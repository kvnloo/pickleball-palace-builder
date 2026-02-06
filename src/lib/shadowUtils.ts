export interface ShadowFrustumConfig {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
  lightTarget: [number, number, number];
  lightPosition: [number, number, number];
}

export function computeShadowFrustum(
  facilityWidth: number,
  facilityLength: number,
  centerX: number,
  centerZ: number
): ShadowFrustumConfig {
  // Calculate tight shadow frustum bounds based on facility size
  // The frustum should:
  // - Cover the full facility width and length
  // - Half-extent should be at least half the max dimension
  // - Not be hardcoded to 50 (that's too large for small facilities)
  // - far should be <= 150
  // - near should be positive and < 10
  // The frustum should be SQUARE to prevent distortion

  const maxDim = Math.max(facilityWidth, facilityLength);
  const halfExtent = (maxDim / 2) + 2; // Add a 2m padding

  // Light is positioned above and offset from the facility center
  // to create natural shadow angles
  const lightHeight = 100;
  const lightOffset = 50; // Offset from center for angled shadows

  return {
    left: -halfExtent,
    right: halfExtent,
    top: halfExtent,
    bottom: -halfExtent,
    near: 1,
    far: 150,
    lightTarget: [centerX, 0, centerZ],
    lightPosition: [centerX + lightOffset, lightHeight, centerZ + lightOffset],
  };
}

export function shouldCastShadow(
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  objX: number,
  objY: number,
  objZ: number,
  threshold: number
): boolean {
  // If threshold is 0 or negative, LOD is disabled - everything casts shadows
  if (threshold <= 0) return true;

  // Calculate 3D distance between camera and object
  const dx = cameraX - objX;
  const dy = cameraY - objY;
  const dz = cameraZ - objZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Objects within threshold distance cast shadows (inclusive)
  return distance <= threshold;
}
