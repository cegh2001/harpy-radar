import { describe, expect, it } from "vitest";
import type { HeartbeatUpdateInput } from "@/features/worker/infrastructure/heartbeat-service";
import { JobRunner } from "@/worker/scheduler/job-runner";

describe("JobRunner", () => {
  it("records start and completion heartbeats on successful execution", async () => {
    const heartbeats: Array<{ jobName: string; input: HeartbeatUpdateInput }> =
      [];

    const result = await JobRunner.run({
      jobName: "job:sync-rates",
      lockKey: "sync-rates",
      timeoutMs: 5000,
      run: async () => ({ synced: true }),
      deps: {
        acquireLock: async (_lockKey, fn) => {
          const val = await fn(new AbortController().signal);
          return { lockAcquired: true, executed: true, skipped: false, result: val };
        },
        writeHeartbeat: async (jobName, input) => {
          heartbeats.push({ jobName, input });
        },
      },
    });

    expect(result.executed).toBe(true);
    expect(result.result).toStrictEqual({ synced: true });
    expect(heartbeats).toHaveLength(2);
    expect(heartbeats[0].input.isExecuting).toBe(true);
    expect(heartbeats[1].input.isExecuting).toBe(false);
    expect(heartbeats[1].input.lastCycleStatus).toBe("completed");
    expect(heartbeats[1].input.incrementCycle).toBe(true);
  });

  it("records failed heartbeat and rethrows when run throws", async () => {
    const heartbeats: Array<{ jobName: string; input: HeartbeatUpdateInput }> =
      [];

    await expect(
      JobRunner.run({
        jobName: "job:scrape-bahia",
        lockKey: "scrape-bahia",
        timeoutMs: 5000,
        run: async () => {
          throw new Error("Connection reset");
        },
        deps: {
          acquireLock: async (_lockKey, fn) => {
            const val = await fn(new AbortController().signal);
            return { lockAcquired: true, executed: true, skipped: false, result: val };
          },
          writeHeartbeat: async (jobName, input) => {
            heartbeats.push({ jobName, input });
          },
        },
      })
    ).rejects.toThrow("Connection reset");

    expect(heartbeats).toHaveLength(2);
    expect(heartbeats[1].input.lastCycleStatus).toBe("failed");
    expect(heartbeats[1].input.lastError).toBe("Connection reset");
  });
});
