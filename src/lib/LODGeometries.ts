/**
 * LOD Geometry Factory - Task 19
 *
 * Module-level pre-created geometries for each LOD level.
 * All geometries are created once at module load time to avoid
 * runtime allocation during rendering.
 *
 * This module exports geometry objects that can be directly used
 * in Three.js mesh components.
 */

import * as THREE from 'three';
import { COURT_WIDTH, COURT_LENGTH, KITCHEN_DEPTH, LINE_WIDTH, LINE_HEIGHT } from '@/types/facility';

// ---------------------------------------------------------------------------
// Player Dimensions
// ---------------------------------------------------------------------------

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.22;
const HEAD_RADIUS = 0.14;

// ---------------------------------------------------------------------------
// Ball Dimensions
// ---------------------------------------------------------------------------

const BALL_RADIUS = 0.037; // 74mm diameter pickleball

// ---------------------------------------------------------------------------
// Robot Dimensions
// ---------------------------------------------------------------------------

const ROBOT_WIDTH = 0.552;
const ROBOT_HEIGHT = 0.695;
const ROBOT_LENGTH = 0.629;

// ---------------------------------------------------------------------------
// Court LOD Geometries
// ---------------------------------------------------------------------------

/**
 * Create LOD0 court geometry - full detail with all elements.
 * Returns an array of geometries for: surface, lines, net, posts
 */
function createCourtLOD0Surface(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH);
}

function createCourtLOD1Surface(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH);
}

function createCourtLOD2Box(): THREE.BufferGeometry {
  // Single box representation for distant courts
  return new THREE.BoxGeometry(COURT_WIDTH, 0.15, COURT_LENGTH);
}

function createCourtLOD3Point(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.1, 0], 3));
  return geometry;
}

// Line geometries for LOD0/LOD1 courts
function createCenterLine(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, COURT_LENGTH);
}

function createSideLine(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, COURT_LENGTH);
}

function createBaseLine(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH);
}

function createNVZLine(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH);
}

// ---------------------------------------------------------------------------
// Player LOD Geometries
// ---------------------------------------------------------------------------

/**
 * LOD0 Player geometries - full body with all parts
 */
export const PLAYER_GEOMETRIES_LOD0 = {
  body: new THREE.CapsuleGeometry(
    PLAYER_RADIUS,
    PLAYER_HEIGHT - PLAYER_RADIUS * 2 - HEAD_RADIUS * 2,
    4, 8
  ),
  head: new THREE.SphereGeometry(HEAD_RADIUS, 8, 8),
  arm: new THREE.CapsuleGeometry(0.06, 0.4, 2, 4),
  paddle: new THREE.BoxGeometry(0.18, 0.02, 0.12)
} as const;

/**
 * LOD1 Player geometry - single simplified capsule
 */
export const PLAYER_GEOMETRY_LOD1 = new THREE.CapsuleGeometry(
  PLAYER_RADIUS,
  PLAYER_HEIGHT - PLAYER_RADIUS * 2,
  4, 8
);

/**
 * LOD2 Player geometry - single point
 */
export const PLAYER_GEOMETRY_LOD2 = (() => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, PLAYER_HEIGHT / 2, 0], 3));
  return geometry;
})();

// ---------------------------------------------------------------------------
// Ball LOD Geometries
// ---------------------------------------------------------------------------

/**
 * LOD0 Ball geometry - full sphere with high detail
 */
export const BALL_GEOMETRY_LOD0 = new THREE.SphereGeometry(BALL_RADIUS, 12, 8);

/**
 * LOD1 Ball geometry - simplified sphere
 */
export const BALL_GEOMETRY_LOD1 = new THREE.SphereGeometry(BALL_RADIUS, 6, 4);

/**
 * LOD2 Ball geometry - single point
 */
export const BALL_GEOMETRY_LOD2 = (() => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  return geometry;
})();

// Trail geometries (for ball trails)
export const TRAIL_GEOMETRY = new THREE.SphereGeometry(BALL_RADIUS * 0.8, 6, 4);

// ---------------------------------------------------------------------------
// Robot LOD Geometries
// ---------------------------------------------------------------------------

/**
 * LOD0 Robot geometries - full detail with all parts
 */
export const ROBOT_GEOMETRIES_LOD0 = {
  base: new THREE.BoxGeometry(ROBOT_WIDTH, ROBOT_HEIGHT * 0.3, ROBOT_LENGTH),
  body: new THREE.BoxGeometry(ROBOT_WIDTH * 0.9, ROBOT_HEIGHT * 0.5, ROBOT_LENGTH * 0.9),
  screen: new THREE.PlaneGeometry(ROBOT_WIDTH * 0.6, ROBOT_HEIGHT * 0.2),
  wheel: new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8),
  statusLight: new THREE.SphereGeometry(0.03, 6, 6)
} as const;

/**
 * LOD1 Robot geometry - simplified box
 */
export const ROBOT_GEOMETRY_LOD1 = new THREE.BoxGeometry(ROBOT_WIDTH, ROBOT_HEIGHT, ROBOT_LENGTH);

/**
 * LOD2 Robot geometry - single point
 */
export const ROBOT_GEOMETRY_LOD2 = (() => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, ROBOT_HEIGHT / 2, 0], 3));
  return geometry;
})();

// ---------------------------------------------------------------------------
// Court Geometry Registry
// ---------------------------------------------------------------------------

export const COURT_GEOMETRIES = {
  LOD0: {
    surface: createCourtLOD0Surface(),
    centerLine: createCenterLine(),
    sideLine: createSideLine(),
    baseLine: createBaseLine(),
    nvzLine: createNVZLine()
  },
  LOD1: {
    surface: createCourtLOD1Surface(),
    nvzLine: createNVZLine()
  },
  LOD2: {
    box: createCourtLOD2Box()
  },
  LOD3: {
    point: createCourtLOD3Point()
  }
} as const;

// ---------------------------------------------------------------------------
// Pre-created Materials
// ---------------------------------------------------------------------------

// Court materials
export const COURT_MATERIALS = {
  surface: {
    hardwood: new THREE.MeshLambertMaterial({ color: '#c4a574' }),
    rubber: new THREE.MeshLambertMaterial({ color: '#3d3d3d' }),
    polypropylene: new THREE.MeshLambertMaterial({ color: '#2563eb' }),
    vinyl: new THREE.MeshLambertMaterial({ color: '#94a3b8' })
  },
  line: new THREE.MeshLambertMaterial({ color: '#ffffff' }),
  net: new THREE.MeshLambertMaterial({ color: '#333333', transparent: true, opacity: 0.8 })
} as const;

// Player materials
export const PLAYER_MATERIALS = {
  teamA: new THREE.MeshLambertMaterial({ color: '#3b82f6' }),
  teamB: new THREE.MeshLambertMaterial({ color: '#ef4444' }),
  skin: new THREE.MeshLambertMaterial({ color: '#e0b090' }),
  paddle: new THREE.MeshLambertMaterial({ color: '#1a1a1a' })
} as const;

// Ball materials
export const BALL_MATERIALS = {
  ball: new THREE.MeshLambertMaterial({ color: '#ffff00' }),
  trail40: new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.4 }),
  trail20: new THREE.MeshBasicMaterial({ color: '#ffff00', transparent: true, opacity: 0.2 })
} as const;

// Robot materials
export const ROBOT_MATERIALS = {
  body: new THREE.MeshLambertMaterial({ color: '#e0e0e0' }),
  accent: new THREE.MeshLambertMaterial({ color: '#2563eb' }),
  screen: new THREE.MeshBasicMaterial({ color: '#000000' })
} as const;

// Point materials for LOD fallbacks
export const POINT_MATERIALS = {
  court: new THREE.PointsMaterial({ color: '#666666', size: 2, sizeAttenuation: true }),
  player: {
    teamA: new THREE.PointsMaterial({ color: '#3b82f6', size: 2, sizeAttenuation: true }),
    teamB: new THREE.PointsMaterial({ color: '#ef4444', size: 2, sizeAttenuation: true })
  },
  ball: new THREE.PointsMaterial({ color: '#ffff00', size: 0.5, sizeAttenuation: true }),
  robot: new THREE.PointsMaterial({ color: '#2563eb', size: 2, sizeAttenuation: true })
} as const;

// ---------------------------------------------------------------------------
// Geometry Getter Functions
// ---------------------------------------------------------------------------

/**
 * Get player geometry for specified LOD level.
 */
export function getPlayerGeometry(lodLevel: 0 | 1 | 2) {
  switch (lodLevel) {
    case 0:
      return PLAYER_GEOMETRIES_LOD0;
    case 1:
      return PLAYER_GEOMETRY_LOD1;
    case 2:
      return PLAYER_GEOMETRY_LOD2;
  }
}

/**
 * Get ball geometry for specified LOD level.
 */
export function getBallGeometry(lodLevel: 0 | 1 | 2) {
  switch (lodLevel) {
    case 0:
      return BALL_GEOMETRY_LOD0;
    case 1:
      return BALL_GEOMETRY_LOD1;
    case 2:
      return BALL_GEOMETRY_LOD2;
  }
}

/**
 * Get robot geometry for specified LOD level.
 */
export function getRobotGeometry(lodLevel: 0 | 1 | 2) {
  switch (lodLevel) {
    case 0:
      return ROBOT_GEOMETRIES_LOD0;
    case 1:
      return ROBOT_GEOMETRY_LOD1;
    case 2:
      return ROBOT_GEOMETRY_LOD2;
  }
}

/**
 * Get court geometries for specified LOD level.
 */
export function getCourtGeometries(lodLevel: 0 | 1 | 2 | 3) {
  switch (lodLevel) {
    case 0:
      return COURT_GEOMETRIES.LOD0;
    case 1:
      return COURT_GEOMETRIES.LOD1;
    case 2:
      return COURT_GEOMETRIES.LOD2;
    case 3:
      return COURT_GEOMETRIES.LOD3;
  }
}
