import { useRef, useMemo, memo } from 'react';
import * as THREE from 'three';
import { RobotStatus } from '@/types/facility';

interface CleaningRobotCC1Props {
  position: { x: number; z: number };
  rotation?: number;
  status: RobotStatus;
  battery: number;
}

// Pudu CC1 dimensions in meters
const ROBOT_LENGTH = 0.629;
const ROBOT_WIDTH = 0.552;
const ROBOT_HEIGHT = 0.695;

// Shared geometries
const bodyGeometry = new THREE.BoxGeometry(ROBOT_WIDTH * 0.9, ROBOT_HEIGHT * 0.7, ROBOT_LENGTH * 0.9);
const baseGeometry = new THREE.BoxGeometry(ROBOT_WIDTH, ROBOT_HEIGHT * 0.15, ROBOT_LENGTH);
const screenGeometry = new THREE.BoxGeometry(ROBOT_WIDTH * 0.6, ROBOT_HEIGHT * 0.25, 0.02);
const wheelGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
const brushGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8);

// Shared materials
const bodyMaterial = new THREE.MeshLambertMaterial({ color: '#e8e8e8' });
const baseMaterial = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
const screenMaterial = new THREE.MeshLambertMaterial({ color: '#1a1a2e' });
const screenActiveMaterial = new THREE.MeshLambertMaterial({ color: '#00ff88', emissive: '#00ff88', emissiveIntensity: 0.3 });
const wheelMaterial = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });
const brushMaterial = new THREE.MeshLambertMaterial({ color: '#4a9eff' });

// Pre-created status light materials
const statusLightMaterials = {
  cleaning: new THREE.MeshLambertMaterial({ color: '#8b5cf6', emissive: '#8b5cf6', emissiveIntensity: 0.8 }),
  navigating: new THREE.MeshLambertMaterial({ color: '#3b82f6', emissive: '#3b82f6', emissiveIntensity: 0.8 }),
  charging: new THREE.MeshLambertMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.8 }),
  idle: new THREE.MeshLambertMaterial({ color: '#94a3b8', emissive: '#94a3b8', emissiveIntensity: 0.8 }),
};

// Status light geometry
const statusLightGeometry = new THREE.SphereGeometry(0.03, 8, 8);

// Pre-created battery materials
const batteryMaterials = {
  high: new THREE.MeshLambertMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 0.5 }),
  medium: new THREE.MeshLambertMaterial({ color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.5 }),
  low: new THREE.MeshLambertMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.5 }),
};

// Component implementation (note: export function CleaningRobotCC1 is memo-wrapped for performance)
export const CleaningRobotCC1 = memo(function CleaningRobotCC1({ position, rotation = 0, status, battery }: CleaningRobotCC1Props) {
  const groupRef = useRef<THREE.Group>(null);

  const currentScreenMaterial = status === 'idle' || status === 'charging' ? screenMaterial : screenActiveMaterial;

  // Use pre-created battery material
  const batteryMaterial = battery > 60 ? batteryMaterials.high 
    : battery > 30 ? batteryMaterials.medium 
    : batteryMaterials.low;
  
  // Use pre-created status light material
  const statusLightMaterial = status === 'cleaning' ? statusLightMaterials.cleaning
    : status === 'navigating' ? statusLightMaterials.navigating
    : status === 'charging' ? statusLightMaterials.charging
    : statusLightMaterials.idle;
  
  // Battery indicator width
  const batteryWidth = ROBOT_WIDTH * 0.3 * (battery / 100);

  return (
    <group ref={groupRef} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
      {/* Base deck */}
      <mesh geometry={baseGeometry} material={baseMaterial} position={[0, ROBOT_HEIGHT * 0.075, 0]} castShadow />

      {/* Main body */}
      <mesh geometry={bodyGeometry} material={bodyMaterial} position={[0, ROBOT_HEIGHT * 0.5, 0]} castShadow />

      {/* Face screen */}
      <mesh
        geometry={screenGeometry}
        material={currentScreenMaterial}
        position={[0, ROBOT_HEIGHT * 0.55, ROBOT_LENGTH * 0.45]}
      />

      {/* Battery indicator */}
      <mesh position={[0, ROBOT_HEIGHT * 0.7, ROBOT_LENGTH * 0.45]}>
        <boxGeometry args={[batteryWidth, 0.02, 0.01]} />
        <primitive object={batteryMaterial} attach="material" />
      </mesh>

      {/* Wheels */}
      {[
        { x: -ROBOT_WIDTH * 0.4, z: -ROBOT_LENGTH * 0.3 },
        { x: ROBOT_WIDTH * 0.4, z: -ROBOT_LENGTH * 0.3 },
        { x: -ROBOT_WIDTH * 0.4, z: ROBOT_LENGTH * 0.3 },
        { x: ROBOT_WIDTH * 0.4, z: ROBOT_LENGTH * 0.3 },
      ].map((pos, i) => (
        <mesh
          key={i}
          geometry={wheelGeometry}
          material={wheelMaterial}
          position={[pos.x, 0.06, pos.z]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        />
      ))}

      {/* Side brush */}
      <mesh
        geometry={brushGeometry}
        material={brushMaterial}
        position={[-ROBOT_WIDTH * 0.35, 0.02, ROBOT_LENGTH * 0.4]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Status light */}
      <mesh
        position={[0, ROBOT_HEIGHT + 0.05, 0]}
        geometry={statusLightGeometry}
        material={statusLightMaterial}
      />
    </group>
  );
});
