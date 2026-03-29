import { useRef, useCallback } from "react";
import type { ConsumptionFactors } from "./useConsumptionModel";

interface AccumulatedFactors {
  speedPenaltySum: number;
  speedPenaltyCount: number;
  aggressionPenaltySum: number;
  aggressionPenaltyCount: number;
  idlePenaltySum: number;
  idlePenaltyCount: number;
  stabilityPenaltySum: number;
  stabilityPenaltyCount: number;
  totalSamples: number;
}

interface TripConsumptionTrackerReturn {
  addSample: (factors: ConsumptionFactors) => void;
  getAverageFactors: () => {
    speedPenaltyPct: number;
    aggressionPenaltyPct: number;
    idlePenaltyPct: number;
    stabilityPenaltyPct: number;
  };
  getEstimatedCosts: (
    distanceKm: number,
    baseKmPerLiter: number,
    fuelPrice: number,
  ) => {
    baseFuelUsed: number;
    extraFuelUsed: number;
    extraCost: number;
    totalFuelUsed: number;
    totalCost: number;
  };
  reset: () => void;
}

const PENALTY_SAMPLES_MIN = 5;

export function useTripConsumptionTracker(): TripConsumptionTrackerReturn {
  const accumulatedRef = useRef<AccumulatedFactors>({
    speedPenaltySum: 0,
    speedPenaltyCount: 0,
    aggressionPenaltySum: 0,
    aggressionPenaltyCount: 0,
    idlePenaltySum: 0,
    idlePenaltyCount: 0,
    stabilityPenaltySum: 0,
    stabilityPenaltyCount: 0,
    totalSamples: 0,
  });

  const addSample = useCallback((factors: ConsumptionFactors) => {
    const acc = accumulatedRef.current;
    acc.totalSamples++;

    const speedPenalty = (factors.speedFactor - 1) * 100;
    if (speedPenalty > 0) {
      acc.speedPenaltySum += speedPenalty;
      acc.speedPenaltyCount++;
    }

    const aggressionPenalty = (factors.aggressionFactor - 1) * 100;
    if (aggressionPenalty > 0) {
      acc.aggressionPenaltySum += aggressionPenalty;
      acc.aggressionPenaltyCount++;
    }

    const idlePenalty = (factors.idleFactor - 1) * 100;
    if (idlePenalty > 0) {
      acc.idlePenaltySum += idlePenalty;
      acc.idlePenaltyCount++;
    }

    const stabilityPenalty = (factors.stabilityFactor - 1) * 100;
    if (stabilityPenalty > 0) {
      acc.stabilityPenaltySum += stabilityPenalty;
      acc.stabilityPenaltyCount++;
    }
  }, []);

  const getAverageFactors = useCallback(() => {
    const acc = accumulatedRef.current;

    const speedPenaltyPct =
      acc.speedPenaltyCount >= PENALTY_SAMPLES_MIN
        ? acc.speedPenaltySum / acc.speedPenaltyCount
        : 0;

    const aggressionPenaltyPct =
      acc.aggressionPenaltyCount >= PENALTY_SAMPLES_MIN
        ? acc.aggressionPenaltySum / acc.aggressionPenaltyCount
        : 0;

    const idlePenaltyPct =
      acc.idlePenaltyCount >= PENALTY_SAMPLES_MIN
        ? acc.idlePenaltySum / acc.idlePenaltyCount
        : 0;

    const stabilityPenaltyPct =
      acc.stabilityPenaltyCount >= PENALTY_SAMPLES_MIN
        ? acc.stabilityPenaltySum / acc.stabilityPenaltyCount
        : 0;

    return {
      speedPenaltyPct: Math.round(speedPenaltyPct * 10) / 10,
      aggressionPenaltyPct: Math.round(aggressionPenaltyPct * 10) / 10,
      idlePenaltyPct: Math.round(idlePenaltyPct * 10) / 10,
      stabilityPenaltyPct: Math.round(stabilityPenaltyPct * 10) / 10,
    };
  }, []);

  const getEstimatedCosts = useCallback(
    (distanceKm: number, baseKmPerLiter: number, fuelPrice: number) => {
      const averages = getAverageFactors();

      const combinedPenalty =
        averages.speedPenaltyPct / 100 +
        averages.aggressionPenaltyPct / 100 +
        averages.idlePenaltyPct / 100 +
        averages.stabilityPenaltyPct / 100;

      const baseFuelUsed = distanceKm / baseKmPerLiter;

      const adjustedKmPerLiter = baseKmPerLiter / (1 + combinedPenalty);
      const totalFuelUsed = distanceKm / adjustedKmPerLiter;

      const extraFuelUsed = totalFuelUsed - baseFuelUsed;
      const extraCost = extraFuelUsed * fuelPrice;
      const totalCost = totalFuelUsed * fuelPrice;

      return {
        baseFuelUsed: Math.round(baseFuelUsed * 100) / 100,
        extraFuelUsed: Math.round(extraFuelUsed * 100) / 100,
        extraCost: Math.round(extraCost * 100) / 100,
        totalFuelUsed: Math.round(totalFuelUsed * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
      };
    },
    [getAverageFactors],
  );

  const reset = useCallback(() => {
    accumulatedRef.current = {
      speedPenaltySum: 0,
      speedPenaltyCount: 0,
      aggressionPenaltySum: 0,
      aggressionPenaltyCount: 0,
      idlePenaltySum: 0,
      idlePenaltyCount: 0,
      stabilityPenaltySum: 0,
      stabilityPenaltyCount: 0,
      totalSamples: 0,
    };
  }, []);

  return {
    addSample,
    getAverageFactors,
    getEstimatedCosts,
    reset,
  };
}
