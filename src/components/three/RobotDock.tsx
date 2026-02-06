import { memo } from 'react';
import * as THREE from 'three';

// Shared geometries
const dockBaseGeometry = new THREE.BoxGeometry(1.5, 0.05, 1);
const dockRampGeometry = new THREE.BoxGeometry(0.8, 0.02, 0.3);
const dockPoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
const dockSignGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.02);

// Shared materials
const dockBaseMaterial = new THREE.MeshLambertMaterial({ color: '#374151' });
const dockAccentMaterial = new THREE.MeshLambertMaterial({ color: '#22c55e' });
const poleMaterial = new THREE.MeshLambertMaterial({ color: '#6b7280' });
const signMaterial = new THREE.MeshLambertMaterial({ color: '#1f2937' });

interface RobotDockProps {
  position: { x: number; z: number };
  hasRobot: boolean;
}

// Component implementation (note: export function RobotDock is memo-wrapped for performance)
export const RobotDock = memo(function RobotDock({ position, hasRobot }: RobotDockProps) {
  return (
    <group position={[position.x, 0, position.z]}>
      {/* Base platform */}
      <mesh geometry={dockBaseGeometry} material={dockBaseMaterial} position={[0, 0.025, 0]} receiveShadow />
      
      {/* Green accent strip */}
      <mesh position={[0, 0.055, 0.35]}>
        <boxGeometry args={[1.2, 0.02, 0.1]} />
        <primitive object={dockAccentMaterial} />
      </mesh>

      {/* Entry ramp */}
      <mesh geometry={dockRampGeometry} material={dockBaseMaterial} position={[0, 0.01, 0.6]} rotation={[0.1, 0, 0]} />

      {/* Pole */}
      <mesh geometry={dockPoleGeometry} material={poleMaterial} position={[-0.6, 0.4, -0.35]} />

      {/* Sign */}
      <mesh geometry={dockSignGeometry} material={signMaterial} position={[-0.6, 0.7, -0.35]}>
        {/* Add charging icon */}
      </mesh>

      {/* Charging indicator light */}
      <mesh position={[-0.6, 0.9, -0.35]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshLambertMaterial
          color={hasRobot ? '#22c55e' : '#6b7280'}
          emissive={hasRobot ? '#22c55e' : '#6b7280'}
          emissiveIntensity={hasRobot ? 0.8 : 0.2}
        />
      </mesh>

      {/* Contact plates */}
      {[-0.3, 0.3].map((xOffset) => (
        <mesh key={xOffset} position={[xOffset, 0.06, -0.3]}>
          <boxGeometry args={[0.15, 0.02, 0.2]} />
          <meshLambertMaterial color="#fbbf24" />
        </mesh>
      ))}
    </group>
  );
});
