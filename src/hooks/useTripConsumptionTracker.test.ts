import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTripConsumptionTracker } from "./useTripConsumptionTracker";
import type { ConsumptionFactors } from "./useConsumptionModel";

const createFactors = (
  overrides: Partial<ConsumptionFactors> = {},
): ConsumptionFactors => ({
  baseKmPerLiter: 12,
  speedFactor: 1,
  aggressionFactor: 1,
  idleFactor: 1,
  stabilityFactor: 1,
  adjustedKmPerLiter: 12,
  isAggressive: false,
  totalBonus: 0,
  speedBonus: 0,
  accelerationBonus: 0,
  coastingBonus: 0,
  stabilityBonus: 0,
  idleBonus: 0,
  isEcoDriving: false,
  currentSpeedKmh: 0,
  currentAcceleration: 0,
  idlePercentage: 0,
  speedVariance: 0,
  activityType: "MA",
  copertKmPerLiter: 12,
  hybridKmPerLiter: 12,
  ...overrides,
});

describe("useTripConsumptionTracker", () => {
  it("returns zero penalties when no samples added", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());
    const factors = result.current.getAverageFactors();

    expect(factors.speedPenaltyPct).toBe(0);
    expect(factors.aggressionPenaltyPct).toBe(0);
    expect(factors.idlePenaltyPct).toBe(0);
    expect(factors.stabilityPenaltyPct).toBe(0);
  });

  it("calculates penalty correctly when all time has penalty", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 1.5 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(speedingFactors, 2000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBeCloseTo(50, 1);
  });

  it("calculates penalty correctly when no time has penalty", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const normalFactors = createFactors({ speedFactor: 1 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(normalFactors, 2000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBe(0);
  });

  it("handles multiple penalty types simultaneously", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const factors = createFactors({
      speedFactor: 1.2,
      aggressionFactor: 1.1,
      idleFactor: 1.08,
      stabilityFactor: 1.05,
    });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(factors, 2000);
      }
    });

    const resultFactors = result.current.getAverageFactors();

    expect(resultFactors.speedPenaltyPct).toBeCloseTo(20, 1);
    expect(resultFactors.aggressionPenaltyPct).toBeCloseTo(10, 1);
    expect(resultFactors.idlePenaltyPct).toBeCloseTo(8, 1);
    expect(resultFactors.stabilityPenaltyPct).toBeCloseTo(5, 1);
  });

  it("respects minimum time threshold", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 2.0 });

    act(() => {
      result.current.addSample(speedingFactors, 4000);
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBe(0);
  });

  it("respects minimum samples threshold", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 2.0 });

    act(() => {
      for (let i = 0; i < 4; i++) {
        result.current.addSample(speedingFactors, 2000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBe(0);
  });

  it("applies penalty after meeting minimum thresholds", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 2.0 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(speedingFactors, 2000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBeCloseTo(100, 1);
  });

  it("calculates weighted average for mixed time periods", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const moderateFactors = createFactors({ speedFactor: 1.1 });
    const fastFactors = createFactors({ speedFactor: 1.3 });

    act(() => {
      result.current.addSample(moderateFactors, 3000);
      result.current.addSample(fastFactors, 2000);
      result.current.addSample(moderateFactors, 3000);
      result.current.addSample(fastFactors, 2000);
      result.current.addSample(fastFactors, 2000);
    });

    const factors = result.current.getAverageFactors();

    expect(factors.speedPenaltyPct).toBeGreaterThan(0);
    expect(factors.speedPenaltyPct).toBeLessThan(30);
  });

  it("calculates estimated costs correctly", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const factors = createFactors({ speedFactor: 1.091 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(factors, 2000);
      }
    });

    const costs = result.current.getEstimatedCosts(100, 10, 5);

    expect(costs.baseFuelUsed).toBe(10);
    expect(costs.extraFuelUsed).toBeGreaterThan(0);
    expect(costs.extraCost).toBe(costs.extraFuelUsed * 5);
  });

  it("reset clears all accumulated data", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 2.0 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(speedingFactors, 2000);
      }
      result.current.reset();
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBe(0);
    expect(factors.aggressionPenaltyPct).toBe(0);
    expect(factors.idlePenaltyPct).toBe(0);
    expect(factors.stabilityPenaltyPct).toBe(0);
  });

  it("handles very small duration values", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 2.0 });

    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.addSample(speedingFactors, 500);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBeCloseTo(100, 1);
  });

  it("handles large duration values", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedingFactors = createFactors({ speedFactor: 1.5 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(speedingFactors, 720000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.speedPenaltyPct).toBeCloseTo(50, 1);
  });

  it("calculates aggression penalty proportionally", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const aggressiveFactors = createFactors({ aggressionFactor: 1.1 });

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.addSample(aggressiveFactors, 2000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.aggressionPenaltyPct).toBeCloseTo(10, 1);
  });

  it("calculates idle penalty proportionally", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const idleFactors = createFactors({ idleFactor: 1.08 });

    act(() => {
      result.current.addSample(idleFactors, 3000);
      result.current.addSample(idleFactors, 3000);
      result.current.addSample(idleFactors, 4000);
      result.current.addSample(idleFactors, 2000);
      result.current.addSample(idleFactors, 2000);
    });

    const factors = result.current.getAverageFactors();
    expect(factors.idlePenaltyPct).toBeCloseTo(8, 1);
  });

  it("calculates stability penalty proportionally", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const unstableFactors = createFactors({ stabilityFactor: 1.05 });

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addSample(unstableFactors, 1000);
      }
    });

    const factors = result.current.getAverageFactors();
    expect(factors.stabilityPenaltyPct).toBeCloseTo(5, 1);
  });

  it("integrates different penalties with different durations", () => {
    const { result } = renderHook(() => useTripConsumptionTracker());

    const speedPenalty = createFactors({ speedFactor: 1.4 });
    const idlePenalty = createFactors({ idleFactor: 1.2 });
    const normalFactors = createFactors();

    act(() => {
      result.current.addSample(speedPenalty, 2000);
      result.current.addSample(speedPenalty, 2000);
      result.current.addSample(speedPenalty, 2000);
      result.current.addSample(speedPenalty, 2000);
      result.current.addSample(speedPenalty, 2000);
      result.current.addSample(idlePenalty, 2000);
      result.current.addSample(idlePenalty, 2000);
      result.current.addSample(idlePenalty, 2000);
      result.current.addSample(idlePenalty, 2000);
      result.current.addSample(idlePenalty, 2000);
      result.current.addSample(normalFactors, 1000);
    });

    const factors = result.current.getAverageFactors();

    expect(factors.speedPenaltyPct).toBeGreaterThan(0);
    expect(factors.idlePenaltyPct).toBeGreaterThan(0);
    expect(factors.speedPenaltyPct).toBeGreaterThan(factors.idlePenaltyPct);
  });

  describe("bonus calculations", () => {
    it("caps total bonus at 10% in getAverageFactors", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const maxBonusFactors = createFactors({
        speedBonus: 0.05,
        accelerationBonus: 0.04,
        coastingBonus: 0.03,
        stabilityBonus: 0.03,
        idleBonus: 0.03,
      });

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addSample(maxBonusFactors, 2000);
        }
      });

      const factors = result.current.getAverageFactors();
      expect(factors.totalBonusPct).toBe(10);
    });

    it("isEcoDriving is true when bonuses exist, even if capped", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const maxBonusFactors = createFactors({
        speedBonus: 0.05,
        accelerationBonus: 0.04,
        coastingBonus: 0.03,
        stabilityBonus: 0.03,
        idleBonus: 0.03,
      });

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addSample(maxBonusFactors, 2000);
        }
      });

      const factors = result.current.getAverageFactors();
      expect(factors.isEcoDriving).toBe(true);
    });

    it("calculates individual bonus percentages correctly", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const speedBonusFactors = createFactors({
        speedBonus: 0.05,
        accelerationBonus: 0,
        coastingBonus: 0,
        stabilityBonus: 0,
        idleBonus: 0,
      });

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addSample(speedBonusFactors, 2000);
        }
      });

      const factors = result.current.getAverageFactors();
      expect(factors.speedBonusPct).toBeCloseTo(5, 1);
      expect(factors.accelerationBonusPct).toBe(0);
      expect(factors.coastingBonusPct).toBe(0);
      expect(factors.stabilityBonusPct).toBe(0);
      expect(factors.idleBonusPct).toBe(0);
    });

    it("sums multiple bonuses correctly up to cap", () => {
      const { result } = renderHook(() => useTripConsumptionTracker());

      const partialBonusFactors = createFactors({
        speedBonus: 0.03,
        accelerationBonus: 0.02,
        coastingBonus: 0.01,
        stabilityBonus: 0.01,
        idleBonus: 0.01,
      });

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.addSample(partialBonusFactors, 2000);
        }
      });

      const factors = result.current.getAverageFactors();
      expect(factors.totalBonusPct).toBe(8);
      expect(factors.isEcoDriving).toBe(true);
    });
  });
});
