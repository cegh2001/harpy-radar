import { NextResponse } from "next/server";
import { exchangeRateRepository } from "@/features/exchange-rates/infrastructure/exchange-rate-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [latest, history] = await Promise.all([
      exchangeRateRepository.getLatestRatesSnapshot(),
      exchangeRateRepository.getRateHistory(30),
    ]);

    return NextResponse.json({
      latest,
      history: history.map((row) => ({
        id: row.id,
        rateDate: row.rateDate,
        source: row.source,
        usdRate: Number(row.usdRate),
        eurRate: row.eurRate ? Number(row.eurRate) : null,
        fetchedAt: row.fetchedAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
