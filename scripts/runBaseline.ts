export const BASELINE_CONFIG = { batchSize: 1 };

export interface BaselineConfig {
  totalIntents: number;
  batchSize: number;
}

export interface BaselineResult {
  mode: "baseline";
  totalTxs: number;
  totalIntents: number;
  batchSize: number;
  totalGas: bigint;
  avgGasPerIntent: number;
  avgLatencyMs: number;
  p95LatencyMs?: number;
  throughput: number;
  failedRate: number;
}

export interface GasReceipt {
  gasUsed: bigint;
}

export interface GasMetrics {
  totalGas: bigint;
  avgGasPerIntent: number;
}

export function computeGasMetrics(
  receipts: GasReceipt[],
  intentCount: number
): GasMetrics {
  let totalGas = 0n;
  for (const r of receipts) {
    totalGas += r.gasUsed;
  }
  const avg = intentCount === 0 ? 0 : Number(totalGas) / intentCount;
  return { totalGas, avgGasPerIntent: avg };
}

export interface LatencyMetrics {
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export function computeLatencyMetrics(latencies: number[]): LatencyMetrics {
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg =
    sorted.reduce((sum, l) => sum + l, 0) / sorted.length;
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  return {
    avgLatencyMs: avg,
    p95LatencyMs: sorted[p95Index],
  };
}

export function computeThroughput(intents: number, elapsedSeconds: number): number {
  if (elapsedSeconds === 0) return 0;
  return intents / elapsedSeconds;
}

export function computeFailureRate(failed: number, total: number): number {
  if (total === 0) return 0;
  return failed / total;
}

export function resultsAreComparable(
  run1: { avgGasPerIntent: number; throughput: number; failedRate: number },
  run2: { avgGasPerIntent: number; throughput: number; failedRate: number },
  tolerance: number
): boolean {
  const gasDiff = Math.abs(run1.avgGasPerIntent - run2.avgGasPerIntent) / run1.avgGasPerIntent;
  const tputDiff = Math.abs(run1.throughput - run2.throughput) / run1.throughput;
  const failDiff = Math.abs(run1.failedRate - run2.failedRate);
  return gasDiff <= tolerance && tputDiff <= tolerance && failDiff <= tolerance;
}

export async function runBaseline(
  config: BaselineConfig
): Promise<BaselineResult> {
  const totalTxs = config.totalIntents; // batchSize=1: one tx per intent
  return {
    mode: "baseline",
    totalTxs,
    totalIntents: config.totalIntents,
    batchSize: config.batchSize,
    totalGas: 0n,
    avgGasPerIntent: 0,
    avgLatencyMs: 0,
    throughput: 0,
    failedRate: 0,
  };
}
