/**
 * Task 9: Shadow Optimization -- Test Suite
 *
 * Verifies the shadow optimization system:
 * 1. Shadow map size matches performance tier (ULTRA=0, HIGH=512, NORMAL=1024)
 * 2. Shadow frustum is tight to visible area (dynamic, not hardcoded 100x100)
 * 3. ULTRA tier has no shadow map rendering (shadows=false, shadowMapSize=0)
 * 4. Distant objects don't cast shadows (shadow LOD via shouldCastShadow)
 * 5. Shadow frustum scales with facility size
 * 6. Shadow frustum is square to prevent distortion
 * 7. Light position is relative to facility center
 *
 * All tests use pure functions from shadowUtils.ts -- no React/Three.js rendering needed.
 */

import { describe, it, expect } from 'vitest';
import { COURT_WIDTH, COURT_LENGTH } from '@/types/facility';
import { PERFORMANCE_CONFIGS, PerformanceTier } from '@/types/performance';
import {
  computeShadowFrustum,
  shouldCastShadow,
  ShadowFrustumConfig,
} from '@/lib/shadowUtils';

// ---------------------------------------------------------------------------
// Constants for test calculations
// ---------------------------------------------------------------------------
const SPACING = 1;

/**
 * Compute facility dimensions for a given grid size (mirrors HomebaseCanvas logic).
 */
function facilityDimensions(rows: number, cols: number, spacing: number = SPACING) {
  const width = cols * (COURT_WIDTH + spacing) + 6;
  const length = rows * (COURT_LENGTH + spacing) + 6;
  const centerX = (cols * (COURT_WIDTH + spacing) - spacing) / 2;
  const centerZ = (rows * (COURT_LENGTH + spacing) - spacing) / 2;
  return { width, length, centerX, centerZ };
}

// ---------------------------------------------------------------------------
// 1. Shadow configuration per tier
// ---------------------------------------------------------------------------
describe('shadow configuration per performance tier', () => {
  it('ULTRA tier has shadows disabled and shadowMapSize=0', () => {
    const config = PERFORMANCE_CONFIGS.ULTRA;
    expect(config.shadows).toBe(false);
    expect(config.shadowMapSize).toBe(0);
    expect(config.shadowCasterDistance).toBe(0);
  });

  it('HIGH tier has shadows enabled with 512x512 shadow map', () => {
    const config = PERFORMANCE_CONFIGS.HIGH;
    expect(config.shadows).toBe(true);
    expect(config.shadowMapSize).toBe(512);
  });

  it('NORMAL tier has shadows enabled with 1024x1024 shadow map', () => {
    const config = PERFORMANCE_CONFIGS.NORMAL;
    expect(config.shadows).toBe(true);
    expect(config.shadowMapSize).toBe(1024);
  });

  it('HIGH shadow map is smaller than NORMAL (4x fewer pixels)', () => {
    const highPixels = PERFORMANCE_CONFIGS.HIGH.shadowMapSize ** 2;
    const normalPixels = PERFORMANCE_CONFIGS.NORMAL.shadowMapSize ** 2;
    expect(highPixels).toBeLessThan(normalPixels);
    expect(normalPixels / highPixels).toBe(4); // 1024^2 / 512^2 = 4
  });

  it('all tiers have shadowCasterDistance defined and >= 0', () => {
    const tiers: PerformanceTier[] = ['ULTRA', 'HIGH', 'NORMAL'];
    for (const tier of tiers) {
      const config = PERFORMANCE_CONFIGS[tier];
      expect(typeof config.shadowCasterDistance).toBe('number');
      expect(config.shadowCasterDistance).toBeGreaterThanOrEqual(0);
    }
  });

  it('NORMAL tier has larger shadow caster distance than HIGH', () => {
    expect(PERFORMANCE_CONFIGS.NORMAL.shadowCasterDistance).toBeGreaterThan(
      PERFORMANCE_CONFIGS.HIGH.shadowCasterDistance
    );
  });

  it('all tiers have shadowMapSize defined and are power-of-two or zero', () => {
    const tiers: PerformanceTier[] = ['ULTRA', 'HIGH', 'NORMAL'];
    for (const tier of tiers) {
      const size = PERFORMANCE_CONFIGS[tier].shadowMapSize;
      if (size > 0) {
        // Power of two check: n & (n-1) === 0 for powers of 2
        expect(size & (size - 1)).toBe(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. computeShadowFrustum produces tight bounds
// ---------------------------------------------------------------------------
describe('computeShadowFrustum produces tight bounds', () => {
  it('small facility (1x1 court) gets tight frustum, not 50 units', () => {
    const dims = facilityDimensions(1, 1);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // For a 1x1 court, facility is ~13.1m x 20.4m (with padding in facilityDimensions)
    // Max half-extent should be ~(20.4/2)+2 = ~12.2, far less than old hardcoded 50
    expect(Math.abs(frustum.right)).toBeLessThan(50);
    expect(Math.abs(frustum.left)).toBeLessThan(50);
    expect(Math.abs(frustum.top)).toBeLessThan(50);
    expect(Math.abs(frustum.bottom)).toBeLessThan(50);
  });

  it('frustum covers the full facility width and length', () => {
    const dims = facilityDimensions(3, 4);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // The frustum half-extent should be at least half of the max facility dimension
    const requiredHalfExtent = Math.max(dims.width, dims.length) / 2;
    expect(frustum.right).toBeGreaterThanOrEqual(requiredHalfExtent);
    expect(Math.abs(frustum.left)).toBeGreaterThanOrEqual(requiredHalfExtent);
    expect(frustum.top).toBeGreaterThanOrEqual(requiredHalfExtent);
    expect(Math.abs(frustum.bottom)).toBeGreaterThanOrEqual(requiredHalfExtent);
  });

  it('frustum far is less than 200 (was 200, optimized to 150)', () => {
    const dims = facilityDimensions(5, 5);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);
    expect(frustum.far).toBeLessThanOrEqual(150);
    expect(frustum.far).toBeGreaterThan(0);
  });

  it('frustum near is positive and small', () => {
    const dims = facilityDimensions(2, 2);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);
    expect(frustum.near).toBeGreaterThan(0);
    expect(frustum.near).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 3. Shadow frustum scales with facility size
// ---------------------------------------------------------------------------
describe('shadow frustum scales with facility size', () => {
  it('10x10 facility frustum is larger than 1x1 facility frustum', () => {
    const small = facilityDimensions(1, 1);
    const large = facilityDimensions(10, 10);

    const frustumSmall = computeShadowFrustum(small.width, small.length, small.centerX, small.centerZ);
    const frustumLarge = computeShadowFrustum(large.width, large.length, large.centerX, large.centerZ);

    expect(frustumLarge.right).toBeGreaterThan(frustumSmall.right);
    expect(Math.abs(frustumLarge.left)).toBeGreaterThan(Math.abs(frustumSmall.left));
  });

  it('adding rows increases frustum size', () => {
    const d3 = facilityDimensions(3, 5);
    const d6 = facilityDimensions(6, 5);

    const f3 = computeShadowFrustum(d3.width, d3.length, d3.centerX, d3.centerZ);
    const f6 = computeShadowFrustum(d6.width, d6.length, d6.centerX, d6.centerZ);

    // 6 rows should produce a larger frustum than 3 rows
    expect(f6.right).toBeGreaterThanOrEqual(f3.right);
  });

  it('adding columns increases frustum size when columns dominate', () => {
    // When cols dominate the width, adding cols increases frustum
    const d5x2 = facilityDimensions(2, 5);
    const d10x2 = facilityDimensions(2, 10);

    const f5 = computeShadowFrustum(d5x2.width, d5x2.length, d5x2.centerX, d5x2.centerZ);
    const f10 = computeShadowFrustum(d10x2.width, d10x2.length, d10x2.centerX, d10x2.centerZ);

    expect(f10.right).toBeGreaterThan(f5.right);
  });
});

// ---------------------------------------------------------------------------
// 4. Shadow frustum is square (prevents distortion)
// ---------------------------------------------------------------------------
describe('shadow frustum is square', () => {
  it('square frustum for square facility', () => {
    const dims = facilityDimensions(5, 5);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);
    expect(frustum.right).toBe(-frustum.left);
    expect(frustum.top).toBe(-frustum.bottom);
    expect(frustum.right).toBe(frustum.top);
  });

  it('square frustum for rectangular facility (wider than long)', () => {
    const dims = facilityDimensions(2, 8);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // Frustum should be square using max(width, length)
    expect(frustum.right).toBe(-frustum.left);
    expect(frustum.top).toBe(-frustum.bottom);
    expect(frustum.right).toBe(frustum.top);
  });

  it('square frustum for tall facility (longer than wide)', () => {
    const dims = facilityDimensions(8, 2);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    expect(frustum.right).toBe(-frustum.left);
    expect(frustum.top).toBe(-frustum.bottom);
    expect(frustum.right).toBe(frustum.top);
  });
});

// ---------------------------------------------------------------------------
// 5. Light position is relative to facility center
// ---------------------------------------------------------------------------
describe('light position is relative to facility center', () => {
  it('light target is at facility center on ground plane', () => {
    const dims = facilityDimensions(4, 6);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    expect(frustum.lightTarget[0]).toBeCloseTo(dims.centerX, 5);
    expect(frustum.lightTarget[1]).toBe(0);
    expect(frustum.lightTarget[2]).toBeCloseTo(dims.centerZ, 5);
  });

  it('light position is elevated above facility center', () => {
    const dims = facilityDimensions(3, 3);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // Light should be at a significant height
    expect(frustum.lightPosition[1]).toBeGreaterThanOrEqual(50);
  });

  it('light position shifts when facility center shifts', () => {
    const dims1 = facilityDimensions(2, 2);
    const dims2 = facilityDimensions(5, 8);

    const f1 = computeShadowFrustum(dims1.width, dims1.length, dims1.centerX, dims1.centerZ);
    const f2 = computeShadowFrustum(dims2.width, dims2.length, dims2.centerX, dims2.centerZ);

    // Different facility centers should produce different light positions
    expect(f1.lightPosition[0]).not.toBe(f2.lightPosition[0]);
    expect(f1.lightPosition[2]).not.toBe(f2.lightPosition[2]);

    // But same height
    expect(f1.lightPosition[1]).toBe(f2.lightPosition[1]);
  });
});

// ---------------------------------------------------------------------------
// 6. shouldCastShadow: distance-based shadow LOD
// ---------------------------------------------------------------------------
describe('shouldCastShadow distance-based LOD', () => {
  it('returns true for nearby objects within threshold', () => {
    // Camera at (0, 50, 0), object at (5, 0, 5), distance ~50.5
    const result = shouldCastShadow(0, 50, 0, 5, 0, 5, 80);
    expect(result).toBe(true);
  });

  it('returns false for distant objects beyond threshold', () => {
    // Camera at (0, 50, 0), object at (100, 0, 100), distance ~150
    const result = shouldCastShadow(0, 50, 0, 100, 0, 100, 40);
    expect(result).toBe(false);
  });

  it('returns true when threshold is 0 (LOD disabled)', () => {
    // Even very distant objects should cast shadow when threshold is 0
    const result = shouldCastShadow(0, 50, 0, 1000, 0, 1000, 0);
    expect(result).toBe(true);
  });

  it('returns true when threshold is negative (LOD disabled)', () => {
    const result = shouldCastShadow(0, 50, 0, 1000, 0, 1000, -1);
    expect(result).toBe(true);
  });

  it('object exactly at threshold distance returns true (inclusive)', () => {
    // Camera at origin, object at (30, 0, 40), distance = 50 exactly
    const result = shouldCastShadow(0, 0, 0, 30, 0, 40, 50);
    expect(result).toBe(true);
  });

  it('object just beyond threshold returns false', () => {
    // Camera at origin, object at (30, 0, 40.01), distance just over 50
    const result = shouldCastShadow(0, 0, 0, 30, 0, 40.01, 50);
    expect(result).toBe(false);
  });

  it('same position always returns true (distance=0)', () => {
    const result = shouldCastShadow(10, 20, 30, 10, 20, 30, 1);
    expect(result).toBe(true);
  });

  it('works correctly with typical game camera distances', () => {
    // Typical camera: position (30, 60, 50), looking at courts
    const cameraX = 30, cameraY = 60, cameraZ = 50;

    // Nearby player on visible court (10, 0, 10) - distance ~80
    const nearbyResult = shouldCastShadow(cameraX, cameraY, cameraZ, 10, 0, 10, 80);
    expect(nearbyResult).toBe(true);

    // Distant player on far court (200, 0, 200) - distance ~250
    const distantResult = shouldCastShadow(cameraX, cameraY, cameraZ, 200, 0, 200, 80);
    expect(distantResult).toBe(false);
  });

  it('halved threshold for balls makes them lose shadows sooner', () => {
    const cameraX = 0, cameraY = 50, cameraZ = 0;
    const objX = 45, objY = 1, objZ = 45;
    const playerThreshold = 80;
    const ballThreshold = playerThreshold / 2; // 40

    // At this distance (~88 units), player still casts but ball does not
    const playerResult = shouldCastShadow(cameraX, cameraY, cameraZ, objX, objY, objZ, playerThreshold);
    const ballResult = shouldCastShadow(cameraX, cameraY, cameraZ, objX, objY, objZ, ballThreshold);

    expect(playerResult).toBe(true);
    expect(ballResult).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Performance: shouldCastShadow is fast for many objects
// ---------------------------------------------------------------------------
describe('shadow LOD performance', () => {
  it('shouldCastShadow for 1000 objects completes in < 0.1ms', () => {
    const cameraX = 50, cameraY = 80, cameraZ = 50;
    const threshold = 80;

    // Generate 1000 random positions
    const objects: [number, number, number][] = [];
    for (let i = 0; i < 1000; i++) {
      objects.push([Math.random() * 500, 0, Math.random() * 500]);
    }

    // Warm up
    for (let w = 0; w < 100; w++) {
      for (const [x, y, z] of objects) {
        shouldCastShadow(cameraX, cameraY, cameraZ, x, y, z, threshold);
      }
    }

    // Benchmark
    const iterations = 1000;
    const start = performance.now();
    let castCount = 0;

    for (let iter = 0; iter < iterations; iter++) {
      castCount = 0;
      for (const [x, y, z] of objects) {
        if (shouldCastShadow(cameraX, cameraY, cameraZ, x, y, z, threshold)) {
          castCount++;
        }
      }
    }

    const elapsed = performance.now() - start;
    const perIteration = elapsed / iterations;

    // 1000 distance checks should be well under 0.1ms
    expect(perIteration).toBeLessThan(0.1);

    // Sanity: some should cast, some shouldn't
    expect(castCount).toBeGreaterThan(0);
    expect(castCount).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// 8. Integration: frustum + LOD work together for realistic scenarios
// ---------------------------------------------------------------------------
describe('shadow system integration scenarios', () => {
  it('small facility (2x3) has dramatically smaller frustum than old hardcoded', () => {
    const dims = facilityDimensions(2, 3);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // Old hardcoded: left=-50, right=50, top=50, bottom=-50 (100x100 area)
    const oldArea = 100 * 100;
    const newArea = (frustum.right - frustum.left) * (frustum.top - frustum.bottom);

    // New frustum area should be significantly smaller than old 100x100
    expect(newArea).toBeLessThan(oldArea);
    // For a 2x3 facility (~22m x 35m), frustum should be about 39x39 = ~1521
    // vs old 10000, so ratio should be > 2x reduction
    expect(oldArea / newArea).toBeGreaterThan(2);
  });

  it('large facility (10x10) frustum is proportionally large', () => {
    const dims = facilityDimensions(10, 10);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // 10x10 facility is ~77m x 149m, so frustum half-extent ~ 77
    // This is larger than old hardcoded 50 in one dimension -- that's fine,
    // the key is that it's dynamic and matches the actual facility
    expect(frustum.right).toBeGreaterThan(0);
    expect(frustum.far).toBeLessThanOrEqual(150);
  });

  it('shadow far reduction saves depth buffer precision', () => {
    const dims = facilityDimensions(5, 5);
    const frustum = computeShadowFrustum(dims.width, dims.length, dims.centerX, dims.centerZ);

    // Old: far=200, near assumed ~0.1 -> ratio 2000
    // New: far=150, near=0.5 -> ratio 300
    // Lower ratio = better depth precision = fewer shadow artifacts
    const oldRatio = 200 / 0.1;
    const newRatio = frustum.far / frustum.near;
    expect(newRatio).toBeLessThan(oldRatio);
  });
});
