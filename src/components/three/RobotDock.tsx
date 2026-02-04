import * as THREE from 'three';

// Shared geometries
const dockBaseGeometry = new THREE.BoxGeometry(1.5, 0.05, 1);
const dockRampGeometry = new THREE.BoxGeometry(0.8, 0.02, 0.3);
const dockPoleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8);
const dockSignGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.02);

// Shared materials
const dockBaseMaterial = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.7, metalness: 0.2 });
const dockAccentMaterial = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.4, metalness: 0.1 });
const poleMaterial = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.5, metalness: 0.4 });
const signMaterial = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.3 });

interface RobotDockProps {
  position: { x: number; z: number };
  hasRobot: boolean;
}

export function RobotDock({ position, hasRobot }: RobotDockProps) {
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
        <meshStandardMaterial
          color={hasRobot ? '#22c55e' : '#6b7280'}
          emissive={hasRobot ? '#22c55e' : '#6b7280'}
          emissiveIntensity={hasRobot ? 0.8 : 0.2}
        />
      </mesh>

      {/* Contact plates */}
      {[-0.3, 0.3].map((xOffset) => (
        <mesh key={xOffset} position={[xOffset, 0.06, -0.3]}>
          <boxGeometry args={[0.15, 0.02, 0.2]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.2} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
