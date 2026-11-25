import { Activity, Clock, Cpu, Store } from "lucide-react";
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
  const enabledRetailers = retailers.filter((r) => r.enabled);
  const activeRegions = Array.from(
    new Set(enabledRetailers.map((r) => r.primaryRegion))
  );

  const healthyJobsCount = heartbeats.filter(
    (hb) =>
      hb.lastCycleStatus === "completed" ||
      hb.lastCycleStatus === "ready" ||
      hb.isExecuting
  ).length;
  const alertJobsCount = heartbeats.filter(
    (hb) =>
      !hb.isExecuting &&
      (hb.lastCycleStatus === "partial" || hb.lastCycleStatus === "failed")
  ).length;
  const totalCycles = heartbeats.reduce((sum, hb) => sum + hb.cycleCount, 0);

  const latestCycleIso =
    heartbeats
      .map((hb) => hb.lastCycleAt)
      .filter((iso): iso is string => Boolean(iso))
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Comercios Activos</span>
            <Store className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-50 tabular-nums">
            {enabledRetailers.length} / {retailers.length}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {activeRegions.length > 0
              ? `Cobertura: ${activeRegions.join(", ")}`
              : "Sin comercios habilitados"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Estado del Worker</span>
            <Activity className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-50 tabular-nums">
            {heartbeats.length > 0
              ? `${healthyJobsCount} / ${heartbeats.length} saludables`
              : "Sin ciclos"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {alertJobsCount > 0 ? (
              <span className="text-amber-300">
                {alertJobsCount} tarea(s) con estado parcial o fallido
              </span>
            ) : heartbeats.length > 0 ? (
              "Todas las tareas operan dentro de lo esperado"
            ) : (
              "Esperando ejecución inicial del worker"
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
            <span>Último Ciclo Registrado</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-50 tabular-nums">
            {formatRelativeIso(latestCycleIso)}
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {totalCycles} ciclos acumulados entre {heartbeats.length} tarea(s)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 xl:col-span-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Store className="h-4 w-4 text-emerald-400" />
              Conectores de Comercios
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {enabledRetailers.length} activos
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {retailers.map((retailer) => (
              <div
                key={retailer.slug}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-950/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">
                    {retailer.name}
                  </div>
                  <div className="truncate text-xs text-slate-400">
                    {retailer.primaryRegion} · {retailer.adapterKey} (
                    {retailer.defaultCurrency})
                  </div>
                </div>
                <span
                  className={
                    retailer.status === "active"
                      ? "shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
                      : retailer.status === "beta"
                        ? "shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300"
                        : "shrink-0 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400"
                  }
                >
                  {RETAILER_STATUS_LABELS[retailer.status] ?? retailer.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 xl:col-span-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Cpu className="h-4 w-4 text-sky-400" />
              Tareas del Worker y Estado
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {heartbeats.length} tareas
            </span>
          </div>
          {heartbeats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-400">
              Aún no hay ciclos registrados. Ejecuta{" "}
              <code className="text-emerald-300">pnpm worker:once</code> o{" "}
              <code className="text-emerald-300">pnpm worker</code> para iniciar
              la ingesta.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 2xl:grid-cols-2">
              {heartbeats.map((hb) => {
                const rawStatus = hb.isExecuting
                  ? "running"
                  : hb.lastCycleStatus;
                const statusLabel = JOB_STATUS_LABELS[rawStatus] ?? rawStatus;
                return (
                  <div
                    key={hb.jobName}
                    className="rounded-lg border border-slate-800/90 bg-slate-950/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">
                          {JOB_DISPLAY_NAMES[hb.jobName] ?? hb.jobName}
                        </div>
                        <div className="text-xs text-slate-400 tabular-nums">
                          Último ciclo: {formatRelativeIso(hb.lastCycleAt)} ·
                          Ciclos: {hb.cycleCount}
                        </div>
                      </div>
                      <span
                        className={
                          rawStatus === "completed"
                            ? "shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300"
                            : rawStatus === "partial" ||
                                rawStatus === "running"
                              ? "shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300"
                              : rawStatus === "failed"
                                ? "shrink-0 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300"
                                : "shrink-0 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                        }
                      >
                        {statusLabel}
                      </span>
                    </div>
                    {hb.lastError && (
                      <p className="mt-1.5 truncate text-[11px] text-rose-300">
                        Error: {hb.lastError}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
