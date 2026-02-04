import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlayerProps {
  position: { x: number; z: number };
  color?: string;
  index: number;
}

// Player dimensions
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.25;
const HEAD_RADIUS = 0.15;

// Shared geometries
const bodyGeometry = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2 - HEAD_RADIUS * 2, 4, 8);
const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS, 8, 8);
const paddleGeometry = new THREE.BoxGeometry(0.2, 0.02, 0.15);

// Paddle material
const paddleMaterial = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.5 });

const playerColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];

export function Player({ position, color, index }: PlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const paddleRef = useRef<THREE.Mesh>(null);
  const animationOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const playerColor = color || playerColors[index % playerColors.length];
  const playerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: playerColor, roughness: 0.6 }),
    [playerColor]
  );

  // Idle animation
  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime + animationOffset;
      
      // Subtle body sway
      groupRef.current.rotation.y = Math.sin(time * 0.5) * 0.1;
      groupRef.current.position.y = Math.sin(time * 2) * 0.02;
      
      // Paddle swing animation
      if (paddleRef.current) {
        paddleRef.current.rotation.x = Math.sin(time * 3) * 0.3;
        paddleRef.current.rotation.z = Math.cos(time * 2) * 0.2;
      }
    }
  });

  return (
    <group ref={groupRef} position={[position.x, 0, position.z]}>
      {/* Body */}
      <mesh
        geometry={bodyGeometry}
        material={playerMaterial}
        position={[0, PLAYER_HEIGHT / 2, 0]}
        castShadow
      />
      
      {/* Head */}
      <mesh
        geometry={headGeometry}
        material={playerMaterial}
        position={[0, PLAYER_HEIGHT - HEAD_RADIUS, 0]}
        castShadow
      />

      {/* Paddle arm */}
      <group position={[PLAYER_RADIUS + 0.1, PLAYER_HEIGHT * 0.6, 0]}>
        <mesh ref={paddleRef} geometry={paddleGeometry} material={paddleMaterial} position={[0.15, 0, 0]} />
      </group>
    </group>
  );
}

interface PlayerGroupProps {
  playerCount: 2 | 4;
  courtPosition: { x: number; z: number };
  courtWidth: number;
  courtLength: number;
}

export function PlayerGroup({ playerCount, courtPosition, courtWidth, courtLength }: PlayerGroupProps) {
  // Position players on the court
  const positions = useMemo(() => {
    const halfWidth = courtWidth / 2;
    const halfLength = courtLength / 2;
    
    if (playerCount === 2) {
      return [
        { x: courtPosition.x, z: courtPosition.z - halfLength * 0.6 },
        { x: courtPosition.x, z: courtPosition.z + halfLength * 0.6 },
      ];
    } else {
      return [
        { x: courtPosition.x - halfWidth * 0.4, z: courtPosition.z - halfLength * 0.6 },
        { x: courtPosition.x + halfWidth * 0.4, z: courtPosition.z - halfLength * 0.6 },
        { x: courtPosition.x - halfWidth * 0.4, z: courtPosition.z + halfLength * 0.6 },
        { x: courtPosition.x + halfWidth * 0.4, z: courtPosition.z + halfLength * 0.6 },
      ];
    }
  }, [playerCount, courtPosition, courtWidth, courtLength]);

  return (
    <group>
      {positions.map((pos, i) => (
        <Player key={i} position={pos} index={i} />
      ))}
    </group>
  );
}
