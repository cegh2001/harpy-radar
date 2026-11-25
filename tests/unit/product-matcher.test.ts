import { describe, expect, it } from "vitest";
import {
  CANONICAL_BASKET_ITEMS,
  type BasketCategory,
} from "@/features/catalog/domain/canonical-basket";
import { matchRawProductToCanonical } from "@/features/catalog/domain/product-matcher";

const VALID_CATEGORIES = new Set<BasketCategory>([
  "grains_flours",
  "legumes",
  "oils_fats",
  "dairy_eggs",
  "proteins",
  "pantry",
  "personal_care",
  "household_cleaning",
]);

describe("product-matcher", () => {
  it("keeps canonical catalog integrity across all 41 items", () => {
    expect(CANONICAL_BASKET_ITEMS).toHaveLength(41);

    const slugs = new Set<string>();
    for (const item of CANONICAL_BASKET_ITEMS) {
      expect(slugs.has(item.slug)).toBe(false);
      slugs.add(item.slug);
      expect(item.searchTerms.length).toBeGreaterThan(0);
      expect(item.requiredTokens.length).toBeGreaterThan(0);
      expect(item.expectedMinUnitUsd).toBeLessThan(item.expectedMaxUnitUsd);
      expect(VALID_CATEGORIES.has(item.category)).toBe(true);
    }
  });

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

  it("routes Palmolive coffee soap to jabon-bano and rejects reported false positives", () => {
    const soapPackMatch = matchRawProductToCanonical(
      "Jabón de Tocador Café y Aceite de Almendras Palmolive 330 Gr 3 Pack",
      6.36,
      CANONICAL_BASKET_ITEMS
    );
    expect(soapPackMatch?.canonicalSlug).toBe("jabon-bano");
    expect(soapPackMatch?.packageSize).toStrictEqual({
      quantity: 3,
      unit: "unit",
      hasExplicitSize: true,
    });
    expect(soapPackMatch?.normalizedUnitPriceUsd).toBe(2.12);

    expect(
      matchRawProductToCanonical(
        "Picadillo De Pollo Por Kg",
        3.45,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Tronquitos/Sardinas Provemar KG",
        4.49,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Queso Blanco De Bufala KG",
        11.48,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();
  });

  it("routes poultry cuts, deli meats, and whole chicken without cross-contamination", () => {
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

    const mortadelaMatch = matchRawProductToCanonical(
      "Mortadela de Pollo Superior Hermo 1 Kg",
      3.9,
      CANONICAL_BASKET_ITEMS
    );
    expect(mortadelaMatch?.canonicalSlug).toBe("mortadela");
    expect(mortadelaMatch?.normalizedUnitPriceUsd).toBe(3.9);

    const breastMatch = matchRawProductToCanonical(
      "Pechuga de Pollo Entera 1kg",
      6.6528,
      CANONICAL_BASKET_ITEMS
    );
    expect(breastMatch?.canonicalSlug).toBe("pechuga-pollo");
    expect(breastMatch?.normalizedUnitPriceUsd).toBe(6.6528);

    const thighMatch = matchRawProductToCanonical(
      "Cuadril De Pollo KG",
      3.78,
      CANONICAL_BASKET_ITEMS
    );
    expect(thighMatch?.canonicalSlug).toBe("muslo-pollo");
    expect(thighMatch?.normalizedUnitPriceUsd).toBe(3.78);

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

    const cmWhole = matchRawProductToCanonical(
      "Pollo La Caridad Congelado KG",
      3.88,
      CANONICAL_BASKET_ITEMS
    );
    expect(cmWhole?.canonicalSlug).toBe("pollo-entero");
    expect(cmWhole?.normalizedUnitPriceUsd).toBe(3.88);
  });

  it("routes expanded beef, pork, deli, dairy, bread, personal care, and cleaning items", () => {
    expect(
      matchRawProductToCanonical(
        "Bistec de Res 1kg",
        10.5,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("carne-res-corte");

    expect(
      matchRawProductToCanonical(
        "Chuleta de Cerdo 1kg",
        8.9,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("chuleta-cerdo");

    expect(
      matchRawProductToCanonical(
        "Jamón de Pierna Plumrose 500 Gr",
        4.5,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("jamon-cocido");

    expect(
      matchRawProductToCanonical(
        "Leche Líquida Completa Purísima 1 Lt",
        2.1,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("leche-liquida");

    expect(
      matchRawProductToCanonical(
        "Queso Amarillo Gouda Torondoy 500 Gr",
        7.5,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("queso-amarillo");

    expect(
      matchRawProductToCanonical(
        "Pan de Molde Blanco Bimbo 500 Gr",
        2.8,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("pan-molde");

    expect(
      matchRawProductToCanonical(
        "Jabón Azul Las Llaves 250 Gr",
        0.95,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("jabon-azul");

    expect(
      matchRawProductToCanonical(
        "Cloro Nevex 1 Lt",
        1.4,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("cloro");

    expect(
      matchRawProductToCanonical(
        "Desinfectante Mistolin Lavanda 1 Lt",
        1.65,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("desinfectante");

    expect(
      matchRawProductToCanonical(
        "Shampoo Head & Shoulders 375 ml",
        5.2,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("champu");

    expect(
      matchRawProductToCanonical(
        "Toallas Sanitarias Kotex Nocturna 8 Und",
        2.4,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("toallas-sanitarias");

    expect(
      matchRawProductToCanonical(
        "Afeitadora Desechable Prestobarba 3 Und",
        2.1,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("afeitadora-desechable");

    expect(
      matchRawProductToCanonical(
        "Crema Dental Colgate 1 Und",
        2.5,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("crema-dental");

    expect(
      matchRawProductToCanonical(
        "Pasta Dental Colgate 1 Und",
        2.5,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("crema-dental");

    expect(
      matchRawProductToCanonical(
        "Desodorante Rexona 1 Und",
        3.9,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("desodorante");
  });

  it("enforces unit-aware normalization and package constraints across real-world titles", () => {
    const singleSoap = matchRawProductToCanonical(
      "Jabón de Baño Protex Avena 110gr",
      1.2,
      CANONICAL_BASKET_ITEMS
    );
    expect(singleSoap?.canonicalSlug).toBe("jabon-bano");
    expect(singleSoap?.normalizedUnitPriceUsd).toBe(1.2);

    const threePackSoap = matchRawProductToCanonical(
      "Jabón de Baño Protex 3 x 110gr",
      3.3,
      CANONICAL_BASKET_ITEMS
    );
    expect(threePackSoap?.canonicalSlug).toBe("jabon-bano");
    expect(threePackSoap?.normalizedUnitPriceUsd).toBe(1.1);

    const toothpasteSingle = matchRawProductToCanonical(
      "Crema Dental Colgate Triple Acción x 75 ml",
      2.4,
      CANONICAL_BASKET_ITEMS
    );
    expect(toothpasteSingle?.canonicalSlug).toBe("crema-dental");
    expect(toothpasteSingle?.normalizedUnitPriceUsd).toBe(2.4);

    const toothpasteDuo = matchRawProductToCanonical(
      "Crema Dental Colgate 2x75ml",
      4.2,
      CANONICAL_BASKET_ITEMS
    );
    expect(toothpasteDuo?.canonicalSlug).toBe("crema-dental");
    expect(toothpasteDuo?.normalizedUnitPriceUsd).toBe(2.1);

    const deodorant = matchRawProductToCanonical(
      "Desodorante Rexona Men 50ml",
      3.5,
      CANONICAL_BASKET_ITEMS
    );
    expect(deodorant?.canonicalSlug).toBe("desodorante");
    expect(deodorant?.normalizedUnitPriceUsd).toBe(3.5);

    const razorPack = matchRawProductToCanonical(
      "Afeitadora Prestobarba Ultragrip x 3",
      2.4,
      CANONICAL_BASKET_ITEMS
    );
    expect(razorPack?.canonicalSlug).toBe("afeitadora-desechable");
    expect(razorPack?.normalizedUnitPriceUsd).toBe(0.8);

    const padsPack = matchRawProductToCanonical(
      "Toallas Sanitarias Nosotras x 10",
      2.5,
      CANONICAL_BASKET_ITEMS
    );
    expect(padsPack?.canonicalSlug).toBe("toallas-sanitarias");
    expect(padsPack?.normalizedUnitPriceUsd).toBe(0.25);

    expect(
      matchRawProductToCanonical(
        "Papel Higiénico Caricias 300 Hojas",
        2.07,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    const toiletPaperRollPack = matchRawProductToCanonical(
      "Papel Higiénico Rosal Plus 400 Hojas Por 4 Rollos",
      2.5,
      CANONICAL_BASKET_ITEMS
    );
    expect(toiletPaperRollPack?.canonicalSlug).toBe("papel-higienico");
    expect(toiletPaperRollPack?.normalizedUnitPriceUsd).toBe(0.625);

    expect(
      matchRawProductToCanonical(
        "Sardina Margarita 170gr",
        1.5,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("sardinas-lata");

    expect(
      matchRawProductToCanonical(
        "Sardina Oriental 1kg",
        4.5,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Atún en Aceite Margarita 140g",
        2.1,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("atun-lata");

    expect(
      matchRawProductToCanonical(
        "Atún Empacado 1kg",
        14.0,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Huevos de Gallina",
        5.4,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();

    expect(
      matchRawProductToCanonical(
        "Toallas Sanitarias Kotex Nocturna",
        2.4,
        CANONICAL_BASKET_ITEMS
      )
    ).toBeNull();
  });

  it("blocks plural false positives, fruit/pork pulp, deli poultry, and tomato-sauce fish", () => {
    const rejectCases: Array<[string, number]> = [
      ["Galletas De Arroz Rice Cakes Con Sal 12 Und", 2.16],
      ["Filtros para Café Blank & Dark 50 Und", 12.02],
      ["Café en Granos San Domingo 1 Kg", 15.56],
      ["NESCAFE DOLCE GUSTO CAFE AU LAIT X10", 14.06],
      ["Salchichas de Pollo Económicas Fiesta 12 Und", 3.66],
      ["Sal de Frutas MakEno Naranja Biumak x 10 Sobres", 2.48],
      ["Pulpa de Fresa Tu Verdura 1 Kg", 5.49],
      ["Pulpa de Pernil 1kg", 8.99],
      ["Salsa de Tomate Boloñesa Olé 200 Gr", 1.47],
      ["Pechuga Cocida de Pollo Light Punta de Monte 800 Gr", 5.61],
    ];

    for (const [title, price] of rejectCases) {
      expect(
        matchRawProductToCanonical(title, price, CANONICAL_BASKET_ITEMS)
      ).toBeNull();
    }

    expect(
      matchRawProductToCanonical(
        "Pulpa Negra De Res CM 1000Gr",
        8.79,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("carne-res-corte");

    expect(
      matchRawProductToCanonical(
        "Sardinas en Salsa de Tomate Omega 170 Gr",
        0.92,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("sardinas-lata");

    expect(
      matchRawProductToCanonical(
        "YOFFI ATUN DESMENUZADO SALSA TOMATE 170G",
        1.63,
        CANONICAL_BASKET_ITEMS
      )?.canonicalSlug
    ).toBe("atun-lata");

    const x2Razor = matchRawProductToCanonical(
      "GILLETTE MAQUINA DESECHABLE PRESTOBARBA 3 EXTRA SUAVE X2UN",
      8.66,
      CANONICAL_BASKET_ITEMS
    );
    expect(x2Razor?.canonicalSlug).toBe("afeitadora-desechable");
    expect(x2Razor?.packageSize).toStrictEqual({
      quantity: 2,
      unit: "unit",
      hasExplicitSize: true,
    });
    expect(x2Razor?.normalizedUnitPriceUsd).toBe(4.33);
  });
});
