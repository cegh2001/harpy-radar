import {
  index,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: serial("id").primaryKey(),
    rateDate: text("rate_date").notNull(),
    source: text("source").notNull(), // 'bcv_official' | 'dolarapi_official' | 'dolarapi_parallel'
    usdRate: numeric("usd_rate", { precision: 14, scale: 6 }).notNull(),
    eurRate: numeric("eur_rate", { precision: 14, scale: 6 }),
    bcvDateText: text("bcv_date_text"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("exchange_rates_source_fetched_idx").on(
      table.source,
      table.fetchedAt
    ),
    index("exchange_rates_date_source_idx").on(table.rateDate, table.source),
  ]
);

export type ExchangeRateRow = typeof exchangeRates.$inferSelect;
export type ExchangeRateInsert = typeof exchangeRates.$inferInsert;
