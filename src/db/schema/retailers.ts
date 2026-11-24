import {
  boolean,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const retailers = pgTable("retailers", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  adapterKey: text("adapter_key").notNull(), // 'stellar_webstore' | 'farmatodo_algolia' | 'gama_occ' | 'manual_only'
  baseUrl: text("base_url").notNull(),
  defaultCurrency: text("default_currency").notNull(), // 'USD' | 'VES'
  primaryRegion: text("primary_region").notNull(),
  status: text("status").notNull(), // 'active' | 'beta' | 'planned'
  enabled: boolean("enabled").default(true).notNull(),
  configJson: jsonb("config_json")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type RetailerRow = typeof retailers.$inferSelect;
export type RetailerInsert = typeof retailers.$inferInsert;
