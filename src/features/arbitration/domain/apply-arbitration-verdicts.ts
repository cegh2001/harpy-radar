import type { BasketObservationInput } from "@/features/basket/domain/basket-types";
import { MIN_MULTIPLIER_CONFIDENCE } from "./arbiter-policy";
import {
  buildArbitrationCacheKey,
  type CachedSkuVerdict,
} from "./arbiter-schemas";

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Applies cached SKU arbitration verdicts to raw basket observations in memory:
 * drops confirmed invalid matches, tags product tier/reason, and adjusts
 * unparsed multipack package multipliers when confidence is high.
 */
export function applyArbitrationVerdictsToObservations(
  observations: readonly BasketObservationInput[],
  slugByProductId: ReadonlyMap<number, string>,
  verdictsByKey: ReadonlyMap<string, CachedSkuVerdict>
): BasketObservationInput[] {
  if (verdictsByKey.size === 0) {
    return [...observations];
  }

  const result: BasketObservationInput[] = [];

  for (const obs of observations) {
    const canonicalSlug = slugByProductId.get(obs.canonicalProductId);
    if (!canonicalSlug) {
      result.push(obs);
      continue;
    }

    const cacheKey = buildArbitrationCacheKey(canonicalSlug, obs.rawTitle);
    const verdict = verdictsByKey.get(cacheKey);
    if (!verdict) {
      result.push(obs);
      continue;
    }

    if (!verdict.isValidMatch) {
      continue;
    }

    const isAlreadyParsedUnitPack =
      obs.packageUnit === "unit" &&
      obs.packageSize > 1 &&
      verdict.effectivePackageMultiplier > 1;

    const shouldScaleMultiplier =
      !isAlreadyParsedUnitPack &&
      verdict.confidence >= MIN_MULTIPLIER_CONFIDENCE &&
      Math.abs(verdict.effectivePackageMultiplier - 1) > 0.01;

    if (!shouldScaleMultiplier) {
      result.push({
        ...obs,
        productTier: verdict.tier,
        arbitrationReason: verdict.reason,
      });
      continue;
    }

    const adjustedSize = round4(
      obs.packageSize * verdict.effectivePackageMultiplier
    );
    const adjustedUnitUsd =
      adjustedSize > 0
        ? round4(obs.priceUsdBcv / adjustedSize)
        : obs.normalizedUnitPriceUsd;

    result.push({
      ...obs,
      packageSize: adjustedSize > 0 ? adjustedSize : obs.packageSize,
      normalizedUnitPriceUsd: adjustedUnitUsd,
      productTier: verdict.tier,
      arbitrationReason: verdict.reason,
    });
  }

  return result;
}
