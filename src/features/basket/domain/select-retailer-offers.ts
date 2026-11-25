import type {
  BasketObservationInput,
  RetailerOfferOption,
} from "./basket-types";

export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

export type { RetailerOfferOption };

export interface SelectedRetailerOffer {
  representative: BasketObservationInput;
  matchedSkuCount: number;
  alternatives: RetailerOfferOption[];
}

function isHighConfidence(obs: BasketObservationInput): boolean {
  return (obs.matchConfidence ?? 1) >= HIGH_CONFIDENCE_THRESHOLD;
}

export function compareRetailerCandidates(
  a: BasketObservationInput,
  b: BasketObservationInput
): number {
  if (a.inStock !== b.inStock) {
    return a.inStock ? -1 : 1;
  }

  const aHigh = isHighConfidence(a);
  const bHigh = isHighConfidence(b);
  if (aHigh !== bHigh) {
    return aHigh ? -1 : 1;
  }

  if (a.normalizedUnitPriceUsd !== b.normalizedUnitPriceUsd) {
    return a.normalizedUnitPriceUsd - b.normalizedUnitPriceUsd;
  }

  const confDiff = (b.matchConfidence ?? 1) - (a.matchConfidence ?? 1);
  if (confDiff !== 0) {
    return confDiff;
  }

  return b.observedAt.getTime() - a.observedAt.getTime();
}

function toOfferOption(obs: BasketObservationInput): RetailerOfferOption {
  return {
    externalSku: obs.externalSku ?? null,
    rawTitle: obs.rawTitle,
    originalAmount: obs.originalAmount,
    originalCurrency: obs.originalCurrency,
    priceUsdBcv: obs.priceUsdBcv,
    priceVes: obs.priceVes,
    priceUsdParallel: obs.priceUsdParallel,
    packageSize: obs.packageSize,
    packageUnit: obs.packageUnit,
    normalizedUnitPriceUsd: obs.normalizedUnitPriceUsd,
    inStock: obs.inStock,
    matchConfidence: obs.matchConfidence ?? 1,
    storeAvailabilityCount: obs.storeAvailabilityCount,
    productUrl: obs.productUrl,
    region: obs.region,
    observedAt: obs.observedAt.toISOString(),
  };
}

function deduplicateRetailerSkus(
  observations: BasketObservationInput[]
): BasketObservationInput[] {
  const bySku = new Map<string, BasketObservationInput>();
  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i];
    const key = obs.externalSku?.trim()
      ? `sku:${obs.externalSku.trim()}`
      : `anon:${i}:${obs.rawTitle}:${obs.packageSize}`;
    const existing = bySku.get(key);
    if (
      !existing ||
      obs.observedAt.getTime() > existing.observedAt.getTime()
    ) {
      bySku.set(key, obs);
    }
  }
  return Array.from(bySku.values());
}

export function selectRetailerOffers(
  observations: BasketObservationInput[],
  includeAlternatives = false
): SelectedRetailerOffer[] {
  const byRetailer = new Map<string, BasketObservationInput[]>();
  for (const obs of observations) {
    const list = byRetailer.get(obs.retailerSlug) ?? [];
    list.push(obs);
    byRetailer.set(obs.retailerSlug, list);
  }

  const selected: SelectedRetailerOffer[] = [];
  for (const group of byRetailer.values()) {
    const uniqueSkus = deduplicateRetailerSkus(group);
    uniqueSkus.sort(compareRetailerCandidates);
    const representative = uniqueSkus[0];
    if (!representative) continue;

    selected.push({
      representative,
      matchedSkuCount: uniqueSkus.length,
      alternatives: includeAlternatives
        ? uniqueSkus.slice(1).map(toOfferOption)
        : [],
    });
  }

  return selected.sort((a, b) => {
    if (a.representative.inStock !== b.representative.inStock) {
      return a.representative.inStock ? -1 : 1;
    }
    if (
      a.representative.normalizedUnitPriceUsd !==
      b.representative.normalizedUnitPriceUsd
    ) {
      return (
        a.representative.normalizedUnitPriceUsd -
        b.representative.normalizedUnitPriceUsd
      );
    }
    return (
      b.representative.observedAt.getTime() -
      a.representative.observedAt.getTime()
    );
  });
}
