"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleSlash } from "lucide-react";
import type { ProductPriceSummary } from "../domain/basket-index";
import {
  CATEGORY_LABELS,
  formatPct,
  formatUsd,
  formatVes,
  getDisplayUnitMeta,
  type CurrencyDisplayMode,
} from "./formatters";

interface ProductPriceTableProps {
  products: ProductPriceSummary[];
  currencyMode: CurrencyDisplayMode;
}

function scaleNullable(value: number | null, scale: number): number | null {
  return value === null ? null : value * scale;
}

function renderUnitPrice(
  product: ProductPriceSummary,
  currencyMode: CurrencyDisplayMode,
  scale: number
): string {
  if (currencyMode === "ves") {
    return formatVes(scaleNullable(product.cheapestUnitVes, scale));
  }
  if (currencyMode === "usd_parallel") {
    return formatUsd(scaleNullable(product.cheapestUnitUsdParallel, scale));
  }
  return formatUsd(scaleNullable(product.cheapestUnitUsdBcv, scale));
}

function renderAverageUnitPrice(
  product: ProductPriceSummary,
  currencyMode: CurrencyDisplayMode,
  scale: number
): string {
  if (currencyMode === "ves") {
    return formatVes(scaleNullable(product.averageUnitVes, scale));
  }
  if (currencyMode === "usd_parallel") {
    return formatUsd(scaleNullable(product.averageUnitUsdParallel, scale));
  }
  return formatUsd(scaleNullable(product.averageUnitUsdBcv, scale));
}

export function ProductPriceTable({
  products,
  currencyMode,
}: ProductPriceTableProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
        Ningún producto de la canasta coincide con el filtro actual.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900/90 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium text-right">
                Mejor precio unit.
              </th>
              <th className="px-4 py-3 font-medium text-right">
                Precio promedio
              </th>
              <th className="px-4 py-3 font-medium text-right">
                Cant. mensual
              </th>
              <th className="px-4 py-3 font-medium">Mejor cadena</th>
              <th className="px-4 py-3 font-medium text-right">Dispersión</th>
              <th className="px-4 py-3 font-medium text-center">
                Disponibilidad
              </th>
              <th className="px-4 py-3 font-medium text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {products.map((product) => {
              const meta = getDisplayUnitMeta(product);
              return (
                <tr
                  key={product.slug}
                  className="transition-colors hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-100 lg:whitespace-nowrap">
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {meta.isScaledDisplay
                        ? `Ref: ${meta.referenceLabel}`
                        : `Unidad base: ${product.baseUnit}`}{" "}
                      · {product.retailerCount} cadena(s)
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-300">
                    <span className="inline-block whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-800/70 px-2 py-0.5">
                      {CATEGORY_LABELS[product.category]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
                    {renderUnitPrice(product, currencyMode, meta.scale)}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      /{meta.unitLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-200 tabular-nums whitespace-nowrap">
                    {renderAverageUnitPrice(product, currencyMode, meta.scale)}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      /{meta.unitLabel}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300 tabular-nums whitespace-nowrap">
                    {meta.monthlyQtyLabel}
                  </td>
                  <td className="px-4 py-2.5 text-slate-200 lg:whitespace-nowrap">
                    {product.cheapestRetailerName ?? (
                      <span className="text-slate-500">Sin observaciones</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-200 tabular-nums whitespace-nowrap">
                    {product.outlierCount > 0 ? (
                      <div>
                        <div>
                          {formatPct(
                            product.robustSpreadPct ?? product.spreadPct
                          )}
                        </div>
                        <div className="text-[11px] text-amber-400/80">
                          Bruta: {formatPct(product.spreadPct)} ·{" "}
                          {product.outlierCount} atípico
                          {product.outlierCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    ) : (
                      formatPct(product.spreadPct)
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {product.retailerCount === 0 ? (
                      <span className="text-xs text-slate-500">—</span>
                    ) : product.inStockAny ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Disponible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-400">
                        <CircleSlash className="h-3.5 w-3.5" />
                        Agotado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Link
                      href={`/products/${product.slug}`}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-500/50 hover:text-emerald-300"
                    >
                      Comparar
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
