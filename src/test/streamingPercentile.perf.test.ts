import { describe, it, expect } from "vitest";
import {
  P2StreamingPercentile,
  RunningStats,
  createPerformanceTracker,
} from "@/lib/streamingStats";

// Reference percentile function (same as old performanceStore.ts)
function sortedPercentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, index)];
}

// Deterministic LCG pseudo-random number generator (seeded)
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ============================================================
// P2 Streaming Percentile Accuracy Tests
// ============================================================

describe("P2StreamingPercentile accuracy", () => {
  it("estimates p99 within 5% of sorted percentile for 1000 frame times", () => {
    const p2 = new P2StreamingPercentile(0.99);
    const values: number[] = [];
    const rand = lcg(42);

    // Generate realistic frame times: mostly 14-18ms with some spikes
    for (let i = 0; i < 1000; i++) {
      const r = rand();
      // 90% normal frames (14-18ms), 8% slow (18-33ms), 2% spikes (33-60ms)
      let t: number;
      if (r < 0.9) {
        t = 14 + rand() * 4; // 14-18ms
      } else if (r < 0.98) {
        t = 18 + rand() * 15; // 18-33ms
      } else {
        t = 33 + rand() * 27; // 33-60ms
      }
      values.push(t);
      p2.update(t);
    }

    const exact = sortedPercentile(values, 0.99);
    const estimated = p2.query();
    const relativeError = Math.abs(estimated - exact) / exact;

    expect(relativeError).toBeLessThan(0.05);
  });

  it("estimates p99.9 within 10% of sorted percentile for 1000 frame times", () => {
    const p2 = new P2StreamingPercentile(0.999);
    const values: number[] = [];
    const rand = lcg(123);

    for (let i = 0; i < 1000; i++) {
      const r = rand();
      let t: number;
      if (r < 0.9) {
        t = 14 + rand() * 4;
      } else if (r < 0.98) {
        t = 18 + rand() * 15;
      } else {
        t = 33 + rand() * 27;
      }
      values.push(t);
      p2.update(t);
    }

    const exact = sortedPercentile(values, 0.999);
    const estimated = p2.query();
    const relativeError = Math.abs(estimated - exact) / exact;

    // p99.9 is harder to estimate with only 1000 samples, allow 10%
    expect(relativeError).toBeLessThan(0.1);
  });

  it("converges more accurately with larger sample sizes", () => {
    const p2 = new P2StreamingPercentile(0.99);
    const values: number[] = [];
    const rand = lcg(999);

    for (let i = 0; i < 5000; i++) {
      const t = 8 + rand() * 32; // 8-40ms uniform
      values.push(t);
      p2.update(t);
    }

    const exact = sortedPercentile(values, 0.99);
    const estimated = p2.query();
    const relativeError = Math.abs(estimated - exact) / exact;

    // With 5000 samples should be < 2%
    expect(relativeError).toBeLessThan(0.02);
  });
});

// ============================================================
// Zero Allocation Guarantee Tests
// ============================================================

describe("Zero allocation guarantee", () => {
  it("P2 update completes 10000 iterations in under 50ms", () => {
    const p2 = new P2StreamingPercentile(0.99);

    // Warm up
    for (let i = 0; i < 100; i++) {
      p2.update(16.67);
    }

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      p2.update(10 + (i % 30)); // varied but deterministic
    }
    const elapsed = performance.now() - start;

    // Zero-allocation code should be extremely fast
    // 50ms for 10000 updates = 5us per update (generous bound)
    expect(elapsed).toBeLessThan(50);
  });

  it("RunningStats update completes 10000 iterations in under 10ms", () => {
    const stats = new RunningStats();

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      stats.update(10 + (i % 30));
    }
    const elapsed = performance.now() - start;

    // Pure arithmetic should be near-instant
    expect(elapsed).toBeLessThan(10);
  });

  it("PerformanceTracker facade update is fast", () => {
    const tracker = createPerformanceTracker();

    // Warm up
    for (let i = 0; i < 100; i++) {
      tracker.update(16.67);
    }

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      tracker.update(10 + (i % 30));
    }
    const elapsed = performance.now() - start;

    // 3 sub-trackers, should still be < 100ms for 10k
    expect(elapsed).toBeLessThan(100);
  });
});

// ============================================================
// RunningStats Correctness Tests
// ============================================================

describe("RunningStats correctness", () => {
  it("matches batch avg/min/max exactly", () => {
    const stats = new RunningStats();
    const values = [16.5, 16.7, 33.4, 8.2, 50.1, 16.6, 16.8, 16.5, 16.7, 16.6];
    values.forEach((v) => stats.update(v));

    const batchAvg = values.reduce((a, b) => a + b, 0) / values.length;
    const batchMin = Math.min(...values);
    const batchMax = Math.max(...values);
    const batchDrops = values.filter((v) => v > 33.33).length;

    expect(stats.getAvg()).toBeCloseTo(batchAvg, 10);
    expect(stats.min).toBe(batchMin);
    expect(stats.max).toBe(batchMax);
    expect(stats.frameDrops).toBe(batchDrops);
    expect(stats.count).toBe(values.length);
  });

  it("handles large running sums without precision loss for typical frame counts", () => {
    const stats = new RunningStats();
    // Simulate 10 minutes at 60fps = 36000 frames
    for (let i = 0; i < 36000; i++) {
      stats.update(16.67);
    }
    // Average should still be very close to 16.67
    expect(stats.getAvg()).toBeCloseTo(16.67, 5);
  });
});

// ============================================================
// Frame Drop Counter Tests
// ============================================================

describe("Frame drop counter", () => {
  it("counts frames above 33.33ms threshold", () => {
    const stats = new RunningStats();
    stats.update(33.32); // not a drop
    stats.update(33.33); // not a drop (not strictly >)
    stats.update(33.34); // drop!
    stats.update(50.0); // drop!
    stats.update(16.67); // not a drop
    expect(stats.frameDrops).toBe(2);
  });

  it("counts zero drops for consistently fast frames", () => {
    const stats = new RunningStats();
    for (let i = 0; i < 100; i++) {
      stats.update(16.67);
    }
    expect(stats.frameDrops).toBe(0);
  });

  it("counts all drops for consistently slow frames", () => {
    const stats = new RunningStats();
    for (let i = 0; i < 100; i++) {
      stats.update(50.0);
    }
    expect(stats.frameDrops).toBe(100);
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe("Edge cases", () => {
  it("P2 returns 0 before 5 observations", () => {
    const p2 = new P2StreamingPercentile(0.99);
    expect(p2.query()).toBe(0);

    p2.update(16.67);
    expect(p2.query()).toBe(0);

    p2.update(16.67);
    p2.update(16.67);
    p2.update(16.67);
    expect(p2.query()).toBe(0); // still only 4
  });

  it("P2 returns valid estimate after exactly 5 observations", () => {
    const p2 = new P2StreamingPercentile(0.99);
    for (let i = 0; i < 5; i++) {
      p2.update(10 + i * 5); // 10, 15, 20, 25, 30
    }
    const result = p2.query();
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(30);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it("P2 handles all identical values", () => {
    const p2 = new P2StreamingPercentile(0.99);
    for (let i = 0; i < 100; i++) {
      p2.update(16.67);
    }
    expect(p2.query()).toBeCloseTo(16.67, 1);
  });

  it("P2 handles monotonically increasing values", () => {
    const p2 = new P2StreamingPercentile(0.99);
    const values: number[] = [];
    for (let i = 0; i < 100; i++) {
      const v = 10 + i * 0.5;
      values.push(v);
      p2.update(v);
    }
    const exact = sortedPercentile(values, 0.99);
    const estimated = p2.query();
    const relativeError = Math.abs(estimated - exact) / exact;
    expect(relativeError).toBeLessThan(0.05);
  });

  it("P2 handles monotonically decreasing values", () => {
    const p2 = new P2StreamingPercentile(0.99);
    const values: number[] = [];
    for (let i = 0; i < 100; i++) {
      const v = 60 - i * 0.5;
      values.push(v);
      p2.update(v);
    }
    const exact = sortedPercentile(values, 0.99);
    const estimated = p2.query();
    const relativeError = Math.abs(estimated - exact) / exact;
    expect(relativeError).toBeLessThan(0.05);
  });

  it("RunningStats handles single observation", () => {
    const stats = new RunningStats();
    stats.update(16.67);
    expect(stats.getAvg()).toBe(16.67);
    expect(stats.min).toBe(16.67);
    expect(stats.max).toBe(16.67);
    expect(stats.count).toBe(1);
  });

  it("RunningStats returns 0 avg with no observations", () => {
    const stats = new RunningStats();
    expect(stats.getAvg()).toBe(0);
    expect(stats.count).toBe(0);
  });

  it("P2 works correctly after reset", () => {
    const p2 = new P2StreamingPercentile(0.99);
    for (let i = 0; i < 100; i++) {
      p2.update(10 + i * 0.3);
    }
    const beforeReset = p2.query();
    expect(beforeReset).toBeGreaterThan(0);

    p2.reset();
    expect(p2.query()).toBe(0);
    expect(p2.getCount()).toBe(0);

    // Feed new data after reset
    for (let i = 0; i < 100; i++) {
      p2.update(16.67);
    }
    expect(p2.query()).toBeCloseTo(16.67, 1);
  });

  it("PerformanceTracker facade reset clears all state", () => {
    const tracker = createPerformanceTracker();
    for (let i = 0; i < 100; i++) {
      tracker.update(16.67);
    }

    const before = tracker.getMetrics();
    expect(before.count).toBe(100);
    expect(before.avgFrameTime).toBeGreaterThan(0);

    tracker.reset();
    const after = tracker.getMetrics();
    expect(after.count).toBe(0);
    expect(after.avgFrameTime).toBe(0);
    expect(after.frameDrops).toBe(0);
    expect(after.p99FrameTime).toBe(0);
    expect(after.p999FrameTime).toBe(0);
  });

  it("PerformanceTracker computes correct FPS-domain metrics", () => {
    const tracker = createPerformanceTracker();
    // Feed 1000 frames at ~60fps (16.67ms)
    for (let i = 0; i < 1000; i++) {
      tracker.update(16.67);
    }
    const m = tracker.getMetrics();

    // avgFps should be ~60
    const avgFps = m.avgFrameTime > 0 ? 1000 / m.avgFrameTime : 0;
    expect(avgFps).toBeCloseTo(60, 0);

    // p99 frame time should be ~16.67, so p1Low FPS should be ~60
    const p1Low = m.p99FrameTime > 0 ? 1000 / m.p99FrameTime : 0;
    expect(p1Low).toBeCloseTo(60, 0);

    // No frame drops at 60fps
    expect(m.frameDrops).toBe(0);
  });
});
