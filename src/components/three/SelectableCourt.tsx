import { useMemo, useState, useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { PickleballCourt } from './PickleballCourt';
import {
  SurfaceType,
  CourtState,
  COURT_WIDTH,
  COURT_LENGTH,
  getStatusColor,
} from '@/types/facility';

interface SelectableCourtProps {
  courtState: CourtState;
  surfaceType: SurfaceType;
  showNet: boolean;
  showLines: boolean;
  position: { x: number; z: number };
  isSelected: boolean;
  onSelect: (courtId: string, shiftKey: boolean) => void;
}

// Shared geometries - created once, reused by all courts
const sharedGeometries = {
  outline: new THREE.BoxGeometry(COURT_WIDTH + 0.2, 0.05, COURT_LENGTH + 0.2),
  overlay: new THREE.PlaneGeometry(COURT_WIDTH - 0.1, COURT_LENGTH - 0.1),
  clickTarget: new THREE.BoxGeometry(COURT_WIDTH, 0.5, COURT_LENGTH),
  statusRing: new THREE.RingGeometry(COURT_WIDTH / 2 + 0.05, COURT_WIDTH / 2 + 0.15, 32),
};

// Pooled materials - avoid recreation on state changes
const pooledMaterials = {
  selected: new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.8 }),
  hovered: new THREE.MeshBasicMaterial({ color: '#a5b4fc', transparent: true, opacity: 0.5 }),
  clickTarget: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  // Dirty overlays at different opacity levels (pre-computed)
  dirty: [
    null, // 100% clean
    new THREE.MeshBasicMaterial({ color: '#7c2d12', transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: '#7c2d12', transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: '#7c2d12', transparent: true, opacity: 0.24, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: '#7c2d12', transparent: true, opacity: 0.32, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: '#7c2d12', transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  ] as (THREE.MeshBasicMaterial | null)[],
  // Status ring materials
  statusRings: new Map<string, THREE.MeshBasicMaterial>(),
};

// Get or create status ring material
function getStatusRingMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  const key = `${color}-${opacity}`;
  if (!pooledMaterials.statusRings.has(key)) {
    pooledMaterials.statusRings.set(key, new THREE.MeshBasicMaterial({ 
      color, 
      transparent: true, 
      opacity 
    }));
  }
  return pooledMaterials.statusRings.get(key)!;
}

export function SelectableCourt({
  courtState,
  surfaceType,
  showNet,
  showLines,
  position,
  isSelected,
  onSelect,
}: SelectableCourtProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(courtState.id, e.shiftKey || e.ctrlKey || e.metaKey);
  }, [courtState.id, onSelect]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setIsHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback(() => {
    setIsHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  // Status-based materials
  const statusColor = getStatusColor(courtState.status);
  
  // Use pooled materials instead of creating new ones
  const outlineMaterial = isSelected ? pooledMaterials.selected 
    : isHovered ? pooledMaterials.hovered 
    : null;

  // Use pooled dirty materials (quantized to 5 levels for performance)
  const dirtyLevel = courtState.cleanliness >= 100 ? 0 
    : Math.min(5, Math.ceil((100 - courtState.cleanliness) / 20));
  const dirtyOverlayMaterial = pooledMaterials.dirty[dirtyLevel];
  
  // Use pooled status ring material
  const ringOpacity = isHovered || isSelected ? 0.8 : 0.3;
  const statusRingMaterial = getStatusRingMaterial(statusColor, ringOpacity);

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Invisible click target */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        visible={false}
        geometry={sharedGeometries.clickTarget}
        material={pooledMaterials.clickTarget}
      >
      </mesh>

      {/* The court itself */}
      <PickleballCourt surfaceType={surfaceType} showNet={showNet} showLines={showLines} />

      {/* Dirty overlay */}
      {dirtyOverlayMaterial && (
        <mesh
          geometry={sharedGeometries.overlay}
          material={dirtyOverlayMaterial}
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      )}

      {/* Selection/hover outline */}
      {outlineMaterial && (
        <mesh geometry={sharedGeometries.outline} material={outlineMaterial} position={[0, -0.02, 0]} />
      )}

      {/* Status indicator ring */}
      <mesh 
        geometry={sharedGeometries.statusRing}
        material={statusRingMaterial}
        position={[0, 0.01, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
}
