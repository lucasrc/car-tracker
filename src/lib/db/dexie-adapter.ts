import Dexie, { type EntityTable } from "dexie";
import type { DbAdapter } from "./adapter";
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
  engineDisplacement: 1600,
  fuelType: "flex",
};

class DexieAdapter implements DbAdapter {
  name = "dexie";
  private db: Dexie & {
    trips: EntityTable<Trip, "id">;
    currentTrip: EntityTable<Trip, "id">;
    settings: EntityTable<Settings, "id">;
    refuels: EntityTable<Refuel, "id">;
  };

  constructor() {
    this.db = new Dexie("CarTelemetryDB") as Dexie & {
      trips: EntityTable<Trip, "id">;
      currentTrip: EntityTable<Trip, "id">;
      settings: EntityTable<Settings, "id">;
      refuels: EntityTable<Refuel, "id">;
    };

    this.db
      .version(4)
      .stores({
        trips: "id, startTime, endTime, status",
        currentTrip: "id",
        settings: "id",
      })
      .upgrade((tx) => {
        return tx.table("settings").put(DEFAULT_SETTINGS);
      });

    this.db.version(5).stores({
      trips: "id, startTime, endTime, status",
      currentTrip: "id",
      settings: "id",
      refuels: "id, timestamp",
    });
  }

  async isReady(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  async getSettings(): Promise<Settings> {
    try {
      const settings = await this.db.settings.get("default");

      if (!settings) {
        await this.db.settings.put(DEFAULT_SETTINGS);
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
        await this.db.settings.put(updated);
        return updated;
      }
      if (typeof s.fuelPrice === "undefined") {
        const updated = {
          ...settings,
          fuelPrice: DEFAULT_SETTINGS.fuelPrice,
        } as Settings;
        await this.db.settings.put(updated);
        return updated;
      }
      if (typeof s.mixedKmPerLiter === "undefined") {
        const city = s.cityKmPerLiter || 8;
        const highway = s.highwayKmPerLiter || 12;
        const updated = {
          ...settings,
          mixedKmPerLiter: (city + highway) / 2,
        } as Settings;
        await this.db.settings.put(updated);
        return updated;
      }
      if (typeof s.manualCityKmPerLiter === "undefined") {
        const updated = {
          ...settings,
          manualCityKmPerLiter: s.cityKmPerLiter || 10,
          manualHighwayKmPerLiter: s.highwayKmPerLiter || 14,
          manualMixedKmPerLiter: s.mixedKmPerLiter || 12,
        } as Settings;
        await this.db.settings.put(updated);
        return updated;
      }
      return settings as Settings;
    } catch (err) {
      console.error("getSettings error:", err);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.settings.put(settings);
  }

  async refuel(amount: number): Promise<Settings> {
    const settings = await this.getSettings();

    const newFuel = Math.min(
      settings.currentFuel + amount,
      settings.fuelCapacity,
    );

    const updated = { ...settings, currentFuel: newFuel };
    await this.saveSettings(updated);
    return updated;
  }

  async consumeFuel(liters: number): Promise<Settings> {
    const settings = await this.getSettings();
    const newFuel = Math.max(settings.currentFuel - liters, 0);
    const updated = { ...settings, currentFuel: newFuel };
    await this.saveSettings(updated);
    return updated;
  }

  async saveCurrentTrip(trip: Trip): Promise<void> {
    await this.db.currentTrip.put(trip);
  }

  async getCurrentTrip(): Promise<Trip | undefined> {
    return await this.db.currentTrip.toCollection().first();
  }

  async clearCurrentTrip(): Promise<void> {
    await this.db.currentTrip.clear();
  }

  async saveTrip(trip: Trip): Promise<void> {
    await this.db.trips.put(trip);
  }

  async getAllTrips(): Promise<Trip[]> {
    return await this.db.trips.orderBy("startTime").reverse().toArray();
  }

  async getTripById(id: string): Promise<Trip | undefined> {
    return await this.db.trips.get(id);
  }

  async deleteTrip(id: string): Promise<void> {
    await this.db.trips.delete(id);
  }

  async addRefuel(amount: number, fuelPrice: number): Promise<Refuel> {
    const refuel: Refuel = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      amount,
      fuelPrice,
      totalCost: amount * fuelPrice,
    };
    await this.db.refuels.put(refuel);
    return refuel;
  }

  async getRefuels(startDate?: Date, endDate?: Date): Promise<Refuel[]> {
    const query = this.db.refuels.orderBy("timestamp").reverse();

    if (startDate && endDate) {
      const start = startDate.toISOString();
      const end = endDate.toISOString();
      return await query
        .filter((r) => r.timestamp >= start && r.timestamp <= end)
        .toArray();
    }

    return await query.toArray();
  }

  async getRefuelsInPeriod(startDate: Date, endDate: Date): Promise<Refuel[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return await this.db.refuels
      .where("timestamp")
      .between(start, end)
      .toArray();
  }

  async deleteRefuel(id: string): Promise<void> {
    await this.db.refuels.delete(id);
  }

  async getTripsInPeriod(startDate: Date, endDate: Date): Promise<Trip[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    return await this.db.trips
      .where("startTime")
      .between(start, end)
      .filter((t) => t.status === "completed")
      .reverse()
      .toArray();
  }
}

export function createDexieAdapter(): DbAdapter {
  return new DexieAdapter();
}

createDexieAdapter.isSupported = async (): Promise<boolean> => {
  return typeof indexedDB !== "undefined";
};

export { DexieAdapter };
