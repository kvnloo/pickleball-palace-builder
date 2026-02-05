const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- Core research findings table
  CREATE TABLE IF NOT EXISTS findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    impact_score REAL DEFAULT 0,  -- 0-10 scale
    effort_score REAL DEFAULT 0,  -- 0-10 scale (lower = easier)
    priority TEXT CHECK(priority IN ('P0','P1','P2','P3')) DEFAULT 'P2',
    status TEXT CHECK(status IN ('research','validated','implementing','done','rejected')) DEFAULT 'research',
    source_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Bottlenecks identified in the codebase
  CREATE TABLE IF NOT EXISTS bottlenecks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    line_start INTEGER,
    line_end INTEGER,
    description TEXT NOT NULL,
    bottleneck_type TEXT CHECK(bottleneck_type IN ('cpu','gpu','memory','gc','render','state','io')) NOT NULL,
    severity TEXT CHECK(severity IN ('critical','high','medium','low')) DEFAULT 'medium',
    measured_impact_ms REAL,
    estimated_fps_gain REAL,
    fix_description TEXT,
    fix_complexity TEXT CHECK(fix_complexity IN ('trivial','easy','medium','hard','extreme')) DEFAULT 'medium',
    related_finding_id INTEGER REFERENCES findings(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Optimization techniques researched
  CREATE TABLE IF NOT EXISTS techniques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    applicability_score REAL DEFAULT 0,  -- 0-10 how applicable to this codebase
    performance_gain_estimate TEXT,      -- e.g. "2-5x for physics", "30% fewer draw calls"
    implementation_notes TEXT,
    browser_support TEXT,
    risks TEXT,
    dependencies TEXT,                   -- npm packages or APIs needed
    code_example TEXT,
    related_finding_id INTEGER REFERENCES findings(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Rust/C/WASM optimization candidates
  CREATE TABLE IF NOT EXISTS wasm_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_name TEXT NOT NULL,
    current_file TEXT NOT NULL,
    current_language TEXT DEFAULT 'TypeScript',
    target_language TEXT CHECK(target_language IN ('Rust','C','C++','AssemblyScript')) NOT NULL,
    description TEXT NOT NULL,
    estimated_speedup TEXT,
    memory_layout TEXT,                  -- How data should be laid out for WASM
    interface_design TEXT,               -- JS<->WASM bridge API
    compilation_strategy TEXT,           -- wasm-pack, emscripten, etc.
    feasibility TEXT CHECK(feasibility IN ('high','medium','low')) DEFAULT 'medium',
    related_finding_id INTEGER REFERENCES findings(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Benchmark results and measurements
  CREATE TABLE IF NOT EXISTS benchmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_name TEXT NOT NULL,
    scenario TEXT,                       -- e.g. "12 courts, 4 active games"
    metric_name TEXT NOT NULL,           -- e.g. "fps", "frame_time_ms", "gc_pause_ms"
    metric_value REAL NOT NULL,
    baseline_value REAL,                 -- comparison point
    improvement_pct REAL,
    environment TEXT,                    -- browser, hardware info
    notes TEXT,
    related_finding_id INTEGER REFERENCES findings(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Algorithm alternatives researched
  CREATE TABLE IF NOT EXISTS algorithms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_domain TEXT NOT NULL,        -- e.g. "collision detection", "pathfinding"
    current_algorithm TEXT,
    proposed_algorithm TEXT NOT NULL,
    time_complexity_current TEXT,
    time_complexity_proposed TEXT,
    space_complexity_current TEXT,
    space_complexity_proposed TEXT,
    description TEXT NOT NULL,
    tradeoffs TEXT,
    implementation_sketch TEXT,
    related_finding_id INTEGER REFERENCES findings(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Code transformation patterns
  CREATE TABLE IF NOT EXISTS code_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT NOT NULL,
    anti_pattern TEXT,                   -- What to avoid
    optimized_pattern TEXT NOT NULL,     -- What to use instead
    explanation TEXT NOT NULL,
    applicable_files TEXT,               -- JSON array of file paths
    estimated_impact TEXT,
    code_before TEXT,
    code_after TEXT,
    related_finding_id INTEGER REFERENCES findings(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Research sessions tracking
  CREATE TABLE IF NOT EXISTS research_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    research_topic TEXT NOT NULL,
    status TEXT CHECK(status IN ('running','completed','failed')) DEFAULT 'running',
    findings_count INTEGER DEFAULT 0,
    summary TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  -- Cross-references between findings
  CREATE TABLE IF NOT EXISTS finding_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_finding_id INTEGER REFERENCES findings(id),
    to_finding_id INTEGER REFERENCES findings(id),
    relationship TEXT,  -- e.g. "depends_on", "conflicts_with", "enables", "alternative_to"
    notes TEXT
  );

  -- Create indexes for fast querying
  CREATE INDEX IF NOT EXISTS idx_findings_category ON findings(category);
  CREATE INDEX IF NOT EXISTS idx_findings_priority ON findings(priority);
  CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
  CREATE INDEX IF NOT EXISTS idx_bottlenecks_severity ON bottlenecks(severity);
  CREATE INDEX IF NOT EXISTS idx_bottlenecks_type ON bottlenecks(bottleneck_type);
  CREATE INDEX IF NOT EXISTS idx_techniques_category ON techniques(category);
  CREATE INDEX IF NOT EXISTS idx_wasm_feasibility ON wasm_candidates(feasibility);
`);

console.log('Knowledge base initialized successfully!');
console.log('Tables created: findings, bottlenecks, techniques, wasm_candidates, benchmarks, algorithms, code_patterns, research_sessions, finding_links');

// Seed with initial bottleneck data from codebase analysis
const insertBottleneck = db.prepare(`
  INSERT INTO bottlenecks (file_path, line_start, line_end, description, bottleneck_type, severity, estimated_fps_gain, fix_description, fix_complexity)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertFinding = db.prepare(`
  INSERT INTO findings (category, subcategory, title, description, impact_score, effort_score, priority, source_agent)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedData = db.transaction(() => {
  // Seed bottlenecks from analysis
  insertBottleneck.run('src/stores/gameStore.ts', 221, 258, 'Player collision detection uses Math.sqrt() per player per frame - O(N) with N players', 'cpu', 'critical', 15, 'Use squared distance comparison instead of sqrt', 'trivial');
  insertBottleneck.run('src/stores/gameStore.ts', 305, 310, 'Creates new Map and spreads game object EVERY FRAME via Zustand set()', 'gc', 'critical', 20, 'Use immer or mutative for immutable updates; batch state updates', 'medium');
  insertBottleneck.run('src/stores/simulationStore.ts', 138, 147, 'Clones entire courts Map on every state update - O(n) per update', 'gc', 'high', 10, 'Use structural sharing or mutable updates with manual notification', 'medium');
  insertBottleneck.run('src/stores/performanceStore.ts', 97, 103, 'Allocates and sorts 1000-element array every 30 frames for percentile calculation', 'gc', 'high', 5, 'Use streaming percentile algorithm (P2 or t-digest) to avoid sort', 'medium');
  insertBottleneck.run('src/components/three/SelectableCourt.tsx', 46, 60, 'Unbounded statusRings Material Map grows with unique (color,opacity) combinations', 'memory', 'high', 2, 'Pre-allocate fixed material set or use shader uniforms', 'easy');
  insertBottleneck.run('src/components/three/HomebaseCanvas.tsx', 169, 196, 'No frustum culling - all courts rendered regardless of camera visibility', 'render', 'critical', 25, 'Implement Three.js frustum culling or manual visibility checks', 'medium');
  insertBottleneck.run('src/components/three/AnimatedPlayer.tsx', 57, 61, 'useMemo calls performance.now() defeating memoization - recalculates every render', 'cpu', 'medium', 3, 'Use useFrame delta for time-based animation instead of performance.now()', 'trivial');
  insertBottleneck.run('src/components/three/HomebaseCanvas.tsx', 0, 0, 'No InstancedMesh usage - each court rendered as individual draw calls (~12 per court)', 'render', 'critical', 30, 'Convert repeated court geometries to InstancedMesh for batch rendering', 'hard');
  insertBottleneck.run('src/components/three/PickleballBall.tsx', 42, 65, 'Trail meshes re-created on every render instead of reusing instances', 'render', 'medium', 5, 'Pre-create trail mesh instances and update positions via refs', 'easy');
  insertBottleneck.run('src/hooks/useSimulation.ts', 0, 0, 'Multiple useFrame hooks across components not consolidated', 'cpu', 'high', 10, 'Consolidate into single update loop with priority-based dispatch', 'hard');

  // Seed initial findings
  insertFinding.run('rendering', 'draw-calls', 'InstancedMesh for Court Elements', 'Courts use individual meshes for surfaces, lines, nets, and posts. With 100+ courts this means 1200+ draw calls. Three.js InstancedMesh can batch identical geometries into single draw calls.', 9.5, 7, 'P0', 'analysis-agent');
  insertFinding.run('rendering', 'culling', 'Frustum Culling for Off-Screen Courts', 'No visibility culling implemented. All court meshes render every frame regardless of camera position. Courts behind the camera still consume GPU cycles.', 9, 5, 'P0', 'analysis-agent');
  insertFinding.run('state', 'zustand', 'State Update Optimization', 'Zustand stores clone entire Maps on every update. At 60fps with 100 courts, this creates 6000 Map copies/second. Need structural sharing or mutable state with manual subscribers.', 8.5, 6, 'P0', 'analysis-agent');
  insertFinding.run('physics', 'collision', 'Squared Distance for Collision Detection', 'Math.sqrt() called per player per frame for hit detection. Can be eliminated by comparing squared distances instead.', 7, 2, 'P1', 'analysis-agent');
  insertFinding.run('wasm', 'physics', 'WASM Physics Engine Candidate', 'Ball physics and collision detection are pure math operations ideal for Rust/WASM. Could achieve 10-50x speedup for physics calculations.', 8, 8, 'P1', 'analysis-agent');
  insertFinding.run('wasm', 'pathfinding', 'WASM Pathfinding Candidate', 'Robot pathfinding uses Manhattan routing with waypoint calculation. A* or similar in Rust/WASM would be significantly faster for complex paths.', 7.5, 7, 'P1', 'analysis-agent');
  insertFinding.run('memory', 'gc', 'GC Pressure from Per-Frame Allocations', 'Multiple hot paths create objects every frame: Map cloning, array allocation for metrics, temporary vectors. Need zero-allocation hot paths.', 8, 5, 'P0', 'analysis-agent');
  insertFinding.run('rendering', 'shadows', 'Shadow Map Optimization', 'Shadow maps at 1024x1024 per light source. Can use CSM, shadow LOD, or baked shadows for static courts.', 6, 4, 'P2', 'analysis-agent');
  insertFinding.run('workers', 'offloading', 'Web Worker for Game Simulation', 'All game logic runs on main thread. Physics, AI, and pathfinding could run in dedicated Web Workers using SharedArrayBuffer.', 9, 8, 'P1', 'analysis-agent');
  insertFinding.run('rendering', 'lod', 'Level of Detail System', 'No LOD implementation. Distant courts could use simplified geometry (merged mesh, fewer segments). Players could become billboards at distance.', 7, 6, 'P1', 'analysis-agent');
});

seedData();

console.log('Seeded initial data from codebase analysis');

db.close();
