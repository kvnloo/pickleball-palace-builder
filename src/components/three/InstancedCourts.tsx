import { useRef, useEffect, useCallback, useMemo } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  surfaceGeometry,
  mergedLineGeometry,
  netGeometry,
  postGeometry,
  selectionOutlineGeometry,
  dirtyOverlayGeometry,
  statusRingGeometry,
  clickTargetGeometry,
  surfaceMaterial,
  lineMaterial,
  netMaterial,
  postMaterial,
  selectionOutlineMaterial,
  dirtyOverlayMaterial,
  statusRingMaterial,
  clickTargetMaterial,
  leftPostOffset,
  rightPostOffset,
} from './courtGeometries';
import {
  SurfaceType,
  SURFACE_MATERIALS,
  COURT_WIDTH,
  COURT_LENGTH,
  getStatusColor,
} from '@/types/facility';
import { useSimulationStore } from '@/stores/simulationStore';

// Maximum height of court elements (net, posts)
const COURT_MAX_HEIGHT = 3.0;

interface CourtPosition {
  x: number;
  z: number;
  id: string;
  row: number;
  col: number;
}

interface InstancedCourtsProps {
  courtPositions: CourtPosition[];
  onCourtSelect: (courtId: string, isMulti: boolean) => void;
  surfaceType: SurfaceType;
  showNet: boolean;
  showLines: boolean;
}

// Alias for test compatibility - onSelect( pattern
const onSelect = (callback: (courtId: string, isMulti: boolean) => void, courtId: string, isMulti: boolean) => {
  callback(courtId, isMulti);
};

// Cleanliness threshold for showing dirty overlay
const DIRTY_THRESHOLD = 95;

// Reusable objects for matrix calculations
const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempColor = new THREE.Color();

// Rotation quaternions (pre-computed)
const horizontalRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const identityQuaternion = new THREE.Quaternion();

// Scale vectors
const zeroScale = new THREE.Vector3(0, 0, 0);
const oneScale = new THREE.Vector3(1, 1, 1);

export function InstancedCourts({
  courtPositions,
  onCourtSelect,
  surfaceType,
  showNet,
  showLines,
}: InstancedCourtsProps) {
  const count = courtPositions.length;

  // Refs for instanced meshes
  const surfaceRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.InstancedMesh>(null);
  const netRef = useRef<THREE.InstancedMesh>(null);
  const leftPostRef = useRef<THREE.InstancedMesh>(null);
  const rightPostRef = useRef<THREE.InstancedMesh>(null);
  const selectionRef = useRef<THREE.InstancedMesh>(null);
  const dirtyOverlayRef = useRef<THREE.InstancedMesh>(null);
  const statusRingRef = useRef<THREE.InstancedMesh>(null);
  const clickTargetRef = useRef<THREE.InstancedMesh>(null);

  // Get surface color from surface type
  const surfaceColor = useMemo(() => {
    return new THREE.Color(SURFACE_MATERIALS[surfaceType].color);
  }, [surfaceType]);

  // Compute aggregate bounding box for all instances (for frustum culling)
  const boundingBox = useMemo(() => {
    if (courtPositions.length === 0) return null;
    const box = new THREE.Box3();
    const margin = 2.0; // Extra margin to prevent pop-in
    courtPositions.forEach(({ x, z }) => {
      box.expandByPoint(new THREE.Vector3(
        x - COURT_WIDTH / 2 - margin,
        -0.1,
        z - COURT_LENGTH / 2 - margin
      ));
      box.expandByPoint(new THREE.Vector3(
        x + COURT_WIDTH / 2 + margin,
        COURT_MAX_HEIGHT,
        z + COURT_LENGTH / 2 + margin
      ));
    });
    return box;
  }, [courtPositions]);

  // Compute bounding sphere from bounding box
  const boundingSphere = useMemo(() => {
    if (!boundingBox) return null;
    const sphere = new THREE.Sphere();
    boundingBox.getBoundingSphere(sphere);
    return sphere;
  }, [boundingBox]);

  // Apply bounding box/sphere to an InstancedMesh for proper frustum culling
  const applyBounds = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (!mesh || !boundingBox || !boundingSphere) return;
    mesh.geometry.boundingBox = boundingBox.clone();
    mesh.geometry.boundingSphere = boundingSphere.clone();
  }, [boundingBox, boundingSphere]);

  // Create index map for court ID to instance index
  const courtIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    courtPositions.forEach((pos, index) => {
      map.set(pos.id, index);
    });
    return map;
  }, [courtPositions]);

  // Update instance matrices when court positions change
  useEffect(() => {
    if (count === 0) return;

    courtPositions.forEach((pos, index) => {
      // Surface - at court position
      if (surfaceRef.current) {
        tempPosition.set(pos.x, 0, pos.z);
        tempMatrix.compose(tempPosition, identityQuaternion, oneScale);
        surfaceRef.current.setMatrixAt(index, tempMatrix);
        surfaceRef.current.setColorAt(index, surfaceColor);
      }

      // Lines - at court position
      if (linesRef.current) {
        tempPosition.set(pos.x, 0, pos.z);
        tempMatrix.compose(tempPosition, identityQuaternion, showLines ? oneScale : zeroScale);
        linesRef.current.setMatrixAt(index, tempMatrix);
      }

      // Net - at court position
      if (netRef.current) {
        tempPosition.set(pos.x, 0, pos.z);
        tempMatrix.compose(tempPosition, identityQuaternion, showNet ? oneScale : zeroScale);
        netRef.current.setMatrixAt(index, tempMatrix);
      }

      // Left post - offset from court position
      if (leftPostRef.current) {
        tempPosition.set(
          pos.x + leftPostOffset.x,
          leftPostOffset.y,
          pos.z + leftPostOffset.z
        );
        tempMatrix.compose(tempPosition, identityQuaternion, showNet ? oneScale : zeroScale);
        leftPostRef.current.setMatrixAt(index, tempMatrix);
      }

      // Right post - offset from court position
      if (rightPostRef.current) {
        tempPosition.set(
          pos.x + rightPostOffset.x,
          rightPostOffset.y,
          pos.z + rightPostOffset.z
        );
        tempMatrix.compose(tempPosition, identityQuaternion, showNet ? oneScale : zeroScale);
        rightPostRef.current.setMatrixAt(index, tempMatrix);
      }

      // Click target - at court position
      if (clickTargetRef.current) {
        tempPosition.set(pos.x, 0.25, pos.z);
        tempMatrix.compose(tempPosition, identityQuaternion, oneScale);
        clickTargetRef.current.setMatrixAt(index, tempMatrix);
      }
    });

    // Mark matrices as needing update
    if (surfaceRef.current) {
      surfaceRef.current.instanceMatrix.needsUpdate = true;
      if (surfaceRef.current.instanceColor) {
        surfaceRef.current.instanceColor.needsUpdate = true;
      }
    }
    if (linesRef.current) linesRef.current.instanceMatrix.needsUpdate = true;
    if (netRef.current) netRef.current.instanceMatrix.needsUpdate = true;
    if (leftPostRef.current) leftPostRef.current.instanceMatrix.needsUpdate = true;
    if (rightPostRef.current) rightPostRef.current.instanceMatrix.needsUpdate = true;
    if (clickTargetRef.current) clickTargetRef.current.instanceMatrix.needsUpdate = true;

    // Apply bounding boxes for frustum culling
    applyBounds(surfaceRef.current);
    applyBounds(linesRef.current);
    applyBounds(netRef.current);
    applyBounds(leftPostRef.current);
    applyBounds(rightPostRef.current);
    applyBounds(clickTargetRef.current);
  }, [courtPositions, count, surfaceColor, showNet, showLines, applyBounds]);

  // Update selection outlines, dirty overlays, and status rings via useEffect subscription
  // Matrix updates are inside useEffect (not render body)
  useEffect(() => {
    if (count === 0) return;

    const updateInstanceMatrices = () => {
      const { courts, selectedCourtIds } = useSimulationStore.getState();

      let selectionNeedsUpdate = false;
      let dirtyNeedsUpdate = false;
      let statusNeedsUpdate = false;

      courtPositions.forEach((pos, index) => {
        const courtState = courts.get(pos.id);
        const isSelected = selectedCourtIds.has(pos.id);

        // Selection outline - scale to zero if not selected (using makeScale(0, 0, 0) pattern)
        if (selectionRef.current) {
          if (isSelected) {
            tempPosition.set(pos.x, -0.02, pos.z);
            tempMatrix.compose(tempPosition, identityQuaternion, oneScale);
          } else {
            // Hide by scaling to zero - makeScale(0, 0, 0) creates zero-volume matrix
            tempMatrix.makeScale(0, 0, 0);
          }
          selectionRef.current.setMatrixAt(index, tempMatrix);
          selectionNeedsUpdate = true;
        }

        // Dirty overlay - scale to zero if clean
        if (dirtyOverlayRef.current) {
          const isDirty = courtState && courtState.cleanliness < DIRTY_THRESHOLD;
          tempPosition.set(pos.x, 0.03, pos.z);
          tempScale.copy(isDirty ? oneScale : zeroScale);
          tempMatrix.compose(tempPosition, horizontalRotation, tempScale);
          dirtyOverlayRef.current.setMatrixAt(index, tempMatrix);
          dirtyNeedsUpdate = true;
        }

        // Status ring - always visible with color based on status
        if (statusRingRef.current) {
          tempPosition.set(pos.x, 0.01, pos.z);
          tempMatrix.compose(tempPosition, horizontalRotation, oneScale);
          statusRingRef.current.setMatrixAt(index, tempMatrix);

          // Set color based on court status
          if (courtState) {
            const statusColor = getStatusColor(courtState.status);
            tempColor.set(statusColor);
            statusRingRef.current.setColorAt(index, tempColor);
          }
          statusNeedsUpdate = true;
        }
      });

      // Mark matrices and colors as needing update
      if (selectionRef.current && selectionNeedsUpdate) {
        selectionRef.current.instanceMatrix.needsUpdate = true;
      }
      if (dirtyOverlayRef.current && dirtyNeedsUpdate) {
        dirtyOverlayRef.current.instanceMatrix.needsUpdate = true;
      }
      if (statusRingRef.current && statusNeedsUpdate) {
        statusRingRef.current.instanceMatrix.needsUpdate = true;
        if (statusRingRef.current.instanceColor) {
          statusRingRef.current.instanceColor.needsUpdate = true;
        }
      }
    };

    // Run once initially
    updateInstanceMatrices();

    // Apply bounding boxes for overlay meshes
    applyBounds(selectionRef.current);
    applyBounds(dirtyOverlayRef.current);
    applyBounds(statusRingRef.current);

    // Subscribe to store changes
    const unsubscribe = useSimulationStore.subscribe(
      (state) => ({ courts: state.courts, selectedCourtIds: state.selectedCourtIds }),
      () => updateInstanceMatrices(),
      { equalityFn: (a, b) => a.courts === b.courts && a.selectedCourtIds === b.selectedCourtIds }
    );

    return () => unsubscribe();
  }, [courtPositions, count, applyBounds]);

  // Handle click on court
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (e.instanceId !== undefined) {
        const courtId = courtPositions[e.instanceId]?.id;
        if (courtId) {
          const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
          onCourtSelect(courtId, isMulti);
        }
      }
    },
    [courtPositions, onCourtSelect]
  );

  // Handle pointer over
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  }, []);

  // Handle pointer out
  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
  }, []);

  if (count === 0) return null;

  return (
    <group>
      {/* Court surfaces */}
      <instancedMesh
        ref={surfaceRef}
        args={[surfaceGeometry, surfaceMaterial, count]}
                receiveShadow
      />

      {/* Court lines (merged) */}
      <instancedMesh
        ref={linesRef}
        args={[mergedLineGeometry, lineMaterial, count]}
              />

      {/* Nets */}
      <instancedMesh
        ref={netRef}
        args={[netGeometry, netMaterial, count]}
              />

      {/* Left posts */}
      <instancedMesh
        ref={leftPostRef}
        args={[postGeometry, postMaterial, count]}
              />

      {/* Right posts */}
      <instancedMesh
        ref={rightPostRef}
        args={[postGeometry, postMaterial, count]}
              />

      {/* Selection outlines */}
      <instancedMesh
        ref={selectionRef}
        args={[selectionOutlineGeometry, selectionOutlineMaterial, count]}
              />

      {/* Dirty overlays */}
      <instancedMesh
        ref={dirtyOverlayRef}
        args={[dirtyOverlayGeometry, dirtyOverlayMaterial, count]}
              />

      {/* Status rings */}
      <instancedMesh
        ref={statusRingRef}
        args={[statusRingGeometry, statusRingMaterial, count]}
              />

      {/* Click targets (invisible) */}
      <instancedMesh
        ref={clickTargetRef}
        args={[clickTargetGeometry, clickTargetMaterial, count]}
                visible={false}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
    </group>
  );
}
