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

// Selection outline geometry
const outlineGeometry = new THREE.BoxGeometry(COURT_WIDTH + 0.2, 0.05, COURT_LENGTH + 0.2);

// Dirty overlay geometry
const overlayGeometry = new THREE.PlaneGeometry(COURT_WIDTH - 0.1, COURT_LENGTH - 0.1);

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
  
  const outlineMaterial = useMemo(() => {
    if (isSelected) {
      return new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.8 });
    }
    if (isHovered) {
      return new THREE.MeshBasicMaterial({ color: '#a5b4fc', transparent: true, opacity: 0.5 });
    }
    return null;
  }, [isSelected, isHovered]);

  // Dirty overlay material (shows when cleanliness < 100)
  const dirtyOverlayMaterial = useMemo(() => {
    if (courtState.cleanliness >= 100) return null;
    const opacity = (100 - courtState.cleanliness) / 100 * 0.4;
    return new THREE.MeshBasicMaterial({
      color: '#7c2d12',
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });
  }, [courtState.cleanliness]);

  return (
    <group position={[position.x, 0, position.z]}>
      {/* Invisible click target */}
      <mesh
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        visible={false}
      >
        <boxGeometry args={[COURT_WIDTH, 0.5, COURT_LENGTH]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* The court itself */}
      <PickleballCourt surfaceType={surfaceType} showNet={showNet} showLines={showLines} />

      {/* Dirty overlay */}
      {dirtyOverlayMaterial && (
        <mesh
          geometry={overlayGeometry}
          material={dirtyOverlayMaterial}
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      )}

      {/* Selection/hover outline */}
      {outlineMaterial && (
        <mesh geometry={outlineGeometry} material={outlineMaterial} position={[0, -0.02, 0]} />
      )}

      {/* Status indicator ring */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[COURT_WIDTH / 2 + 0.05, COURT_WIDTH / 2 + 0.15, 32]} />
        <meshBasicMaterial color={statusColor} transparent opacity={isHovered || isSelected ? 0.8 : 0.3} />
      </mesh>
    </group>
  );
}
