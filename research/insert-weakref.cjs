const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

db.prepare(`INSERT INTO techniques (name, category, description, applicability_score, performance_gain_estimate, implementation_notes, browser_support, risks, dependencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'WeakRef and FinalizationRegistry for Resource Cleanup',
  'memory',
  'WeakRef allows holding a non-preventing reference to an object (the GC can still collect it). FinalizationRegistry provides a callback when a registered object is garbage collected. Together they form a safety-net pattern for resource cleanup: primary cleanup is always explicit (dispose/destroy methods), but FinalizationRegistry catches leaked resources as a backstop. CRITICAL CAVEAT: Cleanup callbacks are non-deterministic - they may fire late or not at all. Never rely on them for essential game logic. For the pickleball game, these are useful for: 1) Detecting leaked Three.js geometries/materials that were not properly disposed, 2) Logging resource leaks during development, 3) Optional cache management for texture/material caches. They should NOT be used for frame-critical resource management.',
  4.0,
  'Minimal direct performance gain; prevents long-term memory leaks in long-running sessions',
  'Create a FinalizationRegistry at app init: const registry = new FinalizationRegistry((heldValue) => { console.warn("Leaked resource:", heldValue); }). Register Three.js materials/geometries: registry.register(material, material.uuid). In dispose(), call registry.unregister(material) to prevent double-free warnings. Use WeakRef for optional material caches: cache.set(key, new WeakRef(material)). On cache access: const ref = cache.get(key)?.deref(); if (!ref) { /* recreate */ }.',
  'All modern browsers (Chrome 84+, Firefox 79+, Safari 14.1+, Edge 84+)',
  'Non-deterministic timing makes them unsuitable for critical resource management; adds code complexity for marginal benefit in game context',
  'none'
);
console.log('WeakRef technique inserted');

db.prepare(`INSERT INTO techniques (name, category, description, applicability_score, performance_gain_estimate, implementation_notes, browser_support, risks, dependencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'Object.freeze for Immutable Constants',
  'memory',
  'Object.freeze() makes objects immutable (non-writable, non-configurable properties). Frozen objects in V8 have specific GC implications: 1) They naturally tenure to old generation since they are created once and never modified, 2) V8 can optimize property access on frozen objects since their shape (hidden class) never changes, 3) They cannot be accidentally mutated in hot paths. Historical V8 performance penalties for frozen objects have been largely fixed (since 2014). The overhead of Object.freeze() itself is negligible. For the pickleball game, freeze all constant configuration objects (SHOT_CONFIGS, PERFORMANCE_CONFIGS, shared geometries/materials). Deep freeze is needed for nested objects. Note: freeze is shallow by default - nested objects need individual freezing.',
  5.5,
  'Minor direct gain; prevents accidental mutation bugs; helps V8 optimize property access on stable shapes',
  'Apply Object.freeze to: SHOT_CONFIGS, PERFORMANCE_CONFIGS, COURT_WIDTH/LENGTH constants, shared Three.js geometries and materials (bodyGeometry, headGeometry, teamAMaterial etc in AnimatedPlayer.tsx), pooledMaterials and sharedGeometries in SelectableCourt.tsx. Create a deepFreeze utility: function deepFreeze(obj) { Object.freeze(obj); Object.values(obj).forEach(v => typeof v === "object" && v !== null && deepFreeze(v)); return obj; }. Do NOT freeze objects that need per-frame mutation (game state, ball state, player state).',
  'All modern browsers',
  'Cannot unfreeze; accidental freeze of mutable state causes silent failures in non-strict mode, TypeError in strict mode',
  'none'
);
console.log('Object.freeze technique inserted');

db.prepare(`INSERT INTO techniques (name, category, description, applicability_score, performance_gain_estimate, implementation_notes, browser_support, risks, dependencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'Allocation Profiling with Chrome DevTools',
  'memory',
  'Chrome DevTools provides three memory profiling modes critical for identifying GC hotspots: 1) Allocation Timeline - takes heap snapshots every ~50ms showing blue (live) vs gray (collected) bars, revealing allocation patterns over time. 2) Allocation Sampling - low-overhead profiling that breaks down allocations by JS call stack; includes "Include objects discarded by minor GC" and "Include objects discarded by major GC" checkboxes to see what generates the most garbage. 3) Performance panel with Memory checkbox - shows heap chart with GC events as steep drops, and GC pause durations. The Allocation Sampling mode with minor/major GC tracking enabled is the most useful for game optimization - it shows exactly which functions produce the most garbage without significant performance overhead. The Timeline mode forces full GC per snapshot (every 50ms) so it is invasive and changes GC behavior.',
  7.0,
  'No direct performance gain; essential for identifying and validating GC optimizations',
  'Recommended profiling workflow: 1) Open DevTools > Memory > Allocation Sampling with both minor and major GC checkboxes enabled. 2) Play the game for 30 seconds. 3) Stop and analyze: sort by "Total Size" to find top allocators. 4) For this codebase, expect to see: gameStore.ts updateGame (Map clone + object spread), performanceStore.ts recordFrame (array allocation + sort), React fiber reconciliation (JSX element creation), useFrame closures. 5) After optimizations, re-profile to validate zero-allocation hot path. 6) Use Performance panel > Memory to measure actual GC pause frequency and duration. Look for the sawtooth pattern in heap usage - flatter is better.',
  'Chrome and Chromium-based browsers only for DevTools; Firefox has equivalent tools',
  'Allocation Timeline mode is invasive (forces GC every 50ms); Allocation Sampling may miss short-lived allocations; profiling itself adds overhead',
  'Chrome DevTools'
);
console.log('Allocation Profiling technique inserted');

db.close();
