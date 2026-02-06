// Insert Phase 2 optimization tasks with L0/L1/L2 granularity
// Based on 25 agent research findings from OPTIMAL_RESEARCH_PLAN_V2.md

const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const insertTask = db.prepare(`
  INSERT INTO tasks (title, description, category, priority, estimated_effort, target_fps_gain)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertIteration = db.prepare(`
  INSERT INTO plan_iterations (task_id, iteration_number, agent_id, status, total_step_count)
  VALUES (?, 1, ?, 'accepted', ?)
`);

const insertStep = db.prepare(`
  INSERT INTO plan_steps (iteration_id, resolution, sequence_number, title, description, related_files, rationale, implementation_approach, exact_instructions, target_file, code_snippet, status, confidence_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
`);

const insertTest = db.prepare(`
  INSERT INTO test_specs (step_id, test_type, description, assertion, target_metric, target_value, target_comparison)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Phase 2 Tasks (Tasks 16-40)
const phase2Tasks = [
  // Tier 1: Critical Missing Hooks (Tasks 16-21)
  {
    title: 'useFrustumCulling Hook Implementation',
    description: 'Implement the useFrustumCulling hook that has 563 lines of tests but no implementation. Uses Frustum.intersectsBox() with pre-computed court bounding boxes for O(1) visibility checks.',
    category: 'rendering',
    priority: 'P0',
    effort: '4h',
    gain: 100,
    agent: 'agent-frustum-1',
    steps: {
      L0: [
        { title: 'Frustum Culling Concept', desc: 'Camera frustum extraction and Box3 intersection testing to skip rendering off-screen objects', rationale: '50-80% render reduction when zoomed in' }
      ],
      L1: [
        { title: 'Hook Architecture', desc: 'Create useFrustumCulling(courtPositions, camera) hook returning Set<string> of visible court IDs', approach: 'Extract frustum from camera projection matrix, pre-compute court Box3 bounds, return filtered visibility set' },
        { title: 'Integration Points', desc: 'Integrate with HomebaseCanvas, InstancedCourts, and CourtGroup components', approach: 'Pass visibleCourts set to child components for conditional rendering' }
      ],
      L2: [
        { title: 'Create useFrustumCulling.ts', desc: 'Implement hook with Frustum extraction and Box3 intersection', file: 'src/hooks/useFrustumCulling.ts', code: `import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

const COURT_HEIGHT = 3; // max height including net/players
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

export function useFrustumCulling(
  courtPositions: Array<{ x: number; z: number; id: string }>
) {
  const { camera } = useThree();
  const visibleRef = useRef<Set<string>>(new Set());

  // Pre-compute bounding boxes once
  const boxes = useMemo(() => {
    return courtPositions.map(({ x, z, id }) => ({
      id,
      box: new THREE.Box3(
        new THREE.Vector3(x - COURT_WIDTH/2, 0, z - COURT_LENGTH/2),
        new THREE.Vector3(x + COURT_WIDTH/2, COURT_HEIGHT, z + COURT_LENGTH/2)
      )
    }));
  }, [courtPositions]);

  useFrame(() => {
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    visibleRef.current.clear();
    for (const { id, box } of boxes) {
      if (frustum.intersectsBox(box)) {
        visibleRef.current.add(id);
      }
    }
  });

  return visibleRef;
}` },
        { title: 'Integrate in HomebaseCanvas', desc: 'Use hook and pass visibility to children', file: 'src/components/three/HomebaseCanvas.tsx', code: `// Add to HomebaseScene:
const visibleCourtsRef = useFrustumCulling(courtPositions);

// Pass to InstancedCourts and CourtGroup rendering
{courtPositions.filter(({id}) => visibleCourtsRef.current.has(id)).map(...)}`}
      ],
      tests: [
        { type: 'benchmark', desc: 'Culling check under 0.1ms for 200 courts', assertion: 'cullingTime < 0.1', metric: 'ms', value: 0.1, comparison: 'lt' },
        { type: 'unit', desc: 'Returns empty set when camera faces away', assertion: 'visibleCourts.size === 0', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Grid-Range Frustum Algorithm',
    description: 'Optimize frustum culling for grid layouts using row/column range computation instead of per-court Box3 checks. O(1) bounds calculation.',
    category: 'rendering',
    priority: 'P0',
    effort: '2h',
    gain: 20,
    agent: 'agent-frustum-2',
    steps: {
      L0: [
        { title: 'Grid-Range Concept', desc: 'For regular grid layouts, compute visible row/col range directly from frustum planes instead of checking each court individually', rationale: 'O(1) vs O(n) for grid layouts' }
      ],
      L1: [
        { title: 'Range Computation', desc: 'Project frustum corners to ground plane, compute bounding rectangle, map to grid row/col indices', approach: 'Use ray-plane intersection for corner projection, clamp to valid grid indices' }
      ],
      L2: [
        { title: 'Add getVisibleGridRange function', desc: 'Compute min/max row/col from frustum', file: 'src/hooks/useFrustumCulling.ts', code: `export function getVisibleGridRange(
  camera: THREE.Camera,
  gridConfig: { rows: number; cols: number; spacing: number }
): { minRow: number; maxRow: number; minCol: number; maxCol: number } {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matrix);

  // Project frustum corners to y=0 plane
  const corners = getFrustumGroundCorners(camera);
  const bounds = getBoundingRect(corners);

  return {
    minRow: Math.max(0, Math.floor(bounds.minZ / (COURT_LENGTH + gridConfig.spacing))),
    maxRow: Math.min(gridConfig.rows - 1, Math.ceil(bounds.maxZ / (COURT_LENGTH + gridConfig.spacing))),
    minCol: Math.max(0, Math.floor(bounds.minX / (COURT_WIDTH + gridConfig.spacing))),
    maxCol: Math.min(gridConfig.cols - 1, Math.ceil(bounds.maxX / (COURT_WIDTH + gridConfig.spacing)))
  };
}` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Grid range computation under 0.01ms', assertion: 'rangeComputeTime < 0.01', metric: 'ms', value: 0.01, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'useLODLevel Hook Implementation',
    description: 'Implement the useLODLevel hook that has 747 lines of tests but no implementation. Distance-based LOD selection with hysteresis anti-popping.',
    category: 'rendering',
    priority: 'P0',
    effort: '4h',
    gain: 80,
    agent: 'agent-lod-3',
    steps: {
      L0: [
        { title: 'LOD Concept', desc: 'Select geometry detail level based on camera distance. COURT: [0-35m]=HIGH, [35-80m]=MEDIUM, [80-180m]=LOW, [180+]=BILLBOARD. PLAYER: [0-30m]=HIGH, [30-60m]=LOW, [60+]=HIDDEN', rationale: '70-80% draw call reduction' }
      ],
      L1: [
        { title: 'Hook Design', desc: 'Create useLODLevel(objectType, position) returning { level, geometry, castShadow }', approach: 'Use squared distance, frame-skipped checks (every 3 frames), hysteresis band (10%)' },
        { title: 'Geometry Registry', desc: 'Module-level LOD geometry factories for Court, Player, Ball', approach: 'Pre-create all LOD geometries at module load, return by level index' }
      ],
      L2: [
        { title: 'Create useLODLevel.ts', desc: 'Implement LOD hook with distance thresholds', file: 'src/hooks/useLODLevel.ts', code: `import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export type LODLevel = 0 | 1 | 2 | 3; // HIGH, MEDIUM, LOW, BILLBOARD/HIDDEN

const THRESHOLDS = {
  COURT: [0, 35, 80, 180],  // meters
  PLAYER: [0, 30, 60, Infinity],
  BALL: [0, 20, 50, Infinity]
};
const HYSTERESIS = 0.1; // 10% band
const CHECK_INTERVAL = 3; // frames

export function useLODLevel(
  objectType: 'COURT' | 'PLAYER' | 'BALL',
  position: THREE.Vector3
): { level: LODLevel; castShadow: boolean } {
  const { camera } = useThree();
  const levelRef = useRef<LODLevel>(0);
  const frameCount = useRef(0);
  const thresholds = THRESHOLDS[objectType];

  useFrame(() => {
    if (++frameCount.current % CHECK_INTERVAL !== 0) return;

    const distSq = camera.position.distanceToSquared(position);
    const currentLevel = levelRef.current;

    // Check if we should change level (with hysteresis)
    for (let i = 0; i < thresholds.length - 1; i++) {
      const lower = thresholds[i] * thresholds[i];
      const upper = thresholds[i + 1] * thresholds[i + 1];
      const hysteresisBand = (upper - lower) * HYSTERESIS;

      if (currentLevel === i && distSq > upper + hysteresisBand) {
        levelRef.current = (i + 1) as LODLevel;
      } else if (currentLevel === i + 1 && distSq < upper - hysteresisBand) {
        levelRef.current = i as LODLevel;
      }
    }
  });

  return {
    level: levelRef.current,
    castShadow: levelRef.current === 0 // Only HIGH LOD casts shadows
  };
}` }
      ],
      tests: [
        { type: 'unit', desc: 'Returns HIGH at 20m distance', assertion: 'level === 0', metric: null, value: null, comparison: null },
        { type: 'unit', desc: 'Hysteresis prevents oscillation at boundary', assertion: 'transitionCount < 3', metric: 'transitions', value: 3, comparison: 'lt' },
        { type: 'benchmark', desc: 'LOD check under 0.05ms for 100 objects', assertion: 'lodCheckTime < 0.05', metric: 'ms', value: 0.05, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'LOD Geometry Factory',
    description: 'Create module-level LOD geometry factories for Court, Player, Ball with pre-created geometries for each detail level.',
    category: 'rendering',
    priority: 'P0',
    effort: '3h',
    gain: 50,
    agent: 'agent-lod-4',
    steps: {
      L0: [
        { title: 'Geometry Factory Concept', desc: 'Pre-create all LOD geometries at module load time to avoid runtime allocation. Each object type has 3-4 detail levels.', rationale: 'Zero runtime geometry allocation, faster LOD switching' }
      ],
      L1: [
        { title: 'Court LOD Geometries', desc: 'HIGH: Full detail (12 segments). MEDIUM: Merged surface+lines. LOW: Single plane. BILLBOARD: Texture quad', approach: 'Use BufferGeometry.merge() for medium LOD' },
        { title: 'Player LOD Geometries', desc: 'HIGH: Full body+head+arm+paddle. LOW: Single capsule. HIDDEN: null', approach: 'Reduce segment count at lower LODs' }
      ],
      L2: [
        { title: 'Create LODGeometries.ts', desc: 'Module-level geometry registry', file: 'src/three/LODGeometries.ts', code: `import * as THREE from 'three';

// Court geometries by LOD level
export const COURT_GEOMETRIES = {
  HIGH: createHighDetailCourt(),
  MEDIUM: createMediumDetailCourt(),
  LOW: new THREE.PlaneGeometry(6.096, 13.4112),
  BILLBOARD: new THREE.PlaneGeometry(6.096, 13.4112)
};

// Player geometries by LOD level
export const PLAYER_GEOMETRIES = {
  HIGH: {
    body: new THREE.CapsuleGeometry(0.22, 1.06, 4, 8),
    head: new THREE.SphereGeometry(0.14, 8, 8),
    arm: new THREE.CapsuleGeometry(0.06, 0.4, 2, 4),
    paddle: new THREE.BoxGeometry(0.18, 0.02, 0.12)
  },
  LOW: {
    body: new THREE.CapsuleGeometry(0.25, 1.2, 2, 4),
    head: null, arm: null, paddle: null
  }
};

// Ball geometries
export const BALL_GEOMETRIES = {
  HIGH: new THREE.SphereGeometry(0.04, 12, 12),
  LOW: new THREE.SphereGeometry(0.04, 6, 6),
  BILLBOARD: new THREE.CircleGeometry(0.04, 8)
};

function createHighDetailCourt() { /* ... */ }
function createMediumDetailCourt() { /* ... */ }` }
      ],
      tests: [
        { type: 'unit', desc: 'All geometries pre-created at module load', assertion: 'COURT_GEOMETRIES.HIGH !== undefined', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'LOD Hysteresis Anti-Popping',
    description: 'Implement 10% hysteresis band to prevent LOD oscillation when camera is near distance thresholds.',
    category: 'rendering',
    priority: 'P1',
    effort: '1h',
    gain: 5,
    agent: 'agent-lod-5',
    steps: {
      L0: [
        { title: 'Hysteresis Concept', desc: 'Add 10% dead zone around LOD thresholds where level changes are suppressed to prevent rapid switching', rationale: 'Eliminates visual popping and reduces LOD computation' }
      ],
      L1: [
        { title: 'Hysteresis Logic', desc: 'When transitioning UP (lower to higher detail), use threshold - 10%. When transitioning DOWN, use threshold + 10%', approach: 'Track last LOD level and apply directional hysteresis' }
      ],
      L2: [
        { title: 'Add hysteresis to useLODLevel', desc: 'Modify threshold comparison logic', file: 'src/hooks/useLODLevel.ts', code: `// In useLODLevel hook:
const prevLevel = levelRef.current;
const hysteresisFactor = prevLevel > targetLevel ? (1 - HYSTERESIS) : (1 + HYSTERESIS);
const adjustedThreshold = thresholds[targetLevel] * hysteresisFactor;
if (distSq crosses adjustedThreshold) { levelRef.current = targetLevel; }` }
      ],
      tests: [
        { type: 'unit', desc: 'No oscillation at boundary distance', assertion: 'levelChanges < 2 over 60 frames', metric: 'changes', value: 2, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'Shadow LOD Integration',
    description: 'Dynamically toggle castShadow/receiveShadow based on LOD level. Only HIGH LOD objects cast shadows.',
    category: 'rendering',
    priority: 'P1',
    effort: '2h',
    gain: 30,
    agent: 'agent-lod-6',
    steps: {
      L0: [
        { title: 'Shadow LOD Concept', desc: 'Shadows are expensive. Only render shadows for HIGH LOD objects within shadow camera frustum.', rationale: '30-50% shadow render cost reduction' }
      ],
      L1: [
        { title: 'Integration', desc: 'useLODLevel returns castShadow boolean. Components apply to mesh.castShadow prop.', approach: 'LOD level 0 = castShadow:true, others = false' }
      ],
      L2: [
        { title: 'Apply shadow LOD to AnimatedPlayer', desc: 'Use LOD-based castShadow', file: 'src/components/three/AnimatedPlayer.tsx', code: `const { level, castShadow } = useLODLevel('PLAYER', position);
// In mesh:
<mesh castShadow={castShadow} ... />` }
      ],
      tests: [
        { type: 'unit', desc: 'castShadow false when LOD > 0', assertion: 'mesh.castShadow === false when level > 0', metric: null, value: null, comparison: null }
      ]
    }
  },

  // Tier 2: Architecture Improvements (Tasks 22-29)
  {
    title: 'Per-Instance InstancedMesh Culling',
    description: 'Fix frustumCulled={false} on all InstancedMesh components. Enable per-instance culling or use manual visibility management.',
    category: 'rendering',
    priority: 'P0',
    effort: '2h',
    gain: 60,
    agent: 'agent-arch-7',
    steps: {
      L0: [
        { title: 'InstancedMesh Culling Problem', desc: 'All InstancedMesh components have frustumCulled={false}, disabling Three.js automatic culling. This wastes GPU on off-screen instances.', rationale: '40-60% fewer rendered instances' }
      ],
      L1: [
        { title: 'Solution Options', desc: 'Option A: Set frustumCulled={true} with proper bounding box. Option B: Manual instance visibility via count or setMatrixAt(identity)', approach: 'Use bounding box that encompasses all instances for Option A' },
        { title: 'Implementation', desc: 'Compute aggregate bounding box from all instance positions, set on InstancedMesh.geometry.boundingBox', approach: 'Use Box3.expandByPoint() for each instance position' }
      ],
      L2: [
        { title: 'Fix InstancedCourts culling', desc: 'Enable frustum culling with computed bounds', file: 'src/components/three/InstancedCourts.tsx', code: `// After creating instancedMesh:
const box = new THREE.Box3();
courtPositions.forEach(({ x, z }) => {
  box.expandByPoint(new THREE.Vector3(x - COURT_WIDTH/2, 0, z - COURT_LENGTH/2));
  box.expandByPoint(new THREE.Vector3(x + COURT_WIDTH/2, 3, z + COURT_LENGTH/2));
});
meshRef.current.geometry.boundingBox = box;
meshRef.current.geometry.boundingSphere = new THREE.Sphere();
box.getBoundingSphere(meshRef.current.geometry.boundingSphere);
// Remove frustumCulled={false}` }
      ],
      tests: [
        { type: 'unit', desc: 'frustumCulled not explicitly false', assertion: 'mesh.frustumCulled !== false', metric: null, value: null, comparison: null },
        { type: 'benchmark', desc: 'Draw calls reduced when zoomed in', assertion: 'drawCalls < 50% of total when camera zoomed', metric: 'percent', value: 50, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'Court-Scoped Game Version Counter',
    description: 'Replace global game version counter with per-court version tracking to reduce cascade re-renders across all courts.',
    category: 'state',
    priority: 'P0',
    effort: '3h',
    gain: 90,
    agent: 'agent-arch-8',
    steps: {
      L0: [
        { title: 'Version Counter Problem', desc: 'Global gameVersion counter causes all 100+ courts to re-render when any single court updates. Need per-court isolation.', rationale: '90% fewer re-renders' }
      ],
      L1: [
        { title: 'Per-Court Version Map', desc: 'Replace single gameVersion with Map<courtId, number>. Components subscribe only to their court version.', approach: 'Use Zustand selector with courtId parameter' }
      ],
      L2: [
        { title: 'Add courtVersions to gameStore', desc: 'Per-court version tracking', file: 'src/stores/gameStore.ts', code: `// In gameStore state:
courtVersions: new Map<string, number>(),

// Action to increment specific court:
incrementCourtVersion: (courtId: string) => {
  const current = get().courtVersions.get(courtId) || 0;
  set(state => {
    const newMap = new Map(state.courtVersions);
    newMap.set(courtId, current + 1);
    return { courtVersions: newMap };
  });
}` },
        { title: 'Update GameSession selector', desc: 'Subscribe to specific court version', file: 'src/components/three/GameSession.tsx', code: `// Change from:
const version = useGameStore(s => s.gameVersion);
// To:
const version = useGameStore(s => s.courtVersions.get(courtId) || 0);` }
      ],
      tests: [
        { type: 'unit', desc: 'Court A update doesnt trigger Court B render', assertion: 'courtB.renderCount === 0 after courtA.update()', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Web Worker Physics Offloading',
    description: 'Move physics calculations to dedicated Web Worker with SharedArrayBuffer for zero-copy position data sharing.',
    category: 'workers',
    priority: 'P1',
    effort: '1d',
    gain: 100,
    agent: 'agent-arch-9',
    steps: {
      L0: [
        { title: 'Worker Offloading Concept', desc: 'Physics runs in separate thread, main thread only handles rendering. SharedArrayBuffer enables zero-copy data sharing.', rationale: 'Unblock main thread, consistent 60fps even with heavy physics' }
      ],
      L1: [
        { title: 'Worker Architecture', desc: 'PhysicsWorker.ts handles ball trajectories, collision detection. Main thread reads position data from SharedArrayBuffer.', approach: 'Use Atomics for synchronization, Float64Array views for positions' },
        { title: 'Data Layout', desc: 'SharedArrayBuffer layout: [ballCount, ball0.x, ball0.y, ball0.z, ball0.vx, ball0.vy, ball0.vz, ...]', approach: '7 floats per ball (position + velocity + active flag)' }
      ],
      L2: [
        { title: 'Create PhysicsWorker.ts', desc: 'Worker script for physics loop', file: 'src/workers/PhysicsWorker.ts', code: `// Physics worker
const FLOATS_PER_BALL = 7;
let sharedBuffer: SharedArrayBuffer;
let positions: Float64Array;

self.onmessage = (e) => {
  if (e.data.type === 'init') {
    sharedBuffer = e.data.buffer;
    positions = new Float64Array(sharedBuffer);
  }
  if (e.data.type === 'tick') {
    updatePhysics(e.data.dt);
  }
};

function updatePhysics(dt: number) {
  const ballCount = Atomics.load(new Int32Array(sharedBuffer), 0);
  for (let i = 0; i < ballCount; i++) {
    const offset = 1 + i * FLOATS_PER_BALL;
    // Update position from velocity
    positions[offset + 0] += positions[offset + 3] * dt; // x += vx * dt
    positions[offset + 1] += positions[offset + 4] * dt; // y += vy * dt
    positions[offset + 2] += positions[offset + 5] * dt; // z += vz * dt
    // Apply gravity
    positions[offset + 4] -= 9.81 * dt; // vy -= g * dt
  }
}` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Main thread frame time < 4ms with 100 balls', assertion: 'mainThreadTime < 4', metric: 'ms', value: 4, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'WASM Physics Engine Integration',
    description: 'Integrate Rapier.js or custom Rust WASM physics for 10-50x speedup on collision detection and trajectory calculation.',
    category: 'wasm',
    priority: 'P2',
    effort: '1w',
    gain: 200,
    agent: 'agent-arch-10',
    steps: {
      L0: [
        { title: 'WASM Physics Concept', desc: 'WASM executes at near-native speed. Rapier provides production-ready 3D physics. Can handle 1000+ rigid bodies.', rationale: '10-50x physics speedup, enables larger simulations' }
      ],
      L1: [
        { title: 'Rapier Integration', desc: 'Use @dimforge/rapier3d-compat for browser-compatible WASM physics', approach: 'Create physics world, add ball rigid bodies, step simulation each frame' },
        { title: 'Data Flow', desc: 'WASM world is source of truth. Read positions back to JS for rendering.', approach: 'Batch read all positions in single call to minimize JS-WASM boundary crossings' }
      ],
      L2: [
        { title: 'Install and initialize Rapier', desc: 'Add Rapier dependency and init', file: 'src/physics/RapierPhysics.ts', code: `import RAPIER from '@dimforge/rapier3d-compat';

let world: RAPIER.World;
const balls = new Map<string, RAPIER.RigidBody>();

export async function initPhysics() {
  await RAPIER.init();
  const gravity = { x: 0, y: -9.81, z: 0 };
  world = new RAPIER.World(gravity);
}

export function addBall(id: string, position: {x,y,z}) {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z);
  const body = world.createRigidBody(bodyDesc);
  balls.set(id, body);
}

export function stepPhysics(dt: number) {
  world.step();
}

export function getBallPositions(): Map<string, {x,y,z}> {
  const result = new Map();
  balls.forEach((body, id) => {
    const pos = body.translation();
    result.set(id, { x: pos.x, y: pos.y, z: pos.z });
  });
  return result;
}` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Physics step < 1ms for 100 balls', assertion: 'physicsStepTime < 1', metric: 'ms', value: 1, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'Batched Matrix Updates for InstancedMesh',
    description: 'Reduce setMatrixAt calls by batching all instance matrix updates into single needsUpdate=true trigger.',
    category: 'rendering',
    priority: 'P1',
    effort: '2h',
    gain: 20,
    agent: 'agent-arch-11',
    steps: {
      L0: [
        { title: 'Matrix Update Problem', desc: 'Each setMatrixAt triggers internal updates. Batching all updates before setting needsUpdate=true reduces overhead.', rationale: 'Reduce per-instance overhead' }
      ],
      L1: [
        { title: 'Batch Pattern', desc: 'Loop through all instances, call setMatrixAt for each, then set instanceMatrix.needsUpdate=true once at end', approach: 'Use pre-allocated Matrix4 to avoid allocation' }
      ],
      L2: [
        { title: 'Implement batched updates', desc: 'Batch all matrix updates', file: 'src/components/three/InstancedCourts.tsx', code: `// Pre-allocate matrix
const tempMatrix = new THREE.Matrix4();

// In update loop:
courtPositions.forEach(({ x, z }, i) => {
  tempMatrix.setPosition(x, 0, z);
  meshRef.current.setMatrixAt(i, tempMatrix);
});
meshRef.current.instanceMatrix.needsUpdate = true; // Single update trigger` }
      ],
      tests: [
        { type: 'unit', desc: 'needsUpdate set once per batch', assertion: 'needsUpdateCount === 1', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Spatial Hashing for Collision Detection',
    description: 'Replace O(n²) collision detection with O(1) spatial hash grid lookups for ball-player and ball-ball collisions.',
    category: 'physics',
    priority: 'P1',
    effort: '4h',
    gain: 50,
    agent: 'agent-arch-12',
    steps: {
      L0: [
        { title: 'Spatial Hashing Concept', desc: 'Divide world into grid cells. Only check collisions between objects in same or adjacent cells. O(1) average case.', rationale: 'O(n²) → O(n) collision detection' }
      ],
      L1: [
        { title: 'Hash Grid Implementation', desc: 'Use Map<cellKey, Set<objectId>>. Cell size = largest object radius * 2.', approach: 'cellKey = `${floor(x/cellSize)},${floor(z/cellSize)}`' }
      ],
      L2: [
        { title: 'Create SpatialHash.ts', desc: 'Spatial hash grid implementation', file: 'src/physics/SpatialHash.ts', code: `export class SpatialHash {
  private cells = new Map<string, Set<string>>();
  private cellSize: number;

  constructor(cellSize: number = 2) {
    this.cellSize = cellSize;
  }

  private getKey(x: number, z: number): string {
    return \`\${Math.floor(x / this.cellSize)},\${Math.floor(z / this.cellSize)}\`;
  }

  insert(id: string, x: number, z: number) {
    const key = this.getKey(x, z);
    if (!this.cells.has(key)) this.cells.set(key, new Set());
    this.cells.get(key)!.add(id);
  }

  query(x: number, z: number): string[] {
    const results: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = this.getKey(x + dx * this.cellSize, z + dz * this.cellSize);
        const cell = this.cells.get(key);
        if (cell) results.push(...cell);
      }
    }
    return results;
  }

  clear() { this.cells.clear(); }
}` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Collision check < 0.5ms for 100 objects', assertion: 'collisionTime < 0.5', metric: 'ms', value: 0.5, comparison: 'lt' }
      ]
    }
  },
  {
    title: 'Object Pooling for Game Entities',
    description: 'Implement object pool for balls, trail particles, and collision effects to eliminate runtime allocations.',
    category: 'memory',
    priority: 'P0',
    effort: '3h',
    gain: 40,
    agent: 'agent-arch-13',
    steps: {
      L0: [
        { title: 'Object Pooling Concept', desc: 'Pre-allocate fixed number of objects. Reuse instead of create/destroy. Zero GC pressure.', rationale: 'Eliminate GC pauses, consistent frame times' }
      ],
      L1: [
        { title: 'Pool Architecture', desc: 'Generic Pool<T> class with acquire()/release(). Pre-allocate on init.', approach: 'Use free list for O(1) acquire/release' }
      ],
      L2: [
        { title: 'Create ObjectPool.ts', desc: 'Generic object pool implementation', file: 'src/utils/ObjectPool.ts', code: `export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 100) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  release(obj: T) {
    this.reset(obj);
    this.pool.push(obj);
  }
}

// Ball pool example:
export const ballPool = new ObjectPool(
  () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, active: false }),
  (ball) => { ball.active = false; ball.x = ball.y = ball.z = 0; },
  200
);` }
      ],
      tests: [
        { type: 'unit', desc: 'No new allocations after warmup', assertion: 'allocations === 0', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Deferred Rendering Pipeline Analysis',
    description: 'Evaluate deferred vs forward rendering for multi-court facility. Analyze light count, G-buffer cost, and fill rate.',
    category: 'rendering',
    priority: 'P2',
    effort: '1d',
    gain: 30,
    agent: 'agent-arch-14',
    steps: {
      L0: [
        { title: 'Deferred Rendering Analysis', desc: 'For facilities with many lights, deferred rendering can be more efficient. However, for simple lighting (1-2 directional), forward is better.', rationale: 'Understand rendering trade-offs for future scaling' }
      ],
      L1: [
        { title: 'Current Analysis', desc: 'With 2-3 lights and simple materials, forward rendering is optimal. Deferred adds G-buffer overhead without benefit.', approach: 'Document decision, revisit if light count increases' }
      ],
      L2: [
        { title: 'Document rendering decision', desc: 'Add performance note', file: 'src/ARCHITECTURE.md', code: `## Rendering Pipeline

Forward rendering chosen over deferred because:
- Only 2-3 lights in scene
- No dynamic point/spot lights per court
- G-buffer bandwidth cost > forward multi-pass

Revisit if: per-court lighting, >10 dynamic lights` }
      ],
      tests: [
        { type: 'manual', desc: 'Verify forward rendering is active', assertion: 'renderer.capabilities check', metric: null, value: null, comparison: null }
      ]
    }
  },

  // Tier 3: Micro-Optimizations (Tasks 30-36)
  {
    title: 'Sin/Cos Lookup Tables',
    description: 'Pre-compute sin/cos values in lookup tables for 3-5x speedup in animation hot paths.',
    category: 'math',
    priority: 'P2',
    effort: '1h',
    gain: 10,
    agent: 'agent-micro-15',
    steps: {
      L0: [
        { title: 'Trig Lookup Concept', desc: 'Math.sin/cos are expensive. Pre-computed tables with interpolation are 3-5x faster.', rationale: 'Reduce animation CPU cost' }
      ],
      L1: [
        { title: 'Table Size', desc: '360 entries (1 degree resolution) balances accuracy and cache efficiency', approach: 'Linear interpolation for sub-degree precision' }
      ],
      L2: [
        { title: 'Create TrigTables.ts', desc: 'Sin/cos lookup implementation', file: 'src/utils/TrigTables.ts', code: `const TABLE_SIZE = 360;
const DEG_TO_RAD = Math.PI / 180;
const sinTable = new Float32Array(TABLE_SIZE);
const cosTable = new Float32Array(TABLE_SIZE);

for (let i = 0; i < TABLE_SIZE; i++) {
  sinTable[i] = Math.sin(i * DEG_TO_RAD);
  cosTable[i] = Math.cos(i * DEG_TO_RAD);
}

export function fastSin(radians: number): number {
  const degrees = (radians * 180 / Math.PI) % 360;
  const idx = degrees < 0 ? degrees + 360 : degrees;
  const i = Math.floor(idx);
  const t = idx - i;
  return sinTable[i] * (1 - t) + sinTable[(i + 1) % TABLE_SIZE] * t;
}

export function fastCos(radians: number): number {
  const degrees = (radians * 180 / Math.PI) % 360;
  const idx = degrees < 0 ? degrees + 360 : degrees;
  const i = Math.floor(idx);
  const t = idx - i;
  return cosTable[i] * (1 - t) + cosTable[(i + 1) % TABLE_SIZE] * t;
}` }
      ],
      tests: [
        { type: 'benchmark', desc: 'fastSin 3x faster than Math.sin', assertion: 'fastSinTime < mathSinTime / 3', metric: 'ratio', value: 3, comparison: 'gt' }
      ]
    }
  },
  {
    title: 'Pre-computed Ball Arc Physics',
    description: 'Pre-compute ball trajectory arcs instead of calculating position each frame. Store arc as parametric curve.',
    category: 'physics',
    priority: 'P1',
    effort: '2h',
    gain: 15,
    agent: 'agent-micro-16',
    steps: {
      L0: [
        { title: 'Arc Pre-computation Concept', desc: 'Ball follows parabolic arc under gravity. Compute arc parameters once at shot, evaluate parametrically each frame.', rationale: 'Avoid repeated physics calculations' }
      ],
      L1: [
        { title: 'Arc Parameters', desc: 'Store: startPos, velocity, gravity, startTime. Position(t) = start + v*t + 0.5*g*t²', approach: 'Check for bounce/collision events along arc' }
      ],
      L2: [
        { title: 'Create BallArc.ts', desc: 'Pre-computed arc implementation', file: 'src/physics/BallArc.ts', code: `export interface BallArc {
  startX: number; startY: number; startZ: number;
  vx: number; vy: number; vz: number;
  startTime: number;
  gravity: number;
}

export function createArc(pos: {x,y,z}, vel: {x,y,z}, time: number): BallArc {
  return {
    startX: pos.x, startY: pos.y, startZ: pos.z,
    vx: vel.x, vy: vel.y, vz: vel.z,
    startTime: time, gravity: -9.81
  };
}

export function evaluateArc(arc: BallArc, currentTime: number): {x,y,z} {
  const t = currentTime - arc.startTime;
  return {
    x: arc.startX + arc.vx * t,
    y: arc.startY + arc.vy * t + 0.5 * arc.gravity * t * t,
    z: arc.startZ + arc.vz * t
  };
}` }
      ],
      tests: [
        { type: 'unit', desc: 'Arc evaluation matches physics integration', assertion: 'Math.abs(arcPos.y - physicsPos.y) < 0.001', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Animation Frame Skipping',
    description: 'Skip animation updates for distant players. Only animate HIGH LOD players every frame.',
    category: 'rendering',
    priority: 'P1',
    effort: '1h',
    gain: 25,
    agent: 'agent-micro-17',
    steps: {
      L0: [
        { title: 'Frame Skipping Concept', desc: 'Distant player animations are barely visible. Update every 2-4 frames instead of every frame.', rationale: '50-75% animation overhead reduction' }
      ],
      L1: [
        { title: 'Skip Logic', desc: 'LOD 0: every frame. LOD 1: every 2 frames. LOD 2+: every 4 frames or frozen', approach: 'Use frame counter modulo' }
      ],
      L2: [
        { title: 'Add frame skipping to AnimatedPlayer', desc: 'Skip updates for distant players', file: 'src/components/three/AnimatedPlayer.tsx', code: `// In useFrame:
const frameCount = useRef(0);
const { level } = useLODLevel('PLAYER', position);

useFrame((state) => {
  frameCount.current++;
  const skipFrames = level === 0 ? 1 : level === 1 ? 2 : 4;
  if (frameCount.current % skipFrames !== 0) return;

  // ... existing animation logic
});` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Animation time reduced 50% for 100 players', assertion: 'animationTime < baseline / 2', metric: 'ms', value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Texture Atlas for Materials',
    description: 'Consolidate court surface textures into single atlas to reduce texture binding overhead.',
    category: 'rendering',
    priority: 'P2',
    effort: '3h',
    gain: 10,
    agent: 'agent-micro-18',
    steps: {
      L0: [
        { title: 'Texture Atlas Concept', desc: 'Multiple texture binds per frame is expensive. Atlas combines textures, uses UV offsets.', rationale: 'Fewer GPU state changes' }
      ],
      L1: [
        { title: 'Atlas Layout', desc: '4 court surfaces in 2x2 grid. UV coordinates select quadrant.', approach: 'Use canvas to composite textures, create single DataTexture' }
      ],
      L2: [
        { title: 'Create TextureAtlas.ts', desc: 'Atlas creation and UV mapping', file: 'src/three/TextureAtlas.ts', code: `export function createCourtAtlas(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Draw 4 surface colors in quadrants
  const surfaces = ['#c4a574', '#3d3d3d', '#2563eb', '#94a3b8'];
  surfaces.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect((i % 2) * 256, Math.floor(i / 2) * 256, 256, 256);
  });

  return new THREE.CanvasTexture(canvas);
}

export function getSurfaceUV(surfaceType: string): { u: number, v: number } {
  const index = ['hardwood', 'rubber', 'polypropylene', 'vinyl'].indexOf(surfaceType);
  return { u: (index % 2) * 0.5, v: Math.floor(index / 2) * 0.5 };
}` }
      ],
      tests: [
        { type: 'unit', desc: 'Single texture for all surfaces', assertion: 'textureBindCount === 1', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Geometry Merging for Static Objects',
    description: 'Merge ground plane, dock, and other static geometries into single draw call.',
    category: 'rendering',
    priority: 'P2',
    effort: '2h',
    gain: 5,
    agent: 'agent-micro-19',
    steps: {
      L0: [
        { title: 'Geometry Merge Concept', desc: 'Static objects that never move can be merged into single geometry for one draw call.', rationale: 'Reduce draw calls for static scene elements' }
      ],
      L1: [
        { title: 'Merge Candidates', desc: 'Ground plane + dock base + court boundaries (if static)', approach: 'Use BufferGeometryUtils.mergeBufferGeometries()' }
      ],
      L2: [
        { title: 'Merge static geometries', desc: 'Use Three.js merge utility', file: 'src/components/three/StaticSceneElements.tsx', code: `import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

const staticGeometry = useMemo(() => {
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  groundGeo.rotateX(-Math.PI / 2);

  const dockGeo = new THREE.BoxGeometry(2, 0.1, 2);
  dockGeo.translate(dockPosition.x, 0.05, dockPosition.z);

  return mergeBufferGeometries([groundGeo, dockGeo]);
}, [dockPosition]);

return <mesh geometry={staticGeometry} material={groundMaterial} />;` }
      ],
      tests: [
        { type: 'unit', desc: 'Static elements merged to 1 draw call', assertion: 'staticDrawCalls === 1', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'TypedArray View Recycling',
    description: 'Recycle TypedArray views instead of creating new slices. Avoid subarray() allocations.',
    category: 'memory',
    priority: 'P1',
    effort: '2h',
    gain: 15,
    agent: 'agent-micro-20',
    steps: {
      L0: [
        { title: 'View Recycling Concept', desc: 'TypedArray.subarray() creates new view objects. Reuse views via offset tracking.', rationale: 'Zero allocation for array operations' }
      ],
      L1: [
        { title: 'Recycled View Pattern', desc: 'Instead of arr.subarray(start, end), use pre-created view with offset index', approach: 'Track current offset, use view[offset + i] instead of slice[i]' }
      ],
      L2: [
        { title: 'Create RecycledArrayView.ts', desc: 'Recyclable array view wrapper', file: 'src/utils/RecycledArrayView.ts', code: `export class RecycledFloat64View {
  private buffer: Float64Array;
  private offset = 0;
  private length = 0;

  constructor(buffer: Float64Array) {
    this.buffer = buffer;
  }

  setWindow(offset: number, length: number) {
    this.offset = offset;
    this.length = length;
  }

  get(index: number): number {
    return this.buffer[this.offset + index];
  }

  set(index: number, value: number) {
    this.buffer[this.offset + index] = value;
  }

  getLength(): number { return this.length; }
}` }
      ],
      tests: [
        { type: 'unit', desc: 'No allocations in view operations', assertion: 'heapDelta === 0', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'RequestAnimationFrame Throttling',
    description: 'Implement adaptive frame rate throttling based on performance budget and device capability.',
    category: 'rendering',
    priority: 'P2',
    effort: '2h',
    gain: 20,
    agent: 'agent-micro-21',
    steps: {
      L0: [
        { title: 'RAF Throttling Concept', desc: 'On low-end devices, target 30fps instead of 60fps to maintain consistency. On high-end, allow 120fps.', rationale: 'Adaptive quality for all devices' }
      ],
      L1: [
        { title: 'Throttle Logic', desc: 'Track frame time average. If > 16ms, skip every other frame. If < 8ms, allow higher refresh.', approach: 'Use performance store tier detection' }
      ],
      L2: [
        { title: 'Add RAF throttling', desc: 'Frame rate adaptation', file: 'src/systems/WorldUpdateLoop.tsx', code: `// In WorldUpdateLoop:
const skipFrame = useRef(false);
const { tier } = usePerformanceStore();

useFrame((state, delta) => {
  if (tier === 'low' && (skipFrame.current = !skipFrame.current)) {
    return; // Skip every other frame on low-end
  }

  // ... existing update logic
});` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Frame time variance < 5ms on low tier', assertion: 'frameTimeVariance < 5', metric: 'ms', value: 5, comparison: 'lt' }
      ]
    }
  },

  // Tier 4: Advanced/Exploratory (Tasks 37-40)
  {
    title: 'GPU Instancing with Custom Shaders',
    description: 'Replace InstancedMesh with custom shader-based instancing for maximum GPU efficiency and custom attributes.',
    category: 'rendering',
    priority: 'P3',
    effort: '1w',
    gain: 50,
    agent: 'agent-adv-22',
    steps: {
      L0: [
        { title: 'Custom GPU Instancing Concept', desc: 'Three.js InstancedMesh has overhead. Custom instancing with BufferAttribute for instance data maximizes throughput.', rationale: 'Maximum GPU efficiency for 1000+ instances' }
      ],
      L1: [
        { title: 'Shader Design', desc: 'Vertex shader reads instance matrix from attribute. Fragment shader supports per-instance color.', approach: 'Use instanced BufferGeometry with custom attributes' }
      ],
      L2: [
        { title: 'Create CustomInstancedMesh.ts', desc: 'Custom shader instancing', file: 'src/three/CustomInstancedMesh.ts', code: `// Advanced: Custom shader instancing for maximum performance
// Implementation requires GLSL vertex/fragment shaders
// See Three.js examples: webgl_buffergeometry_instancing` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Draw 10000 instances at 60fps', assertion: 'fps >= 60 with 10000 instances', metric: 'fps', value: 60, comparison: 'gte' }
      ]
    }
  },
  {
    title: 'Occlusion Culling with GPU Queries',
    description: 'Use GPU occlusion queries to skip rendering objects hidden behind other geometry.',
    category: 'rendering',
    priority: 'P3',
    effort: '1w',
    gain: 40,
    agent: 'agent-adv-23',
    steps: {
      L0: [
        { title: 'Occlusion Culling Concept', desc: 'Beyond frustum culling, skip objects hidden behind walls/buildings. GPU queries test visibility.', rationale: 'Further draw call reduction in complex scenes' }
      ],
      L1: [
        { title: 'Implementation Approach', desc: 'WebGL2 occlusion queries or hierarchical-Z buffer approach', approach: 'Render bounding boxes first, query visibility, skip occluded objects' }
      ],
      L2: [
        { title: 'Research occlusion culling', desc: 'Document approach for future implementation', file: 'docs/OCCLUSION_CULLING.md', code: `# Occlusion Culling Research

For flat pickleball facility (no walls), occlusion culling provides minimal benefit.
Revisit if: indoor facilities with walls, multi-level buildings.

WebGL2 approach: gl.createQuery(), gl.beginQuery(gl.ANY_SAMPLES_PASSED, query)` }
      ],
      tests: [
        { type: 'manual', desc: 'Measure benefit vs cost', assertion: 'Document findings', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Compute Shader Physics (WebGPU)',
    description: 'Future-proof physics with WebGPU compute shaders for parallel GPU physics.',
    category: 'wasm',
    priority: 'P3',
    effort: '2w',
    gain: 100,
    agent: 'agent-adv-24',
    steps: {
      L0: [
        { title: 'WebGPU Compute Concept', desc: 'WebGPU compute shaders enable massively parallel physics on GPU. 100-1000x speedup for particle systems.', rationale: 'Future-proof for next-gen browsers' }
      ],
      L1: [
        { title: 'Implementation Path', desc: 'Requires WebGPU-enabled browser. Three.js WebGPU renderer in development.', approach: 'Prototype with @webgpu/types, migrate when Three.js WebGPU stable' }
      ],
      L2: [
        { title: 'Document WebGPU roadmap', desc: 'Future implementation plan', file: 'docs/WEBGPU_ROADMAP.md', code: `# WebGPU Physics Roadmap

## Prerequisites
- WebGPU browser support (Chrome 113+, Firefox behind flag)
- Three.js WebGPU renderer stable release

## Compute Shader Design
- Ball physics: position += velocity * dt
- Collision detection: spatial grid in compute
- Output: position buffer read by vertex shader` }
      ],
      tests: [
        { type: 'manual', desc: 'Prototype when WebGPU available', assertion: 'Document browser support', metric: null, value: null, comparison: null }
      ]
    }
  },
  {
    title: 'Progressive Loading and Streaming',
    description: 'Load facility data progressively for faster initial render. Stream court data as camera moves.',
    category: 'loading',
    priority: 'P2',
    effort: '1d',
    gain: 30,
    agent: 'agent-adv-25',
    steps: {
      L0: [
        { title: 'Progressive Loading Concept', desc: 'Load visible courts first, stream others in background. Faster time-to-interactive.', rationale: 'Better UX for large facilities (100+ courts)' }
      ],
      L1: [
        { title: 'Loading Strategy', desc: 'Initial load: courts within camera view. Background: remaining courts sorted by distance.', approach: 'Use IntersectionObserver pattern for distance-based loading' }
      ],
      L2: [
        { title: 'Implement progressive court loading', desc: 'Load courts based on camera position', file: 'src/hooks/useProgressiveLoad.ts', code: `export function useProgressiveLoad(
  totalCourts: number,
  cameraPosition: THREE.Vector3
) {
  const [loadedCourts, setLoadedCourts] = useState<Set<string>>(new Set());
  const loadQueue = useRef<string[]>([]);

  useEffect(() => {
    // Initial: load nearest 20 courts
    const nearest = sortByDistance(allCourts, cameraPosition).slice(0, 20);
    setLoadedCourts(new Set(nearest.map(c => c.id)));

    // Queue rest for background loading
    loadQueue.current = sortByDistance(allCourts, cameraPosition)
      .slice(20)
      .map(c => c.id);
  }, []);

  // Background loader
  useEffect(() => {
    const interval = setInterval(() => {
      if (loadQueue.current.length > 0) {
        const next = loadQueue.current.shift()!;
        setLoadedCourts(prev => new Set([...prev, next]));
      }
    }, 100); // Load 10 courts/second
    return () => clearInterval(interval);
  }, []);

  return loadedCourts;
}` }
      ],
      tests: [
        { type: 'benchmark', desc: 'Time to first render < 500ms', assertion: 'firstRenderTime < 500', metric: 'ms', value: 500, comparison: 'lt' }
      ]
    }
  }
];

// Insert all tasks with iterations and steps
const insertAll = db.transaction(() => {
  let taskCount = 0;
  let stepCount = 0;
  let testCount = 0;

  for (const task of phase2Tasks) {
    // Insert task
    const taskResult = insertTask.run(
      task.title,
      task.description,
      task.category,
      task.priority,
      task.effort,
      task.gain
    );
    const taskId = taskResult.lastInsertRowid;

    // Count total steps
    const totalSteps = task.steps.L0.length + task.steps.L1.length + task.steps.L2.length;

    // Create iteration
    const iterResult = insertIteration.run(taskId, task.agent, totalSteps);
    const iterationId = iterResult.lastInsertRowid;

    // Insert L0 steps
    let seq = 0;
    for (const step of task.steps.L0) {
      insertStep.run(
        iterationId, 'L0', seq++,
        step.title, step.desc,
        null, step.rationale || null,
        null, null, null, null, 0.9
      );
      stepCount++;
    }

    // Insert L1 steps
    for (const step of task.steps.L1) {
      insertStep.run(
        iterationId, 'L1', seq++,
        step.title, step.desc,
        null, null,
        step.approach || null, null, null, null, 0.85
      );
      stepCount++;
    }

    // Insert L2 steps
    for (const step of task.steps.L2) {
      const stepResult = insertStep.run(
        iterationId, 'L2', seq++,
        step.title, step.desc,
        step.file || null, null,
        null, null, step.file || null, step.code || null, 0.8
      );
      stepCount++;

      // Insert tests for L2 steps if task has tests
      if (task.tests) {
        for (const test of task.tests) {
          insertTest.run(
            stepResult.lastInsertRowid,
            test.type,
            test.desc,
            test.assertion,
            test.metric,
            test.value,
            test.comparison
          );
          testCount++;
        }
      }
    }

    taskCount++;
  }

  return { taskCount, stepCount, testCount };
});

const result = insertAll();
console.log(`Inserted ${result.taskCount} tasks, ${result.stepCount} steps, ${result.testCount} tests`);

// Verify
const summary = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM tasks) as tasks,
    (SELECT COUNT(*) FROM plan_iterations) as iterations,
    (SELECT COUNT(*) FROM plan_steps) as steps,
    (SELECT COUNT(*) FROM test_specs) as tests
`).get();
console.log('Database summary:', JSON.stringify(summary, null, 2));

db.close();
