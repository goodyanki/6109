export const BATCHING_CONFIG = { batchSize: 10 };

export interface BatchingConfig {
  totalIntents: number;
  batchSize: number;
}

export interface BenchmarkResult {
  mode: "baseline" | "batching";
  totalTxs: number;
  totalIntents: number;
  batchSize: number;
  avgGasPerIntent: number;
  avgLatencyMs: number;
  throughput: number;
  failedRate: number;
}

export interface ComparisonResult {
  throughputImprovement: number;
  gasSavingPercent: number;
}

export function compareResults(
  baseline: BenchmarkResult,
  batching: BenchmarkResult
): ComparisonResult {
  return {
    throughputImprovement: batching.throughput / baseline.throughput,
    gasSavingPercent:
      ((baseline.avgGasPerIntent - batching.avgGasPerIntent) / baseline.avgGasPerIntent) * 100,
  };
}

export interface TxReduction {
  baselineTxCount: number;
  batchingTxCount: number;
  reductionPercent: number;
}

export function computeTxReduction(
  totalIntents: number,
  baselineBatchSize: number,
  batchingBatchSize: number
): TxReduction {
  const baselineTxCount = Math.ceil(totalIntents / baselineBatchSize);
  const batchingTxCount = Math.ceil(totalIntents / batchingBatchSize);
  const reductionPercent =
    ((baselineTxCount - batchingTxCount) / baselineTxCount) * 100;
  return {
    baselineTxCount,
    batchingTxCount,
    reductionPercent,
  };
}

export async function runBatching(
  config: BatchingConfig
): Promise<BenchmarkResult> {
  const totalTxs = Math.ceil(config.totalIntents / config.batchSize);
  return {
    mode: "batching",
    totalTxs,
    totalIntents: config.totalIntents,
    batchSize: config.batchSize,
    avgGasPerIntent: 0,
    avgLatencyMs: 0,
    throughput: 0,
    failedRate: 0,
  };
}
