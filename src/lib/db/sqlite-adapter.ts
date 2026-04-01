import initSqlJs, { type Database } from "sql.js";
import type { DbAdapter } from "./adapter";
import type { Trip, Settings, Refuel } from "@/types";
import { generateId } from "@/lib/utils";

const DB_NAME = "CarTelemetrySQLite";
const OPFS_AVAILABLE =
  typeof navigator !== "undefined" &&
  "storage" in navigator &&
  "getDirectory" in navigator.storage;

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql(): Promise<ReturnType<typeof initSqlJs>> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
  }
  return sqlPromise;
}

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

class SqliteAdapter implements DbAdapter {
  name = "sqlite";
  private db: Database | null = null;
  private dbBuffer: Uint8Array | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    const SQL = await getSql();

    this.dbBuffer = await this.loadFromStorage();

    if (this.dbBuffer) {
      this.db = new SQL.Database(this.dbBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        cityKmPerLiter REAL,
        highwayKmPerLiter REAL,
        mixedKmPerLiter REAL,
        manualCityKmPerLiter REAL,
        manualHighwayKmPerLiter REAL,
        manualMixedKmPerLiter REAL,
        fuelCapacity REAL,
        currentFuel REAL,
        fuelPrice REAL,
        avgCityKmPerLiter REAL,
        avgHighwayKmPerLiter REAL,
        avgMixedKmPerLiter REAL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        startTime TEXT,
        endTime TEXT,
        distanceMeters REAL,
        maxSpeed REAL,
        avgSpeed REAL,
        path TEXT,
        status TEXT,
        driveMode TEXT,
        consumption REAL,
        fuelCapacity REAL,
        fuelUsed REAL,
        fuelPrice REAL,
        totalCost REAL,
        elapsedTime REAL,
        totalFuelUsed REAL,
        stops TEXT,
        consumptionBreakdown TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS refuels (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        amount REAL,
        fuelPrice REAL,
        totalCost REAL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS current_trip (
        id TEXT PRIMARY KEY,
        startTime TEXT,
        endTime TEXT,
        distanceMeters REAL,
        maxSpeed REAL,
        avgSpeed REAL,
        path TEXT,
        status TEXT,
        driveMode TEXT,
        consumption REAL,
        fuelCapacity REAL,
        fuelUsed REAL,
        fuelPrice REAL,
        totalCost REAL,
        elapsedTime REAL,
        totalFuelUsed REAL,
        stops TEXT,
        consumptionBreakdown TEXT
      )
    `);

    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_trips_startTime ON trips(startTime)`,
    );
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status)`);
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_refuels_timestamp ON refuels(timestamp)`,
    );

    const settings = this.db.exec(
      "SELECT * FROM settings WHERE id = 'default'",
    );
    if (settings.length === 0 || settings[0].values.length === 0) {
      const cols = Object.keys(DEFAULT_SETTINGS).join(", ");
      const placeholders = Object.keys(DEFAULT_SETTINGS)
        .map(() => "?")
        .join(", ");
      const values = Object.values(DEFAULT_SETTINGS);
      this.db.run(
        `INSERT INTO settings (${cols}) VALUES (${placeholders})`,
        values,
      );
    }

    await this.save();
  }

  private async loadFromStorage(): Promise<Uint8Array | null> {
    try {
      if (OPFS_AVAILABLE) {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(`${DB_NAME}.db`, {
          create: false,
        });
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        return new Uint8Array(buffer);
      }

      const stored = localStorage.getItem(`${DB_NAME}_buffer`);
      if (stored) {
        const binary = atob(stored);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      }
    } catch (e) {
      console.warn("Failed to load from storage:", e);
    }
    return null;
  }

  private async save(): Promise<void> {
    if (!this.db) return;

    const data = this.db.export();
    const buffer = new Uint8Array(data);

    try {
      if (OPFS_AVAILABLE) {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(`${DB_NAME}.db`, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();
      } else {
        let binary = "";
        for (let i = 0; i < buffer.length; i++) {
          binary += String.fromCharCode(buffer[i]);
        }
        localStorage.setItem(`${DB_NAME}_buffer`, btoa(binary));
      }
    } catch (e) {
      console.warn("Failed to save to storage:", e);
    }
  }

  async isReady(): Promise<boolean> {
    return this.db !== null;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.save();
      this.db.close();
      this.db = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tripFromRow(row: any[]): Trip {
    return {
      id: row[0],
      startTime: row[1],
      endTime: row[2] || undefined,
      distanceMeters: row[3],
      maxSpeed: row[4],
      avgSpeed: row[5],
      path: JSON.parse(row[6] || "[]"),
      status: row[7],
      driveMode: row[8],
      consumption: row[9],
      fuelCapacity: row[10],
      fuelUsed: row[11],
      fuelPrice: row[12],
      totalCost: row[13],
      elapsedTime: row[14],
      totalFuelUsed: row[15],
      stops: row[16] ? JSON.parse(row[16]) : undefined,
      consumptionBreakdown: row[17] ? JSON.parse(row[17]) : undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tripToRow(trip: Trip): any[] {
    return [
      trip.id,
      trip.startTime,
      trip.endTime || null,
      trip.distanceMeters,
      trip.maxSpeed,
      trip.avgSpeed,
      JSON.stringify(trip.path),
      trip.status,
      trip.driveMode,
      trip.consumption,
      trip.fuelCapacity,
      trip.fuelUsed,
      trip.fuelPrice,
      trip.totalCost,
      trip.elapsedTime,
      trip.totalFuelUsed,
      trip.stops ? JSON.stringify(trip.stops) : null,
      trip.consumptionBreakdown
        ? JSON.stringify(trip.consumptionBreakdown)
        : null,
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private refuelFromRow(row: any[]): Refuel {
    return {
      id: String(row[0]),
      timestamp: String(row[1]),
      amount: Number(row[2]),
      fuelPrice: Number(row[3]),
      totalCost: Number(row[4]),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private refuelToRow(refuel: Refuel): any[] {
    return [
      refuel.id,
      refuel.timestamp,
      refuel.amount,
      refuel.fuelPrice,
      refuel.totalCost,
    ];
  }

  async getSettings(): Promise<Settings> {
    await this.init();
    const result = this.db!.exec("SELECT * FROM settings WHERE id = 'default'");

    if (result.length === 0 || result[0].values.length === 0) {
      return DEFAULT_SETTINGS;
    }

    const row = result[0].values[0];
    const cols = result[0].columns;

    const settings: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => {
      settings[col] = row[i];
    });

    return settings as unknown as Settings;
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.init();
    const cols = Object.keys(settings);
    const placeholders = cols.map(() => "?").join(", ");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = cols.map((c) => (settings as any)[c]);

    this.db!.run(
      `INSERT OR REPLACE INTO settings (${cols.join(", ")}) VALUES (${placeholders})`,
      values,
    );
    await this.save();
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
    await this.init();
    const row = this.tripToRow(trip);
    const cols = [
      "id",
      "startTime",
      "endTime",
      "distanceMeters",
      "maxSpeed",
      "avgSpeed",
      "path",
      "status",
      "driveMode",
      "consumption",
      "fuelCapacity",
      "fuelUsed",
      "fuelPrice",
      "totalCost",
      "elapsedTime",
      "totalFuelUsed",
      "stops",
      "consumptionBreakdown",
    ];

    this.db!.run(`DELETE FROM current_trip`);
    this.db!.run(
      `INSERT INTO current_trip (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      row,
    );
    await this.save();
  }

  async getCurrentTrip(): Promise<Trip | undefined> {
    await this.init();
    const result = this.db!.exec("SELECT * FROM current_trip LIMIT 1");

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.tripFromRow(result[0].values[0]);
  }

  async clearCurrentTrip(): Promise<void> {
    await this.init();
    this.db!.run("DELETE FROM current_trip");
    await this.save();
  }

  async saveTrip(trip: Trip): Promise<void> {
    await this.init();
    const row = this.tripToRow(trip);
    const cols = [
      "id",
      "startTime",
      "endTime",
      "distanceMeters",
      "maxSpeed",
      "avgSpeed",
      "path",
      "status",
      "driveMode",
      "consumption",
      "fuelCapacity",
      "fuelUsed",
      "fuelPrice",
      "totalCost",
      "elapsedTime",
      "totalFuelUsed",
      "stops",
      "consumptionBreakdown",
    ];

    this.db!.run(
      `INSERT OR REPLACE INTO trips (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      row,
    );
    await this.save();
  }

  async getAllTrips(): Promise<Trip[]> {
    await this.init();
    const result = this.db!.exec("SELECT * FROM trips ORDER BY startTime DESC");

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row) => this.tripFromRow(row));
  }

  async getTripById(id: string): Promise<Trip | undefined> {
    await this.init();
    const result = this.db!.exec(`SELECT * FROM trips WHERE id = '${id}'`);

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.tripFromRow(result[0].values[0]);
  }

  async deleteTrip(id: string): Promise<void> {
    await this.init();
    this.db!.run(`DELETE FROM trips WHERE id = '${id}'`);
    await this.save();
  }

  async addRefuel(amount: number, fuelPrice: number): Promise<Refuel> {
    await this.init();
    const refuel: Refuel = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      amount,
      fuelPrice,
      totalCost: amount * fuelPrice,
    };

    const row = this.refuelToRow(refuel);
    const cols = ["id", "timestamp", "amount", "fuelPrice", "totalCost"];

    this.db!.run(
      `INSERT INTO refuels (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      row,
    );
    await this.save();
    return refuel;
  }

  async getRefuels(startDate?: Date, endDate?: Date): Promise<Refuel[]> {
    await this.init();
    let query = "SELECT * FROM refuels";
    const params: string[] = [];

    if (startDate && endDate) {
      query += " WHERE timestamp >= ? AND timestamp <= ?";
      params.push(startDate.toISOString(), endDate.toISOString());
    }

    query += " ORDER BY timestamp DESC";

    const result =
      params.length > 0 ? this.db!.exec(query, params) : this.db!.exec(query);

    if (result.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result[0].values.map((row: any[]) => this.refuelFromRow(row));
  }

  async getRefuelsInPeriod(startDate: Date, endDate: Date): Promise<Refuel[]> {
    return this.getRefuels(startDate, endDate);
  }

  async deleteRefuel(id: string): Promise<void> {
    await this.init();
    this.db!.run(`DELETE FROM refuels WHERE id = '${id}'`);
    await this.save();
  }

  async getTripsInPeriod(startDate: Date, endDate: Date): Promise<Trip[]> {
    await this.init();
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const result = this.db!.exec(
      `SELECT * FROM trips WHERE startTime >= '${start}' AND startTime <= '${end}' AND status = 'completed' ORDER BY startTime DESC`,
    );

    if (result.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result[0].values.map((row: any[]) => this.tripFromRow(row));
  }
}

export function createSqliteAdapter(): DbAdapter {
  return new SqliteAdapter();
}

createSqliteAdapter.isSupported = async (): Promise<boolean> => {
  try {
    const sql = await getSql();
    return typeof sql !== "undefined";
  } catch {
    return false;
  }
};

export { SqliteAdapter };
