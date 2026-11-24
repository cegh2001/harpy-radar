import { Layers, Scale, ShoppingBasket, Store } from "lucide-react";
import type { BasketIndexSummary } from "../domain/basket-index";
import type { RetailerStatusDto } from "../application/get-dashboard-snapshot";
import { formatPct, formatUsd, formatVes } from "./formatters";

interface BasketKpiGridProps {
  basket: BasketIndexSummary;
  retailers: RetailerStatusDto[];
}

export function BasketKpiGrid({ basket, retailers }: BasketKpiGridProps) {
  const activeRetailersCount = retailers.filter((r) => r.enabled).length;

  return (
    <section
      aria-label="Basket summary metrics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Monthly Basket (BCV)</span>
          <ShoppingBasket className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-emerald-300 tabular-nums">
          {basket.coveredProductsCount > 0
            ? formatUsd(basket.estimatedMonthlyBasketUsdBcv)
            : "—"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
          <span>
            {basket.coveredProductsCount > 0
              ? formatVes(basket.estimatedMonthlyBasketVes)
              : "Run worker to ingest prices"}
          </span>
          {basket.coveredProductsCount > 0 && (
            <span className="text-sky-300">
              · Avg basket: {formatUsd(basket.estimatedMonthlyBasketAvgUsdBcv)}
            </span>
          )}
          {basket.estimatedMonthlyBasketUsdParallel !== null && (
            <span className="text-amber-300">
              · {formatUsd(basket.estimatedMonthlyBasketUsdParallel)} parallel
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Catalog Coverage</span>
          <Layers className="h-4 w-4 text-sky-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-50 tabular-nums">
          {basket.coveredProductsCount} / {basket.totalProductsCount}
        </div>
        <div className="mt-1 text-xs text-slate-400 tabular-nums">
          {basket.coveragePct.toFixed(1)}% of canonical basket items matched
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Active Connectors</span>
          <Store className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-50 tabular-nums">
          {activeRetailersCount} / {retailers.length}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Bahía (La Guaira), Rio (Caracas), Farmatodo
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Benchmark Delta</span>
          <Scale className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-50 tabular-nums">
          {formatPct(basket.benchmarkDeltaPct)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {basket.benchmarkReferenceLabel
            ? `vs ${basket.benchmarkReferenceLabel}`
            : "Awaiting covered basket items"}
        </div>
      </div>
    </section>
  );
}
