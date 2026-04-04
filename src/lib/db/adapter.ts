import type { Trip, Settings, Refuel } from "@/types";

export interface DbAdapter {
  name: string;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  saveTrip(trip: Trip): Promise<void>;
  getAllTrips(): Promise<Trip[]>;
  getTripById(id: string): Promise<Trip | undefined>;
  getTripsInPeriod(startDate: Date, endDate: Date): Promise<Trip[]>;
  deleteTrip(id: string): Promise<void>;

  addRefuel(vehicleId: string, amount: number, fuelPrice: number, fuelType?: FuelType): Promise<Refuel>;
  getRefuels(startDate?: Date, endDate?: Date): Promise<Refuel[]>;
  getRefuelsInPeriod(startDate: Date, endDate: Date): Promise<Refuel[]>;
  deleteRefuel(id: string): Promise<void>;

  saveCurrentTrip(trip: Trip): Promise<void>;
  getCurrentTrip(): Promise<Trip | undefined>;
  clearCurrentTrip(): Promise<void>;

  refuel(amount: number): Promise<Settings>;
  consumeFuel(liters: number): Promise<Settings>;

  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export interface DbAdapterConstructor {
  new (): DbAdapter;
  isSupported(): Promise<boolean>;
}

export type DbAdapterType = "dexie" | "sqlite";
