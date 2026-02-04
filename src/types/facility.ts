export type SurfaceType = 'hardwood' | 'rubber' | 'polypropylene' | 'vinyl';

export interface EvenConfig {
  mode: 'even';
  rows: number;
  cols: number;
}

export interface UnevenConfig {
  mode: 'uneven';
  rows: number;
  maxCols: number;
  rowLengths: number[];
}

export type FacilityConfig = EvenConfig | UnevenConfig;

export interface FacilityState {
  config: FacilityConfig;
  surfaceType: SurfaceType;
  spacing: number; // in meters
  showNet: boolean;
  showLines: boolean;
}

// Conversion constants
export const FT_TO_M = 0.3048;
export const INCH_TO_M = 0.0254;

// Court dimensions in meters
export const COURT_WIDTH = 20 * FT_TO_M;  // 6.096m
export const COURT_LENGTH = 44 * FT_TO_M; // 13.4112m
export const KITCHEN_DEPTH = 7 * FT_TO_M; // 2.1336m
export const LINE_WIDTH = 2 * INCH_TO_M;  // 0.0508m
export const LINE_HEIGHT = 0.01; // Slight elevation above surface

// Net dimensions
export const NET_HEIGHT_SIDES = 36 * INCH_TO_M;  // 0.9144m
export const NET_HEIGHT_CENTER = 34 * INCH_TO_M; // 0.8636m
export const NET_POST_OFFSET = 1 * FT_TO_M;      // 0.3048m outside sideline

// Surface materials configuration
export const SURFACE_MATERIALS: Record<SurfaceType, { color: string; roughness: number; metalness: number; name: string }> = {
  hardwood: {
    color: '#c4a574',
    roughness: 0.4,
    metalness: 0.1,
    name: 'Hardwood (Maple Gym)',
  },
  rubber: {
    color: '#3d3d3d',
    roughness: 0.7,
    metalness: 0.0,
    name: 'Rubber Sports Floor',
  },
  polypropylene: {
    color: '#2563eb',
    roughness: 0.5,
    metalness: 0.05,
    name: 'Polypropylene Tiles',
  },
  vinyl: {
    color: '#94a3b8',
    roughness: 0.3,
    metalness: 0.05,
    name: 'Vinyl/PU Flooring',
  },
};
