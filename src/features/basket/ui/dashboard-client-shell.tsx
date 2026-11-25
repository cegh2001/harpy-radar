"use client";

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { BasketCategory } from "@/features/catalog/domain/canonical-basket";
import type { DashboardSnapshot } from "../application/get-dashboard-snapshot";
import {
  buildDashboardTabUrl,
  parseDashboardTab,
  type DashboardTab,
} from "../domain/dashboard-tab";
import { BasketKpiGrid } from "./basket-kpi-grid";
import { BenchmarkComparisonChart } from "./benchmark-comparison-chart";
import { CategoryBreakdownChart } from "./category-breakdown-chart";
import { DashboardTabs } from "./dashboard-tabs";
import { CATEGORY_LABELS, type CurrencyDisplayMode } from "./formatters";
import { ProductPriceTable } from "./product-price-table";
import { RetailerStatusPanel } from "./retailer-status-panel";

interface DashboardClientShellProps {
  snapshot: DashboardSnapshot;
}

const REGIONS = [
  { id: "all", label: "Todas las regiones" },
  { id: "La Guaira", label: "La Guaira" },
  { id: "Caracas", label: "Caracas" },
];

const CURRENCY_MODES: Array<{ id: CurrencyDisplayMode; label: string }> = [
  { id: "usd_bcv", label: "USD (BCV)" },
  { id: "ves", label: "VES (Bs.)" },
  { id: "usd_parallel", label: "USD (Paralelo)" },
];

export function DashboardClientShell({ snapshot }: DashboardClientShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseDashboardTab(searchParams.get("tab"));

  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currencyMode, setCurrencyMode] =
    useState<CurrencyDisplayMode>("usd_bcv");
  const [searchQuery, setSearchQuery] = useState<string>("");

  function handleSelectTab(nextTab: DashboardTab) {
    if (nextTab === activeTab) return;
    const nextUrl = buildDashboardTabUrl(
      pathname,
      searchParams.toString(),
      nextTab
    );
    window.history.pushState(null, "", nextUrl);
  }

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return snapshot.basket.products
      .map((product) => {
        if (regionFilter === "all") return product;
        const matchingRetailers = product.retailers.filter((r) =>
          r.region.toLowerCase().includes(regionFilter.toLowerCase())
        );
        if (matchingRetailers.length === 0) {
          return {
            ...product,
            cheapestUnitUsdBcv: null,
            averageUnitUsdBcv: null,
            cheapestUnitVes: null,
            averageUnitVes: null,
            cheapestUnitUsdParallel: null,
            averageUnitUsdParallel: null,
            cheapestRetailerName: null,
            cheapestRetailerSlug: null,
            spreadPct: null,
            inStockAny: false,
            retailerCount: 0,
            retailers: [],
          };
        }
        const inStockList = matchingRetailers.filter((r) => r.inStock);
        const pool = inStockList.length > 0 ? inStockList : matchingRetailers;
        const cheapest = pool[0];
        const avg = (values: number[]) =>
          Math.round(
            (values.reduce((s, v) => s + v, 0) / values.length) * 10000
          ) / 10000;
        const parallelUnits = pool
          .filter((r) => r.priceUsdParallel !== null)
          .map((r) => (r.priceUsdParallel as number) / r.packageSize);

        return {
          ...product,
          cheapestUnitUsdBcv: cheapest.normalizedUnitPriceUsd,
          averageUnitUsdBcv: avg(pool.map((r) => r.normalizedUnitPriceUsd)),
          cheapestUnitVes: cheapest.priceVes / cheapest.packageSize,
          averageUnitVes: avg(pool.map((r) => r.priceVes / r.packageSize)),
          cheapestUnitUsdParallel:
            cheapest.priceUsdParallel !== null
              ? cheapest.priceUsdParallel / cheapest.packageSize
              : null,
          averageUnitUsdParallel:
            parallelUnits.length > 0 ? avg(parallelUnits) : null,
          cheapestRetailerName: cheapest.retailerName,
          cheapestRetailerSlug: cheapest.retailerSlug,
          retailerCount: matchingRetailers.length,
          inStockAny: inStockList.length > 0,
          retailers: matchingRetailers,
        };
      })
      .filter((product) => {
        if (categoryFilter !== "all" && product.category !== categoryFilter) {
          return false;
        }
        if (q && !product.name.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [snapshot.basket.products, regionFilter, categoryFilter, searchQuery]);

  const activeRetailersCount = snapshot.retailers.filter(
    (r) => r.enabled
  ).length;
  const hasHealthAlerts = snapshot.heartbeats.some(
    (hb) =>
      !hb.isExecuting &&
      (hb.lastCycleStatus === "partial" || hb.lastCycleStatus === "failed")
  );

  return (
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <BasketKpiGrid basket={snapshot.basket} retailers={snapshot.retailers} />

      <DashboardTabs
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        productCount={filteredProducts.length}
        totalProductCount={snapshot.basket.totalProductsCount}
        activeRetailersCount={activeRetailersCount}
        totalRetailersCount={snapshot.retailers.length}
        hasHealthAlerts={hasHealthAlerts}
      />

      <section
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="space-y-4 focus:outline-none"
      >
        {activeTab === "products" && (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 lg:flex-row lg:items-center lg:justify-between">
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

                <select
                  aria-label="Filtrar por categoría"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">Todas las categorías</option>
                  {(Object.keys(CATEGORY_LABELS) as BasketCategory[]).map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500"
                  />
                  <input
                    type="search"
                    aria-label="Buscar producto"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:w-64"
                  />
                </div>

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
                  {filteredProducts.length} /{" "}
                  {snapshot.basket.totalProductsCount}
                </span>
              </div>
            </div>

            <ProductPriceTable
              products={filteredProducts}
              currencyMode={currencyMode}
            />
          </>
        )}

        {activeTab === "charts" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <BenchmarkComparisonChart
                benchmarks={snapshot.benchmarks}
                harpyBasketUsd={snapshot.basket.estimatedMonthlyBasketUsdBcv}
                harpyAvgBasketUsd={
                  snapshot.basket.estimatedMonthlyBasketAvgUsdBcv
                }
                coveredCount={snapshot.basket.coveredProductsCount}
                totalCount={snapshot.basket.totalProductsCount}
              />
            </div>
            <div className="xl:col-span-5">
              <CategoryBreakdownChart
                categorySubtotals={snapshot.basket.categorySubtotals}
                totalMonthlyUsdBcv={
                  snapshot.basket.estimatedMonthlyBasketUsdBcv
                }
              />
            </div>
          </div>
        )}

        {activeTab === "health" && (
          <RetailerStatusPanel
            retailers={snapshot.retailers}
            heartbeats={snapshot.heartbeats}
          />
        )}
      </section>
    </main>
  );
}
