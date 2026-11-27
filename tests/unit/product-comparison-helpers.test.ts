import { describe, expect, it } from "vitest";
import type { RetailerPriceBreakdown } from "@/features/basket/domain/basket-index";
import {
  formatPackageSizeLabel,
  getDisplayUnitMeta,
} from "@/features/basket/ui/formatters";
import {
  computeComparisonViewStats,
  extractPresentationOptions,
} from "@/features/basket/ui/product-comparison-helpers";

const SAMPLE_RETAILERS: RetailerPriceBreakdown[] = [
  {
    retailerSlug: "riomarket-caracas",
    retailerName: "Rio Supermarket",
    externalSku: "rio-175",
    rawTitle: "Atún Sabor del Pacífico 175 Gr",
    originalAmount: 1.74,
    originalCurrency: "USD",
    priceUsdBcv: 1.74,
    priceVes: 1605.26,
    priceUsdParallel: 1.45,
    packageSize: 0.175,
    packageUnit: "kg",
    normalizedUnitPriceUsd: 9.9429,
    inStock: true,
    matchConfidence: 0.86,
    matchedSkuCount: 2,
    deltaVsCheapestPct: 0,
    outlierStatus: "normal",
    deviationFromMedianPct: -20.46,
    alternatives: [
      {
        externalSku: "rio-140",
        rawTitle: "Atún Margarita 140 Gr",
        originalAmount: 2.1,
        originalCurrency: "USD",
        priceUsdBcv: 2.1,
        priceVes: 1937.38,
        priceUsdParallel: 1.75,
        packageSize: 0.14,
        packageUnit: "kg",
        normalizedUnitPriceUsd: 15.0,
        inStock: true,
        matchConfidence: 0.86,
        storeAvailabilityCount: 5,
        productUrl: "https://www.riomarket.com/",
        region: "Caracas",
        observedAt: "2026-11-25T16:00:00Z",
      },
    ],
    storeAvailabilityCount: 10,
    productUrl: "https://www.riomarket.com/",
    region: "Caracas",
    observedAt: "2026-11-25T16:00:00Z",
  },
  {
    retailerSlug: "bahia-la-guaira",
    retailerName: "Bahía Supermarket",
    externalSku: "bahia-140",
    rawTitle: "Atún Newpesca 140 Gr",
    originalAmount: 1.75,
    originalCurrency: "USD",
    priceUsdBcv: 1.75,
    priceVes: 1614.48,
    priceUsdParallel: 1.46,
    packageSize: 0.14,
    packageUnit: "kg",
    normalizedUnitPriceUsd: 12.5,
    inStock: true,
    matchConfidence: 0.86,
    matchedSkuCount: 1,
    deltaVsCheapestPct: 25.72,
    outlierStatus: "normal",
    deviationFromMedianPct: 0,
    alternatives: [],
    storeAvailabilityCount: null,
    productUrl: "https://store.bahiasupermarket.com/",
    region: "La Guaira",
    observedAt: "2026-11-25T16:00:00Z",
  },
  {
    retailerSlug: "puntoalmayor-la-guaira",
    retailerName: "Punto al Mayor",
    externalSku: "punto-160",
    rawTitle: "Atún Oriente 160 Gr",
    originalAmount: 2.0,
    originalCurrency: "USD",
    priceUsdBcv: 2.0,
    priceVes: 1845.12,
    priceUsdParallel: 1.67,
    packageSize: 0.16,
    packageUnit: "kg",
    normalizedUnitPriceUsd: 12.5,
    inStock: true,
    matchConfidence: 0.86,
    matchedSkuCount: 1,
    deltaVsCheapestPct: 25.72,
    outlierStatus: "normal",
    deviationFromMedianPct: 0,
    alternatives: [],
    storeAvailabilityCount: null,
    productUrl: "https://puntoalmayor.com/",
    region: "La Guaira",
    observedAt: "2026-11-25T16:00:00Z",
  },
];

describe("product-comparison-helpers", () => {
  it("formats package sizes into grams, kilograms, milliliters, liters, and units", () => {
    expect(formatPackageSizeLabel(0.17, "kg")).toBe("170 g");
    expect(formatPackageSizeLabel(1, "kg")).toBe("1 kg");
    expect(formatPackageSizeLabel(0.375, "l")).toBe("375 ml");
    expect(formatPackageSizeLabel(1, "l")).toBe("1 L");
    expect(formatPackageSizeLabel(4, "unit")).toBe("4 und");
  });

  it("computes scaled display unit metadata for canned fish and regular items", () => {
    expect(
      getDisplayUnitMeta({
        baseUnit: "kg",
        basketMonthlyQty: 1.2,
        displayUnitLabel: "lata",
        displayUnitPluralLabel: "latas",
        displayUnitSizeInBase: 0.17,
      })
    ).toStrictEqual({
      scale: 0.17,
      unitLabel: "lata",
      referenceLabel: "lata (170 g)",
      monthlyQtyLabel: "7 latas",
      isScaledDisplay: true,
    });

    expect(
      getDisplayUnitMeta({
        baseUnit: "kg",
        basketMonthlyQty: 6,
      })
    ).toStrictEqual({
      scale: 1,
      unitLabel: "kg",
      referenceLabel: "kg",
      monthlyQtyLabel: "6 kg",
      isScaledDisplay: false,
    });
  });

  it("extracts dynamic presentation options ordered by chain coverage then size", () => {
    const options = extractPresentationOptions(SAMPLE_RETAILERS, "all");
    expect(options).toStrictEqual([
      { key: "0.14:kg", size: 0.14, unit: "kg", label: "140 g", chainCount: 2 },
      { key: "0.16:kg", size: 0.16, unit: "kg", label: "160 g", chainCount: 1 },
      {
        key: "0.175:kg",
        size: 0.175,
        unit: "kg",
        label: "175 g",
        chainCount: 1,
      },
    ]);
  });

  it("promotes matching alternatives and recalculates KPIs when filtering by presentation", () => {
    const stats = computeComparisonViewStats(
      SAMPLE_RETAILERS,
      "all",
      "0.14:kg"
    );

    expect(stats.retailers).toHaveLength(2);
    expect(stats.retailers[0].retailerSlug).toBe("bahia-la-guaira");
    expect(stats.retailers[0].externalSku).toBe("bahia-140");
    expect(stats.retailers[0].deltaVsCheapestPct).toBe(0);

    expect(stats.retailers[1].retailerSlug).toBe("riomarket-caracas");
    expect(stats.retailers[1].externalSku).toBe("rio-140");
    expect(stats.retailers[1].matchedSkuCount).toBe(1);
    expect(stats.retailers[1].alternatives).toStrictEqual([]);
    expect(stats.retailers[1].deltaVsCheapestPct).toBe(20);

    expect(stats.cheapestPackageUsdBcv).toBe(1.75);
    expect(stats.averagePackageUsdBcv).toBeCloseTo(1.925, 3);
    expect(stats.spreadPct).toBe(20);
    expect(stats.robustSpreadPct).toBe(20);
    expect(stats.outlierCount).toBe(0);
  });

  it("recomputes outlier flags and robust spread dynamically when filtering by region", () => {
    const withHighOutlier: RetailerPriceBreakdown[] = [
      ...SAMPLE_RETAILERS,
      {
        retailerSlug: "locatel-caracas",
        retailerName: "Locatel",
        externalSku: "locatel-importado",
        rawTitle: "Atún Importado Gourmet 140 Gr",
        originalAmount: 4.9,
        originalCurrency: "USD",
        priceUsdBcv: 4.9,
        priceVes: 4520.54,
        priceUsdParallel: 4.08,
        packageSize: 0.14,
        packageUnit: "kg",
        normalizedUnitPriceUsd: 35.0,
        inStock: true,
        matchConfidence: 0.86,
        matchedSkuCount: 1,
        deltaVsCheapestPct: 252.01,
        outlierStatus: "normal",
        deviationFromMedianPct: 0,
        alternatives: [],
        storeAvailabilityCount: 3,
        productUrl: "https://www.locatel.com.ve/",
        region: "Caracas",
        observedAt: "2026-11-25T16:00:00Z",
      },
    ];

    const allRegions = computeComparisonViewStats(withHighOutlier, "all");
    expect(allRegions.outlierCount).toBe(1);
    expect(allRegions.needsArbitration).toBe(true);
    expect(allRegions.robustSpreadPct).toBeCloseTo(25.72, 2);
    expect(allRegions.retailers[3].outlierStatus).toBe("high_outlier");

    const laGuairaOnly = computeComparisonViewStats(
      withHighOutlier,
      "La Guaira"
    );
    expect(laGuairaOnly.outlierCount).toBe(0);
    expect(laGuairaOnly.needsArbitration).toBe(false);
    expect(laGuairaOnly.spreadPct).toBe(0);
    expect(laGuairaOnly.robustSpreadPct).toBe(0);
  });
});
