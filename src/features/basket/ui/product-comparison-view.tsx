"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ProductDetailSnapshot } from "../application/get-dashboard-snapshot";
import type { ProductPriceSummary } from "../domain/basket-index";
import {
  CATEGORY_LABELS,
  formatPct,
  getDisplayUnitMeta,
  type CurrencyDisplayMode,
} from "./formatters";
import {
  computeComparisonViewStats,
  extractPresentationOptions,
  formatComparisonPackageValue,
  formatComparisonUnitValue,
} from "./product-comparison-helpers";
import { ProductComparisonTable } from "./product-comparison-table";
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
  const [presentationFilter, setPresentationFilter] = useState<string>("all");
  const [currencyMode, setCurrencyMode] =
    useState<CurrencyDisplayMode>("usd_bcv");
  const [expandedChains, setExpandedChains] = useState<Record<string, boolean>>(
    {}
  );

  const unitMeta = getDisplayUnitMeta(product);

  const presentationOptions = useMemo(
    () => extractPresentationOptions(product.retailers, regionFilter),
    [product.retailers, regionFilter]
  );

  const activePresentation =
    presentationFilter !== "all" &&
    presentationOptions.some((opt) => opt.key === presentationFilter)
      ? presentationFilter
      : "all";

  const activeOption =
    presentationOptions.find((opt) => opt.key === activePresentation) ?? null;

  const viewStats = useMemo(
    () =>
      computeComparisonViewStats(
        product.retailers,
        regionFilter,
        activePresentation
      ),
    [product.retailers, regionFilter, activePresentation]
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
              <span>
                {unitMeta.isScaledDisplay
                  ? `Referencia: ${unitMeta.referenceLabel}`
                  : `Unidad base: ${product.baseUnit}`}
              </span>
              <span>·</span>
              <span>Peso mensual en canasta: {unitMeta.monthlyQtyLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-right tabular-nums">
            <div>
              <div className="text-xs text-slate-400">
                {activeOption
                  ? `Mejor precio (${activeOption.label})`
                  : "Mejor precio unitario"}
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {activeOption ? (
                  formatComparisonPackageValue(
                    viewStats.cheapestPackageUsdBcv,
                    viewStats.cheapestPackageVes,
                    viewStats.cheapestPackageUsdParallel,
                    currencyMode
                  )
                ) : (
                  <>
                    {formatComparisonUnitValue(
                      viewStats.cheapestUnitUsdBcv,
                      viewStats.cheapestUnitVes,
                      viewStats.cheapestUnitUsdParallel,
                      currencyMode,
                      unitMeta.scale
                    )}{" "}
                    / {unitMeta.unitLabel}
                  </>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">
                {activeOption
                  ? `Precio promedio (${activeOption.label})`
                  : "Precio promedio"}
              </div>
              <div className="text-xl font-bold text-slate-100">
                {activeOption ? (
                  formatComparisonPackageValue(
                    viewStats.averagePackageUsdBcv,
                    viewStats.averagePackageVes,
                    viewStats.averagePackageUsdParallel,
                    currencyMode
                  )
                ) : (
                  <>
                    {formatComparisonUnitValue(
                      viewStats.averageUnitUsdBcv,
                      viewStats.averageUnitVes,
                      viewStats.averageUnitUsdParallel,
                      currencyMode,
                      unitMeta.scale
                    )}{" "}
                    / {unitMeta.unitLabel}
                  </>
                )}
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

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

          {presentationOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-3">
              <span className="mr-1 text-xs font-medium text-slate-400">
                Presentación:
              </span>
              <button
                type="button"
                onClick={() => setPresentationFilter("all")}
                className={
                  activePresentation === "all"
                    ? "rounded-md bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/40"
                    : "rounded-md bg-slate-800/70 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                }
              >
                Todas
              </button>
              {presentationOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPresentationFilter(opt.key)}
                  className={
                    activePresentation === opt.key
                      ? "rounded-md bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/40"
                      : "rounded-md bg-slate-800/70 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  }
                >
                  {opt.label} ({opt.chainCount})
                </button>
              ))}
            </div>
          )}
        </div>

        <ProductComparisonTable
          retailers={viewStats.retailers}
          activePresentationLabel={activeOption?.label ?? null}
          currencyMode={currencyMode}
          unitMeta={unitMeta}
          expandedChains={expandedChains}
          onToggleChain={toggleChain}
        />

        <ProductHistoryChart
          history={filteredHistory}
          baseUnit={product.baseUnit}
        />
      </div>
    </div>
  );
}
