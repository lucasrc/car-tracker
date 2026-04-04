import { useRef, useCallback } from "react";
import type { ConsumptionFactors } from "./useConsumptionModel";

interface AccumulatedData {
  totalConsumption: number;
  totalTimeMs: number;
  sampleCount: number;
}

interface TimedSample {
  adjustedKmPerLiter: number;
  durationMs: number;
  timestamp: number;
}

const INSTANT_WINDOW_MS = 30000;

interface TripConsumptionTrackerReturn {
  addSample: (factors: ConsumptionFactors, durationMs: number) => void;
  getAverageConsumption: () => number;
  getInstantConsumption: () => number;
  getEstimatedCosts: (
    distanceKm: number,
    avgKmPerLiter: number,
    fuelPrice: number,
  ) => {
    baseFuelUsed: number;
    extraFuelUsed: number;
    savedFuel: number;
    extraCost: number;
    savedCost: number;
    totalFuelUsed: number;
    totalCost: number;
  };
  reset: () => void;
}

export function useTripConsumptionTracker(): TripConsumptionTrackerReturn {
  const accumulatedRef = useRef<AccumulatedData>({
    totalConsumption: 0,
    totalTimeMs: 0,
    sampleCount: 0,
  });

  const samplesRef = useRef<TimedSample[]>([]);

  const addSample = useCallback(
    (factors: ConsumptionFactors, durationMs: number) => {
      if (durationMs <= 0) return;
      const acc = accumulatedRef.current;
      acc.totalTimeMs += durationMs;
      acc.totalConsumption += factors.adjustedKmPerLiter * durationMs;
      acc.sampleCount += 1;

      samplesRef.current.push({
        adjustedKmPerLiter: factors.adjustedKmPerLiter,
        durationMs,
        timestamp: Date.now(),
      });

      const cutoff = Date.now() - INSTANT_WINDOW_MS;
      samplesRef.current = samplesRef.current.filter(
        (s) => s.timestamp > cutoff,
      );
    },
    [],
  );

  const getAverageConsumption = useCallback(() => {
    const acc = accumulatedRef.current;
    if (acc.totalTimeMs === 0 || acc.sampleCount === 0) {
      return 0;
    }
    return acc.totalConsumption / acc.totalTimeMs;
  }, []);

  const getInstantConsumption = useCallback(() => {
    const recent = samplesRef.current;
    if (recent.length === 0) return 0;
    const totalConsumption = recent.reduce(
      (sum, s) => sum + s.adjustedKmPerLiter * s.durationMs,
      0,
    );
    const totalTime = recent.reduce((sum, s) => sum + s.durationMs, 0);
    if (totalTime === 0) return 0;
    return totalConsumption / totalTime;
  }, []);

  const getEstimatedCosts = useCallback(
    (distanceKm: number, avgKmPerLiter: number, fuelPrice: number) => {
      if (avgKmPerLiter <= 0) {
        return {
          baseFuelUsed: 0,
          extraFuelUsed: 0,
          savedFuel: 0,
          extraCost: 0,
          savedCost: 0,
          totalFuelUsed: 0,
          totalCost: 0,
        };
      }

      const totalFuelUsed = distanceKm / avgKmPerLiter;

      return {
        baseFuelUsed: Math.round(totalFuelUsed * 100) / 100,
        extraFuelUsed: 0,
        savedFuel: 0,
        extraCost: 0,
        savedCost: 0,
        totalFuelUsed: Math.round(totalFuelUsed * 100) / 100,
        totalCost: Math.round(totalFuelUsed * fuelPrice * 100) / 100,
      };
    },
    [],
  );

  const reset = useCallback(() => {
    accumulatedRef.current = {
      totalConsumption: 0,
      totalTimeMs: 0,
      sampleCount: 0,
    };
    samplesRef.current = [];
  }, []);

  return {
    addSample,
    getAverageConsumption,
    getInstantConsumption,
    getEstimatedCosts,
    reset,
  };
}
