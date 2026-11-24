import { NextResponse } from "next/server";
import { pool } from "@/db/client";
import { getAllJobHeartbeats } from "@/features/worker/infrastructure/heartbeat-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    const heartbeats = await getAllJobHeartbeats();

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      workerHeartbeats: heartbeats.map((hb) => ({
        jobName: hb.jobName,
        isExecuting: hb.isExecuting,
        lastCycleStatus: hb.lastCycleStatus,
        lastCycleAt: hb.lastCycleAt ? hb.lastCycleAt.toISOString() : null,
        cycleCount: hb.cycleCount,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        database: "unreachable",
        error: message,
      },
      { status: 503 }
    );
  }
}
