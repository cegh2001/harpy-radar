"use client";

import { Fragment } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  ExternalLink,
} from "lucide-react";
import type { ProductTier } from "@/features/arbitration/domain/arbiter-schemas";
import type { RetailerPriceBreakdown } from "../domain/basket-index";
import {
  formatPackageSizeLabel,
  formatPct,
  formatRelativeIso,
  formatVes,
  type CurrencyDisplayMode,
  type DisplayUnitMeta,
} from "./formatters";
import { ProductAlternativesRow } from "./product-alternatives-row";
import {
  formatComparisonPackageValue,
  formatComparisonUnitValue,
} from "./product-comparison-helpers";

const TIER_LABELS: Record<ProductTier, string> = {
  basic: "Básico",
  standard: "Estándar",
  premium_imported: "Premium / Importado",
};

interface ProductComparisonTableProps {
  retailers: RetailerPriceBreakdown[];
  activePresentationLabel: string | null;
  currencyMode: CurrencyDisplayMode;
  unitMeta: DisplayUnitMeta;
  expandedChains: Record<string, boolean>;
  onToggleChain: (retailerSlug: string) => void;
}

export function ProductComparisonTable({
  retailers,
  activePresentationLabel,
  currencyMode,
  unitMeta,
  expandedChains,
  onToggleChain,
}: ProductComparisonTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
        Comparación por cadena
        {activePresentationLabel
          ? ` · Presentación ${activePresentationLabel}`
          : ""}
      </div>
      {retailers.length === 0 ? (
        <div className="p-6 text-sm text-slate-400">
          Aún no hay observaciones registradas para este filtro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-900/90 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Cadena</th>
                <th className="px-4 py-2.5">Producto detectado</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 text-right">Presentación</th>
                <th className="px-4 py-2.5 text-right">Precio empaque</th>
                <th className="px-4 py-2.5 text-right">Unitario</th>
                <th className="px-4 py-2.5 text-right">vs. Mejor</th>
                <th className="px-4 py-2.5 text-right">Observado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {retailers.map((obs) => {
                const isExpanded = Boolean(expandedChains[obs.retailerSlug]);
                const hasAlts = obs.alternatives.length > 0;
                const unitVes = obs.priceVes / obs.packageSize;
                const unitParallel =
                  obs.priceUsdParallel !== null
                    ? obs.priceUsdParallel / obs.packageSize
                    : null;
                const unitVal = formatComparisonUnitValue(
                  obs.normalizedUnitPriceUsd,
                  unitVes,
                  unitParallel,
                  currencyMode,
                  unitMeta.scale
                );
                const pkgVal = formatComparisonPackageValue(
                  obs.priceUsdBcv,
                  obs.priceVes,
                  obs.priceUsdParallel,
                  currencyMode
                );

                return (
                  <Fragment key={obs.retailerSlug}>
                    <tr className="transition-colors hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-100">
                          {obs.retailerName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {obs.region}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{obs.rawTitle}</span>
                          {obs.productTier && (
                            <span
                              title={obs.arbitrationReason ?? undefined}
                              className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300"
                            >
                              {TIER_LABELS[obs.productTier]}
                            </span>
                          )}
                          {obs.outlierStatus !== "normal" && (
                            <span
                              title={
                                obs.deviationFromMedianPct !== null
                                  ? `${formatPct(obs.deviationFromMedianPct)} vs. mediana`
                                  : undefined
                              }
                              className={
                                obs.outlierStatus === "low_outlier"
                                  ? "rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300"
                                  : "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                              }
                            >
                              {obs.outlierStatus === "low_outlier"
                                ? "Atípico bajo"
                                : "Atípico alto"}
                            </span>
                          )}
                          {obs.productUrl && (
                            <a
                              href={obs.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-slate-400 hover:text-emerald-300"
                              aria-label={`Abrir ficha en ${obs.retailerName}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        {hasAlts && (
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => onToggleChain(obs.retailerSlug)}
                            className="mt-1 inline-flex items-center gap-1 rounded border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
                          >
                            Mejor de {obs.matchedSkuCount} opciones
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {obs.inStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Disponible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
                            <CircleSlash className="h-3.5 w-3.5" />
                            Agotado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums whitespace-nowrap">
                        {formatPackageSizeLabel(
                          obs.packageSize,
                          obs.packageUnit
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 tabular-nums whitespace-nowrap">
                        <div>{pkgVal}</div>
                        {currencyMode !== "ves" && (
                          <div className="text-[11px] text-slate-400">
                            {formatVes(obs.priceVes)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-emerald-300">
                          {unitVal} / {unitMeta.unitLabel}
                        </div>
                        {unitMeta.isScaledDisplay && (
                          <div className="text-[11px] text-slate-400">
                            {formatComparisonUnitValue(
                              obs.normalizedUnitPriceUsd,
                              unitVes,
                              unitParallel,
                              currencyMode,
                              1
                            )}{" "}
                            / {obs.packageUnit}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {obs.deltaVsCheapestPct === null ? (
                          <span className="text-xs text-slate-500">—</span>
                        ) : obs.deltaVsCheapestPct <= 0.01 ? (
                          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                            Mejor precio
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-200">
                            {formatPct(obs.deltaVsCheapestPct)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap">
                        {formatRelativeIso(obs.observedAt)}
                      </td>
                    </tr>
                    {isExpanded && hasAlts && (
                      <ProductAlternativesRow
                        retailerName={obs.retailerName}
                        alternatives={obs.alternatives}
                        currencyMode={currencyMode}
                        displayScale={unitMeta.scale}
                        displayUnitLabel={unitMeta.unitLabel}
                      />
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
