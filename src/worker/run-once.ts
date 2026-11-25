import { pool } from "@/db/client";
import { runDatabaseMigrations } from "@/db/run-migrations";
import { seedDatabase } from "@/db/seed-data";
import { runScrapeRetailerJob } from "./jobs/scrape-retailer-job";
import { runSyncRatesJob } from "./jobs/sync-rates-job";
import { JobRunner } from "./scheduler/job-runner";

async function main() {
  await runDatabaseMigrations();
  await seedDatabase();

  const fxResult = await JobRunner.run({
    jobName: "job:sync-rates",
    lockKey: "sync-rates",
    timeoutMs: 45_000,
    run: runSyncRatesJob,
  });

  const bahiaResult = await JobRunner.run({
    jobName: "job:scrape-bahia",
    lockKey: "scrape-bahia",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("bahia-la-guaira", "job:scrape-bahia", signal),
  });

  const riomarketResult = await JobRunner.run({
    jobName: "job:scrape-riomarket",
    lockKey: "scrape-riomarket",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("riomarket-caracas", "job:scrape-riomarket", signal),
  });

  const farmatodoResult = await JobRunner.run({
    jobName: "job:scrape-farmatodo",
    lockKey: "scrape-farmatodo",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("farmatodo-ve", "job:scrape-farmatodo", signal),
  });

  const centralMadeirenseResult = await JobRunner.run({
    jobName: "job:scrape-central-madeirense",
    lockKey: "scrape-central-madeirense",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob(
        "central-madeirense",
        "job:scrape-central-madeirense",
        signal
      ),
  });

  const puntoAlMayorResult = await JobRunner.run({
    jobName: "job:scrape-punto-al-mayor",
    lockKey: "scrape-punto-al-mayor",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob(
        "puntoalmayor-la-guaira",
        "job:scrape-punto-al-mayor",
        signal
      ),
  });

  const vivaResult = await JobRunner.run({
    jobName: "job:scrape-viva",
    lockKey: "scrape-viva",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("viva-la-guaira", "job:scrape-viva", signal),
  });

  const locatelResult = await JobRunner.run({
    jobName: "job:scrape-locatel",
    lockKey: "scrape-locatel",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("locatel-caracas", "job:scrape-locatel", signal),
  });

  const gamaResult = await JobRunner.run({
    jobName: "job:scrape-gama",
    lockKey: "scrape-gama",
    timeoutMs: 120_000,
    run: (signal) =>
      runScrapeRetailerJob("excelsior-gama", "job:scrape-gama", signal),
  });

  console.log(
    JSON.stringify(
      {
        fx: fxResult,
        bahia: bahiaResult,
        riomarket: riomarketResult,
        farmatodo: farmatodoResult,
        centralMadeirense: centralMadeirenseResult,
        puntoAlMayor: puntoAlMayorResult,
        viva: vivaResult,
        locatel: locatelResult,
        gama: gamaResult,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("One-shot worker run failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
