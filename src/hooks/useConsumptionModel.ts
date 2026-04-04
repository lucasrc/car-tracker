import { useCallback, useRef } from "react";
import type { ActivityType, FuelType, CopertCalibration } from "@/types";

export interface ConsumptionFactors {
  baseKmPerLiter: number;
  adjustedKmPerLiter: number;
  activityType: ActivityType;
  copertKmPerLiter: number;
  displacementFactor: number;
  fuelEnergyFactor: number;
  calibrated: boolean;
  gradePercent: number;
  fuelCutActive: boolean;
}

export function getFuelEnergyFactor(fuelType: FuelType): number {
  const FUEL_ENERGY_FACTORS: Record<FuelType, number> = {
    gasolina: 0.91,
    etanol: 0.7,
    flex: 0.87,
  };
  const factor = FUEL_ENERGY_FACTORS[fuelType];
  if (factor === undefined) {
    console.warn(
      `getFuelEnergyFactor: unknown fuel type "${fuelType}", using default 1.0`,
    );
    return 1.0;
  }
  return factor;
}

export function getDisplacementFactor(engineDisplacement: number): number {
  if (engineDisplacement <= 0) return 1.0;
  const BASELINE_DISPLACEMENT_CC = 1600;
  const ratio = engineDisplacement / BASELINE_DISPLACEMENT_CC;
  return Math.pow(ratio, -0.15);
}

export function getIdleConsumptionMlPerSecond(
  engineDisplacement: number,
): number {
  if (engineDisplacement <= 0) return 0;
  const baseMlPerSecond = 0.361;
  const BASELINE_DISPLACEMENT_CC = 1600;
  const ratio = engineDisplacement / BASELINE_DISPLACEMENT_CC;
  return baseMlPerSecond * Math.pow(ratio, 0.7);
}

export function calculateIdleConsumptionLiters(
  durationMs: number,
  engineDisplacement: number = 1600,
): number {
  const durationSeconds = durationMs / 1000;
  const mlPerSecond = getIdleConsumptionMlPerSecond(engineDisplacement);
  return (mlPerSecond * durationSeconds) / 1000;
}

export function copertFuelConsumption(speedKmh: number): number {
  if (speedKmh <= 0) return 0;
  const v = speedKmh;
  const denominator = 1 + 0.096 * v - 0.000421 * v * v;
  if (denominator <= 0.01) return 0;
  const fcPerKm = (217 + 0.253 * v + 0.00965 * v * v) / denominator;
  const GASOLINE_DENSITY_G_PER_L = 750;
  return GASOLINE_DENSITY_G_PER_L / fcPerKm;
}

function calculateGradePowerKw(
  gradePercent: number,
  massKg: number,
  speedKmh: number,
): number {
  const vMs = speedKmh / 3.6;
  const gradeRadians = Math.atan(gradePercent / 100);
  return (massKg * 9.81 * Math.sin(gradeRadians) * vMs) / 1000;
}

export function copertFuelConsumptionCalibrated(
  speedKmh: number,
  calibration: CopertCalibration,
  gradePercent: number = 0,
): number {
  if (speedKmh <= 0) return 0;

  const vMs = speedKmh / 3.6;

  const gradePowerKw = calculateGradePowerKw(
    gradePercent,
    calibration.mass,
    speedKmh,
  );

  if (gradePercent < -3) {
    return 0;
  }

  const roadLoadKw =
    (calibration.f0 * vMs +
      calibration.f1 * vMs * vMs +
      calibration.f2 * vMs * vMs * vMs) /
      1000 +
    gradePowerKw;

  if (roadLoadKw <= 0) return 0;

  const engineEfficiency = 0.25;
  const fuelLhvKwhPerLiter = calibration.fuelType === "diesel" ? 9.97 : 8.76;
  const effectiveEnergy = fuelLhvKwhPerLiter * engineEfficiency;

  const litersPerHour = roadLoadKw / effectiveEnergy;
  const litersPerKm = litersPerHour / speedKmh;
  const kmPerLiter = 1 / litersPerKm;

  return kmPerLiter;
}

export function useConsumptionModel() {
  const readingsRef = useRef<Array<{ speed: number; timestamp: number }>>([]);
  const lastTimestampRef = useRef<number>(0);

  const addReading = useCallback((speedMs: number, timestamp: number) => {
    const now = timestamp;
    lastTimestampRef.current = now;

    readingsRef.current.push({ speed: speedMs, timestamp: now });

    const windowStart = now - 30000;
    readingsRef.current = readingsRef.current.filter(
      (r) => r.timestamp > windowStart,
    );
  }, []);

  const getMetrics = useCallback((currentTime?: number) => {
    const now = currentTime ?? Date.now();
    const windowStart = now - 30000;

    const recentReadings = readingsRef.current.filter(
      (r) => r.timestamp > windowStart,
    );

    if (recentReadings.length === 0) {
      return {
        avgSpeedKmh: 0,
        maxSpeedKmh: 0,
        speedVariance: 0,
        idlePercentage: 0,
      };
    }

    const speeds = recentReadings.map((r) => r.speed * 3.6);
    const avgSpeedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const maxSpeedKmh = Math.max(...speeds);

    const speedVariance =
      speeds.reduce((sum, s) => sum + Math.pow(s - avgSpeedKmh, 2), 0) /
      speeds.length;

    const idleReadings = recentReadings.filter((r) => r.speed < 1).length;
    const idlePercentage =
      recentReadings.length > 0
        ? (idleReadings / recentReadings.length) * 100
        : 0;

    return {
      avgSpeedKmh,
      maxSpeedKmh,
      speedVariance,
      idlePercentage,
    };
  }, []);

  const reset = useCallback(() => {
    readingsRef.current = [];
    lastTimestampRef.current = 0;
  }, []);

  const calculateAdjustedConsumption = useCallback(
    (
      baseConsumption: number,
      currentSpeedKmh: number,
      _speedVariance: number,
      _idlePercentage: number,
      activityType: ActivityType = "MA",
      _idleDurationMs: number = 0,
      engineDisplacement: number = 1600,
      fuelType: FuelType = "gasolina",
      calibration?: CopertCalibration | null,
      gradePercent: number = 0,
    ): ConsumptionFactors => {
      const displacementFactor = getDisplacementFactor(engineDisplacement);
      const fuelEnergyFactor = getFuelEnergyFactor(fuelType);

      void _idleDurationMs;

      const fuelCutActive = gradePercent < -3 && activityType === "MA";

      let copertKmPerLiter: number;
      let calibrated = false;

      if (activityType === "SA_ENGINE_OFF") {
        copertKmPerLiter = 0;
      } else if (activityType === "SA_ENGINE_ON") {
        copertKmPerLiter = baseConsumption;
      } else if (fuelCutActive) {
        copertKmPerLiter = 0;
      } else {
        if (calibration) {
          copertKmPerLiter = copertFuelConsumptionCalibrated(
            currentSpeedKmh,
            calibration,
            gradePercent,
          );
          calibrated = true;
        } else {
          copertKmPerLiter = copertFuelConsumption(currentSpeedKmh);
        }

        if (copertKmPerLiter <= 0) {
          copertKmPerLiter = baseConsumption;
        }
      }

      let adjustedKmPerLiter: number;
      if (calibrated && calibration) {
        const refSpeed = currentSpeedKmh > 0 ? currentSpeedKmh : 60;
        const copertAtRef = copertFuelConsumptionCalibrated(
          refSpeed,
          calibration,
          0,
        );
        if (copertAtRef > 0) {
          const scaleFactor = baseConsumption / copertAtRef;
          adjustedKmPerLiter = copertKmPerLiter * scaleFactor;
        } else {
          adjustedKmPerLiter = baseConsumption;
        }
      } else {
        adjustedKmPerLiter =
          copertKmPerLiter * displacementFactor * fuelEnergyFactor;
      }

      return {
        baseKmPerLiter: baseConsumption,
        adjustedKmPerLiter,
        activityType,
        copertKmPerLiter,
        displacementFactor,
        fuelEnergyFactor,
        calibrated,
        gradePercent,
        fuelCutActive,
      };
    },
    [],
  );

  return {
    addReading,
    getMetrics,
    reset,
    calculateAdjustedConsumption,
  };
}
