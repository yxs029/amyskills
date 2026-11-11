---
name: token-usage-meter
description: Measure LLM token usage (total/input/output/cache_read/cache_write/reasoning) at session, project, and minimum-loop-unit granularity from Hermes state.db, zero-instrumentation via start/end snapshot deltas. Use when the user asks to count/monitor/audit token consumption, cost of agents or sub-agents, per-article distillation, per-test-case execution, per-requirement-to-checklist loop, build token bill or retrospective for a task/project, or instrument monitoring/review checkpoints in a multi-step or sub-agent workflow.
version: 1.0.0
author: agent
triggers:
  - 统计/监控/审计 token 用量、token 消耗、缓存命中
  - 给子智能体/任务/项目算 token 成本
  - 按"一篇文章提炼/一条用例执行/一个需求转清单体"等最小循环单元计量
  - 埋监控点、复盘点，输出 token 账单/人效比
class: observability
dependencies: python3；只读访问 ~/.hermes/state.db（无需改 Hermes，零侵入）
---

# token-usage-meter

基于 Hermes `state.db` 的 token 用量计量，**不改链路、不改 provider**。

## 数据事实（已实测 2026-09）

- `sessions` 表实时累加：`input_tokens / output_tokens / cache_read_tokens /
  cache_write_tokens / reasoning_tokens / api_call_count / message_count / tool_call_count`。
  **进行中会话（ended_at=NULL）也在更新**，所以可在任意时刻读累计值。
- `messages.token_count` 基本为 NULL——**token 只精确到 session，不到单条消息**。
- 没有逐 API 调用的 usage 明细表；usage 也不藏在 messages 的 JSON 字段里。
- `cache_write_tokens / reasoning_tokens` 在火山方舟 Coding Plan 网关下为 0（网关未回传）。
- `estimated_cost_usd` 为 0 / `cost_status=unknown`：自定义网关没配单价，token 数真实、成本缺。

因此本 skill 用两种粒度：

| 粒度 | 方法 | 精度 |
|---|---|---|
| 会话/项目 | 直接读 sessions 累计 / 汇总埋点账 | **精确**（网关累计值） |
| 最小循环单元（实时） | 单元开始/结束各读一次会话累计，**差分** | **精确**（区间内真实增量） |
| 最小循环单元（事后） | 按 user-turn 切分，用内容字符占比分摊会话总量 | **[估算]**，仅用于历史回溯 |

## 工具：scripts/token_meter.py

```bash
M=~/.hermes/skills/token-usage-meter/scripts/token_meter.py

# 1) 看某会话当前累计（不写账）；--session auto 自动取进行中的非cron会话
python3 $M snapshot --session auto

# 2) 一个/多个会话精确汇总（项目级）
python3 $M session 20260909_161425_b04e37 20260909_174740_30f9a5

# 3) 历史会话按 user-turn 切最小单元（[估算]分摊）
python3 $M turns --session 20260909_161425_b04e37

# 4) 实时埋点：最小循环单元开始 / 结束（自动与最近 start 差分）
python3 $M start --session auto --project 项目名 --unit-type 文章提炼 --tag 文章A
#   ……执行该循环（期间模型产生调用）……
python3 $M end   --session auto --tag 文章A

# 5) 项目复盘：聚合该项目所有单元，按类型统计次数/合计/单元均耗
python3 $M project 项目名

# 6) 查原始账本
python3 $M ledger --project 项目名
```

账本：`~/.hermes/token_meter/ledger.jsonl`，每行一条 start 或 unit 记录。

## 埋点规范：最小循环单元怎么划

**最小行动单元 = 一次可独立交付、有明确起止的完整循环**，举例：

- 内容：`文章提炼`（读一篇 → 产出结构化摘要）、`资料整理`
- 测试：`用例执行`（执行1条用例 → 证据 → 判定）、`缺陷提单`、`安全扫描子阶段`
- 需求：`需求转清单`（1个需求 → 清单体）、`用例生成`
- 子智能体：`subagent-<目标>`（一次 delegate_task 的完整子任务）

埋点约定：
- `--project`：项目/任务名（同一项目所有单元共用，用于 project 聚合）
- `--unit-type`：循环类型（同类可统计"单元均耗 token"，即人效比）
- `--tag`：单元唯一标识（如 文章A、用例TC-012、需求REQ-3），end 用它匹配 start
- end 省略 `--project/--unit-type` 时自动继承 start；同会话多单元靠 tag 区分

## 监控点 / 复盘点（对齐你的诉求）

- **监控点（埋点）= start/end 成对调用**。长流程在每个最小循环前后各一次。
  - 子智能体：在 `delegate_task` 派发前 start，拿到结果后 end，`--unit-type subagent-...`。
  - 长脚本/后台任务：任务启动前 start，完成通知后 end（会话累计在后台也增长）。
- **复盘点 = `project 项目名`**：一个任务/项目结束聚合输出——
  各单元类型的次数、合计 token、单元均耗（每条用例/每篇文章成本）、
  总量/输入/输出/缓存读、API 调用数、总耗时。直接进复盘报告。

## 防熔断使用纪律

- 计量命令本身是轻量只读 + 一行 jsonl，开销可忽略，不要在循环里高频调用（每单元一对即可）。
- 大结果只回结论行；明细在 ledger.jsonl，需要时落盘不在对话铺开。
- 多会话项目：每个会话各自 start/end，project 聚合会自动合并同名项目跨会话单元。

## 局限与路线B（精确成本/逐调用）

- 本 skill 不产出真实金额；要成本需给模型配单价（Hermes 定价配置），属路线B。
- 要逐 API 调用 usage 与 cache_write/reasoning，需网关回传明细并由 provider 适配器落库（路线B）。
- 事后 turns 分摊是近似值，需要精确单元账请在执行时用 start/end 实时埋点。
