/**
 * useLODLevel Hook - Task 18
 *
 * Distance-based Level of Detail selection with hysteresis anti-popping.
 * Uses squared distance comparison for efficiency (no sqrt per frame).
 * Checks LOD level every N frames to reduce computation.
 *
 * Expected performance: < 0.05ms for 100 objects
 * Expected draw call reduction: 70-80%
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  COURT_LOD_SQUARED,
  PLAYER_LOD_SQUARED,
  BALL_LOD_SQUARED,
  ROBOT_LOD_SQUARED,
  SCOREBOARD_LOD_SQUARED,
  GAME_LOD_SQUARED,
  SHADOW_CAST_DISTANCE_SQ,
  SHADOW_RECEIVE_DISTANCE_SQ,
  LOD_CHECK_INTERVAL,
  selectLODLevel,
  type CourtLODLevel,
  type EntityLODLevel
} from '@/lib/lodConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LODObjectType = 'COURT' | 'PLAYER' | 'BALL' | 'ROBOT' | 'SCOREBOARD' | 'GAME';

export interface LODResult {
  level: number;
  castShadow: boolean;
  receiveShadow: boolean;
}

// ---------------------------------------------------------------------------
// Threshold Lookup
// ---------------------------------------------------------------------------

const THRESHOLD_MAP: Record<LODObjectType, readonly number[]> = {
  COURT: COURT_LOD_SQUARED,
  PLAYER: PLAYER_LOD_SQUARED,
  BALL: BALL_LOD_SQUARED,
  ROBOT: ROBOT_LOD_SQUARED,
  SCOREBOARD: SCOREBOARD_LOD_SQUARED,
  GAME: GAME_LOD_SQUARED
};

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

/**
 * Hook that computes LOD level based on distance from camera.
 * Uses squared distance comparison and frame-skipping for efficiency.
 *
 * @param objectType - Type of object (COURT, PLAYER, BALL, etc.)
 * @param position - World position of the object (Vector3 or {x, y, z})
 * @returns Object with level, castShadow, and receiveShadow
 */
export function useLODLevel(
  objectType: LODObjectType,
  position: THREE.Vector3 | { x: number; y?: number; z: number }
): LODResult {
  const { camera } = useThree();
  const levelRef = useRef<number>(0);
  const frameCount = useRef(0);
  const resultRef = useRef<LODResult>({
    level: 0,
    castShadow: true,
    receiveShadow: true
  });

  const thresholds = THRESHOLD_MAP[objectType];

  useFrame(() => {
    // Only check every N frames
    if (++frameCount.current % LOD_CHECK_INTERVAL !== 0) {
      return;
    }

    // Get position as Vector3 or plain object
    const px = position instanceof THREE.Vector3 ? position.x : position.x;
    const py = position instanceof THREE.Vector3 ? position.y : (position.y ?? 0);
    const pz = position instanceof THREE.Vector3 ? position.z : position.z;

    // Compute squared distance (avoids sqrt)
    const dx = camera.position.x - px;
    const dy = camera.position.y - py;
    const dz = camera.position.z - pz;
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    // Select LOD level with hysteresis
    const newLevel = selectLODLevel(distanceSquared, thresholds, levelRef.current);
    levelRef.current = newLevel;

    // Determine shadow settings based on distance
    const castShadow = distanceSquared < SHADOW_CAST_DISTANCE_SQ;
    const receiveShadow = distanceSquared < SHADOW_RECEIVE_DISTANCE_SQ;

    // Update result ref
    resultRef.current = {
      level: newLevel,
      castShadow,
      receiveShadow
    };
  });

  return resultRef.current;
}

/**
 * Non-hook version for use outside React components.
 * Computes LOD level from camera and position directly.
 *
 * @param camera - Three.js camera
 * @param objectType - Type of object
 * @param position - World position
 * @param currentLevel - Current LOD level (for hysteresis)
 * @returns LOD result
 */
export function computeLODLevel(
  camera: THREE.Camera,
  objectType: LODObjectType,
  position: { x: number; y?: number; z: number },
  currentLevel: number = 0
): LODResult {
  const thresholds = THRESHOLD_MAP[objectType];

  const px = position.x;
  const py = position.y ?? 0;
  const pz = position.z;

  const dx = camera.position.x - px;
  const dy = camera.position.y - py;
  const dz = camera.position.z - pz;
  const distanceSquared = dx * dx + dy * dy + dz * dz;

  const level = selectLODLevel(distanceSquared, thresholds, currentLevel);
  const castShadow = distanceSquared < SHADOW_CAST_DISTANCE_SQ;
  const receiveShadow = distanceSquared < SHADOW_RECEIVE_DISTANCE_SQ;

  return { level, castShadow, receiveShadow };
}

/**
 * Batch compute LOD levels for multiple objects.
 * More efficient than calling useLODLevel for each object.
 *
 * @param camera - Three.js camera
 * @param objects - Array of objects with type, position, and current level
 * @returns Map of object IDs to LOD results
 */
export function batchComputeLODLevels(
  camera: THREE.Camera,
  objects: Array<{
    id: string;
    type: LODObjectType;
    position: { x: number; y?: number; z: number };
    currentLevel?: number;
  }>
): Map<string, LODResult> {
  const results = new Map<string, LODResult>();
  const camX = camera.position.x;
  const camY = camera.position.y;
  const camZ = camera.position.z;

  for (const obj of objects) {
    const thresholds = THRESHOLD_MAP[obj.type];
    const px = obj.position.x;
    const py = obj.position.y ?? 0;
    const pz = obj.position.z;

    const dx = camX - px;
    const dy = camY - py;
    const dz = camZ - pz;
    const distanceSquared = dx * dx + dy * dy + dz * dz;

    const level = selectLODLevel(distanceSquared, thresholds, obj.currentLevel ?? 0);
    const castShadow = distanceSquared < SHADOW_CAST_DISTANCE_SQ;
    const receiveShadow = distanceSquared < SHADOW_RECEIVE_DISTANCE_SQ;

    results.set(obj.id, { level, castShadow, receiveShadow });
  }

  return results;
}

export default useLODLevel;
