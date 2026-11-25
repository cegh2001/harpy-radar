"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  ExternalLink,
} from "lucide-react";
import type { ProductDetailSnapshot } from "../application/get-dashboard-snapshot";
import type { ProductPriceSummary } from "../domain/basket-index";
import {
  CATEGORY_LABELS,
  formatPct,
  formatRelativeIso,
  formatVes,
  type CurrencyDisplayMode,
} from "./formatters";
import { ProductAlternativesRow } from "./product-alternatives-row";
import {
  computeComparisonViewStats,
  formatComparisonPackageValue,
  formatComparisonUnitValue,
} from "./product-comparison-helpers";
import { ProductHistoryChart } from "./product-history-chart";

interface ProductComparisonViewProps {
  product: ProductPriceSummary;
  history: ProductDetailSnapshot["history"];
}

const REGIONS = [
  { id: "all", label: "Todas las regiones" },
  { id: "La Guaira", label: "La Guaira" },
  { id: "Caracas", label: "Caracas" },
] as const;

const CURRENCY_MODES: Array<{ id: CurrencyDisplayMode; label: string }> = [
  { id: "usd_bcv", label: "USD (BCV)" },
  { id: "ves", label: "VES (Bs.)" },
  { id: "usd_parallel", label: "USD (Paralelo)" },
];

export function ProductComparisonView({
  product,
  history,
}: ProductComparisonViewProps) {
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [currencyMode, setCurrencyMode] =
    useState<CurrencyDisplayMode>("usd_bcv");
  const [expandedChains, setExpandedChains] = useState<Record<string, boolean>>(
    {}
  );

  const viewStats = useMemo(
    () => computeComparisonViewStats(product.retailers, regionFilter),
    [product.retailers, regionFilter]
  );

  const filteredHistory = useMemo(() => {
    if (regionFilter === "all") return history;
    const visibleSlugs = new Set(
      viewStats.retailers.map((r) => r.retailerSlug)
    );
    return history.filter((point) => visibleSlugs.has(point.retailerSlug));
  }, [history, regionFilter, viewStats.retailers]);

  function toggleChain(retailerSlug: string) {
    setExpandedChains((prev) => ({
      ...prev,
      [retailerSlug]: !prev[retailerSlug],
    }));
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al monitor
            </Link>
            <h1 className="text-2xl font-bold text-slate-50">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-md border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-slate-300">
                {CATEGORY_LABELS[product.category]}
              </span>
              <span>Unidad base: {product.baseUnit}</span>
              <span>·</span>
              <span>
                Peso mensual en canasta: {product.basketMonthlyQty}{" "}
                {product.baseUnit}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-right tabular-nums">
            <div>
              <div className="text-xs text-slate-400">
                Mejor precio unitario
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {formatComparisonUnitValue(
                  viewStats.cheapestUnitUsdBcv,
                  viewStats.cheapestUnitVes,
                  viewStats.cheapestUnitUsdParallel,
                  currencyMode
                )}{" "}
                / {product.baseUnit}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Precio promedio</div>
              <div className="text-xl font-bold text-slate-100">
                {formatComparisonUnitValue(
                  viewStats.averageUnitUsdBcv,
                  viewStats.averageUnitVes,
                  viewStats.averageUnitUsdParallel,
                  currencyMode
                )}{" "}
                / {product.baseUnit}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">
                Dispersión entre cadenas
              </div>
              <div className="text-xl font-bold text-amber-200">
                {formatPct(viewStats.spreadPct)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {REGIONS.map((region) => (
              <button
                key={region.id}
                type="button"
                onClick={() => setRegionFilter(region.id)}
                className={
                  regionFilter === region.id
                    ? "rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40"
                    : "rounded-lg bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
                }
              >
                {region.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              {CURRENCY_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setCurrencyMode(mode.id)}
                  className={
                    currencyMode === mode.id
                      ? "rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                      : "rounded-md px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                  }
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <span className="rounded-md border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-xs text-slate-400 tabular-nums">
              {viewStats.retailers.length} cadena(s)
            </span>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
            Comparación por cadena
          </div>
          {viewStats.retailers.length === 0 ? (
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
                  {viewStats.retailers.map((obs) => {
                    const isExpanded = Boolean(expandedChains[obs.retailerSlug]);
                    const hasAlts = obs.alternatives.length > 0;
                    const unitVal = formatComparisonUnitValue(
                      obs.normalizedUnitPriceUsd,
                      obs.priceVes / obs.packageSize,
                      obs.priceUsdParallel !== null
                        ? obs.priceUsdParallel / obs.packageSize
                        : null,
                      currencyMode
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
                            <div className="flex items-center gap-1.5">
                              <span>{obs.rawTitle}</span>
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
                                onClick={() => toggleChain(obs.retailerSlug)}
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
                            {obs.packageSize} {obs.packageUnit}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-200 tabular-nums whitespace-nowrap">
                            <div>{pkgVal}</div>
                            {currencyMode !== "ves" && (
                              <div className="text-[11px] text-slate-400">
                                {formatVes(obs.priceVes)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
                            {unitVal} / {obs.packageUnit}
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

        <ProductHistoryChart
          history={filteredHistory}
          baseUnit={product.baseUnit}
        />
      </div>
    </div>
  );
}
