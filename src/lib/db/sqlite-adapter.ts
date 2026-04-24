import initSqlJs, { type Database, type SqlValue } from "sql.js";
import type { DbAdapter } from "./adapter";
import type {
  Trip,
  Settings,
  Refuel,
  FuelType,
  Vehicle,
  InclinationCalibration,
} from "@/types";
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
      locateFile: (file: string) => `/${file}`,
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
        vehicleId TEXT,
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
        actualCost REAL,
        elapsedTime REAL,
        totalFuelUsed REAL,
        stops TEXT,
        consumptionBreakdown TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS refuels (
        id TEXT PRIMARY KEY,
        vehicleId TEXT,
        timestamp TEXT,
        amount REAL,
        fuelPrice REAL,
        fuelType TEXT,
        totalCost REAL,
        consumedAmount REAL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS current_trip (
        id TEXT PRIMARY KEY,
        vehicleId TEXT,
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
      `CREATE INDEX IF NOT EXISTS idx_trips_vehicleId ON trips(vehicleId)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_refuels_timestamp ON refuels(timestamp)`,
    );
    this.db.run(
      `CREATE INDEX IF NOT EXISTS idx_refuels_vehicleId ON refuels(vehicleId)`,
    );

    this.db.run(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        name TEXT,
        make TEXT,
        model TEXT,
        year INTEGER,
        displacement REAL,
        fuelType TEXT,
        euroNorm TEXT,
        segment TEXT,
        urbanKmpl REAL,
        highwayKmpl REAL,
        combinedKmpl REAL,
        mass REAL,
        grossWeight REAL,
        frontalArea REAL,
        dragCoefficient REAL,
        f0 REAL,
        f1 REAL,
        f2 REAL,
        fuelConversionFactor REAL,
        peakPowerKw REAL,
        peakTorqueNm REAL,
        co2_gkm REAL,
        nox_mgkm REAL,
        confidence TEXT,
        calibrationInput TEXT,
        calibratedAt TEXT,
        createdAt TEXT,
        fuelCapacity REAL,
        currentFuel REAL,
        dataSource TEXT,
        inmetroCityKmpl REAL,
        inmetroHighwayKmpl REAL,
        userAvgCityKmpl REAL,
        userAvgHighwayKmpl REAL,
        inmetroEthanolCityKmpl REAL,
        inmetroEthanolHighwayKmpl REAL,
        userAvgEthanolCityKmpl REAL,
        userAvgEthanolHighwayKmpl REAL,
        inmetroGnvCityKmpl REAL,
        inmetroGnvHighwayKmpl REAL,
        userAvgGnvCityKmpl REAL,
        userAvgGnvHighwayKmpl REAL,
        crr REAL,
        idleLph REAL,
        baseBsfc REAL,
        weightInmetro REAL,
        weightUser REAL,
        isHybrid INTEGER,
        gnvCylinderWeightKg REAL,
        gnvEfficiencyFactor REAL,
        transmission TEXT,
        techEra TEXT,
        idleFuelRateLph REAL,
        bsfcMinGPerKwh REAL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS inclination_calibrations (
        vehicleId TEXT PRIMARY KEY,
        offsetDegrees REAL,
        calibratedAt TEXT
      )
    `);

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
      vehicleId: row[1] || "",
      startTime: row[2],
      endTime: row[3] || undefined,
      distanceMeters: row[4],
      maxSpeed: row[5],
      avgSpeed: row[6],
      path: JSON.parse(row[7] || "[]"),
      status: row[8],
      driveMode: row[9],
      consumption: row[10],
      fuelCapacity: row[11],
      fuelUsed: row[12],
      fuelPrice: row[13],
      totalCost: row[14],
      actualCost: row[15] ?? 0,
      elapsedTime: row[16],
      movingTime: row[18] ?? 0,
      stopTime: row[19] ?? 0,
      totalFuelUsed: row[20],
      stops: row[21] ? JSON.parse(row[21]) : undefined,
      consumptionBreakdown: row[22] ? JSON.parse(row[22]) : undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tripToRow(trip: Trip): any[] {
    return [
      trip.id,
      trip.vehicleId,
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
      trip.actualCost,
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
      id: String(row[1]),
      vehicleId: String(row[0]),
      timestamp: String(row[2]),
      amount: Number(row[3]),
      fuelPrice: Number(row[4]),
      fuelType: (row[5] || "gasolina") as FuelType,
      totalCost: Number(row[6]),
      consumedAmount: Number(row[7] || 0),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private refuelToRow(refuel: Refuel): any[] {
    return [
      refuel.vehicleId,
      refuel.id,
      refuel.timestamp,
      refuel.amount,
      refuel.fuelPrice,
      refuel.fuelType,
      refuel.totalCost,
      refuel.consumedAmount,
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
      "actualCost",
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

  async addRefuel(
    vehicleId: string,
    amount: number,
    fuelPrice: number,
    fuelType: FuelType = "gasolina",
  ): Promise<Refuel> {
    await this.init();
    const refuel: Refuel = {
      id: generateId(),
      vehicleId,
      timestamp: new Date().toISOString(),
      amount,
      fuelPrice,
      fuelType,
      totalCost: amount * fuelPrice,
      consumedAmount: 0,
    };

    const row = this.refuelToRow(refuel);
    const cols = [
      "vehicleId",
      "id",
      "timestamp",
      "amount",
      "fuelPrice",
      "fuelType",
      "totalCost",
      "consumedAmount",
    ];

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

  async updateRefuelConsumed(
    id: string,
    consumedAmount: number,
  ): Promise<void> {
    await this.init();
    this.db!.run("UPDATE refuels SET consumedAmount = ? WHERE id = ?", [
      consumedAmount,
      id,
    ]);
    await this.save();
  }

  async getTripsInPeriod(
    startDate: Date,
    endDate: Date,
    vehicleId?: string,
  ): Promise<Trip[]> {
    await this.init();
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    let query = `SELECT * FROM trips WHERE startTime >= '${start}' AND startTime <= '${end}' AND status = 'completed'`;

    if (vehicleId) {
      query += ` AND vehicleId = '${vehicleId}'`;
    }

    query += " ORDER BY startTime DESC";

    const result = this.db!.exec(query);

    if (result.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result[0].values.map((row: any[]) => this.tripFromRow(row));
  }

  async getVehicles(): Promise<Vehicle[]> {
    await this.init();
    const result = this.db!.exec(
      "SELECT * FROM vehicles ORDER BY createdAt DESC",
    );

    if (result.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result[0].values.map((row: any[]) => this.vehicleFromRow(row));
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    await this.init();
    const result = this.db!.exec(`SELECT * FROM vehicles WHERE id = '${id}'`);

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    return this.vehicleFromRow(result[0].values[0]);
  }

  async saveVehicle(vehicle: Vehicle): Promise<void> {
    await this.init();
    const row = this.vehicleToRow(vehicle);
    const cols = Object.keys(vehicle);

    this.db!.run(
      `INSERT OR REPLACE INTO vehicles (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      row as SqlValue[],
    );
    await this.save();
  }

  async deleteVehicle(id: string): Promise<void> {
    await this.init();
    this.db!.run(`DELETE FROM vehicles WHERE id = '${id}'`);
    await this.save();
  }

  async updateVehicleFuel(
    vehicleId: string,
    currentFuel: number,
  ): Promise<void> {
    await this.init();
    this.db!.run("UPDATE vehicles SET currentFuel = ? WHERE id = ?", [
      currentFuel,
      vehicleId,
    ]);
    await this.save();
  }

  async unlinkVehicleRefuels(vehicleId: string): Promise<void> {
    await this.init();
    this.db!.run("UPDATE refuels SET vehicleId = '' WHERE vehicleId = ?", [
      vehicleId,
    ]);
    await this.save();
  }

  async getInclinationCalibration(
    vehicleId: string,
  ): Promise<InclinationCalibration | undefined> {
    await this.init();
    const result = this.db!.exec(
      `SELECT * FROM inclination_calibrations WHERE vehicleId = '${vehicleId}'`,
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    const row = result[0].values[0];
    return {
      vehicleId: String(row[0]),
      offsetDegrees: Number(row[1]),
      calibratedAt: String(row[2]),
    };
  }

  async saveInclinationCalibration(
    calibration: InclinationCalibration,
  ): Promise<void> {
    await this.init();
    this.db!.run(
      `INSERT OR REPLACE INTO inclination_calibrations (vehicleId, offsetDegrees, calibratedAt) VALUES (?, ?, ?)`,
      [
        calibration.vehicleId,
        calibration.offsetDegrees,
        calibration.calibratedAt,
      ],
    );
    await this.save();
  }

  async clearInclinationCalibration(vehicleId: string): Promise<void> {
    await this.init();
    this.db!.run(
      `DELETE FROM inclination_calibrations WHERE vehicleId = '${vehicleId}'`,
    );
    await this.save();
  }

  async migrateLegacyCalibration(): Promise<void> {
    const LEGACY_CALIBRATION_KEY = "copert-calibration";
    const LEGACY_INCLINATION_KEY = "inclination-calibration";

    const rawCalibration = localStorage.getItem(LEGACY_CALIBRATION_KEY);
    if (!rawCalibration) return;

    const existingVehicles = await this.getVehicles();
    if (existingVehicles.length > 0) return;

    try {
      const legacyData = JSON.parse(rawCalibration);

      const vehicle: Vehicle = {
        id: generateId(),
        name: `${legacyData.make} ${legacyData.model}`,
        make: legacyData.make,
        model: legacyData.model,
        year: legacyData.year,
        displacement: legacyData.displacement,
        fuelType: legacyData.fuelType,
        euroNorm: legacyData.euroNorm,
        segment: legacyData.segment,
        urbanKmpl: legacyData.urbanKmpl,
        highwayKmpl: legacyData.highwayKmpl,
        combinedKmpl: legacyData.combinedKmpl,
        mass: legacyData.mass,
        grossWeight: legacyData.grossWeight,
        frontalArea: legacyData.frontalArea,
        dragCoefficient: legacyData.dragCoefficient,
        f0: legacyData.f0,
        f1: legacyData.f1,
        f2: legacyData.f2,
        fuelConversionFactor: legacyData.fuelConversionFactor,
        peakPowerKw: legacyData.peakPowerKw,
        peakTorqueNm: legacyData.peakTorqueNm,
        co2_gkm: legacyData.co2_gkm,
        nox_mgkm: legacyData.nox_mgkm,
        confidence: legacyData.confidence,
        calibrationInput: legacyData.vehicleInput,
        calibratedAt: legacyData.savedAt,
        createdAt: new Date().toISOString(),
        fuelCapacity: 50,
        currentFuel: 0,
        inmetroCityKmpl: legacyData.inmetroCityKmpl || legacyData.urbanKmpl,
        inmetroHighwayKmpl:
          legacyData.inmetroHighwayKmpl || legacyData.highwayKmpl,
        userAvgCityKmpl: legacyData.userAvgCityKmpl || legacyData.urbanKmpl,
        userAvgHighwayKmpl:
          legacyData.userAvgHighwayKmpl || legacyData.highwayKmpl,
        inmetroEthanolCityKmpl: legacyData.inmetroEthanolCityKmpl,
        inmetroEthanolHighwayKmpl: legacyData.inmetroEthanolHighwayKmpl,
        userAvgEthanolCityKmpl: legacyData.userAvgEthanolCityKmpl,
        userAvgEthanolHighwayKmpl: legacyData.userAvgEthanolHighwayKmpl,
        inmetroGnvCityKmpl:
          legacyData.inmetroGnvCityKmpl || legacyData.inmetroCityKmpl,
        inmetroGnvHighwayKmpl:
          legacyData.inmetroGnvHighwayKmpl || legacyData.inmetroHighwayKmpl,
        userAvgGnvCityKmpl:
          legacyData.userAvgGnvCityKmpl || legacyData.userAvgCityKmpl,
        userAvgGnvHighwayKmpl:
          legacyData.userAvgGnvHighwayKmpl || legacyData.userAvgHighwayKmpl,
        crr: legacyData.crr || 0.013,
        idleLph: legacyData.idleLph || 0.9,
        baseBsfc: legacyData.baseBsfc || 265,
        weightInmetro: 0.6,
        weightUser: 0.4,
        isHybrid: false,
        gnvCylinderWeightKg: 80,
        gnvEfficiencyFactor: 1.32,
      };

      await this.saveVehicle(vehicle);

      const settings = await this.getSettings();
      if (!settings.activeVehicleId) {
        await this.saveSettings({ ...settings, activeVehicleId: vehicle.id });
      }

      localStorage.removeItem(LEGACY_CALIBRATION_KEY);

      const rawInclination = localStorage.getItem(LEGACY_INCLINATION_KEY);
      if (rawInclination) {
        try {
          const inclinationData = JSON.parse(rawInclination);
          const inclinationCalibration: InclinationCalibration = {
            vehicleId: vehicle.id,
            offsetDegrees: inclinationData.offsetDegrees,
            calibratedAt: inclinationData.calibratedAt,
          };
          await this.saveInclinationCalibration(inclinationCalibration);
          localStorage.removeItem(LEGACY_INCLINATION_KEY);
        } catch {
          // Ignore invalid inclination data
        }
      }
    } catch {
      // Ignore invalid calibration data
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vehicleFromRow(row: any[]): Vehicle {
    const cols = [
      "id",
      "name",
      "make",
      "model",
      "year",
      "displacement",
      "fuelType",
      "euroNorm",
      "segment",
      "urbanKmpl",
      "highwayKmpl",
      "combinedKmpl",
      "mass",
      "grossWeight",
      "frontalArea",
      "dragCoefficient",
      "f0",
      "f1",
      "f2",
      "fuelConversionFactor",
      "peakPowerKw",
      "peakTorqueNm",
      "co2_gkm",
      "nox_mgkm",
      "confidence",
      "calibrationInput",
      "calibratedAt",
      "createdAt",
      "fuelCapacity",
      "currentFuel",
      "dataSource",
      "inmetroCityKmpl",
      "inmetroHighwayKmpl",
      "userAvgCityKmpl",
      "userAvgHighwayKmpl",
      "inmetroEthanolCityKmpl",
      "inmetroEthanolHighwayKmpl",
      "userAvgEthanolCityKmpl",
      "userAvgEthanolHighwayKmpl",
      "inmetroGnvCityKmpl",
      "inmetroGnvHighwayKmpl",
      "userAvgGnvCityKmpl",
      "userAvgGnvHighwayKmpl",
      "crr",
      "idleLph",
      "baseBsfc",
      "weightInmetro",
      "weightUser",
      "isHybrid",
      "gnvCylinderWeightKg",
      "gnvEfficiencyFactor",
      "transmission",
      "techEra",
      "idleFuelRateLph",
      "bsfcMinGPerKwh",
    ];

    const vehicle: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      if (row[i] !== null && row[i] !== undefined) {
        vehicle[col] = row[i];
      }
    });

    if (vehicle.transmission) {
      vehicle.transmission = JSON.parse(vehicle.transmission as string);
    }

    return vehicle as unknown as Vehicle;
  }

  private vehicleToRow(vehicle: Vehicle): unknown[] {
    const values = Object.values(vehicle).map((v) => {
      if (typeof v === "object" && v !== null) {
        return JSON.stringify(v);
      }
      return v;
    });
    return values;
  }

  async getRefuelsByVehicle(
    vehicleId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Refuel[]> {
    await this.init();
    let query = "SELECT * FROM refuels WHERE vehicleId = ?";
    const params: string[] = [vehicleId];

    if (startDate && endDate) {
      query += " AND timestamp >= ? AND timestamp <= ?";
      params.push(startDate.toISOString(), endDate.toISOString());
    }

    query += " ORDER BY timestamp DESC";

    const result = this.db!.exec(query, params);

    if (result.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result[0].values.map((row: any[]) => ({
      id: String(row[0]),
      vehicleId: String(row[1] || ""),
      timestamp: String(row[2]),
      amount: Number(row[3]),
      fuelPrice: Number(row[4]),
      fuelType: (row[5] || "gasolina") as FuelType,
      totalCost: Number(row[6]),
      consumedAmount: Number(row[7] || 0),
    }));
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
