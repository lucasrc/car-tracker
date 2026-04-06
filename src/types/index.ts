export interface Coordinates {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  altitudeAccuracy?: number;
}

export type TripStatus = "idle" | "recording" | "paused" | "completed";

export type DriveMode = "city" | "highway" | "mixed";

export type ActivityType = "MA" | "SA_ENGINE_ON" | "SA_ENGINE_OFF";

export interface TripStop {
  lat: number;
  lng: number;
  timestamp: number;
  durationSeconds: number;
}

export interface TripConsumptionBreakdown {
  speedPenaltyPct: number;
  aggressionPenaltyPct: number;
  idlePenaltyPct: number;
  stabilityPenaltyPct: number;
  totalPenaltyPct: number;
  speedBonusPct: number;
  accelerationBonusPct: number;
  coastingBonusPct: number;
  stabilityBonusPct: number;
  idleBonusPct: number;
  totalBonusPct: number;
  isEcoDriving: boolean;
  baseFuelUsed: number;
  extraFuelUsed: number;
  savedFuel: number;
  extraCost: number;
  savedCost: number;
}

export interface Trip {
  id: string;
  vehicleId: string;
  startTime: string;
  endTime?: string;
  distanceMeters: number;
  maxSpeed: number;
  avgSpeed: number;
  path: Coordinates[];
  status: TripStatus;
  driveMode: DriveMode;
  consumption: number;
  fuelCapacity: number;
  fuelUsed: number;
  actualCost: number;
  fuelPrice?: number;
  totalCost?: number;
  elapsedTime: number;
  totalFuelUsed: number;
  stops?: TripStop[];
  consumptionBreakdown?: TripConsumptionBreakdown;
  speedingEvents?: SpeedingEvent[];
  pendingStopStart?: {
    lat: number;
    lng: number;
    timestamp: number;
  } | null;
  pendingStopLastTimestamp?: number | null;
  vehicleSnapshot?: {
    make: string;
    model: string;
    year: number;
  };
  telemetryData?: TripTelemetryData;
}

export type FuelType = "gasolina" | "etanol" | "flex" | "gnv";

export interface Settings {
  id: string;
  cityKmPerLiter: number;
  highwayKmPerLiter: number;
  mixedKmPerLiter: number;
  manualCityKmPerLiter: number;
  manualHighwayKmPerLiter: number;
  manualMixedKmPerLiter: number;
  fuelCapacity: number;
  currentFuel: number;
  fuelPrice: number;
  avgCityKmPerLiter?: number;
  avgHighwayKmPerLiter?: number;
  avgMixedKmPerLiter?: number;
  engineDisplacement: number;
  fuelType: FuelType;
  activeVehicleId?: string;
}

export interface Refuel {
  id: string;
  vehicleId: string;
  timestamp: string;
  amount: number;
  fuelPrice: number;
  fuelType: FuelType;
  totalCost: number;
  consumedAmount: number;
}

export interface BatteryState {
  charging: boolean;
  level: number;
}

export interface SpeedingEvent {
  radarId: string;
  radarLat: number;
  radarLng: number;
  radarMaxSpeed: number;
  currentSpeed: number;
  timestamp: number;
}

export interface Radar {
  id: string;
  lat: number;
  lng: number;
  maxSpeed: number;
  direction?: number;
  directionTag?: string;
  source: string;
  wayGeometry?: [number, number][];
}

export type CopertEuroNorm =
  | "Euro 1"
  | "Euro 2"
  | "Euro 3"
  | "Euro 4"
  | "Euro 5"
  | "Euro 6"
  | "Euro 6d"
  | "Euro 7";

export type CopertSegment =
  | "mini"
  | "small"
  | "medium"
  | "large"
  | "suv"
  | "pickup";

export type CopertFuelType = "gasoline" | "diesel" | "ethanol" | "flex";

export type CopertConfidence = "high" | "medium" | "low";

export type TechEra =
  | "carburetor"
  | "injection_early"
  | "injection_modern"
  | "direct_injection";

export type TransmissionType = "Manual" | "Automatic" | "CVT";

export interface TransmissionData {
  type: TransmissionType;
  gearRatios: number[];
  finalDrive: number;
  tireRadiusM: number;
  redlineRpm: number;
  idleRpm: number;
  torqueCurve: Record<number, number>;
}

export type DataSource = "web" | "ai_inferred" | "manual";

export interface CopertCalibration {
  make: string;
  model: string;
  year: number;
  displacement: number;
  fuelType: CopertFuelType;
  euroNorm: CopertEuroNorm;
  segment: CopertSegment;
  urbanKmpl: number;
  highwayKmpl: number;
  combinedKmpl: number;
  mass: number;
  grossWeight: number;
  frontalArea: number;
  dragCoefficient: number;
  f0: number;
  f1: number;
  f2: number;
  fuelConversionFactor: number;
  peakPowerKw: number;
  peakTorqueNm: number;
  co2_gkm?: number;
  nox_mgkm?: number;
  confidence: CopertConfidence;
  dataSource?: DataSource;
  inmetroCityKmpl: number;
  inmetroHighwayKmpl: number;
  userAvgCityKmpl: number;
  userAvgHighwayKmpl: number;
  inmetroEthanolCityKmpl?: number;
  inmetroEthanolHighwayKmpl?: number;
  userAvgEthanolCityKmpl?: number;
  userAvgEthanolHighwayKmpl?: number;
  inmetroGnvCityKmpl?: number;
  inmetroGnvHighwayKmpl?: number;
  userAvgGnvCityKmpl?: number;
  userAvgGnvHighwayKmpl?: number;
  crr: number;
  idleLph: number;
  baseBsfc: number;
  weightInmetro: number;
  weightUser: number;
  isHybrid: boolean;
  gnvCylinderWeightKg: number;
  gnvEfficiencyFactor: number;
  transmission?: TransmissionData;
  techEra?: TechEra;
  idleFuelRateLph?: number;
  bsfcMinGPerKwh?: number;
}

export interface CopertCalibrationRecord extends CopertCalibration {
  savedAt: string;
  vehicleInput: string;
}

export interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number;
  displacement: number;
  fuelType: CopertFuelType;
  euroNorm: CopertEuroNorm;
  segment: CopertSegment;
  urbanKmpl: number;
  highwayKmpl: number;
  combinedKmpl: number;
  mass: number;
  grossWeight: number;
  frontalArea: number;
  dragCoefficient: number;
  f0: number;
  f1: number;
  f2: number;
  fuelConversionFactor: number;
  peakPowerKw: number;
  peakTorqueNm: number;
  co2_gkm?: number;
  nox_mgkm?: number;
  confidence: CopertConfidence;
  calibrationInput: string;
  calibratedAt: string;
  createdAt: string;
  fuelCapacity: number;
  currentFuel: number;
  dataSource?: DataSource;
  inmetroCityKmpl: number;
  inmetroHighwayKmpl: number;
  userAvgCityKmpl: number;
  userAvgHighwayKmpl: number;
  inmetroEthanolCityKmpl?: number;
  inmetroEthanolHighwayKmpl?: number;
  userAvgEthanolCityKmpl?: number;
  userAvgEthanolHighwayKmpl?: number;
  inmetroGnvCityKmpl?: number;
  inmetroGnvHighwayKmpl?: number;
  userAvgGnvCityKmpl?: number;
  userAvgGnvHighwayKmpl?: number;
  crr: number;
  idleLph: number;
  baseBsfc: number;
  weightInmetro: number;
  weightUser: number;
  isHybrid: boolean;
  gnvCylinderWeightKg: number;
  gnvEfficiencyFactor: number;
  transmission?: TransmissionData;
  techEra?: TechEra;
  idleFuelRateLph?: number;
  bsfcMinGPerKwh?: number;
}

export interface InclinationCalibration {
  vehicleId: string;
  offsetDegrees: number;
  calibratedAt: string;
}

export interface TripTelemetryData {
  fuelType: FuelType;
  batterySocStart: number;
  batterySocEnd: number;
  hybridDistancePct: number;
  avgSlope: number;
  maxSlope: number;
  acUsagePct: number;
  massPenaltyAvg: number;
  idleTimeSeconds: number;
  avgAcceleration: number;
  maxAcceleration: number;
  speedDistribution: {
    city: number;
    mixed: number;
    highway: number;
  };
  gearDistribution?: Record<number, number>;
  avgRpm?: number;
  maxRpm?: number;
  hasTransmissionData?: boolean;
}
