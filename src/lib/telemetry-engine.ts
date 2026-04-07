import type { Vehicle, FuelType, TechEra, TransmissionData } from "@/types";
import {
  type DrivingStyle,
  type DrivingStyleState,
  createDrivingStyleState,
  resetDrivingStyleForTrip,
} from "./driving-style-detector";
import {
  selectOptimalGear,
  calculateEngineLoad,
} from "./transmission-calculator";

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
  engineLoad?: number; // Engine load percentage (0-100%)
  confidence: number;
  hasTransmissionData: boolean;
  drivingStyle?: "eco" | "normal" | "sport";
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

interface EstimationResult {
  gear: number;
  rpm: number;
  confidence: number;
  drivingStyle: DrivingStyle;
}

class GearRpmEstimator {
  private previousGear: number = 2;
  private styleState: DrivingStyleState;

  constructor() {
    this.styleState = createDrivingStyleState();
  }

  estimate(
    speedKmh: number,
    observedAccel: number,
    slope: number,
    transmission: TransmissionData,
    mass: number = 1000,
  ): EstimationResult {
    // Use the new selectOptimalGear function that considers engine load and slope
    // We need to create a minimal Vehicle object for the function
    const minimalVehicle: Vehicle = {
      id: "temp",
      name: "temp",
      make: "temp",
      model: "temp",
      year: 2020,
      displacement: 1600,
      fuelType: "flex",
      euroNorm: "Euro 6",
      segment: "small",
      urbanKmpl: 10,
      highwayKmpl: 14,
      combinedKmpl: 12,
      mass: mass,
      grossWeight: mass + 400,
      frontalArea: 2.2,
      dragCoefficient: 0.3,
      f0: 0.15,
      f1: 0.008,
      f2: 0.00035,
      fuelConversionFactor: 8.5,
      peakPowerKw: 80,
      peakTorqueNm: 150,
      confidence: "high",
      calibrationInput: "temp",
      calibratedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      fuelCapacity: 50,
      currentFuel: 30,
      dataSource: "manual",
      inmetroCityKmpl: 10,
      inmetroHighwayKmpl: 14,
      userAvgCityKmpl: 9,
      userAvgHighwayKmpl: 13,
      weightInmetro: 0.6,
      weightUser: 0.4,
      isHybrid: false,
      gnvCylinderWeightKg: 80,
      gnvEfficiencyFactor: 1.32,
      crr: 0.013,
      idleLph: 0.8,
      baseBsfc: 250,
      transmission,
    };

    const result = selectOptimalGear(
      minimalVehicle,
      speedKmh,
      observedAccel,
      slope,
      this.previousGear,
    );

    this.previousGear = result.gear - 1;

    return {
      gear: result.gear,
      rpm: result.rpm,
      confidence: result.confidence,
      drivingStyle: this.styleState.currentStyle,
    };
  }

  resetForNewTrip(): void {
    this.styleState = resetDrivingStyleForTrip(this.styleState);
    this.previousGear = 2;
  }

  getDrivingStyle(): DrivingStyle {
    return this.styleState.currentStyle;
  }
}

const gearEstimator = new GearRpmEstimator();

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

/**
 * Calculate BSFC load factor based on real engine data
 * Based on Heywood (1988) and SAE papers - BSFC varies with engine load
 * Optimal load is around 80%, efficiency drops at very low and very high loads
 */
function getLoadFactor(engineLoadPercent: number): number {
  // Clamp load between 0 and 100
  const load = Math.max(0, Math.min(100, engineLoadPercent)) / 100;
  const optimalLoad = 0.8; // 80% load is optimal for most engines

  // Base formula: 1 + 0.35 * (1 - load/0.8)^2
  // This gives:
  // - 20% load: ~1.50x (50% higher consumption)
  // - 50% load: ~1.20x (20% higher consumption)
  // - 80% load: 1.00x (baseline - optimal)
  // - 100% load: ~1.05x (5% higher due to enrichment)
  let loadFactor = 1 + 0.35 * Math.pow(1 - load / optimalLoad, 2);

  // Additional penalty for very high loads (>90%) due to fuel enrichment
  if (engineLoadPercent > 90) {
    loadFactor *= 1 + (engineLoadPercent - 90) * 0.008; // +0.8% per % above 90
  }

  return loadFactor;
}

function calculatePhysicsConsumption(
  rpm: number,
  torqueNm: number,
  bsfcMinGPerKwh: number,
  techEra: TechEra,
  fuelType: FuelType,
  speedKmh: number,
  engineLoadPercent: number,
  rpmAt100Kmh?: number,
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
  const optimalRpm = rpmAt100Kmh ?? 2500;

  // RPM factor: BSFC increases when far from optimal RPM
  const rpmFactor = 1 + Math.abs(rpm - optimalRpm) / (optimalRpm * 2);

  // Load factor: BSFC varies with engine load (NEW - based on real data)
  const loadFactor = getLoadFactor(engineLoadPercent);

  // Combined BSFC with both RPM and load effects
  const bsfc = bsfcBase * rpmFactor * loadFactor;
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
  let drivingStyle: "eco" | "normal" | "sport" | undefined;

  let engineLoad: number | undefined;

  if (vehicle.transmission) {
    hasTransmissionData = true;
    console.log(
      "[TelemetryEngine] Using transmission data:",
      JSON.stringify({
        type: vehicle.transmission.type,
        gearRatios: vehicle.transmission.gearRatios,
        finalDrive: vehicle.transmission.finalDrive,
        tireRadiusM: vehicle.transmission.tireRadiusM,
        idleRpm: vehicle.transmission.idleRpm,
        redlineRpm: vehicle.transmission.redlineRpm,
        hasTorqueCurve: !!vehicle.transmission.torqueCurve,
        cda: vehicle.transmission.cda,
        rollingResistance: vehicle.transmission.rollingResistance,
        cruiseRpm: vehicle.transmission.cruiseRpm,
      }),
    );

    const totalMass = vehicle.mass + extraMass;
    const gearResult = gearEstimator.estimate(
      speed,
      accel,
      slope,
      vehicle.transmission,
      totalMass,
    );
    gear = gearResult.gear;
    rpm = gearResult.rpm;
    confidence = gearResult.confidence;
    drivingStyle = gearResult.drivingStyle;

    // Calculate engine load for the selected gear
    if (gear !== undefined && gear > 0) {
      try {
        const loadResult = calculateEngineLoad({
          vehicle,
          speedKmh: speed,
          accelerationMps2: accel,
          slopePercent: slope,
          gearIndex: gear - 1, // convert to 0-based index
        });
        engineLoad = loadResult.engineLoadPercent;
        console.log(
          `[TelemetryEngine] Engine load calculated: ${engineLoad.toFixed(1)}% for gear ${gear} at ${speed}km/h`,
        );
      } catch (err) {
        console.warn("[TelemetryEngine] Failed to calculate engine load:", err);
        engineLoad = 50; // default to 50% if calculation fails
      }
    }

    console.log(
      `[TelemetryEngine] Predicted: gear=${gear}, rpm=${rpm}, load=${engineLoad?.toFixed(1) ?? "N/A"}%, confidence=${confidence.toFixed(2)}, drivingStyle=${drivingStyle}, speed=${speed}km/h, slope=${slope}%`,
    );

    if (
      vehicle.transmission.torqueCurve &&
      Object.keys(vehicle.transmission.torqueCurve).length > 3 &&
      vehicle.bsfcMinGPerKwh &&
      rpm &&
      engineLoad !== undefined
    ) {
      const torque = getTorqueAtRpm(rpm, vehicle.transmission.torqueCurve);
      const physicsKmpl = calculatePhysicsConsumption(
        rpm,
        torque,
        vehicle.bsfcMinGPerKwh,
        vehicle.techEra || "injection_modern",
        fuelType,
        speed,
        engineLoad,
        vehicle.transmission.rpmAt100Kmh,
      );

      if (physicsKmpl < 999 && physicsKmpl > 0) {
        kmpl = physicsKmpl * 0.8 + copertKmpl * 0.2;
        confidence = Math.min(0.98, confidence + 0.1);
      } else {
        kmpl = copertKmpl;
        confidence = Math.min(0.92, confidence + 0.05);
      }
    } else {
      kmpl = copertKmpl;
      confidence = Math.min(0.9, confidence + 0.05);
    }
  } else {
    console.log(
      "[TelemetryEngine] No transmission data, using COPERT fallback only",
    );
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

  console.log(
    "[TELEMETRY-ENGINE] slope:",
    slope,
    "dynamicFactor:",
    dynamicFactor.toFixed(3),
    "kmpl:",
    kmpl,
  );

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
    engineLoad,
    confidence,
    hasTransmissionData,
    drivingStyle,
  };
}

export function resetGearEstimator(): void {
  gearEstimator.resetForNewTrip();
}

export const TelemetryConstants = WORLD;
