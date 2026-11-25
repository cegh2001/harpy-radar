"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BenchmarkDto } from "../infrastructure/benchmark-repository";

interface BenchmarkComparisonChartProps {
  benchmarks: BenchmarkDto[];
  harpyBasketUsd: number;
  coveredCount: number;
  totalCount: number;
}

export function BenchmarkComparisonChart({
  benchmarks,
  harpyBasketUsd,
  coveredCount,
  totalCount,
}: BenchmarkComparisonChartProps) {
  const byMonth = new Map<
    string,
    { period: string; cendasUsd?: number; ovfUsd?: number; harpyUsd?: number }
  >();

  for (const item of benchmarks) {
    const row = byMonth.get(item.periodMonth) ?? { period: item.periodMonth };
    if (item.source === "cendas_fvm") row.cendasUsd = item.basketCostUsd;
    if (item.source === "ovf") row.ovfUsd = item.basketCostUsd;
    byMonth.set(item.periodMonth, row);
  }

  const data = Array.from(byMonth.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );

  if (coveredCount > 0) {
    data.push({
      period: "Harpy En Vivo",
      harpyUsd: harpyBasketUsd,
    });
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Referencias Institucionales vs. Canasta Harpy Radar
          </h2>
          <p className="text-xs text-slate-400">
            Canasta alimentaria mensual de referencia (CENDAS-FVM 60 productos,
            OVF USD) frente a nuestra canasta curada de 24 productos (
            {coveredCount}/{totalCount} cubiertos).
          </p>
        </div>
      </div>

      <div className="h-72 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Aún no hay referencias institucionales cargadas.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="period" stroke="#94a3b8" fontSize={12} />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  color: "#f8fafc",
                }}
              />
              <Legend />
              <Bar
                dataKey="cendasUsd"
                name="CENDAS-FVM (USD)"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="ovfUsd"
                name="OVF (USD)"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="harpyUsd"
                name="Harpy Radar (24 productos)"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
