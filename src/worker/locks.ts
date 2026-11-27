import { pool } from "@/db/client";
import type { PoolClient } from "pg";

export const JOB_LOCK_IDS: Record<string, number> = {
  "sync-rates": 988654321,
  "sync-rates-official": 988654330,
  "sync-rates-parallel": 988654331,
  "scrape-bahia": 988654322,
  "scrape-farmatodo": 988654323,
  "scrape-riomarket": 988654325,
  "scrape-central-madeirense": 988654326,
  "scrape-punto-al-mayor": 988654327,
  "scrape-viva": 988654328,
  "scrape-locatel": 988654329,
};

const MAX_INT32 = 2147483647;

export function getJobLockId(jobName: string): number {
  if (JOB_LOCK_IDS[jobName] !== undefined) {
    return JOB_LOCK_IDS[jobName];
  }
  let hash = 0;
  for (let i = 0; i < jobName.length; i++) {
    hash = (hash * 31 + jobName.charCodeAt(i)) % MAX_INT32;
  }
  return hash || 1;
}

export async function tryAcquireAdvisoryLock(
  client: PoolClient,
  lockId: number
): Promise<boolean> {
  const res = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [
    lockId,
  ]);
  return Boolean(res.rows[0]?.locked);
}

export async function releaseAdvisoryLock(
  client: PoolClient,
  lockId: number
): Promise<boolean> {
  const res = await client.query(
    "SELECT pg_advisory_unlock($1) AS unlocked",
    [lockId]
  );
  return Boolean(res.rows[0]?.unlocked);
}

export interface JobLockOptions {
  timeoutMs?: number;
  onSkipped?: () => void;
}

export interface JobLockResult<T = unknown> {
  lockAcquired: boolean;
  executed: boolean;
  skipped: boolean;
  result?: T;
}

export async function withJobLock<T = void>(
  jobName: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options?: JobLockOptions
): Promise<JobLockResult<T>> {
  const lockId = getJobLockId(jobName);
  const client = await pool.connect();

  let locked = false;
  try {
    locked = await tryAcquireAdvisoryLock(client, lockId);
  } catch (err) {
    client.release();
    throw err;
  }

  if (!locked) {
    client.release();
    options?.onSkipped?.();
    return { lockAcquired: false, executed: false, skipped: true };
  }

  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  if (options?.timeoutMs && options.timeoutMs > 0) {
    timer = setTimeout(() => {
      controller.abort(
        new Error(`Job "${jobName}" timed out after ${options.timeoutMs}ms`)
      );
    }, options.timeoutMs);
  }

  try {
    const result = await fn(controller.signal);
    return { lockAcquired: true, executed: true, skipped: false, result };
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await releaseAdvisoryLock(client, lockId);
    } catch (unlockErr) {
      console.error(
        `Failed to release advisory lock ${lockId} for job ${jobName}:`,
        unlockErr
      );
    } finally {
      client.release();
    }
  }
}
