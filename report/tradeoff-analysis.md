# Trade-off Analysis

This document discusses the central trade-offs of the Macro-Intent Agent Execution Network MVP, following the SC6019 Option 1 hint: *"Strong projects should discuss trade-offs between decentralization, efficiency, and trust assumptions."*

---

## 1. Decentralization vs. Efficiency

The biggest single source of throughput in this system is the **single trusted relayer** that batches and submits intents. This is also its biggest decentralization weakness.

| Model | Throughput | Censorship resistance | Failure mode |
|---|---|---|---|
| Single relayer (this MVP) | Highest — no coordination overhead | None — operator can drop / delay / front-run any intent | Single point of failure / kill-switch |
| Fixed relayer set | Slightly lower — needs leader election | Better — collusion required | Cartel risk |
| Permissionless bundlers (ERC-4337 style) | Variable — depends on mempool | Best — anyone can bundle | Higher gas (competition), MEV |

**Mitigations even in the MVP model:**
- `minAmountOut` and `deadline` cap the worst case the relayer can inflict on a single intent.
- Intent storage is on-chain, so any independent observer can detect dropped intents.
- The relayer cannot mutate `amountIn` / `recipient` because `BatchExecutor` reads from storage, not calldata.

**Conclusion:** the MVP makes the conscious choice to optimize for benchmarkable throughput. A production system would replace this with a permissionless bundler set and rely on cryptoeconomic incentives + slashing to keep operators honest.

---

## 2. Trust Assumptions

There are three trust boundaries:

1. **Agent ↔ User** — the agent's owner authorizes a permission mask. A compromised agent can submit any intent allowed by its mask up to its on-chain token allowances. *Mitigation:* per-intent `maxGasPrice`, `executeAfter`, `deadline`, and the ability to deactivate the agent or cancel the intent.

2. **Agent ↔ Relayer** — the agent must trust that the relayer will eventually batch its intent. There is no on-chain SLA. *Mitigation:* in production, an inclusion guarantee market or pre-committed bundler bond would be needed; in the MVP, a manual `executeBatch` fallback is always available.

3. **Relayer ↔ Settlement (AMM / token contracts)** — the relayer trusts the settlement layer to honor `minAmountOut`. The mock AMM formula is deterministic, but a real DEX may have malicious tokens, fee-on-transfer behavior, or rebasing tokens. *Mitigation:* whitelist tokens at the `IntentManager` level (not implemented in MVP).

---

## 3. Batch Size Trade-off

`maxBatchSize` is the single most influential parameter. Empirically:

| Batch size | Per-intent gas | Latency-to-inclusion | Failure blast radius |
|---|---|---|---|
| 1 (baseline) | High — every intent pays full base + intrinsic overhead | Low — submitted immediately | One intent affects only itself |
| 10 (this MVP default) | ~39% lower than baseline (measured in Scenario A) | Up to one polling interval (default 10 s) | A reverting swap inside the batch fails individually thanks to partial-failure isolation |
| 50+ (hypothetical) | Diminishing returns; bounded by block gas limit | Higher — wait for enough intents to fill a batch | More wasted compute if many intents revert |

There is no universally optimal batch size. The right default depends on:
- Base fee dynamics (high fee → larger batches amortize more).
- Workload homogeneity (homogeneous swaps batch better than mixed types).
- Block gas limit on the target chain.

The architecture supports per-tokenpair grouping precisely so different markets can have different optimal sizes.

---

## 4. Synchronous vs. Asynchronous Execution

Intents are inherently **asynchronous**: the user expresses *what* they want, not *when*. This is a feature for use cases like DCA or rebalancing, but a problem for arbitrage or liquidations where freshness dominates.

| Workload | Async good? | Why |
|---|---|---|
| DCA / scheduled transfers | Yes | A 10–60 s delay is invisible to the user |
| Treasury rebalancing | Yes | Aggregating multiple positions into one trade reduces slippage |
| Cross-protocol arbitrage | No | Stale intents miss the opportunity; an inclusion-time guarantee is needed |
| Liquidations | No | Ordering and freshness are critical; would need a priority lane |

A production system should support a **priority lane** (single-intent fast path) alongside the batched lane.

---

## 5. Mock AMM vs. Real DEX

The MVP uses a single-pool constant-product AMM. Compared to real DEX integration:

- **+** Deterministic, easy to reason about, sufficient to make `minAmountOut` meaningful.
- **−** No multi-venue routing → suboptimal execution for the user.
- **−** No protection against sandwich attacks; in production, batched execution within a single block partially helps because internal ordering is deterministic.
- **−** No price oracle: the price is whatever the pool says, so price-triggered rules in the agent are based on a *separate* mock price file rather than the AMM state. This is a deliberate simplification.

---

## 6. Simulated AI Layer

The course description explicitly permits `simulate the AI or off-chain intelligence layer`. We use two hard-coded rules. This is a trade-off:

- **+** Reproducible benchmarks. AI nondeterminism would make gas / throughput comparisons noisy.
- **+** Keeps focus on the protocol layer (which is the actual deliverable).
- **−** Doesn't exercise prompt-injection / hallucination failure modes that a real LLM-driven agent would face.

The architecture's clean separation (`agent.ts` only calls `submitSwapIntent` / `submitTransferIntent`) means the rule engine can be replaced with an LLM call without any contract change.

---

## 7. Future Work

| Direction | Why it matters |
|---|---|
| ERC-4337 Paymaster | Let users pay gas in stablecoins; remove the requirement that agents hold ETH |
| Signature aggregation (BLS) | Reduce per-intent calldata cost by ~80% for batches |
| Permissionless bundler set | Replace single relayer; align incentives with reputation / staking |
| Cross-chain intents (Across-style) | Let one intent settle on the cheapest chain |
| ZK validity proof of batch | Optimistic settlement with succinct fraud proofs — reduces L1 verification cost |
| LLM-driven agent | Demonstrate prompt-injection resistance and hallucination guardrails |
| Priority lane | Serve latency-sensitive workloads alongside batched lane |
| Intent whitelisting / token registry | Defend against malicious token contracts at the protocol layer |

---

## 8. Summary

The MVP makes deliberate, scoped trade-offs:

- **Centralized relayer** for benchmarkable throughput → roadmap is permissionless bundlers.
- **Mock AMM** for deterministic swap economics → roadmap is real DEX routing.
- **Rule-based agent** for reproducibility → roadmap is LLM-driven decision making.
- **Two intent types** for clarity → roadmap is REBALANCE / SCHEDULED_TASK.

The architecture is intentionally layered so each of these can be swapped without redesigning the core (`IntentManager` + `BatchExecutor` + permission mask) — which is the part the assignment actually asks us to evaluate.
