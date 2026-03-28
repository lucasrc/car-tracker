import Dexie, { type EntityTable } from "dexie";
import type { Trip } from "@/types";

const db = new Dexie("CarTelemetryDB") as Dexie & {
  trips: EntityTable<Trip, "id">;
  currentTrip: EntityTable<Trip, "id">;
};

db.version(1).stores({
  trips: "id, startTime, endTime, status",
  currentTrip: "id",
});

export async function saveCurrentTrip(trip: Trip): Promise<void> {
  await db.currentTrip.put(trip);
}

export async function getCurrentTrip(): Promise<Trip | undefined> {
  return await db.currentTrip.toCollection().first();
}

export async function clearCurrentTrip(): Promise<void> {
  await db.currentTrip.clear();
}

export async function saveTrip(trip: Trip): Promise<void> {
  await db.trips.put(trip);
}

export async function getAllTrips(): Promise<Trip[]> {
  return await db.trips.orderBy("startTime").reverse().toArray();
}

export async function getTripById(id: string): Promise<Trip | undefined> {
  return await db.trips.get(id);
}

export async function deleteTrip(id: string): Promise<void> {
  await db.trips.delete(id);
}

export { db };
