import { syncExchangeRates } from "@/features/exchange-rates/application/sync-exchange-rates";

export async function runSyncRatesJob(signal?: AbortSignal) {
  console.log("[Worker] Syncing BCV and DolarAPI exchange rates...");
  const result = await syncExchangeRates(undefined, signal);
  console.log(
    `[Worker] FX synced: Official ${result.officialUsd.toFixed(4)} Bs (${result.officialSource})` +
      (result.parallelUsd
        ? `, Parallel ${result.parallelUsd.toFixed(4)} Bs (gap ${result.gapPct ?? 0}%)`
        : "")
  );
  return result;
}
