import { useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '@/stores/simulationStore';
import { useFacilityStore } from '@/stores/facilityStore';

export function useSimulation() {
  const { config } = useFacilityStore();
  const { 
    isPlaying, 
    speed, 
    tick, 
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

  // Simulation tick driven by useFrame for smooth animation
  useFrame((_, delta) => {
    if (!isPlaying) return;
    
    // Convert real seconds to simulated minutes
    // At 1x speed, 1 real second = 1 simulated minute
    const simulatedMinutes = delta * speed;
    tick(simulatedMinutes);
  });

  return {
    currentTime,
    isPlaying,
    speed,
  };
}
