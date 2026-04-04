import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTripConsumptionTracker } from "./useTripConsumptionTracker";
import type { ConsumptionFactors } from "./useConsumptionModel";

const createFactors = (
  overrides: Partial<ConsumptionFactors> = {},
): ConsumptionFactors => ({
  baseKmPerLiter: 12,
  adjustedKmPerLiter: 12,
  activityType: "MA",
  copertKmPerLiter: 12,
  displacementFactor: 1,
  fuelEnergyFactor: 1,
  calibrated: false,
  gradePercent: 0,
  fuelCutActive: false,
  ...overrides,
});

describe("useTripConsumptionTracker", () => {
  it("returns zero consumption when no samples added", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());
    const avgConsumption = result.current.getAverageConsumption();

    expect(avgConsumption).toBe(0);
  });

  it("calculates average consumption correctly with single sample", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    act(() => {
      result.current.addSample(createFactors({ adjustedKmPerLiter: 10 }), 5000);
    });

    const avgConsumption = result.current.getAverageConsumption();
    expect(avgConsumption).toBe(10);
  });

  it("calculates average consumption correctly with multiple samples", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    act(() => {
      result.current.addSample(createFactors({ adjustedKmPerLiter: 10 }), 2000);
      result.current.addSample(createFactors({ adjustedKmPerLiter: 12 }), 2000);
      result.current.addSample(createFactors({ adjustedKmPerLiter: 14 }), 2000);
    });

    const avgConsumption = result.current.getAverageConsumption();
    // (10*2000 + 12*2000 + 14*2000) / 6000 = 72000 / 6000 = 12
    expect(avgConsumption).toBe(12);
  });

  it("weights samples by duration correctly", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    act(() => {
      result.current.addSample(createFactors({ adjustedKmPerLiter: 10 }), 1000);
      result.current.addSample(createFactors({ adjustedKmPerLiter: 15 }), 4000);
    });

    const avgConsumption = result.current.getAverageConsumption();
    // (10*1000 + 15*4000) / 5000 = 70000 / 5000 = 14
    expect(avgConsumption).toBe(14);
  });

  describe("getEstimatedCosts", () => {
    it("returns zero costs for zero distance", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const costs = result.current.getEstimatedCosts(0, 10, 5);

      expect(costs.totalFuelUsed).toBe(0);
      expect(costs.totalCost).toBe(0);
    });

    it("calculates fuel correctly", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const costs = result.current.getEstimatedCosts(100, 10, 5);

      expect(costs.totalFuelUsed).toBe(10); // 100km / 10km/l = 10L
      expect(costs.totalCost).toBe(50); // 10L * R$5 = R$50
    });

    it("handles different consumption rates", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const costs1 = result.current.getEstimatedCosts(100, 8, 6);
      const costs2 = result.current.getEstimatedCosts(100, 12, 6);

      expect(costs1.totalFuelUsed).toBe(12.5); // 100/8
      expect(costs2.totalFuelUsed).toBe(8.33); // 100/12
      expect(costs1.totalFuelUsed).toBeGreaterThan(costs2.totalFuelUsed);
    });

    it("returns correct structure", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const costs = result.current.getEstimatedCosts(100, 10, 5);

      expect(costs).toHaveProperty("baseFuelUsed");
      expect(costs).toHaveProperty("totalFuelUsed");
      expect(costs).toHaveProperty("totalCost");
      expect(costs.extraFuelUsed).toBe(0);
      expect(costs.savedFuel).toBe(0);
    });
  });

  describe("getInstantConsumption", () => {
    it("returns zero when no samples", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());
      expect(result.current.getInstantConsumption()).toBe(0);
    });

    it("returns same as average when all samples are within 30s window", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      act(() => {
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 10 }),
          2000,
        );
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 14 }),
          3000,
        );
      });

      const avg = result.current.getAverageConsumption();
      const instant = result.current.getInstantConsumption();
      expect(instant).toBeCloseTo(avg, 5);
    });

    it("returns weighted average of recent samples only", () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTripConsumptionTracker());

      act(() => {
        vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 8 }),
          2000,
        );
      });

      act(() => {
        vi.setSystemTime(new Date("2024-01-01T00:00:35.000Z"));
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 12 }),
          2000,
        );
      });

      const instant = result.current.getInstantConsumption();
      expect(instant).toBe(12);

      vi.useRealTimers();
    });
  });

  describe("getInstantConsumption", () => {
    it("returns zero when no samples", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());
      expect(result.current.getInstantConsumption()).toBe(0);
    });

    it("returns same as average when all samples are within 30s window", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      act(() => {
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 10 }),
          2000,
        );
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 14 }),
          3000,
        );
      });

      const avg = result.current.getAverageConsumption();
      const instant = result.current.getInstantConsumption();
      expect(instant).toBeCloseTo(avg, 5);
    });

    it("returns weighted average of recent samples only", () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTripConsumptionTracker());

      act(() => {
        vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 8 }),
          2000,
        );
      });

      act(() => {
        vi.setSystemTime(new Date("2024-01-01T00:00:35.000Z"));
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 12 }),
          2000,
        );
      });

      const instant = result.current.getInstantConsumption();
      expect(instant).toBe(12);

      vi.useRealTimers();
    });
  });

  describe("reset", () => {
    it("clears all accumulated data", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      act(() => {
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 10 }),
          5000,
        );
        result.current.reset();
      });

      const avgConsumption = result.current.getAverageConsumption();
      expect(avgConsumption).toBe(0);
    });

    it("allows adding samples after reset", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      act(() => {
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 10 }),
          5000,
        );
        result.current.reset();
        result.current.addSample(
          createFactors({ adjustedKmPerLiter: 15 }),
          3000,
        );
      });

      const avgConsumption = result.current.getAverageConsumption();
      expect(avgConsumption).toBe(15);
    });
  });
});
