import { NextRequest, NextResponse } from "next/server";
import { getProductDetailSnapshot } from "@/features/basket/application/get-dashboard-snapshot";
import { PUBLIC_API_CACHE_HEADERS } from "@/shared/lib/http/cache-headers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const detail = await getProductDetailSnapshot(slug);
    if (!detail) {
      return NextResponse.json(
        { error: `Product "${slug}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(detail, { headers: PUBLIC_API_CACHE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
