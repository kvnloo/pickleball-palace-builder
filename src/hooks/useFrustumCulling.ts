/**
 * useFrustumCulling Hook - Task 16
 *
 * Camera-based visibility culling for court rendering optimization.
 * Uses Frustum.intersectsBox() with pre-computed court bounding boxes
 * for O(n) visibility checks where n = number of courts.
 *
 * Expected performance: < 0.1ms for 200 courts
 * Expected render reduction: 50-80% when zoomed in
 */

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

// Frustum margin to prevent pop-in at edges (meters)
const FRUSTUM_MARGIN = 2.0;

// Maximum height of objects on court (players, net)
const COURT_HEIGHT = 5.0;

// Reusable objects to avoid allocation per frame
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

export interface CourtPosition {
  x: number;
  z: number;
  id: string;
  row?: number;
  col?: number;
}

/**
 * Create a bounding box for a court at given position.
 * Includes margin to prevent pop-in at frustum edges.
 */
export function createCourtBoundingBox(
  courtX: number,
  courtZ: number,
  margin: number = FRUSTUM_MARGIN
): THREE.Box3 {
  const halfW = COURT_WIDTH / 2 + margin;
  const halfL = COURT_LENGTH / 2 + margin;
  return new THREE.Box3(
    new THREE.Vector3(courtX - halfW, -0.1, courtZ - halfL),
    new THREE.Vector3(courtX + halfW, COURT_HEIGHT, courtZ + halfL)
  );
}

/**
 * Hook that returns a ref to the set of visible court IDs.
 * Updates every frame based on camera frustum.
 *
 * @param courtPositions - Array of court positions with IDs
 * @returns Ref to Set<string> of visible court IDs
 */
export function useFrustumCulling(
  courtPositions: CourtPosition[]
): React.MutableRefObject<Set<string>> {
  const { camera } = useThree();
  const visibleRef = useRef<Set<string>>(new Set());

  // Pre-compute bounding boxes once when court positions change
  const boxes = useMemo(() => {
    return courtPositions.map(({ x, z, id }) => ({
      id,
      box: createCourtBoundingBox(x, z)
    }));
  }, [courtPositions]);

  // Initialize with all courts visible
  useMemo(() => {
    visibleRef.current = new Set(courtPositions.map(c => c.id));
  }, [courtPositions]);

  // Update visibility every frame
  useFrame(() => {
    // Build view-projection matrix
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Clear and rebuild visible set
    visibleRef.current.clear();
    for (const { id, box } of boxes) {
      if (frustum.intersectsBox(box)) {
        visibleRef.current.add(id);
      }
    }
  });

  return visibleRef;
}

/**
 * Compute visible grid range for optimized culling of regular grid layouts.
 * Uses frustum corner projection to determine min/max row/col.
 *
 * @param camera - The Three.js camera
 * @param gridRows - Total number of rows
 * @param gridCols - Total number of columns
 * @param spacing - Spacing between courts
 * @param margin - Additional margin in grid cells
 * @returns Object with minRow, maxRow, minCol, maxCol
 */
export function computeVisibleGridRange(
  camera: THREE.Camera,
  gridRows: number,
  gridCols: number,
  spacing: number = 1,
  margin: number = 1
): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
  // Compute inverse view-projection matrix
  const invVP = new THREE.Matrix4();
  invVP.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
  invVP.invert();

  // 8 NDC corners of the view frustum
  const ndcCorners: [number, number, number][] = [
    [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1],
  ];

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  const corner = new THREE.Vector4();

  for (const [nx, ny, nz] of ndcCorners) {
    corner.set(nx, ny, nz, 1).applyMatrix4(invVP);
    const w = corner.w || 1;
    const wx = corner.x / w;
    const wz = corner.z / w;
    minX = Math.min(minX, wx);
    maxX = Math.max(maxX, wx);
    minZ = Math.min(minZ, wz);
    maxZ = Math.max(maxZ, wz);
  }

  // Convert world coordinates to grid indices
  const cwS = COURT_WIDTH + spacing;
  const clS = COURT_LENGTH + spacing;

  return {
    minCol: Math.max(0, Math.floor((minX - COURT_WIDTH / 2) / cwS) - margin),
    maxCol: Math.min(gridCols - 1, Math.ceil((maxX - COURT_WIDTH / 2) / cwS) + margin),
    minRow: Math.max(0, Math.floor((minZ - COURT_LENGTH / 2) / clS) - margin),
    maxRow: Math.min(gridRows - 1, Math.ceil((maxZ - COURT_LENGTH / 2) / clS) + margin),
  };
}

/**
 * Hook that returns visible grid range for regular grid layouts.
 * More efficient than per-court Box3 checks for large regular grids.
 *
 * @param gridRows - Total number of rows
 * @param gridCols - Total number of columns
 * @param spacing - Spacing between courts
 * @returns Ref to object with minRow, maxRow, minCol, maxCol
 */
export function useVisibleGridRange(
  gridRows: number,
  gridCols: number,
  spacing: number = 1
): React.MutableRefObject<{ minRow: number; maxRow: number; minCol: number; maxCol: number }> {
  const { camera } = useThree();
  const rangeRef = useRef({
    minRow: 0,
    maxRow: gridRows - 1,
    minCol: 0,
    maxCol: gridCols - 1
  });

  useFrame(() => {
    const range = computeVisibleGridRange(camera, gridRows, gridCols, spacing);
    rangeRef.current = range;
  });

  return rangeRef;
}

export default useFrustumCulling;
