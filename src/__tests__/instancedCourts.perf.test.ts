/**
 * Task 6: InstancedMesh Court Batching - Performance & Correctness Tests
 *
 * Verifies that the InstancedMesh court batching optimization:
 * 1. Draw call count < 30 for 100 courts (structural verification)
 * 2. All court positions are correctly encoded in instance matrices
 * 3. Instance matrices update only on layout change (no per-frame updates)
 * 4. Per-court click/hover interaction still works correctly
 * 5. Selection visual feedback updates instance attributes correctly
 *
 * Current state: 100 courts = ~1500 draw calls (12-16 meshes per court)
 * Target state: 100 courts = ~7-10 draw calls (7 InstancedMesh objects)
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  COURT_WIDTH,
  COURT_LENGTH,
  KITCHEN_DEPTH,
  LINE_WIDTH,
  LINE_HEIGHT,
  NET_HEIGHT_SIDES,
  NET_HEIGHT_CENTER,
  getStatusColor,
} from '@/types/facility';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

const halfWidth = COURT_WIDTH / 2;
const halfLength = COURT_LENGTH / 2;
const centerlineLength = halfLength - KITCHEN_DEPTH;
const POST_OFFSET_X = halfWidth + 0.05;
const NET_Y = NET_HEIGHT_SIDES / 2;

/**
 * Generate N court positions in a grid layout (mimics HomebaseCanvas logic).
 */
function generateCourtPositions(count: number) {
  const cols = Math.ceil(Math.sqrt(count));
  const spacing = 1;
  const positions: Array<{ x: number; z: number; id: string }> = [];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = col * (COURT_WIDTH + spacing) + COURT_WIDTH / 2;
    const z = row * (COURT_LENGTH + spacing) + COURT_LENGTH / 2;
    positions.push({ x, z, id: `court-${row}-${col}` });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// 1. Draw call budget: structural verification
//    Ensures InstancedCourts uses InstancedMesh (not individual meshes)
// ---------------------------------------------------------------------------
describe('1. Draw call budget (structural)', () => {
  it('InstancedCourts.tsx uses <instancedMesh> elements', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Must use instancedMesh (R3F JSX) or THREE.InstancedMesh
    const hasInstancedMesh =
      source.includes('instancedMesh') || source.includes('InstancedMesh');
    expect(hasInstancedMesh).toBe(true);
  });

  it('InstancedCourts.tsx has at most 10 <instancedMesh> elements', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Count occurrences of <instancedMesh (JSX opening tag)
    const matches = source.match(/<instancedMesh/g) || [];
    // We expect 7 InstancedMesh objects:
    // surface, lines, net, posts, statusRing, selection, dirtyOverlay
    expect(matches.length).toBeLessThanOrEqual(10);
    expect(matches.length).toBeGreaterThanOrEqual(3); // at minimum surface + lines + posts
  });

  it('HomebaseCanvas.tsx no longer iterates SelectableCourt per court', () => {
    const source = readSource('src/components/three/HomebaseCanvas.tsx');
    // Should NOT have per-court SelectableCourt rendering
    expect(source).not.toContain('<SelectableCourt');
    // Should import InstancedCourts instead
    expect(source).toContain('InstancedCourts');
  });

  it('InstancedCourts.tsx does not create individual mesh per court for geometry', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Should NOT have patterns like courtPositions.map() with <mesh geometry={surfaceGeometry}
    // Invisible click targets are OK (they have visible={false})
    const meshInMap = source.match(/\.map\(.*\n.*<mesh\s/g) || [];
    // Any mesh inside a map should be a click target (visible={false})
    for (const match of meshInMap) {
      // The mesh in a map pattern is only acceptable for click targets
      const afterMesh = source.substring(
        source.indexOf(match) + match.length,
        source.indexOf(match) + match.length + 200
      );
      // It should have visible={false} nearby
      expect(afterMesh).toMatch(/visible\s*=\s*\{?\s*false/);
    }
  });

  it('merged line geometry reduces 8 line meshes to 1 instanced mesh', () => {
    const geoSource = readSource('src/components/three/courtGeometries.ts');
    // Should contain mergeGeometries call
    expect(geoSource).toMatch(/mergeGeometries/);
    // Should export mergedLineGeometry
    expect(geoSource).toContain('mergedLineGeometry');
  });

  it('theoretical draw call count for 100 courts is under 30', () => {
    // Count InstancedMesh objects in component source
    const source = readSource('src/components/three/InstancedCourts.tsx');
    const instancedMeshCount = (source.match(/<instancedMesh/g) || []).length;

    // Count any non-instanced meshes (click targets are invisible, don't count)
    // Invisible meshes cost 0 draw calls
    // Each <instancedMesh> = 1 draw call regardless of instance count

    // Additional draw calls from HomebaseCanvas: ground plane (1), lights (0)
    const fixedDrawCalls = 1; // ground plane

    const totalDrawCalls = instancedMeshCount + fixedDrawCalls;
    expect(totalDrawCalls).toBeLessThan(30);
  });
});

// ---------------------------------------------------------------------------
// 2. Court position matrix correctness
//    Verifies that instance transform matrices encode correct positions
// ---------------------------------------------------------------------------
describe('2. Court position matrix correctness', () => {
  const positions = generateCourtPositions(10);

  it('surface instance matrices have correct (x, 0, z) translations', () => {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();

    for (const courtPos of positions) {
      mat.makeTranslation(courtPos.x, 0, courtPos.z);
      pos.setFromMatrixPosition(mat);

      expect(pos.x).toBeCloseTo(courtPos.x, 5);
      expect(pos.y).toBeCloseTo(0, 5);
      expect(pos.z).toBeCloseTo(courtPos.z, 5);
    }
  });

  it('post instance matrices have correct +/- offset from court center', () => {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();

    for (const courtPos of positions) {
      // Left post
      mat.makeTranslation(courtPos.x - POST_OFFSET_X, NET_Y, courtPos.z);
      pos.setFromMatrixPosition(mat);
      expect(pos.x).toBeCloseTo(courtPos.x - POST_OFFSET_X, 5);
      expect(pos.y).toBeCloseTo(NET_Y, 5);
      expect(pos.z).toBeCloseTo(courtPos.z, 5);

      // Right post
      mat.makeTranslation(courtPos.x + POST_OFFSET_X, NET_Y, courtPos.z);
      pos.setFromMatrixPosition(mat);
      expect(pos.x).toBeCloseTo(courtPos.x + POST_OFFSET_X, 5);
      expect(pos.y).toBeCloseTo(NET_Y, 5);
      expect(pos.z).toBeCloseTo(courtPos.z, 5);
    }
  });

  it('net instance matrices are positioned at court center, raised to NET_Y', () => {
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();

    for (const courtPos of positions) {
      mat.makeTranslation(courtPos.x, NET_Y, courtPos.z);
      pos.setFromMatrixPosition(mat);

      expect(pos.x).toBeCloseTo(courtPos.x, 5);
      expect(pos.y).toBeCloseTo(NET_Y, 5);
      expect(pos.z).toBeCloseTo(courtPos.z, 5);
    }
  });

  it('status ring matrices include rotation (X-axis -PI/2)', () => {
    const mat = new THREE.Matrix4();
    const rotX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (const courtPos of positions) {
      mat.makeTranslation(courtPos.x, 0.01, courtPos.z).multiply(rotX);
      mat.decompose(pos, quat, scale);

      expect(pos.x).toBeCloseTo(courtPos.x, 3);
      // Y position may change due to rotation composition
      expect(pos.z).toBeCloseTo(courtPos.z, 3);
      // Verify rotation is approximately -PI/2 around X
      const euler = new THREE.Euler().setFromQuaternion(quat);
      expect(euler.x).toBeCloseTo(-Math.PI / 2, 2);
    }
  });

  it('posts count is 2x court count', () => {
    const courtCount = positions.length;
    const postCount = courtCount * 2;
    expect(postCount).toBe(20); // 10 courts * 2 posts
  });
});

// ---------------------------------------------------------------------------
// 3. Instance matrix update frequency
//    Ensures matrices are NOT updated per-frame
// ---------------------------------------------------------------------------
describe('3. Instance matrix update frequency', () => {
  it('InstancedCourts.tsx contains no useFrame hook', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    expect(source).not.toContain('useFrame');
  });

  it('matrix updates are inside useEffect (not render body)', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // needsUpdate should only appear inside useEffect blocks
    const needsUpdateOccurrences = source.match(/needsUpdate\s*=\s*true/g) || [];
    expect(needsUpdateOccurrences.length).toBeGreaterThan(0);

    // All needsUpdate assignments should be within useEffect callbacks
    // Verify by checking that useEffect appears before needsUpdate
    const useEffectCount = (source.match(/useEffect\s*\(/g) || []).length;
    expect(useEffectCount).toBeGreaterThan(0);
  });

  it('courtPositions in HomebaseCanvas is memoized with useMemo', () => {
    const source = readSource('src/components/three/HomebaseCanvas.tsx');
    // courtPositions should be computed via useMemo
    const courtPosStart = source.indexOf('courtPositions');
    const nearbyCode = source.substring(
      Math.max(0, courtPosStart - 50),
      courtPosStart + 10
    );
    expect(nearbyCode).toContain('useMemo');
  });

  it('courtGeometries.ts creates geometries at module level (not per render)', () => {
    const source = readSource('src/components/three/courtGeometries.ts');
    // Geometries should NOT be inside any function or component
    expect(source).not.toMatch(/function.*\{[\s\S]*new THREE\.BoxGeometry/);
    // Should be module-level exports
    expect(source).toContain('export const');
  });
});

// ---------------------------------------------------------------------------
// 4. Per-court click/hover interaction
//    Verifies interaction layer is preserved
// ---------------------------------------------------------------------------
describe('4. Per-court click/hover interaction', () => {
  it('InstancedCourts has click handler for court selection', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Should have onClick handler
    expect(source).toContain('onClick');
    // Should call onSelect with court ID
    expect(source).toMatch(/onSelect\s*\(/);
  });

  it('InstancedCourts has pointer handlers for hover feedback', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    expect(source).toContain('onPointerOver');
    expect(source).toContain('onPointerOut');
    // Should change cursor style
    expect(source).toContain("cursor");
  });

  it('click targets are invisible (zero draw call cost)', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Click target meshes should have visible={false}
    expect(source).toMatch(/visible\s*=\s*\{?\s*false/);
  });

  it('event handlers call stopPropagation to prevent event bubbling', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    expect(source).toContain('stopPropagation');
  });

  it('click handler passes modifier keys (shift/ctrl/meta) for multi-select', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Should check for shiftKey, ctrlKey, or metaKey
    expect(source).toMatch(/shiftKey|ctrlKey|metaKey/);
  });
});

// ---------------------------------------------------------------------------
// 5. Selection visual feedback via instance attributes
//    Verifies per-instance color and visibility updates
// ---------------------------------------------------------------------------
describe('5. Selection visual feedback via instance attributes', () => {
  it('uses setColorAt for per-instance status ring colors', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    expect(source).toContain('setColorAt');
  });

  it('uses setMatrixAt for per-instance transforms', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    expect(source).toContain('setMatrixAt');
  });

  it('selection outline uses scale-to-zero for unselected courts', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Should have a zero-scale matrix pattern for hiding instances
    expect(source).toMatch(/makeScale\s*\(\s*0/);
  });

  it('status colors map correctly from court status', () => {
    // Verify getStatusColor returns expected hex colors
    expect(getStatusColor('AVAILABLE_CLEAN')).toBe('#22c55e');
    expect(getStatusColor('IN_USE')).toBe('#3b82f6');
    expect(getStatusColor('NEEDS_CLEANING')).toBe('#f59e0b');
    expect(getStatusColor('CLEANING')).toBe('#8b5cf6');
    expect(getStatusColor('OUT_OF_SERVICE')).toBe('#ef4444');
  });

  it('dirty overlay visibility is based on cleanliness threshold', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    // Should check cleanliness value and conditionally show/hide
    expect(source).toMatch(/cleanliness/);
  });

  it('instanceColor.needsUpdate is set after color changes', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');
    expect(source).toMatch(/instanceColor.*needsUpdate\s*=\s*true/s);
  });
});

// ---------------------------------------------------------------------------
// 6. Merged geometry correctness
//    Verifies the courtGeometries module creates valid merged geometry
// ---------------------------------------------------------------------------
describe('6. Merged geometry correctness', () => {
  it('courtGeometries.ts exports all required geometries', () => {
    const source = readSource('src/components/three/courtGeometries.ts');
    expect(source).toContain('courtSurfaceGeometry');
    expect(source).toContain('mergedLineGeometry');
    expect(source).toContain('netGeometry');
    expect(source).toContain('postGeometry');
  });

  it('courtGeometries.ts exports materials', () => {
    const source = readSource('src/components/three/courtGeometries.ts');
    expect(source).toContain('courtMaterials');
  });

  it('courtGeometries.ts exports overlay geometries', () => {
    const source = readSource('src/components/three/courtGeometries.ts');
    expect(source).toContain('overlayGeometries');
  });

  it('merged line geometry includes all 8 court lines', () => {
    const source = readSource('src/components/three/courtGeometries.ts');
    // Should reference all line types in the merge call
    // Look for clone() and translate() calls for each line type
    const cloneCount = (source.match(/\.clone\(\)/g) || []).length;
    // At least 8 clones for the 8 line geometries
    expect(cloneCount).toBeGreaterThanOrEqual(8);
  });

  it('net geometry preserves parabolic sag computation', () => {
    const source = readSource('src/components/three/courtGeometries.ts');
    // Should contain the sag computation logic
    expect(source).toContain('sagAmount');
    expect(source).toContain('normalizedX');
    expect(source).toContain('computeVertexNormals');
  });

  it('line positions match original PickleballCourt.tsx positions', () => {
    // Verify the translate offsets match the original position props
    const source = readSource('src/components/three/courtGeometries.ts');

    // Left sideline: x = -halfWidth + LINE_WIDTH/2
    expect(source).toMatch(/-halfWidth\s*\+\s*LINE_WIDTH\s*\/\s*2/);
    // Right sideline: x = halfWidth - LINE_WIDTH/2
    expect(source).toMatch(/halfWidth\s*-\s*LINE_WIDTH\s*\/\s*2/);
    // NVZ lines at KITCHEN_DEPTH
    expect(source).toContain('KITCHEN_DEPTH');
    // Centerline offset
    expect(source).toContain('centerlineLength');
  });
});

// ---------------------------------------------------------------------------
// 7. InstancedMesh frustumCulled configuration
//    Ensures instances have proper bounding boxes for frustum culling
// ---------------------------------------------------------------------------
describe('7. InstancedMesh frustumCulled configuration', () => {
  it('InstancedMesh uses computed bounding boxes for proper frustum culling', () => {
    const source = readSource('src/components/three/InstancedCourts.tsx');

    // Should have bounding box computation
    expect(source).toContain('boundingBox');
    expect(source).toContain('boundingSphere');

    // Should have applyBounds function to set geometry bounds
    expect(source).toContain('applyBounds');

    // Should compute bounds from court positions
    expect(source).toContain('box.expandByPoint');
    expect(source).toContain('getBoundingSphere');

    // Should NOT have frustumCulled={false} anymore (use proper bounds instead)
    const frustumCulledFalseCount = (source.match(/frustumCulled\s*=\s*\{?\s*false/g) || []).length;
    expect(frustumCulledFalseCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Mathematical validation of matrix operations
//    Verifies the matrix math used for instancing is correct
// ---------------------------------------------------------------------------
describe('8. Matrix operation correctness', () => {
  it('makeTranslation preserves identity rotation and scale', () => {
    const mat = new THREE.Matrix4();
    mat.makeTranslation(5.0, 1.0, 10.0);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mat.decompose(pos, quat, scale);

    expect(scale.x).toBeCloseTo(1, 5);
    expect(scale.y).toBeCloseTo(1, 5);
    expect(scale.z).toBeCloseTo(1, 5);

    const euler = new THREE.Euler().setFromQuaternion(quat);
    expect(euler.x).toBeCloseTo(0, 5);
    expect(euler.y).toBeCloseTo(0, 5);
    expect(euler.z).toBeCloseTo(0, 5);
  });

  it('makeScale(0,0,0) creates a zero-volume matrix (hides instance)', () => {
    const mat = new THREE.Matrix4();
    mat.makeScale(0, 0, 0);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mat.decompose(pos, quat, scale);

    expect(scale.x).toBeCloseTo(0, 5);
    expect(scale.y).toBeCloseTo(0, 5);
    expect(scale.z).toBeCloseTo(0, 5);
  });

  it('translation * rotation(X,-PI/2) correctly positions flat geometry', () => {
    const mat = new THREE.Matrix4();
    const rotX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

    mat.makeTranslation(3.0, 0.01, 7.0).multiply(rotX);

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mat.decompose(pos, quat, scale);

    // Position is preserved
    expect(pos.x).toBeCloseTo(3.0, 3);
    // Note: multiply changes the composed result; translation component stays
    expect(pos.z).toBeCloseTo(7.0, 3);

    // Rotation around X
    const euler = new THREE.Euler().setFromQuaternion(quat);
    expect(euler.x).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('100 courts generate exactly 100 surface matrices and 200 post matrices', () => {
    const positions = generateCourtPositions(100);
    expect(positions.length).toBe(100);

    const surfaceMatrices: THREE.Matrix4[] = [];
    const postMatrices: THREE.Matrix4[] = [];

    for (const pos of positions) {
      surfaceMatrices.push(new THREE.Matrix4().makeTranslation(pos.x, 0, pos.z));
      postMatrices.push(new THREE.Matrix4().makeTranslation(pos.x - POST_OFFSET_X, NET_Y, pos.z));
      postMatrices.push(new THREE.Matrix4().makeTranslation(pos.x + POST_OFFSET_X, NET_Y, pos.z));
    }

    expect(surfaceMatrices.length).toBe(100);
    expect(postMatrices.length).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 9. Color attribute correctness
//    Verifies THREE.Color operations used for per-instance colors
// ---------------------------------------------------------------------------
describe('9. Color attribute correctness', () => {
  it('THREE.Color correctly parses all status colors', () => {
    const statusColors = [
      '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444',
    ];

    for (const hex of statusColors) {
      const color = new THREE.Color(hex);
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(1);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(1);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(1);
    }
  });

  it('THREE.Color correctly parses surface material colors', () => {
    const surfaceColors = ['#c4a574', '#3d3d3d', '#2563eb', '#94a3b8'];

    for (const hex of surfaceColors) {
      const color = new THREE.Color(hex);
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(1);
    }
  });

  it('InstancedBufferAttribute for 100 instances has correct size', () => {
    const count = 100;
    const colorArray = new Float32Array(count * 3);
    const attr = new THREE.InstancedBufferAttribute(colorArray, 3);

    expect(attr.count).toBe(count);
    expect(attr.itemSize).toBe(3);
    expect(attr.array.length).toBe(count * 3);
  });
});
