# Option 1 课程描述 — 中英对照

> 摘自 SC6019 Project Description.pdf，逐段翻译对照。

---

## 标题 / Title

| English | 中文 |
|---|---|
| Option 1: AI-Powered On-Chain Agent Protocol with Intent Infrastructure | 选项 1：基于意图基础设施的 AI 驱动链上 Agent 协议 |

---

## 项目摘要 / Project Summary

| English | 中文 |
|---|---|
| Design and develop a scalable execution network for AI-powered on-chain agents that can accept user intents, batch requests, and execute them efficiently across multiple transactions or workflows. The project should focus on improving throughput and reducing execution bottlenecks for autonomous agents operating on blockchain systems. | 设计并开发一个面向 AI 驱动链上 Agent 的可扩展执行网络。该网络能够接受用户意图（Intent），对请求进行批量处理，并跨多个交易或工作流高效执行。项目重点在于提升自主 Agent 在区块链系统上运行的吞吐量，减少执行瓶颈。 |

---

## 背景与问题陈述 / Background & Problem Statement

| English | 中文 |
|---|---|
| AI agents are emerging as a new type of blockchain user. Unlike normal users, agents may generate a large number of actions, rebalance positions frequently, and interact with multiple protocols automatically. Traditional blockchain execution is not well suited for this pattern because every intent may compete for blockspace, suffer from latency, and face high gas costs. | AI Agent 正在成为一类新型区块链用户。与普通用户不同，Agent 可能产生大量操作、频繁再平衡仓位、自动与多个协议交互。传统区块链执行模式不适合这种场景：每个意图都需要竞争区块空间，面临高延迟和高 Gas 成本。 |
| This project explores how to build a more scalable infrastructure for on-chain agents by introducing intent batching, asynchronous task handling, and parallelizable execution flows. Students should consider how a blockchain system can support large numbers of agent requests without sacrificing correctness or security. | 本项目探索如何通过引入意图批处理、异步任务处理和可并行化执行流程，为链上 Agent 构建更具可扩展性的基础设施。学生需要考虑区块链系统如何在不牺牲正确性和安全性的前提下，支撑大量 Agent 请求。 |

---

## 功能需求 / Feature Requirements

| English | 中文 |
|---|---|
| Smart contract or protocol layer for registering and managing autonomous agents. | 用于注册和管理自主 Agent 的智能合约或协议层。 |
| Intent submission interface for actions such as swaps, transfers, rebalancing, or repeated scheduled tasks. | 意图提交接口，支持 SWAP、转账、再平衡或重复定时任务等操作。 |
| Batching or aggregation mechanism to combine multiple user or agent intents into fewer on-chain executions. | 批处理或聚合机制，将多个用户/Agent 意图合并为更少的链上交易。 |
| Execution coordinator or relayer design that supports asynchronous processing. | 支持异步处理的执行协调器或 Relayer 设计。 |
| Performance dashboard or report showing throughput, latency, failed execution rate, and gas cost before and after batching. | 性能仪表板或报告，展示批处理前后的吞吐量、延迟、失败执行率和 Gas 成本。 |

---

## 提示与方向 / Hints & Directions

| English | 中文 |
|---|---|
| Explore ERC-4337, intent-centric architecture, and account abstraction. | 探索 ERC-4337、以意图为中心的架构和账户抽象。 |
| Consider simple agent use cases such as treasury rebalancing, DCA execution, arbitrage monitoring, or auto-compounding. | 考虑简单的 Agent 用例，如资金池再平衡、定投（DCA）执行、套利监控或自动复投。 |
| Think about how parallel execution or grouped settlement could improve scalability. | 思考并行执行或分组结算如何提升可扩展性。 |
| Students may simulate the AI or off-chain intelligence layer if full LLM integration is out of scope. | **如果完整 LLM 集成超出范围，学生可以模拟 AI 或链下智能层。** |
| Strong projects should discuss trade-offs between decentralization, efficiency, and trust assumptions. | 优秀项目应讨论去中心化、效率和信任假设之间的权衡。 |

---

## 参考资料 / References

| English | 中文 |
|---|---|
| 1. ERC-4337 Documentation — A strong starting point for account abstraction, UserOperation, bundlers, paymasters, and smart wallet flow. | 1. ERC-4337 文档 — 账户抽象的强力起点，涵盖 UserOperation、Bundler、Paymaster 和智能钱包流程。 |
| 2. CoW Protocol — Intents — Good for understanding what an "intent" looks like in practice. | 2. CoW Protocol — 意图 — 适合理解实践中"意图"的具体形态。 |
| 3. Anoma Docs — Useful for studying intent-centric architecture at a broader systems level. | 3. Anoma 文档 — 适合在更广泛的系统层面研究以意图为中心的架构。 |
| 4. Across Docs — Crosschain Intents / Intent Architecture — Helpful if students want their agents to work across chains or rollups. | 4. Across 文档 — 跨链意图/意图架构 — 适合希望 Agent 跨链或跨 Rollup 工作的场景。 |
| 5. dappOS Intent Documentation — Useful for an easy conceptual model of intent-centric execution networks. | 5. dappOS 意图文档 — 适合快速理解以意图为中心的执行网络概念模型。 |

---

## 从哪里开始 / Where to Start

| English | 中文 |
|---|---|
| 1. ERC-4337 smart wallet flow, 2. one concrete intent format, 3. a very small agent use case such as auto-swap, scheduled transfer, or auto-rebalance. | 1. ERC-4337 智能钱包流程；2. 一种具体的意图格式；3. 一个非常小的 Agent 用例，如自动兑换、定时转账或自动再平衡。 |

---

## 关键解读

关于 **"是否需要接 AI API"** 的问题，课程描述中明确写了：

> *"Students may **simulate** the AI or off-chain intelligence layer if full LLM integration is out of scope."*
>
> **"如果完整 LLM 集成超出范围，学生可以模拟 AI 或链下智能层。"**

这意味着：
- 课程的评估核心是**协议基础设施**（合约、批处理、Relayer、性能对比），而非 AI 模型本身
- AI 层可以用**规则引擎 / 脚本模拟**，不需要真正接入 GPT/Claude 等大模型 API
- 本项目的 Agent 就是两条硬编码规则：DCA 定投（每 60 秒）和价格触发（ETH < $2800），从本地 JSON 文件读取价格数据
- 架构上完全兼容未来替换为真正的 AI 决策——只需修改 `scripts/agent.ts` 中的决策函数即可
