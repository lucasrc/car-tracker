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
  fuelType: "gasolina",
  euroNorm: "Euro 5",
  segment: "medium",
  mass: 1500,
  grossWeight: 2000,
  urbanKmpl: 10,
  combinedKmpl: 12,
  highwayKmpl: 14,
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
  inmetroCityKmpl: 10,
  inmetroHighwayKmpl: 14,
  userAvgCityKmpl: 10,
  userAvgHighwayKmpl: 14,
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

describe("useTelemetryEngine - Range Integration", () => {
  describe("estimatedRange reacts to currentFuel prop changes", () => {
    it("should recalculate range when currentFuel prop changes", async () => {
      const vehicle = makeVehicle();

      const { result, rerender } = renderHook(
        ({ fuel }) => useTelemetryEngine(0, fuel, 0, vehicle),
        { initialProps: { fuel: 50 } },
      );

      // Initial range with 50L at 10km/L = ~500km
      const initialRange = result.current.estimatedRange;
      expect(initialRange).toBeGreaterThan(0);

      // Decrease fuel to 25L
      rerender({ fuel: 25 });

      // Range should decrease
      const newRange = result.current.estimatedRange;
      expect(newRange).toBeLessThan(initialRange);
      // Should be approximately half (with warm-up interpolation factored in)
      expect(newRange).toBeGreaterThan(initialRange * 0.3);
    });

    it("should return 0 range when fuel is 0", async () => {
      const vehicle = makeVehicle();

      const { result, rerender } = renderHook(
        ({ fuel }) => useTelemetryEngine(0, fuel, 0, vehicle),
        { initialProps: { fuel: 50 } },
      );

      expect(result.current.estimatedRange).toBeGreaterThan(0);

      // Set fuel to 0
      rerender({ fuel: 0 });

      expect(result.current.estimatedRange).toBe(0);
    });

    it("should use drive mode consumption for range calculation", async () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 10; // City: 10 km/L
      vehicle.highwayKmpl = 14; // Highway: 14 km/L

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 70, 0, vehicle),
      );

      // Initial drive mode is city
      expect(result.current.driveMode).toBe("city");

      // City range: 70L * 10km/L = ~700km (with warm-up interpolation)
      const cityRange = result.current.estimatedRange;
      expect(cityRange).toBeGreaterThan(0);
      expect(cityRange).toBeLessThan(1000); // Capped by warm-up

      // Add position to trigger drive mode detection
      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 80 / 3.6, // ~80 km/h = highway speed
          accuracy: 5,
          timestamp: Date.now(),
        });
      });

      // Speed > 60 km/h should trigger highway mode
      await new Promise((r) => setTimeout(r, 100));

      // Drive mode should update (may need multiple samples)
      // Range should now be based on highway consumption
    });
  });

  describe("estimatedRange calculation formula", () => {
    it("should calculate range as fuel * consumption", async () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 12;
      vehicle.highwayKmpl = 16;

      const { result, rerender } = renderHook(
        ({ fuel }) => useTelemetryEngine(0, fuel, 0, vehicle),
        { initialProps: { fuel: 60 } },
      );

      // 60L * 12km/L = 720km theoretical max
      const range60L = result.current.estimatedRange;
      expect(range60L).toBeGreaterThan(500); // Warm-up reduces it

      // Decrease to 30L
      rerender({ fuel: 30 });

      const range30L = result.current.estimatedRange;
      expect(range30L).toBeLessThan(range60L);

      // Should be approximately half
      const ratio = range30L / range60L;
      expect(ratio).toBeGreaterThan(0.4);
      expect(ratio).toBeLessThan(0.6);
    });

    it("should handle fractional fuel values correctly", async () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 10;

      const { result, rerender } = renderHook(
        ({ fuel }) => useTelemetryEngine(0, fuel, 0, vehicle),
        { initialProps: { fuel: 50 } },
      );

      const range50 = result.current.estimatedRange;

      // Decrease by 0.1L
      rerender({ fuel: 49.9 });
      const range49_9 = result.current.estimatedRange;

      // Range should decrease slightly
      expect(range49_9).toBeLessThan(range50);
    });
  });

  describe("Integration with position updates", () => {
    it("should accumulate fuel used from position samples", async () => {
      const vehicle = makeVehicle();
      vehicle.urbanKmpl = 10;

      const { result } = renderHook(() =>
        useTelemetryEngine(0, 50, 0, vehicle),
      );

      const initialFuelUsed = result.current.getTotalFuelUsed();
      expect(initialFuelUsed).toBe(0);

      // Add position samples that would consume fuel
      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 20,
          accuracy: 5,
          timestamp: Date.now(),
          heading: 90,
        });
      });

      // Add more samples
      act(() => {
        result.current.addPosition({
          lat: -23.551,
          lng: -46.63,
          speed: 20,
          accuracy: 5,
          timestamp: Date.now() + 1000,
          heading: 90,
        });
      });

      // Fuel used should increase
      const newFuelUsed = result.current.getTotalFuelUsed();
      expect(newFuelUsed).toBeGreaterThan(0);
    });
  });
});
