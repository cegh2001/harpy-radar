import { applyArbitrationVerdictsToObservations } from "@/features/arbitration/domain/apply-arbitration-verdicts";
import type { DailyAnomalyDigestDto } from "@/features/arbitration/domain/arbiter-schemas";
import { arbitrationRepository } from "@/features/arbitration/infrastructure/arbitration-repository";
import { catalogRepository } from "@/features/catalog/infrastructure/catalog-repository";
import {
  exchangeRateRepository,
  type LatestRatesSnapshot,
} from "@/features/exchange-rates/infrastructure/exchange-rate-repository";
import {
  priceRepository,
  type LatestObservationJoined,
} from "@/features/retailers/infrastructure/price-repository";
import { getAllJobHeartbeats } from "@/features/worker/infrastructure/heartbeat-service";
import {
  computeBasketIndex,
  computeProductSummary,
  filterObservationsByRegion,
  type BasketIndexSummary,
  type BasketObservationInput,
  type ProductPriceSummary,
} from "../domain/basket-index";
import {
  benchmarkRepository,
  type BenchmarkDto,
} from "../infrastructure/benchmark-repository";

export interface RetailerStatusDto {
  slug: string;
  name: string;
  adapterKey: string;
  primaryRegion: string;
  defaultCurrency: string;
  status: string;
  enabled: boolean;
}

export interface WorkerHeartbeatDto {
  jobName: string;
  isExecuting: boolean;
  lastHeartbeatAt: string;
  lastCycleAt: string | null;
  lastCycleStatus: string;
  lastError: string | null;
  cycleCount: number;
}

export interface DashboardSnapshot {
  generatedAt: string;
  region: string;
  rates: {
    official: {
      usdRate: number;
      eurRate: number | null;
      rateDate: string;
      bcvDateText: string | null;
      source: string;
      fetchedAt: string;
    } | null;
    parallel: {
      usdRate: number;
      rateDate: string;
      source: string;
      fetchedAt: string;
    } | null;
    gapPct: number | null;
  };
  basket: BasketIndexSummary;
  anomalyDigest: DailyAnomalyDigestDto | null;
  benchmarks: BenchmarkDto[];
  retailers: RetailerStatusDto[];
  heartbeats: WorkerHeartbeatDto[];
}

export interface ProductDetailSnapshot {
  product: ProductPriceSummary;
  rates: DashboardSnapshot["rates"];
  history: Array<{
    observedAt: string;
    retailerSlug: string;
    retailerName: string;
    normalizedUnitPriceUsd: number;
    priceUsdBcv: number;
    priceVes: number;
    inStock: boolean;
  }>;
}

export function mapObservationRow(
  row: LatestObservationJoined
): BasketObservationInput {
  return {
    canonicalProductId: row.observation.canonicalProductId,
    retailerId: row.observation.retailerId,
    retailerSlug: row.retailer.slug,
    retailerName: row.retailer.name,
    externalSku: row.observation.externalSku,
    matchConfidence: Number(row.observation.matchConfidence),
    rawTitle: row.observation.rawTitle,
    originalAmount: Number(row.observation.originalAmount),
    originalCurrency: row.observation.originalCurrency as "USD" | "VES",
    priceUsdBcv: Number(row.observation.priceUsdBcv),
    priceVes: Number(row.observation.priceVes),
    priceUsdParallel: row.observation.priceUsdParallel
      ? Number(row.observation.priceUsdParallel)
      : null,
    packageSize: Number(row.observation.packageSize),
    packageUnit: row.observation.packageUnit as "kg" | "l" | "unit",
    normalizedUnitPriceUsd: Number(row.observation.normalizedUnitPriceUsd),
    inStock: row.observation.inStock,
    storeAvailabilityCount: row.observation.storeAvailabilityCount,
    productUrl: row.observation.productUrl,
    region: row.observation.region,
    observedAt: row.observation.observedAt,
  };
}

function serializeRates(
  rates: LatestRatesSnapshot
): DashboardSnapshot["rates"] {
  return {
    official: rates.official
      ? {
          usdRate: rates.official.usdRate,
          eurRate: rates.official.eurRate,
          rateDate: rates.official.rateDate,
          bcvDateText: rates.official.bcvDateText,
          source: rates.official.source,
          fetchedAt: rates.official.fetchedAt.toISOString(),
        }
      : null,
    parallel: rates.parallel
      ? {
          usdRate: rates.parallel.usdRate,
          rateDate: rates.parallel.rateDate,
          source: rates.parallel.source,
          fetchedAt: rates.parallel.fetchedAt.toISOString(),
        }
      : null,
    gapPct: rates.gapPct,
  };
}

export async function getDashboardSnapshot(
  region = "all"
): Promise<DashboardSnapshot> {
  const [rates, products, rawObs, benchmarks, retailers, heartbeats, anomalyDigest] =
    await Promise.all([
      exchangeRateRepository.getLatestRatesSnapshot(),
      catalogRepository.getActiveCanonicalProducts(),
      priceRepository.getLatestObservations(region),
      benchmarkRepository.getAllBenchmarks(),
      priceRepository.getAllRetailers(),
      getAllJobHeartbeats(),
      arbitrationRepository.getLatestDigest().catch(() => null),
    ]);

  const verdictsByKey = await arbitrationRepository
    .getActiveVerdictsBySlugs(products.map((p) => p.slug))
    .catch(() => new Map());
  const slugByProductId = new Map(products.map((p) => [p.id, p.slug]));

  const arbitratedObservations = applyArbitrationVerdictsToObservations(
    rawObs.map(mapObservationRow),
    slugByProductId,
    verdictsByKey
  );

  const mappedObservations = filterObservationsByRegion(
    arbitratedObservations,
    region
  );

  const latestOvf =
    benchmarks.find((item) => item.source === "ovf") ?? benchmarks[0] ?? null;

  const basket = computeBasketIndex(
    products,
    mappedObservations,
    latestOvf
      ? {
          source: latestOvf.source,
          periodMonth: latestOvf.periodMonth,
          basketCostUsd: latestOvf.basketCostUsd,
          familySize: latestOvf.familySize,
        }
      : null
  );

  return {
    generatedAt: new Date().toISOString(),
    region,
    rates: serializeRates(rates),
    basket,
    anomalyDigest,
    benchmarks,
    retailers: retailers.map((r) => ({
      slug: r.slug,
      name: r.name,
      adapterKey: r.adapterKey,
      primaryRegion: r.primaryRegion,
      defaultCurrency: r.defaultCurrency,
      status: r.status,
      enabled: r.enabled,
    })),
    heartbeats: heartbeats.map((hb) => ({
      jobName: hb.jobName,
      isExecuting: hb.isExecuting,
      lastHeartbeatAt: hb.lastHeartbeatAt.toISOString(),
      lastCycleAt: hb.lastCycleAt ? hb.lastCycleAt.toISOString() : null,
      lastCycleStatus: hb.lastCycleStatus,
      lastError: hb.lastError,
      cycleCount: hb.cycleCount,
    })),
  };
}

export async function getProductDetailSnapshot(
  slug: string
): Promise<ProductDetailSnapshot | null> {
  const product = await catalogRepository.getCanonicalProductBySlug(slug);
  if (!product) return null;

  const [rates, latestObs, historyRows, verdictsByKey] = await Promise.all([
    exchangeRateRepository.getLatestRatesSnapshot(),
    priceRepository.getLatestObservationsForProduct(product.id, "all"),
    priceRepository.getProductHistory(product.id, 30),
    arbitrationRepository
      .getActiveVerdictsBySlugs([product.slug])
      .catch(() => new Map()),
  ]);

  const arbitrated = applyArbitrationVerdictsToObservations(
    latestObs.map(mapObservationRow),
    new Map([[product.id, product.slug]]),
    verdictsByKey
  );

  const summary = computeProductSummary(product, arbitrated, {
    includeAlternatives: true,
  });

  return {
    product: summary,
    rates: serializeRates(rates),
    history: historyRows.map((row) => ({
      observedAt: row.observation.observedAt.toISOString(),
      retailerSlug: row.retailer.slug,
      retailerName: row.retailer.name,
      normalizedUnitPriceUsd: Number(row.observation.normalizedUnitPriceUsd),
      priceUsdBcv: Number(row.observation.priceUsdBcv),
      priceVes: Number(row.observation.priceVes),
      inStock: row.observation.inStock,
    })),
  };
}
