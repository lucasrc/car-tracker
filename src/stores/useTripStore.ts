import { create } from "zustand";
import type {
  Trip,
  Coordinates,
  TripStatus,
  TripStop,
  TripConsumptionBreakdown,
  SpeedingEvent,
} from "@/types";
import { generateId } from "@/lib/utils";
import {
  saveCurrentTrip,
  getCurrentTrip,
  clearCurrentTrip,
  saveTrip,
  getSettings,
  getVehicle,
} from "@/lib/db";
import { calculateTotalDistance } from "@/lib/distance";

interface TripStats {
  distanceMeters: number;
  maxSpeed: number;
  durationSeconds: number;
}

interface TripStore {
  trip: Trip | null;
  status: TripStatus;
  currentSpeed: number;
  stats: TripStats;
  elapsedTime: number;
  totalFuelUsed: number;
  stopSampleStart: Coordinates | null;
  lastStopSampleTimestamp: number | null;
  consumptionBreakdown: TripConsumptionBreakdown | null;
  speedingEvents: SpeedingEvent[];

  startTrip: () => Promise<void>;
  pauseTrip: () => void;
  resumeTrip: () => void;
  stopTrip: (
    totalFuelUsed: number,
    actualCost: number,
    breakdown?: TripConsumptionBreakdown,
    avgConsumption?: number,
  ) => Promise<string>;
  addPosition: (coords: Coordinates) => void;
  registerStopSample: (coords: Coordinates, speedKmh: number) => void;
  setCurrentSpeed: (speed: number) => void;
  setDriveMode: (mode: "city" | "highway") => void;
  setConsumption: (consumption: number) => void;
  setTotalFuelUsed: (totalFuelUsed: number) => void;
  setConsumptionBreakdown: (breakdown: TripConsumptionBreakdown) => void;
  registerSpeedingEvent: (event: SpeedingEvent) => void;
  tick: () => void;
  loadCurrentTrip: () => Promise<void>;
  restoreTrip: (startTime: string, deviceName?: string) => Promise<void>;
}

const getEmptyStats = (): TripStats => ({
  distanceMeters: 0,
  maxSpeed: 0,
  durationSeconds: 0,
});

const STOP_MIN_MILLISECONDS = 5000;
const MIN_TRIP_DISTANCE_METERS = 30;
const MIN_TRIP_DURATION_SECONDS = 30;

function buildTripWithStop(
  trip: Trip,
  stopStart: Coordinates,
  lastTimestamp: number,
): Trip {
  const durationMilliseconds = lastTimestamp - stopStart.timestamp;

  // Considera parada apenas quando ficou em 0 km/h por mais de 5 segundos.
  if (durationMilliseconds <= STOP_MIN_MILLISECONDS) {
    return trip;
  }

  const durationSeconds = Math.round(durationMilliseconds / 1000);

  const newStop: TripStop = {
    lat: stopStart.lat,
    lng: stopStart.lng,
    timestamp: stopStart.timestamp,
    durationSeconds,
  };

  return {
    ...trip,
    stops: [...(trip.stops || []), newStop],
  };
}

export const useTripStore = create<TripStore>((set, get) => ({
  trip: null,
  status: "idle",
  currentSpeed: 0,
  stats: getEmptyStats(),
  elapsedTime: 0,
  totalFuelUsed: 0,
  stopSampleStart: null,
  lastStopSampleTimestamp: null,
  consumptionBreakdown: null,
  speedingEvents: [],

  registerSpeedingEvent: (event: SpeedingEvent) => {
    const { trip, status } = get();
    if (!trip || status !== "recording") return;

    const updatedTrip: Trip = {
      ...trip,
      speedingEvents: [...(trip.speedingEvents || []), event],
    };

    set({
      trip: updatedTrip,
      speedingEvents: [...get().speedingEvents, event],
    });

    saveCurrentTrip(updatedTrip);
  },

  setConsumptionBreakdown: (breakdown: TripConsumptionBreakdown) => {
    set({ consumptionBreakdown: breakdown });
  },

  startTrip: async () => {
    const settings = await getSettings();
    if (!settings.activeVehicleId) {
      throw new Error(
        "No vehicle selected. Please add and select a vehicle in Settings before starting a trip.",
      );
    }

    const vehicle = await getVehicle(settings.activeVehicleId);
    if (!vehicle) {
      throw new Error(
        "Vehicle not found. Please add a vehicle in Settings before starting a trip.",
      );
    }

    const trip: Trip = {
      id: generateId(),
      vehicleId: vehicle.id,
      startTime: new Date().toISOString(),
      distanceMeters: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      path: [],
      status: "recording",
      driveMode: "city",
      consumption: settings.manualCityKmPerLiter,
      fuelCapacity: settings.fuelCapacity,
      fuelUsed: 0,
      actualCost: 0,
      elapsedTime: 0,
      totalFuelUsed: 0,
      stops: [],
    };

    set({
      trip,
      status: "recording",
      currentSpeed: 0,
      stats: getEmptyStats(),
      elapsedTime: 0,
      stopSampleStart: null,
      lastStopSampleTimestamp: null,
      consumptionBreakdown: null,
      speedingEvents: [],
    });

    saveCurrentTrip(trip);
  },

  pauseTrip: () => {
    const { trip, elapsedTime, stopSampleStart, lastStopSampleTimestamp } =
      get();
    if (!trip) return;

    const updatedTrip: Trip = {
      ...trip,
      status: "paused",
      elapsedTime,
      pendingStopStart: stopSampleStart
        ? {
            lat: stopSampleStart.lat,
            lng: stopSampleStart.lng,
            timestamp: stopSampleStart.timestamp,
          }
        : null,
      pendingStopLastTimestamp: lastStopSampleTimestamp,
    };

    set({ status: "paused", trip: updatedTrip });
    saveCurrentTrip(updatedTrip);
  },

  resumeTrip: () => {
    const { trip } = get();
    if (!trip) return;

    // Recupera o estado de parada em andamento salvo ao pausar
    const restoredStopStart = trip.pendingStopStart
      ? {
          ...trip.pendingStopStart,
          accuracy: undefined,
          speed: undefined,
        }
      : null;

    const updatedTrip: Trip = {
      ...trip,
      status: "recording",
    };

    set({
      status: "recording",
      trip: updatedTrip,
      stopSampleStart: restoredStopStart,
      lastStopSampleTimestamp: trip.pendingStopLastTimestamp ?? null,
    });
    saveCurrentTrip(updatedTrip);
  },

  stopTrip: async (
    totalFuelUsed: number,
    actualCost: number,
    breakdown?: TripConsumptionBreakdown,
    avgConsumption?: number,
  ) => {
    const {
      trip,
      stats,
      elapsedTime,
      stopSampleStart,
      lastStopSampleTimestamp,
      currentSpeed,
      speedingEvents,
    } = get();
    if (!trip) return "";

    let tripWithStops = trip;
    if (stopSampleStart && lastStopSampleTimestamp) {
      tripWithStops = buildTripWithStop(
        trip,
        stopSampleStart,
        lastStopSampleTimestamp,
      );
    } else if (stopSampleStart && currentSpeed <= 3.6) {
      const now = Date.now();
      tripWithStops = buildTripWithStop(trip, stopSampleStart, now);
    }

    const distanceKm = stats.distanceMeters / 1000;
    const durationHours = elapsedTime / 3600;
    const avgSpeed = durationHours > 0 ? distanceKm / durationHours : 0;
    const consumption = avgConsumption ?? trip.consumption ?? 0;
    const fuelUsed = Math.max(totalFuelUsed, 0);

    if (
      stats.distanceMeters < MIN_TRIP_DISTANCE_METERS ||
      elapsedTime < MIN_TRIP_DURATION_SECONDS
    ) {
      await clearCurrentTrip();

      set({
        trip: null,
        status: "idle",
        currentSpeed: 0,
        stats: getEmptyStats(),
        elapsedTime: 0,
        totalFuelUsed: 0,
        stopSampleStart: null,
        lastStopSampleTimestamp: null,
        consumptionBreakdown: null,
        speedingEvents: [],
      });

      return "";
    }

    const completedTrip: Trip = {
      ...tripWithStops,
      endTime: new Date().toISOString(),
      status: "completed",
      distanceMeters: stats.distanceMeters,
      maxSpeed: stats.maxSpeed,
      avgSpeed,
      consumption,
      fuelUsed,
      actualCost,
      elapsedTime,
      totalFuelUsed,
      consumptionBreakdown: breakdown || undefined,
      speedingEvents,
      pendingStopStart: null,
      pendingStopLastTimestamp: null,
    };

    await saveTrip(completedTrip);
    await clearCurrentTrip();

    set({
      trip: null,
      status: "idle",
      currentSpeed: 0,
      stats: getEmptyStats(),
      elapsedTime: 0,
      totalFuelUsed: 0,
      stopSampleStart: null,
      lastStopSampleTimestamp: null,
      consumptionBreakdown: null,
      speedingEvents: [],
    });

    return completedTrip.id;
  },

  addPosition: (coords: Coordinates) => {
    const { trip, stats, status } = get();
    if (!trip || status !== "recording") return;

    const newPath = [...trip.path, coords];
    const newDistance = calculateTotalDistance(newPath);

    const newMaxSpeed = Math.max(
      stats.maxSpeed,
      coords.speed ? coords.speed * 3.6 : 0,
    );

    const updatedTrip: Trip = {
      ...trip,
      path: newPath,
      distanceMeters: newDistance,
      maxSpeed: newMaxSpeed,
    };

    set({
      trip: updatedTrip,
      stats: {
        ...stats,
        distanceMeters: newDistance,
        maxSpeed: newMaxSpeed,
      },
    });

    saveCurrentTrip(updatedTrip);
  },

  registerStopSample: (coords: Coordinates, speedKmh: number) => {
    const { trip, status, stopSampleStart, lastStopSampleTimestamp } = get();
    if (!trip || status !== "recording") return;

    const isStopped = speedKmh <= 3.6;

    if (isStopped) {
      if (!stopSampleStart) {
        set({
          stopSampleStart: coords,
          lastStopSampleTimestamp: coords.timestamp,
        });
        return;
      }

      set({ lastStopSampleTimestamp: coords.timestamp });
      return;
    }

    if (!stopSampleStart || !lastStopSampleTimestamp) return;

    const updatedTrip = buildTripWithStop(
      trip,
      stopSampleStart,
      lastStopSampleTimestamp,
    );

    set({
      trip: updatedTrip,
      stopSampleStart: null,
      lastStopSampleTimestamp: null,
    });

    if (updatedTrip !== trip) {
      saveCurrentTrip(updatedTrip);
    }
  },

  setCurrentSpeed: (speed: number) => {
    set({ currentSpeed: speed });
  },

  setDriveMode: (mode: "city" | "highway") => {
    const { trip } = get();
    if (!trip) return;

    const updatedTrip: Trip = { ...trip, driveMode: mode };
    set({ trip: updatedTrip });
    saveCurrentTrip(updatedTrip);
  },

  setConsumption: (consumption: number) => {
    const { trip } = get();
    if (!trip) return;

    const updatedTrip: Trip = { ...trip, consumption };
    set({ trip: updatedTrip });
    saveCurrentTrip(updatedTrip);
  },

  setTotalFuelUsed: (totalFuelUsed: number) => {
    const { trip } = get();
    if (!trip) return;

    const updatedTrip: Trip = { ...trip, totalFuelUsed };
    set({ trip: updatedTrip, totalFuelUsed });
    saveCurrentTrip(updatedTrip);
  },

  tick: () => {
    const { elapsedTime, status } = get();
    if (status !== "recording") return;

    set({ elapsedTime: elapsedTime + 1 });
  },

  loadCurrentTrip: async () => {
    const savedTrip = await getCurrentTrip();
    if (!savedTrip) return;

    if (savedTrip.status === "completed") {
      await clearCurrentTrip();
      return;
    }

    // Mantém o status original (recording ou paused) - não transforma recording em paused
    const recoveredTrip = savedTrip;

    if (recoveredTrip.status === "recording") {
      await saveCurrentTrip({ ...recoveredTrip, status: "recording" });
    }

    const stats: TripStats = {
      distanceMeters: recoveredTrip.distanceMeters,
      maxSpeed: recoveredTrip.maxSpeed,
      durationSeconds: recoveredTrip.elapsedTime || 0,
    };

    const elapsedTime = recoveredTrip.elapsedTime || 0;
    const totalFuelUsed = recoveredTrip.totalFuelUsed || 0;

    // Recupera apenas o estado de parada em andamento salvo, nunca de paradas finalizadas
    const pendingStopStart = recoveredTrip.pendingStopStart;

    set({
      trip: recoveredTrip,
      status: recoveredTrip.status,
      stats,
      elapsedTime,
      totalFuelUsed,
      stopSampleStart: pendingStopStart
        ? {
            ...pendingStopStart,
            accuracy: undefined,
            speed: undefined,
          }
        : null,
      lastStopSampleTimestamp: recoveredTrip.pendingStopLastTimestamp ?? null,
      speedingEvents: recoveredTrip.speedingEvents || [],
    });
  },

  restoreTrip: async (startTime: string) => {
    const settings = await getSettings();
    if (!settings.activeVehicleId) {
      throw new Error(
        "No vehicle selected. Please add and select a vehicle in Settings before starting a trip.",
      );
    }

    const vehicle = await getVehicle(settings.activeVehicleId);
    if (!vehicle) {
      throw new Error(
        "Vehicle not found. Please add a vehicle in Settings before starting a trip.",
      );
    }

    const trip: Trip = {
      id: generateId(),
      vehicleId: vehicle.id,
      startTime,
      distanceMeters: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      path: [],
      status: "recording",
      driveMode: "city",
      consumption: settings.manualCityKmPerLiter,
      fuelCapacity: settings.fuelCapacity,
      fuelUsed: 0,
      actualCost: 0,
      elapsedTime: 0,
      totalFuelUsed: 0,
      stops: [],
    };

    set({
      trip,
      status: "recording",
      currentSpeed: 0,
      stats: getEmptyStats(),
      elapsedTime: 0,
      stopSampleStart: null,
      lastStopSampleTimestamp: null,
      consumptionBreakdown: null,
      speedingEvents: [],
    });

    saveCurrentTrip(trip);
  },
}));
