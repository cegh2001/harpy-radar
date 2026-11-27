import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export interface AnomalyDigestHighlightRow {
  canonicalSlug: string;
  productName: string;
  spreadPct: number;
  primaryCause: "brand_tier" | "package_mismatch" | "retailer_outlier" | "mixed";
  explanation: string;
}

export const skuArbitrationCache = pgTable(
  "sku_arbitration_cache",
  {
    id: serial("id").primaryKey(),
    canonicalSlug: text("canonical_slug").notNull(),
    normalizedTitleHash: text("normalized_title_hash").notNull(),
    sampleRawTitle: text("sample_raw_title").notNull(),
    isValidMatch: boolean("is_valid_match").notNull(),
    tier: text("tier").notNull(), // 'basic' | 'standard' | 'premium_imported'
    effectivePackageMultiplier: numeric("effective_package_multiplier", {
      precision: 8,
      scale: 4,
    })
      .default("1.0000")
      .notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    reason: text("reason").notNull(),
    modelUsed: text("model_used").notNull(),
    promptTokens: integer("prompt_tokens"),
    outputTokens: integer("output_tokens"),
    arbitratedDate: text("arbitrated_date").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sku_arb_cache_slug_hash_uidx").on(
      table.canonicalSlug,
      table.normalizedTitleHash
    ),
    index("sku_arb_cache_date_idx").on(table.arbitratedDate),
    index("sku_arb_cache_expires_idx").on(table.expiresAt),
  ]
);

export const dailyAnomalyDigests = pgTable(
  "daily_anomaly_digests",
  {
    id: serial("id").primaryKey(),
    digestDate: text("digest_date").notNull(),
    headline: text("headline").notNull(),
    summary: text("summary").notNull(),
    highlightsJson: jsonb("highlights_json")
      .$type<AnomalyDigestHighlightRow[]>()
      .notNull(),
    flaggedProductsCount: integer("flagged_products_count")
      .default(0)
      .notNull(),
    outlierOffersCount: integer("outlier_offers_count").default(0).notNull(),
    modelUsed: text("model_used").notNull(),
    promptTokens: integer("prompt_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("daily_anomaly_digests_date_uidx").on(table.digestDate),
  ]
);

export type SkuArbitrationCacheRow = typeof skuArbitrationCache.$inferSelect;
export type SkuArbitrationCacheInsert = typeof skuArbitrationCache.$inferInsert;
export type DailyAnomalyDigestRow = typeof dailyAnomalyDigests.$inferSelect;
export type DailyAnomalyDigestInsert = typeof dailyAnomalyDigests.$inferInsert;
