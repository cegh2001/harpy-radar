"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategorySubtotal } from "../domain/basket-index";
import { CATEGORY_LABELS, formatUsd } from "./formatters";

interface CategoryBreakdownChartProps {
  categorySubtotals: CategorySubtotal[];
  totalMonthlyUsdBcv: number;
}

interface CategoryChartDatum {
  label: string;
  monthlyUsdBcv: number;
  coveredCount: number;
  totalCount: number;
  sharePct: number;
}

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CategoryChartDatum }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 shadow-lg">
      <div className="font-semibold text-slate-50">{datum.label}</div>
      <div className="mt-1 text-emerald-300 tabular-nums">
        {formatUsd(datum.monthlyUsdBcv)} / mes ({datum.sharePct.toFixed(1)}%)
      </div>
      <div className="text-slate-400 tabular-nums">
        Cobertura: {datum.coveredCount}/{datum.totalCount} productos
      </div>
    </div>
  );
}

export function CategoryBreakdownChart({
  categorySubtotals,
  totalMonthlyUsdBcv,
}: CategoryBreakdownChartProps) {
  const data: CategoryChartDatum[] = [...categorySubtotals]
    .filter((item) => item.monthlyUsdBcv > 0)
    .sort((a, b) => b.monthlyUsdBcv - a.monthlyUsdBcv)
    .map((item) => ({
      label: CATEGORY_LABELS[item.category],
      monthlyUsdBcv: item.monthlyUsdBcv,
      coveredCount: item.coveredCount,
      totalCount: item.totalCount,
      sharePct:
        totalMonthlyUsdBcv > 0
          ? (item.monthlyUsdBcv / totalMonthlyUsdBcv) * 100
          : 0,
    }));

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-100">
          Peso Mensual por Categoría (USD BCV)
        </h2>
        <p className="text-xs text-slate-400">
          Distribución del costo mensual estimado según la mejor oferta por
          producto en cada rubro.
        </p>
      </div>

      <div className="h-80 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Aún no hay subtotales por categoría disponibles.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 20, left: 12, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                type="number"
                stroke="#94a3b8"
                fontSize={12}
                tickFormatter={(v) => `$${v}`}
              />
              <YAxis
                type="category"
                dataKey="label"
                stroke="#94a3b8"
                fontSize={11}
                width={118}
              />
              <Tooltip
                cursor={{ fill: "rgba(30, 41, 59, 0.45)" }}
                content={<CategoryTooltip />}
              />
              <Bar
                dataKey="monthlyUsdBcv"
                name="Subtotal mensual (USD BCV)"
                fill="#10b981"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
