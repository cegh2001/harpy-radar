import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  dailyAnomalyDigests,
  skuArbitrationCache,
  type AnomalyDigestHighlightRow,
  type DailyAnomalyDigestRow,
  type SkuArbitrationCacheRow,
} from "@/db/schema";
import {
  buildArbitrationCacheKey,
  type CachedSkuVerdict,
  type DailyAnomalyDigestDto,
  type ProductTier,
} from "../domain/arbiter-schemas";

export interface SaveSkuVerdictInput {
  canonicalSlug: string;
  normalizedTitleHash: string;
  sampleRawTitle: string;
  isValidMatch: boolean;
  tier: ProductTier;
  effectivePackageMultiplier: number;
  confidence: number;
  reason: string;
  modelUsed: string;
  promptTokens: number | null;
  outputTokens: number | null;
  arbitratedDate: string;
  expiresAt: Date;
}

export interface SaveDailyDigestInput {
  digestDate: string;
  headline: string;
  summary: string;
  highlights: AnomalyDigestHighlightRow[];
  flaggedProductsCount: number;
  outlierOffersCount: number;
  modelUsed: string;
  promptTokens: number | null;
  outputTokens: number | null;
}

export interface ArbitrationRepositoryPort {
  getActiveVerdictsBySlugs(
    canonicalSlugs: readonly string[],
    now?: Date
  ): Promise<Map<string, CachedSkuVerdict>>;
  countArbitrationsForDate(dateKey: string): Promise<number>;
  upsertVerdict(input: SaveSkuVerdictInput): Promise<void>;
  getDigestForDate(dateKey: string): Promise<DailyAnomalyDigestDto | null>;
  getLatestDigest(): Promise<DailyAnomalyDigestDto | null>;
  saveDigest(input: SaveDailyDigestInput): Promise<DailyAnomalyDigestDto>;
}

function mapVerdictRow(row: SkuArbitrationCacheRow): CachedSkuVerdict {
  return {
    canonicalSlug: row.canonicalSlug,
    normalizedTitleHash: row.normalizedTitleHash,
    sampleRawTitle: row.sampleRawTitle,
    isValidMatch: row.isValidMatch,
    tier: row.tier as ProductTier,
    effectivePackageMultiplier: Number(row.effectivePackageMultiplier),
    confidence: Number(row.confidence),
    reason: row.reason,
    modelUsed: row.modelUsed,
    arbitratedDate: row.arbitratedDate,
    expiresAt: row.expiresAt,
  };
}

function mapDigestRow(row: DailyAnomalyDigestRow): DailyAnomalyDigestDto {
  return {
    digestDate: row.digestDate,
    headline: row.headline,
    summary: row.summary,
    highlights: row.highlightsJson,
    flaggedProductsCount: row.flaggedProductsCount,
    outlierOffersCount: row.outlierOffersCount,
    modelUsed: row.modelUsed,
    createdAt: row.createdAt.toISOString(),
  };
}

export const arbitrationRepository: ArbitrationRepositoryPort = {
  async getActiveVerdictsBySlugs(
    canonicalSlugs: readonly string[],
    now = new Date()
  ): Promise<Map<string, CachedSkuVerdict>> {
    const result = new Map<string, CachedSkuVerdict>();
    if (canonicalSlugs.length === 0) return result;

    const rows = await db
      .select()
      .from(skuArbitrationCache)
      .where(
        and(
          inArray(skuArbitrationCache.canonicalSlug, [...canonicalSlugs]),
          gt(skuArbitrationCache.expiresAt, now)
        )
      );

    for (const row of rows) {
      const key = buildArbitrationCacheKey(
        row.canonicalSlug,
        row.sampleRawTitle
      );
      const mapped = mapVerdictRow(row);
      result.set(`${row.canonicalSlug}:${row.normalizedTitleHash}`, mapped);
      result.set(key, mapped);
    }

    return result;
  },

  async countArbitrationsForDate(dateKey: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(skuArbitrationCache)
      .where(eq(skuArbitrationCache.arbitratedDate, dateKey));
    return row?.count ?? 0;
  },

  async upsertVerdict(input: SaveSkuVerdictInput): Promise<void> {
    const now = new Date();
    await db
      .insert(skuArbitrationCache)
      .values({
        canonicalSlug: input.canonicalSlug,
        normalizedTitleHash: input.normalizedTitleHash,
        sampleRawTitle: input.sampleRawTitle,
        isValidMatch: input.isValidMatch,
        tier: input.tier,
        effectivePackageMultiplier: input.effectivePackageMultiplier.toFixed(4),
        confidence: input.confidence.toFixed(3),
        reason: input.reason,
        modelUsed: input.modelUsed,
        promptTokens: input.promptTokens,
        outputTokens: input.outputTokens,
        arbitratedDate: input.arbitratedDate,
        expiresAt: input.expiresAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          skuArbitrationCache.canonicalSlug,
          skuArbitrationCache.normalizedTitleHash,
        ],
        set: {
          sampleRawTitle: input.sampleRawTitle,
          isValidMatch: input.isValidMatch,
          tier: input.tier,
          effectivePackageMultiplier:
            input.effectivePackageMultiplier.toFixed(4),
          confidence: input.confidence.toFixed(3),
          reason: input.reason,
          modelUsed: input.modelUsed,
          promptTokens: input.promptTokens,
          outputTokens: input.outputTokens,
          arbitratedDate: input.arbitratedDate,
          expiresAt: input.expiresAt,
          updatedAt: now,
        },
      });
  },

  async getDigestForDate(
    dateKey: string
  ): Promise<DailyAnomalyDigestDto | null> {
    const [row] = await db
      .select()
      .from(dailyAnomalyDigests)
      .where(eq(dailyAnomalyDigests.digestDate, dateKey))
      .limit(1);
    return row ? mapDigestRow(row) : null;
  },

  async getLatestDigest(): Promise<DailyAnomalyDigestDto | null> {
    const [row] = await db
      .select()
      .from(dailyAnomalyDigests)
      .orderBy(desc(dailyAnomalyDigests.digestDate))
      .limit(1);
    return row ? mapDigestRow(row) : null;
  },

  async saveDigest(
    input: SaveDailyDigestInput
  ): Promise<DailyAnomalyDigestDto> {
    const [row] = await db
      .insert(dailyAnomalyDigests)
      .values({
        digestDate: input.digestDate,
        headline: input.headline,
        summary: input.summary,
        highlightsJson: input.highlights,
        flaggedProductsCount: input.flaggedProductsCount,
        outlierOffersCount: input.outlierOffersCount,
        modelUsed: input.modelUsed,
        promptTokens: input.promptTokens,
        outputTokens: input.outputTokens,
      })
      .onConflictDoUpdate({
        target: [dailyAnomalyDigests.digestDate],
        set: {
          headline: input.headline,
          summary: input.summary,
          highlightsJson: input.highlights,
          flaggedProductsCount: input.flaggedProductsCount,
          outlierOffersCount: input.outlierOffersCount,
          modelUsed: input.modelUsed,
          promptTokens: input.promptTokens,
          outputTokens: input.outputTokens,
        },
      })
      .returning();

    return mapDigestRow(row);
  },
};
