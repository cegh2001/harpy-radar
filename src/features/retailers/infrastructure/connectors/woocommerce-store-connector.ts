import { z } from "zod";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const wooProductSchema = z.object({
  id: z.union([z.string(), z.number()]),
  sku: z.string().nullable().optional(),
  name: z.string().min(1),
  permalink: z.string().nullable().optional(),
  is_in_stock: z.boolean().optional(),
  add_to_cart: z
    .object({
      maximum: z.coerce.number().optional(),
    })
    .optional(),
  images: z
    .array(
      z.object({
        src: z.string(),
      })
    )
    .optional(),
  prices: z.object({
    price: z.union([z.string(), z.number()]),
    currency_minor_unit: z.coerce.number().int().nonnegative().default(2),
    currency_code: z.string().optional(),
  }),
});

const wooResponseSchema = z.array(wooProductSchema);

export interface WooCommerceConnectorOptions {
  retailerSlug: string;
  baseUrl: string;
  region: string;
  currency?: "USD" | "VES";
  perPage?: number;
  fetchFn?: typeof fetch;
}

export class WooCommerceStoreConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly region: string;
  private readonly currency: "USD" | "VES";
  private readonly perPage: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: WooCommerceConnectorOptions) {
    this.retailerSlug = options.retailerSlug;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.region = options.region;
    this.currency = options.currency ?? "USD";
    this.perPage = options.perPage ?? 15;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const endpoint = `${this.baseUrl}/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}&per_page=${this.perPage}`;

    const response = await this.fetchFn(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `WooCommerce Store API returned HTTP ${response.status}`
      );
    }

    const payload = wooResponseSchema.parse(await response.json());
    const observedAt = new Date();

    return payload
      .map((item): RawRetailProduct | null => {
        const rawInt =
          typeof item.prices.price === "number"
            ? item.prices.price
            : Number.parseInt(item.prices.price, 10);
        if (!Number.isFinite(rawInt) || rawInt <= 0) return null;

        const minorUnit = item.prices.currency_minor_unit ?? 2;
        const amount = rawInt / 10 ** minorUnit;
        if (!Number.isFinite(amount) || amount <= 0) return null;

        const externalSku = item.sku?.trim() || String(item.id);
        const rawTitle = item.name.replace(/\s+/g, " ").trim();

        return {
          externalSku,
          barcode: null,
          rawTitle,
          originalAmount: amount,
          originalCurrency: this.currency,
          inStock: item.is_in_stock !== false,
          storeAvailabilityCount: item.add_to_cart?.maximum ?? null,
          productUrl: item.permalink ?? `${this.baseUrl}/`,
          imageUrl: item.images?.[0]?.src || null,
          region: this.region,
          observedAt,
        };
      })
      .filter((item): item is RawRetailProduct => item !== null);
  }
}
