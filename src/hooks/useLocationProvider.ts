import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useInclination } from "@/hooks/useInclination";
import { useAutoTracker } from "@/hooks/useAutoTracker";
import { DEFAULT_POSITION } from "@/lib/constants";
import type { Coordinates, BatteryState } from "@/types";

export type FixState = "no-fix" | "fix-acquired" | "fix-stale" | "simulating";

const DEFAULT_LAT = DEFAULT_POSITION.lat;
const DEFAULT_LNG = DEFAULT_POSITION.lng;
const GPS_STALE_TIMEOUT_MS = 10_000;

function isDefaultPosition(pos: Coordinates | null): boolean {
  if (!pos) return true;
  return (
    Math.abs(pos.lat - DEFAULT_LAT) < 0.001 &&
    Math.abs(pos.lng - DEFAULT_LNG) < 0.001
  );
}

const SIMULATION_ROUTE: Coordinates[] = [
  { lat: -23.5871, lng: -46.682, timestamp: 0 },
  { lat: -23.5863, lng: -46.6806, timestamp: 0 },
  { lat: -23.5854, lng: -46.6791, timestamp: 0 },
  { lat: -23.5846, lng: -46.6777, timestamp: 0 },
  { lat: -23.5837, lng: -46.6762, timestamp: 0 },
  { lat: -23.5829, lng: -46.6748, timestamp: 0 },
  { lat: -23.582, lng: -46.6733, timestamp: 0 },
  { lat: -23.5812, lng: -46.6719, timestamp: 0 },
  { lat: -23.5803, lng: -46.6704, timestamp: 0 },
  { lat: -23.5795, lng: -46.669, timestamp: 0 },
  { lat: -23.5786, lng: -46.6675, timestamp: 0 },
  { lat: -23.5778, lng: -46.6661, timestamp: 0 },
  { lat: -23.5769, lng: -46.6646, timestamp: 0 },
  { lat: -23.5761, lng: -46.6632, timestamp: 0 },
  { lat: -23.5752, lng: -46.6617, timestamp: 0 },
  { lat: -23.5743, lng: -46.6602, timestamp: 0 },
  { lat: -23.5735, lng: -46.6588, timestamp: 0 },
  { lat: -23.5726, lng: -46.6573, timestamp: 0 },
  { lat: -23.5718, lng: -46.6559, timestamp: 0 },
  { lat: -23.5709, lng: -46.6544, timestamp: 0 },
  { lat: -23.5701, lng: -46.653, timestamp: 0 },
  { lat: -23.5692, lng: -46.6515, timestamp: 0 },
  { lat: -23.5683, lng: -46.65, timestamp: 0 },
  { lat: -23.5675, lng: -46.6486, timestamp: 0 },
  { lat: -23.5666, lng: -46.6471, timestamp: 0 },
  { lat: -23.5658, lng: -46.6457, timestamp: 0 },
  { lat: -23.5649, lng: -46.6442, timestamp: 0 },
  { lat: -23.5641, lng: -46.6428, timestamp: 0 },
  { lat: -23.5632, lng: -46.6413, timestamp: 0 },
  { lat: -23.5623, lng: -46.6398, timestamp: 0 },
];

const UPDATE_INTERVAL_MS = 500;

function calculateSegmentDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface UseLocationProviderReturn {
  position: Coordinates | null;
  fixState: FixState;
  gpsPosition: Coordinates | null;
  speed: number;
  grade: number;
  elapsedTime: number;
  setSpeed: (speed: number) => void;
  setGrade: (grade: number) => void;
  gpsPermissionDenied: boolean;
  isWatching: boolean;
  startWatching: (options?: {
    enableHighAccuracy?: boolean;
    maximumAge?: number;
    timeout?: number;
  }) => void;
  stopWatching: () => void;
  getCurrentPosition: (options?: {
    enableHighAccuracy?: boolean;
    maximumAge?: number;
    timeout?: number;
  }) => Promise<Coordinates | null>;
  battery: BatteryState | null;
  deviceOrientation: number | null;
  filteredHeading: number | null;
  filteredPitch: number | null;
}

export function useLocationProvider(): UseLocationProviderReturn {
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const autoTrackingEnabled = useAppStore((s) => s.autoTrackingEnabled);
  const selectedCarBluetoothAddress = useAppStore(
    (s) => s.selectedCarBluetoothAddress,
  );
  const selectedCarBluetoothName = useAppStore(
    (s) => s.selectedCarBluetoothName,
  );

  const {
    position: gpsPosition,
    isWatching,
    error: gpsError,
    battery,
    deviceOrientation,
    filteredHeading,
    filteredPitch,
    startWatching,
    stopWatching,
    getCurrentPosition,
  } = useGeolocation();
  const inclination = useInclination({ enabled: isWatching });

  const {
    isTracking: isAutoTracking,
    points: autoTrackerPoints,
    initialize: initAutoTracker,
    startMonitoring: startAutoMonitoring,
    stop: stopAutoTracker,
  } = useAutoTracker();

  const [simSpeed, setSimSpeed] = useState(0);
  const [simGrade, setSimGrade] = useState(0);
  const [simPosition, setSimPosition] = useState<Coordinates | null>(null);
  const [simElapsedTime, setSimElapsedTime] = useState(0);

  const simSpeedRef = useRef(0);
  const simPositionRef = useRef<Coordinates | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeIndexRef = useRef(0);
  const progressRef = useRef(0);
  const simStartTimeRef = useRef(0);
  const lastSimPositionRef = useRef<Coordinates | null>(null);

  const lastGpsPositionRef = useRef<Coordinates | null>(null);
  const lastGpsTimeRef = useRef<number>(0);

  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  useEffect(() => {
    simPositionRef.current = simPosition;
  }, [simPosition]);

  // Bluetooth auto-tracker initialization
  useEffect(() => {
    if (autoTrackingEnabled && !isAutoTracking && selectedCarBluetoothAddress) {
      initAutoTracker(selectedCarBluetoothAddress)
        .then(() =>
          startAutoMonitoring(
            selectedCarBluetoothAddress,
            selectedCarBluetoothName ?? undefined,
          ),
        )
        .catch(() => {});
    }
    if (!autoTrackingEnabled && isAutoTracking) {
      stopAutoTracker();
    }
  }, [
    autoTrackingEnabled,
    initAutoTracker,
    startAutoMonitoring,
    stopAutoTracker,
    isAutoTracking,
    selectedCarBluetoothAddress,
    selectedCarBluetoothName,
  ]);

  // Track last real GPS position and timestamp for staleness detection
  useEffect(() => {
    if (gpsPosition && !isDefaultPosition(gpsPosition)) {
      lastGpsPositionRef.current = gpsPosition;
      lastGpsTimeRef.current = Date.now();
    }
  }, [gpsPosition]);

  // When debug mode turns on: start simulation
  useEffect(() => {
    if (!debugModeEnabled) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setSimPosition(null);
      setSimSpeed(0);
      setSimElapsedTime(0);
      simSpeedRef.current = 0;
      routeIndexRef.current = 0;
      progressRef.current = 0;
      lastSimPositionRef.current = null;
      return;
    }

    routeIndexRef.current = 0;
    progressRef.current = 0;
    simStartTimeRef.current = Date.now();
    lastSimPositionRef.current = null;

    const seed =
      gpsPosition && !isDefaultPosition(gpsPosition)
        ? gpsPosition
        : { ...SIMULATION_ROUTE[0], timestamp: Date.now() };

    const initialPosition: Coordinates = {
      lat: seed.lat,
      lng: seed.lng,
      timestamp: Date.now(),
      speed: 0,
      accuracy: 1,
    };
    setSimPosition(initialPosition);
    simPositionRef.current = initialPosition;
    lastSimPositionRef.current = initialPosition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugModeEnabled]);

  // Sync from real GPS if it arrives after simulation starts
  const initialGpsSynced = useRef(false);
  useEffect(() => {
    if (!debugModeEnabled) {
      initialGpsSynced.current = false;
      return;
    }
    if (
      !initialGpsSynced.current &&
      gpsPosition &&
      !isDefaultPosition(gpsPosition) &&
      simPosition &&
      isDefaultPosition(simPosition)
    ) {
      initialGpsSynced.current = true;
      const updated = { ...gpsPosition, timestamp: Date.now() };
      setSimPosition(updated);
      simPositionRef.current = updated;
      lastSimPositionRef.current = updated;
    }
  }, [debugModeEnabled, gpsPosition, simPosition]);

  // Waypoint-based simulation interval
  useEffect(() => {
    if (!debugModeEnabled) return;

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }

    simIntervalRef.current = setInterval(() => {
      const speed = simSpeedRef.current;
      if (speed <= 0) {
        setSimElapsedTime(
          Math.floor((Date.now() - simStartTimeRef.current) / 1000),
        );
        return;
      }

      const currentIdx = routeIndexRef.current;
      const nextIdx = (currentIdx + 1) % SIMULATION_ROUTE.length;

      const from = SIMULATION_ROUTE[currentIdx];
      const to = SIMULATION_ROUTE[nextIdx];

      const segmentDistance = calculateSegmentDistance(
        from.lat,
        from.lng,
        to.lat,
        to.lng,
      );
      const distancePerUpdate = (speed / 3.6) * (UPDATE_INTERVAL_MS / 1000);
      const progressIncrement =
        segmentDistance > 0 ? distancePerUpdate / segmentDistance : 0;

      progressRef.current += progressIncrement;

      if (progressRef.current >= 1) {
        progressRef.current = 0;
        routeIndexRef.current = nextIdx;
      }

      const currentProgress = progressRef.current;
      const fromIdx = routeIndexRef.current;
      const toIdx = (fromIdx + 1) % SIMULATION_ROUTE.length;
      const fromPt = SIMULATION_ROUTE[fromIdx];
      const toPt = SIMULATION_ROUTE[toIdx];

      const newLat = fromPt.lat + (toPt.lat - fromPt.lat) * currentProgress;
      const newLng = fromPt.lng + (toPt.lng - fromPt.lng) * currentProgress;

      let currentSpeedMs = 0;
      const lastPos = lastSimPositionRef.current;
      if (lastPos) {
        const dist = calculateSegmentDistance(
          lastPos.lat,
          lastPos.lng,
          newLat,
          newLng,
        );
        currentSpeedMs = dist / (UPDATE_INTERVAL_MS / 1000);
      }

      const newPosition: Coordinates = {
        lat: newLat,
        lng: newLng,
        timestamp: Date.now(),
        speed: currentSpeedMs,
        accuracy: 1,
      };

      lastSimPositionRef.current = newPosition;
      simPositionRef.current = newPosition;
      setSimPosition(newPosition);
      setSimElapsedTime(
        Math.floor((Date.now() - simStartTimeRef.current) / 1000),
      );
    }, UPDATE_INTERVAL_MS);

    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [debugModeEnabled]);

  const setSpeed = useCallback((speed: number) => {
    setSimSpeed(speed);
    simSpeedRef.current = speed;
  }, []);

  const setGrade = useCallback((grade: number) => {
    setSimGrade(grade);
  }, []);

  // Compute fixState
  const gpsPermissionDenied =
    gpsError !== null &&
    "code" in gpsError &&
    (gpsError as GeolocationPositionError).code === 1;

  const autoTrackerLatest =
    autoTrackingEnabled && isAutoTracking && autoTrackerPoints.length > 0
      ? (autoTrackerPoints[autoTrackerPoints.length - 1] ?? null)
      : null;

  const realGpsValid =
    gpsPosition && !isDefaultPosition(gpsPosition) ? gpsPosition : null;

  const fixState: FixState = debugModeEnabled
    ? "simulating"
    : autoTrackerLatest
      ? "fix-acquired"
      : realGpsValid
        ? "fix-acquired"
        : lastGpsPositionRef.current &&
            Date.now() - lastGpsTimeRef.current < GPS_STALE_TIMEOUT_MS
          ? "fix-acquired"
          : lastGpsPositionRef.current
            ? "fix-stale"
            : "no-fix";

  // Unified position
  const position: Coordinates | null = debugModeEnabled
    ? simPosition
    : (autoTrackerLatest ?? realGpsValid ?? lastGpsPositionRef.current ?? null);

  // Unified speed (km/h)
  const speed = debugModeEnabled ? simSpeed : (realGpsValid?.speed ?? 0) * 3.6;

  const grade = debugModeEnabled ? simGrade : inclination.gradePercent;

  return {
    position,
    fixState,
    gpsPosition: realGpsValid,
    speed,
    grade,
    elapsedTime: debugModeEnabled ? simElapsedTime : 0,
    setSpeed,
    setGrade,
    gpsPermissionDenied,
    isWatching,
    startWatching,
    stopWatching,
    getCurrentPosition,
    battery,
    deviceOrientation,
    filteredHeading,
    filteredPitch,
  };
}
