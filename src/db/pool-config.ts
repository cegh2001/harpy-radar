import type { PoolConfig } from "pg";

export type DatabaseSslMode = "auto" | "disable" | "require" | "verify-full";

export interface BuildPgPoolConfigInput {
  connectionString: string;
  nodeEnv: "development" | "production" | "test";
  maxConnections?: number;
  sslMode?: DatabaseSslMode;
  caCert?: string;
}

function isSupabaseHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower.endsWith(".supabase.co") || lower.endsWith(".supabase.com");
}

function resolvePoolSsl(
  url: URL,
  sslMode: DatabaseSslMode,
  caCert?: string
): PoolConfig["ssl"] {
  const urlSslMode = url.searchParams.get("sslmode")?.toLowerCase() ?? null;
  const trimmedCaCert = caCert?.trim() ? caCert.trim() : undefined;

  if (
    sslMode === "disable" ||
    (sslMode === "auto" && urlSslMode === "disable")
  ) {
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return false;
  }

  if (
    sslMode === "verify-full" ||
    urlSslMode === "verify-full" ||
    trimmedCaCert !== undefined
  ) {
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return trimmedCaCert
      ? { rejectUnauthorized: true, ca: trimmedCaCert }
      : { rejectUnauthorized: true };
  }

  const requiresRelaxedSsl =
    sslMode === "require" ||
    (urlSslMode !== null &&
      ["require", "prefer", "verify-ca"].includes(urlSslMode)) ||
    isSupabaseHostname(url.hostname);

  if (requiresRelaxedSsl) {
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return { rejectUnauthorized: false };
  }

  return undefined;
}

/**
 * Builds node-postgres PoolConfig with serverless-safe pool sizing and
 * normalized SSL handling for local Docker Postgres and Supabase poolers.
 */
export function buildPgPoolConfig(input: BuildPgPoolConfigInput): PoolConfig {
  const max = input.maxConnections ?? (input.nodeEnv === "production" ? 5 : 10);
  const sslMode = input.sslMode ?? "auto";

  const parsedUrl = new URL(input.connectionString);
  const ssl = resolvePoolSsl(parsedUrl, sslMode, input.caCert);

  return {
    connectionString: parsedUrl.toString(),
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(ssl !== undefined ? { ssl } : {}),
  };
}
