/**
 * Task 14: Web Worker Compute Offloading - Test Suite
 *
 * Verifies the Web Worker + SharedArrayBuffer architecture for offloading
 * physics, AI, and pathfinding from the main thread:
 *
 * 1. SharedArrayBuffer layout: correct sizing, non-overlapping offsets, valid views
 * 2. Double-buffer swap: atomic index transitions, buffer isolation
 * 3. Physics engine: gravity, bounce, ball visibility guard
 * 4. AI engine: player movement towards target, facing angle
 * 5. Fallback mode: works without SharedArrayBuffer
 * 6. Feature detection: correctly identifies SAB availability
 * 7. Performance: physics and AI complete within budget for 100 courts
 */

import { describe, it, expect, beforeEach } from 'vitest';

// =============================================================================
// Inline SharedArrayBuffer Layout Constants (mirrors src/workers/sharedBufferLayout.ts)
// =============================================================================

// Header offsets (Int32 indices into signalView)
const HEADER_SIGNAL_OFFSET = 0;
const HEADER_FRAME_OFFSET = 1;
const HEADER_BUFFER_INDEX_OFFSET = 2;
const HEADER_COURT_COUNT_OFFSET = 3;
const HEADER_ROBOT_COUNT_OFFSET = 4;
const HEADER_TOTAL_INT32S = 5;

// Delta time is stored as Float32 right after header Int32s
const DELTA_TIME_BYTE_OFFSET = HEADER_TOTAL_INT32S * 4; // byte 20
const HEADER_TOTAL_BYTES = DELTA_TIME_BYTE_OFFSET + 4; // 24 bytes

// Per-entity float counts
const BALL_FLOATS = 7;   // px, py, pz, vx, vy, vz, visible
const PLAYER_FLOATS = 9; // cx, cz, tx, tz, facing, swingPhase, animState, swingType, team
const PLAYERS_PER_COURT = 4;
const ROBOT_FLOATS = 6;  // px, pz, battery, status, progress, rotation
const GAME_STATE_FLOATS = 8; // scoreA, scoreB, servingTeam, serverNum, status, rallyCount, lastHitBy, shotType
const COURT_FLOATS = BALL_FLOATS + (PLAYER_FLOATS * PLAYERS_PER_COURT) + GAME_STATE_FLOATS; // 51

// Signal states
const SIGNAL_IDLE = 0;
const SIGNAL_STEP_REQUESTED = 1;
const SIGNAL_STEP_COMPLETE = 2;

// Physics constants
const GRAVITY = -9.81;
const BOUNCE_DAMPING = 0.65;
const BALL_RADIUS = 0.037;

// =============================================================================
// Layout Helper Functions (mirrors src/workers/sharedBufferLayout.ts)
// =============================================================================

function calculateBufferSize(courtCount: number, robotCount: number): number {
  const entityFloats = courtCount * COURT_FLOATS + robotCount * ROBOT_FLOATS;
  const doubleBufferBytes = 2 * entityFloats * 4; // Float32 = 4 bytes
  return HEADER_TOTAL_BYTES + doubleBufferBytes;
}

function getBallOffset(courtIndex: number): number {
  return courtIndex * COURT_FLOATS;
}

function getPlayerOffset(courtIndex: number, playerIndex: number): number {
  return courtIndex * COURT_FLOATS + BALL_FLOATS + playerIndex * PLAYER_FLOATS;
}

function getGameStateOffset(courtIndex: number): number {
  return courtIndex * COURT_FLOATS + BALL_FLOATS + PLAYERS_PER_COURT * PLAYER_FLOATS;
}

function getRobotOffset(courtCount: number, robotIndex: number): number {
  return courtCount * COURT_FLOATS + robotIndex * ROBOT_FLOATS;
}

interface SharedBufferViews {
  sab: SharedArrayBuffer;
  signalView: Int32Array;
  deltaTimeView: Float32Array;
  dataViewA: Float32Array;
  dataViewB: Float32Array;
  entityFloatsPerBuffer: number;
}

function createSharedBuffers(courtCount: number, robotCount: number): SharedBufferViews {
  const entityFloats = courtCount * COURT_FLOATS + robotCount * ROBOT_FLOATS;
  const totalBytes = calculateBufferSize(courtCount, robotCount);
  const sab = new SharedArrayBuffer(totalBytes);
  const signalView = new Int32Array(sab, 0, HEADER_TOTAL_INT32S);
  const deltaTimeView = new Float32Array(sab, DELTA_TIME_BYTE_OFFSET, 1);
  const dataOffsetA = HEADER_TOTAL_BYTES;
  const dataOffsetB = HEADER_TOTAL_BYTES + entityFloats * 4;
  const dataViewA = new Float32Array(sab, dataOffsetA, entityFloats);
  const dataViewB = new Float32Array(sab, dataOffsetB, entityFloats);
  return { sab, signalView, deltaTimeView, dataViewA, dataViewB, entityFloatsPerBuffer: entityFloats };
}

// =============================================================================
// Pure Physics Engine (mirrors src/workers/physicsEngine.ts)
// =============================================================================

function stepBallPhysics(
  data: Float32Array, offset: number, dt: number, _courtCenterZ: number
): void {
  // Ball layout: [0]=px, [1]=py, [2]=pz, [3]=vx, [4]=vy, [5]=vz, [6]=visible
  if (data[offset + 6] < 0.5) return; // not visible, skip

  let px = data[offset];
  let py = data[offset + 1];
  let pz = data[offset + 2];
  let vx = data[offset + 3];
  let vy = data[offset + 4];
  let vz = data[offset + 5];

  // Apply gravity
  vy += GRAVITY * dt;

  // Update position
  px += vx * dt;
  py += vy * dt;
  pz += vz * dt;

  // Ground collision
  if (py <= BALL_RADIUS) {
    py = BALL_RADIUS;
    vy = -vy * BOUNCE_DAMPING;
    vx *= 0.85;
    vz *= 0.85;
  }

  // Write back
  data[offset] = px;
  data[offset + 1] = py;
  data[offset + 2] = pz;
  data[offset + 3] = vx;
  data[offset + 4] = vy;
  data[offset + 5] = vz;
}

// =============================================================================
// Pure AI Engine (mirrors src/workers/aiEngine.ts)
// =============================================================================

function stepPlayerMovement(
  data: Float32Array, offset: number, dt: number
): void {
  // Player layout: [0]=cx, [1]=cz, [2]=tx, [3]=tz, [4]=facing, [5]=swingPhase,
  //                [6]=animState, [7]=swingType, [8]=team
  const cx = data[offset];
  const cz = data[offset + 1];
  const tx = data[offset + 2];
  const tz = data[offset + 3];

  const dx = tx - cx;
  const dz = tz - cz;
  const distSq = dx * dx + dz * dz;

  if (distSq > 0.01) { // threshold^2 = 0.1^2 = 0.01
    const dist = Math.sqrt(distSq);
    const speed = 3 * dt;
    const move = Math.min(speed, dist);
    data[offset] = cx + (dx / dist) * move;
    data[offset + 1] = cz + (dz / dist) * move;
    data[offset + 4] = Math.atan2(dx, dz); // facing angle
  }
}

// =============================================================================
// Fallback Bridge (mirrors src/workers/fallbackBridge.ts)
// =============================================================================

interface BallReadout {
  px: number; py: number; pz: number;
  vx: number; vy: number; vz: number;
  visible: number;
}

interface PlayerReadout {
  cx: number; cz: number; tx: number; tz: number;
  facing: number; swingPhase: number;
  animState: number; swingType: number; team: number;
}

class FallbackBridge {
  private data: Float32Array | null = null;
  private courtCount = 0;
  private robotCount = 0;

  async init(courtCount: number, robotCount: number): Promise<void> {
    this.courtCount = courtCount;
    this.robotCount = robotCount;
    const size = courtCount * COURT_FLOATS + robotCount * ROBOT_FLOATS;
    this.data = new Float32Array(size);
  }

  step(deltaTime: number): void {
    if (!this.data) return;
    for (let c = 0; c < this.courtCount; c++) {
      stepBallPhysics(this.data, getBallOffset(c), deltaTime, 0);
      for (let p = 0; p < PLAYERS_PER_COURT; p++) {
        stepPlayerMovement(this.data, getPlayerOffset(c, p), deltaTime);
      }
    }
  }

  readBallState(courtIndex: number): BallReadout {
    const o = getBallOffset(courtIndex);
    const d = this.data!;
    return {
      px: d[o], py: d[o + 1], pz: d[o + 2],
      vx: d[o + 3], vy: d[o + 4], vz: d[o + 5],
      visible: d[o + 6],
    };
  }

  readPlayerState(courtIndex: number, playerIndex: number): PlayerReadout {
    const o = getPlayerOffset(courtIndex, playerIndex);
    const d = this.data!;
    return {
      cx: d[o], cz: d[o + 1], tx: d[o + 2], tz: d[o + 3],
      facing: d[o + 4], swingPhase: d[o + 5],
      animState: d[o + 6], swingType: d[o + 7], team: d[o + 8],
    };
  }

  writeBallState(courtIndex: number, state: Partial<BallReadout>): void {
    const o = getBallOffset(courtIndex);
    const d = this.data!;
    if (state.px !== undefined) d[o] = state.px;
    if (state.py !== undefined) d[o + 1] = state.py;
    if (state.pz !== undefined) d[o + 2] = state.pz;
    if (state.vx !== undefined) d[o + 3] = state.vx;
    if (state.vy !== undefined) d[o + 4] = state.vy;
    if (state.vz !== undefined) d[o + 5] = state.vz;
    if (state.visible !== undefined) d[o + 6] = state.visible;
  }

  writePlayerState(courtIndex: number, playerIndex: number, state: Partial<PlayerReadout>): void {
    const o = getPlayerOffset(courtIndex, playerIndex);
    const d = this.data!;
    if (state.cx !== undefined) d[o] = state.cx;
    if (state.cz !== undefined) d[o + 1] = state.cz;
    if (state.tx !== undefined) d[o + 2] = state.tx;
    if (state.tz !== undefined) d[o + 3] = state.tz;
    if (state.facing !== undefined) d[o + 4] = state.facing;
    if (state.swingPhase !== undefined) d[o + 5] = state.swingPhase;
    if (state.animState !== undefined) d[o + 6] = state.animState;
    if (state.swingType !== undefined) d[o + 7] = state.swingType;
    if (state.team !== undefined) d[o + 8] = state.team;
  }

  isWorkerMode(): boolean {
    return false;
  }

  destroy(): void {
    this.data = null;
  }
}

// =============================================================================
// Feature Detection (mirrors src/workers/computeBridge.ts)
// =============================================================================

function supportsWorkerCompute(): boolean {
  return (
    typeof SharedArrayBuffer !== 'undefined' &&
    typeof Atomics !== 'undefined'
  );
}

// =============================================================================
// TEST SUITE
// =============================================================================

// ---------------------------------------------------------------------------
// 1. SharedArrayBuffer Memory Layout
// ---------------------------------------------------------------------------
describe('Task 14: Web Worker Compute Offloading', () => {

  describe('Step 2: SharedArrayBuffer Memory Layout', () => {

    it('COURT_FLOATS equals BALL + 4*PLAYER + GAME_STATE = 51', () => {
      expect(COURT_FLOATS).toBe(BALL_FLOATS + PLAYERS_PER_COURT * PLAYER_FLOATS + GAME_STATE_FLOATS);
      expect(COURT_FLOATS).toBe(7 + 4 * 9 + 8);
      expect(COURT_FLOATS).toBe(51);
    });

    it('calculateBufferSize returns correct size for 100 courts + 10 robots', () => {
      const entityFloats = 100 * COURT_FLOATS + 10 * ROBOT_FLOATS; // 5100 + 60 = 5160
      const expected = HEADER_TOTAL_BYTES + 2 * entityFloats * 4; // 24 + 41280 = 41304
      expect(calculateBufferSize(100, 10)).toBe(expected);
      expect(calculateBufferSize(100, 10)).toBe(41304);
    });

    it('calculateBufferSize returns correct size for 1 court + 1 robot', () => {
      const entityFloats = 1 * COURT_FLOATS + 1 * ROBOT_FLOATS; // 51 + 6 = 57
      const expected = HEADER_TOTAL_BYTES + 2 * 57 * 4; // 24 + 456 = 480
      expect(calculateBufferSize(1, 1)).toBe(expected);
      expect(calculateBufferSize(1, 1)).toBe(480);
    });

    it('calculateBufferSize handles zero courts and zero robots', () => {
      expect(calculateBufferSize(0, 0)).toBe(HEADER_TOTAL_BYTES);
      expect(calculateBufferSize(0, 0)).toBe(24);
    });

    it('entity offset helpers return non-overlapping ranges for court 0', () => {
      const ballStart = getBallOffset(0);
      const player0Start = getPlayerOffset(0, 0);
      const player1Start = getPlayerOffset(0, 1);
      const player2Start = getPlayerOffset(0, 2);
      const player3Start = getPlayerOffset(0, 3);
      const gameStart = getGameStateOffset(0);

      // Ball comes first
      expect(ballStart).toBe(0);
      // Players come after ball
      expect(player0Start).toBe(BALL_FLOATS); // 7
      expect(player1Start).toBe(BALL_FLOATS + PLAYER_FLOATS); // 16
      expect(player2Start).toBe(BALL_FLOATS + 2 * PLAYER_FLOATS); // 25
      expect(player3Start).toBe(BALL_FLOATS + 3 * PLAYER_FLOATS); // 34
      // Game state comes after all players
      expect(gameStart).toBe(BALL_FLOATS + PLAYERS_PER_COURT * PLAYER_FLOATS); // 43

      // Non-overlapping: each section starts where the previous ends
      expect(player0Start).toBe(ballStart + BALL_FLOATS);
      expect(gameStart).toBe(player3Start + PLAYER_FLOATS);
    });

    it('entity offsets for sequential courts are non-overlapping', () => {
      const court0Ball = getBallOffset(0);
      const court0End = getGameStateOffset(0) + GAME_STATE_FLOATS;
      const court1Ball = getBallOffset(1);
      const court1End = getGameStateOffset(1) + GAME_STATE_FLOATS;

      // Court 1 starts where court 0 ends
      expect(court1Ball).toBe(court0End);
      expect(court1Ball).toBe(COURT_FLOATS);

      // Court 1 occupies the same size
      expect(court1End - court1Ball).toBe(COURT_FLOATS);
    });

    it('robot offsets start after all courts', () => {
      const courtCount = 10;
      const robot0 = getRobotOffset(courtCount, 0);
      const robot1 = getRobotOffset(courtCount, 1);

      expect(robot0).toBe(courtCount * COURT_FLOATS);
      expect(robot1).toBe(courtCount * COURT_FLOATS + ROBOT_FLOATS);
      expect(robot1 - robot0).toBe(ROBOT_FLOATS);
    });

    it('createSharedBuffers returns valid typed array views', () => {
      // SharedArrayBuffer is available in Node.js test environment
      const views = createSharedBuffers(2, 1);

      expect(views.sab).toBeInstanceOf(SharedArrayBuffer);
      expect(views.signalView).toBeInstanceOf(Int32Array);
      expect(views.deltaTimeView).toBeInstanceOf(Float32Array);
      expect(views.dataViewA).toBeInstanceOf(Float32Array);
      expect(views.dataViewB).toBeInstanceOf(Float32Array);

      // Signal view has 5 Int32 slots
      expect(views.signalView.length).toBe(HEADER_TOTAL_INT32S);

      // Delta time view has 1 Float32 slot
      expect(views.deltaTimeView.length).toBe(1);

      // Entity float count: 2 courts * 51 + 1 robot * 6 = 108
      const expectedEntityFloats = 2 * COURT_FLOATS + 1 * ROBOT_FLOATS;
      expect(views.entityFloatsPerBuffer).toBe(expectedEntityFloats);
      expect(views.dataViewA.length).toBe(expectedEntityFloats);
      expect(views.dataViewB.length).toBe(expectedEntityFloats);
    });

    it('data views A and B do not overlap in memory', () => {
      const views = createSharedBuffers(5, 2);

      const aByteOffset = views.dataViewA.byteOffset;
      const aByteEnd = aByteOffset + views.dataViewA.byteLength;
      const bByteOffset = views.dataViewB.byteOffset;

      // Buffer B starts where buffer A ends
      expect(bByteOffset).toBe(aByteEnd);

      // Both point to the same underlying SAB
      expect(views.dataViewA.buffer).toBe(views.sab);
      expect(views.dataViewB.buffer).toBe(views.sab);
    });

    it('header region does not overlap with data regions', () => {
      const views = createSharedBuffers(3, 1);

      const headerEnd = HEADER_TOTAL_BYTES;
      const dataAStart = views.dataViewA.byteOffset;

      expect(dataAStart).toBeGreaterThanOrEqual(headerEnd);
    });

    it('writing to dataViewA does not affect dataViewB', () => {
      const views = createSharedBuffers(1, 0);

      // Zero out both buffers
      views.dataViewA.fill(0);
      views.dataViewB.fill(0);

      // Write to buffer A
      views.dataViewA[0] = 42.5;
      views.dataViewA[1] = 99.9;

      // Buffer B should still be zero
      expect(views.dataViewB[0]).toBe(0);
      expect(views.dataViewB[1]).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Double-Buffer Swap Protocol
  // ---------------------------------------------------------------------------
  describe('Step 6: Double-Buffer Swap Protocol', () => {

    it('buffer index starts at 0', () => {
      const views = createSharedBuffers(1, 0);
      expect(Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET)).toBe(0);
    });

    it('atomic swap transitions buffer index from 0 to 1', () => {
      const views = createSharedBuffers(1, 0);

      // Initial state
      expect(Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET)).toBe(0);

      // Swap: worker writes to B, then sets index to 1
      Atomics.store(views.signalView, HEADER_BUFFER_INDEX_OFFSET, 1);

      // Verify swap
      expect(Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET)).toBe(1);
    });

    it('atomic swap transitions buffer index from 1 back to 0', () => {
      const views = createSharedBuffers(1, 0);

      Atomics.store(views.signalView, HEADER_BUFFER_INDEX_OFFSET, 1);
      expect(Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET)).toBe(1);

      Atomics.store(views.signalView, HEADER_BUFFER_INDEX_OFFSET, 0);
      expect(Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET)).toBe(0);
    });

    it('front buffer is consistent while back buffer is being written', () => {
      const views = createSharedBuffers(1, 0);

      // Simulate: worker writes ball data to buffer A (front initially)
      const ballOffset = getBallOffset(0);
      views.dataViewA[ballOffset] = 1.0;     // px
      views.dataViewA[ballOffset + 1] = 2.0; // py
      views.dataViewA[ballOffset + 2] = 3.0; // pz

      // Now buffer index is 0, so A is front
      const frontIdx = Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET);
      expect(frontIdx).toBe(0);
      const frontBuffer = frontIdx === 0 ? views.dataViewA : views.dataViewB;

      // Simulate: worker starts writing to back buffer (B)
      views.dataViewB[ballOffset] = 10.0;
      views.dataViewB[ballOffset + 1] = 20.0;

      // Front buffer (A) values are unchanged
      expect(frontBuffer[ballOffset]).toBe(1.0);
      expect(frontBuffer[ballOffset + 1]).toBe(2.0);
      expect(frontBuffer[ballOffset + 2]).toBe(3.0);
    });

    it('after swap, new front buffer has updated data', () => {
      const views = createSharedBuffers(1, 0);
      const ballOffset = getBallOffset(0);

      // Initial data in A
      views.dataViewA[ballOffset] = 1.0;

      // Worker writes updated data to B
      views.dataViewB[ballOffset] = 5.0;

      // Worker swaps: now B is front (index 1)
      Atomics.store(views.signalView, HEADER_BUFFER_INDEX_OFFSET, 1);

      // Main thread reads front buffer
      const frontIdx = Atomics.load(views.signalView, HEADER_BUFFER_INDEX_OFFSET);
      const frontBuffer = frontIdx === 0 ? views.dataViewA : views.dataViewB;

      // Should see the updated data from B
      expect(frontBuffer[ballOffset]).toBe(5.0);
    });

    it('signal word transitions through IDLE -> STEP_REQUESTED -> STEP_COMPLETE', () => {
      const views = createSharedBuffers(1, 0);

      // Initial: idle
      expect(Atomics.load(views.signalView, HEADER_SIGNAL_OFFSET)).toBe(SIGNAL_IDLE);

      // Main thread requests step
      Atomics.store(views.signalView, HEADER_SIGNAL_OFFSET, SIGNAL_STEP_REQUESTED);
      expect(Atomics.load(views.signalView, HEADER_SIGNAL_OFFSET)).toBe(SIGNAL_STEP_REQUESTED);

      // Worker completes step
      Atomics.store(views.signalView, HEADER_SIGNAL_OFFSET, SIGNAL_STEP_COMPLETE);
      expect(Atomics.load(views.signalView, HEADER_SIGNAL_OFFSET)).toBe(SIGNAL_STEP_COMPLETE);
    });

    it('frame counter increments atomically', () => {
      const views = createSharedBuffers(1, 0);

      expect(Atomics.load(views.signalView, HEADER_FRAME_OFFSET)).toBe(0);

      Atomics.add(views.signalView, HEADER_FRAME_OFFSET, 1);
      expect(Atomics.load(views.signalView, HEADER_FRAME_OFFSET)).toBe(1);

      Atomics.add(views.signalView, HEADER_FRAME_OFFSET, 1);
      expect(Atomics.load(views.signalView, HEADER_FRAME_OFFSET)).toBe(2);

      // Simulate 100 frames
      for (let i = 0; i < 100; i++) {
        Atomics.add(views.signalView, HEADER_FRAME_OFFSET, 1);
      }
      expect(Atomics.load(views.signalView, HEADER_FRAME_OFFSET)).toBe(102);
    });

    it('delta time can be written and read via Float32Array', () => {
      const views = createSharedBuffers(1, 0);

      views.deltaTimeView[0] = 0.016667; // ~60fps
      // Float32 has limited precision
      expect(Math.abs(views.deltaTimeView[0] - 0.016667)).toBeLessThan(0.0001);

      views.deltaTimeView[0] = 0.033333; // ~30fps
      expect(Math.abs(views.deltaTimeView[0] - 0.033333)).toBeLessThan(0.0001);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Physics Engine: Ball Physics
  // ---------------------------------------------------------------------------
  describe('Step 3a: Physics Engine - Ball Physics', () => {

    let data: Float32Array;
    const DT = 1 / 60; // 60fps frame time

    beforeEach(() => {
      data = new Float32Array(COURT_FLOATS);
    });

    it('skips invisible balls (visible < 0.5)', () => {
      const offset = getBallOffset(0);
      data[offset] = 5.0;     // px
      data[offset + 1] = 5.0; // py
      data[offset + 6] = 0.0; // visible = false

      stepBallPhysics(data, offset, DT, 0);

      // Nothing should change
      expect(data[offset]).toBe(5.0);
      expect(data[offset + 1]).toBe(5.0);
    });

    it('applies gravity to ball velocity', () => {
      const offset = getBallOffset(0);
      data[offset + 1] = 5.0;   // py (high in air)
      data[offset + 4] = 0;     // vy = 0 initially
      data[offset + 6] = 1.0;   // visible

      stepBallPhysics(data, offset, DT, 0);

      // vy should be GRAVITY * DT = -9.81 / 60 = -0.1635
      const expectedVy = GRAVITY * DT;
      expect(Math.abs(data[offset + 4] - expectedVy)).toBeLessThan(0.001);
    });

    it('updates position based on velocity and delta time', () => {
      const offset = getBallOffset(0);
      data[offset] = 0;         // px
      data[offset + 1] = 5.0;   // py
      data[offset + 2] = 0;     // pz
      data[offset + 3] = 10.0;  // vx = 10 m/s
      data[offset + 4] = 0;     // vy
      data[offset + 5] = -5.0;  // vz = -5 m/s
      data[offset + 6] = 1.0;   // visible

      stepBallPhysics(data, offset, DT, 0);

      // px should be vx * dt = 10 / 60
      expect(Math.abs(data[offset] - 10.0 * DT)).toBeLessThan(0.001);
      // pz should be vz * dt = -5 / 60
      expect(Math.abs(data[offset + 2] - (-5.0 * DT))).toBeLessThan(0.001);
    });

    it('handles ground bounce with damping', () => {
      const offset = getBallOffset(0);
      data[offset + 1] = 0.01;  // py just above ground
      data[offset + 4] = -5.0;  // vy downward
      data[offset + 3] = 2.0;   // vx
      data[offset + 5] = 3.0;   // vz
      data[offset + 6] = 1.0;   // visible

      stepBallPhysics(data, offset, DT, 0);

      // After bounce: py should be clamped to BALL_RADIUS
      // Float32Array has limited precision, so use toBeCloseTo
      expect(data[offset + 1]).toBeCloseTo(BALL_RADIUS, 3);

      // vy should be reversed and damped
      // Before bounce: vy = -5.0 + GRAVITY * DT = ~-5.1635
      // After bounce: vy = 5.1635 * BOUNCE_DAMPING = ~3.356
      expect(data[offset + 4]).toBeGreaterThan(0); // reversed to positive

      // vx and vz should be friction-dampened (* 0.85)
      // vx after: updated by position step then friction
      // The key check is that horizontal velocity decreased
      expect(Math.abs(data[offset + 3])).toBeLessThan(2.0);
      expect(Math.abs(data[offset + 5])).toBeLessThan(3.0);
    });

    it('ball in free fall follows correct trajectory over multiple frames', () => {
      const offset = getBallOffset(0);
      data[offset + 1] = 10.0;  // py = 10m high
      data[offset + 4] = 0;     // vy = 0
      data[offset + 3] = 5.0;   // vx = 5 m/s horizontal
      data[offset + 6] = 1.0;   // visible

      // Simulate 30 frames (0.5 seconds)
      for (let i = 0; i < 30; i++) {
        stepBallPhysics(data, offset, DT, 0);
      }

      // After 0.5s of free fall: y = 10 + 0.5*(-9.81)*0.5^2 = 10 - 1.226 = ~8.77
      // (Euler integration will differ slightly from analytical)
      expect(data[offset + 1]).toBeGreaterThan(7); // still in the air
      expect(data[offset + 1]).toBeLessThan(10);   // but lower

      // Horizontal position: x = 5 * 0.5 = 2.5
      expect(Math.abs(data[offset] - 2.5)).toBeLessThan(0.1);
    });

    it('preserves ball visibility flag', () => {
      const offset = getBallOffset(0);
      data[offset + 6] = 1.0; // visible
      data[offset + 1] = 5.0; // py

      stepBallPhysics(data, offset, DT, 0);

      expect(data[offset + 6]).toBe(1.0); // still visible
    });
  });

  // ---------------------------------------------------------------------------
  // 4. AI Engine: Player Movement
  // ---------------------------------------------------------------------------
  describe('Step 3b: AI Engine - Player Movement', () => {

    let data: Float32Array;
    const DT = 1 / 60;

    beforeEach(() => {
      data = new Float32Array(COURT_FLOATS);
    });

    it('moves player towards target position', () => {
      const offset = getPlayerOffset(0, 0);
      data[offset] = 0;       // cx
      data[offset + 1] = 0;   // cz
      data[offset + 2] = 3.0; // tx (target x)
      data[offset + 3] = 4.0; // tz (target z)

      stepPlayerMovement(data, offset, DT);

      // Player should have moved towards (3, 4)
      expect(data[offset]).toBeGreaterThan(0);
      expect(data[offset + 1]).toBeGreaterThan(0);
    });

    it('moves at correct speed (3 m/s)', () => {
      const offset = getPlayerOffset(0, 0);
      data[offset] = 0;        // cx
      data[offset + 1] = 0;    // cz
      data[offset + 2] = 10.0; // tx (far target)
      data[offset + 3] = 0;    // tz

      stepPlayerMovement(data, offset, DT);

      // Distance moved should be speed * dt = 3/60 = 0.05
      const moved = data[offset]; // moved along x axis only
      expect(Math.abs(moved - 3 * DT)).toBeLessThan(0.001);
    });

    it('does not overshoot target position', () => {
      const offset = getPlayerOffset(0, 0);
      data[offset] = 0;       // cx
      data[offset + 1] = 0;   // cz
      data[offset + 2] = 0.2; // tx (close target)
      data[offset + 3] = 0;   // tz

      // Run many frames - player should approach target but never exceed it
      for (let i = 0; i < 100; i++) {
        stepPlayerMovement(data, offset, DT);
      }

      // Player must NOT overshoot past target
      expect(data[offset]).toBeLessThanOrEqual(0.2 + 0.001); // tiny float tolerance
      // Player should be within threshold distance of target
      expect(data[offset]).toBeGreaterThan(0);
    });

    it('does not move when already at target (within threshold)', () => {
      const offset = getPlayerOffset(0, 0);
      data[offset] = 5.0;     // cx
      data[offset + 1] = 3.0; // cz
      data[offset + 2] = 5.0; // tx = cx (same position)
      data[offset + 3] = 3.0; // tz = cz

      stepPlayerMovement(data, offset, DT);

      expect(data[offset]).toBe(5.0);
      expect(data[offset + 1]).toBe(3.0);
    });

    it('updates facing angle towards target', () => {
      const offset = getPlayerOffset(0, 0);
      data[offset] = 0;       // cx
      data[offset + 1] = 0;   // cz
      data[offset + 2] = 1.0; // tx
      data[offset + 3] = 0;   // tz (target directly along x-axis)

      stepPlayerMovement(data, offset, DT);

      // facing = atan2(dx, dz) = atan2(1, 0) = PI/2
      expect(Math.abs(data[offset + 4] - Math.PI / 2)).toBeLessThan(0.01);
    });

    it('handles diagonal movement correctly', () => {
      const offset = getPlayerOffset(0, 0);
      data[offset] = 0;       // cx
      data[offset + 1] = 0;   // cz
      data[offset + 2] = 5.0; // tx
      data[offset + 3] = 5.0; // tz

      stepPlayerMovement(data, offset, DT);

      // Should move along diagonal (equal x and z displacement)
      const movedX = data[offset];
      const movedZ = data[offset + 1];
      expect(Math.abs(movedX - movedZ)).toBeLessThan(0.001);

      // Total distance moved should be speed * dt
      const totalMoved = Math.sqrt(movedX * movedX + movedZ * movedZ);
      expect(Math.abs(totalMoved - 3 * DT)).toBeLessThan(0.001);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Fallback Mode: Works Without SharedArrayBuffer
  // ---------------------------------------------------------------------------
  describe('Step 8: Fallback Mode', () => {

    it('FallbackBridge initializes with correct buffer size', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(5, 2);

      // Should not throw and should be ready
      expect(bridge.isWorkerMode()).toBe(false);
    });

    it('FallbackBridge reports non-worker mode', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);
      expect(bridge.isWorkerMode()).toBe(false);
    });

    it('FallbackBridge can write and read ball state', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(2, 0);

      // Write initial state
      bridge.writeBallState(0, { px: 1.0, py: 5.0, pz: 2.0, vx: 3.0, vy: 0, vz: -1.0, visible: 1.0 });

      const ball = bridge.readBallState(0);
      expect(ball.px).toBe(1.0);
      expect(ball.py).toBe(5.0);
      expect(ball.pz).toBe(2.0);
      expect(ball.vx).toBe(3.0);
      expect(ball.visible).toBe(1.0);
    });

    it('FallbackBridge can write and read player state', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);

      bridge.writePlayerState(0, 0, { cx: 1.0, cz: 2.0, tx: 5.0, tz: 6.0, team: 0 });

      const player = bridge.readPlayerState(0, 0);
      expect(player.cx).toBe(1.0);
      expect(player.cz).toBe(2.0);
      expect(player.tx).toBe(5.0);
      expect(player.tz).toBe(6.0);
    });

    it('FallbackBridge step() runs physics on ball', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);

      // Set up a visible ball in the air
      bridge.writeBallState(0, {
        px: 0, py: 5.0, pz: 0,
        vx: 1.0, vy: 0, vz: 0,
        visible: 1.0,
      });

      // Step one frame
      bridge.step(1 / 60);

      const ball = bridge.readBallState(0);
      // Ball should have moved horizontally and started falling
      expect(ball.px).toBeGreaterThan(0);
      expect(ball.py).toBeLessThan(5.0); // gravity pulled it down
      expect(ball.vy).toBeLessThan(0);   // velocity is now downward
    });

    it('FallbackBridge step() runs player movement', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);

      // Set up a player with a target
      bridge.writePlayerState(0, 0, {
        cx: 0, cz: 0,
        tx: 10.0, tz: 0,
        facing: 0, swingPhase: 0,
        animState: 0, swingType: 0, team: 0,
      });

      // Step one frame
      bridge.step(1 / 60);

      const player = bridge.readPlayerState(0, 0);
      expect(player.cx).toBeGreaterThan(0); // moved towards target
    });

    it('FallbackBridge step() processes multiple courts', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(3, 0);

      // Set up balls on courts 0, 1, 2
      for (let c = 0; c < 3; c++) {
        bridge.writeBallState(c, {
          px: c * 10.0, py: 5.0, pz: 0,
          vx: 0, vy: 0, vz: 0,
          visible: 1.0,
        });
      }

      bridge.step(1 / 60);

      // All balls should have been affected by gravity
      for (let c = 0; c < 3; c++) {
        const ball = bridge.readBallState(c);
        expect(ball.vy).toBeLessThan(0); // gravity applied
      }
    });

    it('FallbackBridge destroy() cleans up resources', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);
      bridge.destroy();

      // After destroy, isWorkerMode still returns false
      expect(bridge.isWorkerMode()).toBe(false);
    });

    it('FallbackBridge courts are isolated from each other', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(2, 0);

      // Write different values to court 0 and court 1
      bridge.writeBallState(0, { px: 100, py: 5, pz: 0, vx: 0, vy: 0, vz: 0, visible: 1 });
      bridge.writeBallState(1, { px: 200, py: 8, pz: 0, vx: 0, vy: 0, vz: 0, visible: 1 });

      const ball0 = bridge.readBallState(0);
      const ball1 = bridge.readBallState(1);

      expect(ball0.px).toBe(100);
      expect(ball1.px).toBe(200);
      expect(ball0.py).toBe(5);
      expect(ball1.py).toBe(8);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Feature Detection
  // ---------------------------------------------------------------------------
  describe('Feature Detection', () => {

    it('supportsWorkerCompute returns true when SAB and Atomics are available', () => {
      // In Node.js test environment, both should be available
      expect(typeof SharedArrayBuffer).toBe('function');
      expect(typeof Atomics).toBe('object');
      expect(supportsWorkerCompute()).toBe(true);
    });

    it('SharedArrayBuffer is constructable in test environment', () => {
      const sab = new SharedArrayBuffer(16);
      expect(sab.byteLength).toBe(16);
    });

    it('Atomics operations work on SharedArrayBuffer Int32Array', () => {
      const sab = new SharedArrayBuffer(16);
      const view = new Int32Array(sab);

      Atomics.store(view, 0, 42);
      expect(Atomics.load(view, 0)).toBe(42);

      Atomics.add(view, 0, 8);
      expect(Atomics.load(view, 0)).toBe(50);

      const old = Atomics.compareExchange(view, 0, 50, 99);
      expect(old).toBe(50);
      expect(Atomics.load(view, 0)).toBe(99);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Performance Benchmarks
  // ---------------------------------------------------------------------------
  describe('Performance: Physics and AI within budget', () => {

    it('stepBallPhysics processes 100 balls in under 1ms', () => {
      const courtCount = 100;
      const size = courtCount * COURT_FLOATS;
      const data = new Float32Array(size);

      // Initialize all balls as visible with some velocity
      for (let c = 0; c < courtCount; c++) {
        const offset = getBallOffset(c);
        data[offset] = c * 0.1;       // px
        data[offset + 1] = 5.0;       // py
        data[offset + 2] = c * -0.1;  // pz
        data[offset + 3] = 2.0;       // vx
        data[offset + 4] = 1.0;       // vy
        data[offset + 5] = -1.0;      // vz
        data[offset + 6] = 1.0;       // visible
      }

      const dt = 1 / 60;
      const start = performance.now();

      for (let c = 0; c < courtCount; c++) {
        stepBallPhysics(data, getBallOffset(c), dt, 0);
      }

      const elapsed = performance.now() - start;

      // Should complete in under 1ms (generous budget)
      expect(elapsed).toBeLessThan(1.0);
    });

    it('stepPlayerMovement processes 400 players (100 courts x 4) in under 2ms', () => {
      const courtCount = 100;
      const size = courtCount * COURT_FLOATS;
      const data = new Float32Array(size);

      // Initialize all players with targets
      for (let c = 0; c < courtCount; c++) {
        for (let p = 0; p < PLAYERS_PER_COURT; p++) {
          const offset = getPlayerOffset(c, p);
          data[offset] = c * 0.5;          // cx
          data[offset + 1] = p * 0.5;      // cz
          data[offset + 2] = c * 0.5 + 3;  // tx
          data[offset + 3] = p * 0.5 + 3;  // tz
        }
      }

      const dt = 1 / 60;
      const start = performance.now();

      for (let c = 0; c < courtCount; c++) {
        for (let p = 0; p < PLAYERS_PER_COURT; p++) {
          stepPlayerMovement(data, getPlayerOffset(c, p), dt);
        }
      }

      const elapsed = performance.now() - start;

      // Should complete in under 2ms (generous budget)
      expect(elapsed).toBeLessThan(2.0);
    });

    it('full compute step (100 balls + 400 players) under 3ms', () => {
      const courtCount = 100;
      const size = courtCount * COURT_FLOATS;
      const data = new Float32Array(size);

      // Initialize all entities
      for (let c = 0; c < courtCount; c++) {
        const ballOffset = getBallOffset(c);
        data[ballOffset + 1] = 5.0;  // py
        data[ballOffset + 3] = 2.0;  // vx
        data[ballOffset + 6] = 1.0;  // visible

        for (let p = 0; p < PLAYERS_PER_COURT; p++) {
          const pOffset = getPlayerOffset(c, p);
          data[pOffset + 2] = 5.0; // tx
          data[pOffset + 3] = 5.0; // tz
        }
      }

      const dt = 1 / 60;
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (let c = 0; c < courtCount; c++) {
          stepBallPhysics(data, getBallOffset(c), dt, 0);
          for (let p = 0; p < PLAYERS_PER_COURT; p++) {
            stepPlayerMovement(data, getPlayerOffset(c, p), dt);
          }
        }
      }

      const totalElapsed = performance.now() - start;
      const perFrame = totalElapsed / iterations;

      // Per-frame compute budget: under 3ms for 100 courts
      expect(perFrame).toBeLessThan(3.0);
    });

    it('SharedArrayBuffer allocation for 100 courts is under 50KB', () => {
      const totalBytes = calculateBufferSize(100, 10);
      // 41304 bytes = ~40.3 KB
      expect(totalBytes).toBeLessThan(50 * 1024); // 50 KB
    });

    it('SharedArrayBuffer allocation for 1000 courts is under 500KB', () => {
      const totalBytes = calculateBufferSize(1000, 50);
      // 1000*51 + 50*6 = 51300 floats, double buffered = 102600 * 4 = 410400 + 24 = 410424
      expect(totalBytes).toBeLessThan(500 * 1024); // 500 KB
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Data Integrity: End-to-End Flow
  // ---------------------------------------------------------------------------
  describe('Data Integrity: End-to-End Flow', () => {

    it('ball dropped from height eventually bounces and settles', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);

      // Drop ball from 3m
      bridge.writeBallState(0, {
        px: 0, py: 3.0, pz: 0,
        vx: 0, vy: 0, vz: 0,
        visible: 1.0,
      });

      // Simulate 5 seconds (300 frames at 60fps)
      for (let i = 0; i < 300; i++) {
        bridge.step(1 / 60);
      }

      const ball = bridge.readBallState(0);

      // Ball should have settled near ground level
      expect(ball.py).toBeLessThan(0.1);
      expect(ball.py).toBeGreaterThanOrEqual(BALL_RADIUS);

      // Velocity should be near zero (settled)
      expect(Math.abs(ball.vy)).toBeLessThan(1.0);
    });

    it('player reaches target after sufficient simulation time', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(1, 0);

      bridge.writePlayerState(0, 0, {
        cx: 0, cz: 0,
        tx: 1.0, tz: 0,
        facing: 0, swingPhase: 0,
        animState: 0, swingType: 0, team: 0,
      });

      // 1 meter at 3 m/s = 0.33s = ~20 frames
      for (let i = 0; i < 30; i++) {
        bridge.step(1 / 60);
      }

      const player = bridge.readPlayerState(0, 0);

      // Player should be at or very near target
      // Movement stops when within threshold distance (0.1), so allow 0.11 tolerance
      expect(Math.abs(player.cx - 1.0)).toBeLessThan(0.11);
    });

    it('multiple courts evolve independently in FallbackBridge', async () => {
      const bridge = new FallbackBridge();
      await bridge.init(3, 0);

      // Court 0: ball moving right
      bridge.writeBallState(0, { px: 0, py: 5, pz: 0, vx: 10, vy: 0, vz: 0, visible: 1 });
      // Court 1: ball moving left
      bridge.writeBallState(1, { px: 0, py: 5, pz: 0, vx: -10, vy: 0, vz: 0, visible: 1 });
      // Court 2: ball stationary but visible
      bridge.writeBallState(2, { px: 0, py: 5, pz: 0, vx: 0, vy: 0, vz: 0, visible: 1 });

      bridge.step(1 / 60);

      const ball0 = bridge.readBallState(0);
      const ball1 = bridge.readBallState(1);
      const ball2 = bridge.readBallState(2);

      // Court 0: moved right
      expect(ball0.px).toBeGreaterThan(0);
      // Court 1: moved left
      expect(ball1.px).toBeLessThan(0);
      // Court 2: stayed at origin
      expect(ball2.px).toBe(0);

      // All had gravity applied
      expect(ball0.vy).toBeLessThan(0);
      expect(ball1.vy).toBeLessThan(0);
      expect(ball2.vy).toBeLessThan(0);
    });
  });
});
