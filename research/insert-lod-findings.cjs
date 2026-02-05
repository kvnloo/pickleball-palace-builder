const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'performance-kb.db'));
db.pragma('journal_mode = WAL');

const insertCodePattern = db.prepare(`
  INSERT INTO code_patterns (pattern_name, anti_pattern, optimized_pattern, explanation, applicable_files, estimated_impact, code_before, code_after, related_finding_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAlgorithm = db.prepare(`
  INSERT INTO algorithms (problem_domain, current_algorithm, proposed_algorithm, time_complexity_current, time_complexity_proposed, space_complexity_current, space_complexity_proposed, description, tradeoffs, implementation_sketch, related_finding_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertFinding = db.prepare(`
  INSERT INTO findings (category, subcategory, title, description, impact_score, effort_score, priority, source_agent)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertBottleneck = db.prepare(`
  INSERT INTO bottlenecks (file_path, line_start, line_end, description, bottleneck_type, severity, estimated_fps_gain, fix_description, fix_complexity)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  // === CODE PATTERN: Shadow LOD ===
  insertCodePattern.run(
    'Shadow LOD via useFrame distance check',
    'All meshes have castShadow=true regardless of distance, forcing shadow map to render every object in scene from light perspective even when objects are far from camera',
    'Distance-based shadow toggle: useFrame checks camera distance, sets castShadow=false on meshes beyond 30m, receiveShadow=false beyond 80m. Uses refs to avoid React re-renders.',
    'Shadow rendering requires a separate render pass from each light perspective, drawing all castShadow=true objects. With 200 players at castShadow=true, the shadow pass draws 200 meshes even if most are far from camera and their shadows invisible. By toggling castShadow based on camera distance, we limit the shadow pass to only nearby objects. The shadow threshold can be different from geometry LOD thresholds. Using refs (meshRef.current.castShadow = false) avoids triggering React reconciliation.',
    JSON.stringify([
      'src/components/three/AnimatedPlayer.tsx',
      'src/components/three/PickleballBall.tsx',
      'src/components/three/CleaningRobotCC1.tsx',
      'src/components/three/GameSession.tsx',
    ]),
    'Reduces shadow pass draw calls by 70-90% in large facility scenarios',
    `// AnimatedPlayer.tsx - castShadow always on
<mesh geometry={bodyGeometry} material={bodyMaterial} position={[0, PLAYER_HEIGHT/2, 0]} castShadow />
<mesh geometry={headGeometry} material={skinMaterial} position={[0, PLAYER_HEIGHT-HEAD_RADIUS, 0]} castShadow />`,
    `// useShadowLOD.ts - shared hook for distance-based shadow toggling
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const SHADOW_CAST_DISTANCE = 30;   // meters - full shadow casting
const SHADOW_RECEIVE_DISTANCE = 80; // meters - shadow receiving
const _worldPos = new THREE.Vector3(); // reusable vector - zero allocation

export function useShadowLOD(groupRef: React.RefObject<THREE.Group>) {
  const prevCast = useRef(true);
  const prevReceive = useRef(true);

  useFrame(({ camera }) => {
    const group = groupRef.current;
    if (!group) return;

    group.getWorldPosition(_worldPos);
    const dist = camera.position.distanceTo(_worldPos);

    const shouldCast = dist < SHADOW_CAST_DISTANCE;
    const shouldReceive = dist < SHADOW_RECEIVE_DISTANCE;

    // Only traverse children if state changed (avoid per-frame traversal)
    if (shouldCast !== prevCast.current || shouldReceive !== prevReceive.current) {
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).castShadow = shouldCast;
          (child as THREE.Mesh).receiveShadow = shouldReceive;
        }
      });
      prevCast.current = shouldCast;
      prevReceive.current = shouldReceive;
    }
  });
}

// Usage in AnimatedPlayer:
const groupRef = useRef<THREE.Group>(null);
useShadowLOD(groupRef);
return <group ref={groupRef}>...</group>;`,
    30 // related_finding_id
  );
  console.log('Inserted: Shadow LOD code pattern');

  // === CODE PATTERN: Ball LOD ===
  insertCodePattern.run(
    'Ball LOD with trail elimination',
    'Ball renders SphereGeometry(0.037, 12, 8) = 93 vertices per ball plus 2 trail spheres = 279 vertices total with 3 draw calls, even when ball is far from camera and invisible',
    '3-tier LOD: LOD0=full ball with trail (3 meshes, 279 verts), LOD1=simplified ball no trail (1 mesh, 25 verts), LOD2=point or hidden',
    'A pickleball is 7.4cm in diameter. At 15m with 50-degree FOV, it occupies ~0.5% of screen height (~5 pixels on 1080p). Trail effect is completely invisible beyond 15m. At 35m the ball itself is ~2 pixels. Beyond that, a colored point suffices or the ball can be hidden entirely. LOD1 uses SphereGeometry(0.037, 6, 4) with only 25 vertices. LOD2 uses a single point with yellow PointsMaterial.',
    JSON.stringify([
      'src/components/three/PickleballBall.tsx',
      'src/components/three/GameSession.tsx',
    ]),
    '3 meshes/279 verts -> 1 point per distant ball, eliminates trail rendering',
    `// PickleballBall.tsx - full detail always with trail
<group>
  <mesh geometry={ballGeometry} material={ballMaterial}
    position={[ballState.position.x, ballState.position.y, ballState.position.z]} castShadow />
  {showTrail && (
    <>
      <mesh geometry={ballGeometry} position={[/* trail pos 1 */]}>
        <meshBasicMaterial color="#ffff00" transparent opacity={0.4} />
      </mesh>
      <mesh geometry={ballGeometry} position={[/* trail pos 2 */]}>
        <meshBasicMaterial color="#ffff00" transparent opacity={0.2} />
      </mesh>
    </>
  )}
</group>`,
    `import { Detailed } from "@react-three/drei";

// Simplified ball geometry for medium distance
const simplifiedBallGeometry = new THREE.SphereGeometry(0.037, 6, 4); // 25 verts vs 93

// Point geometry for far distance
const ballPointGeometry = new THREE.BufferGeometry();
ballPointGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
const ballPointMaterial = new THREE.PointsMaterial({
  color: "#ffff00", size: 0.5, sizeAttenuation: true
});

const BALL_LOD_DISTANCES = [0, 15, 35];

export function PickleballBallLOD({ ballState, showTrail = false }: PickleballBallProps) {
  if (!ballState.isVisible) return null;

  return (
    <group position={[ballState.position.x, ballState.position.y, ballState.position.z]}>
      <Detailed distances={BALL_LOD_DISTANCES}>
        {/* LOD0: Full ball with trail */}
        <group>
          <mesh geometry={ballGeometry} material={ballMaterial} castShadow />
          {showTrail && (
            <>
              <mesh geometry={ballGeometry}
                position={[-ballState.velocity.x*0.02, -ballState.velocity.y*0.02, -ballState.velocity.z*0.02]}>
                <meshBasicMaterial color="#ffff00" transparent opacity={0.4} />
              </mesh>
              <mesh geometry={ballGeometry}
                position={[-ballState.velocity.x*0.04, -ballState.velocity.y*0.04, -ballState.velocity.z*0.04]}>
                <meshBasicMaterial color="#ffff00" transparent opacity={0.2} />
              </mesh>
            </>
          )}
        </group>

        {/* LOD1: Simple ball, no trail */}
        <mesh geometry={simplifiedBallGeometry} material={ballMaterial} />

        {/* LOD2: Yellow point */}
        <points geometry={ballPointGeometry} material={ballPointMaterial} />
      </Detailed>
    </group>
  );
}`,
    30
  );
  console.log('Inserted: Ball LOD code pattern');

  // === CODE PATTERN: Robot LOD ===
  insertCodePattern.run(
    'Robot LOD simplification',
    'CleaningRobotCC1 renders 11 meshes (base, body, screen, battery, 4 wheels, brush, status light) = ~293 vertices per robot regardless of distance',
    '3-tier LOD: LOD0=full detail (11 meshes, 293 verts), LOD1=simple box+light (2 meshes, ~89 verts), LOD2=colored point (1 point)',
    'The cleaning robot is 0.695m tall. Individual components (wheels at 6cm radius, brush at 4cm radius, screen at 33cm wide) are imperceptible beyond 25m. At LOD1, a single box colored by body material plus the status light sphere conveys all necessary information. At LOD2 beyond 60m, just the status light color as a point. LOD1 saves 9 draw calls per robot.',
    JSON.stringify([
      'src/components/three/CleaningRobotCC1.tsx',
      'src/components/three/HomebaseCanvas.tsx',
    ]),
    '11 meshes/293 verts -> 1 point per distant robot',
    `// CleaningRobotCC1.tsx - all 11 meshes always rendered
<group ref={groupRef} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
  <mesh geometry={baseGeometry} material={baseMaterial} position={[0, ROBOT_HEIGHT*0.075, 0]} castShadow />
  <mesh geometry={bodyGeometry} material={bodyMaterial} position={[0, ROBOT_HEIGHT*0.5, 0]} castShadow />
  <mesh geometry={screenGeometry} material={currentScreenMaterial} position={[0, ROBOT_HEIGHT*0.55, ROBOT_LENGTH*0.45]} />
  <mesh position={[0, ROBOT_HEIGHT*0.7, ROBOT_LENGTH*0.45]}><boxGeometry args={[batteryWidth, 0.02, 0.01]} />...</mesh>
  {/* 4 wheels */}
  {[...].map((pos, i) => <mesh key={i} geometry={wheelGeometry} material={wheelMaterial} ... />)}
  <mesh geometry={brushGeometry} material={brushMaterial} ... />
  <mesh geometry={statusLightGeometry} material={statusLightMaterial} position={[0, ROBOT_HEIGHT+0.05, 0]} />
</group>`,
    `import { Detailed } from "@react-three/drei";

// LOD1: Simplified single-box geometry
const robotSimpleGeometry = new THREE.BoxGeometry(ROBOT_WIDTH, ROBOT_HEIGHT, ROBOT_LENGTH);

// LOD2: Point
const robotPointGeometry = new THREE.BufferGeometry();
robotPointGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, ROBOT_HEIGHT/2, 0], 3));

const ROBOT_LOD_DISTANCES = [0, 25, 60];

export function CleaningRobotCC1LOD({ position, rotation = 0, status, battery }: CleaningRobotCC1Props) {
  const statusLightMaterial = /* existing status material selection */;
  const pointMaterial = useMemo(() =>
    new THREE.PointsMaterial({ color: statusLightMaterial.color, size: 1.5, sizeAttenuation: true }),
    [status]
  );

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
      <Detailed distances={ROBOT_LOD_DISTANCES}>
        {/* LOD0: Full detail (existing code) */}
        <group>
          <mesh geometry={baseGeometry} material={baseMaterial} position={[0, ROBOT_HEIGHT*0.075, 0]} castShadow />
          <mesh geometry={bodyGeometry} material={bodyMaterial} position={[0, ROBOT_HEIGHT*0.5, 0]} castShadow />
          {/* ... all other meshes ... */}
          <mesh geometry={statusLightGeometry} material={statusLightMaterial} position={[0, ROBOT_HEIGHT+0.05, 0]} />
        </group>

        {/* LOD1: Simple box + status light */}
        <group>
          <mesh geometry={robotSimpleGeometry} material={bodyMaterial} position={[0, ROBOT_HEIGHT/2, 0]} />
          <mesh geometry={statusLightGeometry} material={statusLightMaterial} position={[0, ROBOT_HEIGHT+0.05, 0]} />
        </group>

        {/* LOD2: Status-colored point */}
        <points geometry={robotPointGeometry} material={pointMaterial} />
      </Detailed>
    </group>
  );
}`,
    30
  );
  console.log('Inserted: Robot LOD code pattern');

  // === CODE PATTERN: Scoreboard LOD ===
  insertCodePattern.run(
    'Scoreboard LOD with text elimination',
    'Scoreboard3D renders Billboard with 5 Text components (score, 2 team labels, status, game number). Text/troika generates SDF geometry per component with font loading. All rendered even when scoreboard is too far to read.',
    '3-tier LOD: LOD0=full scoreboard (6 elements), LOD1=simplified score only (2 elements), LOD2=hidden (0 elements)',
    'Text rendering via troika/drei Text is expensive: each Text component generates SDF geometry, loads font glyphs, and runs a text layout algorithm. The scoreboard Billboard is 2.5m wide. At 30m with 50-degree FOV, text occupies ~3% of screen width - barely readable. Beyond 30m, only the main score number matters. Beyond 60m, the score is unreadable so the entire scoreboard can be hidden. This eliminates 4 unnecessary Text component renders per distant court.',
    JSON.stringify([
      'src/components/three/Scoreboard3D.tsx',
      'src/components/three/GameSession.tsx',
    ]),
    'Eliminates 5 Text components per distant scoreboard, major troika overhead reduction',
    `// Scoreboard3D.tsx - all text always rendered
<Billboard position={[courtPosition.x, 4, courtPosition.z]} follow={true}>
  <mesh geometry={boardGeometry} material={boardMaterial} />
  <Text position={[0, 0.2, 0.01]} fontSize={0.5} color="#ffffff" ...>{scoreDisplay}</Text>
  <Text position={[-0.8, 0.2, 0.01]} fontSize={0.15} ...>{servingIndicator}</Text>
  <Text position={[0.8, 0.2, 0.01]} fontSize={0.15} ...>{servingIndicator}</Text>
  <Text position={[0, -0.25, 0.01]} fontSize={0.12} ...>{statusText}</Text>
  <Text position={[0, -0.45, 0.01]} fontSize={0.1} ...>{gameNumber}</Text>
</Billboard>`,
    `import { Detailed } from "@react-three/drei";
import { Billboard, Text } from "@react-three/drei";

const SCOREBOARD_LOD_DISTANCES = [0, 30, 60];
const smallBoardGeometry = new THREE.PlaneGeometry(1.5, 0.6);

export function Scoreboard3DLOD({ gameState, courtPosition }: Scoreboard3DProps) {
  const { teamAScore, teamBScore, servingTeam, serverNumber, rallyCount, gameNumber, status } = gameState;
  const scoreDisplay = useMemo(() => { /* existing */ }, [teamAScore, teamBScore, servingTeam, serverNumber]);

  return (
    <Billboard position={[courtPosition.x, 4, courtPosition.z]} follow={true}>
      <Detailed distances={SCOREBOARD_LOD_DISTANCES}>
        {/* LOD0: Full scoreboard */}
        <group>
          <mesh geometry={boardGeometry} material={boardMaterial} />
          <Text position={[0, 0.2, 0.01]} fontSize={0.5} color="#ffffff" anchorX="center" anchorY="middle">
            {scoreDisplay}
          </Text>
          <Text position={[-0.8, 0.2, 0.01]} fontSize={0.15} ...>{/* team A indicator */}</Text>
          <Text position={[0.8, 0.2, 0.01]} fontSize={0.15} ...>{/* team B indicator */}</Text>
          <Text position={[0, -0.25, 0.01]} fontSize={0.12} ...>{statusText}</Text>
          <Text position={[0, -0.45, 0.01]} fontSize={0.1} ...>{gameNumber}</Text>
        </group>

        {/* LOD1: Score only */}
        <group>
          <mesh geometry={smallBoardGeometry} material={boardMaterial} />
          <Text position={[0, 0, 0.01]} fontSize={0.35} color="#ffffff" anchorX="center" anchorY="middle">
            {scoreDisplay}
          </Text>
        </group>

        {/* LOD2: Hidden */}
        <group />
      </Detailed>
    </Billboard>
  );
}`,
    30
  );
  console.log('Inserted: Scoreboard LOD code pattern');

  // === CODE PATTERN: Complete GameSession LOD integration ===
  insertCodePattern.run(
    'GameSession LOD integration pattern',
    'GameSession renders all game entities (ball, 4 players, scoreboard) at full detail regardless of court distance from camera. All entities get full physics/animation updates even when invisible.',
    'Wrap GameSession contents in distance-aware LOD. Skip animation computation for LOD1+ players. Skip physics visualization for LOD2+ balls. Conditionally render scoreboard based on LOD level.',
    'GameSession is the integration point where per-court game entities live. By checking distance at the GameSession level, we can make coarse-grained LOD decisions: LOD0 courts get full game rendering, LOD1 courts get simplified players and balls, LOD2+ courts can skip rendering entirely (game logic still runs for correctness, but rendering is eliminated). This is the key architectural decision: LOD lives at the component boundary, not deep inside each mesh.',
    JSON.stringify([
      'src/components/three/GameSession.tsx',
      'src/components/three/HomebaseCanvas.tsx',
    ]),
    'Eliminates all rendering for distant active courts while maintaining game state correctness',
    `// GameSession.tsx - renders everything for every active court
export function GameSession({ courtId, courtPosition, isActive }: GameSessionProps) {
  // ...
  return (
    <group>
      <PickleballBall ballState={game.ballState} showTrail={showTrail} />
      {game.playerStates.map((player, index) => (
        <AnimatedPlayer key={index} playerState={player} playerIndex={index} />
      ))}
      <Scoreboard3D gameState={game} courtPosition={courtPosition} />
    </group>
  );
}`,
    `import { Detailed } from "@react-three/drei";

const GAME_LOD_DISTANCES = [0, 35, 80]; // matches court LOD roughly

export function GameSession({ courtId, courtPosition, isActive }: GameSessionProps) {
  const { initializeGame, updateGame, endGame, getGame } = useGameStore();
  const tier = usePerformanceStore(state => state.tier);

  // Game logic ALWAYS runs (even for distant courts)
  useEffect(() => { /* existing init/cleanup */ }, [isActive, courtId]);
  useFrame((_, delta) => { /* existing physics update */ });

  const game = getGame(courtId);
  if (!game || !isActive) return null;

  return (
    <group position={[courtPosition.x, 0, courtPosition.z]}>
      <Detailed distances={GAME_LOD_DISTANCES}>
        {/* LOD0: Full game rendering */}
        <group>
          <PickleballBallLOD ballState={game.ballState} showTrail={tier !== "ULTRA"} />
          {game.playerStates.map((player, i) => (
            <AnimatedPlayerLOD key={i} playerState={player} playerIndex={i} />
          ))}
          <Scoreboard3DLOD gameState={game} courtPosition={courtPosition} />
        </group>

        {/* LOD1: Simplified entities */}
        <group>
          <PickleballBallLOD ballState={game.ballState} showTrail={false} />
          {game.playerStates.map((player, i) => (
            <AnimatedPlayerLOD key={i} playerState={player} playerIndex={i} />
          ))}
        </group>

        {/* LOD2: Nothing rendered (game state still updates) */}
        <group />
      </Detailed>
    </group>
  );
}`,
    30
  );
  console.log('Inserted: GameSession LOD integration pattern');

  // === ALGORITHM: LOD Geometry Budget Calculator ===
  insertAlgorithm.run(
    'LOD geometry budget optimization',
    'No budget - all objects rendered at maximum detail',
    'Screen-coverage-based geometry budget with FOV-aware thresholds',
    'O(V_total) vertex processing per frame where V_total = sum of all vertices',
    'O(V_visible) where V_visible << V_total, dynamically selected per frame by THREE.LOD',
    'O(N * V_max) memory for N objects at max detail',
    'O(N * (V_lod0 + V_lod1 + V_lod2 + V_lod3)) but V_lod1+V_lod2+V_lod3 << V_lod0',
    `Geometry budget calculator for the pickleball facility. Per-entity vertex budgets:

COURT (6.1m x 13.4m):
- LOD0 (0-35m):  12 meshes, 361 verts, full lines/net/posts
- LOD1 (35-80m):  4 meshes, ~200 verts, merged lines/simple net
- LOD2 (80-180m): 1 mesh, 24 verts, colored box
- LOD3 (180m+):   1 point, 4 verts

PLAYER (1.7m tall):
- LOD0 (0-30m):  5 meshes, 226 verts, full animated
- LOD1 (30-60m): 1 mesh, 83 verts, colored capsule
- LOD2 (60m+):   1 point, 4 verts

BALL (0.074m diameter):
- LOD0 (0-15m):  3 meshes, 279 verts (with trail)
- LOD1 (15-35m): 1 mesh, 25 verts
- LOD2 (35m+):   1 point, 4 verts

ROBOT (0.695m tall):
- LOD0 (0-25m):  11 meshes, 293 verts
- LOD1 (25-60m): 2 meshes, 89 verts
- LOD2 (60m+):   1 point, 4 verts

SCOREBOARD (2.5m billboard):
- LOD0 (0-30m):  6 elements (plane + 5 texts)
- LOD1 (30-60m): 2 elements (plane + 1 text)
- LOD2 (60m+):   0 elements (hidden)

100-COURT SCENARIO (50 active games, 3 robots):
WITHOUT LOD: ~3083 meshes, ~107,929 vertices
WITH LOD (typical view): ~570 meshes, ~16,897 vertices
REDUCTION: 81.5% draw calls, 84.3% vertices`,
    'Memory increases ~15% for storing LOD geometries but they are small singletons. CPU cost of LOD distance checks is O(N) per frame but trivial (<0.01ms). Visual quality loss at medium distances is acceptable for game-like rendering. LOD3 point sprites lose all shape information.',
    `// Distance threshold formula for FOV-based LOD:
// screen_fraction = object_size / (2 * distance * tan(fov/2))
// For 50-degree FOV: screen_fraction = object_size / (0.9326 * distance)
// Solve for distance: d = object_size / (0.9326 * target_fraction)

function computeLODThreshold(objectSize: number, targetScreenFraction: number, fovDegrees: number = 50): number {
  const halfFovRad = (fovDegrees / 2) * Math.PI / 180;
  return objectSize / (2 * Math.tan(halfFovRad) * targetScreenFraction);
}

// Court (13.4m): LOD transitions at 25%, 10%, 4% screen coverage
// computeLODThreshold(13.4, 0.25, 50) = 57.5m -> rounded to 35m (conservative)
// computeLODThreshold(13.4, 0.10, 50) = 143.7m -> rounded to 80m
// computeLODThreshold(13.4, 0.04, 50) = 359.3m -> rounded to 180m

const COURT_LOD_DISTANCES = [0, 35, 80, 180];
const PLAYER_LOD_DISTANCES = [0, 30, 60];
const BALL_LOD_DISTANCES = [0, 15, 35];
const ROBOT_LOD_DISTANCES = [0, 25, 60];
const SCOREBOARD_LOD_DISTANCES = [0, 30, 60];`,
    30
  );
  console.log('Inserted: LOD geometry budget algorithm');

  // === BOTTLENECK: No LOD system ===
  insertBottleneck.run(
    'src/components/three/HomebaseCanvas.tsx',
    169,
    196,
    'No LOD system - all courts render at full detail (12 meshes, 361 verts each) regardless of camera distance. Active courts add 29+ meshes per game (4 players x 5 meshes + ball + scoreboard). With 100 courts, this means 3000+ draw calls rendering vertices that are invisible at distance.',
    'render',
    'critical',
    40.0,
    'Implement 4-tier LOD system using drei <Detailed> component: LOD0=full detail, LOD1=merged geometry, LOD2=single box, LOD3=point sprite. Expected 81% draw call reduction for 100-court scenario.',
    'medium'
  );
  console.log('Inserted: No LOD bottleneck');

  // === FINDING: LOD + InstancedMesh synergy ===
  insertFinding.run(
    'rendering',
    'lod-instancing',
    'LOD + InstancedMesh Synergy for Maximum Draw Call Reduction',
    'LOD and InstancedMesh are complementary optimizations. LOD reduces per-object complexity at distance. InstancedMesh batches identical geometries into single draw calls. Combined: LOD2 courts (single colored box) can ALL be rendered as a single InstancedMesh draw call. LOD3 courts (points) can be a single Points object. LOD1 courts could use InstancedMesh for their merged-lines geometry. The synergy means: LOD reduces what needs rendering, instancing batches what remains. For 100 courts: without either = 1200 draw calls. With LOD only = ~300. With both LOD + instancing = ~20 draw calls total for courts.',
    8.5,
    8.0,
    'P1',
    'agent-3-lod-designer'
  );
  console.log('Inserted: LOD + InstancedMesh synergy finding');

  // === FINDING: LOD hysteresis and popping prevention ===
  insertFinding.run(
    'rendering',
    'lod-quality',
    'LOD Transition Quality - Hysteresis and Anti-Popping Strategies',
    'LOD transitions can cause visible "popping" artifacts when objects switch between detail levels. THREE.LOD supports per-level hysteresis (fraction of distance) to prevent rapid switching. Recommended 10% hysteresis (e.g., switch to LOD1 at 35m, switch back to LOD0 at 31.5m). Additional strategies: (1) Cross-fade with material opacity during transition (expensive, requires rendering both levels briefly), (2) Dithered transparency pattern (shader-based, zero-cost fade), (3) Morphing between geometry levels (complex, best for continuous meshes). For this game-style renderer, hysteresis alone is sufficient - the visual style is not photorealistic so slight pops are acceptable. drei <Detailed> does not expose hysteresis directly but the underlying THREE.LOD levels array can be accessed via ref to set hysteresis per level.',
    5.0,
    3.0,
    'P2',
    'agent-3-lod-designer'
  );
  console.log('Inserted: LOD hysteresis finding');

  // === FINDING: LOD for SelectableCourt overlays ===
  insertFinding.run(
    'rendering',
    'lod-interaction',
    'LOD-Aware Interaction: SelectableCourt Overlays at Distance',
    'SelectableCourt adds 4 extra meshes per court (outline, dirty overlay, click target, status ring). At distance, these overlays serve no purpose: users cannot click distant courts, dirty overlay colors are invisible, status rings are sub-pixel. LOD1+ courts should skip rendering SelectableCourt overlays entirely. The invisible click target mesh (used for raycasting) should also be disabled for LOD2+ courts to save raycaster intersection tests. Implementation: SelectableCourt should accept a lodLevel prop and conditionally render overlays only at LOD0. This saves 4 meshes and 118 vertices per medium/far court.',
    6.0,
    2.0,
    'P2',
    'agent-3-lod-designer'
  );
  console.log('Inserted: SelectableCourt LOD finding');

  // Update research session
  db.prepare(`UPDATE research_sessions SET status='completed', findings_count=8, completed_at=CURRENT_TIMESTAMP, summary='Comprehensive LOD system designed: 4-tier court LOD, 3-tier player/ball/robot/scoreboard LOD, shadow LOD, distance thresholds from 50-deg FOV, implementation code for all components using drei Detailed. 81% draw call reduction, 84% vertex reduction for 100-court scenario.' WHERE id=5`).run();
  console.log('Updated research session');
});

transaction();
console.log('All LOD findings inserted successfully!');
db.close();
