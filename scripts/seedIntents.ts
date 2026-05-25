import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { getDatabase } from "./database";
import { DEFAULT_HARDHAT_PRIVATE_KEY, DEFAULT_RPC_URL, DeployedAddresses } from "./deploy";

export interface SeedConfig {
  agentCount: number;
  intentsPerAgent: number;
  intentType: "SWAP" | "TRANSFER";
  tokenIn?: string;
  tokenOut?: string;
  recipient?: string;
  rpcUrl?: string;
  privateKey?: string;
  contractAddresses?: DeployedAddresses;
  dbPath?: string;
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

function readDeployedAddresses(): DeployedAddresses {
  return readJson(path.join(__dirname, "..", "data", "deployed_addresses.json"));
}

export async function seedIntentsOnChain(config: SeedConfig): Promise<{
  agentsCreated: number;
  intentsCreated: number;
}> {
  const addresses = config.contractAddresses || readDeployedAddresses();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl || DEFAULT_RPC_URL);
  const deployerWallet = new ethers.Wallet(
    config.privateKey || process.env.PRIVATE_KEY || DEFAULT_HARDHAT_PRIVATE_KEY,
    provider
  );
  const deployer = new ethers.NonceManager(deployerWallet);
  const deployerAddress = await deployer.getAddress();

  const erc20Artifact = readArtifact("MockERC20");
  const registryArtifact = readArtifact("AgentRegistry");
  const intentArtifact = readArtifact("IntentManager");

  const usdc = new ethers.Contract(addresses.usdc, erc20Artifact.abi, deployer);
  const weth = new ethers.Contract(addresses.weth, erc20Artifact.abi, deployer);
  const registry = new ethers.Contract(addresses.agentRegistry, registryArtifact.abi, deployer);
  const db = getDatabase(config.dbPath);
  const recipient = config.recipient || deployerAddress;
  let intentsCreated = 0;

  for (let i = 0; i < config.agentCount; i++) {
    const agentWallet = ethers.Wallet.createRandom().connect(provider);
    const agent = new ethers.NonceManager(agentWallet);
    const agentAddress = await agent.getAddress();
    await (await deployer.sendTransaction({ to: agentAddress, value: ethers.parseEther("0.05") })).wait();
    await (await registry.registerAgent(agentAddress, config.intentType === "SWAP" ? 2 : 1)).wait();
    await (await usdc.mint(agentAddress, ethers.parseUnits("10000", 18))).wait();
    await (await weth.mint(agentAddress, ethers.parseUnits("100", 18))).wait();

    const agentUsdc = usdc.connect(agent) as ethers.Contract;
    const agentWeth = weth.connect(agent) as ethers.Contract;
    await (await agentUsdc.approve(addresses.batchExecutor, ethers.MaxUint256)).wait();
    await (await agentWeth.approve(addresses.batchExecutor, ethers.MaxUint256)).wait();

    db.prepare(
      `INSERT OR IGNORE INTO agents (chain_agent_id, owner, agent_address, active)
       VALUES (?, ?, ?, ?)`
    ).run(i + 1, deployerAddress, agentAddress, 1);

    const intentManager = new ethers.Contract(addresses.intentManager, intentArtifact.abi, agent);
    for (let j = 0; j < config.intentsPerAgent; j++) {
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      let tx;
      if (config.intentType === "SWAP") {
        tx = await intentManager.submitSwapIntent(
          config.tokenIn || addresses.usdc,
          config.tokenOut || addresses.weth,
          ethers.parseUnits("100", 18),
          ethers.parseUnits("0.01", 18),
          0,
          deadline,
          0
        );
      } else {
        tx = await intentManager.submitTransferIntent(
          config.tokenIn || addresses.usdc,
          recipient,
          ethers.parseUnits("10", 18),
          0,
          deadline,
          0
        );
      }
      const receipt = await tx.wait();
      intentsCreated++;
      db.prepare(
        `INSERT INTO intents
          (chain_intent_id, agent_address, intent_type, token_in, token_out, amount_in, status, deadline, tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        intentsCreated,
        agentAddress,
        config.intentType,
        config.tokenIn || addresses.usdc,
        config.intentType === "SWAP" ? config.tokenOut || addresses.weth : null,
        config.intentType === "SWAP" ? "100" : "10",
        "PENDING",
        new Date(deadline * 1000).toISOString(),
        receipt.hash
      );
    }
  }

  return { agentsCreated: config.agentCount, intentsCreated };
}

if (require.main === module) {
  seedIntentsOnChain({
    agentCount: Number(process.env.AGENT_COUNT || 50),
    intentsPerAgent: Number(process.env.INTENTS_PER_AGENT || 2),
    intentType: (process.env.INTENT_TYPE as "SWAP" | "TRANSFER") || "SWAP",
    rpcUrl: process.env.RPC_URL || DEFAULT_RPC_URL,
    privateKey: process.env.PRIVATE_KEY || DEFAULT_HARDHAT_PRIVATE_KEY,
  })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
