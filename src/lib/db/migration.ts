import type { DbAdapter } from "./adapter";
import { createSqliteAdapter } from "./sqlite-adapter";

const MIGRATION_KEY = "db_migration_version";
const CURRENT_MIGRATION_VERSION = 1;

interface MigrationResult {
  adapter: DbAdapter;
  source: "sqlite";
  migrated: boolean;
}

export async function attemptMigration(): Promise<MigrationResult> {
  const sqliteAdapter = createSqliteAdapter();

  try {
    if (await sqliteAdapter.isReady()) {
      localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION));
      return { adapter: sqliteAdapter, source: "sqlite", migrated: false };
    }
  } catch (error) {
    console.error("Failed to initialize SQLite adapter:", error);
  }

  throw new Error("SQLite adapter failed to initialize");
}

export async function forceUseSqlite(): Promise<DbAdapter> {
  const adapter = createSqliteAdapter();
  localStorage.setItem(MIGRATION_KEY, String(CURRENT_MIGRATION_VERSION));
  return adapter;
}

export async function migrateFromDexie(
  _sqliteAdapter: DbAdapter,
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Dexie migration no longer supported" };
}

export async function forceUseDexie(): Promise<DbAdapter> {
  throw new Error("Dexie is no longer supported. Use SQLite instead.");
}
