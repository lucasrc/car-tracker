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
  HYSTERESIS_CONFIG,
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
  altitudeM?: number;
  temperatureC?: number;
  secondsSinceEngineStart?: number;
  windSpeedMs?: number;
  windDirectionDeg?: number;
  stopAndGoPenalty?: number;
}

export interface TelemetryResult {
  kmpl: number;
  lphOrM3ph: number;
  updatedBatterySocPct: number;
  isHybridEvMode: boolean;
  factors: PhysicsFactors;
  gear?: number;
  rpm?: number;
  engineLoad?: number;
  confidence: number;
  hasTransmissionData: boolean;
  drivingStyle?: "eco" | "normal" | "sport";
}

export interface PhysicsFactors {
  rollingResistanceKw: number;
  aerodynamicDragKw: number;
  slopeKw: number;
  accelerationKw: number;
  acPowerKw: number;
  totalPowerKw: number;
  fuelCutActive: boolean;
  hybridFactor: number;
  bsfcEffective: number;
  altitudeFactor: number;
  coldStartFactor: number;
}

const PHYSICS = {
  AIR_DENSITY_SEA_LEVEL: 1.225,
  G: 9.81,
  FUEL_E27_DENSITY: 0.75,
  FUEL_E100_DENSITY: 0.79,
  GNV_DENSITY: 0.717,
  MIN_KMPL: 3.0,
  MIN_KMPL_IGNORE: 100,
  DEFAULT_TRANSMISSION_EFFICIENCY: 0.90,
  PARASITIC_POWER_KW: 0.4,
  DEFAULT_ALTITUDE_M: 0,
  DEFAULT_TEMPERATURE_C: 25,
} as const;

function getTransmissionEfficiency(
  transmission: TransmissionData | undefined,
): number {
  if (!transmission) return 0.90;
  switch (transmission.type) {
    case "Manual":
      return 0.93;
    case "Automatic":
      return 0.88;
    case "CVT":
      return 0.86;
    default:
      return 0.90;
  }
}

function calculateAirDensity(altitudeM: number, temperatureC: number): number {
  const T = temperatureC + 273.15;
  const L = 0.0065;
  const T0 = 288.15;
  const p0 = 101325;
  const g = 9.80665;
  const M = 0.0289652;
  const R = 8.31446;
  const p = p0 * Math.pow(1 - (L * altitudeM) / T0, (g * M) / (R * L));
  return (p * M) / (R * T);
}

function getAltitudePowerLoss(
  altitudeM: number,
  techEra: TechEra,
  fuelType: FuelType,
): number {
  const isTurbo =
    (fuelType === "gasolina" || fuelType === "flex" || fuelType === "diesel") &&
    (techEra === "injection_modern" || techEra === "direct_injection");

  if (isTurbo || fuelType === "diesel") {
    return 1.0;
  }

  const altitudeKm = altitudeM / 1000;
  return Math.max(0.7, 1 - 0.01 * altitudeKm);
}

function getColdStartEnrichment(
  secondsSinceEngineStart: number | undefined,
  displacement: number,
): number {
  if (secondsSinceEngineStart === undefined || secondsSinceEngineStart <= 0) {
    return 1.0;
  }

  const warmUpDurationMs =
    displacement <= 1200 ? 180000 :
    displacement <= 1800 ? 240000 :
    300000;
  const warmUpProgress = Math.min(secondsSinceEngineStart / warmUpDurationMs, 1);
  return 1.0 + (0.3 * (1 - warmUpProgress));
}

function calculateEffectiveSpeedForAero(
  speedMs: number,
  windSpeedMs: number,
  windDirectionDeg: number,
  headingDeg: number,
): number {
  if (windSpeedMs <= 0) {
    return speedMs;
  }

  const windAngleRad = ((windDirectionDeg - headingDeg) * Math.PI) / 180;
  const headwindComponent = windSpeedMs * Math.cos(windAngleRad);
  return speedMs + headwindComponent;
}

function getEngineEfficiency(loadPercent: number, isDiesel: boolean): number {
  const baseEfficiency = isDiesel ? 0.38 : 0.32;
  const load = Math.max(0.05, Math.min(1.0, loadPercent / 100));

  if (load < 0.15) {
    return baseEfficiency * (0.5 + load * 3.33);
  } else if (load < 0.75) {
    return baseEfficiency;
  } else {
    return baseEfficiency * (1 - (load - 0.75) * 0.15);
  }
}

const BSFC_BY_ERA: Record<TechEra, Record<string, number>> = {
  carburetor: {
    gasolina: 310,
    etanol: 380,
    flex: 310,
    diesel: 245,
    gnv: 300,
  },
  injection_early: {
    gasolina: 280,
    etanol: 350,
    flex: 280,
    diesel: 230,
    gnv: 275,
  },
  injection_modern: {
    gasolina: 250,
    etanol: 320,
    flex: 250,
    diesel: 215,
    gnv: 245,
  },
  direct_injection: {
    gasolina: 230,
    etanol: 295,
    flex: 230,
    diesel: 200,
    gnv: 225,
  },
};

const IDLE_LPH_DEFAULTS: Record<TechEra, number> = {
  carburetor: 1.0,
  injection_early: 0.9,
  injection_modern: 0.8,
  direct_injection: 0.7,
};

const AC_POWER_KW_SMALL = 2.5;
const AC_POWER_KW_LARGE = 3.5;
const AC_POWER_THRESHOLD_KW = 80;

interface EstimationResult {
  gear: number;
  rpm: number;
  confidence: number;
  drivingStyle: DrivingStyle;
}

interface GearHysteresisState {
  currentGear: number;
  lastShiftTimestamp: number;
  shiftCount: number;
}

class GearRpmEstimator {
  private styleState: DrivingStyleState;
  private hysteresis: GearHysteresisState;

  constructor() {
    this.styleState = createDrivingStyleState();
    this.hysteresis = { currentGear: 0, lastShiftTimestamp: 0, shiftCount: 0 };
  }

  estimate(
    speedKmh: number,
    observedAccel: number,
    slope: number,
    transmission: TransmissionData,
    mass: number = 1000,
  ): EstimationResult {
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
      peakPowerKw: 80,
      peakTorqueNm: 150,
      confidence: "high",
      calibrationInput: "temp",
      calibratedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      fuelCapacity: 50,
      currentFuel: 30,
      dataSource: "manual",
      crr: 0.013,
      idleLph: 0.8,
      baseBsfc: 250,
      isHybrid: false,
      gnvCylinderWeightKg: 80,
      gnvEfficiencyFactor: 1.32,
      transmission,
    };

    const now = Date.now();
    const result = selectOptimalGear(
      minimalVehicle,
      speedKmh,
      observedAccel,
      slope,
      this.hysteresis.currentGear || undefined,
    );

    const proposedGear = result.gear;
    const timeSinceShift = now - this.hysteresis.lastShiftTimestamp;
    const isKickdown = observedAccel > HYSTERESIS_CONFIG.kickdownAccelThreshold;
    const isLowSpeed = speedKmh < HYSTERESIS_CONFIG.lowSpeedBypassKmh;
    const canShift =
      timeSinceShift >= HYSTERESIS_CONFIG.minDwellMs ||
      this.hysteresis.shiftCount === 0 ||
      isKickdown ||
      isLowSpeed;

    let finalGear: number;
    if (canShift && proposedGear !== this.hysteresis.currentGear) {
      finalGear = proposedGear;
      this.hysteresis.currentGear = proposedGear;
      this.hysteresis.lastShiftTimestamp = now;
      this.hysteresis.shiftCount++;
    } else if (!canShift) {
      finalGear = this.hysteresis.currentGear || proposedGear;
    } else {
      finalGear = proposedGear;
      this.hysteresis.currentGear = proposedGear;
    }

    return {
      gear: finalGear,
      rpm: result.rpm,
      confidence: result.confidence,
      drivingStyle: this.styleState.currentStyle,
    };
  }

  resetForNewTrip(): void {
    this.styleState = resetDrivingStyleForTrip(this.styleState);
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

function getLoadFactor(engineLoadPercent: number): number {
  const load = Math.max(0.01, Math.min(1.0, engineLoadPercent / 100));

  if (load <= 0.05) {
    return 2.8;
  } else if (load < 0.15) {
    return 1 + 1.8 * Math.pow((0.15 - load) / 0.1, 1.2);
  } else if (load < 0.75) {
    return 1 + 0.25 * Math.pow((0.75 - load) / 0.6, 1.5);
  } else {
    return 1 + 0.1 * Math.pow((load - 0.75) / 0.25, 2);
  }
}

function getFuelDensity(fuelType: FuelType): number {
  switch (fuelType) {
    case "etanol":
      return PHYSICS.FUEL_E100_DENSITY;
    case "gnv":
      return PHYSICS.GNV_DENSITY;
    default:
      return PHYSICS.FUEL_E27_DENSITY;
  }
}

function getBsfcForEra(
  techEra: TechEra,
  fuelType: FuelType,
  loadPercent: number,
  bsfcMinGPerKwh?: number,
): number {
  const eraBsfc = BSFC_BY_ERA[techEra] || BSFC_BY_ERA.injection_modern;
  const baseBsfc = bsfcMinGPerKwh || eraBsfc[fuelType] || eraBsfc.flex || 245;
  const loadFactor = getLoadFactor(loadPercent);
  return baseBsfc * loadFactor;
}

function calculatePhysicsConsumption(
  rpm: number,
  torqueNm: number,
  bsfcMinGPerKwh: number,
  techEra: TechEra,
  fuelType: FuelType,
  speedKmh: number,
  engineLoadPercent: number,
  transmission: TransmissionData | undefined,
  rpmAt100Kmh?: number,
): number {
  const P_wheels = (torqueNm * rpm * 2 * Math.PI) / 60000;
  if (P_wheels <= 0.1) return 999;

  const transEff = getTransmissionEfficiency(transmission);
  const engineEff = getEngineEfficiency(
    engineLoadPercent,
    fuelType === "diesel",
  );
  const totalEff = transEff * engineEff;

  const P_engine = P_wheels / totalEff;

  const bsfcBase = bsfcMinGPerKwh || BSFC_BY_ERA[techEra]?.[fuelType] || 245;
  const optimalRpm = rpmAt100Kmh ?? 2500;

  const rpmFactor = 1 + Math.abs(rpm - optimalRpm) / (optimalRpm * 2);
  const loadFactor = getLoadFactor(engineLoadPercent);
  const bsfc = bsfcBase * rpmFactor * loadFactor;
  const fuelFlowGPerH = bsfc * P_engine;

  const fuelDensity = getFuelDensity(fuelType);
  const fuelFlowLPerH = fuelFlowGPerH / fuelDensity / 1000;

  if (fuelFlowLPerH <= 0 || speedKmh < 1) return 999;

  return speedKmh / fuelFlowLPerH;
}

function shouldFuelCut(
  slope: number,
  accel: number,
  speedKmh: number,
  rpm: number | undefined,
  techEra: TechEra,
): boolean {
  if (techEra === "carburetor") return false;
  if (speedKmh < 8) return false;

  const rpmThreshold = techEra === "direct_injection" ? 1000 : 1200;
  if (rpm !== undefined && rpm < rpmThreshold) return false;

  if (slope <= -3) return true;
  if (slope <= -1.5 && accel < -0.3 && speedKmh > 20) return true;
  if (accel < -0.5 && speedKmh > 50) return true;

  return false;
}

function estimateEngineLoadNoTransmission(
  P_total: number,
  speedKmh: number,
  vehicle: Vehicle,
): number {
  const rpmAt100 =
    vehicle.rpmAt100Kmh ??
    vehicle.transmission?.rpmAt100Kmh ??
    2800;
  const estimatedRpm = Math.max(
    800,
    (speedKmh / 100) * rpmAt100 * (speedKmh < 30 ? 1.5 : 1.0),
  );

  const rpmPeak = vehicle.transmission?.redlineRpm
    ? (vehicle.transmission.redlineRpm as number) * 0.65
    : 5500;
  const rpmRatio = estimatedRpm / rpmPeak;
  const powerFactor = Math.max(0.1, 2 * rpmRatio - rpmRatio * rpmRatio);
  const maxPowerAtRpm = vehicle.peakPowerKw * powerFactor;

  return Math.min(100, (P_total / maxPowerAtRpm) * 100);
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
    altitudeM = PHYSICS.DEFAULT_ALTITUDE_M,
    temperatureC = PHYSICS.DEFAULT_TEMPERATURE_C,
    secondsSinceEngineStart,
    windSpeedMs = 0,
    windDirectionDeg = 0,
    stopAndGoPenalty = 1.0,
  } = input;

  const headingDeg = 0;
  const speedMs = speed / 3.6;
  const effectiveSpeedMs = calculateEffectiveSpeedForAero(
    speedMs,
    windSpeedMs,
    windDirectionDeg,
    headingDeg,
  );
  const airDensity = calculateAirDensity(altitudeM, temperatureC);

  let batterySoc = batterySocPct;
  let isHybridEvMode = false;

  const totalMass =
    vehicle.mass +
    passengers * 75 +
    cargoKg +
    (fuelType === "gnv" ? (vehicle.gnvCylinderWeightKg ?? 80) : 0);
  const cda = vehicle.frontalArea * vehicle.dragCoefficient;
  const techEra: TechEra = vehicle.techEra || "injection_modern";

  const crrAtSpeed = vehicle.crr * (1 + 0.00006 * speedMs * speedMs);
  const P_rolling = (totalMass * PHYSICS.G * crrAtSpeed * speedMs) / 1000;
  const P_aero = (0.5 * airDensity * cda * Math.pow(effectiveSpeedMs, 3)) / 1000;
  const P_slope =
    (totalMass * PHYSICS.G * Math.sin(Math.atan(slope / 100)) * speedMs) / 1000;
  const P_accel = accel > 0 ? (totalMass * accel * speedMs) / 1000 : 0;
  const P_ac = acOn
    ? vehicle.peakPowerKw <= AC_POWER_THRESHOLD_KW
      ? AC_POWER_KW_SMALL
      : AC_POWER_KW_LARGE
    : 0;
  const P_parasitic = PHYSICS.PARASITIC_POWER_KW;
  const P_total = Math.max(
    P_rolling + P_aero + P_slope + P_accel + P_ac + P_parasitic,
    0.5,
  );
  let fuelCutActive = shouldFuelCut(
    slope,
    accel,
    speed,
    vehicle.transmission?.rpmAt100Kmh,
    techEra,
  );

  // 2. Idle consumption
  if (speed < 1) {
    const idleLph =
      vehicle.idleLph ?? vehicle.idleFuelRateLph ?? IDLE_LPH_DEFAULTS[techEra];
    const idleKmpl = idleLph > 0 ? 0.001 : 999;
    return {
      kmpl: idleKmpl,
      lphOrM3ph: idleLph,
      updatedBatterySocPct: batterySoc,
      isHybridEvMode: false,
      factors: {
        rollingResistanceKw: 0,
        aerodynamicDragKw: 0,
        slopeKw: 0,
        accelerationKw: 0,
        acPowerKw: P_ac,
        totalPowerKw: 0,
        fuelCutActive: false,
        hybridFactor: 1.0,
        bsfcEffective: 0,
        altitudeFactor: 1.0,
        coldStartFactor: 1.0,
      },
      confidence: 0.95,
      hasTransmissionData: !!vehicle.transmission,
      drivingStyle: undefined,
    };
  }

  // 3. Fuel cut (deceleration on steep downhill)
  if (fuelCutActive) {
    return {
      kmpl: 999,
      lphOrM3ph: 0,
      updatedBatterySocPct: batterySoc,
      isHybridEvMode: false,
      factors: {
        rollingResistanceKw: Math.round(P_rolling * 100) / 100,
        aerodynamicDragKw: Math.round(P_aero * 100) / 100,
        slopeKw: Math.round(P_slope * 100) / 100,
        accelerationKw: Math.round(P_accel * 100) / 100,
        acPowerKw: P_ac,
        totalPowerKw: Math.round(P_total * 100) / 100,
        fuelCutActive: true,
        hybridFactor: 1.0,
        bsfcEffective: 0,
        altitudeFactor: 1.0,
        coldStartFactor: 1.0,
      },
      confidence: 0.95,
      hasTransmissionData: !!vehicle.transmission,
      drivingStyle: undefined,
    };
  }

  // 4. Hybrid factor
  let hybridFactor = 1.0;
  if (vehicle.isHybrid) {
    if (speed < 60) {
      hybridFactor = 1.4;
      isHybridEvMode = batterySoc > 20;
      batterySoc = Math.max(20, batterySoc - 2);
    } else {
      hybridFactor = 1.1;
      batterySoc = Math.min(100, batterySoc + 1);
    }
  }

  // 5. Calculate consumption
  let kmpl: number;
  let gear: number | undefined;
  let rpm: number | undefined;
  let engineLoad: number | undefined;
  let confidence: number;
  let hasTransmissionData = false;
  let drivingStyle: "eco" | "normal" | "sport" | undefined;
  let bsfcEffective: number;

  if (vehicle.transmission) {
    hasTransmissionData = true;

    const totalMassForGear =
      vehicle.mass +
      passengers * 75 +
      cargoKg +
      (fuelType === "gnv" ? (vehicle.gnvCylinderWeightKg ?? 80) : 0);
    const gearResult = gearEstimator.estimate(
      speed,
      accel,
      slope,
      vehicle.transmission,
      totalMassForGear,
    );
    gear = gearResult.gear;
    rpm = gearResult.rpm;
    confidence = gearResult.confidence;
    drivingStyle = gearResult.drivingStyle;

    if (gear !== undefined && gear > 0) {
      try {
        const loadResult = calculateEngineLoad({
          vehicle,
          speedKmh: speed,
          accelerationMps2: accel,
          slopePercent: slope,
          gearIndex: gear - 1,
          passengers,
          cargoKg,
          isGnv: fuelType === "gnv",
        });
        engineLoad = loadResult.engineLoadPercent;
      } catch {
        engineLoad = 50;
      }
    }

    if (
      vehicle.transmission.torqueCurve &&
      Object.keys(vehicle.transmission.torqueCurve).length > 3 &&
      vehicle.bsfcMinGPerKwh &&
      rpm &&
      engineLoad !== undefined
    ) {
      const torque = getTorqueAtRpm(rpm, vehicle.transmission.torqueCurve);
      bsfcEffective = getBsfcForEra(
        techEra,
        fuelType,
        engineLoad,
        vehicle.bsfcMinGPerKwh,
      );
      kmpl = calculatePhysicsConsumption(
        rpm,
        torque,
        vehicle.bsfcMinGPerKwh,
        techEra,
        fuelType,
        speed,
        engineLoad,
        vehicle.transmission,
        vehicle.transmission.rpmAt100Kmh,
      );

      if (kmpl >= 999 || kmpl <= 0) {
        const fuelDensity = getFuelDensity(fuelType);
        const transEff = getTransmissionEfficiency(vehicle.transmission);
        const engineEff = getEngineEfficiency(
          engineLoad,
          fuelType === "diesel",
        );
        const totalEff = transEff * engineEff;
        const P_engine = P_total / totalEff;
        kmpl =
          speed /
          ((bsfcEffective * P_engine) / (fuelDensity * 1000000));
      }
      confidence = Math.min(0.98, confidence + 0.1);
    } else {
      const transEff = getTransmissionEfficiency(vehicle.transmission);
      const engineEff = getEngineEfficiency(
        engineLoad ?? 50,
        fuelType === "diesel",
      );
      const totalEff = transEff * engineEff;
      const P_engine = P_total / totalEff;
      bsfcEffective = getBsfcForEra(techEra, fuelType, engineLoad ?? 50);
      const fuelDensity = getFuelDensity(fuelType);
      const fuelFlowLPerH = (bsfcEffective * P_engine) / (fuelDensity * 1000);
      kmpl = fuelFlowLPerH > 0 ? speed / fuelFlowLPerH : PHYSICS.MIN_KMPL;
      confidence = Math.min(0.9, confidence + 0.05);
    }
  } else {
    const estimatedLoad = estimateEngineLoadNoTransmission(P_total, speed, vehicle);
    const transEff = getTransmissionEfficiency(vehicle.transmission);
    const engineEff = getEngineEfficiency(
      estimatedLoad,
      fuelType === "diesel",
    );
    const totalEff = transEff * engineEff;
    const P_engine = P_total / totalEff;
    bsfcEffective = getBsfcForEra(techEra, fuelType, estimatedLoad);
    const fuelDensity = getFuelDensity(fuelType);
    const fuelFlowLPerH = (bsfcEffective * P_engine) / (fuelDensity * 1000);
    kmpl = fuelFlowLPerH > 0 ? speed / fuelFlowLPerH : PHYSICS.MIN_KMPL;
    confidence = 0.75;
  }

  // 6. Apply hybrid factor
  kmpl *= hybridFactor;

  // 7. Apply GNV efficiency
  if (fuelType === "gnv") {
    kmpl *= vehicle.gnvEfficiencyFactor ?? 1.22;
  }

  // 8. Apply altitude power loss for NA engines
  const altitudeLossFactor = getAltitudePowerLoss(altitudeM, techEra, fuelType);
  kmpl *= altitudeLossFactor;

  // 9. Apply cold start enrichment
  const coldStartFactor = getColdStartEnrichment(
    secondsSinceEngineStart,
    vehicle.displacement,
  );
  kmpl *= coldStartFactor;

  // 10. Apply stop-and-go traffic penalty (reduces kmpl)
  kmpl /= stopAndGoPenalty;

  // 11. Clamp
  kmpl = Math.round(Math.max(kmpl, PHYSICS.MIN_KMPL) * 100) / 100;

  const lphOrM3ph =
    kmpl > 0 && speed > 0
      ? Math.round((speed / kmpl) * 100) / 100
      : (vehicle.idleLph ??
        vehicle.idleFuelRateLph ??
        IDLE_LPH_DEFAULTS[techEra]);

  return {
    kmpl,
    lphOrM3ph,
    updatedBatterySocPct: batterySoc,
    isHybridEvMode,
    factors: {
      rollingResistanceKw: Math.round(P_rolling * 100) / 100,
      aerodynamicDragKw: Math.round(P_aero * 100) / 100,
      slopeKw: Math.round(P_slope * 100) / 100,
      accelerationKw: Math.round(P_accel * 100) / 100,
      acPowerKw: P_ac,
      totalPowerKw: Math.round(P_total * 100) / 100,
      fuelCutActive,
      hybridFactor,
      bsfcEffective: Math.round(bsfcEffective * 100) / 100,
      altitudeFactor: altitudeLossFactor,
      coldStartFactor,
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

export const TelemetryConstants = {
  ...PHYSICS,
  getTransmissionEfficiency,
  getEngineEfficiency,
  calculateAirDensity,
  AIR_DENSITY: 1.225,
  G: 9.81,
  FUEL_E27_DENSITY: 0.75,
  FUEL_E100_DENSITY: 0.79,
  GNV_DENSITY: 0.717,
  MIN_KMPL: 3.0,
  MIN_KMPL_IGNORE: 100,
  DEFAULT_TRANSMISSION_EFFICIENCY: 0.90,
  PARASITIC_POWER_KW: 0.4,
  DEFAULT_ALTITUDE_M: 0,
  DEFAULT_TEMPERATURE_C: 25,
};
