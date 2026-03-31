import type { DbAdapter } from "./adapter";
import { attemptMigration } from "./migration";

let dbAdapter: DbAdapter | null = null;
let initPromise: Promise<DbAdapter> | null = null;

export async function getDb(): Promise<DbAdapter> {
  if (dbAdapter) {
    return dbAdapter;
  }

  if (!initPromise) {
    initPromise = initDb();
  }

  return initPromise;
}

async function initDb(): Promise<DbAdapter> {
  const result = await attemptMigration();
  dbAdapter = result.adapter;

  console.info(
    `Using database adapter: ${result.source}${result.migrated ? " (migrated)" : ""}`,
  );

  return dbAdapter;
}

export async function closeDb(): Promise<void> {
  if (dbAdapter) {
    await dbAdapter.close();
    dbAdapter = null;
    initPromise = null;
  }
}
