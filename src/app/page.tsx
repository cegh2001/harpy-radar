import { Suspense } from "react";
import { getDashboardSnapshot } from "@/features/basket/application/get-dashboard-snapshot";
import { DashboardClientShell } from "@/features/basket/ui/dashboard-client-shell";
import { DashboardHeader } from "@/features/basket/ui/dashboard-header";
import { CANONICAL_BASKET_ITEMS } from "@/features/catalog/domain/canonical-basket";
import { REFERENCE_BENCHMARKS } from "@/features/basket/domain/reference-benchmarks";
import { RETAILER_SEEDS } from "@/db/seed-data";
import { computeBasketIndex } from "@/features/basket/domain/basket-index";

export const dynamic = "force-dynamic";

function buildFallbackSnapshot() {
  const products = CANONICAL_BASKET_ITEMS.map((item, idx) => ({
    id: idx + 1,
    slug: item.slug,
    name: item.name,
    category: item.category,
    baseUnit: item.baseUnit,
    basketMonthlyQty: item.basketMonthlyQty,
    displayUnitLabel: item.displayUnitLabel,
    displayUnitPluralLabel: item.displayUnitPluralLabel,
    displayUnitSizeInBase: item.displayUnitSizeInBase,
  }));

  return {
    generatedAt: new Date().toISOString(),
    region: "all",
    rates: {
      official: null,
      parallel: null,
      gapPct: null,
    },
    basket: computeBasketIndex(products, [], null),
    anomalyDigest: null,
    benchmarks: REFERENCE_BENCHMARKS.map((item, idx) => ({
      id: idx + 1,
      ...item,
    })),
    retailers: RETAILER_SEEDS.map((r) => ({
      slug: r.slug,
      name: r.name,
      adapterKey: r.adapterKey,
      primaryRegion: r.primaryRegion,
      defaultCurrency: r.defaultCurrency,
      status: r.status,
      enabled: r.enabled,
    })),
    heartbeats: [],
  };
}

export default async function HomePage() {
  let snapshot;
  let dbConnected = true;

  try {
    snapshot = await getDashboardSnapshot("all");
  } catch {
    dbConnected = false;
    snapshot = buildFallbackSnapshot();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <DashboardHeader
        rates={snapshot.rates}
        generatedAt={snapshot.generatedAt}
      />

      {!dbConnected && (
        <div className="mx-auto mt-4 max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            La base de datos está sin conexión o pendiente de migración; se
            muestra el catálogo canónico estático y las referencias
            institucionales. Inicia PostgreSQL con{" "}
            <code>docker compose up -d postgres</code>, ejecuta{" "}
            <code>pnpm db:migrate &amp;&amp; pnpm db:seed</code> y luego{" "}
            <code>pnpm worker:once</code>.
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <DashboardClientShell snapshot={snapshot} />
      </Suspense>
    </div>
  );
}
