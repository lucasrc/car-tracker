import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapTracker } from "@/components/tracker/MapTracker";
import { Speedometer } from "@/components/tracker/Speedometer";
import { TripControls } from "@/components/tracker/TripControls";
import { DrivingPanel } from "@/components/tracker/DrivingPanel";
import { FuelBar } from "@/components/tracker/FuelBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SimulationControls } from "@/components/tracker/SimulationControls";
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
import type { Settings } from "@/types";
import {
  isValidSpeedForDistance,
  vincentyDistance,
  calculateTotalDistance,
} from "@/lib/distance";
import { getSettings } from "@/lib/db";
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
  const { activeVehicle } = useVehicleStore();
  const fuelInventory = useFuelInventory(activeVehicle?.id || "");
  const { nearestRadar, currentSpeedingEvent } = useRadarStore();
  const inclination = useInclination({ enabled: status === "recording" });
  const location = useLocationProvider();
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const debugModeShowRadars = useAppStore((s) => s.debugModeShowRadars);
  const pos = location.position;

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

  const [settings, setSettings] = useState<Settings>({
    id: "default",
    cityKmPerLiter: 8,
    highwayKmPerLiter: 12,
    mixedKmPerLiter: 10,
    manualCityKmPerLiter: 10,
    manualHighwayKmPerLiter: 14,
    manualMixedKmPerLiter: 12,
    fuelCapacity: 50,
    currentFuel: 0,
    fuelPrice: 0,
    engineDisplacement: 1000,
    fuelType: "gasolina",
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGpsWarming, setIsGpsWarming] = useState(false);
  const [warmupStartTime, setWarmupStartTime] = useState<number | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [realtimeCost, setRealtimeCost] = useState(0);

  useEffect(() => {
    fuelInventory.loadInventory();
  }, [fuelInventory]);

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
      : settings.fuelType;
    const weightedPrice =
      fuelInventory.getWeightedAveragePrice(vehicleFuelType);
    setRealtimeCost(storeTotalFuelUsed * weightedPrice);
  }, [storeTotalFuelUsed, fuelInventory, activeVehicle, settings.fuelType]);

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
    addPosition: addDriveModePosition,
    reset: resetDriveMode,
    isInitialized,
    getInstantConsumption,
    getTelemetryData,
    batterySocPct,
    isGnv,
  } = useTelemetryEngine(
    stats.distanceMeters,
    activeVehicle?.currentFuel ?? 0,
    inclination.gradePercent,
    activeVehicle,
  );

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
        engineDisplacement: s.engineDisplacement,
        fuelType: s.fuelType,
      });
    });
  }, []);

  const handleStart = useCallback(async () => {
    try {
      await fuelInventory.loadInventory();
      const totalLiters = fuelInventory.getTotalLiters();
      if (totalLiters === 0) {
        alert(
          "Sem combustível no tanque. O custo da viagem não será calculado. Faça um abastecimento antes de iniciar.",
        );
      }
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
    startWatching,
    requestWakeLock,
    resetSpeedFilter,
    resetDriveMode,
    fuelInventory,
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

  const handleConfirmStop = useCallback(async () => {
    setShowConfirmDialog(false);
    stopWatching();
    releaseWakeLock();
    const telemetryData = getTelemetryData();
    const tripId = await stopTrip(
      storeTotalFuelUsed,
      realtimeCost,
      undefined,
      undefined,
      telemetryData,
    );
    if (tripId) {
      navigate(`/history/${tripId}`);
    }
  }, [
    stopWatching,
    releaseWakeLock,
    stopTrip,
    storeTotalFuelUsed,
    realtimeCost,
    getTelemetryData,
    navigate,
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
      if (fuelUsed > 0) setTotalFuelUsed(storeTotalFuelUsed + fuelUsed);
    }

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
    status,
    addPosition,
    addDriveModePosition,
    registerStopSample,
    setCurrentSpeed,
    setTotalFuelUsed,
    storeTotalFuelUsed,
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
    addSpeedReading,
    addDriveModePosition,
    storeTotalFuelUsed,
    estimatedConsumption,
    stats.distanceMeters,
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

  useEffect(() => {
    if (isSimulating && simulatedPath.length >= 2) {
      const lastIdx = simulatedPath.length - 1;
      const prev = simulatedPath[lastIdx - 1];
      const curr = simulatedPath[lastIdx];

      const dist = vincentyDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      const distKm = dist / 1000;

      if (distKm > 0.001 && estimatedConsumption > 0) {
        const fuelUsed = distKm / estimatedConsumption;
        setTotalFuelUsed(storeTotalFuelUsed + fuelUsed);
      }
    }
  }, [
    simulatedPath,
    isSimulating,
    estimatedConsumption,
    setTotalFuelUsed,
    storeTotalFuelUsed,
  ]);

  const idleWorstCaseRange =
    (activeVehicle?.currentFuel ?? 0) * (activeVehicle?.urbanKmpl ?? 10);

  const currentConsumption = isRecordingOrSimulating
    ? estimatedConsumption
    : (activeVehicle?.urbanKmpl ?? 10);

  const displayedRange =
    status === "idle"
      ? idleWorstCaseRange
      : isInitialized && currentConsumption > 0
        ? (activeVehicle?.currentFuel ?? 0) * currentConsumption
        : idleWorstCaseRange;

  return (
    <>
      <FuelBar
        currentFuel={activeVehicle?.currentFuel ?? 0}
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
            fuelUsed={isRecordingOrSimulating ? storeTotalFuelUsed : 0}
            cost={realtimeCost}
            currentFuelLiters={activeVehicle?.currentFuel ?? 0}
            range={displayedRange}
            currentConsumption={
              isRecordingOrSimulating
                ? estimatedConsumption
                : (activeVehicle?.urbanKmpl ?? 10)
            }
            avgConsumption={
              isRecordingOrSimulating
                ? getInstantConsumption() || estimatedConsumption
                : (activeVehicle?.urbanKmpl ?? 10)
            }
            vehicleName={activeVehicle?.name}
            vehicleDetails={
              activeVehicle
                ? `${(activeVehicle.displacement / 1000).toFixed(1)}L ${activeVehicle.fuelType === "flex" ? "Flex" : activeVehicle.fuelType === "diesel" ? "Diesel" : activeVehicle.fuelType === "ethanol" ? "Etanol" : "Gasolina"} · ${Math.round(activeVehicle.mass)}kg`
                : undefined
            }
            calibrated={!!activeVehicle?.inmetroCityKmpl}
            radarMaxSpeed={nearbyRadarMaxSpeed}
            isSpeeding={!!currentSpeedingEvent}
            gradePercent={inclination.gradePercent}
            inclinationConfidence={inclination.confidence}
            batterySocPct={activeVehicle?.isHybrid ? batterySocPct : undefined}
            isHybrid={activeVehicle?.isHybrid ?? false}
            isGnv={isGnv}
          />
        </div>

        <div className="pointer-events-none fixed bottom-24 left-4">
          <Speedometer
            currentSpeed={displaySpeed}
            maxSpeed={nearbyRadarMaxSpeed}
            isSpeeding={!!currentSpeedingEvent}
          />
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
              gpsAccuracy={pos?.accuracy}
              warmupStartTime={warmupStartTime}
            />
          </div>
        </div>

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
          className="pointer-events-auto fixed bottom-60 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/70 shadow-md transition-all hover:scale-105 active:scale-95"
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
