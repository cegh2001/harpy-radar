import type {
  BaseUnit,
  BasketCategory,
} from "@/features/catalog/domain/canonical-basket";

export interface RetailerOfferOption {
  externalSku: string | null;
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
  matchConfidence: number;
  storeAvailabilityCount: number | null;
  productUrl: string | null;
  region: string;
  observedAt: string;
}

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
  externalSku?: string | null;
  matchConfidence?: number;
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
  externalSku: string | null;
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
  matchConfidence: number;
  matchedSkuCount: number;
  deltaVsCheapestPct: number | null;
  alternatives: RetailerOfferOption[];
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
