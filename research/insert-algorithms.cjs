const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const insertAlgorithm = db.prepare(`
  INSERT INTO algorithms (problem_domain, current_algorithm, proposed_algorithm, time_complexity_current, time_complexity_proposed, space_complexity_current, space_complexity_proposed, description, tradeoffs, implementation_sketch)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const algorithms = [
  {
    problem_domain: "robot-pathfinding",
    current_algorithm: "Manhattan waypoint routing (hardcoded aisle logic)",
    proposed_algorithm: "A* with pathfinding crate on facility grid (Rust/WASM)",
    time_complexity_current: "O(1) - hardcoded waypoint selection, no search",
    time_complexity_proposed: "O(V log V) where V = grid cells, but V is small (~1000 for 100 courts)",
    space_complexity_current: "O(W) where W = waypoints in path (~3-5 per route)",
    space_complexity_proposed: "O(V) for open/closed sets during search",
    description: "The current Manhattan routing is actually O(1) since it hardcodes aisle-based waypoint selection without any graph search. This is fast but inflexible - it cannot handle dynamic obstacles, cannot find optimal paths around congestion, and cannot adapt to non-grid layouts. A* on a proper facility grid enables obstacle avoidance, dynamic re-routing around other robots, and optimal paths through any layout. For the typical facility size (<100 courts), A* completes in <100 microseconds in Rust. The real win is not speed of the pathfinding itself (current approach is already fast) but the FLEXIBILITY and the ability to batch all robot updates into a single WASM call, eliminating per-robot JS object allocations.",
    tradeoffs: "Current approach is simpler and actually faster for single queries (O(1) vs O(V log V)). A* adds value when: (1) dynamic obstacles exist, (2) multiple robots need collision-free paths, (3) facility layout is non-rectangular, (4) runtime re-routing is needed. For static Manhattan routing, the bigger win is porting moveAlongPath to Rust to eliminate per-frame JS object allocation.",
    implementation_sketch: `// Rust facility grid with A* pathfinding
use pathfinding::prelude::astar;

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct GridPos { x: i32, z: i32 }

impl GridPos {
    fn successors(&self, grid: &Grid) -> Vec<(GridPos, u32)> {
        let dirs = [(0,1),(0,-1),(1,0),(-1,0)];
        dirs.iter()
            .map(|(dx,dz)| GridPos { x: self.x+dx, z: self.z+dz })
            .filter(|p| grid.is_passable(p))
            .map(|p| { let cost = grid.cost(&p); (p, cost) })
            .collect()
    }
    fn manhattan(&self, other: &GridPos) -> u32 {
        ((self.x - other.x).abs() + (self.z - other.z).abs()) as u32
    }
}

fn find_path(grid: &Grid, start: GridPos, goal: GridPos) -> Option<Vec<GridPos>> {
    astar(&start, |p| p.successors(grid), |p| p.manhattan(&goal), |p| *p == goal)
        .map(|(path, _)| path)
}`
  },
  {
    problem_domain: "multi-robot-navigation",
    current_algorithm: "Independent per-robot Manhattan routing (no coordination)",
    proposed_algorithm: "Flow field pathfinding with distance map caching (Rust/WASM)",
    time_complexity_current: "O(R) where R = number of robots, each O(1) path generation",
    time_complexity_proposed: "O(V) one-time flow field generation per destination, then O(1) per robot per frame lookup",
    space_complexity_current: "O(R * W) where W = waypoints per path",
    space_complexity_proposed: "O(V) per cached flow field (grid_width * grid_height * 2 floats for direction vectors)",
    description: "Flow fields are the optimal algorithm when multiple agents navigate to common destinations - exactly the pickleball facility pattern where robots go to courts for cleaning and return to docks. Instead of computing paths individually, one Dijkstra/BFS pass from the destination produces a distance map. The gradient of this distance map is the flow field - a direction vector at each grid cell pointing toward the destination. Any robot at any position simply looks up its grid cell and follows the direction. For N robots going to the same destination, this is O(V + N) total vs O(N * V log V) for individual A*. Flow fields also naturally handle congestion because they represent ALL optimal paths, not just one.",
    tradeoffs: "Flow fields use more memory than individual paths (O(V) per destination vs O(W) per path). They produce grid-aligned movement that needs smoothing for natural-looking navigation. Grid resolution affects path quality - too coarse gives jerky movement, too fine wastes memory. For the facility scale (~50x50 grid = 5KB per flow field), memory is negligible. Best combined with local steering for final approach to exact positions.",
    implementation_sketch: `// Flow field generation in Rust
struct FlowField {
    directions: Vec<(f32, f32)>,  // normalized direction vectors
    width: u32,
    height: u32,
}

fn generate_flow_field(grid: &Grid, target: GridPos) -> FlowField {
    let size = (grid.width * grid.height) as usize;
    let mut dist = vec![f32::MAX; size];
    let mut queue = VecDeque::new();

    // BFS/Dijkstra from target
    dist[target.index(grid.width)] = 0.0;
    queue.push_back(target);
    while let Some(pos) = queue.pop_front() {
        for (neighbor, cost) in pos.successors(grid) {
            let new_dist = dist[pos.index(grid.width)] + cost as f32;
            if new_dist < dist[neighbor.index(grid.width)] {
                dist[neighbor.index(grid.width)] = new_dist;
                queue.push_back(neighbor);
            }
        }
    }

    // Compute gradient (direction toward lower distance)
    let mut directions = Vec::with_capacity(size);
    for z in 0..grid.height as i32 {
        for x in 0..grid.width as i32 {
            let dx = sample_dist(&dist, x-1, z, grid) - sample_dist(&dist, x+1, z, grid);
            let dz = sample_dist(&dist, x, z-1, grid) - sample_dist(&dist, x, z+1, grid);
            let len = (dx*dx + dz*dz).sqrt().max(0.001);
            directions.push((dx/len, dz/len));
        }
    }
    FlowField { directions, width: grid.width, height: grid.height }
}

// Per-robot per-frame: O(1) lookup
fn get_direction(field: &FlowField, world_x: f32, world_z: f32) -> (f32, f32) {
    let gx = world_to_grid_x(world_x);
    let gz = world_to_grid_z(world_z);
    field.directions[(gz * field.width + gx) as usize]
}`
  },
  {
    problem_domain: "robot-pathfinding",
    current_algorithm: "Per-robot moveAlongPath with JS object allocation",
    proposed_algorithm: "Batched robot movement in Rust/WASM with flat array I/O",
    time_complexity_current: "O(R * W) per frame where R = robots, W = remaining waypoints checked",
    time_complexity_proposed: "O(R) per frame - single WASM call processes all robots",
    space_complexity_current: "O(R * 4) new JS objects per frame (position spread, path clone, result object)",
    space_complexity_proposed: "O(R * 4) floats in pre-allocated Float32Array (zero allocation per frame)",
    description: "The current moveAlongPath in TypeScript creates multiple new objects per call per frame: spread operator for position ({...currentPos}), array spread for path ([...path]), remaining.shift() mutating a fresh array, and a new result object with position/remainingPath/rotation/completed. With 20 robots at 60fps, this is 1200 object allocations per second contributing to GC pressure. Porting to Rust/WASM with batched processing eliminates all per-frame allocations. Input: pre-allocated Float32Array of all robot positions + path data. Output: pre-allocated Float32Array of updated positions + rotations + completion flags. The math (distance, interpolation, atan2) is identical but runs without any heap allocation.",
    tradeoffs: "More complex interface (must manage path buffer indices and offsets). Harder to debug individual robot behavior. Requires coordinating path updates between JS game logic and WASM movement engine. However, the current TS moveAlongPath is the most frequently called pathfinding function (every frame per robot) so it has the highest optimization payoff.",
    implementation_sketch: `// Batched robot movement - single WASM call per frame
#[wasm_bindgen]
pub fn batch_move_robots(
    positions: &[f32],       // [x0,z0, x1,z1, ...] current positions
    path_data: &[f32],       // all path waypoints concatenated [px0,pz0, px1,pz1, ...]
    path_offsets: &[u32],    // start index in path_data for each robot
    path_lengths: &[u32],    // number of waypoints remaining for each robot
    speeds: &[f32],          // movement speed per robot
    dt: f32,                 // delta time
) -> Float32Array {
    let n = speeds.len();
    let mut result = Vec::with_capacity(n * 4);

    for i in 0..n {
        let mut px = positions[i * 2];
        let mut pz = positions[i * 2 + 1];
        let speed = speeds[i] * dt;
        let offset = path_offsets[i] as usize * 2;
        let len = path_lengths[i] as usize;
        let mut dist_left = speed;
        let mut rotation = 0.0f32;
        let mut wp_idx = 0;

        while dist_left > 0.0 && wp_idx < len {
            let tx = path_data[offset + wp_idx * 2];
            let tz = path_data[offset + wp_idx * 2 + 1];
            let dx = tx - px;
            let dz = tz - pz;
            let dist = (dx * dx + dz * dz).sqrt();
            rotation = dx.atan2(dz);

            if dist <= dist_left {
                px = tx;
                pz = tz;
                dist_left -= dist;
                wp_idx += 1;
            } else {
                let ratio = dist_left / dist;
                px += dx * ratio;
                pz += dz * ratio;
                dist_left = 0.0;
            }
        }

        result.push(px);
        result.push(pz);
        result.push(rotation);
        result.push(if wp_idx >= len { 1.0 } else { 0.0 });
    }

    Float32Array::from(&result[..])
}`
  },
  {
    problem_domain: "robot-pathfinding",
    current_algorithm: "Per-query lawnmower path generation",
    proposed_algorithm: "Pre-computed cleaning paths with compact storage in WASM memory",
    time_complexity_current: "O(S) where S = number of stripes per court half, computed each time cleaning starts",
    time_complexity_proposed: "O(1) lookup from pre-computed cache, O(S) one-time generation at facility init",
    space_complexity_current: "O(S * 2) floats per path, garbage collected after cleaning completes",
    space_complexity_proposed: "O(C * S * 2) floats permanently cached where C = number of courts",
    description: "The current getCleaningPath generates a fresh lawnmower pattern each time a robot is assigned to clean a court. Since court positions are fixed, these paths are deterministic and identical every time. Pre-computing all cleaning paths at facility initialization and storing them in WASM linear memory eliminates redundant generation. For 100 courts with ~60 waypoints each, total cache is 100 * 60 * 2 * 4 = 48KB - negligible. The cleaning path generation involves two phases (each court half) plus net avoidance routing, which while not computationally expensive individually, benefits from being pre-computed to eliminate all per-cleaning-start allocation.",
    tradeoffs: "Uses 48KB persistent memory for 100 courts (negligible). Paths must be regenerated if stripe_width or net_clearance parameters change. Pre-computation adds ~1ms to facility initialization. The real benefit is not speed (path generation is already fast) but eliminating the JS array allocations and enabling the batched WASM movement pattern.",
    implementation_sketch: `struct CleaningPathCache {
    paths: Vec<f32>,          // all waypoints concatenated
    offsets: Vec<u32>,        // start offset for each court's path
    lengths: Vec<u32>,        // number of waypoints for each court's path
}

impl CleaningPathCache {
    fn new(grid: &FacilityGrid) -> Self {
        let mut paths = Vec::new();
        let mut offsets = Vec::new();
        let mut lengths = Vec::new();

        for row in 0..grid.rows {
            for col in 0..grid.row_lengths[row] {
                offsets.push((paths.len() / 2) as u32);
                let center = grid.court_center(row, col);
                let court_path = generate_lawnmower_path(
                    center, grid.court_width, grid.court_length,
                    0.5,  // stripe_width
                    0.3,  // net_clearance
                );
                lengths.push(court_path.len() as u32);
                for (x, z) in &court_path {
                    paths.push(*x);
                    paths.push(*z);
                }
            }
        }
        CleaningPathCache { paths, offsets, lengths }
    }

    fn get_path(&self, court_index: usize) -> &[f32] {
        let start = self.offsets[court_index] as usize * 2;
        let len = self.lengths[court_index] as usize * 2;
        &self.paths[start..start + len]
    }
}`
  },
  {
    problem_domain: "robot-pathfinding",
    current_algorithm: "No grid-based search (Manhattan waypoint heuristic)",
    proposed_algorithm: "Jump Point Search on uniform-cost facility grid",
    time_complexity_current: "O(1) hardcoded waypoint logic",
    time_complexity_proposed: "O(V log V) but with 10-30x fewer nodes expanded than standard A* on grids",
    space_complexity_current: "O(1)",
    space_complexity_proposed: "O(V) but with much smaller constant factor than A*",
    description: "Jump Point Search (JPS) is an optimization of A* specifically for uniform-cost grids. It exploits grid symmetry to prune the search space, skipping over intermediate nodes that would be explored in standard A*. The grid_pathfinding Rust crate implements JPS with improved pruning rules. Key optimization: it pre-computes connected components to avoid flood-filling when no path exists, and records neighbors in u8 format for fast lookups. JPS is ideal when: (1) the grid has large open areas (facility aisles), (2) costs are uniform (all aisle cells equally traversable), (3) many path queries are expected. For non-uniform costs (e.g., preferring wider aisles), standard A* or Theta* is better.",
    tradeoffs: "JPS only works on uniform-cost grids - cannot express movement cost preferences. Produces grid-aligned paths that need post-processing smoothing for natural robot movement. The bevy_northstar crate offers Any-Angle HPA* and Theta* as alternatives that produce smoother paths on grids. For the facility use case where aisles are uniform-cost, JPS provides the best raw pathfinding performance.",
    implementation_sketch: `// Using grid_pathfinding crate for JPS
use grid_pathfinding::PathingGrid;

fn create_facility_grid(rows: u32, cols: u32, spacing: f32) -> PathingGrid {
    let grid_w = /* calculate grid dimensions from facility layout */;
    let grid_h = /* ... */;
    let mut grid = PathingGrid::new(grid_w, grid_h, false);

    // Mark aisle cells as passable
    for cell in aisle_cells {
        grid.set(cell.x, cell.z, true);
    }
    // Court interiors are obstacles by default (false)

    grid.generate_components(); // Pre-compute connected components
    grid
}

fn find_path_jps(grid: &PathingGrid, start: (usize,usize), goal: (usize,usize)) -> Option<Vec<(usize,usize)>> {
    grid.get_path_single_goal(start, goal, false)
    // Returns pruned path with jump points only - much shorter than full grid path
}`
  }
];

const insertAll = db.transaction(() => {
  for (const a of algorithms) {
    insertAlgorithm.run(
      a.problem_domain, a.current_algorithm, a.proposed_algorithm,
      a.time_complexity_current, a.time_complexity_proposed,
      a.space_complexity_current, a.space_complexity_proposed,
      a.description, a.tradeoffs, a.implementation_sketch
    );
  }
});

insertAll();
console.log(`Inserted ${algorithms.length} algorithms`);
db.close();
