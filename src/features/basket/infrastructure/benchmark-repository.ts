import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { benchmarkSnapshots, type BenchmarkSnapshotRow } from "@/db/schema";

export interface BenchmarkDto {
  id: number;
  source: string;
  periodMonth: string;
  basketCostUsd: number;
  basketCostVes: number | null;
  familySize: number;
  notes: string | null;
  sourceUrl: string | null;
  publishedAt: string;
}

function mapBenchmarkRow(row: BenchmarkSnapshotRow): BenchmarkDto {
  return {
    id: row.id,
    source: row.source,
    periodMonth: row.periodMonth,
    basketCostUsd: Number(row.basketCostUsd),
    basketCostVes: row.basketCostVes ? Number(row.basketCostVes) : null,
    familySize: row.familySize,
    notes: row.notes,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt.toISOString(),
  };
}

export const benchmarkRepository = {
  async getAllBenchmarks(): Promise<BenchmarkDto[]> {
    const rows = await db
      .select()
      .from(benchmarkSnapshots)
      .orderBy(desc(benchmarkSnapshots.periodMonth));

    return rows.map(mapBenchmarkRow);
  },
};
