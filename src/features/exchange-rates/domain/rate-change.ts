export interface ComparableExchangeRate {
  rateDate: string;
  source: string;
  usdRate: number;
  eurRate: number | null;
}

function formatRate6(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return value.toFixed(6);
}

/**
 * Determines whether a newly fetched exchange rate should be persisted.
 * Skips redundant inserts when rateDate, USD, and EUR match the latest stored quote
 * and avoids overwriting a complete BCV quote with a EUR-less fallback.
 */
export function shouldPersistExchangeRate(
  previous: ComparableExchangeRate | null,
  next: ComparableExchangeRate
): boolean {
  if (!previous) {
    return true;
  }

  if (
    previous.source === "dolarapi_official" &&
    next.source === "bcv_official"
  ) {
    return true;
  }

  if (previous.rateDate !== next.rateDate) {
    return true;
  }

  if (formatRate6(previous.usdRate) !== formatRate6(next.usdRate)) {
    return true;
  }

  if (
    previous.source === "bcv_official" &&
    next.source === "dolarapi_official" &&
    next.eurRate === null
  ) {
    return false;
  }

  return formatRate6(previous.eurRate) !== formatRate6(next.eurRate);
}
