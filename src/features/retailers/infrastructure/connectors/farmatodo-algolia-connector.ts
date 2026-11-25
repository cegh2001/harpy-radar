import { z } from "zod";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const nullablePriceSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .optional();

const farmatodoHitSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  objectID: z.string().min(1),
  barcode: z.string().nullable().optional(),
  mediaDescription: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  fullPrice: nullablePriceSchema,
  offerPrice: nullablePriceSchema,
  fullPriceByCity: z
    .array(
      z.object({
        cityCode: z.string(),
        fullPrice: nullablePriceSchema,
      })
    )
    .optional(),
  stores_with_stock: z.array(z.union([z.number(), z.string()])).optional(),
  url: z.string().nullable().optional(),
  mediaImageUrl: z.string().nullable().optional(),
});

const algoliaResponseSchema = z.object({
  hits: z.array(farmatodoHitSchema),
});

const PRIORITY_CITY_CODES = new Set(["CCS", "LG", "MAI", "CARACAS"]);

function parseOptionalPositiveNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function resolveHitBasePrice(
  hit: z.infer<typeof farmatodoHitSchema>
): number | null {
  const globalPrice = parseOptionalPositiveNumber(hit.fullPrice);
  if (globalPrice !== null) {
    return globalPrice;
  }

  for (const entry of hit.fullPriceByCity ?? []) {
    if (!PRIORITY_CITY_CODES.has(entry.cityCode.trim().toUpperCase())) {
      continue;
    }
    const cityPrice = parseOptionalPositiveNumber(entry.fullPrice);
    if (cityPrice !== null) {
      return cityPrice;
    }
  }

  return null;
}

export interface FarmatodoConnectorOptions {
  retailerSlug?: string;
  appId: string;
  apiKey: string;
  indexName: string;
  region?: string;
  hitsPerPage?: number;
  fetchFn?: typeof fetch;
}

export class FarmatodoAlgoliaConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly appId: string;
  private readonly apiKey: string;
  private readonly indexName: string;
  private readonly region: string;
  private readonly hitsPerPage: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: FarmatodoConnectorOptions) {
    this.retailerSlug = options.retailerSlug ?? "farmatodo-ve";
    this.appId = options.appId;
    this.apiKey = options.apiKey;
    this.indexName = options.indexName;
    this.region = options.region ?? "La Guaira / Caracas";
    this.hitsPerPage = options.hitsPerPage ?? 12;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const endpoint = `https://${this.appId.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(this.indexName)}/query`;

    const response = await this.fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Algolia-Application-Id": this.appId,
        "X-Algolia-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        query,
        hitsPerPage: this.hitsPerPage,
      }),
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `Algolia search failed with HTTP ${response.status}`
      );
    }

    const payload = algoliaResponseSchema.parse(await response.json());
    const observedAt = new Date();

    return payload.hits
      .map((hit): RawRetailProduct | null => {
        const title = (hit.mediaDescription || hit.description || "").trim();
        if (!title) return null;

        const basePrice = resolveHitBasePrice(hit);
        if (basePrice === null) return null;

        const offerPrice = parseOptionalPositiveNumber(hit.offerPrice);
        const effectivePrice =
          offerPrice !== null && offerPrice < basePrice
            ? offerPrice
            : basePrice;

        const stores = hit.stores_with_stock ?? [];
        const externalSku = String(hit.id ?? hit.objectID);
        const productUrl = hit.url
          ? `https://www.farmatodo.com.ve/producto/${hit.url.replace(/^\//, "")}`
          : "https://www.farmatodo.com.ve/";

        return {
          externalSku,
          barcode: hit.barcode ?? null,
          rawTitle: title,
          originalAmount: effectivePrice,
          originalCurrency: "VES",
          inStock: stores.length > 0,
          storeAvailabilityCount: stores.length,
          productUrl,
          imageUrl: hit.mediaImageUrl ?? null,
          region: this.region,
          observedAt,
        };
      })
      .filter((item): item is RawRetailProduct => item !== null);
  }
}
