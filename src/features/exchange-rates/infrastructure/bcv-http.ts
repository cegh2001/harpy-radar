import https from "node:https";
import { env } from "@/shared/config/env";
import { isRetryableError } from "@/shared/lib/resilience/errors";
import { withRetry } from "@/shared/lib/resilience/retry";
import {
  parseBCVHtml,
  parseDolarApiCotizaciones,
  parseDolarApiDolares,
  type DolarApiParsedRates,
  type ScrapedBcvRates,
} from "../domain/bcv-parser";

const BCV_RATE_PATHS = [
  "/estadisticas/tipo-cambio-de-referencia-smc",
  "/",
];

const RETRYABLE_NETWORK_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
]);

function shouldRetryBcvError(error: unknown): boolean {
  if (isRetryableError(error)) return true;
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    (Boolean(code) && RETRYABLE_NETWORK_CODES.has(code!)) ||
    error.message.toLowerCase().includes("timeout")
  );
}

function performBcvHttpsRequest(
  path: string,
  signal?: AbortSignal
): Promise<string> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const customCa = env.BCV_CA_CERT || env.BCV_CA_BUNDLE;
    // BCV serves an incomplete certificate chain in standard Node environments.
    // Disable strict verification solely for www.bcv.org.ve unless a custom CA is supplied.
    const req = https.request(
      {
        hostname: "www.bcv.org.ve",
        port: 443,
        path,
        method: "GET",
        signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
          Referer: "https://www.bcv.org.ve/",
        },
        rejectUnauthorized: Boolean(customCa),
        ...(customCa ? { ca: customCa } : {}),
      },
      (response) => {
        let html = "";
        response.on("data", (chunk) => {
          html += chunk;
        });
        response.on("end", () => resolve(html));
        response.on("error", reject);
      }
    );

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout while querying BCV"));
    });
    req.end();
  });
}

export async function fetchOfficialBcvRates(
  signal?: AbortSignal
): Promise<ScrapedBcvRates> {
  const errors: string[] = [];

  for (const path of BCV_RATE_PATHS) {
    signal?.throwIfAborted();
    try {
      const html = await withRetry(
        () => performBcvHttpsRequest(path, signal),
        {
          maxAttempts: 2,
          baseDelayMs: 500,
          maxDelayMs: 3000,
          shouldRetry: (error) => !signal?.aborted && shouldRetryBcvError(error),
        }
      );
      return parseBCVHtml(html);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${path}: ${reason}`);
    }
  }

  throw new Error(`BCV official endpoint unavailable (${errors.join(" | ")})`);
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<unknown> {
  return withRetry(
    async () => {
      signal?.throwIfAborted();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: signal
            ? AbortSignal.any([signal, controller.signal])
            : controller.signal,
        });
        if (!response.ok) {
          throw Object.assign(new Error(`HTTP ${response.status}`), {
            status: response.status,
          });
        }
        return (await response.json()) as unknown;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 4000,
      shouldRetry: (error) => !signal?.aborted && isRetryableError(error),
    }
  );
}

export async function fetchDolarApiCotizaciones(
  signal?: AbortSignal
): Promise<ScrapedBcvRates> {
  const payload = await fetchJsonWithTimeout(
    "https://ve.dolarapi.com/v1/cotizaciones",
    6000,
    signal
  );
  return parseDolarApiCotizaciones(payload);
}

export async function fetchDolarApiDolares(
  signal?: AbortSignal
): Promise<DolarApiParsedRates> {
  const payload = await fetchJsonWithTimeout(
    "https://ve.dolarapi.com/v1/dolares",
    6000,
    signal
  );
  return parseDolarApiDolares(payload);
}
