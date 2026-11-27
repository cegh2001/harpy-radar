import { desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { exchangeRates, type ExchangeRateRow } from "@/db/schema";
import { calculateExchangeGapPct } from "../domain/bcv-parser";
import { shouldPersistExchangeRate } from "../domain/rate-change";

export interface SaveExchangeRateInput {
  rateDate: string;
  source: "bcv_official" | "dolarapi_official" | "dolarapi_parallel";
  usdRate: number;
  eurRate: number | null;
  bcvDateText: string | null;
  fetchedAt: Date;
}

export interface SaveExchangeRateIfChangedResult {
  row: ExchangeRateRow;
  inserted: boolean;
}

export interface LatestRatesSnapshot {
  official: {
    id: number;
    usdRate: number;
    eurRate: number | null;
    rateDate: string;
    bcvDateText: string | null;
    source: string;
    fetchedAt: Date;
  } | null;
  parallel: {
    id: number;
    usdRate: number;
    rateDate: string;
    source: string;
    fetchedAt: Date;
  } | null;
  gapPct: number | null;
}

export interface ExchangeRateRepositoryPort {
  saveExchangeRate(input: SaveExchangeRateInput): Promise<ExchangeRateRow>;
  saveExchangeRateIfChanged(
    input: SaveExchangeRateInput
  ): Promise<SaveExchangeRateIfChangedResult>;
  getLatestRatesSnapshot(): Promise<LatestRatesSnapshot>;
  getRateHistory(limit?: number): Promise<ExchangeRateRow[]>;
}

async function insertExchangeRate(
  input: SaveExchangeRateInput
): Promise<ExchangeRateRow> {
  const [inserted] = await db
    .insert(exchangeRates)
    .values({
      rateDate: input.rateDate,
      source: input.source,
      usdRate: input.usdRate.toFixed(6),
      eurRate: input.eurRate !== null ? input.eurRate.toFixed(6) : null,
      bcvDateText: input.bcvDateText,
      fetchedAt: input.fetchedAt,
    })
    .returning();

  return inserted;
}

export const exchangeRateRepository: ExchangeRateRepositoryPort = {
  async saveExchangeRate(input: SaveExchangeRateInput): Promise<ExchangeRateRow> {
    return insertExchangeRate(input);
  },

  async saveExchangeRateIfChanged(
    input: SaveExchangeRateInput
  ): Promise<SaveExchangeRateIfChangedResult> {
    const trackSources =
      input.source === "dolarapi_parallel"
        ? ["dolarapi_parallel"]
        : ["bcv_official", "dolarapi_official"];

    const [latestRow] = await db
      .select()
      .from(exchangeRates)
      .where(inArray(exchangeRates.source, trackSources))
      .orderBy(desc(exchangeRates.fetchedAt), desc(exchangeRates.id))
      .limit(1);

    if (
      latestRow &&
      !shouldPersistExchangeRate(
        {
          rateDate: latestRow.rateDate,
          source: latestRow.source,
          usdRate: Number(latestRow.usdRate),
          eurRate: latestRow.eurRate ? Number(latestRow.eurRate) : null,
        },
        {
          rateDate: input.rateDate,
          source: input.source,
          usdRate: input.usdRate,
          eurRate: input.eurRate,
        }
      )
    ) {
      return { row: latestRow, inserted: false };
    }

    const row = await insertExchangeRate(input);
    return { row, inserted: true };
  },

  async getLatestRatesSnapshot(): Promise<LatestRatesSnapshot> {
    const [officialRow] = await db
      .select()
      .from(exchangeRates)
      .where(inArray(exchangeRates.source, ["bcv_official", "dolarapi_official"]))
      .orderBy(desc(exchangeRates.fetchedAt), desc(exchangeRates.id))
      .limit(1);

    const [parallelRow] = await db
      .select()
      .from(exchangeRates)
      .where(inArray(exchangeRates.source, ["dolarapi_parallel"]))
      .orderBy(desc(exchangeRates.fetchedAt), desc(exchangeRates.id))
      .limit(1);

    const official = officialRow
      ? {
          id: officialRow.id,
          usdRate: Number(officialRow.usdRate),
          eurRate: officialRow.eurRate ? Number(officialRow.eurRate) : null,
          rateDate: officialRow.rateDate,
          bcvDateText: officialRow.bcvDateText,
          source: officialRow.source,
          fetchedAt: officialRow.fetchedAt,
        }
      : null;

    const parallel = parallelRow
      ? {
          id: parallelRow.id,
          usdRate: Number(parallelRow.usdRate),
          rateDate: parallelRow.rateDate,
          source: parallelRow.source,
          fetchedAt: parallelRow.fetchedAt,
        }
      : null;

    const gapPct =
      official && parallel
        ? calculateExchangeGapPct(official.usdRate, parallel.usdRate)
        : null;

    return { official, parallel, gapPct };
  },

  async getRateHistory(limit = 30): Promise<ExchangeRateRow[]> {
    return db
      .select()
      .from(exchangeRates)
      .orderBy(desc(exchangeRates.fetchedAt))
      .limit(limit);
  },
};
