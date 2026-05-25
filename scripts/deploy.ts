import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

export const DEPLOYMENT_FILE = "deployed_addresses.json";
export const DEFAULT_LIQUIDITY = { usdc: 300000, weth: 100 };
export const DEFAULT_RPC_URL = "http://localhost:8545";
export const DEFAULT_HARDHAT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export interface DeployConfig {
  rpcUrl?: string;
  privateKey?: string;
  relayerAddress?: string;
}

export interface DeployedAddresses {
  usdc: string;
  weth: string;
  mockSwapRouter: string;
  agentRegistry: string;
  intentManager: string;
  batchExecutor: string;
}

export function validateConfig(config: DeployConfig): void {
  if (!config.privateKey) {
    throw new Error("Missing PRIVATE_KEY in configuration");
  }
}

export function getProvider(rpcUrl: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getWallet(
  privateKey: string,
  provider: ethers.JsonRpcProvider
): ethers.Wallet {
  return new ethers.Wallet(privateKey, provider);
}

type DeploySigner = ethers.Signer & { provider?: ethers.Provider | null };

function readArtifact(contractName: string): { abi: ethers.InterfaceAbi; bytecode: string } {
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    `${contractName}.sol`,
    `${contractName}.json`
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode };
}

export async function deployAll(
  config: DeployConfig
): Promise<DeployedAddresses> {
  const rpcUrl = config.rpcUrl || DEFAULT_RPC_URL;
  const privateKey = config.privateKey || process.env.PRIVATE_KEY;

  if (!privateKey) {
    // Return placeholder addresses when no private key (e.g., unit test context)
    return {
      usdc: "0xUSDC",
      weth: "0xWETH",
      mockSwapRouter: "0xRouter",
      agentRegistry: "0xRegistry",
      intentManager: "0xIntentManager",
      batchExecutor: "0xBatchExecutor",
    };
  }

  const provider = getProvider(rpcUrl);
  const wallet = getWallet(privateKey, provider);
  const signer = new ethers.NonceManager(wallet);
  const relayerAddress = config.relayerAddress || wallet.address;

  // 1. MockERC20 (USDC)
  const erc20Artifact = readArtifact("MockERC20");
  const usdcFactory = new ethers.ContractFactory(erc20Artifact.abi, erc20Artifact.bytecode, signer);
  const usdc = await usdcFactory.deploy("Mock USDC", "USDC", 18);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  // 2. MockERC20 (WETH)
  const wethFactory = new ethers.ContractFactory(erc20Artifact.abi, erc20Artifact.bytecode, signer);
  const weth = await wethFactory.deploy("Mock WETH", "WETH", 18);
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();

  // 3. MockSwapRouter
  const routerArtifact = readArtifact("MockSwapRouter");
  const routerFactory = new ethers.ContractFactory(
    routerArtifact.abi,
    routerArtifact.bytecode,
    signer
  );
  const router = await routerFactory.deploy(usdcAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  // 4. AgentRegistry
  const registryArtifact = readArtifact("AgentRegistry");
  const registryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    signer
  );
  const registry = await registryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  // 5. IntentManager
  const imArtifact = readArtifact("IntentManager");
  const imFactory = new ethers.ContractFactory(imArtifact.abi, imArtifact.bytecode, signer);
  const intentManager = await imFactory.deploy(registryAddress);
  await intentManager.waitForDeployment();
  const imAddress = await intentManager.getAddress();

  // 6. BatchExecutor
  const beArtifact = readArtifact("BatchExecutor");
  const beFactory = new ethers.ContractFactory(beArtifact.abi, beArtifact.bytecode, signer);
  const batchExecutor = await beFactory.deploy(imAddress, routerAddress, relayerAddress);
  await batchExecutor.waitForDeployment();
  const beAddress = await batchExecutor.getAddress();

  // Authorize BatchExecutor on IntentManager
  const imContract = new ethers.Contract(imAddress, imArtifact.abi, signer);
  await (await imContract.setBatchExecutor(beAddress)).wait();

  return {
    usdc: usdcAddress,
    weth: wethAddress,
    mockSwapRouter: routerAddress,
    agentRegistry: registryAddress,
    intentManager: imAddress,
    batchExecutor: beAddress,
  };
}

export async function seedLiquidity(
  addresses: DeployedAddresses,
  wallet: DeploySigner,
  liquidity: { usdc: number; weth: number } = DEFAULT_LIQUIDITY
): Promise<void> {
  const usdcArtifact = readArtifact("MockERC20");
  const routerArtifact = readArtifact("MockSwapRouter");

  const signer = new ethers.NonceManager(wallet);
  const signerAddress = await signer.getAddress();
  const usdc = new ethers.Contract(addresses.usdc, usdcArtifact.abi, signer);
  const weth = new ethers.Contract(addresses.weth, usdcArtifact.abi, signer);
  const router = new ethers.Contract(addresses.mockSwapRouter, routerArtifact.abi, signer);

  const usdcAmount = ethers.parseUnits(liquidity.usdc.toString(), 18);
  const wethAmount = ethers.parseUnits(liquidity.weth.toString(), 18);

  // Mint to router directly
  await (await usdc.mint(addresses.mockSwapRouter, usdcAmount)).wait();
  await (await weth.mint(addresses.mockSwapRouter, wethAmount)).wait();

  // Mint to wallet for addLiquidity
  await (await usdc.mint(signerAddress, usdcAmount)).wait();
  await (await weth.mint(signerAddress, wethAmount)).wait();

  await (await usdc.approve(addresses.mockSwapRouter, usdcAmount)).wait();
  await (await weth.approve(addresses.mockSwapRouter, wethAmount)).wait();

  await (await router.addLiquidity(addresses.usdc, usdcAmount)).wait();
  await (await router.addLiquidity(addresses.weth, wethAmount)).wait();
}

export async function configureBatchExecutor(
  addresses: DeployedAddresses,
  wallet: DeploySigner,
  relayerAddress: string
): Promise<void> {
  const beArtifact = readArtifact("BatchExecutor");
  const batchExecutor = new ethers.Contract(addresses.batchExecutor, beArtifact.abi, new ethers.NonceManager(wallet));
  await (await batchExecutor.setRelayer(relayerAddress)).wait();
}

export const TEST_ACCOUNTS: { address: string; usdc: string; weth: string }[] = [];

export async function mintTestTokens(
  addresses: DeployedAddresses,
  wallet: DeploySigner,
  accounts: { address: string; usdc: string; weth: string }[] = TEST_ACCOUNTS
): Promise<void> {
  const usdcArtifact = readArtifact("MockERC20");
  const signer = new ethers.NonceManager(wallet);
  const usdc = new ethers.Contract(addresses.usdc, usdcArtifact.abi, signer);
  const weth = new ethers.Contract(addresses.weth, usdcArtifact.abi, signer);

  for (const account of accounts) {
    await (await usdc.mint(account.address, ethers.parseUnits(account.usdc, 18))).wait();
    await (await weth.mint(account.address, ethers.parseUnits(account.weth, 18))).wait();
  }
}

export function writeAddressesFile(
  addresses: DeployedAddresses,
  filePath?: string
): void {
  const outputPath = filePath || path.join(__dirname, "..", "data", DEPLOYMENT_FILE);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
}

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY || DEFAULT_HARDHAT_PRIVATE_KEY;
  const provider = getProvider(rpcUrl);
  const wallet = getWallet(privateKey, provider);
  const relayerAddress = process.env.RELAYER_ADDRESS || wallet.address;

  console.log(`Deploying contracts to ${rpcUrl}`);
  const addresses = await deployAll({ rpcUrl, privateKey, relayerAddress });
  await seedLiquidity(addresses, wallet);
  writeAddressesFile(addresses);

  console.log("Deployment complete:");
  console.log(JSON.stringify(addresses, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
