 import { create } from 'zustand';
 import { GameState, BallState, PlayerState, ShotType, Team, SHOT_CONFIGS, GRAVITY, BOUNCE_DAMPING, NET_HEIGHT_AT_CENTER } from '@/types/game';
 import { COURT_WIDTH, COURT_LENGTH, KITCHEN_DEPTH } from '@/types/facility';
 
 // Pre-allocated vector for calculations
 const tempVec = { x: 0, y: 0, z: 0 };
 
 interface GameStore {
   games: Map<string, GameState>;
   
   // Actions
   initializeGame: (courtId: string, courtPosition: { x: number; z: number }) => void;
   updateGame: (courtId: string, deltaSeconds: number) => void;
   endGame: (courtId: string) => void;
   getGame: (courtId: string) => GameState | undefined;
 }
 
 function createInitialBallState(): BallState {
   return {
     position: { x: 0, y: 0, z: 0 },
     velocity: { x: 0, y: 0, z: 0 },
     isVisible: false,
     lastHitBy: 0,
     shotType: 'serve',
   };
 }
 
 function createInitialPlayerStates(courtPosition: { x: number; z: number }): PlayerState[] {
   const halfWidth = COURT_WIDTH / 2;
   const halfLength = COURT_LENGTH / 2;
   
   // 4 players: 2 on each side
   return [
     // Team A - near side
     {
       animState: 'ready',
       targetPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
       currentPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
       facingAngle: 0,
       swingPhase: 0,
       swingType: 'drive',
       team: 'A',
       playerIndex: 0,
     },
     {
       animState: 'ready',
       targetPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
       currentPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z - halfLength * 0.6 },
       facingAngle: 0,
       swingPhase: 0,
       swingType: 'drive',
       team: 'A',
       playerIndex: 1,
     },
     // Team B - far side
     {
       animState: 'ready',
       targetPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
       currentPosition: { x: courtPosition.x - halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
       facingAngle: Math.PI,
       swingPhase: 0,
       swingType: 'drive',
       team: 'B',
       playerIndex: 2,
     },
     {
       animState: 'ready',
       targetPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
       currentPosition: { x: courtPosition.x + halfWidth * 0.3, z: courtPosition.z + halfLength * 0.6 },
       facingAngle: Math.PI,
       swingPhase: 0,
       swingType: 'drive',
       team: 'B',
       playerIndex: 3,
     },
   ];
 }
 
 function selectShot(): ShotType {
   const rand = Math.random();
   if (rand < 0.4) return 'drive';
   if (rand < 0.6) return 'dink';
   if (rand < 0.75) return 'drop';
   if (rand < 0.9) return 'volley';
   return 'lob';
 }
 
 function calculateShotVelocity(
   from: { x: number; z: number },
   to: { x: number; z: number },
   shotType: ShotType
 ): { x: number; y: number; z: number } {
   const config = SHOT_CONFIGS[shotType];
   const dx = to.x - from.x;
   const dz = to.z - from.z;
   const distance = Math.sqrt(dx * dx + dz * dz);
   
   // Calculate time of flight based on arc height
   const timeUp = Math.sqrt(2 * config.arcHeight / Math.abs(GRAVITY));
   const totalTime = timeUp * 2;
   
   // Add some variance
   const variance = 1 + (Math.random() - 0.5) * config.variance * 2;
   
   return {
     x: (dx / totalTime) * variance,
     y: Math.sqrt(2 * Math.abs(GRAVITY) * config.arcHeight),
     z: (dz / totalTime) * variance,
   };
 }
 
 export const useGameStore = create<GameStore>((set, get) => ({
   games: new Map(),
   
   initializeGame: (courtId: string, courtPosition: { x: number; z: number }) => {
     const game: GameState = {
       courtId,
       teamAScore: 0,
       teamBScore: 0,
       servingTeam: 'A',
       serverNumber: 2, // Start with server 2 (first server of game)
       receiverNumber: 1,
       gameNumber: 1,
       rallyCount: 0,
       status: 'serving',
       ballState: createInitialBallState(),
       playerStates: createInitialPlayerStates(courtPosition),
       lastPointTime: 0,
       gameStartTime: performance.now(),
     };
     
     // Position ball for serve
     const serverIndex = game.servingTeam === 'A' ? 0 : 2;
     const serverPos = game.playerStates[serverIndex].currentPosition;
     game.ballState.position = { x: serverPos.x, y: 1.0, z: serverPos.z };
     game.ballState.isVisible = true;
     
     set(state => {
       const newGames = new Map(state.games);
       newGames.set(courtId, game);
       return { games: newGames };
     });
   },
   
   updateGame: (courtId: string, deltaSeconds: number) => {
     const state = get();
     const game = state.games.get(courtId);
     if (!game) return;
     
     const ball = game.ballState;
     const players = game.playerStates;
     
     // State machine for game progression
     switch (game.status) {
       case 'waiting':
         // Wait 2 seconds then serve
         if (performance.now() - game.lastPointTime > 2000) {
           game.status = 'serving';
           const serverIndex = game.servingTeam === 'A' ? (game.serverNumber - 1) : (game.serverNumber + 1);
           const serverPos = players[serverIndex]?.currentPosition || players[0].currentPosition;
           ball.position = { x: serverPos.x, y: 1.0, z: serverPos.z };
           ball.isVisible = true;
           players[serverIndex].animState = 'serve';
           players[serverIndex].swingPhase = 0;
         }
         break;
         
       case 'serving':
         // Animate serve
         const serverIndex = game.servingTeam === 'A' ? (game.serverNumber - 1) : (game.serverNumber + 1);
         const server = players[serverIndex] || players[0];
         server.swingPhase += deltaSeconds * 2;
         
         if (server.swingPhase >= 1) {
           server.animState = 'ready';
           server.swingPhase = 0;
           
           // Launch ball to opponent's court
           const targetZ = game.servingTeam === 'A' 
             ? ball.position.z + COURT_LENGTH * 0.7
             : ball.position.z - COURT_LENGTH * 0.7;
           const targetX = ball.position.x + (Math.random() - 0.5) * COURT_WIDTH * 0.5;
           
           ball.velocity = calculateShotVelocity(
             { x: ball.position.x, z: ball.position.z },
             { x: targetX, z: targetZ },
             'serve'
           );
           ball.shotType = 'serve';
           ball.lastHitBy = serverIndex;
           
           game.status = 'rally';
           game.rallyCount = 1;
         }
         break;
         
       case 'rally':
         // Update ball physics
         ball.velocity.y += GRAVITY * deltaSeconds;
         ball.position.x += ball.velocity.x * deltaSeconds;
         ball.position.y += ball.velocity.y * deltaSeconds;
         ball.position.z += ball.velocity.z * deltaSeconds;
         
         // Check for bounce
         if (ball.position.y <= 0.037) {
           ball.position.y = 0.037;
           ball.velocity.y = -ball.velocity.y * BOUNCE_DAMPING;
           
           // Check if ball is out of bounds or in kitchen on serve
           const courtCenter = players[0].currentPosition.z + COURT_LENGTH / 2 * (game.servingTeam === 'A' ? 1 : -1);
           
           // Simplified: end point after bounce
           if (Math.abs(ball.velocity.y) < 0.5) {
             // Ball stopped - determine point winner
             const scoringTeam: Team = ball.velocity.z > 0 ? 'A' : 'B';
             scorePoint(game, scoringTeam);
           }
         }
         
         // Check for player hit (simplified - based on proximity)
         players.forEach((player, idx) => {
           if (idx === ball.lastHitBy) return;
           
           const dx = ball.position.x - player.currentPosition.x;
           const dz = ball.position.z - player.currentPosition.z;
           const dist = Math.sqrt(dx * dx + dz * dz);
           
           // Player can hit if ball is close and at reachable height
           if (dist < 1.5 && ball.position.y < 2.0 && ball.position.y > 0.2) {
             // Chance to miss
             if (Math.random() < 0.12) {
               const missedTeam = player.team;
               const scoringTeam = missedTeam === 'A' ? 'B' : 'A';
               scorePoint(game, scoringTeam);
               return;
             }
             
             // Return shot
             player.animState = 'swing';
             player.swingPhase = 0;
             player.swingType = selectShot();
             
             // Target opponent's side
             const targetTeam = player.team === 'A' ? 'B' : 'A';
             const targetPlayer = players.find(p => p.team === targetTeam) || players[0];
             const targetX = targetPlayer.currentPosition.x + (Math.random() - 0.5) * COURT_WIDTH * 0.8;
             const targetZ = targetPlayer.currentPosition.z + (Math.random() - 0.5) * COURT_LENGTH * 0.3;
             
             ball.velocity = calculateShotVelocity(
               { x: ball.position.x, z: ball.position.z },
               { x: targetX, z: targetZ },
               player.swingType
             );
             ball.lastHitBy = idx;
             ball.shotType = player.swingType;
             game.rallyCount++;
           }
         });
         
         // Update player animations
         players.forEach(player => {
           if (player.animState === 'swing') {
             player.swingPhase += deltaSeconds * 4;
             if (player.swingPhase >= 1) {
               player.animState = 'ready';
               player.swingPhase = 0;
             }
           }
           
           // Move towards target position
           const dx = player.targetPosition.x - player.currentPosition.x;
           const dz = player.targetPosition.z - player.currentPosition.z;
           const dist = Math.sqrt(dx * dx + dz * dz);
           if (dist > 0.1) {
             const speed = 3 * deltaSeconds;
             player.currentPosition.x += (dx / dist) * Math.min(speed, dist);
             player.currentPosition.z += (dz / dist) * Math.min(speed, dist);
             player.facingAngle = Math.atan2(dx, dz);
           }
         });
         break;
         
       case 'point_scored':
         // Celebration animation
         const winner = game.teamAScore > game.teamBScore ? 'A' : 'B';
         players.forEach(player => {
           if (player.team === winner) {
             player.animState = 'celebrate';
           }
         });
         
         // Wait then reset
         if (performance.now() - game.lastPointTime > 1500) {
           game.status = 'waiting';
           players.forEach(p => p.animState = 'ready');
           ball.isVisible = false;
         }
         break;
         
       case 'game_over':
         // Game complete
         break;
     }
     
     // Update state
     set(state => {
       const newGames = new Map(state.games);
       newGames.set(courtId, { ...game });
       return { games: newGames };
     });
   },
   
   endGame: (courtId: string) => {
     set(state => {
       const newGames = new Map(state.games);
       newGames.delete(courtId);
       return { games: newGames };
     });
   },
   
   getGame: (courtId: string) => {
     return get().games.get(courtId);
   },
 }));
 
 function scorePoint(game: GameState, scoringTeam: Team) {
   // Only serving team can score
   if (scoringTeam === game.servingTeam) {
     if (game.servingTeam === 'A') {
       game.teamAScore++;
     } else {
       game.teamBScore++;
     }
     // Server switches sides
     game.serverNumber = game.serverNumber === 1 ? 2 : 1;
   } else {
     // Side out
     if (game.serverNumber === 2) {
       // Second server lost, switch sides
       game.servingTeam = game.servingTeam === 'A' ? 'B' : 'A';
       game.serverNumber = 1;
     } else {
       // First server lost, second server gets it
       game.serverNumber = 2;
     }
   }
   
   game.lastPointTime = performance.now();
   game.status = 'point_scored';
   game.ballState.isVisible = false;
   
   // Check for game over (11 points, win by 2)
   const maxScore = Math.max(game.teamAScore, game.teamBScore);
   const minScore = Math.min(game.teamAScore, game.teamBScore);
   if (maxScore >= 11 && maxScore - minScore >= 2) {
     game.status = 'game_over';
   }
 }