import {
  boolean,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const canonicalProducts = pgTable("canonical_products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  baseUnit: text("base_unit").notNull(), // 'kg' | 'l' | 'unit'
  basketMonthlyQty: numeric("basket_monthly_qty", {
    precision: 10,
    scale: 3,
  }).notNull(),
  searchTerms: jsonb("search_terms").$type<string[]>().notNull(),
  requiredTokens: jsonb("required_tokens").$type<string[]>().notNull(),
  excludedTokens: jsonb("excluded_tokens").$type<string[]>().notNull(),
  expectedMinUnitUsd: numeric("expected_min_unit_usd", {
    precision: 10,
    scale: 4,
  }).notNull(),
  expectedMaxUnitUsd: numeric("expected_max_unit_usd", {
    precision: 10,
    scale: 4,
  }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type CanonicalProductRow = typeof canonicalProducts.$inferSelect;
export type CanonicalProductInsert = typeof canonicalProducts.$inferInsert;
