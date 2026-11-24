import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { canonicalProducts } from "./catalog";
import { exchangeRates } from "./exchange-rates";
import { retailers } from "./retailers";

export const priceObservations = pgTable(
  "price_observations",
  {
    id: serial("id").primaryKey(),
    canonicalProductId: integer("canonical_product_id")
      .notNull()
      .references(() => canonicalProducts.id, { onDelete: "cascade" }),
    retailerId: integer("retailer_id")
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    exchangeRateId: integer("exchange_rate_id")
      .notNull()
      .references(() => exchangeRates.id),
    parallelRateId: integer("parallel_rate_id").references(
      () => exchangeRates.id
    ),
    externalSku: text("external_sku").notNull(),
    barcode: text("barcode"),
    rawTitle: text("raw_title").notNull(),
    productUrl: text("product_url"),
    imageUrl: text("image_url"),
    originalAmount: numeric("original_amount", {
      precision: 14,
      scale: 4,
    }).notNull(),
    originalCurrency: text("original_currency").notNull(), // 'USD' | 'VES'
    priceUsdBcv: numeric("price_usd_bcv", {
      precision: 14,
      scale: 4,
    }).notNull(),
    priceVes: numeric("price_ves", { precision: 14, scale: 4 }).notNull(),
    priceUsdParallel: numeric("price_usd_parallel", {
      precision: 14,
      scale: 4,
    }),
    packageSize: numeric("package_size", { precision: 12, scale: 4 }).notNull(),
    packageUnit: text("package_unit").notNull(), // 'kg' | 'l' | 'unit'
    normalizedUnitPriceUsd: numeric("normalized_unit_price_usd", {
      precision: 14,
      scale: 4,
    }).notNull(),
    inStock: boolean("in_stock").default(true).notNull(),
    storeAvailabilityCount: integer("store_availability_count"),
    matchConfidence: numeric("match_confidence", {
      precision: 4,
      scale: 3,
    }).notNull(),
    region: text("region").notNull(),
    contentHash: text("content_hash").notNull(),
    observedDate: text("observed_date").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("price_obs_product_observed_idx").on(
      table.canonicalProductId,
      table.observedAt
    ),
    index("price_obs_retailer_observed_idx").on(
      table.retailerId,
      table.observedAt
    ),
    uniqueIndex("price_obs_daily_dedup_uidx").on(
      table.retailerId,
      table.externalSku,
      table.observedDate,
      table.contentHash
    ),
  ]
);

export type PriceObservationRow = typeof priceObservations.$inferSelect;
export type PriceObservationInsert = typeof priceObservations.$inferInsert;
