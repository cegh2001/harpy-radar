import type { z } from "zod";
import type { ProductPriceSummary } from "@/features/basket/domain/basket-types";
import {
  getModelRequestProfile,
  type ArbitrationCandidate,
} from "../domain/arbiter-policy";
import {
  anomalyDigestOutputSchema,
  skuArbitrationVerdictSchema,
  type AnomalyDigestOutput,
  type SkuArbitrationVerdict,
} from "../domain/arbiter-schemas";

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiClientConfig {
  apiKey: string;
  models: readonly string[];
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface GeminiCascadeAttempt {
  model: string;
  status: number | null;
  error?: string;
}

export interface GeminiStructuredResult<T> {
  data: T;
  modelUsed: string;
  promptTokens: number | null;
  outputTokens: number | null;
  attempts: GeminiCascadeAttempt[];
}

export class GeminiAuthError extends Error {
  constructor(status: number, model: string) {
    super(`Gemini authentication failed (HTTP ${status}) on model ${model}`);
    this.name = "GeminiAuthError";
  }
}

const SKU_ARBITRATION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isValidMatch: { type: "BOOLEAN" },
    tier: { type: "STRING", enum: ["basic", "standard", "premium_imported"] },
    effectivePackageMultiplier: { type: "NUMBER" },
    confidence: { type: "NUMBER" },
    reason: { type: "STRING" },
  },
  required: [
    "isValidMatch",
    "tier",
    "effectivePackageMultiplier",
    "confidence",
    "reason",
  ],
};

const ANOMALY_DIGEST_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    summary: { type: "STRING" },
    highlights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          canonicalSlug: { type: "STRING" },
          productName: { type: "STRING" },
          spreadPct: { type: "NUMBER" },
          primaryCause: {
            type: "STRING",
            enum: [
              "brand_tier",
              "package_mismatch",
              "retailer_outlier",
              "mixed",
            ],
          },
          explanation: { type: "STRING" },
        },
        required: [
          "canonicalSlug",
          "productName",
          "spreadPct",
          "primaryCause",
          "explanation",
        ],
      },
    },
  },
  required: ["headline", "summary", "highlights"],
};

function composeSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return externalSignal
    ? AbortSignal.any([externalSignal, timeoutSignal])
    : timeoutSignal;
}

export async function callGeminiStructuredWithCascade<T>(params: {
  apiKey: string;
  models: readonly string[];
  prompt: string;
  responseSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}): Promise<GeminiStructuredResult<T>> {
  const fetchImpl = params.fetchFn ?? globalThis.fetch;
  const timeoutMs = params.timeoutMs ?? 15_000;
  const attempts: GeminiCascadeAttempt[] = [];

  for (const model of params.models) {
    params.signal?.throwIfAborted();
    const profile = getModelRequestProfile(model);
    const generationConfig: Record<string, unknown> = {
      temperature: 0,
      maxOutputTokens: params.maxOutputTokens ?? 512,
      responseMimeType: "application/json",
      responseSchema: params.responseSchema,
    };

    if (profile.disableThinking) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    try {
      const response = await fetchImpl(
        `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": params.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: params.prompt }] }],
            generationConfig,
          }),
          signal: composeSignal(timeoutMs, params.signal),
        }
      );

      if (response.status === 401 || response.status === 403) {
        throw new GeminiAuthError(response.status, model);
      }

      if (!response.ok) {
        const errSnippet = (await response.text()).slice(0, 180);
        attempts.push({ model, status: response.status, error: errSnippet });
        continue;
      }

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };

      const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const parsedJson = JSON.parse(rawText) as unknown;
      const validated = params.schema.parse(parsedJson);
      attempts.push({ model, status: response.status });

      return {
        data: validated,
        modelUsed: model,
        promptTokens: payload.usageMetadata?.promptTokenCount ?? null,
        outputTokens: payload.usageMetadata?.candidatesTokenCount ?? null,
        attempts,
      };
    } catch (error) {
      if (error instanceof GeminiAuthError) {
        throw error;
      }
      if (params.signal?.aborted) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      attempts.push({ model, status: null, error: message });
    }
  }

  const summary = attempts
    .map((a) => `${a.model}:${a.status ?? "err"}(${a.error ?? ""})`)
    .join(" | ");
  throw new Error(`All Gemini cascade models failed: ${summary}`);
}

export async function arbitrateSkuWithGemini(
  candidate: ArbitrationCandidate,
  config: GeminiClientConfig,
  signal?: AbortSignal
): Promise<GeminiStructuredResult<SkuArbitrationVerdict>> {
  const medianStr =
    candidate.medianUnitUsdBcv !== null
      ? `$${candidate.medianUnitUsdBcv.toFixed(2)} USD/${candidate.baseUnit}`
      : "sin mediana";

  const prompt = [
    "Eres un auditor de catálogo de supermercados en Venezuela. Responde en español neutro y conciso.",
    `Producto canónico: "${candidate.canonicalName}" (slug: ${candidate.canonicalSlug}, unidad base: ${candidate.baseUnit}, mediana actual: ${medianStr}).`,
    `SKU detectado en ${candidate.retailerName}: "${candidate.rawTitle}".`,
    `Empaque YA parseado por el sistema: ${candidate.packageSize} ${candidate.packageUnit}. Precio empaque: $${candidate.priceUsdBcv.toFixed(2)} USD BCV. Precio unitario calculado: $${candidate.normalizedUnitPriceUsd.toFixed(2)} USD/${candidate.baseUnit}.`,
    "Evalúa:",
    "1) isValidMatch: true si pertenece al ítem canónico; false si es un producto distinto, preparado/gourmet incompatible o falso positivo.",
    "2) tier: 'basic' (económico/regulado/genérico nacional), 'standard' (marca nacional comercial común) o 'premium_imported' (importado/gourmet/especializado).",
    `3) effectivePackageMultiplier: Factor de CORRECCIÓN sobre el empaque ya parseado (NO repitas el número del pack). Devuelve 1 si ${candidate.packageSize} ${candidate.packageUnit} ya es correcto (ej. si dice '2 Pack' y el sistema ya parseó '2 unit', devuelve 1). Devuelve >1 SOLO si el sistema parseó 1 y el título indica un multipack/bulto no dividido; <1 si un código de modelo (ej. X5) se confundió con unidades.`,
    "4) confidence: 0 a 1.",
    "5) reason: explicación breve en español neutro (máx 240 caracteres).",
  ].join("\n");

  return callGeminiStructuredWithCascade({
    apiKey: config.apiKey,
    models: config.models,
    prompt,
    responseSchema: SKU_ARBITRATION_RESPONSE_SCHEMA,
    schema: skuArbitrationVerdictSchema,
    maxOutputTokens: 384,
    timeoutMs: config.timeoutMs,
    fetchFn: config.fetchFn,
    signal,
  });
}

export async function generateAnomalyDigestWithGemini(
  input: {
    digestDate: string;
    topProducts: readonly ProductPriceSummary[];
    flaggedProductsCount: number;
    outlierOffersCount: number;
  },
  config: GeminiClientConfig,
  signal?: AbortSignal
): Promise<GeminiStructuredResult<AnomalyDigestOutput>> {
  const productLines = input.topProducts.map((product) => {
    const sampleRetailers = product.retailers
      .slice(0, 4)
      .map(
        (r) =>
          `${r.retailerName}: "${r.rawTitle}" ($${r.normalizedUnitPriceUsd.toFixed(2)}/${product.baseUnit}, estado=${r.outlierStatus}${r.productTier ? `, gama=${r.productTier}` : ""})`
      )
      .join(" | ");
    return `- ${product.name} [${product.slug}]: spread=${product.spreadPct ?? 0}%, robustSpread=${product.robustSpreadPct ?? 0}%, outliers=${product.outlierCount}. Ofertas: ${sampleRetailers}`;
  });

  const prompt = [
    `Redacta en español neutro el resumen diario de dispersión de precios (${input.digestDate}) para la canasta básica en Venezuela.`,
    `Productos marcados para revisión: ${input.flaggedProductsCount}. Ofertas atípicas detectadas: ${input.outlierOffersCount}.`,
    "Productos con mayor brecha hoy:",
    ...productLines,
    "Instrucciones:",
    "- headline: titular breve y claro (máx 120 caracteres).",
    "- summary: síntesis ejecutiva de 2 a 3 oraciones explicando las causas principales (diferencias de gama/marca, errores de presentación o precios atípicos).",
    "- highlights: lista con los productos analizados indicando canonicalSlug, productName, spreadPct, primaryCause ('brand_tier'|'package_mismatch'|'retailer_outlier'|'mixed') y explanation breve en español neutro.",
  ].join("\n");

  return callGeminiStructuredWithCascade({
    apiKey: config.apiKey,
    models: config.models,
    prompt,
    responseSchema: ANOMALY_DIGEST_RESPONSE_SCHEMA,
    schema: anomalyDigestOutputSchema,
    maxOutputTokens: 1024,
    timeoutMs: config.timeoutMs,
    fetchFn: config.fetchFn,
    signal,
  });
}
