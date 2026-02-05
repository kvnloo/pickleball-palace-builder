const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  -- TASKS: Top-level optimization tasks
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    priority TEXT CHECK(priority IN ('P0','P1','P2','P3')) DEFAULT 'P2',
    status TEXT CHECK(status IN ('planned','active','blocked','completed','abandoned')) DEFAULT 'planned',
    estimated_effort TEXT,
    target_fps_gain REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- PLAN_ITERATIONS: One snapshot per task per planning round
  CREATE TABLE IF NOT EXISTS plan_iterations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    status TEXT CHECK(status IN ('draft','voting','accepted','rejected','superseded')) DEFAULT 'draft',
    overall_score REAL,
    vote_count INTEGER DEFAULT 0,
    convergence_delta REAL,
    changed_step_count INTEGER DEFAULT 0,
    total_step_count INTEGER DEFAULT 0,
    agent_id TEXT,
    generation_prompt TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, iteration_number)
  );

  -- PLAN_STEPS: Steps at any resolution (L0=conceptual, L1=implementation, L2=atomic)
  CREATE TABLE IF NOT EXISTS plan_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iteration_id INTEGER NOT NULL REFERENCES plan_iterations(id) ON DELETE CASCADE,
    parent_step_id INTEGER REFERENCES plan_steps(id),
    resolution TEXT NOT NULL CHECK(resolution IN ('L0','L1','L2')),
    sequence_number INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    related_files TEXT,
    rationale TEXT,
    implementation_approach TEXT,
    estimated_effort TEXT,
    dependencies TEXT,
    exact_instructions TEXT,
    target_file TEXT,
    target_lines TEXT,
    code_snippet TEXT,
    status TEXT CHECK(status IN ('pending','in_progress','completed','skipped','blocked','failed')) DEFAULT 'pending',
    confidence_score REAL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- PLAN_VOTES: Scoring and feedback
  CREATE TABLE IF NOT EXISTS plan_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iteration_id INTEGER REFERENCES plan_iterations(id) ON DELETE CASCADE,
    step_id INTEGER REFERENCES plan_steps(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('approve','reject','improve','abstain')),
    score REAL CHECK(score >= 0 AND score <= 10),
    reasoning TEXT,
    suggested_changes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK(iteration_id IS NOT NULL OR step_id IS NOT NULL)
  );

  -- TEST_SPECS: Test specifications linked to plan steps
  CREATE TABLE IF NOT EXISTS test_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id INTEGER NOT NULL REFERENCES plan_steps(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL CHECK(test_type IN ('unit','integration','benchmark','visual','manual')),
    description TEXT NOT NULL,
    assertion TEXT NOT NULL,
    target_metric TEXT,
    target_value REAL,
    target_comparison TEXT CHECK(target_comparison IN ('gt','gte','lt','lte','eq','between')) DEFAULT 'gte',
    current_value REAL,
    status TEXT CHECK(status IN ('pending','passing','failing','skipped','error')) DEFAULT 'pending',
    related_benchmark_id INTEGER REFERENCES benchmarks(id),
    code_location TEXT,
    test_code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified_at DATETIME
  );

  -- PLAN_RESEARCH_LINKS: Connect steps to research findings
  CREATE TABLE IF NOT EXISTS plan_research_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id INTEGER NOT NULL REFERENCES plan_steps(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK(relationship IN ('implements','addresses','uses','validates','depends_on')),
    finding_id INTEGER REFERENCES findings(id),
    bottleneck_id INTEGER REFERENCES bottlenecks(id),
    technique_id INTEGER REFERENCES techniques(id),
    algorithm_id INTEGER REFERENCES algorithms(id),
    notes TEXT,
    CHECK(finding_id IS NOT NULL OR bottleneck_id IS NOT NULL OR technique_id IS NOT NULL OR algorithm_id IS NOT NULL)
  );

  -- INDEXES
  CREATE INDEX IF NOT EXISTS idx_iterations_task_num ON plan_iterations(task_id, iteration_number DESC);
  CREATE INDEX IF NOT EXISTS idx_iterations_task_status ON plan_iterations(task_id, status);
  CREATE INDEX IF NOT EXISTS idx_steps_iteration_resolution ON plan_steps(iteration_id, resolution, sequence_number);
  CREATE INDEX IF NOT EXISTS idx_steps_parent ON plan_steps(parent_step_id);
  CREATE INDEX IF NOT EXISTS idx_votes_iteration ON plan_votes(iteration_id);
  CREATE INDEX IF NOT EXISTS idx_votes_step ON plan_votes(step_id);
  CREATE INDEX IF NOT EXISTS idx_tests_step ON test_specs(step_id);
  CREATE INDEX IF NOT EXISTS idx_tests_status ON test_specs(status);
  CREATE INDEX IF NOT EXISTS idx_research_links_step ON plan_research_links(step_id);
  CREATE INDEX IF NOT EXISTS idx_research_links_finding ON plan_research_links(finding_id);
  CREATE INDEX IF NOT EXISTS idx_research_links_bottleneck ON plan_research_links(bottleneck_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

  -- VIEWS
  CREATE VIEW IF NOT EXISTS v_latest_iterations AS
  SELECT pi.*
  FROM plan_iterations pi
  INNER JOIN (
    SELECT task_id, MAX(iteration_number) AS max_iter
    FROM plan_iterations WHERE status = 'accepted'
    GROUP BY task_id
  ) latest ON pi.task_id = latest.task_id AND pi.iteration_number = latest.max_iter;

  CREATE VIEW IF NOT EXISTS v_latest_steps AS
  SELECT ps.*, pi.task_id, pi.iteration_number
  FROM plan_steps ps JOIN v_latest_iterations pi ON ps.iteration_id = pi.id;

  CREATE VIEW IF NOT EXISTS v_convergence_trend AS
  SELECT t.id AS task_id, t.title AS task_title, pi.iteration_number,
         pi.convergence_delta, pi.overall_score, pi.changed_step_count,
         pi.total_step_count, pi.created_at
  FROM plan_iterations pi JOIN tasks t ON pi.task_id = t.id
  ORDER BY t.id, pi.iteration_number;
`);

// Seed the 15 optimization tasks from our research
const insertTask = db.prepare(`
  INSERT OR IGNORE INTO tasks (title, description, category, priority, estimated_effort, target_fps_gain)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const tasks = [
  // Phase 1: Quick Wins
  ['Squared Distance Collision', 'Replace Math.sqrt() with squared distance comparison in gameStore.ts:221-258 collision detection loop', 'physics', 'P0', '1h', 15],
  ['Fix AnimatedPlayer useMemo', 'Remove performance.now() call that defeats useMemo in AnimatedPlayer.tsx:55-63. Use useFrame delta for time-based animation', 'rendering', 'P0', '30m', 3],
  ['MeshLambertMaterial Swap', 'Replace MeshStandardMaterial with MeshLambertMaterial for all court/player/robot materials. PBR is unnecessary for this game style', 'rendering', 'P0', '2h', null],
  ['Streaming Percentile Algorithm', 'Replace sort-based percentile calculation in performanceStore.ts:97-103 with P2 streaming algorithm for zero-allocation metrics', 'memory', 'P0', '2h', 5],
  ['Pre-Create Trail Meshes', 'Convert PickleballBall.tsx:42-65 trail mesh recreation to ref-based position updates with pre-created instances', 'rendering', 'P0', '1h', 5],

  // Phase 2: Rendering Pipeline
  ['InstancedMesh Court Batching', 'Convert all repeated court geometries (surfaces, lines, nets, posts) to InstancedMesh for batch rendering. Target: 1200+ draw calls → 4-6', 'rendering', 'P0', '2d', 200],
  ['Frustum Culling System', 'Implement camera-based visibility culling so off-screen courts skip rendering and physics. Expected 50-80% draw call reduction', 'rendering', 'P0', '1d', 100],
  ['Level of Detail System', 'Multi-level geometry and rendering: full detail < 20m, merged mesh 20-50m, billboard/box > 50m', 'rendering', 'P1', '2d', 80],
  ['Shadow Optimization', 'Implement shadow LOD, CSM for normal tier, baked shadows for static courts, tighter frustum', 'rendering', 'P2', '1d', 40],

  // Phase 3: State Management
  ['External Mutable Game State', 'Bypass Zustand for hot game state. Create GameStateManager with direct mutation, ref-based Three.js updates, React only for score/UI', 'state', 'P0', '1d', 150],
  ['Consolidated Render Loop', 'Merge all useFrame hooks into single WorldUpdateLoop with priority-based dispatch and frame-skipping for low-priority systems', 'state', 'P0', '1d', 50],
  ['React Reconciliation Minimization', 'Identify and eliminate unnecessary React re-renders. Add memo boundaries, use refs for Three.js state, extract hot paths from React', 'state', 'P1', '1d', 30],

  // Phase 4: WASM/Rust
  ['Rust WASM Physics Engine', 'Port ball physics to Rust compiled to WASM with SIMD. Batch update all balls in single WASM call. Zero-copy via memory views', 'wasm', 'P2', '1w', 200],
  ['Web Worker Compute Offloading', 'Move physics, AI, and pathfinding to dedicated Web Worker with SharedArrayBuffer for zero-copy data sharing', 'workers', 'P1', '1w', 100],
  ['GC Elimination Strategy', 'Systematically eliminate all per-frame allocations: Map cloning, object spreads, array creation, closures in hot paths', 'memory', 'P0', '2d', 80],
];

const seedTasks = db.transaction(() => {
  for (const [title, description, category, priority, effort, gain] of tasks) {
    insertTask.run(title, description, category, priority, effort, gain);
  }
});
seedTasks();

const count = db.prepare('SELECT COUNT(*) as c FROM tasks').get();
console.log(`Schema created. ${count.c} tasks seeded.`);
db.close();
