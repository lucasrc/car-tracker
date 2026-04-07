import { describe, it, expect } from "vitest";
import {
  selectOptimalGear,
  calculateEngineLoadForAllGears,
} from "./transmission-calculator";
import type { Vehicle, TransmissionData } from "@/types";

// Dados do Renault Clio do usuário
const clioTransmission: TransmissionData = {
  type: "Manual",
  gearRatios: [3.5, 2.1, 1.4, 1.0, 0.8],
  finalDrive: 4.1,
  tireRadiusM: 0.31,
  redlineRpm: 6500,
  idleRpm: 800,
  rpmAt100Kmh: 3200,
};

const clioVehicle: Vehicle = {
  id: "clio-test",
  name: "Renault Clio 1.6 16V",
  make: "Renault",
  model: "Clio",
  year: 2008,
  displacement: 1598,
  fuelType: "flex",
  euroNorm: "Euro 4",
  segment: "small",
  urbanKmpl: 9,
  highwayKmpl: 13.8,
  combinedKmpl: 11,
  mass: 1005,
  grossWeight: 1500,
  frontalArea: 2.05,
  dragCoefficient: 0.32,
  f0: 0.15,
  f1: 0.007,
  f2: 0.00035,
  fuelConversionFactor: 8.5,
  peakPowerKw: 82,
  peakTorqueNm: 148,
  confidence: "high",
  calibrationInput: "manual",
  calibratedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  fuelCapacity: 50,
  currentFuel: 30,
  dataSource: "manual",
  inmetroCityKmpl: 9,
  inmetroHighwayKmpl: 13.8,
  userAvgCityKmpl: 8.5,
  userAvgHighwayKmpl: 12.5,
  weightInmetro: 0.6,
  weightUser: 0.4,
  isHybrid: false,
  gnvCylinderWeightKg: 80,
  gnvEfficiencyFactor: 1.32,
  crr: 0.015,
  idleLph: 0.8,
  baseBsfc: 280,
  transmission: clioTransmission,
};

describe("Seleção de Marcha - Testes de Regressão", () => {
  it("65 km/h cruzeiro plano DEVE usar 5ª marcha", () => {
    const result = selectOptimalGear(clioVehicle, 65, 0, 0, 4);

    console.log(
      `[TEST] 65 km/h plano: gear=${result.gear}, rpm=${result.rpm}, load=${result.engineLoad.toFixed(1)}%`,
    );

    // Em cruzeiro plano, deve usar a marcha mais alta possível
    expect(result.gear).toBe(5);
    expect(result.rpm).toBeCloseTo(2080, -1); // 3200 * 0.65 = 2080
    expect(result.engineLoad).toBeLessThan(40); // Carga leve em cruzeiro
  });

  it("100 km/h cruzeiro plano DEVE usar 5ª marcha com 3200 RPM", () => {
    const result = selectOptimalGear(clioVehicle, 100, 0, 0, 5);

    console.log(
      `[TEST] 100 km/h plano: gear=${result.gear}, rpm=${result.rpm}, load=${result.engineLoad.toFixed(1)}%`,
    );

    expect(result.gear).toBe(5);
    expect(result.rpm).toBe(3200); // Exatamente o rpmAt100Kmh
  });

  it("60 km/h subida 8% DEVE reduzir para 4ª marcha", () => {
    const result = selectOptimalGear(clioVehicle, 60, 0.3, 8, 5);

    console.log(
      `[TEST] 60 km/h subida 8%: gear=${result.gear}, rpm=${result.rpm}, load=${result.engineLoad.toFixed(1)}%`,
    );

    // Em subida, deve reduzir para ter mais torque
    expect(result.gear).toBeLessThanOrEqual(4);
    expect(result.engineLoad).toBeGreaterThan(60); // Carga significativa
    expect(result.engineLoad).toBeLessThan(95); // Mas não sobrecarregar
  });

  it("80 km/h aceleração 2.5 m/s² DEVE reduzir para 3ª ou 4ª", () => {
    const result = selectOptimalGear(clioVehicle, 80, 2.5, 0, 5);

    console.log(
      `[TEST] 80 km/h aceleração forte: gear=${result.gear}, rpm=${result.rpm}, load=${result.engineLoad.toFixed(1)}%`,
    );

    // Para acelerar forte, deve ter RPM alto
    expect(result.gear).toBeLessThanOrEqual(4);
    expect(result.rpm).toBeGreaterThan(2500);
  });

  it("30 km/h plano DEVE usar 3ª marcha", () => {
    const result = selectOptimalGear(clioVehicle, 30, 0, 0, 2);

    console.log(
      `[TEST] 30 km/h plano: gear=${result.gear}, rpm=${result.rpm}, load=${result.engineLoad.toFixed(1)}%`,
    );

    // 30 km/h é velocidade urbana, deve usar 3ª ou 4ª
    expect(result.gear).toBeGreaterThanOrEqual(2);
    expect(result.gear).toBeLessThanOrEqual(4);
    expect(result.rpm).toBeGreaterThan(1200); // Não pode estar em lugging
  });

  it("5 km/h DEVE usar 1ª ou 2ª marcha", () => {
    const result = selectOptimalGear(clioVehicle, 5, 0.5, 0, 1);

    console.log(
      `[TEST] 5 km/h: gear=${result.gear}, rpm=${result.rpm}, load=${result.engineLoad.toFixed(1)}%`,
    );

    // Velocidade muito baixa, só pode usar marchas 1 ou 2
    expect(result.gear).toBeLessThanOrEqual(2);
    expect(result.gear).toBeGreaterThanOrEqual(1);
  });
});
