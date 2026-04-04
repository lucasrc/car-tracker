import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInclination } from "./useInclination";

const STORAGE_KEY = "inclination-calibration";

describe("useInclination", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("initial state", () => {
    it("starts with zero values", () => {
      const { result } = renderHook(() => useInclination());
      expect(result.current.gradePercent).toBe(0);
      expect(result.current.angleDegrees).toBe(0);
      expect(result.current.confidence).toBe(0);
      expect(result.current.isCalibrated).toBe(false);
    });
  });

  describe("addPitchReading", () => {
    it("converges toward constant pitch reading", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addPitchReading(5, i * 50);
        }
      });

      expect(result.current.angleDegrees).toBeCloseTo(5, 0);
      expect(result.current.gradePercent).toBeGreaterThan(0);
    });

    it("smooths noisy pitch readings", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 30; i++) {
          const noisy = 3 + (Math.random() - 0.5) * 2;
          result.current.addPitchReading(noisy, i * 50);
        }
      });

      expect(Math.abs(result.current.angleDegrees - 3)).toBeLessThan(1);
    });

    it("produces positive grade for uphill (positive pitch)", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addPitchReading(5, i * 50);
        }
      });

      expect(result.current.gradePercent).toBeGreaterThan(0);
    });

    it("produces negative grade for downhill (negative pitch)", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addPitchReading(-5, i * 50);
        }
      });

      expect(result.current.gradePercent).toBeLessThan(0);
    });

    it("increases confidence as more readings arrive", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addPitchReading(3, 0);
      });
      const conf1 = result.current.confidence;

      act(() => {
        for (let i = 1; i < 50; i++) {
          result.current.addPitchReading(3, i * 50);
        }
      });
      const conf2 = result.current.confidence;

      expect(conf2).toBeGreaterThan(conf1);
    });

    it("does nothing when disabled", () => {
      const { result } = renderHook(() => useInclination({ enabled: false }));

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addPitchReading(10, i * 50);
        }
      });

      expect(result.current.angleDegrees).toBe(0);
    });
  });

  describe("addGpsReading", () => {
    it("ignores undefined altitude", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(undefined, 100);
      });

      expect(result.current.angleDegrees).toBe(0);
    });

    it("ignores short distances (< 5m)", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 3);
        result.current.addGpsReading(105, 3);
      });

      expect(result.current.angleDegrees).toBe(0);
    });

    it("computes grade from altitude delta over distance", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 100);
        result.current.addGpsReading(105, 100);
      });

      expect(result.current.angleDegrees).toBeGreaterThan(0);
    });

    it("ignores extreme grade (> 30 degrees)", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 100);
        result.current.addGpsReading(200, 10);
      });

      expect(result.current.angleDegrees).toBe(0);
    });
  });

  describe("calibration", () => {
    it("calibrates after collecting enough samples", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.calibrate();
        for (let i = 0; i < 60; i++) {
          result.current.addPitchReading(2.5, i * 50);
        }
      });

      expect(result.current.isCalibrated).toBe(true);
      expect(result.current.angleDegrees).toBeCloseTo(0, 1);
    });

    it("saves calibration to localStorage", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.calibrate();
        for (let i = 0; i < 60; i++) {
          result.current.addPitchReading(3, i * 50);
        }
      });

      const saved = localStorage.getItem(STORAGE_KEY);
      expect(saved).not.toBeNull();
      const data = JSON.parse(saved!);
      expect(data.offsetDegrees).toBeCloseTo(3, 1);
    });

    it("loads saved calibration on mount", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ offsetDegrees: 2.5, calibratedAt: "2024-01-01" }),
      );

      const { result } = renderHook(() => useInclination());
      expect(result.current.isCalibrated).toBe(true);
    });

    it("resetCalibration clears everything", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.calibrate();
        for (let i = 0; i < 60; i++) {
          result.current.addPitchReading(2, i * 50);
        }
      });
      expect(result.current.isCalibrated).toBe(true);

      act(() => {
        result.current.resetCalibration();
      });
      expect(result.current.isCalibrated).toBe(false);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("gradePercent computation", () => {
    it("converts angle to percentage correctly", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addPitchReading(5.71, i * 50);
        }
      });

      expect(Math.abs(result.current.gradePercent)).toBeGreaterThan(8);
      expect(Math.abs(result.current.gradePercent)).toBeLessThan(12);
    });
  });
});
