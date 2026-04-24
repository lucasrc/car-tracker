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
  baseFuelUsed: number;
  extraFuelUsed: number;
  savedFuel: number;
  rollingResistanceFuel: number;
  aeroDragFuel: number;
  slopeFuel: number;
  accelerationFuel: number;
  acFuel: number;
  idleFuel: number;
  extraCost: number;
  savedCost: number;
  totalCost: number;
  totalPenaltyPct?: number;
  speedPenaltyPct?: number;
  aggressionPenaltyPct?: number;
  idlePenaltyPct?: number;
  stabilityPenaltyPct?: number;
  totalBonusPct?: number;
  speedBonusPct?: number;
  accelerationBonusPct?: number;
  coastingBonusPct?: number;
  stabilityBonusPct?: number;
  idleBonusPct?: number;
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
  movingTime: number;
  stopTime: number;
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

export type FuelType = "gasolina" | "etanol" | "flex" | "gnv" | "diesel";

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

export type VehicleEuroNorm =
  | "Euro 1"
  | "Euro 2"
  | "Euro 3"
  | "Euro 4"
  | "Euro 5"
  | "Euro 6"
  | "Euro 6d"
  | "Euro 7";

export type VehicleSegment =
  | "mini"
  | "small"
  | "medium"
  | "large"
  | "suv"
  | "pickup";

export type VehicleFuelType = "gasolina" | "etanol" | "diesel" | "flex" | "gnv";

export type VehicleConfidence = "high" | "medium" | "low";

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
  torqueCurve?: Record<number, number>;
  cda?: number;
  rollingResistance?: number;
  cruiseRpm?: number;
  rpmAt100Kmh?: number;
}

export type DataSource = "web" | "ai_inferred" | "manual";

export interface VehicleCalibration {
  make: string;
  model: string;
  year: number;
  displacement: number;
  fuelType: VehicleFuelType;
  euroNorm: VehicleEuroNorm;
  segment: VehicleSegment;
  urbanKmpl: number;
  highwayKmpl: number;
  combinedKmpl: number;
  mass: number;
  grossWeight: number;
  frontalArea: number;
  dragCoefficient: number;
  peakPowerKw: number;
  peakTorqueNm: number;
  co2_gkm?: number;
  nox_mgkm?: number;
  confidence: VehicleConfidence;
  dataSource?: DataSource;
  crr: number;
  idleLph: number;
  baseBsfc: number;
  isHybrid: boolean;
  gnvCylinderWeightKg: number;
  gnvEfficiencyFactor: number;
  transmission?: TransmissionData;
  techEra?: TechEra;
  idleFuelRateLph?: number;
  bsfcMinGPerKwh?: number;
  f0?: number;
  f1?: number;
  f2?: number;
  fuelConversionFactor?: number;
  inmetroCityKmpl?: number;
  inmetroHighwayKmpl?: number;
  inmetroEthanolCityKmpl?: number;
  inmetroEthanolHighwayKmpl?: number;
  userAvgCityKmpl?: number;
  userAvgHighwayKmpl?: number;
  userAvgEthanolCityKmpl?: number;
  userAvgEthanolHighwayKmpl?: number;
  weightInmetro?: number;
  weightUser?: number;
}

export interface VehicleCalibrationRecord extends VehicleCalibration {
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
  fuelType: VehicleFuelType;
  euroNorm: VehicleEuroNorm;
  segment: VehicleSegment;
  urbanKmpl: number;
  highwayKmpl: number;
  combinedKmpl: number;
  mass: number;
  grossWeight: number;
  frontalArea: number;
  dragCoefficient: number;
  peakPowerKw: number;
  peakTorqueNm: number;
  co2_gkm?: number;
  nox_mgkm?: number;
  confidence: VehicleConfidence;
  calibrationInput: string;
  calibratedAt: string;
  createdAt: string;
  fuelCapacity: number;
  currentFuel: number;
  dataSource?: DataSource;
  crr: number;
  idleLph: number;
  baseBsfc: number;
  isHybrid: boolean;
  gnvCylinderWeightKg: number;
  gnvEfficiencyFactor: number;
  transmission?: TransmissionData;
  techEra?: TechEra;
  idleFuelRateLph?: number;
  bsfcMinGPerKwh?: number;
  f0?: number;
  f1?: number;
  f2?: number;
  fuelConversionFactor?: number;
  inmetroCityKmpl?: number;
  inmetroHighwayKmpl?: number;
  inmetroEthanolCityKmpl?: number;
  inmetroEthanolHighwayKmpl?: number;
  userAvgCityKmpl?: number;
  userAvgHighwayKmpl?: number;
  userAvgEthanolCityKmpl?: number;
  userAvgEthanolHighwayKmpl?: number;
  weightInmetro?: number;
  weightUser?: number;
  rpmAt100Kmh?: number;
  cda?: number;
  rollingResistance?: number;
  inmetroGnvCityKmpl?: number;
  inmetroGnvHighwayKmpl?: number;
  userAvgGnvCityKmpl?: number;
  userAvgGnvHighwayKmpl?: number;
  hasHydraulicSteering?: boolean;
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
  avgPowerKw?: number;
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
  massPenaltyAvg?: number;
  dynamicFactorAvg?: number;
  speedFactorAvg?: number;
}

export interface BatchAllocation {
  batchId: string;
  amountFromBatch: number;
  batchPricePerLiter: number;
  batchFuelType: FuelType;
}

export interface FuelConsumptionEvent {
  id: string;
  tripId: string;
  vehicleId: string;
  timestamp: string;
  sequenceNumber: number;
  position: { lat: number; lng: number; altitude?: number };
  fuelLiters: number;
  cumulativeFuelUsed: number;
  tankLevelBefore: number;
  tankLevelAfter: number;
  speedKmh: number;
  driveMode: DriveMode;
  gradePercent: number;
  instantConsumption: number;
  avgConsumptionSoFar: number;
  batchAllocations: BatchAllocation[];
  eventCost: number;
  source: "gps" | "simulation";
}
