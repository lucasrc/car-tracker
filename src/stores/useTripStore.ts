import { create } from "zustand";
import type { Trip, Coordinates, TripStatus } from "@/types";
import { generateId } from "@/lib/utils";
import {
  saveCurrentTrip,
  getCurrentTrip,
  clearCurrentTrip,
  saveTrip,
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

  startTrip: () => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  stopTrip: () => Promise<void>;
  addPosition: (coords: Coordinates) => void;
  setCurrentSpeed: (speed: number) => void;
  tick: () => void;
  loadCurrentTrip: () => Promise<void>;
}

const getEmptyStats = (): TripStats => ({
  distanceMeters: 0,
  maxSpeed: 0,
  durationSeconds: 0,
});

export const useTripStore = create<TripStore>((set, get) => ({
  trip: null,
  status: "idle",
  currentSpeed: 0,
  stats: getEmptyStats(),
  elapsedTime: 0,

  startTrip: () => {
    const trip: Trip = {
      id: generateId(),
      startTime: new Date().toISOString(),
      distanceMeters: 0,
      maxSpeed: 0,
      path: [],
      status: "recording",
    };

    set({
      trip,
      status: "recording",
      currentSpeed: 0,
      stats: getEmptyStats(),
      elapsedTime: 0,
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

  stopTrip: async () => {
    const { trip, stats } = get();
    if (!trip) return;

    const completedTrip: Trip = {
      ...trip,
      endTime: new Date().toISOString(),
      status: "completed",
      distanceMeters: stats.distanceMeters,
      maxSpeed: stats.maxSpeed,
    };

    await saveTrip(completedTrip);
    await clearCurrentTrip();

    set({
      trip: null,
      status: "idle",
      currentSpeed: 0,
      stats: getEmptyStats(),
      elapsedTime: 0,
    });
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

  setCurrentSpeed: (speed: number) => {
    set({ currentSpeed: speed });
  },

  tick: () => {
    const { elapsedTime, status } = get();
    if (status === "idle") return;

    set({ elapsedTime: elapsedTime + 1 });
  },

  loadCurrentTrip: async () => {
    const savedTrip = await getCurrentTrip();
    if (!savedTrip) return;

    if (savedTrip.status === "completed") {
      await clearCurrentTrip();
      return;
    }

    const stats: TripStats = {
      distanceMeters: savedTrip.distanceMeters,
      maxSpeed: savedTrip.maxSpeed,
      durationSeconds: savedTrip.startTime
        ? Math.floor(
            (Date.now() - new Date(savedTrip.startTime).getTime()) / 1000,
          )
        : 0,
    };

    const elapsedTime = savedTrip.startTime
      ? Math.floor(
          (Date.now() - new Date(savedTrip.startTime).getTime()) / 1000,
        )
      : 0;

    set({
      trip: savedTrip,
      status: savedTrip.status,
      stats,
      elapsedTime,
    });
  },
}));
