// 故意失败种子脚本：用于触发 partial-failure 隔离机制的演示
// 90 个正常 SWAP 意图 + 10 个 minAmountOut 不可达的 SWAP 意图（会被 BatchExecutor 标记为 FAILED）
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { getDatabase } from "./database";
import { DEFAULT_HARDHAT_PRIVATE_KEY, DEFAULT_RPC_URL, DeployedAddresses } from "./deploy";

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readArtifact(contractName: string): { abi: ethers.InterfaceAbi } {
  return readJson(
    path.join(__dirname, "..", "artifacts", "contracts", `${contractName}.sol`, `${contractName}.json`)
  );
}

function readDeployedAddresses(): DeployedAddresses {
  return readJson(path.join(__dirname, "..", "data", "deployed_addresses.json"));
}

interface FailingSeedConfig {
  totalAgents: number;        // 总 Agent 数量
  failingAgents: number;      // 其中故意制造失败的 Agent 数量
  intentsPerAgent: number;
  rpcUrl?: string;
  privateKey?: string;
}

async function main(config: FailingSeedConfig) {
  const addresses = readDeployedAddresses();
  const provider = new ethers.JsonRpcProvider(config.rpcUrl || DEFAULT_RPC_URL);
  const deployerWallet = new ethers.Wallet(
    config.privateKey || DEFAULT_HARDHAT_PRIVATE_KEY,
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
  const db = getDatabase();

  let intentsCreated = 0;
  let failingIntentsCreated = 0;

  for (let i = 0; i < config.totalAgents; i++) {
    const isFailing = i < config.failingAgents; // 前 N 个 Agent 标记为"故意失败"
    const agentWallet = ethers.Wallet.createRandom().connect(provider);
    const agent = new ethers.NonceManager(agentWallet);
    const agentAddress = await agent.getAddress();

    await (await deployer.sendTransaction({ to: agentAddress, value: ethers.parseEther("0.05") })).wait();
    await (await registry.registerAgent(agentAddress, 2)).wait(); // SWAP 权限
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
      // 故意失败：把 minAmountOut 设成一个 AMM 永远不可能给出的数（100 USDC → 1000 WETH）
      // 正常：minAmountOut = 0.01 WETH（远小于 AMM 实际报价）
      const minAmountOut = isFailing
        ? ethers.parseUnits("1000", 18)
        : ethers.parseUnits("0.01", 18);

      const tx = await intentManager.submitSwapIntent(
        addresses.usdc,
        addresses.weth,
        ethers.parseUnits("100", 18),
        minAmountOut,
        0,
        deadline,
        0
      );
      const receipt = await tx.wait();
      intentsCreated++;
      if (isFailing) failingIntentsCreated++;

      db.prepare(
        `INSERT INTO intents
          (chain_intent_id, agent_address, intent_type, token_in, token_out, amount_in, status, deadline, tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        intentsCreated,
        agentAddress,
        "SWAP",
        addresses.usdc,
        addresses.weth,
        "100",
        "PENDING",
        new Date(deadline * 1000).toISOString(),
        receipt.hash
      );
    }
  }

  console.log(JSON.stringify({
    totalAgents: config.totalAgents,
    failingAgents: config.failingAgents,
    intentsCreated,
    failingIntentsCreated,
    expectedFailRate: failingIntentsCreated / intentsCreated,
  }, null, 2));
}

if (require.main === module) {
  main({
    totalAgents: Number(process.env.TOTAL_AGENTS || 50),
    failingAgents: Number(process.env.FAILING_AGENTS || 5), // 5 个 agent × 2 intent = 10 个失败意图
    intentsPerAgent: Number(process.env.INTENTS_PER_AGENT || 2),
  }).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
