import { describe, expect, it, vi } from "vitest";
import type { ArbitrationCandidate } from "@/features/arbitration/domain/arbiter-policy";
import {
  arbitrateSkuWithGemini,
  GeminiAuthError,
  generateAnomalyDigestWithGemini,
} from "@/features/arbitration/infrastructure/gemini-arbiter-client";

const SAMPLE_CANDIDATE: ArbitrationCandidate = {
  canonicalSlug: "arroz-blanco",
  canonicalName: "Arroz Blanco de Mesa",
  baseUnit: "kg",
  medianUnitUsdBcv: 1.2,
  spreadPct: 275,
  retailerSlug: "locatel-caracas",
  retailerName: "Locatel",
  rawTitle: "Arroz Arborio Riso Gallo Italiano 1 Kg",
  normalizedTitleHash: "abc123",
  cacheKey: "arroz-blanco:abc123",
  packageSize: 1,
  packageUnit: "kg",
  priceUsdBcv: 4.5,
  normalizedUnitPriceUsd: 4.5,
  matchConfidence: 0.88,
  outlierStatus: "high_outlier",
  priority: 3,
};

describe("gemini-arbiter-client", () => {
  it("omits thinkingConfig for flash-lite and falls back to flash with thinkingBudget 0 on 503", async () => {
    const capturedBodies: Array<{ url: string; body: Record<string, unknown> }> =
      [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      capturedBodies.push({ url, body });

      if (url.includes("gemini-3.5-flash-lite")) {
        return new Response("Service unavailable", { status: 503 });
      }

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      isValidMatch: false,
                      tier: "premium_imported",
                      effectivePackageMultiplier: 1,
                      confidence: 0.95,
                      reason: "Arroz arborio importado para risotto.",
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 110, candidatesTokenCount: 45 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const result = await arbitrateSkuWithGemini(SAMPLE_CANDIDATE, {
      apiKey: "test-key",
      models: ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"],
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(result.modelUsed).toBe("gemini-3.5-flash");
    expect(result.data.isValidMatch).toBe(false);
    expect(result.data.tier).toBe("premium_imported");
    expect(result.promptTokens).toBe(110);
    expect(result.outputTokens).toBe(45);
    expect(capturedBodies).toHaveLength(2);

    const liteGenConfig = capturedBodies[0].body.generationConfig as Record<
      string,
      unknown
    >;
    const flashGenConfig = capturedBodies[1].body.generationConfig as Record<
      string,
      unknown
    >;
    expect("thinkingConfig" in liteGenConfig).toBe(false);
    expect(flashGenConfig.thinkingConfig).toStrictEqual({ thinkingBudget: 0 });
  });

  it("falls back when JSON validation fails and fails fast on 401 auth errors", async () => {
    const fetchInvalidThenValid = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("gemini-3.5-flash-lite")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{bad-json" }] } }],
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      headline: "Brecha impulsada por productos importados",
                      summary:
                        "La dispersión responde a presentaciones importadas frente a marcas nacionales.",
                      highlights: [
                        {
                          canonicalSlug: "arroz-blanco",
                          productName: "Arroz Blanco de Mesa",
                          spreadPct: 275,
                          primaryCause: "brand_tier",
                          explanation:
                            "Arroz arborio importado eleva el extremo superior.",
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      );
    });

    const digest = await generateAnomalyDigestWithGemini(
      {
        digestDate: "2026-11-27",
        topProducts: [],
        flaggedProductsCount: 1,
        outlierOffersCount: 1,
      },
      {
        apiKey: "test-key",
        models: ["gemini-3.5-flash-lite", "gemini-2.5-flash"],
        fetchFn: fetchInvalidThenValid as unknown as typeof fetch,
      }
    );

    expect(digest.modelUsed).toBe("gemini-2.5-flash");
    expect(digest.data.highlights).toHaveLength(1);

    const fetchAuthFail = vi.fn(
      async () => new Response("Unauthorized", { status: 401 })
    );
    await expect(
      arbitrateSkuWithGemini(SAMPLE_CANDIDATE, {
        apiKey: "bad-key",
        models: ["gemini-3.5-flash-lite", "gemini-3.5-flash"],
        fetchFn: fetchAuthFail as unknown as typeof fetch,
      })
    ).rejects.toBeInstanceOf(GeminiAuthError);
    expect(fetchAuthFail).toHaveBeenCalledTimes(1);
  });
});
