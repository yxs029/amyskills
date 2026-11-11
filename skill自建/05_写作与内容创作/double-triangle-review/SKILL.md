---
name: double-triangle-review
display_name: 一堂双三角复盘(量化版 · 自动评分 + 双报告)
description: >
  用「双三角清单体」量化模型对人或 AI 系统的 6 大能力维度做结构化复盘。
  自动评分模式:基于实际素材/项目表现,LLM 推断 27 子模块分数,无需手答 108 题。
  输出两份报告:
    报告 1 = 可视化复盘(SVG 雷达图 + 段位 + 90 天成长主线)
    报告 2 = 场景迭代建议(直接喂给 AI 跑下一轮)
  适用场景:成长测评、项目复盘、阶段总结、跨项目对比、6 个月成长曲线追踪、
  AI 协作效果评估、给下一轮 AI 写启动 prompt。
  当用户说:复盘、双三角、一堂双三角、能力测评、6 要素测评、段位判定、
  我现在到底几级、能力短板、成长曲线、下一轮怎么改,使用此技能。
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# 一堂双三角复盘(Double-Triangle Review · Quantitative)

## 这是什么

一个**可量化的能力测评 + 复盘框架**,**含自动评分模式**和**两份报告**输出:

- **6 维度 × 27 子模块 × 满分 540 分**(0-100% 段位)
- **自动评分**:基于素材/项目表现,LLM 推断 27 子模块分数,无需用户答 108 题
- **报告 1**(可视化复盘):SVG 雷达图 + 段位 + 90 天成长主线
- **报告 2**(场景迭代建议):AI 启动 prompt + 人类启动清单 + 期望下轮分数

不是主观打分,而是**用 LLM 观察素材 → 客观分数 → 自动生成双报告**。

## 与早期版本差异

| 维度 | 早期版本 | 本版本(自动评分 + 双报告) |
|---|---|---|
| 评分 | 主观 / 答 108 题 | **LLM 看素材自动打分** |
| 段位 | 3 段(基/进/高) | 27 子模块 + 0-100% 段位 |
| 报告 | 1 份 markdown | **2 份**(可视化复盘 + 迭代建议) |
| 雷达图 | 无 | **SVG 内嵌** |
| 90 天主线 | 简版 | **6 要素完整版** |
| 喂 AI 下轮 | 无 | **完整可复制 prompt** |

## 何时使用

- 自我成长盘点(每 90 天)
- 项目交付复盘
- 跨项目对比(过去 3 个月做了哪些项目,整体段位涨没涨)
- AI 协作效果评估
- 给下一轮 AI 写启动 prompt
- 团队能力图谱

## 完整流程(自动评分模式)

### Step 1: 收集素材

用户提供**复盘对象 + 素材**:

- 对话记录(粘贴 / 引用)
- 项目日志 / git history
- 已完成的 skill 文件树
- skill 输出物(SKILL.md / pipeline / 代码)
- 用户主观观察("这个项目我做得好/不好")

### Step 2: 调用 LLM 自动评分

读取 `scripts/eval_prompt.md`,把素材注入 prompt,调 LLM(推荐 m3),得到 raw JSON。

```
LLM 输出结构:
{
  "sub_scores": {
    "A1": {"score": 16, "evidence": "看到原始 skill 后立刻分两栏列亮点/毛病"},
    ...
  },
  "key_observations": [...]
}
```

LLM 对每个子模块打 0-20 分,基于 evidence。

### Step 3: 解析 + 校验 + 计算段位

调用 `scripts/auto_assess.py`:

```python
from auto_assess import assess_from_raw
result = assess_from_raw(llm_raw_output)
# result 包含:
#   sub_scores (27 个子模块分数)
#   dim_summary (6 维度汇总 + 段位)
#   overall (综合分)
#   bottleneck / strength
```

校验逻辑:
- S1-S4 在两个三角里同名 → 按 evidence 自动加 `_人` / `_AI` 后缀
- 校验分数范围 0-20
- 校验所有 27 个子模块都存在

### Step 4: 生成两份报告

调用 `scripts/generate_report.py`:

```python
from generate_report import generate_report_1, generate_report_2

r1 = generate_report_1(result, subject=..., date=..., scenario=...)
r2 = generate_report_2(result, scenario=..., hours=..., retros=...)
```

**报告 1 结构**:
1. 一句话回顾
2. 综合评分卡
3. **6 维度 SVG 雷达图**(内嵌)
4. 维度明细表
5. 6 要素详细章节(每个含子模块明细 + 段位徽章 + **90 天成长主线**)
6. 下次复评时间

**报告 2 结构**:
1. 场景元数据
2. 上一轮 6 要素得分速览(关键观察 + 改进方向)
3. **P0 改进建议**(1-3 条,含 AI prompt + 人类 prompt + 验证标准)
4. P1 改进建议(2-4 条)
5. P2 改进建议(战略性,可推迟)
6. **下一轮 AI 启动 prompt**(完整粘贴块)
7. **下一轮人类启动清单**(时间轴 + checkbox)
8. 期望下轮 6 要素分数提升表

### Step 5: 输出 markdown

把两份报告写到指定路径(默认 `$MAVIS_SCRATCHPAD/<session-id>/`)。

## 6 维度 × 27 子模块(完整定义)

| 三角 | 维度 | 子模块 | 满分 |
|---|---|---|---|
| 🧑 人 | 审美 | A1 主动模仿 / A2 我能看见 / A3 筛选入围 / A4 提炼模型 | 80 |
| 🧑 人 | 体系 | S1_人 散点管理 / S2_人 TopN聚焦 / S3_人 MECE结构 / S4_人 逻辑链系统 | 80 |
| 🧑 人 | 创新 | I1 流程 / I2 方案 / I3 商业 / I4 产品 / I5 技术应用 / I6 技术自研 | 120 |
| 🤖 AI | 场景 | S1_AI Seek / S2_AI Transform / S3_AI Accelerate / S4_AI Realize | 80 |
| 🤖 AI | 基本功 | K1 认知入门 / K2 提示工程 / K3 智能体RAG / K4 编程融合 / K5 体系化思维 | 100 |
| 🤖 AI | 数据 | D1 质量意识 / D2 整理能力 / D3 资产就绪 / D4 飞轮增值 | 80 |
| **合计** |  | **27 子模块** | **540** |

详见 `references/sub-modules.md` 和 `references/assessment-data.json`。

## 段位判定

每个子模块 0-20 分。每个维度(子模块总和 / 满分 × 100%):

| 段位 | 百分比 | 含义 |
|---|---|---|
| 🌱 初阶 | < 30% | 知道要做,但还没开始 / 完全未建立 |
| 🔵 进阶段 A | 30-50% | 已开始执行,但还不稳定,常忘 |
| 🟢 进阶段 B | 50-70% | 稳定执行,还未引领 |
| ⭐ 高阶 | 60-100% | 可输出 / 教学 / 跨场景迁移 |

详见 `references/percentage-rubric.md`。

## 极简模式(5 分钟)

时间不够做完整双报告时,只答 6 个问题:

1. **审美**:最近 30 天收藏 / 标注过 3 篇以上"值得反复研究"的内容吗?
2. **体系**:知识 / 项目有"统一入口 + 定期整理"吗?
3. **创新**:过去 30 天有没有**自创**一个方法 / 模型 / 工具?
4. **场景**:用 AI 解决**真实业务痛点**而不是"测试玩玩"吗?
5. **基本功**:能写出 5 个自己常用的 prompt 模板吗?
6. **数据**:数据有"统一标签 + 双向链接"吗?

每个 1-5 分,5 分钟完成。**只能做粗筛,不能替代完整双报告**。

## 输出位置

- 默认:`$MAVIS_SCRATCHPAD/<root-session-id>/review-<topic>-report-1.md` + `report-2.md`
- 也可指定路径(比如 `C:/.../something-report-1.md`)
- 团队对比:`team-review-YYYYMMDD-report-{1,2}.md`

## 重要纪律

1. **诚实打分**(LLM 也要被 prompt 约束诚实)
2. **每个建议 1 小时内能开始**:否则是空话
3. **必须设下次复评时间**:不写就是空头支票
4. **报告 1 + 报告 2 配套使用**:只看 1 会"知道痛但不知道怎么治",只看 2 会"瞎改",两个一起用

## 文件结构

```
double-triangle-review/
├── SKILL.md                              本文件
├── references/
│   ├── sub-modules.md                    27 子模块定义
│   ├── rubric.md                         1-5 分标准(老)
│   ├── scoring.md                        段位判定(老)
│   ├── framework.md                      定性兜底(老)
│   ├── question-bank.md                  108 题题库(老,可选)
│   ├── assessment-data.json              结构化题库
│   ├── percentage-rubric.md              0-100% 段位标准(新)
│   ├── radar-chart.md                    SVG 雷达图模板(新)
│   ├── growth-path.md                    90 天主线模板(新)
│   └── iteration-guide.md                报告 2 设计指南(新)
├── scripts/
│   ├── auto_assess.py                    LLM JSON 解析 + 校验 + 维度汇总(新)
│   ├── eval_prompt.md                    LLM 评分提示词(新)
│   └── generate_report.py                两份报告生成(新)
└── examples/
    ├── arxiv-pipeline-case.md            老版本示例
    ├── quantitative-self-review.md       老版本示例
    └── reports/
        ├── arxiv-skill-report-1.md       报告 1 示例(新)
        └── arxiv-skill-report-2.md       报告 2 示例(新)
```

## 自定义

- 改评分标准:编辑 `references/percentage-rubric.md` 或 `references/rubric.md`
- 改 90 天主线模板:编辑 `scripts/generate_report.py` 的 `GROWTH_PATH_TEMPLATES`
- 改 AI 启动 prompt 模板:编辑 `scripts/generate_report.py` 的 `generate_report_2`
- 改报告结构:编辑 `scripts/generate_report.py` 的 `generate_report_1` / `generate_report_2`
- 改题库:编辑 `references/assessment-data.json`