import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeText } from "@/features/catalog/domain/unit-normalizer";

export const productTierSchema = z.enum([
  "basic",
  "standard",
  "premium_imported",
]);

export type ProductTier = z.infer<typeof productTierSchema>;

export const skuArbitrationVerdictSchema = z.object({
  isValidMatch: z.boolean(),
  tier: productTierSchema,
  effectivePackageMultiplier: z.number().finite().min(0.05).max(50),
  confidence: z.number().finite().min(0).max(1),
  reason: z.string().trim().min(3).max(400),
});

export type SkuArbitrationVerdict = z.infer<
  typeof skuArbitrationVerdictSchema
>;

export const anomalyCauseSchema = z.enum([
  "brand_tier",
  "package_mismatch",
  "retailer_outlier",
  "mixed",
]);

export type AnomalyCause = z.infer<typeof anomalyCauseSchema>;

export const anomalyDigestHighlightSchema = z.object({
  canonicalSlug: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  spreadPct: z.number().finite(),
  primaryCause: anomalyCauseSchema,
  explanation: z.string().trim().min(5).max(320),
});

export type AnomalyDigestHighlight = z.infer<
  typeof anomalyDigestHighlightSchema
>;

export const anomalyDigestOutputSchema = z.object({
  headline: z.string().trim().min(5).max(160),
  summary: z.string().trim().min(10).max(600),
  highlights: z.array(anomalyDigestHighlightSchema).max(8),
});

export type AnomalyDigestOutput = z.infer<typeof anomalyDigestOutputSchema>;

export interface CachedSkuVerdict extends SkuArbitrationVerdict {
  canonicalSlug: string;
  normalizedTitleHash: string;
  sampleRawTitle: string;
  modelUsed: string;
  arbitratedDate: string;
  expiresAt: Date;
}

export interface DailyAnomalyDigestDto {
  digestDate: string;
  headline: string;
  summary: string;
  highlights: AnomalyDigestHighlight[];
  flaggedProductsCount: number;
  outlierOffersCount: number;
  modelUsed: string;
  createdAt: string;
}

/**
 * Computes a stable SHA-256 hex digest of a normalized product title for cache indexing.
 */
export function buildNormalizedTitleHash(rawTitle: string): string {
  const normalized = normalizeText(rawTitle) || rawTitle.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Builds the composite cache lookup key for a canonical slug and raw retailer title.
 */
export function buildArbitrationCacheKey(
  canonicalSlug: string,
  rawTitle: string
): string {
  return `${canonicalSlug}:${buildNormalizedTitleHash(rawTitle)}`;
}
