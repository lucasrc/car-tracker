import { useEffect, useRef, useCallback, useState } from "react";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { TripInfo } from "@/components/tracker/TripInfo";
import { useTripStore } from "@/stores/useTripStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSpeedFilter } from "@/hooks/useSpeedFilter";
import { useDriveMode } from "@/hooks/useDriveMode";
import { useSimulation } from "@/hooks/useSimulation";
import { speedToKmh } from "@/lib/utils";
import {
  isValidSpeedForDistance,
  vincentyDistance,
  calculateTotalDistance,
} from "@/lib/distance";
import { getSettings, consumeFuel } from "@/lib/db";

const IS_DEV = import.meta.env.DEV;

const GPS_CONFIG = {
  maxAccuracyMeters: 20,
  minSpeedMs: 0.5,
  minDistanceMeters: 10,
  minTimeDeltaMs: 1000,
} as const;

export function Tracker() {
  const {
    trip,
    status,
    currentSpeed,
    stats,
    elapsedTime,
    startTrip,
    pauseTrip,
    resumeTrip,
    stopTrip,
    addPosition,
    setCurrentSpeed,
    tick,
    loadCurrentTrip,
  } = useTripStore();

  const {
    position,
    isWatching,
    startWatching,
    stopWatching,
    battery,
    getCurrentPosition,
  } = useGeolocation();
  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  const { addSpeedReading, reset: resetSpeedFilter } = useSpeedFilter();
  const {
    isSimulating,
    currentPosition: simulatedPosition,
    speed: simulatedSpeed,
    simulatedPath,
    elapsedTime: simulatedElapsedTime,
    startSimulation,
    stopSimulation,
  } = useSimulation();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastValidPositionRef = useRef<{
    lat: number;
    lng: number;
    timestamp: number;
  } | null>(null);

  const [settings, setSettings] = useState({
    fuelCapacity: 50,
    currentFuel: 50,
    fuelPrice: 5.0,
  });
  const [totalFuelUsed, setTotalFuelUsed] = useState(0);

  const {
    estimatedRange,
    addPosition: addDriveModePosition,
    reset: resetDriveMode,
    isInitialized,
    currentKmPerLiter,
  } = useDriveMode(stats.distanceMeters, settings.currentFuel);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings({
        fuelCapacity: s.fuelCapacity,
        currentFuel: s.currentFuel,
        fuelPrice: s.fuelPrice,
      });
    });
  }, []);

  const handleStart = useCallback(async () => {
    resetSpeedFilter();
    resetDriveMode();
    lastValidPositionRef.current = null;
    startTrip();
    startWatching();
    await requestWakeLock();
  }, [
    startTrip,
    startWatching,
    requestWakeLock,
    resetSpeedFilter,
    resetDriveMode,
  ]);

  const handlePause = useCallback(() => {
    pauseTrip();
    stopWatching();
  }, [pauseTrip, stopWatching]);

  const handleResume = useCallback(() => {
    resumeTrip();
    startWatching();
  }, [resumeTrip, startWatching]);

  const handleStop = useCallback(async () => {
    stopWatching();
    await releaseWakeLock();
    await stopTrip();
  }, [stopWatching, releaseWakeLock, stopTrip]);

  useEffect(() => {
    loadCurrentTrip();
    getCurrentPosition();
  }, [loadCurrentTrip, getCurrentPosition]);

  useEffect(() => {
    if (status !== "idle") {
      timerRef.current = setInterval(() => {
        tick();
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, tick]);

  useEffect(() => {
    if (position && status === "recording") {
      const filteredSpeed =
        position.speed !== undefined
          ? addSpeedReading(position.speed, position.timestamp)
          : 0;
      setCurrentSpeed(speedToKmh(filteredSpeed));

      if (
        position.accuracy !== undefined &&
        position.accuracy > GPS_CONFIG.maxAccuracyMeters
      ) {
        return;
      }

      if (
        position.speed !== undefined &&
        position.speed < GPS_CONFIG.minSpeedMs
      ) {
        return;
      }

      const lastPos = lastValidPositionRef.current;
      if (lastPos) {
        const timeDelta = position.timestamp - lastPos.timestamp;
        if (timeDelta < GPS_CONFIG.minTimeDeltaMs) {
          return;
        }

        if (
          !isValidSpeedForDistance(
            {
              lat: lastPos.lat,
              lng: lastPos.lng,
              timestamp: lastPos.timestamp,
            },
            {
              lat: position.lat,
              lng: position.lng,
              timestamp: position.timestamp,
            },
          )
        ) {
          return;
        }

        const distance = vincentyDistance(
          lastPos.lat,
          lastPos.lng,
          position.lat,
          position.lng,
        );
        if (distance < GPS_CONFIG.minDistanceMeters) {
          return;
        }

        const distanceKm = distance / 1000;
        const fuelUsed = distanceKm / currentKmPerLiter;

        if (fuelUsed > 0 && status === "recording") {
          const newTotalFuel = totalFuelUsed + fuelUsed;
          setTotalFuelUsed(newTotalFuel);

          consumeFuel(fuelUsed).then((updated) => {
            setSettings((prev) => ({
              fuelCapacity: updated.fuelCapacity,
              currentFuel: updated.currentFuel,
              fuelPrice: prev.fuelPrice,
            }));
          });
        }
      }

      addPosition(position);
      addDriveModePosition(position);
      lastValidPositionRef.current = {
        lat: position.lat,
        lng: position.lng,
        timestamp: position.timestamp,
      };
    }
  }, [
    position,
    status,
    addPosition,
    setCurrentSpeed,
    addSpeedReading,
    addDriveModePosition,
    totalFuelUsed,
    currentKmPerLiter,
    stats.distanceMeters,
  ]);

  useEffect(() => {
    if (status === "recording" && !isWatching) {
      startWatching();
    } else if (status === "paused" && isWatching) {
      stopWatching();
    }
  }, [status, isWatching, startWatching, stopWatching]);

  const effectivePosition = isSimulating ? simulatedPosition : position;
  const effectivePath = isSimulating ? simulatedPath : trip?.path || [];
  const displaySpeed = isSimulating ? simulatedSpeed * 3.6 : currentSpeed;
  const simulatedDistance = isSimulating
    ? calculateTotalDistance(simulatedPath)
    : 0;
  const simulatedMaxSpeed = isSimulating
    ? Math.max(stats.maxSpeed, displaySpeed)
    : stats.maxSpeed;
  const isRecordingOrSimulating = isSimulating || status === "recording";

  useEffect(() => {
    if (isSimulating && simulatedPath.length >= 2) {
      const lastIdx = simulatedPath.length - 1;
      const prev = simulatedPath[lastIdx - 1];
      const curr = simulatedPath[lastIdx];

      const dist = vincentyDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const distKm = dist / 1000;

      if (distKm > 0.001 && currentKmPerLiter > 0) {
        const fuelUsed = distKm / currentKmPerLiter;
        setTotalFuelUsed((prev) => prev + fuelUsed);
      }
    }
  }, [simulatedPath, isSimulating, currentKmPerLiter]);

  const displayDistance = isSimulating ? simulatedDistance : stats.distanceMeters;
  const displayElapsedTime = isSimulating ? simulatedElapsedTime : elapsedTime;
  const avgSpeed =
    displayElapsedTime > 0
      ? (displayDistance / 1000) / (displayElapsedTime / 3600)
      : 0;

  return (
    <div className="h-dvh w-screen overflow-hidden bg-[#bdd2d9]">
      {/* Map: full screen background */}
      <div className="fixed inset-0 z-0">
        <MapTracker position={effectivePosition} path={effectivePath} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(214,228,233,0.5)_0%,rgba(214,228,233,0.14)_38%,rgba(18,38,58,0.22)_100%)]" />

      {IS_DEV && (
        <div className="fixed right-4 top-16 z-50">
          <button
            onClick={isSimulating ? stopSimulation : startSimulation}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isSimulating
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            {isSimulating ? "Parar Simulação" : "Iniciar Simulação"}
          </button>
        </div>
      )}

      {/* Main column layout */}
      <div className="relative z-10 flex h-dvh flex-col">
        <div className="pointer-events-auto pt-3">
          <TripInfo
            distance={isSimulating ? simulatedDistance : stats.distanceMeters}
            elapsedTime={isSimulating ? simulatedElapsedTime : elapsedTime}
            fuelUsed={isRecordingOrSimulating ? totalFuelUsed : 0}
            fuelPrice={settings.fuelPrice}
            range={isRecordingOrSimulating && isInitialized ? estimatedRange : 250}
          />
        </div>

        <div className="pointer-events-none flex flex-1 items-center justify-center px-3 pb-1 pt-1">
          <Speedometer
            currentSpeed={displaySpeed}
            maxSpeed={simulatedMaxSpeed}
            avgSpeed={avgSpeed}
          />
        </div>

        <div className="pointer-events-auto px-4 pb-20">
          <TripControls
            status={status}
            battery={battery}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
}
