import { useState, useEffect, useCallback, useRef } from "react";
import type { Coordinates } from "@/types";

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
const TARGET_SPEED_KMH = 45;

function calculateDistance(
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

export function useSimulation() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(
    null,
  );
  const [speed, setSpeed] = useState<number>(0);
  const [simulatedPath, setSimulatedPath] = useState<Coordinates[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeIndexRef = useRef(0);
  const progressRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastPositionRef = useRef<Coordinates | null>(null);

  const startSimulation = useCallback(() => {
    if (isSimulating) return;

    routeIndexRef.current = 0;
    progressRef.current = 0;
    startTimeRef.current = Date.now();
    lastPositionRef.current = null;

    const initialPosition: Coordinates = {
      ...SIMULATION_ROUTE[0],
      timestamp: Date.now(),
    };
    setCurrentPosition(initialPosition);
    setSimulatedPath([initialPosition]);
    setSpeed(0);
    setIsSimulating(true);

    intervalRef.current = setInterval(() => {
      const currentIdx = routeIndexRef.current;
      const nextIdx = (currentIdx + 1) % SIMULATION_ROUTE.length;

      const from = SIMULATION_ROUTE[currentIdx];
      const to = SIMULATION_ROUTE[nextIdx];

      const segmentDistance = calculateDistance(
        from.lat,
        from.lng,
        to.lat,
        to.lng,
      );
      const distancePerUpdate =
        (TARGET_SPEED_KMH / 3.6) * (UPDATE_INTERVAL_MS / 1000);
      const progressIncrement = distancePerUpdate / segmentDistance;

      progressRef.current += progressIncrement;

      if (progressRef.current >= 1) {
        progressRef.current = 0;
        routeIndexRef.current = nextIdx;
        if (nextIdx === 0) {
          setSimulatedPath([SIMULATION_ROUTE[0]]);
        }
      }

      const currentProgress = progressRef.current;
      const newLat = from.lat + (to.lat - from.lat) * currentProgress;
      const newLng = from.lng + (to.lng - from.lng) * currentProgress;
      const timestamp = Date.now();

      const newPosition: Coordinates = {
        lat: newLat,
        lng: newLng,
        timestamp,
      };

      let currentSpeed = 0;
      if (lastPositionRef.current) {
        const dist = calculateDistance(
          lastPositionRef.current.lat,
          lastPositionRef.current.lng,
          newLat,
          newLng,
        );
        const timeSeconds = UPDATE_INTERVAL_MS / 1000;
        currentSpeed = dist / timeSeconds;
      }

      lastPositionRef.current = newPosition;
      setCurrentPosition(newPosition);
      setSpeed(currentSpeed);
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setSimulatedPath((prev) => {
        const newPath = [...prev, newPosition];
        if (newPath.length > 500) {
          return newPath.slice(-500);
        }
        return newPath;
      });
    }, UPDATE_INTERVAL_MS);
  }, [isSimulating]);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    setCurrentPosition(null);
    setSpeed(0);
    setSimulatedPath([]);
    setElapsedTime(0);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isSimulating,
    currentPosition,
    speed,
    simulatedPath,
    elapsedTime,
    startSimulation,
    stopSimulation,
  };
}
