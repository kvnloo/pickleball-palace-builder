// Performance tier system for adaptive quality
export type PerformanceTier = 'ULTRA' | 'HIGH' | 'NORMAL';

export interface PerformanceConfig {
  tier: PerformanceTier;
  shadows: boolean;
  shadowMapSize: number; // 0 for ULTRA, 512 for HIGH, 1024 for NORMAL
  shadowCasterDistance: number; // 0 for ULTRA, smaller for HIGH, larger for NORMAL
  antialiasing: boolean;
  pixelRatio: number;
  animationHz: number; // Animation update frequency
  particlesEnabled: boolean;
  maxVisiblePlayers: number;
}

export const PERFORMANCE_CONFIGS: Record<PerformanceTier, PerformanceConfig> = {
  ULTRA: {
    tier: 'ULTRA',
    shadows: false,
    shadowMapSize: 0,
    shadowCasterDistance: 0,
    antialiasing: false,
    pixelRatio: 1,
    animationHz: 60,
    particlesEnabled: false,
    maxVisiblePlayers: 400,
  },
  HIGH: {
    tier: 'HIGH',
    shadows: true,
    shadowMapSize: 512,
    shadowCasterDistance: 30, // Objects within 30m cast shadows
    antialiasing: true,
    pixelRatio: Math.min(1.5, window.devicePixelRatio),
    animationHz: 60,
    particlesEnabled: true,
    maxVisiblePlayers: 200,
  },
  NORMAL: {
    tier: 'NORMAL',
    shadows: true,
    shadowMapSize: 1024,
    shadowCasterDistance: 50, // Objects within 50m cast shadows
    antialiasing: true,
    pixelRatio: window.devicePixelRatio,
    animationHz: 60,
    particlesEnabled: true,
    maxVisiblePlayers: 100,
  },
};

export interface FrameMetrics {
  timestamp: number;
  frameTime: number; // ms
  fps: number;
}

export interface SessionMetrics {
  id: string;
  timestamp: number;
  duration: number;
  config: {
    courts: number;
    players: number;
    robots: number;
    tier: PerformanceTier;
  };
  metrics: {
    avgFps: number;
    minFps: number;
    maxFps: number;
    p1Low: number;
    p01Low: number;
    frameDrops: number;
    avgFrameTime: number;
    maxFrameTime: number;
  };
}

export interface PerformanceAnalytics {
  sessions: SessionMetrics[];
  regressions: Array<{
    detectedAt: number;
    baseline: SessionMetrics['metrics'];
    current: SessionMetrics['metrics'];
    delta: number;
  }>;
}
