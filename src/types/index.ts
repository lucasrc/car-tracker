export interface Coordinates {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

export type TripStatus = "idle" | "recording" | "paused" | "completed";

export interface Trip {
  id: string;
  startTime: string;
  endTime?: string;
  distanceMeters: number;
  maxSpeed: number;
  path: Coordinates[];
  status: TripStatus;
}

export interface BatteryState {
  charging: boolean;
  level: number;
}
