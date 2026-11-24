import { describe, expect, it } from "vitest";
import {
  computeBasketIndex,
  filterObservationsByRegion,
  type BasketObservationInput,
  type BasketProductInput,
} from "@/features/basket/domain/basket-index";

const PRODUCTS: BasketProductInput[] = [
  {
    id: 1,
    slug: "harina-maiz-precocida",
    name: "Harina de Maíz Precocida",
    category: "grains_flours",
    baseUnit: "kg",
    basketMonthlyQty: 8,
  },
  {
    id: 2,
    slug: "aceite-vegetal",
    name: "Aceite Vegetal",
    category: "oils_fats",
    baseUnit: "l",
    basketMonthlyQty: 2,
  },
];

const OBSERVATIONS: BasketObservationInput[] = [
  {
    canonicalProductId: 1,
    retailerId: 1,
    retailerSlug: "bahia-la-guaira",
    retailerName: "Bahía Supermarket",
    rawTitle: "Harina PAN 1kg",
    originalAmount: 1.43,
    originalCurrency: "USD",
    priceUsdBcv: 1.43,
    priceVes: 1315.35,
    priceUsdParallel: 1.19,
    packageSize: 1,
    packageUnit: "kg",
    normalizedUnitPriceUsd: 1.43,
    inStock: true,
    storeAvailabilityCount: null,
    productUrl: "https://store.bahiasupermarket.com/",
    region: "La Guaira",
    observedAt: new Date("2026-11-24T20:00:00Z"),
  },
  {
    canonicalProductId: 1,
    retailerId: 2,
    retailerSlug: "farmatodo-ve",
    retailerName: "Farmatodo",
    rawTitle: "Harina PAN 1kg",
    originalAmount: 1021,
    originalCurrency: "VES",
    priceUsdBcv: 1.11,
    priceVes: 1021,
    priceUsdParallel: 0.92,
    packageSize: 1,
    packageUnit: "kg",
    normalizedUnitPriceUsd: 1.11,
    inStock: true,
    storeAvailabilityCount: 40,
    productUrl: "https://www.farmatodo.com.ve/",
    region: "La Guaira / Caracas",
    observedAt: new Date("2026-11-24T20:00:00Z"),
  },
];

describe("basket-index", () => {
  it("computes cheapest retailer, spread, coverage, and benchmark delta", () => {
    const index = computeBasketIndex(PRODUCTS, OBSERVATIONS, {
      source: "ovf",
      periodMonth: "2026-10",
      basketCostUsd: 405.25,
      familySize: 5,
    });

    expect(index.coveredProductsCount).toBe(1);
    expect(index.totalProductsCount).toBe(2);
    expect(index.coveragePct).toBe(50);
    // 8 kg * $1.11 = $8.88
    expect(index.estimatedMonthlyBasketUsdBcv).toBe(8.88);
    expect(index.estimatedMonthlyBasketVes).toBe(8168);
    expect(index.estimatedMonthlyBasketUsdParallel).toBe(7.36);
    expect(index.estimatedMonthlyBasketAvgUsdBcv).toBe(10.16);
    expect(index.estimatedMonthlyBasketAvgVes).toBe(9345.4);
    expect(index.estimatedMonthlyBasketAvgUsdParallel).toBe(8.44);

    const harina = index.products[0];
    expect(harina.cheapestRetailerSlug).toBe("farmatodo-ve");
    expect(harina.averageUnitUsdBcv).toBe(1.27);
    expect(harina.averageUnitVes).toBe(1168.175);
    expect(harina.averageUnitUsdParallel).toBe(1.055);
    expect(harina.spreadPct).toBeCloseTo(28.83, 2);
    expect(index.benchmarkReferenceLabel).toBe("OVF (2026-10)");
  });

  it("filters observations by region", () => {
    const caracasOnly = filterObservationsByRegion(OBSERVATIONS, "Caracas");
    expect(caracasOnly).toHaveLength(1);
    expect(caracasOnly[0].retailerSlug).toBe("farmatodo-ve");
  });
});
