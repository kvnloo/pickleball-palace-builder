/**
 * Task 1: Squared Distance Collision Optimization — Test Suite
 *
 * Verifies that the Math.sqrt elimination in gameStore.ts is:
 * 1. Algebraically correct (squared comparisons match sqrt comparisons)
 * 2. Behaviorally identical (movement normalization unchanged)
 * 3. Edge-case safe (dist=0, very small distances)
 * 4. Actually applied in source (no sqrt in collision path, lazy sqrt in movement)
 * 5. Dead code removed (no unused distance var in calculateShotVelocity)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read source once for all source-verification tests
const SOURCE = readFileSync(
  resolve(__dirname, '../stores/gameStore.ts'),
  'utf-8'
);

// ---------------------------------------------------------------------------
// 1. Mathematical equivalence of squared distance comparison
// ---------------------------------------------------------------------------
describe('squared distance equivalence', () => {
  const HIT_THRESHOLD = 1.5;
  const HIT_THRESHOLD_SQ = HIT_THRESHOLD * HIT_THRESHOLD; // 2.25
  const MOVE_THRESHOLD = 0.1;
  const MOVE_THRESHOLD_SQ = MOVE_THRESHOLD * MOVE_THRESHOLD; // 0.01

  // Representative test vectors spanning all interesting regions
  const vectors: [number, number][] = [
    [0, 0],           // zero
    [0.01, 0.01],     // tiny
    [0.05, 0.05],     // below move threshold
    [0.07, 0.07],     // near move threshold (~0.099)
    [0.071, 0.071],   // just above move threshold (~0.1004)
    [0.1, 0],         // exact move threshold
    [0.5, 0.5],       // mid-range
    [1, 1],           // diagonal ~1.414 (inside hit)
    [1.06, 1.06],     // diagonal ~1.499 (just inside hit)
    [1.061, 1.061],   // diagonal ~1.500 (at hit boundary)
    [1.5, 0],         // exact hit threshold on axis
    [2, 0],           // outside hit threshold
    [5, 5],           // far away
    [-1, -1],         // negative (squaring makes positive)
    [-1.5, 0],        // negative at threshold
  ];

  it.each(vectors)(
    'dx=%f dz=%f: squared collision check matches sqrt collision check',
    (dx, dz) => {
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);
      expect(distSq < HIT_THRESHOLD_SQ).toBe(dist < HIT_THRESHOLD);
    }
  );

  it.each(vectors)(
    'dx=%f dz=%f: squared movement check matches sqrt movement check',
    (dx, dz) => {
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);
      expect(distSq > MOVE_THRESHOLD_SQ).toBe(dist > MOVE_THRESHOLD);
    }
  );
});

// ---------------------------------------------------------------------------
// 2. Collision detection source uses distSq, not Math.sqrt
// ---------------------------------------------------------------------------
describe('collision detection optimization', () => {
  it('uses distSq instead of Math.sqrt in the collision loop', () => {
    // Extract collision block: between "Check for player hit" and "Update player animations"
    const start = SOURCE.indexOf('Check for player hit');
    const end = SOURCE.indexOf('Update player animations');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = SOURCE.substring(start, end);

    expect(block).toContain('distSq');
    expect(block).not.toContain('Math.sqrt');
    expect(block).toContain('2.25'); // 1.5^2
  });
});

// ---------------------------------------------------------------------------
// 3. Player movement normalization still works correctly (lazy sqrt)
// ---------------------------------------------------------------------------
describe('lazy sqrt movement normalization', () => {
  it('produces identical movement as eager sqrt for dist > threshold', () => {
    const dx = 3;
    const dz = 4;
    const deltaSeconds = 1 / 60;
    const speed = 3 * deltaSeconds;

    // --- Original (eager sqrt) ---
    const eagerDist = Math.sqrt(dx * dx + dz * dz); // 5
    const eagerMoveX = (dx / eagerDist) * Math.min(speed, eagerDist);
    const eagerMoveZ = (dz / eagerDist) * Math.min(speed, eagerDist);

    // --- Optimized (lazy sqrt) ---
    const distSq = dx * dx + dz * dz;
    expect(distSq > 0.01).toBe(true); // guard passes
    const lazyDist = Math.sqrt(distSq);
    const lazyMoveX = (dx / lazyDist) * Math.min(speed, lazyDist);
    const lazyMoveZ = (dz / lazyDist) * Math.min(speed, lazyDist);

    expect(lazyMoveX).toBe(eagerMoveX);
    expect(lazyMoveZ).toBe(eagerMoveZ);
  });

  it('preserves direction vector for various angles', () => {
    const cases = [
      [1, 0], [0, 1], [-1, 0], [0, -1],   // axis-aligned
      [1, 1], [-3, 4], [7, -24],            // diagonals
    ];

    for (const [dx, dz] of cases) {
      const distSq = dx * dx + dz * dz;
      const dist = Math.sqrt(distSq);
      const normX = dx / dist;
      const normZ = dz / dist;

      // Unit vector length should be 1
      expect(Math.abs(normX * normX + normZ * normZ - 1)).toBeLessThan(1e-10);
    }
  });

  it('source uses lazy sqrt pattern (sqrt inside threshold guard)', () => {
    // Extract movement block: between "Move towards target" and "facingAngle"
    const start = SOURCE.indexOf('Move towards target');
    const end = SOURCE.indexOf('facingAngle', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = SOURCE.substring(start, end);

    expect(block).toContain('distSq');

    // Verify ordering: distSq assigned BEFORE if guard, sqrt computed AFTER if guard
    const distSqPos = block.indexOf('distSq =');
    const ifPos = block.indexOf('if (distSq');
    const sqrtPos = block.indexOf('Math.sqrt');

    expect(distSqPos).toBeGreaterThan(-1);
    expect(ifPos).toBeGreaterThan(distSqPos);
    expect(sqrtPos).toBeGreaterThan(ifPos);
  });
});

// ---------------------------------------------------------------------------
// 4. Edge case: dist=0 handled gracefully (no division by zero)
// ---------------------------------------------------------------------------
describe('edge case: dist=0', () => {
  it('guard blocks entry when dx=0, dz=0', () => {
    const dx = 0;
    const dz = 0;
    const distSq = dx * dx + dz * dz;

    // Guard must fail — no sqrt, no division
    expect(distSq > 0.01).toBe(false);
    expect(distSq).toBe(0);
  });

  it('guard blocks entry for very small distances', () => {
    // Player is 0.05m from target on each axis (~0.07m total)
    const dx = 0.05;
    const dz = 0.05;
    const distSq = dx * dx + dz * dz; // 0.005
    expect(distSq > 0.01).toBe(false);
  });

  it('guard passes for distances just above threshold', () => {
    // Player is 0.08m from target on each axis (~0.113m total)
    const dx = 0.08;
    const dz = 0.08;
    const distSq = dx * dx + dz * dz; // 0.0128
    expect(distSq > 0.01).toBe(true);

    // And sqrt is safe (no division by zero)
    const dist = Math.sqrt(distSq);
    expect(dist).toBeGreaterThan(0);
    expect(isFinite(dx / dist)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Dead code: distance variable removed from calculateShotVelocity
// ---------------------------------------------------------------------------
describe('dead code removal: calculateShotVelocity', () => {
  it('does not contain unused distance variable', () => {
    // Extract function body: from "function calculateShotVelocity" to "export"
    const start = SOURCE.indexOf('function calculateShotVelocity');
    const end = SOURCE.indexOf('export', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const fnBody = SOURCE.substring(start, end);

    // Must NOT have the dead variable
    expect(fnBody).not.toMatch(/const distance\s*=/);

    // Must still have the actual used Math.sqrt calls (for arcHeight physics)
    expect(fnBody).toContain('Math.sqrt(2');
  });
});
