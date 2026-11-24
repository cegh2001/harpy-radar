import { describe, expect, it } from "vitest";
import {
  calculateExchangeGapPct,
  convertToDualCurrency,
  parseBCVHtml,
  parseDolarApiCotizaciones,
  parseDolarApiDolares,
  parseFlexibleNumber,
} from "@/features/exchange-rates/domain/bcv-parser";

describe("bcv-parser", () => {
  it("parses Venezuelan formatted numbers and standard floats", () => {
    expect(parseFlexibleNumber("919,8227")).toBeCloseTo(919.8227, 4);
    expect(parseFlexibleNumber("1.234,56")).toBeCloseTo(1234.56, 2);
    expect(parseFlexibleNumber(1109.63)).toBe(1109.63);
    expect(Number.isNaN(parseFlexibleNumber(""))).toBe(true);
  });

  it("extracts USD and EUR rates from BCV div blocks", () => {
    const html = `
      <div id="dolar"><strong> 919,8227 </strong></div>
      <div id="euro"><strong> 971,4500 </strong></div>
      <span>Fecha Valor:</span><span content="2026-11-24T00:00:00-04:00">Martes, 24 Noviembre 2026</span>
    `;
    const parsed = parseBCVHtml(html);

    expect(parsed.usd).toBeCloseTo(919.8227, 4);
    expect(parsed.eur).toBeCloseTo(971.45, 2);
    expect(parsed.rateDate).toBe("2026-11-24");
    expect(parsed.bcvDateText).toBe("Martes, 24 Noviembre 2026");
  });

  it("parses DolarAPI /v1/dolares and /v1/cotizaciones responses", () => {
    const dolares = parseDolarApiDolares([
      {
        fuente: "oficial",
        promedio: 919.8227,
        fechaActualizacion: "2026-11-24T00:00:00-04:00",
      },
      {
        fuente: "paralelo",
        promedio: 1109.639477,
        fechaActualizacion: "2026-11-24T20:01:19.823Z",
      },
    ]);

    expect(dolares.official).toStrictEqual({
      usd: 919.8227,
      rateDate: "2026-11-24",
    });
    expect(dolares.parallel).toStrictEqual({
      usd: 1109.639477,
      rateDate: "2026-11-24",
    });

    const cotizaciones = parseDolarApiCotizaciones([
      {
        moneda: "USD",
        promedio: 919.8227,
        fechaActualizacion: "2026-11-24T00:00:00-04:00",
      },
      {
        moneda: "EUR",
        promedio: 970.12,
        fechaActualizacion: "2026-11-24T00:00:00-04:00",
      },
    ]);

    expect(cotizaciones.usd).toBeCloseTo(919.8227, 4);
    expect(cotizaciones.eur).toBeCloseTo(970.12, 2);
  });

  it("computes dual-currency conversions and exchange gap percentage", () => {
    const fromVes = convertToDualCurrency({
      amount: 1021,
      currency: "VES",
      officialUsdRate: 919.8227,
      parallelUsdRate: 1109.64,
    });

    expect(fromVes.priceVes).toBe(1021);
    expect(fromVes.priceUsdBcv).toBeCloseTo(1.11, 3);
    expect(fromVes.priceUsdParallel).toBeCloseTo(0.9201, 3);

    const fromUsd = convertToDualCurrency({
      amount: 1.43,
      currency: "USD",
      officialUsdRate: 919.8227,
      parallelUsdRate: 1109.64,
    });

    expect(fromUsd.priceUsdBcv).toBe(1.43);
    expect(fromUsd.priceVes).toBeCloseTo(1315.3465, 3);
    expect(calculateExchangeGapPct(919.8227, 1109.6395)).toBeCloseTo(20.64, 2);
  });
});
