 import { useEffect } from 'react';
 import { useFrame } from '@react-three/fiber';
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
 
 export function GameSession({ courtId, courtPosition, isActive }: GameSessionProps) {
   const { initializeGame, updateGame, endGame, getGame } = useGameStore();
   const tier = usePerformanceStore(state => state.tier);
   
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
   }, [isActive, courtId, courtPosition.x, courtPosition.z]);
   
   // Update game physics
   useFrame((_, delta) => {
     if (!isActive) return;
     
     // Cap delta to prevent physics explosions
     const cappedDelta = Math.min(delta, 0.05);
     updateGame(courtId, cappedDelta);
   });
   
   const game = getGame(courtId);
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
 }