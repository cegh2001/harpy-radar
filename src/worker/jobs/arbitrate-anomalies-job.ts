import { env } from "@/shared/config/env";
import { runArbitrationCycle } from "@/features/arbitration/application/run-arbitration-cycle";
import {
  DEFAULT_ARBITER_MODELS,
  DEFAULT_DIGEST_MODELS,
  parseModelCascade,
} from "@/features/arbitration/domain/arbiter-policy";
import { arbitrationRepository } from "@/features/arbitration/infrastructure/arbitration-repository";
import {
  arbitrateSkuWithGemini,
  generateAnomalyDigestWithGemini,
} from "@/features/arbitration/infrastructure/gemini-arbiter-client";
import { catalogRepository } from "@/features/catalog/infrastructure/catalog-repository";
import { priceRepository } from "@/features/retailers/infrastructure/price-repository";

export async function runArbitrateAnomaliesJob(signal?: AbortSignal) {
  const arbiterModels = parseModelCascade(
    env.ARBITER_MODEL_CASCADE,
    DEFAULT_ARBITER_MODELS
  );
  const digestModels = parseModelCascade(
    env.DIGEST_MODEL_CASCADE,
    DEFAULT_DIGEST_MODELS
  );

  const summary = await runArbitrationCycle(
    {
      enabled: env.ARBITER_ENABLED,
      apiKey: env.GEMINI_API_KEY,
      maxDailyCalls: env.ARBITER_MAX_DAILY_CALLS,
      cacheTtlDays: env.ARBITER_CACHE_TTL_DAYS,
      getCatalog: () => catalogRepository.getActiveCanonicalProducts(),
      getLatestObservations: () => priceRepository.getLatestObservations("all"),
      arbitrationRepo: arbitrationRepository,
      arbitrateSku: (candidate, innerSignal) =>
        arbitrateSkuWithGemini(
          candidate,
          {
            apiKey: env.GEMINI_API_KEY ?? "",
            models: arbiterModels,
          },
          innerSignal
        ),
      generateDigest: (input, innerSignal) =>
        generateAnomalyDigestWithGemini(
          input,
          {
            apiKey: env.GEMINI_API_KEY ?? "",
            models: digestModels,
          },
          innerSignal
        ),
    },
    signal
  );

  console.log(
    `[Worker] arbitrate-anomalies ${summary.status}: evaluated=${summary.candidatesEvaluated}, arbitrated=${summary.arbitratedCount}, rejected=${summary.rejectedMatchesCount}, digest=${summary.digestGenerated}, budgetRemaining=${summary.budgetRemaining}`
  );
  return summary;
}
