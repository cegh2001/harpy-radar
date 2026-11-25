import { z } from "zod";
import {
  normalizeText,
  tokenizeNormalized,
} from "@/features/catalog/domain/unit-normalizer";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const shopifyVariantSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().default("Default Title"),
  sku: z.string().nullable().optional(),
  available: z.boolean().optional(),
  price: z.union([z.string(), z.number()]),
});

const shopifyProductSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string().min(1),
  handle: z.string().min(1),
  product_type: z.string().optional(),
  images: z.array(z.object({ src: z.string() })).optional(),
  variants: z.array(shopifyVariantSchema).default([]),
});

const shopifyProductsPageSchema = z.object({
  products: z.array(shopifyProductSchema),
});

type ShopifyProduct = z.infer<typeof shopifyProductSchema>;
type ShopifyVariant = z.infer<typeof shopifyVariantSchema>;

const RETAIL_VARIANT_RE = /\b(detal|unidad|individual)\b/i;
const WHOLESALE_VARIANT_RE = /\b(mayor|bulto|caja|fardo|a\s+partir\s+de)\b/i;
const WHOLESALE_PRODUCT_RE = /\b(bulto|caja|fardo|saco|paleta)\b/i;

function parsePositivePrice(value: string | number): number | null {
  const num =
    typeof value === "number" ? value : Number.parseFloat(value.trim());
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function selectRetailVariant(
  product: ShopifyProduct
): ShopifyVariant | null {
  const validVariants = product.variants.filter(
    (v) => parsePositivePrice(v.price) !== null
  );
  if (validVariants.length === 0) return null;

  const retailTagged = validVariants.filter((v) =>
    RETAIL_VARIANT_RE.test(v.title)
  );
  if (retailTagged.length > 0) {
    return (
      retailTagged.find((v) => v.available !== false) ?? retailTagged[0]
    );
  }

  if (WHOLESALE_PRODUCT_RE.test(product.title)) {
    return null;
  }

  const nonWholesale = validVariants.filter(
    (v) => !WHOLESALE_VARIANT_RE.test(v.title)
  );
  if (nonWholesale.length === 0) {
    return null;
  }

  return nonWholesale.find((v) => v.available !== false) ?? nonWholesale[0];
}

export interface ShopifyCatalogConnectorOptions {
  retailerSlug: string;
  baseUrl: string;
  region: string;
  currency?: "USD" | "VES";
  maxPages?: number;
  fetchFn?: typeof fetch;
}

export class ShopifyCatalogConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly region: string;
  private readonly currency: "USD" | "VES";
  private readonly maxPages: number;
  private readonly fetchFn: typeof fetch;
  private cachedCatalog: ShopifyProduct[] | null = null;

  constructor(options: ShopifyCatalogConnectorOptions) {
    this.retailerSlug = options.retailerSlug;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.region = options.region;
    this.currency = options.currency ?? "USD";
    this.maxPages = options.maxPages ?? 5;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async loadCatalog(signal?: AbortSignal): Promise<ShopifyProduct[]> {
    if (this.cachedCatalog !== null) {
      return this.cachedCatalog;
    }

    const collected: ShopifyProduct[] = [];
    for (let page = 1; page <= this.maxPages; page++) {
      signal?.throwIfAborted();
      const endpoint = `${this.baseUrl}/collections/all/products.json?limit=250&page=${page}`;
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
          `Shopify catalog returned HTTP ${response.status}`
        );
      }

      const parsed = shopifyProductsPageSchema.parse(await response.json());
      collected.push(...parsed.products);
      if (parsed.products.length < 250) {
        break;
      }
    }

    this.cachedCatalog = collected;
    return collected;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const catalog = await this.loadCatalog(signal);
    const queryTokens = tokenizeNormalized(query);
    if (queryTokens.length === 0) return [];

    const observedAt = new Date();
    const results: RawRetailProduct[] = [];

    for (const product of catalog) {
      const normalizedTitle = normalizeText(product.title);
      if (!queryTokens.every((token) => normalizedTitle.includes(token))) {
        continue;
      }

      const variant = selectRetailVariant(product);
      if (!variant) continue;

      const amount = parsePositivePrice(variant.price);
      if (amount === null) continue;

      results.push({
        externalSku: variant.sku?.trim() || String(variant.id),
        barcode: null,
        rawTitle: product.title.trim(),
        originalAmount: amount,
        originalCurrency: this.currency,
        inStock: variant.available !== false,
        storeAvailabilityCount: null,
        productUrl: `${this.baseUrl}/products/${product.handle}`,
        imageUrl: product.images?.[0]?.src ?? null,
        region: this.region,
        observedAt,
      });
    }

    return results;
  }
}
