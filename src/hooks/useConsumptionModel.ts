import { useCallback, useRef } from "react";
import type { ActivityType } from "@/types";

export interface ConsumptionFactors {
  baseKmPerLiter: number;
  speedFactor: number;
  aggressionFactor: number;
  idleFactor: number;
  stabilityFactor: number;
  adjustedKmPerLiter: number;
  isAggressive: boolean;
  totalBonus: number;
  speedBonus: number;
  accelerationBonus: number;
  coastingBonus: number;
  stabilityBonus: number;
  idleBonus: number;
  isEcoDriving: boolean;
  currentSpeedKmh: number;
  currentAcceleration: number;
  idlePercentage: number;
  speedVariance: number;
  activityType: ActivityType;
  copertKmPerLiter: number;
  hybridKmPerLiter: number;
}

export interface BonusBreakdown {
  speedBonus: number;
  accelerationBonus: number;
  coastingBonus: number;
  stabilityBonus: number;
  idleBonus: number;
  totalBonus: number;
}

interface SpeedReading {
  speed: number;
  acceleration: number;
  timestamp: number;
}

const WINDOW_SIZE_MS = 30000;
const SPEED_THRESHOLD_KMH = 90;
const AGGRESSION_ACCEL_THRESHOLD_MS2 = 2.5;
const MODERATE_ACCEL_THRESHOLD_MS2 = 1.5;
const IDLE_SPEED_THRESHOLD_MS = 1;

const SPEED_PENALTY_PER_KMH = 0.009;
const AGGRESSIVE_PENALTY = 0.1;
const MODERATE_PENALTY = 0.06;
const IDLE_PENALTY_PERCENT = 0.08;
const STABILITY_PENALTY_PER_VARIANCE = 0.05;

const OPTIMAL_SPEED_MIN = 60;
const OPTIMAL_SPEED_MAX = 80;
const OPTIMAL_SPEED_BONUS = 0.05;

const GENTLE_ACCEL_THRESHOLD = 0.5;
const GENTLE_BONUS = 0.04;

const COASTING_DECEL_THRESHOLD = -0.3;
const COASTING_BONUS = 0.03;

const STABLE_VARIANCE = 15;
const STABILITY_BONUS = 0.03;

const ZERO_IDLE_BONUS = 0.03;

const MAX_TOTAL_BONUS = 0.1;

const COPERT_WEIGHT = 0.6;
const CURRENT_MODEL_WEIGHT = 0.4;

export function copertFuelConsumption(speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  const v = speedKmh;
  const fcPerKm =
    (217 + 0.253 * v + 0.00965 * v * v) / (1 + 0.096 * v - 0.000421 * v * v);
  return 100 / fcPerKm;
}

export function calculateIdleConsumptionLiters(durationMs: number): number {
  const durationSeconds = durationMs / 1000;
  const mlPerSecond = 0.361;
  return (mlPerSecond * durationSeconds) / 1000;
}

export function useConsumptionModel() {
  const readingsRef = useRef<SpeedReading[]>([]);
  const idleTimeRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);

  const calculateSpeedFactor = useCallback(
    (currentSpeedKmh: number): number => {
      if (currentSpeedKmh <= SPEED_THRESHOLD_KMH) {
        return 1.0;
      }
      const excessSpeed = currentSpeedKmh - SPEED_THRESHOLD_KMH;
      return 1 + excessSpeed * SPEED_PENALTY_PER_KMH;
    },
    [],
  );

  const calculateAggressionFactor = useCallback(
    (avgAcceleration: number): { factor: number; isAggressive: boolean } => {
      const absAccel = Math.abs(avgAcceleration);
      if (absAccel > AGGRESSION_ACCEL_THRESHOLD_MS2) {
        return { factor: 1 + AGGRESSIVE_PENALTY, isAggressive: true };
      }
      if (absAccel > MODERATE_ACCEL_THRESHOLD_MS2) {
        return { factor: 1 + MODERATE_PENALTY, isAggressive: false };
      }
      return { factor: 1.0, isAggressive: false };
    },
    [],
  );

  const calculateIdleFactor = useCallback((idlePercentage: number): number => {
    return 1 + (idlePercentage / 100) * IDLE_PENALTY_PERCENT;
  }, []);

  const calculateStabilityFactor = useCallback(
    (speedVariance: number): number => {
      return 1 + (speedVariance / 100) * STABILITY_PENALTY_PER_VARIANCE;
    },
    [],
  );

  const calculateSpeedBonus = useCallback((currentSpeedKmh: number): number => {
    if (
      currentSpeedKmh >= OPTIMAL_SPEED_MIN &&
      currentSpeedKmh <= OPTIMAL_SPEED_MAX
    ) {
      const distanceFromCenter =
        Math.abs(
          currentSpeedKmh - (OPTIMAL_SPEED_MIN + OPTIMAL_SPEED_MAX) / 2,
        ) /
        ((OPTIMAL_SPEED_MAX - OPTIMAL_SPEED_MIN) / 2);
      return OPTIMAL_SPEED_BONUS * (1 - distanceFromCenter * 0.9);
    }
    if (currentSpeedKmh > OPTIMAL_SPEED_MAX && currentSpeedKmh < 90) {
      const excess = currentSpeedKmh - OPTIMAL_SPEED_MAX;
      const decayRate = OPTIMAL_SPEED_BONUS / 10;
      return Math.max(0, OPTIMAL_SPEED_BONUS - excess * decayRate);
    }
    return 0;
  }, []);

  const calculateAccelerationBonus = useCallback(
    (avgAcceleration: number): number => {
      if (Math.abs(avgAcceleration) < GENTLE_ACCEL_THRESHOLD) {
        return GENTLE_BONUS;
      }
      return 0;
    },
    [],
  );

  const calculateCoastingBonus = useCallback(
    (avgAcceleration: number): number => {
      if (
        avgAcceleration < COASTING_DECEL_THRESHOLD &&
        avgAcceleration > -2.0
      ) {
        return COASTING_BONUS;
      }
      return 0;
    },
    [],
  );

  const calculateStabilityBonus = useCallback(
    (speedVariance: number): number => {
      if (speedVariance < STABLE_VARIANCE) {
        const normalizedVariance = speedVariance / STABLE_VARIANCE;
        return STABILITY_BONUS * (1 - normalizedVariance);
      }
      return 0;
    },
    [],
  );

  const calculateIdleBonus = useCallback((idlePercentage: number): number => {
    if (idlePercentage === 0) {
      return ZERO_IDLE_BONUS;
    }
    return 0;
  }, []);

  const calculateTotalBonus = useCallback(
    (bonusBreakdown: BonusBreakdown): number => {
      const total =
        bonusBreakdown.speedBonus +
        bonusBreakdown.accelerationBonus +
        bonusBreakdown.coastingBonus +
        bonusBreakdown.stabilityBonus +
        bonusBreakdown.idleBonus;
      return Math.min(total, MAX_TOTAL_BONUS);
    },
    [],
  );

  const calculateAdjustedConsumption = useCallback(
    (
      baseConsumption: number,
      currentSpeedKmh: number,
      speedVariance: number,
      idlePercentage: number,
      activityType: ActivityType = "MA",
      idleDurationMs: number = 0,
    ): ConsumptionFactors => {
      const speedFactor = calculateSpeedFactor(currentSpeedKmh);

      const recentReadings = readingsRef.current.slice(-10);
      const avgAcceleration =
        recentReadings.length > 0
          ? recentReadings.reduce((sum, r) => sum + r.acceleration, 0) /
            recentReadings.length
          : 0;

      const { factor: aggressionFactor, isAggressive } =
        calculateAggressionFactor(avgAcceleration);

      const idleFactor = calculateIdleFactor(idlePercentage);
      const stabilityFactor = calculateStabilityFactor(speedVariance);

      const bonusBreakdown: BonusBreakdown = {
        speedBonus: calculateSpeedBonus(currentSpeedKmh),
        accelerationBonus: calculateAccelerationBonus(avgAcceleration),
        coastingBonus: calculateCoastingBonus(avgAcceleration),
        stabilityBonus: calculateStabilityBonus(speedVariance),
        idleBonus: calculateIdleBonus(idlePercentage),
        totalBonus: 0,
      };

      bonusBreakdown.totalBonus = calculateTotalBonus(bonusBreakdown);

      const totalPenalty =
        speedFactor * aggressionFactor * idleFactor * stabilityFactor;
      const bonusMultiplier = 1 - bonusBreakdown.totalBonus;
      const currentModelKmPerLiter =
        (baseConsumption / totalPenalty) * bonusMultiplier;

      let copertKmPerLiter: number;
      let hybridKmPerLiter: number;

      if (activityType === "SA_ENGINE_OFF") {
        copertKmPerLiter = 0;
        hybridKmPerLiter = 0;
      } else if (activityType === "SA_ENGINE_ON") {
        const idleConsumptionLiters =
          calculateIdleConsumptionLiters(idleDurationMs);
        const idleKmPerLiter =
          idleDurationMs > 0
            ? (((idleDurationMs / 1000 / 3600) * 60) / idleConsumptionLiters) *
              60
            : 0;
        copertKmPerLiter =
          idleKmPerLiter > 0 ? idleKmPerLiter : baseConsumption * 0.5;
        hybridKmPerLiter =
          copertKmPerLiter * COPERT_WEIGHT +
          currentModelKmPerLiter * CURRENT_MODEL_WEIGHT;
      } else {
        copertKmPerLiter = copertFuelConsumption(currentSpeedKmh);
        if (copertKmPerLiter <= 0) {
          copertKmPerLiter = baseConsumption;
        }
        hybridKmPerLiter =
          copertKmPerLiter * COPERT_WEIGHT +
          currentModelKmPerLiter * CURRENT_MODEL_WEIGHT;
      }

      const adjustedKmPerLiter = hybridKmPerLiter;

      return {
        baseKmPerLiter: baseConsumption,
        speedFactor,
        aggressionFactor,
        idleFactor,
        stabilityFactor,
        adjustedKmPerLiter,
        isAggressive,
        totalBonus: bonusBreakdown.totalBonus,
        speedBonus: bonusBreakdown.speedBonus,
        accelerationBonus: bonusBreakdown.accelerationBonus,
        coastingBonus: bonusBreakdown.coastingBonus,
        stabilityBonus: bonusBreakdown.stabilityBonus,
        idleBonus: bonusBreakdown.idleBonus,
        isEcoDriving: bonusBreakdown.totalBonus > 0,
        currentSpeedKmh,
        currentAcceleration: avgAcceleration,
        idlePercentage,
        speedVariance,
        activityType,
        copertKmPerLiter,
        hybridKmPerLiter,
      };
    },
    [
      calculateSpeedFactor,
      calculateAggressionFactor,
      calculateIdleFactor,
      calculateStabilityFactor,
      calculateSpeedBonus,
      calculateAccelerationBonus,
      calculateCoastingBonus,
      calculateStabilityBonus,
      calculateIdleBonus,
      calculateTotalBonus,
    ],
  );

  const addReading = useCallback((speedMs: number, timestamp: number) => {
    const now = timestamp;

    const lastReading = readingsRef.current[readingsRef.current.length - 1];

    let acceleration = 0;
    if (lastReading) {
      const timeDelta = (now - lastReading.timestamp) / 1000;
      if (timeDelta > 0) {
        acceleration = (speedMs - lastReading.speed) / timeDelta;
      }
    }

    readingsRef.current.push({ speed: speedMs, acceleration, timestamp: now });

    const windowStart = now - WINDOW_SIZE_MS;
    readingsRef.current = readingsRef.current.filter(
      (r) => r.timestamp > windowStart,
    );

    if (speedMs < IDLE_SPEED_THRESHOLD_MS) {
      idleTimeRef.current += 1000;
    }
    totalTimeRef.current += 1000;
  }, []);

  const getMetrics = useCallback((currentTime?: number) => {
    const now = currentTime ?? Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    const recentReadings = readingsRef.current.filter(
      (r) => r.timestamp > windowStart,
    );

    if (recentReadings.length === 0) {
      return {
        avgSpeedKmh: 0,
        maxSpeedKmh: 0,
        speedVariance: 0,
        avgAcceleration: 0,
        idlePercentage: 0,
        coastingPercentage: 0,
      };
    }

    const speeds = recentReadings.map((r) => r.speed * 3.6);
    const avgSpeedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeedKmh = Math.max(...speeds);

    const speedVariance =
      speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeedKmh, 2), 0) /
      speeds.length;

    const avgAcceleration =
      recentReadings.reduce((sum, r) => sum + r.acceleration, 0) /
      recentReadings.length;

    const coastingCount = recentReadings.filter(
      (r) => r.acceleration < COASTING_DECEL_THRESHOLD && r.acceleration > -2.0,
    ).length;
    const coastingPercentage = (coastingCount / recentReadings.length) * 100;

    const totalTimeWindow = WINDOW_SIZE_MS;
    const idlePercentage =
      totalTimeWindow > 0 ? (idleTimeRef.current / totalTimeWindow) * 100 : 0;

    return {
      avgSpeedKmh,
      maxSpeedKmh,
      speedVariance,
      avgAcceleration,
      idlePercentage: Math.min(100, idlePercentage),
      coastingPercentage,
    };
  }, []);

  const reset = useCallback(() => {
    readingsRef.current = [];
    idleTimeRef.current = 0;
    totalTimeRef.current = 0;
  }, []);

  return {
    addReading,
    getMetrics,
    reset,
    calculateAdjustedConsumption,
    calculateSpeedBonus,
    calculateAccelerationBonus,
    calculateCoastingBonus,
    calculateStabilityBonus,
    calculateIdleBonus,
  };
}
