# Macro-Intent Agent Execution Network (MVP)

**AI-Powered On-Chain Agent Protocol with Intent Infrastructure**

基于意图（Intent）的链上自主 Agent 批量执行网络 — 课程 SC6019 Option 1 MVP 实现。

---

## 1. 项目概述

本项目实现了一个最小化的意图执行网络。Agent 在链上注册后提交高层意图（SWAP / TRANSFER），链下 Relayer 异步扫描待处理意图，将相容意图合并为批次（Batch），通过 BatchExecutor 合约在单笔链上交易中批量执行。系统通过 SQLite 记录全流程指标，提供 Web 前端对比批处理前后的吞吐量、延迟、失败率和 Gas 成本。

**核心贡献在于批量执行基础设施本身，而非交易策略。**

### 技术栈

| 层 | 技术 |
|---|---|
| 智能合约 | Solidity 0.8.24, Hardhat, OpenZeppelin |
| 本地链 | Hardhat Network (chainId 31337) |
| 离线脚本 | Node.js, TypeScript, ethers.js v6 |
| 数据存储 | SQLite (better-sqlite3) |
| API 服务 | Express |
| 前端 | React 18 + Vite, Recharts |

---

## 2. 项目结构

```text
macro-intent-agent-network/
├── contracts/                    # Solidity 智能合约
│   ├── MockERC20.sol             # ERC20 测试代币 (USDC / WETH)
│   ├── MockSwapRouter.sol        # 恒定乘积 AMM (x*y=k)
│   ├── AgentRegistry.sol         # Agent 注册与权限管理
│   ├── IntentManager.sol         # 意图提交、取消、查询
│   └── BatchExecutor.sol         # 批量执行 + 部分失败支持
│
├── scripts/                      # TypeScript 离线脚本
│   ├── database.ts               # SQLite 数据库初始化
│   ├── deploy.ts                 # 合约部署 + 流动性初始化
│   ├── agent.ts                  # 规则驱动 Agent 引擎
│   ├── relayer.ts                # 扫描→过滤→分批→执行→记录
│   ├── seedIntents.ts            # 基准测试意图生成
│   ├── runBaseline.ts            # 基线基准测试 (batchSize=1)
│   ├── runBatching.ts            # 批量基准测试 (batchSize=10)
│   ├── server.ts                 # Express API 服务
│   ├── security.ts               # 安全测试辅助
│   └── integration.ts            # 端到端集成测试辅助
│
├── test/                         # TDD 测试套件 (174 test cases)
│   ├── contracts/                # 合约单元测试 (Hardhat)
│   ├── scripts/                  # 脚本单元测试 (Vitest)
│   ├── database/                 # 数据库模式测试
│   ├── api/                      # API 端点测试
│   ├── integration/              # 端到端集成测试
│   └── security/                 # 安全性测试
│
├── frontend/                     # React + Vite 调试前端
│   └── src/
│       ├── App.tsx               # 标签页导航
│       └── pages/
│           ├── Agents.tsx        # Agent 列表
│           ├── Intents.tsx       # 意图池 (支持过滤/展开)
│           ├── Batches.tsx       # 批次历史
│           └── Metrics.tsx       # 指标对比 + 柱状图
│
├── data/                         # SQLite 数据库文件 (gitignored)
├── doc/                          # 项目文档
│   ├── Option1_Full_Spec.md      # 完整 MVP 规格说明
│   ├── TEST_SPEC.md              # TDD 测试规格 (132 cases)
│   └── SC6019 Project Description.pdf
├── report/                       # 最终报告目录
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## 3. 快速开始

### 3.1 环境要求

- Node.js >= 18
- npm >= 9

### 3.2 安装依赖

```bash
# 根目录 (合约 + 脚本)
npm install

# 前端
cd frontend && npm install && cd ..
```

### 3.3 编译合约

```bash
npm run compile
```

### 3.4 运行测试

```bash
# 合约测试 (95 cases)
npm run test

# 离线脚本测试 (79 cases)
npm run test:scripts

# 全部测试
npm run test:all
```

---

## 4. 架构设计

### 4.1 系统流程

```text
                    Simple Debug Frontend (React)
                           ↑
Rule-Based Agent Engine ──→ IntentManager (smart contract)
  (off-chain script)          ↓
                         Pending Intent Pool
                               ↓
Off-Chain Relayer ──→ filters → groups →BatchExecutor (smart contract)
  (script)                    ↓           ↓
                        MockSwapRouter  Direct Transfer
                       (x*y=k AMM)       (ERC20)
                              ↓
                     Metrics Recorder (SQLite)
                              ↓
                     Express API → Frontend Display
```

### 4.2 合约依赖关系

```text
MockERC20 ──────→ MockSwapRouter
                      ↓
AgentRegistry ──→ IntentManager ──→ BatchExecutor
```

### 4.3 合约说明

| 合约 | 职责 |
|---|---|
| **MockERC20** | 标准 ERC20 + `mint(onlyOwner)`。部署两份：Mock USDC 和 Mock WETH，均 18 位小数 |
| **MockSwapRouter** | 恒定乘积 AMM `x * y = k`，0.3% 手续费。初始池：300k USDC / 100 WETH (1 WETH ≈ 3000 USDC) |
| **AgentRegistry** | Agent 注册（含权限掩码）、激活/停用、权限校验 |
| **IntentManager** | 接收 SWAP / TRANSFER 意图，支持取消、状态生命周期管理、分页查询 |
| **BatchExecutor** | 核心批量执行器。单笔交易执行最多 10 个意图，支持部分失败（单个意图失败不回滚整批）。含 ReentrancyGuard |

### 4.4 意图类型

| 类型 | 参数 | 说明 |
|---|---|---|
| **TRANSFER** | token, recipient, amount | Agent 向指定地址转账 |
| **SWAP** | tokenIn, tokenOut, amountIn, minAmountOut | Agent 通过 AMM 兑换代币 |

每个意图包含：`executeAfter`（最早执行时间）、`deadline`（过期时间）、`maxGasPrice`（Gas 上限）。

### 4.5 意图状态生命周期

```text
PENDING ──→ BATCHED ──→ EXECUTED
  │                       
  ├──→ FAILED             (校验失败 / 执行失败)
  ├──→ EXPIRED            (超过 deadline)
  └──→ CANCELLED          (Owner/Agent 主动取消)
```

---

## 5. Demo 流程

以下为完整的演示流程，在本地 Hardhat Network 上运行。

### 关键概念说明

**Agent 是什么？** Agent 本质上就是一个以太坊地址。任何持有私钥的地址都可以通过 `AgentRegistry.registerAgent()` 注册成为 Agent。Demo 中使用的 `agent1`、`agent2`、`agent3` 是 Hardhat Network 预置的测试账户（Hardhat 节点启动时自动生成 20 个账户，每个持有 10000 ETH）。你不需要"创建"Agent — 任何 Hardhat 账户直接注册即可。

**代币是真的吗？** 不是。`MockERC20`（Mock USDC / Mock WETH）是部署在本地 Hardhat Network 上的模拟代币，仅供测试使用。合约中的 `mint()` 函数可以免费铸造任意数量，与主网上的真实 USDC/WETH 没有任何关系。MockSwapRouter 的 AMM 池也只是用恒定乘积公式 (`x * y = k`) 模拟真实 DEX 的滑点行为。

### Step 1: 启动本地链

```bash
npm run node
```

启动 Hardhat Network，监听 `localhost:8545`。保持此终端运行。

### Step 2: 部署合约

打开新终端，执行：

```bash
npm run deploy
```

此命令执行以下操作：
1. 部署 MockERC20 (USDC) 和 MockERC20 (WETH)
2. 部署 MockSwapRouter（关联 USDC/WETH）
3. 部署 AgentRegistry
4. 部署 IntentManager（关联 AgentRegistry）
5. 部署 BatchExecutor（关联 IntentManager、Router，设置 Relayer 地址）
6. 向 MockSwapRouter 注入流动性（300k USDC + 100 WETH）
7. 将合约地址写入 `data/deployed_addresses.json`

预期输出：各合约地址确认。

### Step 3: 注册 Agent

创建脚本或通过 Hardhat Console 注册测试 Agent：

```bash
npx hardhat console --network localhost
```

在控制台中执行：

```javascript
const { ethers } = require("hardhat");
const addresses = require("./data/deployed_addresses.json");

const [owner, agent1, agent2, agent3] = await ethers.getSigners();

// 获取合约实例
const registry = await ethers.getContractAt("AgentRegistry", addresses.agentRegistry);
const usdc = await ethers.getContractAt("MockERC20", addresses.usdc);
const weth = await ethers.getContractAt("MockERC20", addresses.weth);
const intentManager = await ethers.getContractAt("IntentManager", addresses.intentManager);

// 注册 3 个 Agent (PERM_TRANSFER=1, PERM_SWAP=2, PERM_BOTH=3)
await registry.registerAgent(agent1.address, 3);  // 全部权限
await registry.registerAgent(agent2.address, 2);  // 仅 SWAP
await registry.registerAgent(agent3.address, 1);  // 仅 TRANSFER

// 给 Agent 铸造测试代币
await usdc.mint(agent1.address, ethers.parseUnits("10000", 18));
await weth.mint(agent1.address, ethers.parseUnits("100", 18));
await usdc.mint(agent2.address, ethers.parseUnits("10000", 18));
await weth.mint(agent2.address, ethers.parseUnits("100", 18));

// Agent 授权 BatchExecutor 花费代币
const beAddress = addresses.batchExecutor;
await usdc.connect(agent1).approve(beAddress, ethers.MaxUint256);
await weth.connect(agent1).approve(beAddress, ethers.MaxUint256);
await usdc.connect(agent2).approve(beAddress, ethers.MaxUint256);
await weth.connect(agent2).approve(beAddress, ethers.MaxUint256);
```

### Step 4: Agent 提交意图

```javascript
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 小时后过期

// Agent1 提交 5 个 SWAP 意图: 100 USDC → WETH
for (let i = 0; i < 5; i++) {
  await intentManager.connect(agent1).submitSwapIntent(
    await usdc.getAddress(),
    await weth.getAddress(),
    ethers.parseUnits("100", 18),   // 100 USDC
    ethers.parseUnits("0.01", 18),  // 最少获得 0.01 WETH
    0,                                // 立即可执行
    deadline,
    0                                 // 不限制 Gas 价格
  );
}

// Agent2 提交 2 个 SWAP 意图
for (let i = 0; i < 2; i++) {
  await intentManager.connect(agent2).submitSwapIntent(
    await usdc.getAddress(),
    await weth.getAddress(),
    ethers.parseUnits("50", 18),
    ethers.parseUnits("0.005", 18),
    0,
    deadline,
    0
  );
}

// 查看待处理意图
const pending = await intentManager.getPendingIntentIds(0, 10);
console.log("Pending intents:", pending);
```

### Step 5: Relayer 批量执行

```javascript
const batchExecutor = await ethers.getContractAt("BatchExecutor", addresses.batchExecutor);

// 获取 pending 意图 ID 列表
const pendingIds = await intentManager.getPendingIntentIds(0, 10);
const ids = pendingIds.map(id => Number(id));

// 批量执行
const tx = await batchExecutor.executeBatch(ids);
const receipt = await tx.wait();
console.log("Batch executed. Gas used:", receipt.gasUsed.toString());

// 验证意图状态
for (const id of ids) {
  const intent = await intentManager.getIntent(id);
  console.log(`Intent ${id}: status=${intent.status} (0=PENDING,2=EXECUTED,3=FAILED,4=EXPIRED)`);
}
```

### Step 6: 启动 API 服务

```bash
npx ts-node scripts/server.ts
```

服务运行在 `http://localhost:3001`。

可用端点：
- `GET /api/agents` — Agent 列表
- `GET /api/intents?status=ALL` — 意图查询
- `GET /api/batches` — 批次历史
- `GET /api/benchmarks` — 基准测试记录
- `GET /api/metrics/comparison` — 批处理前后对比

### Step 7: 启动前端

```bash
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`，即可看到 4 个标签页：

| 标签页 | 内容 |
|---|---|
| **Agents** | Agent ID、地址、Owner、激活状态（绿色/红色徽章） |
| **Intents** | 意图类型、状态（彩色徽章）、点击行展开详情 |
| **Batches** | Tx Hash、成功/失败计数、Gas 用量、成功率进度条 |
| **Metrics** | 批处理前后对比表 + Gas 柱状图 |

### Step 8: 运行基准测试

```bash
# 生成 100 个意图 (50 agent × 2)
npx ts-node scripts/seedIntents.ts

# 基线: 逐个执行 (batchSize=1)
npx ts-node scripts/runBaseline.ts

# 批量: 10 个一批
npx ts-node scripts/runBatching.ts
```

基准测试结果自动写入 SQLite，前端 Metrics 页面可查看对比。

---

## 6. 基准测试场景

### 场景 A: 同构 SWAP (主要)

- 50 个 Agent，每个提交 2 个 USDC→WETH SWAP 意图（共 100 个）
- 对比 `batchSize=1`（基线）与 `batchSize=10`（批量）

### 场景 B: 混合工作负载 (附加)

- 50 个 SWAP 意图 + 50 个 TRANSFER 意图
- 同上的对比

### 记录指标

| 指标 | 说明 |
|---|---|
| Total Tx Count | 上链交易总数 |
| Avg Gas per Intent | 每意图平均 Gas 消耗 |
| Throughput (intents/s) | 吞吐量 |
| Avg / P95 Latency | 延迟分布 |
| Failure Rate | 失败率 |

---

## 7. 安全与正确性

| 规则 | 实现 |
|---|---|
| Agent 授权 | 仅已注册 + 激活的 Agent 可提交意图 |
| 意图不可变 | Relayer 无法修改意图参数（BatchExecutor 直接从 IntentManager 读取存储值） |
| 滑点保护 | SWAP 强制检查 `minAmountOut` |
| 过期保护 | `deadline` 之后拒绝执行 |
| 取消机制 | Agent/Owner 可取消 PENDING 意图 |
| 部分失败隔离 | 单个意图失败不回滚整批 |
| 重入保护 | BatchExecutor 使用 OpenZeppelin ReentrancyGuard |
| 溢出保护 | Solidity 0.8.x 内置溢出检查 |

---

## 8. 最终交付物

| 交付物 | 内容 |
|---|---|
| GitHub 仓库 | 合约 + 脚本 + 前端 + 测试 |
| 最终报告 | `report/` 目录：架构说明、基准测试结果、权衡分析 |
| 演示视频 | 注册 → 意图提交 → 批量执行 → 指标对比 |
| 仪表板截图 | Agent 列表、意图池、批次历史、指标对比 |

---

## 9. 开发命令速查

```bash
npm run compile          # 编译 Solidity 合约
npm run test             # 运行合约测试 (Hardhat)
npm run test:scripts     # 运行脚本测试 (Vitest)
npm run test:all         # 全部测试
npm run node             # 启动 Hardhat 本地链
npm run deploy           # 部署合约到 localhost
npm run agent            # 启动 Agent 引擎
npm run relayer          # 启动 Relayer
npm run seed             # 生成测试意图
npm run baseline         # 运行基线基准测试
npm run batching         # 运行批量基准测试
cd frontend && npm run dev  # 启动前端开发服务器
```
