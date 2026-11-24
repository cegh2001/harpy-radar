import { pool } from "./client";
import { runDatabaseMigrations } from "./run-migrations";

async function main() {
  console.log("Running Harpy Radar database migrations...");
  await runDatabaseMigrations();
  console.log("Database migrations applied successfully.");
  await pool.end();
}

main().catch(async (error) => {
  console.error("Failed to run database migrations:", error);
  await pool.end();
  process.exit(1);
});
