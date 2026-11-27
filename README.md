# Harpy Radar

Near-zero-cost price and availability monitor for basic basket products in Venezuela, focused on **La Guaira** and **Caracas**.

## Architecture

- **Next.js 16 + Drizzle ORM + PostgreSQL 16**: Public read-only dashboard and REST endpoints (`/api/health`, `/api/rates`, `/api/basket`, `/api/products`, `/api/products/[slug]`) with edge-friendly `Cache-Control` / `Vercel-CDN-Cache-Control` headers.
- **Ephemeral One-Shot Ingestion (`src/worker/run-once.ts`) & Optional Daemon (`src/worker/main.ts`)**: Runs scheduled jobs via GitHub Actions (or `Croner` locally) with Postgres advisory locks (`pg_try_advisory_lock`) and persistent job heartbeats.
- **Deterministic Catalog Matching (Zero LLM Cost)**: Curated 41-item canonical basket (`src/features/catalog/domain/canonical-basket.ts`) normalized to `$/kg`, `$/L`, and `$/unit`.
- **Exchange Rate Dual-Reference (Lazy Fallback & Write-on-Change)**: Official BCV USD/EUR scraper (`www.bcv.org.ve`) with lazy `ve.dolarapi.com` fallback (only queried if BCV fails), decoupled parallel USD reference, and idempotent `saveExchangeRateIfChanged` persistence that skips redundant inserts when rates have not changed.
- **Retailer Connectors (1x/day default schedule)**:
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
- **Docker** (for local PostgreSQL 16) or **Supabase** (for cloud PostgreSQL)

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

4. Run a one-shot ingestion cycle (or targeted jobs):

   ```bash
   pnpm worker:once
   # Targeted examples:
   pnpm worker:once --job=rates-official --skip-bootstrap
   pnpm worker:once --job=rates-parallel --skip-bootstrap
   pnpm worker:once --job=retailers --skip-bootstrap
   pnpm worker:once --job=retailers --retailer=farmatodo-ve --skip-bootstrap
   # Or start the local continuous Croner scheduler:
   pnpm worker
   ```

5. Start the Next.js dashboard:

   ```bash
   pnpm dev
   ```

## Production Deployment (Vercel + Supabase + GitHub Actions)

### 1. Supabase Database & Connection Strings

Create a Supabase project and use **two different pooler URLs** depending on the runtime:

| Runtime | Supabase Pooler | Why |
| --- | --- | --- |
| **Vercel (`web`)** | **Transaction Pooler (port `6543`)** | Read-only SSR pages and cached API routes; safe for serverless fan-out. |
| **GitHub Actions (`worker:once`, `db:migrate`)** | **Session Pooler (port `5432`, IPv4)** | Supports session-level `pg_try_advisory_lock` and IPv4 runners. |

`src/db/pool-config.ts` auto-enables TLS (`rejectUnauthorized: false`) for `*.supabase.*` hosts and limits production pools to `DB_POOL_MAX=5` by default (`DATABASE_SSL=auto`).

### 2. Vercel Environment Variables

Configure in Vercel Project Settings:

- `DATABASE_URL` → Supabase **Transaction Pooler** (`:6543`) URL
- `DATABASE_SSL` → `auto`
- `DB_POOL_MAX` → `5`
- `APP_TIMEZONE` → `America/Caracas`

### 3. GitHub Actions Secrets & Scheduled Workflows

Add repository secret `DATABASE_URL` (pointing to Supabase **Session Pooler** `:5432`) and optionally `BCV_CA_CERT`. Four workflows live under `.github/workflows/`:

| Workflow | Schedule (VET / UTC-4) | Command |
| --- | --- | --- |
| `db-bootstrap.yml` | Manual or on migration/seed changes to `main` | `pnpm db:migrate && pnpm db:seed` |
| `sync-rates-official.yml` | Mon–Fri `17:30` & `19:00` VET + manual | `pnpm worker:once --job=rates-official --skip-bootstrap` |
| `sync-rates-parallel.yml` | Daily `09:00`, `13:00`, `17:00` VET + manual | `pnpm worker:once --job=rates-parallel --skip-bootstrap` |
| `scrape-retailers.yml` | Daily `06:30` VET + manual (`retailer` selector) | `pnpm worker:once --job=retailers --skip-bootstrap` |

### 4. Initial Cloud Bootstrap Order

After connecting Supabase and setting the GitHub `DATABASE_URL` secret, trigger the workflows manually in this order:

1. **Database Migrate & Seed** (`db-bootstrap.yml`)
2. **Sync Official BCV Rate** (`sync-rates-official.yml`)
3. **Sync Parallel Rate** (`sync-rates-parallel.yml`)
4. **Scrape Retailer Prices** (`scrape-retailers.yml`)

## Verification & Quality Gates

```bash
pnpm lint
node scripts/verify-release.mjs units
node scripts/verify-release.mjs types
node scripts/verify-release.mjs build
```

All source files under `src/` and `scripts/` enforce a strict **350-line limit** via ESLint, ban wildcard `export *` re-exports (except `src/db/schema/index.ts`), and forbid shallow Vitest assertions (`toBeTruthy` / `toBeDefined`).
