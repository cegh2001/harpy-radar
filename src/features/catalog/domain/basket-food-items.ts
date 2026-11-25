import { BASKET_DAIRY_PANTRY_ITEMS } from "./basket-dairy-pantry-items";
import { BASKET_STAPLE_ITEMS } from "./basket-staple-items";
import type { CanonicalBasketItem } from "./basket-types";

export const BASKET_FOOD_ITEMS: CanonicalBasketItem[] = [
  ...BASKET_STAPLE_ITEMS,
  ...BASKET_DAIRY_PANTRY_ITEMS,
];
