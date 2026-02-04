import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '@/stores/simulationStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { FacilityPathfinder, moveAlongPath, pathLength, distance } from '@/lib/pathfinding';
import { parseCourtId, COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

interface RobotControllerState {
  currentPath: Array<{ x: number; z: number }>;
  cleaningPath: Array<{ x: number; z: number }>;
  rotation: number;
}

export function useRobotController() {
  const robotStates = useRef<Map<string, RobotControllerState>>(new Map());

  const {
    robots,
    courts,
    cleaningQueue,
    dockPosition,
    isPlaying,
    speed,
    updateRobot,
    setCourtStatus,
    updateCourtCleanliness,
    dequeueCleaningJob,
    addNotification,
  } = useSimulationStore();

  const { config, spacing, robotSettings } = useFacilityStore();

  // Create pathfinder
  const pathfinder = useRef<FacilityPathfinder | null>(null);
  
  useEffect(() => {
    const rows = config.rows;
    const cols = config.mode === 'even' ? config.cols : config.maxCols;
    const rowLengths = config.mode === 'uneven' ? config.rowLengths : undefined;
    pathfinder.current = new FacilityPathfinder(rows, cols, spacing, rowLengths);
  }, [config, spacing]);

  // Assign jobs to idle robots
  const assignJobs = useCallback(() => {
    if (!pathfinder.current) return;

    robots.forEach((robot) => {
      if (robot.status === 'idle' && robot.battery > 20) {
        // Find unassigned job
        const job = cleaningQueue.find((j) => !j.assignedRobotId);
        if (job) {
          const { row, col } = parseCourtId(job.courtId);
          const court = courts.get(job.courtId);
          
          // Don't clean if court is in use
          if (court && court.status === 'IN_USE') return;

          // Calculate path to court
          const path = pathfinder.current!.getPathToCourtEntrance(robot.position, row, col);
          
          robotStates.current.set(robot.id, {
            currentPath: path,
            cleaningPath: [],
            rotation: 0,
          });

          updateRobot(robot.id, {
            status: 'navigating',
            targetCourtId: job.courtId,
            currentJobId: job.id,
          });

          // Mark job as assigned
          const updatedQueue = cleaningQueue.map((j) =>
            j.id === job.id ? { ...j, assignedRobotId: robot.id } : j
          );
          
          addNotification(`Robot ${robot.name} dispatched to Court ${row + 1}-${col + 1}`);
        }
      } else if (robot.status === 'idle' && robot.battery <= 20 && distance(robot.position, dockPosition) > 0.5) {
        // Low battery, return to dock
        const path = pathfinder.current!.getPathToDock(robot.position, dockPosition);
        robotStates.current.set(robot.id, {
          currentPath: path,
          cleaningPath: [],
          rotation: 0,
        });
        updateRobot(robot.id, { status: 'returning' });
      }
    });
  }, [robots, cleaningQueue, courts, dockPosition, updateRobot, addNotification]);

  // Main update loop
  useFrame((_, delta) => {
    if (!isPlaying || !pathfinder.current) return;

    const adjustedDelta = delta * speed;

    robots.forEach((robot) => {
      const state = robotStates.current.get(robot.id) || {
        currentPath: [],
        cleaningPath: [],
        rotation: 0,
      };

      switch (robot.status) {
        case 'navigating': {
          if (state.currentPath.length === 0) {
            // Arrived at court, start cleaning
            if (robot.targetCourtId) {
              const { row, col } = parseCourtId(robot.targetCourtId);
              const cleaningPath = pathfinder.current!.getCleaningPath(row, col);
              robotStates.current.set(robot.id, {
                ...state,
                currentPath: [],
                cleaningPath,
              });
              updateRobot(robot.id, { status: 'cleaning', cleaningProgress: 0 });
              setCourtStatus(robot.targetCourtId, 'CLEANING');
            }
          } else {
            // Move along path
            const moveDistance = robotSettings.navigationSpeed * adjustedDelta;
            const result = moveAlongPath(robot.position, state.currentPath, moveDistance);
            
            robotStates.current.set(robot.id, {
              ...state,
              currentPath: result.remainingPath,
              rotation: result.rotation,
            });
            
            updateRobot(robot.id, {
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
              setCourtStatus(robot.targetCourtId, 'AVAILABLE_CLEAN');
              updateCourtCleanliness(robot.targetCourtId, 100);
              dequeueCleaningJob(robot.currentJobId);
              
              const { row, col } = parseCourtId(robot.targetCourtId);
              addNotification(`Court ${row + 1}-${col + 1} cleaned`);
              
              // Return to dock or find next job
              updateRobot(robot.id, {
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
            const totalLength = pathLength(pathfinder.current!.getCleaningPath(
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
                updateCourtCleanliness(robot.targetCourtId, Math.min(100, newCleanliness));
              }
            }
            
            robotStates.current.set(robot.id, {
              ...state,
              cleaningPath: result.remainingPath,
              rotation: result.rotation,
            });
            
            updateRobot(robot.id, {
              position: result.position,
              cleaningProgress: progress,
            });
          }
          break;
        }

        case 'returning': {
          if (state.currentPath.length === 0) {
            // Arrived at dock
            updateRobot(robot.id, { status: 'charging' });
          } else {
            const moveDistance = robotSettings.navigationSpeed * adjustedDelta;
            const result = moveAlongPath(robot.position, state.currentPath, moveDistance);
            
            robotStates.current.set(robot.id, {
              ...state,
              currentPath: result.remainingPath,
              rotation: result.rotation,
            });
            
            updateRobot(robot.id, {
              position: result.position,
              battery: robot.battery - moveDistance * robotSettings.batteryDrainPerMeter * 0.01,
            });
          }
          break;
        }

        case 'charging': {
          // Recharge battery
          const newBattery = Math.min(100, robot.battery + robotSettings.rechargeRatePerMinute * adjustedDelta / 60);
          updateRobot(robot.id, { battery: newBattery });
          
          if (newBattery >= 95) {
            updateRobot(robot.id, { status: 'idle' });
          }
          break;
        }

        case 'idle': {
          // Check for new jobs periodically
          break;
        }
      }
    });

    // Periodically assign jobs
    assignJobs();
  });

  return {
    getRobotRotation: (robotId: string) => {
      const state = robotStates.current.get(robotId);
      return state?.rotation || 0;
    },
  };
}
