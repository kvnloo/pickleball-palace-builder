import { useMemo } from 'react';
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
const paddleMaterial = new THREE.MeshLambertMaterial({ color: '#1a1a1a' });

// Pre-created player materials
const playerMaterials = [
  new THREE.MeshLambertMaterial({ color: '#3b82f6' }),
  new THREE.MeshLambertMaterial({ color: '#ef4444' }),
  new THREE.MeshLambertMaterial({ color: '#22c55e' }),
  new THREE.MeshLambertMaterial({ color: '#f59e0b' }),
];

export function Player({ position, color, index }: PlayerProps) {
  // Use pre-created material or create custom one if color provided
  const playerMaterial = useMemo(() =>
    color
      ? new THREE.MeshLambertMaterial({ color })
      : playerMaterials[index % playerMaterials.length],
    [color, index]
  );

  return (
    <group position={[position.x, 0, position.z]}>
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
        <mesh geometry={paddleGeometry} material={paddleMaterial} position={[0.15, 0, 0]} />
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
