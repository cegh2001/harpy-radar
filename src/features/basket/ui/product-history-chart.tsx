"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ProductHistoryPoint {
  observedAt: string;
  retailerSlug: string;
  retailerName: string;
  normalizedUnitPriceUsd: number;
  priceUsdBcv: number;
  priceVes: number;
  inStock: boolean;
}

interface ProductHistoryChartProps {
  history: ProductHistoryPoint[];
  baseUnit: string;
}

export function ProductHistoryChart({
  history,
  baseUnit,
}: ProductHistoryChartProps) {
  const chartData = [...history]
    .reverse()
    .map((point) => ({
      date: point.observedAt.slice(0, 10),
      unitUsd: point.normalizedUnitPriceUsd,
      retailer: point.retailerName,
    }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-100">
        Historial de Precio Unitario Normalizado (30 días · USD BCV /{" "}
        {baseUnit})
      </h2>
      <div className="h-72 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Aún no hay observaciones históricas registradas para este producto.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
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
              <Line
                type="monotone"
                dataKey="unitUsd"
                name={`USD BCV / ${baseUnit}`}
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
