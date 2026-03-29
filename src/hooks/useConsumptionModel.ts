import { useCallback, useRef } from "react";

export interface ConsumptionFactors {
  baseKmPerLiter: number;
  speedFactor: number;
  aggressionFactor: number;
  idleFactor: number;
  stabilityFactor: number;
  adjustedKmPerLiter: number;
  isAggressive: boolean;
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

  const calculateAdjustedConsumption = useCallback(
    (
      baseConsumption: number,
      currentSpeedKmh: number,
      speedVariance: number,
      idlePercentage: number,
    ): ConsumptionFactors => {
      const speedFactor = calculateSpeedFactor(currentSpeedKmh);

      const avgAcceleration =
        readingsRef.current.length > 1
          ? readingsRef.current
              .slice(-10)
              .reduce((sum, r) => sum + r.acceleration, 0) /
            Math.min(readingsRef.current.length, 10)
          : 0;
      const { factor: aggressionFactor, isAggressive } =
        calculateAggressionFactor(avgAcceleration);

      const idleFactor = calculateIdleFactor(idlePercentage);
      const stabilityFactor = calculateStabilityFactor(speedVariance);

      const totalPenalty =
        speedFactor * aggressionFactor * idleFactor * stabilityFactor;
      const adjustedKmPerLiter = baseConsumption / totalPenalty;

      return {
        baseKmPerLiter: baseConsumption,
        speedFactor,
        aggressionFactor,
        idleFactor,
        stabilityFactor,
        adjustedKmPerLiter,
        isAggressive,
      };
    },
    [
      calculateSpeedFactor,
      calculateAggressionFactor,
      calculateIdleFactor,
      calculateStabilityFactor,
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

    const totalTimeWindow = WINDOW_SIZE_MS;
    const idlePercentage =
      totalTimeWindow > 0 ? (idleTimeRef.current / totalTimeWindow) * 100 : 0;

    return {
      avgSpeedKmh,
      maxSpeedKmh,
      speedVariance,
      avgAcceleration,
      idlePercentage: Math.min(100, idlePercentage),
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
  };
}
