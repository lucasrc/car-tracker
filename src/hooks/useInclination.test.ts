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

  describe("addGpsReading", () => {
    it("ignores short distances (< 10m)", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 3);
        result.current.addGpsReading(105, 3);
      });

      expect(result.current.gradePercent).toBe(0);
    });

    it("computes grade from altitude delta over distance", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 50);
        result.current.addGpsReading(105, 50);
      });

      expect(result.current.gradePercent).not.toBe(0);
    });

    it("returns positive grade when climbing", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 50);
        result.current.addGpsReading(110, 100);
      });

      expect(result.current.gradePercent).toBeGreaterThan(0);
    });

    it("returns negative grade when descending", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(110, 50);
        result.current.addGpsReading(100, 100);
      });

      expect(result.current.gradePercent).toBeLessThan(0);
    });

    it("filters out extreme altitude jumps", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 50);
        result.current.addGpsReading(150, 100);
      });

      const afterJump = result.current.gradePercent;

      act(() => {
        result.current.addGpsReading(102, 50);
      });

      expect(Math.abs(result.current.gradePercent)).toBeLessThanOrEqual(
        Math.abs(afterJump) + 1,
      );
    });

    it("smooths grade changes with low-pass filter", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addGpsReading(100 + i * 2, 50);
        }
      });

      const grade1 = result.current.gradePercent;

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addGpsReading(120 - i * 2, 50);
        }
      });

      const grade2 = result.current.gradePercent;

      expect(Math.abs(grade2)).toBeLessThan(Math.abs(grade1) + 5);
    });

    it("increases confidence as more samples arrive", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 50);
      });
      const conf1 = result.current.confidence;

      act(() => {
        for (let i = 1; i < 15; i++) {
          result.current.addGpsReading(100 + i, 50);
        }
      });
      const conf2 = result.current.confidence;

      expect(conf2).toBeGreaterThan(conf1);
    });

    it("does nothing when disabled", () => {
      const { result } = renderHook(() => useInclination({ enabled: false }));

      act(() => {
        for (let i = 0; i < 20; i++) {
          result.current.addGpsReading(100 + i * 2, 50);
        }
      });

      expect(result.current.gradePercent).toBe(0);
    });

    it("maintains a sliding window of recent samples", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 50);
        result.current.addGpsReading(105, 50);
      });

      const firstGrade = result.current.gradePercent;

      act(() => {
        for (let i = 0; i < 30; i++) {
          result.current.addGpsReading(105 + i * 0.5, 50);
        }
      });

      expect(result.current.gradePercent).not.toBe(firstGrade);
    });
  });

  describe("calibration", () => {
    it("calibrates after collecting enough samples", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.calibrate();
        for (let i = 0; i < 30; i++) {
          result.current.addGpsReading(100, 50);
        }
      });

      expect(result.current.isCalibrated).toBe(true);
    });

    it("saves calibration to localStorage", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.calibrate();
        for (let i = 0; i < 30; i++) {
          result.current.addGpsReading(100, 50);
        }
      });

      const saved = localStorage.getItem(STORAGE_KEY);
      expect(saved).not.toBeNull();
      const data = JSON.parse(saved!);
      expect(data.offsetDegrees).not.toBeUndefined();
      expect(data.calibratedAt).toBeDefined();
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
        for (let i = 0; i < 30; i++) {
          result.current.addGpsReading(100, 50);
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
    it("returns positive grade for climbing", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        result.current.addGpsReading(100, 20);
        for (let i = 0; i < 10; i++) {
          result.current.addGpsReading(100 + (i + 1) * 0.5, 20);
        }
      });

      expect(result.current.gradePercent).toBeGreaterThan(0);
      expect(result.current.angleDegrees).toBeGreaterThan(0);
    });

    it("returns approximately 0% on flat terrain", () => {
      const { result } = renderHook(() => useInclination());

      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addGpsReading(100, 50);
        }
      });

      expect(Math.abs(result.current.gradePercent)).toBeLessThan(1);
    });
  });
});
