# Option 1 MVP Spec: AI-Powered On-Chain Agent Protocol with Intent Infrastructure

**Project Name:** Macro-Intent Agent Execution Network (MVP)
**Version:** v0.1-MVP
**Course Topic:** Option 1 — AI-Powered On-Chain Agent Protocol with Intent Infrastructure
**Primary Goal:** Deliver a minimal viable intent execution system that meets all 5 assignment requirements, with a simple debug/demo frontend.

---

## 1. Executive Summary

This project implements a minimal intent-based execution network for autonomous on-chain agents. Agents submit high-level intents (SWAP or TRANSFER). An off-chain relayer scans pending intents, groups compatible intents into batches, and executes them through a batch executor smart contract. The system measures throughput, latency, failure rate, and gas cost before and after batching.

The core contribution is the protocol infrastructure — not a trading strategy.

---

## 2. Alignment with Option 1 Requirements

| Requirement | Implementation |
|---|---|
| Smart contract for registering/managing agents | `AgentRegistry` — register, activate/deactivate, permission mask |
| Intent submission interface (swaps, transfers, etc.) | `IntentManager` — supports `SWAP` and `TRANSFER` |
| Batching/aggregation mechanism | `BatchExecutor` + relayer groups multiple intents into one tx |
| Execution coordinator/relayer (async) | Off-chain relayer script polls pending intents, builds batches, submits |
| Performance dashboard or report | Simple web frontend displays agent/intent status + before/after batching metrics comparison |

Also covers the "Hints & Directions": ERC-4337 discussion in report, simple agent use cases (DCA, transfer), simulated off-chain intelligence (rule-based agent), and trade-off analysis (decentralization, efficiency, trust).

---

## 3. System Overview

### 3.1 High-Level Architecture

```text
Rule-Based Agent Engine (off-chain script)
        ↓
IntentManager Smart Contract  ←──  Simple Debug Frontend
        ↓
Pending Intent Pool
        ↓
Off-Chain Relayer (script)
        ↓
BatchExecutor Smart Contract
        ↓
MockSwapRouter (x*y=k AMM) / Direct Transfer
        ↓
Metrics Recorder (SQLite)
        ↓
Simple Demo Frontend (metrics display)
```

### 3.2 Main Components

| Component | Responsibility |
|---|---|
| AgentRegistry | Register and manage autonomous agents |
| IntentManager | Accept, store, and track SWAP/TRANSFER intents |
| BatchExecutor | Execute multiple intents in one on-chain tx |
| MockERC20 | Mock USDC and WETH tokens for testing |
| MockSwapRouter | Constant-product AMM mock swap (x*y=k), simulates slippage |
| Relayer Script | Async scan, filter, batch, execute, record metrics |
| Agent Script | Rule-based agent submitting intents on schedule/trigger |
| Debug/Demo Frontend | View agents, intents, batches, and batching vs no-batching metrics |

---

## 4. Smart Contract Specification

### 4.1 Contract: AgentRegistry

Register and manage autonomous agents.

```solidity
struct Agent {
    address owner;
    address agentAddress;
    bool active;
    uint256 allowedIntentMask;
    uint256 registeredAt;
}
```

**Core Functions:**

```solidity
function registerAgent(address agentAddress, uint256 allowedIntentMask) external returns (uint256 agentId);
function setAgentStatus(uint256 agentId, bool active) external;
function isRegisteredAgent(address agentAddress) external view returns (bool);
function canSubmitIntent(address agentAddress, uint8 intentType) external view returns (bool);
```

**Events:** `AgentRegistered`, `AgentStatusChanged`

---

### 4.2 Contract: IntentManager

Accepts SWAP and TRANSFER intents from registered agents.

```solidity
enum IntentType { TRANSFER, SWAP }

enum IntentStatus { PENDING, BATCHED, EXECUTED, FAILED, EXPIRED, CANCELLED }

struct Intent {
    uint256 id;
    address agent;
    address owner;
    IntentType intentType;
    address tokenIn;
    address tokenOut;
    address recipient;
    uint256 amountIn;
    uint256 minAmountOut;
    uint256 executeAfter;
    uint256 deadline;
    uint256 maxGasPrice;
    uint256 createdAt;
    IntentStatus status;
}
```

**Core Functions:**

```solidity
function submitTransferIntent(
    address token, address recipient, uint256 amount,
    uint256 executeAfter, uint256 deadline, uint256 maxGasPrice
) external returns (uint256 intentId);

function submitSwapIntent(
    address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut,
    uint256 executeAfter, uint256 deadline, uint256 maxGasPrice
) external returns (uint256 intentId);

function cancelIntent(uint256 intentId) external;
function getIntent(uint256 intentId) external view returns (Intent memory);
function getPendingIntentIds(uint256 offset, uint256 limit) external view returns (uint256[] memory);
```

**Events:** `IntentSubmitted`, `IntentStatusChanged`, `IntentCancelled`

---

### 4.3 Contract: BatchExecutor

Executes multiple intents in one transaction. Supports partial failure (one bad intent does not revert the entire batch).

```solidity
function executeBatch(uint256[] calldata intentIds) external returns (uint256 successCount, uint256 failedCount);
```

**Execution Flow:**
1. Load each intent from IntentManager
2. Verify: status == PENDING, agent active, within time window, gas price acceptable
3. Execute SWAP via MockSwapRouter or TRANSFER via token transfer
4. Mark EXECUTED on success, FAILED/EXPIRED on failure
5. Emit `BatchExecuted` and per-intent `IntentExecuted` events

---

### 4.4 Contract: MockERC20

Standard ERC20 with `mint(address, uint256)` for test token creation. Two tokens: **MockUSDC** and **MockWETH**.

---

### 4.5 Contract: MockSwapRouter

Implements a **constant-product AMM model** (x * y = k) to simulate realistic swap execution with slippage.

**Price Model:**
```text
x * y = k  (constant product)

Pool initialized with liquidity, e.g.:
  reserveUSDC = 300,000 (300k USDC)
  reserveWETH = 100 (100 WETH)
  → k = 30,000,000
  → initial price: 1 WETH = 3000 USDC
```

**Core Function:**
```solidity
function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut);
```

Swap output is computed as:
```text
amountOut = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997)
```
(0.3% fee baked into the formula for realistic slippage behavior.)

This AMM model makes `minAmountOut` checks meaningful — larger swaps experience more slippage and may fail if output falls below the minimum, generating realistic failed-execution data for benchmarking.

**Additional Functions:**
```solidity
function addLiquidity(address token, uint256 amount) external;
function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
```

---

## 5. Intent Types (MVP — 2 types)

### 5.1 Transfer Intent

```json
{
  "intentType": "TRANSFER",
  "tokenIn": "USDC",
  "recipient": "0xRecipient",
  "amountIn": "100",
  "executeAfter": "<timestamp>",
  "deadline": "<timestamp>"
}
```

### 5.2 Swap Intent

```json
{
  "intentType": "SWAP",
  "tokenIn": "USDC",
  "tokenOut": "WETH",
  "amountIn": "100",
  "minAmountOut": "0.03",
  "executeAfter": "<timestamp>",
  "deadline": "<timestamp>"
}
```

---

## 6. Agent Engine (Simplified)

Off-chain Node.js/TypeScript script simulating the AI layer with 2 simple rules:

### Rule 1: Scheduled DCA
```
Every 60 seconds, submit a SWAP intent: 100 USDC → WETH
```

### Rule 2: Price-Triggered Swap
```
If mock ETH price drops below 2800 USDC, submit a SWAP intent: 200 USDC → WETH
```

The agent reads mock price data from a local config/JSON, evaluates rules, and calls `IntentManager` to submit intents.

---

## 7. Relayer Specification

A single TypeScript script (no REST server). Can be run manually or on a timer.

### Workflow
```
1. Poll IntentManager for pending intents
2. Filter executable intents (status==PENDING, agent active, in time window, gas ok)
3. Group by intentType + token pair
4. Build batches (maxBatchSize configurable, default 10)
5. Submit BatchExecutor.executeBatch(intentIds)
6. Wait for confirmation
7. Record gas, latency, success/fail counts to SQLite
8. Repeat
```

### Configurable Parameters

| Parameter | Default | Description |
|---|---|---|
| `pollIntervalSeconds` | 10 | How often to scan |
| `maxBatchSize` | 10 | Max intents per batch |

---

## 8. Simple Debug/Demo Frontend

A minimal single-page web app (React + Vite or plain HTML/JS) for debugging and demo. **Not a production dashboard.**

### Pages / Sections

**Tab 1 — Agents:** Table showing registered agents (ID, address, owner, active status, intent count).

**Tab 2 — Intent Pool:** Table of pending/executed/failed intents with type, status, timestamps.

**Tab 3 — Batches:** Table of executed batches with tx hash, intent count, success/fail, gas used.

**Tab 4 — Metrics Comparison:** Side-by-side table comparing no-batching vs batching:
| Metric | No Batching | Batching (size=10) |
|---|---|---|
| Total Tx Count | N | M |
| Avg Gas per Intent | X | Y |
| Throughput (intents/s) | A | B |
| Avg Latency (s) | C | D |
| Failure Rate (%) | E% | F% |

A single bar chart (Recharts or Chart.js) showing gas-per-intent comparison is a bonus.

---

## 9. Benchmark Plan (Simplified)

### Scenario A: Homogeneous Swap (Primary)
- 50 agents each submit 2 USDC→WETH swap intents (100 intents total)
- Run baseline (batchSize=1) and batching (batchSize=10)
- Compare: tx count, gas per intent, throughput, latency, failure rate

### Scenario B: Mixed Workload (Bonus)
- 50 swap intents + 50 transfer intents
- Same comparison as above

### Metrics Recorded
- Total transactions, total gas, avg gas per intent, avg/p95 latency, throughput, failure rate

---

## 10. Off-Chain Data Storage (SQLite)

SQLite database for structured metrics and state tracking:

### 10.1 Table: agents

```sql
CREATE TABLE agents (
    id INTEGER PRIMARY KEY,
    chain_agent_id INTEGER,
    owner TEXT NOT NULL,
    agent_address TEXT NOT NULL UNIQUE,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### 10.2 Table: intents

```sql
CREATE TABLE intents (
    id INTEGER PRIMARY KEY,
    chain_intent_id INTEGER,
    agent_address TEXT NOT NULL,
    intent_type TEXT NOT NULL CHECK (intent_type IN ('SWAP', 'TRANSFER')),
    token_in TEXT,
    token_out TEXT,
    amount_in TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TEXT DEFAULT (datetime('now')),
    executed_at TEXT,
    deadline TEXT,
    tx_hash TEXT
);
```

### 10.3 Table: batches

```sql
CREATE TABLE batches (
    id INTEGER PRIMARY KEY,
    tx_hash TEXT NOT NULL,
    batch_size INTEGER NOT NULL,
    intent_count INTEGER NOT NULL,
    success_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    gas_used INTEGER NOT NULL,
    confirmed_at TEXT DEFAULT (datetime('now'))
);
```

### 10.4 Table: benchmark_runs

```sql
CREATE TABLE benchmark_runs (
    id INTEGER PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('baseline', 'batching')),
    batch_size INTEGER NOT NULL,
    total_intents INTEGER NOT NULL,
    total_txs INTEGER NOT NULL,
    avg_gas_per_intent REAL NOT NULL,
    avg_latency_ms REAL NOT NULL,
    throughput REAL NOT NULL,
    failed_rate REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
```

The relayer and benchmark scripts write directly to SQLite. The frontend reads via a minimal Express endpoint that queries the database.

---

## 11. Security and Correctness (MVP)

| Rule | Implementation |
|---|---|
| Agent authorization | Only registered + active agents can submit |
| Intent immutability | Relayer cannot modify intent params |
| Deadline protection | Expired intents rejected at execution |
| Slippage protection | `minAmountOut` enforced for swaps |
| Cancellation | Owner can cancel pending intents |
| Partial failure | One failed intent does not revert batch |

---

## 12. MVP Scope Summary

### Required (must deliver)
1. AgentRegistry + IntentManager + BatchExecutor contracts
2. MockERC20 (USDC, WETH) + MockSwapRouter (x*y=k AMM)
3. Two intent types: SWAP + TRANSFER
4. Off-chain relayer script with batching
5. Simple agent script (2 rules)
6. Debug/demo frontend with agent/intent/batch views + metrics comparison
7. SQLite database for metrics and state persistence
8. Benchmark: baseline vs batching on at least 1 scenario
9. Metrics: throughput, latency, failure rate, gas cost

### Explicitly Excluded from MVP
| Feature | Reason |
|---|---|
| REBALANCE and SCHEDULED_TASK intent types | 2 types sufficient for requirements |
| MockPortfolioVault | Not needed without REBALANCE |
| Full backend REST API | Relayer is a script; frontend reads via minimal Express API |
| React 4-page production dashboard | Simple single-page debug frontend instead |
| 5 benchmark scenarios | 1 primary scenario sufficient |
| Multi-relayer / decentralization | Discussed in report only |
| ERC-4337 implementation | Discussed in report only |

---

## 13. Technology Stack (MVP)

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity, Foundry or Hardhat, OpenZeppelin ERC20 |
| Local Chain | Anvil or Hardhat Network |
| Relayer + Agent Scripts | Node.js, TypeScript, ethers.js v6 |
| Frontend | React + Vite (minimal), or plain HTML + vanilla JS |
| Chart (optional) | Recharts or Chart.js |
| Data Storage | SQLite (via better-sqlite3) |

---

## 14. Repository Structure (MVP)

```text
macro-intent-agent-network/
├── contracts/
│   ├── AgentRegistry.sol
│   ├── IntentManager.sol
│   ├── BatchExecutor.sol
│   ├── MockERC20.sol
│   └── MockSwapRouter.sol
│
├── scripts/
│   ├── deploy.ts           # Deploy all contracts
│   ├── agent.ts            # Rule-based agent engine
│   ├── relayer.ts          # Scan → batch → execute loop
│   ├── runBaseline.ts      # Benchmark: batchSize=1
│   ├── runBatching.ts      # Benchmark: batchSize=10
│   └── seedIntents.ts      # Generate test intents
│
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Agents.tsx
│       │   ├── Intents.tsx
│       │   ├── Batches.tsx
│       │   └── Metrics.tsx
│       └── main.tsx
│
├── data/
│   └── metrics.db          # SQLite database (gitignored)
│
├── test/
│   ├── AgentRegistry.test.ts
│   ├── IntentManager.test.ts
│   └── BatchExecutor.test.ts
│
└── report/
    ├── architecture.md
    ├── benchmark-results.md
    └── tradeoff-analysis.md
```

---

## 15. Testing Plan (MVP)

| Area | Tests |
|---|---|
| AgentRegistry | Register, deactivate, permission check |
| IntentManager | Submit SWAP, submit TRANSFER, reject inactive agent, cancel |
| BatchExecutor | Execute valid batch, expired intent fails, partial failure |

Integration test: deploy → mint → register agent → submit intents → relayer batch → verify statuses.

---

## 16. Demo Script

```
1. Deploy contracts locally (Anvil / Hardhat node)
2. Mint USDC and WETH to test accounts
3. Register 5 agents
4. Run agent.ts to submit 50 SWAP intents
5. Run runBaseline.ts → record metrics
6. Reset state
7. Run agent.ts again to submit 50 SWAP intents
8. Run relayer.ts with maxBatchSize=10 → record metrics
9. Open frontend → show before/after comparison table
10. Explain trade-offs
```

---

## 17. Final Deliverables

| Deliverable | Content |
|---|---|
| GitHub Repository | Contracts, scripts, frontend, tests |
| Final Report | Architecture, benchmark results, trade-off analysis |
| Demo Video | Registration → intent submission → batching → metrics comparison |
| Dashboard Screenshots | Agent list, intent pool, batch history, metrics comparison |

---

## 18. Chinese Summary

本项目是面向链上自主 Agent 的 intent 执行网络 MVP。Agent 注册后在系统中提交 SWAP 或 TRANSFER intent。链下 relayer 脚本异步扫描 pending intents，将相容 intent 合并为 batch，再调用 BatchExecutor 链上批量执行。系统通过简单前端展示 batching 前后的 throughput、latency、failure rate 和 gas cost 对比。

项目重点在于批量执行基础设施本身，而非交易策略。
