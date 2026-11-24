import { z } from "zod";
import { config } from "dotenv";

if (
  process.env.RELEASE_VERIFY_GUARD !== "true" &&
  process.env.NODE_ENV !== "test"
) {
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
  APP_TIMEZONE: z.string().min(1).default("America/Caracas"),
  RATE_SYNC_CRON: z.string().min(1).default("0 */30 * * * *"),
  BAHIA_CRON: z.string().min(1).default("0 5 */4 * * *"),
  RIOMARKET_CRON: z.string().min(1).default("0 12 */4 * * *"),
  FARMATODO_CRON: z.string().min(1).default("0 20 */4 * * *"),
  GAMA_CRON: z.string().min(1).default("0 35 */4 * * *"),
  SCRAPE_CONCURRENCY: z.coerce.number().int().positive().max(8).default(2),
  SCRAPE_DELAY_MS: z.coerce.number().int().nonnegative().default(400),
  SOURCE_BAHIA_ENABLED: booleanFlagSchema(true),
  SOURCE_RIOMARKET_ENABLED: booleanFlagSchema(true),
  SOURCE_FARMATODO_ENABLED: booleanFlagSchema(true),
  SOURCE_GAMA_ENABLED: booleanFlagSchema(false),
  FARMATODO_ALGOLIA_APP_ID: z.string().min(1).default("VCOJEYD2PO"),
  FARMATODO_ALGOLIA_API_KEY: z
    .string()
    .min(1)
    .default("869a91e98550dd668b8b1dc04bca9011"),
  FARMATODO_ALGOLIA_INDEX: z.string().min(1).default("products-venezuela"),
  GAMA_WAREHOUSE_CODE: z.string().min(1).default("S007"),
  BCV_CA_CERT: z.string().optional(),
  BCV_CA_BUNDLE: z.string().optional(),
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
