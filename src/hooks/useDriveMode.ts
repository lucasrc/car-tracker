import { useState, useRef, useCallback, useEffect } from "react";
import type { DriveMode, Settings, Coordinates } from "@/types";
import { getSettings } from "@/lib/db";

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
  addPosition: (position: Coordinates) => void;
  reset: () => void;
  isInitialized: boolean;
}

const WINDOW_SIZE_MS = 30000;
const HYSTERESIS_MS = 10000;
const MIN_SPEED_CITY = 40 / 3.6;
const MAX_SPEED_HIGHWAY = 60 / 3.6;
const STOP_SPEED_THRESHOLD = 5 / 3.6;
const MIN_STOP_DURATION_MS = 180000;
const STOPS_PER_km_THRESHOLD = 2;

export function useDriveMode(
  distanceMeters: number,
  fuelCapacity: number,
): UseDriveModeReturn {
  const [driveMode, setDriveMode] = useState<DriveMode>("city");
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [stopPercentage, setStopPercentage] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentKmPerLiter, setCurrentKmPerLiter] = useState(8);

  const speedReadingsRef = useRef<SpeedReading[]>([]);
  const stopsRef = useRef<{ start: number; end?: number }[]>([]);
  const lastModeChangeRef = useRef<number>(0);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setCurrentKmPerLiter(s.cityKmPerLiter);
      setIsInitialized(true);
    });
  }, []);

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

    return "highway";
  }, [avgSpeed, distanceMeters]);

  const addPosition = useCallback(
    (position: Coordinates) => {
      if (!settings || position.speed === undefined) return;

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

      if (wasStopped && !isStopped && stopsRef.current.length > 0) {
        const lastStop = stopsRef.current[stopsRef.current.length - 1];
        if (!lastStop.end) {
          lastStop.end = now;
        }
      }

      if (!wasStopped && isStopped) {
        stopsRef.current.push({ start: now });
      }

      calculateMetrics();

      const newMode = determineMode();
      const timeSinceLastChange = now - lastModeChangeRef.current;

      if (newMode !== driveMode && timeSinceLastChange >= HYSTERESIS_MS) {
        setDriveMode(newMode);
        lastModeChangeRef.current = now;
        setCurrentKmPerLiter(
          newMode === "highway"
            ? settings.highwayKmPerLiter
            : settings.cityKmPerLiter,
        );
      }
    },
    [settings, calculateMetrics, determineMode, driveMode],
  );

  const reset = useCallback(() => {
    speedReadingsRef.current = [];
    stopsRef.current = [];
    lastModeChangeRef.current = 0;
    setDriveMode("city");
    setAvgSpeed(0);
    setStopPercentage(0);
    if (settings) {
      setCurrentKmPerLiter(settings.cityKmPerLiter);
    }
  }, [settings]);

  const distanceKm = distanceMeters / 1000;
  const litersUsed =
    distanceKm > 0 && currentKmPerLiter > 0
      ? distanceKm / currentKmPerLiter
      : 0;
  const litersRemaining = Math.max(0, fuelCapacity - litersUsed);
  const estimatedRange =
    currentKmPerLiter > 0 ? litersRemaining * currentKmPerLiter : 0;
  const estimatedConsumption =
    distanceKm > 0 && litersUsed > 0
      ? distanceKm / litersUsed
      : currentKmPerLiter;

  return {
    driveMode,
    avgSpeed,
    stopPercentage,
    estimatedConsumption,
    estimatedRange,
    currentKmPerLiter,
    addPosition,
    reset,
    isInitialized,
  };
}
