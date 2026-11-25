import { describe, expect, it } from "vitest";
import {
  computeBasketIndex,
  computeProductSummary,
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

  it("selects deterministic representative SKU per chain and exposes alternatives only when requested", () => {
    const arrozProduct: BasketProductInput = {
      id: 3,
      slug: "arroz-blanco",
      name: "Arroz Blanco de Mesa",
      category: "grains_flours",
      baseUnit: "kg",
      basketMonthlyQty: 6,
    };

    const multiSkuObs: BasketObservationInput[] = [
      {
        ...OBSERVATIONS[0],
        canonicalProductId: 3,
        retailerId: 7,
        retailerSlug: "locatel-caracas",
        retailerName: "Locatel",
        externalSku: "sku-primor-1kg",
        matchConfidence: 0.88,
        rawTitle: "PRIMOR ARROZ TRADICIONAL 1KG",
        originalAmount: 3000,
        originalCurrency: "VES",
        priceUsdBcv: 3.27,
        priceVes: 3000,
        normalizedUnitPriceUsd: 3.27,
        inStock: true,
        observedAt: new Date("2026-11-25T17:25:04Z"),
      },
      {
        ...OBSERVATIONS[0],
        canonicalProductId: 3,
        retailerId: 7,
        retailerSlug: "locatel-caracas",
        retailerName: "Locatel",
        externalSku: "sku-primor-900g",
        matchConfidence: 0.86,
        rawTitle: "PRIMOR ARROZ BLANCO PERLADO TIPO A 900 GR",
        originalAmount: 1320,
        originalCurrency: "VES",
        priceUsdBcv: 1.44,
        priceVes: 1320,
        packageSize: 0.9,
        normalizedUnitPriceUsd: 1.6,
        inStock: true,
        observedAt: new Date("2026-11-25T17:25:03Z"),
      },
      {
        ...OBSERVATIONS[0],
        canonicalProductId: 3,
        retailerId: 7,
        retailerSlug: "locatel-caracas",
        retailerName: "Locatel",
        externalSku: "sku-oos-cheap",
        matchConfidence: 0.92,
        rawTitle: "ARROZ ECONOMICO AGOTADO 1KG",
        originalAmount: 800,
        originalCurrency: "VES",
        priceUsdBcv: 0.87,
        priceVes: 800,
        normalizedUnitPriceUsd: 0.87,
        inStock: false,
        observedAt: new Date("2026-11-25T17:25:05Z"),
      },
      {
        ...OBSERVATIONS[1],
        canonicalProductId: 3,
        retailerId: 2,
        retailerSlug: "riomarket-caracas",
        retailerName: "Rio Supermarket",
        externalSku: "sku-rio-inferred",
        matchConfidence: 0.7,
        rawTitle: "Arroz Sin Peso Explicito",
        originalAmount: 0.9,
        originalCurrency: "USD",
        priceUsdBcv: 0.9,
        priceVes: 828,
        normalizedUnitPriceUsd: 0.9,
        inStock: true,
        observedAt: new Date("2026-11-25T16:02:30Z"),
      },
      {
        ...OBSERVATIONS[1],
        canonicalProductId: 3,
        retailerId: 2,
        retailerSlug: "riomarket-caracas",
        retailerName: "Rio Supermarket",
        externalSku: "sku-rio-masia",
        matchConfidence: 0.88,
        rawTitle: "Arroz Blanco Tipo 1 Premium Masía 1 Kg",
        originalAmount: 0.97,
        originalCurrency: "USD",
        priceUsdBcv: 0.97,
        priceVes: 892.4,
        normalizedUnitPriceUsd: 0.97,
        inStock: true,
        observedAt: new Date("2026-11-25T16:02:29Z"),
      },
    ];

    const compact = computeProductSummary(arrozProduct, multiSkuObs);
    expect(compact.retailerCount).toBe(2);
    expect(compact.cheapestRetailerSlug).toBe("riomarket-caracas");
    expect(compact.cheapestUnitUsdBcv).toBe(0.97);
    expect(compact.retailers[0].externalSku).toBe("sku-rio-masia");
    expect(compact.retailers[0].matchedSkuCount).toBe(2);
    expect(compact.retailers[0].deltaVsCheapestPct).toBe(0);
    expect(compact.retailers[0].alternatives).toStrictEqual([]);

    expect(compact.retailers[1].retailerSlug).toBe("locatel-caracas");
    expect(compact.retailers[1].externalSku).toBe("sku-primor-900g");
    expect(compact.retailers[1].normalizedUnitPriceUsd).toBe(1.6);
    expect(compact.retailers[1].matchedSkuCount).toBe(3);
    expect(compact.retailers[1].deltaVsCheapestPct).toBeCloseTo(64.95, 2);

    const detailed = computeProductSummary(arrozProduct, multiSkuObs, {
      includeAlternatives: true,
    });
    expect(detailed.retailers[0].alternatives).toHaveLength(1);
    expect(detailed.retailers[0].alternatives[0].externalSku).toBe(
      "sku-rio-inferred"
    );
    expect(detailed.retailers[1].alternatives).toHaveLength(2);
    expect(detailed.retailers[1].alternatives[0].externalSku).toBe(
      "sku-primor-1kg"
    );
    expect(detailed.retailers[1].alternatives[1].externalSku).toBe(
      "sku-oos-cheap"
    );
  });
});
