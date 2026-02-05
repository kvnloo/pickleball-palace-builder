 // Performance tier system for adaptive quality
 export type PerformanceTier = 'ULTRA' | 'HIGH' | 'NORMAL';
 
 export interface PerformanceConfig {
   tier: PerformanceTier;
   shadows: boolean;
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
     antialiasing: false,
     pixelRatio: 1,
     animationHz: 60,
     particlesEnabled: false,
     maxVisiblePlayers: 400,
   },
   HIGH: {
     tier: 'HIGH',
     shadows: true,
     antialiasing: true,
     pixelRatio: Math.min(1.5, window.devicePixelRatio),
     animationHz: 60,
     particlesEnabled: true,
     maxVisiblePlayers: 200,
   },
   NORMAL: {
     tier: 'NORMAL',
     shadows: true,
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