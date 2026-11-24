import { pool } from "./client";
import { seedDatabase } from "./seed-data";

async function main() {
  console.log("Seeding Harpy Radar catalog, retailers, and benchmarks...");
  const summary = await seedDatabase();
  console.log("Seed completed:", JSON.stringify(summary));
  await pool.end();
}

main().catch(async (error) => {
  console.error("Failed to seed Harpy Radar database:", error);
  await pool.end();
  process.exit(1);
});
