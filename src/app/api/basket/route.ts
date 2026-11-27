import { NextRequest, NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/features/basket/application/get-dashboard-snapshot";
import { PUBLIC_API_CACHE_HEADERS } from "@/shared/lib/http/cache-headers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get("region") ?? "all";
    const snapshot = await getDashboardSnapshot(region);
    return NextResponse.json(snapshot, { headers: PUBLIC_API_CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
