import { useRef, useCallback } from "react";
import type { ConsumptionFactors } from "./useConsumptionModel";

interface AccumulatedFactors {
  speedPenaltySum: number;
  speedTimeMs: number;
  aggressionPenaltySum: number;
  aggressionTimeMs: number;
  idlePenaltySum: number;
  idleTimeMs: number;
  stabilityPenaltySum: number;
  stabilityTimeMs: number;
  totalTimeMs: number;
}

interface TripConsumptionTrackerReturn {
  addSample: (factors: ConsumptionFactors, durationMs: number) => void;
  getAverageFactors: () => {
    speedPenaltyPct: number;
    aggressionPenaltyPct: number;
    idlePenaltyPct: number;
    stabilityPenaltyPct: number;
  };
  getEffectivePenalties: () => {
    speedPenaltyPct: number;
    aggressionPenaltyPct: number;
    idlePenaltyPct: number;
    stabilityPenaltyPct: number;
    combinedPenalty: number;
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

const PENALTY_TIME_MIN_MS = 10000;

export function useTripConsumptionTracker(): TripConsumptionTrackerReturn {
  const accumulatedRef = useRef<AccumulatedFactors>({
    speedPenaltySum: 0,
    speedTimeMs: 0,
    aggressionPenaltySum: 0,
    aggressionTimeMs: 0,
    idlePenaltySum: 0,
    idleTimeMs: 0,
    stabilityPenaltySum: 0,
    stabilityTimeMs: 0,
    totalTimeMs: 0,
  });

  const addSample = useCallback(
    (factors: ConsumptionFactors, durationMs: number) => {
      const acc = accumulatedRef.current;
      acc.totalTimeMs += durationMs;

      const speedPenalty = (factors.speedFactor - 1) * 100;
      if (speedPenalty > 0) {
        acc.speedPenaltySum += speedPenalty * durationMs;
        acc.speedTimeMs += durationMs;
      }

      const aggressionPenalty = (factors.aggressionFactor - 1) * 100;
      if (aggressionPenalty > 0) {
        acc.aggressionPenaltySum += aggressionPenalty * durationMs;
        acc.aggressionTimeMs += durationMs;
      }

      const idlePenalty = (factors.idleFactor - 1) * 100;
      if (idlePenalty > 0) {
        acc.idlePenaltySum += idlePenalty * durationMs;
        acc.idleTimeMs += durationMs;
      }

      const stabilityPenalty = (factors.stabilityFactor - 1) * 100;
      if (stabilityPenalty > 0) {
        acc.stabilityPenaltySum += stabilityPenalty * durationMs;
        acc.stabilityTimeMs += durationMs;
      }
    },
    [],
  );

  const getAverageFactors = useCallback(() => {
    const acc = accumulatedRef.current;

    const speedPenaltyPct =
      acc.speedTimeMs >= PENALTY_TIME_MIN_MS && acc.speedTimeMs > 0
        ? acc.speedPenaltySum / acc.speedTimeMs
        : 0;

    const aggressionPenaltyPct =
      acc.aggressionTimeMs >= PENALTY_TIME_MIN_MS && acc.aggressionTimeMs > 0
        ? acc.aggressionPenaltySum / acc.aggressionTimeMs
        : 0;

    const idlePenaltyPct =
      acc.idleTimeMs >= PENALTY_TIME_MIN_MS && acc.idleTimeMs > 0
        ? acc.idlePenaltySum / acc.idleTimeMs
        : 0;

    const stabilityPenaltyPct =
      acc.stabilityTimeMs >= PENALTY_TIME_MIN_MS && acc.stabilityTimeMs > 0
        ? acc.stabilityPenaltySum / acc.stabilityTimeMs
        : 0;

    return {
      speedPenaltyPct: Math.round(speedPenaltyPct * 10) / 10,
      aggressionPenaltyPct: Math.round(aggressionPenaltyPct * 10) / 10,
      idlePenaltyPct: Math.round(idlePenaltyPct * 10) / 10,
      stabilityPenaltyPct: Math.round(stabilityPenaltyPct * 10) / 10,
    };
  }, []);

  const getEffectivePenalties = useCallback(() => {
    const acc = accumulatedRef.current;
    const totalTime = acc.totalTimeMs || 1;

    const speedTimeRatio =
      acc.speedTimeMs >= PENALTY_TIME_MIN_MS ? acc.speedTimeMs / totalTime : 0;
    const speedPenaltyPct =
      acc.speedTimeMs >= PENALTY_TIME_MIN_MS && acc.speedTimeMs > 0
        ? (acc.speedPenaltySum / acc.speedTimeMs) * speedTimeRatio
        : 0;

    const aggressionTimeRatio =
      acc.aggressionTimeMs >= PENALTY_TIME_MIN_MS
        ? acc.aggressionTimeMs / totalTime
        : 0;
    const aggressionPenaltyPct =
      acc.aggressionTimeMs >= PENALTY_TIME_MIN_MS && acc.aggressionTimeMs > 0
        ? (acc.aggressionPenaltySum / acc.aggressionTimeMs) *
          aggressionTimeRatio
        : 0;

    const idleTimeRatio =
      acc.idleTimeMs >= PENALTY_TIME_MIN_MS ? acc.idleTimeMs / totalTime : 0;
    const idlePenaltyPct =
      acc.idleTimeMs >= PENALTY_TIME_MIN_MS && acc.idleTimeMs > 0
        ? (acc.idlePenaltySum / acc.idleTimeMs) * idleTimeRatio
        : 0;

    const stabilityTimeRatio =
      acc.stabilityTimeMs >= PENALTY_TIME_MIN_MS
        ? acc.stabilityTimeMs / totalTime
        : 0;
    const stabilityPenaltyPct =
      acc.stabilityTimeMs >= PENALTY_TIME_MIN_MS && acc.stabilityTimeMs > 0
        ? (acc.stabilityPenaltySum / acc.stabilityTimeMs) * stabilityTimeRatio
        : 0;

    const combinedPenalty =
      speedPenaltyPct +
      aggressionPenaltyPct +
      idlePenaltyPct +
      stabilityPenaltyPct;

    return {
      speedPenaltyPct: Math.round(speedPenaltyPct * 10) / 10,
      aggressionPenaltyPct: Math.round(aggressionPenaltyPct * 10) / 10,
      idlePenaltyPct: Math.round(idlePenaltyPct * 10) / 10,
      stabilityPenaltyPct: Math.round(stabilityPenaltyPct * 10) / 10,
      combinedPenalty: Math.round(combinedPenalty * 10) / 10,
    };
  }, []);

  const getEstimatedCosts = useCallback(
    (distanceKm: number, baseKmPerLiter: number, fuelPrice: number) => {
      const effective = getEffectivePenalties();

      const baseFuelUsed = distanceKm / baseKmPerLiter;

      const adjustedKmPerLiter =
        baseKmPerLiter / (1 + effective.combinedPenalty / 100);
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
    [getEffectivePenalties],
  );

  const reset = useCallback(() => {
    accumulatedRef.current = {
      speedPenaltySum: 0,
      speedTimeMs: 0,
      aggressionPenaltySum: 0,
      aggressionTimeMs: 0,
      idlePenaltySum: 0,
      idleTimeMs: 0,
      stabilityPenaltySum: 0,
      stabilityTimeMs: 0,
      totalTimeMs: 0,
    };
  }, []);

  return {
    addSample,
    getAverageFactors,
    getEffectivePenalties,
    getEstimatedCosts,
    reset,
  };
}
