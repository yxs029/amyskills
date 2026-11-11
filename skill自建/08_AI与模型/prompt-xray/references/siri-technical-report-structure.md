# Siri 技术版报告 — 实际产出结构参考

> 这是 2026-06-11 第一版技术报告的实际产出，作为后续技术版拆解的参考模板。
> 这版用了 L1-L5+Feedback 框架（后来被老大纠正为"指向对象"），但**数据层产出是技术版的核心**。

## 拆解过程完整记录

### Step 2 画像阶段

**全量画像 JSON**：每个文件记录 bytes/lines/head/tail/keywords

**★ 合并文件切分**（关键子步骤，经常遗漏）：

| 发现 | 详情 |
|---|---|
| 异常文件 | `gistfile1.txt`：103KB / 1791 行，远大于其他文件 |
| 分隔符 | `──────────────────────────────────────────────────────────────`（Unicode 长横线） |
| 切分算法 | `re.split(separator_pattern, content)` → 过滤 <50 字符碎片 → 标记 `is_real_sp: true` |
| 切分结果 | 55 条独立 SP |
| 统计公式 | 189 原始 - 1(gistfile1) + 55(切分) = 243 总条目 |

### Step 3 分类阶段

**file_catalog.json 的 5 维标签**：
```json
{
  "file": "001_NEW27_task_overview.txt",
  "size": 1189,
  "status": "NEW27",           // 来源状态：新版新增 vs 旧版已有
  "kind": "embedded",          // 嵌入方式：编译进二进制 vs 独立文件
  "framework": "TextComposerRuntime",  // 代码级来源
  "domains": ["✉️ Mail/TextComposer", "📍 Maps/Location"],  // 可跨域
  "oneliner": "TextComposer 任务概览"   // 人类可读摘要
}
```

**3 轮递进分类法**：

1. **关键词粗分**：预设关键词表自动打标
   - 含 `mail/email/compose/draft/reply` → `✉️ Mail/TextComposer`
   - 含 `map/location/route/navigate/place` → `📍 Maps/Location`
   - 含 `planner/plan/orchestrat/task_overview` → `🧠 Planner/Orchestrator`
   - 含 `safe/crisis/harm/self-harm/violence` → `🛡️ Safety/Crisis`

2. **框架校准**：有框架名的以框架为准
   - `TextComposerRuntime` → `✉️ Mail/TextComposer`
   - `VisualIntelligenceCore` → `🖼️ VisualIntelligence`
   - `ActionPredictionHeuristicsInternal` → `📅 Calendar/EventKit`
   - 编译级来源比文件名更可靠

3. **人工审校**：>1KB 文件或关键词/框架矛盾条目人工确认
   - 典型修正：文件名含 "safe" 但内容是 Mail 回复规则 → 实际属于 `✉️ Mail`
   - 典型修正：framework 标 `Foundation` 但内容全是地图查询 → 改标 `📍 Maps`

**分类结果**（29 域）：
```
📚 Knowledge/Foundation: 96   ✉️ Mail/TextComposer: 55
🎬 ContentKit/Media: 43       📍 Maps/Location: 36
⚙️ System/Foundation: 32     🏆 Coaching/Awards: 28
🧠 Planner/Orchestrator: 25  🔍 Spotlight/OmniSearch: 24
🎵 Music: 20                 🌍 Translation: 19
📅 Calendar/EventKit: 18     🖼️ VisualIntelligence: 17
📷 PhotosIntelligence: 17    🛠️ OS/Error/Misc: 17
📞 Phone/CallIntelligence: 9 🔐 Auth/Password: 8
🍽️ Food/Nutrition: 8        🍎 Health: 7
🛡️ Safety/Crisis: 7         🎫 Wallet/Pass: 7
⚙️ 其它: 11                 📸 Camera: 5
🏠 HomeKit/SmartHome: 5     💼 Productivity/Shortcuts: 4
📡 Push/Notification: 4     🔬 Eval/Tool-Sim: 3
📰 News: 3                  ✅ Reminders: 3
🎨 Image Generation: 1
```

**22.6% 的 SP 跨域**，说明 Siri 的提示词设计高度复用。

### Step 4 精读阶段

**精读优先级策略**：

| 优先级 | 文件类型 | 读取方式 | 原因 |
|---|---|---|---|
| ★★★ | 总章程/主提示词（>20KB） | 全文精读 | 包含 L1 人格 + L2 原则 + L4 执行流程 |
| ★★☆ | 各域核心文件（5-20KB） | 分段精读（每段 50 行） | 包含 L5 场景适配 + 工具调用 |
| ★☆☆ | 短文件（<5KB） | 批量扫描（head/tail + keywords） | 主要是错误消息/调试日志 |

**跨文件关联发现**：
- `PLANNER_ORCHESTRATOR`（总调度）→ 引用所有子任务的 SP
- `SAFETY_GUARDRAILS`（安全护栏）→ 被所有域的 SP 引用
- `TOOL_DEFINITIONS`（工具列表）→ 被 Planner + 各域 SP 引用

## 产出目录结构

```
siri_system_prompts_分析报告/
├── 00_README.md                              ← 总入口
├── 仪表盘.html                               ← 暗色主题交互仪表盘
├── 01_L1_灵魂层/
│   └── 01_为什么学这份语料.md                  ← WHY + 学习路径
├── 02_L2_方法论/
│   └── 01_五大方法论.md                       ← 5 大方法论 + 8 段可复用代码
├── 03_L3_数据底座/                            ← ★ 核心交付
│   ├── 00_核心洞察卡.md                       ← 10 张速记卡
│   ├── 全量提示词清单.md                       ← 742 行 / 28 域 / 243 条
│   ├── file_catalog.json                      ← 结构化索引
│   ├── domain_stats.json                      ← 各域统计
│   └── 关键原文/                              ← 核心文件原文
│       ├── PLANNER_CATALOG_static_system_prompt.txt  ← 60KB 总章程
│       ├── PLANNER_PCC_static_system_prompt.txt
│       ├── PLANNER_PCC_agentinstr_process_content_safely.txt
│       ├── PLANNER_PCC_prerequest_get_system_info.txt
│       ├── PLANNER_CATALOG_prerequest_get_image_content_handling_instructions.txt
│       ├── PLANNER_ODM_static_system_prompt.txt
│       ├── PLANNER_PCC_agentinstr_writing_tools.txt
│       ├── 008_NEW27_system.txt               ← 对话骨架
│       └── 058_NEW27_you_are_an_orchestrator_for_a_multi_agent_spotli.txt
├── 04_L4_执行层/
│   └── 01_系统调用流程.md
├── 05_L5_产品层/
│   └── 01_产品形态可视化.md
├── 06_Feedback_复盘层/
│   └── 01_复盘与行动建议.md
└── 99_学习手册/
    └── 00_从哪开始看.md
```

## 全量提示词清单的实际格式（742 行）

```markdown
# L3 数据底座 - 按功能域分组的全部提示词清单
> 共 243 个文件（含 gistfile1 切分出的 55 段真 SP），按 28 个功能域分组

## 索引
- [📚 Knowledge/Foundation](#📚-Knowledge/Foundation) (96 个)
- [✉️ Mail/TextComposer](#✉️-Mail/TextComposer) (55 个)
- [🎬 ContentKit/Media](#🎬-ContentKit/Media) (43 个)
- [📍 Maps/Location](#📍-Maps/Location) (36 个)
- [⚙️ System/Foundation](#⚙️-System/Foundation) (32 个)
- ...（共 28 域）

---

## 📚 Knowledge/Foundation (96 个)

| # | 文件 | 字节 | 状态 | 所属框架 | 一句话 |
|---|------|------|------|---------|--------|
| 1 | `004_in26_public_s_you_are_not_the_organizer_no_suggestion.tx` | 293 | in26 | ActionPredictionHeuristicsInternal | %{public}s You are not the organizer: No suggestion |
| 2 | `008_NEW27_system.txt` | 374 | NEW27 | ? | 对话骨架模板 |
| 9 | `059_NEW27_you_are_being_connected_to_the_user_through_siri.t` | 4217 | NEW27 | ? | Siri 通道身份+工具列表 |
| ... | ... | ... | ... | ... | ... |
```

**关键点**：
- 每条提示词都有：文件名、字节大小、版本标记（NEW27/in26/on-disk）、所属框架、一句话描述
- 按域分组，每个域有 emoji 标识 + 计数
- 742 行 / 28 域 / 243 条 → 开发者可以 Ctrl+F 搜任何关键词

## file_catalog.json 实际格式

```json
[
  {
    "file": "008_NEW27_system.txt",
    "bytes": 374,
    "lines": 12,
    "domain": "Knowledge/Foundation",
    "framework": "unknown",
    "version_tag": "NEW27",
    "one_liner": "对话骨架模板"
  },
  ...
]
```

## domain_stats.json 实际格式

```json
{
  "Knowledge/Foundation": {"count": 96, "total_bytes": 123456, "largest": "..."},
  "Mail/TextComposer": {"count": 55, "total_bytes": 78901, "largest": "..."},
  ...
}
```

## 仪表盘 HTML 特点

- 暗色主题（#0a0e27 背景）
- 大字统计卡片（文件数/域数/总字节）
- 各域占比柱状图
- NEW27 vs in26 对比
- 最大文件 Top 10

## 技术版 vs 大白话版的核心区别

| 维度 | 技术版 | 大白话版 |
|---|---|---|
| **资产层** | 742 行全量清单（每条配文件名+字节+一句话） | 6 大类分类表（只说"有几张本本"） |
| **术语** | 保留原文（entity/Jinja2/dyld） | 翻译成大白话（联系人/拼装模板/从程序包提取） |
| **原文** | 关键原文直接放在目录里 | 只引用、不粘贴 |
| **代码** | 8 段可复用代码片段 | 无代码 |
| **学习路径** | 4 阶段（打底→分类扫→精读→对比） | 5 个问题对应 5 节 |
| **受众** | 开发者/AI工程师/QA | 企业经营者/PM/非技术 |
