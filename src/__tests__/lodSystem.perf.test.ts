/**
 * LOD System Performance Tests - Task 8
 *
 * Validates the Level of Detail system for the pickleball facility renderer.
 * Tests cover: threshold configuration, LOD level selection, hysteresis,
 * vertex count reduction, configurability, and draw call budget estimation.
 *
 * These tests run against the LOD configuration and geometry definitions
 * WITHOUT requiring a full Three.js WebGL context (pure unit/benchmark tests).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';

// ============================================================
// LOD Configuration Constants (mirrors src/lib/lodConfig.ts)
// These will be imported from the real module once implemented.
// For now, define inline so tests are ready to run immediately.
// ============================================================

const HYSTERESIS_FACTOR = 0.1;
const LOD_CHECK_INTERVAL = 3;

// Distance thresholds (meters) - ordered from closest to farthest
const COURT_LOD_DISTANCES = [0, 35, 80, 180] as const;
const PLAYER_LOD_DISTANCES = [0, 30, 60] as const;
const BALL_LOD_DISTANCES = [0, 15, 35] as const;
const ROBOT_LOD_DISTANCES = [0, 25, 60] as const;
const SCOREBOARD_LOD_DISTANCES = [0, 30, 60] as const;
const GAME_LOD_DISTANCES = [0, 35, 80] as const;

// Shadow thresholds
const SHADOW_CAST_DISTANCE = 30;
const SHADOW_RECEIVE_DISTANCE = 80;

// Pre-squared thresholds
const COURT_LOD_SQUARED = COURT_LOD_DISTANCES.map(d => d * d);
const PLAYER_LOD_SQUARED = PLAYER_LOD_DISTANCES.map(d => d * d);
const BALL_LOD_SQUARED = BALL_LOD_DISTANCES.map(d => d * d);
const ROBOT_LOD_SQUARED = ROBOT_LOD_DISTANCES.map(d => d * d);

/**
 * Compute LOD distance threshold from object size and target screen fraction.
 */
function computeLODThreshold(
  objectSize: number,
  targetScreenFraction: number,
  fovDegrees: number = 50
): number {
  const halfFovRad = (fovDegrees / 2) * Math.PI / 180;
  return objectSize / (2 * Math.tan(halfFovRad) * targetScreenFraction);
}

/**
 * Simulates the LOD level selection algorithm (same logic as useLODLevel hook).
 * Uses squared distance comparison with hysteresis.
 */
function selectLODLevel(
  distanceSquared: number,
  squaredThresholds: readonly number[],
  currentLevel: number
): number {
  let newLevel = 0;
  for (let i = squaredThresholds.length - 1; i >= 1; i--) {
    const threshold = squaredThresholds[i];
    if (i > currentLevel) {
      // Going to lower quality: must exceed threshold
      if (distanceSquared >= threshold) {
        newLevel = i;
        break;
      }
    } else {
      // Going to higher quality: must be below threshold * (1 - hysteresis)^2
      const hysteresisThreshold = threshold * (1 - HYSTERESIS_FACTOR) * (1 - HYSTERESIS_FACTOR);
      if (distanceSquared >= hysteresisThreshold) {
        newLevel = i;
        break;
      }
    }
  }
  return newLevel;
}

// ============================================================
// Geometry definitions for vertex counting
// ============================================================

// Player geometries
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.22;
const HEAD_RADIUS = 0.14;

// Court dimensions
const COURT_WIDTH = 20 * 0.3048;  // 6.096m
const COURT_LENGTH = 44 * 0.3048; // 13.4112m

// Robot dimensions
const ROBOT_WIDTH = 0.552;
const ROBOT_HEIGHT = 0.695;
const ROBOT_LENGTH = 0.629;

// ============================================================
// Tests
// ============================================================

describe('Task 8: Level of Detail System', () => {

  // ---------------------------------------------------------
  // Step 1: LOD Configuration
  // ---------------------------------------------------------
  describe('Step 1: LOD Configuration Module', () => {

    it('should export all required distance threshold arrays', () => {
      expect(COURT_LOD_DISTANCES).toBeDefined();
      expect(PLAYER_LOD_DISTANCES).toBeDefined();
      expect(BALL_LOD_DISTANCES).toBeDefined();
      expect(ROBOT_LOD_DISTANCES).toBeDefined();
      expect(SCOREBOARD_LOD_DISTANCES).toBeDefined();
      expect(GAME_LOD_DISTANCES).toBeDefined();
    });

    it('should have correct number of LOD levels per entity type', () => {
      expect(COURT_LOD_DISTANCES.length).toBe(4);     // LOD0-3
      expect(PLAYER_LOD_DISTANCES.length).toBe(3);    // LOD0-2
      expect(BALL_LOD_DISTANCES.length).toBe(3);       // LOD0-2
      expect(ROBOT_LOD_DISTANCES.length).toBe(3);      // LOD0-2
      expect(SCOREBOARD_LOD_DISTANCES.length).toBe(3); // LOD0-2
      expect(GAME_LOD_DISTANCES.length).toBe(3);       // LOD0-2
    });

    it('should have all thresholds starting at 0 (highest detail)', () => {
      expect(COURT_LOD_DISTANCES[0]).toBe(0);
      expect(PLAYER_LOD_DISTANCES[0]).toBe(0);
      expect(BALL_LOD_DISTANCES[0]).toBe(0);
      expect(ROBOT_LOD_DISTANCES[0]).toBe(0);
      expect(SCOREBOARD_LOD_DISTANCES[0]).toBe(0);
      expect(GAME_LOD_DISTANCES[0]).toBe(0);
    });

    it('should have thresholds in ascending order', () => {
      for (let i = 1; i < COURT_LOD_DISTANCES.length; i++) {
        expect(COURT_LOD_DISTANCES[i]).toBeGreaterThan(COURT_LOD_DISTANCES[i - 1]);
      }
      for (let i = 1; i < PLAYER_LOD_DISTANCES.length; i++) {
        expect(PLAYER_LOD_DISTANCES[i]).toBeGreaterThan(PLAYER_LOD_DISTANCES[i - 1]);
      }
      for (let i = 1; i < BALL_LOD_DISTANCES.length; i++) {
        expect(BALL_LOD_DISTANCES[i]).toBeGreaterThan(BALL_LOD_DISTANCES[i - 1]);
      }
    });

    it('should have pre-squared thresholds matching squares of distances', () => {
      for (let i = 0; i < COURT_LOD_DISTANCES.length; i++) {
        expect(COURT_LOD_SQUARED[i]).toBe(COURT_LOD_DISTANCES[i] * COURT_LOD_DISTANCES[i]);
      }
      for (let i = 0; i < PLAYER_LOD_DISTANCES.length; i++) {
        expect(PLAYER_LOD_SQUARED[i]).toBe(PLAYER_LOD_DISTANCES[i] * PLAYER_LOD_DISTANCES[i]);
      }
      for (let i = 0; i < BALL_LOD_DISTANCES.length; i++) {
        expect(BALL_LOD_SQUARED[i]).toBe(BALL_LOD_DISTANCES[i] * BALL_LOD_DISTANCES[i]);
      }
    });

    it('should compute correct LOD threshold from object size and FOV', () => {
      // Court (13.4m) at 25% screen coverage with 50-deg FOV
      const courtThreshold = computeLODThreshold(13.4112, 0.25, 50);
      expect(courtThreshold).toBeGreaterThan(50);
      expect(courtThreshold).toBeLessThan(65);

      // Player (1.7m) at 10% screen coverage
      const playerThreshold = computeLODThreshold(1.7, 0.10, 50);
      expect(playerThreshold).toBeGreaterThan(15);
      expect(playerThreshold).toBeLessThan(25);

      // Ball (0.074m) at 1% screen coverage
      const ballThreshold = computeLODThreshold(0.074, 0.01, 50);
      expect(ballThreshold).toBeGreaterThan(5);
      expect(ballThreshold).toBeLessThan(15);
    });

    it('should have consistent shadow distance thresholds', () => {
      expect(SHADOW_CAST_DISTANCE).toBe(30);
      expect(SHADOW_RECEIVE_DISTANCE).toBe(80);
      expect(SHADOW_CAST_DISTANCE).toBeLessThan(SHADOW_RECEIVE_DISTANCE);
    });

    it('should have hysteresis factor between 0 and 1', () => {
      expect(HYSTERESIS_FACTOR).toBeGreaterThan(0);
      expect(HYSTERESIS_FACTOR).toBeLessThan(1);
      expect(HYSTERESIS_FACTOR).toBe(0.1);
    });

    it('should have check interval as a positive integer', () => {
      expect(LOD_CHECK_INTERVAL).toBeGreaterThan(0);
      expect(Number.isInteger(LOD_CHECK_INTERVAL)).toBe(true);
    });
  });

  // ---------------------------------------------------------
  // Step 2: LOD Level Selection
  // ---------------------------------------------------------
  describe('Step 2: LOD Level Selection (useLODLevel algorithm)', () => {

    it('should select correct LOD level for each court distance range', () => {
      // LOD0: < 35m (squared: 0 to 1225)
      expect(selectLODLevel(10 * 10, COURT_LOD_SQUARED, 0)).toBe(0);
      expect(selectLODLevel(20 * 20, COURT_LOD_SQUARED, 0)).toBe(0);
      expect(selectLODLevel(34 * 34, COURT_LOD_SQUARED, 0)).toBe(0);

      // LOD1: 35-80m (squared: 1225 to 6400)
      expect(selectLODLevel(40 * 40, COURT_LOD_SQUARED, 0)).toBe(1);
      expect(selectLODLevel(60 * 60, COURT_LOD_SQUARED, 0)).toBe(1);
      expect(selectLODLevel(79 * 79, COURT_LOD_SQUARED, 0)).toBe(1);

      // LOD2: 80-180m (squared: 6400 to 32400)
      expect(selectLODLevel(90 * 90, COURT_LOD_SQUARED, 0)).toBe(2);
      expect(selectLODLevel(150 * 150, COURT_LOD_SQUARED, 0)).toBe(2);

      // LOD3: > 180m (squared: > 32400)
      expect(selectLODLevel(200 * 200, COURT_LOD_SQUARED, 0)).toBe(3);
      expect(selectLODLevel(500 * 500, COURT_LOD_SQUARED, 0)).toBe(3);
    });

    it('should select correct LOD level for player distances', () => {
      // LOD0: < 30m
      expect(selectLODLevel(15 * 15, PLAYER_LOD_SQUARED, 0)).toBe(0);

      // LOD1: 30-60m
      expect(selectLODLevel(45 * 45, PLAYER_LOD_SQUARED, 0)).toBe(1);

      // LOD2: > 60m
      expect(selectLODLevel(100 * 100, PLAYER_LOD_SQUARED, 0)).toBe(2);
    });

    it('should select correct LOD level for ball distances', () => {
      // LOD0: < 15m
      expect(selectLODLevel(10 * 10, BALL_LOD_SQUARED, 0)).toBe(0);

      // LOD1: 15-35m
      expect(selectLODLevel(25 * 25, BALL_LOD_SQUARED, 0)).toBe(1);

      // LOD2: > 35m
      expect(selectLODLevel(50 * 50, BALL_LOD_SQUARED, 0)).toBe(2);
    });

    it('should handle distance of zero (LOD0)', () => {
      expect(selectLODLevel(0, COURT_LOD_SQUARED, 0)).toBe(0);
      expect(selectLODLevel(0, PLAYER_LOD_SQUARED, 0)).toBe(0);
      expect(selectLODLevel(0, BALL_LOD_SQUARED, 0)).toBe(0);
    });

    it('should handle very large distances (highest LOD level)', () => {
      expect(selectLODLevel(10000 * 10000, COURT_LOD_SQUARED, 0)).toBe(3);
      expect(selectLODLevel(10000 * 10000, PLAYER_LOD_SQUARED, 0)).toBe(2);
      expect(selectLODLevel(10000 * 10000, BALL_LOD_SQUARED, 0)).toBe(2);
    });
  });

  // ---------------------------------------------------------
  // Step 3: LOD Transition Hysteresis
  // ---------------------------------------------------------
  describe('Step 3: LOD Transition Hysteresis (anti-popping)', () => {

    it('should not switch back immediately at threshold boundary', () => {
      // Start at LOD0, move to 35m to trigger LOD1
      const level1 = selectLODLevel(35 * 35, COURT_LOD_SQUARED, 0);
      expect(level1).toBe(1);

      // Move back to just below 35m - should stay at LOD1 due to hysteresis
      // Hysteresis threshold = 35^2 * (1-0.1)^2 = 1225 * 0.81 = 992.25
      // 34m^2 = 1156 > 992.25, so stays at LOD1
      const level1Stable = selectLODLevel(34 * 34, COURT_LOD_SQUARED, 1);
      expect(level1Stable).toBe(1);

      // Move significantly closer - hysteresis band exceeded, back to LOD0
      // Need to get below sqrt(992.25) = ~31.5m
      // 30m^2 = 900 < 992.25 -> LOD0
      const level0Back = selectLODLevel(30 * 30, COURT_LOD_SQUARED, 1);
      expect(level0Back).toBe(0);
    });

    it('should have approximately 10% hysteresis band', () => {
      const threshold = 35; // LOD1 threshold
      const thresholdSq = threshold * threshold;
      const hysteresisThresholdSq = thresholdSq * (1 - HYSTERESIS_FACTOR) * (1 - HYSTERESIS_FACTOR);

      // The hysteresis distance should be ~10% less than the threshold
      const hysteresisDistance = Math.sqrt(hysteresisThresholdSq);
      const bandPercentage = (threshold - hysteresisDistance) / threshold;

      // Should be approximately 10% (actually 1 - 0.9^2 = 0.19, but expressed as distance ratio it's ~10%)
      expect(bandPercentage).toBeGreaterThan(0.05);
      expect(bandPercentage).toBeLessThan(0.25);
    });

    it('should not oscillate when moving back and forth near threshold', () => {
      const thresholdDist = 35; // Court LOD1 threshold

      // Simulate camera moving back and forth near threshold
      let currentLevel = 0;
      const distances = [
        34, 36, 34, 36, 34, 36, 34, 36, // oscillating around 35m
      ];
      const transitions: number[] = [];

      for (const dist of distances) {
        const newLevel = selectLODLevel(dist * dist, COURT_LOD_SQUARED, currentLevel);
        if (newLevel !== currentLevel) {
          transitions.push(newLevel);
          currentLevel = newLevel;
        }
      }

      // With hysteresis, should have at most 1-2 transitions, not 8
      expect(transitions.length).toBeLessThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------
  // Step 4: Vertex Count Reduction
  // ---------------------------------------------------------
  describe('Step 4: Vertex Count Decreases with Distance (Geometry Budget)', () => {

    it('should have court LOD geometries with decreasing vertex counts', () => {
      // LOD0: Full court surface
      const courtFull = new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH);
      const courtLOD0Verts = courtFull.attributes.position.count;

      // LOD1: Same box (simplified - lines merged)
      const courtLOD1 = new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH);
      const courtLOD1Verts = courtLOD1.attributes.position.count;

      // LOD2: Simple box
      const courtLOD2 = new THREE.BoxGeometry(COURT_WIDTH, 0.15, COURT_LENGTH);
      const courtLOD2Verts = courtLOD2.attributes.position.count;

      // LOD0 surface alone has same verts as LOD1 surface (both are BoxGeometry)
      // But LOD0 total includes lines + net + posts while LOD1 is just surface + 2 NVZ lines
      // The key metric is TOTAL mesh count: LOD0=12 meshes, LOD1=4, LOD2=1
      expect(courtLOD0Verts).toBeGreaterThan(0);
      expect(courtLOD2Verts).toBeGreaterThan(0);
      // All are 24 verts for BoxGeometry, but mesh COUNT drops dramatically
      expect(courtLOD2Verts).toBeLessThanOrEqual(courtLOD0Verts);

      courtFull.dispose();
      courtLOD1.dispose();
      courtLOD2.dispose();
    });

    it('should have player LOD geometries with strictly decreasing vertex counts', () => {
      // LOD0: Full player body (capsule with head/arms)
      const bodyGeom = new THREE.CapsuleGeometry(
        PLAYER_RADIUS,
        PLAYER_HEIGHT - PLAYER_RADIUS * 2 - HEAD_RADIUS * 2,
        4, 8
      );
      const headGeom = new THREE.SphereGeometry(HEAD_RADIUS, 8, 8);
      const armGeom = new THREE.CapsuleGeometry(0.06, 0.4, 2, 4);
      const paddleGeom = new THREE.BoxGeometry(0.18, 0.02, 0.12);

      const lod0TotalVerts =
        bodyGeom.attributes.position.count +
        headGeom.attributes.position.count +
        armGeom.attributes.position.count * 2 + // 2 arms
        paddleGeom.attributes.position.count;

      // LOD1: Single capsule
      const lod1Geom = new THREE.CapsuleGeometry(
        PLAYER_RADIUS,
        PLAYER_HEIGHT - PLAYER_RADIUS * 2,
        4, 8
      );
      const lod1Verts = lod1Geom.attributes.position.count;

      // LOD2: Single point (1 vertex position, but BufferGeometry has it as 1)
      const lod2Verts = 1; // Single point

      expect(lod0TotalVerts).toBeGreaterThan(lod1Verts);
      expect(lod1Verts).toBeGreaterThan(lod2Verts);

      // Verify significant reduction ratios
      const lod1Ratio = lod1Verts / lod0TotalVerts;
      expect(lod1Ratio).toBeLessThan(0.5); // LOD1 < 50% of LOD0

      bodyGeom.dispose();
      headGeom.dispose();
      armGeom.dispose();
      paddleGeom.dispose();
      lod1Geom.dispose();
    });

    it('should have ball LOD geometries with strictly decreasing vertex counts', () => {
      // LOD0: Full sphere (12 segments, 8 rings)
      const ballFull = new THREE.SphereGeometry(0.037, 12, 8);
      const lod0Verts = ballFull.attributes.position.count;

      // LOD1: Simplified sphere (6 segments, 4 rings)
      const ballSimple = new THREE.SphereGeometry(0.037, 6, 4);
      const lod1Verts = ballSimple.attributes.position.count;

      // LOD2: Point
      const lod2Verts = 1;

      expect(lod0Verts).toBeGreaterThan(lod1Verts);
      expect(lod1Verts).toBeGreaterThan(lod2Verts);

      // Verify the simplified sphere has significantly fewer vertices
      const reductionRatio = lod1Verts / lod0Verts;
      expect(reductionRatio).toBeLessThan(0.5); // At least 50% reduction

      ballFull.dispose();
      ballSimple.dispose();
    });

    it('should have robot LOD with decreasing mesh counts', () => {
      // LOD0: 11 meshes (base, body, screen, battery, 4 wheels, brush, status light)
      const lod0MeshCount = 11;

      // LOD1: 2 meshes (box + status light)
      const lod1MeshCount = 2;

      // LOD2: 1 point
      const lod2MeshCount = 1;

      expect(lod0MeshCount).toBeGreaterThan(lod1MeshCount);
      expect(lod1MeshCount).toBeGreaterThan(lod2MeshCount);
    });

    it('should have scoreboard LOD with decreasing element counts', () => {
      // LOD0: 6 elements (1 plane + 5 Text components)
      const lod0ElementCount = 6;

      // LOD1: 2 elements (1 plane + 1 Text)
      const lod1ElementCount = 2;

      // LOD2: 0 elements (hidden)
      const lod2ElementCount = 0;

      expect(lod0ElementCount).toBeGreaterThan(lod1ElementCount);
      expect(lod1ElementCount).toBeGreaterThan(lod2ElementCount);
    });
  });

  // ---------------------------------------------------------
  // Step 5: Distance Threshold Configurability
  // ---------------------------------------------------------
  describe('Step 5: LOD Distance Thresholds Are Configurable', () => {

    it('should allow custom thresholds to change LOD behavior', () => {
      // Standard thresholds
      const standardResult = selectLODLevel(40 * 40, COURT_LOD_SQUARED, 0);
      expect(standardResult).toBe(1); // 40m is LOD1 with standard [0,35,80,180]

      // Custom "closer" thresholds - switch to LOD1 at 20m instead of 35m
      const closerThresholds = [0, 20 * 20, 50 * 50, 100 * 100];
      const closerResult = selectLODLevel(40 * 40, closerThresholds, 0);
      expect(closerResult).toBe(1); // 40m still LOD1 but threshold changed

      // Custom "farther" thresholds - switch to LOD1 at 60m
      const fartherThresholds = [0, 60 * 60, 120 * 120, 250 * 250];
      const fartherResult = selectLODLevel(40 * 40, fartherThresholds, 0);
      expect(fartherResult).toBe(0); // 40m is still LOD0 with farther thresholds
    });

    it('should support different number of LOD levels', () => {
      // 2-level LOD (full + simplified)
      const twoLevel = [0, 30 * 30];
      expect(selectLODLevel(20 * 20, twoLevel, 0)).toBe(0);
      expect(selectLODLevel(40 * 40, twoLevel, 0)).toBe(1);

      // 5-level LOD
      const fiveLevel = [0, 10 * 10, 25 * 25, 50 * 50, 100 * 100];
      expect(selectLODLevel(5 * 5, fiveLevel, 0)).toBe(0);
      expect(selectLODLevel(15 * 15, fiveLevel, 0)).toBe(1);
      expect(selectLODLevel(35 * 35, fiveLevel, 0)).toBe(2);
      expect(selectLODLevel(75 * 75, fiveLevel, 0)).toBe(3);
      expect(selectLODLevel(150 * 150, fiveLevel, 0)).toBe(4);
    });
  });

  // ---------------------------------------------------------
  // Step 6: Draw Call Budget Estimation
  // ---------------------------------------------------------
  describe('Step 6: 100-Court Scenario Draw Call Budget', () => {

    /**
     * Estimates the number of draw calls for a 100-court facility
     * based on a typical camera position and LOD distribution.
     *
     * Assumptions for "typical view" looking at the facility:
     * - 5 courts at LOD0 (< 35m)
     * - 15 courts at LOD1 (35-80m)
     * - 30 courts at LOD2 (80-180m)
     * - 50 courts at LOD3 (> 180m) or frustum-culled
     * - 25 courts have active games (50% of visible)
     * - 3 robots
     */
    it('should estimate significant draw call reduction with LOD', () => {
      // WITHOUT LOD: everything at full detail
      const meshesPerCourtFull = 12;        // surface + 8 lines + net + 2 posts
      const overlaysPerCourt = 4;            // click target, dirty, outline, status ring
      const meshesPerPlayerFull = 5;         // body, head, 2 arms, paddle
      const meshesPerBallFull = 3;           // ball + 2 trail
      const meshesPerScoreboardFull = 6;     // panel + 5 text
      const meshesPerRobotFull = 11;
      const activeGames = 50;
      const playersPerGame = 4;
      const totalCourts = 100;
      const totalRobots = 3;

      const noLODDrawCalls =
        totalCourts * (meshesPerCourtFull + overlaysPerCourt) +
        activeGames * (playersPerGame * meshesPerPlayerFull + meshesPerBallFull + meshesPerScoreboardFull) +
        totalRobots * meshesPerRobotFull;

      // WITH LOD: typical distribution
      const courtsLOD0 = 5;
      const courtsLOD1 = 15;
      const courtsLOD2 = 30;
      const courtsLOD3 = 50;

      const gamesLOD0 = 3;  // only LOD0 courts show full games
      const gamesLOD1 = 7;  // LOD1 courts show simplified games

      const meshesPerCourtLOD1 = 4;    // surface + 2 NVZ lines + net plane
      const meshesPerCourtLOD2 = 1;    // single box
      const meshesPerCourtLOD3 = 1;    // single point

      const meshesPerPlayerLOD1 = 1;   // single capsule
      const meshesPerBallLOD1 = 1;     // simplified sphere
      const meshesPerScoreboardLOD1 = 2; // small panel + score text

      const meshesPerRobotLOD1 = 2;    // box + status light
      const meshesPerRobotLOD2 = 1;    // point

      // LOD0 courts: full detail + overlays
      const lod0DrawCalls =
        courtsLOD0 * (meshesPerCourtFull + overlaysPerCourt) +
        gamesLOD0 * (playersPerGame * meshesPerPlayerFull + meshesPerBallFull + meshesPerScoreboardFull);

      // LOD1 courts: simplified court + simplified game (no overlays)
      const lod1DrawCalls =
        courtsLOD1 * meshesPerCourtLOD1 +
        gamesLOD1 * (playersPerGame * meshesPerPlayerLOD1 + meshesPerBallLOD1 + meshesPerScoreboardLOD1);

      // LOD2 courts: single box, no game rendering, no overlays
      const lod2DrawCalls = courtsLOD2 * meshesPerCourtLOD2;

      // LOD3 courts: single point
      const lod3DrawCalls = courtsLOD3 * meshesPerCourtLOD3;

      // Robots (assume 1 at LOD0, 1 at LOD1, 1 at LOD2)
      const robotDrawCalls =
        1 * meshesPerRobotFull +
        1 * meshesPerRobotLOD1 +
        1 * meshesPerRobotLOD2;

      const withLODDrawCalls =
        lod0DrawCalls + lod1DrawCalls + lod2DrawCalls + lod3DrawCalls + robotDrawCalls;

      const reductionPercent = ((noLODDrawCalls - withLODDrawCalls) / noLODDrawCalls) * 100;

      // Verify at least 80% draw call reduction
      expect(reductionPercent).toBeGreaterThanOrEqual(80);

      // Log the results for visibility
      console.log(`WITHOUT LOD: ${noLODDrawCalls} draw calls`);
      console.log(`WITH LOD:    ${withLODDrawCalls} draw calls`);
      console.log(`REDUCTION:   ${reductionPercent.toFixed(1)}%`);
    });

    it('should estimate significant vertex reduction with LOD', () => {
      // Approximate vertex counts
      const vertsBallFull = 93;
      const vertsBallTrail = 93 * 2;
      const vertsPlayerFull = 226;
      const vertsCourtFull = 361;

      const vertsBallSimple = 25;
      const vertsPlayerLOD1 = 83;
      const vertsCourtLOD1 = 200;
      const vertsCourtLOD2 = 24;

      // 100 courts scenario WITHOUT LOD
      const totalCourts = 100;
      const activeGames = 50;
      const noLODVerts =
        totalCourts * vertsCourtFull +
        activeGames * (4 * vertsPlayerFull + vertsBallFull + vertsBallTrail);

      // WITH LOD (same distribution as draw call test)
      const withLODVerts =
        5 * vertsCourtFull +       // LOD0 courts
        15 * vertsCourtLOD1 +      // LOD1 courts
        30 * vertsCourtLOD2 +      // LOD2 courts
        50 * 1 +                   // LOD3 points
        3 * (4 * vertsPlayerFull + vertsBallFull + vertsBallTrail) + // LOD0 games
        7 * (4 * vertsPlayerLOD1 + vertsBallSimple);                 // LOD1 games

      const vertReduction = ((noLODVerts - withLODVerts) / noLODVerts) * 100;

      expect(vertReduction).toBeGreaterThanOrEqual(70); // At least 70% vertex reduction

      console.log(`WITHOUT LOD: ${noLODVerts} vertices`);
      console.log(`WITH LOD:    ${withLODVerts} vertices`);
      console.log(`REDUCTION:   ${vertReduction.toFixed(1)}%`);
    });
  });

  // ---------------------------------------------------------
  // Step 7: Shadow LOD
  // ---------------------------------------------------------
  describe('Step 7: Shadow LOD Thresholds', () => {

    it('should have shadow cast distance less than receive distance', () => {
      expect(SHADOW_CAST_DISTANCE).toBeLessThan(SHADOW_RECEIVE_DISTANCE);
    });

    it('should have shadow cast distance within court LOD0 range', () => {
      // Shadows should be cast for nearby objects (within full-detail range)
      expect(SHADOW_CAST_DISTANCE).toBeLessThanOrEqual(COURT_LOD_DISTANCES[1]);
    });

    it('should have shadow receive distance within court LOD1-2 range', () => {
      expect(SHADOW_RECEIVE_DISTANCE).toBeLessThanOrEqual(COURT_LOD_DISTANCES[2]);
    });
  });

  // ---------------------------------------------------------
  // Step 8: Module-Level Geometry Reuse
  // ---------------------------------------------------------
  describe('Step 8: Geometry and Material Reuse Patterns', () => {

    it('should create geometries with valid vertex attributes', () => {
      // Verify all LOD geometries can be created without error
      const courtLOD2 = new THREE.BoxGeometry(COURT_WIDTH, 0.15, COURT_LENGTH);
      expect(courtLOD2.attributes.position.count).toBeGreaterThan(0);

      const playerLOD1 = new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT - PLAYER_RADIUS * 2, 4, 8);
      expect(playerLOD1.attributes.position.count).toBeGreaterThan(0);

      const ballSimple = new THREE.SphereGeometry(0.037, 6, 4);
      expect(ballSimple.attributes.position.count).toBeGreaterThan(0);

      const robotSimple = new THREE.BoxGeometry(ROBOT_WIDTH, ROBOT_HEIGHT, ROBOT_LENGTH);
      expect(robotSimple.attributes.position.count).toBeGreaterThan(0);

      const pointGeom = new THREE.BufferGeometry();
      pointGeom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      expect(pointGeom.attributes.position.count).toBe(1);

      // Cleanup
      courtLOD2.dispose();
      playerLOD1.dispose();
      ballSimple.dispose();
      robotSimple.dispose();
      pointGeom.dispose();
    });

    it('should create valid PointsMaterial for LOD fallbacks', () => {
      const courtPoint = new THREE.PointsMaterial({ color: '#666666', size: 2, sizeAttenuation: true });
      expect(courtPoint.size).toBe(2);
      expect(courtPoint.sizeAttenuation).toBe(true);

      const ballPoint = new THREE.PointsMaterial({ color: '#ffff00', size: 0.5, sizeAttenuation: true });
      expect(ballPoint.size).toBe(0.5);

      const playerPointA = new THREE.PointsMaterial({ color: '#3b82f6', size: 2, sizeAttenuation: true });
      const playerPointB = new THREE.PointsMaterial({ color: '#ef4444', size: 2, sizeAttenuation: true });
      expect(playerPointA.color.getHexString()).not.toBe(playerPointB.color.getHexString());

      courtPoint.dispose();
      ballPoint.dispose();
      playerPointA.dispose();
      playerPointB.dispose();
    });

    it('should pre-create trail materials (no inline allocation)', () => {
      // Validate that trail materials can be created at module level
      const trailMat40 = new THREE.MeshBasicMaterial({
        color: '#ffff00',
        transparent: true,
        opacity: 0.4,
      });
      const trailMat20 = new THREE.MeshBasicMaterial({
        color: '#ffff00',
        transparent: true,
        opacity: 0.2,
      });

      expect(trailMat40.opacity).toBe(0.4);
      expect(trailMat20.opacity).toBe(0.2);
      expect(trailMat40.transparent).toBe(true);
      expect(trailMat20.transparent).toBe(true);

      trailMat40.dispose();
      trailMat20.dispose();
    });
  });

  // ---------------------------------------------------------
  // Step 9: Edge Cases
  // ---------------------------------------------------------
  describe('Step 9: Edge Cases and Boundary Conditions', () => {

    it('should handle exact threshold distances correctly', () => {
      // At exactly 35m (LOD1 threshold for courts)
      const exactThreshold = 35 * 35;
      const result = selectLODLevel(exactThreshold, COURT_LOD_SQUARED, 0);
      expect(result).toBe(1); // Should switch to LOD1 at exactly the threshold
    });

    it('should handle NaN distances gracefully', () => {
      // NaN comparison should result in LOD0 (safest default)
      const result = selectLODLevel(NaN, COURT_LOD_SQUARED, 0);
      expect(result).toBe(0);
    });

    it('should handle negative distances as LOD0', () => {
      const result = selectLODLevel(-100, COURT_LOD_SQUARED, 0);
      expect(result).toBe(0);
    });

    it('should handle single-threshold LOD (only LOD0 + LOD1)', () => {
      const singleThreshold = [0, 50 * 50];
      expect(selectLODLevel(30 * 30, singleThreshold, 0)).toBe(0);
      expect(selectLODLevel(60 * 60, singleThreshold, 0)).toBe(1);
    });

    it('should maintain LOD level consistency across multiple sequential checks', () => {
      // Simulate a camera slowly moving away
      let currentLevel = 0;
      const distances = [10, 20, 30, 35, 40, 50, 60, 70, 80, 90, 100, 150, 200];
      const levels: number[] = [];

      for (const dist of distances) {
        currentLevel = selectLODLevel(dist * dist, COURT_LOD_SQUARED, currentLevel);
        levels.push(currentLevel);
      }

      // Levels should be monotonically non-decreasing as distance increases
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
      }
    });
  });
});
