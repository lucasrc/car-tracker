import { create } from "zustand";
import type { Radar, SpeedingEvent } from "@/types";
import {
  fetchRadarsInArea,
  findNearestRadar,
  isSpeeding,
  isRadarApplicable,
  isOnSameRoadHMM,
} from "@/lib/radar-api";
import { calculateDistanceKm } from "@/lib/radar-api";

interface RadarStore {
  radars: Radar[];
  nearestRadar: Radar | null;
  currentSpeedingEvent: SpeedingEvent | null;
  speedingEvents: SpeedingEvent[];
  isLoading: boolean;
  lastFetchPosition: { lat: number; lng: number } | null;

  fetchRadars: (lat: number, lng: number) => Promise<void>;
  checkSpeeding: (
    path: { lat: number; lng: number; timestamp: number }[],
    currentSpeed: number,
    vehicleHeading: number,
  ) => void;
  clearSpeedingEvents: () => void;
  getRadarDistance: (
    radar: Radar,
    position: { lat: number; lng: number },
  ) => number;
}

const RADAR_FETCH_RADIUS_KM = 5;
const SPEEDING_TOLERANCE_KMH = 5;
const MIN_DISTANCE_TO_CHECK_KMH = 0.15;

export const useRadarStore = create<RadarStore>((set, get) => ({
  radars: [],
  nearestRadar: null,
  currentSpeedingEvent: null,
  speedingEvents: [],
  isLoading: false,
  lastFetchPosition: null,

  fetchRadars: async (lat: number, lng: number) => {
    const state = get();

    if (state.lastFetchPosition) {
      const distance = calculateDistanceKm(
        state.lastFetchPosition.lat,
        state.lastFetchPosition.lng,
        lat,
        lng,
      );
      if (distance < 1) {
        return;
      }
    }

    set({ isLoading: true });

    try {
      const radars = await fetchRadarsInArea(lat, lng, RADAR_FETCH_RADIUS_KM);
      const nearest = findNearestRadar(
        { lat, lng },
        radars,
        RADAR_FETCH_RADIUS_KM,
      );

      set({
        radars,
        nearestRadar: nearest,
        lastFetchPosition: { lat, lng },
        isLoading: false,
      });
    } catch (err) {
      console.error("Failed to fetch radars:", err);
      set({ isLoading: false });
    }
  },

  checkSpeeding: (
    path: { lat: number; lng: number; timestamp: number }[],
    currentSpeed: number,
    vehicleHeading: number,
  ) => {
    const { nearestRadar, currentSpeedingEvent } = get();

    if (!nearestRadar || currentSpeed < 20 || path.length === 0) {
      if (currentSpeedingEvent) {
        set({ currentSpeedingEvent: null });
      }
      return;
    }

    const position = path[path.length - 1];

    const distanceToRadar = calculateDistanceKm(
      position.lat,
      position.lng,
      nearestRadar.lat,
      nearestRadar.lng,
    );

    if (distanceToRadar > MIN_DISTANCE_TO_CHECK_KMH) {
      if (currentSpeedingEvent) {
        set({ currentSpeedingEvent: null });
      }
      return;
    }

    if (!isRadarApplicable(vehicleHeading, nearestRadar.direction)) {
      if (currentSpeedingEvent) {
        set({ currentSpeedingEvent: null });
      }
      return;
    }

    if (!isOnSameRoadHMM(path, nearestRadar.wayGeometry ?? [])) {
      if (currentSpeedingEvent) {
        set({ currentSpeedingEvent: null });
      }
      return;
    }

    const currentlySpeeding = isSpeeding(
      currentSpeed,
      nearestRadar,
      SPEEDING_TOLERANCE_KMH,
    );

    if (currentlySpeeding) {
      const event: SpeedingEvent = {
        radarId: nearestRadar.id,
        radarLat: nearestRadar.lat,
        radarLng: nearestRadar.lng,
        radarMaxSpeed: nearestRadar.maxSpeed,
        currentSpeed,
        timestamp: Date.now(),
      };

      set((state) => {
        const shouldAddEvent =
          state.currentSpeedingEvent === null ||
          state.currentSpeedingEvent.radarId !== nearestRadar.id ||
          currentSpeed > state.currentSpeedingEvent.currentSpeed;

        if (shouldAddEvent) {
          return {
            currentSpeedingEvent: event,
            speedingEvents: [...state.speedingEvents, event],
          };
        }
        return { currentSpeedingEvent: event };
      });
    } else if (currentSpeedingEvent) {
      set({ currentSpeedingEvent: null });
    }
  },

  clearSpeedingEvents: () => {
    set({ speedingEvents: [], currentSpeedingEvent: null });
  },

  getRadarDistance: (radar: Radar, position: { lat: number; lng: number }) => {
    return calculateDistanceKm(
      position.lat,
      position.lng,
      radar.lat,
      radar.lng,
    );
  },
}));
