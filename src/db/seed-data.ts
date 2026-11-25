import { db } from "./client";
import {
  benchmarkSnapshots,
  canonicalProducts,
  retailers,
} from "./schema";
import { CANONICAL_BASKET_ITEMS } from "@/features/catalog/domain/canonical-basket";
import { REFERENCE_BENCHMARKS } from "@/features/basket/domain/reference-benchmarks";

export const RETAILER_SEEDS = [
  {
    slug: "bahia-la-guaira",
    name: "Bahía Supermarket",
    adapterKey: "stellar_webstore",
    baseUrl: "https://store.bahiasupermarket.com",
    defaultCurrency: "USD",
    primaryRegion: "La Guaira",
    status: "active",
    enabled: true,
    configJson: { platform: "Stellar Webstore", city: "La Guaira" },
  },
  {
    slug: "riomarket-caracas",
    name: "Rio Supermarket",
    adapterKey: "instaleap_ssr",
    baseUrl: "https://www.riomarket.com",
    defaultCurrency: "USD",
    primaryRegion: "Caracas",
    status: "active",
    enabled: true,
    configJson: { platform: "Instaleap SSR", city: "Caracas" },
  },
  {
    slug: "farmatodo-ve",
    name: "Farmatodo",
    adapterKey: "farmatodo_algolia",
    baseUrl: "https://www.farmatodo.com.ve",
    defaultCurrency: "VES",
    primaryRegion: "La Guaira / Caracas",
    status: "active",
    enabled: true,
    configJson: { platform: "Algolia Catalog", city: "La Guaira / Caracas" },
  },
  {
    slug: "excelsior-gama",
    name: "Excelsior Gama",
    adapterKey: "gama_occ",
    baseUrl: "https://api.gamaenlinea.com",
    defaultCurrency: "VES",
    primaryRegion: "Caracas",
    status: "beta",
    enabled: false,
    configJson: { platform: "SAP Commerce OCC", defaultWarehouse: "S007" },
  },
  {
    slug: "central-madeirense",
    name: "Central Madeirense (Maiquetía)",
    adapterKey: "woocommerce_store",
    baseUrl: "https://tucentralonline.com/Maiquetia-53",
    defaultCurrency: "USD",
    primaryRegion: "La Guaira",
    status: "active",
    enabled: true,
    configJson: {
      platform: "WooCommerce Store API",
      branch: "Maiquetia-53",
      city: "La Guaira",
    },
  },
  {
    slug: "puntoalmayor-la-guaira",
    name: "Punto al Mayor",
    adapterKey: "shopify_catalog",
    baseUrl: "https://puntoalmayor.com",
    defaultCurrency: "USD",
    primaryRegion: "La Guaira",
    status: "active",
    enabled: true,
    configJson: { platform: "Shopify Catalog", city: "La Guaira" },
  },
] as const;

export async function seedDatabase(): Promise<{
  productsSeeded: number;
  retailersSeeded: number;
  benchmarksSeeded: number;
}> {
  for (const item of CANONICAL_BASKET_ITEMS) {
    await db
      .insert(canonicalProducts)
      .values({
        slug: item.slug,
        name: item.name,
        category: item.category,
        baseUnit: item.baseUnit,
        basketMonthlyQty: String(item.basketMonthlyQty),
        searchTerms: item.searchTerms,
        requiredTokens: item.requiredTokens,
        excludedTokens: item.excludedTokens,
        expectedMinUnitUsd: String(item.expectedMinUnitUsd),
        expectedMaxUnitUsd: String(item.expectedMaxUnitUsd),
        active: true,
      })
      .onConflictDoUpdate({
        target: canonicalProducts.slug,
        set: {
          name: item.name,
          category: item.category,
          baseUnit: item.baseUnit,
          basketMonthlyQty: String(item.basketMonthlyQty),
          searchTerms: item.searchTerms,
          requiredTokens: item.requiredTokens,
          excludedTokens: item.excludedTokens,
          expectedMinUnitUsd: String(item.expectedMinUnitUsd),
          expectedMaxUnitUsd: String(item.expectedMaxUnitUsd),
        },
      });
  }

  for (const retailer of RETAILER_SEEDS) {
    await db
      .insert(retailers)
      .values({
        slug: retailer.slug,
        name: retailer.name,
        adapterKey: retailer.adapterKey,
        baseUrl: retailer.baseUrl,
        defaultCurrency: retailer.defaultCurrency,
        primaryRegion: retailer.primaryRegion,
        status: retailer.status,
        enabled: retailer.enabled,
        configJson: retailer.configJson,
      })
      .onConflictDoUpdate({
        target: retailers.slug,
        set: {
          name: retailer.name,
          adapterKey: retailer.adapterKey,
          baseUrl: retailer.baseUrl,
          defaultCurrency: retailer.defaultCurrency,
          primaryRegion: retailer.primaryRegion,
          status: retailer.status,
          enabled: retailer.enabled,
          configJson: retailer.configJson,
        },
      });
  }

  for (const benchmark of REFERENCE_BENCHMARKS) {
    await db
      .insert(benchmarkSnapshots)
      .values({
        source: benchmark.source,
        periodMonth: benchmark.periodMonth,
        basketCostUsd: String(benchmark.basketCostUsd),
        basketCostVes:
          benchmark.basketCostVes !== null
            ? String(benchmark.basketCostVes)
            : null,
        familySize: benchmark.familySize,
        notes: benchmark.notes,
        sourceUrl: benchmark.sourceUrl,
        publishedAt: new Date(benchmark.publishedAt),
      })
      .onConflictDoNothing({
        target: [benchmarkSnapshots.source, benchmarkSnapshots.periodMonth],
      });
  }

  return {
    productsSeeded: CANONICAL_BASKET_ITEMS.length,
    retailersSeeded: RETAILER_SEEDS.length,
    benchmarksSeeded: REFERENCE_BENCHMARKS.length,
  };
}
