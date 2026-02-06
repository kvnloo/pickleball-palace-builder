import { useMemo, memo } from 'react';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { GameState } from '@/types/game';

interface Scoreboard3DProps {
  gameState: GameState;
  courtPosition: { x: number; z: number };
}

// Shared materials
const boardMaterial = new THREE.MeshBasicMaterial({
  color: '#1a1a2e',
  transparent: true,
  opacity: 0.9
});

const boardGeometry = new THREE.PlaneGeometry(2.5, 1.2);

export const Scoreboard3D = memo(function Scoreboard3D({ gameState, courtPosition }: Scoreboard3DProps) {
  const { teamAScore, teamBScore, servingTeam, serverNumber, rallyCount, gameNumber, status } = gameState;

  // Format score in traditional pickleball format: "Server-Receiver-ServerNumber"
  const scoreDisplay = useMemo(() => {
    if (servingTeam === 'A') {
      return `${teamAScore}-${teamBScore}-${serverNumber}`;
    } else {
      return `${teamBScore}-${teamAScore}-${serverNumber}`;
    }
  }, [teamAScore, teamBScore, servingTeam, serverNumber]);

  const statusText = useMemo(() => {
    switch (status) {
      case 'serving': return 'SERVING';
      case 'rally': return `RALLY ${rallyCount}`;
      case 'point_scored': return 'POINT!';
      case 'game_over': return 'GAME OVER';
      default: return '';
    }
  }, [status, rallyCount]);

  const servingIndicator = servingTeam === 'A' ? '◀' : '▶';

  return (
    <Billboard
      position={[courtPosition.x, 4, courtPosition.z]}
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      {/* Background panel */}
      <mesh geometry={boardGeometry} material={boardMaterial} />

      {/* Score display */}
      <Text
        position={[0, 0.2, 0.01]}
        fontSize={0.5}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Inter-Bold.woff"
      >
        {scoreDisplay}
      </Text>

      {/* Team labels */}
      <Text
        position={[-0.8, 0.2, 0.01]}
        fontSize={0.15}
        color={servingTeam === 'A' ? '#22c55e' : '#94a3b8'}
        anchorX="center"
        anchorY="middle"
      >
        {servingTeam === 'A' ? servingIndicator : ''}
      </Text>

      <Text
        position={[0.8, 0.2, 0.01]}
        fontSize={0.15}
        color={servingTeam === 'B' ? '#22c55e' : '#94a3b8'}
        anchorX="center"
        anchorY="middle"
      >
        {servingTeam === 'B' ? servingIndicator : ''}
      </Text>

      {/* Status line */}
      <Text
        position={[0, -0.25, 0.01]}
        fontSize={0.12}
        color={status === 'point_scored' ? '#f59e0b' : '#94a3b8'}
        anchorX="center"
        anchorY="middle"
      >
        {statusText}
      </Text>

      {/* Game number */}
      <Text
        position={[0, -0.45, 0.01]}
        fontSize={0.1}
        color="#64748b"
        anchorX="center"
        anchorY="middle"
      >
        {`Game ${gameNumber}`}
      </Text>
    </Billboard>
  );
});
