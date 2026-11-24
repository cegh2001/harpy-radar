import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import path from "node:path";
import * as schema from "./schema";

export const DATABASE_MIGRATIONS_LOCK_KEY = "harpy-radar:database-migrations";

interface RunDatabaseMigrationsOptions {
  pool?: Pick<Pool, "connect">;
  migrationsFolder?: string;
  migrateFn?: typeof migrate;
}

export async function runDatabaseMigrations(
  options: RunDatabaseMigrationsOptions = {}
): Promise<void> {
  const migrationPool = options.pool ?? (await import("./client")).pool;
  const migrationsFolder =
    options.migrationsFolder ?? path.resolve(process.cwd(), "src/db/migrations");
  const migrateFn = options.migrateFn ?? migrate;
  const client = await migrationPool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      DATABASE_MIGRATIONS_LOCK_KEY,
    ]);
    lockAcquired = true;

    await migrateFn(drizzle(client, { schema }), { migrationsFolder });
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
        DATABASE_MIGRATIONS_LOCK_KEY,
      ]);
    }
    client.release();
  }
}
