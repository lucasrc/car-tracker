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
  speedBonusSum: number;
  speedBonusTimeMs: number;
  accelerationBonusSum: number;
  accelerationBonusTimeMs: number;
  coastingBonusSum: number;
  coastingBonusTimeMs: number;
  stabilityBonusSum: number;
  stabilityBonusTimeMs: number;
  idleBonusSum: number;
  idleBonusTimeMs: number;
  totalTimeMs: number;
}

interface TripConsumptionTrackerReturn {
  addSample: (factors: ConsumptionFactors, durationMs: number) => void;
  getAverageFactors: () => {
    speedPenaltyPct: number;
    aggressionPenaltyPct: number;
    idlePenaltyPct: number;
    stabilityPenaltyPct: number;
    speedBonusPct: number;
    accelerationBonusPct: number;
    coastingBonusPct: number;
    stabilityBonusPct: number;
    idleBonusPct: number;
    totalBonusPct: number;
    isEcoDriving: boolean;
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
    totalBonusPct?: number,
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
    speedBonusSum: 0,
    speedBonusTimeMs: 0,
    accelerationBonusSum: 0,
    accelerationBonusTimeMs: 0,
    coastingBonusSum: 0,
    coastingBonusTimeMs: 0,
    stabilityBonusSum: 0,
    stabilityBonusTimeMs: 0,
    idleBonusSum: 0,
    idleBonusTimeMs: 0,
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

      if (factors.speedBonus > 0) {
        acc.speedBonusSum += factors.speedBonus * 100 * durationMs;
        acc.speedBonusTimeMs += durationMs;
      }

      if (factors.accelerationBonus > 0) {
        acc.accelerationBonusSum +=
          factors.accelerationBonus * 100 * durationMs;
        acc.accelerationBonusTimeMs += durationMs;
      }

      if (factors.coastingBonus > 0) {
        acc.coastingBonusSum += factors.coastingBonus * 100 * durationMs;
        acc.coastingBonusTimeMs += durationMs;
      }

      if (factors.stabilityBonus > 0) {
        acc.stabilityBonusSum += factors.stabilityBonus * 100 * durationMs;
        acc.stabilityBonusTimeMs += durationMs;
      }

      if (factors.idleBonus > 0) {
        acc.idleBonusSum += factors.idleBonus * 100 * durationMs;
        acc.idleBonusTimeMs += durationMs;
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

    const speedBonusPct =
      acc.speedBonusTimeMs >= PENALTY_TIME_MIN_MS && acc.speedBonusTimeMs > 0
        ? acc.speedBonusSum / acc.speedBonusTimeMs
        : 0;

    const accelerationBonusPct =
      acc.accelerationBonusTimeMs >= PENALTY_TIME_MIN_MS &&
      acc.accelerationBonusTimeMs > 0
        ? acc.accelerationBonusSum / acc.accelerationBonusTimeMs
        : 0;

    const coastingBonusPct =
      acc.coastingBonusTimeMs >= PENALTY_TIME_MIN_MS &&
      acc.coastingBonusTimeMs > 0
        ? acc.coastingBonusSum / acc.coastingBonusTimeMs
        : 0;

    const stabilityBonusPct =
      acc.stabilityBonusTimeMs >= PENALTY_TIME_MIN_MS &&
      acc.stabilityBonusTimeMs > 0
        ? acc.stabilityBonusSum / acc.stabilityBonusTimeMs
        : 0;

    const idleBonusPct =
      acc.idleBonusTimeMs >= PENALTY_TIME_MIN_MS && acc.idleBonusTimeMs > 0
        ? acc.idleBonusSum / acc.idleBonusTimeMs
        : 0;

    const uncappedTotal =
      speedBonusPct +
      accelerationBonusPct +
      coastingBonusPct +
      stabilityBonusPct +
      idleBonusPct;
    const totalBonusPct = Math.min(uncappedTotal, 10);

    return {
      speedPenaltyPct: Math.round(speedPenaltyPct * 10) / 10,
      aggressionPenaltyPct: Math.round(aggressionPenaltyPct * 10) / 10,
      idlePenaltyPct: Math.round(idlePenaltyPct * 10) / 10,
      stabilityPenaltyPct: Math.round(stabilityPenaltyPct * 10) / 10,
      speedBonusPct: Math.round(speedBonusPct * 10) / 10,
      accelerationBonusPct: Math.round(accelerationBonusPct * 10) / 10,
      coastingBonusPct: Math.round(coastingBonusPct * 10) / 10,
      stabilityBonusPct: Math.round(stabilityBonusPct * 10) / 10,
      idleBonusPct: Math.round(idleBonusPct * 10) / 10,
      totalBonusPct: Math.round(totalBonusPct * 10) / 10,
      isEcoDriving: uncappedTotal > 0,
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
    (
      distanceKm: number,
      baseKmPerLiter: number,
      fuelPrice: number,
      totalBonusPct: number = 0,
    ) => {
      if (baseKmPerLiter <= 0) {
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

      const effective = getEffectivePenalties();

      const baseFuelUsed = distanceKm / baseKmPerLiter;

      const penaltyMultiplier = 1 + effective.combinedPenalty / 100;
      const bonusMultiplier = 1 - Math.min(totalBonusPct, 10) / 100;

      const adjustedKmPerLiter =
        (baseKmPerLiter * bonusMultiplier) / penaltyMultiplier;
      const totalFuelUsed = distanceKm / adjustedKmPerLiter;

      const extraFuelUsed = totalFuelUsed - baseFuelUsed;
      const savedFuel = extraFuelUsed < 0 ? Math.abs(extraFuelUsed) : 0;
      const extraCost = extraFuelUsed > 0 ? extraFuelUsed * fuelPrice : 0;
      const savedCost = savedFuel > 0 ? savedFuel * fuelPrice : 0;

      return {
        baseFuelUsed: Math.round(baseFuelUsed * 100) / 100,
        extraFuelUsed: Math.round(Math.max(0, extraFuelUsed) * 100) / 100,
        savedFuel: Math.round(savedFuel * 100) / 100,
        extraCost: Math.round(extraCost * 100) / 100,
        savedCost: Math.round(savedCost * 100) / 100,
        totalFuelUsed: Math.round(totalFuelUsed * 100) / 100,
        totalCost:
          Math.round((baseFuelUsed + extraFuelUsed) * fuelPrice * 100) / 100,
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
      speedBonusSum: 0,
      speedBonusTimeMs: 0,
      accelerationBonusSum: 0,
      accelerationBonusTimeMs: 0,
      coastingBonusSum: 0,
      coastingBonusTimeMs: 0,
      stabilityBonusSum: 0,
      stabilityBonusTimeMs: 0,
      idleBonusSum: 0,
      idleBonusTimeMs: 0,
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
