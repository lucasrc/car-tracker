import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { DrivingPanel } from "@/components/tracker/DrivingPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SimulationControls } from "@/components/tracker/SimulationControls";
import { DrivingModePanel } from "@/components/tracker/DrivingModePanel";
import { EngineLoadBar } from "@/components/tracker/EngineLoadBar";
import { LocationButton } from "@/components/tracker/LocationButton";
import { useTripStore } from "@/stores/useTripStore";
import { useRadarStore } from "@/stores/useRadarStore";
import { useLocationProvider } from "@/hooks/useLocationProvider";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSpeedFilter } from "@/hooks/useSpeedFilter";
import { useTelemetryEngine } from "@/hooks/useTelemetryEngine";
import { useFuelInventoryStore } from "@/stores/useFuelInventoryStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useAppStore } from "@/stores/useAppStore";
import type { FuelType } from "@/types";
import { speedToKmh } from "@/lib/utils";
import { isValidSpeedForDistance, vincentyDistance } from "@/lib/distance";
import { calculateDistanceKm } from "@/lib/radar-api";
import L from "leaflet";

const GPS_CONFIG = {
  maxAccuracyMeters: 20,
  minSpeedMs: 0.5,
  minDistanceMeters: 10,
  minTimeDeltaMs: 1000,
  warmupMinAccuracyMeters: 15,
  warmupMaxTimeMs: 30000,
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

  const { request: requestWakeLock, release: releaseWakeLock } = useWakeLock();
  const { addSpeedReading, reset: resetSpeedFilter } = useSpeedFilter();
  const { activeVehicle, updateVehicleFuelLevel } = useVehicleStore();
  const fuelInventoryIsLoaded = useFuelInventoryStore((s) => s.isLoaded);
  const {
    loadBatches,
    consumeFuel,
    getTotalLiters,
    getCumulativeFifoCost,
    emitFuelEvent,
    flushEventsToDb,
  } = useFuelInventoryStore();
  const { nearestRadar, currentSpeedingEvent } = useRadarStore();
  const location = useLocationProvider();
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const debugModeShowRadars = useAppStore((s) => s.debugModeShowRadars);
  const pos = location.position;
  const {
    isWatching,
    startWatching,
    stopWatching,
    getCurrentPosition,
    battery,
    deviceOrientation,
    filteredHeading,
    grade,
    gradeConfidence,
  } = location;

  const accumulatedFuelRef = useRef(0);
  const lastFuelUpdateRef = useRef(0);

  const nearbyRadarMaxSpeed = (() => {
    if (!nearestRadar || !pos) return undefined;
    const dist = calculateDistanceKm(
      pos.lat,
      pos.lng,
      nearestRadar.lat,
      nearestRadar.lng,
    );
    if (dist > 0.15) return undefined;
    return nearestRadar.maxSpeed;
  })();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastValidPositionRef = useRef<{
    lat: number;
    lng: number;
    timestamp: number;
  } | null>(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGpsWarming, setIsGpsWarming] = useState(false);
  const [warmupStartTime, setWarmupStartTime] = useState<number | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [realtimeCost, setRealtimeCost] = useState(0);
  const [localFuelUsed, setLocalFuelUsed] = useState(0);
  const [acOn, setAcOn] = useState(false);

  useEffect(() => {
    if (activeVehicle?.id) {
      // Reset and reload when vehicle changes
      console.log(
        `[FUEL] Vehicle changed to ${activeVehicle.id}, reloading inventory`,
      );
      loadBatches(activeVehicle.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVehicle?.id]);

  const lastGpsDistanceRef = useRef(0);
  useEffect(() => {
    if (pos?.altitude !== undefined) {
      const lastPos = lastValidPositionRef.current;
      let distance = 0;
      if (lastPos) {
        distance = vincentyDistance(lastPos.lat, lastPos.lng, pos.lat, pos.lng);
      }
      lastGpsDistanceRef.current = distance;
    }
  }, [pos?.altitude, pos?.lat, pos?.lng]);

  useEffect(() => {
    if (!activeVehicle || storeTotalFuelUsed <= 0) {
      setRealtimeCost(0);
      return;
    }

    const fifoCost = getCumulativeFifoCost();
    console.log(`[FUEL] realtimeCost: using FIFO cost=${fifoCost.toFixed(2)}`);
    setRealtimeCost(fifoCost);
  }, [storeTotalFuelUsed, activeVehicle, getCumulativeFifoCost]);

  const {
    estimatedConsumption,
    estimatedRange,
    addPosition: addDriveModePosition,
    reset: resetDriveMode,
    isInitialized,
    getInstantConsumption,
    getAverageConsumption,
    getTelemetryData,
    batterySocPct,
    isGnv,
    currentGear,
    currentRpm,
    currentEngineLoad,
    hasTransmissionData,
    drivingStyle,
    driveMode,
  } = useTelemetryEngine(
    stats.distanceMeters,
    activeVehicle?.currentFuel ?? 0,
    location.grade,
    activeVehicle,
    acOn,
  );

  const handleStart = useCallback(async () => {
    try {
      if (!activeVehicle || (activeVehicle.currentFuel ?? 0) <= 0) {
        alert(
          "Sem combustível no tanque. Faça um abastecimento antes de iniciar.",
        );
        return;
      }
      await loadBatches(activeVehicle.id);
      const totalRemaining = getTotalLiters();
      const newFuel = Math.min(totalRemaining, activeVehicle.fuelCapacity);
      await updateVehicleFuelLevel(activeVehicle.id, newFuel);
      console.log(
        `[FUEL] Trip start sync: batches=${totalRemaining.toFixed(2)}L, vehicle.currentFuel=${newFuel.toFixed(2)}L`,
      );
      resetSpeedFilter();
      resetDriveMode();
      lastValidPositionRef.current = null;

      if (debugModeEnabled) {
        // In simulation mode: skip GPS warmup, start immediately
        startTrip();
        await requestWakeLock();
        return;
      }

      setIsGpsWarming(true);
      setWarmupStartTime(Date.now());
      setLocalFuelUsed(0);
      startWatching();
      await requestWakeLock();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      if (
        message.includes("COPERT") ||
        message.includes("calibration") ||
        message.includes("calibrar")
      ) {
        alert(
          "⚠️ Calibração COPERT necessária\n\n" +
            "Antes de iniciar o rastreamento, você deve calibrar os dados do veículo para obter cálculos precisos de consumo.\n\n" +
            "Vá em Configurações → Calibração COPERT e adicione as informações do seu veículo.",
        );
      } else {
        alert(message);
      }
    }
  }, [
    activeVehicle,
    debugModeEnabled,
    startTrip,
    startWatching,
    requestWakeLock,
    resetSpeedFilter,
    resetDriveMode,
    loadBatches,
    getTotalLiters,
    updateVehicleFuelLevel,
    setLocalFuelUsed,
  ]);

  const handleActualStart = useCallback(() => {
    setIsGpsWarming(false);
    startTrip();
  }, [startTrip]);

  const handlePause = useCallback(() => {
    pauseTrip();
    stopWatching();
  }, [pauseTrip, stopWatching]);

  const handleResume = useCallback(() => {
    resumeTrip();
    startWatching();
    requestWakeLock();
  }, [resumeTrip, startWatching, requestWakeLock]);

  const handleStopRequest = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleCancelWarmup = useCallback(() => {
    setIsGpsWarming(false);
    stopWatching();
    releaseWakeLock();
  }, [stopWatching, releaseWakeLock]);

  const consumeFuelFromVehicle = useCallback(
    async (
      fuelLiters: number,
      currentFuelLevel: number,
      isTripEnding = false,
    ) => {
      if (!activeVehicle) return;

      const newAccumulated = accumulatedFuelRef.current + fuelLiters;
      accumulatedFuelRef.current = newAccumulated;

      if (isTripEnding && newAccumulated <= 0) {
        return;
      }

      const now = Date.now();
      const timeSinceLastUpdate = now - lastFuelUpdateRef.current;
      const MIN_UPDATE_INTERVAL_MS = 5000;
      const MIN_FUEL_TO_CONSUME = 0.05;

      if (
        !isTripEnding &&
        timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS &&
        newAccumulated < MIN_FUEL_TO_CONSUME
      ) {
        return;
      }

      if (!fuelInventoryIsLoaded) {
        console.log("[FUEL] Waiting for inventory to load...");
        await loadBatches(activeVehicle.id);
      }

      const fuelToConsume = accumulatedFuelRef.current;
      accumulatedFuelRef.current = 0;
      lastFuelUpdateRef.current = now;

      const tankLevelBefore = currentFuelLevel;
      const tankLevelAfter = Math.max(0, currentFuelLevel - fuelToConsume);

      console.log(
        `[FUEL] Consuming ${fuelToConsume.toFixed(3)}L from vehicle ${activeVehicle.id} (current: ${currentFuelLevel.toFixed(2)}L)`,
      );

      // DEBUG: Log batch state before consumption
      const batchesBefore = useFuelInventoryStore.getState().batches;
      console.log(
        `[FUEL] Batches before: ${batchesBefore.length}, total remaining: ${getTotalLiters().toFixed(2)}L`,
      );

      const fuelTypeFilter: FuelType | undefined =
        activeVehicle.fuelType === "flex"
          ? undefined
          : activeVehicle.fuelType === "diesel"
            ? "diesel"
            : activeVehicle.fuelType;

      const position = lastValidPositionRef.current || { lat: 0, lng: 0 };

      try {
        console.log(
          `[FUEL] Calling consumeFuel with ${fuelToConsume}L, filter=${fuelTypeFilter ?? "all"}, vehicleId=${activeVehicle.id}`,
        );
        const result = await consumeFuel(
          fuelToConsume,
          fuelTypeFilter,
          activeVehicle.id,
        );
        console.log(
          `[FUEL] Batch consumption result: cost=${result.cost.toFixed(2)}, batches=${result.batches.length}`,
        );

        // DEBUG: Log batch state after consumption
        const batchesAfter = useFuelInventoryStore.getState().batches;
        console.log(`[FUEL] Batches after: ${batchesAfter.length}`);
        batchesAfter.forEach((b, i) => {
          console.log(
            `[FUEL]   Batch ${i}: amount=${b.amount}, consumed=${b.consumedAmount}, remaining=${b.amount - b.consumedAmount}`,
          );
        });

        const totalRemaining = getTotalLiters();
        const newFuelLevel = Math.min(
          Math.max(0, totalRemaining),
          activeVehicle.fuelCapacity,
        );
        console.log(
          `[FUEL] Calling updateVehicleFuelLevel with ${newFuelLevel.toFixed(2)}L`,
        );
        await updateVehicleFuelLevel(activeVehicle.id, newFuelLevel);
        console.log(
          `[FUEL] Consumption sync: batches=${totalRemaining.toFixed(2)}L, vehicle.currentFuel=${newFuelLevel.toFixed(2)}L`,
        );

        // DEBUG: Log activeVehicle after update
        console.log(
          `[FUEL] activeVehicle.currentFuel after sync: ${activeVehicle.currentFuel?.toFixed(2) ?? "null"}L`,
        );

        const cumulativeFuelUsed = storeTotalFuelUsed + fuelToConsume;
        emitFuelEvent(
          trip?.id || "",
          fuelToConsume,
          cumulativeFuelUsed,
          tankLevelBefore,
          tankLevelAfter,
          position,
          currentSpeed,
          driveMode,
          location.grade || 0,
          getInstantConsumption(),
          getAverageConsumption(),
          debugModeEnabled ? "simulation" : "gps",
        );
      } catch (err) {
        console.warn("[FUEL] Failed to consume from batch:", err);
      }

      console.log(
        `[FUEL] Vehicle fuel updated: ${currentFuelLevel.toFixed(2)}L -> ${tankLevelAfter.toFixed(2)}L`,
      );
    },
    [
      activeVehicle,
      updateVehicleFuelLevel,
      trip,
      currentSpeed,
      driveMode,
      location.grade,
      getInstantConsumption,
      getAverageConsumption,
      debugModeEnabled,
      storeTotalFuelUsed,
      consumeFuel,
      emitFuelEvent,
      fuelInventoryIsLoaded,
      loadBatches,
      getTotalLiters,
    ],
  );

  const handleConfirmStop = useCallback(async () => {
    setShowConfirmDialog(false);
    stopWatching();
    releaseWakeLock();

    if (accumulatedFuelRef.current > 0) {
      console.log(
        `[FUEL] Trip ending - consuming remaining ${accumulatedFuelRef.current.toFixed(3)}L`,
      );
      await consumeFuelFromVehicle(0, activeVehicle?.currentFuel ?? 0, true);
    }

    await flushEventsToDb();
    const { clearWal } = useFuelInventoryStore.getState();
    clearWal();

    const telemetryData = getTelemetryData();
    const tripFuelUsed = localFuelUsed;
    const tripId = await stopTrip(
      tripFuelUsed,
      realtimeCost,
      undefined,
      undefined,
      telemetryData,
    );
    setLocalFuelUsed(0);
    if (tripId) {
      navigate(`/history/${tripId}`);
    }
  }, [
    activeVehicle,
    stopWatching,
    releaseWakeLock,
    stopTrip,
    localFuelUsed,
    realtimeCost,
    getTelemetryData,
    navigate,
    consumeFuelFromVehicle,
    flushEventsToDb,
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [tick]);

  useEffect(() => {
    if (!isGpsWarming) {
      return;
    }

    const checkWarmup = () => {
      if (!pos || warmupStartTime === null) {
        return;
      }

      const now = Date.now();
      const elapsedTime = now - warmupStartTime;
      const hasGoodAccuracy =
        pos.accuracy !== undefined &&
        pos.accuracy < GPS_CONFIG.warmupMinAccuracyMeters;
      const hasMaxTime = elapsedTime >= GPS_CONFIG.warmupMaxTimeMs;

      if (hasGoodAccuracy || hasMaxTime) {
        handleActualStart();
      }
    };

    checkWarmup();

    const interval = setInterval(checkWarmup, 1000);
    return () => clearInterval(interval);
  }, [isGpsWarming, pos, warmupStartTime, handleActualStart]);

  // ---------- Debug/Simulation: process simulated positions ----------
  useEffect(() => {
    if (!debugModeEnabled || status !== "recording") return;
    const simPos = location.position;
    if (!simPos) return;

    const speedKmh = location.speed;
    setCurrentSpeed(speedKmh);
    registerStopSample(simPos, speedKmh);

    const lastPos = lastValidPositionRef.current;

    if (!lastPos) {
      // First point
      addPosition(simPos);
      addDriveModePosition(simPos);
      console.log("[SIM] First point - grade:", location.grade);
      lastValidPositionRef.current = {
        lat: simPos.lat,
        lng: simPos.lng,
        timestamp: simPos.timestamp,
      };
      return;
    }

    // Only process if position actually changed (speed > 0)
    if (speedKmh <= 0) return;

    const timeDelta = simPos.timestamp - lastPos.timestamp;
    if (timeDelta < GPS_CONFIG.minTimeDeltaMs) return;

    const distance = vincentyDistance(
      lastPos.lat,
      lastPos.lng,
      simPos.lat,
      simPos.lng,
    );
    if (distance < GPS_CONFIG.minDistanceMeters) return;

    const distanceKm = distance / 1000;
    console.log(
      `[FUEL-SIM] distanceKm=${distanceKm.toFixed(3)}, estimatedConsumption=${estimatedConsumption.toFixed(2)}`,
    );
    if (estimatedConsumption > 0) {
      const fuelUsed = distanceKm / estimatedConsumption;
      console.log(`[FUEL-SIM] fuelUsed=${fuelUsed.toFixed(4)}`);
      if (fuelUsed > 0) {
        setTotalFuelUsed(storeTotalFuelUsed + fuelUsed);
        setLocalFuelUsed((prev) => prev + fuelUsed);
        console.log(
          `[FUEL-SIM] Calling consumeFuelFromVehicle with ${fuelUsed.toFixed(4)}L`,
        );
        consumeFuelFromVehicle(fuelUsed, activeVehicle?.currentFuel ?? 0);
      } else {
        console.log(
          `[FUEL-SIM] Skipping consumeFuelFromVehicle - fuelUsed <= 0`,
        );
      }
    } else {
      console.log(`[FUEL-SIM] Skipping - estimatedConsumption <= 0`);
    }

    console.log("[SIM] Calling addDriveModePosition - grade:", location.grade);
    addPosition(simPos);
    addDriveModePosition(simPos);
    lastValidPositionRef.current = {
      lat: simPos.lat,
      lng: simPos.lng,
      timestamp: simPos.timestamp,
    };
  }, [
    debugModeEnabled,
    location.position,
    location.speed,
    location.grade,
    status,
    addPosition,
    addDriveModePosition,
    registerStopSample,
    setCurrentSpeed,
    setTotalFuelUsed,
    setLocalFuelUsed,
    storeTotalFuelUsed,
    consumeFuelFromVehicle,
    activeVehicle,
    estimatedConsumption,
  ]);

  // ---------- Real GPS: process positions ----------
  useEffect(() => {
    if (debugModeEnabled) return; // handled above
    if (pos && status === "recording") {
      const filteredSpeed =
        pos.speed !== undefined ? addSpeedReading(pos.speed, pos.timestamp) : 0;
      const speedKmh = speedToKmh(filteredSpeed);
      setCurrentSpeed(speedKmh);
      registerStopSample(pos, speedKmh);

      const lastPos = lastValidPositionRef.current;
      const isFirstPoint = !lastPos;

      // Always save the first point, even with poor accuracy/speed
      if (isFirstPoint) {
        addPosition(pos);
        addDriveModePosition(pos);
        lastValidPositionRef.current = {
          lat: pos.lat,
          lng: pos.lng,
          timestamp: pos.timestamp,
        };
        return;
      }

      // Apply filters for subsequent points
      if (
        pos.accuracy !== undefined &&
        pos.accuracy > GPS_CONFIG.maxAccuracyMeters
      ) {
        return;
      }

      if (pos.speed !== undefined && pos.speed < GPS_CONFIG.minSpeedMs) {
        return;
      }

      if (lastPos) {
        const timeDelta = pos.timestamp - lastPos.timestamp;
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
              lat: pos.lat,
              lng: pos.lng,
              timestamp: pos.timestamp,
            },
          )
        ) {
          return;
        }

        const distance = vincentyDistance(
          lastPos.lat,
          lastPos.lng,
          pos.lat,
          pos.lng,
        );
        if (distance < GPS_CONFIG.minDistanceMeters) {
          return;
        }

        const distanceKm = distance / 1000;
        if (estimatedConsumption <= 0) {
          console.warn(
            "Tracker: estimatedConsumption <= 0, skipping fuel calculation",
          );
          return;
        }
        const fuelUsed = distanceKm / estimatedConsumption;

        if (fuelUsed > 0 && status === "recording") {
          const newTotalFuel = storeTotalFuelUsed + fuelUsed;
          setTotalFuelUsed(newTotalFuel);
          setLocalFuelUsed((prev) => prev + fuelUsed);
          consumeFuelFromVehicle(fuelUsed, activeVehicle?.currentFuel ?? 0);
        }
      }

      addPosition(pos);
      addDriveModePosition(pos);
      lastValidPositionRef.current = {
        lat: pos.lat,
        lng: pos.lng,
        timestamp: pos.timestamp,
      };
    }
  }, [
    debugModeEnabled,
    pos,
    status,
    addPosition,
    registerStopSample,
    setCurrentSpeed,
    setTotalFuelUsed,
    setLocalFuelUsed,
    addSpeedReading,
    addDriveModePosition,
    storeTotalFuelUsed,
    estimatedConsumption,
    stats.distanceMeters,
    consumeFuelFromVehicle,
    activeVehicle,
  ]);

  // Auto-start GPS watching only in non-debug mode
  useEffect(() => {
    console.log("[TRACKER] GPS auto-start effect:", {
      debugModeEnabled,
      status,
      isWatching,
    });
    if (debugModeEnabled) return; // simulation handles its own position
    if (status === "recording" && !isWatching) {
      console.log("[TRACKER] Calling startWatching for recording");
      startWatching();
    } else if (status === "idle" && !isWatching) {
      console.log("[TRACKER] Calling startWatching for idle");
      startWatching();
    } else if (status === "paused" && isWatching) {
      stopWatching();
    }
  }, [debugModeEnabled, status, isWatching, startWatching, stopWatching]);

  // Determine effective position/path/speed for the UI
  // All position/speed/grade come from useLocationProvider (single source)
  const effectivePosition = location.position;
  const effectivePath = trip?.path || [];
  const displaySpeed = location.speed;
  const isRecordingOrSimulating = debugModeEnabled || status === "recording";

  const displayedFuel = activeVehicle?.currentFuel ?? 0;

  const idleWorstCaseRange = displayedFuel * (activeVehicle?.urbanKmpl ?? 10);

  const currentConsumption = isRecordingOrSimulating
    ? estimatedConsumption
    : (activeVehicle?.urbanKmpl ?? 10);

  const displayedRange =
    status === "idle" || !isInitialized
      ? idleWorstCaseRange
      : estimatedRange > 0
        ? estimatedRange
        : displayedFuel * currentConsumption;

  return (
    <>
      <div className="fixed inset-0 z-0">
        <MapTracker
          position={effectivePosition}
          path={effectivePath}
          showRadars={
            debugModeEnabled ? debugModeShowRadars : !!effectivePosition
          }
          currentSpeed={displaySpeed}
          onMapReady={setMapInstance}
          isSpeeding={!!currentSpeedingEvent}
          deviceOrientation={deviceOrientation}
          filteredHeading={filteredHeading}
          isSimulation={debugModeEnabled}
          fixState={location.fixState}
          gpsPermissionDenied={location.gpsPermissionDenied}
        />
      </div>

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(214,228,233,0.5)_0%,rgba(214,228,233,0.14)_38%,rgba(18,38,58,0.22)_100%)]" />

      <div className="pointer-events-none fixed inset-0 z-10">
        <div className="pointer-events-auto pt-0">
          <DrivingPanel
            currentSpeed={displaySpeed}
            distance={stats.distanceMeters}
            elapsedTime={debugModeEnabled ? location.elapsedTime : elapsedTime}
            fuelUsed={isRecordingOrSimulating ? localFuelUsed : 0}
            cost={realtimeCost}
            currentFuelLiters={displayedFuel}
            range={displayedRange}
            currentConsumption={
              isRecordingOrSimulating ? getInstantConsumption() : 0
            }
            avgConsumption={
              isRecordingOrSimulating ? getAverageConsumption() : 0
            }
            radarMaxSpeed={nearbyRadarMaxSpeed}
            isSpeeding={!!currentSpeedingEvent}
            gradePercent={grade}
            inclinationConfidence={gradeConfidence}
            batterySocPct={activeVehicle?.isHybrid ? batterySocPct : undefined}
            isHybrid={activeVehicle?.isHybrid ?? false}
            isGnv={isGnv}
          />
        </div>

        {status !== "idle" && (
          <div className="pointer-events-auto absolute bottom-44 left-4 z-30">
            <DrivingModePanel
              drivingStyle={drivingStyle ?? "eco"}
              acOn={acOn}
              onAcChange={setAcOn}
            />
          </div>
        )}

        <EngineLoadBar engineLoad={currentEngineLoad} />

        <div
          className={`pointer-events-none fixed left-4 right-4 z-40 transition-all duration-300 ${
            status === "idle" ? "bottom-24" : "bottom-6"
          }`}
        >
          <div className="flex items-end justify-between pointer-events-none">
            <div className="flex flex-col items-start">
              <Speedometer
                currentSpeed={displaySpeed}
                maxSpeed={nearbyRadarMaxSpeed}
                isSpeeding={!!currentSpeedingEvent}
                currentGear={currentGear}
                currentRpm={currentRpm}
                hasTransmissionData={hasTransmissionData}
              />
            </div>

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
                gpsAccuracy={pos?.accuracy}
                warmupStartTime={warmupStartTime}
              />
            </div>
          </div>
        </div>

        <LocationButton
          onClick={() => {
            getCurrentPosition();
            if (mapInstance && pos) {
              mapInstance.setView([pos.lat, pos.lng], mapInstance.getZoom(), {
                animate: true,
                duration: 0.5,
              });
            }
          }}
          className={`fixed right-4 z-10 ${status === "idle" ? "bottom-52" : "bottom-48"}`}
        />
      </div>

      {debugModeEnabled && status === "recording" && (
        <SimulationControls
          isActive={status === "recording"}
          speed={location.speed}
          grade={location.grade}
          onSpeedChange={location.setSpeed}
          onGradeChange={location.setGrade}
        />
      )}

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
