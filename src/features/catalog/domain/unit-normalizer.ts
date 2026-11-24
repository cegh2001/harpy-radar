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

function scaleToBaseUnit(
  value: number,
  rawUnit: string
): { quantity: number; unit: BaseUnit } | null {
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
  if (
    [
      "u",
      "un",
      "und",
      "unds",
      "unid",
      "unidad",
      "unidades",
      "rollo",
      "rollos",
      "barra",
      "barras",
      "pza",
      "pzas",
    ].includes(u)
  ) {
    return { quantity: round4(value), unit: "unit" };
  }
  return null;
}

/**
 * Extracts normalized package size (in kg, l, or unit) from raw retail product titles.
 */
export function parsePackageSize(
  rawTitle: string,
  fallbackBaseUnit: BaseUnit = "unit"
): ParsedPackageSize {
  const normalized = rawTitle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // 1. Multipacks such as "2 x 500g", "4x250ml", "3 x 1 kg"
  const multipackMatch = normalized.match(
    /(\d+)\s*[x*]\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc)\b/
  );
  if (multipackMatch) {
    const count = Number.parseInt(multipackMatch[1], 10);
    const eachVal = parseNumericToken(multipackMatch[2]);
    const scaled = scaleToBaseUnit(count * eachVal, multipackMatch[3]);
    if (scaled && scaled.quantity > 0) {
      return { ...scaled, hasExplicitSize: true };
    }
  }

  // 2. Standard single mass/volume/count (e.g. "1kg", "400 gr", "900ml", "4 rollos", "30 unid")
  const unitMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kls?|grs?|gramos?|g|lts?|litros?|l|ml|cc|unds?|unids?|unidades?|unidad|rollos?|rollo|barras?|barra|pzas?|pza|u)\b/
  );
  if (unitMatch) {
    const val = parseNumericToken(unitMatch[1]);
    const scaled = scaleToBaseUnit(val, unitMatch[2]);
    if (scaled && scaled.quantity > 0) {
      return { ...scaled, hasExplicitSize: true };
    }
  }

  // 3. Egg carton conventions and "x 30" / "x12"
  if (/\bmedio\s+carton\b/.test(normalized)) {
    return { quantity: 15, unit: "unit", hasExplicitSize: true };
  }
  if (/\bcarton\b/.test(normalized)) {
    return { quantity: 30, unit: "unit", hasExplicitSize: true };
  }
  if (/\bdocena\b/.test(normalized)) {
    return { quantity: 12, unit: "unit", hasExplicitSize: true };
  }

  const bareMultiplyMatch = normalized.match(/\bx\s*(\d+)\b/);
  if (bareMultiplyMatch) {
    const count = Number.parseInt(bareMultiplyMatch[1], 10);
    if (count > 0) {
      return { quantity: count, unit: "unit", hasExplicitSize: true };
    }
  }

  return {
    quantity: 1,
    unit: fallbackBaseUnit,
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
