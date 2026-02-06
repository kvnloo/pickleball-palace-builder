// Insert tests for Phase 2 tasks
// Links tests to the last L2 step of each task

const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const insertTest = db.prepare(`
  INSERT INTO test_specs (step_id, test_type, description, assertion, target_metric, target_value, target_comparison)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Get Phase 2 tasks (16-40)
const tasks = db.prepare(`
  SELECT t.id, t.title, pi.id as iteration_id
  FROM tasks t
  JOIN plan_iterations pi ON pi.task_id = t.id
  WHERE t.id >= 16
  ORDER BY t.id
`).all();

// Test specifications for each task
const taskTests = {
  'useFrustumCulling Hook Implementation': [
    { type: 'benchmark', desc: 'Culling check under 0.1ms for 200 courts', assertion: 'cullingTime < 0.1', metric: 'ms', value: 0.1, comparison: 'lt' },
    { type: 'unit', desc: 'Returns empty set when camera faces away', assertion: 'visibleCourts.size === 0', metric: null, value: null, comparison: null }
  ],
  'Grid-Range Frustum Algorithm': [
    { type: 'benchmark', desc: 'Grid range computation under 0.01ms', assertion: 'rangeComputeTime < 0.01', metric: 'ms', value: 0.01, comparison: 'lt' }
  ],
  'useLODLevel Hook Implementation': [
    { type: 'unit', desc: 'Returns HIGH at 20m distance', assertion: 'level === 0', metric: null, value: null, comparison: null },
    { type: 'unit', desc: 'Hysteresis prevents oscillation at boundary', assertion: 'transitionCount < 3', metric: 'transitions', value: 3, comparison: 'lt' },
    { type: 'benchmark', desc: 'LOD check under 0.05ms for 100 objects', assertion: 'lodCheckTime < 0.05', metric: 'ms', value: 0.05, comparison: 'lt' }
  ],
  'LOD Geometry Factory': [
    { type: 'unit', desc: 'All geometries pre-created at module load', assertion: 'COURT_GEOMETRIES.HIGH !== undefined', metric: null, value: null, comparison: null }
  ],
  'LOD Hysteresis Anti-Popping': [
    { type: 'unit', desc: 'No oscillation at boundary distance', assertion: 'levelChanges < 2 over 60 frames', metric: 'changes', value: 2, comparison: 'lt' }
  ],
  'Shadow LOD Integration': [
    { type: 'unit', desc: 'castShadow false when LOD > 0', assertion: 'mesh.castShadow === false when level > 0', metric: null, value: null, comparison: null }
  ],
  'Per-Instance InstancedMesh Culling': [
    { type: 'unit', desc: 'frustumCulled not explicitly false', assertion: 'mesh.frustumCulled !== false', metric: null, value: null, comparison: null },
    { type: 'benchmark', desc: 'Draw calls reduced when zoomed in', assertion: 'drawCalls < 50% of total when camera zoomed', metric: 'percent', value: 50, comparison: 'lt' }
  ],
  'Court-Scoped Game Version Counter': [
    { type: 'unit', desc: 'Court A update doesnt trigger Court B render', assertion: 'courtB.renderCount === 0 after courtA.update()', metric: null, value: null, comparison: null }
  ],
  'Web Worker Physics Offloading': [
    { type: 'benchmark', desc: 'Main thread frame time < 4ms with 100 balls', assertion: 'mainThreadTime < 4', metric: 'ms', value: 4, comparison: 'lt' }
  ],
  'WASM Physics Engine Integration': [
    { type: 'benchmark', desc: 'Physics step < 1ms for 100 balls', assertion: 'physicsStepTime < 1', metric: 'ms', value: 1, comparison: 'lt' }
  ],
  'Batched Matrix Updates for InstancedMesh': [
    { type: 'unit', desc: 'needsUpdate set once per batch', assertion: 'needsUpdateCount === 1', metric: null, value: null, comparison: null }
  ],
  'Spatial Hashing for Collision Detection': [
    { type: 'benchmark', desc: 'Collision check < 0.5ms for 100 objects', assertion: 'collisionTime < 0.5', metric: 'ms', value: 0.5, comparison: 'lt' }
  ],
  'Object Pooling for Game Entities': [
    { type: 'unit', desc: 'No new allocations after warmup', assertion: 'allocations === 0', metric: null, value: null, comparison: null }
  ],
  'Deferred Rendering Pipeline Analysis': [
    { type: 'manual', desc: 'Verify forward rendering is active', assertion: 'renderer.capabilities check', metric: null, value: null, comparison: null }
  ],
  'Sin/Cos Lookup Tables': [
    { type: 'benchmark', desc: 'fastSin 3x faster than Math.sin', assertion: 'fastSinTime < mathSinTime / 3', metric: 'ratio', value: 3, comparison: 'gt' }
  ],
  'Pre-computed Ball Arc Physics': [
    { type: 'unit', desc: 'Arc evaluation matches physics integration', assertion: 'Math.abs(arcPos.y - physicsPos.y) < 0.001', metric: null, value: null, comparison: null }
  ],
  'Animation Frame Skipping': [
    { type: 'benchmark', desc: 'Animation time reduced 50% for 100 players', assertion: 'animationTime < baseline / 2', metric: 'ms', value: null, comparison: null }
  ],
  'Texture Atlas for Materials': [
    { type: 'unit', desc: 'Single texture for all surfaces', assertion: 'textureBindCount === 1', metric: null, value: null, comparison: null }
  ],
  'Geometry Merging for Static Objects': [
    { type: 'unit', desc: 'Static elements merged to 1 draw call', assertion: 'staticDrawCalls === 1', metric: null, value: null, comparison: null }
  ],
  'TypedArray View Recycling': [
    { type: 'unit', desc: 'No allocations in view operations', assertion: 'heapDelta === 0', metric: null, value: null, comparison: null }
  ],
  'RequestAnimationFrame Throttling': [
    { type: 'benchmark', desc: 'Frame time variance < 5ms on low tier', assertion: 'frameTimeVariance < 5', metric: 'ms', value: 5, comparison: 'lt' }
  ],
  'GPU Instancing with Custom Shaders': [
    { type: 'benchmark', desc: 'Draw 10000 instances at 60fps', assertion: 'fps >= 60 with 10000 instances', metric: 'fps', value: 60, comparison: 'gte' }
  ],
  'Occlusion Culling with GPU Queries': [
    { type: 'manual', desc: 'Measure benefit vs cost', assertion: 'Document findings', metric: null, value: null, comparison: null }
  ],
  'Compute Shader Physics (WebGPU)': [
    { type: 'manual', desc: 'Prototype when WebGPU available', assertion: 'Document browser support', metric: null, value: null, comparison: null }
  ],
  'Progressive Loading and Streaming': [
    { type: 'benchmark', desc: 'Time to first render < 500ms', assertion: 'firstRenderTime < 500', metric: 'ms', value: 500, comparison: 'lt' }
  ]
};

const insertAll = db.transaction(() => {
  let count = 0;

  for (const task of tasks) {
    const tests = taskTests[task.title];
    if (!tests) continue;

    // Get the last L2 step for this task's iteration
    const lastStep = db.prepare(`
      SELECT id FROM plan_steps
      WHERE iteration_id = ? AND resolution = 'L2'
      ORDER BY sequence_number DESC
      LIMIT 1
    `).get(task.iteration_id);

    if (!lastStep) continue;

    for (const test of tests) {
      insertTest.run(
        lastStep.id,
        test.type,
        test.desc,
        test.assertion,
        test.metric,
        test.value,
        test.comparison
      );
      count++;
    }
  }

  return count;
});

const testCount = insertAll();
console.log(`Inserted ${testCount} tests for Phase 2 tasks`);

// Verify
const summary = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM test_specs) as total_tests,
    (SELECT COUNT(*) FROM test_specs ts JOIN plan_steps ps ON ts.step_id = ps.id WHERE ps.iteration_id >= 20) as phase2_tests
`).get();
console.log('Test summary:', JSON.stringify(summary, null, 2));

db.close();
