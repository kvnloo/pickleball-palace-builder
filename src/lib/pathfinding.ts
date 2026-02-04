import { COURT_WIDTH, COURT_LENGTH } from '@/types/facility';

interface Point {
  x: number;
  z: number;
}

interface PathNode {
  x: number;
  z: number;
  row: number;
  col: number;
}

/**
 * Manhattan-style pathfinding through facility aisles.
 * Courts are treated as obstacles; robots navigate through the spacing between them.
 */
export class FacilityPathfinder {
  private spacing: number;
  private rows: number;
  private cols: number;
  private rowLengths: number[];

  constructor(rows: number, cols: number, spacing: number, rowLengths?: number[]) {
    this.rows = rows;
    this.cols = cols;
    this.spacing = spacing;
    this.rowLengths = rowLengths || Array(rows).fill(cols);
  }

  /**
   * Get the center position of a court in world coordinates
   */
  getCourtCenter(row: number, col: number): Point {
    const courtWidthWithSpacing = COURT_WIDTH + this.spacing;
    const courtLengthWithSpacing = COURT_LENGTH + this.spacing;
    
    return {
      x: col * courtWidthWithSpacing + COURT_WIDTH / 2,
      z: row * courtLengthWithSpacing + COURT_LENGTH / 2,
    };
  }

  /**
   * Get waypoint positions for navigating to a court.
   * Uses Manhattan routing: move along X first, then Z (through aisles).
   */
  getPathToCourtEntrance(from: Point, targetRow: number, targetCol: number): Point[] {
    const path: Point[] = [];
    const courtCenter = this.getCourtCenter(targetRow, targetCol);
    const courtWidthWithSpacing = COURT_WIDTH + this.spacing;
    const courtLengthWithSpacing = COURT_LENGTH + this.spacing;

    // Navigate to the aisle behind the target row
    const aisleZ = targetRow * courtLengthWithSpacing - this.spacing / 2;
    
    // First, move to the correct X position (using the aisle)
    if (Math.abs(from.z - aisleZ) > 0.5) {
      // Move to current X position but in the main aisle (z = -spacing/2)
      const mainAisleZ = -this.spacing / 2;
      if (from.z > mainAisleZ + 0.5) {
        path.push({ x: from.x, z: mainAisleZ });
      }
      
      // Move along X axis to align with target court
      path.push({ x: courtCenter.x, z: mainAisleZ });
      
      // Move up to the row aisle
      if (aisleZ > mainAisleZ) {
        path.push({ x: courtCenter.x, z: aisleZ });
      }
    } else {
      // Already in the right aisle area, just move X
      path.push({ x: courtCenter.x, z: from.z });
    }

    // Enter the court from the side
    path.push({
      x: courtCenter.x - COURT_WIDTH / 2 - 0.3,
      z: courtCenter.z,
    });

    return path;
  }

  /**
   * Get path for robot to return to dock
   */
  getPathToDock(from: Point, dockPosition: Point): Point[] {
    const path: Point[] = [];
    const mainAisleZ = -this.spacing / 2;

    // First go to the main aisle
    if (from.z > mainAisleZ + 0.5) {
      path.push({ x: from.x, z: mainAisleZ });
    }

    // Then go to dock X position
    path.push({ x: dockPosition.x, z: mainAisleZ });

    // Finally approach the dock
    path.push({ x: dockPosition.x, z: dockPosition.z });

    return path;
  }

  /**
   * Generate lawnmower cleaning path across a court
   */
  getCleaningPath(row: number, col: number): Point[] {
    const center = this.getCourtCenter(row, col);
    const path: Point[] = [];
    const stripeWidth = 0.5; // Width of each cleaning stripe
    const halfWidth = COURT_WIDTH / 2 - 0.2;
    const halfLength = COURT_LENGTH / 2 - 0.2;

    // Start from top-left corner
    let currentX = center.x - halfWidth;
    let direction = 1; // 1 = going positive Z, -1 = going negative Z

    while (currentX <= center.x + halfWidth) {
      if (direction === 1) {
        path.push({ x: currentX, z: center.z - halfLength });
        path.push({ x: currentX, z: center.z + halfLength });
      } else {
        path.push({ x: currentX, z: center.z + halfLength });
        path.push({ x: currentX, z: center.z - halfLength });
      }
      
      currentX += stripeWidth;
      direction *= -1;
    }

    return path;
  }
}

/**
 * Calculate distance between two points
 */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
}

/**
 * Calculate total path length
 */
export function pathLength(path: Point[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += distance(path[i - 1], path[i]);
  }
  return total;
}

/**
 * Move along a path by a certain distance, returning new position and remaining path
 */
export function moveAlongPath(
  currentPos: Point,
  path: Point[],
  distanceToMove: number
): { position: Point; remainingPath: Point[]; rotation: number; completed: boolean } {
  if (path.length === 0) {
    return { position: currentPos, remainingPath: [], rotation: 0, completed: true };
  }

  let pos = { ...currentPos };
  let remaining = [...path];
  let distanceLeft = distanceToMove;
  let rotation = 0;

  while (distanceLeft > 0 && remaining.length > 0) {
    const target = remaining[0];
    const dist = distance(pos, target);

    // Calculate rotation towards target
    rotation = Math.atan2(target.x - pos.x, target.z - pos.z);

    if (dist <= distanceLeft) {
      // Reach this waypoint
      pos = { ...target };
      remaining.shift();
      distanceLeft -= dist;
    } else {
      // Move towards waypoint
      const ratio = distanceLeft / dist;
      pos = {
        x: pos.x + (target.x - pos.x) * ratio,
        z: pos.z + (target.z - pos.z) * ratio,
      };
      distanceLeft = 0;
    }
  }

  return {
    position: pos,
    remainingPath: remaining,
    rotation,
    completed: remaining.length === 0,
  };
}
