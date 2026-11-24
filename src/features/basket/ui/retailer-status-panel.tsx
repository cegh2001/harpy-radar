import { Cpu, Store } from "lucide-react";
import type {
  RetailerStatusDto,
  WorkerHeartbeatDto,
} from "../application/get-dashboard-snapshot";
import { formatRelativeIso } from "./formatters";

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
          Retailer Connectors
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
                {retailer.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Cpu className="h-4 w-4 text-sky-400" />
          Worker Jobs &amp; Heartbeats
        </div>
        {heartbeats.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-400">
            No worker cycles recorded yet. Run{" "}
            <code className="text-emerald-300">pnpm worker:once</code> or{" "}
            <code className="text-emerald-300">pnpm worker</code> to start
            ingestion.
          </div>
        ) : (
          <div className="space-y-2.5">
            {heartbeats.map((hb) => (
              <div
                key={hb.jobName}
                className="flex items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/60 px-3 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {hb.jobName}
                  </div>
                  <div className="text-xs text-slate-400">
                    Last cycle: {formatRelativeIso(hb.lastCycleAt)} · Cycles:{" "}
                    {hb.cycleCount}
                  </div>
                </div>
                <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
                  {hb.isExecuting ? "running" : hb.lastCycleStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
