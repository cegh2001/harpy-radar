import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  envDir: false,
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/env.test.ts",
      "tests/unit/caracas-date.test.ts",
      "tests/unit/bcv-parser.test.ts",
      "tests/unit/unit-normalizer.test.ts",
      "tests/unit/product-matcher.test.ts",
      "tests/unit/stellar-webstore-connector.test.ts",
      "tests/unit/farmatodo-algolia-connector.test.ts",
      "tests/unit/gama-occ-connector.test.ts",
      "tests/unit/riomarket-connector.test.ts",
      "tests/unit/woocommerce-store-connector.test.ts",
      "tests/unit/shopify-catalog-connector.test.ts",
      "tests/unit/cscart-store-connector.test.ts",
      "tests/unit/vtex-catalog-connector.test.ts",
      "tests/unit/ingest-retailer-prices.test.ts",
      "tests/unit/basket-index.test.ts",
      "tests/unit/dashboard-tab.test.ts",
      "tests/unit/job-runner.test.ts",
    ],
    globalSetup: [],
    setupFiles: [],
    pool: "threads",
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        "postgres://postgres:postgres@localhost:5432/harpy_radar_unit_test",
      APP_TIMEZONE: "America/Caracas",
      SOURCE_BAHIA_ENABLED: "false",
      SOURCE_FARMATODO_ENABLED: "false",
      SOURCE_VIVA_ENABLED: "false",
      SOURCE_LOCATEL_ENABLED: "false",
      SOURCE_GAMA_ENABLED: "false",
    },
  },
});
