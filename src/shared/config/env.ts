import { z } from "zod";
import { config } from "dotenv";

if (
  process.env.RELEASE_VERIFY_GUARD !== "true" &&
  process.env.NODE_ENV !== "test"
) {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
}

const booleanFlagSchema = (defaultValue: boolean) =>
  z
    .preprocess((val) => {
      if (val === undefined || val === "") return defaultValue;
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return val;
    }, z.boolean())
    .default(defaultValue);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection string")
    .default("postgres://postgres:postgres@localhost:5433/harpy_radar"),
  DB_POOL_MAX: z.coerce.number().int().positive().max(20).optional(),
  DATABASE_SSL: z
    .enum(["auto", "disable", "require", "verify-full"])
    .default("auto"),
  DATABASE_CA_CERT: z.string().optional(),
  APP_TIMEZONE: z.string().min(1).default("America/Caracas"),
  RATE_OFFICIAL_SYNC_CRON: z.string().min(1).default("0 30 17,19 * * 1-5"),
  RATE_PARALLEL_SYNC_CRON: z.string().min(1).default("0 0 9,13,17 * * *"),
  BAHIA_CRON: z.string().min(1).default("0 30 6 * * *"),
  RIOMARKET_CRON: z.string().min(1).default("0 35 6 * * *"),
  FARMATODO_CRON: z.string().min(1).default("0 40 6 * * *"),
  CENTRAL_MADEIRENSE_CRON: z.string().min(1).default("0 45 6 * * *"),
  PUNTO_AL_MAYOR_CRON: z.string().min(1).default("0 50 6 * * *"),
  VIVA_CRON: z.string().min(1).default("0 55 6 * * *"),
  LOCATEL_CRON: z.string().min(1).default("0 0 7 * * *"),
  SCRAPE_CONCURRENCY: z.coerce.number().int().positive().max(8).default(2),
  SCRAPE_DELAY_MS: z.coerce.number().int().nonnegative().default(400),
  SOURCE_BAHIA_ENABLED: booleanFlagSchema(true),
  SOURCE_RIOMARKET_ENABLED: booleanFlagSchema(true),
  SOURCE_FARMATODO_ENABLED: booleanFlagSchema(true),
  SOURCE_CENTRAL_MADEIRENSE_ENABLED: booleanFlagSchema(true),
  SOURCE_PUNTO_AL_MAYOR_ENABLED: booleanFlagSchema(true),
  SOURCE_VIVA_ENABLED: booleanFlagSchema(true),
  SOURCE_LOCATEL_ENABLED: booleanFlagSchema(true),
  CENTRAL_MADEIRENSE_BASE_URL: z
    .string()
    .url()
    .default("https://tucentralonline.com/Maiquetia-53"),
  FARMATODO_ALGOLIA_APP_ID: z.string().min(1).default("VCOJEYD2PO"),
  FARMATODO_ALGOLIA_API_KEY: z
    .string()
    .min(1)
    .default("869a91e98550dd668b8b1dc04bca9011"),
  FARMATODO_ALGOLIA_INDEX: z.string().min(1).default("products-venezuela"),
  BCV_CA_CERT: z.string().optional(),
  BCV_CA_BUNDLE: z.string().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  ARBITER_ENABLED: booleanFlagSchema(false),
  ARBITER_MAX_DAILY_CALLS: z.coerce.number().int().nonnegative().max(500).default(40),
  ARBITER_CACHE_TTL_DAYS: z.coerce.number().int().positive().max(365).default(45),
  ARBITER_MODEL_CASCADE: z
    .string()
    .min(1)
    .default("gemini-3.5-flash-lite,gemini-3.5-flash,gemini-2.5-flash"),
  DIGEST_MODEL_CASCADE: z
    .string()
    .min(1)
    .default("gemini-3.5-flash,gemini-3.5-flash-lite,gemini-2.5-flash"),
  ARBITER_CRON: z.string().min(1).default("0 15 7 * * *"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): Env {
  return envSchema.parse(input);
}

let cachedEnv: Env;

try {
  cachedEnv = parseEnv(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(
      "Invalid environment variables:",
      JSON.stringify(error.format(), null, 2)
    );
  } else {
    console.error("Failed to parse environment variables:", error);
  }
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  }
  cachedEnv = parseEnv({});
}

export const env = cachedEnv;
