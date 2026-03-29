import { create } from "zustand";
import type { Trip, Coordinates, TripStatus, TripStop } from "@/types";
import { generateId } from "@/lib/utils";
import {
  saveCurrentTrip,
  getCurrentTrip,
  clearCurrentTrip,
  saveTrip,
  getSettings,
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
  stopSampleStart: Coordinates | null;
  lastStopSampleTimestamp: number | null;

  startTrip: () => Promise<void>;
  pauseTrip: () => void;
  resumeTrip: () => void;
  stopTrip: (fuelPrice: number, totalFuelUsed: number) => Promise<string>;
  addPosition: (coords: Coordinates) => void;
  registerStopSample: (coords: Coordinates, speedKmh: number) => void;
  setCurrentSpeed: (speed: number) => void;
  setDriveMode: (mode: "city" | "highway") => void;
  setConsumption: (consumption: number) => void;
  tick: () => void;
  loadCurrentTrip: () => Promise<void>;
}

const getEmptyStats = (): TripStats => ({
  distanceMeters: 0,
  maxSpeed: 0,
  durationSeconds: 0,
});

const STOP_MIN_MILLISECONDS = 5000;

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
  stopSampleStart: null,
  lastStopSampleTimestamp: null,

  startTrip: async () => {
    const settings = await getSettings();
    const trip: Trip = {
      id: generateId(),
      startTime: new Date().toISOString(),
      distanceMeters: 0,
      maxSpeed: 0,
      avgSpeed: 0,
      path: [],
      status: "recording",
      driveMode: "city",
      consumption: settings.cityKmPerLiter,
      fuelCapacity: settings.fuelCapacity,
      fuelUsed: 0,
      fuelPrice: settings.fuelPrice,
      totalCost: 0,
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
    });

    saveCurrentTrip(trip);
  },

  pauseTrip: () => {
    const { trip } = get();
    if (!trip) return;

    const updatedTrip: Trip = {
      ...trip,
      status: "paused",
    };

    set({ status: "paused", trip: updatedTrip });
    saveCurrentTrip(updatedTrip);
  },

  resumeTrip: () => {
    const { trip } = get();
    if (!trip) return;

    const updatedTrip: Trip = {
      ...trip,
      status: "recording",
    };

    set({ status: "recording", trip: updatedTrip });
    saveCurrentTrip(updatedTrip);
  },

  stopTrip: async (fuelPrice: number, totalFuelUsed: number) => {
    const {
      trip,
      stats,
      elapsedTime,
      stopSampleStart,
      lastStopSampleTimestamp,
    } = get();
    if (!trip) return "";

    const tripWithStops =
      stopSampleStart && lastStopSampleTimestamp
        ? buildTripWithStop(trip, stopSampleStart, lastStopSampleTimestamp)
        : trip;

    const distanceKm = stats.distanceMeters / 1000;
    const durationHours = elapsedTime / 3600;
    const avgSpeed = durationHours > 0 ? distanceKm / durationHours : 0;
    const consumption = trip.consumption || 0;
    const fuelUsed = Math.max(totalFuelUsed, 0);
    const totalCost = fuelUsed * fuelPrice;

    const completedTrip: Trip = {
      ...tripWithStops,
      endTime: new Date().toISOString(),
      status: "completed",
      distanceMeters: stats.distanceMeters,
      maxSpeed: stats.maxSpeed,
      avgSpeed,
      consumption,
      fuelUsed,
      fuelPrice,
      totalCost,
    };

    await saveTrip(completedTrip);
    await clearCurrentTrip();

    set({
      trip: null,
      status: "idle",
      currentSpeed: 0,
      stats: getEmptyStats(),
      elapsedTime: 0,
      stopSampleStart: null,
      lastStopSampleTimestamp: null,
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

    const isStopped = speedKmh <= 0.1;

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

    const recoveredTrip: Trip =
      savedTrip.status === "recording"
        ? { ...savedTrip, status: "paused" }
        : savedTrip;

    if (recoveredTrip !== savedTrip) {
      await saveCurrentTrip(recoveredTrip);
    }

    const stats: TripStats = {
      distanceMeters: recoveredTrip.distanceMeters,
      maxSpeed: recoveredTrip.maxSpeed,
      durationSeconds: recoveredTrip.startTime
        ? Math.floor(
            (Date.now() - new Date(recoveredTrip.startTime).getTime()) / 1000,
          )
        : 0,
    };

    const elapsedTime = recoveredTrip.startTime
      ? Math.floor(
          (Date.now() - new Date(recoveredTrip.startTime).getTime()) / 1000,
        )
      : 0;

    set({
      trip: recoveredTrip,
      status: recoveredTrip.status,
      stats,
      elapsedTime,
      stopSampleStart: null,
      lastStopSampleTimestamp: null,
    });
  },
}));
