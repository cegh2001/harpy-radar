import { BASKET_FOOD_ITEMS } from "./basket-food-items";
import { BASKET_HYGIENE_ITEMS } from "./basket-hygiene-items";
import { BASKET_PROTEIN_ITEMS } from "./basket-protein-items";
import type { CanonicalBasketItem } from "./basket-types";

export type {
  BaseUnit,
  BasketCategory,
  CanonicalBasketItem,
} from "./basket-types";

export const CANONICAL_BASKET_ITEMS: CanonicalBasketItem[] = [
  ...BASKET_FOOD_ITEMS,
  ...BASKET_PROTEIN_ITEMS,
  ...BASKET_HYGIENE_ITEMS,
];

export const CANONICAL_BASKET_BY_SLUG = new Map<string, CanonicalBasketItem>(
  CANONICAL_BASKET_ITEMS.map((item) => [item.slug, item])
);
