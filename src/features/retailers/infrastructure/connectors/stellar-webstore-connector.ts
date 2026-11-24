import { z } from "zod";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const stellarProductSchema = z.object({
  product: z.string().min(1),
  precio: z.coerce.number().nonnegative(),
  PrecioFinal: z.coerce.number().nonnegative().optional(),
  code: z.string().min(1),
  Image: z.string().optional(),
  Simbolo: z.string().optional(),
});

const stellarResponseSchema = z.array(stellarProductSchema);

export interface StellarConnectorOptions {
  retailerSlug: string;
  baseUrl: string;
  region: string;
  fetchFn?: typeof fetch;
}

function extractCookieHeader(headers: Headers): string | null {
  const raw = headers.get("set-cookie");
  if (!raw) return null;
  const sessionMatch = raw.match(/PHPSESSID=([^;\s,]+)/i);
  return sessionMatch ? `PHPSESSID=${sessionMatch[1]}` : raw.split(";")[0];
}

function normalizeImageUrl(baseUrl: string, rawPath?: string): string | null {
  if (!rawPath) return null;
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return rawPath;
  }
  const clean = rawPath.replace(/^\.\//, "");
  return `${baseUrl.replace(/\/$/, "")}/${clean}`;
}

export class StellarWebstoreConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly region: string;
  private readonly fetchFn: typeof fetch;
  private cachedCookie: string | null = null;

  constructor(options: StellarConnectorOptions) {
    this.retailerSlug = options.retailerSlug;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.region = options.region;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async ensureSessionCookie(signal?: AbortSignal): Promise<string | null> {
    if (this.cachedCookie) return this.cachedCookie;

    const response = await this.fetchFn(`${this.baseUrl}/`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `Session bootstrap returned HTTP ${response.status}`
      );
    }

    this.cachedCookie = extractCookieHeader(response.headers);
    return this.cachedCookie;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const cookie = await this.ensureSessionCookie(signal);
    const endpoint = `${this.baseUrl}/includes/QueryPHP/Product/ListaProductosSugeridos.php?des=${encodeURIComponent(query)}`;

    const response = await this.fetchFn(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json,text/plain,*/*",
        Referer: `${this.baseUrl}/`,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `Search endpoint returned HTTP ${response.status}`
      );
    }

    const text = (await response.text()).trim();
    if (!text || text.toLowerCase().includes("no hay resultados")) {
      return [];
    }

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(text);
    } catch {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `Unexpected non-JSON response: ${text.slice(0, 80)}`
      );
    }

    const parsed = stellarResponseSchema.parse(rawJson);
    const observedAt = new Date();

    return parsed
      .map((item): RawRetailProduct | null => {
        const finalPrice =
          item.PrecioFinal && item.PrecioFinal > 0
            ? item.PrecioFinal
            : item.precio;
        if (!Number.isFinite(finalPrice) || finalPrice <= 0) return null;

        const originalCurrency = item.Simbolo?.includes("$") ? "USD" : "VES";
        return {
          externalSku: item.code,
          barcode: null,
          rawTitle: item.product.trim(),
          originalAmount: finalPrice,
          originalCurrency,
          inStock: true,
          storeAvailabilityCount: null,
          productUrl: `${this.baseUrl}/`,
          imageUrl: normalizeImageUrl(this.baseUrl, item.Image),
          region: this.region,
          observedAt,
        };
      })
      .filter((item): item is RawRetailProduct => item !== null);
  }
}
