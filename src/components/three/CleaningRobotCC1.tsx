import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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
const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.3, metalness: 0.1 });
const baseMaterial = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.6, metalness: 0.2 });
const screenMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a2e', roughness: 0.1, metalness: 0.3 });
const screenActiveMaterial = new THREE.MeshStandardMaterial({ color: '#00ff88', roughness: 0.1, metalness: 0.3, emissive: '#00ff88', emissiveIntensity: 0.3 });
const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
const brushMaterial = new THREE.MeshStandardMaterial({ color: '#4a9eff', roughness: 0.7 });

export function CleaningRobotCC1({ position, rotation = 0, status, battery }: CleaningRobotCC1Props) {
  const groupRef = useRef<THREE.Group>(null);
  const brushRef = useRef<THREE.Mesh>(null);
  const wheelRefs = useRef<THREE.Mesh[]>([]);

  // Animate brush and wheels
  useFrame((_, delta) => {
    if (status === 'cleaning' || status === 'navigating') {
      // Spin brush
      if (brushRef.current) {
        brushRef.current.rotation.y += delta * 10;
      }
      // Rotate wheels
      wheelRefs.current.forEach((wheel) => {
        if (wheel) {
          wheel.rotation.x += delta * 5 * (status === 'cleaning' ? 0.5 : 1);
        }
      });
    }
  });

  const currentScreenMaterial = status === 'idle' || status === 'charging' ? screenMaterial : screenActiveMaterial;

  // Battery indicator color
  const batteryColor = battery > 60 ? '#22c55e' : battery > 30 ? '#f59e0b' : '#ef4444';
  const batteryMaterial = useMemo(() => 
    new THREE.MeshStandardMaterial({ color: batteryColor, emissive: batteryColor, emissiveIntensity: 0.5 }),
    [batteryColor]
  );

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
        <boxGeometry args={[ROBOT_WIDTH * 0.3 * (battery / 100), 0.02, 0.01]} />
        <primitive object={batteryMaterial} />
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
          ref={(el) => { if (el) wheelRefs.current[i] = el; }}
          geometry={wheelGeometry}
          material={wheelMaterial}
          position={[pos.x, 0.06, pos.z]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        />
      ))}

      {/* Side brush */}
      <mesh
        ref={brushRef}
        geometry={brushGeometry}
        material={brushMaterial}
        position={[-ROBOT_WIDTH * 0.35, 0.02, ROBOT_LENGTH * 0.4]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Status light */}
      <mesh position={[0, ROBOT_HEIGHT + 0.05, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial
          color={status === 'cleaning' ? '#8b5cf6' : status === 'navigating' ? '#3b82f6' : status === 'charging' ? '#22c55e' : '#94a3b8'}
          emissive={status === 'cleaning' ? '#8b5cf6' : status === 'navigating' ? '#3b82f6' : status === 'charging' ? '#22c55e' : '#94a3b8'}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
}
