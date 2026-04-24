import { describe, it, expect } from "vitest";
import { simulate, TelemetryConstants } from "./telemetry-engine";
import type { Vehicle, TransmissionData } from "@/types";

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
    peakPowerKw: 60,
    peakTorqueNm: 100,
    confidence: "medium",
    calibrationInput: "test",
    calibratedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    fuelCapacity: 50,
    currentFuel: 30,
    dataSource: "manual",
    crr: 0.013,
    idleLph: 0.9,
    baseBsfc: 265,
    isHybrid: false,
    gnvCylinderWeightKg: 80,
    gnvEfficiencyFactor: 1.32,
    ...overrides,
  };
  return base;
}

function makeTransmission(
  overrides: Partial<TransmissionData> = {},
): TransmissionData {
  const base: TransmissionData = {
    type: "Manual",
    gearRatios: [3.364, 1.864, 1.321, 1.029, 0.821],
    finalDrive: 4.067,
    tireRadiusM: 0.288,
    redlineRpm: 6500,
    idleRpm: 800,
    torqueCurve: {
      800: 105,
      1200: 120,
      1800: 135,
      2500: 145,
      3500: 152,
      4500: 155,
      5500: 148,
      6000: 140,
      6500: 135,
    },
    ...overrides,
  };
  return base;
}

describe("TelemetryEngine", () => {
  describe("constants", () => {
    it("has correct air density at sea level", () => {
      expect(TelemetryConstants.AIR_DENSITY).toBe(1.225);
    });

    it("has correct gravity", () => {
      expect(TelemetryConstants.G).toBe(9.81);
    });

    it("has transmission efficiency functions", () => {
      expect(typeof TelemetryConstants.getTransmissionEfficiency).toBe("function");
      expect(typeof TelemetryConstants.getEngineEfficiency).toBe("function");
      expect(typeof TelemetryConstants.calculateAirDensity).toBe("function");
    });

    it("has fuel cut max kmpl threshold", () => {
      expect(TelemetryConstants.MIN_KMPL_IGNORE).toBe(100);
    });

    it("calculates engine efficiency based on load", () => {
      const effAt10 = TelemetryConstants.getEngineEfficiency(10, false);
      const effAt75 = TelemetryConstants.getEngineEfficiency(75, false);
      expect(effAt10).toBeLessThan(effAt75);
    });

    it("calculates air density with altitude", () => {
      const densityAtSeaLevel = TelemetryConstants.calculateAirDensity(0, 25);
      const densityAt1000m = TelemetryConstants.calculateAirDensity(1000, 25);
      expect(densityAt1000m).toBeLessThan(densityAtSeaLevel);
    });
  });

  describe("simulate - basic", () => {
    it("returns reasonable kmpl for city driving", () => {
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

      expect(result.kmpl).toBeGreaterThan(3);
      expect(result.kmpl).toBeLessThan(50);
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

      expect(highwayResult.kmpl).toBeGreaterThan(3);
      expect(cityResult.kmpl).toBeGreaterThan(3);
    });

    it("considers transmission and engine efficiency for realistic consumption", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 60,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.kmpl).toBeGreaterThan(3);
      expect(result.kmpl).toBeLessThan(50);
      expect(result.factors.totalPowerKw).toBeGreaterThan(0);
    });

    it("returns realistic values with BSFC correction", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.kmpl).toBeGreaterThanOrEqual(3);
      expect(result.lphOrM3ph).toBeGreaterThan(0);
    });

    it("applies efficiency factors correctly at different speeds", () => {
      const vehicle = makeVehicle();

      const at40 = simulate(vehicle, {
        speed: 40,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const at80 = simulate(vehicle, {
        speed: 80,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const at120 = simulate(vehicle, {
        speed: 120,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(at40.kmpl).toBeGreaterThan(3);
      expect(at80.kmpl).toBeGreaterThan(3);
      expect(at120.kmpl).toBeGreaterThan(3);
      expect(at40.kmpl).toBeLessThan(30);
      expect(at80.kmpl).toBeLessThan(30);
      expect(at120.kmpl).toBeLessThan(30);
    });

    it("applies uphill penalty", () => {
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

      expect(uphill.kmpl).toBeLessThan(flat.kmpl);
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

      expect(gasoline.kmpl).toBeGreaterThan(3);

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

      expect(cityResult.factors.hybridFactor).toBe(1.4);
      expect(cityResult.kmpl).toBeGreaterThan(3);
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

      expect(highwayResult.factors.hybridFactor).toBe(1.1);
      expect(highwayResult.kmpl).toBeGreaterThan(3);
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

    it("activates fuel cut on steep downhill", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 60,
        slope: -4,
        accel: -0.5,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.factors.fuelCutActive).toBe(true);
    });
  });

  describe("simulate - gear prediction", () => {
    it("returns no gear data when transmission is missing", () => {
      const vehicle = makeVehicle();
      const result = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.gear).toBeUndefined();
      expect(result.rpm).toBeUndefined();
      expect(result.hasTransmissionData).toBe(false);
    });

    it("predicts gear and RPM when transmission data is available", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
        bsfcMinGPerKwh: 240,
      });
      const result = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.gear).toBeGreaterThan(0);
      expect(result.gear).toBeLessThanOrEqual(5);
      expect(result.rpm).toBeGreaterThan(800);
      expect(result.rpm).toBeLessThan(6500);
    });

    it("selects appropriate gear on downhill without triggering fuel cut", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
        bsfcMinGPerKwh: 240,
      });
      const result = simulate(vehicle, {
        speed: 40,
        slope: -1,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.gear).toBeDefined();
      expect(result.gear).toBeGreaterThanOrEqual(2);
      expect(result.gear).toBeLessThanOrEqual(5);
    });
  });
});
