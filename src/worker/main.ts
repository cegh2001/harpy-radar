import { pool } from "@/db/client";
import { runDatabaseMigrations } from "@/db/run-migrations";
import { seedDatabase } from "@/db/seed-data";
import { markAllShutdown } from "@/features/worker/infrastructure/heartbeat-service";
import { startScheduler } from "./scheduler/cron";

console.log("Starting Harpy Radar Background Worker...");

await runDatabaseMigrations();
await seedDatabase();
const scheduler = await startScheduler();

async function handleShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down Harpy Radar worker...`);
  scheduler.stop();
  await markAllShutdown().catch((err) => {
    console.error("Failed to mark worker shutdown state:", err);
  });
  await pool.end().catch((err) => {
    console.error("Failed to close database pool:", err);
  });
  process.exit(0);
}

process.on("SIGINT", () => {
  void handleShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void handleShutdown("SIGTERM");
});
