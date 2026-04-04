import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDriveMode } from "./useDriveMode";
import type { Vehicle } from "@/types";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const now = new Date().toISOString();
  return {
    id: "test-vehicle-1",
    name: "Corolla 2.0 Flex",
    make: "Toyota",
    model: "Corolla",
    year: 2020,
    displacement: 1987,
    fuelType: "flex",
    euroNorm: "Euro 6" as const,
    segment: "medium" as const,
    urbanKmpl: 9.2,
    highwayKmpl: 13.1,
    combinedKmpl: 10.8,
    mass: 1350,
    grossWeight: 1800,
    frontalArea: 2.2,
    dragCoefficient: 0.29,
    f0: 120,
    f1: 2.5,
    f2: 0.42,
    fuelConversionFactor: 1,
    peakPowerKw: 110,
    peakTorqueNm: 200,
    confidence: "high" as const,
    calibrationInput: "Toyota Corolla 2.0 2020",
    calibratedAt: now,
    createdAt: now,
    fuelCapacity: 50,
    currentFuel: 30,
    ...overrides,
  };
}

describe("useDriveMode with Vehicle integration", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe("vehicle fuel data", () => {
    it("uses vehicle currentFuel for estimatedRange", () => {
      const vehicle = makeVehicle({ currentFuel: 25 });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      const range = result.current.estimatedRange;
      expect(range).toBeGreaterThan(0);
      const maxPossibleRange = vehicle.currentFuel * vehicle.urbanKmpl;
      expect(range).toBeLessThanOrEqual(maxPossibleRange);
    });

    it("updates range when currentFuel prop changes", () => {
      const vehicle = makeVehicle({ currentFuel: 40 });
      const { result, rerender } = renderHook(
        ({ v, fuel }) => useDriveMode(0, fuel, 0, v),
        { initialProps: { v: vehicle, fuel: 40 } },
      );

      const initialRange = result.current.estimatedRange;

      rerender({ v: vehicle, fuel: 20 });

      const newRange = result.current.estimatedRange;
      expect(newRange).toBeLessThan(initialRange);
    });

    it("returns zero range when vehicle fuel is zero", () => {
      const vehicle = makeVehicle({ currentFuel: 0 });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      expect(result.current.estimatedRange).toBe(0);
    });
  });

  describe("vehicle calibration data", () => {
    it("marks consumption as calibrated when vehicle has f0/f1/f2", () => {
      const vehicle = makeVehicle();
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 15,
          timestamp: 1000,
        });
      });

      expect(result.current.consumptionFactors.calibrated).toBe(true);
    });

    it("uses vehicle displacement for displacementFactor", () => {
      const vehicle = makeVehicle({ displacement: 2000 });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      const factors = result.current.consumptionFactors;
      const expectedFactor = Math.pow(2000 / 1600, -0.15);
      expect(factors.displacementFactor).toBeCloseTo(expectedFactor, 4);
    });

    it("uses vehicle fuelType for fuelEnergyFactor (flex)", () => {
      const vehicle = makeVehicle({ fuelType: "flex" });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      expect(result.current.consumptionFactors.fuelEnergyFactor).toBeCloseTo(
        0.87,
        4,
      );
    });

    it("maps gasoline fuelType correctly", () => {
      const vehicle = makeVehicle({ fuelType: "gasoline" });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      expect(result.current.consumptionFactors.fuelEnergyFactor).toBeCloseTo(
        0.91,
        4,
      );
    });

    it("maps ethanol fuelType correctly", () => {
      const vehicle = makeVehicle({ fuelType: "ethanol" });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      expect(result.current.consumptionFactors.fuelEnergyFactor).toBeCloseTo(
        0.7,
        4,
      );
    });

    it("maps diesel fuelType to gasolina energy factor", () => {
      const vehicle = makeVehicle({ fuelType: "diesel" });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      expect(result.current.consumptionFactors.fuelEnergyFactor).toBeCloseTo(
        0.91,
        4,
      );
    });
  });

  describe("vehicle consumption values", () => {
    it("uses vehicle urbanKmpl for city mode base consumption", () => {
      const vehicle = makeVehicle({ urbanKmpl: 9.5 });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      expect(result.current.consumptionFactors.baseKmPerLiter).toBe(9.5);
    });

    it("uses vehicle highwayKmpl after mode transitions to highway", () => {
      const vehicle = makeVehicle({ highwayKmpl: 13.5, urbanKmpl: 9 });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 25,
          timestamp: Date.now() - 15000,
        });
      });

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 25,
          timestamp: Date.now(),
        });
      });

      expect(result.current.currentKmPerLiter).toBe(13.5);
    });

    it("uses vehicle combinedKmpl for mixed mode base consumption", () => {
      const vehicle = makeVehicle({
        combinedKmpl: 11.2,
        urbanKmpl: 9,
        highwayKmpl: 13,
      });
      const { result } = renderHook(
        ({ v }) => useDriveMode(0, v.currentFuel, 0, v),
        { initialProps: { v: vehicle } },
      );

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 14,
          timestamp: 1000,
        });
      });

      const factors = result.current.consumptionFactors;
      expect(factors.baseKmPerLiter).toBeGreaterThanOrEqual(9);
      expect(factors.baseKmPerLiter).toBeLessThanOrEqual(13);
    });

    it("reset uses vehicle urbanKmpl as default", () => {
      const vehicle = makeVehicle({ urbanKmpl: 8.5 });
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      act(() => {
        result.current.reset();
      });

      expect(result.current.currentKmPerLiter).toBe(8.5);
    });
  });

  describe("grade/inclination with vehicle mass", () => {
    it("uphill grade reduces average consumption compared to flat", () => {
      const vehicle = makeVehicle({ mass: 1500 });
      const { result: flatResult } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 0, vehicle),
      );

      const { result: uphillResult } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, 10, vehicle),
      );

      act(() => {
        flatResult.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 16.67,
          timestamp: 1000,
        });
        uphillResult.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 16.67,
          timestamp: 1000,
        });
      });

      const flatAvg = flatResult.current.getAverageConsumption();
      const uphillAvg = uphillResult.current.getAverageConsumption();

      expect(uphillAvg).toBeLessThan(flatAvg);
    });

    it("activates fuel cut on steep downhill (grade < -3%)", () => {
      const vehicle = makeVehicle();
      const { result } = renderHook(() =>
        useDriveMode(0, vehicle.currentFuel, -5, vehicle),
      );

      act(() => {
        result.current.addPosition({
          lat: -23.55,
          lng: -46.63,
          speed: 16.67,
          timestamp: 1000,
        });
      });

      expect(result.current.consumptionFactors.fuelCutActive).toBe(true);
      expect(result.current.consumptionFactors.copertKmPerLiter).toBe(0);
    });
  });

  describe("different vehicle types", () => {
    it("works with small car (low displacement, low mass)", () => {
      const smallCar = makeVehicle({
        displacement: 1000,
        mass: 900,
        urbanKmpl: 12,
        highwayKmpl: 16,
        combinedKmpl: 14,
        f0: 80,
        f1: 1.5,
        f2: 0.3,
      });

      const { result } = renderHook(() =>
        useDriveMode(0, smallCar.currentFuel, 0, smallCar),
      );

      expect(
        result.current.consumptionFactors.displacementFactor,
      ).toBeGreaterThan(1);
      expect(result.current.consumptionFactors.baseKmPerLiter).toBe(12);
    });

    it("works with SUV (high displacement, high mass)", () => {
      const suv = makeVehicle({
        displacement: 3000,
        mass: 2200,
        urbanKmpl: 6,
        highwayKmpl: 9,
        combinedKmpl: 7.5,
        f0: 200,
        f1: 4,
        f2: 0.6,
      });

      const { result } = renderHook(() =>
        useDriveMode(0, suv.currentFuel, 0, suv),
      );

      expect(result.current.consumptionFactors.displacementFactor).toBeLessThan(
        1,
      );
      expect(result.current.consumptionFactors.baseKmPerLiter).toBe(6);
    });
  });

  describe("vehicle changes mid-session", () => {
    it("updates consumption values when vehicle prop changes", () => {
      const vehicle1 = makeVehicle({ urbanKmpl: 10, id: "v1" });
      const vehicle2 = makeVehicle({ urbanKmpl: 7, id: "v2" });

      const { result, rerender } = renderHook(
        ({ v, fuel }) => useDriveMode(0, fuel, 0, v),
        { initialProps: { v: vehicle1, fuel: vehicle1.currentFuel } },
      );

      expect(result.current.consumptionFactors.baseKmPerLiter).toBe(10);

      rerender({ v: vehicle2, fuel: vehicle2.currentFuel });

      expect(result.current.consumptionFactors.baseKmPerLiter).toBe(7);
    });
  });
});
