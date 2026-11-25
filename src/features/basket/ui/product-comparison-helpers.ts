import type { RetailerPriceBreakdown } from "../domain/basket-index";
import { formatUsd, formatVes, type CurrencyDisplayMode } from "./formatters";

export function formatComparisonUnitValue(
  unitUsdBcv: number | null,
  unitVes: number | null,
  unitParallel: number | null,
  mode: CurrencyDisplayMode
): string {
  if (mode === "ves") return formatVes(unitVes);
  if (mode === "usd_parallel") return formatUsd(unitParallel);
  return formatUsd(unitUsdBcv);
}

export function formatComparisonPackageValue(
  priceUsdBcv: number,
  priceVes: number,
  priceParallel: number | null,
  mode: CurrencyDisplayMode
): string {
  if (mode === "ves") return formatVes(priceVes);
  if (mode === "usd_parallel") return formatUsd(priceParallel);
  return formatUsd(priceUsdBcv);
}

export function computeComparisonViewStats(
  retailers: RetailerPriceBreakdown[],
  regionFilter: string
) {
  const filtered =
    regionFilter === "all"
      ? retailers
      : retailers.filter((r) =>
          r.region.toLowerCase().includes(regionFilter.toLowerCase())
        );

  if (filtered.length === 0) {
    return {
      retailers: [] as RetailerPriceBreakdown[],
      cheapestUnitUsdBcv: null,
      averageUnitUsdBcv: null,
      cheapestUnitVes: null,
      averageUnitVes: null,
      cheapestUnitUsdParallel: null,
      averageUnitUsdParallel: null,
      spreadPct: null,
    };
  }

  const inStockList = filtered.filter((r) => r.inStock);
  const pool = inStockList.length > 0 ? inStockList : filtered;
  const unitBcv = pool
    .map((r) => r.normalizedUnitPriceUsd)
    .sort((a, b) => a - b);
  const minUnit = unitBcv[0];
  const maxUnit = unitBcv[unitBcv.length - 1];
  const avg = (vals: number[]) =>
    vals.reduce((s, v) => s + v, 0) / vals.length;

  const cheapest =
    pool.find((r) => r.normalizedUnitPriceUsd === minUnit) ?? pool[0];
  const parallelUnits = pool
    .filter((r) => r.priceUsdParallel !== null)
    .map((r) => (r.priceUsdParallel as number) / r.packageSize);

  const spreadPct =
    unitBcv.length > 1 && minUnit > 0
      ? Math.round(((maxUnit - minUnit) / minUnit) * 10000) / 100
      : null;

  const updatedRetailers = filtered.map((obs) => ({
    ...obs,
    deltaVsCheapestPct:
      minUnit > 0
        ? Math.round(
            ((obs.normalizedUnitPriceUsd - minUnit) / minUnit) * 10000
          ) / 100
        : null,
  }));

  return {
    retailers: updatedRetailers,
    cheapestUnitUsdBcv: cheapest.normalizedUnitPriceUsd,
    averageUnitUsdBcv: avg(unitBcv),
    cheapestUnitVes: cheapest.priceVes / cheapest.packageSize,
    averageUnitVes: avg(pool.map((r) => r.priceVes / r.packageSize)),
    cheapestUnitUsdParallel:
      cheapest.priceUsdParallel !== null
        ? cheapest.priceUsdParallel / cheapest.packageSize
        : null,
    averageUnitUsdParallel:
      parallelUnits.length > 0 ? avg(parallelUnits) : null,
    spreadPct,
  };
}
