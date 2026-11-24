import { describe, expect, it } from "vitest";
import type { PriceObservationInsert } from "@/db/schema";
import type { CatalogProductRecord } from "@/features/catalog/infrastructure/catalog-repository";
import { ingestRetailerPrices } from "@/features/retailers/application/ingest-retailer-prices";
import type { RetailerConnector } from "@/features/retailers/domain/retailer-connector";

const SAMPLE_CATALOG: CatalogProductRecord[] = [
  {
    id: 1,
    slug: "harina-maiz-precocida",
    name: "Harina de Maíz Precocida",
    category: "grains_flours",
    baseUnit: "kg",
    basketMonthlyQty: 8,
    searchTerms: ["harina pan", "harina maiz"],
    requiredTokens: ["harina", "maiz|pan"],
    excludedTokens: ["trigo", "integral"],
    expectedMinUnitUsd: 0.7,
    expectedMaxUnitUsd: 3.5,
    active: true,
  },
];

describe("ingestRetailerPrices", () => {
  it("deduplicates queries/SKUs, pins FX rates, and tolerates single query failures", async () => {
    const savedRows: PriceObservationInsert[] = [];
    const recordedRuns: Array<{ status: string; itemsSaved: number }> = [];

    const mockConnector: RetailerConnector = {
      retailerSlug: "bahia-la-guaira",
      async searchProducts(query) {
        if (query === "harina maiz") {
          throw new Error("Transient upstream timeout");
        }
        return [
          {
            externalSku: "000205",
            barcode: null,
            rawTitle: "Harina de maiz blanco pan 1kg",
            originalAmount: 1.43,
            originalCurrency: "USD",
            inStock: true,
            storeAvailabilityCount: null,
            productUrl: "https://store.bahiasupermarket.com/",
            imageUrl: null,
            region: "La Guaira",
            observedAt: new Date("2026-11-24T20:00:00Z"),
          },
          {
            externalSku: "000999",
            barcode: null,
            rawTitle: "Galleta de chocolate 150g",
            originalAmount: 2.5,
            originalCurrency: "USD",
            inStock: true,
            storeAvailabilityCount: null,
            productUrl: null,
            imageUrl: null,
            region: "La Guaira",
            observedAt: new Date("2026-11-24T20:00:00Z"),
          },
        ];
      },
    };

    const summary = await ingestRetailerPrices({
      connector: mockConnector,
      jobName: "job:scrape-bahia",
      getCatalog: async () => SAMPLE_CATALOG,
      getLatestRates: async () => ({
        official: {
          id: 10,
          usdRate: 900,
          eurRate: 950,
          rateDate: "2026-11-24",
          bcvDateText: "24 Nov 2026",
          source: "bcv_official",
          fetchedAt: new Date("2026-11-24T19:00:00Z"),
        },
        parallel: {
          id: 11,
          usdRate: 1100,
          rateDate: "2026-11-24",
          source: "dolarapi_parallel",
          fetchedAt: new Date("2026-11-24T19:00:00Z"),
        },
        gapPct: 22.22,
      }),
      priceRepo: {
        async getRetailerBySlug() {
          return {
            id: 5,
            slug: "bahia-la-guaira",
            name: "Bahía Supermarket",
            adapterKey: "stellar_webstore",
            baseUrl: "https://store.bahiasupermarket.com",
            defaultCurrency: "USD",
            primaryRegion: "La Guaira",
            status: "active",
            enabled: true,
            configJson: {},
            createdAt: new Date(),
          };
        },
        async saveObservationsBatch(rows) {
          savedRows.push(...rows);
          return rows.length;
        },
        async recordIngestionRun(input) {
          recordedRuns.push({
            status: input.status,
            itemsSaved: input.itemsSaved,
          });
          return {
            id: 1,
            ...input,
          };
        },
      },
      delayMs: 0,
      concurrency: 1,
    });

    expect(summary.status).toBe("partial");
    expect(summary.itemsFetched).toBe(2);
    expect(summary.itemsMatched).toBe(1);
    expect(summary.itemsSaved).toBe(1);
    expect(summary.errors).toHaveLength(1);

    expect(savedRows[0].exchangeRateId).toBe(10);
    expect(savedRows[0].parallelRateId).toBe(11);
    expect(savedRows[0].priceUsdBcv).toBe("1.4300");
    expect(savedRows[0].priceVes).toBe("1287.0000");
    expect(savedRows[0].observedDate).toBe("2026-11-24");
    expect(recordedRuns).toStrictEqual([{ status: "partial", itemsSaved: 1 }]);
  });
});
