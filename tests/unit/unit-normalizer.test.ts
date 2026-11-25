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

  it("parses unit-based packs and consumer items without confusing weights for counts", () => {
    expect(
      parsePackageSize(
        "Jabón de Tocador Café y Aceite de Almendras Palmolive 330 Gr 3 Pack",
        "unit"
      )
    ).toStrictEqual({
      quantity: 3,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Jabón de Baño Protex Avena 3 x 110gr", "unit")
    ).toStrictEqual({
      quantity: 3,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Jabón de Baño Protex 110gr", "unit")
    ).toStrictEqual({
      quantity: 1,
      unit: "unit",
      hasExplicitSize: false,
    });

    expect(
      parsePackageSize("Crema Dental Colgate Triple Acción x 75 ml", "unit")
    ).toStrictEqual({
      quantity: 1,
      unit: "unit",
      hasExplicitSize: false,
    });

    expect(
      parsePackageSize("Crema Dental Colgate 2x75ml", "unit")
    ).toStrictEqual({
      quantity: 2,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Desodorante Rexona Men Roll On 50ml", "unit")
    ).toStrictEqual({
      quantity: 1,
      unit: "unit",
      hasExplicitSize: false,
    });

    expect(
      parsePackageSize("Toallas Sanitarias Nosotras x 10", "unit")
    ).toStrictEqual({
      quantity: 10,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Afeitadora Prestobarba Blister x 3", "unit")
    ).toStrictEqual({
      quantity: 3,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Jabón Palmolive Tripack 330g", "unit")
    ).toStrictEqual({
      quantity: 3,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Papel Higiénico Caricias 215 Hojas", "unit")
    ).toStrictEqual({
      quantity: 1,
      unit: "unit",
      hasExplicitSize: false,
    });

    expect(
      parsePackageSize("Pollo Entero San Blas de 1,80 kg (aproximado)", "kg")
    ).toStrictEqual({
      quantity: 1.8,
      unit: "kg",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize(
        "GILLETTE MAQUINA DESECHABLE PRESTOBARBA 3 EXTRA SUAVE X2UN",
        "unit"
      )
    ).toStrictEqual({
      quantity: 2,
      unit: "unit",
      hasExplicitSize: true,
    });

    expect(
      parsePackageSize("Desodorante En Spray X5 Speed Stick 91 Gr", "unit")
    ).toStrictEqual({
      quantity: 1,
      unit: "unit",
      hasExplicitSize: false,
    });
  });

  it("calculates normalized unit prices accurately", () => {
    // 500g pasta at $1.10 -> $2.20 / kg
    expect(calculateNormalizedUnitPrice(1.1, 0.5)).toBe(2.2);
    // 30-egg carton at $5.40 -> $0.18 / unit
    expect(calculateNormalizedUnitPrice(5.4, 30)).toBe(0.18);
  });
});
