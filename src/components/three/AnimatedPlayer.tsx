import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlayerState } from '@/types/game';

// Player dimensions
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.22;
const HEAD_RADIUS = 0.14;

// Shared geometries - created once
const bodyGeometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2 - HEAD_RADIUS * 2, 4, 8);
const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS, 8, 8);
const armGeometry = new THREE.CapsuleGeometry(0.06, 0.4, 2, 4);
const paddleGeometry = new THREE.BoxGeometry(0.18, 0.02, 0.12);

// Team colors - PERF: Using Lambert materials for faster rendering
const teamAMaterial = new THREE.MeshLambertMaterial({ color: '#3b82f6' });
const teamBMaterial = new THREE.MeshLambertMaterial({ color: '#ef4444' });
const skinMaterial = new THREE.MeshLambertMaterial({ color: '#e0b090' });
const paddleMaterial = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });

interface AnimatedPlayerProps {
  playerState: PlayerState;
  playerIndex: number;
}

// Custom comparator for React.memo - checks specific fields of playerState
function areAnimatedPlayerPropsEqual(
  prevProps: AnimatedPlayerProps,
  nextProps: AnimatedPlayerProps
): boolean {
  const prev = prevProps.playerState;
  const next = nextProps.playerState;

  return (
    prevProps.playerIndex === nextProps.playerIndex &&
    prev.team === next.team &&
    prev.animState === next.animState &&
    prev.swingPhase === next.swingPhase &&
    prev.facingAngle === next.facingAngle &&
    prev.currentPosition.x === next.currentPosition.x &&
    prev.currentPosition.z === next.currentPosition.z
  );
}

// Component implementation (note: export function AnimatedPlayer is memo-wrapped for performance)
export const AnimatedPlayer = memo(function AnimatedPlayer({ playerState, playerIndex }: AnimatedPlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);

  const bodyMaterial = playerState.team === 'A' ? teamAMaterial : teamBMaterial;

  // Calculate arm rotation based on animation state
  const armRotation = useMemo(() => {
    switch (playerState.animState) {
      case 'swing':
        // Swing animation: rotate arm forward
        const swingAngle = Math.sin(playerState.swingPhase * Math.PI) * 1.5;
        return { x: -swingAngle, y: 0, z: 0.2 };
      case 'serve':
        // Serve: underhand motion
        const serveAngle = playerState.swingPhase * Math.PI;
        return { x: Math.sin(serveAngle) * 1.2 - 0.5, y: 0, z: 0.3 };
      case 'celebrate':
        // Arms up!
        return { x: -2.5, y: 0, z: 0.5 };
      case 'ready':
        return { x: -0.3, y: 0, z: 0.2 };
      default:
        return { x: 0, y: 0, z: 0.1 };
    }
  }, [playerState.animState, playerState.swingPhase]);

  // PERF: Body bob animation via useFrame - avoids useMemo with performance.now() anti-pattern
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    if (playerState.animState === 'celebrate') {
      groupRef.current.position.y = Math.sin(t * 10) * 0.1;
    } else if (playerState.animState === 'moving') {
      groupRef.current.position.y = Math.sin(t * 20) * 0.05;
    } else {
      groupRef.current.position.y = 0;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[
        playerState.currentPosition.x,
        0,
        playerState.currentPosition.z
      ]}
      rotation={[0, playerState.facingAngle, 0]}
    >
      {/* Body */}
      <mesh
        geometry={bodyGeometry}
        material={bodyMaterial}
        position={[0, PLAYER_HEIGHT / 2, 0]}
        castShadow
      />

      {/* Head */}
      <mesh
        geometry={headGeometry}
        material={skinMaterial}
        position={[0, PLAYER_HEIGHT - HEAD_RADIUS, 0]}
        castShadow
      />

      {/* Right arm with paddle */}
      <group
        ref={armRef}
        position={[PLAYER_RADIUS + 0.08, PLAYER_HEIGHT * 0.65, 0]}
        rotation={[armRotation.x, armRotation.y, armRotation.z]}
      >
        {/* Upper arm */}
        <mesh
          geometry={armGeometry}
          material={skinMaterial}
          position={[0, -0.15, 0]}
          rotation={[0, 0, 0]}
        />

        {/* Paddle */}
        <mesh
          geometry={paddleGeometry}
          material={paddleMaterial}
          position={[0.1, -0.35, 0]}
          rotation={[0.2, 0, 0.3]}
        />
      </group>

      {/* Left arm */}
      <group
        position={[-PLAYER_RADIUS - 0.08, PLAYER_HEIGHT * 0.65, 0]}
        rotation={[-0.2, 0, -0.2]}
      >
        <mesh
          geometry={armGeometry}
          material={skinMaterial}
          position={[0, -0.15, 0]}
        />
      </group>
    </group>
  );
}, areAnimatedPlayerPropsEqual);
