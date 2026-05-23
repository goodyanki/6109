# TDD Test Specification — Macro-Intent Agent Execution Network (MVP)

**Version:** v0.1-TDD
**Principle:** Every test case below MUST fail (RED) before its corresponding feature is implemented. Tests pass (GREEN) only after the feature is correctly built.

---

## 1. Smart Contract: AgentRegistry

### 1.1 Agent Registration

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| AR-001 | `registerAgent` with valid address and permission mask | Should emit `AgentRegistered(agentId=1, owner=msg.sender, agentAddress, allowedIntentMask)`. AgentId starts at 1 and auto-increments. |
| AR-002 | `registerAgent` called twice with same agent address | Second call MUST revert with `AgentAlreadyRegistered`. |
| AR-003 | `registerAgent` with `address(0)` | MUST revert with `InvalidAgentAddress`. |
| AR-004 | `registerAgent` with `allowedIntentMask = 0` | MUST revert with `InvalidPermissionMask` — every agent must have at least one intent type permission. |
| AR-005 | `registerAgent` from an address, then call `registerAgent` again from a different address specifying the same agent address | MUST revert — only the original owner (or the agent address itself) can register that address. |

### 1.2 Agent Status Management

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| AR-006 | `setAgentStatus(agentId, false)` called by owner | Agent.active should become `false`. Emits `AgentStatusChanged(agentId, false)`. |
| AR-007 | `setAgentStatus(agentId, true)` called by owner on an inactive agent | Agent.active should become `true`. Emits `AgentStatusChanged(agentId, true)`. |
| AR-008 | `setAgentStatus` called by non-owner | MUST revert with `OnlyAgentOwner`. |
| AR-009 | `setAgentStatus` for non-existent `agentId` | MUST revert with `AgentNotFound`. |
| AR-010 | `setAgentStatus(agentId, true)` when agent is already active | MUST revert with `StatusUnchanged`. |

### 1.3 Permission / Authorization Checks

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| AR-011 | `canSubmitIntent(agentAddress, SWAP)` for an agent registered with SWAP permission | Returns `true`. |
| AR-012 | `canSubmitIntent(agentAddress, TRANSFER)` for an agent registered with SWAP-only permission | Returns `false`. |
| AR-013 | `canSubmitIntent(agentAddress, SWAP)` for an inactive agent | Returns `false`. |
| AR-014 | `canSubmitIntent(agentAddress, SWAP)` for an unregistered address | Returns `false`. |
| AR-015 | `isRegisteredAgent` for a registered + active agent | Returns `true`. |
| AR-016 | `isRegisteredAgent` for a registered + inactive agent | Returns `true` (it IS registered, just inactive). |
| AR-017 | `isRegisteredAgent` for an unregistered address | Returns `false`. |

---

## 2. Smart Contract: IntentManager

### 2.1 Submit Transfer Intent

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| IM-001 | Registered agent submits valid TRANSFER intent | Emits `IntentSubmitted(id, agent, TRANSFER, ...)`. Returns `intentId = 1`. Intent.status = `PENDING`. All fields match submitted values. |
| IM-002 | Submit TRANSFER with `amount = 0` | MUST revert with `InvalidAmount`. |
| IM-003 | Submit TRANSFER with `token == address(0)` | MUST revert with `InvalidToken`. |
| IM-004 | Submit TRANSFER with `recipient == address(0)` | MUST revert with `InvalidRecipient`. |
| IM-005 | Submit TRANSFER with `deadline <= block.timestamp` | MUST revert with `InvalidDeadline` — deadline must be in the future. |
| IM-006 | Submit TRANSFER with `executeAfter > deadline` | MUST revert with `InvalidTimeWindow` — executeAfter cannot exceed deadline. |
| IM-007 | Unregistered agent submits TRANSFER | MUST revert with `OnlyRegisteredAgent`. |
| IM-008 | Registered but INACTIVE agent submits TRANSFER | MUST revert with `AgentNotActive`. |
| IM-009 | Agent with SWAP-only permission submits TRANSFER | MUST revert with `IntentTypeNotAllowed`. |

### 2.2 Submit Swap Intent

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| IM-010 | Registered agent submits valid SWAP intent | Emits `IntentSubmitted(id, agent, SWAP, ...)`. All fields match. |
| IM-011 | Submit SWAP with `amountIn = 0` | MUST revert with `InvalidAmount`. |
| IM-012 | Submit SWAP with `tokenIn == tokenOut` | MUST revert with `IdenticalTokens` — cannot swap same token. |
| IM-013 | Submit SWAP with `minAmountOut = 0` | MUST revert with `InvalidMinAmountOut`. |
| IM-014 | Submit SWAP with `tokenIn == address(0)` or `tokenOut == address(0)` | MUST revert with `InvalidToken`. |
| IM-015 | Agent with TRANSFER-only permission submits SWAP | MUST revert with `IntentTypeNotAllowed`. |
| IM-016 | Submit SWAP with `maxGasPrice = 0` | Should be allowed — `maxGasPrice = 0` means no gas price ceiling (unlimited). |
| IM-017 | Submit intent where `executeAfter` is 1 hour in the future | Intent should be accepted. `executeAfter` timestamp is stored correctly. |

### 2.3 Intent Cancellation

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| IM-018 | Owner cancels their own PENDING intent | Emits `IntentCancelled(intentId)`. Intent.status becomes `CANCELLED`. |
| IM-019 | Non-owner tries to cancel someone else's intent | MUST revert with `OnlyIntentOwnerOrAgent`. |
| IM-020 | Agent that submitted the intent cancels it | Should succeed — agent is authorized. |
| IM-021 | Cancel an intent that is already EXECUTED | MUST revert with `IntentNotCancellable` — only PENDING intents can be cancelled. |
| IM-022 | Cancel an intent that is already FAILED | MUST revert with `IntentNotCancellable`. |
| IM-023 | Cancel an intent that is already CANCELLED | MUST revert with `IntentNotCancellable`. |
| IM-024 | Cancel non-existent intentId | MUST revert with `IntentNotFound`. |

### 2.4 Intent Status Lifecycle

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| IM-025 | Intent starts in PENDING status | After submission, `getIntent(id).status == PENDING`. |
| IM-026 | Intent transitions: PENDING → BATCHED → EXECUTED | BATCHED is set by BatchExecutor when included in a batch. EXECUTED is set on successful execution. Only the BatchExecutor contract can change these statuses. |
| IM-027 | Intent transitions: PENDING → FAILED | Only BatchExecutor can mark FAILED. |
| IM-028 | Intent transitions: PENDING → EXPIRED | Only BatchExecutor can mark EXPIRED (when deadline passed). |
| IM-029 | Direct status change by non-BatchExecutor address | MUST revert with `OnlyBatchExecutor` for any status change other than CANCELLED. |

### 2.5 Query Functions

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| IM-030 | `getPendingIntentIds(0, 10)` with 15 pending intents | Returns array of length 10 (the limit). |
| IM-031 | `getPendingIntentIds(10, 10)` with 15 pending intents | Returns array of length 5 (remaining). |
| IM-032 | `getPendingIntentIds(0, 10)` when no pending intents exist | Returns empty array `[]`. |
| IM-033 | `getIntent(nonExistentId)` | MUST revert with `IntentNotFound`. |
| IM-034 | `getIntent` returns all struct fields correctly | Verify: id, agent, owner, intentType, tokenIn, tokenOut, recipient, amountIn, minAmountOut, executeAfter, deadline, maxGasPrice, createdAt, status. |

---

## 3. Smart Contract: BatchExecutor

### 3.1 Core Batch Execution

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-001 | Execute batch of 5 valid PENDING SWAP intents | All 5 succeed. Emits `BatchExecuted(txHash, 5, 5, 0, gasUsed)`. Each intent emits `IntentExecuted`. All intent statuses = `EXECUTED`. |
| BE-002 | Execute batch of 1 valid PENDING TRANSFER intent | 1 success. Transfer tokens from agent (or contract) to recipient. |
| BE-003 | Execute batch with empty `intentIds` array | MUST revert with `EmptyBatch`. |
| BE-004 | Execute batch with `intentIds.length > maxBatchSize` | MUST revert with `BatchTooLarge`. Default `maxBatchSize = 10`. |
| BE-005 | Execute batch with duplicate `intentIds` | MUST revert with `DuplicateIntent`. |

### 3.2 Batch Authorization

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-006 | Non-relayer address calls `executeBatch` | MUST revert with `OnlyRelayer`. The relayer address must be set (constructor param or setter). |
| BE-007 | Relayer address can be updated by contract owner | `setRelayer(newAddress)` succeeds for owner. |
| BE-008 | Non-owner tries to update relayer address | MUST revert with `Ownable: caller is not the owner`. |

### 3.3 Intent Validation Within Batch

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-009 | Batch includes an intent with `status != PENDING` (already EXECUTED) | That specific intent FAILS, others succeed. `failedCount++`, `successCount--`. |
| BE-010 | Batch includes an intent from an inactive agent | That specific intent FAILS. |
| BE-011 | Batch includes an intent where `block.timestamp < executeAfter` | That specific intent FAILS (not yet executable). |
| BE-012 | Batch includes an intent where `block.timestamp > deadline` | That specific intent marked EXPIRED, counted as failed. |
| BE-013 | Batch includes an intent where `tx.gasprice > maxGasPrice` (and maxGasPrice > 0) | That specific intent FAILS — gas price exceeds agent's limit. |

### 3.4 Partial Failure (Core Feature)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-014 | Batch of 10: 7 valid, 2 expired, 1 inactive agent | Returns `(successCount=7, failedCount=3)`. Batch tx does NOT revert. |
| BE-015 | Batch of 10: all 10 are expired | Returns `(0, 10)`. Batch tx does NOT revert. |
| BE-016 | Batch of 10: 1 reverting swap (slippage) + 9 valid | The 1 failing swap fails individually. 9 succeed. Batch does not revert. |

### 3.5 Swap Execution (via MockSwapRouter)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-017 | SWAP intent: tokenIn approved for BatchExecutor, MockSwapRouter returns expected output >= minAmountOut | SWAP succeeds. Tokens transferred correctly. |
| BE-018 | SWAP intent: MockSwapRouter returns output < minAmountOut (slippage) | Intent FAILS. `minAmountOut` constraint enforced. |
| BE-019 | SWAP intent: tokenIn not approved for BatchExecutor | Intent FAILS — insufficient allowance. |

### 3.6 Transfer Execution

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-020 | TRANSFER intent: sufficient token balance and allowance | Transfer succeeds. Recipient receives `amount` tokens. |
| BE-021 | TRANSFER intent: insufficient token balance | Intent FAILS. Transfer does not occur. |

### 3.7 Events & Gas Tracking

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BE-022 | `BatchExecuted` event contains correct fields | `txHash`, `batchSize`, `successCount`, `failedCount`, `gasUsed` are all accurate. |
| BE-023 | Each successfully executed intent emits `IntentExecuted(intentId, txHash)` | Event emitted per intent. |
| BE-024 | A failed intent does NOT emit `IntentExecuted` | Only `IntentStatusChanged(intentId, FAILED/EXPIRED)`. |

---

## 4. Smart Contract: MockERC20

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| MC-001 | `mint(address, amount)` called by owner | Recipient balance increases by `amount`. Total supply increases. Emits `Transfer(address(0), recipient, amount)`. |
| MC-002 | `mint` called by non-owner | MUST revert with `Ownable: caller is not the owner`. |
| MC-003 | `transfer` with sufficient balance | Transfers tokens. Emits `Transfer`. |
| MC-004 | `transfer` with insufficient balance | MUST revert (ERC20 standard). |
| MC-005 | `approve` + `transferFrom` | Allowance deducted correctly. Transfer succeeds. |
| MC-006 | `transferFrom` without sufficient allowance | MUST revert with `ERC20InsufficientAllowance`. |
| MC-007 | Token metadata (name, symbol, decimals) | Returns values set at construction (e.g., "Mock USDC", "USDC", 18). |

---

## 5. Smart Contract: MockSwapRouter (x*y=k AMM)

### 5.1 Liquidity

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| MR-001 | `addLiquidity(token, amount)` by owner | Reserves increase by `amount`. Pool initialized with k = reserve0 * reserve1. |
| MR-002 | `addLiquidity` by non-owner | MUST revert with `Ownable: caller is not the owner`. |

### 5.2 Swap (Constant Product)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| MR-003 | `swap(tokenIn, tokenOut, amountIn)` with standard input | Returns `amountOut = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997)`. Reserves updated. |
| MR-004 | `swap` with `tokenIn` not supported by pool | MUST revert with `UnsupportedToken`. |
| MR-005 | `swap` with `tokenOut` not supported by pool | MUST revert with `UnsupportedToken`. |
| MR-006 | `swap` with `tokenIn == tokenOut` | MUST revert with `IdenticalTokens`. |
| MR-007 | `swap` with `amountIn = 0` | MUST revert with `InvalidAmount`. |
| MR-008 | `swap` when pool has zero reserves (no liquidity added) | MUST revert with `InsufficientLiquidity`. |
| MR-009 | `swap` of very large amount relative to pool (e.g., 90% of reserve) | Should succeed but with significant slippage. Verify constant product invariant: `k_before >= k_after` (k increases slightly due to fee). |
| MR-010 | `swap` of a tiny amount (e.g., 1 wei) | Should succeed. `amountOut` computed correctly per formula. |

### 5.3 Query

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| MR-011 | `getAmountOut(tokenIn, tokenOut, amountIn)` | Returns same value as `swap` would produce, but does NOT modify state (reserves unchanged after call). |
| MR-012 | `getAmountOut` with unsupported token pair | MUST revert with `UnsupportedToken`. |

---

## 6. Off-Chain: Agent Script (agent.ts)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| AG-001 | Agent starts and connects to local chain (Anvil/Hardhat) | Script boots without crash. Wallet has ETH for gas. Contracts are deployed and addresses loaded. |
| AG-002 | Rule 1 — DCA: Every 60 seconds, a SWAP intent is submitted | After 120 seconds, at least 2 SWAP intents exist in `IntentManager`. Each is 100 USDC → WETH. |
| AG-003 | Rule 2 — Price Trigger: When mock ETH price drops below 2800 USDC | A SWAP intent of 200 USDC → WETH is submitted within one polling cycle (< 30s of price change). |
| AG-004 | Agent does NOT submit intent when price is above trigger | No SWAP intent submitted by Rule 2 when ETH > 2800 USDC. |
| AG-005 | Agent reads mock price from local config/JSON file | Price data source is configurable. Agent does not hardcode price. |
| AG-006 | Agent validates on-chain registration status before submitting | If agent is not registered, script logs error and exits gracefully (no revert on-chain). |
| AG-007 | Agent respects `maxGasPrice` from config | Submitted intents carry the configured `maxGasPrice`. |
| AG-008 | Agent handles transaction failure gracefully | If tx reverts (e.g., out of gas), agent logs error and continues polling (does not crash). |
| AG-009 | Agent stops on SIGINT / SIGTERM | Clean shutdown with log message, no dangling promises. |

---

## 7. Off-Chain: Relayer Script (relayer.ts)

### 7.1 Core Loop

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| RL-001 | Relayer starts, connects to chain, fetches pending intents | Logs: "Relayer started. Found N pending intents." |
| RL-002 | Relayer processes intents in configurable `pollIntervalSeconds` | Default 10s. Two consecutive polls occur ~10s apart. |
| RL-003 | Relayer skips execution when 0 pending intents found | Logs: "No pending intents." No batch tx submitted. |

### 7.2 Filtering

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| RL-004 | Filter out intents where `block.timestamp < executeAfter` | Intent excluded from current batch. Relayer does not attempt execution. |
| RL-005 | Filter out intents where `block.timestamp > deadline` | Intent excluded from batch. Should be marked EXPIRED (via BatchExecutor). |
| RL-006 | Filter out intents from inactive agents | Intent excluded from batch. |
| RL-007 | Do NOT filter out intents from active agents with correct permissions | Intent included in batch. |
| RL-008 | Filter by `maxGasPrice`: if current gas price > intent.maxGasPrice (and maxGasPrice > 0) | Intent excluded from batch. |

### 7.3 Batching

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| RL-009 | 25 pending SWAP intents of same token pair, maxBatchSize=10 | Relayer creates 3 batches: sizes 10, 10, 5. |
| RL-010 | Mixed SWAP and TRANSFER intents | SWAP and TRANSFER grouped into separate batches (different execution logic). |
| RL-011 | SWAP intents with different token pairs (USDC→WETH vs WETH→USDC) | Grouped into separate batches per token pair. |
| RL-012 | Configurable `maxBatchSize` | When `maxBatchSize = 5`, no batch exceeds 5 intents. |
| RL-013 | Relayer leaves a small gap between batch submissions | Two consecutive `executeBatch` calls are not in the same block (unless intentional). At minimum, one confirmation before next submission. |

### 7.4 Metrics Recording (SQLite)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| RL-014 | After each batch execution, a row is inserted into `batches` table | Row contains `tx_hash`, `batch_size`, `intent_count`, `success_count`, `failed_count`, `gas_used`, `confirmed_at`. |
| RL-015 | After each intent status change, the `intents` table is updated | `status`, `executed_at`, `tx_hash` fields updated for each processed intent. |
| RL-016 | Latency is calculated as `(executed_at - created_at)` | Stored in `avg_latency_ms` after benchmark run. |
| RL-017 | Gas per intent is calculated as `total_gas / intent_count` | Stored per batch and aggregated for benchmarks. |

---

## 8. Off-Chain: Deploy Script (deploy.ts)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| DP-001 | Deploy all 5 contracts in correct order | 1. MockERC20 (USDC), 2. MockERC20 (WETH), 3. MockSwapRouter, 4. AgentRegistry, 5. IntentManager, 6. BatchExecutor. Dependencies resolved: MockSwapRouter needs token addresses; IntentManager needs AgentRegistry address; BatchExecutor needs IntentManager + MockSwapRouter addresses. |
| DP-002 | Post-deploy: add liquidity to MockSwapRouter | Pool initialized with reserves (e.g., 300k USDC + 100 WETH). |
| DP-003 | Post-deploy: set relayer address on BatchExecutor | Relayer address set to deployer or configured address. |
| DP-004 | Post-deploy: mint test tokens to configured accounts | Each test account receives pre-configured amount of USDC and WETH. |
| DP-005 | Deploy script writes contract addresses to a JSON file | Output file `deployed_addresses.json` contains all contract addresses and ABIs. |
| DP-006 | Deploy with missing env vars / config | Script exits with clear error message (e.g., "Missing PRIVATE_KEY in .env"). |

---

## 9. Off-Chain: Benchmark Scripts

### 9.1 Seed Intents (seedIntents.ts)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| SI-001 | Seed 100 SWAP intents from 50 agents (2 each) | `IntentManager` has 100 PENDING SWAP intents. Each agent submitted exactly 2. |
| SI-002 | Seed mixed intents: 50 SWAP + 50 TRANSFER | 50 of each type in PENDING state. |
| SI-003 | Seed script respects agent registration | Only registered agents submit. Each agent has correct permission mask. |
| SI-004 | Seed intents with staggered `executeAfter` timestamps | Some intents executable immediately, some delayed. Simulates realistic arrival. |

### 9.2 Baseline Benchmark (runBaseline.ts)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BL-001 | Run baseline: batchSize=1, 100 intents | 100 separate transactions submitted. `benchmark_runs` row: mode='baseline', total_txs=100. |
| BL-002 | Baseline records: total_txs, total_gas, avg_gas_per_intent | All metrics computed and stored. |
| BL-003 | Baseline records: avg_latency_ms, p95_latency_ms | Latency distribution captured. |
| BL-004 | Baseline records: throughput (intents/s) | Elapsed time measured from first tx to last confirmation. |
| BL-005 | Baseline records: failed_rate | Count of failed/expired intents divided by total. |
| BL-006 | Baseline benchmark is deterministic with same input | Running baseline twice with identical state produces comparable (within ~5%) results. |

### 9.3 Batching Benchmark (runBatching.ts)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| BX-001 | Run batching: batchSize=10, 100 intents | ~10 transactions submitted (100 / 10). `benchmark_runs` row: mode='batching', total_txs ≈ 10. |
| BX-002 | Batching records same metrics as baseline | All metrics computed: gas, latency, throughput, failure rate. |
| BX-003 | Batching throughput > baseline throughput | Throughput (intents/s) should be higher under batching. |
| BX-004 | Batching avg_gas_per_intent < baseline avg_gas_per_intent | Gas savings demonstrated via batching amortization. |
| BX-005 | Batching total_txs < baseline total_txs | Fewer on-chain transactions for same number of intents. |

---

## 10. SQLite Database

### 10.1 Schema

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| DB-001 | `agents` table has correct schema | Columns: id (PK AUTOINCREMENT), chain_agent_id (INTEGER), owner (TEXT NOT NULL), agent_address (TEXT NOT NULL UNIQUE), active (INTEGER DEFAULT 1), created_at (TEXT). |
| DB-002 | `intents` table has correct schema | Columns match spec §10.2. CHECK constraint on `intent_type` enforces SWAP/TRANSFER only. |
| DB-003 | `batches` table has correct schema | Columns match spec §10.3. |
| DB-004 | `benchmark_runs` table has correct schema | Columns match spec §10.4. CHECK constraint on `mode` enforces baseline/batching only. |
| DB-005 | Database file created at `data/metrics.db` | File exists after first write operation. |

### 10.2 Data Integrity

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| DB-006 | Insert intent with invalid `intent_type` (e.g., "REBALANCE") | SQLite CHECK constraint rejects the INSERT. |
| DB-007 | Insert benchmark with invalid `mode` | SQLite CHECK constraint rejects the INSERT. |
| DB-008 | `agent_address` must be unique | Inserting duplicate agent_address fails with UNIQUE constraint violation. |
| DB-009 | Delete a benchmark_run by id | Row deleted. Does not cascade-delete related intents/batches (no FK cascade). |

---

## 11. Express API (Minimal Backend)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| API-001 | `GET /api/agents` | Returns JSON array of all agents from SQLite `agents` table. |
| API-002 | `GET /api/intents?status=PENDING&limit=50` | Returns filtered, limited JSON array of intents. |
| API-003 | `GET /api/intents?status=ALL` | Returns all intents (default limit 100). |
| API-004 | `GET /api/batches` | Returns JSON array of all batches, most recent first. |
| API-005 | `GET /api/benchmarks` | Returns JSON array of benchmark runs for metrics comparison. |
| API-006 | `GET /api/metrics/comparison` | Returns aggregated metrics: `{ baseline: {...}, batching: {...} }` for side-by-side display. |
| API-007 | API responds within 500ms for <1000 records | Response time acceptable for frontend polling. |
| API-008 | Invalid endpoint returns `{ error: "Not found" }` with 404 | Graceful error handling. |
| API-009 | Database error returns `{ error: "Internal server error" }` with 500 | Graceful error handling, no crash. |

---

## 12. Frontend (React + Vite)

### 12.1 Agents Tab

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| FE-001 | Agents tab loads and displays table | Table columns: ID, Address (truncated), Owner (truncated), Active (badge), Intent Count. |
| FE-002 | Active agent shows green badge, inactive shows red badge | Visual distinction between active/inactive agents. |
| FE-003 | Agents table updates on page refresh / polling | New agents appear after registration without page reload (poll every 10s). |
| FE-004 | Empty state: "No agents registered" when table is empty | Not a crash or white screen. |

### 12.2 Intents Tab

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| FE-005 | Intents tab loads and displays table | Columns: ID, Type, Agent, Token(s), Amount, Status, Created At. |
| FE-006 | Status badges are color-coded | PENDING=yellow, BATCHED=blue, EXECUTED=green, FAILED=red, EXPIRED=gray, CANCELLED=dark-gray. |
| FE-007 | Filter by status dropdown works | Selecting "PENDING" shows only pending intents. "ALL" shows everything. |
| FE-008 | Intent detail row expands on click | Shows all fields: tokenIn, tokenOut, minAmountOut, executeAfter, deadline, maxGasPrice. |

### 12.3 Batches Tab

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| FE-009 | Batches tab loads and displays table | Columns: Tx Hash (truncated + link), Batch Size, Success, Failed, Gas Used, Confirmed At. |
| FE-010 | Tx hash is a clickable link to block explorer (if configured) | Opens in new tab. |
| FE-011 | Success rate bar per batch | Visual bar: green (success) + red (failed) proportion. |

### 12.4 Metrics Tab (Comparison)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| FE-012 | Metrics tab shows side-by-side comparison table | Rows: Total Tx Count, Avg Gas per Intent, Throughput, Avg Latency, Failure Rate. Columns: No Batching, Batching (size=10). |
| FE-013 | Gas-per-intent bar chart renders (Recharts/Chart.js) | Two bars side by side: No Batching vs Batching. Batching bar is visibly lower. |
| FE-014 | Metrics data sourced from `/api/metrics/comparison` | Frontend fetches from API, not hardcoded. |
| FE-015 | Empty state: "Run benchmarks to see comparison" when no data | Before benchmarks are run. |

### 12.5 General Frontend

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| FE-016 | Tab navigation works (Agents / Intents / Batches / Metrics) | Clicking tab switches content. Active tab is highlighted. |
| FE-017 | Frontend starts with `npm run dev` | Vite dev server starts on localhost. Page loads without console errors. |
| FE-018 | Frontend handles API unavailable gracefully | Shows "Connecting to server..." or error message, not a white screen. |
| FE-019 | Responsive layout | Tables are scrollable horizontally on narrow viewports (< 768px). |
| FE-020 | Page title and header display "Macro-Intent Agent Network" | Branding present. |

---

## 13. Integration Tests (End-to-End)

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| IT-001 | Full flow: Deploy → Register 5 agents → Submit 50 SWAP intents → Relayer executes with batchSize=10 → Verify all 50 EXECUTED | All 50 intents reach EXECUTED status. BatchExecutor emitted ~5 BatchExecuted events. Tokens transferred. |
| IT-002 | Full flow with partial failure: 10 intents, 2 expired | 8 EXECUTED, 2 EXPIRED. Batch does not revert. Metrics reflect 20% failure rate. |
| IT-003 | Full flow with cancellation: Submit 10 intents, cancel 3, relayer runs | 7 EXECUTED, 3 CANCELLED (untouched by relayer). |
| IT-004 | Benchmark comparison flow: Seed 100 → Baseline → Reset → Seed 100 → Batching → Verify metrics in DB → Verify frontend displays comparison | Complete end-to-end benchmark pipeline works. |
| IT-005 | Agent script + Relayer running concurrently | Agent submits intents while relayer is picking them up. No race condition or duplicate execution. |
| IT-006 | Multi-agent scenario: 50 different agent addresses each submit 2 intents | All 100 intents attributed to correct agents. Owner field matches agent registration. |

---

## 14. Security & Edge Cases

| ID | Test Case | Expected Behavior (RED → Wait for Implementation) |
|---|---|---|
| SE-001 | Re-entrancy guard on BatchExecutor | Calling `executeBatch` re-entrantly from within a swap callback MUST fail. (Use OpenZeppelin ReentrancyGuard.) |
| SE-002 | Intent immutability: Relayer cannot modify intent amount | `executeBatch` MUST read params directly from IntentManager storage. No calldata override of amount/recipient. |
| SE-003 | Front-running protection: minAmountOut enforces slippage tolerance | Malicious relayer cannot execute swap at worse rate than agent specified. |
| SE-004 | Integer overflow in constant-product formula | `reserveOut * amountIn * 997` uses SafeMath / Solidity 0.8.x built-in overflow check. No overflow possible. |
| SE-005 | Zero-address token in MockSwapRouter | Cannot add liquidity with `address(0)` as token. |
| SE-006 | Large batch gas limit | Batch of 10 complex swaps does not exceed block gas limit on Anvil/Hardhat. (Test with Hardhat `reportGas`.) |
| SE-007 | Concurrent relayer instances | If two relayers run simultaneously, second `executeBatch` should skip already-processed intents (status != PENDING). No double-execution. |
| SE-008 | Agent submits intent with extremely far-future deadline | Accepted. `deadline = block.timestamp + 365 days` is valid. |

---

## 15. Test Execution Order (TDD Workflow)

Each phase: **Write tests → Run (all RED) → Implement → Run (all GREEN) → Refactor**

| Phase | Tests | Depends On |
|---|---|---|
| P1 | MC-001 → MC-007 (MockERC20) | Nothing |
| P2 | MR-001 → MR-012 (MockSwapRouter) | P1 |
| P3 | AR-001 → AR-017 (AgentRegistry) | Nothing |
| P4 | IM-001 → IM-034 (IntentManager) | P3 |
| P5 | BE-001 → BE-024 (BatchExecutor) | P1, P2, P4 |
| P6 | SE-001 → SE-008 (Security) | P5 |
| P7 | DP-001 → DP-006 (Deploy Script) | P5 |
| P8 | DB-001 → DB-009 (SQLite Schema) | Nothing |
| P9 | AG-001 → AG-009 (Agent Script) | P7 |
| P10 | RL-001 → RL-017 (Relayer Script) | P7, P8 |
| P11 | SI-001 → SI-004, BL-001 → BX-005 (Benchmarks) | P9, P10 |
| P12 | API-001 → API-009 (Express API) | P8 |
| P13 | FE-001 → FE-020 (Frontend) | P12 |
| P14 | IT-001 → IT-006 (Integration Tests) | ALL |

---

**Total Test Cases: 132**

- Smart Contracts: 66 tests
- Off-Chain Scripts: 36 tests
- Database: 9 tests
- API: 9 tests
- Frontend: 20 tests (manual verification for UI, automated for API integration)
- Integration: 6 tests
- Security: 8 tests

---

*All test cases are designed to FAIL (RED) in a fresh repository with no implementation. Implementation must satisfy each test exactly as specified.*
