import { describe, expect, it } from "vitest";
import { buildPgPoolConfig } from "@/db/pool-config";

describe("buildPgPoolConfig", () => {
  it("keeps local Docker Postgres unencrypted with development default pool size", () => {
    const config = buildPgPoolConfig({
      connectionString:
        "postgres://postgres:postgres@localhost:5433/harpy_radar",
      nodeEnv: "development",
    });

    expect(config.max).toBe(10);
    expect(config.connectionTimeoutMillis).toBe(10_000);
    expect(config.idleTimeoutMillis).toBe(30_000);
    expect("ssl" in config).toBe(false);
    expect(config.connectionString).toBe(
      "postgres://postgres:postgres@localhost:5433/harpy_radar"
    );
  });

  it("defaults production pool max to 5 and honors explicit maxConnections", () => {
    const prodDefault = buildPgPoolConfig({
      connectionString: "postgres://u:p@db.internal:5432/harpy",
      nodeEnv: "production",
    });
    expect(prodDefault.max).toBe(5);

    const customMax = buildPgPoolConfig({
      connectionString: "postgres://u:p@db.internal:5432/harpy",
      nodeEnv: "production",
      maxConnections: 3,
    });
    expect(customMax.max).toBe(3);
  });

  it("strips sslmode=require from Supabase pooler URLs and sets rejectUnauthorized=false", () => {
    const config = buildPgPoolConfig({
      connectionString:
        "postgres://postgres.proj:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true",
      nodeEnv: "production",
      sslMode: "auto",
    });

    expect(config.ssl).toStrictEqual({ rejectUnauthorized: false });
    expect(config.connectionString).toBe(
      "postgres://postgres.proj:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    );
  });

  it("auto-enables SSL for Supabase hostnames even without sslmode query param", () => {
    const config = buildPgPoolConfig({
      connectionString:
        "postgres://postgres.proj:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      nodeEnv: "production",
    });

    expect(config.ssl).toStrictEqual({ rejectUnauthorized: false });
  });

  it("allows explicit sslMode='disable' to override Supabase auto-detection", () => {
    const config = buildPgPoolConfig({
      connectionString:
        "postgres://postgres.proj:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require",
      nodeEnv: "production",
      sslMode: "disable",
    });

    expect(config.ssl).toBe(false);
    expect(config.connectionString).toBe(
      "postgres://postgres.proj:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    );
  });

  it("supports verify-full and custom CA certificate", () => {
    const verifyOnly = buildPgPoolConfig({
      connectionString: "postgres://u:p@db.example.com:5432/harpy",
      nodeEnv: "production",
      sslMode: "verify-full",
    });
    expect(verifyOnly.ssl).toStrictEqual({ rejectUnauthorized: true });

    const withCa = buildPgPoolConfig({
      connectionString:
        "postgres://u:p@db.example.com:5432/harpy?sslmode=require",
      nodeEnv: "production",
      sslMode: "auto",
      caCert: "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
    });
    expect(withCa.ssl).toStrictEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
    });
    expect(withCa.connectionString).toBe(
      "postgres://u:p@db.example.com:5432/harpy"
    );
  });
});
