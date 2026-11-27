import type { BasketCategory } from "@/features/catalog/domain/canonical-basket";
import type {
  BasketIndexSummary,
  BasketObservationInput,
  BasketProductInput,
  BenchmarkReferenceInput,
  CategorySubtotal,
  ProductPriceSummary,
  RetailerOfferOption,
  RetailerPriceBreakdown,
} from "./basket-types";
import {
  analyzePriceDispersion,
  classifySinglePriceAgainstReference,
  computeMedian,
  type OutlierStatus,
} from "./dispersion-outliers";
import {
  selectRetailerOffers,
  type SelectedRetailerOffer,
} from "./select-retailer-offers";

export type {
  BasketIndexSummary,
  BasketObservationInput,
  BasketProductInput,
  BenchmarkReferenceInput,
  CategorySubtotal,
  OutlierStatus,
  ProductPriceSummary,
  RetailerOfferOption,
  RetailerPriceBreakdown,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function computeAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeUnitParallel(obs: BasketObservationInput): number | null {
  return obs.priceUsdParallel !== null
    ? round4(obs.priceUsdParallel / obs.packageSize)
    : null;
}

interface ParallelAccumulator {
  sum: number;
  complete: boolean;
}

function addParallelSample(
  acc: ParallelAccumulator,
  unitPrice: number | null,
  qty: number
): void {
  if (unitPrice !== null) acc.sum += unitPrice * qty;
  else acc.complete = false;
}

function finalizeParallel(
  coveredProductsCount: number,
  acc: ParallelAccumulator
): number | null {
  return coveredProductsCount > 0 && acc.complete ? round2(acc.sum) : null;
}

function toRetailerBreakdown(
  entry: SelectedRetailerOffer,
  minUnit: number,
  outlierStatus: OutlierStatus,
  deviationFromMedianPct: number | null
): RetailerPriceBreakdown {
  const obs = entry.representative;
  const deltaVsCheapestPct =
    minUnit > 0
      ? round2(((obs.normalizedUnitPriceUsd - minUnit) / minUnit) * 100)
      : null;

  return {
    retailerSlug: obs.retailerSlug,
    retailerName: obs.retailerName,
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
    productTier: obs.productTier ?? null,
    arbitrationReason: obs.arbitrationReason ?? null,
    matchedSkuCount: entry.matchedSkuCount,
    deltaVsCheapestPct,
    outlierStatus,
    deviationFromMedianPct,
    alternatives: entry.alternatives,
    storeAvailabilityCount: obs.storeAvailabilityCount,
    productUrl: obs.productUrl,
    region: obs.region,
    observedAt: obs.observedAt.toISOString(),
  };
}

export function filterObservationsByRegion(
  observations: BasketObservationInput[],
  region: string
): BasketObservationInput[] {
  if (!region || region === "all") return observations;
  const normalized = region.trim().toLowerCase();
  return observations.filter((obs) =>
    obs.region.toLowerCase().includes(normalized)
  );
}

export function computeProductSummary(
  product: BasketProductInput,
  observations: BasketObservationInput[],
  options?: { includeAlternatives?: boolean }
): ProductPriceSummary {
  const productObs = observations.filter(
    (obs) => obs.canonicalProductId === product.id
  );
  const selectedOffers = selectRetailerOffers(
    productObs,
    options?.includeAlternatives ?? false
  );

  if (selectedOffers.length === 0) {
    return {
      ...product,
      cheapestUnitUsdBcv: null,
      averageUnitUsdBcv: null,
      medianUnitUsdBcv: null,
      cheapestUnitVes: null,
      averageUnitVes: null,
      cheapestUnitUsdParallel: null,
      averageUnitUsdParallel: null,
      cheapestRetailerName: null,
      cheapestRetailerSlug: null,
      robustCheapestUnitUsdBcv: null,
      robustCheapestUnitVes: null,
      robustCheapestUnitUsdParallel: null,
      robustCheapestRetailerName: null,
      robustCheapestRetailerSlug: null,
      spreadPct: null,
      robustSpreadPct: null,
      outlierCount: 0,
      needsArbitration: false,
      monthlyContributionUsdBcv: null,
      robustMonthlyContributionUsdBcv: null,
      inStockAny: false,
      retailerCount: 0,
      retailers: [],
    };
  }

  const representatives = selectedOffers.map((offer) => offer.representative);
  const inStockList = representatives.filter((obs) => obs.inStock);
  const pricingPool = inStockList.length > 0 ? inStockList : representatives;

  const cheapest = pricingPool[0];
  const poolPrices = pricingPool.map((obs) => obs.normalizedUnitPriceUsd);
  const dispersion = analyzePriceDispersion(poolPrices);
  const normalPoolIdx = dispersion.classifications.findIndex(
    (entry) => entry.status === "normal"
  );
  const robustCheapest = normalPoolIdx >= 0 ? pricingPool[normalPoolIdx] : cheapest;
  const poolIndexByObs = new Map(pricingPool.map((obs, idx) => [obs, idx]));

  const unitPrices = [...poolPrices].sort((a, b) => a - b);
  const minUnit = unitPrices[0];
  const parallelUnits = pricingPool
    .filter((obs) => obs.priceUsdParallel !== null)
    .map((obs) => (obs.priceUsdParallel as number) / obs.packageSize);

  return {
    ...product,
    cheapestUnitUsdBcv: cheapest.normalizedUnitPriceUsd,
    averageUnitUsdBcv: round4(computeAverage(unitPrices)),
    medianUnitUsdBcv: round4(computeMedian(unitPrices)),
    cheapestUnitVes: round4(cheapest.priceVes / cheapest.packageSize),
    averageUnitVes: round4(
      computeAverage(pricingPool.map((obs) => obs.priceVes / obs.packageSize))
    ),
    cheapestUnitUsdParallel: computeUnitParallel(cheapest),
    averageUnitUsdParallel:
      parallelUnits.length > 0 ? round4(computeAverage(parallelUnits)) : null,
    cheapestRetailerName: cheapest.retailerName,
    cheapestRetailerSlug: cheapest.retailerSlug,
    robustCheapestUnitUsdBcv: robustCheapest.normalizedUnitPriceUsd,
    robustCheapestUnitVes: round4(robustCheapest.priceVes / robustCheapest.packageSize),
    robustCheapestUnitUsdParallel: computeUnitParallel(robustCheapest),
    robustCheapestRetailerName: robustCheapest.retailerName,
    robustCheapestRetailerSlug: robustCheapest.retailerSlug,
    spreadPct: dispersion.rawSpreadPct,
    robustSpreadPct: dispersion.robustSpreadPct,
    outlierCount: dispersion.outlierCount,
    needsArbitration: dispersion.needsArbitration,
    monthlyContributionUsdBcv: round2(cheapest.normalizedUnitPriceUsd * product.basketMonthlyQty),
    robustMonthlyContributionUsdBcv: round2(
      robustCheapest.normalizedUnitPriceUsd * product.basketMonthlyQty
    ),
    inStockAny: inStockList.length > 0,
    retailerCount: selectedOffers.length,
    retailers: selectedOffers.map((entry) => {
      const obs = entry.representative;
      const poolIdx = poolIndexByObs.get(obs);
      const outlierInfo =
        poolIdx !== undefined
          ? dispersion.classifications[poolIdx]
          : classifySinglePriceAgainstReference(
              obs.normalizedUnitPriceUsd,
              dispersion.median,
              dispersion.mad,
              pricingPool.length
            );
      return toRetailerBreakdown(
        entry,
        minUnit,
        outlierInfo.status,
        outlierInfo.deviationFromMedianPct
      );
    }),
  };
}

export function computeBasketIndex(
  products: BasketProductInput[],
  observations: BasketObservationInput[],
  latestBenchmark: BenchmarkReferenceInput | null
): BasketIndexSummary {
  const summaries = products.map((product) =>
    computeProductSummary(product, observations)
  );

  let estimatedMonthlyBasketUsdBcv = 0;
  let estimatedMonthlyBasketRobustUsdBcv = 0;
  let estimatedMonthlyBasketMedianUsdBcv = 0;
  let estimatedMonthlyBasketAvgUsdBcv = 0;
  let estimatedMonthlyBasketVes = 0;
  let estimatedMonthlyBasketRobustVes = 0;
  let estimatedMonthlyBasketAvgVes = 0;
  const parallelAcc: ParallelAccumulator = { sum: 0, complete: true };
  const parallelRobustAcc: ParallelAccumulator = { sum: 0, complete: true };
  const parallelAvgAcc: ParallelAccumulator = { sum: 0, complete: true };
  let coveredProductsCount = 0;
  let flaggedProductsCount = 0;
  let outlierOffersCount = 0;

  const categoryMap = new Map<
    BasketCategory,
    { coveredCount: number; totalCount: number; monthlyUsdBcv: number }
  >();

  for (const summary of summaries) {
    const cat = categoryMap.get(summary.category) ?? {
      coveredCount: 0,
      totalCount: 0,
      monthlyUsdBcv: 0,
    };
    cat.totalCount += 1;

    if (summary.needsArbitration) flaggedProductsCount += 1;
    outlierOffersCount += summary.outlierCount;

    const {
      robustCheapestUnitUsdBcv,
      medianUnitUsdBcv,
      averageUnitUsdBcv,
      cheapestUnitVes,
      robustCheapestUnitVes,
      averageUnitVes,
      monthlyContributionUsdBcv,
      robustMonthlyContributionUsdBcv,
    } = summary;

    if (
      summary.cheapestUnitUsdBcv !== null &&
      robustCheapestUnitUsdBcv !== null &&
      medianUnitUsdBcv !== null &&
      averageUnitUsdBcv !== null &&
      cheapestUnitVes !== null &&
      robustCheapestUnitVes !== null &&
      averageUnitVes !== null &&
      monthlyContributionUsdBcv !== null &&
      robustMonthlyContributionUsdBcv !== null
    ) {
      coveredProductsCount += 1;
      cat.coveredCount += 1;
      cat.monthlyUsdBcv = round2(cat.monthlyUsdBcv + monthlyContributionUsdBcv);

      const qty = summary.basketMonthlyQty;
      estimatedMonthlyBasketUsdBcv += monthlyContributionUsdBcv;
      estimatedMonthlyBasketRobustUsdBcv += robustMonthlyContributionUsdBcv;
      estimatedMonthlyBasketMedianUsdBcv += medianUnitUsdBcv * qty;
      estimatedMonthlyBasketAvgUsdBcv += averageUnitUsdBcv * qty;
      estimatedMonthlyBasketVes += cheapestUnitVes * qty;
      estimatedMonthlyBasketRobustVes += robustCheapestUnitVes * qty;
      estimatedMonthlyBasketAvgVes += averageUnitVes * qty;

      addParallelSample(parallelAcc, summary.cheapestUnitUsdParallel, qty);
      addParallelSample(parallelRobustAcc, summary.robustCheapestUnitUsdParallel, qty);
      addParallelSample(parallelAvgAcc, summary.averageUnitUsdParallel, qty);
    }

    categoryMap.set(summary.category, cat);
  }

  estimatedMonthlyBasketUsdBcv = round2(estimatedMonthlyBasketUsdBcv);
  const totalProductsCount = products.length;
  const coveragePct =
    totalProductsCount > 0
      ? round2((coveredProductsCount / totalProductsCount) * 100)
      : 0;

  let benchmarkDeltaUsd: number | null = null;
  let benchmarkDeltaPct: number | null = null;
  let benchmarkReferenceLabel: string | null = null;

  if (latestBenchmark && coveredProductsCount > 0) {
    benchmarkReferenceLabel = `${latestBenchmark.source.toUpperCase()} (${latestBenchmark.periodMonth})`;
    benchmarkDeltaUsd = round2(
      estimatedMonthlyBasketUsdBcv - latestBenchmark.basketCostUsd
    );
    benchmarkDeltaPct =
      latestBenchmark.basketCostUsd > 0
        ? round2(
            ((estimatedMonthlyBasketUsdBcv - latestBenchmark.basketCostUsd) /
              latestBenchmark.basketCostUsd) *
              100
          )
        : null;
  }

  const categorySubtotals: CategorySubtotal[] = Array.from(
    categoryMap.entries()
  ).map(([category, stats]) => ({
    category,
    ...stats,
  }));

  return {
    estimatedMonthlyBasketUsdBcv,
    estimatedMonthlyBasketRobustUsdBcv: round2(estimatedMonthlyBasketRobustUsdBcv),
    estimatedMonthlyBasketMedianUsdBcv: round2(estimatedMonthlyBasketMedianUsdBcv),
    estimatedMonthlyBasketAvgUsdBcv: round2(estimatedMonthlyBasketAvgUsdBcv),
    estimatedMonthlyBasketVes: round2(estimatedMonthlyBasketVes),
    estimatedMonthlyBasketRobustVes: round2(estimatedMonthlyBasketRobustVes),
    estimatedMonthlyBasketAvgVes: round2(estimatedMonthlyBasketAvgVes),
    estimatedMonthlyBasketUsdParallel: finalizeParallel(coveredProductsCount, parallelAcc),
    estimatedMonthlyBasketRobustUsdParallel: finalizeParallel(coveredProductsCount, parallelRobustAcc),
    estimatedMonthlyBasketAvgUsdParallel: finalizeParallel(coveredProductsCount, parallelAvgAcc),
    coveredProductsCount,
    totalProductsCount,
    coveragePct,
    flaggedProductsCount,
    outlierOffersCount,
    benchmarkDeltaUsd,
    benchmarkDeltaPct,
    benchmarkReferenceLabel,
    categorySubtotals,
    products: summaries,
  };
}
