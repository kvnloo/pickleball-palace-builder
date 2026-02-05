/**
 * Material Swap Verification Tests (Task 3: MeshLambertMaterial Swap)
 *
 * Verifies that all MeshStandardMaterial instances have been replaced with
 * MeshLambertMaterial across game rendering components, that no PBR-only
 * params (roughness, metalness) remain, and that visual properties are preserved.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// All Three.js component files that should use MeshLambertMaterial
const COMPONENT_FILES = [
  'src/components/three/AnimatedPlayer.tsx',
  'src/components/three/PickleballCourt.tsx',
  'src/components/three/PickleballBall.tsx',
  'src/components/three/HomebaseCanvas.tsx',
  'src/components/three/Player.tsx',
  'src/components/three/CleaningRobotCC1.tsx',
  'src/components/three/RobotDock.tsx',
  'src/components/three/FacilityCanvas.tsx',
];

const ROOT = path.resolve(__dirname, '../..');

function readComponent(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

describe('Task 3: MeshLambertMaterial Swap', () => {
  describe('1. No MeshStandardMaterial in game rendering components', () => {
    COMPONENT_FILES.forEach((file) => {
      it(`${path.basename(file)} contains no MeshStandardMaterial`, () => {
        const content = readComponent(file);
        // Check both imperative (new THREE.MeshStandardMaterial) and JSX (<meshStandardMaterial)
        expect(content).not.toContain('MeshStandardMaterial');
        expect(content).not.toContain('meshStandardMaterial');
      });
    });
  });

  describe('2. No roughness/metalness params on Lambert materials', () => {
    COMPONENT_FILES.forEach((file) => {
      it(`${path.basename(file)} has no roughness or metalness params`, () => {
        const content = readComponent(file);
        // These PBR-only properties should not appear anywhere in material definitions
        expect(content).not.toMatch(/roughness/);
        expect(content).not.toMatch(/metalness/);
      });
    });

    it('SURFACE_MATERIALS type no longer includes roughness/metalness', () => {
      const content = readComponent('src/types/facility.ts');
      // The SURFACE_MATERIALS Record type should not reference roughness or metalness
      const surfaceMaterialsBlock = content.slice(
        content.indexOf('SURFACE_MATERIALS'),
        content.indexOf('};', content.indexOf('SURFACE_MATERIALS')) + 2
      );
      expect(surfaceMaterialsBlock).not.toContain('roughness');
      expect(surfaceMaterialsBlock).not.toContain('metalness');
    });
  });

  describe('3. Visual properties preserved (color, transparency)', () => {
    it('AnimatedPlayer.tsx preserves team colors', () => {
      const content = readComponent('src/components/three/AnimatedPlayer.tsx');
      expect(content).toContain("color: '#3b82f6'"); // Team A blue
      expect(content).toContain("color: '#ef4444'"); // Team B red
      expect(content).toContain("color: '#e0b090'"); // Skin tone
      expect(content).toContain("color: '#1a1a1a'"); // Paddle black
    });

    it('PickleballCourt.tsx preserves net transparency', () => {
      const content = readComponent('src/components/three/PickleballCourt.tsx');
      expect(content).toContain('transparent: true');
      expect(content).toContain('opacity: 0.7');
      expect(content).toContain('side: THREE.DoubleSide');
    });

    it('PickleballCourt.tsx post has emissive for metal hint', () => {
      const content = readComponent('src/components/three/PickleballCourt.tsx');
      // Post material should have emissive to approximate former metalness: 0.6
      expect(content).toMatch(/post.*MeshLambertMaterial.*emissive/s);
    });

    it('PickleballBall.tsx preserves ball colors', () => {
      const content = readComponent('src/components/three/PickleballBall.tsx');
      expect(content).toContain("color: '#ffff00'"); // Yellow ball
      expect(content).toContain("color: '#f0f000'"); // Holes variant
    });

    it('CleaningRobotCC1.tsx preserves emissive on status lights', () => {
      const content = readComponent('src/components/three/CleaningRobotCC1.tsx');
      // Status lights must keep their emissive glow
      expect(content).toContain("emissive: '#8b5cf6'");  // cleaning
      expect(content).toContain("emissive: '#3b82f6'");  // navigating
      expect(content).toContain("emissive: '#22c55e'");  // charging
      expect(content).toContain("emissive: '#94a3b8'");  // idle
      expect(content).toContain('emissiveIntensity: 0.8'); // light intensity
    });

    it('RobotDock.tsx preserves charging indicator emissive', () => {
      const content = readComponent('src/components/three/RobotDock.tsx');
      expect(content).toContain('meshLambertMaterial');
      expect(content).toContain("emissiveIntensity={hasRobot ? 0.8 : 0.2}");
    });
  });

  describe('4. Material instances are shared (not recreated per render)', () => {
    it('AnimatedPlayer.tsx materials are module-level constants', () => {
      const content = readComponent('src/components/three/AnimatedPlayer.tsx');
      // Materials should be declared outside the component function
      const componentStart = content.indexOf('export function AnimatedPlayer');
      const teamAPos = content.indexOf('const teamAMaterial');
      const teamBPos = content.indexOf('const teamBMaterial');
      const skinPos = content.indexOf('const skinMaterial');
      const paddlePos = content.indexOf('const paddleMaterial');

      // All material declarations should be before the component
      expect(teamAPos).toBeLessThan(componentStart);
      expect(teamBPos).toBeLessThan(componentStart);
      expect(skinPos).toBeLessThan(componentStart);
      expect(paddlePos).toBeLessThan(componentStart);
    });

    it('PickleballCourt.tsx shared materials are module-level', () => {
      const content = readComponent('src/components/three/PickleballCourt.tsx');
      const componentStart = content.indexOf('export function PickleballCourt');
      const sharedPos = content.indexOf('const sharedMaterials');
      expect(sharedPos).toBeLessThan(componentStart);
    });

    it('PickleballBall.tsx materials are module-level constants', () => {
      const content = readComponent('src/components/three/PickleballBall.tsx');
      const componentStart = content.indexOf('export function PickleballBall');
      const ballPos = content.indexOf('const ballMaterial');
      const ballHolesPos = content.indexOf('const ballMaterialWithHoles');
      expect(ballPos).toBeLessThan(componentStart);
      expect(ballHolesPos).toBeLessThan(componentStart);
    });

    it('CleaningRobotCC1.tsx materials are module-level constants', () => {
      const content = readComponent('src/components/three/CleaningRobotCC1.tsx');
      const componentStart = content.indexOf('export function CleaningRobotCC1');
      const bodyPos = content.indexOf('const bodyMaterial');
      const statusPos = content.indexOf('const statusLightMaterials');
      const batteryPos = content.indexOf('const batteryMaterials');
      expect(bodyPos).toBeLessThan(componentStart);
      expect(statusPos).toBeLessThan(componentStart);
      expect(batteryPos).toBeLessThan(componentStart);
    });

    it('Player.tsx pre-created materials are module-level', () => {
      const content = readComponent('src/components/three/Player.tsx');
      const componentStart = content.indexOf('export function Player');
      const paddlePos = content.indexOf('const paddleMaterial');
      const playerMatsPos = content.indexOf('const playerMaterials');
      expect(paddlePos).toBeLessThan(componentStart);
      expect(playerMatsPos).toBeLessThan(componentStart);
    });

    it('RobotDock.tsx materials are module-level constants', () => {
      const content = readComponent('src/components/three/RobotDock.tsx');
      const componentStart = content.indexOf('export function RobotDock');
      const dockBasePos = content.indexOf('const dockBaseMaterial');
      const polePos = content.indexOf('const poleMaterial');
      expect(dockBasePos).toBeLessThan(componentStart);
      expect(polePos).toBeLessThan(componentStart);
    });
  });

  describe('5. MeshLambertMaterial is actually used (positive check)', () => {
    COMPONENT_FILES.forEach((file) => {
      it(`${path.basename(file)} uses MeshLambertMaterial or MeshBasicMaterial`, () => {
        const content = readComponent(file);
        const hasLambert = content.includes('MeshLambertMaterial') || content.includes('meshLambertMaterial');
        const hasBasic = content.includes('MeshBasicMaterial') || content.includes('meshBasicMaterial');
        // Every component should use Lambert (or Basic for trail effects, overlays)
        expect(hasLambert || hasBasic).toBe(true);
      });
    });
  });
});
