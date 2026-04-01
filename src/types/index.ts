export interface Coordinates {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
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
  fuelPrice: number;
  totalCost: number;
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
}

export type FuelType = "gasolina" | "etanol" | "flex";

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
}

export interface Refuel {
  id: string;
  timestamp: string;
  amount: number;
  fuelPrice: number;
  totalCost: number;
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
