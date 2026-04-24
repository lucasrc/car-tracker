import { describe, it, expect } from "vitest";
import type { Vehicle } from "@/types";
import {
  validateVehicleCalibration,
  getConsumptionWarning,
} from "./vehicle-validation";

const createMockVehicle = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  id: "test-vehicle",
  name: "Test Car",
  make: "Toyota",
  model: "Corolla",
  year: 2020,
  displacement: 1.8,
  fuelType: "gasolina",
  euroNorm: "Euro 5",
  segment: "medium",
  urbanKmpl: 10,
  highwayKmpl: 14,
  combinedKmpl: 12,
  mass: 1300,
  grossWeight: 1700,
  frontalArea: 2.5,
  dragCoefficient: 0.3,
  peakPowerKw: 100,
  peakTorqueNm: 180,
  confidence: "high",
  calibrationInput: "",
  calibratedAt: "",
  createdAt: "",
  fuelCapacity: 50,
  currentFuel: 25,
  crr: 0.01,
  idleLph: 0.6,
  baseBsfc: 250,
  isHybrid: false,
  gnvCylinderWeightKg: 80,
  gnvEfficiencyFactor: 1.32,
  inmetroCityKmpl: 12.5,
  inmetroHighwayKmpl: 15.0,
  userAvgCityKmpl: 11.0,
  userAvgHighwayKmpl: 14.0,
  ...overrides,
});

describe("vehicle-validation", () => {
  describe("validateVehicleCalibration", () => {
    it("returns error for null vehicle", () => {
      const result = validateVehicleCalibration(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Nenhum veículo selecionado");
    });

    it("returns warnings for missing city consumption", () => {
      const vehicle = createMockVehicle({ inmetroCityKmpl: undefined });
      const result = validateVehicleCalibration(vehicle);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Consumo urbano não calibrado"),
      );
    });

    it("returns warnings for missing highway consumption", () => {
      const vehicle = createMockVehicle({ inmetroHighwayKmpl: undefined });
      const result = validateVehicleCalibration(vehicle);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Consumo rodoviário não calibrado"),
      );
    });

    it("returns warnings for missing user city consumption", () => {
      const vehicle = createMockVehicle({ userAvgCityKmpl: undefined });
      const result = validateVehicleCalibration(vehicle);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Seu consumo urbano não registrado"),
      );
    });

    it("returns warnings for missing user highway consumption", () => {
      const vehicle = createMockVehicle({ userAvgHighwayKmpl: undefined });
      const result = validateVehicleCalibration(vehicle);
      expect(result.warnings).toContainEqual(
        expect.stringContaining("Seu consumo rodoviário não registrado"),
      );
    });

    it("returns error for invalid fuel capacity", () => {
      const vehicle = createMockVehicle({ fuelCapacity: 0 });
      const result = validateVehicleCalibration(vehicle);
      expect(result.errors).toContain("Capacidade do tanque não configurada");
    });

    it("returns error for negative fuel level", () => {
      const vehicle = createMockVehicle({ currentFuel: -1 });
      const result = validateVehicleCalibration(vehicle);
      expect(result.errors).toContain(
        "Nível de combustível inválido (negativo)",
      );
    });

    it("returns error when fuel exceeds capacity", () => {
      const vehicle = createMockVehicle({ currentFuel: 60, fuelCapacity: 50 });
      const result = validateVehicleCalibration(vehicle);
      expect(result.errors).toContainEqual(
        expect.stringContaining("maior que capacidade"),
      );
    });

    it("returns valid for fully configured vehicle", () => {
      const vehicle = createMockVehicle();
      const result = validateVehicleCalibration(vehicle);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("getConsumptionWarning", () => {
    it("returns select vehicle message for null", () => {
      expect(getConsumptionWarning(null)).toBe(
        "Selecione um veículo em Configurações",
      );
    });

    it("returns first error message", () => {
      const vehicle = createMockVehicle({ fuelCapacity: 0 });
      expect(getConsumptionWarning(vehicle)).toBe(
        "Capacidade do tanque não configurada",
      );
    });

    it("returns first warning message", () => {
      const vehicle = createMockVehicle({ inmetroCityKmpl: undefined });
      const result = getConsumptionWarning(vehicle);
      expect(result).toContain("Consumo urbano não calibrado");
    });

    it("returns null for valid vehicle", () => {
      const vehicle = createMockVehicle();
      expect(getConsumptionWarning(vehicle)).toBeNull();
    });
  });
});
