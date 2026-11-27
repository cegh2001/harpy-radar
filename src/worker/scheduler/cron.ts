import { env } from "@/shared/config/env";
import { exchangeRateRepository } from "@/features/exchange-rates/infrastructure/exchange-rate-repository";
import { recordJobHeartbeat } from "@/features/worker/infrastructure/heartbeat-service";
import { RETAILER_JOB_SPECS } from "../jobs/retailer-jobs";
import { runArbitrateAnomaliesJob } from "../jobs/arbitrate-anomalies-job";
import { runScrapeRetailerJob } from "../jobs/scrape-retailer-job";
import {
  runSyncOfficialRatesJob,
  runSyncParallelRatesJob,
} from "../jobs/sync-rates-job";
import { JobRunner, scheduleLockedJob } from "./job-runner";

export const KNOWN_JOBS = [
  "job:sync-rates-official",
  "job:sync-rates-parallel",
  ...RETAILER_JOB_SPECS.map((spec) => spec.jobName),
  "job:arbitrate-anomalies",
] as const;

export interface SchedulerController {
  stop: () => void;
}

export async function startScheduler(): Promise<SchedulerController> {
  console.log(
    `Starting Harpy Radar scheduler in timezone "${env.APP_TIMEZONE}"`
  );

  await Promise.all(
    KNOWN_JOBS.map((jobName) =>
      recordJobHeartbeat(jobName, {
        isExecuting: false,
        lastCycleStatus: "ready",
      }).catch((err) => {
        console.error(`Failed to initialize heartbeat for ${jobName}:`, err);
      })
    )
  );

  // Cold-start FX sync when database has no official or parallel rates yet
  const latestRates = await exchangeRateRepository.getLatestRatesSnapshot();
  if (!latestRates.official) {
    await JobRunner.run({
      jobName: "job:sync-rates-official",
      lockKey: "sync-rates-official",
      timeoutMs: 45_000,
      run: runSyncOfficialRatesJob,
    }).catch((err) => {
      console.error("Cold-start official FX sync failed:", err);
    });
  }

  if (!latestRates.parallel) {
    await JobRunner.run({
      jobName: "job:sync-rates-parallel",
      lockKey: "sync-rates-parallel",
      timeoutMs: 45_000,
      run: runSyncParallelRatesJob,
    }).catch((err) => {
      console.error("Cold-start parallel FX sync failed:", err);
    });
  }

  const rateOfficialJob = scheduleLockedJob({
    schedule: env.RATE_OFFICIAL_SYNC_CRON,
    jobName: "job:sync-rates-official",
    lockKey: "sync-rates-official",
    timeoutMs: 45_000,
    run: runSyncOfficialRatesJob,
  });

  const rateParallelJob = scheduleLockedJob({
    schedule: env.RATE_PARALLEL_SYNC_CRON,
    jobName: "job:sync-rates-parallel",
    lockKey: "sync-rates-parallel",
    timeoutMs: 45_000,
    run: runSyncParallelRatesJob,
  });

  const retailerJobs = RETAILER_JOB_SPECS.map((spec) =>
    scheduleLockedJob({
      schedule: env[spec.cronEnvKey],
      jobName: spec.jobName,
      lockKey: spec.lockKey,
      timeoutMs: spec.timeoutMs,
      run: (signal) => runScrapeRetailerJob(spec.slug, spec.jobName, signal),
    })
  );

  const arbiterJob = scheduleLockedJob({
    schedule: env.ARBITER_CRON,
    jobName: "job:arbitrate-anomalies",
    lockKey: "arbitrate-anomalies",
    timeoutMs: 120_000,
    run: runArbitrateAnomaliesJob,
  });

  return {
    stop: () => {
      rateOfficialJob.stop();
      rateParallelJob.stop();
      for (const job of retailerJobs) {
        job.stop();
      }
      arbiterJob.stop();
    },
  };
}
