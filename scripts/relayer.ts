import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { getDatabase } from "./database";
import { DEFAULT_HARDHAT_PRIVATE_KEY, DEFAULT_RPC_URL, DeployedAddresses } from "./deploy";

export const DEFAULT_POLL_INTERVAL_MS = 10000;
export const STATUS_NAMES = ["PENDING", "BATCHED", "EXECUTED", "FAILED", "EXPIRED", "CANCELLED"];

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
  contractAddresses?: DeployedAddresses;
  once?: boolean;
  dbPath?: string;
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

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readArtifact(contractName: string): { abi: ethers.InterfaceAbi } {
  return readJson(
    path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      `${contractName}.sol`,
      `${contractName}.json`
    )
  );
}

export function readDeployedAddresses(filePath?: string): DeployedAddresses {
  return readJson(filePath || path.join(__dirname, "..", "data", "deployed_addresses.json"));
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

export function buildCompatibleBatches(
  intents: Array<{ id: number; intentType: number; tokenIn?: string; tokenOut?: string }>,
  maxBatchSize: number
): number[][] {
  const groups = groupIntentsByType(intents);
  const batches: number[][] = [];

  for (const swaps of Object.values(groupSwapsByPair(groups.SWAP as any))) {
    batches.push(...groupIntoBatches(swaps, maxBatchSize));
  }

  batches.push(...groupIntoBatches(groups.TRANSFER, maxBatchSize));
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

export function insertBatchRecord(batch: BatchRecord, dbPath?: string): void {
  const db = getDatabase(dbPath);
  db.prepare(
    `INSERT INTO batches (tx_hash, batch_size, intent_count, success_count, failed_count, gas_used)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    batch.txHash,
    batch.batchSize,
    batch.intentCount,
    batch.successCount,
    batch.failedCount,
    batch.gasUsed
  );
}

export function updateIntentStatus(
  intentId: number,
  status: string,
  txHash: string
): { intentId: number; status: string; txHash: string } {
  return { intentId, status, txHash };
}

export function updateIntentStatusInDb(
  intentId: number,
  status: string,
  txHash: string,
  dbPath?: string
): void {
  const db = getDatabase(dbPath);
  db.prepare(
    `UPDATE intents
     SET status = ?, tx_hash = ?, executed_at = datetime('now')
     WHERE chain_intent_id = ?`
  ).run(status, txHash, intentId);
}

export function calculateLatencyMs(createdAt: number, executedAt: number): number {
  return executedAt - createdAt;
}

export function calculateGasPerIntent(totalGas: number, intentCount: number): number {
  if (intentCount === 0) return 0;
  return totalGas / intentCount;
}

async function loadPendingIntents(
  intentManager: ethers.Contract,
  registry: ethers.Contract,
  currentGasPrice: bigint
): Promise<Intent[]> {
  const ids = (await intentManager.getPendingIntentIds(0, 1000)) as bigint[];
  const intents: Intent[] = [];
  for (const rawId of ids) {
    const id = Number(rawId);
    const chainIntent = await intentManager.getIntent(id);
    const agentActive = await registry.isAgentActive(chainIntent.agent);
    intents.push({
      id,
      status: Number(chainIntent.status),
      executeAfter: BigInt(chainIntent.executeAfter),
      deadline: BigInt(chainIntent.deadline),
      agentActive,
      maxGasPrice: BigInt(chainIntent.maxGasPrice),
      intentType: Number(chainIntent.intentType),
      tokenIn: chainIntent.tokenIn,
      tokenOut: chainIntent.tokenOut,
    });
  }
  return intents.filter((intent) => intent.status === 0 && isExecutable(intent, currentGasPrice));
}

function parseBatchEvent(
  receipt: ethers.TransactionReceipt,
  batchExecutor: ethers.Contract
): { successCount: number; failedCount: number } {
  for (const log of receipt.logs) {
    try {
      const parsed = batchExecutor.interface.parseLog(log);
      if (parsed?.name === "BatchExecuted") {
        return {
          successCount: Number(parsed.args.successCount),
          failedCount: Number(parsed.args.failedCount),
        };
      }
    } catch {
      // Ignore logs emitted by other contracts.
    }
  }
  return { successCount: 0, failedCount: 0 };
}

export async function runRelayerCycle(config: RelayerConfig): Promise<BatchRecord[]> {
  const addresses = (config.contractAddresses || readDeployedAddresses()) as DeployedAddresses;
  const provider = new ethers.JsonRpcProvider(config.rpcUrl || DEFAULT_RPC_URL);
  const wallet = new ethers.Wallet(
    config.privateKey || process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY || DEFAULT_HARDHAT_PRIVATE_KEY,
    provider
  );
  const signer = new ethers.NonceManager(wallet);

  const intentArtifact = readArtifact("IntentManager");
  const registryArtifact = readArtifact("AgentRegistry");
  const batchArtifact = readArtifact("BatchExecutor");
  const intentManager = new ethers.Contract(addresses.intentManager, intentArtifact.abi, signer);
  const registry = new ethers.Contract(addresses.agentRegistry, registryArtifact.abi, signer);
  const batchExecutor = new ethers.Contract(addresses.batchExecutor, batchArtifact.abi, signer);

  const feeData = await provider.getFeeData();
  const currentGasPrice = feeData.gasPrice || 0n;
  const executable = await loadPendingIntents(intentManager, registry, currentGasPrice);
  if (shouldSkipCycle(executable)) {
    console.log("No pending intents");
    return [];
  }

  const batches = buildCompatibleBatches(executable as Required<Intent>[], config.maxBatchSize || 10);
  const records: BatchRecord[] = [];
  for (const batch of batches) {
    const receipt = await submitBatchAndWait(batchExecutor, batch);
    const counts = parseBatchEvent(receipt, batchExecutor);
    const record = {
      txHash: receipt.hash,
      batchSize: batch.length,
      intentCount: batch.length,
      successCount: counts.successCount,
      failedCount: counts.failedCount,
      gasUsed: Number(receipt.gasUsed),
    };
    insertBatchRecord(record, config.dbPath);
    for (const id of batch) {
      const updated = await intentManager.getIntent(id);
      updateIntentStatusInDb(id, STATUS_NAMES[Number(updated.status)] || "UNKNOWN", receipt.hash, config.dbPath);
    }
    records.push(recordBatch(record));
  }
  return records;
}

export async function runRelayer(config: RelayerConfig): Promise<void> {
  const relayer = createRelayer(config);
  do {
    await runRelayerCycle(config);
    if (config.once) break;
    await new Promise((resolve) => setTimeout(resolve, relayer.pollIntervalMs));
  } while (true);
}

if (require.main === module) {
  runRelayer({
    rpcUrl: process.env.RPC_URL || DEFAULT_RPC_URL,
    privateKey: process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY || DEFAULT_HARDHAT_PRIVATE_KEY,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS),
    maxBatchSize: Number(process.env.MAX_BATCH_SIZE || 10),
    once: process.env.RELAYER_ONCE === "1",
  }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
