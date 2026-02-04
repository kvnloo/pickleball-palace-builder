import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Facility } from './Facility';
import { FacilityState, COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

interface CameraControllerProps {
  state: FacilityState;
}

function CameraController({ state }: CameraControllerProps) {
  const { camera } = useThree();
  const initialized = useRef(false);

  useEffect(() => {
    const { config, spacing } = state;
    const rows = config.rows;
    const cols = config.mode === 'even' ? config.cols : config.maxCols;

    if (rows === 0 || cols === 0) return;

    // Calculate facility center
    const facilityWidth = cols * (COURT_WIDTH + spacing) - spacing;
    const facilityLength = rows * (COURT_LENGTH + spacing) - spacing;
    const centerX = facilityWidth / 2;
    const centerZ = facilityLength / 2;

    // Calculate camera distance based on facility size
    const maxDimension = Math.max(facilityWidth, facilityLength);
    const distance = maxDimension * 1.2;

    // Position camera at 45° angle looking at center
    const cameraHeight = distance * 0.8;
    const cameraOffset = distance * 0.6;

    camera.position.set(
      centerX + cameraOffset,
      cameraHeight,
      centerZ + cameraOffset
    );
    camera.lookAt(centerX, 0, centerZ);
    
    initialized.current = true;
  }, [state.config.rows, state.config.mode === 'even' ? state.config.cols : state.config.maxCols, state.spacing, camera]);

  return null;
}

interface FacilityCanvasProps {
  state: FacilityState;
}

export function FacilityCanvas({ state }: FacilityCanvasProps) {
  // Calculate target for OrbitControls
  const target = (() => {
    const { config, spacing } = state;
    const rows = config.rows;
    const cols = config.mode === 'even' ? config.cols : config.maxCols;
    
    if (rows === 0 || cols === 0) return new THREE.Vector3(0, 0, 0);
    
    const facilityWidth = cols * (COURT_WIDTH + spacing) - spacing;
    const facilityLength = rows * (COURT_LENGTH + spacing) - spacing;
    
    return new THREE.Vector3(facilityWidth / 2, 0, facilityLength / 2);
  })();

  return (
    <div className="w-full h-full bg-muted">
      <Canvas
        shadows
        camera={{ 
          fov: 50, 
          near: 0.1, 
          far: 1000,
          position: [20, 20, 20]
        }}
      >
        <CameraController state={state} />
        
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
        <directionalLight
          position={[-30, 50, -30]}
          intensity={0.3}
        />
        
        {/* Controls */}
        <OrbitControls
          target={target}
          minDistance={5}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />
        
        {/* Facility */}
        <Facility state={state} />
      </Canvas>
    </div>
  );
}
