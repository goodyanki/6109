import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

export const DEPLOYMENT_FILE = "deployed_addresses.json";
export const DEFAULT_LIQUIDITY = { usdc: 300000, weth: 100 };

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

export async function deployAll(
  config: DeployConfig
): Promise<DeployedAddresses> {
  const rpcUrl = config.rpcUrl || "http://localhost:8545";
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
  const relayerAddress = config.relayerAddress || wallet.address;

  // 1. MockERC20 (USDC)
  const usdcFactory = new ethers.ContractFactory(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "artifacts", "contracts", "MockERC20.sol", "MockERC20.json"),
        "utf8"
      ).abi
    ),
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "artifacts", "contracts", "MockERC20.sol", "MockERC20.json"),
        "utf8"
      ).bytecode
    ),
    wallet
  );
  const usdc = await usdcFactory.deploy("Mock USDC", "USDC", 18);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  // 2. MockERC20 (WETH)
  const wethFactory = new ethers.ContractFactory(
    usdcFactory.interface,
    usdcFactory.bytecode,
    wallet
  );
  const weth = await wethFactory.deploy("Mock WETH", "WETH", 18);
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();

  // 3. MockSwapRouter
  const routerArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "MockSwapRouter.sol", "MockSwapRouter.json"),
      "utf8"
    )
  );
  const routerFactory = new ethers.ContractFactory(
    routerArtifact.abi,
    routerArtifact.bytecode,
    wallet
  );
  const router = await routerFactory.deploy(usdcAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  // 4. AgentRegistry
  const registryArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "AgentRegistry.sol", "AgentRegistry.json"),
      "utf8"
    )
  );
  const registryFactory = new ethers.ContractFactory(
    registryArtifact.abi,
    registryArtifact.bytecode,
    wallet
  );
  const registry = await registryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();

  // 5. IntentManager
  const imArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "IntentManager.sol", "IntentManager.json"),
      "utf8"
    )
  );
  const imFactory = new ethers.ContractFactory(imArtifact.abi, imArtifact.bytecode, wallet);
  const intentManager = await imFactory.deploy(registryAddress);
  await intentManager.waitForDeployment();
  const imAddress = await intentManager.getAddress();

  // 6. BatchExecutor
  const beArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "BatchExecutor.sol", "BatchExecutor.json"),
      "utf8"
    )
  );
  const beFactory = new ethers.ContractFactory(beArtifact.abi, beArtifact.bytecode, wallet);
  const batchExecutor = await beFactory.deploy(imAddress, routerAddress, relayerAddress);
  await batchExecutor.waitForDeployment();
  const beAddress = await batchExecutor.getAddress();

  // Authorize BatchExecutor on IntentManager
  const imContract = new ethers.Contract(imAddress, imArtifact.abi, wallet);
  await imContract.setBatchExecutor(beAddress);

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
  wallet: ethers.Wallet,
  liquidity: { usdc: number; weth: number } = DEFAULT_LIQUIDITY
): Promise<void> {
  const usdcArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "MockERC20.sol", "MockERC20.json"),
      "utf8"
    )
  );
  const routerArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "MockSwapRouter.sol", "MockSwapRouter.json"),
      "utf8"
    )
  );

  const usdc = new ethers.Contract(addresses.usdc, usdcArtifact.abi, wallet);
  const weth = new ethers.Contract(addresses.weth, usdcArtifact.abi, wallet);
  const router = new ethers.Contract(addresses.mockSwapRouter, routerArtifact.abi, wallet);

  const usdcAmount = ethers.parseUnits(liquidity.usdc.toString(), 18);
  const wethAmount = ethers.parseUnits(liquidity.weth.toString(), 18);

  // Mint to router directly
  await usdc.mint(addresses.mockSwapRouter, usdcAmount);
  await weth.mint(addresses.mockSwapRouter, wethAmount);

  // Mint to wallet for addLiquidity
  await usdc.mint(wallet.address, usdcAmount);
  await weth.mint(wallet.address, wethAmount);

  await usdc.approve(addresses.mockSwapRouter, usdcAmount);
  await weth.approve(addresses.mockSwapRouter, wethAmount);

  await router.addLiquidity(addresses.usdc, usdcAmount);
  await router.addLiquidity(addresses.weth, wethAmount);
}

export async function configureBatchExecutor(
  addresses: DeployedAddresses,
  wallet: ethers.Wallet,
  relayerAddress: string
): Promise<void> {
  const beArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "BatchExecutor.sol", "BatchExecutor.json"),
      "utf8"
    )
  );
  const batchExecutor = new ethers.Contract(addresses.batchExecutor, beArtifact.abi, wallet);
  await batchExecutor.setRelayer(relayerAddress);
}

export const TEST_ACCOUNTS: { address: string; usdc: string; weth: string }[] = [];

export async function mintTestTokens(
  addresses: DeployedAddresses,
  wallet: ethers.Wallet,
  accounts: { address: string; usdc: string; weth: string }[] = TEST_ACCOUNTS
): Promise<void> {
  const usdcArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", "MockERC20.sol", "MockERC20.json"),
      "utf8"
    )
  );
  const usdc = new ethers.Contract(addresses.usdc, usdcArtifact.abi, wallet);
  const weth = new ethers.Contract(addresses.weth, usdcArtifact.abi, wallet);

  for (const account of accounts) {
    await usdc.mint(account.address, ethers.parseUnits(account.usdc, 18));
    await weth.mint(account.address, ethers.parseUnits(account.weth, 18));
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
