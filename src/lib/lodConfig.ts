/**
 * LOD Configuration Module - Task 19
 *
 * Centralized Level of Detail configuration for the pickleball facility.
 * Contains distance thresholds, hysteresis settings, and shadow distances.
 *
 * All thresholds are in meters. Pre-squared versions are provided for
 * efficient distance comparisons without sqrt().
 */

// Hysteresis factor: 10% band to prevent oscillation at boundaries
export const HYSTERESIS_FACTOR = 0.1;

// Number of frames between LOD checks (reduces computation)
export const LOD_CHECK_INTERVAL = 3;

// ---------------------------------------------------------------------------
// Distance Thresholds (meters) - ordered from closest to farthest
// Index 0 is always 0 (highest detail threshold)
// ---------------------------------------------------------------------------

/** Court LOD thresholds: LOD0 < 35m, LOD1 35-80m, LOD2 80-180m, LOD3 > 180m */
export const COURT_LOD_DISTANCES = [0, 35, 80, 180] as const;

/** Player LOD thresholds: LOD0 < 30m, LOD1 30-60m, LOD2 > 60m (hidden) */
export const PLAYER_LOD_DISTANCES = [0, 30, 60] as const;

/** Ball LOD thresholds: LOD0 < 15m, LOD1 15-35m, LOD2 > 35m (point) */
export const BALL_LOD_DISTANCES = [0, 15, 35] as const;

/** Robot LOD thresholds: LOD0 < 25m, LOD1 25-60m, LOD2 > 60m */
export const ROBOT_LOD_DISTANCES = [0, 25, 60] as const;

/** Scoreboard LOD thresholds: LOD0 < 30m, LOD1 30-60m, LOD2 > 60m (hidden) */
export const SCOREBOARD_LOD_DISTANCES = [0, 30, 60] as const;

/** Game session LOD thresholds (aggregates players, ball, scoreboard) */
export const GAME_LOD_DISTANCES = [0, 35, 80] as const;

// ---------------------------------------------------------------------------
// Pre-squared Thresholds (for efficient distance comparison without sqrt)
// ---------------------------------------------------------------------------

export const COURT_LOD_SQUARED = COURT_LOD_DISTANCES.map(d => d * d) as readonly number[];
export const PLAYER_LOD_SQUARED = PLAYER_LOD_DISTANCES.map(d => d * d) as readonly number[];
export const BALL_LOD_SQUARED = BALL_LOD_DISTANCES.map(d => d * d) as readonly number[];
export const ROBOT_LOD_SQUARED = ROBOT_LOD_DISTANCES.map(d => d * d) as readonly number[];
export const SCOREBOARD_LOD_SQUARED = SCOREBOARD_LOD_DISTANCES.map(d => d * d) as readonly number[];
export const GAME_LOD_SQUARED = GAME_LOD_DISTANCES.map(d => d * d) as readonly number[];

// ---------------------------------------------------------------------------
// Shadow Thresholds
// ---------------------------------------------------------------------------

/** Maximum distance for objects to cast shadows (saves shadow map resolution) */
export const SHADOW_CAST_DISTANCE = 30;

/** Maximum distance for objects to receive shadows */
export const SHADOW_RECEIVE_DISTANCE = 80;

export const SHADOW_CAST_DISTANCE_SQ = SHADOW_CAST_DISTANCE * SHADOW_CAST_DISTANCE;
export const SHADOW_RECEIVE_DISTANCE_SQ = SHADOW_RECEIVE_DISTANCE * SHADOW_RECEIVE_DISTANCE;

// ---------------------------------------------------------------------------
// LOD Level Types
// ---------------------------------------------------------------------------

export type CourtLODLevel = 0 | 1 | 2 | 3;
export type EntityLODLevel = 0 | 1 | 2;

// ---------------------------------------------------------------------------
// LOD Level Selection
// ---------------------------------------------------------------------------

/**
 * Select the appropriate LOD level based on squared distance.
 * Uses hysteresis to prevent oscillation at threshold boundaries.
 *
 * @param distanceSquared - Squared distance from camera to object
 * @param squaredThresholds - Array of squared distance thresholds
 * @param currentLevel - Current LOD level (for hysteresis calculation)
 * @returns New LOD level
 */
export function selectLODLevel(
  distanceSquared: number,
  squaredThresholds: readonly number[],
  currentLevel: number
): number {
  // Handle edge cases
  if (isNaN(distanceSquared) || distanceSquared < 0) {
    return 0;
  }

  let newLevel = 0;

  // Check from highest (farthest) to lowest (closest) threshold
  for (let i = squaredThresholds.length - 1; i >= 1; i--) {
    const threshold = squaredThresholds[i];

    if (i > currentLevel) {
      // Moving to lower quality: must exceed threshold
      if (distanceSquared >= threshold) {
        newLevel = i;
        break;
      }
    } else {
      // Moving to higher quality: must be below threshold * (1 - hysteresis)^2
      const hysteresisThreshold = threshold * (1 - HYSTERESIS_FACTOR) * (1 - HYSTERESIS_FACTOR);
      if (distanceSquared >= hysteresisThreshold) {
        newLevel = i;
        break;
      }
    }
  }

  return newLevel;
}

/**
 * Compute the LOD distance threshold from object size and target screen fraction.
 * Useful for calibrating LOD thresholds based on perceptual criteria.
 *
 * @param objectSize - Size of the object in meters
 * @param targetScreenFraction - Target fraction of screen height (0-1)
 * @param fovDegrees - Camera field of view in degrees
 * @returns Distance threshold in meters
 */
export function computeLODThreshold(
  objectSize: number,
  targetScreenFraction: number,
  fovDegrees: number = 50
): number {
  const halfFovRad = (fovDegrees / 2) * Math.PI / 180;
  return objectSize / (2 * Math.tan(halfFovRad) * targetScreenFraction);
}

// ---------------------------------------------------------------------------
// Geometry Vertex Budgets (informational)
// ---------------------------------------------------------------------------

export const VERTEX_BUDGETS = {
  court: {
    LOD0: 361,  // Full detail with all lines
    LOD1: 200,  // Surface + NVZ lines only
    LOD2: 24,   // Single box
    LOD3: 1     // Single point
  },
  player: {
    LOD0: 226,  // Body + head + arms + paddle
    LOD1: 83,   // Single capsule
    LOD2: 1     // Single point
  },
  ball: {
    LOD0: 93,   // Full sphere (12 segments)
    LOD1: 25,   // Simple sphere (6 segments)
    LOD2: 1     // Single point
  },
  robot: {
    LOD0: 500,  // Full detail (11 meshes)
    LOD1: 50,   // Box + status light
    LOD2: 1     // Single point
  }
} as const;

// ---------------------------------------------------------------------------
// Mesh Count Budgets (informational)
// ---------------------------------------------------------------------------

export const MESH_COUNTS = {
  court: {
    LOD0: 12,   // surface + 8 lines + net + 2 posts
    LOD1: 4,    // surface + 2 NVZ lines + net plane
    LOD2: 1,    // single box
    LOD3: 1     // single point
  },
  player: {
    LOD0: 5,    // body, head, 2 arms, paddle
    LOD1: 1,    // single capsule
    LOD2: 0     // hidden or point
  },
  robot: {
    LOD0: 11,   // all parts
    LOD1: 2,    // box + status
    LOD2: 1     // point
  },
  scoreboard: {
    LOD0: 6,    // panel + 5 text elements
    LOD1: 2,    // panel + score only
    LOD2: 0     // hidden
  }
} as const;
