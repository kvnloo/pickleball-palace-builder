/**
 * useRobotController - Hook for accessing robot state
 *
 * NOTE: Robot updates are now handled by RobotControllerManager via WorldUpdateLoop.
 * This hook only exposes the getRobotRotation method for rendering.
 */
import { useEffect } from 'react';
import { useFacilityStore } from '@/stores/facilityStore';
import { robotManager } from '@/systems/RobotControllerManager';

export function useRobotController() {
  const { config, spacing } = useFacilityStore();

  // Initialize pathfinder when config changes
  useEffect(() => {
    robotManager.init();
  }, [config, spacing]);

  // Robot updates are handled by WorldUpdateLoop via robotManager.update()

  return {
    getRobotRotation: (robotId: string) => {
      return robotManager.getRobotRotation(robotId);
    },
  };
}
