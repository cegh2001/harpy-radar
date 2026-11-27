import { Layers, Scale, ShoppingBasket, Store } from "lucide-react";
import type { BasketIndexSummary } from "../domain/basket-index";
import type { RetailerStatusDto } from "../application/get-dashboard-snapshot";
import { formatPct, formatUsd, formatVes } from "./formatters";

interface BasketKpiGridProps {
  basket: BasketIndexSummary;
  retailers: RetailerStatusDto[];
}

export function BasketKpiGrid({ basket, retailers }: BasketKpiGridProps) {
  const activeRetailers = retailers.filter((r) => r.enabled);
  const activeRetailersSummary =
    activeRetailers.length > 0
      ? activeRetailers.map((r) => r.name).join(", ")
      : "Sin conectores activos";

  return (
    <section
      aria-label="Resumen de métricas de la canasta"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Canasta Mensual (BCV)</span>
          <ShoppingBasket className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-emerald-300 tabular-nums">
          {basket.coveredProductsCount > 0
            ? formatUsd(basket.estimatedMonthlyBasketUsdBcv)
            : "—"}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 tabular-nums">
          <span>
            {basket.coveredProductsCount > 0
              ? formatVes(basket.estimatedMonthlyBasketVes)
              : "Ejecuta el worker para ingerir precios"}
          </span>
          {basket.coveredProductsCount > 0 && (
            <span className="text-sky-300">
              · Promedio: {formatUsd(basket.estimatedMonthlyBasketAvgUsdBcv)}
            </span>
          )}
          {basket.coveredProductsCount > 0 && (
            <span className="text-slate-300">
              · Mediana: {formatUsd(basket.estimatedMonthlyBasketMedianUsdBcv)}
            </span>
          )}
          {basket.coveredProductsCount > 0 &&
            basket.outlierOffersCount > 0 &&
            basket.estimatedMonthlyBasketRobustUsdBcv !==
              basket.estimatedMonthlyBasketUsdBcv && (
              <span className="text-amber-300">
                · Sin atípicos:{" "}
                {formatUsd(basket.estimatedMonthlyBasketRobustUsdBcv)}
              </span>
            )}
          {basket.estimatedMonthlyBasketUsdParallel !== null && (
            <span className="text-amber-300">
              · {formatUsd(basket.estimatedMonthlyBasketUsdParallel)} paralelo
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Cobertura del Catálogo</span>
          <Layers className="h-4 w-4 text-sky-400" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-slate-50 tabular-nums">
          {basket.coveredProductsCount} / {basket.totalProductsCount}
        </div>
        <div className="mt-1 text-xs text-slate-400 tabular-nums">
          {basket.coveragePct.toFixed(1)}% de los productos canónicos relevados
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Conectores Activos</span>
          <Store className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-slate-50 tabular-nums">
          {activeRetailers.length} / {retailers.length}
        </div>
        <div className="mt-1 truncate text-xs text-slate-400" title={activeRetailersSummary}>
          {activeRetailersSummary}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
          <span>Diferencia vs. Referencia</span>
          <Scale className="h-4 w-4 text-amber-400" />
        </div>
        <div className="mt-1.5 text-2xl font-bold text-slate-50 tabular-nums">
          {formatPct(basket.benchmarkDeltaPct)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {basket.benchmarkReferenceLabel
            ? `vs. ${basket.benchmarkReferenceLabel}`
            : "Esperando productos cubiertos"}
        </div>
      </div>
    </section>
  );
}
