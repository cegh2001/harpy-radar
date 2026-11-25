# Harpy Radar

Near-zero-cost price and availability monitor for basic basket products in Venezuela, focused on **La Guaira** and **Caracas**.

## Architecture

- **Next.js 16 + Drizzle ORM + PostgreSQL 16**: Public dashboard and REST endpoints (`/api/health`, `/api/rates`, `/api/basket`, `/api/products`, `/api/products/[slug]`) with immutable price and exchange-rate snapshots.
- **Standalone Background Worker (`src/worker/main.ts`)**: Scheduled via `Croner` with Postgres advisory locks (`pg_try_advisory_lock`) and persistent job heartbeats.
- **Deterministic Catalog Matching (Zero LLM Cost)**: Curated 24-item canonical basket (`src/features/catalog/domain/canonical-basket.ts`) normalized to `$/kg`, `$/L`, and `$/unit`.
- **Exchange Rate Dual-Reference**: Official BCV USD/EUR scraper (`www.bcv.org.ve`) with `ve.dolarapi.com` official fallback and parallel USD reference to track the exchange-rate gap.
- **Retailer Connectors**:
  - **Bahía Supermarket (La Guaira)**: Stellar Webstore JSON search (`store.bahiasupermarket.com`).
  - **Rio Supermarket (Caracas)**: Next.js SSR product catalog (`www.riomarket.com`).
  - **Farmatodo Venezuela (La Guaira / Caracas)**: Public Algolia catalog index (`products-venezuela`).
  - **Central Madeirense (Maiquetía / La Guaira)**: WooCommerce Store API (`tucentralonline.com/Maiquetia-53`).
  - **Punto al Mayor (La Guaira)**: Shopify JSON catalog (`puntoalmayor.com`, retail `Detal` variant filter).
  - **Viva Supercentro (La Guaira)**: CS-Cart storefront (`vivaenlinea.com`, La Guaira branch session).
  - **Locatel (Caracas)**: VTEX public catalog search API (`www.locatel.com.ve`, VES pricing).

## Requirements

- **Node.js** 24+
- **pnpm** 12+
- **Docker** (for PostgreSQL 16 and containerized execution)

## Local Setup

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL with Docker:

   ```bash
   docker compose up -d postgres
   ```

3. Apply database migrations and seed the canonical catalog, retailers, and CENDAS-FVM / OVF reference benchmarks:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

4. Run a one-shot worker ingestion cycle (or start the continuous scheduler):

   ```bash
   pnpm worker:once
   # or continuous cron worker:
   pnpm worker
   ```

5. Start the Next.js dashboard:

   ```bash
   pnpm dev
   ```

## Verification & Quality Gates

```bash
pnpm lint
node scripts/verify-release.mjs units
node scripts/verify-release.mjs types
node scripts/verify-release.mjs build
```

All source files under `src/` and `scripts/` enforce a strict **350-line limit** via ESLint, ban wildcard `export *` re-exports (except `src/db/schema/index.ts`), and forbid shallow Vitest assertions (`toBeTruthy` / `toBeDefined`).
