import { useEffect, useRef, useCallback } from "react";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { TripInfo } from "@/components/tracker/TripInfo";
import { useTripStore } from "@/stores/useTripStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSpeedFilter } from "@/hooks/useSpeedFilter";
import { speedToKmh } from "@/lib/utils";
import { isValidSpeedForDistance, vincentyDistance } from "@/lib/distance";

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastValidPositionRef = useRef<{
    lat: number;
    lng: number;
    timestamp: number;
  } | null>(null);

  const handleStart = useCallback(async () => {
    resetSpeedFilter();
    lastValidPositionRef.current = null;
    startTrip();
    startWatching();
    await requestWakeLock();
  }, [startTrip, startWatching, requestWakeLock, resetSpeedFilter]);

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
      }

      addPosition(position);
      lastValidPositionRef.current = {
        lat: position.lat,
        lng: position.lng,
        timestamp: position.timestamp,
      };
    }
  }, [position, status, addPosition, setCurrentSpeed, addSpeedReading]);

  useEffect(() => {
    if (status === "recording" && !isWatching) {
      startWatching();
    } else if (status === "paused" && isWatching) {
      stopWatching();
    }
  }, [status, isWatching, startWatching, stopWatching]);

  return (
    <div className="h-screen w-screen overflow-hidden pb-20">
      <div className="fixed inset-0 z-0">
        <MapTracker position={position} path={trip?.path || []} />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between pointer-events-none">
        <div className="p-4 pt-12 pointer-events-auto">
          <TripInfo
            distance={stats.distanceMeters}
            elapsedTime={elapsedTime}
            maxSpeed={stats.maxSpeed}
          />
        </div>

        <div className="pointer-events-auto bg-gradient-to-t from-black/90 via-black/70 to-transparent pb-8 pt-12">
          <Speedometer currentSpeed={currentSpeed} maxSpeed={stats.maxSpeed} />
          <div className="mt-4">
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
    </div>
  );
}
