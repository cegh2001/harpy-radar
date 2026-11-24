import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ingestionRuns,
  priceObservations,
  retailers,
  type IngestionRunRow,
  type PriceObservationInsert,
  type PriceObservationRow,
  type RetailerRow,
} from "@/db/schema";

export interface LatestObservationJoined {
  observation: PriceObservationRow;
  retailer: RetailerRow;
}

export interface PriceRepositoryPort {
  getRetailerBySlug(slug: string): Promise<RetailerRow | null>;
  getAllRetailers(): Promise<RetailerRow[]>;
  saveObservationsBatch(rows: PriceObservationInsert[]): Promise<number>;
  getLatestObservations(region?: string): Promise<LatestObservationJoined[]>;
  getProductHistory(
    canonicalProductId: number,
    days?: number
  ): Promise<LatestObservationJoined[]>;
  recordIngestionRun(input: {
    jobName: string;
    retailerSlug: string | null;
    status: "completed" | "partial" | "failed";
    itemsFetched: number;
    itemsMatched: number;
    itemsSaved: number;
    errorMessage: string | null;
    startedAt: Date;
    finishedAt: Date;
  }): Promise<IngestionRunRow>;
}

export const priceRepository: PriceRepositoryPort = {
  async getRetailerBySlug(slug: string): Promise<RetailerRow | null> {
    const [row] = await db
      .select()
      .from(retailers)
      .where(eq(retailers.slug, slug))
      .limit(1);
    return row ?? null;
  },

  async getAllRetailers(): Promise<RetailerRow[]> {
    return db.select().from(retailers);
  },

  async saveObservationsBatch(rows: PriceObservationInsert[]): Promise<number> {
    if (rows.length === 0) return 0;

    const inserted = await db
      .insert(priceObservations)
      .values(rows)
      .onConflictDoNothing({
        target: [
          priceObservations.retailerId,
          priceObservations.externalSku,
          priceObservations.observedDate,
          priceObservations.contentHash,
        ],
      })
      .returning({ id: priceObservations.id });

    return inserted.length;
  },

  async getLatestObservations(
    region?: string
  ): Promise<LatestObservationJoined[]> {
    const rows = await db
      .select({
        observation: priceObservations,
        retailer: retailers,
      })
      .from(priceObservations)
      .innerJoin(retailers, eq(priceObservations.retailerId, retailers.id))
      .orderBy(desc(priceObservations.observedAt));

    const seen = new Set<string>();
    const latest: LatestObservationJoined[] = [];

    for (const row of rows) {
      if (
        region &&
        region !== "all" &&
        !row.observation.region.toLowerCase().includes(region.toLowerCase())
      ) {
        continue;
      }
      const key = `${row.observation.canonicalProductId}:${row.observation.retailerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(row);
    }

    return latest;
  },

  async getProductHistory(
    canonicalProductId: number,
    days = 30
  ): Promise<LatestObservationJoined[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db
      .select({
        observation: priceObservations,
        retailer: retailers,
      })
      .from(priceObservations)
      .innerJoin(retailers, eq(priceObservations.retailerId, retailers.id))
      .where(
        and(
          eq(priceObservations.canonicalProductId, canonicalProductId),
          gte(priceObservations.observedAt, since)
        )
      )
      .orderBy(desc(priceObservations.observedAt));
  },

  async recordIngestionRun(input) {
    const [row] = await db.insert(ingestionRuns).values(input).returning();
    return row;
  },
};
