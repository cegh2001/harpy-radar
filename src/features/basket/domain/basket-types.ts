import type {
  BaseUnit,
  BasketCategory,
} from "@/features/catalog/domain/canonical-basket";
import type { ProductTier } from "@/features/arbitration/domain/arbiter-schemas";
import type { OutlierStatus } from "./dispersion-outliers";

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
  productTier?: ProductTier | null;
  arbitrationReason?: string | null;
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
  displayUnitLabel?: string;
  displayUnitPluralLabel?: string;
  displayUnitSizeInBase?: number;
}

export interface BasketObservationInput {
  canonicalProductId: number;
  retailerId: number;
  retailerSlug: string;
  retailerName: string;
  externalSku?: string | null;
  matchConfidence?: number;
  productTier?: ProductTier | null;
  arbitrationReason?: string | null;
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
  productTier?: ProductTier | null;
  arbitrationReason?: string | null;
  matchedSkuCount: number;
  deltaVsCheapestPct: number | null;
  outlierStatus: OutlierStatus;
  deviationFromMedianPct: number | null;
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
  displayUnitLabel?: string;
  displayUnitPluralLabel?: string;
  displayUnitSizeInBase?: number;
  cheapestUnitUsdBcv: number | null;
  averageUnitUsdBcv: number | null;
  medianUnitUsdBcv: number | null;
  cheapestUnitVes: number | null;
  averageUnitVes: number | null;
  cheapestUnitUsdParallel: number | null;
  averageUnitUsdParallel: number | null;
  cheapestRetailerName: string | null;
  cheapestRetailerSlug: string | null;
  robustCheapestUnitUsdBcv: number | null;
  robustCheapestUnitVes: number | null;
  robustCheapestUnitUsdParallel: number | null;
  robustCheapestRetailerName: string | null;
  robustCheapestRetailerSlug: string | null;
  spreadPct: number | null;
  robustSpreadPct: number | null;
  outlierCount: number;
  needsArbitration: boolean;
  monthlyContributionUsdBcv: number | null;
  robustMonthlyContributionUsdBcv: number | null;
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
  estimatedMonthlyBasketRobustUsdBcv: number;
  estimatedMonthlyBasketMedianUsdBcv: number;
  estimatedMonthlyBasketAvgUsdBcv: number;
  estimatedMonthlyBasketVes: number;
  estimatedMonthlyBasketRobustVes: number;
  estimatedMonthlyBasketAvgVes: number;
  estimatedMonthlyBasketUsdParallel: number | null;
  estimatedMonthlyBasketRobustUsdParallel: number | null;
  estimatedMonthlyBasketAvgUsdParallel: number | null;
  coveredProductsCount: number;
  totalProductsCount: number;
  coveragePct: number;
  flaggedProductsCount: number;
  outlierOffersCount: number;
  benchmarkDeltaUsd: number | null;
  benchmarkDeltaPct: number | null;
  benchmarkReferenceLabel: string | null;
  categorySubtotals: CategorySubtotal[];
  products: ProductPriceSummary[];
}
