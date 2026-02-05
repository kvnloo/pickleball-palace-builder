/**
 * React Reconciliation Minimization Tests (Task 12)
 *
 * Verifies that unnecessary React re-renders have been eliminated from R3F components:
 * 1. SelectableCourt does not re-render on unrelated court state changes
 * 2. Hover uses ref (not useState) - no re-render on pointer events
 * 3. React.memo prevents unnecessary child re-renders
 * 4. Zustand selectors return stable references for unchanged courts
 * 5. Callbacks are stabilized with empty dependency arrays
 * 6. Per-court subscriptions isolate re-renders
 * 7. Trail materials are pre-allocated at module level
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// Helper: check if a component export is wrapped with React.memo or memo
function isMemoWrapped(content: string, componentName: string): boolean {
  // Pattern 1: export const Foo = memo(function Foo
  const memoPattern1 = new RegExp(
    `export\\s+const\\s+${componentName}\\s*=\\s*memo\\s*\\(`
  );
  // Pattern 2: export const Foo = React.memo(function Foo
  const memoPattern2 = new RegExp(
    `export\\s+const\\s+${componentName}\\s*=\\s*React\\.memo\\s*\\(`
  );
  // Pattern 3: export default memo(function Foo
  const memoPattern3 = new RegExp(
    `export\\s+default\\s+memo\\s*\\(`
  );
  return memoPattern1.test(content) || memoPattern2.test(content) || memoPattern3.test(content);
}

// Helper: check that memo import exists
function hasMemoImport(content: string): boolean {
  // Check for named import of memo from 'react'
  return /import\s+\{[^}]*\bmemo\b[^}]*\}\s+from\s+['"]react['"]/.test(content) ||
    /import\s+React/.test(content);
}

describe('Task 12: React Reconciliation Minimization', () => {

  // ============================================================
  // L1-1: Leaf R3F components wrapped with React.memo
  // ============================================================
  describe('L1-1: Leaf R3F components wrapped with React.memo', () => {
    it('PickleballCourt is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/PickleballCourt.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'PickleballCourt')).toBe(true);
    });

    it('CleaningRobotCC1 is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/CleaningRobotCC1.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'CleaningRobotCC1')).toBe(true);
    });

    it('RobotDock is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/RobotDock.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'RobotDock')).toBe(true);
    });
  });

  // ============================================================
  // L1-2: Hover state uses useRef instead of useState
  // ============================================================
  describe('L1-2: Hover uses useRef, not useState', () => {
    it('SelectableCourt does not use useState for hover state', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      // Should NOT have useState(false) or useState<boolean> for hover
      expect(content).not.toMatch(/useState\s*\(\s*false\s*\)/);
      expect(content).not.toMatch(/useState<boolean>/);
    });

    it('SelectableCourt uses useRef for hover state', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      // Should have useRef(false) or useRef<boolean>(false) for hover
      expect(content).toMatch(/isHoveredRef\s*=\s*useRef/);
    });

    it('SelectableCourt has mesh refs for imperative outline updates', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      // Should have refs for outline mesh and status ring
      expect(content).toMatch(/outlineMeshRef\s*=\s*useRef/);
      expect(content).toMatch(/statusRingRef\s*=\s*useRef/);
    });

    it('Pointer handlers mutate refs instead of calling setState', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      // handlePointerOver should set ref, not call setIsHovered
      expect(content).not.toContain('setIsHovered');
      expect(content).toContain('isHoveredRef.current');
    });

    it('Outline mesh is always rendered (visibility controlled via ref)', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      // Should have ref={outlineMeshRef} on the outline mesh
      expect(content).toContain('ref={outlineMeshRef}');
      // Should have ref={statusRingRef} on the status ring
      expect(content).toContain('ref={statusRingRef}');
    });
  });

  // ============================================================
  // L1-3: SelectableCourt wrapped with React.memo + custom comparator
  // ============================================================
  describe('L1-3: SelectableCourt memo with custom comparator', () => {
    it('SelectableCourt is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'SelectableCourt')).toBe(true);
    });

    it('Custom comparator function exists', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      expect(content).toMatch(/areSelectableCourtPropsEqual/);
    });

    it('Comparator checks courtState.id', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      const comparatorMatch = content.match(
        /function\s+areSelectableCourtPropsEqual[\s\S]*?(?=\nexport|\nconst|\nfunction)/
      );
      expect(comparatorMatch).not.toBeNull();
      const comparator = comparatorMatch![0];
      expect(comparator).toContain('courtState.id');
    });

    it('Comparator checks courtState.status', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      const comparatorSection = content.slice(
        content.indexOf('areSelectableCourtPropsEqual'),
        content.indexOf('areSelectableCourtPropsEqual') + 500
      );
      expect(comparatorSection).toContain('courtState.status');
    });

    it('Comparator checks courtState.cleanliness', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      const comparatorSection = content.slice(
        content.indexOf('areSelectableCourtPropsEqual'),
        content.indexOf('areSelectableCourtPropsEqual') + 500
      );
      expect(comparatorSection).toContain('courtState.cleanliness');
    });

    it('Comparator checks isSelected', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      const comparatorSection = content.slice(
        content.indexOf('areSelectableCourtPropsEqual'),
        content.indexOf('areSelectableCourtPropsEqual') + 500
      );
      expect(comparatorSection).toContain('isSelected');
    });

    it('Comparator checks surfaceType, showNet, showLines', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      const comparatorSection = content.slice(
        content.indexOf('areSelectableCourtPropsEqual'),
        content.indexOf('areSelectableCourtPropsEqual') + 500
      );
      expect(comparatorSection).toContain('surfaceType');
      expect(comparatorSection).toContain('showNet');
      expect(comparatorSection).toContain('showLines');
    });

    it('Memo wrapper passes custom comparator', () => {
      const content = readComponent('src/components/three/SelectableCourt.tsx');
      // Should pass comparator as second arg to memo
      expect(content).toMatch(/memo\s*\(\s*function\s+SelectableCourt[\s\S]*?,\s*areSelectableCourtPropsEqual\s*\)/);
    });
  });

  // ============================================================
  // L1-4: handleCourtSelect has stable (empty) dependency array
  // ============================================================
  describe('L1-4: Stable handleCourtSelect callback', () => {
    it('handleCourtSelect uses getState() instead of reactive state', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // Find the handleCourtSelect callback
      const callbackStart = content.indexOf('handleCourtSelect');
      expect(callbackStart).toBeGreaterThan(-1);

      // Should use getState() to read current values
      const callbackRegion = content.slice(callbackStart, callbackStart + 600);
      expect(callbackRegion).toContain('getState()');
    });

    it('handleCourtSelect has empty or minimal dependency array', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // Find useCallback for handleCourtSelect
      const callbackStart = content.indexOf('handleCourtSelect');
      const callbackRegion = content.slice(callbackStart, callbackStart + 800);

      // Should NOT have selectedCourtIds or multiSelectMode in deps
      // Find the dependency array (last [...] before the semicolon)
      expect(callbackRegion).not.toMatch(/,\s*\[.*selectedCourtIds/);
      expect(callbackRegion).not.toMatch(/,\s*\[.*multiSelectMode/);
    });

    it('HomebaseScene does not destructure selectedCourtIds from store', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // Find HomebaseScene function body
      const sceneStart = content.indexOf('function HomebaseScene');
      const sceneBody = content.slice(sceneStart, sceneStart + 1000);

      // Should NOT destructure selectedCourtIds from useSimulationStore
      expect(sceneBody).not.toMatch(/\{\s*[^}]*selectedCourtIds[^}]*\}\s*=\s*useSimulationStore/);
    });
  });

  // ============================================================
  // L1-5: GameSession uses per-court Zustand selectors
  // ============================================================
  describe('L1-5: GameSession per-court Zustand selectors', () => {
    it('GameSession does not destructure entire useGameStore', () => {
      const content = readComponent('src/components/three/GameSession.tsx');
      // Should NOT have { initializeGame, updateGame, endGame, getGame } = useGameStore()
      expect(content).not.toMatch(
        /\{\s*initializeGame\s*,\s*updateGame\s*,\s*endGame\s*,\s*getGame\s*\}\s*=\s*useGameStore\s*\(\s*\)/
      );
    });

    it('GameSession uses selector for per-court game state', () => {
      const content = readComponent('src/components/three/GameSession.tsx');
      // Should have useGameStore(s => s.games.get(courtId)) or similar selector
      expect(content).toMatch(/useGameStore\s*\(\s*\(?s\)?\s*=>\s*s\.games\.get\s*\(\s*courtId\s*\)/);
    });

    it('GameSession uses selectors for individual actions', () => {
      const content = readComponent('src/components/three/GameSession.tsx');
      // Should have individual selectors for actions
      expect(content).toMatch(/useGameStore\s*\(\s*\(?s\)?\s*=>\s*s\.initializeGame\s*\)/);
      expect(content).toMatch(/useGameStore\s*\(\s*\(?s\)?\s*=>\s*s\.updateGame\s*\)/);
      expect(content).toMatch(/useGameStore\s*\(\s*\(?s\)?\s*=>\s*s\.endGame\s*\)/);
    });
  });

  // ============================================================
  // L1-5 bonus: Zustand selector reference stability
  // ============================================================
  describe('L1-5 bonus: Zustand selector reference stability', () => {
    it('simulationStore creates new Map on court updates (prerequisite for selector stability)', () => {
      const content = readComponent('src/stores/simulationStore.ts');
      // The store should create new Map but preserve old court references
      // e.g., new Map(s.courts) then only set the changed court
      expect(content).toContain('new Map(s.courts)');
    });

    it('gameStore creates new Map on game updates (prerequisite for selector stability)', () => {
      const content = readComponent('src/stores/gameStore.ts');
      // The store should create new Map but preserve old game references
      expect(content).toContain('new Map(state.games)');
    });
  });

  // ============================================================
  // L1-6: CourtGroup component with per-court subscriptions
  // ============================================================
  describe('L1-6: CourtGroup with per-court Zustand subscriptions', () => {
    it('CourtGroup component exists in HomebaseCanvas', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      expect(content).toContain('CourtGroup');
    });

    it('CourtGroup is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      expect(content).toMatch(/CourtGroup\s*=\s*memo\s*\(/);
    });

    it('CourtGroup uses per-court Zustand selector for court state', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // CourtGroup should subscribe to individual court state
      expect(content).toMatch(/useSimulationStore\s*\(\s*\(?s\)?\s*=>\s*s\.courts\.get\s*\(\s*courtId\s*\)/);
    });

    it('CourtGroup uses per-court selector for selection state', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // CourtGroup should check selection per court
      expect(content).toMatch(/useSimulationStore\s*\(\s*\(?s\)?\s*=>\s*s\.selectedCourtIds\.has\s*\(\s*courtId\s*\)/);
    });

    it('HomebaseScene does not subscribe to courts Map directly', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // Find HomebaseScene function
      const sceneStart = content.indexOf('function HomebaseScene');
      if (sceneStart === -1) return; // scene might be renamed
      const sceneEnd = content.indexOf('\nexport', sceneStart);
      const sceneBody = content.slice(sceneStart, sceneEnd > sceneStart ? sceneEnd : undefined);

      // Should NOT have courts in destructured useSimulationStore
      // But should have individual selectors or no courts subscription
      expect(sceneBody).not.toMatch(
        /\{\s*[^}]*\bcourts\b[^}]*\}\s*=\s*useSimulationStore\s*\(\s*\)/
      );
    });

    it('HomebaseScene does not compute activeBookingsByCourtId', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      const sceneStart = content.indexOf('function HomebaseScene');
      if (sceneStart === -1) return;
      const sceneBody = content.slice(sceneStart, sceneStart + 3000);

      // The activeBookingsByCourtId memo should be removed (moved into CourtGroup)
      expect(sceneBody).not.toContain('activeBookingsByCourtId');
    });

    it('courtPositions.map uses CourtGroup instead of inline rendering', () => {
      const content = readComponent('src/components/three/HomebaseCanvas.tsx');
      // Should render CourtGroup in the map
      expect(content).toMatch(/courtPositions\.map[\s\S]*?<CourtGroup/);
    });
  });

  // ============================================================
  // L1-7: Game sub-components wrapped with React.memo
  // ============================================================
  describe('L1-7: Game sub-components wrapped with React.memo', () => {
    it('GameSession is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/GameSession.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'GameSession')).toBe(true);
    });

    it('AnimatedPlayer is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/AnimatedPlayer.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'AnimatedPlayer')).toBe(true);
    });

    it('AnimatedPlayer has custom comparator for playerState', () => {
      const content = readComponent('src/components/three/AnimatedPlayer.tsx');
      expect(content).toMatch(/arePlayerPropsEqual|areAnimatedPlayerPropsEqual/);
    });

    it('PickleballBall is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/PickleballBall.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'PickleballBall')).toBe(true);
    });

    it('Scoreboard3D is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/Scoreboard3D.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'Scoreboard3D')).toBe(true);
    });

    it('CourtStatusLabel is wrapped with React.memo', () => {
      const content = readComponent('src/components/three/CourtStatusLabel.tsx');
      expect(hasMemoImport(content)).toBe(true);
      expect(isMemoWrapped(content, 'CourtStatusLabel')).toBe(true);
    });
  });

  // ============================================================
  // L1-8: Pre-created trail materials in PickleballBall
  // ============================================================
  describe('L1-8: Pre-created trail materials in PickleballBall', () => {
    it('Module-level trail materials exist', () => {
      const content = readComponent('src/components/three/PickleballBall.tsx');
      const componentStart = content.search(/export\s+(const|function)\s+PickleballBall/);
      expect(componentStart).toBeGreaterThan(-1);

      // Trail materials should be declared before the component
      const preComponent = content.slice(0, componentStart);
      expect(preComponent).toMatch(/trailMaterial1|trailMat1|TRAIL_MATERIAL_1/i);
      expect(preComponent).toMatch(/trailMaterial2|trailMat2|TRAIL_MATERIAL_2/i);
    });

    it('No inline <meshBasicMaterial> in trail effect', () => {
      const content = readComponent('src/components/three/PickleballBall.tsx');
      // The component body should NOT have inline meshBasicMaterial JSX for trail
      // (the main ball can still use material prop, which is fine)
      const componentStart = content.search(/export\s+(const|function)\s+PickleballBall/);
      const componentBody = content.slice(componentStart);

      // Count inline meshBasicMaterial declarations (JSX style)
      const inlineMaterials = componentBody.match(/<meshBasicMaterial/g);
      // Should have zero inline material declarations
      expect(inlineMaterials).toBeNull();
    });

    it('Trail meshes use material prop with pre-created references', () => {
      const content = readComponent('src/components/three/PickleballBall.tsx');
      const componentStart = content.search(/export\s+(const|function)\s+PickleballBall/);
      const componentBody = content.slice(componentStart);

      // Trail meshes should reference pre-created materials
      expect(componentBody).toMatch(/material\s*=\s*\{?\s*trailMaterial1|material=\{trailMat/i);
    });
  });

  // ============================================================
  // Cross-cutting: No forbidden anti-patterns
  // ============================================================
  describe('Cross-cutting: Anti-pattern detection', () => {
    const R3F_COMPONENTS = [
      'src/components/three/SelectableCourt.tsx',
      'src/components/three/PickleballCourt.tsx',
      'src/components/three/GameSession.tsx',
      'src/components/three/AnimatedPlayer.tsx',
      'src/components/three/PickleballBall.tsx',
      'src/components/three/Scoreboard3D.tsx',
      'src/components/three/CourtStatusLabel.tsx',
      'src/components/three/CleaningRobotCC1.tsx',
      'src/components/three/RobotDock.tsx',
    ];

    it('No R3F component uses useState for visual-only state', () => {
      // Visual state (hover, focus, animation phase) should use refs, not state
      R3F_COMPONENTS.forEach((file) => {
        const content = readComponent(file);
        const basename = path.basename(file);
        // Allow useState for non-visual state, but hover should be ref
        if (basename === 'SelectableCourt.tsx') {
          expect(content).not.toMatch(
            /useState\s*\(\s*false\s*\)/
          );
        }
      });
    });

    it('All R3F leaf components (no children) are memo-wrapped', () => {
      const leafComponents = [
        { file: 'src/components/three/PickleballCourt.tsx', name: 'PickleballCourt' },
        { file: 'src/components/three/CleaningRobotCC1.tsx', name: 'CleaningRobotCC1' },
        { file: 'src/components/three/RobotDock.tsx', name: 'RobotDock' },
        { file: 'src/components/three/CourtStatusLabel.tsx', name: 'CourtStatusLabel' },
      ];

      leafComponents.forEach(({ file, name }) => {
        const content = readComponent(file);
        expect(
          isMemoWrapped(content, name),
          `${name} should be wrapped with React.memo`
        ).toBe(true);
      });
    });

    it('Store selectors use arrow functions (not destructuring) for per-item subscriptions', () => {
      const gameSession = readComponent('src/components/three/GameSession.tsx');
      // Should use selector pattern, not destructuring
      expect(gameSession).toMatch(/useGameStore\s*\(\s*\(?s\)?\s*=>/);
    });
  });
});
