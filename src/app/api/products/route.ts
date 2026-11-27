import { NextRequest, NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/features/basket/application/get-dashboard-snapshot";
import { PUBLIC_API_CACHE_HEADERS } from "@/shared/lib/http/cache-headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const region = params.get("region") ?? "all";
    const category = params.get("category") ?? "all";
    const query = (params.get("q") ?? "").trim().toLowerCase();

    const snapshot = await getDashboardSnapshot(region);
    const filtered = snapshot.basket.products.filter((product) => {
      if (category !== "all" && product.category !== category) return false;
      if (query && !product.name.toLowerCase().includes(query)) return false;
      return true;
    });

    return NextResponse.json(
      {
        generatedAt: snapshot.generatedAt,
        region,
        rates: snapshot.rates,
        total: filtered.length,
        products: filtered,
      },
      { headers: PUBLIC_API_CACHE_HEADERS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
