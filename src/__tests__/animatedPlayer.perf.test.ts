/**
 * Performance and correctness tests for AnimatedPlayer body bob animation.
 *
 * Task 2: Fix AnimatedPlayer useMemo
 * Problem: performance.now() inside useMemo defeats memoization and freezes animation.
 * Solution: Replace with useFrame + imperative ref mutation.
 *
 * These tests verify:
 * 1. No performance.now() inside useMemo (static analysis)
 * 2. Body bob animation is driven by useFrame, not React state
 * 3. Animation responds correctly to animState changes
 * 4. Position.y is zero when idle/ready
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Source file path for static analysis
// ---------------------------------------------------------------------------
const ANIMATED_PLAYER_PATH = path.resolve(
  __dirname,
  '../components/three/AnimatedPlayer.tsx'
);

// ---------------------------------------------------------------------------
// SECTION 1: Static source analysis
// These tests read the raw source text to verify anti-patterns are absent
// and correct patterns are present. They work regardless of runtime mocking.
// ---------------------------------------------------------------------------
describe('AnimatedPlayer - static source analysis', () => {
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(ANIMATED_PLAYER_PATH, 'utf-8');
  });

  it('should NOT call performance.now() inside useMemo', () => {
    // Match useMemo blocks and check none contain performance.now()
    const useMemoBlocks = source.match(/useMemo\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[[\s\S]*?\]\s*\)/g) || [];

    for (const block of useMemoBlocks) {
      expect(block).not.toContain('performance.now()');
    }

    // Also do a direct negative check: performance.now() should not appear
    // anywhere in a useMemo context
    const perfNowInMemo = /useMemo\s*\([^)]*performance\.now\(\)/s;
    expect(source).not.toMatch(perfNowInMemo);
  });

  it('should not have bodyOffset as a useMemo variable', () => {
    // The old pattern: const bodyOffset = useMemo(...)
    const bodyOffsetMemo = /const\s+bodyOffset\s*=\s*useMemo/;
    expect(source).not.toMatch(bodyOffsetMemo);
  });

  it('should import useFrame from @react-three/fiber', () => {
    const useFrameImport = /import\s+\{[^}]*useFrame[^}]*\}\s+from\s+['"]@react-three\/fiber['"]/;
    expect(source).toMatch(useFrameImport);
  });

  it('should call useFrame with a callback function', () => {
    // useFrame((state) => { ... }) or useFrame((state, delta) => { ... })
    const useFrameCall = /useFrame\s*\(\s*\(/;
    expect(source).toMatch(useFrameCall);
  });

  it('should set groupRef.current.position.y inside useFrame', () => {
    // Find the useFrame block and verify it writes to position.y
    const useFrameBlock = source.match(/useFrame\s*\(\s*\([\s\S]*?\)\s*=>\s*\{[\s\S]*?\}\s*\)/g) || [];
    expect(useFrameBlock.length).toBeGreaterThan(0);

    const hasPositionYWrite = useFrameBlock.some(block =>
      /groupRef\.current\.position\.y\s*=/.test(block)
    );
    expect(hasPositionYWrite).toBe(true);
  });

  it('should handle celebrate state in useFrame with correct frequency', () => {
    // Original: Math.sin(performance.now() * 0.01) * 0.1
    // Fixed:    Math.sin(t * 10) * 0.1
    // The amplitude 0.1 must be preserved
    const celebratePattern = /celebrate[\s\S]*?Math\.sin\(.*?\*\s*10\)\s*\*\s*0\.1/;
    expect(source).toMatch(celebratePattern);
  });

  it('should handle moving state in useFrame with correct frequency', () => {
    // Original: Math.sin(performance.now() * 0.02) * 0.05
    // Fixed:    Math.sin(t * 20) * 0.05
    // The amplitude 0.05 must be preserved
    const movingPattern = /moving[\s\S]*?Math\.sin\(.*?\*\s*20\)\s*\*\s*0\.05/;
    expect(source).toMatch(movingPattern);
  });

  it('should set position.y to 0 for non-animated states', () => {
    // The else branch should set position.y = 0
    const zeroPattern = /position\.y\s*=\s*0/;
    expect(source).toMatch(zeroPattern);
  });

  it('should guard against null groupRef.current', () => {
    // Must have a null check: if (!groupRef.current) return;
    const nullGuard = /if\s*\(\s*!groupRef\.current\s*\)\s*return/;
    expect(source).toMatch(nullGuard);
  });

  it('should NOT use bodyOffset in JSX position prop', () => {
    // The position array should no longer reference bodyOffset
    const bodyOffsetInJsx = /position=\{[\s\S]*?bodyOffset[\s\S]*?\}/;
    expect(source).not.toMatch(bodyOffsetInJsx);
  });
});

// ---------------------------------------------------------------------------
// SECTION 2: Body bob animation math (pure function tests)
// These test the mathematical properties of the animation without R3F deps.
// ---------------------------------------------------------------------------
describe('AnimatedPlayer - body bob animation math', () => {
  // Replicate the animation logic as a pure function for testing.
  // This MUST match the implementation in the useFrame callback.
  function computeBodyBob(animState: string, elapsedTime: number): number {
    if (animState === 'celebrate') {
      return Math.sin(elapsedTime * 10) * 0.1;
    }
    if (animState === 'moving') {
      return Math.sin(elapsedTime * 20) * 0.05;
    }
    return 0;
  }

  it('should return 0 for idle state at any time', () => {
    expect(computeBodyBob('idle', 0)).toBe(0);
    expect(computeBodyBob('idle', 1.5)).toBe(0);
    expect(computeBodyBob('idle', 100)).toBe(0);
  });

  it('should return 0 for ready state at any time', () => {
    expect(computeBodyBob('ready', 0)).toBe(0);
    expect(computeBodyBob('ready', 5.0)).toBe(0);
  });

  it('should return 0 for swing state at any time', () => {
    expect(computeBodyBob('swing', 0)).toBe(0);
    expect(computeBodyBob('swing', 2.7)).toBe(0);
  });

  it('should return 0 for serve state at any time', () => {
    expect(computeBodyBob('serve', 0)).toBe(0);
    expect(computeBodyBob('serve', 3.14)).toBe(0);
  });

  it('celebrate bob should be bounded in [-0.1, 0.1]', () => {
    for (let t = 0; t < 10; t += 0.01) {
      const val = computeBodyBob('celebrate', t);
      expect(val).toBeGreaterThanOrEqual(-0.1);
      expect(val).toBeLessThanOrEqual(0.1);
    }
  });

  it('moving bob should be bounded in [-0.05, 0.05]', () => {
    for (let t = 0; t < 10; t += 0.01) {
      const val = computeBodyBob('moving', t);
      expect(val).toBeGreaterThanOrEqual(-0.05);
      expect(val).toBeLessThanOrEqual(0.05);
    }
  });

  it('celebrate should produce different values at different times (it animates)', () => {
    const v1 = computeBodyBob('celebrate', 0);
    const v2 = computeBodyBob('celebrate', 0.1);
    const v3 = computeBodyBob('celebrate', 0.2);
    // At least two of three should differ (sine wave)
    const allSame = v1 === v2 && v2 === v3;
    expect(allSame).toBe(false);
  });

  it('moving should produce different values at different times (it animates)', () => {
    const v1 = computeBodyBob('moving', 0);
    const v2 = computeBodyBob('moving', 0.05);
    const v3 = computeBodyBob('moving', 0.1);
    const allSame = v1 === v2 && v2 === v3;
    expect(allSame).toBe(false);
  });

  it('celebrate frequency should be 10 rad/s (matching original perf.now()*0.01)', () => {
    // At t = pi/(2*10) = pi/20, sin should be 1.0 (peak)
    const peakTime = Math.PI / 20;
    const val = computeBodyBob('celebrate', peakTime);
    expect(val).toBeCloseTo(0.1, 10);
  });

  it('moving frequency should be 20 rad/s (matching original perf.now()*0.02)', () => {
    // At t = pi/(2*20) = pi/40, sin should be 1.0 (peak)
    const peakTime = Math.PI / 40;
    const val = computeBodyBob('moving', peakTime);
    expect(val).toBeCloseTo(0.05, 10);
  });

  it('should be continuous - no discontinuities in the sine wave', () => {
    // Check that adjacent samples are close (Lipschitz continuity check)
    const dt = 0.0001;
    for (let t = 0; t < 1; t += 0.01) {
      const v1 = computeBodyBob('celebrate', t);
      const v2 = computeBodyBob('celebrate', t + dt);
      const diff = Math.abs(v2 - v1);
      // Max derivative of sin(10t)*0.1 is 10*0.1 = 1.0, so diff < 1.0 * dt * 2
      expect(diff).toBeLessThan(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 3: Structural verification of the useFrame body
// These tests parse the useFrame block from source to verify its internal
// structure without needing to import/render the R3F component.
// ---------------------------------------------------------------------------
describe('AnimatedPlayer - useFrame callback structure', () => {
  let source: string;
  let useFrameBody: string;

  beforeEach(() => {
    source = fs.readFileSync(ANIMATED_PLAYER_PATH, 'utf-8');
    // Extract the useFrame callback body
    const match = source.match(/useFrame\s*\(\s*\([\s\S]*?\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
    useFrameBody = match ? match[1] : '';
  });

  it('should have a useFrame block to extract', () => {
    expect(useFrameBody.length).toBeGreaterThan(0);
  });

  it('useFrame body should check for celebrate state', () => {
    expect(useFrameBody).toContain("'celebrate'");
  });

  it('useFrame body should check for moving state', () => {
    expect(useFrameBody).toContain("'moving'");
  });

  it('useFrame body should NOT check for idle or ready (they fall through to else)', () => {
    // idle and ready should be handled by the else branch (position.y = 0)
    // They should NOT have explicit string checks in the useFrame body
    expect(useFrameBody).not.toContain("'idle'");
    expect(useFrameBody).not.toContain("'ready'");
  });

  it('useFrame body should read elapsedTime from the state/clock argument', () => {
    // Should reference clock.elapsedTime or destructure elapsedTime
    const usesElapsedTime = /clock\.elapsedTime|elapsedTime/.test(useFrameBody);
    expect(usesElapsedTime).toBe(true);
  });

  it('useFrame body should NOT call performance.now()', () => {
    expect(useFrameBody).not.toContain('performance.now()');
  });

  it('useFrame body should NOT use useState or setState', () => {
    // Animation should be entirely imperative, no React state
    expect(useFrameBody).not.toContain('useState');
    expect(useFrameBody).not.toContain('setState');
    expect(useFrameBody).not.toContain('set(');
  });

  it('useFrame body should assign position.y exactly 3 times (celebrate, moving, else)', () => {
    const assignments = useFrameBody.match(/position\.y\s*=/g) || [];
    expect(assignments.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// SECTION 4: Performance anti-pattern regression guards
// These tests ensure common animation anti-patterns are not reintroduced.
// ---------------------------------------------------------------------------
describe('AnimatedPlayer - performance anti-pattern guards', () => {
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(ANIMATED_PLAYER_PATH, 'utf-8');
  });

  it('should not use Date.now() anywhere in the component', () => {
    expect(source).not.toContain('Date.now()');
  });

  it('should not use requestAnimationFrame (useFrame replaces it in R3F)', () => {
    expect(source).not.toContain('requestAnimationFrame');
  });

  it('should not use setInterval or setTimeout for animation', () => {
    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('setTimeout');
  });

  it('should not force re-renders with a time-based state variable', () => {
    // No useState with a time/tick counter that would trigger re-renders
    const timeState = /useState.*(?:time|tick|frame|clock|now)/i;
    expect(source).not.toMatch(timeState);
  });

  it('should still use useMemo for armRotation (that one is correct)', () => {
    // armRotation useMemo is fine - it depends on animState and swingPhase
    // which are legitimate React state dependencies
    const armRotationMemo = /const\s+armRotation\s*=\s*useMemo/;
    expect(source).toMatch(armRotationMemo);
  });

  it('bodyOffset variable should not exist anywhere in the component', () => {
    // After the fix, bodyOffset should be completely removed
    expect(source).not.toContain('bodyOffset');
  });
});
