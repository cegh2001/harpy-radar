import { Cpu, Store } from "lucide-react";
import type {
  RetailerStatusDto,
  WorkerHeartbeatDto,
} from "../application/get-dashboard-snapshot";
import {
  formatRelativeIso,
  JOB_DISPLAY_NAMES,
  JOB_STATUS_LABELS,
  RETAILER_STATUS_LABELS,
} from "./formatters";

interface RetailerStatusPanelProps {
  retailers: RetailerStatusDto[];
  heartbeats: WorkerHeartbeatDto[];
}

export function RetailerStatusPanel({
  retailers,
  heartbeats,
}: RetailerStatusPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Store className="h-4 w-4 text-emerald-400" />
          Conectores de Comercios
        </div>
        <div className="space-y-2.5">
          {retailers.map((retailer) => (
            <div
              key={retailer.slug}
              className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3 py-2.5"
            >
              <div>
                <div className="text-sm font-medium text-slate-100">
                  {retailer.name}
                </div>
                <div className="text-xs text-slate-400">
                  {retailer.primaryRegion} · {retailer.adapterKey} (
                  {retailer.defaultCurrency})
                </div>
              </div>
              <span
                className={
                  retailer.status === "active"
                    ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
                    : retailer.status === "beta"
                      ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300"
                      : "rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400"
                }
              >
                {RETAILER_STATUS_LABELS[retailer.status] ?? retailer.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Cpu className="h-4 w-4 text-sky-400" />
          Tareas del Worker y Estado
        </div>
        {heartbeats.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-400">
            Aún no hay ciclos registrados. Ejecuta{" "}
            <code className="text-emerald-300">pnpm worker:once</code> o{" "}
            <code className="text-emerald-300">pnpm worker</code> para iniciar la
            ingesta.
          </div>
        ) : (
          <div className="space-y-2.5">
            {heartbeats.map((hb) => {
              const rawStatus = hb.isExecuting ? "running" : hb.lastCycleStatus;
              const statusLabel = JOB_STATUS_LABELS[rawStatus] ?? rawStatus;
              return (
                <div
                  key={hb.jobName}
                  className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {JOB_DISPLAY_NAMES[hb.jobName] ?? hb.jobName}
                    </div>
                    <div className="text-xs text-slate-400">
                      Último ciclo: {formatRelativeIso(hb.lastCycleAt)} ·
                      Ciclos: {hb.cycleCount}
                    </div>
                  </div>
                  <span
                    className={
                      rawStatus === "completed"
                        ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                        : rawStatus === "partial" || rawStatus === "running"
                          ? "rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
                          : "rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                    }
                  >
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
