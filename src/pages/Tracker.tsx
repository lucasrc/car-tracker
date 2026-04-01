import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { TripInfo } from "@/components/tracker/TripInfo";
import { FuelBar } from "@/components/tracker/FuelBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTripStore } from "@/stores/useTripStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSpeedFilter } from "@/hooks/useSpeedFilter";
import { useDriveMode } from "@/hooks/useDriveMode";
import { useSimulation } from "@/hooks/useSimulation";
import { useAutoTracker } from "@/hooks/useAutoTracker";
import { useAppStore } from "@/stores/useAppStore";
import { speedToKmh } from "@/lib/utils";
import type { Settings } from "@/types";
import {
  isValidSpeedForDistance,
  vincentyDistance,
  calculateTotalDistance,
} from "@/lib/distance";
import { getSettings, consumeFuel } from "@/lib/db";

const GPS_CONFIG = {
  maxAccuracyMeters: 20,
  minSpeedMs: 0.5,
  minDistanceMeters: 10,
  minTimeDeltaMs: 1000,
  warmupMinAccuracyMeters: 15,
  warmupMinTimeMs: 3000,
  warmupMaxTimeMs: 10000,
} as const;

export function Tracker() {
  const navigate = useNavigate();

  const {
    trip,
    status,
    currentSpeed,
    stats,
    elapsedTime,
    totalFuelUsed: storeTotalFuelUsed,
    startTrip,
    pauseTrip,
    resumeTrip,
    stopTrip,
    addPosition,
    registerStopSample,
    setCurrentSpeed,
    setTotalFuelUsed,
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
  } = useSimulation();
  const {
    isTracking: isAutoTracking,
    points: autoTrackerPoints,
    error: autoTrackerError,
    initialize: initAutoTracker,
    startMonitoring: startAutoMonitoring,
    stop: stopAutoTracker,
    setOnTripComplete,
  } = useAutoTracker();
  const selectedCarBluetoothAddress = useAppStore(
    (s) => s.selectedCarBluetoothAddress,
  );
  const selectedCarBluetoothName = useAppStore(
    (s) => s.selectedCarBluetoothName,
  );
  const autoTrackingEnabled = useAppStore((s) => s.autoTrackingEnabled);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastValidPositionRef = useRef<{
    lat: number;
    lng: number;
    timestamp: number;
  } | null>(null);

  const [settings, setSettings] = useState<Settings>({
    id: "default",
    cityKmPerLiter: 8,
    highwayKmPerLiter: 12,
    mixedKmPerLiter: 10,
    manualCityKmPerLiter: 10,
    manualHighwayKmPerLiter: 14,
    manualMixedKmPerLiter: 12,
    fuelCapacity: 50,
    currentFuel: 50,
    fuelPrice: 5.0,
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGpsWarming, setIsGpsWarming] = useState(false);
  const [warmupStartTime, setWarmupStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (autoTrackingEnabled && selectedCarBluetoothAddress) {
      setOnTripComplete((tripId: string) => {
        if (tripId) {
          navigate(`/history/${tripId}`);
        }
      });
    }
  }, [
    autoTrackingEnabled,
    selectedCarBluetoothAddress,
    selectedCarBluetoothName,
    navigate,
    setOnTripComplete,
  ]);

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

  const {
    estimatedRange,
    addPosition: addDriveModePosition,
    reset: resetDriveMode,
    isInitialized,
    currentKmPerLiter,
    getAverageFactors,
    getEstimatedCosts,
  } = useDriveMode(stats.distanceMeters, settings.currentFuel);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings({
        id: s.id,
        cityKmPerLiter: s.cityKmPerLiter,
        highwayKmPerLiter: s.highwayKmPerLiter,
        mixedKmPerLiter: s.mixedKmPerLiter,
        manualCityKmPerLiter: s.manualCityKmPerLiter,
        manualHighwayKmPerLiter: s.manualHighwayKmPerLiter,
        manualMixedKmPerLiter: s.manualMixedKmPerLiter,
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
    setIsGpsWarming(true);
    setWarmupStartTime(Date.now());
    startWatching();
    await requestWakeLock();
  }, [startWatching, requestWakeLock, resetSpeedFilter, resetDriveMode]);

  const handleActualStart = useCallback(() => {
    startTrip();
    setIsGpsWarming(false);
    setWarmupStartTime(null);
  }, [startTrip]);

  const handleCancelWarmup = useCallback(() => {
    setIsGpsWarming(false);
    setWarmupStartTime(null);
    stopWatching();
  }, [stopWatching]);

  const handlePause = useCallback(() => {
    pauseTrip();
    stopWatching();
  }, [pauseTrip, stopWatching]);

  const handleResume = useCallback(() => {
    resumeTrip();
    startWatching();
  }, [resumeTrip, startWatching]);

  const handleStopRequest = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmStop = useCallback(async () => {
    setShowConfirmDialog(false);
    stopWatching();
    await releaseWakeLock();

    const distanceKm = stats.distanceMeters / 1000;
    const avgFactors = getAverageFactors();
    const costs = getEstimatedCosts(
      distanceKm,
      currentKmPerLiter,
      settings.fuelPrice,
      avgFactors.totalBonusPct,
    );

    const breakdown = {
      speedPenaltyPct: avgFactors.speedPenaltyPct,
      aggressionPenaltyPct: avgFactors.aggressionPenaltyPct,
      idlePenaltyPct: avgFactors.idlePenaltyPct,
      stabilityPenaltyPct: avgFactors.stabilityPenaltyPct,
      totalPenaltyPct:
        avgFactors.speedPenaltyPct +
        avgFactors.aggressionPenaltyPct +
        avgFactors.idlePenaltyPct +
        avgFactors.stabilityPenaltyPct,
      speedBonusPct: avgFactors.speedBonusPct,
      accelerationBonusPct: avgFactors.accelerationBonusPct,
      coastingBonusPct: avgFactors.coastingBonusPct,
      stabilityBonusPct: avgFactors.stabilityBonusPct,
      idleBonusPct: avgFactors.idleBonusPct,
      totalBonusPct: avgFactors.totalBonusPct,
      isEcoDriving: avgFactors.isEcoDriving,
      baseFuelUsed: costs.baseFuelUsed,
      extraFuelUsed: costs.extraFuelUsed,
      savedFuel: costs.savedFuel,
      extraCost: costs.extraCost,
      savedCost: costs.savedCost,
    };

    const tripId = await stopTrip(
      settings.fuelPrice,
      storeTotalFuelUsed,
      breakdown,
    );
    setTotalFuelUsed(0);

    if (tripId) {
      navigate(`/history/${tripId}`);
    }
  }, [
    stopWatching,
    releaseWakeLock,
    stopTrip,
    setTotalFuelUsed,
    settings.fuelPrice,
    storeTotalFuelUsed,
    navigate,
    stats.distanceMeters,
    getAverageFactors,
    getEstimatedCosts,
    currentKmPerLiter,
  ]);

  const handleCancelStop = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

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
    if (!isGpsWarming) {
      return;
    }

    const checkWarmup = () => {
      if (!position || warmupStartTime === null) {
        return;
      }

      const now = Date.now();
      const elapsedTime = now - warmupStartTime;
      const hasGoodAccuracy =
        position.accuracy !== undefined &&
        position.accuracy < GPS_CONFIG.warmupMinAccuracyMeters;
      const hasMinTime = elapsedTime >= GPS_CONFIG.warmupMinTimeMs;
      const hasMaxTime = elapsedTime >= GPS_CONFIG.warmupMaxTimeMs;

      if ((hasGoodAccuracy && hasMinTime) || hasMaxTime) {
        handleActualStart();
      }
    };

    checkWarmup();

    const interval = setInterval(checkWarmup, 1000);
    return () => clearInterval(interval);
  }, [isGpsWarming, position, warmupStartTime, handleActualStart]);

  useEffect(() => {
    if (position && status === "recording") {
      const filteredSpeed =
        position.speed !== undefined
          ? addSpeedReading(position.speed, position.timestamp)
          : 0;
      const speedKmh = speedToKmh(filteredSpeed);
      setCurrentSpeed(speedKmh);
      registerStopSample(position, speedKmh);

      const lastPos = lastValidPositionRef.current;
      const isFirstPoint = !lastPos;

      // Always save the first point, even with poor accuracy/speed
      if (isFirstPoint) {
        addPosition(position);
        addDriveModePosition(position);
        lastValidPositionRef.current = {
          lat: position.lat,
          lng: position.lng,
          timestamp: position.timestamp,
        };
        return;
      }

      // Apply filters for subsequent points
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
          const newTotalFuel = storeTotalFuelUsed + fuelUsed;
          setTotalFuelUsed(newTotalFuel);

          consumeFuel(fuelUsed).then((updated) => {
            setSettings((prev) => ({
              ...prev,
              fuelCapacity: updated.fuelCapacity,
              currentFuel: updated.currentFuel,
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
    registerStopSample,
    setCurrentSpeed,
    setTotalFuelUsed,
    addSpeedReading,
    addDriveModePosition,
    storeTotalFuelUsed,
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

  const effectivePosition = isSimulating
    ? simulatedPosition
    : isAutoTracking
      ? (autoTrackerPoints[autoTrackerPoints.length - 1] ?? null)
      : position;
  const effectivePath = isSimulating
    ? simulatedPath
    : isAutoTracking
      ? autoTrackerPoints
      : trip?.path || [];
  const displaySpeed = isSimulating ? simulatedSpeed * 3.6 : currentSpeed;
  const simulatedDistance = isSimulating
    ? calculateTotalDistance(simulatedPath)
    : 0;
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
        setTotalFuelUsed(storeTotalFuelUsed + fuelUsed);
      }
    }
  }, [
    simulatedPath,
    isSimulating,
    currentKmPerLiter,
    setTotalFuelUsed,
    storeTotalFuelUsed,
  ]);

  const idleWorstCaseRange = settings.currentFuel * settings.cityKmPerLiter;
  const displayedRange =
    status === "idle"
      ? idleWorstCaseRange
      : isInitialized
        ? estimatedRange
        : idleWorstCaseRange;

  return (
    <>
      <FuelBar
        currentFuel={settings.currentFuel}
        fuelCapacity={settings.fuelCapacity}
      />

      <div className="fixed inset-0 z-0">
        <MapTracker position={effectivePosition} path={effectivePath} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(214,228,233,0.5)_0%,rgba(214,228,233,0.14)_38%,rgba(18,38,58,0.22)_100%)]" />

      {autoTrackerError && autoTrackingEnabled && (
        <div className="fixed right-4 top-20 z-50">
          <div className="rounded-lg bg-red-500 px-3 py-2 text-xs text-white shadow-lg">
            {autoTrackerError}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 z-10">
        <div className="pointer-events-auto pt-2">
          <TripInfo
            distance={isSimulating ? simulatedDistance : stats.distanceMeters}
            elapsedTime={isSimulating ? simulatedElapsedTime : elapsedTime}
            fuelUsed={isRecordingOrSimulating ? storeTotalFuelUsed : 0}
            fuelPrice={settings.fuelPrice}
            range={displayedRange}
            currentConsumption={
              isRecordingOrSimulating
                ? currentKmPerLiter
                : settings.cityKmPerLiter
            }
          />
        </div>

        <div className="pointer-events-none fixed bottom-24 left-4">
          <Speedometer currentSpeed={displaySpeed} />
        </div>

        <div className="pointer-events-none fixed bottom-24 right-4">
          <div className="pointer-events-auto">
            <TripControls
              status={status}
              battery={battery}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStopRequest}
              onCancel={handleCancelWarmup}
              isGpsWarming={isGpsWarming}
              gpsAccuracy={position?.accuracy}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirmDialog}
        title="Parar rastreamento"
        message="Tem certeza que deseja parar o rastreamento?"
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmStop}
        onCancel={handleCancelStop}
      />
    </>
  );
}
