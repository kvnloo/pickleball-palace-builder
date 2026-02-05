const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const insertAlgo = db.prepare(`INSERT INTO algorithms (problem_domain, current_algorithm, proposed_algorithm, time_complexity_current, time_complexity_proposed, description, tradeoffs, implementation_sketch) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

const insertTechnique = db.prepare(`INSERT INTO techniques (name, category, description, applicability_score, performance_gain_estimate, implementation_notes, browser_support, risks, dependencies, code_example) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

const insertFinding = db.prepare(`INSERT INTO findings (category, subcategory, title, description, impact_score, effort_score, priority, source_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

const insertPattern = db.prepare(`INSERT INTO code_patterns (pattern_name, anti_pattern, optimized_pattern, explanation, applicable_files, estimated_impact, code_before, code_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

const insertAll = db.transaction(() => {

  // ============================================================
  // ALGORITHM 1: Flow Field Pathfinding
  // ============================================================
  insertAlgo.run(
    'pathfinding',
    'Manhattan waypoint routing (per-robot)',
    'Flow Field Pathfinding',
    'O((rows+cols) * numRobots) for N robots',
    'O(gridCells) one-time, then O(1) per robot per frame',
    'Flow fields compute a vector field for the entire map pointing toward a destination. Once computed, ANY number of agents can query their direction in O(1). For a 100-court facility with 50+ robots, this is transformative: instead of computing 50 individual paths, compute 1 flow field per destination (dock, each court entrance). The facility grid is relatively small (maybe 500x300 cells at 0.5m resolution), so each flow field costs ~0.3ms to generate. With hierarchical decomposition into 50x50 tiles, only tiles on the path need flow fields. Key insight: since all robots return to the SAME dock, a single dock-return flow field serves ALL robots simultaneously.',
    'Memory: each flow field is gridWidth*gridHeight*2 bytes (direction vectors). For 500x300 grid = 300KB per field. With 100 courts + 1 dock = 101 fields = ~30MB total (acceptable but heavy). Flow fields produce slightly suboptimal paths vs direct routing. Requires grid discretization of continuous facility space. Pre-computation amortizes beautifully when multiple robots share destinations. However, the current facility has simple aisle topology where Manhattan routing is already near-optimal, making flow fields overkill for navigation. Best suited for the dock-return use case where many robots share the same destination.',
    `class FlowFieldManager {
  private fields: Map<string, Float32Array> = new Map();
  private gridW: number; private gridH: number;
  private cellSize = 0.5; // meters per cell

  generateField(targetX: number, targetZ: number): Float32Array {
    const field = new Float32Array(this.gridW * this.gridH * 2);
    const queue: number[] = [this.toIndex(targetX, targetZ)];
    const cost = new Uint16Array(this.gridW * this.gridH).fill(65535);
    cost[queue[0]] = 0;
    while (queue.length > 0) {
      const idx = queue.shift();
      for (const [nx, ny] of this.neighbors(idx)) {
        const ni = ny * this.gridW + nx;
        if (cost[ni] > cost[idx] + 1 && !this.isBlocked(nx, ny)) {
          cost[ni] = cost[idx] + 1;
          // Set direction vector pointing toward lower cost
          field[ni * 2] = Math.sign(idx % this.gridW - nx);
          field[ni * 2 + 1] = Math.sign(Math.floor(idx / this.gridW) - ny);
          queue.push(ni);
        }
      }
    }
    return field;
  }

  getDirection(fieldKey: string, x: number, z: number): {dx: number, dz: number} {
    const field = this.fields.get(fieldKey);
    const idx = this.toIndex(x, z);
    return { dx: field[idx * 2], dz: field[idx * 2 + 1] };
  }
}`
  );

  // ============================================================
  // ALGORITHM 2: Pre-computed Path Cache
  // ============================================================
  insertAlgo.run(
    'pathfinding',
    'Manhattan waypoint routing (computed on demand)',
    'Pre-computed Path Cache with LRU eviction',
    'O(rows+cols) per path request (repeated for same routes)',
    'O(1) amortized for cached paths, O(rows+cols) on cache miss',
    'The facility layout is static - courts never move. All paths between dock and court entrances are deterministic given (dockPos, courtRow, courtCol). Pre-compute and cache ALL dock-to-court and court-to-dock paths at facility initialization. For a 100-court facility, this is only 200 paths to cache (100 to-court + 100 from-court). Each path is ~5-10 waypoints = tiny memory. CRITICAL FINDING: getCleaningPath() is called every frame per cleaning robot (line 166-169 in useRobotController.ts) just to compute totalLength for progress. This should be cached once when cleaning begins. This single cache would eliminate ~3000 path regenerations/second with 50 robots.',
    'Near-zero memory cost (200 paths * 10 waypoints * 16 bytes = 32KB). Must invalidate cache if facility layout changes (rare - only on user reconfiguration). Cleaning paths are deterministic per court so can also be pre-computed. The biggest win is caching totalLength for cleaning progress calculation which currently regenerates entire paths every frame.',
    `class CachedPathfinder extends FacilityPathfinder {
  private toCourtCache = new Map<string, Point[]>();
  private toDockCache = new Map<string, Point[]>();
  private cleaningPathCache = new Map<string, Point[]>();
  private cleaningLengthCache = new Map<string, number>();

  precomputeAllPaths(dockPosition: Point): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.rowLengths[row]; col++) {
        const key = row + ',' + col;
        // Cache to-court path from dock
        this.toCourtCache.set(key, this.getPathToCourtEntrance(dockPosition, row, col));
        // Cache cleaning path and its total length
        const cp = this.getCleaningPath(row, col);
        this.cleaningPathCache.set(key, cp);
        this.cleaningLengthCache.set(key, pathLength(cp));
        // Cache return-to-dock path from court entrance
        const courtCenter = this.getCourtCenter(row, col);
        this.toDockCache.set(key, this.getPathToDock(courtCenter, dockPosition));
      }
    }
  }

  getCachedCleaningLength(row: number, col: number): number {
    return this.cleaningLengthCache.get(row + ',' + col) || 0;
  }
}`
  );

  // ============================================================
  // ALGORITHM 3: HPA* Hierarchical Pathfinding
  // ============================================================
  insertAlgo.run(
    'pathfinding',
    'Manhattan waypoint routing',
    'Hierarchical Pathfinding A* (HPA*)',
    'O(rows+cols) per path',
    'O(clusters_on_path * local_search) with pre-computed inter-cluster costs',
    'HPA* partitions the map into clusters, pre-computes optimal local paths between cluster entrance points, then plans abstract paths through the cluster graph at runtime. For a 100-court facility, natural clusters are court groups (e.g., 4x4 court sections). The abstract graph has ~25 cluster nodes with pre-computed aisle connections. However, for THIS specific facility, HPA* is OVERKILL. The current Manhattan routing already exploits the aisle structure which is essentially a hierarchical decomposition (main aisle -> row aisles -> court entrances). HPA* shines on large maps with complex obstacle patterns, but the pickleball facility has a regular grid topology that the current approach handles efficiently. HPA* would add 1-3ms path refinement overhead per query with negligible benefit.',
    'Adds implementation complexity (cluster management, abstract graph, path refinement). Pre-computation needed when layout changes. Up to 10x faster than A* on large maps with obstacles, but NOT faster than the current Manhattan routing for this regular-grid topology. Path quality within 1% of optimal. Worth considering only if facility layouts become irregular/complex.',
    `// HPA* sketch - NOT recommended for current regular grid facility
class HPAPathfinder {
  private clusters: Cluster[];
  private abstractGraph: Graph;

  preprocess(): void {
    // Divide facility into clusters (e.g., 4x4 court groups)
    this.clusters = this.partitionMap(4, 4);
    // Find entrance points between adjacent clusters (aisles)
    for (const cluster of this.clusters) {
      cluster.entrances = this.findEntrances(cluster);
    }
    // Pre-compute paths between entrances within each cluster
    for (const cluster of this.clusters) {
      cluster.intraEdges = this.computeIntraPaths(cluster);
    }
    // Build abstract graph from inter-cluster connections
    this.abstractGraph = this.buildAbstractGraph();
  }

  findPath(start: Point, goal: Point): Point[] {
    const startCluster = this.getCluster(start);
    const goalCluster = this.getCluster(goal);
    // Search abstract graph
    const abstractPath = aStar(this.abstractGraph, startCluster, goalCluster);
    // Refine: concatenate local paths through each cluster
    return this.refinePath(abstractPath, start, goal);
  }
}`
  );

  // ============================================================
  // ALGORITHM 4: Theta* Any-Angle Pathfinding
  // ============================================================
  insertAlgo.run(
    'pathfinding',
    'Manhattan waypoint routing (axis-aligned only)',
    'Theta* Any-Angle Pathfinding',
    'O(rows+cols) per path (axis-aligned segments)',
    'O(n log n) where n = grid nodes expanded, but paths are shorter',
    'Theta* extends A* to find any-angle paths on grids by checking line-of-sight between non-adjacent nodes. This produces shorter, more natural-looking paths that cut diagonally through open space rather than following grid edges. For robots navigating through facility aisles, Theta* would allow diagonal shortcuts through open areas between courts. Typical path length reduction is 8-13% vs grid-constrained paths. For the pickleball facility, the main benefit would be smoother robot movement appearance, as diagonal paths through aisle intersections look more natural than right-angle turns.',
    'Theta* is slower than A* per node expansion (line-of-sight checks). Paths are shorter but computation is heavier. The current Manhattan routing is already fast because it generates only 3-5 waypoints total. Theta* would need a grid representation and expand many more nodes to get slightly shorter paths. Best used as a post-processing smoothing step on the existing Manhattan paths rather than replacing the pathfinder entirely. Line-of-sight checks cost O(max(dx,dz)) per check.',
    `// Theta* - line-of-sight based path optimization
// Best used as post-processing on existing Manhattan paths
function thetaSmooth(path: Point[], isWalkable: (a: Point, b: Point) => boolean): Point[] {
  if (path.length <= 2) return path;
  const smoothed: Point[] = [path[0]];
  let current = 0;
  while (current < path.length - 1) {
    // Try to skip ahead as far as line-of-sight allows
    let farthest = current + 1;
    for (let i = path.length - 1; i > current + 1; i--) {
      if (isWalkable(path[current], path[i])) {
        farthest = i;
        break;
      }
    }
    smoothed.push(path[farthest]);
    current = farthest;
  }
  return smoothed;
}

// Line-of-sight check for facility (no court obstacles between points)
function hasLineOfSight(a: Point, b: Point, courts: CourtBounds[]): boolean {
  // Bresenham or DDA ray march checking for court intersections
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.z - a.z)) / 0.5;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    if (courts.some(c => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ)) return false;
  }
  return true;
}`
  );

  // ============================================================
  // ALGORITHM 5: Navigation Mesh
  // ============================================================
  insertAlgo.run(
    'pathfinding',
    'Manhattan waypoint routing on implicit grid',
    'Navigation Mesh (NavMesh) with Funnel Algorithm',
    'O(rows+cols) per path, axis-aligned only',
    'O(n log n) where n = navmesh polygons (much fewer than grid cells)',
    'NavMeshes represent walkable areas as convex polygons rather than grid cells. For the pickleball facility, the walkable area (aisles between courts) can be represented as a small number of rectangles (~200 for 100 courts). Pathfinding on navmesh is 5x-150x faster than grid A* because there are far fewer nodes. The funnel/string-pulling algorithm produces optimal shortest paths through the mesh. Three.js has mature navmesh libraries: three-pathfinding and recast-navigation-js (WASM port of industry-standard Recast/Detour). However, for THIS facility, the current Manhattan routing is effectively already a navmesh-like approach using the aisle structure as implicit navigation corridors.',
    'NavMesh requires mesh generation (Blender, Recast CLI, or runtime via recast-navigation-js). For a regular grid of courts, the navmesh is trivially computable. recast-navigation-js adds ~500KB WASM bundle. NavMesh excels for complex irregular layouts but is overkill for regular court grids. The funnel algorithm adds path smoothing for free. Dynamic obstacle support via TileCache API. CPU bottleneck with many agents noted in Three.js forum - navmesh pathfinding still costs per-agent.',
    `// NavMesh approach using recast-navigation-js
import { init as initRecast } from "recast-navigation";
import { threeToSoloNavMesh } from "@recast-navigation/three";

// Generate navmesh from facility geometry
async function createFacilityNavMesh(facilityMeshes: THREE.Mesh[]) {
  await initRecast();
  const { success, navMesh } = threeToSoloNavMesh(facilityMeshes, {
    cs: 0.2,      // cell size (meters)
    ch: 0.1,      // cell height
    walkableRadius: 0.3, // robot radius
    walkableHeight: 0.7, // robot height
    walkableClimb: 0.05,
  });

  // Query path
  const { path } = navMesh.computePath(
    { x: startX, y: 0, z: startZ },
    { x: endX, y: 0, z: endZ }
  );
  return path; // Already smoothed via funnel algorithm
}

// For crowd simulation with 50+ robots:
import { Crowd } from "recast-navigation";
const crowd = new Crowd(navMesh, { maxAgents: 100, maxAgentRadius: 0.4 });
// Crowd handles collision avoidance between agents automatically`
  );

  // ============================================================
  // ALGORITHM 6: Multi-Agent Coordination (MAPF)
  // ============================================================
  insertAlgo.run(
    'pathfinding',
    'Independent per-robot Manhattan routing (no coordination)',
    'Cooperative A* with Reservation Table (Windowed)',
    'O((rows+cols) * numRobots) independent paths, collision possible',
    'O((rows+cols) * timeWindow * numRobots) with guaranteed collision-free',
    'Multi-Agent Path Finding (MAPF) ensures collision-free paths for all robots simultaneously. The simplest effective approach for 50 robots is Cooperative A* (CA*) with a space-time reservation table. Each robot plans A* considering time dimension - cells occupied by previously-planned robots at specific timesteps are blocked. For the pickleball facility, a simpler approach works: aisle-based traffic rules. Since aisles are the only corridors, assign traffic direction (e.g., main aisle is bidirectional with lanes, row aisles are one-way based on robot proximity). Priority-based: robots with lower battery or active cleaning jobs get priority.',
    'Full MAPF (e.g., Conflict-Based Search CBS) is NP-hard and overkill for 50 robots in wide aisles. Windowed Cooperative A* limits planning horizon to ~30 timesteps for tractability. Simpler alternatives: (1) Aisle traffic lanes with priority yielding, (2) Local collision avoidance via velocity obstacles (ORCA), (3) Recast Detour Crowd which handles collision avoidance automatically. The facility has wide aisles (spacing parameter), so simple local avoidance suffices. Robots moving at 1-2 m/s in 2m+ wide aisles rarely collide.',
    `// Lightweight multi-agent coordination for facility robots
class RobotCoordinator {
  private reservations = new Map<string, string>(); // cellKey -> robotId

  // Reserve cells along a robot path for next N seconds
  reservePath(robotId: string, path: Point[], speed: number): void {
    let t = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const dist = distance(path[i], path[i + 1]);
      const travelTime = dist / speed;
      const cellKey = this.toCellKey(path[i].x, path[i].z, Math.floor(t));
      this.reservations.set(cellKey, robotId);
      t += travelTime;
    }
  }

  // Check if path segment is clear
  isSegmentClear(robotId: string, from: Point, to: Point, atTime: number): boolean {
    const key = this.toCellKey(to.x, to.z, Math.floor(atTime));
    const occupant = this.reservations.get(key);
    return !occupant || occupant === robotId;
  }

  // Simple ORCA-style local avoidance
  avoidCollision(robot: Robot, nearbyRobots: Robot[]): {dx: number, dz: number} {
    let avoidX = 0, avoidZ = 0;
    for (const other of nearbyRobots) {
      const dx = robot.position.x - other.position.x;
      const dz = robot.position.z - other.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.5) { // avoidance radius
        const force = (1.5 - dist) / 1.5;
        avoidX += (dx / dist) * force;
        avoidZ += (dz / dist) * force;
      }
    }
    return { dx: avoidX, dz: avoidZ };
  }
}`
  );

  // ============================================================
  // TECHNIQUE 1: Path Index Tracking (Zero-Alloc Path Following)
  // ============================================================
  insertTechnique.run(
    'Zero-Allocation Path Following',
    'pathfinding',
    'Replace array spread/shift in moveAlongPath with an index-based approach. Current code creates new arrays and objects every frame via [...path] and { ...currentPos }. Instead, track a pathIndex integer and mutate a pre-allocated position object. This eliminates all GC pressure from the hot path following loop.',
    9.5,
    '100% elimination of path-following GC allocations, est. 3-5ms/frame saved with 50 robots',
    'Change moveAlongPath signature to accept a mutable state object with pathIndex. Return void and mutate in place. The caller (useRobotController) already uses a ref-based state map that persists across frames. Add pathIndex to RobotControllerState. Pre-allocate a reusable Point object for position output.',
    'All browsers (pure JS optimization)',
    'Mutation-based API is less functional/pure but necessary for hot paths. Must be careful not to alias references.',
    'None',
    `// BEFORE: Allocates new arrays and objects every frame
function moveAlongPath(currentPos, path, dist) {
  let pos = { ...currentPos };      // ALLOC
  let remaining = [...path];         // ALLOC (50+ elements)
  // ... shift() is O(n) ...
  remaining.shift();                 // SLOW
  return { position: pos, remainingPath: remaining, ... }; // ALLOC
}

// AFTER: Zero-allocation path following
interface PathState {
  posX: number; posZ: number;
  pathIndex: number;
  rotation: number;
  completed: boolean;
}

function moveAlongPathZeroAlloc(
  state: PathState,
  path: readonly Point[],
  distanceToMove: number
): void {
  if (state.pathIndex >= path.length) { state.completed = true; return; }
  let distLeft = distanceToMove;
  while (distLeft > 0 && state.pathIndex < path.length) {
    const target = path[state.pathIndex];
    const dx = target.x - state.posX;
    const dz = target.z - state.posZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    state.rotation = Math.atan2(dx, dz);
    if (dist <= distLeft) {
      state.posX = target.x;
      state.posZ = target.z;
      state.pathIndex++;
      distLeft -= dist;
    } else {
      const ratio = distLeft / dist;
      state.posX += dx * ratio;
      state.posZ += dz * ratio;
      distLeft = 0;
    }
  }
  state.completed = state.pathIndex >= path.length;
}`
  );

  // ============================================================
  // TECHNIQUE 2: Cleaning Path Length Cache
  // ============================================================
  insertTechnique.run(
    'Cleaning Path Total Length Cache',
    'pathfinding',
    'Cache the total cleaning path length when a robot starts cleaning, instead of regenerating the entire cleaning path every frame to calculate progress. Lines 166-169 in useRobotController.ts call getCleaningPath() + pathLength() every frame per cleaning robot. This generates 50+ waypoints and sums distances EVERY FRAME just to get a denominator for progress calculation.',
    10,
    'Eliminates ~3000 path regenerations/second with 50 robots cleaning. Est. 2-4ms/frame saved.',
    'When robot transitions to cleaning state, compute totalLength once and store in RobotControllerState. On each frame, only call pathLength(remainingPath) which is cheap for shrinking paths. Even better: track distance-cleaned as accumulator instead of recomputing remaining length.',
    'All browsers (pure JS optimization)',
    'None - strictly an improvement with no downsides.',
    'None',
    `// BEFORE (every frame during cleaning):
const totalLength = pathLength(
  pathfinder.current.getCleaningPath(    // Regenerates 50+ waypoints
    parseCourtId(robot.targetCourtId).row,
    parseCourtId(robot.targetCourtId).col
  )
);
const remainingLength = pathLength(result.remainingPath);
const progress = ((totalLength - remainingLength) / totalLength) * 100;

// AFTER (cache at cleaning start):
// In the navigating->cleaning transition:
const cleaningPath = pathfinder.current.getCleaningPath(row, col);
const totalCleaningLength = pathLength(cleaningPath);  // Compute ONCE
robotStates.current.set(robot.id, {
  ...state,
  cleaningPath,
  totalCleaningLength,  // NEW: cached
  distanceCleaned: 0,   // NEW: accumulator
});

// In cleaning update (every frame):
const moveDistance = robotSettings.cleaningSpeed * adjustedDelta;
state.distanceCleaned += moveDistance;
const progress = (state.distanceCleaned / state.totalCleaningLength) * 100;`
  );

  // ============================================================
  // TECHNIQUE 3: Throttled Job Assignment
  // ============================================================
  insertTechnique.run(
    'Throttled Job Assignment',
    'pathfinding',
    'assignJobs() currently runs every frame in useFrame. It iterates all robots and the cleaning queue to find idle robots and unassigned jobs. This is O(robots * queue) per frame. Throttle to run only when: (a) a robot status changes to idle, (b) a new cleaning job is enqueued, or (c) every 500ms as a fallback. Use a dirty flag triggered by state changes.',
    8.5,
    'Reduce assignJobs from 60 calls/sec to ~2-5 calls/sec. Est. 1-2ms/frame saved with large queues.',
    'Add a lastAssignTime ref. Only call assignJobs if Date.now() - lastAssignTime > 500 or a dirtyFlag is set. Set dirtyFlag when robot enters idle state or when cleaningQueue changes. This is a minimal code change with significant impact.',
    'All browsers',
    'Slight delay (up to 500ms) before idle robots pick up new jobs. Imperceptible to users.',
    'None',
    `// BEFORE:
useFrame((_, delta) => {
  // ... robot updates ...
  assignJobs(); // Called EVERY FRAME
});

// AFTER:
const lastAssignTime = useRef(0);
const assignDirty = useRef(true);

useFrame((_, delta) => {
  const now = performance.now();
  // ... robot updates ...
  // Only assign when dirty or every 500ms
  if (assignDirty.current || now - lastAssignTime.current > 500) {
    assignJobs();
    lastAssignTime.current = now;
    assignDirty.current = false;
  }
});

// Set dirty when relevant state changes:
// In robot status update: if (newStatus === 'idle') assignDirty.current = true;
// In queue update: assignDirty.current = true;`
  );

  // ============================================================
  // TECHNIQUE 4: Catmull-Rom Path Smoothing
  // ============================================================
  insertTechnique.run(
    'Catmull-Rom Path Smoothing',
    'pathfinding',
    'Apply Catmull-Rom spline interpolation to robot navigation paths to create smooth, natural-looking movement instead of sharp right-angle turns. The current Manhattan routing creates paths with 90-degree turns at aisle intersections. Catmull-Rom splines pass through all control points while creating smooth curves between them. Three variants: uniform (equal spacing), centripetal (prevents cusps), chordal (proportional to chord length). Centripetal is best for game paths. A tension parameter controls tightness (0 = smooth curves, 1 = straight lines).',
    6.0,
    'Visual improvement only - smoother robot movement. No FPS impact if applied at path generation time.',
    'Apply as post-processing on generated Manhattan paths. Sample the spline at regular intervals (e.g., every 0.5m) to create a denser smooth path. Only apply to navigation paths (not cleaning paths which should remain as precise lawnmower stripes). Ensure smoothed path does not cut through courts by validating waypoints against court bounds.',
    'All browsers',
    'Smoothed paths may slightly enter court areas near corners. Need collision validation. Denser paths (more waypoints) increase moveAlongPath iteration count slightly.',
    'None',
    `function catmullRomSmooth(path: Point[], tension: number = 0.5, samples: number = 5): Point[] {
  if (path.length < 3) return path;
  const result: Point[] = [path[0]];
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[i];
    const p2 = path[Math.min(path.length - 1, i + 1)];
    const p3 = path[Math.min(path.length - 1, i + 2)];
    for (let t = 1; t <= samples; t++) {
      const s = t / samples;
      const s2 = s * s, s3 = s2 * s;
      const f = tension;
      result.push({
        x: f * ((-s3 + 2*s2 - s) * p0.x + (3*s3 - 5*s2 + 2) * p1.x +
            (-3*s3 + 4*s2 + s) * p2.x + (s3 - s2) * p3.x) / 2,
        z: f * ((-s3 + 2*s2 - s) * p0.z + (3*s3 - 5*s2 + 2) * p1.z +
            (-3*s3 + 4*s2 + s) * p2.z + (s3 - s2) * p3.z) / 2,
      });
    }
  }
  return result;
}`
  );

  // ============================================================
  // TECHNIQUE 5: Coroutine-Based Path Computation
  // ============================================================
  insertTechnique.run(
    'Generator-Based Chunked Pathfinding',
    'pathfinding',
    'Use ES6 generators as coroutines to spread expensive path computations across multiple frames. When 50 robots need paths simultaneously (e.g., after facility reset), computing all paths in one frame causes a spike. Instead, use a generator that yields after each path computation, spreading the work across frames. The js-coroutines library provides a ready-made framework, but a simple generator + requestAnimationFrame works too. Also applies to cleaning path generation which creates 50+ waypoints per court.',
    5.0,
    'Eliminates path computation spikes (e.g., 5ms spike when 10 robots dispatched simultaneously -> spread to 0.5ms/frame over 10 frames)',
    'Create a PathComputationQueue that accepts path requests and processes N per frame. Use generator functions that yield between path computations. Priority queue: urgent paths (robot about to collide) computed immediately, routine paths (new job assignment) spread over frames. For this facility the individual path computations are cheap (<0.01ms each), so this is mainly needed for batch scenarios.',
    'All browsers (ES6 generators)',
    'Adds latency to path delivery (path available next frame instead of immediately). For slow-moving cleaning robots this is imperceptible. Must handle case where robot needs path before generator completes.',
    'None (or js-coroutines npm package for advanced scheduling)',
    `class PathComputationQueue {
  private pending: Array<{resolve: (p: Point[]) => void, compute: () => Point[]}> = [];
  private maxPerFrame = 5;

  requestPath(compute: () => Point[]): Promise<Point[]> {
    return new Promise(resolve => {
      this.pending.push({ resolve, compute });
    });
  }

  // Call each frame from useFrame
  processFrame(): void {
    const batch = this.pending.splice(0, this.maxPerFrame);
    for (const req of batch) {
      req.resolve(req.compute());
    }
  }
}

// Generator-based alternative:
function* computePathsBatched(requests: PathRequest[]): Generator<void, Point[][], void> {
  const results: Point[][] = [];
  for (const req of requests) {
    results.push(pathfinder.getPathToCourtEntrance(req.from, req.row, req.col));
    yield; // Resume next frame
  }
  return results;
}`
  );

  // ============================================================
  // TECHNIQUE 6: Spatial Hashing for Robot Proximity
  // ============================================================
  insertTechnique.run(
    'Spatial Hash Grid for Robot Proximity Queries',
    'pathfinding',
    'For multi-agent collision avoidance, robots need to know about nearby robots. Naive approach is O(n^2) pairwise distance checks. A spatial hash grid divides the facility into cells (e.g., 2m x 2m) and only checks robots in the same or adjacent cells. For 50 robots in a 100-court facility, most cells will have 0-1 robots, making proximity queries O(1) amortized.',
    7.0,
    'Reduces robot proximity checks from O(n^2)=2500 to O(n*k) where k~2 avg neighbors = 100 checks',
    'Create a flat array grid covering the facility. Each frame, clear and re-insert all robot positions (O(n)). For collision avoidance, query 3x3 cells around each robot (O(9) per robot). Cell size should match avoidance radius (~2m). Pre-allocate cell arrays to avoid GC.',
    'All browsers',
    'Cell size must match expected robot density. Too small = many empty cells, too large = too many robots per cell. For 50 robots across 100 courts, 2m cells work well.',
    'None',
    `class RobotSpatialHash {
  private cellSize = 2.0; // meters
  private gridW: number;
  private gridH: number;
  private cells: Uint16Array; // Flat array: [count, id0, id1, ...] per cell
  private maxPerCell = 4;

  constructor(worldW: number, worldH: number) {
    this.gridW = Math.ceil(worldW / this.cellSize);
    this.gridH = Math.ceil(worldH / this.cellSize);
    this.cells = new Uint16Array(this.gridW * this.gridH * (this.maxPerCell + 1));
  }

  clear(): void { this.cells.fill(0); }

  insert(robotIdx: number, x: number, z: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const base = (cz * this.gridW + cx) * (this.maxPerCell + 1);
    const count = this.cells[base];
    if (count < this.maxPerCell) {
      this.cells[base + 1 + count] = robotIdx;
      this.cells[base] = count + 1;
    }
  }

  getNearby(x: number, z: number): number[] {
    const results: number[] = [];
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nx >= this.gridW || nz < 0 || nz >= this.gridH) continue;
        const base = (nz * this.gridW + nx) * (this.maxPerCell + 1);
        const count = this.cells[base];
        for (let i = 0; i < count; i++) results.push(this.cells[base + 1 + i]);
      }
    }
    return results;
  }
}`
  );

  // ============================================================
  // FINDINGS
  // ============================================================

  // Finding 1: Critical per-frame path regeneration
  insertFinding.run(
    'pathfinding', 'per-frame-waste',
    'Critical: Cleaning Path Regenerated Every Frame for Progress Calculation',
    'In useRobotController.ts lines 166-169, getCleaningPath() is called every frame for each cleaning robot solely to compute totalLength for progress percentage. This regenerates 50+ waypoints and iterates them for distance calculation. With 50 robots cleaning, this is ~3000 unnecessary path generations per second. The totalLength is constant for a given court and should be computed once when cleaning begins.',
    10, 1, 'P0', 'agent-10-pathfinding'
  );

  // Finding 2: assignJobs per-frame overhead
  insertFinding.run(
    'pathfinding', 'per-frame-waste',
    'assignJobs() Called Every Frame Regardless of State Changes',
    'In useRobotController.ts line 237, assignJobs() runs inside useFrame on every frame. It iterates all robots checking for idle status and iterates the cleaning queue for unassigned jobs. This is O(robots * queue) per frame even when no state changes have occurred. Should be throttled to run only on state changes or at fixed intervals.',
    7, 1, 'P1', 'agent-10-pathfinding'
  );

  // Finding 3: moveAlongPath GC pressure
  insertFinding.run(
    'pathfinding', 'gc-pressure',
    'moveAlongPath Creates Garbage Every Frame via Spread Operators',
    'moveAlongPath (pathfinding.ts lines 196-239) uses let pos = { ...currentPos } and let remaining = [...path] creating new objects/arrays every frame per robot. Also uses remaining.shift() which is O(n). With 50 robots, this creates 100+ garbage objects per frame. Should use index-based tracking and pre-allocated mutable state objects instead.',
    8, 2, 'P0', 'agent-10-pathfinding'
  );

  // Finding 4: Flow fields for dock return
  insertFinding.run(
    'pathfinding', 'algorithm',
    'Flow Field for Shared Dock Destination Eliminates Per-Robot Path Computation',
    'All robots share the same dock as return destination. A single pre-computed flow field for the dock position allows ALL robots to navigate to dock with O(1) per-robot per-frame cost (just look up direction vector at current cell). Current approach computes individual dock-return paths per robot. For 50 robots returning simultaneously, flow field is optimal. Facility grid is small (~500x300 cells at 0.5m) so flow field generation is <1ms.',
    6.5, 5, 'P2', 'agent-10-pathfinding'
  );

  // Finding 5: Pre-computed path cache
  insertFinding.run(
    'pathfinding', 'caching',
    'Static Facility Layout Enables Complete Path Pre-computation',
    'The facility layout (court positions, aisles) is static. All possible dock-to-court paths, cleaning paths, and return paths are deterministic. For 100 courts this is only 200 navigation paths + 100 cleaning paths = 300 total paths to pre-compute. Total cache size ~48KB. Eliminates all runtime path computation. Only needs invalidation when user reconfigures facility layout, which is rare.',
    8, 2, 'P1', 'agent-10-pathfinding'
  );

  // Finding 6: NavMesh + Detour Crowd for scalable solution
  insertFinding.run(
    'pathfinding', 'architecture',
    'recast-navigation-js Provides Production-Grade NavMesh + Crowd for Three.js',
    'recast-navigation-js is a WASM port of the industry-standard Recast/Detour navigation toolkit with Three.js integration (@recast-navigation/three). It provides: (1) Runtime or offline navmesh generation from 3D geometry, (2) Efficient pathfinding with funnel algorithm smoothing, (3) Crowd simulation with automatic collision avoidance for 100+ agents, (4) TileCache for dynamic obstacles. This is the gold standard for Three.js games with many agents. However, it adds ~500KB WASM bundle and is significantly more complex than the current simple Manhattan approach.',
    7, 7, 'P2', 'agent-10-pathfinding'
  );

  // Finding 7: Optimal architecture for 50+ robots
  insertFinding.run(
    'pathfinding', 'architecture',
    'Recommended: Layered Pathfinding Architecture for 50+ Robots',
    'The optimal architecture for 50+ robots in a 100-court facility is a 3-layer approach: (1) IMMEDIATE WINS (P0): Cache cleaning path totalLength, zero-alloc moveAlongPath with index tracking, throttle assignJobs - these 3 changes alone save ~10ms/frame. (2) SHORT-TERM (P1): Pre-compute all 300 paths at facility init, store in typed arrays. Spatial hash for O(1) proximity queries. (3) LONG-TERM (P2): If robot count exceeds 100 or facility becomes irregular, adopt recast-navigation-js with Detour Crowd for production-grade multi-agent navigation with automatic collision avoidance. The current Manhattan routing is already excellent for the regular grid topology - the major wins are in eliminating per-frame waste, not replacing the algorithm.',
    9.5, 3, 'P0', 'agent-10-pathfinding'
  );

  // ============================================================
  // CODE PATTERNS
  // ============================================================

  insertPattern.run(
    'Path Index Tracking vs Array Spread',
    'let remaining = [...path]; remaining.shift(); // O(n) copy + O(n) shift',
    'state.pathIndex++; // O(1) index advance on pre-existing path array',
    'Array spread copies all elements. Array.shift() must move all elements left. Both are O(n) where n = path length. An index variable is O(1) for both operations and creates zero garbage. Critical for hot path called 50+ times per frame.',
    '["src/lib/pathfinding.ts","src/hooks/useRobotController.ts"]',
    'Eliminates ~100 array allocations per frame with 50 robots. Est. 2-3ms/frame GC savings.',
    `function moveAlongPath(currentPos: Point, path: Point[], dist: number) {
  let pos = { ...currentPos };  // NEW OBJECT every frame
  let remaining = [...path];    // COPY entire array every frame
  while (distLeft > 0 && remaining.length > 0) {
    remaining.shift();          // O(n) shift
  }
  return { position: pos, remainingPath: remaining, ... };
}`,
    `function moveAlongPathFast(state: PathState, path: readonly Point[], dist: number): void {
  let distLeft = dist;
  while (distLeft > 0 && state.pathIndex < path.length) {
    const target = path[state.pathIndex];
    const dx = target.x - state.posX;
    const dz = target.z - state.posZ;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= distLeft) {
      state.posX = target.x; state.posZ = target.z;
      state.pathIndex++;       // O(1) advance
      distLeft -= d;
    } else {
      const r = distLeft / d;
      state.posX += dx * r; state.posZ += dz * r;
      distLeft = 0;
    }
  }
  state.completed = state.pathIndex >= path.length;
}`
  );

  insertPattern.run(
    'Cached Constant vs Per-Frame Recomputation',
    'const totalLength = pathLength(pathfinder.getCleaningPath(row, col)); // EVERY FRAME',
    'const progress = state.distanceCleaned / state.totalCleaningLength; // Cached at start',
    'When a value is constant for the duration of an operation, compute it once and cache. The cleaning path total length never changes during cleaning - it is determined solely by the court dimensions. Computing it once at cleaning start and storing it in robot state eliminates thousands of wasted computations per second.',
    '["src/hooks/useRobotController.ts"]',
    'Eliminates ~3000 path regenerations/sec with 50 cleaning robots. Est. 2-4ms/frame saved.',
    `// Every frame during cleaning state:
const totalLength = pathLength(
  pathfinder.current!.getCleaningPath(
    parseCourtId(robot.targetCourtId!).row,    // parseCourtId called twice
    parseCourtId(robot.targetCourtId!).col     // parseCourtId called twice
  )
);
const remainingLength = pathLength(result.remainingPath);
const progress = ((totalLength - remainingLength) / totalLength) * 100;`,
    `// At cleaning start (navigating -> cleaning transition):
const cleaningPath = pathfinder.current!.getCleaningPath(row, col);
robotStates.current.set(robot.id, {
  cleaningPath,
  totalCleaningLength: pathLength(cleaningPath),  // Computed ONCE
  distanceCleaned: 0,
});

// Each frame during cleaning:
const moveDistance = robotSettings.cleaningSpeed * adjustedDelta;
state.distanceCleaned += moveDistance;
const progress = Math.min(100, (state.distanceCleaned / state.totalCleaningLength) * 100);`
  );
});

insertAll();

console.log('All pathfinding research data inserted successfully');
db.close();
