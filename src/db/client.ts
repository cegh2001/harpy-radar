import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/shared/config/env";
import { buildPgPoolConfig } from "./pool-config";
import * as schema from "./schema";

const { Pool } = pg;

const globalForDb = globalThis as typeof globalThis & {
  __harpyRadarPool?: pg.Pool;
};

const poolConfig = buildPgPoolConfig({
  connectionString: env.DATABASE_URL,
  nodeEnv: env.NODE_ENV,
  maxConnections: env.DB_POOL_MAX,
  sslMode: env.DATABASE_SSL,
  caCert: env.DATABASE_CA_CERT,
});

export const pool =
  env.NODE_ENV !== "production"
    ? (globalForDb.__harpyRadarPool ??= new Pool(poolConfig))
    : new Pool(poolConfig);

export const db = drizzle(pool, { schema });
export type DbClient = typeof db;
