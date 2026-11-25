import { z } from "zod";
import {
  RetailerUpstreamError,
  type RawRetailProduct,
  type RetailerConnector,
} from "../../domain/retailer-connector";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const vtexOfferSchema = z.object({
  Price: z.number().nullable().optional(),
  ListPrice: z.number().nullable().optional(),
  IsAvailable: z.boolean().nullable().optional(),
  AvailableQuantity: z.number().nullable().optional(),
});

const vtexSellerSchema = z.object({
  sellerDefault: z.boolean().optional(),
  commertialOffer: vtexOfferSchema.optional(),
});

const vtexItemSchema = z.object({
  itemId: z.union([z.string(), z.number()]),
  name: z.string().nullable().optional(),
  nameComplete: z.string().nullable().optional(),
  ean: z.string().nullable().optional(),
  images: z
    .array(
      z.object({
        imageUrl: z.string(),
      })
    )
    .optional(),
  sellers: z.array(vtexSellerSchema).optional(),
});

const vtexProductSchema = z.object({
  productId: z.union([z.string(), z.number()]),
  productName: z.string().min(1),
  brand: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  linkText: z.string().nullable().optional(),
  items: z.array(vtexItemSchema).optional(),
});

const vtexResponseSchema = z.array(vtexProductSchema);

type VtexItem = z.infer<typeof vtexItemSchema>;
type VtexOffer = z.infer<typeof vtexOfferSchema>;

export interface VtexCatalogConnectorOptions {
  retailerSlug: string;
  baseUrl: string;
  region: string;
  currency: "USD" | "VES";
  maxResults?: number;
  fetchFn?: typeof fetch;
}

function isOfferInStock(offer: VtexOffer): boolean {
  if (offer.IsAvailable === true) return true;
  if (offer.IsAvailable === false) return false;
  return (offer.AvailableQuantity ?? 0) > 0;
}

function pickBestOfferForItem(item: VtexItem): VtexOffer | null {
  const validOffers = (item.sellers ?? [])
    .map((seller) => ({
      sellerDefault: seller.sellerDefault === true,
      offer: seller.commertialOffer,
    }))
    .filter(
      (entry): entry is { sellerDefault: boolean; offer: VtexOffer } =>
        entry.offer !== undefined &&
        typeof entry.offer.Price === "number" &&
        Number.isFinite(entry.offer.Price) &&
        entry.offer.Price > 0
    );

  if (validOffers.length === 0) return null;

  const defaultOffer = validOffers.find((entry) => entry.sellerDefault);
  if (defaultOffer) return defaultOffer.offer;

  const availableOffer = validOffers.find((entry) =>
    isOfferInStock(entry.offer)
  );
  return (availableOffer ?? validOffers[0]).offer;
}

function pickBestItem(
  items: VtexItem[] | undefined
): { item: VtexItem; offer: VtexOffer } | null {
  if (!items || items.length === 0) return null;

  const candidates = items
    .map((item) => {
      const offer = pickBestOfferForItem(item);
      return offer ? { item, offer } : null;
    })
    .filter(
      (entry): entry is { item: VtexItem; offer: VtexOffer } => entry !== null
    );

  if (candidates.length === 0) return null;

  return (
    candidates.find((candidate) => isOfferInStock(candidate.offer)) ??
    candidates[0]
  );
}

export class VtexCatalogConnector implements RetailerConnector {
  readonly retailerSlug: string;
  private readonly baseUrl: string;
  private readonly region: string;
  private readonly currency: "USD" | "VES";
  private readonly maxResults: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: VtexCatalogConnectorOptions) {
    this.retailerSlug = options.retailerSlug;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.region = options.region;
    this.currency = options.currency;
    this.maxResults = options.maxResults ?? 12;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]> {
    const toIndex = Math.max(0, this.maxResults - 1);
    const endpoint = `${this.baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=${toIndex}`;

    const response = await this.fetchFn(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal,
    });

    if (!response.ok) {
      throw new RetailerUpstreamError(
        this.retailerSlug,
        response.status,
        `VTEX catalog search returned HTTP ${response.status}`
      );
    }

    const payload = vtexResponseSchema.parse(await response.json());
    const observedAt = new Date();

    return payload
      .map((product): RawRetailProduct | null => {
        const picked = pickBestItem(product.items);
        if (!picked) return null;

        const { item, offer } = picked;
        const amount = offer.Price;
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
          return null;
        }

        const rawTitle = (item.nameComplete || product.productName)
          .replace(/\s+/g, " ")
          .trim();
        if (!rawTitle) return null;

        const productUrl =
          product.link?.trim() ||
          (product.linkText?.trim()
            ? `${this.baseUrl}/${product.linkText.trim()}/p`
            : `${this.baseUrl}/`);

        const availableQty = offer.AvailableQuantity;
        const storeAvailabilityCount =
          typeof availableQty === "number" &&
          Number.isFinite(availableQty) &&
          availableQty >= 0
            ? availableQty
            : null;

        return {
          externalSku: String(item.itemId || product.productId),
          barcode: item.ean?.trim() || null,
          rawTitle,
          originalAmount: amount,
          originalCurrency: this.currency,
          inStock: isOfferInStock(offer),
          storeAvailabilityCount,
          productUrl,
          imageUrl: item.images?.[0]?.imageUrl?.trim() || null,
          region: this.region,
          observedAt,
        };
      })
      .filter((item): item is RawRetailProduct => item !== null);
  }
}
