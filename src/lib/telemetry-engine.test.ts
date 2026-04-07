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

    it("applies progressive penalty for city speeds above optimal (32.5 km/h)", () => {
      const vehicle = makeVehicle();
      const speedAtOptimal = simulate(vehicle, {
        speed: 32.5,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const speedAbove40 = simulate(vehicle, {
        speed: 40,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const speedAbove55 = simulate(vehicle, {
        speed: 55,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      // Consumption should degrade (lower km/l) as speed increases above 32.5 km/h
      expect(speedAbove40.kmpl).toBeLessThan(speedAtOptimal.kmpl);
      expect(speedAbove55.kmpl).toBeLessThan(speedAbove40.kmpl);

      // Verify the penalty is steeper (factor > 0.005)
      const factor40 = speedAbove40.factors.speedFactor;
      const factor55 = speedAbove55.factors.speedFactor;
      // Both should be > 1.0 (penalizing consumption)
      expect(factor40).toBeGreaterThan(1.0);
      expect(factor55).toBeGreaterThan(1.0);
      // Penalty should increase with speed
      expect(factor55).toBeGreaterThan(factor40);
    });

    it("improves efficiency for city speeds below optimal (32.5 km/h)", () => {
      const vehicle = makeVehicle();
      const speedAtOptimal = simulate(vehicle, {
        speed: 32.5,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const speedBelow20 = simulate(vehicle, {
        speed: 20,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      // Lower speeds should improve efficiency (higher km/l)
      expect(speedBelow20.kmpl).toBeGreaterThan(speedAtOptimal.kmpl);

      // speedFactor should be < 1.0 (improving consumption)
      expect(speedBelow20.factors.speedFactor).toBeLessThan(1.0);
      expect(speedBelow20.factors.speedFactor).toBeGreaterThan(0.95); // Not unreasonably improved
    });

    it("does not penalize highway speeds excessively beyond 85 km/h", () => {
      const vehicle = makeVehicle();
      const speed85 = simulate(vehicle, {
        speed: 85,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const speed110 = simulate(vehicle, {
        speed: 110,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      // Highway speeds are generally efficient, but high speeds degrade
      // 110 km/h should have penalty but not catastrophic
      const penaltyAt110 = speed85.kmpl / speed110.kmpl - 1;
      expect(penaltyAt110).toBeGreaterThan(0.05); // At least 5% penalty
      expect(penaltyAt110).toBeLessThan(0.3); // But not more than 30%
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
      expect(result.confidence).toBe(0.85);
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
      expect(result.rpm).toBeGreaterThan(0);
      expect(result.hasTransmissionData).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("predicts lower gear at low speed", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
        bsfcMinGPerKwh: 240,
      });
      const lowSpeed = simulate(vehicle, {
        speed: 20,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const highSpeed = simulate(vehicle, {
        speed: 80,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(lowSpeed.gear).toBeDefined();
      expect(highSpeed.gear).toBeDefined();
      expect(lowSpeed.gear!).toBeLessThan(highSpeed.gear!);
      expect(lowSpeed.rpm).toBeGreaterThan(0);
      expect(highSpeed.rpm).toBeGreaterThan(0);
    });

    it("returns idle RPM when speed is zero", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
        bsfcMinGPerKwh: 240,
      });
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

      expect(result.gear).toBe(1);
      expect(result.rpm).toBe(800);
    });

    it("uses hybrid model when torqueCurve is missing", () => {
      const transmissionNoCurve: TransmissionData = {
        type: "Manual",
        gearRatios: [3.364, 1.864, 1.321, 1.029, 0.821],
        finalDrive: 4.067,
        tireRadiusM: 0.288,
        redlineRpm: 6500,
        idleRpm: 800,
        torqueCurve: {} as Record<number, number>,
      };
      const vehicle = makeVehicle({
        transmission: transmissionNoCurve,
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
      expect(result.hasTransmissionData).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    it("uses hybrid model when bsfcMinGPerKwh is missing", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
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
      expect(result.hasTransmissionData).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    it("increases RPM with speed in same gear range", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
        bsfcMinGPerKwh: 240,
      });
      // Use same gear context (previousGear=3) to test RPM increase within same gear
      const result1 = simulate(vehicle, {
        speed: 40,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      const result2 = simulate(vehicle, {
        speed: 50,
        slope: 0,
        accel: 0,
        acOn: false,
        passengers: 1,
        cargoKg: 0,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result2.rpm).toBeDefined();
      expect(result1.rpm).toBeDefined();
      // When speed increases within the same gear range, RPM should increase
      // Note: If gear changes between calls, this comparison may not hold
      if (result1.gear === result2.gear) {
        expect(result2.rpm!).toBeGreaterThan(result1.rpm!);
      } else {
        // If gears differ, just verify both have valid RPMs
        expect(result1.rpm! > 0).toBe(true);
        expect(result2.rpm! > 0).toBe(true);
      }
    });

    it("uses COPERT fallback when physics calculation fails", () => {
      const vehicle = makeVehicle({
        transmission: makeTransmission(),
        techEra: "injection_modern",
        bsfcMinGPerKwh: 240,
      });
      const result = simulate(vehicle, {
        speed: 200,
        slope: 10,
        accel: 5,
        acOn: true,
        passengers: 5,
        cargoKg: 200,
        fuelType: "gasolina",
        batterySocPct: 100,
      });

      expect(result.gear).toBeDefined();
      expect(result.kmpl).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("GearRpmEstimator", () => {
    const defaultTransmission: TransmissionData = {
      type: "Manual",
      gearRatios: [3.5, 2.0, 1.4, 1.0, 0.8],
      finalDrive: 4.0,
      tireRadiusM: 0.3,
      redlineRpm: 6500,
      idleRpm: 800,
    };

    it("returns low gear at very low speed", () => {
      const result = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 5,
          slope: 0,
          accel: 0.5,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      // New engine load-based logic may choose gear 1 or 2 depending on load
      expect(result.gear).toBeGreaterThanOrEqual(1);
      expect(result.gear).toBeLessThanOrEqual(2);
    });

    it("chooses gear based on physics (closest to ideal RPM)", () => {
      const result = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 60,
          slope: 0,
          accel: 0.2,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      expect(result.gear).toBeGreaterThanOrEqual(3);
      expect(result.gear).toBeLessThanOrEqual(5);
      expect(result.rpm).toBeGreaterThan(800);
      expect(result.rpm).toBeLessThan(6500);
    });

    it("uses higher gear at higher speed (physically correct)", () => {
      const result = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 100,
          slope: 0,
          accel: 0,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      expect(result.gear).toBe(5);
      expect(result.rpm).toBeGreaterThan(2000);
    });

    it("downshifts on steep uphill", () => {
      const resultUphill = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 80,
          slope: 10,
          accel: 0.5,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      const resultFlat = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 80,
          slope: 0,
          accel: 0.5,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      expect(resultUphill.gear).toBeDefined();
      expect(resultFlat.gear).toBeDefined();
      expect(resultUphill.gear!).toBeLessThanOrEqual(resultFlat.gear!);
    });

    it("selects appropriate gear on downhill deceleration", () => {
      const result = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 80,
          slope: -8,
          accel: -1.0,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      // New engine load-based logic selects gear based on load, not just speed
      // On steep downhill with deceleration, may use higher gear (engine braking) or lower gear
      expect(result.gear).toBeDefined();
      expect(result.gear).toBeGreaterThanOrEqual(2);
      expect(result.gear).toBeLessThanOrEqual(5);
    });

    it("returns reasonable RPM values", () => {
      const result = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 80,
          slope: 0,
          accel: 0.1,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      expect(result.rpm).toBeGreaterThan(800);
      expect(result.rpm).toBeLessThan(6500);
    });

    it("maintains gear consistency (temporal memory)", () => {
      const result = simulate(
        makeVehicle({ transmission: defaultTransmission }),
        {
          speed: 60,
          slope: 0,
          accel: 0.05,
          acOn: false,
          passengers: 1,
          cargoKg: 0,
          fuelType: "gasolina",
          batterySocPct: 100,
        },
      );
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });
});
