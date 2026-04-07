import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { DrivingPanel } from "@/components/tracker/DrivingPanel";
import { FuelBar } from "@/components/tracker/FuelBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SimulationControls } from "@/components/tracker/SimulationControls";
import { DrivingModePanel } from "@/components/tracker/DrivingModePanel";
import { EngineLoadBar } from "@/components/tracker/EngineLoadBar";
import { useTripStore } from "@/stores/useTripStore";
import { useRadarStore } from "@/stores/useRadarStore";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLocationProvider } from "@/hooks/useLocationProvider";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useSpeedFilter } from "@/hooks/useSpeedFilter";
import { useTelemetryEngine } from "@/hooks/useTelemetryEngine";
import { useInclination } from "@/hooks/useInclination";
import { useSimulation } from "@/hooks/useSimulation";
import { useAutoTracker } from "@/hooks/useAutoTracker";
import { useFuelInventory } from "@/hooks/useFuelInventory";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useAppStore } from "@/stores/useAppStore";
import { isAndroid } from "@/lib/platform";
import { speedToKmh } from "@/lib/utils";
import {
  isValidSpeedForDistance,
  vincentyDistance,
  calculateTotalDistance,
} from "@/lib/distance";
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

  const {
    isWatching,
    startWatching,
    stopWatching,
    battery,
    getCurrentPosition,
    deviceOrientation,
    filteredHeading,
    filteredPitch,
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
    initialize: initAutoTracker,
    startMonitoring: startAutoMonitoring,
    stop: stopAutoTracker,
    setOnTripComplete,
  } = useAutoTracker();
  const { activeVehicle, updateVehicleFuelLevel } = useVehicleStore();
  const fuelInventory = useFuelInventory(activeVehicle?.id || "");
  const { nearestRadar, currentSpeedingEvent } = useRadarStore();
  const inclination = useInclination({ enabled: status === "recording" });
  const location = useLocationProvider();
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const debugModeShowRadars = useAppStore((s) => s.debugModeShowRadars);
  const pos = location.position;

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

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGpsWarming, setIsGpsWarming] = useState(false);
  const [warmupStartTime, setWarmupStartTime] = useState<number | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [realtimeCost, setRealtimeCost] = useState(0);
  const [localFuelUsed, setLocalFuelUsed] = useState(0);
  const [acOn, setAcOn] = useState(false);

  useEffect(() => {
    if (activeVehicle?.id) {
      fuelInventory.loadInventory();
    }
  }, [activeVehicle?.id, fuelInventory]);

  useEffect(() => {
    if (filteredPitch !== null) {
      inclination.addPitchReading(filteredPitch, Date.now());
    }
  }, [filteredPitch, inclination]);

  const lastGpsDistanceRef = useRef(0);
  useEffect(() => {
    if (pos?.altitude !== undefined) {
      const lastPos = lastValidPositionRef.current;
      let distance = 0;
      if (lastPos) {
        distance = vincentyDistance(lastPos.lat, lastPos.lng, pos.lat, pos.lng);
      }
      inclination.addGpsReading(pos.altitude, distance);
      lastGpsDistanceRef.current = distance;
    }
  }, [pos?.altitude, pos?.lat, pos?.lng, inclination]);

  useEffect(() => {
    const vehicleFuelType = activeVehicle
      ? activeVehicle.fuelType === "diesel"
        ? "gasolina"
        : activeVehicle.fuelType === "ethanol"
          ? "etanol"
          : activeVehicle.fuelType === "flex"
            ? "flex"
            : "gasolina"
      : "gasolina";

    const totalLiters = fuelInventory.getTotalLiters(
      vehicleFuelType as "gasolina" | "etanol" | "flex" | "gnv",
    );
    const weightedPrice =
      totalLiters > 0
        ? fuelInventory.getWeightedAveragePrice(
            vehicleFuelType as "gasolina" | "etanol" | "flex" | "gnv",
          )
        : 0;

    if (totalLiters === 0 && storeTotalFuelUsed > 0) {
      const fallbackPrice = 5.5;
      setRealtimeCost(storeTotalFuelUsed * fallbackPrice);
    } else {
      setRealtimeCost(storeTotalFuelUsed * weightedPrice);
    }
  }, [storeTotalFuelUsed, fuelInventory, activeVehicle]);

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
    if (!isAndroid) return;
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
      await fuelInventory.loadInventory();
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
    fuelInventory,
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
    async (fuelLiters: number, currentFuelLevel: number) => {
      if (!activeVehicle || fuelLiters <= 0) return;

      const newAccumulated = accumulatedFuelRef.current + fuelLiters;
      accumulatedFuelRef.current = newAccumulated;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastFuelUpdateRef.current;
      const MIN_UPDATE_INTERVAL_MS = 5000;
      const MIN_FUEL_TO_CONSUME = 0.05;

      if (
        timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS &&
        newAccumulated < MIN_FUEL_TO_CONSUME
      ) {
        return;
      }

      if (!fuelInventory.isLoaded()) {
        console.log("[FUEL] Waiting for inventory to load...");
        await fuelInventory.loadInventory();
      }

      const fuelToConsume = accumulatedFuelRef.current;
      accumulatedFuelRef.current = 0;
      lastFuelUpdateRef.current = now;

      console.log(
        `[FUEL] Consuming ${fuelToConsume.toFixed(3)}L from vehicle ${activeVehicle.id} (current: ${currentFuelLevel.toFixed(2)}L)`,
      );

      const vehicleFuelType: "gasolina" | "etanol" | "flex" | "gnv" =
        activeVehicle.fuelType === "diesel"
          ? "gasolina"
          : activeVehicle.fuelType === "ethanol"
            ? "etanol"
            : activeVehicle.fuelType === "flex"
              ? "flex"
              : "gasolina";

      try {
        const result = await fuelInventory.consumeFuel(
          fuelToConsume,
          vehicleFuelType,
        );
        console.log(
          `[FUEL] Batch consumption result: cost=${result.cost.toFixed(2)}, batches=${result.batches.length}`,
        );
      } catch (err) {
        console.warn("[FUEL] Failed to consume from batch:", err);
      }

      const newFuelLevel = Math.max(0, currentFuelLevel - fuelToConsume);
      await updateVehicleFuelLevel(activeVehicle.id, newFuelLevel);
      console.log(
        `[FUEL] Vehicle fuel updated: ${currentFuelLevel.toFixed(2)}L -> ${newFuelLevel.toFixed(2)}L`,
      );
    },
    [activeVehicle, fuelInventory, updateVehicleFuelLevel],
  );

  const handleConfirmStop = useCallback(async () => {
    setShowConfirmDialog(false);
    stopWatching();
    releaseWakeLock();

    if (accumulatedFuelRef.current > 0) {
      console.log(
        `[FUEL] Trip ending - consuming remaining ${accumulatedFuelRef.current.toFixed(3)}L`,
      );
      await consumeFuelFromVehicle(0, activeVehicle?.currentFuel ?? 0);
    }

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
    const simPos = location.simPosition;
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
    if (estimatedConsumption > 0) {
      const fuelUsed = distanceKm / estimatedConsumption;
      if (fuelUsed > 0) {
        setTotalFuelUsed(storeTotalFuelUsed + fuelUsed);
        setLocalFuelUsed((prev) => prev + fuelUsed);
        consumeFuelFromVehicle(fuelUsed, activeVehicle?.currentFuel ?? 0);
      }
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
    location.simPosition,
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
    if (debugModeEnabled) return; // simulation handles its own position
    if (status === "recording" && !isWatching) {
      startWatching();
    } else if (status === "idle" && !isWatching) {
      startWatching();
    } else if (status === "paused" && isWatching) {
      stopWatching();
    }
  }, [debugModeEnabled, status, isWatching, startWatching, stopWatching]);

  // Determine effective position/path/speed for the UI
  const effectivePosition = debugModeEnabled
    ? location.simPosition
    : isSimulating
      ? simulatedPosition
      : isAutoTracking
        ? (autoTrackerPoints[autoTrackerPoints.length - 1] ?? null)
        : pos;
  const effectivePath = debugModeEnabled
    ? trip?.path || []
    : isSimulating
      ? simulatedPath
      : isAutoTracking
        ? autoTrackerPoints
        : trip?.path || [];
  const displaySpeed = debugModeEnabled
    ? location.speed
    : isSimulating
      ? simulatedSpeed * 3.6
      : currentSpeed;
  const simulatedDistance = isSimulating
    ? calculateTotalDistance(simulatedPath)
    : 0;
  const isRecordingOrSimulating = isSimulating || status === "recording";

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
      <FuelBar
        currentFuel={displayedFuel}
        fuelCapacity={activeVehicle?.fuelCapacity ?? 50}
      />

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
        />
      </div>

      <div className="pointer-events-none fixed inset-0 z-[1] bg-[linear-gradient(180deg,rgba(214,228,233,0.5)_0%,rgba(214,228,233,0.14)_38%,rgba(18,38,58,0.22)_100%)]" />

      <div className="pointer-events-none fixed inset-0 z-10">
        <div className="pointer-events-auto pt-0">
          <DrivingPanel
            currentSpeed={displaySpeed}
            distance={isSimulating ? simulatedDistance : stats.distanceMeters}
            elapsedTime={isSimulating ? simulatedElapsedTime : elapsedTime}
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
            vehicleName={activeVehicle?.name}
            vehicleDetails={
              activeVehicle
                ? `${(activeVehicle.displacement / 1000).toFixed(1)}L ${activeVehicle.fuelType === "flex" ? "Flex" : activeVehicle.fuelType === "diesel" ? "Diesel" : activeVehicle.fuelType === "ethanol" ? "Etanol" : "Gasolina"} · ${Math.round(activeVehicle.mass)}kg`
                : undefined
            }
            radarMaxSpeed={nearbyRadarMaxSpeed}
            isSpeeding={!!currentSpeedingEvent}
            gradePercent={inclination.gradePercent}
            inclinationConfidence={inclination.confidence}
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

        <div className="pointer-events-none fixed bottom-6 left-4 z-40">
          <Speedometer
            currentSpeed={displaySpeed}
            maxSpeed={nearbyRadarMaxSpeed}
            isSpeeding={!!currentSpeedingEvent}
            currentGear={currentGear}
            currentRpm={currentRpm}
            hasTransmissionData={hasTransmissionData}
          />
        </div>

        {status === "idle" && (
          <div className="pointer-events-none fixed bottom-6 right-4">
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
        )}

        {status !== "idle" && (
          <div className="pointer-events-none fixed bottom-6 right-4">
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
        )}

        <button
          onClick={() => {
            getCurrentPosition();
            if (mapInstance && pos) {
              mapInstance.setView([pos.lat, pos.lng], mapInstance.getZoom(), {
                animate: true,
                duration: 0.5,
              });
            }
          }}
          className="pointer-events-auto fixed bottom-44 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 shadow-md transition-all hover:scale-105 active:scale-95"
        >
          <svg
            className="h-4 w-4 text-white/80"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
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
