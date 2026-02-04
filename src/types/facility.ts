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
  spacing: number;
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
export const LINE_HEIGHT = 0.01;

// Net dimensions
export const NET_HEIGHT_SIDES = 36 * INCH_TO_M;  // 0.9144m
export const NET_HEIGHT_CENTER = 34 * INCH_TO_M; // 0.8636m

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

// Court status for simulation
export type CourtStatus = 
  | 'AVAILABLE_CLEAN'
  | 'IN_USE'
  | 'NEEDS_CLEANING'
  | 'CLEANING'
  | 'OUT_OF_SERVICE';

export interface CourtState {
  id: string;
  row: number;
  col: number;
  status: CourtStatus;
  cleanliness: number; // 0-100
  lastUsedAt: number | null;
  lastCleanedAt: number | null;
  activeBookingId: string | null;
}

// Booking types
export type BookingType = 'open_play' | 'lesson' | 'reservation' | 'tournament';

export interface Booking {
  id: string;
  courtId: string;
  startTime: number; // minutes since midnight
  endTime: number;
  type: BookingType;
  playerCount: 2 | 4;
  title: string;
}

// Cleaning system
export interface CleaningJob {
  id: string;
  courtId: string;
  priority: 'normal' | 'high';
  createdAt: number;
  assignedRobotId: string | null;
}

export type RobotStatus = 
  | 'idle'
  | 'navigating'
  | 'cleaning'
  | 'returning'
  | 'charging';

export interface Robot {
  id: string;
  name: string;
  status: RobotStatus;
  battery: number; // 0-100
  position: { x: number; z: number };
  targetCourtId: string | null;
  currentJobId: string | null;
  cleaningProgress: number; // 0-100 when cleaning
}

// Scheduling settings
export interface SchedulingSettings {
  operatingHoursStart: number; // minutes since midnight (e.g., 480 = 8:00 AM)
  operatingHoursEnd: number;   // e.g., 1320 = 10:00 PM
  sessionDuration: 60 | 90 | 120;
  bufferTime: 5 | 10 | 15;
  cleanAfterSession: boolean;
  demandLevel: 'light' | 'normal' | 'peak';
}

// Robot settings
export interface RobotSettings {
  navigationSpeed: number; // m/s
  cleaningSpeed: number;   // m/s
  cleaningTimePerCourt: number; // seconds
  batteryDrainPerMeter: number;
  batteryDrainPerCourt: number;
  rechargeRatePerMinute: number;
}

// App mode
export type AppMode = 'build' | 'homebase';

// Utility functions
export function getCourtId(row: number, col: number): string {
  return `court-${row}-${col}`;
}

export function parseCourtId(id: string): { row: number; col: number } {
  const parts = id.split('-');
  return { row: parseInt(parts[1]), col: parseInt(parts[2]) };
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function getStatusColor(status: CourtStatus): string {
  switch (status) {
    case 'AVAILABLE_CLEAN': return '#22c55e';
    case 'IN_USE': return '#3b82f6';
    case 'NEEDS_CLEANING': return '#f59e0b';
    case 'CLEANING': return '#8b5cf6';
    case 'OUT_OF_SERVICE': return '#ef4444';
  }
}

export function getStatusLabel(status: CourtStatus): string {
  switch (status) {
    case 'AVAILABLE_CLEAN': return 'Available';
    case 'IN_USE': return 'In Use';
    case 'NEEDS_CLEANING': return 'Needs Cleaning';
    case 'CLEANING': return 'Cleaning';
    case 'OUT_OF_SERVICE': return 'Out of Service';
  }
}
