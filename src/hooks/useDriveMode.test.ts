import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDriveMode } from "./useDriveMode";

describe("useDriveMode", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("without vehicle (fallback defaults)", () => {
    it("initializes immediately without DB calls", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.driveMode).toBe("city");
    });

    it("uses default consumption values when no vehicle", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      expect(result.current.currentKmPerLiter).toBe(8);
    });

    it("adds position and updates consumption factors", async () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      act(() => {
        result.current.addPosition({
          lat: -23.5505,
          lng: -46.6333,
          speed: 15,
          timestamp: 1000,
        });
      });

      expect(result.current.consumptionFactors).toBeDefined();
      expect(result.current.consumptionFactors.baseKmPerLiter).toBe(10);
    });

    it("resets all state when reset is called", async () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      act(() => {
        result.current.addPosition({
          lat: -23.5505,
          lng: -46.6333,
          speed: 15,
          timestamp: 1000,
        });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.driveMode).toBe("city");
      expect(result.current.avgSpeed).toBe(0);
      expect(result.current.stopPercentage).toBe(0);
    });

    it("calculates estimated range based on current fuel", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      expect(result.current.estimatedRange).toBeGreaterThan(0);
      expect(result.current.estimatedRange).toBeLessThanOrEqual(30 * 10);
    });

    it("returns consumption factors with all required fields", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      const factors = result.current.consumptionFactors;

      expect(factors).toHaveProperty("baseKmPerLiter");
      expect(factors).toHaveProperty("adjustedKmPerLiter");
      expect(factors).toHaveProperty("activityType");
      expect(factors).toHaveProperty("copertKmPerLiter");
      expect(factors).toHaveProperty("displacementFactor");
      expect(factors).toHaveProperty("fuelEnergyFactor");
    });

    it("getAverageConsumption returns a number", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      const avgConsumption = result.current.getAverageConsumption();

      expect(typeof avgConsumption).toBe("number");
      expect(avgConsumption).toBeGreaterThanOrEqual(0);
    });

    it("getEstimatedCosts calculates costs correctly", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      const costs = result.current.getEstimatedCosts(100, 10, 5);

      expect(costs).toHaveProperty("baseFuelUsed");
      expect(costs).toHaveProperty("extraFuelUsed");
      expect(costs).toHaveProperty("savedFuel");
      expect(costs).toHaveProperty("extraCost");
      expect(costs).toHaveProperty("savedCost");
      expect(costs).toHaveProperty("totalFuelUsed");
      expect(costs).toHaveProperty("totalCost");
      expect(costs.baseFuelUsed).toBe(10);
    });

    it("handles multiple positions over time", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      const positions = [
        { lat: -23.55, lng: -46.63, speed: 10, timestamp: 1000 },
        { lat: -23.56, lng: -46.64, speed: 15, timestamp: 2000 },
        { lat: -23.57, lng: -46.65, speed: 20, timestamp: 3000 },
        { lat: -23.58, lng: -46.66, speed: 15, timestamp: 4000 },
      ];

      act(() => {
        positions.forEach((pos) => result.current.addPosition(pos));
      });

      const factors = result.current.consumptionFactors;
      expect(factors).toBeDefined();
    });

    it("returns zero range when fuel is zero", () => {
      const { result } = renderHook(() => useDriveMode(0, 0, 0, null));

      expect(result.current.estimatedRange).toBe(0);
    });

    it("returns zero range when fuel is negative", () => {
      const { result } = renderHook(() => useDriveMode(0, -5, 0, null));

      expect(result.current.estimatedRange).toBe(0);
    });
  });

  describe("warm-up behavior", () => {
    it("starts with conservative range right after reset", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      act(() => {
        result.current.reset();
      });

      const conservativeRange = 30 * 10;
      expect(result.current.estimatedRange).toBeCloseTo(conservativeRange, 0);
    });

    it("estimatedConsumption is available after initialization", () => {
      const { result } = renderHook(() => useDriveMode(0, 30, 0, null));

      expect(result.current.estimatedConsumption).toBeGreaterThan(0);
    });

    it("estimatedRange is proportional to fuel amount", () => {
      const { result: result1 } = renderHook(() =>
        useDriveMode(0, 10, 0, null),
      );
      const { result: result2 } = renderHook(() =>
        useDriveMode(0, 20, 0, null),
      );

      act(() => {
        result1.current.reset();
      });
      act(() => {
        result2.current.reset();
      });

      const range1 = result1.current.estimatedRange;
      const range2 = result2.current.estimatedRange;

      expect(range2 / range1).toBeCloseTo(2, 0);
    });
  });
});
