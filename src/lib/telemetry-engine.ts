import type { Vehicle, FuelType } from "@/types";

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

  if (fuelType === "etanol") {
    const inmetroCity =
      vehicle.inmetroEthanolCityKmpl ?? vehicle.inmetroCityKmpl * 0.7;
    const inmetroHighway =
      vehicle.inmetroEthanolHighwayKmpl ?? vehicle.inmetroHighwayKmpl * 0.7;
    const userCity =
      vehicle.userAvgEthanolCityKmpl ?? vehicle.userAvgCityKmpl * 0.7;
    const userHighway =
      vehicle.userAvgEthanolHighwayKmpl ?? vehicle.userAvgHighwayKmpl * 0.7;

    if (isCity) {
      return inmetroCity * wInmetro + userCity * wUser;
    }
    return inmetroHighway * wInmetro + userHighway * wUser;
  }

  if (fuelType === "gnv") {
    if (isCity) {
      return (
        vehicle.inmetroCityKmpl * wInmetro + vehicle.userAvgCityKmpl * wUser
      );
    }
    return (
      vehicle.inmetroHighwayKmpl * wInmetro + vehicle.userAvgHighwayKmpl * wUser
    );
  }

  if (isCity) {
    return vehicle.inmetroCityKmpl * wInmetro + vehicle.userAvgCityKmpl * wUser;
  }
  return (
    vehicle.inmetroHighwayKmpl * wInmetro + vehicle.userAvgHighwayKmpl * wUser
  );
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
    if (speed > 0) {
      speedFactor = 1.0 + (speed - 32.5) * 0.005;
    }
  } else {
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

  let kmpl: number;
  if (fuelCutActive) {
    kmpl = 999;
  } else {
    kmpl =
      ((baseKmpl * speedFactor * acFactor * dynamicFactor) / massPenalty) *
      hybridImprovement;
  }

  if (fuelType === "gnv") {
    kmpl *= vehicle.gnvEfficiencyFactor ?? 1.32;
  }

  kmpl = Math.round(Math.max(kmpl, MIN_KMPL) * 100) / 100;

  const lphOrM3ph =
    kmpl > 0 && speed > 0
      ? Math.round((speed / kmpl) * 100) / 100
      : (vehicle.idleLph ?? 0.9);

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
  };
}

export const TelemetryConstants = WORLD;
