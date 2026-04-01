import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDriveMode } from "./useDriveMode";
import * as db from "@/lib/db";
import type { Settings } from "@/types";

vi.mock("@/lib/db", () => ({
  getSettings: vi.fn(),
}));

const mockSettings: Settings = {
  id: "default",
  cityKmPerLiter: 10,
  highwayKmPerLiter: 14,
  mixedKmPerLiter: 12,
  fuelCapacity: 50,
  currentFuel: 30,
  fuelPrice: 5,
  manualCityKmPerLiter: 10,
  manualHighwayKmPerLiter: 14,
  manualMixedKmPerLiter: 12,
  engineDisplacement: 1600,
  fuelType: "flex",
};

describe("useDriveMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getSettings).mockResolvedValue(mockSettings);
  });

  it("initializes with city mode and manual consumption values", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.driveMode).toBe("city");
    expect(result.current.currentKmPerLiter).toBe(10);
  });

  it("returns proper initial state before initialization", () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.driveMode).toBe("city");
    expect(result.current.currentKmPerLiter).toBe(8);
  });

  it("adds position and updates consumption factors", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

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
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

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

  it("uses correct consumption based on drive mode", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.consumptionFactors.baseKmPerLiter).toBe(10);

    act(() => {
      result.current.addPosition({
        lat: -23.5505,
        lng: -46.6333,
        speed: 25,
        timestamp: 1000,
      });
    });

    expect(result.current.currentKmPerLiter).toBe(10);
  });

  it("calculates estimated range based on current fuel", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.estimatedRange).toBeGreaterThan(0);
    expect(result.current.estimatedRange).toBeLessThanOrEqual(
      30 * mockSettings.manualCityKmPerLiter,
    );
  });

  it("returns consumption factors with all required fields", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const factors = result.current.consumptionFactors;

    expect(factors).toHaveProperty("baseKmPerLiter");
    expect(factors).toHaveProperty("speedFactor");
    expect(factors).toHaveProperty("aggressionFactor");
    expect(factors).toHaveProperty("idleFactor");
    expect(factors).toHaveProperty("stabilityFactor");
    expect(factors).toHaveProperty("adjustedKmPerLiter");
    expect(factors).toHaveProperty("isAggressive");
    expect(factors).toHaveProperty("totalBonus");
    expect(factors).toHaveProperty("speedBonus");
    expect(factors).toHaveProperty("accelerationBonus");
    expect(factors).toHaveProperty("coastingBonus");
    expect(factors).toHaveProperty("stabilityBonus");
    expect(factors).toHaveProperty("idleBonus");
    expect(factors).toHaveProperty("isEcoDriving");
  });

  it("getAverageFactors returns proper structure", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    const avgFactors = result.current.getAverageFactors();

    expect(avgFactors).toHaveProperty("speedPenaltyPct");
    expect(avgFactors).toHaveProperty("aggressionPenaltyPct");
    expect(avgFactors).toHaveProperty("idlePenaltyPct");
    expect(avgFactors).toHaveProperty("stabilityPenaltyPct");
    expect(avgFactors).toHaveProperty("speedBonusPct");
    expect(avgFactors).toHaveProperty("accelerationBonusPct");
    expect(avgFactors).toHaveProperty("coastingBonusPct");
    expect(avgFactors).toHaveProperty("stabilityBonusPct");
    expect(avgFactors).toHaveProperty("idleBonusPct");
    expect(avgFactors).toHaveProperty("totalBonusPct");
    expect(avgFactors).toHaveProperty("isEcoDriving");
  });

  it("getEstimatedCosts calculates costs correctly", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

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

  it("handles multiple positions over time", async () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

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

  it("returns correct values before settings are loaded", () => {
    const { result } = renderHook(() => useDriveMode(0, 30));

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.currentKmPerLiter).toBe(8);
    expect(result.current.consumptionFactors.baseKmPerLiter).toBe(8);
  });

  describe("warm-up behavior", () => {
    it("starts with conservative range right after reset", async () => {
      const { result } = renderHook(() => useDriveMode(0, 30));

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      act(() => {
        result.current.reset();
      });

      const conservativeRange = 30 * mockSettings.manualCityKmPerLiter;
      expect(result.current.estimatedRange).toBeCloseTo(conservativeRange, 0);
    });

    it("uses conservative fallback when warm-up just started", async () => {
      const { result } = renderHook(() => useDriveMode(0, 30));

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      act(() => {
        result.current.reset();
        result.current.addPosition({
          lat: -23.5505,
          lng: -46.6333,
          speed: 15,
          timestamp: Date.now(),
        });
      });

      const conservativeRange = 30 * mockSettings.manualCityKmPerLiter;
      expect(result.current.estimatedRange).toBeGreaterThanOrEqual(
        conservativeRange * 0.95,
      );
    });

    it("returns zero range when fuel is zero", async () => {
      const { result } = renderHook(() => useDriveMode(0, 0));

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.estimatedRange).toBe(0);
    });

    it("returns zero range when fuel is negative", async () => {
      const { result } = renderHook(() => useDriveMode(0, -5));

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.estimatedRange).toBe(0);
    });

    it("estimatedConsumption is available after initialization", async () => {
      const { result } = renderHook(() => useDriveMode(0, 30));

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.estimatedConsumption).toBeGreaterThan(0);
    });

    it("estimatedRange is proportional to fuel amount", async () => {
      const { result: result1 } = renderHook(() => useDriveMode(0, 10));
      const { result: result2 } = renderHook(() => useDriveMode(0, 20));

      await waitFor(() => {
        expect(result1.current.isInitialized).toBe(true);
      });
      await waitFor(() => {
        expect(result2.current.isInitialized).toBe(true);
      });

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
