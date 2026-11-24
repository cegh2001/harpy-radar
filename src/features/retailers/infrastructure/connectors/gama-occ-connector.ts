import { z } from "zod";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const gamaProductSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  url: z.string().optional(),
  price: z
    .object({
      value: z.coerce.number().nonnegative(),
      currencyIso: z.string().optional(),
    })
    .optional(),
  totalWithVatPrice: z
    .object({
      value: z.coerce.number().nonnegative(),
    })
    .optional(),
  stock: z
    .object({
      stockLevelStatus: z.string().optional(),
      stockLevel: z.number().optional(),
    })
    .optional(),
});

const gamaSearchResponseSchema = z.object({
  products: z.array(gamaProductSchema).default([]),
});

export interface GamaConnectorOptions {
  retailerSlug?: string;
  baseUrl?: string;
  warehouseCode?: string;
  region?: string;
  fetchFn?: typeof fetch;
}

export class GamaOccConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly warehouseCode: string;
  private readonly region: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GamaConnectorOptions = {}) {
    this.retailerSlug = options.retailerSlug ?? "excelsior-gama";
    this.baseUrl = (options.baseUrl ?? "https://api.gamaenlinea.com").replace(
      /\/$/,
      ""
    );
    this.warehouseCode = options.warehouseCode ?? "S007";
    this.region = options.region ?? "Caracas";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const params = new URLSearchParams({
      query,
      pageSize: "12",
      warehouse: this.warehouseCode,
      lang: "es",
      curr: "VES",
      fields:
        "products(code,name,url,price(value,currencyIso),totalWithVatPrice(value),stock(stockLevelStatus,stockLevel))",
    });

    const endpoint = `${this.baseUrl}/occ/v2/egb2c-spa/products/search?${params.toString()}`;
    const response = await this.fetchFn(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Origin: "https://gamaenlinea.com",
        Referer: "https://gamaenlinea.com/",
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `Excelsior Gama OCC returned HTTP ${response.status}`
      );
    }

    const payload = gamaSearchResponseSchema.parse(await response.json());
    const observedAt = new Date();

    return payload.products
      .map((item): RawRetailProduct | null => {
        const amount = item.totalWithVatPrice?.value ?? item.price?.value ?? 0;
        if (!Number.isFinite(amount) || amount <= 0) return null;

        const currency =
          item.price?.currencyIso?.toUpperCase() === "REF" ? "USD" : "VES";
        const stockStatus = item.stock?.stockLevelStatus?.toLowerCase();
        const inStock = stockStatus ? stockStatus !== "outofstock" : true;

        return {
          externalSku: item.code,
          barcode: null,
          rawTitle: item.name.trim(),
          originalAmount: amount,
          originalCurrency: currency,
          inStock,
          storeAvailabilityCount: item.stock?.stockLevel ?? null,
          productUrl: item.url
            ? `https://gamaenlinea.com${item.url}`
            : "https://gamaenlinea.com/",
          imageUrl: null,
          region: this.region,
          observedAt,
        };
      })
      .filter((item): item is RawRetailProduct => item !== null);
  }
}
