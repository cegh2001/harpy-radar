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

export type SyncExchangeRatesMode = "all" | "official" | "parallel";

export interface SyncExchangeRatesDeps {
  fetchBcv: (signal?: AbortSignal) => Promise<ScrapedBcvRates>;
  fetchCotizacionesFallback: (signal?: AbortSignal) => Promise<ScrapedBcvRates>;
  fetchDolares: (signal?: AbortSignal) => Promise<DolarApiParsedRates>;
  repository: Pick<ExchangeRateRepositoryPort, "saveExchangeRateIfChanged">;
  now: () => Date;
}

export interface SyncExchangeRatesResult {
  mode: SyncExchangeRatesMode;
  officialRateId: number | null;
  officialUsd: number | null;
  officialEur: number | null;
  officialSource: "bcv_official" | "dolarapi_official" | null;
  officialInserted: boolean;
  parallelRateId: number | null;
  parallelUsd: number | null;
  parallelInserted: boolean;
  gapPct: number | null;
}

type SettledOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; reason: unknown };

interface ResolvedOfficialRate {
  source: "bcv_official" | "dolarapi_official";
  rates: ScrapedBcvRates;
}

const defaultDeps: SyncExchangeRatesDeps = {
  fetchBcv: fetchOfficialBcvRates,
  fetchCotizacionesFallback: fetchDolarApiCotizaciones,
  fetchDolares: fetchDolarApiDolares,
  repository: exchangeRateRepository,
  now: () => new Date(),
};

function toSettledPromise<T>(
  promise: Promise<T>
): Promise<SettledOutcome<T>> {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (reason: unknown) => ({ ok: false as const, reason })
  );
}

async function resolveOfficialRates(
  deps: SyncExchangeRatesDeps,
  signal: AbortSignal | undefined,
  getDolares: () => Promise<DolarApiParsedRates>
): Promise<ResolvedOfficialRate> {
  let bcvError: unknown;

  try {
    const rates = await deps.fetchBcv(signal);
    return { source: "bcv_official", rates };
  } catch (error) {
    bcvError = error;
  }

  try {
    const rates = await deps.fetchCotizacionesFallback(signal);
    return { source: "dolarapi_official", rates };
  } catch {
    // Fall through to DolarAPI /v1/dolares official entry.
  }

  try {
    const dolares = await getDolares();
    if (dolares.official !== null) {
      return {
        source: "dolarapi_official",
        rates: {
          usd: dolares.official.usd,
          eur: null,
          bcvDateText: "DolarAPI Official Fallback",
          rateDate: dolares.official.rateDate,
        },
      };
    }
  } catch {
    // Throw original BCV unavailability error below.
  }

  const bcvMsg =
    bcvError instanceof Error ? bcvError.message : String(bcvError);
  throw new Error(`No official exchange rate source available: ${bcvMsg}`);
}

export async function syncExchangeRates(
  deps: SyncExchangeRatesDeps = defaultDeps,
  signal?: AbortSignal,
  mode: SyncExchangeRatesMode = "all"
): Promise<SyncExchangeRatesResult> {
  const fetchedAt = deps.now();

  if (mode === "parallel") {
    const dolares = await deps.fetchDolares(signal);
    if (dolares.parallel === null) {
      throw new Error("No parallel exchange rate available from DolarAPI");
    }

    const savedParallel = await deps.repository.saveExchangeRateIfChanged({
      rateDate: dolares.parallel.rateDate,
      source: "dolarapi_parallel",
      usdRate: dolares.parallel.usd,
      eurRate: null,
      bcvDateText: "DolarAPI Parallel",
      fetchedAt,
    });

    return {
      mode,
      officialRateId: null,
      officialUsd: null,
      officialEur: null,
      officialSource: null,
      officialInserted: false,
      parallelRateId: savedParallel.row.id,
      parallelUsd: dolares.parallel.usd,
      parallelInserted: savedParallel.inserted,
      gapPct: null,
    };
  }

  let memoizedDolaresPromise: Promise<SettledOutcome<DolarApiParsedRates>> | null =
    mode === "all" ? toSettledPromise(deps.fetchDolares(signal)) : null;

  const getDolares = async (): Promise<DolarApiParsedRates> => {
    if (!memoizedDolaresPromise) {
      memoizedDolaresPromise = toSettledPromise(deps.fetchDolares(signal));
    }
    const outcome = await memoizedDolaresPromise;
    if (!outcome.ok) {
      throw outcome.reason;
    }
    return outcome.value;
  };

  const official = await resolveOfficialRates(deps, signal, getDolares);
  const savedOfficial = await deps.repository.saveExchangeRateIfChanged({
    rateDate: official.rates.rateDate,
    source: official.source,
    usdRate: official.rates.usd,
    eurRate: official.rates.eur,
    bcvDateText: official.rates.bcvDateText,
    fetchedAt,
  });

  if (mode === "official") {
    return {
      mode,
      officialRateId: savedOfficial.row.id,
      officialUsd: official.rates.usd,
      officialEur: official.rates.eur,
      officialSource: official.source,
      officialInserted: savedOfficial.inserted,
      parallelRateId: null,
      parallelUsd: null,
      parallelInserted: false,
      gapPct: null,
    };
  }

  let parallelRateId: number | null = null;
  let parallelUsd: number | null = null;
  let parallelInserted = false;

  const dolaresOutcome = await memoizedDolaresPromise!;
  if (dolaresOutcome.ok && dolaresOutcome.value.parallel !== null) {
    const parallel = dolaresOutcome.value.parallel;
    const savedParallel = await deps.repository.saveExchangeRateIfChanged({
      rateDate: parallel.rateDate,
      source: "dolarapi_parallel",
      usdRate: parallel.usd,
      eurRate: null,
      bcvDateText: "DolarAPI Parallel",
      fetchedAt,
    });
    parallelRateId = savedParallel.row.id;
    parallelUsd = parallel.usd;
    parallelInserted = savedParallel.inserted;
  }

  return {
    mode,
    officialRateId: savedOfficial.row.id,
    officialUsd: official.rates.usd,
    officialEur: official.rates.eur,
    officialSource: official.source,
    officialInserted: savedOfficial.inserted,
    parallelRateId,
    parallelUsd,
    parallelInserted,
    gapPct: calculateExchangeGapPct(official.rates.usd, parallelUsd),
  };
}
