import type { Vehicle, FuelType, TechEra, TransmissionData } from "@/types";

export interface TelemetryInput {
  speed: number;
  slope: number;
  accel: number;
  acOn: boolean;
  passengers: number;
  cargoKg: number;
  fuelType: FuelType;
  batterySocPct: number;
}

export interface TelemetryResult {
  kmpl: number;
  lphOrM3ph: number;
  updatedBatterySocPct: number;
  isHybridEvMode: boolean;
  factors: TelemetryFactors;
  gear?: number;
  rpm?: number;
  confidence: number;
  hasTransmissionData: boolean;
}

export interface TelemetryFactors {
  baseKmpl: number;
  massPenalty: number;
  speedFactor: number;
  dynamicFactor: number;
  acFactor: number;
  hybridImprovement: number;
  fuelCutActive: boolean;
}

const WORLD = {
  AIR_DENSITY: 1.225,
  G: 9.81,
  FUEL_E27_DENSITY: 0.75,
  FUEL_E100_DENSITY: 0.79,
  GNV_DENSITY: 0.717,
} as const;

const CITY_SPEED_THRESHOLD = 60;
const MIN_KMPL = 3.0;

function getCalibratedBase(
  vehicle: Vehicle,
  isCity: boolean,
  fuelType: FuelType,
): number {
  const wInmetro = vehicle.weightInmetro ?? 0.6;
  const wUser = vehicle.weightUser ?? 0.4;

  if (fuelType === "gnv") {
    const inmetroCity = vehicle.inmetroGnvCityKmpl ?? vehicle.inmetroCityKmpl;
    const inmetroHighway =
      vehicle.inmetroGnvHighwayKmpl ?? vehicle.inmetroHighwayKmpl;
    const userCity = vehicle.userAvgGnvCityKmpl ?? vehicle.userAvgCityKmpl;
    const userHighway =
      vehicle.userAvgGnvHighwayKmpl ?? vehicle.userAvgHighwayKmpl;

    if (isCity) {
      return inmetroCity * wInmetro + userCity * wUser;
    }
    return inmetroHighway * wInmetro + userHighway * wUser;
  }

  if (fuelType === "etanol") {
    const inmetroCity =
      vehicle.inmetroEthanolCityKmpl ?? vehicle.inmetroCityKmpl;
    const inmetroHighway =
      vehicle.inmetroEthanolHighwayKmpl ?? vehicle.inmetroHighwayKmpl;
    const userCity = vehicle.userAvgEthanolCityKmpl ?? vehicle.userAvgCityKmpl;
    const userHighway =
      vehicle.userAvgEthanolHighwayKmpl ?? vehicle.userAvgHighwayKmpl;

    if (isCity) {
      return inmetroCity * wInmetro + userCity * wUser;
    }
    return inmetroHighway * wInmetro + userHighway * wUser;
  }

  if (isCity) {
    return vehicle.inmetroCityKmpl * wInmetro + vehicle.userAvgCityKmpl * wUser;
  }
  return (
    vehicle.inmetroHighwayKmpl * wInmetro + vehicle.userAvgHighwayKmpl * wUser
  );
}

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

function predictGear(
  speedKmh: number,
  transmission: TransmissionData,
): { gear: number; rpm: number } {
  const { gearRatios, finalDrive, tireRadiusM, idleRpm, redlineRpm } =
    transmission;

  if (speedKmh < 1) {
    return { gear: 0, rpm: idleRpm };
  }

  for (let i = 0; i < gearRatios.length; i++) {
    const rpm = calculateRPM(speedKmh, gearRatios[i], finalDrive, tireRadiusM);
    if (rpm >= idleRpm && rpm <= redlineRpm) {
      return { gear: i + 1, rpm: Math.round(rpm) };
    }
  }

  const results = gearRatios.map((ratio, i) => ({
    gear: i + 1,
    rpm: calculateRPM(speedKmh, ratio, finalDrive, tireRadiusM),
  }));

  const valid = results.filter((r) => r.rpm >= idleRpm && r.rpm <= redlineRpm);
  if (valid.length > 0) {
    const best = valid.reduce((a, b) => (a.rpm < b.rpm ? a : b));
    return { gear: best.gear, rpm: Math.round(best.rpm) };
  }

  const closest = results.reduce((a, b) => {
    const aDist = Math.min(
      Math.abs(a.rpm - idleRpm),
      Math.abs(a.rpm - redlineRpm),
    );
    const bDist = Math.min(
      Math.abs(b.rpm - idleRpm),
      Math.abs(b.rpm - redlineRpm),
    );
    return aDist < bDist ? a : b;
  });

  return { gear: closest.gear, rpm: Math.round(closest.rpm) };
}

function getTorqueAtRpm(
  rpm: number,
  torqueCurve: Record<number, number>,
): number {
  const rpms = Object.keys(torqueCurve)
    .map(Number)
    .sort((a, b) => a - b);

  if (rpms.length === 0) return 0;
  if (rpm <= rpms[0]) return torqueCurve[rpms[0]];
  if (rpm >= rpms[rpms.length - 1]) return torqueCurve[rpms[rpms.length - 1]];

  for (let i = 0; i < rpms.length - 1; i++) {
    if (rpm >= rpms[i] && rpm <= rpms[i + 1]) {
      const t1 = torqueCurve[rpms[i]];
      const t2 = torqueCurve[rpms[i + 1]];
      const ratio = (rpm - rpms[i]) / (rpms[i + 1] - rpms[i]);
      return t1 + (t2 - t1) * ratio;
    }
  }

  return torqueCurve[rpms[0]];
}

function calculatePhysicsConsumption(
  rpm: number,
  torqueNm: number,
  bsfcMinGPerKwh: number,
  techEra: TechEra,
  fuelType: FuelType,
  speedKmh: number,
): number {
  const powerKw = (torqueNm * rpm * 2 * Math.PI) / 60000;
  if (powerKw <= 0.1) return 999;

  const bsfcMap: Record<TechEra, number> = {
    carburetor: 280,
    injection_early: 265,
    injection_modern: 250,
    direct_injection: 235,
  };

  const bsfcBase = bsfcMinGPerKwh || bsfcMap[techEra] || 250;
  const bsfc = bsfcBase * (1 + Math.abs(rpm - 2500) / 5000);
  const fuelFlowGPerH = bsfc * powerKw;

  const fuelDensity =
    fuelType === "etanol" ? WORLD.FUEL_E100_DENSITY : WORLD.FUEL_E27_DENSITY;
  const fuelFlowLPerH = fuelFlowGPerH / fuelDensity / 1000;

  if (fuelFlowLPerH <= 0 || speedKmh < 1) return 999;

  return speedKmh / fuelFlowLPerH;
}

export function simulate(
  vehicle: Vehicle,
  input: TelemetryInput,
): TelemetryResult {
  const {
    speed,
    slope,
    accel,
    acOn,
    passengers,
    cargoKg,
    fuelType,
    batterySocPct,
  } = input;

  const isCity = speed < CITY_SPEED_THRESHOLD;
  const baseKmpl = getCalibratedBase(vehicle, isCity, fuelType);

  let batterySoc = batterySocPct;
  let isHybridEvMode = false;

  const extraMass =
    (passengers - 1) * 75 +
    cargoKg +
    (fuelType === "gnv" ? (vehicle.gnvCylinderWeightKg ?? 80) : 0);
  const massPenalty = 1.0 + (extraMass / vehicle.mass) * 0.4;

  let speedFactor = 1.0;
  if (isCity) {
    // City driving: optimal speed is around 32-35 km/h
    // Below 32 km/h: efficiency improves (higher km/l)
    // Above 32 km/h: efficiency degrades (lower km/l)
    // The formula creates an asymmetric curve that favors lower speeds
    if (speed > 0) {
      const optimalSpeed = 32.5;
      const speedDelta = speed - optimalSpeed;
      // If below optimal (negative delta), speedFactor < 1 (improve efficiency)
      // If above optimal (positive delta), speedFactor > 1 (worsen efficiency)
      if (speedDelta < 0) {
        speedFactor = 1.0 - Math.abs(speedDelta) * 0.003; // Improvement at low speeds
      } else {
        speedFactor = 1.0 + speedDelta * 0.0085; // Steeper penalty above optimal
      }
    }
  } else {
    // Highway driving: efficiency improves as speed increases, but at a decreasing rate
    // Peak efficiency around 80-90 km/h, then degrades above 100 km/h
    // The formula accounts for increased aerodynamic drag at higher speeds
    speedFactor = 1.0 - (speed - 85.0) * 0.008;
  }

  const dynamicFactor = 1.0 - slope * 0.025 - accel * 0.415;
  const fuelCutActive = slope < -3 && speed > 0;

  const acPenalty = vehicle.peakPowerKw <= 80 ? 0.12 : 0.08;
  const acFactor = acOn ? 1.0 - acPenalty : 1.0;

  let hybridImprovement = 1.0;
  if (vehicle.isHybrid) {
    if (isCity) {
      hybridImprovement = 1.6;
      isHybridEvMode = batterySoc > 20;
      batterySoc = Math.max(20, batterySoc - 2);
    } else {
      hybridImprovement = 1.1;
      batterySoc = Math.min(100, batterySoc + 1);
    }
  }

  // For city driving, divide by speedFactor (use reciprocal)
  // For highway, multiply by speedFactor (use directly)
  // This ensures low city speeds improve efficiency, while high highway speeds degrade it
  const speedFactorAdjustment = isCity ? 1.0 / speedFactor : speedFactor;

  const copertKmpl =
    ((baseKmpl * speedFactorAdjustment * acFactor * dynamicFactor) /
      massPenalty) *
    hybridImprovement;

  let gear: number | undefined;
  let rpm: number | undefined;
  let confidence = 0.85;
  let hasTransmissionData = false;
  let kmpl: number;

  if (vehicle.transmission) {
    hasTransmissionData = true;
    const gearResult = predictGear(speed, vehicle.transmission);
    gear = gearResult.gear;
    rpm = gearResult.rpm;

    if (
      vehicle.transmission.torqueCurve &&
      Object.keys(vehicle.transmission.torqueCurve).length > 0 &&
      vehicle.bsfcMinGPerKwh
    ) {
      const torque = getTorqueAtRpm(rpm, vehicle.transmission.torqueCurve);
      const physicsKmpl = calculatePhysicsConsumption(
        rpm,
        torque,
        vehicle.bsfcMinGPerKwh,
        vehicle.techEra || "injection_modern",
        fuelType,
        speed,
      );

      if (physicsKmpl < 999 && physicsKmpl > 0) {
        kmpl = physicsKmpl * 0.7 + copertKmpl * 0.3;
        confidence = 0.95;
      } else {
        kmpl = copertKmpl;
        confidence = 0.9;
      }
    } else {
      kmpl = copertKmpl;
      confidence = 0.9;
    }
  } else {
    kmpl = copertKmpl;
    confidence = 0.85;
  }

  if (fuelCutActive) {
    kmpl = 999;
  }

  if (fuelType === "gnv") {
    kmpl *= vehicle.gnvEfficiencyFactor ?? 1.32;
  }

  kmpl = Math.round(Math.max(kmpl, MIN_KMPL) * 100) / 100;

  const lphOrM3ph =
    kmpl > 0 && speed > 0
      ? Math.round((speed / kmpl) * 100) / 100
      : (vehicle.idleLph ?? vehicle.idleFuelRateLph ?? 0.9);

  return {
    kmpl,
    lphOrM3ph,
    updatedBatterySocPct: batterySoc,
    isHybridEvMode,
    factors: {
      baseKmpl,
      massPenalty,
      speedFactor,
      dynamicFactor,
      acFactor,
      hybridImprovement,
      fuelCutActive,
    },
    gear,
    rpm,
    confidence,
    hasTransmissionData,
  };
}

export const TelemetryConstants = WORLD;
