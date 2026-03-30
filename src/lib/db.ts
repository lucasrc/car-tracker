import Dexie, { type EntityTable } from "dexie";
import type { Trip, Settings, Refuel } from "@/types";
import { generateId } from "@/lib/utils";

const DEFAULT_SETTINGS: Settings = {
  id: "default",
  cityKmPerLiter: 8,
  highwayKmPerLiter: 12,
  mixedKmPerLiter: 10,
  manualCityKmPerLiter: 10,
  manualHighwayKmPerLiter: 14,
  manualMixedKmPerLiter: 12,
  fuelCapacity: 50,
  currentFuel: 50,
  fuelPrice: 5.0,
};

const db = new Dexie("CarTelemetryDB") as Dexie & {
  trips: EntityTable<Trip, "id">;
  currentTrip: EntityTable<Trip, "id">;
  settings: EntityTable<Settings, "id">;
  refuels: EntityTable<Refuel, "id">;
};

db.version(4)
  .stores({
    trips: "id, startTime, endTime, status",
    currentTrip: "id",
    settings: "id",
  })
  .upgrade((tx) => {
    return tx.table("settings").put(DEFAULT_SETTINGS);
  });

db.version(5).stores({
  trips: "id, startTime, endTime, status",
  currentTrip: "id",
  settings: "id",
  refuels: "id, timestamp",
});

export async function getSettings(): Promise<Settings> {
  try {
    const settings = await db.settings.get("default");

    if (!settings) {
      await db.settings.put(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }

    const s = settings as unknown as Partial<Settings>;
    if (typeof s.currentFuel === "undefined") {
      const fuelCapacity = s.fuelCapacity || 50;
      const updated = {
        ...DEFAULT_SETTINGS,
        ...s,
        currentFuel: fuelCapacity,
        fuelCapacity,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.fuelPrice === "undefined") {
      const updated = {
        ...settings,
        fuelPrice: DEFAULT_SETTINGS.fuelPrice,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.mixedKmPerLiter === "undefined") {
      const city = s.cityKmPerLiter || 8;
      const highway = s.highwayKmPerLiter || 12;
      const updated = {
        ...settings,
        mixedKmPerLiter: (city + highway) / 2,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    if (typeof s.manualCityKmPerLiter === "undefined") {
      const updated = {
        ...settings,
        manualCityKmPerLiter: s.cityKmPerLiter || 10,
        manualHighwayKmPerLiter: s.highwayKmPerLiter || 14,
        manualMixedKmPerLiter: s.mixedKmPerLiter || 12,
      } as Settings;
      await db.settings.put(updated);
      return updated;
    }
    return settings as Settings;
  } catch (err) {
    console.error("getSettings error:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put(settings);
}

export async function refuel(amount: number): Promise<Settings> {
  const settings = await getSettings();

  const newFuel = Math.min(
    settings.currentFuel + amount,
    settings.fuelCapacity,
  );

  const updated = { ...settings, currentFuel: newFuel };
  await saveSettings(updated);
  return updated;
}

export async function consumeFuel(liters: number): Promise<Settings> {
  const settings = await getSettings();
  const newFuel = Math.max(settings.currentFuel - liters, 0);
  const updated = { ...settings, currentFuel: newFuel };
  await saveSettings(updated);
  return updated;
}

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

export async function addRefuel(
  amount: number,
  fuelPrice: number,
): Promise<Refuel> {
  const refuel: Refuel = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    amount,
    fuelPrice,
    totalCost: amount * fuelPrice,
  };
  await db.refuels.put(refuel);
  return refuel;
}

export async function getRefuels(
  startDate?: Date,
  endDate?: Date,
): Promise<Refuel[]> {
  const query = db.refuels.orderBy("timestamp").reverse();

  if (startDate && endDate) {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return await query
      .filter((r) => r.timestamp >= start && r.timestamp <= end)
      .toArray();
  }

  return await query.toArray();
}

export async function getRefuelsInPeriod(
  startDate: Date,
  endDate: Date,
): Promise<Refuel[]> {
  const start = startDate.toISOString();
  const end = endDate.toISOString();
  return await db.refuels.where("timestamp").between(start, end).toArray();
}

export async function deleteRefuel(id: string): Promise<void> {
  await db.refuels.delete(id);
}

export async function getTripsInPeriod(
  startDate: Date,
  endDate: Date,
): Promise<Trip[]> {
  const start = startDate.toISOString();
  const end = endDate.toISOString();
  return await db.trips
    .where("startTime")
    .between(start, end)
    .filter((t) => t.status === "completed")
    .reverse()
    .toArray();
}

export { db };
