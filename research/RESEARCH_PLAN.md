# Performance Optimization Research Plan
## Target: Minimize Frame Time, Maximize FPS (1000+ FPS)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RESEARCH DOMAINS                          │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ RENDERING│  COMPUTE │  MEMORY  │  STATE   │  NATIVE/WASM   │
│ Pipeline │  Engine  │  System  │  Mgmt    │  Acceleration  │
├──────────┼──────────┼──────────┼──────────┼────────────────┤
│InstMesh  │ Physics  │ Pooling  │ Zustand  │ Rust Physics   │
│ Culling  │ Collisn  │ GC Elim  │ Batching │ Rust Pathfind  │
│ LOD      │ Pathfind │ Buffers  │ Selectors│ WASM SIMD      │
│ Batching │ AI Logic │ Layout   │ Workers  │ C Math Kernels │
│ Shadows  │ Algorith │ Caching  │ SharedAB │ AssemblyScript │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

---

## Research Agent Allocation (25 Agents)

### DOMAIN 1: RENDERING PIPELINE (Agents 1-7)

| # | Agent | Research Focus | Key Questions |
|---|-------|---------------|---------------|
| 1 | InstancedMesh Optimizer | Convert court elements to InstancedMesh | How to batch 100+ courts into <10 draw calls? Matrix update patterns? |
| 2 | Frustum Culling Engine | Implement camera-based visibility culling | Manual vs Three.js built-in? BVH acceleration? |
| 3 | LOD System Designer | Multi-level detail for courts/players/robots | Distance thresholds? Billboard sprites for distant players? Geometry simplification? |
| 4 | Draw Call Analyzer | Minimize total draw calls per frame | Geometry merging? Material atlas? Merged meshes? |
| 5 | Shadow Optimization | Minimize shadow rendering cost | Baked shadows? CSM? Shadow LOD? Disable per-object? |
| 6 | Material & Shader Opt | Custom shaders for batch rendering | Uber shader? Material atlas? GPU-driven rendering? |
| 7 | Canvas & WebGL Config | Optimal WebGL context configuration | powerPreference, antialias, alpha, stencil, depth buffer bits? |

### DOMAIN 2: COMPUTE ENGINE (Agents 8-12)

| # | Agent | Research Focus | Key Questions |
|---|-------|---------------|---------------|
| 8 | Physics Engine Opt | Optimize ball physics calculations | SIMD? Batch updates? Predictive physics? |
| 9 | Collision Detection | Faster collision algorithms | Spatial hashing? Sweep & prune? Squared distance? |
| 10 | Pathfinding Optimizer | Robot pathfinding improvements | Jump Point Search? Flow fields? Pre-computed paths? |
| 11 | AI Decision Engine | Optimize shot selection & player AI | Decision trees? Lookup tables? Pre-computed strategies? |
| 12 | Game Loop Architecture | Optimal update loop design | Fixed timestep? Interpolation? Priority-based updates? |

### DOMAIN 3: MEMORY SYSTEM (Agents 13-17)

| # | Agent | Research Focus | Key Questions |
|---|-------|---------------|---------------|
| 13 | Zero-Alloc Hot Paths | Eliminate GC pressure in render loop | Pre-allocated arrays? Object pools? Typed arrays everywhere? |
| 14 | Object Pool Design | Pool patterns for game entities | Entity pool? Material pool? Geometry pool sizing? |
| 15 | Buffer Management | Optimal buffer strategies for WebGL | Ring buffers? Double buffering? Buffer orphaning? |
| 16 | Memory Layout Opt | Cache-friendly data structures | SoA vs AoS? Flat arrays? ArrayBuffer-backed state? |
| 17 | GC Analysis & Mitigation | Profile and eliminate GC pauses | Which allocations trigger GC? How to avoid closures in hot paths? |

### DOMAIN 4: STATE MANAGEMENT (Agents 18-21)

| # | Agent | Research Focus | Key Questions |
|---|-------|---------------|---------------|
| 18 | Zustand Optimization | Minimize store update overhead | Transient updates? Selective subscriptions? Mutative library? |
| 19 | Web Worker Offloading | Move computation off main thread | Which systems to offload? SharedArrayBuffer design? |
| 20 | Render Loop Consolidation | Single unified update loop | How to batch all useFrame hooks? Priority system? |
| 21 | React Reconciliation | Minimize React re-renders in 3D | Memo boundaries? Ref-based updates? Escape React for hot paths? |

### DOMAIN 5: NATIVE/WASM ACCELERATION (Agents 22-25)

| # | Agent | Research Focus | Key Questions |
|---|-------|---------------|---------------|
| 22 | Rust WASM Physics | Port physics to Rust/WASM | wasm-bindgen? Memory sharing? SIMD in WASM? |
| 23 | Rust WASM Pathfinding | Port pathfinding to Rust/WASM | A* in Rust? Grid-based optimization? |
| 24 | WASM SIMD Math | SIMD-accelerated math kernels | Matrix ops? Vector math? Batch transforms? |
| 25 | Native Bridge Architecture | JS<->WASM communication design | SharedArrayBuffer? Zero-copy? Batch API? |

---

## Priority Matrix

```
IMPACT ▲
  10  │  ●InstancedMesh  ●FrustumCull  ●WebWorker
      │  ●ZustandOpt     ●RustPhysics
   8  │  ●GCElim  ●RenderLoop  ●CollisionOpt
      │  ●LOD     ●MemLayout   ●WASMBridge
   6  │  ●Shadows  ●PathfindOpt  ●MaterialOpt
      │  ●ObjectPool  ●AIDecision  ●BufferMgmt
   4  │  ●ReactReconcil  ●CanvasConfig
      │  ●DrawCallAnalysis
   2  │
      └──────────────────────────────────────► EFFORT
       1    2    3    4    5    6    7    8    9   10
```

---

## Success Metrics

| Metric | Current Est. | Target | Method |
|--------|-------------|--------|--------|
| FPS (12 courts) | ~60 | 1000+ | Performance tier ULTRA |
| FPS (100 courts) | ~15 | 240+ | InstancedMesh + culling |
| Frame time (ms) | ~16.7 | <1.0 | All optimizations |
| Draw calls | ~215 | <30 | Instancing + batching |
| GC pauses | ~5ms | 0ms | Zero-allocation paths |
| JS→WASM overhead | N/A | <0.1ms | SharedArrayBuffer |
| Physics update | ~2ms | <0.05ms | Rust WASM |
| State update | ~3ms | <0.1ms | Mutative + batching |

---

## Knowledge Base Schema

All findings stored in `research/performance-kb.db` (SQLite):
- **findings**: Core research results with impact/effort scoring
- **bottlenecks**: Specific code locations with measured impact
- **techniques**: Optimization techniques with applicability scores
- **wasm_candidates**: Rust/C port candidates with feasibility analysis
- **benchmarks**: Performance measurements and comparisons
- **algorithms**: Algorithm alternatives with complexity analysis
- **code_patterns**: Before/after code transformation patterns
- **research_sessions**: Agent session tracking
