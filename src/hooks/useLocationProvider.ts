import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useInclination } from "@/hooks/useInclination";
import type { Coordinates } from "@/types";

// São Paulo fallback — positions near here are treated as "not real GPS"
const DEFAULT_POSITION: Coordinates = {
  lat: -23.5629,
  lng: -46.6544,
  timestamp: 0,
};

const DEFAULT_LAT = -23.5629;
const DEFAULT_LNG = -46.6544;

function isDefaultPosition(pos: Coordinates | null): boolean {
  if (!pos) return true;
  return (
    Math.abs(pos.lat - DEFAULT_LAT) < 0.001 &&
    Math.abs(pos.lng - DEFAULT_LNG) < 0.001
  );
}

// Move north per second tick; longitude stays constant
const DIRECTION_LNG = 0.0;

export function useLocationProvider() {
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);

  const { position: gpsPosition, isWatching } = useGeolocation();
  const inclination = useInclination({ enabled: isWatching });

  // Simulation state — speed starts at 0
  const [simSpeed, setSimSpeed] = useState(0);
  const [simGrade, setSimGrade] = useState(0);
  const [simPosition, setSimPosition] = useState<Coordinates | null>(null);

  // Refs to avoid stale closures inside interval
  const simSpeedRef = useRef(0);
  const simPositionRef = useRef<Coordinates | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  useEffect(() => {
    simPositionRef.current = simPosition;
  }, [simPosition]);

  // When debug mode turns on: start simulation at a sensible origin.
  // We prefer the real GPS position, but if unavailable use DEFAULT_POSITION
  // immediately (no waiting).
  useEffect(() => {
    if (!debugModeEnabled) {
      // Leaving debug mode — clean up
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSimPosition(null);
      setSimSpeed(0);
      simSpeedRef.current = 0;
      return;
    }

    // Debug mode just enabled: seed position
    const seed =
      gpsPosition && !isDefaultPosition(gpsPosition)
        ? gpsPosition
        : DEFAULT_POSITION;
    setSimPosition({ ...seed, timestamp: Date.now() });
    simPositionRef.current = { ...seed, timestamp: Date.now() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugModeEnabled]);

  // If GPS wasn't ready when debug mode was enabled, grab first real fix
  const initialGpsSynced = useRef(false);
  useEffect(() => {
    if (!debugModeEnabled) {
      initialGpsSynced.current = false;
      return;
    }
    // Only update if we haven't got a real position yet and sim is still at default
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
    }
  }, [debugModeEnabled, gpsPosition, simPosition]);

  // Movement interval: runs when debug mode is active
  useEffect(() => {
    if (!debugModeEnabled) return;

    // Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const speed = simSpeedRef.current; // km/h
      if (speed <= 0) return; // Don't move if speed is 0

      const pos = simPositionRef.current;
      if (!pos) return;

      // Distance per tick: speed (km/h) → m/s → 1 s tick
      const speedMs = speed / 3.6; // metres per second
      // Convert metres to degrees: 1° lat ≈ 111 320 m
      const deltaLat = (speedMs * 1) / 111320;

      const newPos: Coordinates = {
        lat: pos.lat + deltaLat,
        lng: pos.lng + DIRECTION_LNG,
        timestamp: Date.now(),
        speed: speed / 3.6, // store as m/s like real GPS
        accuracy: 1,
      };

      simPositionRef.current = newPos;
      setSimPosition(newPos);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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

  // What the rest of the app sees
  const position = debugModeEnabled
    ? (simPosition ?? DEFAULT_POSITION)
    : (gpsPosition ?? DEFAULT_POSITION);

  const speed = debugModeEnabled ? simSpeed : (gpsPosition?.speed ?? 0) * 3.6;

  const grade = debugModeEnabled ? simGrade : inclination.gradePercent;

  return {
    position,
    /** Raw GPS position (may be null/default) */
    gpsPosition: gpsPosition ?? DEFAULT_POSITION,
    speed,
    grade,
    setSpeed,
    setGrade,
    /** Exposes simPosition so Tracker can pass it as map position */
    simPosition,
  };
}
