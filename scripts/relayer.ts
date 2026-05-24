import { ethers } from "ethers";

export const DEFAULT_POLL_INTERVAL_MS = 10000;

export interface Intent {
  id: number;
  status: number;
  executeAfter: bigint;
  deadline: bigint;
  agentActive: boolean;
  maxGasPrice: bigint;
  intentType?: number;
  tokenIn?: string;
  tokenOut?: string;
}

export interface RelayerConfig {
  rpcUrl: string;
  privateKey?: string;
  pollIntervalMs?: number;
  maxBatchSize?: number;
  contractAddresses?: Record<string, string>;
}

export interface BatchRecord {
  txHash: string;
  batchSize: number;
  intentCount: number;
  successCount: number;
  failedCount: number;
  gasUsed: number;
}

export function createRelayer(config: RelayerConfig) {
  const pollIntervalMs = config.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
  const maxBatchSize = config.maxBatchSize || 10;

  return {
    config,
    pollIntervalMs,
    maxBatchSize,
  };
}

export function shouldSkipCycle(intents: Array<{ id: number }>): boolean {
  return intents.length === 0;
}

export function isExecutable(intent: Intent, currentGasPrice: bigint): boolean {
  const now = Math.floor(Date.now() / 1000);

  if (!intent.agentActive) return false;
  if (BigInt(now) < intent.executeAfter) return false;
  if (BigInt(now) > intent.deadline) return false;

  if (intent.maxGasPrice > 0n && currentGasPrice > intent.maxGasPrice) {
    return false;
  }

  return true;
}

export function groupIntoBatches(
  intents: Array<{ id: number; intentType?: number; tokenIn?: string; tokenOut?: string }>,
  maxBatchSize: number
): number[][] {
  const batches: number[][] = [];
  for (let i = 0; i < intents.length; i += maxBatchSize) {
    batches.push(intents.slice(i, i + maxBatchSize).map((it) => it.id));
  }
  return batches;
}

export function groupIntentsByType(
  intents: Array<{ id: number; intentType: number }>
): { SWAP: typeof intents; TRANSFER: typeof intents } {
  return {
    SWAP: intents.filter((i) => i.intentType === 1),
    TRANSFER: intents.filter((i) => i.intentType === 0),
  };
}

export function groupSwapsByPair(
  swaps: Array<{ id: number; tokenIn: string; tokenOut: string }>
): Record<string, typeof swaps> {
  const groups: Record<string, typeof swaps> = {};
  for (const swap of swaps) {
    const key = `${swap.tokenIn}->${swap.tokenOut}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(swap);
  }
  return groups;
}

export async function submitBatchAndWait(
  batchExecutorContract: ethers.Contract,
  intentIds: number[]
): Promise<ethers.TransactionReceipt> {
  const tx = await batchExecutorContract.executeBatch(intentIds);
  return await tx.wait();
}

export function recordBatch(batch: BatchRecord): BatchRecord {
  return batch;
}

export function updateIntentStatus(
  intentId: number,
  status: string,
  txHash: string
): { intentId: number; status: string; txHash: string } {
  return { intentId, status, txHash };
}

export function calculateLatencyMs(createdAt: number, executedAt: number): number {
  return executedAt - createdAt;
}

export function calculateGasPerIntent(totalGas: number, intentCount: number): number {
  if (intentCount === 0) return 0;
  return totalGas / intentCount;
}
