import type { BasketCategory } from "@/features/catalog/domain/canonical-basket";

export type CurrencyDisplayMode = "usd_bcv" | "ves" | "usd_parallel";

export const CATEGORY_LABELS: Record<BasketCategory, string> = {
  grains_flours: "Grains & Flours",
  legumes: "Legumes",
  oils_fats: "Oils & Fats",
  dairy_eggs: "Dairy & Eggs",
  proteins: "Proteins",
  pantry: "Pantry",
  hygiene: "Hygiene",
};

export function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatVes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `Bs. ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatRelativeIso(iso: string | null): string {
  if (!iso) return "Not yet synced";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString("en-US", {
    timeZone: "America/Caracas",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
