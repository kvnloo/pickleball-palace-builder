import { useMemo } from 'react';
import * as THREE from 'three';
import {
  SurfaceType,
  SURFACE_MATERIALS,
  COURT_WIDTH,
  COURT_LENGTH,
  KITCHEN_DEPTH,
  LINE_WIDTH,
  LINE_HEIGHT,
  NET_HEIGHT_SIDES,
  NET_HEIGHT_CENTER,
} from '@/types/facility';

interface PickleballCourtProps {
  surfaceType: SurfaceType;
  showNet?: boolean;
  showLines?: boolean;
}

// Shared geometries - created once, reused everywhere
const sharedGeometries = {
  surface: new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH),
  sideline: new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, COURT_LENGTH),
  baseline: new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH),
  nvzLine: new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH),
  centerline: new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, COURT_LENGTH / 2 - KITCHEN_DEPTH),
  post: new THREE.CylinderGeometry(0.04, 0.04, NET_HEIGHT_SIDES, 8),
};

// Shared materials - created once
const sharedMaterials = {
  line: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, metalness: 0 }),
  net: new THREE.MeshStandardMaterial({
    color: '#1a1a1a',
    roughness: 0.8,
    metalness: 0,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  }),
  post: new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.3, metalness: 0.6 }),
};

// Create net geometry with sag - net spans across X-axis (width of court)
const createNetGeometry = () => {
  const segments = 20;
  // Net width is court width, height is net height
  const geometry = new THREE.PlaneGeometry(COURT_WIDTH + 0.1, NET_HEIGHT_SIDES, segments, 4);
  const positions = geometry.attributes.position;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);

    // Only modify top vertices (y > 0) to create sag
    if (y > 0) {
      // Parabolic sag - center is lower
      const normalizedX = x / (COURT_WIDTH / 2);
      const sagAmount = (NET_HEIGHT_SIDES - NET_HEIGHT_CENTER) * (1 - normalizedX * normalizedX);
      positions.setY(i, y - sagAmount);
    }
  }

  geometry.computeVertexNormals();
  return geometry;
};

const netGeometry = createNetGeometry();

export function PickleballCourt({
  surfaceType,
  showNet = true,
  showLines = true,
}: PickleballCourtProps) {
  // Memoize surface material (changes with surfaceType)
  const surfaceMaterial = useMemo(() => {
    const config = SURFACE_MATERIALS[surfaceType];
    return new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness,
      metalness: config.metalness,
    });
  }, [surfaceType]);

  const halfWidth = COURT_WIDTH / 2;
  const halfLength = COURT_LENGTH / 2;
  const centerlineLength = halfLength - KITCHEN_DEPTH;

  return (
    <group>
      {/* Court surface */}
      <mesh geometry={sharedGeometries.surface} material={surfaceMaterial} receiveShadow />

      {showLines && (
        <group>
          {/* Left sideline */}
          <mesh
            geometry={sharedGeometries.sideline}
            material={sharedMaterials.line}
            position={[-halfWidth + LINE_WIDTH / 2, LINE_HEIGHT / 2, 0]}
          />

          {/* Right sideline */}
          <mesh
            geometry={sharedGeometries.sideline}
            material={sharedMaterials.line}
            position={[halfWidth - LINE_WIDTH / 2, LINE_HEIGHT / 2, 0]}
          />

          {/* Front baseline */}
          <mesh
            geometry={sharedGeometries.baseline}
            material={sharedMaterials.line}
            position={[0, LINE_HEIGHT / 2, -halfLength + LINE_WIDTH / 2]}
          />

          {/* Back baseline */}
          <mesh
            geometry={sharedGeometries.baseline}
            material={sharedMaterials.line}
            position={[0, LINE_HEIGHT / 2, halfLength - LINE_WIDTH / 2]}
          />

          {/* Front NVZ (kitchen) line */}
          <mesh
            geometry={sharedGeometries.nvzLine}
            material={sharedMaterials.line}
            position={[0, LINE_HEIGHT / 2, -KITCHEN_DEPTH]}
          />

          {/* Back NVZ (kitchen) line */}
          <mesh
            geometry={sharedGeometries.nvzLine}
            material={sharedMaterials.line}
            position={[0, LINE_HEIGHT / 2, KITCHEN_DEPTH]}
          />

          {/* Front centerline */}
          <mesh
            geometry={sharedGeometries.centerline}
            material={sharedMaterials.line}
            position={[0, LINE_HEIGHT / 2, -KITCHEN_DEPTH - centerlineLength / 2]}
          />

          {/* Back centerline */}
          <mesh
            geometry={sharedGeometries.centerline}
            material={sharedMaterials.line}
            position={[0, LINE_HEIGHT / 2, KITCHEN_DEPTH + centerlineLength / 2]}
          />
        </group>
      )}

      {showNet && (
        <group position={[0, 0, 0]}>
          {/* Net mesh - positioned at center, spanning across X-axis */}
          <mesh
            geometry={netGeometry}
            material={sharedMaterials.net}
            position={[0, NET_HEIGHT_SIDES / 2, 0]}
            rotation={[0, 0, 0]} // No rotation - plane already faces +Z by default
          />

          {/* Left post */}
          <mesh
            geometry={sharedGeometries.post}
            material={sharedMaterials.post}
            position={[-halfWidth - 0.05, NET_HEIGHT_SIDES / 2, 0]}
          />

          {/* Right post */}
          <mesh
            geometry={sharedGeometries.post}
            material={sharedMaterials.post}
            position={[halfWidth + 0.05, NET_HEIGHT_SIDES / 2, 0]}
          />
        </group>
      )}
    </group>
  );
}
