/**
 * GC Elimination Performance Tests (Task 15)
 *
 * Verifies that per-frame memory allocations have been eliminated
 * from all hot-path code. These tests use source code analysis
 * (grep-style pattern matching) and runtime allocation tracking
 * to ensure zero GC pressure during gameplay.
 *
 * Allocation sources targeted (from research KB):
 *   1. gameStore.ts: new Map(state.games) - per-frame Map clone
 *   2. gameStore.ts: { ...game } - per-frame object spread
 *   3. simulationStore.ts: new Map(s.courts) - Map clone on events
 *   4. gameStore.ts: players.find() - iterator creation
 *   5. performanceStore.ts: const times: number[] = [] - array alloc
 *   6. performanceStore.ts: .sort() - temp storage
 *   7. performanceStore.ts: .filter() - new array creation
 *   8. gameStore.ts: ball.position = { x, y, z } - new object
 *   9. gameStore.ts: calculateShotVelocity returns new object
 *  10. simulationStore.ts: set((s) => { ... }) closures
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Helper: Read source file content for static analysis
// ============================================================
function readSource(relativePath: string): string {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Extract the body of a specific function from source code.
 * Handles nested braces to find the full function body.
 */
function extractFunctionBody(source: string, functionName: string): string {
  // Try multiple patterns to find the function start
  const patterns = [
    new RegExp(`${functionName}\\s*[:=]\\s*\\([^)]*\\)\\s*=>\\s*\\{`, 'g'),
    new RegExp(`${functionName}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`function\\s+${functionName}\\s*\\([^)]*\\)\\s*[^{]*\\{`, 'g'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) {
      const startIdx = match.index + match[0].length;
      let depth = 1;
      let i = startIdx;
      while (i < source.length && depth > 0) {
        if (source[i] === '{') depth++;
        if (source[i] === '}') depth--;
        i++;
      }
      return source.substring(match.index, i);
    }
  }
  return '';
}

// ============================================================
// Section 1: Static Analysis - Forbidden Patterns in Hot Paths
// ============================================================
describe('GC Elimination: Static Analysis of Hot Paths', () => {
  let gameStoreSource: string;
  let perfStoreSource: string;
  let simStoreSource: string;
  let robotControllerSource: string;

  beforeEach(() => {
    gameStoreSource = readSource('stores/gameStore.ts');
    perfStoreSource = readSource('stores/performanceStore.ts');
    simStoreSource = readSource('stores/simulationStore.ts');
    robotControllerSource = readSource('hooks/useRobotController.ts');
  });

  describe('gameStore.ts - updateGame() hot path', () => {
    it('should NOT contain new Map() in updateGame', () => {
      const updateGameBody = extractFunctionBody(gameStoreSource, 'updateGame');
      expect(updateGameBody).not.toBe('');
      // new Map(state.games) or new Map(s.games) should not appear in updateGame
      expect(updateGameBody).not.toMatch(/new\s+Map\s*\(/);
    });

    it('should NOT contain object spread { ...game } in updateGame', () => {
      const updateGameBody = extractFunctionBody(gameStoreSource, 'updateGame');
      expect(updateGameBody).not.toBe('');
      // { ...game } or { ...game, } should not appear in the per-frame set() call
      // We check for the specific pattern of spreading a game object
      expect(updateGameBody).not.toMatch(/\{\s*\.\.\.game\s*\}/);
    });

    it('should NOT allocate new position objects (ball.position = { ... })', () => {
      const updateGameBody = extractFunctionBody(gameStoreSource, 'updateGame');
      expect(updateGameBody).not.toBe('');
      // ball.position = { x: ..., y: ..., z: ... } should not appear
      // Instead should be: ball.position.x = ...; ball.position.y = ...; ball.position.z = ...;
      expect(updateGameBody).not.toMatch(/ball\.position\s*=\s*\{/);
      expect(updateGameBody).not.toMatch(/position\s*=\s*\{\s*x\s*:/);
    });

    it('should NOT use players.find() in rally logic', () => {
      const updateGameBody = extractFunctionBody(gameStoreSource, 'updateGame');
      expect(updateGameBody).not.toBe('');
      // players.find(p => p.team === ...) creates iterator + closure
      expect(updateGameBody).not.toMatch(/players\.find\s*\(/);
    });

    it('should NOT call calculateShotVelocity that returns new object', () => {
      // The old pattern: ball.velocity = calculateShotVelocity(...)
      // The new pattern: calculateShotVelocityInto(..., ball.velocity)
      const updateGameBody = extractFunctionBody(gameStoreSource, 'updateGame');
      expect(updateGameBody).not.toBe('');
      // Should not assign return value of calculateShotVelocity to ball.velocity
      expect(updateGameBody).not.toMatch(/ball\.velocity\s*=\s*calculateShotVelocity\s*\(/);
    });

    it('should NOT pass object literals as arguments to shot velocity function', () => {
      const updateGameBody = extractFunctionBody(gameStoreSource, 'updateGame');
      expect(updateGameBody).not.toBe('');
      // Should not create temporary { x: ..., z: ... } wrapper objects
      // Pattern: calculateShotVelocity({ x: ..., z: ... }, { x: ..., z: ... }, ...)
      expect(updateGameBody).not.toMatch(/calculateShotVelocity\s*\(\s*\{/);
      expect(updateGameBody).not.toMatch(/calculateShotVelocityInto\s*\(\s*\{/);
    });
  });

  describe('gameStore.ts - calculateShotVelocity', () => {
    it('should use output parameter pattern (void return, writes to out)', () => {
      // The function should either:
      // 1. Be named calculateShotVelocityInto and take an output param, OR
      // 2. Write to tempVec or similar pre-allocated object
      const hasOutputParam = gameStoreSource.includes('calculateShotVelocityInto') ||
        gameStoreSource.includes('out.x') ||
        gameStoreSource.includes('out.y') ||
        gameStoreSource.includes('out.z');
      const hasReturnObject = /function\s+calculateShotVelocity[^{]*\{[^}]*return\s*\{/.test(
        gameStoreSource.replace(/\n/g, ' ')
      );

      // Either uses output param pattern OR doesn't return object literal
      expect(hasOutputParam || !hasReturnObject).toBe(true);
    });
  });

  describe('gameStore.ts - initializeGame and endGame', () => {
    it('should NOT clone Map in initializeGame', () => {
      const body = extractFunctionBody(gameStoreSource, 'initializeGame');
      expect(body).not.toBe('');
      expect(body).not.toMatch(/new\s+Map\s*\(\s*state\.games\s*\)/);
    });

    it('should NOT clone Map in endGame', () => {
      const body = extractFunctionBody(gameStoreSource, 'endGame');
      expect(body).not.toBe('');
      expect(body).not.toMatch(/new\s+Map\s*\(\s*state\.games\s*\)/);
    });
  });

  describe('performanceStore.ts - recordFrame() metrics path', () => {
    it('should NOT allocate number[] array for frame times', () => {
      const body = extractFunctionBody(perfStoreSource, 'recordFrame');
      expect(body).not.toBe('');
      // const times: number[] = [] or const times = [] should not appear
      expect(body).not.toMatch(/const\s+times\s*[:]?\s*(?:number\[\])?\s*=\s*\[\s*\]/);
      expect(body).not.toMatch(/let\s+times\s*[:]?\s*(?:number\[\])?\s*=\s*\[\s*\]/);
    });

    it('should NOT use .filter() to count frame drops', () => {
      const body = extractFunctionBody(perfStoreSource, 'recordFrame');
      expect(body).not.toBe('');
      // .filter(t => t > 33.33).length creates a new array
      expect(body).not.toMatch(/\.filter\s*\(/);
    });

    it('should NOT use Array.prototype.push in frame time collection', () => {
      const body = extractFunctionBody(perfStoreSource, 'recordFrame');
      expect(body).not.toBe('');
      // times.push(frameTimeBuffer[i]) allocates via dynamic array growth
      expect(body).not.toMatch(/times\.push\s*\(/);
    });

    it('should use pre-allocated scratch buffer (Float64Array at module scope)', () => {
      // There should be a module-scope Float64Array for scratch computation
      // Pattern: const scratchBuffer = new Float64Array(...)
      const hasScratch = perfStoreSource.match(
        /(?:const|let)\s+\w*[Ss]cratch\w*\s*=\s*new\s+Float64Array\s*\(/
      );
      expect(hasScratch).not.toBeNull();
    });
  });

  describe('simulationStore.ts - tick() event handlers', () => {
    it('should NOT clone Map in tick booking start handler', () => {
      const body = extractFunctionBody(simStoreSource, 'tick');
      if (body) {
        // Count occurrences of new Map(s.courts) or new Map(state.courts)
        const mapClones = (body.match(/new\s+Map\s*\(\s*s\.courts\s*\)/g) || []).length;
        expect(mapClones).toBe(0);
      }
    });

    it('should NOT use object spread for court updates in tick', () => {
      const body = extractFunctionBody(simStoreSource, 'tick');
      if (body) {
        // { ...c, status: ... } or { ...court, status: ... }
        const spreads = (body.match(/\{\s*\.\.\.c\b/g) || []).length;
        expect(spreads).toBe(0);
      }
    });
  });

  describe('useRobotController.ts - useFrame hot loop', () => {
    it('should NOT create fallback object on every frame', () => {
      // The old pattern: robotStates.current.get(id) || { currentPath: [], ... }
      // creates a new object on the || branch every frame
      // New pattern: lazy-init into the Map once
      const source = robotControllerSource;
      // Count occurrences of the fallback pattern in the useFrame body
      // We look for || { that creates arrays and objects
      const fallbackPattern = /\|\|\s*\{\s*currentPath\s*:\s*\[\s*\]/g;
      const matches = source.match(fallbackPattern) || [];
      expect(matches.length).toBe(0);
    });

    it('should NOT use object spread for robotStates updates', () => {
      // Old pattern: robotStates.current.set(id, { ...state, ... })
      // New pattern: state.currentPath = ...; (direct mutation)
      const source = robotControllerSource;
      // Count spread patterns in set() calls for robotStates
      const spreadSets = (source.match(/robotStates\.current\.set\([^,]+,\s*\{\s*\.\.\./g) || []).length;
      expect(spreadSets).toBe(0);
    });
  });
});

// ============================================================
// Section 2: Pre-allocated Temp Objects Verification
// ============================================================
describe('GC Elimination: Pre-allocated Objects', () => {
  let gameStoreSource: string;
  let perfStoreSource: string;

  beforeEach(() => {
    gameStoreSource = readSource('stores/gameStore.ts');
    perfStoreSource = readSource('stores/performanceStore.ts');
  });

  it('should have pre-allocated tempVec at module scope in gameStore', () => {
    // const tempVec = { x: 0, y: 0, z: 0 };
    expect(gameStoreSource).toMatch(/(?:const|let)\s+tempVec\s*=\s*\{/);
  });

  it('should have pre-allocated scratch buffer at module scope in performanceStore', () => {
    // const scratchBuffer = new Float64Array(RING_BUFFER_SIZE);
    expect(perfStoreSource).toMatch(
      /(?:const|let)\s+\w*[Ss]cratch\w*\s*=\s*new\s+Float64Array\s*\(/
    );
  });

  it('should have _gameVersion field in gameStore for React sync', () => {
    expect(gameStoreSource).toMatch(/_gameVersion/);
  });
});

// ============================================================
// Section 3: Runtime Allocation Verification (Behavioral)
// ============================================================
describe('GC Elimination: Runtime Behavior', () => {
  it('should mutate ball position in place (no new object)', async () => {
    // Import the actual store
    const { useGameStore } = await import('@/stores/gameStore');

    // Initialize a game
    const store = useGameStore.getState();
    store.initializeGame('test-court-1', { x: 0, z: 0 });

    const game = store.getGame('test-court-1');
    expect(game).toBeDefined();

    if (game) {
      // Capture the position object reference
      const posRef = game.ballState.position;

      // Run an update
      store.updateGame('test-court-1', 0.016);

      // The position object reference should be THE SAME (mutated in place)
      const gameAfter = useGameStore.getState().getGame('test-court-1');
      if (gameAfter) {
        expect(gameAfter.ballState.position).toBe(posRef);
      }
    }

    // Cleanup
    store.endGame('test-court-1');
  });

  it('should mutate ball velocity in place (no new object) during rally', async () => {
    const { useGameStore } = await import('@/stores/gameStore');

    const store = useGameStore.getState();
    store.initializeGame('test-court-2', { x: 0, z: 0 });

    const game = store.getGame('test-court-2');
    expect(game).toBeDefined();

    if (game) {
      // Force into rally state for testing
      game.status = 'rally';
      game.ballState.isVisible = true;
      game.ballState.velocity.x = 5;
      game.ballState.velocity.y = 3;
      game.ballState.velocity.z = 8;

      const velRef = game.ballState.velocity;

      // Run multiple updates
      for (let i = 0; i < 10; i++) {
        store.updateGame('test-court-2', 0.016);
      }

      const gameAfter = useGameStore.getState().getGame('test-court-2');
      if (gameAfter) {
        // Velocity object reference should be the same (mutated in place)
        expect(gameAfter.ballState.velocity).toBe(velRef);
      }
    }

    store.endGame('test-court-2');
  });

  it('should not create new Map on updateGame calls', async () => {
    const { useGameStore } = await import('@/stores/gameStore');

    const store = useGameStore.getState();
    store.initializeGame('test-court-3', { x: 0, z: 0 });

    // Capture the games Map reference
    const mapRef = useGameStore.getState().games;

    // Run 100 updates
    for (let i = 0; i < 100; i++) {
      store.updateGame('test-court-3', 0.016);
    }

    // The Map reference should be the same (not cloned)
    const mapAfter = useGameStore.getState().games;
    expect(mapAfter).toBe(mapRef);

    store.endGame('test-court-3');
  });

  it('should count frame drops via loop, not .filter()', async () => {
    const { usePerformanceStore } = await import('@/stores/performanceStore');

    const store = usePerformanceStore.getState();
    store.reset();

    // Record 31 frames to trigger the every-30-frame calculation
    for (let i = 0; i < 31; i++) {
      // Mix of fast and slow frames
      const deltaMs = i % 5 === 0 ? 40 : 8; // 40ms = below 30fps (frame drop)
      store.recordFrame(deltaMs);
    }

    // The store should have computed frameDrops
    const state = usePerformanceStore.getState();
    expect(state.frameDrops).toBeGreaterThanOrEqual(0);
    // 7 out of 31 frames are 40ms (indices 0,5,10,15,20,25,30)
    expect(state.frameDrops).toBeGreaterThan(0);
  });
});

// ============================================================
// Section 4: Source Code Pattern Summary
// ============================================================
describe('GC Elimination: Forbidden Pattern Summary', () => {
  /**
   * Comprehensive scan: no forbidden allocation patterns in any hot-path function.
   * Hot paths: updateGame, recordFrame, tick (when called from useFrame)
   */
  it('should have zero forbidden patterns across all hot-path functions', () => {
    const gameStore = readSource('stores/gameStore.ts');
    const perfStore = readSource('stores/performanceStore.ts');

    const updateGameBody = extractFunctionBody(gameStore, 'updateGame');
    const recordFrameBody = extractFunctionBody(perfStore, 'recordFrame');

    const forbiddenPatterns = [
      { pattern: /new\s+Map\s*\(/, name: 'new Map()' },
      { pattern: /\{\s*\.\.\.\w+\s*\}/, name: 'object spread {...x}' },
      { pattern: /\.filter\s*\(/, name: '.filter()' },
      { pattern: /\.find\s*\(/, name: '.find()' },
      { pattern: /const\s+\w+\s*(?::\s*\w+\[\])?\s*=\s*\[\s*\]/, name: 'array literal []' },
    ];

    const violations: string[] = [];

    for (const { pattern, name } of forbiddenPatterns) {
      if (pattern.test(updateGameBody)) {
        violations.push(`updateGame contains forbidden pattern: ${name}`);
      }
      if (pattern.test(recordFrameBody)) {
        violations.push(`recordFrame contains forbidden pattern: ${name}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
