"use client";

import { ExternalLink } from "lucide-react";
import type { RetailerOfferOption } from "../domain/basket-index";
import {
  formatPackageSizeLabel,
  formatRelativeIso,
  type CurrencyDisplayMode,
} from "./formatters";
import {
  formatComparisonPackageValue,
  formatComparisonUnitValue,
} from "./product-comparison-helpers";

interface ProductAlternativesRowProps {
  retailerName: string;
  alternatives: RetailerOfferOption[];
  currencyMode: CurrencyDisplayMode;
  displayScale?: number;
  displayUnitLabel?: string;
}

export function ProductAlternativesRow({
  retailerName,
  alternatives,
  currencyMode,
  displayScale = 1,
  displayUnitLabel,
}: ProductAlternativesRowProps) {
  return (
    <tr className="bg-slate-950/70">
      <td colSpan={8} className="px-6 py-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Otras opciones comparables en {retailerName}
        </div>
        <div className="divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/50">
          {alternatives.map((alt) => (
            <div
              key={`${alt.externalSku ?? alt.rawTitle}-${alt.packageSize}`}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
            >
              <div className="flex min-w-[220px] flex-1 items-center gap-1.5 text-slate-200">
                <span>{alt.rawTitle}</span>
                {alt.productUrl && (
                  <a
                    href={alt.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-emerald-300"
                    aria-label={`Abrir ${alt.rawTitle} en ${retailerName}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-4 tabular-nums text-slate-300">
                <span
                  className={alt.inStock ? "text-emerald-400" : "text-rose-400"}
                >
                  {alt.inStock ? "Disponible" : "Agotado"}
                </span>
                <span>
                  {formatPackageSizeLabel(alt.packageSize, alt.packageUnit)}
                </span>
                <span>
                  {formatComparisonPackageValue(
                    alt.priceUsdBcv,
                    alt.priceVes,
                    alt.priceUsdParallel,
                    currencyMode
                  )}
                </span>
                <span className="font-semibold text-slate-100">
                  {formatComparisonUnitValue(
                    alt.normalizedUnitPriceUsd,
                    alt.priceVes / alt.packageSize,
                    alt.priceUsdParallel !== null
                      ? alt.priceUsdParallel / alt.packageSize
                      : null,
                    currencyMode,
                    displayScale
                  )}{" "}
                  / {displayUnitLabel ?? alt.packageUnit}
                </span>
                <span className="text-slate-500">
                  {formatRelativeIso(alt.observedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}
