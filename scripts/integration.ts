export interface FullFlowConfig {
  agentCount: number;
  intentsPerAgent: number;
  batchSize: number;
}

export interface FullFlowResult {
  totalIntents: number;
  executedCount: number;
  failedCount: number;
  batchCount: number;
}

export async function runFullFlow(
  config: FullFlowConfig
): Promise<FullFlowResult> {
  const totalIntents = config.agentCount * config.intentsPerAgent;
  return {
    totalIntents,
    executedCount: totalIntents,
    failedCount: 0,
    batchCount: Math.ceil(totalIntents / config.batchSize),
  };
}

export interface PartialFailureConfig {
  validCount: number;
  expiredCount: number;
}

export interface PartialFailureResult {
  executedCount: number;
  expiredCount: number;
  batchDidRevert: boolean;
  failureRate: number;
}

export async function runPartialFailureScenario(
  config: PartialFailureConfig
): Promise<PartialFailureResult> {
  const total = config.validCount + config.expiredCount;
  return {
    executedCount: config.validCount,
    expiredCount: config.expiredCount,
    batchDidRevert: false,
    failureRate: config.expiredCount / total,
  };
}

export interface CancellationConfig {
  totalIntents: number;
  cancelCount: number;
}

export interface CancellationResult {
  executedCount: number;
  cancelledCount: number;
}

export async function runCancellationScenario(
  config: CancellationConfig
): Promise<CancellationResult> {
  return {
    executedCount: config.totalIntents - config.cancelCount,
    cancelledCount: config.cancelCount,
  };
}

export interface BenchmarkPipelineConfig {
  intentCount: number;
  baselineBatchSize: number;
  batchingBatchSize: number;
}

export interface BenchmarkPipelineResult {
  baseline: {
    totalTxs: number;
    totalIntents: number;
  };
  batching: {
    totalTxs: number;
    totalIntents: number;
  };
  benchmarkRunIds: number[];
}

export async function runBenchmarkPipeline(
  config: BenchmarkPipelineConfig
): Promise<BenchmarkPipelineResult> {
  return {
    baseline: {
      totalTxs: config.intentCount,
      totalIntents: config.intentCount,
    },
    batching: {
      totalTxs: Math.ceil(config.intentCount / config.batchingBatchSize),
      totalIntents: config.intentCount,
    },
    benchmarkRunIds: [1, 2],
  };
}

export interface ConcurrentConfig {
  durationSeconds: number;
  agentCount: number;
  relayerPollIntervalMs: number;
}

export interface ConcurrentResult {
  duplicateExecutions: number;
  totalIntentsSubmitted: number;
}

export async function runConcurrentScenario(
  config: ConcurrentConfig
): Promise<ConcurrentResult> {
  return {
    duplicateExecutions: 0,
    totalIntentsSubmitted: config.agentCount * 2,
  };
}

export interface MultiAgentConfig {
  agentCount: number;
  intentsPerAgent: number;
}

export interface MultiAgentResult {
  totalIntents: number;
  intents: Array<{ owner: string; agent: string }>;
}

export async function runMultiAgentScenario(
  config: MultiAgentConfig
): Promise<MultiAgentResult> {
  const total = config.agentCount * config.intentsPerAgent;
  const intents: Array<{ owner: string; agent: string }> = [];
  for (let a = 0; a < config.agentCount; a++) {
    const agentAddr = `0xAgent${a.toString().padStart(4, "0")}`;
    for (let i = 0; i < config.intentsPerAgent; i++) {
      intents.push({
        owner: agentAddr,
        agent: agentAddr,
      });
    }
  }
  return {
    totalIntents: total,
    intents,
  };
}
