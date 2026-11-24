import { z } from "zod";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const rioProductSchema = z.object({
  sku: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  price: z.coerce.number().positive(),
  unit: z.string().optional(),
  subUnit: z.string().optional(),
  subQty: z.coerce.number().optional(),
  ean: z.array(z.string()).optional(),
  stock: z.coerce.number().optional(),
  isAvailable: z.boolean().optional(),
  slug: z.string().optional(),
  photosUrl: z.array(z.string()).optional(),
});

export interface RioMarketConnectorOptions {
  retailerSlug?: string;
  baseUrl?: string;
  region?: string;
  fetchFn?: typeof fetch;
}

function extractBalancedJsonObject(
  source: string,
  startBraceIndex: number
): { jsonText: string; endIndex: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return {
            jsonText: source.slice(startBraceIndex, i + 1),
            endIndex: i + 1,
          };
        }
      }
    }
  }

  return null;
}

function hasExplicitMassUnit(title: string): boolean {
  return /\b\d+(?:[.,]\d+)?\s*(kg|kilo|kilos|g|gr|grs|gramos)\b/i.test(title);
}

export function extractRioProductsFromHtml(html: string): RawRetailProduct[] {
  const normalized = html.replace(/\\"/g, '"').replace(/\\u0026/g, "&");
  const marker = '"product":{';
  const observedAt = new Date();
  const seenSkus = new Set<string>();
  const results: RawRetailProduct[] = [];

  let cursor = 0;
  while (cursor < normalized.length) {
    const markerIdx = normalized.indexOf(marker, cursor);
    if (markerIdx === -1) break;

    const braceStart = markerIdx + marker.length - 1;
    const extracted = extractBalancedJsonObject(normalized, braceStart);
    if (!extracted) {
      cursor = braceStart + 1;
      continue;
    }

    cursor = extracted.endIndex;
    let rawObj: unknown;
    try {
      rawObj = JSON.parse(extracted.jsonText);
    } catch {
      continue;
    }

    const parsed = rioProductSchema.safeParse(rawObj);
    if (!parsed.success) continue;

    const item = parsed.data;
    const externalSku = String(item.sku);
    if (seenSkus.has(externalSku)) continue;
    seenSkus.add(externalSku);

    const cleanName = item.name.replace(/\u00a0/g, " ").trim();
    const rawTitle =
      item.unit?.toUpperCase() === "KG" && !hasExplicitMassUnit(cleanName)
        ? `${cleanName} 1kg`
        : cleanName;

    const inStock =
      item.isAvailable !== false &&
      (item.stock === undefined || item.stock > 0);

    results.push({
      externalSku,
      barcode: item.ean?.[0] ?? null,
      rawTitle,
      originalAmount: item.price,
      originalCurrency: "USD",
      inStock,
      storeAvailabilityCount: item.stock ?? null,
      productUrl: item.slug
        ? `https://www.riomarket.com/product/${item.slug}`
        : "https://www.riomarket.com/",
      imageUrl: item.photosUrl?.[0] ?? null,
      region: "Caracas",
      observedAt,
    });
  }

  return results;
}

export class RioMarketConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly region: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: RioMarketConnectorOptions = {}) {
    this.retailerSlug = options.retailerSlug ?? "riomarket-caracas";
    this.baseUrl = (options.baseUrl ?? "https://www.riomarket.com").replace(
      /\/$/,
      ""
    );
    this.region = options.region ?? "Caracas";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const endpoint = `${this.baseUrl}/search?name=${encodeURIComponent(query)}`;
    const response = await this.fetchFn(endpoint, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `Rio Supermarket returned HTTP ${response.status}`
      );
    }

    const html = await response.text();
    return extractRioProductsFromHtml(html).map((item) => ({
      ...item,
      region: this.region,
    }));
  }
}
