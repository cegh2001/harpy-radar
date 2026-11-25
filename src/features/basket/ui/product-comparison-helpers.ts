import type { BaseUnit } from "@/features/catalog/domain/canonical-basket";
import type {
  RetailerOfferOption,
  RetailerPriceBreakdown,
} from "../domain/basket-index";
import {
  formatPackageSizeLabel,
  formatUsd,
  formatVes,
  type CurrencyDisplayMode,
} from "./formatters";

export interface PresentationOption {
  key: string;
  size: number;
  unit: BaseUnit;
  label: string;
  chainCount: number;
}

export function buildPresentationKey(size: number, unit: BaseUnit): string {
  return `${Number(size.toFixed(4))}:${unit}`;
}

function scaleNullable(value: number | null, scale: number): number | null {
  return value === null ? null : value * scale;
}

export function formatComparisonUnitValue(
  unitUsdBcv: number | null,
  unitVes: number | null,
  unitParallel: number | null,
  mode: CurrencyDisplayMode,
  scale = 1
): string {
  if (mode === "ves") return formatVes(scaleNullable(unitVes, scale));
  if (mode === "usd_parallel") {
    return formatUsd(scaleNullable(unitParallel, scale));
  }
  return formatUsd(scaleNullable(unitUsdBcv, scale));
}

export function formatComparisonPackageValue(
  priceUsdBcv: number | null,
  priceVes: number | null,
  priceParallel: number | null,
  mode: CurrencyDisplayMode
): string {
  if (mode === "ves") return formatVes(priceVes);
  if (mode === "usd_parallel") return formatUsd(priceParallel);
  return formatUsd(priceUsdBcv);
}

function breakdownToOfferOption(
  row: RetailerPriceBreakdown
): RetailerOfferOption {
  return {
    externalSku: row.externalSku,
    rawTitle: row.rawTitle,
    originalAmount: row.originalAmount,
    originalCurrency: row.originalCurrency,
    priceUsdBcv: row.priceUsdBcv,
    priceVes: row.priceVes,
    priceUsdParallel: row.priceUsdParallel,
    packageSize: row.packageSize,
    packageUnit: row.packageUnit,
    normalizedUnitPriceUsd: row.normalizedUnitPriceUsd,
    inStock: row.inStock,
    matchConfidence: row.matchConfidence,
    storeAvailabilityCount: row.storeAvailabilityCount,
    productUrl: row.productUrl,
    region: row.region,
    observedAt: row.observedAt,
  };
}

export function extractPresentationOptions(
  retailers: RetailerPriceBreakdown[],
  regionFilter: string
): PresentationOption[] {
  const filtered =
    regionFilter === "all"
      ? retailers
      : retailers.filter((r) =>
          r.region.toLowerCase().includes(regionFilter.toLowerCase())
        );

  const optionMap = new Map<string, PresentationOption>();

  for (const chain of filtered) {
    const chainKeys = new Set<string>();
    const allOffers = [breakdownToOfferOption(chain), ...chain.alternatives];

    for (const offer of allOffers) {
      const key = buildPresentationKey(offer.packageSize, offer.packageUnit);
      if (chainKeys.has(key)) continue;
      chainKeys.add(key);

      const existing = optionMap.get(key);
      if (existing) {
        existing.chainCount += 1;
      } else {
        optionMap.set(key, {
          key,
          size: offer.packageSize,
          unit: offer.packageUnit,
          label: formatPackageSizeLabel(offer.packageSize, offer.packageUnit),
          chainCount: 1,
        });
      }
    }
  }

  return Array.from(optionMap.values()).sort((a, b) => {
    if (b.chainCount !== a.chainCount) return b.chainCount - a.chainCount;
    return a.size - b.size;
  });
}

function filterRetailersByPresentation(
  retailers: RetailerPriceBreakdown[],
  presentationKey: string
): RetailerPriceBreakdown[] {
  if (!presentationKey || presentationKey === "all") return retailers;

  const promoted: RetailerPriceBreakdown[] = [];
  for (const chain of retailers) {
    const candidates = [breakdownToOfferOption(chain), ...chain.alternatives];
    const matching = candidates.filter(
      (c) => buildPresentationKey(c.packageSize, c.packageUnit) === presentationKey
    );
    if (matching.length === 0) continue;

    const best = matching[0];
    promoted.push({
      ...chain,
      externalSku: best.externalSku,
      rawTitle: best.rawTitle,
      originalAmount: best.originalAmount,
      originalCurrency: best.originalCurrency,
      priceUsdBcv: best.priceUsdBcv,
      priceVes: best.priceVes,
      priceUsdParallel: best.priceUsdParallel,
      packageSize: best.packageSize,
      packageUnit: best.packageUnit,
      normalizedUnitPriceUsd: best.normalizedUnitPriceUsd,
      inStock: best.inStock,
      matchConfidence: best.matchConfidence,
      matchedSkuCount: matching.length,
      alternatives: matching.slice(1),
      storeAvailabilityCount: best.storeAvailabilityCount,
      productUrl: best.productUrl,
      region: best.region,
      observedAt: best.observedAt,
    });
  }

  return promoted.sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return a.normalizedUnitPriceUsd - b.normalizedUnitPriceUsd;
  });
}

export function computeComparisonViewStats(
  retailers: RetailerPriceBreakdown[],
  regionFilter: string,
  presentationKey = "all"
) {
  const byRegion =
    regionFilter === "all"
      ? retailers
      : retailers.filter((r) =>
          r.region.toLowerCase().includes(regionFilter.toLowerCase())
        );

  const filtered = filterRetailersByPresentation(byRegion, presentationKey);

  if (filtered.length === 0) {
    return {
      retailers: [] as RetailerPriceBreakdown[],
      cheapestUnitUsdBcv: null,
      averageUnitUsdBcv: null,
      cheapestUnitVes: null,
      averageUnitVes: null,
      cheapestUnitUsdParallel: null,
      averageUnitUsdParallel: null,
      cheapestPackageUsdBcv: null,
      averagePackageUsdBcv: null,
      cheapestPackageVes: null,
      averagePackageVes: null,
      cheapestPackageUsdParallel: null,
      averagePackageUsdParallel: null,
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
  const parallelPkgs = pool
    .filter((r) => r.priceUsdParallel !== null)
    .map((r) => r.priceUsdParallel as number);

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
    cheapestPackageUsdBcv: cheapest.priceUsdBcv,
    averagePackageUsdBcv: avg(pool.map((r) => r.priceUsdBcv)),
    cheapestPackageVes: cheapest.priceVes,
    averagePackageVes: avg(pool.map((r) => r.priceVes)),
    cheapestPackageUsdParallel: cheapest.priceUsdParallel,
    averagePackageUsdParallel:
      parallelPkgs.length > 0 ? avg(parallelPkgs) : null,
    spreadPct,
  };
}
