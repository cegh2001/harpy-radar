import pLimit from "p-limit";
import { getCaracasDateKey } from "@/shared/lib/date/caracas-date";
import { defaultSleep } from "@/shared/lib/resilience/retry";
import { matchRawProductToCanonical } from "@/features/catalog/domain/product-matcher";
import type { CatalogProductRecord } from "@/features/catalog/infrastructure/catalog-repository";
import { convertToDualCurrency } from "@/features/exchange-rates/domain/bcv-parser";
import type { LatestRatesSnapshot } from "@/features/exchange-rates/infrastructure/exchange-rate-repository";
import {
  buildObservationContentHash,
  type RawRetailProduct,
  type RetailerConnector,
} from "../domain/retailer-connector";
import type { PriceRepositoryPort } from "../infrastructure/price-repository";
import type { PriceObservationInsert } from "@/db/schema";

export interface IngestRetailerDeps {
  connector: RetailerConnector;
  jobName: string;
  getCatalog: () => Promise<CatalogProductRecord[]>;
  getLatestRates: () => Promise<LatestRatesSnapshot>;
  priceRepo: Pick<
    PriceRepositoryPort,
    "getRetailerBySlug" | "saveObservationsBatch" | "recordIngestionRun"
  >;
  concurrency?: number;
  delayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface IngestRetailerSummary {
  retailerSlug: string;
  status: "completed" | "partial" | "failed";
  queriesExecuted: number;
  itemsFetched: number;
  itemsMatched: number;
  itemsSaved: number;
  errors: string[];
}

export async function ingestRetailerPrices(
  deps: IngestRetailerDeps,
  signal?: AbortSignal
): Promise<IngestRetailerSummary> {
  const startedAt = new Date();
  const retailer = await deps.priceRepo.getRetailerBySlug(
    deps.connector.retailerSlug
  );
  if (!retailer) {
    throw new Error(`Retailer "${deps.connector.retailerSlug}" not seeded`);
  }

  const [catalog, rates] = await Promise.all([
    deps.getCatalog(),
    deps.getLatestRates(),
  ]);

  if (!rates.official) {
    throw new Error(
      "Cannot ingest retailer prices without an official exchange rate"
    );
  }

  const officialRate = rates.official;
  const parallelRate = rates.parallel;

  const uniqueQueries = Array.from(
    new Set(
      catalog.flatMap((item) => item.searchTerms.map((term) => term.trim()))
    )
  ).filter(Boolean);

  const limit = pLimit(deps.concurrency ?? 2);
  const sleep = deps.sleepFn ?? defaultSleep;
  const delayMs = deps.delayMs ?? 0;

  const errors: string[] = [];
  const rawResults: RawRetailProduct[] = [];

  await Promise.all(
    uniqueQueries.map((query, index) =>
      limit(async () => {
        signal?.throwIfAborted();
        if (delayMs > 0 && index > 0) {
          await sleep(delayMs);
        }
        try {
          const hits = await deps.connector.searchProducts(query, signal);
          rawResults.push(...hits);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`query "${query}": ${message}`);
        }
      })
    )
  );

  // Deduplicate raw hits by externalSku before matching
  const uniqueRawMap = new Map<string, RawRetailProduct>();
  for (const raw of rawResults) {
    if (!uniqueRawMap.has(raw.externalSku)) {
      uniqueRawMap.set(raw.externalSku, raw);
    }
  }

  const catalogBySlug = new Map(catalog.map((item) => [item.slug, item]));
  const rowsToInsert: PriceObservationInsert[] = [];

  for (const raw of uniqueRawMap.values()) {
    const dual = convertToDualCurrency({
      amount: raw.originalAmount,
      currency: raw.originalCurrency,
      officialUsdRate: officialRate.usdRate,
      parallelUsdRate: parallelRate?.usdRate ?? null,
    });

    const match = matchRawProductToCanonical(
      raw.rawTitle,
      dual.priceUsdBcv,
      catalog
    );
    if (!match) continue;

    const canonical = catalogBySlug.get(match.canonicalSlug);
    if (!canonical) continue;

    rowsToInsert.push({
      canonicalProductId: canonical.id,
      retailerId: retailer.id,
      exchangeRateId: officialRate.id,
      parallelRateId: parallelRate?.id ?? null,
      externalSku: raw.externalSku,
      barcode: raw.barcode,
      rawTitle: raw.rawTitle,
      productUrl: raw.productUrl,
      imageUrl: raw.imageUrl,
      originalAmount: raw.originalAmount.toFixed(4),
      originalCurrency: raw.originalCurrency,
      priceUsdBcv: dual.priceUsdBcv.toFixed(4),
      priceVes: dual.priceVes.toFixed(4),
      priceUsdParallel:
        dual.priceUsdParallel !== null
          ? dual.priceUsdParallel.toFixed(4)
          : null,
      packageSize: match.packageSize.quantity.toFixed(4),
      packageUnit: match.packageSize.unit,
      normalizedUnitPriceUsd: match.normalizedUnitPriceUsd.toFixed(4),
      inStock: raw.inStock,
      storeAvailabilityCount: raw.storeAvailabilityCount,
      matchConfidence: match.confidence.toFixed(3),
      region: raw.region,
      contentHash: buildObservationContentHash({
        retailerSlug: deps.connector.retailerSlug,
        externalSku: raw.externalSku,
        originalAmount: raw.originalAmount,
        originalCurrency: raw.originalCurrency,
        inStock: raw.inStock,
      }),
      observedDate: getCaracasDateKey(raw.observedAt),
      observedAt: raw.observedAt,
    });
  }

  const itemsSaved = await deps.priceRepo.saveObservationsBatch(rowsToInsert);
  const status: "completed" | "partial" | "failed" =
    errors.length === 0
      ? "completed"
      : uniqueRawMap.size > 0
        ? "partial"
        : "failed";

  await deps.priceRepo.recordIngestionRun({
    jobName: deps.jobName,
    retailerSlug: deps.connector.retailerSlug,
    status,
    itemsFetched: uniqueRawMap.size,
    itemsMatched: rowsToInsert.length,
    itemsSaved,
    errorMessage: errors.length > 0 ? errors.slice(0, 5).join(" | ") : null,
    startedAt,
    finishedAt: new Date(),
  });

  return {
    retailerSlug: deps.connector.retailerSlug,
    status,
    queriesExecuted: uniqueQueries.length,
    itemsFetched: uniqueRawMap.size,
    itemsMatched: rowsToInsert.length,
    itemsSaved,
    errors,
  };
}
