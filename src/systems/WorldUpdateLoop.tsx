/**
 * WorldUpdateLoop - Consolidated render loop with single useFrame hook
 *
 * This component consolidates all per-frame updates into a single useFrame hook
 * with priority -1 (highest R3F scheduling priority). It dispatches systems in
 * correct priority order:
 *   P0: Performance tracking (every frame)
 *   P1: Physics/game updates (every frame)
 *   P2: Simulation tick (every 4th frame)
 *   P3: Robot pathfinding (every 8th frame)
 *
 * Frame-skipped systems receive accumulated delta to prevent time loss.
 */

import { useFrame } from '@react-three/fiber';
import { usePerformanceStore } from '@/stores/performanceStore';
import { useGameStore } from '@/stores/gameStore';
import { useSimulationStore } from '@/stores/simulationStore';
import { robotManager } from './RobotControllerManager';

// Frame-skip intervals
const SIM_SKIP_INTERVAL = 4;   // Simulation runs every 4th frame (15fps at 60fps)
const ROBOT_SKIP_INTERVAL = 8; // Robot pathfinding runs every 8th frame (7.5fps at 60fps)

// Module-level state (not React state - avoids allocations)
let frameCount = 0;
let simAccumulator = 0;
let robotAccumulator = 0;

export function WorldUpdateLoop() {
  // Get store actions via stable references
  const recordFrame = usePerformanceStore.getState().recordFrame;
  const updateAllGames = useGameStore.getState().updateAllGames;

  useFrame((_, delta) => {
    // Cap delta to prevent physics explosions (50ms max)
    const cappedDelta = Math.min(delta, 0.05);

    // Increment frame counter
    frameCount++;

    // Accumulate delta for frame-skipped systems
    simAccumulator += cappedDelta;
    robotAccumulator += cappedDelta;

    // P0: Performance tracking (every frame)
    recordFrame(cappedDelta * 1000);

    // P1: Physics/game updates (every frame)
    updateAllGames(cappedDelta);

    // P2: Simulation tick (every 4th frame)
    if (frameCount % SIM_SKIP_INTERVAL === 0) {
      const simStore = useSimulationStore.getState();
      if (simStore.isPlaying) {
        // Convert accumulated delta to simulated minutes
        const simulatedMinutes = simAccumulator * simStore.speed;
        simStore.tick(simulatedMinutes);
      }
      simAccumulator = 0;
    }

    // P3: Robot pathfinding (every 8th frame)
    if (frameCount % ROBOT_SKIP_INTERVAL === 0) {
      robotManager.update(robotAccumulator);
      robotAccumulator = 0;
    }
  }, -1); // Priority -1 = highest priority in R3F

  return null;
}
