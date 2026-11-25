import { describe, expect, it } from "vitest";
import {
  calculateNormalizedUnitPrice,
  parsePackageSize,
} from "@/features/catalog/domain/unit-normalizer";

describe("unit-normalizer", () => {
  it("parses grams, kilograms, liters, milliliters, and multipacks", () => {
    expect(parsePackageSize("Harina de maiz blanco pan 1kg")).toStrictEqual({
      quantity: 1,
      unit: "kg",
      hasExplicitSize: true,
    });

    expect(parsePackageSize("Avena harina quaker 400gr")).toStrictEqual({
      quantity: 0.4,
      unit: "kg",
      hasExplicitSize: true,
    });

    expect(parsePackageSize("Aceite Vegetal 900 ml")).toStrictEqual({
      quantity: 0.9,
      unit: "l",
      hasExplicitSize: true,
    });

    expect(parsePackageSize("Atun en aceite 2 x 140g")).toStrictEqual({
      quantity: 0.28,
      unit: "kg",
      hasExplicitSize: true,
    });
  });

  it("parses unit counts, cartons, and rolls", () => {
    expect(parsePackageSize("Carton de huevos x 30 und")).toStrictEqual({
      quantity: 30,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(parsePackageSize("Medio Carton de Huevos")).toStrictEqual({
      quantity: 15,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(parsePackageSize("Papel Higienico Rosal 4 Rollos")).toStrictEqual({
      quantity: 4,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(parsePackageSize("Pollo La Caridad Congelado KG")).toStrictEqual({
      quantity: 1,
      unit: "kg",
      hasExplicitSize: true,
    });
  });

  it("calculates normalized unit prices accurately", () => {
    // 500g pasta at $1.10 -> $2.20 / kg
    expect(calculateNormalizedUnitPrice(1.1, 0.5)).toBe(2.2);
    // 30-egg carton at $5.40 -> $0.18 / unit
    expect(calculateNormalizedUnitPrice(5.4, 30)).toBe(0.18);
  });
});
