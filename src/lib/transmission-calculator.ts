import type { Vehicle, TransmissionData } from "@/types";
import { debugLog } from "@/lib/debug";

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface EngineLoadInput {
  vehicle: Vehicle;
  speedKmh: number;
  accelerationMps2: number;
  slopePercent: number;
  gearIndex: number;
  passengers?: number;
  cargoKg?: number;
  isGnv?: boolean;
}

export interface EngineLoadResult {
  engineLoadPercent: number;
  requiredPowerKw: number;
  availablePowerKw: number;
  currentRpm: number;
  availableTorqueNm: number;
  isLugging: boolean;
  isOverRev: boolean;
  powerBreakdown: {
    rollingResistanceKw: number;
    aerodynamicDragKw: number;
    slopeKw: number;
    accelerationKw: number;
    totalKw: number;
  };
}

export interface GearEstimationResult {
  gear: number;
  rpm: number;
  confidence: number;
  engineLoad: number;
  reason: string;
}

// ============================================================================
// CONSTANTES FÍSICAS
// ============================================================================

const PHYSICS = {
  G: 9.81, // m/s²
  AIR_DENSITY: 1.225, // kg/m³ at sea level
} as const;

// RPM mínimos operacionais por tipo de motor
const MIN_OPERATING_RPM = {
  NA: 1300,
  turbo: 1100,
  "turbo-diesel": 1000,
} as const;

// Parâmetros de scoring por tipo de aspiração
export const SCORING_PARAMS = {
  NA: {
    minOperatingRpm: 1300,
    rpmOptimal: 2500,
    sigmaRpmLow: 900,
    sigmaRpmHigh: 2000,
    sigmaLoad: 0.25,
    sigmaBsfc: 50,
    clutchEngagementSpeedKmh: 10,
  },
  turbo: {
    minOperatingRpm: 1100,
    rpmOptimal: 2000,
    sigmaRpmLow: 700,
    sigmaRpmHigh: 1800,
    sigmaLoad: 0.22,
    sigmaBsfc: 45,
    clutchEngagementSpeedKmh: 8,
  },
  "turbo-diesel": {
    minOperatingRpm: 1000,
    rpmOptimal: 1800,
    sigmaRpmLow: 600,
    sigmaRpmHigh: 1500,
    sigmaLoad: 0.20,
    sigmaBsfc: 40,
    clutchEngagementSpeedKmh: 7,
  },
} as const;

// Configuração de histerese para evitar gear hunting
export const HYSTERESIS_CONFIG = {
  upshiftMargin: 0.15,
  downshiftMargin: 0.10,
  minDwellMs: 1500,
  kickdownAccelThreshold: 2.5,
  lowSpeedBypassKmh: 10,
} as const;

// Pesos padrão para scoring multi-critério (modo cruzeiro)
export const DEFAULT_SCORING_WEIGHTS = {
  fuel: 0.40,
  drive: 0.30,
  power: 0.20,
  safety: 0.10,
} as const;

// ============================================================================
// FUNÇÕES ESTATÍSTICAS
// ============================================================================

export function gaussianScore(
  value: number,
  optimal: number,
  sigma: number,
): number {
  if (sigma <= 0) return value === optimal ? 1 : 0;
  const diff = (value - optimal) / sigma;
  return Math.exp(-0.5 * diff * diff);
}

export function asymmetricScore(
  value: number,
  optimal: number,
  sigmaLow: number,
  sigmaHigh: number,
): number {
  const sigma = value < optimal ? sigmaLow : sigmaHigh;
  if (sigma <= 0) return value === optimal ? 1 : 0;
  const diff = (value - optimal) / sigma;
  return Math.exp(-0.5 * diff * diff);
}

export function sigmoid(value: number, center: number, steepness: number): number {
  if (steepness === 0) return 0.5;
  const x = steepness * (value - center);
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ============================================================================
// FUNÇÕES PRINCIPAIS DE CÁLCULO DE RPM
// ============================================================================

/**
 * Validate and correct transmission data using rpmAt100Kmh as the source of truth.
 * If rpmAt100Kmh exists and is inconsistent with other parameters,
 * it takes precedence and tireRadiusM is adjusted.
 */
export function validateTransmission(
  transmission: TransmissionData,
): TransmissionData {
  const { gearRatios, finalDrive, tireRadiusM, rpmAt100Kmh } = transmission;

  // If rpmAt100Kmh is not provided, return as-is (will use physical calculations)
  if (!rpmAt100Kmh || rpmAt100Kmh <= 0) {
    return transmission;
  }

  const topGearIndex = gearRatios.length - 1;
  const topGearRatio = gearRatios[topGearIndex];

  // Calculate what the RPM should be with current parameters
  const speedMs = 100 / 3.6; // 100 km/h in m/s
  const wheelRpsCalculated = speedMs / (2 * Math.PI * tireRadiusM);
  const rpmCalculated = Math.round(
    wheelRpsCalculated * topGearRatio * finalDrive * 60,
  );

  // Allow 3% tolerance for rounding errors
  const tolerance = rpmAt100Kmh * 0.03;
  const difference = Math.abs(rpmCalculated - rpmAt100Kmh);

  if (difference <= tolerance) {
    // Data is consistent, no correction needed
    return transmission;
  }

  // Data is inconsistent - rpmAt100Kmh is the source of truth
  // Calculate the correct tireRadiusM that would produce rpmAt100Kmh
  // Formula: rpm = (100/3.6) / (2π * r) * gearRatio * finalDrive * 60
  // Solving for r: r = (100/3.6) * gearRatio * finalDrive * 60 / (2π * rpm)
  const correctedTireRadiusM =
    (speedMs * topGearRatio * finalDrive * 60) / (2 * Math.PI * rpmAt100Kmh);

  debugLog(
    `[Transmission] Correcting transmission data: calculated RPM=${rpmCalculated}, ` +
      `expected RPM=${rpmAt100Kmh}, correcting tireRadiusM from ${tireRadiusM.toFixed(3)} to ${correctedTireRadiusM.toFixed(3)}`,
  );

  return {
    ...transmission,
    tireRadiusM: Math.round(correctedTireRadiusM * 1000) / 1000,
  };
}

/**
 * Get the clutch engagement speed based on engine aspiration type.
 * Below this speed, the clutch is slipping and RPM decouples from wheel speed.
 */
export function getClutchEngagementSpeed(
  aspiration: "NA" | "turbo" | "turbo-diesel",
): number {
  return SCORING_PARAMS[aspiration].clutchEngagementSpeedKmh;
}

/**
 * Calculate RPM for a given speed, gear, and transmission.
 * Uses rpmAt100Kmh as source of truth when available.
 * Below clutch engagement speed, uses a smoothstep clutch-slip model.
 */
export function calculateRpm(
  speedKmh: number,
  gearIndex: number,
  transmission: TransmissionData,
  aspiration: "NA" | "turbo" | "turbo-diesel" = "NA",
  clampToIdle: boolean = true,
): number {
  const correctedTransmission = validateTransmission(transmission);
  const idleRpm = correctedTransmission.idleRpm;
  const engagementSpeed = getClutchEngagementSpeed(aspiration);

  if (speedKmh < 1) {
    return idleRpm;
  }

  if (speedKmh < engagementSpeed) {
    const engagementRpm = computeGearRpm(
      engagementSpeed,
      gearIndex,
      correctedTransmission,
    );
    const factor = smoothstep(0, engagementSpeed, speedKmh);
    const rpm = idleRpm + (engagementRpm - idleRpm) * factor;
    return Math.round(rpm);
  }

  const rpm = computeGearRpm(speedKmh, gearIndex, correctedTransmission);

  if (clampToIdle && rpm < idleRpm) {
    return idleRpm;
  }

  return rpm;
}

function computeGearRpm(
  speedKmh: number,
  gearIndex: number,
  transmission: TransmissionData,
): number {
  if (transmission.rpmAt100Kmh && transmission.rpmAt100Kmh > 0) {
    const topGearIndex = transmission.gearRatios.length - 1;
    const currentGearRatio = transmission.gearRatios[gearIndex];
    const topGearRatio = transmission.gearRatios[topGearIndex];
    return Math.round(
      transmission.rpmAt100Kmh *
        (speedKmh / 100) *
        (currentGearRatio / topGearRatio),
    );
  }

  const speedMs = speedKmh / 3.6;
  const wheelRps = speedMs / (2 * Math.PI * transmission.tireRadiusM);
  const gearRatio = transmission.gearRatios[gearIndex];
  const engineRps = wheelRps * gearRatio * transmission.finalDrive;
  return Math.round(engineRps * 60);
}

// ============================================================================
// CÁLCULO DE CARGA DO MOTOR
// ============================================================================

/**
 * Determine engine aspiration type from vehicle data
 */
export function getAspirationType(
  vehicle: Vehicle,
): "NA" | "turbo" | "turbo-diesel" {
  // Check if vehicle has turbo characteristics
  if (vehicle.peakPowerKw > 0 && vehicle.peakTorqueNm > 0) {
    const powerToDisplacement =
      vehicle.peakPowerKw / (vehicle.displacement / 1000);
    // High power/displacement ratio indicates turbo
    if (powerToDisplacement > 55) {
      return vehicle.fuelType === "diesel" ? "turbo-diesel" : "turbo";
    }
  }

  // Check transmission data for hints
  if (vehicle.transmission?.torqueCurve) {
    const curve = vehicle.transmission.torqueCurve;
    const rpms = Object.keys(curve)
      .map(Number)
      .sort((a, b) => a - b);
    if (rpms.length > 0) {
      const torqueAt1000 = curve[1000] ?? curve[rpms[0]];
      const maxTorque = Math.max(...Object.values(curve));
      // If torque is already high at low RPM, likely turbo
      if (torqueAt1000 > maxTorque * 0.8 && rpms[0] <= 1500) {
        return vehicle.fuelType === "diesel" ? "turbo-diesel" : "turbo";
      }
    }
  }

  return "NA";
}

/**
 * Estimate torque curve based on engine characteristics
 */
export function estimateTorqueCurve(
  displacement: number,
  peakTorqueNm: number,
  aspiration: "NA" | "turbo" | "turbo-diesel" = "NA",
  idleRpm: number = 800,
  redlineRpm: number = 6000,
): Record<number, number> {
  const curve: Record<number, number> = {};
  const rpms = [
    idleRpm,
    1000,
    1250,
    1500,
    1750,
    2000,
    2250,
    2500,
    2750,
    3000,
    3250,
    3500,
    3750,
    4000,
    4500,
    5000,
    5500,
    6000,
    redlineRpm,
  ].filter((rpm) => rpm >= idleRpm && rpm <= redlineRpm);

  // Define torque curve profiles based on aspiration type
  const profiles = {
    NA: {
      idleFactor: 0.75,
      peakRpm: 3500 + displacement * 0.5,
      dropOffStart: 5000,
      redlineFactor: 0.72,
    },
    turbo: {
      idleFactor: 0.45,
      peakRpm: 2000 + displacement * 0.3,
      dropOffStart: 4500,
      redlineFactor: 0.78,
    },
    "turbo-diesel": {
      idleFactor: 0.55,
      peakRpm: 1750 + displacement * 0.15,
      dropOffStart: 3000,
      redlineFactor: 0.65,
    },
  };

  const profile = profiles[aspiration];

  for (const rpm of rpms) {
    let torqueFactor: number;

    if (rpm <= profile.peakRpm) {
      const progress = (rpm - idleRpm) / (profile.peakRpm - idleRpm);
      torqueFactor =
        profile.idleFactor +
        (1.0 - profile.idleFactor) * Math.sin((progress * Math.PI) / 2);
    } else if (rpm <= profile.dropOffStart) {
      torqueFactor = 1.0;
    } else {
      const progress =
        (rpm - profile.dropOffStart) / (redlineRpm - profile.dropOffStart);
      torqueFactor = 1.0 - (1.0 - profile.redlineFactor) * progress;
    }

    curve[rpm] = Math.round(peakTorqueNm * torqueFactor);
  }

  return curve;
}

/**
 * Get torque at a specific RPM by interpolating the torque curve
 */
export function getTorqueAtRpm(
  rpm: number,
  torqueCurve: Record<number, number>,
  peakTorqueNm: number,
  idleRpm: number,
  redlineRpm: number,
): number {
  const rpms = Object.keys(torqueCurve)
    .map(Number)
    .sort((a, b) => a - b);

  if (rpms.length === 0) return peakTorqueNm;

  if (rpm <= idleRpm) return torqueCurve[rpms[0]] ?? peakTorqueNm * 0.7;
  if (rpm >= redlineRpm)
    return torqueCurve[rpms[rpms.length - 1]] ?? peakTorqueNm * 0.7;

  for (let i = 0; i < rpms.length - 1; i++) {
    if (rpm >= rpms[i] && rpm <= rpms[i + 1]) {
      const t1 = torqueCurve[rpms[i]];
      const t2 = torqueCurve[rpms[i + 1]];
      const ratio = (rpm - rpms[i]) / (rpms[i + 1] - rpms[i]);
      return t1 + (t2 - t1) * ratio;
    }
  }

  return torqueCurve[rpms[0]] ?? peakTorqueNm;
}

/**
 * Calculate engine load for a given driving condition
 */
export function calculateEngineLoad(input: EngineLoadInput): EngineLoadResult {
  const { vehicle, speedKmh, accelerationMps2, slopePercent, gearIndex } =
    input;
  const transmission = vehicle.transmission;

  if (!transmission) {
    throw new Error(
      "Vehicle must have transmission data to calculate engine load",
    );
  }

  if (gearIndex < 0 || gearIndex >= transmission.gearRatios.length) {
    throw new Error(
      `Invalid gear index ${gearIndex}. Vehicle has ${transmission.gearRatios.length} gears.`,
    );
  }

  // Calculate current RPM (uses validated transmission)
  const currentRpm = calculateRpm(speedKmh, gearIndex, transmission);

  // Get or estimate torque curve
  let torqueCurve = transmission.torqueCurve;
  if (!torqueCurve || Object.keys(torqueCurve).length < 3) {
    const aspiration = getAspirationType(vehicle);
    torqueCurve = estimateTorqueCurve(
      vehicle.displacement,
      vehicle.peakTorqueNm,
      aspiration,
      transmission.idleRpm,
      transmission.redlineRpm,
    );
  }

  // Get available torque at current RPM
  const availableTorqueNm = getTorqueAtRpm(
    currentRpm,
    torqueCurve,
    vehicle.peakTorqueNm,
    transmission.idleRpm,
    transmission.redlineRpm,
  );

  // Calculate available power (kW): P = τ × ω
  const availablePowerKw =
    (availableTorqueNm * currentRpm * 2 * Math.PI) / 60000;

  // Calculate required power components
  const speedMs = speedKmh / 3.6;
  const p = input.passengers ?? 1;
  const cg = input.cargoKg ?? 0;
  const gnvWeight = (input.isGnv ?? false) ? 80 : 0;
  const massTotal = vehicle.mass + p * 75 + cg + gnvWeight;
  const cda = vehicle.frontalArea * vehicle.dragCoefficient;

  // 1. Rolling resistance power
  const rollingResistanceKw =
    (massTotal * PHYSICS.G * vehicle.crr * speedMs) / 1000;

  // 2. Aerodynamic drag power (scales with velocity cubed)
  const aerodynamicDragKw =
    (0.5 * PHYSICS.AIR_DENSITY * cda * Math.pow(speedMs, 3)) / 1000;

  // 3. Slope power - CRITICAL: this is where slope affects load!
  const slopeRadians = Math.atan(slopePercent / 100);
  const slopeForce = massTotal * PHYSICS.G * Math.sin(slopeRadians);
  const slopeKw = (slopeForce * speedMs) / 1000;

  // 4. Acceleration power
  const accelerationForce = massTotal * accelerationMps2;
  const accelerationKw = (accelerationForce * speedMs) / 1000;

  // Total required power
  const requiredPowerKw =
    rollingResistanceKw + aerodynamicDragKw + slopeKw + accelerationKw;

  // Calculate engine load percentage
  const minPowerKw = 1.0;
  const effectiveAvailablePower = Math.max(availablePowerKw, minPowerKw);
  const engineLoadPercent = (requiredPowerKw / effectiveAvailablePower) * 100;

  // Determine operating conditions
  const aspiration = getAspirationType(vehicle);
  const minOperatingRpm = MIN_OPERATING_RPM[aspiration] || 1300;
  const isLugging = currentRpm < minOperatingRpm && speedKmh > 5;
  const isOverRev = currentRpm > transmission.redlineRpm * 0.9;

  return {
    engineLoadPercent: Math.round(engineLoadPercent * 10) / 10,
    requiredPowerKw: Math.round(requiredPowerKw * 100) / 100,
    availablePowerKw: Math.round(availablePowerKw * 100) / 100,
    currentRpm,
    availableTorqueNm: Math.round(availableTorqueNm * 10) / 10,
    isLugging,
    isOverRev,
    powerBreakdown: {
      rollingResistanceKw: Math.round(rollingResistanceKw * 100) / 100,
      aerodynamicDragKw: Math.round(aerodynamicDragKw * 100) / 100,
      slopeKw: Math.round(slopeKw * 100) / 100,
      accelerationKw: Math.round(accelerationKw * 100) / 100,
      totalKw: Math.round(requiredPowerKw * 100) / 100,
    },
  };
}

/**
 * Calculate engine load for all possible gears
 */
export function calculateEngineLoadForAllGears(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
): Array<EngineLoadResult & { gearIndex: number; gearNumber: number }> {
  if (!vehicle.transmission) {
    return [];
  }

  const results: Array<
    EngineLoadResult & { gearIndex: number; gearNumber: number }
  > = [];

  for (let i = 0; i < vehicle.transmission.gearRatios.length; i++) {
    try {
      const result = calculateEngineLoad({
        vehicle,
        speedKmh,
        accelerationMps2,
        slopePercent,
        gearIndex: i,
      });

      results.push({
        ...result,
        gearIndex: i,
        gearNumber: i + 1,
      });
    } catch {
      continue;
    }
  }

  return results;
}

// ============================================================================
// FILTRO DE VIABILIDADE E SCORING MULTI-CRITÉRIO
// ============================================================================

export interface ViableGearResult {
  gearIndex: number;
  gearNumber: number;
  rpm: number;
  engineLoad: EngineLoadResult;
  isViable: boolean;
  viabilityReason: string;
}

export function filterViableGears(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
): ViableGearResult[] {
  if (!vehicle.transmission) {
    return [];
  }

  const aspiration = getAspirationType(vehicle);
  const params = SCORING_PARAMS[aspiration];
  const transmission = vehicle.transmission;
  const engagementSpeed = params.clutchEngagementSpeedKmh;

  if (speedKmh < 1) {
    return [
      {
        gearIndex: 0,
        gearNumber: 1,
        rpm: transmission.idleRpm,
        engineLoad: calculateEngineLoad({
          vehicle,
          speedKmh,
          accelerationMps2,
          slopePercent,
          gearIndex: 0,
        }),
        isViable: true,
        viabilityReason: "Vehicle stationary - gear 1",
      },
    ];
  }

  if (speedKmh < engagementSpeed) {
    const firstGearRpm = Math.round(
      transmission.idleRpm +
        (computeGearRpm(engagementSpeed, 0, validateTransmission(transmission)) -
          transmission.idleRpm) *
          smoothstep(0, engagementSpeed, speedKmh),
    );
    return [
      {
        gearIndex: 0,
        gearNumber: 1,
        rpm: firstGearRpm,
        engineLoad: calculateEngineLoad({
          vehicle,
          speedKmh,
          accelerationMps2,
          slopePercent,
          gearIndex: 0,
        }),
        isViable: true,
        viabilityReason: `Below clutch engagement (${engagementSpeed} km/h) - gear 1`,
      },
    ];
  }

  const allLoads = calculateEngineLoadForAllGears(
    vehicle,
    speedKmh,
    accelerationMps2,
    slopePercent,
  );

  const results: ViableGearResult[] = [];

  for (const load of allLoads) {
    const rpm = calculateRpm(
      speedKmh,
      load.gearIndex,
      transmission,
      aspiration,
      false,
    );
    const minRpm = params.minOperatingRpm;
    const maxRpm = transmission.redlineRpm * 0.95;

    let isViable = true;
    let reason = "Viable";

    if (rpm < minRpm) {
      isViable = false;
      reason = `RPM ${rpm} below min ${minRpm} (lugging)`;
    } else if (rpm > maxRpm) {
      isViable = false;
      reason = `RPM ${rpm} above redline limit ${Math.round(maxRpm)} (over-rev)`;
    }

    results.push({
      gearIndex: load.gearIndex,
      gearNumber: load.gearNumber,
      rpm,
      engineLoad: load,
      isViable,
      viabilityReason: reason,
    });
  }

  if (results.every((r) => !r.isViable)) {
    const closest = results.reduce((best, curr) =>
      Math.abs(curr.rpm - params.minOperatingRpm) <
      Math.abs(best.rpm - params.minOperatingRpm)
        ? curr
        : best,
    );
    closest.isViable = true;
    closest.viabilityReason = `Fallback: closest to min RPM ${params.minOperatingRpm}`;
  }

  return results;
}

export interface GearScore {
  gearIndex: number;
  gearNumber: number;
  rpm: number;
  engineLoad: EngineLoadResult;
  totalScore: number;
  fuelScore: number;
  driveScore: number;
  powerScore: number;
  safetyScore: number;
  isViable: boolean;
  reason: string;
}

function scoreViableGear(
  vehicle: Vehicle,
  _speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
  viableGear: ViableGearResult,
  aspiration: "NA" | "turbo" | "turbo-diesel",
): GearScore {
  const params = SCORING_PARAMS[aspiration];
  const { rpm, engineLoad } = viableGear;

  const bsfcBase = vehicle.baseBsfc || 250;
  const rpmOffsetFactor = 1 + Math.abs(rpm - params.rpmOptimal) / (params.rpmOptimal * 2);
  const loadFactor = getLoadFactor(engineLoad.engineLoadPercent);
  const bsfc = bsfcBase * rpmOffsetFactor * loadFactor;

  const fuelScore = gaussianScore(bsfc, bsfcBase, params.sigmaBsfc);

  const isCruising = slopePercent < 2 && accelerationMps2 < 0.5;
  const rpmTarget = isCruising
    ? params.minOperatingRpm + (params.rpmOptimal - params.minOperatingRpm) * 0.2
    : params.rpmOptimal;

  const driveScore = isCruising
    ? gaussianScore(rpm, rpmTarget, params.sigmaRpmHigh)
    : asymmetricScore(
        rpm,
        rpmTarget,
        params.sigmaRpmLow,
        params.sigmaRpmHigh,
      );

  const loadFraction = engineLoad.engineLoadPercent / 100;
  const optimalLoad = isCruising ? 0.30 : 0.65;
  const sigmaLoad = isCruising ? params.sigmaLoad * 2.0 : params.sigmaLoad;
  const powerScore = gaussianScore(loadFraction, optimalLoad, sigmaLoad);

  const maxRpm = vehicle.transmission!.redlineRpm * 0.95;
  const safetyScore = rpm > maxRpm ? 0 : 1;

  const uphillWeight = sigmoid(slopePercent, 3, 2);
  const accelWeight = sigmoid(accelerationMps2, 0.5, 3.3);
  const hardAccelWeight = sigmoid(accelerationMps2, 2.0, 4);

  const rawWFuel = 0.45 * (1 - uphillWeight) * (1 - accelWeight);
  const rawWDrive = 0.20 + 0.05 * uphillWeight + 0.05 * (1 - hardAccelWeight);
  const rawWPower = 0.10 + 0.20 * (uphillWeight + hardAccelWeight);
  const rawWSafety = 0.25 - 0.15 * hardAccelWeight;
  const totalRaw = rawWFuel + rawWDrive + rawWPower + rawWSafety;

  const wFuel = rawWFuel / totalRaw;
  const wDrive = rawWDrive / totalRaw;
  const wPower = rawWPower / totalRaw;
  const wSafety = rawWSafety / totalRaw;

  const totalScore =
    wFuel * fuelScore +
    wDrive * driveScore +
    wPower * powerScore +
    wSafety * safetyScore;

  let reason: string;
  if (hardAccelWeight > 0.7) {
    reason = "Power demand - hard acceleration";
  } else if (uphillWeight > 0.7) {
    reason = "Power demand - steep uphill";
  } else if (fuelScore > driveScore && fuelScore > powerScore) {
    reason = "Fuel efficiency optimal";
  } else if (driveScore > fuelScore) {
    reason = "Drivability optimal";
  } else {
    reason = "Power reserve optimal";
  }

  return {
    gearIndex: viableGear.gearIndex,
    gearNumber: viableGear.gearNumber,
    rpm,
    engineLoad,
    totalScore,
    fuelScore,
    driveScore,
    powerScore,
    safetyScore,
    isViable: viableGear.isViable,
    reason,
  };
}

function getLoadFactor(engineLoadPercent: number): number {
  const load = Math.max(0.01, Math.min(1.0, engineLoadPercent / 100));
  if (load <= 0.05) return 2.8;
  if (load < 0.15) return 1 + 1.8 * Math.pow((0.15 - load) / 0.1, 1.2);
  if (load < 0.75) return 1 + 0.25 * Math.pow((0.75 - load) / 0.6, 1.5);
  return 1 + 0.1 * Math.pow((load - 0.75) / 0.25, 2);
}

// ============================================================================
// SELEÇÃO DE MARCHA COM SCORING MULTI-CRITÉRIO
// ============================================================================

export interface GearSelectionParams {
  maxLoadPercent: number; // Maximum acceptable load (e.g., 85%)
  minLoadPercent: number; // Minimum acceptable load (e.g., 25%)
  preferHigherGear: boolean; // true for cruising, false for power
  downshiftOnUphill: boolean; // true to downshift on slopes > 5%
}

/**
 * Select the best gear using multi-criteria Gaussian scoring.
 *
 * Phase 1: Filter viable gears (RPM within operating range)
 * Phase 2: Score each viable gear (fuel, drivability, power, safety)
 * Phase 3: Apply hysteresis if currentGear is provided
 */
export function selectOptimalGear(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
  currentGear?: number,
): GearEstimationResult {
  if (!vehicle.transmission) {
    return {
      gear: 1,
      rpm: 800,
      confidence: 0.5,
      engineLoad: 0,
      reason: "No transmission data",
    };
  }

  if (speedKmh < 1) {
    return {
      gear: 1,
      rpm: vehicle.transmission.idleRpm,
      confidence: 0.95,
      engineLoad: 0,
      reason: "Vehicle stationary",
    };
  }

  const aspiration = getAspirationType(vehicle);

  const viableGears = filterViableGears(
    vehicle,
    speedKmh,
    accelerationMps2,
    slopePercent,
  );

  if (viableGears.length === 0) {
    return {
      gear: 1,
      rpm: vehicle.transmission.idleRpm,
      confidence: 0.3,
      engineLoad: 0,
      reason: "No viable gears found",
    };
  }

  const scoredGears = viableGears
    .filter((g) => g.isViable)
    .map((g) =>
      scoreViableGear(vehicle, speedKmh, accelerationMps2, slopePercent, g, aspiration),
    );

  if (scoredGears.length === 0) {
    const fallback = viableGears.find((g) => g.isViable) || viableGears[0];
    return {
      gear: fallback.gearNumber,
      rpm: fallback.rpm,
      confidence: 0.3,
      engineLoad: fallback.engineLoad.engineLoadPercent,
      reason: fallback.viabilityReason,
    };
  }

  scoredGears.sort((a, b) => b.totalScore - a.totalScore);

  const bestGear = scoredGears[0];

  if (currentGear === undefined || currentGear < 1) {
    const rpm = calculateRpm(
      speedKmh,
      bestGear.gearIndex,
      vehicle.transmission,
      aspiration,
    );
    return {
      gear: bestGear.gearNumber,
      rpm,
      confidence: Math.min(0.9, 0.5 + bestGear.totalScore * 0.4),
      engineLoad: bestGear.engineLoad.engineLoadPercent,
      reason: bestGear.reason,
    };
  }

  const currentGearResult = scoredGears.find(
    (g) => g.gearNumber === currentGear,
  );

  if (!currentGearResult) {
    const rpm = calculateRpm(
      speedKmh,
      bestGear.gearIndex,
      vehicle.transmission,
      aspiration,
    );
    return {
      gear: bestGear.gearNumber,
      rpm,
      confidence: Math.min(0.85, 0.5 + bestGear.totalScore * 0.35),
      engineLoad: bestGear.engineLoad.engineLoadPercent,
      reason: bestGear.reason,
    };
  }

  const gearDiff = bestGear.gearNumber - currentGear;

  if (gearDiff === 0) {
    const rpm = calculateRpm(
      speedKmh,
      bestGear.gearIndex,
      vehicle.transmission,
      aspiration,
    );
    return {
      gear: currentGear,
      rpm,
      confidence: Math.min(0.9, 0.6 + bestGear.totalScore * 0.3),
      engineLoad: bestGear.engineLoad.engineLoadPercent,
      reason: bestGear.reason,
    };
  }

  if (gearDiff > 0) {
    const currentScore = currentGearResult.totalScore;
    const upshiftRequired = bestGear.totalScore > currentScore * (1 + HYSTERESIS_CONFIG.upshiftMargin);
    if (!upshiftRequired && speedKmh > HYSTERESIS_CONFIG.lowSpeedBypassKmh) {
      const rpm = calculateRpm(
        speedKmh,
        currentGearResult.gearIndex,
        vehicle.transmission,
        aspiration,
      );
      return {
        gear: currentGear,
        rpm,
        confidence: Math.min(0.85, 0.5 + currentScore * 0.35),
        engineLoad: currentGearResult.engineLoad.engineLoadPercent,
        reason: `Hysteresis: holding gear ${currentGear}`,
      };
    }
  }

  if (gearDiff < 0) {
    const currentScore = currentGearResult.totalScore;
    const bestScore = bestGear.totalScore;
    const downshiftRequired =
      currentScore < bestScore * (1 - HYSTERESIS_CONFIG.downshiftMargin);
    if (
      !downshiftRequired &&
      speedKmh > HYSTERESIS_CONFIG.lowSpeedBypassKmh &&
      accelerationMps2 < HYSTERESIS_CONFIG.kickdownAccelThreshold
    ) {
      const rpm = calculateRpm(
        speedKmh,
        currentGearResult.gearIndex,
        vehicle.transmission,
        aspiration,
      );
      return {
        gear: currentGear,
        rpm,
        confidence: Math.min(0.85, 0.5 + currentScore * 0.35),
        engineLoad: currentGearResult.engineLoad.engineLoadPercent,
        reason: `Hysteresis: holding gear ${currentGear}`,
      };
    }
  }

  const step = gearDiff > 0 ? 1 : -1;
  const intermediateGearNum = currentGear + step;

  if (Math.abs(gearDiff) <= 1 || accelerationMps2 > HYSTERESIS_CONFIG.kickdownAccelThreshold || speedKmh < HYSTERESIS_CONFIG.lowSpeedBypassKmh) {
    const rpm = calculateRpm(
      speedKmh,
      bestGear.gearIndex,
      vehicle.transmission,
      aspiration,
    );
    return {
      gear: bestGear.gearNumber,
      rpm,
      confidence: Math.min(0.9, 0.5 + bestGear.totalScore * 0.4),
      engineLoad: bestGear.engineLoad.engineLoadPercent,
      reason: gearDiff < 0 ? `Downshift: ${bestGear.reason}` : `Upshift: ${bestGear.reason}`,
    };
  }

  const intermediateResult = scoredGears.find(
    (g) => g.gearNumber === intermediateGearNum,
  );

  if (intermediateResult && intermediateResult.isViable) {
    const rpm = calculateRpm(
      speedKmh,
      intermediateResult.gearIndex,
      vehicle.transmission,
      aspiration,
    );
    return {
      gear: intermediateGearNum,
      rpm,
      confidence: Math.min(0.85, 0.5 + intermediateResult.totalScore * 0.35),
      engineLoad: intermediateResult.engineLoad.engineLoadPercent,
      reason: `Transition ${currentGear}→${intermediateGearNum}`,
    };
  }

  const rpm = calculateRpm(
    speedKmh,
    bestGear.gearIndex,
    vehicle.transmission,
    aspiration,
  );
  return {
    gear: bestGear.gearNumber,
    rpm,
    confidence: Math.min(0.85, 0.5 + bestGear.totalScore * 0.35),
    engineLoad: bestGear.engineLoad.engineLoadPercent,
    reason: bestGear.reason,
  };
}

/**
 * Score a gear based on engine load and operating conditions
 * Returns a score from 0-100 where higher is better
 * @deprecated Use selectOptimalGear instead which includes this logic internally
 */
export function scoreGear(
  result: EngineLoadResult,
  accelerationMps2: number,
  slopePercent: number,
): number {
  let score = 100;

  // Penalize lugging (RPM too low)
  if (result.isLugging) {
    score -= 50;
  }

  // Penalize over-rev
  if (result.isOverRev) {
    score -= 100;
  }

  // Ideal load is 50-70% for cruising, 60-85% for acceleration
  const isAccelerating = accelerationMps2 > 0.5;
  const isClimbing = slopePercent > 3;

  if (isAccelerating || isClimbing) {
    // For acceleration/climbing, prefer higher load but not maxed out
    if (result.engineLoadPercent < 50) {
      score -= (50 - result.engineLoadPercent) * 0.5;
    } else if (result.engineLoadPercent > 90) {
      score -= (result.engineLoadPercent - 90) * 2;
    }
  } else {
    // For cruising, prefer moderate load for efficiency
    if (result.engineLoadPercent < 30) {
      score -= (30 - result.engineLoadPercent) * 0.8;
    } else if (result.engineLoadPercent > 75) {
      score -= (result.engineLoadPercent - 75) * 1.5;
    }
  }

  // Prefer RPM in comfortable range
  const minComfortableRpm = 1400;
  const optimalRpm = 2500;

  if (result.currentRpm < minComfortableRpm) {
    score -= (minComfortableRpm - result.currentRpm) * 0.05;
  }

  // Bonus for being near optimal RPM
  const rpmDiff = Math.abs(result.currentRpm - optimalRpm);
  if (rpmDiff < 500) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// FUNÇÕES LEGADAS (para compatibilidade)
// ============================================================================

/**
 * Legacy function for backward compatibility
 * @deprecated Use selectOptimalGear instead
 */
export function estimateGearAndRpm(
  vehicle: Vehicle,
  speedKmh: number,
  accelerationMps2: number,
  slopePercent: number,
): GearEstimationResult {
  return selectOptimalGear(vehicle, speedKmh, accelerationMps2, slopePercent);
}
