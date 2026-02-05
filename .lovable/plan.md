

## Extreme Performance Optimization Plan: 1000 FPS Target

### Assumptions

- **1000 FPS target**: This requires sub-1ms frame times, which is achievable only by minimizing JavaScript overhead, using GPU instancing, and avoiding any per-frame allocations
- **Net collision for robot**: The cleaning path will split into two halves (one per side of net), with robot navigating around net posts through the aisle
- **Gameplay simulation**: Ball physics uses simplified parabolic trajectories with pre-computed arcs for maximum performance
- **Scoreboard**: Billboard text rendered using Canvas2D textures (single draw call per scoreboard)
- **FPS counter**: Uses high-precision `performance.now()` with a 1000-frame ring buffer for statistical accuracy
- **RALPH loop**: Continuous performance monitoring with automatic degradation when FPS drops below thresholds

---

### Critical Performance Issues in Current Codebase

| Issue | Location | Impact | Fix |
|-------|----------|--------|-----|
| Per-component `useFrame` hooks | `Player.tsx`, `CleaningRobotCC1.tsx` | Each hook adds function call overhead per frame | Consolidate into single scene-level orchestrator |
| Material recreation in render | `SelectableCourt.tsx` lines 59-78 | Creates new materials on every hover/select change | Use pooled materials with visibility toggling |
| `new THREE.Vector3()` in render | `HomebaseCanvas.tsx` line 84 | Allocations trigger GC pauses | Pre-allocate and reuse vectors |
| Map iterations in `useFrame` | `useRobotController.ts` line 99 | O(n) iteration every frame | Use typed arrays for robot state |
| Shadow maps enabled | `HomebaseCanvas.tsx` line 111 | 2048x2048 shadow maps are expensive | Make shadows optional, default off for 1000 FPS mode |
| Individual mesh components | `Player.tsx`, `PickleballCourt.tsx` | Multiple draw calls per entity | Switch to InstancedMesh for repeated geometry |
| Ring geometry per court | `SelectableCourt.tsx` line 113 | Creates geometry inline | Share geometry across all courts |

---

### Performance Architecture

```text
+--------------------------------------------------+
|              Performance Tier System             |
+--------------------------------------------------+
|  ULTRA (1000+ FPS)  |  HIGH (240+ FPS)  |  NORMAL (60+ FPS)  |
+---------------------+-------------------+--------------------+
| - No shadows        | - Simple shadows  | - Full shadows     |
| - Instanced only    | - Mixed rendering | - Individual meshes|
| - No particles      | - Minimal VFX     | - Full VFX         |
| - Billboard sprites | - Low-poly models | - Detailed models  |
| - Skip animations   | - 30Hz animations | - 60Hz animations  |
| - Frustum culling   | - Distance culling| - No culling       |
+---------------------+-------------------+--------------------+
```

---

### Implementation Plan

#### Phase 1: Performance Infrastructure

**1.1 Create Performance Store with RALPH Loop**

New file: `src/stores/performanceStore.ts`

Features:
- 1000-frame ring buffer for frame times using `Float64Array`
- Rolling statistics: current FPS, avg, min, max, 1% low, 0.1% low
- Performance tier auto-detection (ULTRA/HIGH/NORMAL)
- Session recording with timestamps for regression analysis
- Automatic quality degradation when FPS drops below threshold
- Export/import benchmark data as JSON

```text
RALPH Loop Implementation:
+--------+     +----------+     +--------+     +------+     +------------+
| Record | --> | Analyze  | --> | Learn  | --> | Plan | --> | Hypothesize|
| frames |     | metrics  |     | trends |     | tier |     | optimize   |
+--------+     +----------+     +--------+     +------+     +------------+
     ^                                                             |
     |_____________________________________________________________|
```

**1.2 Create FPS Counter Component**

New file: `src/components/ui/FPSCounter.tsx`

Features:
- Toggle visibility with F key
- Shows: Current FPS, Avg, Min, Max, Frame time (ms)
- Color-coded (green > 240, yellow > 60, red < 60)
- Minimal DOM updates (requestAnimationFrame batched)
- Position: fixed top-right corner

**1.3 Create Performance Dashboard**

New file: `src/components/ui/PerformanceDashboard.tsx`

Features:
- Historical FPS graph (last 60 seconds)
- Benchmark mode: 10-second stress test
- Comparison with previous runs
- Export JSON report
- Show draw calls, triangles, textures

---

#### Phase 2: Rendering Optimization

**2.1 Create Instanced Mesh System**

New file: `src/lib/instancedRendering.ts`

```text
Single Draw Call Architecture:
+------------------+
| InstancedMesh    |
+------------------+
| - Courts (100)   | --> 1 draw call
| - Players (400)  | --> 1 draw call  
| - Balls (100)    | --> 1 draw call
| - Court lines    | --> 1 draw call
+------------------+
```

Features:
- `CourtInstanceManager`: Handles all court surfaces in single draw call
- `PlayerInstanceManager`: Up to 400 players (100 courts x 4) in single draw call
- `BallInstanceManager`: Up to 100 balls with trail particles
- Transform matrices stored in `Float32Array` for zero-allocation updates

**2.2 Modify Canvas Configuration**

Update: `src/components/three/HomebaseCanvas.tsx`

Changes:
- Add `frameloop="demand"` option for manual frame control
- Disable antialiasing in ULTRA mode
- Use `powerPreference: "high-performance"`
- Reduce pixel ratio in ULTRA mode: `Math.min(1, window.devicePixelRatio)`
- Remove shadow maps in ULTRA mode

**2.3 Create Single Frame Orchestrator**

New file: `src/hooks/useFrameOrchestrator.ts`

Consolidates ALL animation logic:
- Robot movement
- Player animations
- Ball physics
- Cleanliness updates
- Instance matrix updates

Uses typed arrays and avoids object allocations:
```text
// Pre-allocated buffers
const robotPositions = new Float32Array(MAX_ROBOTS * 3);
const playerMatrices = new Float32Array(MAX_PLAYERS * 16);
const ballPositions = new Float32Array(MAX_BALLS * 6); // pos + velocity
```

---

#### Phase 3: Robot Net Collision Fix

**3.1 Update Pathfinding**

Modify: `src/lib/pathfinding.ts`

New cleaning path algorithm:
```text
Net-Aware Cleaning Path:
+------------------------+
|  ↓  ↓  ↓  ↓  ↓  ↓  ↓  |  1. Clean top half
|  ↑←←←←←←←←←←←←←←←←←↑  |
|========NET==========  |  2. Exit via right side
|  ↓→→→→→→→→→→→→→→→→→↓  |  
|  ↑  ↑  ↑  ↑  ↑  ↑  ↑  |  3. Clean bottom half
+------------------------+
        ↓
   (exit via aisle)
```

Add net zone collision check:
- Net spans from `(courtCenter.x - COURT_WIDTH/2)` to `(courtCenter.x + COURT_WIDTH/2)`
- At Z = `courtCenter.z` (center of court)
- Height from 0 to `NET_HEIGHT_SIDES` (0.91m)
- Robot must navigate around net posts (X = courtEdge +/- 0.1m)

---

#### Phase 4: Gameplay Simulation System

**4.1 Create Game State Store**

New file: `src/stores/gameStore.ts`

```text
Per-Court Game State:
{
  courtId: string,
  teamAScore: number,
  teamBScore: number,
  servingTeam: 'A' | 'B',
  serverNumber: 1 | 2,
  rallyCount: number,
  status: 'waiting' | 'serving' | 'rally' | 'point' | 'game_over',
  ballState: { pos: [x,y,z], vel: [vx,vy,vz], visible: boolean },
  playerStates: [4]{ animState, targetPos, swingPhase }
}
```

**4.2 Create Ball Physics System**

New file: `src/lib/ballPhysics.ts`

Features:
- Pre-computed trajectory arcs (avoid per-frame trig)
- Lookup tables for common shot types:
  - Drive: 15m/s, 0.5m arc
  - Lob: 12m/s, 3m arc  
  - Dink: 5m/s, 0.3m arc
  - Drop: 8m/s, 1.5m arc
- Net clearance check: ball.y at net.z must be > 0.91m
- Bounce damping: 0.7 coefficient
- Out-of-bounds detection

**4.3 Create Player Animation System**

New file: `src/lib/playerAnimations.ts`

State machine:
```text
       ┌─────────────────────────────────────┐
       ↓                                     |
[IDLE] ──serve──> [SERVING] ──hit──> [RALLY] 
   ↑                                    |    
   |                                    ↓    
   └──────────── [CELEBRATE] <──score──┘    
```

Animation data stored in typed arrays:
```text
animationBuffer = Float32Array[playerCount * 8]
  [0]: state (enum)
  [1]: phase (0-1 progress)
  [2]: targetX
  [3]: targetZ
  [4]: facingAngle
  [5]: swingType
  [6]: legPhase
  [7]: reserved
```

**4.4 Create Game Session Component**

New file: `src/components/three/GameSession.tsx`

Features:
- Orchestrates rally simulation per court
- Shot selection AI (weighted random based on court position)
- Miss probability: 10-15% per shot
- Point scoring triggers state transitions
- Connects to instanced rendering system

---

#### Phase 5: Scoreboard System

**5.1 Create 3D Scoreboard**

New file: `src/components/three/Scoreboard3D.tsx`

Implementation:
- Uses `@react-three/drei` `<Billboard>` for camera-facing
- Canvas2D texture for text (single draw call)
- Pre-rendered score textures (0-15 for each digit)
- Updates only when score changes (not every frame)

Display format (Traditional Pickleball):
```text
+---------------------------+
|      COURT 1-1            |
+---------------------------+
|   TEAM A    |   TEAM B    |
|     7       |      5      |
|  (Serving)  |             |
+---------------------------+
|   Server: 2 |  Rally: 12  |
+---------------------------+
```

Scoring rules implemented:
- Games to 11, win by 2
- Only serving team can score
- Side-out on receiver point
- Server number (1 or 2) for doubles

---

#### Phase 6: Visual Quality (Performance-Aware)

**6.1 Create Visual Effects Manager**

New file: `src/lib/visualEffects.ts`

Tier-based effects:
- ULTRA: No VFX
- HIGH: Ball trail (3 instances), impact dust (5 particles)
- NORMAL: Full trails, particles, bloom, ambient occlusion

**6.2 Ball Trail System**

Using instanced rendering:
- 3-5 trail positions stored in ring buffer
- Opacity decreases with age
- Single draw call for all trails

**6.3 Impact Particles**

Object pool pattern:
- Pre-allocate 50 particle instances
- Recycle on completion
- Position updates via instance matrix

---

### File Changes Summary

| File | Status | Description |
|------|--------|-------------|
| `src/stores/performanceStore.ts` | NEW | FPS tracking, RALPH loop, benchmarking |
| `src/stores/gameStore.ts` | NEW | Per-court game state, scores, rally status |
| `src/types/game.ts` | NEW | Game simulation types |
| `src/types/performance.ts` | NEW | Performance tier types |
| `src/lib/instancedRendering.ts` | NEW | InstancedMesh managers |
| `src/lib/ballPhysics.ts` | NEW | Trajectory calculation |
| `src/lib/playerAnimations.ts` | NEW | Animation state machine |
| `src/lib/visualEffects.ts` | NEW | VFX manager |
| `src/lib/pathfinding.ts` | MODIFY | Net collision avoidance |
| `src/hooks/useFrameOrchestrator.ts` | NEW | Consolidated frame loop |
| `src/components/ui/FPSCounter.tsx` | NEW | FPS overlay |
| `src/components/ui/PerformanceDashboard.tsx` | NEW | Benchmark UI |
| `src/components/three/GameSession.tsx` | NEW | Rally orchestration |
| `src/components/three/Scoreboard3D.tsx` | NEW | 3D scoreboard |
| `src/components/three/PickleballBall.tsx` | NEW | Ball with physics |
| `src/components/three/PlayerInstanced.tsx` | NEW | Instanced players |
| `src/components/three/HomebaseCanvas.tsx` | MODIFY | Performance optimizations |
| `src/components/three/Player.tsx` | MODIFY | Remove individual useFrame |
| `src/components/three/CleaningRobotCC1.tsx` | MODIFY | Remove individual useFrame |
| `src/components/three/SelectableCourt.tsx` | MODIFY | Pool materials, share geometry |

---

### Benchmark Targets

| Scenario | Courts | Players | Robots | Target FPS |
|----------|--------|---------|--------|------------|
| Minimal | 1 | 4 | 1 | 1000+ |
| Small | 6 | 24 | 1 | 1000+ |
| Medium | 20 | 80 | 2 | 500+ |
| Large | 50 | 200 | 5 | 240+ |
| Stress | 100 | 400 | 10 | 120+ |

---

### RALPH Analytics Storage Schema

```text
LocalStorage: 'perf-analytics'
{
  sessions: [
    {
      id: string,
      timestamp: number,
      duration: number,
      config: { courts, players, robots, tier },
      metrics: {
        avgFps: number,
        minFps: number,
        maxFps: number,
        p1Low: number,    // 1% low
        p01Low: number,   // 0.1% low
        frameDrops: number,
        avgFrameTime: number,
        maxFrameTime: number
      }
    }
  ],
  regressions: [
    {
      detectedAt: timestamp,
      baseline: metrics,
      current: metrics,
      delta: percentage
    }
  ]
}
```

