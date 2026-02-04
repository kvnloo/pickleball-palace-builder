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

export function PickleballCourt({ 
  surfaceType, 
  showNet = true, 
  showLines = true 
}: PickleballCourtProps) {
  // Memoize materials
  const surfaceMaterial = useMemo(() => {
    const config = SURFACE_MATERIALS[surfaceType];
    return new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness,
      metalness: config.metalness,
    });
  }, [surfaceType]);

  const lineMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.5,
      metalness: 0,
    });
  }, []);

  const netMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      roughness: 0.8,
      metalness: 0,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
  }, []);

  const postMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#4a4a4a',
      roughness: 0.3,
      metalness: 0.6,
    });
  }, []);

  // Memoize geometries
  const geometries = useMemo(() => {
    const halfWidth = COURT_WIDTH / 2;
    const halfLength = COURT_LENGTH / 2;

    return {
      // Court surface
      surface: new THREE.BoxGeometry(COURT_WIDTH, 0.02, COURT_LENGTH),
      
      // Sidelines (long edges)
      sideline: new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, COURT_LENGTH),
      
      // Baselines (short edges)
      baseline: new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH),
      
      // Centerline (from NVZ to baseline on each side)
      centerlineLength: halfLength - KITCHEN_DEPTH,
      centerline: new THREE.BoxGeometry(LINE_WIDTH, LINE_HEIGHT, halfLength - KITCHEN_DEPTH),
      
      // NVZ (kitchen) line
      nvzLine: new THREE.BoxGeometry(COURT_WIDTH, LINE_HEIGHT, LINE_WIDTH),
      
      // Net post
      post: new THREE.CylinderGeometry(0.04, 0.04, NET_HEIGHT_SIDES, 8),
    };
  }, []);

  // Net geometry with sag
  const netGeometry = useMemo(() => {
    const segments = 20;
    const geometry = new THREE.PlaneGeometry(COURT_WIDTH + 0.1, NET_HEIGHT_SIDES, segments, 1);
    const positions = geometry.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      
      // Only modify top vertices (y > 0)
      if (y > 0) {
        // Parabolic sag - center is lower
        const normalizedX = x / (COURT_WIDTH / 2);
        const sagAmount = (NET_HEIGHT_SIDES - NET_HEIGHT_CENTER) * (1 - normalizedX * normalizedX);
        positions.setY(i, y - sagAmount);
      }
    }
    
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const halfWidth = COURT_WIDTH / 2;
  const halfLength = COURT_LENGTH / 2;

  return (
    <group>
      {/* Court surface */}
      <mesh 
        geometry={geometries.surface} 
        material={surfaceMaterial}
        receiveShadow
      />

      {showLines && (
        <group>
          {/* Left sideline */}
          <mesh
            geometry={geometries.sideline}
            material={lineMaterial}
            position={[-halfWidth + LINE_WIDTH / 2, LINE_HEIGHT / 2, 0]}
          />
          
          {/* Right sideline */}
          <mesh
            geometry={geometries.sideline}
            material={lineMaterial}
            position={[halfWidth - LINE_WIDTH / 2, LINE_HEIGHT / 2, 0]}
          />
          
          {/* Front baseline */}
          <mesh
            geometry={geometries.baseline}
            material={lineMaterial}
            position={[0, LINE_HEIGHT / 2, -halfLength + LINE_WIDTH / 2]}
          />
          
          {/* Back baseline */}
          <mesh
            geometry={geometries.baseline}
            material={lineMaterial}
            position={[0, LINE_HEIGHT / 2, halfLength - LINE_WIDTH / 2]}
          />
          
          {/* Front NVZ (kitchen) line */}
          <mesh
            geometry={geometries.nvzLine}
            material={lineMaterial}
            position={[0, LINE_HEIGHT / 2, -KITCHEN_DEPTH]}
          />
          
          {/* Back NVZ (kitchen) line */}
          <mesh
            geometry={geometries.nvzLine}
            material={lineMaterial}
            position={[0, LINE_HEIGHT / 2, KITCHEN_DEPTH]}
          />
          
          {/* Front centerline */}
          <mesh
            geometry={geometries.centerline}
            material={lineMaterial}
            position={[
              0, 
              LINE_HEIGHT / 2, 
              -KITCHEN_DEPTH - geometries.centerlineLength / 2
            ]}
          />
          
          {/* Back centerline */}
          <mesh
            geometry={geometries.centerline}
            material={lineMaterial}
            position={[
              0, 
              LINE_HEIGHT / 2, 
              KITCHEN_DEPTH + geometries.centerlineLength / 2
            ]}
          />
        </group>
      )}

      {showNet && (
        <group position={[0, 0, 0]}>
          {/* Net mesh */}
          <mesh
            geometry={netGeometry}
            material={netMaterial}
            position={[0, NET_HEIGHT_SIDES / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          />
          
          {/* Left post */}
          <mesh
            geometry={geometries.post}
            material={postMaterial}
            position={[-halfWidth - 0.05, NET_HEIGHT_SIDES / 2, 0]}
          />
          
          {/* Right post */}
          <mesh
            geometry={geometries.post}
            material={postMaterial}
            position={[halfWidth + 0.05, NET_HEIGHT_SIDES / 2, 0]}
          />
        </group>
      )}
    </group>
  );
}
