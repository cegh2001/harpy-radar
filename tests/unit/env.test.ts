import { describe, expect, it } from "vitest";
import { parseEnv } from "@/shared/config/env";

describe("parseEnv", () => {
  it("applies safe defaults when optional flags are omitted", () => {
    const parsed = parseEnv({});

    expect(parsed.NODE_ENV).toBe("development");
    expect(parsed.DATABASE_URL).toBe(
      "postgres://postgres:postgres@localhost:5433/harpy_radar"
    );
    expect(parsed.APP_TIMEZONE).toBe("America/Caracas");
    expect(parsed.SOURCE_BAHIA_ENABLED).toBe(true);
    expect(parsed.SOURCE_RIOMARKET_ENABLED).toBe(true);
    expect(parsed.SOURCE_FARMATODO_ENABLED).toBe(true);
    expect(parsed.SOURCE_CENTRAL_MADEIRENSE_ENABLED).toBe(true);
    expect(parsed.SOURCE_PUNTO_AL_MAYOR_ENABLED).toBe(true);
    expect(parsed.SOURCE_VIVA_ENABLED).toBe(true);
    expect(parsed.SOURCE_LOCATEL_ENABLED).toBe(true);
    expect(parsed.SOURCE_GAMA_ENABLED).toBe(false);
    expect(parsed.CENTRAL_MADEIRENSE_BASE_URL).toBe(
      "https://tucentralonline.com/Maiquetia-53"
    );
    expect(parsed.SCRAPE_CONCURRENCY).toBe(2);
    expect(parsed.GAMA_WAREHOUSE_CODE).toBe("S007");
  });

  it("parses boolean string flags strictly", () => {
    const parsed = parseEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user:pass@db.internal:5432/harpy",
      SOURCE_BAHIA_ENABLED: "false",
      SOURCE_FARMATODO_ENABLED: "false",
      SOURCE_GAMA_ENABLED: "true",
      SCRAPE_CONCURRENCY: "4",
    });

    expect(parsed.NODE_ENV).toBe("production");
    expect(parsed.SOURCE_BAHIA_ENABLED).toBe(false);
    expect(parsed.SOURCE_FARMATODO_ENABLED).toBe(false);
    expect(parsed.SOURCE_GAMA_ENABLED).toBe(true);
    expect(parsed.SCRAPE_CONCURRENCY).toBe(4);
  });

  it("rejects invalid DATABASE_URL values", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "not-a-valid-url",
      })
    ).toThrow();
  });
});
