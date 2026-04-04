import type { DbAdapter } from "./adapter";
import { createDexieAdapter } from "./dexie-adapter";
import { createSqliteAdapter } from "./sqlite-adapter";
import type { Trip, Settings, Refuel } from "@/types";

const MIGRATION_KEY = "db_migration_version";
const CURRENT_MIGRATION_VERSION = 1;

interface MigrationResult {
  adapter: DbAdapter;
  source: "dexie" | "sqlite";
  migrated: boolean;
}

async function readDexieData(): Promise<{
  settings: Settings;
  trips: Trip[];
  refuels: Refuel[];
  currentTrip: Trip | undefined;
}> {
  const Dexie = (await import("dexie")).default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Dexie("CarTelemetryDB") as any;
  await db.open();

  const settings = await db.settings.get("default");
  const trips = await db.trips.toArray();
  const refuels = await db.refuels.toArray();
  const currentTrip = await db.currentTrip.toCollection().first();

  return { settings, trips, refuels, currentTrip };
}

export async function migrateFromDexie(
  sqliteAdapter: DbAdapter,
): Promise<{ success: boolean; error?: string }> {
  try {
    const dexieData = await readDexieData();

    if (dexieData.settings) {
      await sqliteAdapter.saveSettings(dexieData.settings);
    }

    for (const trip of dexieData.trips) {
      await sqliteAdapter.saveTrip(trip);
    }

    for (const refuel of dexieData.refuels) {
      await sqliteAdapter.addRefuel(
        refuel.vehicleId || "",
        refuel.amount,
        refuel.fuelPrice,
        refuel.fuelType,
      );
    }

    if (dexieData.currentTrip) {
      await sqliteAdapter.saveCurrentTrip(dexieData.currentTrip);
    }

    const sqliteSettings = await sqliteAdapter.getSettings();
    if (!sqliteSettings) {
      throw new Error("Migration validation failed: no settings found");
    }

    localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION));

    return { success: true };
  } catch (error) {
    console.error("Migration failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function attemptMigration(): Promise<MigrationResult> {
  const migrationVersion = parseInt(
    localStorage.getItem(MIGRATION_KEY) || "0",
    10,
  );

  if (migrationVersion >= CURRENT_MIGRATION_VERSION) {
    const sqliteAdapter = createSqliteAdapter();
    try {
      if (await sqliteAdapter.isReady()) {
        return { adapter: sqliteAdapter, source: "sqlite", migrated: false };
      }
    } catch {
      console.warn("SQLite not ready, falling back to Dexie");
    }
  }

  if (migrationVersion === 0) {
    const sqliteSupported = await createSqliteAdapter.isSupported();

    if (sqliteSupported) {
      const sqliteAdapter = createSqliteAdapter();

      try {
        if (await sqliteAdapter.isReady()) {
          const dexieAdapter = createDexieAdapter();
          await dexieAdapter.getSettings();

          const migrationResult = await migrateFromDexie(sqliteAdapter);

          if (migrationResult.success) {
            console.info("Migration successful from Dexie to SQLite");
            return { adapter: sqliteAdapter, source: "sqlite", migrated: true };
          }
        }
      } catch (error) {
        console.warn("Migration failed, using Dexie:", error);
      }
    }
  }

  const dexieAdapter = createDexieAdapter();
  return { adapter: dexieAdapter, source: "dexie", migrated: false };
}

export async function forceUseDexie(): Promise<DbAdapter> {
  const adapter = createDexieAdapter();
  localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION));
  return adapter;
}

export async function forceUseSqlite(): Promise<DbAdapter> {
  const adapter = createSqliteAdapter();
  localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION));
  return adapter;
}
