import { describe, it, expect } from "vitest";
import { simulate, TelemetryConstants } from "./telemetry-engine";
import type { Vehicle } from "@/types";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const base: Vehicle = {
    id: "test-1",
    name: "Test Car",
    make: "Test",
    model: "Model",
    year: 2024,
    displacement: 1000,
    fuelType: "flex",
    euroNorm: "Euro 6",
    segment: "small",
    urbanKmpl: 10,
    highwayKmpl: 14,
    combinedKmpl: 12,
    mass: 1200,
    grossWeight: 1600,
    frontalArea: 2.2,
    dragCoefficient: 0.3,
    f0: 100,
    f1: 0.5,
    f2: 0.02,
    fuelConversionFactor: 1,
    peakPowerKw: 60,
    peakTorqueNm: 100,
    confidence: "medium",
    calibrationInput: "test",
    calibratedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    fuelCapacity: 50,
    currentFuel: 30,
    dataSource: "manual",
    inmetroCityKmpl: 10.5,
    inmetroHighwayKmpl: 13.5,
    userAvgCityKmpl: 9.8,
    userAvgHighwayKmpl: 12.8,
    weightInmetro: 0.6,
    weightUser: 0.4,
    isHybrid: false,
    gnvCylinderWeightKg: 80,
    gnvEfficiencyFactor: 1.32,
    inmetroEthanolCityKmpl: 7.3,
    inmetroEthanolHighwayKmpl: 9.4,
    userAvgEthanolCityKmpl: 6.8,
    userAvgEthanolHighwayKmpl: 8.9,
    crr: 0.013,
    idleLph: 0.9,
    baseBsfc: 265,
    ...overrides,
  };
  return base;
}

describe("TelemetryEngine", () => {
  describe("constants", () => {
    it("has correct air density", () => {
      expect(TelemetryConstants.AIR_DENSITY).toBe(1.225);
    });

    it("has correct gravity", () => {
      expect(TelemetryConstants.G).toBe(9.81);
    });
  });

  describe("simulate - base scenarios", () => {
    it("returns reasonable consumption for city driving", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 35,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.kmpl).toBeGreaterThan(5);
      expect(result.kmpl).toBeLessThan(20);
      expect(result.factors.baseKmpl).toBeGreaterThan(9);
    });

    it("returns higher consumption for highway driving", () => {
      const vehicle = makeVehicle();
      const cityResult = simulate(vehicle, {
        speed: 35,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const highwayResult = simulate(vehicle, {
        speed: 100,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(highwayResult.kmpl).toBeGreaterThan(cityResult.kmpl);
    });

    it("applies mass penalty for extra passengers", () => {
      const vehicle = makeVehicle();
      const base = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const loaded = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 4,
        cargoKg: 50,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(loaded.factors.massPenalty).toBeGreaterThan(1.0);
      expect(loaded.kmpl).toBeLessThan(base.kmpl);
    });

    it("applies penalty for uphill slope", () => {
      const vehicle = makeVehicle();
      const flat = simulate(vehicle, {
        speed: 60,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const uphill = simulate(vehicle, {
        speed: 60,
        slope: 5,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(uphill.factors.dynamicFactor).toBeLessThan(
        flat.factors.dynamicFactor,
      );
      expect(uphill.kmpl).toBeLessThan(flat.kmpl);
    });

    it("applies penalty for acceleration", () => {
      const vehicle = makeVehicle();
      const steady = simulate(vehicle, {
        speed: 60,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const accelerating = simulate(vehicle, {
        speed: 60,
        slope: 0,
        accel: 2,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(accelerating.factors.dynamicFactor).toBeLessThan(
        steady.factors.dynamicFactor,
      );
      expect(accelerating.kmpl).toBeLessThan(steady.kmpl);
    });

    it("applies AC penalty", () => {
      const vehicle = makeVehicle();
      const noAc = simulate(vehicle, {
        speed: 40,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const withAc = simulate(vehicle, {
        speed: 40,
        slope: 0,
        accel: 0,
        acOn: true,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(withAc.factors.acFactor).toBeLessThan(1.0);
      expect(withAc.kmpl).toBeLessThan(noAc.kmpl);
    });

    it("returns idle consumption when speed is zero", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 0,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.kmpl).toBeGreaterThanOrEqual(3);
      expect(result.lphOrM3ph).toBe(vehicle.idleLph);
    });
  });

  describe("simulate - fuel types", () => {
    it("returns lower kmpl for ethanol vs gasoline", () => {
      const vehicle = makeVehicle();
      const gasoline = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const ethanol = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "etanol",
        batterySocPct: 100,
      });

      expect(ethanol.kmpl).toBeLessThan(gasoline.kmpl);
    });

    it("applies GNV efficiency factor", () => {
      const vehicle = makeVehicle();
      const gasoline = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const gnv = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gnv",
        batterySocPct: 100,
      });

      expect(gnv.factors.massPenalty).toBeGreaterThan(
        gasoline.factors.massPenalty,
      );
    });
  });

  describe("simulate - hybrid", () => {
    it("improves consumption in city mode for hybrids", () => {
      const hybrid = makeVehicle({ isHybrid: true });
      const cityResult = simulate(hybrid, {
        speed: 30,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 80,
      });

      expect(cityResult.factors.hybridImprovement).toBe(1.6);
      expect(cityResult.updatedBatterySocPct).toBeLessThan(80);
    });

    it("has smaller improvement on highway for hybrids", () => {
      const hybrid = makeVehicle({ isHybrid: true });
      const highwayResult = simulate(hybrid, {
        speed: 100,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 50,
      });

      expect(highwayResult.factors.hybridImprovement).toBe(1.1);
    });

    it("does not drain battery below 20%", () => {
      const hybrid = makeVehicle({ isHybrid: true });
      const result = simulate(hybrid, {
        speed: 30,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 20,
      });

      expect(result.updatedBatterySocPct).toBe(20);
    });

    it("charges battery on highway", () => {
      const hybrid = makeVehicle({ isHybrid: true });
      const result = simulate(hybrid, {
        speed: 100,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 50,
      });

      expect(result.updatedBatterySocPct).toBeGreaterThan(50);
    });
  });

  describe("simulate - edge cases", () => {
    it("enforces minimum kmpl of 3.0", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 180,
        slope: 10,
        accel: 5,
        acOn: true,
        passengers: 5,
        cargoKg: 200,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.kmpl).toBeGreaterThanOrEqual(3.0);
    });

    it("handles negative slope (downhill)", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 60,
        slope: -5,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.factors.dynamicFactor).toBeGreaterThan(1.0);
    });

    it("activates fuel cut on steep downhill", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 60,
        slope: -4,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.factors.fuelCutActive).toBe(true);
    });
  });
});
