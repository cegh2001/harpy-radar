import {
  calculateExchangeGapPct,
  type DolarApiParsedRates,
  type ScrapedBcvRates,
} from "../domain/bcv-parser";
import {
  fetchDolarApiCotizaciones,
  fetchDolarApiDolares,
  fetchOfficialBcvRates,
} from "../infrastructure/bcv-http";
import {
  exchangeRateRepository,
  type ExchangeRateRepositoryPort,
} from "../infrastructure/exchange-rate-repository";

export interface SyncExchangeRatesDeps {
  fetchBcv: (signal?: AbortSignal) => Promise<ScrapedBcvRates>;
  fetchCotizacionesFallback: (signal?: AbortSignal) => Promise<ScrapedBcvRates>;
  fetchDolares: (signal?: AbortSignal) => Promise<DolarApiParsedRates>;
  repository: Pick<ExchangeRateRepositoryPort, "saveExchangeRate">;
  now: () => Date;
}

export interface SyncExchangeRatesResult {
  officialRateId: number;
  officialUsd: number;
  officialEur: number | null;
  officialSource: "bcv_official" | "dolarapi_official";
  parallelRateId: number | null;
  parallelUsd: number | null;
  gapPct: number | null;
}

const defaultDeps: SyncExchangeRatesDeps = {
  fetchBcv: fetchOfficialBcvRates,
  fetchCotizacionesFallback: fetchDolarApiCotizaciones,
  fetchDolares: fetchDolarApiDolares,
  repository: exchangeRateRepository,
  now: () => new Date(),
};

export async function syncExchangeRates(
  deps: SyncExchangeRatesDeps = defaultDeps,
  signal?: AbortSignal
): Promise<SyncExchangeRatesResult> {
  const fetchedAt = deps.now();

  const [bcvSettled, cotizacionesSettled, dolaresSettled] =
    await Promise.allSettled([
      deps.fetchBcv(signal),
      deps.fetchCotizacionesFallback(signal),
      deps.fetchDolares(signal),
    ]);

  let officialSource: "bcv_official" | "dolarapi_official";
  let officialRates: ScrapedBcvRates;

  if (bcvSettled.status === "fulfilled") {
    officialSource = "bcv_official";
    officialRates = bcvSettled.value;
  } else if (cotizacionesSettled.status === "fulfilled") {
    officialSource = "dolarapi_official";
    officialRates = cotizacionesSettled.value;
  } else if (
    dolaresSettled.status === "fulfilled" &&
    dolaresSettled.value.official !== null
  ) {
    officialSource = "dolarapi_official";
    officialRates = {
      usd: dolaresSettled.value.official.usd,
      eur: null,
      bcvDateText: "DolarAPI Official Fallback",
      rateDate: dolaresSettled.value.official.rateDate,
    };
  } else {
    const bcvMsg =
      bcvSettled.reason instanceof Error
        ? bcvSettled.reason.message
        : String(bcvSettled.reason);
    throw new Error(`No official exchange rate source available: ${bcvMsg}`);
  }

  const savedOfficial = await deps.repository.saveExchangeRate({
    rateDate: officialRates.rateDate,
    source: officialSource,
    usdRate: officialRates.usd,
    eurRate: officialRates.eur,
    bcvDateText: officialRates.bcvDateText,
    fetchedAt,
  });

  let savedParallelId: number | null = null;
  let parallelUsd: number | null = null;

  if (
    dolaresSettled.status === "fulfilled" &&
    dolaresSettled.value.parallel !== null
  ) {
    const parallel = dolaresSettled.value.parallel;
    const savedParallel = await deps.repository.saveExchangeRate({
      rateDate: parallel.rateDate,
      source: "dolarapi_parallel",
      usdRate: parallel.usd,
      eurRate: null,
      bcvDateText: "DolarAPI Parallel",
      fetchedAt,
    });
    savedParallelId = savedParallel.id;
    parallelUsd = parallel.usd;
  }

  return {
    officialRateId: savedOfficial.id,
    officialUsd: officialRates.usd,
    officialEur: officialRates.eur,
    officialSource,
    parallelRateId: savedParallelId,
    parallelUsd,
    gapPct: calculateExchangeGapPct(officialRates.usd, parallelUsd),
  };
}
