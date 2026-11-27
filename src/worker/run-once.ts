import { pool } from "@/db/client";
import { runDatabaseMigrations } from "@/db/run-migrations";
import { seedDatabase } from "@/db/seed-data";
import { RETAILER_JOB_SPECS, RETAILER_SLUGS } from "./jobs/retailer-jobs";
import { runArbitrateAnomaliesJob } from "./jobs/arbitrate-anomalies-job";
import { runScrapeRetailerJob } from "./jobs/scrape-retailer-job";
import {
  runSyncOfficialRatesJob,
  runSyncParallelRatesJob,
} from "./jobs/sync-rates-job";
import { parseRunOnceArgs } from "./run-once-args";
import { JobRunner } from "./scheduler/job-runner";

interface TrackedJobOutput {
  jobName: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

function isFailedRetailerResult(result: unknown): boolean {
  if (typeof result !== "object" || result === null || !("status" in result)) {
    return false;
  }
  return (result as { status: unknown }).status === "failed";
}

async function executeTrackedJob<T>(
  jobName: string,
  runJob: () => Promise<{ executed: boolean; skipped: boolean; result?: T }>
): Promise<TrackedJobOutput> {
  try {
    const lockResult = await runJob();
    const ok = !isFailedRetailerResult(lockResult.result);
    return {
      jobName,
      ok,
      result: lockResult,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] ${jobName} failed:`, message);
    return {
      jobName,
      ok: false,
      error: message,
    };
  }
}

async function main() {
  const options = parseRunOnceArgs(process.argv.slice(2), RETAILER_SLUGS);

  if (!options.skipBootstrap) {
    await runDatabaseMigrations();
    await seedDatabase();
  }

  const results: TrackedJobOutput[] = [];

  if (
    options.job === "all" ||
    options.job === "rates" ||
    options.job === "rates-official"
  ) {
    results.push(
      await executeTrackedJob("job:sync-rates-official", () =>
        JobRunner.run({
          jobName: "job:sync-rates-official",
          lockKey: "sync-rates-official",
          timeoutMs: 45_000,
          run: runSyncOfficialRatesJob,
        })
      )
    );
  }

  if (
    options.job === "all" ||
    options.job === "rates" ||
    options.job === "rates-parallel"
  ) {
    results.push(
      await executeTrackedJob("job:sync-rates-parallel", () =>
        JobRunner.run({
          jobName: "job:sync-rates-parallel",
          lockKey: "sync-rates-parallel",
          timeoutMs: 45_000,
          run: runSyncParallelRatesJob,
        })
      )
    );
  }

  if (options.job === "all" || options.job === "retailers") {
    const targetSpecs = options.retailerSlug
      ? RETAILER_JOB_SPECS.filter((spec) => spec.slug === options.retailerSlug)
      : RETAILER_JOB_SPECS;

    for (const spec of targetSpecs) {
      results.push(
        await executeTrackedJob(spec.jobName, () =>
          JobRunner.run({
            jobName: spec.jobName,
            lockKey: spec.lockKey,
            timeoutMs: spec.timeoutMs,
            run: (signal) =>
              runScrapeRetailerJob(spec.slug, spec.jobName, signal),
          })
        )
      );
    }
  }

  if (options.job === "all" || options.job === "arbitrate") {
    results.push(
      await executeTrackedJob("job:arbitrate-anomalies", () =>
        JobRunner.run({
          jobName: "job:arbitrate-anomalies",
          lockKey: "arbitrate-anomalies",
          timeoutMs: 120_000,
          run: runArbitrateAnomaliesJob,
        })
      )
    );
  }

  const hasFailures = results.some((entry) => !entry.ok);
  console.log(JSON.stringify({ options, results, hasFailures }, null, 2));

  if (hasFailures) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("One-shot worker run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
