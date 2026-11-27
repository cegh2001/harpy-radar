import type { ProductPriceSummary } from "@/features/basket/domain/basket-index";
import type { OutlierStatus } from "@/features/basket/domain/dispersion-outliers";
import type { BaseUnit } from "@/features/catalog/domain/canonical-basket";
import {
  buildArbitrationCacheKey,
  buildNormalizedTitleHash,
} from "./arbiter-schemas";

export const LOW_CONFIDENCE_ARBITRATION_THRESHOLD = 0.85;
export const MIN_MULTIPLIER_CONFIDENCE = 0.8;

export const DEFAULT_ARBITER_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
] as const;

export const DEFAULT_DIGEST_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
] as const;

export interface ModelRequestProfile {
  disableThinking: boolean;
}

export interface ArbitrationCandidate {
  canonicalSlug: string;
  canonicalName: string;
  baseUnit: BaseUnit;
  medianUnitUsdBcv: number | null;
  spreadPct: number | null;
  retailerSlug: string;
  retailerName: string;
  rawTitle: string;
  normalizedTitleHash: string;
  cacheKey: string;
  packageSize: number;
  packageUnit: BaseUnit;
  priceUsdBcv: number;
  normalizedUnitPriceUsd: number;
  matchConfidence: number;
  outlierStatus: OutlierStatus;
  priority: number;
}

/**
 * Parses a comma-separated model cascade list, deduplicating while preserving order.
 */
export function parseModelCascade(
  raw: string | undefined,
  fallback: readonly string[]
): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique : [...fallback];
}

/**
 * Determines model-specific Gemini generationConfig behavior.
 * flash-lite models reject thinkingConfig (400), whereas 2.5/3.x flash models
 * require thinkingBudget: 0 so thinking tokens do not truncate JSON responses.
 */
export function getModelRequestProfile(model: string): ModelRequestProfile {
  const lower = model.trim().toLowerCase();
  if (lower.includes("flash-lite")) {
    return { disableThinking: false };
  }
  if (/^gemini-(2\.5|3\.\d+)-flash/.test(lower)) {
    return { disableThinking: true };
  }
  return { disableThinking: false };
}

/**
 * Computes remaining daily Gemini call budget.
 */
export function computeRemainingDailyBudget(
  usedToday: number,
  maxDailyCalls: number
): number {
  return Math.max(0, maxDailyCalls - Math.max(0, usedToday));
}

/**
 * Selects uncached SKU candidates from flagged or low-confidence products,
 * ordered by arbitration priority and price dispersion.
 */
export function selectArbitrationCandidates(
  products: readonly ProductPriceSummary[],
  cachedKeys: ReadonlySet<string>,
  maxCandidates: number
): ArbitrationCandidate[] {
  if (maxCandidates <= 0) return [];

  const byCacheKey = new Map<string, ArbitrationCandidate>();

  for (const product of products) {
    const hasLowConfidence = product.retailers.some(
      (r) => r.matchConfidence < LOW_CONFIDENCE_ARBITRATION_THRESHOLD
    );
    if (!product.needsArbitration && !hasLowConfidence) {
      continue;
    }

    let lowestUnit = Infinity;
    let highestUnit = -Infinity;
    if (product.needsArbitration && product.retailers.length >= 2) {
      for (const r of product.retailers) {
        if (r.normalizedUnitPriceUsd < lowestUnit) {
          lowestUnit = r.normalizedUnitPriceUsd;
        }
        if (r.normalizedUnitPriceUsd > highestUnit) {
          highestUnit = r.normalizedUnitPriceUsd;
        }
      }
    }

    for (const retailer of product.retailers) {
      const isOutlier = retailer.outlierStatus !== "normal";
      const isLowConfidence =
        retailer.matchConfidence < LOW_CONFIDENCE_ARBITRATION_THRESHOLD;
      const isSpreadTail =
        product.needsArbitration &&
        product.retailers.length >= 2 &&
        (retailer.normalizedUnitPriceUsd === lowestUnit ||
          retailer.normalizedUnitPriceUsd === highestUnit);

      if (!isOutlier && !isLowConfidence && !isSpreadTail) {
        continue;
      }

      const priority = isOutlier ? 3 : isLowConfidence ? 2 : 1;
      const cacheKey = buildArbitrationCacheKey(product.slug, retailer.rawTitle);
      if (cachedKeys.has(cacheKey)) {
        continue;
      }

      const existing = byCacheKey.get(cacheKey);
      if (existing && existing.priority >= priority) {
        continue;
      }

      byCacheKey.set(cacheKey, {
        canonicalSlug: product.slug,
        canonicalName: product.name,
        baseUnit: product.baseUnit,
        medianUnitUsdBcv: product.medianUnitUsdBcv,
        spreadPct: product.spreadPct,
        retailerSlug: retailer.retailerSlug,
        retailerName: retailer.retailerName,
        rawTitle: retailer.rawTitle,
        normalizedTitleHash: buildNormalizedTitleHash(retailer.rawTitle),
        cacheKey,
        packageSize: retailer.packageSize,
        packageUnit: retailer.packageUnit,
        priceUsdBcv: retailer.priceUsdBcv,
        normalizedUnitPriceUsd: retailer.normalizedUnitPriceUsd,
        matchConfidence: retailer.matchConfidence,
        outlierStatus: retailer.outlierStatus,
        priority,
      });
    }
  }

  return Array.from(byCacheKey.values())
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const spreadDiff = (b.spreadPct ?? 0) - (a.spreadPct ?? 0);
      if (spreadDiff !== 0) return spreadDiff;
      return b.normalizedUnitPriceUsd - a.normalizedUnitPriceUsd;
    })
    .slice(0, maxCandidates);
}

/**
 * Selects the top products with widest cross-retailer price dispersion for the daily digest.
 */
export function selectTopAnomalyProducts(
  products: readonly ProductPriceSummary[],
  limit = 6
): ProductPriceSummary[] {
  return products
    .filter(
      (product) =>
        product.retailerCount >= 2 &&
        (product.needsArbitration ||
          (product.spreadPct !== null && product.spreadPct >= 50))
    )
    .sort((a, b) => (b.spreadPct ?? 0) - (a.spreadPct ?? 0))
    .slice(0, limit);
}
