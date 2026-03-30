export interface Coordinates {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

export type TripStatus = "idle" | "recording" | "paused" | "completed";

export type DriveMode = "city" | "highway" | "mixed";

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
}

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
