import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { useTripStore } from "./useTripStore";
import type { Settings, Trip } from "@/types";

// Mock do db
 
const mockSaveCurrentTrip = vi.fn((_trip: Trip) => Promise.resolve());
const mockClearCurrentTrip = vi.fn(() => Promise.resolve());
const mockSaveTrip = vi.fn((trip: Trip) => Promise.resolve(trip.id));
const mockVehicle = {
  id: "test-vehicle-id",
  name: "Test Vehicle",
  make: "Toyota",
  model: "Corolla",
  year: 2020,
  displacement: 2.0,
  fuelType: "flex" as const,
  euroNorm: "Euro 6" as const,
  segment: "medium" as const,
  urbanKmpl: 8.5,
  highwayKmpl: 12.0,
  combinedKmpl: 10.5,
  mass: 1350,
  grossWeight: 1800,
  frontalArea: 2.3,
  dragCoefficient: 0.28,
  f0: 0.17,
  f1: 0,
  f2: 0.0004,
  fuelConversionFactor: 0.85,
  peakPowerKw: 125,
  peakTorqueNm: 200,
  confidence: "high" as const,
  calibrationInput: "Corolla 2.0 2020",
  calibratedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fuelCapacity: 50,
  currentFuel: 25,
};

const mockGetSettings = vi.fn(() =>
  Promise.resolve({
    id: "default",
    manualCityKmPerLiter: 10,
    manualHighwayKmPerLiter: 14,
    manualMixedKmPerLiter: 12,
    fuelCapacity: 50,
    currentFuel: 50,
    fuelPrice: 5.0,
    cityKmPerLiter: 8,
    highwayKmPerLiter: 12,
    mixedKmPerLiter: 10,
    activeVehicleId: "test-vehicle-id",
  } as Settings),
);

const mockGetVehicle = vi.fn(() => Promise.resolve(mockVehicle));

vi.mock("@/lib/db", () => ({
  getSettings: () => mockGetSettings(),
  saveCurrentTrip: (trip: Trip) => mockSaveCurrentTrip(trip),
  getCurrentTrip: vi.fn(() => Promise.resolve(undefined)),
  clearCurrentTrip: () => mockClearCurrentTrip(),
  saveTrip: (trip: Trip) => mockSaveTrip(trip),
  getVehicle: () => mockGetVehicle(),
}));

vi.mock("@/lib/copert-calibration-service", () => ({
  getSavedCalibration: vi.fn(() => ({
    make: "Toyota",
    model: "Corolla",
    year: 2020,
    displacement: 2.0,
    fuelType: "flex",
    euroNorm: "Euro 6",
    segment: "medium",
    urbanKmpl: 8.5,
    highwayKmpl: 12.0,
    combinedKmpl: 10.5,
    mass: 1350,
    grossWeight: 1800,
    frontalArea: 2.3,
    dragCoefficient: 0.28,
    f0: 0.17,
    f1: 0.003,
    f2: 0.00045,
    fuelConversionFactor: 275,
    peakPowerKw: 115,
    peakTorqueNm: 197,
    co2_gkm: 145,
    confidence: "high",
  })),
}));

describe("useTripStore - Stops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset store state
    act(() => {
      const store = useTripStore.getState();
      // We need to reset the store to initial state
      store.stopTrip(5.0, 0).catch(() => {});
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registerStopSample - Stop detection", () => {
    it("should start stop sample when speed <= 3.6 km/h", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const coords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: Date.now(),
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords, 0);
      });

      const state = useTripStore.getState();
      expect(state.stopSampleStart).toEqual(
        expect.objectContaining({
          lat: coords.lat,
          lng: coords.lng,
          timestamp: coords.timestamp,
        }),
      );
      expect(state.lastStopSampleTimestamp).toBe(coords.timestamp);
    });

    it("should update lastStopSampleTimestamp while still stopped", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const initialTimestamp = Date.now();
      const coords1 = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: initialTimestamp,
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords1, 0);
      });

      const updatedTimestamp = initialTimestamp + 3000;
      const coords2 = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: updatedTimestamp,
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords2, 0);
      });

      const state = useTripStore.getState();
      expect(state.stopSampleStart?.timestamp).toBe(initialTimestamp);
      expect(state.lastStopSampleTimestamp).toBe(updatedTimestamp);
    });

    it("should add stop to trip.stops when speed > 3.6 km/h after >= 5s stop", async () => {
      const startTime = 1000000000000;
      vi.setSystemTime(startTime);

      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const stopCoords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: startTime,
      };

      // Start stop
      act(() => {
        useTripStore.getState().registerStopSample(stopCoords, 0);
      });

      // Verify stop sample was started
      let state = useTripStore.getState();
      expect(state.stopSampleStart).not.toBeNull();
      expect(state.lastStopSampleTimestamp).toBe(startTime);

      // Wait 3 seconds and update while still stopped
      const midTime = startTime + 3000;
      vi.setSystemTime(midTime);

      act(() => {
        useTripStore
          .getState()
          .registerStopSample({ ...stopCoords, timestamp: midTime }, 0);
      });

      state = useTripStore.getState();
      expect(state.lastStopSampleTimestamp).toBe(midTime);

      // Wait more 3 seconds (total 6s) - still stopped, update timestamp
      const endTime = startTime + 6000;
      vi.setSystemTime(endTime);

      act(() => {
        useTripStore
          .getState()
          .registerStopSample({ ...stopCoords, timestamp: endTime }, 0);
      });

      state = useTripStore.getState();
      expect(state.lastStopSampleTimestamp).toBe(endTime);

      // Now resume movement
      const resumeCoords = {
        lat: -23.5506,
        lng: -46.6334,
        timestamp: endTime + 100, // A bit later
      };

      act(() => {
        useTripStore.getState().registerStopSample(resumeCoords, 10);
      });

      state = useTripStore.getState();
      expect(state.trip?.stops).toHaveLength(1);
      expect(state.trip?.stops?.[0]).toEqual(
        expect.objectContaining({
          lat: stopCoords.lat,
          lng: stopCoords.lng,
          timestamp: stopCoords.timestamp,
          durationSeconds: 6,
        }),
      );
      expect(state.stopSampleStart).toBeNull();
      expect(state.lastStopSampleTimestamp).toBeNull();
    });

    it("should NOT add stop when speed > 3.6 km/h after < 5s stop", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const initialTimestamp = Date.now();
      const stopCoords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: initialTimestamp,
      };

      // Start stop
      act(() => {
        useTripStore.getState().registerStopSample(stopCoords, 0);
      });

      // Wait only 3 seconds
      const endTimestamp = initialTimestamp + 3000;
      const endCoords = {
        lat: -23.5506,
        lng: -46.6334,
        timestamp: endTimestamp,
      };

      // Resume movement
      act(() => {
        useTripStore.getState().registerStopSample(endCoords, 10);
      });

      const state = useTripStore.getState();
      expect(state.trip?.stops).toHaveLength(0);
    });

    it("should ignore when status is not 'recording'", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
        useTripStore.getState().pauseTrip();
      });

      const coords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: Date.now(),
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords, 0);
      });

      const state = useTripStore.getState();
      expect(state.stopSampleStart).toBeNull();
    });
  });

  describe("pauseTrip - Save stop state", () => {
    it("should save pendingStopStart and pendingStopLastTimestamp when pausing with active stop", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const coords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: Date.now(),
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords, 0);
      });

      act(() => {
        useTripStore.getState().pauseTrip();
      });

      const state = useTripStore.getState();
      expect(state.trip?.pendingStopStart).toEqual(
        expect.objectContaining({
          lat: coords.lat,
          lng: coords.lng,
          timestamp: coords.timestamp,
        }),
      );
      expect(state.trip?.pendingStopLastTimestamp).toBe(coords.timestamp);
      expect(mockSaveCurrentTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingStopStart: expect.objectContaining({
            lat: coords.lat,
            lng: coords.lng,
            timestamp: coords.timestamp,
          }),
          pendingStopLastTimestamp: coords.timestamp,
        }),
      );
    });

    it("should save null state when pausing without active stop", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      act(() => {
        useTripStore.getState().pauseTrip();
      });

      const state = useTripStore.getState();
      expect(state.trip?.pendingStopStart).toBeNull();
      expect(state.trip?.pendingStopLastTimestamp).toBeNull();
    });
  });

  describe("resumeTrip - Restore stop state", () => {
    it("should restore stopSampleStart from pendingStopStart", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const coords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: Date.now(),
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords, 0);
      });

      act(() => {
        useTripStore.getState().pauseTrip();
      });

      act(() => {
        useTripStore.getState().resumeTrip();
      });

      const state = useTripStore.getState();
      expect(state.stopSampleStart).toEqual(
        expect.objectContaining({
          lat: coords.lat,
          lng: coords.lng,
          timestamp: coords.timestamp,
        }),
      );
    });

    it("should restore lastStopSampleTimestamp from pendingStopLastTimestamp", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const timestamp = Date.now();
      const coords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp,
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords, 0);
      });

      // Update timestamp while stopped
      const updatedCoords = {
        ...coords,
        timestamp: timestamp + 5000,
      };

      act(() => {
        useTripStore.getState().registerStopSample(updatedCoords, 0);
      });

      act(() => {
        useTripStore.getState().pauseTrip();
      });

      act(() => {
        useTripStore.getState().resumeTrip();
      });

      const state = useTripStore.getState();
      expect(state.lastStopSampleTimestamp).toBe(timestamp + 5000);
    });

    it("should start with clean state when no pending stop", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      act(() => {
        useTripStore.getState().pauseTrip();
      });

      act(() => {
        useTripStore.getState().resumeTrip();
      });

      const state = useTripStore.getState();
      expect(state.stopSampleStart).toBeNull();
      expect(state.lastStopSampleTimestamp).toBeNull();
    });
  });

  describe("loadCurrentTrip - BUG FIX: Do not restore from completed stops", () => {
    it("should NOT restore stopSampleStart from completed stops in trip.stops[]", async () => {
      // Simulate loading a trip with completed stops but no pending stop
      const savedTrip = {
        id: "test-trip",
        startTime: new Date().toISOString(),
        distanceMeters: 1000,
        maxSpeed: 50,
        avgSpeed: 30,
        path: [],
        status: "paused" as const,
        driveMode: "city" as const,
        consumption: 10,
        fuelCapacity: 50,
        fuelUsed: 5,
        fuelPrice: 5.0,
        totalCost: 25,
        elapsedTime: 120,
        totalFuelUsed: 5,
        stops: [
          {
            lat: -23.5505,
            lng: -46.6333,
            timestamp: Date.now() - 60000,
            durationSeconds: 30,
          },
        ],
        pendingStopStart: null,
        pendingStopLastTimestamp: null,
      };

      // Override getCurrentTrip mock temporarily
      const { getCurrentTrip } = await import("@/lib/db");
      (getCurrentTrip as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        savedTrip,
      );

      await act(async () => {
        await useTripStore.getState().loadCurrentTrip();
      });

      const state = useTripStore.getState();
      // BUG FIX: Even with stops in the array, should NOT restore stopSampleStart
      expect(state.stopSampleStart).toBeNull();
      expect(state.lastStopSampleTimestamp).toBeNull();
    });

    it("should restore stopSampleStart from pendingStopStart when loading", async () => {
      const timestamp = Date.now();
      const savedTrip = {
        id: "test-trip",
        startTime: new Date().toISOString(),
        distanceMeters: 1000,
        maxSpeed: 50,
        avgSpeed: 30,
        path: [],
        status: "paused" as const,
        driveMode: "city" as const,
        consumption: 10,
        fuelCapacity: 50,
        fuelUsed: 5,
        fuelPrice: 5.0,
        totalCost: 25,
        elapsedTime: 120,
        totalFuelUsed: 5,
        stops: [],
        pendingStopStart: {
          lat: -23.5505,
          lng: -46.6333,
          timestamp,
        },
        pendingStopLastTimestamp: timestamp + 10000,
      };

      const { getCurrentTrip } = await import("@/lib/db");
      (getCurrentTrip as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        savedTrip,
      );

      await act(async () => {
        await useTripStore.getState().loadCurrentTrip();
      });

      const state = useTripStore.getState();
      expect(state.stopSampleStart).toEqual(
        expect.objectContaining({
          lat: -23.5505,
          lng: -46.6333,
          timestamp,
        }),
      );
      expect(state.lastStopSampleTimestamp).toBe(timestamp + 10000);
    });

    it("should restore lastStopSampleTimestamp from pendingStopLastTimestamp when loading", async () => {
      const timestamp = Date.now();
      const savedTrip = {
        id: "test-trip",
        startTime: new Date().toISOString(),
        distanceMeters: 1000,
        maxSpeed: 50,
        avgSpeed: 30,
        path: [],
        status: "recording" as const,
        driveMode: "city" as const,
        consumption: 10,
        fuelCapacity: 50,
        fuelUsed: 5,
        fuelPrice: 5.0,
        totalCost: 25,
        elapsedTime: 120,
        totalFuelUsed: 5,
        stops: [],
        pendingStopStart: {
          lat: -23.5505,
          lng: -46.6333,
          timestamp,
        },
        pendingStopLastTimestamp: timestamp + 30000,
      };

      const { getCurrentTrip } = await import("@/lib/db");
      (getCurrentTrip as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        savedTrip,
      );

      await act(async () => {
        await useTripStore.getState().loadCurrentTrip();
      });

      const state = useTripStore.getState();
      // Status should remain as recording when loading recording trip (preserves original status)
      expect(state.status).toBe("recording");
      expect(state.lastStopSampleTimestamp).toBe(timestamp + 30000);
    });
  });

  describe("stopTrip - Finalize trip with stops", () => {
    it("should finalize active stop and add to stops[] when stopping", async () => {
      const startTime = 1000000000000;
      vi.setSystemTime(startTime);

      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const stopCoords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: startTime,
      };

      // Start the stop sample
      act(() => {
        useTripStore.getState().registerStopSample(stopCoords, 0);
      });

      // Update the timestamp while stopped (wait 6 seconds to exceed 5s threshold)
      const updateTime = startTime + 6000;
      vi.setSystemTime(updateTime);

      act(() => {
        useTripStore
          .getState()
          .registerStopSample({ ...stopCoords, timestamp: updateTime }, 0);
      });

      // Add distance to meet minimum threshold
      act(() => {
        useTripStore.getState().addPosition({
          lat: -23.5505,
          lng: -46.6333,
          timestamp: startTime + 1000,
          speed: 10 / 3.6,
        });
        useTripStore.getState().addPosition({
          lat: -23.54,
          lng: -46.62,
          timestamp: startTime + 2000,
          speed: 10 / 3.6,
        });
      });

      // Advance elapsed time to meet minimum threshold
      act(() => {
        for (let i = 0; i < 30; i++) {
          useTripStore.getState().tick();
        }
      });

      // Verify the stop state is correct before stopping
      const state = useTripStore.getState();
      expect(state.stopSampleStart).not.toBeNull();
      expect(state.lastStopSampleTimestamp).toBe(updateTime);

      // Now stop the trip - it should use lastStopSampleTimestamp
      const tripId = await act(async () => {
        return await useTripStore.getState().stopTrip(5.0, 2);
      });

      expect(tripId).toBeTruthy();

      // Get the last call to mockSaveTrip (the one from our test, not cleanup)
      const calls = mockSaveTrip.mock.calls;
      const lastCall = calls[calls.length - 1][0];

      expect(lastCall).toMatchObject({
        status: "completed",
        stops: [
          {
            lat: stopCoords.lat,
            lng: stopCoords.lng,
            timestamp: stopCoords.timestamp,
            durationSeconds: 6,
          },
        ],
      });
    });

    it("should clear pendingStopStart and pendingStopLastTimestamp in completed trip", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      const coords = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: Date.now(),
      };

      act(() => {
        useTripStore.getState().registerStopSample(coords, 0);
      });

      act(() => {
        useTripStore.getState().addPosition({
          lat: -23.5505,
          lng: -46.6333,
          timestamp: Date.now() + 1000,
          speed: 10 / 3.6,
        });
        useTripStore.getState().addPosition({
          lat: -23.5405,
          lng: -46.6233,
          timestamp: Date.now() + 2000,
          speed: 10 / 3.6,
        });
      });

      act(() => {
        for (let i = 0; i < 30; i++) {
          useTripStore.getState().tick();
        }
      });

      await act(async () => {
        await useTripStore.getState().stopTrip(5.0, 2);
      });

      expect(mockSaveTrip).toHaveBeenCalled();
      const savedTripArg = mockSaveTrip.mock.calls[0][0];
      expect(savedTripArg.pendingStopStart).toBeNull();
      expect(savedTripArg.pendingStopLastTimestamp).toBeNull();
    });

    it("should complete trip without errors when no active stop", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      act(() => {
        useTripStore.getState().addPosition({
          lat: -23.5505,
          lng: -46.6333,
          timestamp: Date.now() + 1000,
          speed: 10 / 3.6,
        });
        useTripStore.getState().addPosition({
          lat: -23.5405,
          lng: -46.6233,
          timestamp: Date.now() + 2000,
          speed: 10 / 3.6,
        });
      });

      act(() => {
        for (let i = 0; i < 30; i++) {
          useTripStore.getState().tick();
        }
      });

      const tripId = await act(async () => {
        return await useTripStore.getState().stopTrip(5.0, 0);
      });

      expect(tripId).toBeTruthy();
      expect(mockSaveTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        }),
      );
    });

    it("should discard trip with distance below 30m", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      act(() => {
        useTripStore.getState().addPosition({
          lat: -23.5505,
          lng: -46.6333,
          timestamp: Date.now() + 1000,
          speed: 10 / 3.6,
        });
      });

      act(() => {
        for (let i = 0; i < 30; i++) {
          useTripStore.getState().tick();
        }
      });

      const tripId = await act(async () => {
        return await useTripStore.getState().stopTrip(5.0, 0);
      });

      expect(tripId).toBe("");
      expect(mockSaveTrip).not.toHaveBeenCalled();
    });

    it("should discard trip with duration below 30s", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      act(() => {
        useTripStore.getState().addPosition({
          lat: -23.5505,
          lng: -46.6333,
          timestamp: Date.now() + 1000,
          speed: 10 / 3.6,
        });
        useTripStore.getState().addPosition({
          lat: -23.5605,
          lng: -46.6433,
          timestamp: Date.now() + 2000,
          speed: 10 / 3.6,
        });
      });

      act(() => {
        for (let i = 0; i < 10; i++) {
          useTripStore.getState().tick();
        }
      });

      const tripId = await act(async () => {
        return await useTripStore.getState().stopTrip(5.0, 0);
      });

      expect(tripId).toBe("");
      expect(mockSaveTrip).not.toHaveBeenCalled();
    });

    it("should save trip meeting both distance and duration thresholds", async () => {
      await act(async () => {
        await useTripStore.getState().startTrip();
      });

      act(() => {
        useTripStore.getState().addPosition({
          lat: -23.5505,
          lng: -46.6333,
          timestamp: Date.now() + 1000,
          speed: 10 / 3.6,
        });
        useTripStore.getState().addPosition({
          lat: -23.5605,
          lng: -46.6433,
          timestamp: Date.now() + 2000,
          speed: 10 / 3.6,
        });
      });

      act(() => {
        for (let i = 0; i < 30; i++) {
          useTripStore.getState().tick();
        }
      });

      const tripId = await act(async () => {
        return await useTripStore.getState().stopTrip(5.0, 0);
      });

      expect(tripId).toBeTruthy();
      expect(mockSaveTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        }),
      );
    });
  });
});
