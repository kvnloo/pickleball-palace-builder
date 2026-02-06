/**
 * Streaming Statistics Library
 *
 * Zero-allocation implementations of:
 * - P² algorithm for streaming percentile estimation
 * - Welford's algorithm for running mean/variance
 * - Performance tracking facade
 */

/**
 * P² (Piecewise-Parabolic) Algorithm for streaming percentile estimation.
 *
 * Maintains 5 markers to estimate any percentile in O(1) space and O(1) time per update.
 * Based on: Jain & Chlamtac, "The P² Algorithm for Dynamic Calculation of Quantiles
 * and Histograms Without Storing Observations", 1985.
 *
 * Zero allocations in update() - all arrays are pre-allocated.
 */
export class P2StreamingPercentile {
  // The percentile to estimate (0 < p < 1)
  private readonly p: number;

  // Marker heights (quantile values) - fixed array of 5
  private readonly q: Float64Array;

  // Marker positions (actual) - fixed array of 5
  private readonly n: Float64Array;

  // Desired marker positions - fixed array of 5
  private readonly np: Float64Array;

  // Desired position increments - fixed array of 5
  private readonly dn: Float64Array;

  // Number of observations
  private count: number;

  constructor(percentile: number) {
    this.p = percentile;
    this.count = 0;

    // Pre-allocate all arrays (zero allocation guarantee)
    this.q = new Float64Array(5);
    this.n = new Float64Array(5);
    this.np = new Float64Array(5);
    this.dn = new Float64Array(5);

    // Initialize desired increments (these don't change)
    this.dn[0] = 0;
    this.dn[1] = percentile / 2;
    this.dn[2] = percentile;
    this.dn[3] = (1 + percentile) / 2;
    this.dn[4] = 1;
  }

  /**
   * Add a new observation. O(1) time, zero allocations.
   */
  update(value: number): void {
    this.count++;

    if (this.count <= 5) {
      // Initial phase: store first 5 observations
      this.q[this.count - 1] = value;

      if (this.count === 5) {
        // Sort initial 5 values (small fixed sort, no allocation)
        this.sortInitial();

        // Initialize marker positions
        for (let i = 0; i < 5; i++) {
          this.n[i] = i + 1;
        }

        // Initialize desired positions
        this.np[0] = 1;
        this.np[1] = 1 + 2 * this.p;
        this.np[2] = 1 + 4 * this.p;
        this.np[3] = 3 + 2 * this.p;
        this.np[4] = 5;
      }
      return;
    }

    // Find cell k where x falls
    let k: number;
    if (value < this.q[0]) {
      this.q[0] = value;
      k = 0;
    } else if (value < this.q[1]) {
      k = 0;
    } else if (value < this.q[2]) {
      k = 1;
    } else if (value < this.q[3]) {
      k = 2;
    } else if (value < this.q[4]) {
      k = 3;
    } else {
      k = 3;
      if (value > this.q[4]) {
        this.q[4] = value;
      }
    }

    // Increment positions of markers k+1 through 4
    for (let i = k + 1; i < 5; i++) {
      this.n[i]++;
    }

    // Update desired positions
    for (let i = 0; i < 5; i++) {
      this.np[i] += this.dn[i];
    }

    // Adjust heights of markers 1, 2, 3 if necessary
    for (let i = 1; i < 4; i++) {
      const d = this.np[i] - this.n[i];

      if (
        (d >= 1 && this.n[i + 1] - this.n[i] > 1) ||
        (d <= -1 && this.n[i - 1] - this.n[i] < -1)
      ) {
        const sign = d >= 0 ? 1 : -1;

        // Try parabolic formula
        const qNew = this.parabolic(i, sign);

        if (qNew > this.q[i - 1] && qNew < this.q[i + 1]) {
          this.q[i] = qNew;
        } else {
          // Use linear formula
          this.q[i] = this.linear(i, sign);
        }

        this.n[i] += sign;
      }
    }
  }

  /**
   * Get the current percentile estimate.
   * Returns 0 if fewer than 5 observations have been recorded.
   */
  query(): number {
    if (this.count < 5) {
      return 0;
    }
    return this.q[2]; // The middle marker tracks the p-th percentile
  }

  /**
   * Get the number of observations.
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Reset all state to initial.
   */
  reset(): void {
    this.count = 0;
    for (let i = 0; i < 5; i++) {
      this.q[i] = 0;
      this.n[i] = 0;
      this.np[i] = 0;
    }
  }

  /**
   * Parabolic (P²) interpolation formula.
   */
  private parabolic(i: number, d: number): number {
    const qi = this.q[i];
    const qip1 = this.q[i + 1];
    const qim1 = this.q[i - 1];
    const ni = this.n[i];
    const nip1 = this.n[i + 1];
    const nim1 = this.n[i - 1];

    const term1 = d / (nip1 - nim1);
    const term2 =
      (ni - nim1 + d) * ((qip1 - qi) / (nip1 - ni)) +
      (nip1 - ni - d) * ((qi - qim1) / (ni - nim1));

    return qi + term1 * term2;
  }

  /**
   * Linear interpolation formula (fallback).
   */
  private linear(i: number, d: number): number {
    const idx = i + d;
    return (
      this.q[i] +
      (d * (this.q[idx] - this.q[i])) / (this.n[idx] - this.n[i])
    );
  }

  /**
   * Sort the initial 5 values in place (insertion sort, no allocation).
   */
  private sortInitial(): void {
    // Simple insertion sort for 5 elements
    for (let i = 1; i < 5; i++) {
      const key = this.q[i];
      let j = i - 1;
      while (j >= 0 && this.q[j] > key) {
        this.q[j + 1] = this.q[j];
        j--;
      }
      this.q[j + 1] = key;
    }
  }
}

/**
 * Running statistics using Welford's online algorithm.
 *
 * Calculates mean, variance, min, max in O(1) per update with zero allocations.
 * Numerically stable for large sample sizes.
 */
export class RunningStats {
  /** Number of observations */
  count: number = 0;

  /** Minimum value observed */
  min: number = Infinity;

  /** Maximum value observed */
  max: number = -Infinity;

  /** Number of frames exceeding 33.33ms (frame drops at 30fps) */
  frameDrops: number = 0;

  // Welford's algorithm state
  private mean: number = 0;
  private m2: number = 0; // Sum of squared differences from mean

  // Frame drop threshold (>33.33ms = below 30fps)
  private static readonly FRAME_DROP_THRESHOLD = 33.33;

  /**
   * Add a new observation. O(1) time, zero allocations.
   */
  update(value: number): void {
    this.count++;

    // Update min/max
    if (value < this.min) this.min = value;
    if (value > this.max) this.max = value;

    // Count frame drops (frames taking longer than 33.33ms)
    if (value > RunningStats.FRAME_DROP_THRESHOLD) {
      this.frameDrops++;
    }

    // Welford's online algorithm for mean and variance
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  /**
   * Get the current mean. Returns 0 if no observations.
   */
  getAvg(): number {
    return this.count === 0 ? 0 : this.mean;
  }

  /**
   * Get the current sample variance. Returns 0 if fewer than 2 observations.
   */
  getVariance(): number {
    return this.count < 2 ? 0 : this.m2 / (this.count - 1);
  }

  /**
   * Get the current standard deviation. Returns 0 if fewer than 2 observations.
   */
  getStdDev(): number {
    return Math.sqrt(this.getVariance());
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.count = 0;
    this.min = Infinity;
    this.max = -Infinity;
    this.frameDrops = 0;
    this.mean = 0;
    this.m2 = 0;
  }
}

/**
 * Performance metrics returned by the tracker.
 */
export interface PerformanceMetrics {
  count: number;
  avgFrameTime: number;
  frameDrops: number;
  p99FrameTime: number;
  p999FrameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
}

/**
 * Performance tracker interface.
 */
export interface PerformanceTracker {
  update(dt: number): void;
  getMetrics(): PerformanceMetrics;
  reset(): void;
}

/**
 * Factory function to create a performance tracker.
 *
 * Combines RunningStats and P2StreamingPercentile to provide
 * comprehensive frame time statistics with zero allocations in hot path.
 */
export function createPerformanceTracker(): PerformanceTracker {
  // Pre-allocate all sub-trackers
  const stats = new RunningStats();
  const p99 = new P2StreamingPercentile(0.99);
  const p999 = new P2StreamingPercentile(0.999);

  return {
    /**
     * Record a frame time. O(1) time, zero allocations.
     */
    update(dt: number): void {
      stats.update(dt);
      p99.update(dt);
      p999.update(dt);
    },

    /**
     * Get current performance metrics.
     */
    getMetrics(): PerformanceMetrics {
      return {
        count: stats.count,
        avgFrameTime: stats.getAvg(),
        frameDrops: stats.frameDrops,
        p99FrameTime: p99.query(),
        p999FrameTime: p999.query(),
        minFrameTime: stats.count > 0 ? stats.min : 0,
        maxFrameTime: stats.count > 0 ? stats.max : 0,
      };
    },

    /**
     * Reset all state.
     */
    reset(): void {
      stats.reset();
      p99.reset();
      p999.reset();
    },
  };
}
