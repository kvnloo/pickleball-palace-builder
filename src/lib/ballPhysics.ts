 import { BallState, ShotType, SHOT_CONFIGS, GRAVITY, BOUNCE_DAMPING, BALL_RADIUS } from '@/types/game';
 import { COURT_WIDTH, COURT_LENGTH, NET_HEIGHT_CENTER } from '@/types/facility';
 
 // Pre-allocated vectors for zero-GC updates
 const tempPos = { x: 0, y: 0, z: 0 };
 const tempVel = { x: 0, y: 0, z: 0 };
 
 export interface BallPhysicsResult {
   position: { x: number; y: number; z: number };
   velocity: { x: number; y: number; z: number };
   bounced: boolean;
   hitNet: boolean;
   outOfBounds: boolean;
 }
 
 /**
  * Update ball physics for one frame
  * @param ball Current ball state
  * @param deltaSeconds Time delta in seconds
  * @param courtCenterZ Center Z position of the court
  * @returns Updated physics result
  */
 export function updateBallPhysics(
   ball: BallState,
   deltaSeconds: number,
   courtCenterZ: number
 ): BallPhysicsResult {
   // Apply gravity
   tempVel.x = ball.velocity.x;
   tempVel.y = ball.velocity.y + GRAVITY * deltaSeconds;
   tempVel.z = ball.velocity.z;
   
   // Update position
   tempPos.x = ball.position.x + tempVel.x * deltaSeconds;
   tempPos.y = ball.position.y + tempVel.y * deltaSeconds;
   tempPos.z = ball.position.z + tempVel.z * deltaSeconds;
   
   let bounced = false;
   let hitNet = false;
   let outOfBounds = false;
   
   // Ground collision
   if (tempPos.y <= BALL_RADIUS) {
     tempPos.y = BALL_RADIUS;
     tempVel.y = -tempVel.y * BOUNCE_DAMPING;
     bounced = true;
     
     // Apply friction on bounce
     tempVel.x *= 0.85;
     tempVel.z *= 0.85;
   }
   
   // Net collision check (simplified - at court center Z)
   const prevZ = ball.position.z;
   const netZ = courtCenterZ;
   
   // Check if ball crossed net plane
   if ((prevZ < netZ && tempPos.z >= netZ) || (prevZ > netZ && tempPos.z <= netZ)) {
     // Interpolate Y at net crossing
     const t = (netZ - prevZ) / (tempPos.z - prevZ);
     const yAtNet = ball.position.y + (tempPos.y - ball.position.y) * t;
     
     if (yAtNet < NET_HEIGHT_CENTER) {
       hitNet = true;
       // Bounce back
       tempVel.z = -tempVel.z * 0.3;
       tempPos.z = prevZ + tempVel.z * deltaSeconds;
     }
   }
   
   // Out of bounds check (simplified)
   const halfWidth = COURT_WIDTH / 2 + 0.5; // Add margin
   const halfLength = COURT_LENGTH / 2 + 0.5;
   
   if (Math.abs(tempPos.x - courtCenterZ) > halfWidth || 
       Math.abs(tempPos.z - courtCenterZ) > halfLength) {
     outOfBounds = true;
   }
   
   return {
     position: { x: tempPos.x, y: tempPos.y, z: tempPos.z },
     velocity: { x: tempVel.x, y: tempVel.y, z: tempVel.z },
     bounced,
     hitNet,
     outOfBounds,
   };
 }
 
 /**
  * Calculate initial velocity for a shot from one point to another
  * Uses pre-computed arc heights for performance
  */
 export function calculateShotVelocity(
   fromX: number,
   fromZ: number,
   toX: number,
   toZ: number,
   shotType: ShotType,
   startY: number = 1.0
 ): { x: number; y: number; z: number } {
   const config = SHOT_CONFIGS[shotType];
   
   const dx = toX - fromX;
   const dz = toZ - fromZ;
   const distance = Math.sqrt(dx * dx + dz * dz);
   
   // Calculate time to reach peak
   const peakHeight = config.arcHeight;
   const timeUp = Math.sqrt(2 * peakHeight / Math.abs(GRAVITY));
   
   // Total flight time (up + down, accounting for start height)
   const fallHeight = peakHeight + startY;
   const timeDown = Math.sqrt(2 * fallHeight / Math.abs(GRAVITY));
   const totalTime = timeUp + timeDown;
   
   // Horizontal velocity components
   const vx = dx / totalTime;
   const vz = dz / totalTime;
   
   // Vertical velocity to reach peak height
   const vy = Math.sqrt(2 * Math.abs(GRAVITY) * peakHeight);
   
   // Add variance
   const variance = 1 + (Math.random() - 0.5) * config.variance * 2;
   
   return {
     x: vx * variance,
     y: vy,
     z: vz * variance,
   };
 }
 
 /**
  * Pre-compute trajectory points for a shot (for trail rendering)
  * @param startPos Starting position
  * @param velocity Initial velocity
  * @param steps Number of points to compute
  * @param timeStep Time between points
  * @returns Array of positions along trajectory
  */
 export function computeTrajectory(
   startPos: { x: number; y: number; z: number },
   velocity: { x: number; y: number; z: number },
   steps: number = 20,
   timeStep: number = 0.05
 ): Array<{ x: number; y: number; z: number }> {
   const points: Array<{ x: number; y: number; z: number }> = [];
   
   let x = startPos.x;
   let y = startPos.y;
   let z = startPos.z;
   let vy = velocity.y;
   
   for (let i = 0; i < steps; i++) {
     points.push({ x, y, z });
     
     x += velocity.x * timeStep;
     z += velocity.z * timeStep;
     vy += GRAVITY * timeStep;
     y += vy * timeStep;
     
     if (y < 0) break;
   }
   
   return points;
 }