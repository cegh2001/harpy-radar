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

function matchesExcludedToken(
  normalizedTitle: string,
  tokens: string[],
  excludedToken: string
): boolean {
  const clean = normalizeText(excludedToken);
  if (!clean) return false;
  if (clean.includes(" ")) {
    return normalizedTitle.includes(clean);
  }
  if (tokens.includes(clean)) return true;
  if (clean.length >= 4) {
    return tokens.includes(`${clean}s`) || tokens.includes(`${clean}es`);
  }
  return false;
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

function matchesPrimarySubject(
  normalizedTitle: string,
  tokens: string[],
  firstGroup: string | undefined
): boolean {
  if (!firstGroup) return false;
  const leadTokens = tokens.slice(0, 2);
  return firstGroup
    .split("|")
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .some((clean) =>
      clean.includes(" ")
        ? normalizedTitle.startsWith(clean)
        : leadTokens.includes(clean)
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
      matchesExcludedToken(normalizedTitle, tokens, excluded)
    );
    if (hasExcluded) continue;

    const allRequiredMatched = item.requiredTokens.every((group) =>
      matchesRequiredGroup(normalizedTitle, tokens, group)
    );
    if (!allRequiredMatched) continue;

    const packageSize = parsePackageSize(rawTitle, item.baseUnit);
    if (packageSize.unit !== item.baseUnit) continue;

    if (item.requireExplicitSize && !packageSize.hasExplicitSize) {
      continue;
    }
    if (
      item.minPackageSize !== undefined &&
      packageSize.quantity < item.minPackageSize
    ) {
      continue;
    }
    if (
      item.maxPackageSize !== undefined &&
      packageSize.quantity > item.maxPackageSize
    ) {
      continue;
    }

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

    const baseConfidence = packageSize.hasExplicitSize
      ? Math.min(0.97, 0.78 + item.requiredTokens.length * 0.08)
      : Math.min(0.76, 0.64 + item.requiredTokens.length * 0.04);
    const primaryBonus = matchesPrimarySubject(
      normalizedTitle,
      tokens,
      item.requiredTokens[0]
    )
      ? 0.02
      : 0;
    const confidence = Math.min(0.99, baseConfidence + primaryBonus);

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
