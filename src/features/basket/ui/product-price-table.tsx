"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleSlash } from "lucide-react";
import type { ProductPriceSummary } from "../domain/basket-index";
import {
  CATEGORY_LABELS,
  formatPct,
  formatUsd,
  formatVes,
  type CurrencyDisplayMode,
} from "./formatters";

interface ProductPriceTableProps {
  products: ProductPriceSummary[];
  currencyMode: CurrencyDisplayMode;
}

function renderUnitPrice(
  product: ProductPriceSummary,
  currencyMode: CurrencyDisplayMode
): string {
  if (currencyMode === "ves") {
    return formatVes(product.cheapestUnitVes);
  }
  if (currencyMode === "usd_parallel") {
    return formatUsd(product.cheapestUnitUsdParallel);
  }
  return formatUsd(product.cheapestUnitUsdBcv);
}

function renderAverageUnitPrice(
  product: ProductPriceSummary,
  currencyMode: CurrencyDisplayMode
): string {
  if (currencyMode === "ves") {
    return formatVes(product.averageUnitVes);
  }
  if (currencyMode === "usd_parallel") {
    return formatUsd(product.averageUnitUsdParallel);
  }
  return formatUsd(product.averageUnitUsdBcv);
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
            {products.map((product) => (
              <tr
                key={product.slug}
                className="transition-colors hover:bg-slate-800/40"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-100">
                    {product.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    Unidad base: {product.baseUnit} · {product.retailerCount}{" "}
                    cadena(s)
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-300">
                  <span className="inline-block whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-800/70 px-2 py-0.5">
                    {CATEGORY_LABELS[product.category]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
                  {renderUnitPrice(product, currencyMode)}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    /{product.baseUnit}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-200 tabular-nums whitespace-nowrap">
                  {renderAverageUnitPrice(product, currencyMode)}
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    /{product.baseUnit}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-300 tabular-nums whitespace-nowrap">
                  {product.basketMonthlyQty} {product.baseUnit}
                </td>
                <td className="px-4 py-3 text-slate-200">
                  {product.cheapestRetailerName ?? (
                    <span className="text-slate-500">Sin observaciones</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-amber-200 tabular-nums whitespace-nowrap">
                  {formatPct(product.spreadPct)}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
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
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/products/${product.slug}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-500/50 hover:text-emerald-300"
                  >
                    Comparar
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
