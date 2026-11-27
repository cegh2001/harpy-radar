import { describe, expect, it } from "vitest";
import { applyArbitrationVerdictsToObservations } from "@/features/arbitration/domain/apply-arbitration-verdicts";
import {
  computeRemainingDailyBudget,
  DEFAULT_ARBITER_MODELS,
  getModelRequestProfile,
  parseModelCascade,
  selectArbitrationCandidates,
  selectTopAnomalyProducts,
} from "@/features/arbitration/domain/arbiter-policy";
import {
  buildArbitrationCacheKey,
  type CachedSkuVerdict,
} from "@/features/arbitration/domain/arbiter-schemas";
import type {
  BasketObservationInput,
  ProductPriceSummary,
} from "@/features/basket/domain/basket-index";

function makeProductSummary(
  overrides: Partial<ProductPriceSummary> = {}
): ProductPriceSummary {
  return {
    id: 1,
    slug: "arroz-blanco",
    name: "Arroz Blanco de Mesa",
    category: "grains_flours",
    baseUnit: "kg",
    basketMonthlyQty: 6,
    cheapestUnitUsdBcv: 1.0,
    averageUnitUsdBcv: 1.5,
    medianUnitUsdBcv: 1.2,
    cheapestUnitVes: 920,
    averageUnitVes: 1380,
    cheapestUnitUsdParallel: null,
    averageUnitUsdParallel: null,
    cheapestRetailerName: "Bahía",
    cheapestRetailerSlug: "bahia-la-guaira",
    robustCheapestUnitUsdBcv: 1.1,
    robustCheapestUnitVes: 1012,
    robustCheapestUnitUsdParallel: null,
    robustCheapestRetailerName: "Farmatodo",
    robustCheapestRetailerSlug: "farmatodo-ve",
    spreadPct: 160,
    robustSpreadPct: 15,
    outlierCount: 1,
    needsArbitration: true,
    monthlyContributionUsdBcv: 6,
    robustMonthlyContributionUsdBcv: 6.6,
    inStockAny: true,
    retailerCount: 2,
    retailers: [
      {
        retailerSlug: "bahia-la-guaira",
        retailerName: "Bahía",
        externalSku: "sku-1",
        rawTitle: "Arroz Economico 1kg",
        originalAmount: 1.0,
        originalCurrency: "USD",
        priceUsdBcv: 1.0,
        priceVes: 920,
        priceUsdParallel: null,
        packageSize: 1,
        packageUnit: "kg",
        normalizedUnitPriceUsd: 1.0,
        inStock: true,
        matchConfidence: 0.9,
        matchedSkuCount: 1,
        deltaVsCheapestPct: 0,
        outlierStatus: "normal",
        deviationFromMedianPct: -16.67,
        alternatives: [],
        storeAvailabilityCount: null,
        productUrl: null,
        region: "La Guaira",
        observedAt: "2026-11-27T10:00:00.000Z",
      },
      {
        retailerSlug: "locatel-caracas",
        retailerName: "Locatel",
        externalSku: "sku-2",
        rawTitle: "Arroz Arborio Italiano 1kg",
        originalAmount: 4.5,
        originalCurrency: "USD",
        priceUsdBcv: 4.5,
        priceVes: 4140,
        priceUsdParallel: null,
        packageSize: 1,
        packageUnit: "kg",
        normalizedUnitPriceUsd: 4.5,
        inStock: true,
        matchConfidence: 0.88,
        matchedSkuCount: 1,
        deltaVsCheapestPct: 350,
        outlierStatus: "high_outlier",
        deviationFromMedianPct: 275,
        alternatives: [],
        storeAvailabilityCount: null,
        productUrl: null,
        region: "Caracas",
        observedAt: "2026-11-27T10:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("arbiter-policy", () => {
  it("parses model cascades and assigns model-specific thinking profiles", () => {
    expect(
      parseModelCascade(
        " gemini-3.5-flash-lite , gemini-3.5-flash , gemini-3.5-flash-lite ",
        DEFAULT_ARBITER_MODELS
      )
    ).toStrictEqual(["gemini-3.5-flash-lite", "gemini-3.5-flash"]);

    expect(parseModelCascade("", DEFAULT_ARBITER_MODELS)).toStrictEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
    ]);

    expect(getModelRequestProfile("gemini-3.5-flash-lite")).toStrictEqual({
      disableThinking: false,
    });
    expect(getModelRequestProfile("gemini-3.5-flash")).toStrictEqual({
      disableThinking: true,
    });
    expect(getModelRequestProfile("gemini-2.5-flash")).toStrictEqual({
      disableThinking: true,
    });
  });

  it("computes remaining budget and prioritizes outliers, low-confidence matches, and spread tails while skipping middle normal rows", () => {
    expect(computeRemainingDailyBudget(12, 40)).toBe(28);
    expect(computeRemainingDailyBudget(45, 40)).toBe(0);

    const product = makeProductSummary({
      retailers: [
        makeProductSummary().retailers[0],
        {
          ...makeProductSummary().retailers[0],
          retailerSlug: "viva-la-guaira",
          retailerName: "Viva",
          externalSku: "sku-mid-normal",
          rawTitle: "Arroz Medio Normal 1kg",
          normalizedUnitPriceUsd: 1.5,
          matchConfidence: 0.9,
          outlierStatus: "normal",
        },
        {
          ...makeProductSummary().retailers[0],
          retailerSlug: "central-madeirense",
          retailerName: "Central",
          externalSku: "sku-low-conf",
          rawTitle: "Arroz Sin Tamano",
          normalizedUnitPriceUsd: 1.6,
          matchConfidence: 0.72,
          outlierStatus: "normal",
        },
        makeProductSummary().retailers[1],
      ],
    });
    const cachedKey = buildArbitrationCacheKey(
      "arroz-blanco",
      "Arroz Economico 1kg"
    );

    const candidates = selectArbitrationCandidates(
      [product],
      new Set([cachedKey]),
      5
    );
    expect(candidates.map((c) => [c.rawTitle, c.priority])).toStrictEqual([
      ["Arroz Arborio Italiano 1kg", 3],
      ["Arroz Sin Tamano", 2],
    ]);

    const tailOnly = selectArbitrationCandidates(
      [
        makeProductSummary({
          retailers: [
            makeProductSummary().retailers[0],
            {
              ...makeProductSummary().retailers[0],
              retailerSlug: "viva-la-guaira",
              rawTitle: "Arroz Intermedio 1kg",
              normalizedUnitPriceUsd: 1.4,
            },
            {
              ...makeProductSummary().retailers[1],
              outlierStatus: "normal",
              rawTitle: "Arroz Caro Normal 1kg",
            },
          ],
        }),
      ],
      new Set(),
      5
    );
    expect(tailOnly.map((c) => [c.rawTitle, c.priority])).toStrictEqual([
      ["Arroz Caro Normal 1kg", 1],
      ["Arroz Economico 1kg", 1],
    ]);

    const topAnomalies = selectTopAnomalyProducts([
      product,
      makeProductSummary({
        id: 2,
        slug: "harina",
        spreadPct: 20,
        needsArbitration: false,
      }),
    ]);
    expect(topAnomalies.map((p) => p.slug)).toStrictEqual(["arroz-blanco"]);
  });

  it("applies cached verdicts to drop invalid matches, tag tier, and normalize multipacks", () => {
    const obsBase: BasketObservationInput = {
      canonicalProductId: 1,
      retailerId: 1,
      retailerSlug: "bahia-la-guaira",
      retailerName: "Bahía",
      rawTitle: "Arroz Arborio Italiano 1kg",
      originalAmount: 4.5,
      originalCurrency: "USD",
      priceUsdBcv: 4.5,
      priceVes: 4140,
      priceUsdParallel: null,
      packageSize: 1,
      packageUnit: "kg",
      normalizedUnitPriceUsd: 4.5,
      inStock: true,
      storeAvailabilityCount: null,
      productUrl: null,
      region: "La Guaira",
      observedAt: new Date("2026-11-27T10:00:00Z"),
    };

    const obsPack: BasketObservationInput = {
      ...obsBase,
      retailerId: 2,
      retailerSlug: "viva-la-guaira",
      rawTitle: "Arroz Mary Bulto Familiar 1kg",
      priceUsdBcv: 3.0,
      normalizedUnitPriceUsd: 3.0,
    };

    const verdicts = new Map<string, CachedSkuVerdict>([
      [
        buildArbitrationCacheKey("arroz-blanco", obsBase.rawTitle),
        {
          canonicalSlug: "arroz-blanco",
          normalizedTitleHash: "h1",
          sampleRawTitle: obsBase.rawTitle,
          isValidMatch: false,
          tier: "premium_imported",
          effectivePackageMultiplier: 1,
          confidence: 0.96,
          reason: "Arroz gourmet importado incompatible",
          modelUsed: "gemini-3.5-flash-lite",
          arbitratedDate: "2026-11-27",
          expiresAt: new Date("2027-01-01T00:00:00Z"),
        },
      ],
      [
        buildArbitrationCacheKey("arroz-blanco", obsPack.rawTitle),
        {
          canonicalSlug: "arroz-blanco",
          normalizedTitleHash: "h2",
          sampleRawTitle: obsPack.rawTitle,
          isValidMatch: true,
          tier: "standard",
          effectivePackageMultiplier: 2,
          confidence: 0.9,
          reason: "Combo de dos paquetes de 1kg",
          modelUsed: "gemini-3.5-flash-lite",
          arbitratedDate: "2026-11-27",
          expiresAt: new Date("2027-01-01T00:00:00Z"),
        },
      ],
    ]);

    const applied = applyArbitrationVerdictsToObservations(
      [obsBase, obsPack],
      new Map([[1, "arroz-blanco"]]),
      verdicts
    );

    expect(applied).toHaveLength(1);
    expect(applied[0].rawTitle).toBe("Arroz Mary Bulto Familiar 1kg");
    expect(applied[0].packageSize).toBe(2);
    expect(applied[0].normalizedUnitPriceUsd).toBe(1.5);
    expect(applied[0].productTier).toBe("standard");
    expect(applied[0].arbitrationReason).toBe("Combo de dos paquetes de 1kg");

    const alreadyParsedPack: BasketObservationInput = {
      ...obsBase,
      canonicalProductId: 2,
      rawTitle: "Crema Dental Colgate 2 Pack 100Ml",
      packageSize: 2,
      packageUnit: "unit",
      priceUsdBcv: 7.67,
      normalizedUnitPriceUsd: 3.835,
    };
    const packVerdicts = new Map<string, CachedSkuVerdict>([
      [
        buildArbitrationCacheKey("crema-dental", alreadyParsedPack.rawTitle),
        {
          canonicalSlug: "crema-dental",
          normalizedTitleHash: "h3",
          sampleRawTitle: alreadyParsedPack.rawTitle,
          isValidMatch: true,
          tier: "standard",
          effectivePackageMultiplier: 2,
          confidence: 0.98,
          reason: "Presentación de 2 unidades",
          modelUsed: "gemini-3.5-flash-lite",
          arbitratedDate: "2026-11-27",
          expiresAt: new Date("2027-01-01T00:00:00Z"),
        },
      ],
    ]);
    const guarded = applyArbitrationVerdictsToObservations(
      [alreadyParsedPack],
      new Map([[2, "crema-dental"]]),
      packVerdicts
    );
    expect(guarded[0].packageSize).toBe(2);
    expect(guarded[0].normalizedUnitPriceUsd).toBe(3.835);
  });
});
