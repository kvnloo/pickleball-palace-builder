/**
 * RobotControllerManager - Singleton for managing robot state without React hooks
 *
 * This manager handles robot pathfinding and state updates without per-frame
 * allocations. It reads store state via getState() instead of hook closures.
 */

import { useSimulationStore } from '@/stores/simulationStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { FacilityPathfinder, moveAlongPath, pathLength, distance } from '@/lib/pathfinding';
import { parseCourtId } from '@/types/facility';

interface RobotControllerState {
  currentPath: Array<{ x: number; z: number }>;
  cleaningPath: Array<{ x: number; z: number }>;
  rotation: number;
}

// Pre-allocated empty state to avoid creating objects on every frame
const EMPTY_STATE: RobotControllerState = {
  currentPath: [],
  cleaningPath: [],
  rotation: 0,
};

class RobotControllerManager {
  private robotStates: Map<string, RobotControllerState> = new Map();
  private pathfinder: FacilityPathfinder | null = null;
  private lastConfigHash: string = '';

  /**
   * Initialize or reinitialize the pathfinder when config changes
   */
  init(): void {
    const { config, spacing } = useFacilityStore.getState();
    const configHash = `${config.rows}-${config.mode === 'even' ? config.cols : config.maxCols}-${spacing}`;

    if (configHash !== this.lastConfigHash) {
      const rows = config.rows;
      const cols = config.mode === 'even' ? config.cols : config.maxCols;
      const rowLengths = config.mode === 'uneven' ? config.rowLengths : undefined;
      this.pathfinder = new FacilityPathfinder(rows, cols, spacing, rowLengths);
      this.lastConfigHash = configHash;
    }
  }

  /**
   * Get or create robot state (lazy init into map once)
   */
  private getOrCreateState(robotId: string): RobotControllerState {
    let state = this.robotStates.get(robotId);
    if (!state) {
      // Create state once per robot, not per frame
      state = {
        currentPath: [],
        cleaningPath: [],
        rotation: 0,
      };
      this.robotStates.set(robotId, state);
    }
    return state;
  }

  /**
   * Main update method called from WorldUpdateLoop
   */
  update(delta: number): void {
    if (!this.pathfinder) {
      this.init();
      if (!this.pathfinder) return;
    }

    const simStore = useSimulationStore.getState();
    const facilityStore = useFacilityStore.getState();

    const { robots, courts, cleaningQueue, dockPosition, isPlaying, speed } = simStore;
    const { robotSettings } = facilityStore;

    if (!isPlaying) return;

    const adjustedDelta = delta * speed;

    // Process each robot
    for (let i = 0; i < robots.length; i++) {
      const robot = robots[i];
      const state = this.getOrCreateState(robot.id);

      switch (robot.status) {
        case 'navigating': {
          if (state.currentPath.length === 0) {
            // Arrived at court, start cleaning
            if (robot.targetCourtId) {
              const { row, col } = parseCourtId(robot.targetCourtId);
              const cleaningPath = this.pathfinder!.getCleaningPath(row, col);
              // Mutate state in place
              state.currentPath.length = 0;
              state.cleaningPath = cleaningPath;
              simStore.updateRobot(robot.id, { status: 'cleaning', cleaningProgress: 0 });
              simStore.setCourtStatus(robot.targetCourtId, 'CLEANING');
            }
          } else {
            // Move along path
            const moveDistance = robotSettings.navigationSpeed * adjustedDelta;
            const result = moveAlongPath(robot.position, state.currentPath, moveDistance);

            // Update state in place
            state.currentPath = result.remainingPath;
            state.rotation = result.rotation;

            simStore.updateRobot(robot.id, {
              position: result.position,
              battery: robot.battery - moveDistance * robotSettings.batteryDrainPerMeter * 0.01,
            });
          }
          break;
        }

        case 'cleaning': {
          if (state.cleaningPath.length === 0) {
            // Cleaning complete
            if (robot.targetCourtId && robot.currentJobId) {
              simStore.setCourtStatus(robot.targetCourtId, 'AVAILABLE_CLEAN');
              simStore.updateCourtCleanliness(robot.targetCourtId, 100);
              simStore.dequeueCleaningJob(robot.currentJobId);

              const { row, col } = parseCourtId(robot.targetCourtId);
              simStore.addNotification(`Court ${row + 1}-${col + 1} cleaned`);

              simStore.updateRobot(robot.id, {
                status: 'idle',
                targetCourtId: null,
                currentJobId: null,
                cleaningProgress: 0,
                battery: robot.battery - robotSettings.batteryDrainPerCourt,
              });
            }
          } else {
            // Clean along path
            const moveDistance = robotSettings.cleaningSpeed * adjustedDelta;
            const result = moveAlongPath(robot.position, state.cleaningPath, moveDistance);

            // Calculate progress
            const totalLength = pathLength(this.pathfinder!.getCleaningPath(
              parseCourtId(robot.targetCourtId!).row,
              parseCourtId(robot.targetCourtId!).col
            ));
            const remainingLength = pathLength(result.remainingPath);
            const progress = ((totalLength - remainingLength) / totalLength) * 100;

            // Update cleanliness based on progress
            if (robot.targetCourtId) {
              const court = courts.get(robot.targetCourtId);
              if (court) {
                const newCleanliness = court.cleanliness + (100 - court.cleanliness) * (adjustedDelta / 3);
                simStore.updateCourtCleanliness(robot.targetCourtId, Math.min(100, newCleanliness));
              }
            }

            // Update state in place
            state.cleaningPath = result.remainingPath;
            state.rotation = result.rotation;

            simStore.updateRobot(robot.id, {
              position: result.position,
              cleaningProgress: progress,
            });
          }
          break;
        }

        case 'returning': {
          if (state.currentPath.length === 0) {
            simStore.updateRobot(robot.id, { status: 'charging' });
          } else {
            const moveDistance = robotSettings.navigationSpeed * adjustedDelta;
            const result = moveAlongPath(robot.position, state.currentPath, moveDistance);

            state.currentPath = result.remainingPath;
            state.rotation = result.rotation;

            simStore.updateRobot(robot.id, {
              position: result.position,
              battery: robot.battery - moveDistance * robotSettings.batteryDrainPerMeter * 0.01,
            });
          }
          break;
        }

        case 'charging': {
          const newBattery = Math.min(100, robot.battery + robotSettings.rechargeRatePerMinute * adjustedDelta / 60);
          simStore.updateRobot(robot.id, { battery: newBattery });

          if (newBattery >= 95) {
            simStore.updateRobot(robot.id, { status: 'idle' });
          }
          break;
        }

        case 'idle': {
          // Check for new jobs
          break;
        }
      }
    }

    // Assign jobs to idle robots
    this.assignJobs();
  }

  /**
   * Assign cleaning jobs to idle robots
   */
  private assignJobs(): void {
    if (!this.pathfinder) return;

    const simStore = useSimulationStore.getState();
    const { robots, cleaningQueue, courts, dockPosition } = simStore;

    for (let i = 0; i < robots.length; i++) {
      const robot = robots[i];

      if (robot.status === 'idle' && robot.battery > 20) {
        // Find unassigned job
        const job = cleaningQueue.find((j) => !j.assignedRobotId);
        if (job) {
          const { row, col } = parseCourtId(job.courtId);
          const court = courts.get(job.courtId);

          // Don't clean if court is in use
          if (court && court.status === 'IN_USE') continue;

          // Calculate path to court
          const path = this.pathfinder!.getPathToCourtEntrance(robot.position, row, col);

          const state = this.getOrCreateState(robot.id);
          state.currentPath = path;
          state.cleaningPath = [];
          state.rotation = 0;

          simStore.updateRobot(robot.id, {
            status: 'navigating',
            targetCourtId: job.courtId,
            currentJobId: job.id,
          });

          simStore.addNotification(`Robot ${robot.name} dispatched to Court ${row + 1}-${col + 1}`);
        }
      } else if (robot.status === 'idle' && robot.battery <= 20 && distance(robot.position, dockPosition) > 0.5) {
        // Low battery, return to dock
        const path = this.pathfinder!.getPathToDock(robot.position, dockPosition);

        const state = this.getOrCreateState(robot.id);
        state.currentPath = path;
        state.cleaningPath = [];
        state.rotation = 0;

        simStore.updateRobot(robot.id, { status: 'returning' });
      }
    }
  }

  /**
   * Get robot rotation for rendering
   */
  getRobotRotation(robotId: string): number {
    const state = this.robotStates.get(robotId);
    return state ? state.rotation : 0;
  }
}

// Export singleton instance
export const robotManager = new RobotControllerManager();
