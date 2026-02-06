import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PickleballCourt } from './PickleballCourt';
import { useFacilityStore } from '@/stores/facilityStore';
import { COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

function FacilityScene() {
  const { config, surfaceType, spacing, showNet, showLines } = useFacilityStore();

  // Calculate court positions
  const courtPositions = useMemo(() => {
    const positions: Array<{ x: number; z: number; key: string }> = [];
    const rows = config.rows;
    const courtWidthWithSpacing = COURT_WIDTH + spacing;
    const courtLengthWithSpacing = COURT_LENGTH + spacing;

    for (let row = 0; row < rows; row++) {
      const cols = config.mode === 'even' ? config.cols : config.rowLengths[row] ?? config.maxCols;
      for (let col = 0; col < cols; col++) {
        const x = col * courtWidthWithSpacing + COURT_WIDTH / 2;
        const z = row * courtLengthWithSpacing + COURT_LENGTH / 2;
        positions.push({ x, z, key: `${row}-${col}` });
      }
    }
    return positions;
  }, [config, spacing]);

  // Calculate bounds for ground plane
  const bounds = useMemo(() => {
    const rows = config.rows;
    const maxCols = config.mode === 'even' ? config.cols : Math.max(...config.rowLengths, config.maxCols);
    const width = maxCols * (COURT_WIDTH + spacing) - spacing + 4;
    const length = rows * (COURT_LENGTH + spacing) - spacing + 4;
    const centerX = (maxCols * (COURT_WIDTH + spacing) - spacing) / 2;
    const centerZ = (rows * (COURT_LENGTH + spacing) - spacing) / 2;
    return { width, length, centerX, centerZ };
  }, [config, spacing]);

  // Camera target
  const target = useMemo(() => {
    return new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
  }, [bounds]);

  if (config.rows === 0 || (config.mode === 'even' && config.cols === 0)) {
    return null;
  }

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 100, 50]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <directionalLight position={[-30, 50, -30]} intensity={0.3} />

      {/* Controls */}
      <OrbitControls
        target={target}
        minDistance={5}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2 - 0.1}
      />

      {/* Ground plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bounds.centerX, -0.02, bounds.centerZ]}
        receiveShadow
      >
        <planeGeometry args={[bounds.width, bounds.length]} />
        <meshLambertMaterial color="#1f2937" />
      </mesh>

      {/* Courts */}
      {courtPositions.map(({ x, z, key }) => (
        <group key={key} position={[x, 0, z]}>
          <PickleballCourt
            surfaceType={surfaceType}
            showNet={showNet}
            showLines={showLines}
          />
        </group>
      ))}
    </>
  );
}

export function FacilityCanvas() {
  const { config, spacing } = useFacilityStore();

  const initialCameraPosition = useMemo(() => {
    const rows = config.rows;
    const cols = config.mode === 'even' ? config.cols : config.maxCols;
    const facilityWidth = cols * (COURT_WIDTH + spacing);
    const facilityLength = rows * (COURT_LENGTH + spacing);
    const maxDim = Math.max(facilityWidth, facilityLength);
    const distance = maxDim * 1.2;

    return [
      facilityWidth / 2 + distance * 0.6,
      distance * 0.8,
      facilityLength / 2 + distance * 0.6,
    ] as [number, number, number];
  }, [config, spacing]);

  return (
    <div className="w-full h-full bg-muted">
      <Canvas
        shadows
        camera={{
          fov: 50,
          near: 0.1,
          far: 1000,
          position: initialCameraPosition,
        }}
      >
        <FacilityScene />
      </Canvas>
    </div>
  );
}
