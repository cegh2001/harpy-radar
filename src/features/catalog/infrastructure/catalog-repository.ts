import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { canonicalProducts, type CanonicalProductRow } from "@/db/schema";
import type {
  BaseUnit,
  BasketCategory,
  CanonicalBasketItem,
} from "../domain/canonical-basket";

export interface CatalogProductRecord extends CanonicalBasketItem {
  id: number;
  active: boolean;
}

function normalizeCategory(raw: string): BasketCategory {
  if (raw === "hygiene") {
    return "personal_care";
  }
  return raw as BasketCategory;
}

function mapRowToRecord(row: CanonicalProductRow): CatalogProductRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: normalizeCategory(row.category),
    baseUnit: row.baseUnit as BaseUnit,
    basketMonthlyQty: Number(row.basketMonthlyQty),
    searchTerms: row.searchTerms,
    requiredTokens: row.requiredTokens,
    excludedTokens: row.excludedTokens,
    expectedMinUnitUsd: Number(row.expectedMinUnitUsd),
    expectedMaxUnitUsd: Number(row.expectedMaxUnitUsd),
    active: row.active,
  };
}

export const catalogRepository = {
  async getActiveCanonicalProducts(): Promise<CatalogProductRecord[]> {
    const rows = await db
      .select()
      .from(canonicalProducts)
      .where(eq(canonicalProducts.active, true));

    return rows.map(mapRowToRecord);
  },

  async getCanonicalProductBySlug(
    slug: string
  ): Promise<CatalogProductRecord | null> {
    const [row] = await db
      .select()
      .from(canonicalProducts)
      .where(eq(canonicalProducts.slug, slug))
      .limit(1);

    return row ? mapRowToRecord(row) : null;
  },
};
