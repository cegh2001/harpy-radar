import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const benchmarkSnapshots = pgTable(
  "benchmark_snapshots",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(), // 'cendas_fvm' | 'ovf' | 'ovp'
    periodMonth: text("period_month").notNull(), // 'YYYY-MM'
    basketCostUsd: numeric("basket_cost_usd", {
      precision: 12,
      scale: 2,
    }).notNull(),
    basketCostVes: numeric("basket_cost_ves", { precision: 14, scale: 2 }),
    familySize: integer("family_size").default(5).notNull(),
    notes: text("notes"),
    sourceUrl: text("source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("benchmark_source_month_uidx").on(
      table.source,
      table.periodMonth
    ),
  ]
);

export type BenchmarkSnapshotRow = typeof benchmarkSnapshots.$inferSelect;
export type BenchmarkSnapshotInsert = typeof benchmarkSnapshots.$inferInsert;
