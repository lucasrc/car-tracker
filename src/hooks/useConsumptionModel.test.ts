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
    it("returns base consumption when all factors and bonuses are neutral", () => {
      const { result } = renderHook(() => useConsumptionModel());
      const { calculateAdjustedConsumption } = result.current;
      const factors = calculateAdjustedConsumption(12, 50, 50, 10);
      expect(factors.adjustedKmPerLiter).toBeLessThanOrEqual(12);
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

  describe("eco-driving bonuses", () => {
    describe("optimal speed bonus (60-80 km/h)", () => {
      it("returns 5% bonus at center of optimal range (70 km/h)", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        expect(factors.speedBonus).toBeCloseTo(0.05, 2);
        expect(factors.isEcoDriving).toBe(true);
      });

      it("returns bonus at edges of optimal range (60 km/h)", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 60, 0, 0);
        expect(factors.speedBonus).toBeGreaterThan(0);
        expect(factors.speedBonus).toBeLessThanOrEqual(0.05);
      });

      it("returns partial bonus between 80-90 km/h", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 85, 0, 0);
        expect(factors.speedBonus).toBeGreaterThan(0);
        expect(factors.speedBonus).toBeLessThan(0.05);
      });

      it("returns 0 bonus outside range (below 60 or above 90)", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factorsBelow = calculateAdjustedConsumption(12, 50, 0, 0);
        const factorsAbove = calculateAdjustedConsumption(12, 95, 0, 0);
        expect(factorsBelow.speedBonus).toBe(0);
        expect(factorsAbove.speedBonus).toBe(0);
      });
    });

    describe("gentle acceleration bonus (<0.5 m/s²)", () => {
      it("applies 4% bonus for gentle acceleration", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(10, 1000);
          result.current.addReading(10.3, 2000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 50, 0, 0);
        expect(factors.accelerationBonus).toBeCloseTo(0.04, 2);
      });

      it("returns 0 bonus for aggressive acceleration", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(10, 1000);
          result.current.addReading(15, 2000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 50, 0, 0);
        expect(factors.accelerationBonus).toBe(0);
      });
    });

    describe("coasting bonus (negative acceleration)", () => {
      it("applies 3% bonus for coasting deceleration", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(15, 1000);
          result.current.addReading(13, 2000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        expect(factors.coastingBonus).toBeCloseTo(0.03, 2);
      });

      it("returns 0 bonus for positive acceleration", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(10, 1000);
          result.current.addReading(12, 2000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        expect(factors.coastingBonus).toBe(0);
      });
    });

    describe("stability bonus (low variance)", () => {
      it("applies up to 3% bonus for very low variance", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 5, 0);
        expect(factors.stabilityBonus).toBeGreaterThan(0);
        expect(factors.stabilityBonus).toBeLessThanOrEqual(0.03);
      });

      it("returns 0 bonus for high variance", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 20, 0);
        expect(factors.stabilityBonus).toBe(0);
      });
    });

    describe("zero idle bonus", () => {
      it("applies 3% bonus when no idle time", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        expect(factors.idleBonus).toBeCloseTo(0.03, 2);
      });

      it("returns 0 bonus when idle time exists", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 10);
        expect(factors.idleBonus).toBe(0);
      });
    });

    describe("total bonus cap", () => {
      it("caps total bonus at 10%", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        act(() => {
          result.current.addReading(15, 1000);
          result.current.addReading(13, 2000);
        });
        const factors = calculateAdjustedConsumption(12, 70, 5, 0);
        expect(factors.totalBonus).toBeLessThanOrEqual(0.1);
      });

      it("reaches 10% cap when all eco-driving conditions are optimal", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(19.44, 1000);
          result.current.addReading(19.44, 2000);
          result.current.addReading(19.44, 3000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        expect(factors.totalBonus).toBe(0.1);
        expect(factors.speedBonus).toBeCloseTo(0.05, 2);
        expect(factors.accelerationBonus).toBeCloseTo(0.04, 2);
        expect(factors.stabilityBonus).toBeCloseTo(0.03, 2);
        expect(factors.idleBonus).toBeCloseTo(0.03, 2);
      });

      it("sum of individual bonuses can exceed cap but total is capped", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(19.44, 1000);
          result.current.addReading(19.44, 2000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        const sumOfBonuses =
          factors.speedBonus +
          factors.accelerationBonus +
          factors.coastingBonus +
          factors.stabilityBonus +
          factors.idleBonus;
        expect(sumOfBonuses).toBeGreaterThan(0.1);
        expect(factors.totalBonus).toBe(0.1);
      });
    });

    describe("combined bonuses and penalties", () => {
      it("improves km/L when bonuses exceed penalties", () => {
        const { result } = renderHook(() => useConsumptionModel());
        act(() => {
          result.current.addReading(15, 1000);
          result.current.addReading(13, 2000);
        });
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 5, 0);
        expect(factors.totalBonus).toBeGreaterThan(0);
      });

      it("sets isEcoDriving flag when bonus is positive", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 70, 0, 0);
        expect(factors.isEcoDriving).toBe(true);
      });

      it("does not set isEcoDriving when no bonuses and high penalties", () => {
        const { result } = renderHook(() => useConsumptionModel());
        const { calculateAdjustedConsumption } = result.current;
        const factors = calculateAdjustedConsumption(12, 95, 100, 50);
        expect(factors.speedBonus).toBe(0);
      });
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
