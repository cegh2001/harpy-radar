import type { BasketCategory } from "@/features/catalog/domain/canonical-basket";

export type CurrencyDisplayMode = "usd_bcv" | "ves" | "usd_parallel";

export const CATEGORY_LABELS: Record<BasketCategory, string> = {
  grains_flours: "Granos y harinas",
  legumes: "Legumbres",
  oils_fats: "Aceites y grasas",
  dairy_eggs: "Lácteos y huevos",
  proteins: "Proteínas",
  pantry: "Despensa",
  hygiene: "Higiene",
};

export const RETAILER_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  beta: "Beta",
  planned: "Planificado",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  completed: "Completado",
  partial: "Parcial",
  skipped: "Omitido",
  failed: "Fallido",
  running: "En ejecución",
  ready: "Listo",
  shutdown: "Detenido",
};

export const JOB_DISPLAY_NAMES: Record<string, string> = {
  "job:sync-rates": "Sincronización de tasas",
  "job:scrape-bahia": "Catálogo Bahía Supermarket",
  "job:scrape-riomarket": "Catálogo Rio Supermarket",
  "job:scrape-farmatodo": "Catálogo Farmatodo",
  "job:scrape-central-madeirense": "Catálogo Central Madeirense",
  "job:scrape-punto-al-mayor": "Catálogo Punto al Mayor",
  "job:scrape-viva": "Catálogo Viva Supercentro",
  "job:scrape-locatel": "Catálogo Locatel",
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
  return `Bs. ${value.toLocaleString("es-VE", {
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
  if (!iso) return "Sin sincronizar";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Desconocido";
  return parsed.toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
