const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const insertTechnique = db.prepare(`
  INSERT INTO techniques (name, category, description, applicability_score, performance_gain_estimate, implementation_notes, browser_support, risks, dependencies, code_example)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const techniques = [
  {
    name: "Rust A* via pathfinding crate in WASM",
    category: "wasm-pathfinding",
    description: "Use the Rust pathfinding crate (v4.14.0) astar() function compiled to WASM for facility robot navigation. The crate provides generic A* with BinaryHeap-based open set, returns Option<(Vec<N>, C)>. Define FacilityGrid as flat u8 array, implement successors() returning neighbor cells with costs. Manhattan heuristic matches current TS implementation. Compile with wasm-pack --target web, return paths as Float32Array via wasm-bindgen automatic Vec<f32> conversion.",
    applicability_score: 8.5,
    performance_gain_estimate: "3-10x speedup for single pathfinding query, eliminates per-frame GC from path object allocation",
    implementation_notes: "Cargo.toml deps: pathfinding = 4.14.0, wasm-bindgen = 0.2. Define #[wasm_bindgen] struct FacilityGrid with flat u8 grid, court positions, spacing. Implement find_path() using pathfinding::directed::astar::astar. Return interleaved f32 coords. For moveAlongPath, pure math in Rust avoids JS object spread/shift overhead.",
    browser_support: "All modern browsers with WASM support (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)",
    risks: "Added build complexity (Rust toolchain + wasm-pack), debugging WASM is harder than JS, wasm-pack ecosystem activity declining (consider wasm-bindgen CLI directly)",
    dependencies: "pathfinding, wasm-bindgen, wasm-pack or wasm-bindgen-cli, wasm-opt (binaryen)",
    code_example: `use pathfinding::prelude::astar;

#[wasm_bindgen]
pub fn find_path(grid: &FacilityGrid, fx: f32, fz: f32, tx: f32, tz: f32) -> Float32Array {
    let start = grid.world_to_grid(fx, fz);
    let goal = grid.world_to_grid(tx, tz);
    let result = astar(
        &start,
        |p| grid.successors(p),
        |p| grid.manhattan(p, &goal),
        |p| *p == goal
    );
    match result {
        Some((path, _cost)) => {
            let coords: Vec<f32> = path.iter().flat_map(|p| {
                let (x, z) = grid.grid_to_world(p);
                vec![x, z]
            }).collect();
            Float32Array::from(&coords[..])
        }
        None => Float32Array::new_with_length(0)
    }
}`
  },
  {
    name: "Flow Field Navigation for Multi-Robot Coordination",
    category: "wasm-pathfinding",
    description: "Generate flow fields (vector fields) in Rust/WASM for multi-robot navigation to common destinations. Instead of per-robot A* (O(V log V) per robot), compute one Dijkstra-based distance map per destination, derive flow field as gradient. Each robot samples flow field at its position for direction - O(1) per robot per frame. Ideal for cleaning robots all heading to courts or returning to docks.",
    applicability_score: 8,
    performance_gain_estimate: "O(1) per robot per frame vs O(V log V), 15-50x for 10+ robots navigating simultaneously",
    implementation_notes: "struct FlowField { directions: Vec<(f32,f32)>, width: u32, height: u32 }. Generate via BFS/Dijkstra from target, store normalized direction vectors. Cache per destination. Invalidate only when facility layout changes. bevy_flowfield_tiles_plugin shows sector-based approach for larger maps. For <100 courts, single flow field suffices (<4KB memory).",
    browser_support: "All WASM-capable browsers",
    risks: "Flow fields produce smooth but not necessarily shortest paths. May need local avoidance layer for robot-robot collision. Flow field quality depends on grid resolution.",
    dependencies: "No external crate needed - BFS/Dijkstra from std::collections::BinaryHeap + VecDeque",
    code_example: `#[wasm_bindgen]
pub fn generate_flow_field(grid: &FacilityGrid, target_x: f32, target_z: f32) -> Float32Array {
    let target = grid.world_to_grid(target_x, target_z);
    let size = (grid.width * grid.height) as usize;
    let mut dist = vec![f32::MAX; size];
    let mut queue = VecDeque::new();
    dist[target.index(grid.width)] = 0.0;
    queue.push_back(target);
    while let Some(pos) = queue.pop_front() {
        for neighbor in grid.neighbors(&pos) {
            let new_dist = dist[pos.index(grid.width)] + grid.cost(&neighbor);
            if new_dist < dist[neighbor.index(grid.width)] {
                dist[neighbor.index(grid.width)] = new_dist;
                queue.push_back(neighbor);
            }
        }
    }
    // Convert distance map to direction vectors (gradient)
    let mut directions = Vec::with_capacity(size * 2);
    for y in 0..grid.height {
        for x in 0..grid.width {
            let (dx, dz) = compute_gradient(&dist, x, y, grid.width, grid.height);
            directions.push(dx);
            directions.push(dz);
        }
    }
    Float32Array::from(&directions[..])
}`
  },
  {
    name: "Pre-computed All-Pairs Path Lookup Table",
    category: "wasm-pathfinding",
    description: "Pre-compute all shortest paths between facility waypoints (court entrances, dock positions, aisle intersections) using Floyd-Warshall algorithm at facility init time. Store as next-hop lookup table in WASM linear memory. Runtime path queries become O(path_length) table lookups instead of O(V log V) A* searches. Game AI Pro Chapter 20 validates this approach for MMO-scale environments.",
    applicability_score: 9,
    performance_gain_estimate: "100x+ for repeated path queries (table lookup vs full A* search), 0ms runtime pathfinding after init",
    implementation_notes: "With ~50 waypoint nodes (court entrances + dock + intersections), table is 50*50=2500 entries of u8 (next-hop ID) = 2.5KB. Floyd-Warshall runs once at init: O(V^3) = 125K operations = sub-millisecond in Rust. Cleaning paths pre-generated as contiguous f32 buffer. Path reconstruction: follow next-hop chain from source to destination, convert node IDs to world coordinates. Invalidate and recompute only when courts added/removed.",
    browser_support: "All WASM-capable browsers",
    risks: "Only works for paths between pre-defined waypoints, not arbitrary positions. Requires waypoint-snapping for start/end positions. Memory grows quadratically with waypoint count (but still tiny for facility scale).",
    dependencies: "No external crate needed - pure Rust implementation",
    code_example: `struct PathTable {
    next_hop: Vec<u8>,
    num_nodes: usize,
}

impl PathTable {
    fn floyd_warshall(dist: &mut [Vec<f32>], next: &mut [Vec<u8>], n: usize) {
        for k in 0..n {
            for i in 0..n {
                for j in 0..n {
                    if dist[i][k] + dist[k][j] < dist[i][j] {
                        dist[i][j] = dist[i][k] + dist[k][j];
                        next[i][j] = next[i][k];
                    }
                }
            }
        }
    }

    fn get_path(&self, from: u8, to: u8) -> Vec<u8> {
        let mut path = vec![from];
        let mut current = from;
        while current != to {
            current = self.next_hop[current as usize * self.num_nodes + to as usize];
            path.push(current);
        }
        path
    }
}`
  }
];

const insertAll = db.transaction(() => {
  for (const t of techniques) {
    insertTechnique.run(
      t.name, t.category, t.description, t.applicability_score,
      t.performance_gain_estimate, t.implementation_notes, t.browser_support,
      t.risks, t.dependencies, t.code_example
    );
  }
});

insertAll();
console.log(`Inserted ${techniques.length} techniques`);
db.close();
