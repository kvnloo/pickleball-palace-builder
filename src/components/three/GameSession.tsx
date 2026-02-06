/**
 * GameSession - Renders pickleball game visuals (ball, players, scoreboard)
 *
 * NOTE: Physics updates are now handled by WorldUpdateLoop via updateAllGames().
 * This component only handles lifecycle (init/cleanup) and rendering.
 */
import { useEffect, memo } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { usePerformanceStore } from '@/stores/performanceStore';
import { PickleballBall } from './PickleballBall';
import { Scoreboard3D } from './Scoreboard3D';
import { AnimatedPlayer } from './AnimatedPlayer';

interface GameSessionProps {
  courtId: string;
  courtPosition: { x: number; z: number };
  isActive: boolean;
}

export const GameSession = memo(function GameSession({ courtId, courtPosition, isActive }: GameSessionProps) {
  // Use per-court Zustand selectors instead of destructuring entire store
  const game = useGameStore(s => s.games.get(courtId));
  const initializeGame = useGameStore(s => s.initializeGame);
  const updateGame = useGameStore(s => s.updateGame);
  const endGame = useGameStore(s => s.endGame);
  const tier = usePerformanceStore(state => state.tier);

  // updateGame is handled by WorldUpdateLoop, but we keep the selector for consistency
  void updateGame;

  // Initialize game when court becomes active
  useEffect(() => {
    if (isActive) {
      initializeGame(courtId, courtPosition);
    } else {
      endGame(courtId);
    }

    return () => {
      endGame(courtId);
    };
  }, [isActive, courtId, courtPosition.x, courtPosition.z, initializeGame, endGame]);

  // Physics updates are handled by WorldUpdateLoop.updateAllGames()

  if (!game || !isActive) return null;

  const showTrail = tier !== 'ULTRA';

  return (
    <group>
      {/* Ball */}
      <PickleballBall ballState={game.ballState} showTrail={showTrail} />

      {/* Players */}
      {game.playerStates.map((player, index) => (
        <AnimatedPlayer
          key={index}
          playerState={player}
          playerIndex={index}
        />
      ))}

      {/* Scoreboard */}
      <Scoreboard3D gameState={game} courtPosition={courtPosition} />
    </group>
  );
});
