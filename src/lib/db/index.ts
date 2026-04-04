export { getDb, closeDb } from "./factory";
export {
  attemptMigration,
  migrateFromDexie,
  forceUseDexie,
  forceUseSqlite,
} from "./migration";
export type { DbAdapter, DbAdapterConstructor, DbAdapterType } from "./adapter";
export { createDexieAdapter } from "./dexie-adapter";
export { createSqliteAdapter } from "./sqlite-adapter";

import { getDb } from "./factory";
import type { DbAdapter } from "./adapter";
import type { Trip, Settings, Refuel, FuelType } from "@/types";

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
  amount: number,
  fuelPrice: number,
  fuelType: FuelType,
  vehicleId: string,
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

export async function deleteRefuel(id: string): Promise<void> {
  return withDb((db) => db.deleteRefuel(id));
}

export async function getTripsInPeriod(
  startDate: Date,
  endDate: Date,
): Promise<Trip[]> {
  return withDb((db) => db.getTripsInPeriod(startDate, endDate));
}
