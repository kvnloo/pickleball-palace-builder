import { useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SelectableCourt } from './SelectableCourt';
import { CourtStatusLabel } from './CourtStatusLabel';
import { CleaningRobotCC1 } from './CleaningRobotCC1';
import { RobotDock } from './RobotDock';
import { GameSession } from './GameSession';
import { useSimulationStore } from '@/stores/simulationStore';
import { useFacilityStore } from '@/stores/facilityStore';
import { usePerformanceStore } from '@/stores/performanceStore';
import { useSimulation } from '@/hooks/useSimulation';
import { useRobotController } from '@/hooks/useRobotController';
import { COURT_WIDTH, COURT_LENGTH, Booking } from '@/types/facility';

// Performance tracking component
function PerformanceTracker() {
  const recordFrame = usePerformanceStore(state => state.recordFrame);
  
  useFrame((_, delta) => {
    // Record frame time in milliseconds
    recordFrame(delta * 1000);
  });
  
  return null;
}

function HomebaseScene() {
  const { config, surfaceType, spacing, showNet, showLines } = useFacilityStore();
  const { tier, config: perfConfig } = usePerformanceStore();
  const { 
    courts, 
    bookings, 
    robots, 
    selectedCourtIds, 
    dockPosition,
    selectCourt,
    multiSelectMode,
  } = useSimulationStore();

  // Initialize simulation
  useSimulation();
  
  // Robot controller for pathfinding
  const { getRobotRotation } = useRobotController();

  // Calculate court positions
  const courtPositions = useMemo(() => {
    const positions: Array<{ x: number; z: number; id: string; row: number; col: number }> = [];
    const rows = config.rows;
    const courtWidthWithSpacing = COURT_WIDTH + spacing;
    const courtLengthWithSpacing = COURT_LENGTH + spacing;

    for (let row = 0; row < rows; row++) {
      const cols = config.mode === 'even' ? config.cols : config.rowLengths[row] ?? config.maxCols;
      for (let col = 0; col < cols; col++) {
        const x = col * courtWidthWithSpacing + COURT_WIDTH / 2;
        const z = row * courtLengthWithSpacing + COURT_LENGTH / 2;
        positions.push({ x, z, id: `court-${row}-${col}`, row, col });
      }
    }
    return positions;
  }, [config, spacing]);

  // Get active bookings for each court
  const activeBookingsByCourtId = useMemo(() => {
    const map = new Map<string, Booking>();
    bookings.forEach((booking) => {
      const court = courts.get(booking.courtId);
      if (court && court.status === 'IN_USE' && court.activeBookingId === booking.id) {
        map.set(booking.courtId, booking);
      }
    });
    return map;
  }, [bookings, courts]);

  // Handle court selection
  const handleCourtSelect = useCallback((courtId: string, isMulti: boolean) => {
    if (isMulti || multiSelectMode) {
      const current = selectedCourtIds.has(courtId);
      if (current) {
        useSimulationStore.getState().deselectCourt(courtId);
      } else {
        useSimulationStore.getState().selectCourt(courtId);
      }
    } else {
      useSimulationStore.getState().clearSelection();
      useSimulationStore.getState().selectCourt(courtId);
    }
  }, [selectedCourtIds, multiSelectMode]);

  // Calculate camera target
  const cameraTarget = useMemo(() => {
    if (courtPositions.length === 0) return new THREE.Vector3(0, 0, 0);
    const avgX = courtPositions.reduce((sum, p) => sum + p.x, 0) / courtPositions.length;
    const avgZ = courtPositions.reduce((sum, p) => sum + p.z, 0) / courtPositions.length;
    return new THREE.Vector3(avgX, 0, avgZ);
  }, [courtPositions]);

  // Calculate ground plane size
  const groundSize = useMemo(() => {
    const rows = config.rows;
    const maxCols = config.mode === 'even' ? config.cols : Math.max(...config.rowLengths, config.maxCols);
    return {
      width: maxCols * (COURT_WIDTH + spacing) + 6,
      length: rows * (COURT_LENGTH + spacing) + 6,
      centerX: (maxCols * (COURT_WIDTH + spacing) - spacing) / 2,
      centerZ: (rows * (COURT_LENGTH + spacing) - spacing) / 2,
    };
  }, [config, spacing]);

  // Check if robot is at dock
  const robotAtDock = useMemo(() => {
    return robots.some(r => 
      r.status === 'charging' || 
      (r.status === 'idle' && Math.abs(r.position.x - dockPosition.x) < 0.5 && Math.abs(r.position.z - dockPosition.z) < 0.5)
    );
  }, [robots, dockPosition]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      {perfConfig.shadows ? (
        <directionalLight
          position={[50, 100, 50]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={200}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
      ) : (
        <directionalLight position={[50, 100, 50]} intensity={1} />
      )}
      <directionalLight position={[-30, 50, -30]} intensity={0.3} />
      
      {/* Performance tracker */}
      <PerformanceTracker />

      {/* Controls */}
      <OrbitControls
        target={cameraTarget}
        minDistance={5}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2 - 0.1}
      />

      {/* Ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[groundSize.centerX, -0.02, groundSize.centerZ]}
        receiveShadow
      >
        <planeGeometry args={[groundSize.width, groundSize.length]} />
        <meshStandardMaterial color="#1f2937" roughness={0.9} />
      </mesh>

      {/* Robot dock */}
      <RobotDock position={dockPosition} hasRobot={robotAtDock} />

      {/* Courts */}
      {courtPositions.map(({ x, z, id }) => {
        const courtState = courts.get(id);
        if (!courtState) return null;

        return (
          <group key={id}>
            <SelectableCourt
              courtState={courtState}
              surfaceType={surfaceType}
              showNet={showNet}
              showLines={showLines}
              position={{ x, z }}
              isSelected={selectedCourtIds.has(id)}
              onSelect={handleCourtSelect}
            />
            <CourtStatusLabel courtState={courtState} position={{ x, z }} />
            
            {/* Game session for active courts */}
            {activeBookingsByCourtId.has(id) && (
              <GameSession
                courtId={id}
                courtPosition={{ x, z }}
                isActive={true}
              />
            )}
          </group>
        );
      })}

      {/* Cleaning robots */}
      {robots.map((robot) => (
        <CleaningRobotCC1
          key={robot.id}
          position={robot.position}
          rotation={getRobotRotation(robot.id)}
          status={robot.status}
          battery={robot.battery}
        />
      ))}
    </>
  );
}

export function HomebaseCanvas() {
  const { config, spacing } = useFacilityStore();
  const { config: perfConfig } = usePerformanceStore();
  
  // Calculate initial camera position
  const initialCameraPosition = useMemo(() => {
    const rows = config.rows;
    const cols = config.mode === 'even' ? config.cols : config.maxCols;
    const facilityWidth = cols * (COURT_WIDTH + spacing);
    const facilityLength = rows * (COURT_LENGTH + spacing);
    const maxDim = Math.max(facilityWidth, facilityLength);
    const distance = maxDim * 1.5;
    
    return [
      facilityWidth / 2 + distance * 0.4,
      distance * 0.6,
      facilityLength / 2 + distance * 0.4,
    ] as [number, number, number];
  }, [config, spacing]);

  return (
    <div className="w-full h-full bg-muted">
      <Canvas
        shadows={perfConfig.shadows}
        dpr={perfConfig.pixelRatio}
        gl={{ 
          antialias: perfConfig.antialiasing,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: 50,
          near: 0.1,
          far: 1000,
          position: initialCameraPosition,
        }}
      >
        <HomebaseScene />
      </Canvas>
    </div>
  );
}
