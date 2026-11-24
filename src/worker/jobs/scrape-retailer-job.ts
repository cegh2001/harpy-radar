import { env } from "@/shared/config/env";
import { catalogRepository } from "@/features/catalog/infrastructure/catalog-repository";
import { exchangeRateRepository } from "@/features/exchange-rates/infrastructure/exchange-rate-repository";
import { ingestRetailerPrices } from "@/features/retailers/application/ingest-retailer-prices";
import { createRetailerConnector } from "@/features/retailers/infrastructure/connectors/connector-registry";
import { priceRepository } from "@/features/retailers/infrastructure/price-repository";

export async function runScrapeRetailerJob(
  retailerSlug: string,
  jobName: string,
  signal?: AbortSignal
) {
  const connector = createRetailerConnector(retailerSlug);
  if (!connector) {
    console.log(`[Worker] Retailer "${retailerSlug}" disabled, skipping.`);
    return {
      retailerSlug,
      status: "skipped" as const,
      queriesExecuted: 0,
      itemsFetched: 0,
      itemsMatched: 0,
      itemsSaved: 0,
      errors: [],
    };
  }

  console.log(`[Worker] Scraping ${retailerSlug}...`);
  const summary = await ingestRetailerPrices(
    {
      connector,
      jobName,
      getCatalog: () => catalogRepository.getActiveCanonicalProducts(),
      getLatestRates: () => exchangeRateRepository.getLatestRatesSnapshot(),
      priceRepo: priceRepository,
      concurrency: env.SCRAPE_CONCURRENCY,
      delayMs: env.SCRAPE_DELAY_MS,
    },
    signal
  );

  console.log(
    `[Worker] ${retailerSlug} ${summary.status}: fetched=${summary.itemsFetched}, matched=${summary.itemsMatched}, saved=${summary.itemsSaved}`
  );
  return summary;
}
