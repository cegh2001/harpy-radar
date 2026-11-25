import { Activity, DollarSign, MapPin, Radar } from "lucide-react";
import type { DashboardSnapshot } from "../application/get-dashboard-snapshot";
import { formatPct, formatRelativeIso, formatVes } from "./formatters";

interface DashboardHeaderProps {
  rates: DashboardSnapshot["rates"];
  generatedAt: string;
}

export function DashboardHeader({ rates, generatedAt }: DashboardHeaderProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/95">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-300">
              <Radar className="h-3.5 w-3.5" />
              HARPY RADAR
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-xs text-slate-300">
              <MapPin className="h-3 w-3 text-sky-400" />
              La Guaira y Caracas
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Activity className="h-3 w-3 text-emerald-400" />
              Corte {formatRelativeIso(generatedAt)}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            Monitor de Canasta Básica en Venezuela
          </h1>
          <p className="text-sm text-slate-400">
            Precios unitarios normalizados ($/kg, $/L, $/unidad) en comercios
            activos, vinculados a la tasa oficial del BCV y referencia paralela.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
              <DollarSign className="h-3 w-3 text-emerald-400" />
              BCV USD
            </div>
            <div className="mt-0.5 text-base font-semibold text-emerald-300 tabular-nums">
              {rates.official ? formatVes(rates.official.usdRate) : "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              {rates.official ? rates.official.rateDate : "En espera"}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              BCV EUR
            </div>
            <div className="mt-0.5 text-base font-semibold text-slate-100 tabular-nums">
              {rates.official?.eurRate
                ? formatVes(rates.official.eurRate)
                : "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              {rates.official?.source ?? "bcv_official"}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Dólar Paralelo
            </div>
            <div className="mt-0.5 text-base font-semibold text-amber-300 tabular-nums">
              {rates.parallel ? formatVes(rates.parallel.usdRate) : "—"}
            </div>
            <div className="text-[11px] text-slate-500">
              {rates.parallel ? rates.parallel.rateDate : "DolarAPI"}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Brecha Cambiaria
            </div>
            <div className="mt-0.5 text-base font-semibold text-amber-200 tabular-nums">
              {formatPct(rates.gapPct)}
            </div>
            <div className="text-[11px] text-slate-500">Paralelo vs. BCV</div>
          </div>
        </div>
      </div>
    </header>
  );
}
