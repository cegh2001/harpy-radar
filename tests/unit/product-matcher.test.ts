import { describe, expect, it } from "vitest";
import { CANONICAL_BASKET_ITEMS } from "@/features/catalog/domain/canonical-basket";
import { matchRawProductToCanonical } from "@/features/catalog/domain/product-matcher";

describe("product-matcher", () => {
  it("matches authentic Bahia and Farmatodo Harina PAN titles", () => {
    const bahiaMatch = matchRawProductToCanonical(
      "Harina de maiz blanco pan 1kg",
      1.43,
      CANONICAL_BASKET_ITEMS
    );
    expect(bahiaMatch?.canonicalSlug).toBe("harina-maiz-precocida");
    expect(bahiaMatch?.normalizedUnitPriceUsd).toBe(1.43);

    const farmatodoMatch = matchRawProductToCanonical(
      "Harina PAN Maíz Blanco Gluten Free 1 Kg",
      1.11,
      CANONICAL_BASKET_ITEMS
    );
    expect(farmatodoMatch?.canonicalSlug).toBe("harina-maiz-precocida");
    expect(farmatodoMatch?.normalizedUnitPriceUsd).toBe(1.11);
  });

  it("routes Quaker oat flour to avena-hojuelas instead of cornmeal", () => {
    const match = matchRawProductToCanonical(
      "Avena harina quaker 400gr",
      2.31,
      CANONICAL_BASKET_ITEMS
    );

    expect(match?.canonicalSlug).toBe("avena-hojuelas");
    expect(match?.packageSize.quantity).toBe(0.4);
    expect(match?.normalizedUnitPriceUsd).toBe(5.775);
  });

  it("rejects excluded variants and out-of-range price outliers", () => {
    const integralMatch = matchRawProductToCanonical(
      "Harina Pan Integral De Maíz Blanco x 1000 gr",
      1.5,
      CANONICAL_BASKET_ITEMS
    );
    expect(integralMatch).toBeNull();

    const outlierMatch = matchRawProductToCanonical(
      "Harina de maiz blanco pan 1kg",
      25.0,
      CANONICAL_BASKET_ITEMS
    );
    expect(outlierMatch).toBeNull();
  });

  it("rejects pet food, offal, and beef cuts for pollo-entero while keeping whole chicken", () => {
    expect(
      matchRawProductToCanonical(
        "Alimento adulto pollo a la brasa  dogourmet 4kg",
        18.11,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Alimentos para Mascotas K-Nina Adulto Pollo con Vegetales 2Kg",
        9.3131,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Pollo de Res 1kg",
        16.37,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Patas de Pollo 1kg",
        3.12,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Mortadela de Pollo Superior Hermo 1 Kg",
        3.9,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Pechuga de Pollo Entera 1kg",
        6.6528,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    const bahiaWhole = matchRawProductToCanonical(
      "Pollo entero",
      3.09,
      CANONICAL_BASKET_ITEMS
    );
    expect(bahiaWhole?.canonicalSlug).toBe("pollo-entero");
    expect(bahiaWhole?.normalizedUnitPriceUsd).toBe(3.09);

    const rioWhole = matchRawProductToCanonical(
      "Pollo Entero Congelado 1kg",
      3.6207,
      CANONICAL_BASKET_ITEMS
    );
    expect(rioWhole?.canonicalSlug).toBe("pollo-entero");
    expect(rioWhole?.normalizedUnitPriceUsd).toBe(3.6207);
  });
});
