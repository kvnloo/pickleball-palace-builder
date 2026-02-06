/**
 * useSimulation - Hook for simulation initialization and state access
 *
 * NOTE: The simulation tick is now handled by WorldUpdateLoop.
 * This hook only handles court initialization when config changes
 * and exposes simulation state for components.
 */
import { useEffect } from 'react';
import { useSimulationStore } from '@/stores/simulationStore';
import { useFacilityStore } from '@/stores/facilityStore';

export function useSimulation() {
  const { config } = useFacilityStore();
  const {
    isPlaying,
    speed,
    initializeCourts,
    currentTime,
  } = useSimulationStore();

  // Initialize courts when config changes
  useEffect(() => {
    const rows = config.rows;
    if (config.mode === 'even') {
      initializeCourts(rows, config.cols);
    } else {
      initializeCourts(rows, config.maxCols, config.rowLengths);
    }
  }, [config, initializeCourts]);

  // Simulation tick is now driven by WorldUpdateLoop

  return {
    currentTime,
    isPlaying,
    speed,
  };
}
