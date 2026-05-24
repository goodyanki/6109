export const DCA_INTERVAL_MS = 60000;
export const PRICE_TRIGGER_THRESHOLD = 2800;
export const DEFAULT_MAX_GAS_PRICE = 100000000000n; // 100 gwei in wei

import { ethers } from "ethers";
import * as fs from "fs";

export class AgentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentError";
  }
}

export interface AgentConfig {
  rpcUrl: string;
  privateKey?: string;
  contractAddresses?: Record<string, string>;
  priceConfigPath?: string;
}

export interface SwapIntentParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
}

export function evaluateDcaRule(lastSubmissionTimestamp: number): boolean {
  const elapsed = Date.now() - lastSubmissionTimestamp;
  return elapsed >= DCA_INTERVAL_MS;
}

export function evaluatePriceRule(currentPrice: number): boolean {
  return currentPrice < PRICE_TRIGGER_THRESHOLD;
}

export async function loadPriceConfig(filePath: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Price config file not found: ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (typeof data.price !== "number") {
    throw new Error("Invalid price config: missing 'price' field");
  }
  return data.price;
}

export async function checkRegistration(
  agentAddress: string,
  registryContract: ethers.Contract
): Promise<boolean> {
  try {
    return await registryContract.isRegisteredAgent(agentAddress);
  } catch {
    return false;
  }
}

export function buildSwapIntent(params: SwapIntentParams): {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  maxGasPrice: bigint;
} {
  return {
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
    maxGasPrice: DEFAULT_MAX_GAS_PRICE,
  };
}

export function handleTxError(error: AgentError): void {
  console.error(`Agent transaction error: ${error.message}`);
  // Does not throw — graceful error handling
}

export interface Agent {
  stop: () => Promise<void>;
}

export function createAgent(config: AgentConfig): Agent {
  let running = true;

  const stop = async (): Promise<void> => {
    running = false;
  };

  return { stop };
}
