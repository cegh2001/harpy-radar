import { describe, expect, it, vi } from "vitest";
import type { ExchangeRateRow } from "@/db/schema";
import type {
  DolarApiParsedRates,
  ScrapedBcvRates,
} from "@/features/exchange-rates/domain/bcv-parser";
import { shouldPersistExchangeRate } from "@/features/exchange-rates/domain/rate-change";
import {
  syncExchangeRates,
  type SyncExchangeRatesDeps,
} from "@/features/exchange-rates/application/sync-exchange-rates";
import type { SaveExchangeRateInput } from "@/features/exchange-rates/infrastructure/exchange-rate-repository";

function makeRow(id: number, input: SaveExchangeRateInput): ExchangeRateRow {
  return {
    id,
    rateDate: input.rateDate,
    source: input.source,
    usdRate: input.usdRate.toFixed(6),
    eurRate: input.eurRate !== null ? input.eurRate.toFixed(6) : null,
    bcvDateText: input.bcvDateText,
    fetchedAt: input.fetchedAt,
    createdAt: input.fetchedAt,
  };
}

const SAMPLE_BCV: ScrapedBcvRates = {
  usd: 919.8227,
  eur: 971.45,
  bcvDateText: "Viernes, 27 Noviembre 2026",
  rateDate: "2026-11-27",
};

const SAMPLE_COTIZACIONES: ScrapedBcvRates = {
  usd: 919.8227,
  eur: 970.12,
  bcvDateText: "DolarAPI Fallback",
  rateDate: "2026-11-27",
};

const SAMPLE_DOLARES: DolarApiParsedRates = {
  official: { usd: 919.8227, rateDate: "2026-11-27" },
  parallel: { usd: 1109.6395, rateDate: "2026-11-27" },
};

describe("shouldPersistExchangeRate", () => {
  it("persists when there is no previous row or when rate fields change", () => {
    const base = {
      rateDate: "2026-11-27",
      source: "bcv_official",
      usdRate: 919.8227,
      eurRate: 971.45,
    };

    expect(shouldPersistExchangeRate(null, base)).toBe(true);
    expect(shouldPersistExchangeRate(base, { ...base })).toBe(false);
    expect(
      shouldPersistExchangeRate(base, { ...base, usdRate: 919.8227001 })
    ).toBe(false);
    expect(
      shouldPersistExchangeRate(base, { ...base, usdRate: 920.1 })
    ).toBe(true);
    expect(
      shouldPersistExchangeRate(base, { ...base, eurRate: 972.0 })
    ).toBe(true);
    expect(
      shouldPersistExchangeRate(base, { ...base, rateDate: "2026-11-28" })
    ).toBe(true);
  });

  it("upgrades fallback to bcv_official and ignores EUR-less downgrade on identical rate", () => {
    expect(
      shouldPersistExchangeRate(
        {
          rateDate: "2026-11-27",
          source: "dolarapi_official",
          usdRate: 919.8227,
          eurRate: null,
        },
        {
          rateDate: "2026-11-27",
          source: "bcv_official",
          usdRate: 919.8227,
          eurRate: 971.45,
        }
      )
    ).toBe(true);

    expect(
      shouldPersistExchangeRate(
        {
          rateDate: "2026-11-27",
          source: "bcv_official",
          usdRate: 919.8227,
          eurRate: 971.45,
        },
        {
          rateDate: "2026-11-27",
          source: "dolarapi_official",
          usdRate: 919.8227,
          eurRate: null,
        }
      )
    ).toBe(false);
  });
});

describe("syncExchangeRates", () => {
  it("uses lazy fallback in mode='all' without calling cotizaciones when BCV succeeds", async () => {
    const fetchBcv = vi.fn(async () => SAMPLE_BCV);
    const fetchCotizacionesFallback = vi.fn(async () => SAMPLE_COTIZACIONES);
    const fetchDolares = vi.fn(async () => SAMPLE_DOLARES);
    let nextId = 1;
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(nextId++, input),
        inserted: true,
      })
    );

    const deps: SyncExchangeRatesDeps = {
      fetchBcv,
      fetchCotizacionesFallback,
      fetchDolares,
      repository: { saveExchangeRateIfChanged },
      now: () => new Date("2026-11-27T17:30:00Z"),
    };

    const result = await syncExchangeRates(deps, undefined, "all");

    expect(fetchBcv).toHaveBeenCalledTimes(1);
    expect(fetchCotizacionesFallback).toHaveBeenCalledTimes(0);
    expect(fetchDolares).toHaveBeenCalledTimes(1);
    expect(saveExchangeRateIfChanged).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      mode: "all",
      officialRateId: 1,
      officialUsd: 919.8227,
      officialEur: 971.45,
      officialSource: "bcv_official",
      officialInserted: true,
      parallelRateId: 2,
      parallelUsd: 1109.6395,
      parallelInserted: true,
      gapPct: 20.64,
    });
  });

  it("falls back to cotizaciones when BCV fails in mode='all'", async () => {
    const fetchBcv = vi.fn(async () => {
      throw new Error("BCV timeout");
    });
    const fetchCotizacionesFallback = vi.fn(async () => SAMPLE_COTIZACIONES);
    const fetchDolares = vi.fn(async () => SAMPLE_DOLARES);
    let nextId = 10;
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(nextId++, input),
        inserted: true,
      })
    );

    const result = await syncExchangeRates(
      {
        fetchBcv,
        fetchCotizacionesFallback,
        fetchDolares,
        repository: { saveExchangeRateIfChanged },
        now: () => new Date("2026-11-27T17:30:00Z"),
      },
      undefined,
      "all"
    );

    expect(fetchBcv).toHaveBeenCalledTimes(1);
    expect(fetchCotizacionesFallback).toHaveBeenCalledTimes(1);
    expect(fetchDolares).toHaveBeenCalledTimes(1);
    expect(result.officialSource).toBe("dolarapi_official");
    expect(result.officialEur).toBe(970.12);
    expect(result.parallelUsd).toBe(1109.6395);
  });

  it("reuses the single fetchDolares call when BCV and cotizaciones both fail in mode='all'", async () => {
    const fetchBcv = vi.fn(async () => {
      throw new Error("BCV down");
    });
    const fetchCotizacionesFallback = vi.fn(async () => {
      throw new Error("Cotizaciones down");
    });
    const fetchDolares = vi.fn(async () => SAMPLE_DOLARES);
    let nextId = 20;
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(nextId++, input),
        inserted: true,
      })
    );

    const result = await syncExchangeRates(
      {
        fetchBcv,
        fetchCotizacionesFallback,
        fetchDolares,
        repository: { saveExchangeRateIfChanged },
        now: () => new Date("2026-11-27T17:30:00Z"),
      },
      undefined,
      "all"
    );

    expect(fetchBcv).toHaveBeenCalledTimes(1);
    expect(fetchCotizacionesFallback).toHaveBeenCalledTimes(1);
    expect(fetchDolares).toHaveBeenCalledTimes(1);
    expect(result.officialSource).toBe("dolarapi_official");
    expect(result.officialEur).toBeNull();
    expect(result.officialUsd).toBe(919.8227);
    expect(result.parallelUsd).toBe(1109.6395);
  });

  it("throws when all official sources fail without leaving unhandled rejections", async () => {
    const fetchBcv = vi.fn(async () => {
      throw new Error("BCV TLS failure");
    });
    const fetchCotizacionesFallback = vi.fn(async () => {
      throw new Error("Cotizaciones 503");
    });
    const fetchDolares = vi.fn(async () => {
      throw new Error("Dolares 503");
    });
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(1, input),
        inserted: true,
      })
    );

    await expect(
      syncExchangeRates(
        {
          fetchBcv,
          fetchCotizacionesFallback,
          fetchDolares,
          repository: { saveExchangeRateIfChanged },
          now: () => new Date("2026-11-27T17:30:00Z"),
        },
        undefined,
        "all"
      )
    ).rejects.toThrow("No official exchange rate source available: BCV TLS failure");

    expect(saveExchangeRateIfChanged).toHaveBeenCalledTimes(0);
  });

  it("fetches only BCV in mode='official' when BCV succeeds", async () => {
    const fetchBcv = vi.fn(async () => SAMPLE_BCV);
    const fetchCotizacionesFallback = vi.fn(async () => SAMPLE_COTIZACIONES);
    const fetchDolares = vi.fn(async () => SAMPLE_DOLARES);
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(31, input),
        inserted: true,
      })
    );

    const result = await syncExchangeRates(
      {
        fetchBcv,
        fetchCotizacionesFallback,
        fetchDolares,
        repository: { saveExchangeRateIfChanged },
        now: () => new Date("2026-11-27T17:30:00Z"),
      },
      undefined,
      "official"
    );

    expect(fetchBcv).toHaveBeenCalledTimes(1);
    expect(fetchCotizacionesFallback).toHaveBeenCalledTimes(0);
    expect(fetchDolares).toHaveBeenCalledTimes(0);
    expect(saveExchangeRateIfChanged).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({
      mode: "official",
      officialRateId: 31,
      officialUsd: 919.8227,
      officialEur: 971.45,
      officialSource: "bcv_official",
      officialInserted: true,
      parallelRateId: null,
      parallelUsd: null,
      parallelInserted: false,
      gapPct: null,
    });
  });

  it("uses DolarAPI only for official fallback in mode='official' and does not save parallel", async () => {
    const fetchBcv = vi.fn(async () => {
      throw new Error("BCV down");
    });
    const fetchCotizacionesFallback = vi.fn(async () => {
      throw new Error("Cotizaciones down");
    });
    const fetchDolares = vi.fn(async () => SAMPLE_DOLARES);
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(41, input),
        inserted: true,
      })
    );

    const result = await syncExchangeRates(
      {
        fetchBcv,
        fetchCotizacionesFallback,
        fetchDolares,
        repository: { saveExchangeRateIfChanged },
        now: () => new Date("2026-11-27T17:30:00Z"),
      },
      undefined,
      "official"
    );

    expect(fetchDolares).toHaveBeenCalledTimes(1);
    expect(saveExchangeRateIfChanged).toHaveBeenCalledTimes(1);
    expect(saveExchangeRateIfChanged.mock.calls[0]?.[0].source).toBe(
      "dolarapi_official"
    );
    expect(result.parallelRateId).toBeNull();
    expect(result.parallelUsd).toBeNull();
    expect(result.parallelInserted).toBe(false);
  });

  it("fetches only DolarAPI in mode='parallel' and throws if parallel rate is null", async () => {
    const fetchBcv = vi.fn(async () => SAMPLE_BCV);
    const fetchCotizacionesFallback = vi.fn(async () => SAMPLE_COTIZACIONES);
    const fetchDolares = vi.fn(async () => SAMPLE_DOLARES);
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(51, input),
        inserted: true,
      })
    );

    const result = await syncExchangeRates(
      {
        fetchBcv,
        fetchCotizacionesFallback,
        fetchDolares,
        repository: { saveExchangeRateIfChanged },
        now: () => new Date("2026-11-27T17:30:00Z"),
      },
      undefined,
      "parallel"
    );

    expect(fetchBcv).toHaveBeenCalledTimes(0);
    expect(fetchCotizacionesFallback).toHaveBeenCalledTimes(0);
    expect(fetchDolares).toHaveBeenCalledTimes(1);
    expect(saveExchangeRateIfChanged).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({
      mode: "parallel",
      officialRateId: null,
      officialUsd: null,
      officialEur: null,
      officialSource: null,
      officialInserted: false,
      parallelRateId: 51,
      parallelUsd: 1109.6395,
      parallelInserted: true,
      gapPct: null,
    });

    await expect(
      syncExchangeRates(
        {
          fetchBcv,
          fetchCotizacionesFallback,
          fetchDolares: vi.fn(async () => ({
            official: SAMPLE_DOLARES.official,
            parallel: null,
          })),
          repository: { saveExchangeRateIfChanged },
          now: () => new Date("2026-11-27T17:30:00Z"),
        },
        undefined,
        "parallel"
      )
    ).rejects.toThrow("No parallel exchange rate available from DolarAPI");
  });

  it("propagates inserted=false and existing IDs when rates are unchanged", async () => {
    const saveExchangeRateIfChanged = vi.fn(
      async (input: SaveExchangeRateInput) => ({
        row: makeRow(input.source === "dolarapi_parallel" ? 88 : 77, input),
        inserted: false,
      })
    );

    const result = await syncExchangeRates(
      {
        fetchBcv: vi.fn(async () => SAMPLE_BCV),
        fetchCotizacionesFallback: vi.fn(async () => SAMPLE_COTIZACIONES),
        fetchDolares: vi.fn(async () => SAMPLE_DOLARES),
        repository: { saveExchangeRateIfChanged },
        now: () => new Date("2026-11-27T17:30:00Z"),
      },
      undefined,
      "all"
    );

    expect(result.officialRateId).toBe(77);
    expect(result.officialInserted).toBe(false);
    expect(result.parallelRateId).toBe(88);
    expect(result.parallelInserted).toBe(false);
  });
});
