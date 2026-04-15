export { getDb, closeDb } from "./factory";
export { attemptMigration, forceUseSqlite } from "./migration";
export type { DbAdapter, DbAdapterConstructor, DbAdapterType } from "./adapter";
export { createSqliteAdapter } from "./sqlite-adapter";

import { getDb } from "./factory";
import type { DbAdapter } from "./adapter";
import type {
  Trip,
  Settings,
  Refuel,
  FuelType,
  Vehicle,
  InclinationCalibration,
} from "@/types";

async function withDb<T>(fn: (db: DbAdapter) => Promise<T>): Promise<T> {
  const db = await getDb();
  return fn(db);
}

export async function getSettings(): Promise<Settings> {
  return withDb((db) => db.getSettings());
}

export async function saveSettings(settings: Settings): Promise<void> {
  return withDb((db) => db.saveSettings(settings));
}

export async function refuel(amount: number): Promise<Settings> {
  return withDb((db) => db.refuel(amount));
}

export async function consumeFuel(liters: number): Promise<Settings> {
  return withDb((db) => db.consumeFuel(liters));
}

export async function saveCurrentTrip(trip: Trip): Promise<void> {
  return withDb((db) => db.saveCurrentTrip(trip));
}

export async function getCurrentTrip(): Promise<Trip | undefined> {
  return withDb((db) => db.getCurrentTrip());
}

export async function clearCurrentTrip(): Promise<void> {
  return withDb((db) => db.clearCurrentTrip());
}

export async function saveTrip(trip: Trip): Promise<void> {
  return withDb((db) => db.saveTrip(trip));
}

export async function getAllTrips(): Promise<Trip[]> {
  return withDb((db) => db.getAllTrips());
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  return withDb((db) => db.getTripById(id));
}

export async function deleteTrip(id: string): Promise<void> {
  return withDb((db) => db.deleteTrip(id));
}

export async function addRefuel(
  vehicleId: string,
  amount: number,
  fuelPrice: number,
  fuelType: FuelType,
): Promise<Refuel> {
  return withDb((db) => db.addRefuel(vehicleId, amount, fuelPrice, fuelType));
}

export async function getRefuels(
  startDate?: Date,
  endDate?: Date,
): Promise<Refuel[]> {
  return withDb((db) => db.getRefuels(startDate, endDate));
}

export async function getRefuelsInPeriod(
  startDate: Date,
  endDate: Date,
): Promise<Refuel[]> {
  return withDb((db) => db.getRefuelsInPeriod(startDate, endDate));
}

export async function getRefuelsByVehicle(
  vehicleId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<Refuel[]> {
  return withDb((db) => db.getRefuelsByVehicle(vehicleId, startDate, endDate));
}

export async function deleteRefuel(id: string): Promise<void> {
  return withDb((db) => db.deleteRefuel(id));
}

export async function updateRefuelConsumed(
  id: string,
  consumedAmount: number,
): Promise<void> {
  return withDb((db) => db.updateRefuelConsumed(id, consumedAmount));
}

export async function getTripsInPeriod(
  startDate: Date,
  endDate: Date,
  vehicleId?: string,
): Promise<Trip[]> {
  return withDb((db) => db.getTripsInPeriod(startDate, endDate, vehicleId));
}

export async function getVehicles(): Promise<Vehicle[]> {
  return withDb((db) => db.getVehicles());
}

export async function getVehicle(id: string): Promise<Vehicle | undefined> {
  return withDb((db) => db.getVehicle(id));
}

export async function saveVehicle(vehicle: Vehicle): Promise<void> {
  return withDb((db) => db.saveVehicle(vehicle));
}

export async function deleteVehicle(id: string): Promise<void> {
  return withDb((db) => db.deleteVehicle(id));
}

export async function updateVehicleFuel(
  vehicleId: string,
  currentFuel: number,
): Promise<void> {
  return withDb((db) => db.updateVehicleFuel(vehicleId, currentFuel));
}

export async function unlinkVehicleRefuels(vehicleId: string): Promise<void> {
  return withDb((db) => db.unlinkVehicleRefuels(vehicleId));
}

export async function getInclinationCalibration(
  vehicleId: string,
): Promise<InclinationCalibration | undefined> {
  return withDb((db) => db.getInclinationCalibration(vehicleId));
}

export async function saveInclinationCalibration(
  calibration: InclinationCalibration,
): Promise<void> {
  return withDb((db) => db.saveInclinationCalibration(calibration));
}

export async function clearInclinationCalibration(
  vehicleId: string,
): Promise<void> {
  return withDb((db) => db.clearInclinationCalibration(vehicleId));
}

export async function migrateLegacyCalibration(): Promise<void> {
  return withDb((db) => db.migrateLegacyCalibration());
}
