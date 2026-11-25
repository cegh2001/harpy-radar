import type { BaseUnit } from "./canonical-basket";

export interface ParsedPackageSize {
  quantity: number;
  unit: BaseUnit;
  hasExplicitSize: boolean;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalized(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.split(" ") : [];
}

function parseNumericToken(raw: string): number {
  return Number.parseFloat(raw.replace(",", "."));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function scaleMassOrVolume(
  value: number,
  rawUnit: string
): { quantity: number; unit: "kg" | "l" } | null {
  const u = rawUnit.toLowerCase();
  if (["kg", "kilo", "kilos", "kl", "kls"].includes(u)) {
    return { quantity: round4(value), unit: "kg" };
  }
  if (["g", "gr", "grs", "gramo", "gramos"].includes(u)) {
    return { quantity: round4(value / 1000), unit: "kg" };
  }
  if (["l", "lt", "lts", "litro", "litros"].includes(u)) {
    return { quantity: round4(value), unit: "l" };
  }
  if (["ml", "cc"].includes(u)) {
    return { quantity: round4(value / 1000), unit: "l" };
  }
  return null;
}

function parseExplicitUnitCount(
  normalized: string,
  includeMassMultipackCount: boolean
): ParsedPackageSize | null {
  if (/\bmedio\s+carton\b/.test(normalized)) {
    return { quantity: 15, unit: "unit", hasExplicitSize: true };
  }
  if (/\bcarton\b/.test(normalized)) {
    return { quantity: 30, unit: "unit", hasExplicitSize: true };
  }
  if (/\bdocena\b/.test(normalized)) {
    return { quantity: 12, unit: "unit", hasExplicitSize: true };
  }

  const unitMatch = normalized.match(
    /(?:\b|\bx\s*)(\d+)\s*(unds?|unids?|unidades?|unidad|un|rollos?|rollo|barras?|barra|pzas?|pza|toallas?|afeitadoras?|tubos?|pastillas?|u)\b/
  );
  if (unitMatch) {
    const count = Number.parseInt(unitMatch[1], 10);
    if (count > 0) {
      return { quantity: round4(count), unit: "unit", hasExplicitSize: true };
    }
  }

  const numericPackMatch = normalized.match(/\b(\d+)\s*-?\s*(?:pack|pk|pck)\b/);
  if (numericPackMatch) {
    const count = Number.parseInt(numericPackMatch[1], 10);
    if (count > 0) {
      return { quantity: round4(count), unit: "unit", hasExplicitSize: true };
    }
  }

  if (/\btri\s*-?\s*pack\b/.test(normalized)) {
    return { quantity: 3, unit: "unit", hasExplicitSize: true };
  }
  if (/\b(?:bi|duo)\s*-?\s*pack\b/.test(normalized)) {
    return { quantity: 2, unit: "unit", hasExplicitSize: true };
  }

  const prefixPackMatch = normalized.match(
    /\b(?:pack|pk|paquete|estuche|blister|bolsa|caja|display)\s*(?:de|por|x)?\s*(\d+)\b(?!\s*(?:[.,]\d+\s*)?(?:kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc|oz|lb|cm|mm|m|mts?|metros?|hojas?|capas?)\b)/
  );
  if (prefixPackMatch) {
    const count = Number.parseInt(prefixPackMatch[1], 10);
    if (count > 0) {
      return { quantity: round4(count), unit: "unit", hasExplicitSize: true };
    }
  }

  if (includeMassMultipackCount) {
    const massMultipackMatch = normalized.match(
      /(\d+)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc)\b/
    );
    if (massMultipackMatch) {
      const count = Number.parseInt(massMultipackMatch[1], 10);
      if (count > 0) {
        return { quantity: round4(count), unit: "unit", hasExplicitSize: true };
      }
    }
  }

  const bareMultiplyMatch = normalized.match(
    /\bx\s*(\d+)\b(?!\s*(?:[.,]\d+\s*)?(?:kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc|oz|lb|cm|mm|m|mts?|metros?|hojas?|capas?|speed|stick)\b)/
  );
  if (bareMultiplyMatch) {
    const count = Number.parseInt(bareMultiplyMatch[1], 10);
    if (count > 0) {
      return { quantity: round4(count), unit: "unit", hasExplicitSize: true };
    }
  }

  return null;
}

function parseMassOrVolume(normalized: string): ParsedPackageSize | null {
  const multipackMatch = normalized.match(
    /(\d+)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc)\b/
  );
  if (multipackMatch) {
    const count = Number.parseInt(multipackMatch[1], 10);
    const eachVal = parseNumericToken(multipackMatch[2]);
    const scaled = scaleMassOrVolume(count * eachVal, multipackMatch[3]);
    if (scaled && scaled.quantity > 0) {
      return { ...scaled, hasExplicitSize: true };
    }
  }

  const unitMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc)\b/
  );
  if (unitMatch) {
    const val = parseNumericToken(unitMatch[1]);
    const scaled = scaleMassOrVolume(val, unitMatch[2]);
    if (scaled && scaled.quantity > 0) {
      return { ...scaled, hasExplicitSize: true };
    }
  }

  if (/\b(?:kg|kilo|kilos)\b/.test(normalized)) {
    return { quantity: 1, unit: "kg", hasExplicitSize: true };
  }
  if (/\b(?:litro|litros|lt|lts)\b/.test(normalized)) {
    return { quantity: 1, unit: "l", hasExplicitSize: true };
  }

  return null;
}

/**
 * Extracts normalized package size (in kg, l, or unit) from raw retail product titles.
 */
export function parsePackageSize(
  rawTitle: string,
  expectedBaseUnit?: BaseUnit
): ParsedPackageSize {
  const normalized = rawTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (expectedBaseUnit === "unit") {
    const unitCount = parseExplicitUnitCount(normalized, true);
    if (unitCount) return unitCount;
    return { quantity: 1, unit: "unit", hasExplicitSize: false };
  }

  if (expectedBaseUnit === "kg" || expectedBaseUnit === "l") {
    const measured = parseMassOrVolume(normalized);
    if (measured) return measured;
    return { quantity: 1, unit: expectedBaseUnit, hasExplicitSize: false };
  }

  const measured = parseMassOrVolume(normalized);
  if (measured) return measured;

  const unitCount = parseExplicitUnitCount(normalized, false);
  if (unitCount) return unitCount;

  return {
    quantity: 1,
    unit: "unit",
    hasExplicitSize: false,
  };
}

export function calculateNormalizedUnitPrice(
  priceUsd: number,
  packageSize: number
): number {
  if (!Number.isFinite(priceUsd) || priceUsd < 0) {
    throw new Error("priceUsd must be non-negative");
  }
  if (!Number.isFinite(packageSize) || packageSize <= 0) {
    throw new Error("packageSize must be positive");
  }
  return round4(priceUsd / packageSize);
}
