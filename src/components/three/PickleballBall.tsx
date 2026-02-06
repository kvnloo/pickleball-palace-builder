import { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BallState } from '@/types/game';

// Shared geometry and material for all balls
const ballGeometry = new THREE.SphereGeometry(0.037, 12, 8);
const ballMaterial = new THREE.MeshLambertMaterial({
  color: '#ffff00',
});

// Hole pattern material (simplified - just color variation)
const ballMaterialWithHoles = new THREE.MeshLambertMaterial({
  color: '#f0f000',
});

// Pre-created trail materials (module-level singletons)
const trailMaterial1 = new THREE.MeshBasicMaterial({
  color: '#ffff00',
  transparent: true,
  opacity: 0.4,
});

const trailMaterial2 = new THREE.MeshBasicMaterial({
  color: '#ffff00',
  transparent: true,
  opacity: 0.2,
});

interface PickleballBallProps {
  ballState: BallState;
  showTrail?: boolean;
}

// Component implementation (note: export function PickleballBall is memo-wrapped for performance)
export const PickleballBall = memo(function PickleballBall({ ballState, showTrail = false }: PickleballBallProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const trail1Ref = useRef<THREE.Mesh>(null);
  const trail2Ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // Null guards for all refs
    if (!groupRef.current || !meshRef.current || !trail1Ref.current || !trail2Ref.current) return;

    // Update group visibility based on ball state
    groupRef.current.visible = ballState.isVisible;

    // Update main ball position
    meshRef.current.position.set(
      ballState.position.x,
      ballState.position.y,
      ballState.position.z
    );

    // Update trail visibility
    trail1Ref.current.visible = showTrail;
    trail2Ref.current.visible = showTrail;

    // Update trail positions based on velocity
    const pos = ballState.position;
    const velocity = ballState.velocity;

    trail1Ref.current.position.set(
      pos.x - velocity.x * 0.02,
      pos.y - velocity.y * 0.02,
      pos.z - velocity.z * 0.02
    );

    trail2Ref.current.position.set(
      pos.x - velocity.x * 0.04,
      pos.y - velocity.y * 0.04,
      pos.z - velocity.z * 0.04
    );
  });

  return (
    <group ref={groupRef}>
      {/* Main ball */}
      <mesh
        ref={meshRef}
        geometry={ballGeometry}
        material={ballMaterial}
        castShadow
      />

      {/* Trail meshes - always rendered, visibility controlled via ref */}
      <mesh
        ref={trail1Ref}
        geometry={ballGeometry}
        material={trailMaterial1}
      />
      <mesh
        ref={trail2Ref}
        geometry={ballGeometry}
        material={trailMaterial2}
      />
    </group>
  );
});
