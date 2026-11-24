import type {
  BaseUnit,
  BasketCategory,
} from "@/features/catalog/domain/canonical-basket";

export interface BasketProductInput {
  id: number;
  slug: string;
  name: string;
  category: BasketCategory;
  baseUnit: BaseUnit;
  basketMonthlyQty: number;
}

export interface BasketObservationInput {
  canonicalProductId: number;
  retailerId: number;
  retailerSlug: string;
  retailerName: string;
  rawTitle: string;
  originalAmount: number;
  originalCurrency: "USD" | "VES";
  priceUsdBcv: number;
  priceVes: number;
  priceUsdParallel: number | null;
  packageSize: number;
  packageUnit: BaseUnit;
  normalizedUnitPriceUsd: number;
  inStock: boolean;
  storeAvailabilityCount: number | null;
  productUrl: string | null;
  region: string;
  observedAt: Date;
}

export interface RetailerPriceBreakdown {
  retailerSlug: string;
  retailerName: string;
  rawTitle: string;
  originalAmount: number;
  originalCurrency: "USD" | "VES";
  priceUsdBcv: number;
  priceVes: number;
  priceUsdParallel: number | null;
  packageSize: number;
  packageUnit: BaseUnit;
  normalizedUnitPriceUsd: number;
  inStock: boolean;
  storeAvailabilityCount: number | null;
  productUrl: string | null;
  region: string;
  observedAt: string;
}

export interface ProductPriceSummary {
  id: number;
  slug: string;
  name: string;
  category: BasketCategory;
  baseUnit: BaseUnit;
  basketMonthlyQty: number;
  cheapestUnitUsdBcv: number | null;
  averageUnitUsdBcv: number | null;
  medianUnitUsdBcv: number | null;
  cheapestUnitVes: number | null;
  averageUnitVes: number | null;
  cheapestUnitUsdParallel: number | null;
  averageUnitUsdParallel: number | null;
  cheapestRetailerName: string | null;
  cheapestRetailerSlug: string | null;
  spreadPct: number | null;
  monthlyContributionUsdBcv: number | null;
  inStockAny: boolean;
  retailerCount: number;
  retailers: RetailerPriceBreakdown[];
}

export interface CategorySubtotal {
  category: BasketCategory;
  coveredCount: number;
  totalCount: number;
  monthlyUsdBcv: number;
}

export interface BenchmarkReferenceInput {
  source: string;
  periodMonth: string;
  basketCostUsd: number;
  familySize: number;
}

export interface BasketIndexSummary {
  estimatedMonthlyBasketUsdBcv: number;
  estimatedMonthlyBasketAvgUsdBcv: number;
  estimatedMonthlyBasketVes: number;
  estimatedMonthlyBasketAvgVes: number;
  estimatedMonthlyBasketUsdParallel: number | null;
  estimatedMonthlyBasketAvgUsdParallel: number | null;
  coveredProductsCount: number;
  totalProductsCount: number;
  coveragePct: number;
  benchmarkDeltaUsd: number | null;
  benchmarkDeltaPct: number | null;
  benchmarkReferenceLabel: string | null;
  categorySubtotals: CategorySubtotal[];
  products: ProductPriceSummary[];
}

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
  observations: BasketObservationInput[]
): ProductPriceSummary {
  const matching = observations
    .filter((obs) => obs.canonicalProductId === product.id)
    .sort((a, b) => a.normalizedUnitPriceUsd - b.normalizedUnitPriceUsd);

  if (matching.length === 0) {
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

  const inStockList = matching.filter((obs) => obs.inStock);
  const pricingPool = inStockList.length > 0 ? inStockList : matching;

  const cheapest = pricingPool[0];
  const unitPrices = pricingPool.map((obs) => obs.normalizedUnitPriceUsd);
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
    retailerCount: matching.length,
    retailers: matching.map((obs) => ({
      retailerSlug: obs.retailerSlug,
      retailerName: obs.retailerName,
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
      storeAvailabilityCount: obs.storeAvailabilityCount,
      productUrl: obs.productUrl,
      region: obs.region,
      observedAt: obs.observedAt.toISOString(),
    })),
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
