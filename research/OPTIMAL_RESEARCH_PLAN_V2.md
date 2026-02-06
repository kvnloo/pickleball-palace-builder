# Optimal Research Plan V2: Performance Optimization Phase 2

## Summary of Phase 1 Findings (10 Agent Analysis)

Based on comprehensive analysis from 10 parallel research agents examining:
- Rendering pipeline (InstancedMesh, draw calls)
- State management (Zustand, GC patterns)
- Physics/game loop (WorldUpdateLoop, scheduling)
- Memory patterns (Float64Array, ring buffers)
- React patterns (memo, comparators)
- Instancing/batching (9 InstancedMesh components)
- LOD/culling systems (tests exist, hooks missing)
- Streaming metrics (P2 percentile, Welford's)
- Hot path math (squared distance, lazy sqrt)
- KB analysis (15 tasks, 117 techniques)

## Critical Discovery: Missing Implementations

**Tests exist but hooks are NOT implemented:**
1. `useFrustumCulling` hook - 563 lines of tests, hook missing
2. `useLODLevel` hook - 747 lines of tests, hook missing

These represent the highest-impact optimization opportunities with clear test specifications.

---

## Prioritized Research Topics (25 Agents)

### Tier 1: Critical Missing Hooks (Agents 1-6) - HIGHEST IMPACT

| Agent | Topic | Expected Impact | Test File |
|-------|-------|-----------------|-----------|
| 1 | useFrustumCulling Hook Implementation | 50-80% render reduction | frustumCulling.perf.test.ts |
| 2 | Frustum Culling Grid-Range Algorithm | O(1) row/col bounds | frustumCulling.perf.test.ts |
| 3 | useLODLevel Hook Implementation | 70-80% draw call reduction | lodSystem.perf.test.ts |
| 4 | LOD Geometry Factory (Court, Player, Ball) | Module-level LOD geometries | lodSystem.perf.test.ts |
| 5 | LOD Hysteresis Anti-Popping Logic | 10% hysteresis band | lodSystem.perf.test.ts |
| 6 | Shadow LOD Integration (castShadow/receiveShadow) | Dynamic shadow toggle | lodSystem.perf.test.ts |

### Tier 2: Architecture Improvements (Agents 7-14) - HIGH IMPACT

| Agent | Topic | Expected Impact | Rationale |
|-------|-------|-----------------|-----------|
| 7 | Per-Instance InstancedMesh Culling | 40-60% fewer instances | frustumCulled={false} everywhere |
| 8 | Court-Scoped Game Version Counter | 90% fewer re-renders | Global version causes cascade |
| 9 | Web Worker Physics Offloading | Unblock main thread | 17 KB research items unexplored |
| 10 | WASM Physics Engine Integration | 10-50x physics speedup | Under-explored in KB |
| 11 | Batched Matrix Updates for InstancedMesh | Reduce setMatrixAt calls | Per-frame overhead |
| 12 | Spatial Hashing for Collision Detection | O(1) collision queries | Currently O(n) |
| 13 | Object Pooling for Game Entities | Zero runtime allocations | GC pressure reduction |
| 14 | Deferred Rendering Pipeline | Single-pass multi-light | Advanced rendering |

### Tier 3: Micro-Optimizations (Agents 15-21) - MEDIUM IMPACT

| Agent | Topic | Expected Impact | Rationale |
|-------|-------|-----------------|-----------|
| 15 | Sin/Cos Lookup Tables | 3-5x trig speedup | Animation hot paths |
| 16 | Pre-computed Ball Arc Physics | Avoid per-frame arc calc | Arc computation expensive |
| 17 | Animation Frame Skipping | 50% animation overhead | Distant player animations |
| 18 | Texture Atlas for Materials | Fewer texture bindings | Material consolidation |
| 19 | Geometry Merging for Static Objects | Merged draw calls | Ground, dock, static meshes |
| 20 | TypedArray View Recycling | Zero slice allocations | Buffer view patterns |
| 21 | Request Animation Frame Throttling | Variable frame budget | Adaptive quality |

### Tier 4: Advanced Optimizations (Agents 22-25) - EXPLORATORY

| Agent | Topic | Expected Impact | Rationale |
|-------|-------|-----------------|-----------|
| 22 | GPU Instancing with Custom Shaders | Maximum GPU efficiency | Beyond InstancedMesh |
| 23 | Occlusion Culling with GPU Queries | Skip hidden objects | Beyond frustum culling |
| 24 | Compute Shader Physics | Parallel physics on GPU | WebGPU preparation |
| 25 | Progressive Loading & Streaming | Faster initial load | Large facility support |

---

## Research Output Format (L0/L1/L2 Granularity)

Each agent will produce findings at three levels:

### L0 - Conceptual (What & Why)
- Problem statement
- Expected performance impact
- Prerequisites and dependencies
- Risk assessment

### L1 - Implementation (How)
- Architecture design
- Component interfaces
- Data flow diagrams
- Integration points

### L2 - Atomic (Step-by-Step)
- File-by-file changes
- Line-level modifications
- Test assertions
- Verification criteria

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Draw calls (100 courts) | ~1200 | <200 |
| Frame time (ms) | 8-12 | <4 |
| Visible court % (zoomed) | 100% | 10-30% |
| LOD transitions/sec | N/A | <5 |
| GC pauses/min | 0 | 0 |
| Memory allocations/frame | 0 | 0 |

---

## Agent Assignment Summary

- **Agents 1-6**: Implement missing hooks (useFrustumCulling, useLODLevel)
- **Agents 7-14**: Architecture improvements (Workers, WASM, spatial hashing)
- **Agents 15-21**: Micro-optimizations (lookup tables, frame skipping)
- **Agents 22-25**: Advanced/exploratory (GPU instancing, occlusion)

Total: 25 parallel research agents with L0/L1/L2 output structure
