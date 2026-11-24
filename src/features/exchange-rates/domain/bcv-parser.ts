import { getCaracasDateKey } from "@/shared/lib/date/caracas-date";

export interface ScrapedBcvRates {
  usd: number;
  eur: number | null;
  bcvDateText: string;
  rateDate: string;
}

export interface DolarApiParsedRates {
  official: { usd: number; rateDate: string } | null;
  parallel: { usd: number; rateDate: string } | null;
}

export interface DualCurrencyConversion {
  priceUsdBcv: number;
  priceVes: number;
  priceUsdParallel: number | null;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Parses standard numbers or Venezuelan formatted strings (e.g. "919,8227" or "1.234,56").
 */
export function parseFlexibleNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;

  let normalized = trimmed;
  if (trimmed.includes(",") && trimmed.includes(".")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (trimmed.includes(",")) {
    normalized = trimmed.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function hasValidPositiveRates(
  usd: unknown,
  eur?: unknown
): boolean {
  const usdNum = parseFlexibleNumber(usd);
  if (!Number.isFinite(usdNum) || usdNum <= 0) {
    return false;
  }
  if (eur !== undefined && eur !== null) {
    const eurNum = parseFlexibleNumber(eur);
    return Number.isFinite(eurNum) && eurNum > 0;
  }
  return true;
}

function parseReferenceDate(section: string): {
  bcvDateText: string;
  rateDate: string;
} {
  const dateMatch = section.match(
    /Fecha Valor:[\s\S]*?content="([^"]+)"[^>]*>([^<]+)/i
  );

  let bcvDateText = "Unavailable";
  let rateDate = getCaracasDateKey();

  if (dateMatch) {
    bcvDateText = dateMatch[2].trim();
    const contentDate = dateMatch[1].trim();
    const parsed = new Date(contentDate);

    if (!Number.isNaN(parsed.getTime())) {
      rateDate = getCaracasDateKey(parsed);
    } else {
      const parts = bcvDateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (parts) {
        rateDate = `${parts[3]}-${parts[2]}-${parts[1]}`;
      }
    }
  }

  return { bcvDateText, rateDate };
}

function parseBCVHtmlFromDivBlocks(html: string): ScrapedBcvRates | null {
  const usdMatch = html.match(
    /<div id="dolar"[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i
  );
  const eurMatch = html.match(
    /<div id="euro"[\s\S]*?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i
  );

  if (!usdMatch || !eurMatch) {
    return null;
  }

  const { bcvDateText, rateDate } = parseReferenceDate(html);
  return {
    usd: parseFlexibleNumber(usdMatch[1]),
    eur: parseFlexibleNumber(eurMatch[1]),
    bcvDateText,
    rateDate,
  };
}

function parseBCVHtmlFromReferenceSection(html: string): ScrapedBcvRates | null {
  const sectionMatch = html.match(
    /Tipo de Cambio de Referencia[\s\S]*?Tasas Informativas del Sistema Bancario/i
  );
  if (!sectionMatch) {
    return null;
  }

  const section = sectionMatch[0];
  const usdMatch = section.match(/\bUSD\s*([\d.,]+)/i);
  const eurMatch = section.match(/\bEUR\s*([\d.,]+)/i);

  if (!usdMatch || !eurMatch) {
    return null;
  }

  const { bcvDateText, rateDate } = parseReferenceDate(section);
  return {
    usd: parseFlexibleNumber(usdMatch[1]),
    eur: parseFlexibleNumber(eurMatch[1]),
    bcvDateText,
    rateDate,
  };
}

export function parseBCVHtml(html: string): ScrapedBcvRates {
  const rates =
    parseBCVHtmlFromDivBlocks(html) ?? parseBCVHtmlFromReferenceSection(html);

  if (rates && hasValidPositiveRates(rates.usd, rates.eur)) {
    return rates;
  }
  throw new Error("Could not extract official USD/EUR rates from BCV HTML");
}

export function parseDolarApiDolares(payload: unknown): DolarApiParsedRates {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid DolarAPI /v1/dolares payload");
  }

  const extractEntry = (fuente: string) => {
    const entry = payload.find(
      (item): item is Record<string, unknown> =>
        typeof item === "object" &&
        item !== null &&
        (item as Record<string, unknown>).fuente === fuente
    );
    if (!entry) return null;

    const usd = parseFlexibleNumber(entry.promedio);
    if (!Number.isFinite(usd) || usd <= 0) return null;

    const rawDate =
      typeof entry.fechaActualizacion === "string"
        ? entry.fechaActualizacion
        : new Date().toISOString();
    const parsedDate = new Date(rawDate);
    const rateDate = Number.isNaN(parsedDate.getTime())
      ? getCaracasDateKey()
      : getCaracasDateKey(parsedDate);

    return { usd, rateDate };
  };

  return {
    official: extractEntry("oficial"),
    parallel: extractEntry("paralelo"),
  };
}

export function parseDolarApiCotizaciones(payload: unknown): ScrapedBcvRates {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid DolarAPI /v1/cotizaciones payload");
  }

  const usdEntry = payload.find(
    (item): item is Record<string, unknown> =>
      typeof item === "object" &&
      item !== null &&
      (item as Record<string, unknown>).moneda === "USD"
  );
  const eurEntry = payload.find(
    (item): item is Record<string, unknown> =>
      typeof item === "object" &&
      item !== null &&
      (item as Record<string, unknown>).moneda === "EUR"
  );

  const usd = parseFlexibleNumber(usdEntry?.promedio);
  const eur = parseFlexibleNumber(eurEntry?.promedio);

  if (!hasValidPositiveRates(usd, eur)) {
    throw new Error("DolarAPI cotizaciones payload missing valid USD/EUR");
  }

  const rawDate =
    typeof usdEntry?.fechaActualizacion === "string"
      ? usdEntry.fechaActualizacion
      : new Date().toISOString();
  const parsedDate = new Date(rawDate);
  const rateDate = Number.isNaN(parsedDate.getTime())
    ? getCaracasDateKey()
    : getCaracasDateKey(parsedDate);

  return {
    usd,
    eur,
    bcvDateText: "DolarAPI Fallback",
    rateDate,
  };
}

export function calculateExchangeGapPct(
  officialUsd: number,
  parallelUsd: number | null
): number | null {
  if (
    !Number.isFinite(officialUsd) ||
    officialUsd <= 0 ||
    parallelUsd === null ||
    !Number.isFinite(parallelUsd) ||
    parallelUsd <= 0
  ) {
    return null;
  }
  return Math.round(((parallelUsd - officialUsd) / officialUsd) * 10000) / 100;
}

export function convertToDualCurrency(input: {
  amount: number;
  currency: "USD" | "VES";
  officialUsdRate: number;
  parallelUsdRate: number | null;
}): DualCurrencyConversion {
  const { amount, currency, officialUsdRate, parallelUsdRate } = input;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative finite number");
  }
  if (!Number.isFinite(officialUsdRate) || officialUsdRate <= 0) {
    throw new Error("officialUsdRate must be positive");
  }

  const priceVes =
    currency === "VES" ? round4(amount) : round4(amount * officialUsdRate);
  const priceUsdBcv =
    currency === "USD" ? round4(amount) : round4(amount / officialUsdRate);
  const priceUsdParallel =
    parallelUsdRate && Number.isFinite(parallelUsdRate) && parallelUsdRate > 0
      ? round4(priceVes / parallelUsdRate)
      : null;

  return {
    priceUsdBcv,
    priceVes,
    priceUsdParallel,
  };
}
