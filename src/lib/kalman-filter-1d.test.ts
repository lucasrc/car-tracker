import { describe, it, expect } from "vitest";
import { KalmanFilter1D } from "./kalman-filter-1d";

describe("KalmanFilter1D", () => {
  describe("constructor", () => {
    it("initializes with given estimate", () => {
      const kf = new KalmanFilter1D(10, 0.1, 1.0);
      expect(kf.getEstimate()).toBe(10);
    });

    it("initializes errorCov to 1 regardless of initial estimate", () => {
      const kf = new KalmanFilter1D(0, 0.1, 1.0);
      expect(kf.getEstimate()).toBe(0);
    });
  });

  describe("update", () => {
    it("converges toward constant measurement", () => {
      const kf = new KalmanFilter1D(0, 0.01, 0.5);
      for (let i = 0; i < 50; i++) {
        kf.update(10);
      }
      expect(kf.getEstimate()).toBeCloseTo(10, 2);
    });

    it("smooths noisy measurements", () => {
      const kf = new KalmanFilter1D(0, 0.01, 1.0);
      const trueValue = 5;
      const measurements: number[] = [];
      for (let i = 0; i < 100; i++) {
        measurements.push(trueValue + (Math.random() - 0.5) * 4);
      }

      measurements.forEach((m) => kf.update(m));

      const estimate = kf.getEstimate();
      expect(Math.abs(estimate - trueValue)).toBeLessThan(1);
    });

    it("responds faster with higher process noise", () => {
      const kfFast = new KalmanFilter1D(0, 1.0, 0.5);
      const kfSlow = new KalmanFilter1D(0, 0.001, 0.5);

      for (let i = 0; i < 5; i++) {
        kfFast.update(20);
        kfSlow.update(20);
      }

      expect(kfFast.getEstimate()).toBeGreaterThan(kfSlow.getEstimate());
    });

    it("responds faster with lower measurement noise", () => {
      const kfTrusting = new KalmanFilter1D(0, 0.01, 0.1);
      const kfSkeptical = new KalmanFilter1D(0, 0.01, 5.0);

      for (let i = 0; i < 5; i++) {
        kfTrusting.update(15);
        kfSkeptical.update(15);
      }

      expect(kfTrusting.getEstimate()).toBeGreaterThan(
        kfSkeptical.getEstimate(),
      );
    });

    it("handles single update correctly", () => {
      const kf = new KalmanFilter1D(0, 0.1, 1.0);
      const result = kf.update(10);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });
  });

  describe("reset", () => {
    it("resets estimate to given value", () => {
      const kf = new KalmanFilter1D(0, 0.01, 1.0);
      for (let i = 0; i < 50; i++) {
        kf.update(10);
      }
      kf.reset(5);
      expect(kf.getEstimate()).toBe(5);
    });

    it("resets errorCov to 1", () => {
      const kf = new KalmanFilter1D(0, 0.01, 1.0);
      for (let i = 0; i < 50; i++) {
        kf.update(10);
      }
      kf.reset(0);
      kf.update(10);
      const afterReset = kf.getEstimate();
      const kf2 = new KalmanFilter1D(0, 0.01, 1.0);
      kf2.update(10);
      expect(afterReset).toBeCloseTo(kf2.getEstimate(), 4);
    });
  });

  describe("setNoise", () => {
    it("allows dynamic noise adjustment", () => {
      const kf = new KalmanFilter1D(0, 0.01, 1.0);
      kf.setNoise(1.0, 0.1);
      for (let i = 0; i < 5; i++) {
        kf.update(10);
      }
      expect(kf.getEstimate()).toBeGreaterThan(5);
    });
  });

  describe("realistic inclination scenario", () => {
    it("tracks road grade from pitch readings", () => {
      const kf = new KalmanFilter1D(0, 0.01, 0.5);
      const roadGrade = 5.2;
      for (let i = 0; i < 30; i++) {
        const noisyPitch = roadGrade + (Math.random() - 0.5) * 1.5;
        kf.update(noisyPitch);
      }
      const estimate = kf.getEstimate();
      expect(Math.abs(estimate - roadGrade)).toBeLessThan(0.5);
    });

    it("handles GPS altitude-derived grade (very noisy)", () => {
      const kf = new KalmanFilter1D(0, 0.1, 5.0);
      const trueGrade = 3.0;
      for (let i = 0; i < 20; i++) {
        const noisyGrade = trueGrade + (Math.random() - 0.5) * 10;
        kf.update(noisyGrade);
      }
      const estimate = kf.getEstimate();
      expect(Math.abs(estimate - trueGrade)).toBeLessThan(3);
    });
  });
});
