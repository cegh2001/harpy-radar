import { createHash } from "node:crypto";

export interface RawRetailProduct {
  externalSku: string;
  barcode: string | null;
  rawTitle: string;
  originalAmount: number;
  originalCurrency: "USD" | "VES";
  inStock: boolean;
  storeAvailabilityCount: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  region: string;
  observedAt: Date;
}

export interface RetailerConnector {
  readonly retailerSlug: string;
  searchProducts(
    query: string,
    signal?: AbortSignal
  ): Promise<RawRetailProduct[]>;
}

export class RetailerUpstreamError extends Error {
  constructor(
    public readonly retailerSlug: string,
    public readonly statusCode: number | null,
    message: string
  ) {
    super(`[${retailerSlug}] ${message}`);
    this.name = "RetailerUpstreamError";
  }
}

export function buildObservationContentHash(input: {
  retailerSlug: string;
  externalSku: string;
  originalAmount: number;
  originalCurrency: "USD" | "VES";
  inStock: boolean;
}): string {
  const payload = [
    input.retailerSlug,
    input.externalSku,
    input.originalAmount.toFixed(4),
    input.originalCurrency,
    input.inStock ? "1" : "0",
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}
