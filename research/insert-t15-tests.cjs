const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

// Step IDs from the L2 steps (300-306) and L0/L1 steps (166-168, 292-299)
// Map L2 steps to their test specs
const tests = [
  {
    step_id: 300, // L2: gameStore remove per-frame set() + _gameVersion
    test_type: 'unit',
    description: 'Verify updateGame() has no new Map() or object spread',
    assertion: 'updateGame body must not match /new\\s+Map\\s*\\(/ or /\\{\\s*\\.\\.\\.game\\s*\\}/',
    target_metric: 'forbidden_pattern_count',
    target_value: 0,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(updateGameBody).not.toMatch(/new\\s+Map\\s*\\(/); expect(updateGameBody).not.toMatch(/\\{\\s*\\.\\.\\.game\\s*\\}/);',
    status: 'pending',
  },
  {
    step_id: 301, // L2: calculateShotVelocity output param
    test_type: 'unit',
    description: 'Verify calculateShotVelocity uses output parameter pattern',
    assertion: 'Function should write to out.x/out.y/out.z or ball.velocity directly, not return new object',
    target_metric: 'has_output_param',
    target_value: 1,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(hasOutputParam || !hasReturnObject).toBe(true);',
    status: 'pending',
  },
  {
    step_id: 302, // L2: in-place position mutation
    test_type: 'integration',
    description: 'Verify ball position object reference is stable across updates',
    assertion: 'Position object reference must be === same before and after updateGame',
    target_metric: 'reference_stable',
    target_value: 1,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(gameAfter.ballState.position).toBe(posRef);',
    status: 'pending',
  },
  {
    step_id: 303, // L2: direct index replacing find()
    test_type: 'unit',
    description: 'Verify no players.find() in updateGame',
    assertion: 'updateGame body must not match /players\\.find\\s*\\(/',
    target_metric: 'forbidden_pattern_count',
    target_value: 0,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(updateGameBody).not.toMatch(/players\\.find\\s*\\(/);',
    status: 'pending',
  },
  {
    step_id: 304, // L2: pre-allocated scratch buffer
    test_type: 'unit',
    description: 'Verify performanceStore uses pre-allocated scratch buffer and no array literals in recordFrame',
    assertion: 'recordFrame must not contain const times: number[] = [] or .filter()',
    target_metric: 'forbidden_pattern_count',
    target_value: 0,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(body).not.toMatch(/const\\s+times/); expect(body).not.toMatch(/\\.filter\\s*\\(/);',
    status: 'pending',
  },
  {
    step_id: 305, // L2: simulationStore direct court mutation
    test_type: 'unit',
    description: 'Verify tick() has no new Map(s.courts) or spread {...c, ...}',
    assertion: 'tick body must not contain new Map(s.courts) or {...c, status:}',
    target_metric: 'forbidden_pattern_count',
    target_value: 0,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(mapClones).toBe(0); expect(spreads).toBe(0);',
    status: 'pending',
  },
  {
    step_id: 306, // L2: useRobotController lazy init + direct mutation
    test_type: 'unit',
    description: 'Verify no fallback object creation or spread in robot state updates',
    assertion: 'No || { currentPath: [] } pattern or robotStates.current.set(id, { ...state })',
    target_metric: 'forbidden_pattern_count',
    target_value: 0,
    target_comparison: 'eq',
    code_location: 'src/__tests__/gcElimination.perf.test.ts',
    test_code: 'expect(matches.length).toBe(0); expect(spreadSets).toBe(0);',
    status: 'pending',
  },
];

const insert = db.transaction((testsArr) => {
  const ids = [];
  for (const data of testsArr) {
    const cols = Object.keys(data);
    const stmt = db.prepare(
      `INSERT INTO test_specs (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    );
    const result = stmt.run(...cols.map(c => data[c]));
    ids.push(result.lastInsertRowid);
  }
  return ids;
});

const ids = insert(tests);
console.log(JSON.stringify({ test_ids: ids }));

db.close();
