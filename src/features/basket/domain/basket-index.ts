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
import { selectRetailerOffers } from "./select-retailer-offers";

export type {
  BasketIndexSummary,
  BasketObservationInput,
  BasketProductInput,
  BenchmarkReferenceInput,
  CategorySubtotal,
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

function computeMedian(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  }
  return sortedValues[mid];
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
      spreadPct: null,
      monthlyContributionUsdBcv: null,
      inStockAny: false,
      retailerCount: 0,
      retailers: [],
    };
  }

  const representatives = selectedOffers.map((offer) => offer.representative);
  const inStockList = representatives.filter((obs) => obs.inStock);
  const pricingPool = inStockList.length > 0 ? inStockList : representatives;

  const cheapest = pricingPool[0];
  const unitPrices = pricingPool
    .map((obs) => obs.normalizedUnitPriceUsd)
    .sort((a, b) => a - b);
  const minUnit = unitPrices[0];
  const maxUnit = unitPrices[unitPrices.length - 1];
  const averageUnitUsdBcv = round4(computeAverage(unitPrices));
  const medianUnit = round4(computeMedian(unitPrices));

  const unitVes = round4(cheapest.priceVes / cheapest.packageSize);
  const averageUnitVes = round4(
    computeAverage(pricingPool.map((obs) => obs.priceVes / obs.packageSize))
  );
  const unitParallel =
    cheapest.priceUsdParallel !== null
      ? round4(cheapest.priceUsdParallel / cheapest.packageSize)
      : null;
  const parallelUnits = pricingPool
    .filter((obs) => obs.priceUsdParallel !== null)
    .map((obs) => (obs.priceUsdParallel as number) / obs.packageSize);
  const averageUnitUsdParallel =
    parallelUnits.length > 0 ? round4(computeAverage(parallelUnits)) : null;

  const spreadPct =
    unitPrices.length > 1 && minUnit > 0
      ? round2(((maxUnit - minUnit) / minUnit) * 100)
      : null;

  return {
    ...product,
    cheapestUnitUsdBcv: cheapest.normalizedUnitPriceUsd,
    averageUnitUsdBcv,
    medianUnitUsdBcv: medianUnit,
    cheapestUnitVes: unitVes,
    averageUnitVes,
    cheapestUnitUsdParallel: unitParallel,
    averageUnitUsdParallel,
    cheapestRetailerName: cheapest.retailerName,
    cheapestRetailerSlug: cheapest.retailerSlug,
    spreadPct,
    monthlyContributionUsdBcv: round2(
      cheapest.normalizedUnitPriceUsd * product.basketMonthlyQty
    ),
    inStockAny: inStockList.length > 0,
    retailerCount: selectedOffers.length,
    retailers: selectedOffers.map((entry) => {
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
        matchedSkuCount: entry.matchedSkuCount,
        deltaVsCheapestPct,
        alternatives: entry.alternatives,
        storeAvailabilityCount: obs.storeAvailabilityCount,
        productUrl: obs.productUrl,
        region: obs.region,
        observedAt: obs.observedAt.toISOString(),
      };
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
  let estimatedMonthlyBasketAvgUsdBcv = 0;
  let estimatedMonthlyBasketVes = 0;
  let estimatedMonthlyBasketAvgVes = 0;
  let parallelAccum = 0;
  let parallelAvgAccum = 0;
  let hasAllParallel = true;
  let hasAllAvgParallel = true;
  let coveredProductsCount = 0;

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

    if (
      summary.cheapestUnitUsdBcv !== null &&
      summary.averageUnitUsdBcv !== null &&
      summary.cheapestUnitVes !== null &&
      summary.averageUnitVes !== null &&
      summary.monthlyContributionUsdBcv !== null
    ) {
      coveredProductsCount += 1;
      cat.coveredCount += 1;
      cat.monthlyUsdBcv = round2(
        cat.monthlyUsdBcv + summary.monthlyContributionUsdBcv
      );

      estimatedMonthlyBasketUsdBcv += summary.monthlyContributionUsdBcv;
      estimatedMonthlyBasketAvgUsdBcv +=
        summary.averageUnitUsdBcv * summary.basketMonthlyQty;
      estimatedMonthlyBasketVes +=
        summary.cheapestUnitVes * summary.basketMonthlyQty;
      estimatedMonthlyBasketAvgVes +=
        summary.averageUnitVes * summary.basketMonthlyQty;

      if (summary.cheapestUnitUsdParallel !== null) {
        parallelAccum +=
          summary.cheapestUnitUsdParallel * summary.basketMonthlyQty;
      } else {
        hasAllParallel = false;
      }

      if (summary.averageUnitUsdParallel !== null) {
        parallelAvgAccum +=
          summary.averageUnitUsdParallel * summary.basketMonthlyQty;
      } else {
        hasAllAvgParallel = false;
      }
    }

    categoryMap.set(summary.category, cat);
  }

  estimatedMonthlyBasketUsdBcv = round2(estimatedMonthlyBasketUsdBcv);
  estimatedMonthlyBasketAvgUsdBcv = round2(estimatedMonthlyBasketAvgUsdBcv);
  estimatedMonthlyBasketVes = round2(estimatedMonthlyBasketVes);
  estimatedMonthlyBasketAvgVes = round2(estimatedMonthlyBasketAvgVes);

  const estimatedMonthlyBasketUsdParallel =
    coveredProductsCount > 0 && hasAllParallel ? round2(parallelAccum) : null;
  const estimatedMonthlyBasketAvgUsdParallel =
    coveredProductsCount > 0 && hasAllAvgParallel
      ? round2(parallelAvgAccum)
      : null;

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
    estimatedMonthlyBasketAvgUsdBcv,
    estimatedMonthlyBasketVes,
    estimatedMonthlyBasketAvgVes,
    estimatedMonthlyBasketUsdParallel,
    estimatedMonthlyBasketAvgUsdParallel,
    coveredProductsCount,
    totalProductsCount,
    coveragePct,
    benchmarkDeltaUsd,
    benchmarkDeltaPct,
    benchmarkReferenceLabel,
    categorySubtotals,
    products: summaries,
  };
}
