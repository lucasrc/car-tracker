import { useEffect, useRef, useCallback } from "react";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { TripInfo } from "@/components/tracker/TripInfo";
import { useTripStore } from "@/stores/useTripStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { speedToKmh } from "@/lib/utils";

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStart = useCallback(async () => {
    startTrip();
    startWatching();
    await requestWakeLock();
  }, [startTrip, startWatching, requestWakeLock]);

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
      if (position.accuracy === undefined || position.accuracy < 30) {
        addPosition(position);
      }

      if (position.speed !== undefined) {
        setCurrentSpeed(speedToKmh(position.speed));
      } else {
        setCurrentSpeed(0);
      }
    }
  }, [position, status, addPosition, setCurrentSpeed]);

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
