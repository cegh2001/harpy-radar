import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const workerHeartbeats = pgTable("worker_heartbeats", {
  jobName: text("job_name").primaryKey(),
  isExecuting: boolean("is_executing").default(false).notNull(),
  lastHeartbeatAt: timestamp("last_heartbeat_at", {
    withTimezone: true,
  }).notNull(),
  lastCycleAt: timestamp("last_cycle_at", { withTimezone: true }),
  lastCycleStatus: text("last_cycle_status").default("ready").notNull(),
  lastError: text("last_error"),
  cycleCount: integer("cycle_count").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ingestionRuns = pgTable("ingestion_runs", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull(),
  retailerSlug: text("retailer_slug"),
  status: text("status").notNull(), // 'completed' | 'partial' | 'failed'
  itemsFetched: integer("items_fetched").default(0).notNull(),
  itemsMatched: integer("items_matched").default(0).notNull(),
  itemsSaved: integer("items_saved").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type WorkerHeartbeatRow = typeof workerHeartbeats.$inferSelect;
export type IngestionRunRow = typeof ingestionRuns.$inferSelect;
export type IngestionRunInsert = typeof ingestionRuns.$inferInsert;
