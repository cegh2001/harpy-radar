import { db } from "@/db/client";
import { workerHeartbeats, type WorkerHeartbeatRow } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface HeartbeatUpdateInput {
  isExecuting: boolean;
  lastCycleAt?: Date;
  lastCycleStatus?: string;
  lastError?: string | null;
  incrementCycle?: boolean;
}

export async function recordJobHeartbeat(
  jobName: string,
  input: HeartbeatUpdateInput
): Promise<void> {
  const now = new Date();
  await db
    .insert(workerHeartbeats)
    .values({
      jobName,
      isExecuting: input.isExecuting,
      lastHeartbeatAt: now,
      lastCycleAt: input.lastCycleAt ?? null,
      lastCycleStatus: input.lastCycleStatus ?? "ready",
      lastError: input.lastError ?? null,
      cycleCount: input.incrementCycle ? 1 : 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: workerHeartbeats.jobName,
      set: {
        isExecuting: input.isExecuting,
        lastHeartbeatAt: now,
        ...(input.lastCycleAt !== undefined
          ? { lastCycleAt: input.lastCycleAt }
          : {}),
        ...(input.lastCycleStatus !== undefined
          ? { lastCycleStatus: input.lastCycleStatus }
          : {}),
        ...(input.lastError !== undefined
          ? { lastError: input.lastError }
          : {}),
        ...(input.incrementCycle
          ? { cycleCount: sql`${workerHeartbeats.cycleCount} + 1` }
          : {}),
        updatedAt: now,
      },
    });
}

export async function getAllJobHeartbeats(): Promise<WorkerHeartbeatRow[]> {
  return db.select().from(workerHeartbeats);
}

export async function markAllShutdown(): Promise<void> {
  const now = new Date();
  await db
    .update(workerHeartbeats)
    .set({
      isExecuting: false,
      lastCycleStatus: "shutdown",
      updatedAt: now,
    })
    .where(eq(workerHeartbeats.isExecuting, true));
}
