import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { DriveMode, Coordinates, ActivityType, Vehicle } from "@/types";
import {
  useConsumptionModel,
  type ConsumptionFactors,
} from "./useConsumptionModel";
import { useTripConsumptionTracker } from "./useTripConsumptionTracker";

interface SpeedReading {
  speed: number;
  timestamp: number;
}

interface UseDriveModeReturn {
  driveMode: DriveMode;
  avgSpeed: number;
  stopPercentage: number;
  estimatedConsumption: number;
  estimatedRange: number;
  currentKmPerLiter: number;
  consumptionFactors: ConsumptionFactors;
  addPosition: (position: Coordinates) => void;
  reset: () => void;
  isInitialized: boolean;
  getAverageConsumption: () => number;
  getInstantConsumption: () => number;
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
}

const WINDOW_SIZE_MS = 30000;
const HYSTERESIS_MS = 10000;
const MIN_SPEED_CITY = 40 / 3.6;
const MAX_SPEED_HIGHWAY = 60 / 3.6;
const STOP_SPEED_THRESHOLD = 1;
const MIN_STOP_DURATION_MS = 180000;
const STOPS_PER_km_THRESHOLD = 2;
const WARM_UP_DURATION_MS = 90000;

const DEFAULT_CITY = 10;
const DEFAULT_HIGHWAY = 14;
const DEFAULT_MIXED = 12;
const DEFAULT_DISPLACEMENT = 1600;
const DEFAULT_FUEL_TYPE = "gasolina" as const;

function mapVehicleFuelType(
  fuelType: Vehicle["fuelType"],
): "gasolina" | "etanol" | "flex" {
  if (fuelType === "diesel") return "gasolina";
  if (fuelType === "ethanol") return "etanol";
  if (fuelType === "flex") return "flex";
  return "gasolina";
}

export function useDriveMode(
  distanceMeters: number,
  currentFuel: number,
  gradePercent: number = 0,
  vehicle?: Vehicle | null,
): UseDriveModeReturn {
  const [driveMode, setDriveMode] = useState<DriveMode>("city");
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [stopPercentage, setStopPercentage] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentKmPerLiter, setCurrentKmPerLiter] = useState(8);
  const [activityType, setActivityType] = useState<ActivityType>("MA");

  const speedReadingsRef = useRef<SpeedReading[]>([]);
  const stopsRef = useRef<{ start: number; end?: number }[]>([]);
  const lastModeChangeRef = useRef<number>(0);
  const lastSampleTimeRef = useRef<number>(0);
  const idleStartTimeRef = useRef<number>(0);
  const tripStartTimeRef = useRef<number>(0);
  const [warmUpElapsedMs, setWarmUpElapsedMs] = useState(0);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (tripStartTimeRef.current === 0) return;
    const interval = setInterval(() => {
      setWarmUpElapsedMs(Date.now() - tripStartTimeRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const {
    addReading: addConsumptionReading,
    getMetrics,
    reset: resetConsumptionModel,
    calculateAdjustedConsumption,
  } = useConsumptionModel();

  const {
    addSample,
    getAverageConsumption,
    getInstantConsumption,
    getEstimatedCosts,
    reset: resetTripTracker,
  } = useTripConsumptionTracker();

  const v = vehicle;
  const cityKmpl = v?.urbanKmpl ?? DEFAULT_CITY;
  const highwayKmpl = v?.highwayKmpl ?? DEFAULT_HIGHWAY;
  const mixedKmpl = v?.combinedKmpl ?? DEFAULT_MIXED;
  const displacement = v?.displacement ?? DEFAULT_DISPLACEMENT;
  const fuelType = v ? mapVehicleFuelType(v.fuelType) : DEFAULT_FUEL_TYPE;
  const calibration = v ?? null;

  const calculateMetrics = useCallback(() => {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    const recentReadings = speedReadingsRef.current.filter(
      (r) => r.timestamp > windowStart,
    );

    if (recentReadings.length === 0) {
      setAvgSpeed(0);
      setStopPercentage(0);
      return;
    }

    const totalSpeed = recentReadings.reduce((sum, r) => sum + r.speed, 0);
    const currentAvgSpeed = totalSpeed / recentReadings.length;
    setAvgSpeed(currentAvgSpeed * 3.6);

    const stopCount = recentReadings.filter(
      (r) => r.speed < STOP_SPEED_THRESHOLD,
    ).length;
    const stopPct = (stopCount / recentReadings.length) * 100;
    setStopPercentage(stopPct);
  }, []);

  const determineMode = useCallback((): DriveMode => {
    const now = Date.now();
    const avgSpeedMs = avgSpeed / 3.6;

    if (avgSpeedMs >= MAX_SPEED_HIGHWAY) {
      return "highway";
    }
    if (avgSpeedMs < MIN_SPEED_CITY) {
      return "city";
    }

    const windowStart = now - WINDOW_SIZE_MS;

    const distanceInWindow =
      distanceMeters > 0
        ? Math.min(distanceMeters, (WINDOW_SIZE_MS / 1000) * (avgSpeedMs || 10))
        : 0;
    const kmInWindow = distanceInWindow / 1000;

    const stopsInWindow = stopsRef.current.filter(
      (s) =>
        s.start > windowStart &&
        s.end &&
        s.end - s.start >= MIN_STOP_DURATION_MS,
    );

    const stopsPerKm = kmInWindow > 0.1 ? stopsInWindow.length / kmInWindow : 0;

    if (stopsPerKm > STOPS_PER_km_THRESHOLD) {
      return "city";
    }

    if (stopsPerKm < STOPS_PER_km_THRESHOLD / 2 && avgSpeedMs >= 35 / 3.6) {
      return "highway";
    }

    return "mixed";
  }, [avgSpeed, distanceMeters]);

  const addPosition = useCallback(
    (position: Coordinates) => {
      if (position.speed === undefined) return;

      const now = position.timestamp;
      const windowStart = now - WINDOW_SIZE_MS;

      speedReadingsRef.current = speedReadingsRef.current.filter(
        (r) => r.timestamp > windowStart,
      );
      speedReadingsRef.current.push({ speed: position.speed, timestamp: now });

      const lastReading =
        speedReadingsRef.current[speedReadingsRef.current.length - 2];
      const wasStopped =
        lastReading && lastReading.speed < STOP_SPEED_THRESHOLD;
      const isStopped = position.speed < STOP_SPEED_THRESHOLD;

      let newActivityType: ActivityType;
      if (position.speed > STOP_SPEED_THRESHOLD) {
        newActivityType = "MA";
        idleStartTimeRef.current = 0;
      } else {
        newActivityType = "SA_ENGINE_ON";
        if (idleStartTimeRef.current === 0) {
          idleStartTimeRef.current = now;
        }
      }
      setActivityType(newActivityType);

      if (wasStopped && !isStopped && stopsRef.current.length > 0) {
        const lastStop = stopsRef.current[stopsRef.current.length - 1];
        if (!lastStop.end) {
          lastStop.end = now;
        }
      }

      if (!wasStopped && isStopped) {
        stopsRef.current.push({ start: now });
      }

      addConsumptionReading(position.speed, now);
      calculateMetrics();

      let baseConsumption: number;
      if (driveMode === "highway") {
        baseConsumption = highwayKmpl;
      } else if (driveMode === "mixed") {
        baseConsumption = mixedKmpl;
      } else {
        baseConsumption = cityKmpl;
      }

      const metrics = getMetrics(now);

      const idleDurationMs =
        newActivityType === "SA_ENGINE_ON" && idleStartTimeRef.current > 0
          ? now - idleStartTimeRef.current
          : 0;

      const newFactors = calculateAdjustedConsumption(
        baseConsumption,
        metrics.avgSpeedKmh,
        metrics.speedVariance,
        metrics.idlePercentage,
        newActivityType,
        idleDurationMs,
        displacement,
        fuelType,
        calibration,
        gradePercent,
      );

      const durationMs =
        lastSampleTimeRef.current > 0 ? now - lastSampleTimeRef.current : 1000;
      lastSampleTimeRef.current = now;
      addSample(newFactors, durationMs);

      const newMode = determineMode();
      const timeSinceLastChange = now - lastModeChangeRef.current;

      if (newMode !== driveMode && timeSinceLastChange >= HYSTERESIS_MS) {
        setDriveMode(newMode);
        lastModeChangeRef.current = now;
        let baseConsumption: number;
        if (newMode === "highway") {
          baseConsumption = highwayKmpl;
        } else if (newMode === "mixed") {
          baseConsumption = mixedKmpl;
        } else {
          baseConsumption = cityKmpl;
        }
        setCurrentKmPerLiter(baseConsumption);
      }
    },
    [
      cityKmpl,
      highwayKmpl,
      mixedKmpl,
      displacement,
      fuelType,
      calibration,
      calculateMetrics,
      determineMode,
      driveMode,
      addConsumptionReading,
      addSample,
      getMetrics,
      calculateAdjustedConsumption,
      gradePercent,
    ],
  );

  const reset = useCallback(() => {
    speedReadingsRef.current = [];
    stopsRef.current = [];
    lastModeChangeRef.current = 0;
    lastSampleTimeRef.current = 0;
    idleStartTimeRef.current = 0;
    tripStartTimeRef.current = Date.now();
    setDriveMode("city");
    setAvgSpeed(0);
    setStopPercentage(0);
    setActivityType("MA");
    setCurrentKmPerLiter(cityKmpl);
    resetConsumptionModel();
    resetTripTracker();
    setWarmUpElapsedMs(0);
  }, [cityKmpl, resetConsumptionModel, resetTripTracker]);

  const litersRemaining = Math.max(0, currentFuel);

  const consumptionFactors = useMemo((): ConsumptionFactors => {
    const metrics = getMetrics();
    let baseConsumption: number;
    if (driveMode === "highway") {
      baseConsumption = highwayKmpl;
    } else if (driveMode === "mixed") {
      baseConsumption = mixedKmpl;
    } else {
      baseConsumption = cityKmpl;
    }

    return calculateAdjustedConsumption(
      baseConsumption,
      metrics.avgSpeedKmh,
      0,
      metrics.idlePercentage,
      activityType,
      0,
      displacement,
      fuelType,
      calibration,
      gradePercent,
    );
  }, [
    cityKmpl,
    highwayKmpl,
    mixedKmpl,
    displacement,
    fuelType,
    calibration,
    currentKmPerLiter,
    driveMode,
    activityType,
    getMetrics,
    calculateAdjustedConsumption,
    gradePercent,
  ]);

  const rawEstimatedRange =
    consumptionFactors.adjustedKmPerLiter > 0
      ? litersRemaining * consumptionFactors.adjustedKmPerLiter
      : 0;

  const conservativeFallbackRange = litersRemaining * cityKmpl;

  const warmUpProgress = Math.min(warmUpElapsedMs / WARM_UP_DURATION_MS, 1);
  const warmUpFactor = warmUpProgress * warmUpProgress;

  const estimatedRange =
    warmUpProgress >= 1
      ? rawEstimatedRange
      : conservativeFallbackRange +
        (rawEstimatedRange - conservativeFallbackRange) * warmUpFactor;

  const estimatedConsumption = consumptionFactors.adjustedKmPerLiter;

  return {
    driveMode,
    avgSpeed,
    stopPercentage,
    estimatedConsumption,
    estimatedRange,
    currentKmPerLiter,
    consumptionFactors,
    addPosition,
    reset,
    isInitialized,
    getAverageConsumption,
    getInstantConsumption,
    getEstimatedCosts,
  };
}
