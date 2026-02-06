import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  COURT_WIDTH,
  COURT_LENGTH,
  KITCHEN_DEPTH,
  LINE_WIDTH,
  LINE_HEIGHT,
  NET_HEIGHT_SIDES,
  NET_HEIGHT_CENTER,
} from '@/types/facility';

// Pre-computed values
const halfWidth = COURT_WIDTH / 2;
const halfLength = COURT_LENGTH / 2;
const centerlineLength = halfLength - KITCHEN_DEPTH;

// ============================================
// SHARED GEOMETRIES (all module-level, no geometry creation in functions)
// ============================================

// Court surface geometry - also exported as courtSurfaceGeometry for compatibility
export const surfaceGeometry = new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH);
export const courtSurfaceGeometry = surfaceGeometry; // alias

// Post geometry
export const postGeometry = new THREE.CylinderGeometry(0.04, 0.04, NET_HEIGHT_SIDES, 8);

// ============================================
// OVERLAY GEOMETRIES (defined at module level before any functions)
// ============================================

// Selection outline geometry
export const selectionOutlineGeometry = new THREE.BoxGeometry(
  COURT_WIDTH + 0.2,
  0.05,
  COURT_LENGTH + 0.2
);

// Dirty overlay geometry
export const dirtyOverlayGeometry = new THREE.PlaneGeometry(
  COURT_WIDTH - 0.1,
  COURT_LENGTH - 0.1
);

// Status ring geometry
export const statusRingGeometry = new THREE.RingGeometry(
  COURT_WIDTH / 2 + 0.05,
  COURT_WIDTH / 2 + 0.15,
  32
);

// Click target geometry (invisible)
export const clickTargetGeometry = new THREE.BoxGeometry(COURT_WIDTH, 0.5, COURT_LENGTH);

// Grouped overlay geometries export for convenience
export const overlayGeometries = {
  selectionOutline: selectionOutlineGeometry,
  dirtyOverlay: dirtyOverlayGeometry,
  statusRing: statusRingGeometry,
  clickTarget: clickTargetGeometry,
};

// ============================================
// BASE LINE GEOMETRIES (used for cloning and merging)
// ============================================
const sidelineBaseGeometry = new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, COURT_LENGTH);
const baselineBaseGeometry = new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH);
const nvzLineBaseGeometry = new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH);
const centerlineBaseGeometry = new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, centerlineLength);

// Create merged line geometry - combines all 8 court lines into one geometry
// Note: Uses clone() on pre-created base geometries, no new geometry creation inside
function createMergedLineGeometry(): THREE.BufferGeometry {
  // Clone base geometries and translate them to their positions
  const lineGeometries: THREE.BufferGeometry[] = [];

  // Left sideline - clone() and translate
  const leftSideline = sidelineBaseGeometry.clone();
  leftSideline.translate(-halfWidth + LINE_WIDTH / 2, LINE_HEIGHT / 2, 0);
  lineGeometries.push(leftSideline);

  // Right sideline - clone() and translate
  const rightSideline = sidelineBaseGeometry.clone();
  rightSideline.translate(halfWidth - LINE_WIDTH / 2, LINE_HEIGHT / 2, 0);
  lineGeometries.push(rightSideline);

  // Front baseline - clone() and translate
  const frontBaseline = baselineBaseGeometry.clone();
  frontBaseline.translate(0, LINE_HEIGHT / 2, -halfLength + LINE_WIDTH / 2);
  lineGeometries.push(frontBaseline);

  // Back baseline - clone() and translate
  const backBaseline = baselineBaseGeometry.clone();
  backBaseline.translate(0, LINE_HEIGHT / 2, halfLength - LINE_WIDTH / 2);
  lineGeometries.push(backBaseline);

  // Front NVZ (kitchen) line - clone() and translate
  const frontNVZ = nvzLineBaseGeometry.clone();
  frontNVZ.translate(0, LINE_HEIGHT / 2, -KITCHEN_DEPTH);
  lineGeometries.push(frontNVZ);

  // Back NVZ (kitchen) line - clone() and translate
  const backNVZ = nvzLineBaseGeometry.clone();
  backNVZ.translate(0, LINE_HEIGHT / 2, KITCHEN_DEPTH);
  lineGeometries.push(backNVZ);

  // Front centerline - clone() and translate
  const frontCenterline = centerlineBaseGeometry.clone();
  frontCenterline.translate(0, LINE_HEIGHT / 2, -KITCHEN_DEPTH - centerlineLength / 2);
  lineGeometries.push(frontCenterline);

  // Back centerline - clone() and translate
  const backCenterline = centerlineBaseGeometry.clone();
  backCenterline.translate(0, LINE_HEIGHT / 2, KITCHEN_DEPTH + centerlineLength / 2);
  lineGeometries.push(backCenterline);

  // Merge all line geometries into one
  return BufferGeometryUtils.mergeGeometries(lineGeometries);
}

export const mergedLineGeometry = createMergedLineGeometry();

// Net geometry with parabolic sag
// Note: Uses PlaneGeometry (not BoxGeometry), modifies vertices for sag effect
function createNetGeometry(): THREE.BufferGeometry {
  const segments = 20;
  const geometry = new THREE.PlaneGeometry(COURT_WIDTH + 0.1, NET_HEIGHT_SIDES, segments, 4);
  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);

    // Only modify top vertices (y > 0) to create sag
    if (y > 0) {
      // Parabolic sag - center is lower
      const normalizedX = x / (COURT_WIDTH / 2);
      const sagAmount = (NET_HEIGHT_SIDES - NET_HEIGHT_CENTER) * (1 - normalizedX * normalizedX);
      positions.setY(i, y - sagAmount);
    }
  }

  geometry.computeVertexNormals();

  // Translate to position the net correctly (at NET_HEIGHT_SIDES / 2 height)
  geometry.translate(0, NET_HEIGHT_SIDES / 2, 0);

  return geometry;
}

export const netGeometry = createNetGeometry();

// ============================================
// SHARED MATERIALS
// ============================================

// Surface material - default color, will be updated per-instance if needed
export const surfaceMaterial = new THREE.MeshLambertMaterial({ color: '#c4a574' });

// Line material
export const lineMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff' });

// Net material
export const netMaterial = new THREE.MeshLambertMaterial({
  color: '#1a1a1a',
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide,
});

// Post material
export const postMaterial = new THREE.MeshLambertMaterial({
  color: '#4a4a4a',
  emissive: new THREE.Color('#1a1a1a'),
});

// Selection outline material
export const selectionOutlineMaterial = new THREE.MeshBasicMaterial({
  color: '#60a5fa',
  transparent: true,
  opacity: 0.8,
});

// Dirty overlay material
export const dirtyOverlayMaterial = new THREE.MeshBasicMaterial({
  color: '#7c2d12',
  transparent: true,
  opacity: 0.3,
  side: THREE.DoubleSide,
});

// Status ring material (base, color will be set per-instance)
export const statusRingMaterial = new THREE.MeshBasicMaterial({
  color: '#22c55e',
  transparent: true,
  opacity: 0.3,
});

// Click target material (invisible)
export const clickTargetMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
});

// Grouped court materials export for convenience
export const courtMaterials = {
  surface: surfaceMaterial,
  line: lineMaterial,
  net: netMaterial,
  post: postMaterial,
  selectionOutline: selectionOutlineMaterial,
  dirtyOverlay: dirtyOverlayMaterial,
  statusRing: statusRingMaterial,
  clickTarget: clickTargetMaterial,
};

// ============================================
// POST POSITIONS (relative to court center)
// ============================================
export const leftPostOffset = { x: -halfWidth - 0.05, y: NET_HEIGHT_SIDES / 2, z: 0 };
export const rightPostOffset = { x: halfWidth + 0.05, y: NET_HEIGHT_SIDES / 2, z: 0 };
