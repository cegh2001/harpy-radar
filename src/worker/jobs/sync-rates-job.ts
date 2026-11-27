import {
  syncExchangeRates,
  type SyncExchangeRatesMode,
} from "@/features/exchange-rates/application/sync-exchange-rates";

export async function runSyncRatesJob(
  signal?: AbortSignal,
  mode: SyncExchangeRatesMode = "all"
) {
  console.log(`[Worker] Syncing exchange rates (mode=${mode})...`);
  const result = await syncExchangeRates(undefined, signal, mode);

  const parts: string[] = [];
  if (result.officialUsd !== null && result.officialSource !== null) {
    const officialTag = result.officialInserted ? "saved" : "unchanged";
    parts.push(
      `Official ${result.officialUsd.toFixed(4)} Bs (${result.officialSource}, ${officialTag})`
    );
  }
  if (result.parallelUsd !== null) {
    const parallelTag = result.parallelInserted ? "saved" : "unchanged";
    const gapSuffix =
      result.gapPct !== null ? `, gap ${result.gapPct}%` : "";
    parts.push(
      `Parallel ${result.parallelUsd.toFixed(4)} Bs (${parallelTag}${gapSuffix})`
    );
  }

  console.log(`[Worker] FX synced: ${parts.join(" | ")}`);
  return result;
}

export function runSyncOfficialRatesJob(signal?: AbortSignal) {
  return runSyncRatesJob(signal, "official");
}

export function runSyncParallelRatesJob(signal?: AbortSignal) {
  return runSyncRatesJob(signal, "parallel");
}
