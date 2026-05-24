import { ethers } from "ethers";

export interface SeedConfig {
  agentCount: number;
  intentsPerAgent: number;
  intentType: "SWAP" | "TRANSFER";
  tokenIn?: string;
  tokenOut?: string;
  recipient?: string;
}

export interface IntentSeed {
  agentIndex: number;
  intentIndex: number;
  intentType: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn: string;
  executeAfter?: number;
  deadline: number;
}

export function generateAgentKeys(count: number): Array<{ privateKey: string; address: string }> {
  const agents: Array<{ privateKey: string; address: string }> = [];
  for (let i = 0; i < count; i++) {
    const wallet = ethers.Wallet.createRandom();
    agents.push({
      privateKey: wallet.privateKey,
      address: wallet.address,
    });
  }
  return agents;
}

export function seedIntents(config: SeedConfig): IntentSeed[] {
  const intents: IntentSeed[] = [];
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  for (let agentIdx = 0; agentIdx < config.agentCount; agentIdx++) {
    for (let intentIdx = 0; intentIdx < config.intentsPerAgent; intentIdx++) {
      intents.push({
        agentIndex: agentIdx,
        intentIndex: intentIdx,
        intentType: config.intentType,
        tokenIn: config.tokenIn || "0xUSDC",
        tokenOut: config.tokenOut || "0xWETH",
        amountIn: "100",
        deadline,
      });
    }
  }
  return intents;
}

export function seedWithRegistration(config: SeedConfig): {
  agents: Array<{ address: string; permissionMask: number }>;
  intents: IntentSeed[];
} {
  const count = config.agentCount;
  const permissionMask = config.intentType === "SWAP" ? 2 : 1;
  const agents = Array.from({ length: count }, (_, i) => ({
    address: `0xAgent${i.toString().padStart(4, "0")}`,
    permissionMask,
  }));
  const intents = seedIntents(config);
  return { agents, intents };
}

export function generateStaggeredTimestamps(
  count: number,
  spacingMs: number
): number[] {
  const base = Date.now();
  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(base + i * spacingMs);
  }
  return timestamps;
}
