import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConsumptionModel } from "./useConsumptionModel";

describe("useConsumptionModel", () => {
  describe("calculateSpeedFactor", () => {
    it("returns 1.0 when speed is below threshold (90 km/h)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 80, 10, 0);
      expect(factors.speedFactor).toBe(1);
    });

    it("applies penalty above 90 km/h", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 100, 10, 0);
      expect(factors.speedFactor).toBeGreaterThan(1);
    });

    it("calculates correct penalty per km/h (0.9% per km/h)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 100, 10, 0);
      expect(factors.speedFactor).toBeCloseTo(1.09, 2);
    });
  });

  describe("calculateAggressionFactor", () => {
    it("returns 1.0 when acceleration is below moderate threshold", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 0, 0);
      expect(factors.aggressionFactor).toBe(1);
      expect(factors.isAggressive).toBe(false);
    });

    it("applies 6% penalty for moderate acceleration (1.5-2.5 m/s²)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      act(() => {
        result.current.addReading(10, 1000);
        result.current.addReading(15, 2000);
      });
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 10, 0);
      expect(factors.aggressionFactor).toBe(1.06);
    });

    it("applies 10% penalty for severe acceleration (>2.5 m/s²)", () => {
      const { result } = renderHook(() => useConsumptionModel());
      act(() => {
        result.current.addReading(10, 1000);
        result.current.addReading(20, 2000);
      });
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 10, 0);
      expect(factors.aggressionFactor).toBe(1.1);
    });
  });

  describe("calculateIdleFactor", () => {
    it("returns 1.0 when no idle time", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 0, 0);
      expect(factors.idleFactor).toBe(1);
    });

    it("applies idle penalty proportionally", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 0, 50);
      expect(factors.idleFactor).toBe(1.04);
    });
  });

  describe("calculateStabilityFactor", () => {
    it("returns 1.0 when no variance", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 0, 0);
      expect(factors.stabilityFactor).toBe(1);
    });

    it("applies stability penalty based on variance", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 100, 0);
      expect(factors.stabilityFactor).toBe(1.05);
    });
  });

  describe("calculateAdjustedConsumption", () => {
    it("returns base consumption when all factors are 1", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 0, 0);
      expect(factors.adjustedKmPerLiter).toBe(12);
    });

    it("reduces km/L when penalties apply", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 110, 20, 30);
      expect(factors.adjustedKmPerLiter).toBeLessThan(12);
    });

    it("returns baseKmPerLiter in result", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 0, 0);
      expect(factors.baseKmPerLiter).toBe(12);
    });
  });

  describe("addReading and getMetrics", () => {
    it("tracks speed readings over time", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(10, 1000);
        result.current.addReading(15, 2000);
        result.current.addReading(20, 3000);
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.avgSpeedKmh).toBeGreaterThan(0);
    });

    it("calculates max speed correctly", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(10, 1000);
        result.current.addReading(30, 2000);
        result.current.addReading(20, 3000);
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.maxSpeedKmh).toBeCloseTo(108, 0);
    });

    it("calculates idle percentage", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(0, 1000);
        result.current.addReading(0, 2000);
        result.current.addReading(0, 3000);
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.idlePercentage).toBeGreaterThan(0);
    });

    it("filters old readings outside window", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(50, 1000);
        result.current.addReading(50, 2000);
        result.current.addReading(50, 3000);
      });

      const metrics = result.current.getMetrics(35000);
      expect(metrics.avgSpeedKmh).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears all accumulated data", () => {
      const { result } = renderHook(() => useConsumptionModel());

      act(() => {
        result.current.addReading(50, 1000);
        result.current.addReading(50, 2000);
        result.current.reset();
      });

      const metrics = result.current.getMetrics(3000);
      expect(metrics.avgSpeedKmh).toBe(0);
      expect(metrics.idlePercentage).toBe(0);
    });
  });
});
