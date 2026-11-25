export type BasketCategory =
  | "grains_flours"
  | "legumes"
  | "oils_fats"
  | "dairy_eggs"
  | "proteins"
  | "pantry"
  | "personal_care"
  | "household_cleaning";

export type BaseUnit = "kg" | "l" | "unit";

export interface CanonicalBasketItem {
  slug: string;
  name: string;
  category: BasketCategory;
  baseUnit: BaseUnit;
  basketMonthlyQty: number;
  searchTerms: string[];
  /**
   * Each entry can contain pipe-separated alternatives (e.g. "maiz|pan|juana"),
   * where at least one alternative in every group must appear in the normalized title.
   */
  requiredTokens: string[];
  excludedTokens: string[];
  expectedMinUnitUsd: number;
  expectedMaxUnitUsd: number;
}
