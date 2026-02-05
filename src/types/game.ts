 // Game simulation types for pickleball gameplay
 
 export type ShotType = 'serve' | 'drive' | 'lob' | 'dink' | 'drop' | 'volley';
 
 export type GameStatus = 'waiting' | 'serving' | 'rally' | 'point_scored' | 'game_over';
 
 export type Team = 'A' | 'B';
 
 export interface BallState {
   position: { x: number; y: number; z: number };
   velocity: { x: number; y: number; z: number };
   isVisible: boolean;
   lastHitBy: number; // Player index (0-3)
   shotType: ShotType;
 }
 
 export type PlayerAnimState = 'idle' | 'ready' | 'moving' | 'swing' | 'serve' | 'celebrate';
 
 export interface PlayerState {
   animState: PlayerAnimState;
   targetPosition: { x: number; z: number };
   currentPosition: { x: number; z: number };
   facingAngle: number;
   swingPhase: number; // 0-1
   swingType: ShotType;
   team: Team;
   playerIndex: number; // 0-3 on court
 }
 
 export interface GameState {
   courtId: string;
   teamAScore: number;
   teamBScore: number;
   servingTeam: Team;
   serverNumber: 1 | 2; // For doubles
   receiverNumber: 1 | 2;
   gameNumber: number;
   rallyCount: number;
   status: GameStatus;
   ballState: BallState;
   playerStates: PlayerState[];
   lastPointTime: number;
   gameStartTime: number;
 }
 
 // Pre-computed shot trajectories for performance
 export interface ShotTrajectory {
   type: ShotType;
   initialVelocity: { x: number; y: number; z: number };
   duration: number; // seconds
   arcHeight: number;
 }
 
 export const SHOT_CONFIGS: Record<ShotType, { speed: number; arcHeight: number; variance: number }> = {
   serve: { speed: 12, arcHeight: 1.5, variance: 0.1 },
   drive: { speed: 18, arcHeight: 0.5, variance: 0.15 },
   lob: { speed: 10, arcHeight: 4, variance: 0.2 },
   dink: { speed: 4, arcHeight: 0.3, variance: 0.05 },
   drop: { speed: 7, arcHeight: 1.8, variance: 0.1 },
   volley: { speed: 14, arcHeight: 0.4, variance: 0.2 },
 };
 
 // Physics constants
 export const GRAVITY = -9.81;
 export const BOUNCE_DAMPING = 0.65;
 export const BALL_RADIUS = 0.037; // 37mm pickleball
 export const NET_HEIGHT_AT_CENTER = 0.86; // meters