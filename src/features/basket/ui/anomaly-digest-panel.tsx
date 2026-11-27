"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type {
  AnomalyCause,
  DailyAnomalyDigestDto,
} from "@/features/arbitration/domain/arbiter-schemas";
import { formatPct } from "./formatters";

interface AnomalyDigestPanelProps {
  digest: DailyAnomalyDigestDto;
}

const CAUSE_LABELS: Record<AnomalyCause, string> = {
  brand_tier: "Diferencia de gama",
  package_mismatch: "Presentación / empaque",
  retailer_outlier: "Precio atípico",
  mixed: "Múltiples factores",
};

export function AnomalyDigestPanel({ digest }: AnomalyDigestPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-label="Resumen diario de dispersión de precios"
      className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3.5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300">
            <span className="inline-flex items-center gap-1 font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Análisis diario de anomalías ({digest.digestDate})
            </span>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-200">
              {digest.flaggedProductsCount} producto(s) ·{" "}
              {digest.outlierOffersCount} atípico(s)
            </span>
          </div>
          <h2 className="text-sm font-semibold text-slate-100">
            {digest.headline}
          </h2>
          <p className="text-xs leading-relaxed text-slate-300">
            {digest.summary}
          </p>
        </div>

        {digest.highlights.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-amber-500/30 bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-amber-200 transition hover:border-amber-400/50 hover:text-amber-100"
          >
            {expanded
              ? "Ocultar detalle"
              : `Ver ${digest.highlights.length} hallazgo(s)`}
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {expanded && digest.highlights.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2.5 border-t border-amber-500/20 pt-3 md:grid-cols-2 xl:grid-cols-3">
          {digest.highlights.map((item) => (
            <div
              key={item.canonicalSlug}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/products/${item.canonicalSlug}`}
                  className="text-xs font-semibold text-emerald-300 hover:underline"
                >
                  {item.productName}
                </Link>
                <span className="shrink-0 text-xs font-semibold text-amber-200 tabular-nums">
                  {formatPct(item.spreadPct)}
                </span>
              </div>
              <div className="mt-1">
                <span className="inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  {CAUSE_LABELS[item.primaryCause]}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {item.explanation}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
