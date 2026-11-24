export interface ReferenceBenchmarkSeed {
  source: "cendas_fvm" | "ovf";
  periodMonth: string;
  basketCostUsd: number;
  basketCostVes: number | null;
  familySize: number;
  notes: string;
  sourceUrl: string;
  publishedAt: string;
}

/**
 * Curated institutional reference benchmarks for historical contrast against
 * Harpy Radar's curated 24-item retail basket.
 */
export const REFERENCE_BENCHMARKS: ReferenceBenchmarkSeed[] = [
  {
    source: "cendas_fvm",
    periodMonth: "2026-08",
    basketCostUsd: 539.16,
    basketCostVes: null,
    familySize: 5,
    notes: "Reference monthly 60-item family food basket benchmark (CENDAS-FVM).",
    sourceUrl: "https://cendasfvm.org/",
    publishedAt: "2026-09-18T12:00:00Z",
  },
  {
    source: "cendas_fvm",
    periodMonth: "2026-09",
    basketCostUsd: 544.8,
    basketCostVes: null,
    familySize: 5,
    notes: "Reference monthly 60-item family food basket benchmark (CENDAS-FVM).",
    sourceUrl: "https://cendasfvm.org/",
    publishedAt: "2026-10-18T12:00:00Z",
  },
  {
    source: "cendas_fvm",
    periodMonth: "2026-10",
    basketCostUsd: 551.4,
    basketCostVes: null,
    familySize: 5,
    notes: "Reference monthly 60-item family food basket benchmark (CENDAS-FVM).",
    sourceUrl: "https://cendasfvm.org/",
    publishedAt: "2026-11-18T12:00:00Z",
  },
  {
    source: "ovf",
    periodMonth: "2026-08",
    basketCostUsd: 392.5,
    basketCostVes: null,
    familySize: 5,
    notes: "Reference basic food basket benchmark in USD (Observatorio Venezolano de Finanzas).",
    sourceUrl: "https://observatoriodefinanzas.com/",
    publishedAt: "2026-09-10T12:00:00Z",
  },
  {
    source: "ovf",
    periodMonth: "2026-09",
    basketCostUsd: 398.1,
    basketCostVes: null,
    familySize: 5,
    notes: "Reference basic food basket benchmark in USD (Observatorio Venezolano de Finanzas).",
    sourceUrl: "https://observatoriodefinanzas.com/",
    publishedAt: "2026-10-10T12:00:00Z",
  },
  {
    source: "ovf",
    periodMonth: "2026-10",
    basketCostUsd: 405.25,
    basketCostVes: null,
    familySize: 5,
    notes: "Reference basic food basket benchmark in USD (Observatorio Venezolano de Finanzas).",
    sourceUrl: "https://observatoriodefinanzas.com/",
    publishedAt: "2026-11-10T12:00:00Z",
  },
];
