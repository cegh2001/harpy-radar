import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getProductDetailSnapshot } from "@/features/basket/application/get-dashboard-snapshot";
import {
  CATEGORY_LABELS,
  formatPct,
  formatRelativeIso,
  formatUsd,
  formatVes,
} from "@/features/basket/ui/formatters";
import { ProductHistoryChart } from "@/features/basket/ui/product-history-chart";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let detail = null;
  try {
    detail = await getProductDetailSnapshot(slug);
  } catch {
    detail = null;
  }

  if (!detail) {
    notFound();
  }

  const { product, history } = detail;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al monitor
            </Link>
            <h1 className="text-2xl font-bold text-slate-50">
              {product.name}
            </h1>
            <p className="text-xs text-slate-400">
              {CATEGORY_LABELS[product.category]} · Unidad base:{" "}
              {product.baseUnit} · Peso mensual en canasta:{" "}
              {product.basketMonthlyQty} {product.baseUnit}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-right tabular-nums">
            <div>
              <div className="text-xs text-slate-400">
                Mejor precio unitario
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {formatUsd(product.cheapestUnitUsdBcv)} / {product.baseUnit}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Precio promedio</div>
              <div className="text-xl font-bold text-slate-100">
                {formatUsd(product.averageUnitUsdBcv)} / {product.baseUnit}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">
                Dispersión entre cadenas
              </div>
              <div className="text-xl font-bold text-amber-200">
                {formatPct(product.spreadPct)}
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-slate-100">
            Últimas observaciones por cadena
          </div>
          {product.retailers.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">
              Aún no hay observaciones registradas para este producto.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-900/90 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Cadena</th>
                    <th className="px-4 py-2.5">Producto detectado</th>
                    <th className="px-4 py-2.5 text-right">Presentación</th>
                    <th className="px-4 py-2.5 text-right">Normalizado BCV</th>
                    <th className="px-4 py-2.5 text-right">Precio VES</th>
                    <th className="px-4 py-2.5 text-right">Observado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {product.retailers.map((obs) => (
                    <tr key={`${obs.retailerSlug}-${obs.rawTitle}`}>
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
                              className="text-slate-400 hover:text-emerald-300"
                              aria-label={`Abrir ficha en ${obs.retailerName}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                        {obs.packageSize} {obs.packageUnit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-300 tabular-nums">
                        {formatUsd(obs.normalizedUnitPriceUsd)} /{" "}
                        {obs.packageUnit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 tabular-nums">
                        {formatVes(obs.priceVes)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400">
                        {formatRelativeIso(obs.observedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ProductHistoryChart history={history} baseUnit={product.baseUnit} />
      </div>
    </div>
  );
}
