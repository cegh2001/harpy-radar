import { describe, expect, it } from "vitest";
import { parseEnv } from "@/shared/config/env";

describe("parseEnv", () => {
  it("applies safe defaults when optional flags are omitted", () => {
    const parsed = parseEnv({});

    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.DATABASE_URL).toBe(
      "postgres://postgres:postgres@localhost:5433/harpy_radar"
    );
    expect(parsed.DB_POOL_MAX).toBeUndefined();
    expect(parsed.DATABASE_SSL).toBe("auto");
    expect(parsed.APP_TIMEZONE).toBe("America/Caracas");
    expect(parsed.RATE_OFFICIAL_SYNC_CRON).toBe("0 30 17,19 * * 1-5");
    expect(parsed.RATE_PARALLEL_SYNC_CRON).toBe("0 0 9,13,17 * * *");
    expect(parsed.BAHIA_CRON).toBe("0 30 6 * * *");
    expect(parsed.LOCATEL_CRON).toBe("0 0 7 * * *");
    expect(parsed.SOURCE_BAHIA_ENABLED).toBe(true);
    expect(parsed.SOURCE_RIOMARKET_ENABLED).toBe(true);
    expect(parsed.SOURCE_FARMATODO_ENABLED).toBe(true);
    expect(parsed.SOURCE_CENTRAL_MADEIRENSE_ENABLED).toBe(true);
    expect(parsed.SOURCE_PUNTO_AL_MAYOR_ENABLED).toBe(true);
    expect(parsed.SOURCE_VIVA_ENABLED).toBe(true);
    expect(parsed.SOURCE_LOCATEL_ENABLED).toBe(true);
    expect(parsed.CENTRAL_MADEIRENSE_BASE_URL).toBe(
      "https://tucentralonline.com/Maiquetia-53"
    );
    expect(parsed.SCRAPE_CONCURRENCY).toBe(2);
    expect(parsed.GEMINI_API_KEY).toBeUndefined();
    expect(parsed.ARBITER_ENABLED).toBe(false);
    expect(parsed.ARBITER_MAX_DAILY_CALLS).toBe(40);
    expect(parsed.ARBITER_CACHE_TTL_DAYS).toBe(45);
    expect(parsed.ARBITER_MODEL_CASCADE).toBe(
      "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-2.5-flash"
    );
    expect(parsed.DIGEST_MODEL_CASCADE).toBe(
      "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-2.5-flash"
    );
    expect(parsed.ARBITER_CRON).toBe("0 15 7 * * *");
  });

  it("parses boolean string flags strictly", () => {
    const parsed = parseEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user:pass@db.internal:5432/harpy",
      DB_POOL_MAX: "4",
      DATABASE_SSL: "require",
      SOURCE_BAHIA_ENABLED: "false",
      SOURCE_FARMATODO_ENABLED: "false",
      SOURCE_VIVA_ENABLED: "false",
      SCRAPE_CONCURRENCY: "4",
      ARBITER_ENABLED: "true",
      ARBITER_MAX_DAILY_CALLS: "25",
    });

    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.DB_POOL_MAX).toBe(4);
    expect(parsed.DATABASE_SSL).toBe("require");
    expect(parsed.SOURCE_BAHIA_ENABLED).toBe(false);
    expect(parsed.SOURCE_FARMATODO_ENABLED).toBe(false);
    expect(parsed.SOURCE_VIVA_ENABLED).toBe(false);
    expect(parsed.SCRAPE_CONCURRENCY).toBe(4);
    expect(parsed.ARBITER_ENABLED).toBe(true);
    expect(parsed.ARBITER_MAX_DAILY_CALLS).toBe(25);
  });

  it("rejects invalid DATABASE_URL values", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "not-a-valid-url",
      })
    ).toThrow();
  });
});
