import { useState, useRef, useCallback, useEffect } from "react";
import type {
  DriveMode,
  Coordinates,
  Vehicle,
  FuelType,
  TripTelemetryData,
} from "@/types";
import {
  simulate,
  type TelemetryResult,
  resetGearEstimator,
} from "@/lib/telemetry-engine";
import { debugLog } from "@/lib/debug";

interface SpeedReading {
  speed: number;
  timestamp: number;
}

interface ConsumptionSample {
  kmpl: number;
  durationMs: number;
  timestamp: number;
  distanceKm: number;
  fuelUsed: number;
}

export interface TelemetryEngineReturn {
  driveMode: DriveMode;
  avgSpeed: number;
  estimatedConsumption: number;
  estimatedRange: number;
  currentKmPerLiter: number;
  addPosition: (position: Coordinates) => void;
  reset: () => void;
  isInitialized: boolean;
  getAverageConsumption: () => number;
  getInstantConsumption: () => number;
  getTotalFuelUsed: () => number;
  getTotalDistance: () => number;
  getTelemetryData: () => TripTelemetryData;
  batterySocPct: number;
  isGnv: boolean;
  currentGear?: number;
  currentRpm?: number;
  currentEngineLoad?: number; // Engine load percentage (0-100%)
  hasTransmissionData: boolean;
  confidence: number;
  drivingStyle?: "eco" | "normal" | "sport";
}

const WINDOW_SIZE_MS = 2000;
const HYSTERESIS_MS = 10000;
const MIN_SPEED_CITY = 40 / 3.6;
const MAX_SPEED_HIGHWAY = 60 / 3.6;
const WARM_UP_DURATION_MS = 90000;
const MIN_KMPL_FOR_CALC = 0.1;
const MAX_KMPL_FOR_CALC = 80;

const DEFAULT_CITY = 10;
const DEFAULT_HIGHWAY = 14;
const DEFAULT_FUEL_TYPE = "gasolina" as FuelType;

function mapVehicleFuelType(vehicle: Vehicle | null | undefined): FuelType {
  if (!vehicle) return DEFAULT_FUEL_TYPE;
  if (vehicle.fuelType === "gnv") return "gnv";
  if (vehicle.fuelType === "flex") return "flex";
  if (vehicle.fuelType === "etanol") return "etanol";
  if (vehicle.fuelType === "diesel") return "gasolina";
  return vehicle.fuelType as FuelType;
}

export function useTelemetryEngine(
  distanceMeters: number,
  currentFuel: number,
  gradePercent: number = 0,
  vehicle?: Vehicle | null,
  acOn: boolean = false,
  passengers: number = 1,
  cargoKg: number = 0,
): TelemetryEngineReturn {
  const [driveMode, setDriveMode] = useState<DriveMode>("city");
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentKmPerLiter, setCurrentKmPerLiter] = useState(8);

  const speedReadingsRef = useRef<SpeedReading[]>([]);
  const lastSampleTimeRef = useRef<number>(0);
  const tripStartTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<Coordinates | null>(null);
  const lastSpeedRef = useRef<number>(0);
  const lastAccelRef = useRef<number>(0);
  const batterySocRef = useRef<number>(100);
  const [batterySocPct, setBatterySocPct] = useState(100);
  const [warmUpElapsedMs, setWarmUpElapsedMs] = useState(0);
  const stopEventsRef = useRef<number[]>([]);

  const samplesRef = useRef<ConsumptionSample[]>([]);
  const totalFuelUsedRef = useRef<number>(0);
  const totalDistanceRef = useRef<number>(0);
  const totalHybridDistanceRef = useRef<number>(0);
  const totalTimeWithAcRef = useRef<number>(0);
  const lastSampleTimestampRef = useRef<number>(0);
  const slopeReadingsRef = useRef<number[]>([]);
  const accelReadingsRef = useRef<number[]>([]);
  const powerReadingsRef = useRef<number[]>([]);
  const [currentGear, setCurrentGear] = useState<number | undefined>();
  const [currentRpm, setCurrentRpm] = useState<number | undefined>();
  const [currentEngineLoad, setCurrentEngineLoad] = useState<
    number | undefined
  >();
  const [confidence, setConfidence] = useState(0.85);
  const [hasTransmissionData, setHasTransmissionData] = useState(false);
  const [drivingStyle, setDrivingStyle] = useState<
    "eco" | "normal" | "sport" | undefined
  >();

  const gearDistributionRef = useRef<Record<number, number>>({});
  const rpmReadingsRef = useRef<number[]>([]);
  const speedDistributionRef = useRef<{
    city: number;
    mixed: number;
    highway: number;
  }>({
    city: 0,
    mixed: 0,
    highway: 0,
  });

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

  const v = vehicle;
  const cityKmpl = v?.urbanKmpl ?? DEFAULT_CITY;
  const highwayKmpl = v?.highwayKmpl ?? DEFAULT_HIGHWAY;
  const fuelType = v ? mapVehicleFuelType(v) : DEFAULT_FUEL_TYPE;

  useEffect(() => {
    if (v?.transmission) {
      debugLog("[Telemetry] Vehicle has transmission data:", {
        type: v.transmission.type,
        gearRatios: v.transmission.gearRatios,
        finalDrive: v.transmission.finalDrive,
        hasTorqueCurve: !!v.transmission.torqueCurve,
        torqueCurveKeys: v.transmission.torqueCurve
          ? Object.keys(v.transmission.torqueCurve).length
          : 0,
      });
    } else {
      debugLog("[Telemetry] No transmission data on vehicle");
    }
  }, [v]);

  const calculateMetrics = useCallback(() => {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    const recentReadings = speedReadingsRef.current.filter(
      (r) => r.timestamp > windowStart,
    );

    if (recentReadings.length === 0) {
      setAvgSpeed(0);
      return;
    }

    const totalSpeed = recentReadings.reduce((sum, r) => sum + r.speed, 0);
    const currentAvgSpeed = totalSpeed / recentReadings.length;
    setAvgSpeed(currentAvgSpeed * 3.6);
  }, []);

  const determineMode = useCallback((): DriveMode => {
    const avgSpeedMs = avgSpeed / 3.6;

    if (avgSpeedMs >= MAX_SPEED_HIGHWAY) {
      return "highway";
    }
    if (avgSpeedMs < MIN_SPEED_CITY) {
      return "city";
    }

    const distanceInWindow =
      distanceMeters > 0
        ? Math.min(distanceMeters, (WINDOW_SIZE_MS / 1000) * (avgSpeedMs || 10))
        : 0;
    const kmInWindow = distanceInWindow / 1000;

    if (kmInWindow < 0.1) {
      return "city";
    }

    const stopsPerKm = 0;

    if (stopsPerKm < 1 && avgSpeedMs >= 35 / 3.6) {
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

      const speedKmh = position.speed * 3.6;
      const lastPos = lastPositionRef.current;

      let accel = 0;
      if (lastPos && lastPos.speed !== undefined) {
        const dt = (now - lastPos.timestamp) / 1000;
        if (dt > 0) {
          accel = (position.speed - lastPos.speed) / dt;
          accel = Math.max(-10, Math.min(10, accel));
        }
      }
      lastAccelRef.current = accel;

      const lastSpeedKmh = (lastSpeedRef.current || 0) * 3.6;
      if (lastSpeedKmh > 5 && speedKmh < 1) {
        stopEventsRef.current.push(now);
        if (stopEventsRef.current.length > 10) {
          stopEventsRef.current = stopEventsRef.current.slice(-10);
        }
      }
      lastSpeedRef.current = position.speed;

      calculateMetrics();

      if (!vehicle) {
        lastPositionRef.current = position;
        return;
      }

      debugLog(
        "[TELEMETRY] gradePercent:",
        gradePercent,
        "speed:",
        speedKmh.toFixed(1),
        "accel:",
        accel.toFixed(2),
      );

      const secondsSinceEngineStart = tripStartTimeRef.current > 0
        ? (now - tripStartTimeRef.current) / 1000
        : undefined;

      const recentStops = stopEventsRef.current.filter(
        (t) => now - t < 120000,
      ).length;
      const stopAndGoPenalty = recentStops >= 3 ? 1.0 + (recentStops - 2) * 0.05 : 1.0;

      const result: TelemetryResult = simulate(vehicle, {
        speed: speedKmh,
        slope: gradePercent,
        accel,
        acOn,
        passengers,
        cargoKg,
        fuelType,
        batterySocPct: batterySocRef.current,
        altitudeM: position.altitude,
        temperatureC: 25,
        secondsSinceEngineStart,
        stopAndGoPenalty,
      });

      batterySocRef.current = result.updatedBatterySocPct;
      setBatterySocPct(result.updatedBatterySocPct);

      setCurrentGear(result.gear);
      setCurrentRpm(result.rpm);
      setCurrentEngineLoad(result.engineLoad);
      setConfidence(result.confidence);
      setHasTransmissionData(result.hasTransmissionData);
      setDrivingStyle(result.drivingStyle);

      if (result.hasTransmissionData) {
        debugLog(
          `[Telemetry] Gear/RPM calculated: gear=${result.gear}, rpm=${result.rpm}, hasData=${result.hasTransmissionData}`,
        );
      }

      if (result.gear !== undefined && result.gear > 0) {
        const dist = gearDistributionRef.current;
        dist[result.gear] = (dist[result.gear] || 0) + 1;
      }

      if (result.rpm !== undefined) {
        rpmReadingsRef.current.push(result.rpm);
        if (rpmReadingsRef.current.length > 300) {
          rpmReadingsRef.current = rpmReadingsRef.current.slice(-300);
        }
      }

      slopeReadingsRef.current.push(gradePercent);
      if (slopeReadingsRef.current.length > 300) {
        slopeReadingsRef.current = slopeReadingsRef.current.slice(-300);
      }

      accelReadingsRef.current.push(accel);
      if (accelReadingsRef.current.length > 300) {
        accelReadingsRef.current = accelReadingsRef.current.slice(-300);
      }

      powerReadingsRef.current.push(result.factors.totalPowerKw);
      if (powerReadingsRef.current.length > 300) {
        powerReadingsRef.current = powerReadingsRef.current.slice(-300);
      }

      const durationMs =
        lastSampleTimeRef.current > 0 ? now - lastSampleTimeRef.current : 1000;
      lastSampleTimeRef.current = now;

      let segmentDistanceKm = 0;
      if (lastPos) {
        const dLat = (position.lat - lastPos.lat) * (Math.PI / 180);
        const dLng = (position.lng - lastPos.lng) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lastPos.lat * (Math.PI / 180)) *
            Math.cos(position.lat * (Math.PI / 180)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        segmentDistanceKm = 6371 * c;
      }

      if (
        segmentDistanceKm > 0.001 &&
        result.kmpl > MIN_KMPL_FOR_CALC &&
        result.kmpl < MAX_KMPL_FOR_CALC
      ) {
        const fuelUsed = segmentDistanceKm / result.kmpl;
        totalFuelUsedRef.current += fuelUsed;
        totalDistanceRef.current += segmentDistanceKm;

        if (vehicle.isHybrid && result.isHybridEvMode) {
          totalHybridDistanceRef.current += segmentDistanceKm;
        }

        if (acOn) {
          totalTimeWithAcRef.current += durationMs;
        }

        const dist = speedDistributionRef.current;
        if (speedKmh < 40) dist.city += segmentDistanceKm;
        else if (speedKmh < 60) dist.mixed += segmentDistanceKm;
        else dist.highway += segmentDistanceKm;
      }

      samplesRef.current.push({
        kmpl: result.kmpl,
        durationMs,
        timestamp: now,
        distanceKm: segmentDistanceKm,
        fuelUsed:
          segmentDistanceKm > 0.001 &&
          result.kmpl > MIN_KMPL_FOR_CALC &&
          result.kmpl < MAX_KMPL_FOR_CALC
            ? segmentDistanceKm / result.kmpl
            : 0,
      });

      const cutoff = Date.now() - WINDOW_SIZE_MS;
      samplesRef.current = samplesRef.current.filter(
        (s) => s.timestamp > cutoff,
      );

      lastSampleTimestampRef.current = now;
      lastPositionRef.current = position;

      const newMode = determineMode();
      const timeSinceLastChange = now - (tripStartTimeRef.current || now);

      if (newMode !== driveMode && timeSinceLastChange >= HYSTERESIS_MS) {
        setDriveMode(newMode);
        let baseConsumption: number;
        if (newMode === "highway") {
          baseConsumption = highwayKmpl;
        } else if (newMode === "mixed") {
          baseConsumption = (cityKmpl + highwayKmpl) / 2;
        } else {
          baseConsumption = cityKmpl;
        }
        setCurrentKmPerLiter(baseConsumption);
      }
    },
    [
      vehicle,
      gradePercent,
      acOn,
      passengers,
      cargoKg,
      fuelType,
      cityKmpl,
      highwayKmpl,
      calculateMetrics,
      determineMode,
      driveMode,
    ],
  );

  const reset = useCallback(() => {
    speedReadingsRef.current = [];
    lastSampleTimeRef.current = 0;
    tripStartTimeRef.current = Date.now();
    lastPositionRef.current = null;
    lastSpeedRef.current = 0;
    lastAccelRef.current = 0;
    batterySocRef.current = 100;
    setBatterySocPct(100);
    samplesRef.current = [];
    totalFuelUsedRef.current = 0;
    totalDistanceRef.current = 0;
    totalHybridDistanceRef.current = 0;
    totalTimeWithAcRef.current = 0;
    lastSampleTimestampRef.current = 0;
    slopeReadingsRef.current = [];
    accelReadingsRef.current = [];
    powerReadingsRef.current = [];
    gearDistributionRef.current = {};
    rpmReadingsRef.current = [];
    speedDistributionRef.current = { city: 0, mixed: 0, highway: 0 };
    setCurrentGear(undefined);
    setCurrentRpm(undefined);
    setCurrentEngineLoad(undefined);
    setConfidence(0.85);
    setHasTransmissionData(false);
    setDriveMode("city");
    setAvgSpeed(0);
    setCurrentKmPerLiter(cityKmpl);
    setWarmUpElapsedMs(0);
    setDrivingStyle(undefined);
    resetGearEstimator();
  }, [cityKmpl]);

  const getAverageConsumption = useCallback((): number => {
    if (totalFuelUsedRef.current === 0 || totalDistanceRef.current === 0)
      return 0;
    return totalDistanceRef.current / totalFuelUsedRef.current;
  }, []);

  const getInstantConsumption = useCallback((): number => {
    const samples = samplesRef.current;
    if (samples.length === 0) return 0;
    const recent = samples.slice(-3);
    if (recent.length === 0) return 0;
    const totalDistance = recent.reduce((sum, s) => sum + s.distanceKm, 0);
    const totalFuel = recent.reduce((sum, s) => sum + s.fuelUsed, 0);
    if (totalFuel === 0 || totalDistance === 0) return 0;
    return totalDistance / totalFuel;
  }, []);

  const getTotalFuelUsed = useCallback((): number => {
    return totalFuelUsedRef.current;
  }, []);

  const getTotalDistance = useCallback((): number => {
    return totalDistanceRef.current;
  }, []);

  const getTelemetryData = useCallback((): TripTelemetryData => {
    const avgSlope =
      slopeReadingsRef.current.length > 0
        ? slopeReadingsRef.current.reduce((a, b) => a + b, 0) /
          slopeReadingsRef.current.length
        : 0;
    const maxSlope =
      slopeReadingsRef.current.length > 0
        ? Math.max(...slopeReadingsRef.current.map(Math.abs))
        : 0;
    const avgAccel =
      accelReadingsRef.current.length > 0
        ? accelReadingsRef.current.reduce((a, b) => a + Math.abs(b), 0) /
          accelReadingsRef.current.length
        : 0;
    const maxAccel =
      accelReadingsRef.current.length > 0
        ? Math.max(...accelReadingsRef.current.map(Math.abs))
        : 0;
    const avgPowerKw =
      powerReadingsRef.current.length > 0
        ? powerReadingsRef.current.reduce((a: number, b: number) => a + b, 0) /
          powerReadingsRef.current.length
        : 0;

    const totalTripTimeMs =
      Date.now() - (tripStartTimeRef.current || Date.now());
    const acUsagePct =
      totalTripTimeMs > 0
        ? (totalTimeWithAcRef.current / totalTripTimeMs) * 100
        : 0;

    const totalDist = totalDistanceRef.current;
    const hybridDistancePct =
      totalDist > 0 ? (totalHybridDistanceRef.current / totalDist) * 100 : 0;

    const dist = speedDistributionRef.current;
    const totalDistDist = dist.city + dist.mixed + dist.highway;

    const avgRpm =
      rpmReadingsRef.current.length > 0
        ? rpmReadingsRef.current.reduce((a, b) => a + b, 0) /
          rpmReadingsRef.current.length
        : undefined;
    const maxRpm =
      rpmReadingsRef.current.length > 0
        ? Math.max(...rpmReadingsRef.current)
        : undefined;

    return {
      fuelType,
      batterySocStart: 100,
      batterySocEnd: batterySocRef.current,
      hybridDistancePct,
      avgSlope,
      maxSlope,
      acUsagePct,
      massPenaltyAvg: avgPowerKw,
      idleTimeSeconds: 0,
      avgAcceleration: avgAccel,
      maxAcceleration: maxAccel,
      speedDistribution: {
        city: totalDistDist > 0 ? (dist.city / totalDistDist) * 100 : 0,
        mixed: totalDistDist > 0 ? (dist.mixed / totalDistDist) * 100 : 0,
        highway: totalDistDist > 0 ? (dist.highway / totalDistDist) * 100 : 0,
      },
      gearDistribution: { ...gearDistributionRef.current },
      avgRpm,
      maxRpm,
      hasTransmissionData,
    };
  }, [fuelType, hasTransmissionData]);

  const litersRemaining = Math.max(0, currentFuel);

  const [currentConsumption, setCurrentConsumption] = useState(cityKmpl);

  useEffect(() => {
    const samples = samplesRef.current;
    if (samples.length === 0) {
      setCurrentConsumption(driveMode === "highway" ? highwayKmpl : cityKmpl);
      return;
    }
    const now = tripStartTimeRef.current + warmUpElapsedMs;
    const recentCutoff = now - WINDOW_SIZE_MS;
    const recent = samples.filter((s) => s.timestamp > recentCutoff);
    if (recent.length === 0) {
      setCurrentConsumption(driveMode === "highway" ? highwayKmpl : cityKmpl);
      return;
    }
    // Correct formula: total distance / total fuel used (harmonic mean)
    const totalDistance = recent.reduce((sum, s) => sum + s.distanceKm, 0);
    const totalFuel = recent.reduce((sum, s) => sum + s.fuelUsed, 0);
    setCurrentConsumption(
      totalFuel > 0 && totalDistance > 0 ? totalDistance / totalFuel : cityKmpl,
    );
  }, [driveMode, cityKmpl, highwayKmpl, warmUpElapsedMs]);

  const rawEstimatedRange =
    currentConsumption > 0 ? litersRemaining * currentConsumption : 0;

  const conservativeFallbackRange = litersRemaining * cityKmpl;

  const warmUpProgress = Math.min(warmUpElapsedMs / WARM_UP_DURATION_MS, 1);
  const warmUpFactor = warmUpProgress * warmUpProgress;

  const estimatedRange =
    warmUpProgress >= 1
      ? rawEstimatedRange
      : conservativeFallbackRange +
        (rawEstimatedRange - conservativeFallbackRange) * warmUpFactor;

  const estimatedConsumption = currentConsumption;

  debugLog(
    `[TELEMETRY] Range calc: currentFuel=${currentFuel.toFixed(2)}L, litersRemaining=${litersRemaining.toFixed(2)}L, currentConsumption=${currentConsumption.toFixed(2)}km/L, estimatedRange=${estimatedRange.toFixed(2)}km`,
  );

  return {
    driveMode,
    avgSpeed,
    estimatedConsumption,
    estimatedRange,
    currentKmPerLiter,
    addPosition,
    reset,
    isInitialized,
    getAverageConsumption,
    getInstantConsumption,
    getTotalFuelUsed,
    getTotalDistance,
    getTelemetryData,
    batterySocPct,
    isGnv: fuelType === "gnv",
    currentGear,
    currentRpm,
    currentEngineLoad,
    hasTransmissionData,
    confidence,
    drivingStyle,
  };
}
