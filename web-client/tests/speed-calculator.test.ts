import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpeedCalculator } from '../src/utils/progress/speed-calculator';

describe('SpeedCalculator', () => {
  let calculator: SpeedCalculator;
  const mockTime = 1000000; // Base timestamp

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockTime);
    calculator = new SpeedCalculator();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default window size', () => {
      const calc = new SpeedCalculator();
      expect(calc).toBeInstanceOf(SpeedCalculator);
    });

    it('should initialize with custom window size', () => {
      const calc = new SpeedCalculator(5000);
      expect(calc).toBeInstanceOf(SpeedCalculator);
    });
  });

  describe('addDataPoint', () => {
    it('should add data point and calculate speed', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 1000);

      const speed = calculator.getCurrentSpeed();
      expect(speed).toBeGreaterThan(0);
    });

    it('should handle negative bytes by treating them as 0', () => {
      calculator.addDataPoint(-500, mockTime);
      calculator.addDataPoint(1000, mockTime + 1000);

      const averageSpeed = calculator.getAverageSpeed();
      expect(averageSpeed).toBeGreaterThan(0);
    });

    it('should use current time when timestamp not provided', () => {
      calculator.addDataPoint(1000);
      expect(calculator.getCurrentSpeed()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('speed calculations', () => {
    it('should calculate current speed correctly', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 1000); // 1000 bytes in 1 second = 1000 B/s

      const speed = calculator.getCurrentSpeed();
      // Due to exponential smoothing, the speed won't be exactly 1000
      expect(speed).toBeGreaterThan(0);
      expect(speed).toBeLessThanOrEqual(1000);
    });

    it('should track peak speed', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(2000, mockTime + 500); // High speed burst
      calculator.addDataPoint(500, mockTime + 1500); // Lower speed

      const peakSpeed = calculator.getPeakSpeed();
      expect(peakSpeed).toBeGreaterThan(calculator.getCurrentSpeed());
    });

    it('should calculate average speed over total time', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 1000);
      calculator.addDataPoint(1000, mockTime + 2000);

      const averageSpeed = calculator.getAverageSpeed();
      expect(averageSpeed).toBeCloseTo(1500, 0); // 3000 bytes over 2 seconds
    });

    it('should return 0 for average speed when no data', () => {
      expect(calculator.getAverageSpeed()).toBe(0);
    });

    it('should handle single data point', () => {
      calculator.addDataPoint(1000, mockTime);

      expect(calculator.getCurrentSpeed()).toBe(0);
      expect(calculator.getAverageSpeed()).toBe(0);
    });
  });

  describe('max speed tracking', () => {
    it('should update max speed only after sufficient time elapsed', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 100); // Too short duration

      expect(calculator.getMaxSpeed()).toBe(calculator.getPeakSpeed());
    });

    it('should update max speed after sufficient time', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 600); // Sufficient duration

      const maxSpeed = calculator.getMaxSpeed();
      expect(maxSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('time window management', () => {
    it('should remove old data points outside time window', () => {
      const windowSize = 1000;
      const calc = new SpeedCalculator(windowSize);

      calc.addDataPoint(1000, mockTime);
      calc.addDataPoint(1000, mockTime + 500);
      calc.addDataPoint(1000, mockTime + 1200); // Should remove first point

      expect(calc.getCurrentSpeed()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('smoothing', () => {
    it('should apply exponential smoothing to current speed', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(2000, mockTime + 1000);
      const speed1 = calculator.getCurrentSpeed();

      calculator.addDataPoint(500, mockTime + 2000);
      const speed2 = calculator.getCurrentSpeed();

      // Speed should change gradually due to smoothing
      expect(Math.abs(speed2 - speed1)).toBeLessThan(1000);
    });
  });

  describe('total time tracking', () => {
    it('should track total elapsed time correctly', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 2000);

      const totalTime = calculator.getTotalTime();
      expect(totalTime).toBe(2); // 2 seconds
    });

    it('should return 0 when no data points added', () => {
      expect(calculator.getTotalTime()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all values to initial state', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime + 1000);

      calculator.reset();

      expect(calculator.getCurrentSpeed()).toBe(0);
      expect(calculator.getMaxSpeed()).toBe(0);
      expect(calculator.getPeakSpeed()).toBe(0);
      expect(calculator.getAverageSpeed()).toBe(0);
      expect(calculator.getTotalTime()).toBe(0);
    });
  });

  describe('retry scenario', () => {
    it('should include retry delay in denominator but not retry bytes in numerator for average speed', () => {
      // The SpeedCalculator is constructed at mockTime (simulating operation start).
      // Retry delay between chunks is included in total time (denominator),
      // but only bytes from successful reads (via addDataPoint) count toward totalBytes (numerator).
      const CHUNK_SIZE = 1000;

      // Chunk 1 read successfully at T+1s
      calculator.addDataPoint(CHUNK_SIZE, mockTime + 1000);

      // 5-second retry gap: no addDataPoint calls (failed reads don't contribute bytes)
      // Chunk 2 read successfully at T+6s (after retries)
      calculator.addDataPoint(CHUNK_SIZE, mockTime + 6000);

      // Average = 2000 bytes / 6 seconds (startTime = mockTime from constructor)
      // The 5s retry gap is correctly included in the denominator, reducing average speed.
      const avgSpeed = calculator.getAverageSpeed();
      expect(avgSpeed).toBeCloseTo(2000 / 6, 0); // ~333 B/s
    });

    it('should converge to gap-based speed (not near-zero) when window repeatedly slides to one item', () => {
      // Scenario: long operation followed by repeated retries that cause the sliding window
      // to always have only one item. With the bug, `startTime` (constructor time) grows
      // increasingly stale, causing rawSpeed → 0. With the fix, `prevTimestamp` keeps the
      // denominator equal to the retry gap, giving a stable and accurate speed estimate.
      const windowSize = 1000;
      const calc = new SpeedCalculator(windowSize);
      const CHUNK_SIZE = 1000;

      // Simulate a long operation: 100 chunks at 100ms intervals (10 seconds)
      for (let i = 0; i < 100; i++) {
        calc.addDataPoint(CHUNK_SIZE, mockTime + i * 100);
      }
      // After the loop: prevTimestamp = mockTime + 9800, lastTimestamp = mockTime + 9900
      // startTime = mockTime (construction time, 10s before the last chunk)

      // Simulate 50 retry chunks, each separated by 4s (> 1s window).
      // Each chunk will cause all previous window items to slide out → always 1 item in window.
      const GAP_MS = 4000;
      for (let n = 1; n <= 50; n++) {
        calc.addDataPoint(CHUNK_SIZE, mockTime + 9900 + n * GAP_MS);
      }

      // With the fix: for every retry chunk, start = prevTimestamp (previous chunk time),
      //   elapsedMs = GAP_MS = 4000ms, rawSpeed = 1000 / 4 = 250 B/s (stable).
      //   EMA converges → ~250 B/s.
      //
      // With the original bug: start = startTime = mockTime,
      //   elapsedMs grows: 9900 + n*4000 → after 50 retries = ~209900ms,
      //   rawSpeed = 1000 / 209.9 ≈ 4.8 B/s (near zero).
      //   EMA converges → near zero.
      const speed = calc.getCurrentSpeed();
      expect(speed).toBeGreaterThan(100); // Fix: ~250 B/s; Bug: ~5 B/s
    });
  });

  describe('edge cases', () => {
    it('should handle zero bytes', () => {
      calculator.addDataPoint(0, mockTime);
      calculator.addDataPoint(0, mockTime + 1000);

      expect(calculator.getCurrentSpeed()).toBe(0);
      expect(calculator.getAverageSpeed()).toBe(0);
    });

    it('should handle same timestamp', () => {
      calculator.addDataPoint(1000, mockTime);
      calculator.addDataPoint(1000, mockTime); // Same timestamp

      expect(calculator.getCurrentSpeed()).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large numbers', () => {
      const largeNumber = 1e9;
      calculator.addDataPoint(largeNumber, mockTime);
      calculator.addDataPoint(largeNumber, mockTime + 1000);

      expect(calculator.getCurrentSpeed()).toBeGreaterThan(0);
      expect(isFinite(calculator.getCurrentSpeed())).toBe(true);
    });
  });
});
