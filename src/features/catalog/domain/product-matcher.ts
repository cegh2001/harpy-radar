import type { CanonicalBasketItem } from "./canonical-basket";
import {
  calculateNormalizedUnitPrice,
  normalizeText,
  parsePackageSize,
  tokenizeNormalized,
  type ParsedPackageSize,
} from "./unit-normalizer";

export interface ProductMatchResult {
  canonicalSlug: string;
  canonicalName: string;
  packageSize: ParsedPackageSize;
  normalizedUnitPriceUsd: number;
  confidence: number;
}

function containsToken(
  normalizedTitle: string,
  tokens: string[],
  candidateToken: string
): boolean {
  const clean = normalizeText(candidateToken);
  if (!clean) return false;
  if (clean.includes(" ")) {
    return normalizedTitle.includes(clean);
  }
  return tokens.includes(clean);
}

function matchesRequiredGroup(
  normalizedTitle: string,
  tokens: string[],
  group: string
): boolean {
  const alternatives = group.split("|").map((part) => part.trim());
  return alternatives.some((alt) =>
    containsToken(normalizedTitle, tokens, alt)
  );
}

/**
 * Deterministically maps a raw retailer product title and BCV USD price
 * to a canonical basket item. Returns null when ambiguous or out of bounds.
 */
export function matchRawProductToCanonical(
  rawTitle: string,
  priceUsdBcv: number,
  catalog: CanonicalBasketItem[]
): ProductMatchResult | null {
  if (!Number.isFinite(priceUsdBcv) || priceUsdBcv <= 0) {
    return null;
  }

  const normalizedTitle = normalizeText(rawTitle);
  if (!normalizedTitle) return null;

  const tokens = tokenizeNormalized(rawTitle);
  let bestMatch: ProductMatchResult | null = null;

  for (const item of catalog) {
    const hasExcluded = item.excludedTokens.some((excluded) =>
      containsToken(normalizedTitle, tokens, excluded)
    );
    if (hasExcluded) continue;

    const allRequiredMatched = item.requiredTokens.every((group) =>
      matchesRequiredGroup(normalizedTitle, tokens, group)
    );
    if (!allRequiredMatched) continue;

    const packageSize = parsePackageSize(rawTitle, item.baseUnit);
    if (packageSize.unit !== item.baseUnit) continue;

    // Require explicit size for weight/volume items unless price already falls cleanly in range
    if (!packageSize.hasExplicitSize && item.baseUnit !== "unit") {
      if (
        priceUsdBcv < item.expectedMinUnitUsd ||
        priceUsdBcv > item.expectedMaxUnitUsd
      ) {
        continue;
      }
    }

    const normalizedUnitPriceUsd = calculateNormalizedUnitPrice(
      priceUsdBcv,
      packageSize.quantity
    );

    if (
      normalizedUnitPriceUsd < item.expectedMinUnitUsd ||
      normalizedUnitPriceUsd > item.expectedMaxUnitUsd
    ) {
      continue;
    }

    const confidence = packageSize.hasExplicitSize
      ? Math.min(0.99, 0.78 + item.requiredTokens.length * 0.08)
      : 0.72;

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        canonicalSlug: item.slug,
        canonicalName: item.name,
        packageSize,
        normalizedUnitPriceUsd,
        confidence: Math.round(confidence * 1000) / 1000,
      };
    }
  }

  return bestMatch;
}
