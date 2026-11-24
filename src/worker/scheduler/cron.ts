import { env } from "@/shared/config/env";
import { exchangeRateRepository } from "@/features/exchange-rates/infrastructure/exchange-rate-repository";
import { recordJobHeartbeat } from "@/features/worker/infrastructure/heartbeat-service";
import { runScrapeRetailerJob } from "../jobs/scrape-retailer-job";
import { runSyncRatesJob } from "../jobs/sync-rates-job";
import { JobRunner, scheduleLockedJob } from "./job-runner";

export const KNOWN_JOBS = [
  "job:sync-rates",
  "job:scrape-bahia",
  "job:scrape-riomarket",
  "job:scrape-farmatodo",
  "job:scrape-gama",
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

  // Cold-start FX sync when database has no rates yet
  const latestRates = await exchangeRateRepository.getLatestRatesSnapshot();
  if (!latestRates.official) {
    await JobRunner.run({
      jobName: "job:sync-rates",
      lockKey: "sync-rates",
      timeoutMs: 45_000,
      run: runSyncRatesJob,
    }).catch((err) => {
      console.error("Cold-start FX sync failed:", err);
    });
  }

  const rateSyncJob = scheduleLockedJob({
    schedule: env.RATE_SYNC_CRON,
    jobName: "job:sync-rates",
    lockKey: "sync-rates",
    timeoutMs: 45_000,
    run: runSyncRatesJob,
  });

  const bahiaJob = scheduleLockedJob({
    schedule: env.BAHIA_CRON,
    jobName: "job:scrape-bahia",
    lockKey: "scrape-bahia",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("bahia-la-guaira", "job:scrape-bahia", signal),
  });

  const riomarketJob = scheduleLockedJob({
    schedule: env.RIOMARKET_CRON,
    jobName: "job:scrape-riomarket",
    lockKey: "scrape-riomarket",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("riomarket-caracas", "job:scrape-riomarket", signal),
  });

  const farmatodoJob = scheduleLockedJob({
    schedule: env.FARMATODO_CRON,
    jobName: "job:scrape-farmatodo",
    lockKey: "scrape-farmatodo",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("farmatodo-ve", "job:scrape-farmatodo", signal),
  });

  const gamaJob = scheduleLockedJob({
    schedule: env.GAMA_CRON,
    jobName: "job:scrape-gama",
    lockKey: "scrape-gama",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("excelsior-gama", "job:scrape-gama", signal),
  });

  return {
    stop: () => {
      rateSyncJob.stop();
      bahiaJob.stop();
      riomarketJob.stop();
      farmatodoJob.stop();
      gamaJob.stop();
    },
  };
}
