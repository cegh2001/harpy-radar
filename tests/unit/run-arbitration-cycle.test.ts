import { describe, expect, it, vi } from "vitest";
import { runArbitrationCycle } from "@/features/arbitration/application/run-arbitration-cycle";
import type { ArbitrationRepositoryPort } from "@/features/arbitration/infrastructure/arbitration-repository";
import type { CatalogProductRecord } from "@/features/catalog/infrastructure/catalog-repository";
import type { LatestObservationJoined } from "@/features/retailers/infrastructure/price-repository";

function makeCatalog(): CatalogProductRecord[] {
  return [
    {
      id: 1,
      slug: "arroz-blanco",
      name: "Arroz Blanco de Mesa",
      category: "grains_flours",
      baseUnit: "kg",
      basketMonthlyQty: 6,
      searchTerms: ["arroz"],
      requiredTokens: ["arroz"],
      excludedTokens: [],
      expectedMinUnitUsd: 0.7,
      expectedMaxUnitUsd: 5.0,
      active: true,
    },
    {
      id: 2,
      slug: "pasta-alimenticia",
      name: "Pasta Alimenticia",
      category: "grains_flours",
      baseUnit: "kg",
      basketMonthlyQty: 5,
      searchTerms: ["pasta"],
      requiredTokens: ["pasta"],
      excludedTokens: [],
      expectedMinUnitUsd: 0.8,
      expectedMaxUnitUsd: 4.5,
      active: true,
    },
  ];
}

function makeObservations(): LatestObservationJoined[] {
  const prices = [
    { productId: 1, id: 1, slug: "bahia", name: "Bahía", raw: "Arroz A 1kg", usd: "1.15" },
    { productId: 1, id: 2, slug: "farma", name: "Farmatodo", raw: "Arroz B 1kg", usd: "1.20" },
    { productId: 1, id: 3, slug: "viva", name: "Viva", raw: "Arroz C 1kg", usd: "1.25" },
    {
      productId: 1,
      id: 4,
      slug: "locatel",
      name: "Locatel",
      raw: "Arroz Arborio Italiano 1kg",
      usd: "4.50",
    },
    { productId: 2, id: 1, slug: "bahia", name: "Bahía", raw: "Pasta Nacional 1kg", usd: "1.00" },
    { productId: 2, id: 4, slug: "locatel", name: "Locatel", raw: "Pasta Barilla 1kg", usd: "2.40" },
  ];
  return prices.map((p, idx) => ({
    observation: {
      id: idx + 1,
      canonicalProductId: p.productId,
      retailerId: p.id,
      exchangeRateId: 1,
      parallelRateId: null,
      externalSku: `sku-${p.id}`,
      barcode: null,
      rawTitle: p.raw,
      productUrl: null,
      imageUrl: null,
      originalAmount: p.usd,
      originalCurrency: "USD",
      priceUsdBcv: p.usd,
      priceVes: "1000.0000",
      priceUsdParallel: null,
      packageSize: "1.0000",
      packageUnit: "kg",
      normalizedUnitPriceUsd: p.usd,
      inStock: true,
      storeAvailabilityCount: null,
      matchConfidence: "0.880",
      region: "La Guaira",
      contentHash: `hash-${p.id}`,
      observedDate: "2026-11-27",
      observedAt: new Date("2026-11-27T12:00:00Z"),
      createdAt: new Date("2026-11-27T12:00:00Z"),
    },
    retailer: {
      id: p.id,
      slug: p.slug,
      name: p.name,
      baseUrl: "https://example.com",
      adapterKey: "shopify_catalog",
      primaryRegion: "La Guaira",
      defaultCurrency: "USD",
      status: "active",
      enabled: true,
      configJson: {},
      createdAt: new Date("2026-11-27T12:00:00Z"),
    },
  }));
}

function makeMockRepo(
  overrides: Partial<ArbitrationRepositoryPort> = {}
): ArbitrationRepositoryPort {
  return {
    getActiveVerdictsBySlugs: vi.fn(async () => new Map()),
    countArbitrationsForDate: vi.fn(async () => 0),
    upsertVerdict: vi.fn(async () => undefined),
    getDigestForDate: vi.fn(async () => null),
    getLatestDigest: vi.fn(async () => null),
    saveDigest: vi.fn(async (input) => ({
      ...input,
      createdAt: "2026-11-27T12:00:00.000Z",
    })),
    ...overrides,
  };
}

describe("runArbitrationCycle", () => {
  it("skips cleanly when disabled or missing API key", async () => {
    const repo = makeMockRepo();
    const disabled = await runArbitrationCycle({
      enabled: false,
      apiKey: "key",
      maxDailyCalls: 40,
      cacheTtlDays: 45,
      getCatalog: async () => [],
      getLatestObservations: async () => [],
      arbitrationRepo: repo,
      arbitrateSku: vi.fn(),
      generateDigest: vi.fn(),
    });
    expect(disabled.status).toBe("skipped");
    expect(disabled.reason).toBe("ARBITER_ENABLED is false");

    const noKey = await runArbitrationCycle({
      enabled: true,
      apiKey: undefined,
      maxDailyCalls: 40,
      cacheTtlDays: 45,
      getCatalog: async () => [],
      getLatestObservations: async () => [],
      arbitrationRepo: repo,
      arbitrateSku: vi.fn(),
      generateDigest: vi.fn(),
    });
    expect(noKey.status).toBe("skipped");
    expect(noKey.reason).toBe("GEMINI_API_KEY is not configured");
  });

  it("enforces daily budget, persists verdicts, and generates digest once per day", async () => {
    const repo = makeMockRepo({
      countArbitrationsForDate: vi.fn(async () => 39),
    });
    const arbitrateSku = vi.fn(async () => ({
      data: {
        isValidMatch: false,
        tier: "premium_imported" as const,
        effectivePackageMultiplier: 1,
        confidence: 0.95,
        reason: "Arroz arborio importado.",
      },
      modelUsed: "gemini-3.5-flash-lite",
      promptTokens: 100,
      outputTokens: 50,
      attempts: [{ model: "gemini-3.5-flash-lite", status: 200 }],
    }));
    const generateDigest = vi.fn(async () => ({
      data: {
        headline: "Brecha por producto importado",
        summary: "El arroz arborio disparó la dispersión del día.",
        highlights: [
          {
            canonicalSlug: "arroz-blanco",
            productName: "Arroz Blanco de Mesa",
            spreadPct: 291.3,
            primaryCause: "brand_tier" as const,
            explanation: "Arroz importado frente a marcas nacionales.",
          },
        ],
      },
      modelUsed: "gemini-3.5-flash",
      promptTokens: 200,
      outputTokens: 90,
      attempts: [{ model: "gemini-3.5-flash", status: 200 }],
    }));

    const summary = await runArbitrationCycle({
      enabled: true,
      apiKey: "key",
      maxDailyCalls: 40,
      cacheTtlDays: 45,
      now: new Date("2026-11-27T12:00:00Z"),
      getCatalog: async () => makeCatalog(),
      getLatestObservations: async () => makeObservations(),
      arbitrationRepo: repo,
      arbitrateSku,
      generateDigest,
    });

    expect(summary.status).toBe("completed");
    expect(summary.candidatesEvaluated).toBe(1);
    expect(summary.arbitratedCount).toBe(1);
    expect(summary.rejectedMatchesCount).toBe(1);
    expect(summary.budgetRemaining).toBe(0);
    expect(summary.digestGenerated).toBe(true);
    expect(arbitrateSku).toHaveBeenCalledTimes(1);
    expect(repo.upsertVerdict).toHaveBeenCalledTimes(1);
    expect(repo.saveDigest).toHaveBeenCalledTimes(1);
  });
});
