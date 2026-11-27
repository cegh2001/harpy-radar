import { getCaracasDateKey } from "@/shared/lib/date/caracas-date";
import { mapObservationRow } from "@/features/basket/application/get-dashboard-snapshot";
import {
  computeBasketIndex,
  type BasketProductInput,
  type ProductPriceSummary,
} from "@/features/basket/domain/basket-index";
import type { CatalogProductRecord } from "@/features/catalog/infrastructure/catalog-repository";
import type { LatestObservationJoined } from "@/features/retailers/infrastructure/price-repository";
import { applyArbitrationVerdictsToObservations } from "../domain/apply-arbitration-verdicts";
import {
  computeRemainingDailyBudget,
  selectArbitrationCandidates,
  selectTopAnomalyProducts,
  type ArbitrationCandidate,
} from "../domain/arbiter-policy";
import type {
  AnomalyDigestOutput,
  CachedSkuVerdict,
  SkuArbitrationVerdict,
} from "../domain/arbiter-schemas";
import type { ArbitrationRepositoryPort } from "../infrastructure/arbitration-repository";
import type { GeminiStructuredResult } from "../infrastructure/gemini-arbiter-client";

export interface RunArbitrationCycleDeps {
  enabled: boolean;
  apiKey: string | undefined;
  maxDailyCalls: number;
  cacheTtlDays: number;
  forceDigest?: boolean;
  now?: Date;
  getCatalog: () => Promise<CatalogProductRecord[]>;
  getLatestObservations: () => Promise<LatestObservationJoined[]>;
  arbitrationRepo: ArbitrationRepositoryPort;
  arbitrateSku: (
    candidate: ArbitrationCandidate,
    signal?: AbortSignal
  ) => Promise<GeminiStructuredResult<SkuArbitrationVerdict>>;
  generateDigest: (
    input: {
      digestDate: string;
      topProducts: readonly ProductPriceSummary[];
      flaggedProductsCount: number;
      outlierOffersCount: number;
    },
    signal?: AbortSignal
  ) => Promise<GeminiStructuredResult<AnomalyDigestOutput>>;
}

export interface ArbitrationCycleSummary {
  status: "completed" | "partial" | "skipped";
  reason?: string;
  candidatesEvaluated: number;
  arbitratedCount: number;
  rejectedMatchesCount: number;
  budgetRemaining: number;
  digestGenerated: boolean;
  errors: string[];
}

export async function runArbitrationCycle(
  deps: RunArbitrationCycleDeps,
  signal?: AbortSignal
): Promise<ArbitrationCycleSummary> {
  if (!deps.enabled) {
    return {
      status: "skipped",
      reason: "ARBITER_ENABLED is false",
      candidatesEvaluated: 0,
      arbitratedCount: 0,
      rejectedMatchesCount: 0,
      budgetRemaining: 0,
      digestGenerated: false,
      errors: [],
    };
  }

  if (!deps.apiKey) {
    return {
      status: "skipped",
      reason: "GEMINI_API_KEY is not configured",
      candidatesEvaluated: 0,
      arbitratedCount: 0,
      rejectedMatchesCount: 0,
      budgetRemaining: 0,
      digestGenerated: false,
      errors: [],
    };
  }

  const now = deps.now ?? new Date();
  const todayKey = getCaracasDateKey(now);
  const expiresAt = new Date(
    now.getTime() + deps.cacheTtlDays * 24 * 60 * 60 * 1000
  );

  const [catalog, rawObservations] = await Promise.all([
    deps.getCatalog(),
    deps.getLatestObservations(),
  ]);

  const slugs = catalog.map((item) => item.slug);
  const slugByProductId = new Map(catalog.map((item) => [item.id, item.slug]));
  const [verdictsByKey, usedToday] = await Promise.all([
    deps.arbitrationRepo.getActiveVerdictsBySlugs(slugs, now),
    deps.arbitrationRepo.countArbitrationsForDate(todayKey),
  ]);

  const products: BasketProductInput[] = catalog;
  const baseObservations = rawObservations.map(mapObservationRow);
  const preApplied = applyArbitrationVerdictsToObservations(
    baseObservations,
    slugByProductId,
    verdictsByKey
  );
  const initialBasket = computeBasketIndex(products, preApplied, null);

  const remainingBudget = computeRemainingDailyBudget(
    usedToday,
    deps.maxDailyCalls
  );
  const candidates = selectArbitrationCandidates(
    initialBasket.products,
    new Set(verdictsByKey.keys()),
    remainingBudget
  );

  const errors: string[] = [];
  let arbitratedCount = 0;
  let rejectedMatchesCount = 0;

  for (const candidate of candidates) {
    signal?.throwIfAborted();
    try {
      const result = await deps.arbitrateSku(candidate, signal);
      const verdict = result.data;
      await deps.arbitrationRepo.upsertVerdict({
        canonicalSlug: candidate.canonicalSlug,
        normalizedTitleHash: candidate.normalizedTitleHash,
        sampleRawTitle: candidate.rawTitle,
        isValidMatch: verdict.isValidMatch,
        tier: verdict.tier,
        effectivePackageMultiplier: verdict.effectivePackageMultiplier,
        confidence: verdict.confidence,
        reason: verdict.reason,
        modelUsed: result.modelUsed,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
        arbitratedDate: todayKey,
        expiresAt,
      });

      const cached: CachedSkuVerdict = {
        ...verdict,
        canonicalSlug: candidate.canonicalSlug,
        normalizedTitleHash: candidate.normalizedTitleHash,
        sampleRawTitle: candidate.rawTitle,
        modelUsed: result.modelUsed,
        arbitratedDate: todayKey,
        expiresAt,
      };
      verdictsByKey.set(candidate.cacheKey, cached);
      arbitratedCount += 1;
      if (!verdict.isValidMatch) {
        rejectedMatchesCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`sku "${candidate.cacheKey}": ${message}`);
    }
  }

  const refreshedObservations = applyArbitrationVerdictsToObservations(
    baseObservations,
    slugByProductId,
    verdictsByKey
  );
  const refreshedBasket = computeBasketIndex(
    products,
    refreshedObservations,
    null
  );

  let digestGenerated = false;
  const existingDigest = await deps.arbitrationRepo.getDigestForDate(todayKey);
  if (!existingDigest || deps.forceDigest) {
    const topProducts = selectTopAnomalyProducts(refreshedBasket.products, 6);
    if (topProducts.length > 0) {
      try {
        const digestResult = await deps.generateDigest(
          {
            digestDate: todayKey,
            topProducts,
            flaggedProductsCount: refreshedBasket.flaggedProductsCount,
            outlierOffersCount: refreshedBasket.outlierOffersCount,
          },
          signal
        );
        await deps.arbitrationRepo.saveDigest({
          digestDate: todayKey,
          headline: digestResult.data.headline,
          summary: digestResult.data.summary,
          highlights: digestResult.data.highlights,
          flaggedProductsCount: refreshedBasket.flaggedProductsCount,
          outlierOffersCount: refreshedBasket.outlierOffersCount,
          modelUsed: digestResult.modelUsed,
          promptTokens: digestResult.promptTokens,
          outputTokens: digestResult.outputTokens,
        });
        digestGenerated = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`digest "${todayKey}": ${message}`);
      }
    }
  }

  return {
    status: errors.length > 0 ? "partial" : "completed",
    candidatesEvaluated: candidates.length,
    arbitratedCount,
    rejectedMatchesCount,
    budgetRemaining: Math.max(0, remainingBudget - arbitratedCount),
    digestGenerated,
    errors,
  };
}
