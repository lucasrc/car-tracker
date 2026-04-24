import { simulate } from "./telemetry-engine";
import type { Vehicle, TransmissionData } from "@/types";

export interface VehicleSpec {
  name: string;
  transmission: TransmissionData;
}

export interface TestScenario {
  speed: number;
  accel: number;
  slope: number;
  description: string;
}

export interface TestResult {
  scenario: TestScenario;
  vehicle: string;
  expectedGear: number;
  actualGear: number;
  expectedRpmRange: { min: number; max: number };
  actualRpm: number;
  accuracyScore: number;
  passed: boolean;
  reason?: string;
}

export interface AlgorithmParams {
  optimalMin: number;
  optimalMax: number;
  downshiftAccel: number;
  memoryWeight: number;
  highRpmBoost: number;
  optimalBoost: number;
  gearMemoryDecay: number;
}

export const VEHICLE_SPECS: VehicleSpec[] = [
  {
    name: "Clio K4M 1.6 16V",
    transmission: {
      type: "Manual",
      gearRatios: [3.364, 1.864, 1.321, 1.029, 0.821],
      finalDrive: 4.067,
      tireRadiusM: 0.288,
      redlineRpm: 6500,
      idleRpm: 800,
      rpmAt100Kmh: 3200,
    },
  },
  {
    name: "Clio K7M 1.6 8V",
    transmission: {
      type: "Manual",
      gearRatios: [3.727, 2.105, 1.473, 1.119, 0.894],
      finalDrive: 3.867,
      tireRadiusM: 0.275,
      redlineRpm: 6000,
      idleRpm: 850,
      rpmAt100Kmh: 3400,
    },
  },
  {
    name: "Ford KA 1.0",
    transmission: {
      type: "Manual",
      gearRatios: [3.85, 2.032, 1.344, 1.029, 0.853],
      finalDrive: 4.53,
      tireRadiusM: 0.268,
      redlineRpm: 6200,
      idleRpm: 850,
      rpmAt100Kmh: 3500,
    },
  },
  {
    name: "Gol 1.6 8V",
    transmission: {
      type: "Manual",
      gearRatios: [3.727, 2.063, 1.433, 1.033, 0.837],
      finalDrive: 4.25,
      tireRadiusM: 0.28,
      redlineRpm: 6000,
      idleRpm: 820,
      rpmAt100Kmh: 3250,
    },
  },
  {
    name: "Palio 1.0 8V",
    transmission: {
      type: "Manual",
      gearRatios: [3.909, 2.157, 1.478, 1.121, 0.891],
      finalDrive: 4.071,
      tireRadiusM: 0.275,
      redlineRpm: 5800,
      idleRpm: 850,
      rpmAt100Kmh: 3350,
    },
  },
  {
    name: "Uno 1.4 8V",
    transmission: {
      type: "Manual",
      gearRatios: [3.647, 1.95, 1.292, 1.029, 0.884],
      finalDrive: 4.125,
      tireRadiusM: 0.282,
      redlineRpm: 6000,
      idleRpm: 840,
      rpmAt100Kmh: 3300,
    },
  },
  {
    name: "Ford KA 1.6",
    transmission: {
      type: "Manual",
      gearRatios: [3.73, 2.05, 1.36, 1.03, 0.86],
      finalDrive: 4.2,
      tireRadiusM: 0.275,
      redlineRpm: 6500,
      idleRpm: 800,
      rpmAt100Kmh: 3300,
    },
  },
  {
    name: "Sandero 1.6 8V",
    transmission: {
      type: "Manual",
      gearRatios: [3.727, 2.105, 1.473, 1.119, 0.894],
      finalDrive: 3.867,
      tireRadiusM: 0.288,
      redlineRpm: 6000,
      idleRpm: 850,
      rpmAt100Kmh: 3200,
    },
  },
  {
    name: "Onix 1.0 Turbo",
    transmission: {
      type: "Manual",
      gearRatios: [3.818, 2.268, 1.521, 1.122, 0.891, 0.744],
      finalDrive: 3.94,
      tireRadiusM: 0.312,
      redlineRpm: 6500,
      idleRpm: 900,
      rpmAt100Kmh: 2750,
    },
  },
  {
    name: "Corolla 1.8",
    transmission: {
      type: "Manual",
      gearRatios: [3.538, 1.904, 1.334, 1.027, 0.892, 0.738],
      finalDrive: 3.888,
      tireRadiusM: 0.322,
      redlineRpm: 6800,
      idleRpm: 750,
      rpmAt100Kmh: 2700,
    },
  },
  {
    name: "Civic 2.0",
    transmission: {
      type: "Manual",
      gearRatios: [3.357, 2.117, 1.518, 1.147, 0.893, 0.735],
      finalDrive: 4.095,
      tireRadiusM: 0.318,
      redlineRpm: 6800,
      idleRpm: 750,
      rpmAt100Kmh: 2800,
    },
  },
  {
    name: "Golf 1.4 TSI",
    transmission: {
      type: "Manual",
      gearRatios: [3.5, 1.944, 1.299, 1.027, 0.855, 0.713],
      finalDrive: 3.65,
      tireRadiusM: 0.318,
      redlineRpm: 6800,
      idleRpm: 850,
      rpmAt100Kmh: 2650,
    },
  },
];

function calculateRPM(
  speedKmh: number,
  gearRatio: number,
  finalDrive: number,
  tireRadiusM: number,
): number {
  const speedMs = speedKmh / 3.6;
  const wheelRps = speedMs / (2 * Math.PI * tireRadiusM);
  const engineRps = wheelRps * gearRatio * finalDrive;
  return engineRps * 60;
}

function findIdealGear(
  speed: number,
  transmission: TransmissionData,
  aspiration: "NA" | "turbo" | "turbo-diesel" = "NA",
): { gear: number; rpm: number } {
  const {
    gearRatios,
    finalDrive,
    tireRadiusM,
    redlineRpm,
  } = transmission;

  const minRpm = aspiration === "turbo-diesel" ? 1000 : aspiration === "turbo" ? 1100 : 1300;
  const maxRpm = redlineRpm * 0.95;

  let bestGear = -1;
  let bestScore = -Infinity;

  for (let g = 0; g < gearRatios.length; g++) {
    const rpm = calculateRPM(speed, gearRatios[g], finalDrive, tireRadiusM);
    if (rpm < minRpm || rpm > maxRpm) continue;

    let score = 0;
    if (speed < 20) {
      score = g === 0 ? 1 : (g === 1 ? 0.8 : 0);
    } else {
      const rpmDeviation = Math.abs(rpm - 2500);
      score = 1000 - rpmDeviation;
      if (rpm < minRpm + 200) score -= 500;
    }

    if (score > bestScore) {
      bestScore = score;
      bestGear = g;
    }
  }

  if (bestGear === -1) {
    bestGear = 0;
  }

  const rpm = calculateRPM(
    speed,
    gearRatios[bestGear],
    finalDrive,
    tireRadiusM,
  );
  return { gear: bestGear + 1, rpm };
}

function findRpmZone(
  speed: number,
  transmission: TransmissionData,
  aspiration: "NA" | "turbo" | "turbo-diesel" = "NA",
): { min: number; max: number } {
  const { rpmAt100Kmh, redlineRpm } = transmission;
  const minRpm = aspiration === "turbo-diesel" ? 1000 : aspiration === "turbo" ? 1100 : 1300;
  const maxRpm = redlineRpm * 0.95;
  const refRpm = rpmAt100Kmh ?? 2500;
  const targetRpm = refRpm * (speed / 100);

  return {
    min: Math.max(minRpm, targetRpm * 0.65),
    max: Math.min(maxRpm, targetRpm * 1.35),
  };
}

export const TEST_SCENARIOS: TestScenario[] = [
  // A. Cruzeiro a velocidade constante (60 testes)
  {
    speed: 20,
    accel: 0,
    slope: 0,
    description: "Cruzeiro urbano baixo 20km/h",
  },
  {
    speed: 25,
    accel: 0,
    slope: 0,
    description: "Cruzeiro urbano baixo 25km/h",
  },
  {
    speed: 30,
    accel: 0,
    slope: 0,
    description: "Cruzeiro urbano baixo 30km/h",
  },
  {
    speed: 35,
    accel: 0,
    slope: 0,
    description: "Cruzeiro urbano baixo 35km/h",
  },
  { speed: 40, accel: 0, slope: 0, description: "Cruzeiro urbano 40km/h" },
  { speed: 45, accel: 0, slope: 0, description: "Cruzeiro urbano 45km/h" },
  { speed: 50, accel: 0, slope: 0, description: "Cruzeiro urbano 50km/h" },
  { speed: 55, accel: 0, slope: 0, description: "Cruzeiro urbano 55km/h" },
  { speed: 60, accel: 0, slope: 0, description: "Cruzeiro urbano 60km/h" },
  { speed: 65, accel: 0, slope: 0, description: "Cruzeiro urbano 65km/h" },
  { speed: 70, accel: 0, slope: 0, description: "Cruzeiro urbano 70km/h" },
  { speed: 75, accel: 0, slope: 0, description: "Cruzeiro rodoviario 75km/h" },
  { speed: 80, accel: 0, slope: 0, description: "Cruzeiro rodoviario 80km/h" },
  { speed: 85, accel: 0, slope: 0, description: "Cruzeiro rodoviario 85km/h" },
  { speed: 90, accel: 0, slope: 0, description: "Cruzeiro rodoviario 90km/h" },
  { speed: 95, accel: 0, slope: 0, description: "Cruzeiro rodoviario 95km/h" },
  {
    speed: 100,
    accel: 0,
    slope: 0,
    description: "Cruzeiro rodoviario 100km/h",
  },
  {
    speed: 105,
    accel: 0,
    slope: 0,
    description: "Cruzeiro rodoviario 105km/h",
  },
  {
    speed: 110,
    accel: 0,
    slope: 0,
    description: "Cruzeiro rodoviario 110km/h",
  },
  {
    speed: 115,
    accel: 0,
    slope: 0,
    description: "Cruzeiro alta velocidade 115km/h",
  },
  {
    speed: 120,
    accel: 0,
    slope: 0,
    description: "Cruzeiro alta velocidade 120km/h",
  },
  {
    speed: 125,
    accel: 0,
    slope: 0,
    description: "Cruzeiro alta velocidade 125km/h",
  },
  {
    speed: 130,
    accel: 0,
    slope: 0,
    description: "Cruzeiro alta velocidade 130km/h",
  },
  {
    speed: 135,
    accel: 0,
    slope: 0,
    description: "Cruzeiro alta velocidade 135km/h",
  },
  {
    speed: 140,
    accel: 0,
    slope: 0,
    description: "Cruzeiro alta velocidade 140km/h",
  },

  // B. Aceleração normal (50 testes)
  { speed: 20, accel: 1.0, slope: 0, description: "Aceleracao leve 20km/h" },
  {
    speed: 20,
    accel: 1.5,
    slope: 0,
    description: "Aceleracao moderada 20km/h",
  },
  { speed: 20, accel: 2.0, slope: 0, description: "Aceleracao firme 20km/h" },
  { speed: 20, accel: 2.5, slope: 0, description: "Aceleracao forte 20km/h" },
  { speed: 40, accel: 1.0, slope: 0, description: "Aceleracao leve 40km/h" },
  {
    speed: 40,
    accel: 1.5,
    slope: 0,
    description: "Aceleracao moderada 40km/h",
  },
  { speed: 40, accel: 2.0, slope: 0, description: "Aceleracao firme 40km/h" },
  { speed: 40, accel: 2.5, slope: 0, description: "Aceleracao forte 40km/h" },
  { speed: 60, accel: 1.0, slope: 0, description: "Aceleracao leve 60km/h" },
  {
    speed: 60,
    accel: 1.5,
    slope: 0,
    description: "Aceleracao moderada 60km/h",
  },
  { speed: 60, accel: 2.0, slope: 0, description: "Aceleracao firme 60km/h" },
  { speed: 60, accel: 2.5, slope: 0, description: "Aceleracao forte 60km/h" },
  { speed: 80, accel: 1.0, slope: 0, description: "Aceleracao leve 80km/h" },
  {
    speed: 80,
    accel: 1.5,
    slope: 0,
    description: "Aceleracao moderada 80km/h",
  },
  { speed: 80, accel: 2.0, slope: 0, description: "Aceleracao firme 80km/h" },
  { speed: 80, accel: 2.5, slope: 0, description: "Aceleracao forte 80km/h" },
  { speed: 100, accel: 1.0, slope: 0, description: "Aceleracao leve 100km/h" },
  {
    speed: 100,
    accel: 1.5,
    slope: 0,
    description: "Aceleracao moderada 100km/h",
  },
  { speed: 100, accel: 2.0, slope: 0, description: "Aceleracao firme 100km/h" },
  { speed: 100, accel: 2.5, slope: 0, description: "Aceleracao forte 100km/h" },

  // C. Desaceleracao/Freagem (30 testes)
  {
    speed: 40,
    accel: -0.5,
    slope: 0,
    description: "Desaceleracao leve 40km/h",
  },
  {
    speed: 40,
    accel: -1.0,
    slope: 0,
    description: "Desaceleracao moderada 40km/h",
  },
  {
    speed: 40,
    accel: -1.5,
    slope: 0,
    description: "Desaceleracao forte 40km/h",
  },
  {
    speed: 60,
    accel: -0.5,
    slope: 0,
    description: "Desaceleracao leve 60km/h",
  },
  {
    speed: 60,
    accel: -1.0,
    slope: 0,
    description: "Desaceleracao moderada 60km/h",
  },
  {
    speed: 60,
    accel: -1.5,
    slope: 0,
    description: "Desaceleracao forte 60km/h",
  },
  {
    speed: 80,
    accel: -0.5,
    slope: 0,
    description: "Desaceleracao leve 80km/h",
  },
  {
    speed: 80,
    accel: -1.0,
    slope: 0,
    description: "Desaceleracao moderada 80km/h",
  },
  {
    speed: 80,
    accel: -1.5,
    slope: 0,
    description: "Desaceleracao forte 80km/h",
  },
  {
    speed: 100,
    accel: -0.5,
    slope: 0,
    description: "Desaceleracao leve 100km/h",
  },
  {
    speed: 100,
    accel: -1.0,
    slope: 0,
    description: "Desaceleracao moderada 100km/h",
  },
  {
    speed: 100,
    accel: -1.5,
    slope: 0,
    description: "Desaceleracao forte 100km/h",
  },

  // D. Subida (Uphill) (30 testes)
  { speed: 40, accel: 0.2, slope: 5, description: "Subida leve 5% 40km/h" },
  { speed: 40, accel: 0.3, slope: 8, description: "Subida moderada 8% 40km/h" },
  { speed: 40, accel: 0.5, slope: 12, description: "Subida forte 12% 40km/h" },
  { speed: 60, accel: 0.2, slope: 5, description: "Subida leve 5% 60km/h" },
  { speed: 60, accel: 0.3, slope: 8, description: "Subida moderada 8% 60km/h" },
  { speed: 60, accel: 0.5, slope: 12, description: "Subida forte 12% 60km/h" },
  { speed: 80, accel: 0.2, slope: 5, description: "Subida leve 5% 80km/h" },
  { speed: 80, accel: 0.3, slope: 8, description: "Subida moderada 8% 80km/h" },
  { speed: 80, accel: 0.5, slope: 12, description: "Subida forte 12% 80km/h" },

  // E. Descida (Downhill) (20 testes)
  { speed: 40, accel: -0.5, slope: -5, description: "Descida leve -5% 40km/h" },
  {
    speed: 40,
    accel: -1.0,
    slope: -8,
    description: "Descida moderada -8% 40km/h",
  },
  { speed: 60, accel: -0.5, slope: -5, description: "Descida leve -5% 60km/h" },
  {
    speed: 60,
    accel: -1.0,
    slope: -8,
    description: "Descida moderada -8% 60km/h",
  },
  {
    speed: 60,
    accel: -1.5,
    slope: -12,
    description: "Descida forte -12% 60km/h",
  },
  { speed: 80, accel: -0.5, slope: -5, description: "Descida leve -5% 80km/h" },
  {
    speed: 80,
    accel: -1.0,
    slope: -8,
    description: "Descida moderada -8% 80km/h",
  },
  {
    speed: 80,
    accel: -1.5,
    slope: -12,
    description: "Descida forte -12% 80km/h",
  },

  // F. Transicoes de marcha (20 testes)
  { speed: 10, accel: 2.5, slope: 0, description: "Arranque 0-20km/h" },
  { speed: 15, accel: 2.5, slope: 0, description: "Arranque 0-30km/h" },
  { speed: 20, accel: 2.0, slope: 0, description: "Transicao 20-40km/h" },
  { speed: 30, accel: 2.0, slope: 0, description: "Transicao 30-60km/h" },
  { speed: 40, accel: 1.5, slope: 0, description: "Transicao 40-80km/h" },
  { speed: 50, accel: 1.5, slope: 0, description: "Transicao 50-100km/h" },
  { speed: 60, accel: 1.0, slope: 0, description: "Transicao 60-120km/h" },
  { speed: 80, accel: 0.5, slope: 0, description: "Retomada 80-100km/h" },
  { speed: 60, accel: -0.5, slope: 0, description: "Reducao 60-40km/h" },
  { speed: 40, accel: -0.5, slope: 0, description: "Reducao 40-20km/h" },

  // G. Edge cases (10 testes)
  { speed: 5, accel: 0.5, slope: 0, description: "Muito baixa velocidade" },
  { speed: 10, accel: 1.0, slope: 0, description: "Baixa velocidade" },
  { speed: 15, accel: 0.5, slope: 0, description: "Velocidade minima urbana" },
  { speed: 130, accel: 0.2, slope: 0, description: "Alta velocidade 130km/h" },
  {
    speed: 140,
    accel: 0.2,
    slope: 0,
    description: "Velocidade maxima 140km/h",
  },
  { speed: 60, accel: 0, slope: 0, description: "Cruzeiro limite urbano" },
  { speed: 100, accel: 0.3, slope: 3, description: "Cruzeiro subida leve" },
  { speed: 80, accel: -0.3, slope: -3, description: "Descida leve" },
  { speed: 45, accel: 1.5, slope: 0, description: "Aceleracao urbana" },
  { speed: 90, accel: 0, slope: 0, description: "Cruzeiro rodoviario 90km/h" },
];

export function runTest(
  vehicle: VehicleSpec,
  scenario: TestScenario,
): TestResult {
  const testVehicle: Vehicle = {
    id: "test-vehicle",
    name: vehicle.name,
    make: "Test",
    model: "Model",
    year: 2024,
    displacement: 1600,
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
    peakPowerKw: 80,
    peakTorqueNm: 145,
    confidence: "medium",
    calibrationInput: "test",
    calibratedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
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
    techEra: "injection_modern",
    bsfcMinGPerKwh: 240,
    transmission: vehicle.transmission,
  };

  const result = simulate(testVehicle, {
    speed: scenario.speed,
    slope: scenario.slope,
    accel: scenario.accel,
    acOn: false,
    passengers: 1,
    cargoKg: 0,
    fuelType: "gasolina",
    batterySocPct: 100,
  });

  const ideal = findIdealGear(scenario.speed, vehicle.transmission, "NA");
  const zone = findRpmZone(scenario.speed, vehicle.transmission, "NA");

  let accuracyScore = 1.0;
  let reason = "";

  const gearCorrect = result.gear === ideal.gear;
  const rpmInZone = result.rpm! >= zone.min && result.rpm! <= zone.max;

  if (!gearCorrect) {
    accuracyScore -= 0.4;
    reason += `Marcha ${result.gear} incorreta (ideal: ${ideal.gear}). `;
  }

  if (!rpmInZone) {
    accuracyScore -= 0.1;
    reason += `RPM ${result.rpm} fora da zona [${Math.round(zone.min)}-${Math.round(zone.max)}]. `;
  }

  const passed = accuracyScore >= 0.8;

  return {
    scenario,
    vehicle: vehicle.name,
    expectedGear: ideal.gear,
    actualGear: result.gear ?? 0,
    expectedRpmRange: zone,
    actualRpm: result.rpm ?? 0,
    accuracyScore,
    passed,
    reason: reason.trim() || undefined,
  };
}

export function runAllTests(): Map<string, TestResult[]> {
  const results = new Map<string, TestResult[]>();

  for (const vehicle of VEHICLE_SPECS) {
    const vehicleResults: TestResult[] = [];
    for (const scenario of TEST_SCENARIOS) {
      vehicleResults.push(runTest(vehicle, scenario));
    }
    results.set(vehicle.name, vehicleResults);
  }

  return results;
}

export function calculateOverallAccuracy(results: Map<string, TestResult[]>): {
  accuracy: number;
  passed: number;
  total: number;
  byVehicle: Record<
    string,
    { accuracy: number; passed: number; total: number }
  >;
} {
  let totalPassed = 0;
  let totalTests = 0;
  const byVehicle: Record<
    string,
    { accuracy: number; passed: number; total: number }
  > = {};

  for (const [vehicleName, vehicleResults] of results) {
    const passed = vehicleResults.filter((r) => r.passed).length;
    const total = vehicleResults.length;
    const accuracy = (passed / total) * 100;

    byVehicle[vehicleName] = { accuracy, passed, total };
    totalPassed += passed;
    totalTests += total;
  }

  return {
    accuracy: (totalPassed / totalTests) * 100,
    passed: totalPassed,
    total: totalTests,
    byVehicle,
  };
}

export function printResults(
  results: Map<string, TestResult[]>,
  overall: {
    accuracy: number;
    passed: number;
    total: number;
    byVehicle: Record<
      string,
      { accuracy: number; passed: number; total: number }
    >;
  },
): void {
  console.log("\n" + "=".repeat(80));
  console.log("RESULTADOS DOS TESTES DE SELEÇÃO DE MARCHA");
  console.log("=".repeat(80));

  console.log(
    `\nACURÁCIA GERAL: ${overall.accuracy.toFixed(1)}% (${overall.passed}/${overall.total} testes passados)\n`,
  );

  console.log("RESULTADOS POR VEÍCULO:");
  console.log("-".repeat(60));
  for (const [name, stats] of Object.entries(overall.byVehicle)) {
    const bar =
      "█".repeat(Math.round(stats.accuracy / 5)) +
      "░".repeat(20 - Math.round(stats.accuracy / 5));
    console.log(
      `${name.padEnd(25)} ${bar} ${stats.accuracy.toFixed(1)}% (${stats.passed}/${stats.total})`,
    );
  }

  const failedResults = Array.from(results.values())
    .flat()
    .filter((r) => !r.passed)
    .sort((a, b) => a.accuracyScore - b.accuracyScore);

  if (failedResults.length > 0) {
    console.log(`\nFALHAS (${failedResults.length} testes):`);
    console.log("-".repeat(60));
    for (const fail of failedResults.slice(0, 20)) {
      console.log(`[${fail.vehicle}] ${fail.scenario.description}`);
      console.log(
        `  Esperado: marcha ${fail.expectedGear}, RPM [${Math.round(fail.expectedRpmRange.min)}-${Math.round(fail.expectedRpmRange.max)}]`,
      );
      console.log(
        `  Atual:    marcha ${fail.actualGear}, RPM ${fail.actualRpm}`,
      );
      console.log(`  Score: ${fail.accuracyScore.toFixed(2)} - ${fail.reason}`);
      console.log();
    }
  }
}
