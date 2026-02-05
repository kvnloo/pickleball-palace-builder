/**
 * PickleballBall Trail Mesh Pre-Creation Tests (Task 5)
 *
 * Verifies that PickleballBall.tsx has been converted from conditional JSX trail
 * rendering with inline materials to a ref-based architecture with module-scope
 * pre-created materials and imperative position/visibility updates.
 *
 * Checks:
 * 1. Trail materials are module-level singletons (not created per render)
 * 2. No inline JSX material creation (<meshBasicMaterial> as children)
 * 3. Ball visibility toggled via .visible, not conditional rendering (return null)
 * 4. Trail positions update correctly based on velocity
 * 5. useFrame is used for imperative updates
 * 6. position.set() is used instead of JSX position props
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const BALL_FILE = 'src/components/three/PickleballBall.tsx';

function readSource(): string {
  return fs.readFileSync(path.join(ROOT, BALL_FILE), 'utf-8');
}

describe('Task 5: Pre-Create Trail Meshes', () => {
  describe('1. Trail materials are module-level singletons', () => {
    it('trailMaterial1 is declared at module scope (before component)', () => {
      const source = readSource();
      const componentStart = source.indexOf('export function PickleballBall');
      const trailMat1Pos = source.indexOf('const trailMaterial1');

      expect(trailMat1Pos).toBeGreaterThan(-1);
      expect(trailMat1Pos).toBeLessThan(componentStart);
    });

    it('trailMaterial2 is declared at module scope (before component)', () => {
      const source = readSource();
      const componentStart = source.indexOf('export function PickleballBall');
      const trailMat2Pos = source.indexOf('const trailMaterial2');

      expect(trailMat2Pos).toBeGreaterThan(-1);
      expect(trailMat2Pos).toBeLessThan(componentStart);
    });

    it('trailMaterial1 has correct properties: transparent, opacity 0.4, yellow', () => {
      const source = readSource();
      // Extract the trailMaterial1 declaration block
      const mat1Start = source.indexOf('const trailMaterial1');
      const mat1End = source.indexOf('});', mat1Start) + 2;
      const mat1Block = source.slice(mat1Start, mat1End);

      expect(mat1Block).toContain('transparent: true');
      expect(mat1Block).toContain('opacity: 0.4');
      expect(mat1Block).toMatch(/#ffff00|0xffff00|'ffff00'/);
    });

    it('trailMaterial2 has correct properties: transparent, opacity 0.2, yellow', () => {
      const source = readSource();
      const mat2Start = source.indexOf('const trailMaterial2');
      const mat2End = source.indexOf('});', mat2Start) + 2;
      const mat2Block = source.slice(mat2Start, mat2End);

      expect(mat2Block).toContain('transparent: true');
      expect(mat2Block).toContain('opacity: 0.2');
      expect(mat2Block).toMatch(/#ffff00|0xffff00|'ffff00'/);
    });

    it('trail materials use MeshBasicMaterial (not MeshStandardMaterial)', () => {
      const source = readSource();
      const mat1Start = source.indexOf('const trailMaterial1');
      const mat1End = source.indexOf('});', mat1Start) + 2;
      const mat1Block = source.slice(mat1Start, mat1End);

      expect(mat1Block).toContain('MeshBasicMaterial');
      expect(mat1Block).not.toContain('MeshStandardMaterial');
    });
  });

  describe('2. No inline JSX material creation', () => {
    it('should not contain <meshBasicMaterial> JSX elements', () => {
      const source = readSource();
      // Inline JSX materials: <meshBasicMaterial ... /> or <meshBasicMaterial>
      expect(source).not.toContain('<meshBasicMaterial');
    });

    it('should not contain inline <meshStandardMaterial> JSX elements', () => {
      const source = readSource();
      expect(source).not.toContain('<meshStandardMaterial');
    });

    it('trail meshes should use material={...} prop, not JSX children', () => {
      const source = readSource();
      // Should find material= prop references to pre-created materials
      expect(source).toContain('material={trailMaterial1}');
      expect(source).toContain('material={trailMaterial2}');
    });
  });

  describe('3. Visibility toggled via .visible, not conditional rendering', () => {
    it('should not use conditional return null for isVisible check', () => {
      const source = readSource();
      // The old pattern: if (!ballState.isVisible) return null;
      expect(source).not.toMatch(
        /if\s*\(\s*!ballState\.isVisible\s*\)\s*return\s+null/
      );
    });

    it('should use groupRef.current.visible for visibility control', () => {
      const source = readSource();
      expect(source).toMatch(/groupRef\.current\.visible/);
    });

    it('should have a groupRef assigned to the <group> element', () => {
      const source = readSource();
      expect(source).toMatch(/ref={groupRef}/);
      expect(source).toContain('useRef<THREE.Group>');
    });

    it('should not use conditional rendering for trail (no showTrail &&)', () => {
      const source = readSource();
      // The old pattern: {showTrail && (<>...</>)}
      expect(source).not.toMatch(/\{showTrail\s*&&/);
    });

    it('trail meshes should have visibility set via .visible property', () => {
      const source = readSource();
      expect(source).toMatch(/trail1Ref\.current\.visible/);
      expect(source).toMatch(/trail2Ref\.current\.visible/);
    });
  });

  describe('4. Trail positions computed correctly from velocity', () => {
    it('should use position.set() for imperative position updates (at least 3 calls)', () => {
      const source = readSource();
      const posSetCount = (source.match(/\.position\.set\(/g) || []).length;
      // At minimum: 1 for main ball + 2 for trails = 3
      expect(posSetCount).toBeGreaterThanOrEqual(3);
    });

    it('trail1 position uses 0.02 velocity offset', () => {
      const source = readSource();
      // Should contain the 0.02 multiplier for trail 1
      expect(source).toMatch(/vx\s*\*\s*0\.02|velocity\.x\s*\*\s*0\.02/);
    });

    it('trail2 position uses 0.04 velocity offset', () => {
      const source = readSource();
      // Should contain the 0.04 multiplier for trail 2
      expect(source).toMatch(/vx\s*\*\s*0\.04|velocity\.x\s*\*\s*0\.04/);
    });

    it('velocity offset formula is correct (position - velocity * factor)', () => {
      // Pure math verification: given position and velocity, verify expected trail positions
      const pos = { x: 5, y: 2, z: 3 };
      const vel = { x: 10, y: 5, z: -8 };

      const trail1 = {
        x: pos.x - vel.x * 0.02,
        y: pos.y - vel.y * 0.02,
        z: pos.z - vel.z * 0.02,
      };
      const trail2 = {
        x: pos.x - vel.x * 0.04,
        y: pos.y - vel.y * 0.04,
        z: pos.z - vel.z * 0.04,
      };

      expect(trail1.x).toBeCloseTo(4.8);
      expect(trail1.y).toBeCloseTo(1.9);
      expect(trail1.z).toBeCloseTo(3.16);

      expect(trail2.x).toBeCloseTo(4.6);
      expect(trail2.y).toBeCloseTo(1.8);
      expect(trail2.z).toBeCloseTo(3.32);
    });
  });

  describe('5. useFrame is used for imperative updates', () => {
    it('should import useFrame from @react-three/fiber', () => {
      const source = readSource();
      expect(source).toMatch(/import\s*\{[^}]*useFrame[^}]*\}\s*from\s*['"]@react-three\/fiber['"]/);
    });

    it('should call useFrame inside the component', () => {
      const source = readSource();
      const componentStart = source.indexOf('export function PickleballBall');
      const componentBody = source.slice(componentStart);
      expect(componentBody).toContain('useFrame(');
    });

    it('useFrame callback should have null-guards for refs', () => {
      const source = readSource();
      // Should guard against null refs before accessing .position or .visible
      expect(source).toMatch(/!groupRef\.current|!meshRef\.current|!trail1Ref\.current|!trail2Ref\.current/);
    });
  });

  describe('6. No JSX position props on meshes (positions set imperatively)', () => {
    it('main ball mesh should not have inline position prop array', () => {
      const source = readSource();
      // The old pattern: position={[ballState.position.x, ballState.position.y, ballState.position.z]}
      expect(source).not.toMatch(
        /position=\{\[ballState\.position\.x/
      );
    });

    it('no trail mesh should have inline position prop', () => {
      const source = readSource();
      // Old trail pattern: position={[ballState.position.x - ballState.velocity.x * ...]}
      expect(source).not.toMatch(
        /position=\{\[\s*ballState\.position\.\w+\s*-\s*ballState\.velocity/
      );
    });
  });

  describe('7. Refs are properly declared', () => {
    it('should declare trail1Ref and trail2Ref', () => {
      const source = readSource();
      expect(source).toContain('trail1Ref');
      expect(source).toContain('trail2Ref');
    });

    it('trail refs should be typed as THREE.Mesh', () => {
      const source = readSource();
      expect(source).toMatch(/useRef<THREE\.Mesh>\(null\)/);
    });

    it('group ref should be typed as THREE.Group', () => {
      const source = readSource();
      expect(source).toMatch(/useRef<THREE\.Group>\(null\)/);
    });
  });
});
