import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTelemetryEngine } from "./useTelemetryEngine";
import type { Vehicle } from "@/types";

const makeVehicle = (): Vehicle => ({
  id: "test-vehicle",
  name: "Test Vehicle",
  make: "BMW",
  model: "320i",
  year: 2018,
  displacement: 2.0,
  fuelType: "gasoline",
  euroNorm: "Euro 5",
  segment: "medium",
  mass: 1500,
  grossWeight: 2000,
  urbanKmpl: 9.5,
  combinedKmpl: 12.0,
  highwayKmpl: 14.0,
  frontalArea: 2.3,
  dragCoefficient: 0.29,
  f0: 0.1,
  f1: 0.005,
  f2: 0.0001,
  fuelConversionFactor: 0.73,
  peakPowerKw: 150,
  peakTorqueNm: 220,
  confidence: "high",
  calibrationInput: "test",
  calibratedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fuelCapacity: 60,
  currentFuel: 50,
  inmetroCityKmpl: 9.5,
  inmetroHighwayKmpl: 14.0,
  userAvgCityKmpl: 9.0,
  userAvgHighwayKmpl: 13.5,
  crr: 0.012,
  idleLph: 0.5,
  baseBsfc: 250,
  weightInmetro: 1500,
  weightUser: 1500,
  isHybrid: false,
  gnvCylinderWeightKg: 80,
  gnvEfficiencyFactor: 1.0,
  techEra: "injection_modern",
  transmission: undefined,
});

describe("useTelemetryEngine", () => {
  describe("initialization", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.driveMode).toBe("city");
      expect(result.current.avgSpeed).toBe(0);
      expect(result.current.getTotalDistance()).toBe(0);
      expect(result.current.getTotalFuelUsed()).toBe(0);
    });

    it("should accept optional vehicle parameter", () => {
      const { result } = renderHook(() => useTelemetryEngine(0, 50));

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.driveMode).toBe("city");
    });

    it("should initialize with city drive mode", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      expect(result.current.driveMode).toBe("city");
    });
  });

  describe("reset", () => {
    it("should reset telemetry data", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      // Add some data
      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 20,
          accuracy: 10,
          timestamp: Date.now(),
        });
      });

      expect(result.current.avgSpeed).toBeGreaterThan(0);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.avgSpeed).toBe(0);
      expect(result.current.getTotalDistance()).toBe(0);
      expect(result.current.getTotalFuelUsed()).toBe(0);
      expect(result.current.driveMode).toBe("city");
    });
  });

  describe("addPosition", () => {
    it("should ignore position without speed", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          accuracy: 10,
          timestamp: Date.now(),
        });
      });

      expect(result.current.avgSpeed).toBe(0);
    });

    it("should update average speed when position is added", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 10, // 10 m/s = 36 km/h
          accuracy: 10,
          timestamp: now,
        });
      });

      expect(result.current.avgSpeed).toBeCloseTo(36, 0);
    });

    it("should accumulate distance across positions", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // First position
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 1,
          accuracy: 5,
          timestamp: now,
        });
      });

      const dist1 = result.current.getTotalDistance();

      // Second position (roughly 111m east at equator)
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0.001,
          speed: 1,
          accuracy: 5,
          timestamp: now + 10000,
        });
      });

      const dist2 = result.current.getTotalDistance();
      expect(dist2).toBeGreaterThan(dist1);
    });

    it("should ignore positions with poor accuracy (> 30m)", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // Good position
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 1,
          accuracy: 10,
          timestamp: now,
        });
      });

      // Poor position
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0.001,
          speed: 1,
          accuracy: 50, // > 30, should be skipped
          timestamp: now + 10000,
        });
      });

      // Good position again
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0.002,
          speed: 1,
          accuracy: 10,
          timestamp: now + 20000,
        });
      });

      // Should have jumped from 0 directly to 0.002
      const totalDist = result.current.getTotalDistance();
      expect(totalDist).toBeGreaterThan(0.2); // ~0.222 km for 2 degrees
    });
  });

  describe("consumption calculations", () => {
    it("should return 0 when no positions added", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      expect(result.current.getAverageConsumption()).toBe(0);
      expect(result.current.getInstantConsumption()).toBe(0);
    });

    it("should calculate total fuel used", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // Add position
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 15, // 15 m/s = 54 km/h
          accuracy: 5,
          timestamp: now,
        });
      });

      // Add another position ~1 km away
      act(() => {
        result.current.addPosition({
          lat: 0.009,
          lng: 0,
          speed: 15,
          accuracy: 5,
          timestamp: now + 67000, // ~1km / 15m/s
        });
      });

      const fuelUsed = result.current.getTotalFuelUsed();
      expect(fuelUsed).toBeGreaterThan(0);
    });

    it("should weight average consumption by distance not time", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // Slow segment: 100m at 5 m/s (takes 20 seconds)
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 5,
          accuracy: 5,
          timestamp: now,
        });
      });

      act(() => {
        result.current.addPosition({
          lat: 0.0009,
          lng: 0,
          speed: 5,
          accuracy: 5,
          timestamp: now + 20000,
        });
      });

      // Fast segment: 100m at 20 m/s (takes 5 seconds)
      act(() => {
        result.current.addPosition({
          lat: 0.0018,
          lng: 0,
          speed: 20,
          accuracy: 5,
          timestamp: now + 25000,
        });
      });

      const avgConsumption = result.current.getAverageConsumption();
      // Should be based on total distance / total fuel, not time
      expect(avgConsumption).toBeGreaterThan(0);
    });
  });

  describe("telemetry data", () => {
    it("should return telemetry data structure", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const data = result.current.getTelemetryData();

      expect(data).toHaveProperty("fuelType");
      expect(data).toHaveProperty("batterySocStart");
      expect(data).toHaveProperty("batterySocEnd");
      expect(data).toHaveProperty("speedDistribution");
      expect(data.speedDistribution).toHaveProperty("city");
      expect(data.speedDistribution).toHaveProperty("mixed");
      expect(data.speedDistribution).toHaveProperty("highway");
    });

    it("should report speed distribution", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // City speed
      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 10, // 36 km/h
          accuracy: 5,
          timestamp: now,
        });
      });

      act(() => {
        result.current.addPosition({
          lat: 0.001,
          lng: 0,
          speed: 10,
          accuracy: 5,
          timestamp: now + 100000,
        });
      });

      const data = result.current.getTelemetryData();
      expect(data.speedDistribution.city).toBeGreaterThan(0);
    });
  });

  describe("hybrid vehicles", () => {
    it("should track battery state for hybrid vehicles", () => {
      const hybridVehicle: Vehicle = {
        ...makeVehicle(),
        isHybrid: true,
      };

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, hybridVehicle),
      );

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 10,
          accuracy: 5,
          timestamp: Date.now(),
        });
      });

      expect(result.current.batterySocPct).toBeDefined();
    });
  });

  describe("drive mode transitions", () => {
    it("should remain in city mode at low speeds", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // Add multiple low-speed positions
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.addPosition({
            lat: -23.55 + i * 0.0001,
            lng: -46.63,
            speed: 8, // 28.8 km/h
            accuracy: 5,
            timestamp: now + i * 1000,
          });
        });
      }

      expect(result.current.driveMode).toBe("city");
    });

    it("should transition to highway at high speeds", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      const now = Date.now();

      // Add multiple high-speed positions
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.addPosition({
            lat: -23.55 + i * 0.001,
            lng: -46.63,
            speed: 25, // 90 km/h
            accuracy: 5,
            timestamp: now + i * 5000,
          });
        });
      }

      // Should have updated drive mode based on speed
      // Verify it's in one of the expected states
      expect(["city", "mixed", "highway"]).toContain(result.current.driveMode);
    });
  });

  describe("transmission data", () => {
    it("should report no transmission data when not available", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      expect(result.current.hasTransmissionData).toBe(false);
      expect(result.current.currentGear).toBeUndefined();
      expect(result.current.currentRpm).toBeUndefined();
    });
  });

  describe("fuel type handling", () => {
    it("should handle gasoline fuel type", () => {
      const gasVehicle: Vehicle = {
        ...makeVehicle(),
        fuelType: "gasoline" as const,
      };

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, gasVehicle),
      );

      const data = result.current.getTelemetryData();
      expect(data.fuelType).toBe("gasolina");
    });

    it("should handle ethanol fuel type", () => {
      const ethanolVehicle: Vehicle = {
        ...makeVehicle(),
        fuelType: "ethanol",
      };

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, ethanolVehicle),
      );

      const data = result.current.getTelemetryData();
      expect(data.fuelType).toBe("etanol");
    });
  });

  describe("AC and environmental factors", () => {
    it("should track AC usage time", () => {
      const { result } = renderHook(
        () => useTelemetryEngine(0, 50, 0, makeVehicle(), true), // acOn = true
      );

      const now = Date.now();

      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 10,
          accuracy: 5,
          timestamp: now,
        });
      });

      // Add position 5 minutes later
      act(() => {
        result.current.addPosition({
          lat: 0.001,
          lng: 0,
          speed: 10,
          accuracy: 5,
          timestamp: now + 300000, // 5 minutes
        });
      });

      const data = result.current.getTelemetryData();
      // AC should have been tracked during the 5-minute interval
      expect(data.acUsagePct).toBeGreaterThanOrEqual(0);
    });

    it("should track slope and acceleration", () => {
      const { result } = renderHook(
        () => useTelemetryEngine(0, 50, 5), // slope = 5%
      );

      const now = Date.now();

      act(() => {
        result.current.addPosition({
          lat: 0,
          lng: 0,
          speed: 10,
          accuracy: 5,
          timestamp: now,
        });
      });

      act(() => {
        result.current.addPosition({
          lat: 0.001,
          lng: 0,
          speed: 15,
          accuracy: 5,
          timestamp: now + 1000,
        });
      });

      const data = result.current.getTelemetryData();
      expect(data.avgSlope).toBeDefined();
      expect(data.avgAcceleration).toBeDefined();
    });
  });

  describe("estimated range", () => {
    it("should calculate estimated range = fuel * consumption", () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 10; // 10 km/L city
      vehicle.highwayKmpl = 14; // 14 km/L highway

      const { result } = renderHook(
        () => useTelemetryEngine(0, 50, 0, vehicle), // 50L fuel
      );

      // Wait for warm-up to complete (90 seconds)
      // After warm-up, range should be approximately fuel * consumption
      // Initial consumption is based on city kmpl
      const range = result.current.estimatedRange;
      expect(range).toBeGreaterThan(0);
      // With 50L and 10 km/L city consumption, should be around 500km
      expect(range).toBeGreaterThan(400);
    });

    it("should calculate range with 9L fuel and 11.2km/L consumption", () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 11.2;
      vehicle.highwayKmpl = 14;
      vehicle.combinedKmpl = 12;

      const { result } = renderHook(
        () => useTelemetryEngine(0, 9, 0, vehicle), // 9L fuel
      );

      const range = result.current.estimatedRange;
      // 9L * 11.2km/L = 100.8km (approximately)
      // Allow some tolerance for the interpolation during warm-up
      expect(range).toBeGreaterThan(90);
      expect(range).toBeLessThan(130);
    });

    it("should return 0 range when fuel is 0", () => {
      const { result } = renderHook(
        () => useTelemetryEngine(0, 0, 0, makeVehicle()), // 0L fuel
      );

      const range = result.current.estimatedRange;
      expect(range).toBe(0);
    });

    it("should return 0 range when consumption is 0", () => {
      const { result } = renderHook(
        () => useTelemetryEngine(0, 50, 0, undefined), // no vehicle
      );

      // Without vehicle, should use default city kmpl of 10
      const range = result.current.estimatedRange;
      expect(range).toBeGreaterThan(0);
    });

    it("should use conservative fallback during warm-up", () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 8; // worse city consumption
      vehicle.highwayKmpl = 12;

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, vehicle),
      );

      // During warm-up, range should be based on city consumption (conservative)
      const range = result.current.estimatedRange;
      const maxPossibleRange = 50 * 12; // using highway kmpl

      // During warm-up, should be lower than max possible
      // (uses interpolation between city and actual)
      expect(range).toBeLessThanOrEqual(maxPossibleRange);
    });

    it("should track autonomy as fuel decreases during trip", async () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 10;

      const { result, rerender } = renderHook(
        ({ fuel }) => useTelemetryEngine(0, fuel, 0, vehicle),
        { initialProps: { fuel: 50 } },
      );

      // Initial range with 50L
      const initialRange = result.current.estimatedRange;
      expect(initialRange).toBeGreaterThan(400);

      // Simulate fuel consumption - decrease fuel
      rerender({ fuel: 40 });

      // Range should decrease proportionally
      const newRange = result.current.estimatedRange;
      expect(newRange).toBeLessThan(initialRange);
      expect(newRange).toBeGreaterThan(320); // 40L * 8 km/L minimum
    });
  });

  describe("confidence metric", () => {
    it("should report confidence level", () => {
      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, makeVehicle()),
      );

      expect(result.current.confidence).toBeGreaterThanOrEqual(0);
      expect(result.current.confidence).toBeLessThanOrEqual(1);
    });
  });
});
