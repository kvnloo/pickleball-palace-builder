 import { create } from 'zustand';
 import { PerformanceTier, PERFORMANCE_CONFIGS, PerformanceConfig, SessionMetrics, PerformanceAnalytics } from '@/types/performance';
 
 const RING_BUFFER_SIZE = 1000;
 const LOCAL_STORAGE_KEY = 'perf-analytics';
 
 interface PerformanceState {
   // Current tier and config
   tier: PerformanceTier;
   config: PerformanceConfig;
   
   // FPS tracking with ring buffer
   frameTimeBuffer: Float64Array;
   bufferIndex: number;
   bufferFilled: boolean;
   
   // Real-time metrics
   currentFps: number;
   avgFps: number;
   minFps: number;
   maxFps: number;
   p1Low: number;
   p01Low: number;
   frameDrops: number;
   
   // Benchmarking
   isBenchmarking: boolean;
   benchmarkStartTime: number;
   benchmarkDuration: number;
   
   // Visibility
   showFpsCounter: boolean;
   showDashboard: boolean;
   
   // Actions
   recordFrame: (deltaMs: number) => void;
   setTier: (tier: PerformanceTier) => void;
   autoAdjustTier: () => void;
   toggleFpsCounter: () => void;
   toggleDashboard: () => void;
   startBenchmark: (duration?: number) => void;
   stopBenchmark: () => SessionMetrics | null;
   exportAnalytics: () => string;
   importAnalytics: (json: string) => void;
   getAnalytics: () => PerformanceAnalytics;
   reset: () => void;
 }
 
 // Pre-allocate typed array for frame times
 const createFrameBuffer = () => new Float64Array(RING_BUFFER_SIZE);
 
 // Calculate percentile from sorted array
 function percentile(sortedArr: number[], p: number): number {
   const index = Math.ceil(sortedArr.length * p / 100) - 1;
   return sortedArr[Math.max(0, index)];
 }
 
 export const usePerformanceStore = create<PerformanceState>((set, get) => ({
   tier: 'ULTRA',
   config: PERFORMANCE_CONFIGS.ULTRA,
   
   frameTimeBuffer: createFrameBuffer(),
   bufferIndex: 0,
   bufferFilled: false,
   
   currentFps: 0,
   avgFps: 0,
   minFps: 0,
   maxFps: 0,
   p1Low: 0,
   p01Low: 0,
   frameDrops: 0,
   
   isBenchmarking: false,
   benchmarkStartTime: 0,
   benchmarkDuration: 10000,
   
   showFpsCounter: true,
   showDashboard: false,
   
   recordFrame: (deltaMs: number) => {
     const state = get();
     const { frameTimeBuffer, bufferIndex, bufferFilled, isBenchmarking, benchmarkStartTime, benchmarkDuration } = state;
     
     // Record frame time
     frameTimeBuffer[bufferIndex] = deltaMs;
     const newIndex = (bufferIndex + 1) % RING_BUFFER_SIZE;
     const newFilled = bufferFilled || newIndex === 0;
     
     // Calculate metrics every 30 frames for performance
     const shouldCalculate = newIndex % 30 === 0;
     
     if (shouldCalculate) {
       const count = newFilled ? RING_BUFFER_SIZE : newIndex;
       if (count > 0) {
         // Get frame times for calculation
         const times: number[] = [];
         for (let i = 0; i < count; i++) {
           times.push(frameTimeBuffer[i]);
         }
         
         // Sort for percentile calculations
         times.sort((a, b) => a - b);
         
         const currentFps = deltaMs > 0 ? 1000 / deltaMs : 0;
         const avgFrameTime = times.reduce((a, b) => a + b, 0) / count;
         const avgFps = avgFrameTime > 0 ? 1000 / avgFrameTime : 0;
         const maxFrameTime = times[times.length - 1];
         const minFrameTime = times[0];
         const minFps = maxFrameTime > 0 ? 1000 / maxFrameTime : 0;
         const maxFps = minFrameTime > 0 ? 1000 / minFrameTime : 0;
         const p1Low = 1000 / percentile(times, 99);
         const p01Low = 1000 / percentile(times, 99.9);
         const frameDrops = times.filter(t => t > 33.33).length; // Below 30fps
         
         set({
           bufferIndex: newIndex,
           bufferFilled: newFilled,
           currentFps: Math.round(currentFps),
           avgFps: Math.round(avgFps),
           minFps: Math.round(minFps),
           maxFps: Math.round(maxFps),
           p1Low: Math.round(p1Low),
           p01Low: Math.round(p01Low),
           frameDrops,
         });
         
         // Auto-adjust tier if needed
         if (!isBenchmarking) {
           get().autoAdjustTier();
         }
       }
     } else {
       // Just update buffer position
       set({
         bufferIndex: newIndex,
         bufferFilled: newFilled,
         currentFps: deltaMs > 0 ? Math.round(1000 / deltaMs) : state.currentFps,
       });
     }
     
     // Check benchmark completion
     if (isBenchmarking && performance.now() - benchmarkStartTime >= benchmarkDuration) {
       get().stopBenchmark();
     }
   },
   
   setTier: (tier: PerformanceTier) => {
     set({
       tier,
       config: PERFORMANCE_CONFIGS[tier],
     });
   },
   
   autoAdjustTier: () => {
     const { avgFps, tier } = get();
     
     // Only adjust if we have stable readings
     if (avgFps === 0) return;
     
     // Upgrade tier if performance is good
     if (tier === 'NORMAL' && avgFps > 120) {
       set({ tier: 'HIGH', config: PERFORMANCE_CONFIGS.HIGH });
     } else if (tier === 'HIGH' && avgFps > 400) {
       set({ tier: 'ULTRA', config: PERFORMANCE_CONFIGS.ULTRA });
     }
     
     // Downgrade tier if performance is bad
     if (tier === 'ULTRA' && avgFps < 200) {
       set({ tier: 'HIGH', config: PERFORMANCE_CONFIGS.HIGH });
     } else if (tier === 'HIGH' && avgFps < 60) {
       set({ tier: 'NORMAL', config: PERFORMANCE_CONFIGS.NORMAL });
     }
   },
   
   toggleFpsCounter: () => {
     set(state => ({ showFpsCounter: !state.showFpsCounter }));
   },
   
   toggleDashboard: () => {
     set(state => ({ showDashboard: !state.showDashboard }));
   },
   
   startBenchmark: (duration = 10000) => {
     // Reset buffer
     set({
       frameTimeBuffer: createFrameBuffer(),
       bufferIndex: 0,
       bufferFilled: false,
       isBenchmarking: true,
       benchmarkStartTime: performance.now(),
       benchmarkDuration: duration,
       frameDrops: 0,
     });
   },
   
   stopBenchmark: () => {
     const state = get();
     const { frameTimeBuffer, bufferIndex, bufferFilled, benchmarkStartTime, tier } = state;
     
     set({ isBenchmarking: false });
     
     const count = bufferFilled ? RING_BUFFER_SIZE : bufferIndex;
     if (count === 0) return null;
     
     const times: number[] = [];
     for (let i = 0; i < count; i++) {
       times.push(frameTimeBuffer[i]);
     }
     times.sort((a, b) => a - b);
     
     const avgFrameTime = times.reduce((a, b) => a + b, 0) / count;
     const maxFrameTime = times[times.length - 1];
     
     const metrics: SessionMetrics = {
       id: crypto.randomUUID(),
       timestamp: Date.now(),
       duration: performance.now() - benchmarkStartTime,
       config: {
         courts: 0, // Will be set externally
         players: 0,
         robots: 0,
         tier,
       },
       metrics: {
         avgFps: state.avgFps,
         minFps: state.minFps,
         maxFps: state.maxFps,
         p1Low: state.p1Low,
         p01Low: state.p01Low,
         frameDrops: state.frameDrops,
         avgFrameTime: Math.round(avgFrameTime * 100) / 100,
         maxFrameTime: Math.round(maxFrameTime * 100) / 100,
       },
     };
     
     // Save to localStorage
     const analytics = get().getAnalytics();
     analytics.sessions.push(metrics);
     
     // Check for regressions
     if (analytics.sessions.length > 1) {
       const previous = analytics.sessions[analytics.sessions.length - 2];
       const delta = (previous.metrics.avgFps - metrics.metrics.avgFps) / previous.metrics.avgFps;
       if (delta > 0.1) { // More than 10% regression
         analytics.regressions.push({
           detectedAt: Date.now(),
           baseline: previous.metrics,
           current: metrics.metrics,
           delta: Math.round(delta * 100),
         });
       }
     }
     
     localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(analytics));
     
     return metrics;
   },
   
   exportAnalytics: () => {
     return JSON.stringify(get().getAnalytics(), null, 2);
   },
   
   importAnalytics: (json: string) => {
     try {
       const data = JSON.parse(json) as PerformanceAnalytics;
       localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
     } catch (e) {
       console.error('Failed to import analytics:', e);
     }
   },
   
   getAnalytics: (): PerformanceAnalytics => {
     try {
       const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
       if (stored) {
         return JSON.parse(stored);
       }
     } catch (e) {
       console.error('Failed to load analytics:', e);
     }
     return { sessions: [], regressions: [] };
   },
   
   reset: () => {
     set({
       frameTimeBuffer: createFrameBuffer(),
       bufferIndex: 0,
       bufferFilled: false,
       currentFps: 0,
       avgFps: 0,
       minFps: 0,
       maxFps: 0,
       p1Low: 0,
       p01Low: 0,
       frameDrops: 0,
     });
   },
 }));
 
 // Keyboard shortcut for toggling FPS counter
 if (typeof window !== 'undefined') {
   window.addEventListener('keydown', (e) => {
     if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
       const target = e.target as HTMLElement;
       if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
         usePerformanceStore.getState().toggleFpsCounter();
       }
     }
   });
 }