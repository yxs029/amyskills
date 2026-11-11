---
name: prompt-xray
version: 1.0.0
description: Agent 系统提示词语料库拆解分析。输入 ZIP/RAR/文件夹/文本，输出结构化解析报告（PDF+MD）。5步流程：解包→画像→分类→精读→输出，5层框架：人格/原则/资产/执行/表现。
tags: [prompt, analysis, agent, xray, report, pdf]
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# PromptXray · Agent 系统提示词拆解分析

把一份 AI 系统提示词语料库（ZIP/RAR/文件夹/粘贴文本）拆解成结构化解析报告。

## 触发条件

当用户要求以下任一操作时触发：
- "拆解/解析/分析这份提示词/系统提示词/agent提示词"
- "帮我看看这个 AI 的提示词写了什么"
- "分析这个 agent 的 system prompt"
- "拆解这个语料库"
- "做一个 prompt 分析报告"

## 核心流程：5 步拆解法

```
输入 → Step1 解包 → Step2 画像 → Step3 分类 → Step4 精读 → Step5 输出 → 报告
```

### Step 1：解包（Unpack）

**做什么**：自动识别输入格式，解压，统计文件数和总大小。

**操作**：
1. 判断输入类型：
   - `.rar` → `sudo apt-get install -y unrar && unrar x <file> <outdir>`
   - `.zip` → `unzip <file> -d <outdir>`
   - `.tar.gz` / `.tgz` → `tar xzf <file> -C <outdir>`
   - 文件夹 → 直接进入 Step 2
   - 纯文本 → 创建临时文件
2. 统计：`find <outdir> -type f | wc -l` + `du -sh <outdir>`
3. 快速扫描文件类型：`file <outdir>/* | sort | uniq -c | sort -rn`

**输出**：文件清单 + 格式统计

### Step 2：画像（Scan）

**做什么**：遍历每个文件，记录元数据，生成全量画像 JSON。

**操作**：
1. Python 脚本遍历所有文件：
   ```python
   for f in all_files:
       profile[f] = {
           "bytes": f.stat().st_size,
           "lines": count_lines(f),
           "head": read_head(f, 5),  # 前5行
           "tail": read_tail(f, 5),  # 后5行
           "keywords": extract_keywords(f, top_n=10),
       }
   ```
2. 按文件大小降序排列（最大的文件通常是核心提示词）
3. **检查合并文件**：单文件但>100行（如 `gistfile1.txt`），可能内含多条独立提示词，需要切分
4. 输出 `_all_content.json`

**关键判断**：
- **最大文件（>20KB）**：极可能是总章程/主提示词，必须精读
- **带特定前缀的文件名**（如 `PLANNER_*`、`system_*`、`prompt_*`）：核心文件
- **文件名含 `safe/security/guard/filter`**：安全规则
- **文件名含 `tool/function/api`**：工具调用规则

**合并文件切分**（★ 关键步骤，经常遗漏）：

有些语料库里，多条独立提示词被拼在一个文件里（如 GitHub Gist 导出格式）。识别方法：

| 特征 | 说明 |
|---|---|
| 文件体积异常大（>50KB）但只有 1 个文件 | 极可能是多条 SP 合并 |
| 文件内出现重复的分隔符 | `──────────`、`---`、`===`、`#` 标题 |
| 文件内出现多条 "You are..." 开头 | 每条 "You are" = 1 条独立 SP |

**切分算法**：

```python
def split_merged_file(filepath, separator_pattern):
    """把合并文件切分成独立提示词"""
    content = Path(filepath).read_text()
    # 按 Unicode 长横线 / --- / === / 空行+标题 分割
    chunks = re.split(separator_pattern, content)
    results = []
    for i, chunk in enumerate(chunks):
        chunk = chunk.strip()
        if len(chunk) < 50:  # 太短，跳过
            continue
        results.append({
            "source": filepath.name,
            "index": i,
            "content": chunk,
            "bytes": len(chunk),
            "lines": chunk.count("\n"),
            "is_real_sp": True  # 标记为"真 SP"
        })
    return results
```

**常见分隔符**（按优先级）：

| 分隔符 | 出现场景 |
|---|---|
| `──────────────────────`（Unicode 长横线） | GitHub Gist 导出 |
| `---`（3 短横线） | Markdown YAML front matter 分隔 |
| `===`（3 等号） | 简单分隔 |
| 连续 2+ 空行 | 朴素合并 |
| `\n# ` 标题行 | 按章节切分 |

**统计公式**（避免数字对不上）：

```
总提示词数 = 原始文件数 + 合并文件切分出的额外条数
           = 189（原始）+ 55（gistfile1 切出）- 1（gistfile1 本身）
           = 243
```

**Siri 项目的实际例子**：
- `gistfile1.txt`：103KB / 1791 行 → 切出 55 条独立 SP
- 分隔符：`──────────────────────────────────────────────────────────────`
- 切分后总条目：189 原始 - 1(gistfile1) + 55(切分) = 243

### Step 3：分类（Classify）

**做什么**：把每条 SP 归入功能域，标注元数据，生成结构化索引。

**分类维度**（每个文件/条目打 5 个标签）：

| 维度 | 字段名 | 说明 | 示例 |
|---|---|---|---|
| 来源状态 | `status` | 提示词在该版本是新增还是旧版已有 | `NEW27` / `in26` |
| 嵌入方式 | `kind` | 编译进二进制 vs 磁盘独立文件 | `embedded` / `on-disk` |
| 所属框架 | `framework` | 代码级来源（iOS 私有框架名） | `TextComposerRuntime` / `SiriKit` |
| 功能域 | `domains[]` | 语义分类，**一个 SP 可跨多个域** | `["✉️ Mail", "📍 Maps"]` |
| 一句话描述 | `oneliner` | 人类可读的一句话摘要 | "从输入文本中抽取结构化信息" |

**域分类方法**（从粗到细 3 轮）：

**第 1 轮：粗分（按关键词打标）**

```python
DOMAIN_KEYWORDS = {
    "✉️ Mail/TextComposer": ["mail", "email", "compose", "draft", "reply"],
    "📍 Maps/Location": ["map", "location", "route", "navigate", "place"],
    "📅 Calendar/EventKit": ["calendar", "event", "schedule", "reminder"],
    "📚 Knowledge/Foundation": ["knowledge", "search", "answer", "web"],
    "🧠 Planner/Orchestrator": ["planner", "plan", "orchestrat", "task_overview"],
    "🛡️ Safety/Crisis": ["safe", "crisis", "harm", "self-harm", "violence"],
    "🎨 Image Generation": ["image", "genmoji", "visual", "draw"],
    # ... 根据语料库动态补充
}

def classify_by_keywords(content, filename):
    domains = []
    text = (content + " " + filename).lower()
    for domain, kws in DOMAIN_KEYWORDS.items():
        if any(kw in text for kw in kws):
            domains.append(domain)
    return domains or ["⚙️ 其它"]
```

**第 2 轮：框架校准（按 framework 名归拢）**

iOS 二进制提取的提示词自带框架名（如 `TextComposerRuntime`、`VisualIntelligenceCore`），框架名比文件名更准：

```python
FRAMEWORK_DOMAIN = {
    "TextComposerRuntime": "✉️ Mail/TextComposer",
    "VisualIntelligenceCore": "🖼️ VisualIntelligence",
    "ActionPredictionHeuristicsInternal": "📅 Calendar/EventKit",
    "SiriPlanner": "🧠 Planner/Orchestrator",
    # ...
}
```

**第 3 轮：人工审校（精读大文件修正）**

对 >1KB 的文件或关键词/框架矛盾的条目，人工确认域归属。典型修正：
- 文件名含 "safe" 但内容是 Mail 回复规则 → 实际属于 `✉️ Mail`
- framework 标 `Foundation` 但内容全是地图查询 → 改标 `📍 Maps`

**统计产出**：

```json
{
  "✉️ Mail/TextComposer": 55,
  "📍 Maps/Location": 36,
  "📚 Knowledge/Foundation": 96,
  "🧠 Planner/Orchestrator": 25,
  "🛡️ Safety/Crisis": 7
}
```

**输出文件**：`file_catalog.json`（结构化索引，每条 SP 一条记录）

**6 大类模板**（从 Siri 验证出来的黄金分类，和域分类是两个维度）：

| 类 | 名称 | 说明 |
|---|---|---|
| 1 | 总章程 | 最核心的 1-2 个文件，定义 AI 是谁、原则、工具列表 |
| 2 | 安全规则 | 红线/拒绝/过滤/注入防护 |
| 3 | 上下文模板 | 状态拼装/环境注入/记忆管理 |
| 4 | 任务清单 | 具体任务的独立提示词 |
| 5 | 错误消息 | 预定义的错误/抱歉话术 |
| 6 | 调试日志 | 程序员用的诊断信息 |

**Siri 项目的实际分类结果**：
- 29 个域，最大域 `📚 Knowledge/Foundation`（96条），最小域 `🎨 Image Generation`（1条）
- 55 条跨域 SP（占 22.6%），说明 Siri 的 SP 设计高度复用
- 分类用的关键词表和框架映射表，已随语料库保存在 `file_catalog.json`

### Step 4：精读（Deep Read）

**做什么**：LLM 逐段解读核心文件，提取五层结构。

**操作**：
1. 找到核心文件（Step 2 中最大的 + Step 3 中分类为"总章程"的）
2. 逐段读取，提取以下 5 层：

**5 层分析框架**（必须按此框架组织，**指向被分析的 AI，不是指向"我怎么分析的"**）：

| 层 | 名称 | 回答什么问题 | 提取什么 |
|---|---|---|---|
| L1 | 人格（Identity） | AI 怎么定义自己？ | 自我定位、角色声明、能力边界 |
| L2 | 原则（Principles） | 铁律和红线是什么？ | 必须遵守的规则、绝对禁止的行为、安全约束 |
| L3 | 资产（Assets） | 有多少条提示词？怎么分的？ | 文件清单、分类统计、各域占比 |
| L4 | 执行（Runtime） | 从接收到输出，怎么一步步跑的？ | 处理流程、决策点、工具调用链 |
| L5 | 表现（Product） | 用户在不同场景下看到什么？ | 输出格式、场景适配、错误回退 |

3. **每层必须配场景+举例**（不是空谈理论）

**精读策略**（按文件优先级）：

| 优先级 | 文件类型 | 读取方式 | 为什么 |
|---|---|---|---|
| ★★★ | 总章程/主提示词（>20KB） | **全文精读** | 包含 L1 人格 + L2 原则 + L4 执行流程 |
| ★★☆ | 各域的核心文件（5-20KB） | **分段精读**（每段 50 行） | 包含 L5 场景适配 + 工具调用 |
| ★☆☆ | 短文件（<5KB） | **批量扫描**（head/tail + keywords） | 主要是错误消息/调试日志，快速归类即可 |

**精读产出**（每层的核心交付物）：

- **L1 人格**：AI 自我定位的原话 + 你的翻译（大白话版用）
- **L2 原则**：每条铁律的原文 + 对应场景 + 被违反的后果
- **L3 资产**：全量提示词清单（742行/28域/243条，每条配文件名+字节+版本+一句话）——**技术版最核心的交付物**
- **L4 执行**：从用户输入到最终输出的完整流程（含决策树/分支点/多 agent 编排）
- **L5 表现**：不同场景下用户看到的/听到的具体输出

**跨文件关联方法**：

很多 SP 之间有引用关系（如 Planner 引用 Tool 模板、Safety 覆盖所有域），精读时必须标注：

```python
# 标注跨文件引用
for sp in all_sps:
    sp["references"] = find_references(sp, all_sps)  # 引用了谁
    sp["referenced_by"] = find_referenced_by(sp, all_sps)  # 被谁引用
```

Siri 的实际关联：
- `PLANNER_ORCHESTRATOR`（总调度）→ 引用所有子任务的 SP
- `SAFETY_GUARDRAILS`（安全护栏）→ 被所有域的 SP 引用
- `TOOL_DEFINITIONS`（工具列表）→ 被 Planner + 各域 SP 引用

## 两种报告模式

拆解完成后，**根据受众选择报告模式**：

| 模式 | 受众 | 风格 | 什么时候用 |
|---|---|---|---|
| **大白话版** | 企业经营者 / 非技术人员 | 无术语、配场景、口语化 | 用户说"给人看的" / "大白话" / "经营者版" |
| **技术版** | 开发者 / AI 工程师 / 测试 | 保留术语、原始数据、代码级细节 | 用户说"技术报告" / "完整清单" / "提示词清单" / "开发者版" |

**如果用户没指定 → 默认两个都做**（先做技术版拿数据，再做大白话版翻译）。

---

### 技术版报告结构

技术版的核心价值是**原始数据的完整呈现**——开发者要的不是翻译，是能直接用的数据。

```
封面 + ⚠️ 版本说明
00_README.md                   ← 总入口（统计+速读路线+目录）
01_L1_灵魂层/
   01_为什么学这份语料.md        ← WHY：解决什么问题 + 阶段学习路径
02_L2_方法论/
   01_五大方法论.md             ← WHAT：5 大方法论 + 可复用代码片段
03_L3_数据底座/
   00_核心洞察卡.md             ← 10 张速记卡
   全量提示词清单.md             ← ★ 核心交付物：按域分组的全部提示词清单
   file_catalog.json            ← 结构化索引（每条：文件名/字节/行数/域/一句话）
   domain_stats.json            ← 各域统计（数量/占比/最大文件）
   关键原文/                    ← 核心文件的原文（不翻译，直接放）
04_L4_执行层/
   01_系统调用流程.md            ← HOW：系统调用流程 + 多 agent 编排
05_L5_产品层/
   01_产品形态可视化.md          ← 外部产品行为（Display/Voice/Widget）
99_学习手册/
   00_从哪开始看.md             ← 学习路径 + 速记卡
```

**技术版的关键章节**（和大白话版的区别）：

| 章节 | 大白话版 | 技术版 |
|---|---|---|
| 人格层 | "Siri 介绍自己说了 5 件事" | 60KB 总章程原文 + 逐段标注 |
| 原则层 | "5 条铁律（每条配场景）" | 原文 guardrails 章节 + 注入/越狱/CSAM 防护代码 |
| **资产层** | "6 大类分类表" | **★ 全量提示词清单（742行/28域/243条，每条配文件名+字节+一句话）** |
| 执行层 | "6 步流程图" | 多 agent 编排代码 + Jinja2 模板 + on-disk 加载机制 |
| 表现层 | "7 个场景" | Display/Voice/Widget 渲染路径 |

**全量提示词清单的格式**（★ 技术版最核心的交付物）：

```markdown
# 全量提示词清单

> 共 N 个文件，按 M 个功能域分组

## 索引
- [📚 域名1](#域名1) (N 个)
- [✉️ 域名2](#域名名2) (N 个)
- ...

---

## 📚 域名1 (N 个)

| # | 文件 | 字节 | 状态 | 所属框架 | 一句话 |
|---|------|------|------|---------|--------|
| 1 | `文件名.txt` | 293 | 版本标记 | 框架名 | 一句话描述 |
| 2 | ... | ... | ... | ... | ... |
```

**file_catalog.json 的格式**：

```json
[
  {
    "file": "008_NEW27_system.txt",
    "bytes": 374,
    "lines": 12,
    "domain": "Knowledge/Foundation",
    "framework": "unknown",
    "version_tag": "NEW27",
    "one_liner": "对话骨架模板",
    "head": ["前5行原文"],
    "keywords": ["system", "turn", "format"]
  }
]
```

**技术版的 HTML 仪表盘**（可选）：

用暗色主题（#0a0e27 背景），包含：
- 文件数 / 域数 / 总字节数 大字卡片
- 各域占比柱状图
- NEW27 vs in26 对比饼图
- 最大文件 Top 10 表格

---

### 大白话版报告结构

（已有，保持不变）

```
封面/概述
★ 30 秒版入口
0 总入口（概述 + 5 层导航）
1 人格 · AI 是谁
2 原则 · AI 怎么做事
3 资产 · 背后有多少"本本"
4 执行 · 一步步怎么跑
5 表现 · 用户看到啥
附录 · 文件结构说明
```

---

### Step 5 输出的具体操作

1. 确认受众和报告模式（大白话版 / 技术版 / 两个都做）
2. **如果做技术版**：
   a. 先生成 `03_L3_数据底座/全量提示词清单.md`（核心）
   b. 生成 `file_catalog.json` 和 `domain_stats.json`
   c. 把核心原文拷贝到 `关键原文/` 目录
   d. 生成其他 4 层的技术文档
   e. 可选：生成 HTML 仪表盘
   f. 渲染 PDF（暗色主题可选）
3. **如果做大白话版**：按已有流程
4. **如果两个都做**：先做技术版（拿数据），再做大白话版（翻译）
5. 渲染 PDF：
   - 用 `html-to-pdf-report` skill 的模板风格
   - Chrome Headless `--no-pdf-header-footer`
   - 每页加二维码水印（position:fixed）
4. 验证 PDF：
   - `pdftotext -layout report.pdf - | grep <关键词>` 验证内容
   - **不要依赖视觉 AI 验证**（经验：视觉 AI 看错率高）

## ⚠️ 铁律（从踩坑中总结）

### 铁律 0：方法论文档化，不只是输出文档化

❌ 错误：Step 只写"遍历文件，记录元数据"（说了做什么，没说怎么做）
✅ 正确：Step 写明具体算法、代码片段、判断标准、常见坑（说了怎么做、为什么这么做）

**判断标准**：如果一个新人拿到这份 skill，能不能只看 Step 描述就复现出结果？如果不能，就是太薄了。

**典型反例**（已被修正）：
- Step 2 旧版："遍历每个文件，记录字节数/行数/关键词/类型标签" → 没提合并文件切分
- Step 3 旧版："按文件名前缀+内容特征自动归域归类" → 没提3轮递进分类法
- Step 4 旧版："LLM 逐段解读核心文件，提取五层结构" → 没提精读优先级策略

**教训**：先跑通一遍 → 回头把"我是怎么做到的"写进 skill → 不是"产出什么"，而是"怎么产出"

### 铁律 1：框架指向对象，不是自己

❌ 错误：L1"我是怎么读人格的"、L2"我是怎么分析原则的"
✅ 正确：L1"AI 怎么定义自己"、L2"AI 的铁律是什么"

**判断标准**：如果章节标题里有"我/我们"，就是套反了。

### 铁律 2：术语看受众

**大白话版**：以下术语**禁止**出现，必须翻译成大白话：

| 禁止 | 替换为 |
|---|---|
| entity | 联系人/邮件/照片（根据上下文） |
| orchestration | 多个 AI 协作/分工 |
| Jinja2 template | 拼装模板 |
| dyld extraction | 从程序包里提取 |
| __cstring | 程序里的文字常量 |
| grounding | 查资料确认 |
| RAG | 翻资料找答案 |
| token | 最小文字单位 |
| embedding | 向量化 |

**技术版**：术语**保留原文**，不翻译。开发者需要看到 `entity`、`Jinja2`、`dyld` 这些词才能和代码对上号。

**判断标准**：
- 大白话版 → 隔壁做行政的小王看得懂才算合格
- 技术版 → 开发者能直接用来查代码、写测试才算合格

### 铁律 3：改完源文件必须走完整个渲染管线

❌ 错误：改了 md → 直接渲染 PDF（HTML 缓存没更新）
✅ 正确：改了 md → 重新生成 HTML → 重新渲染 PDF → 验证

### 铁律 4：占位符二次渲染的正确做法

```
第一次渲染 → 拿到页数 N
→ 替换 HTML 里的 {PAGES} 为 N
→ 确认 HTML 里不再有 {PAGES}
→ 第二次渲染
```

### 铁律 5：用 pdftotext 验证，不要用视觉 AI

视觉 AI 经常看错（把"扫码关注"看成别的、说占位符没替换但实际已替换）。
**文本验证 > 视觉验证**：

```bash
pdftotext -layout report.pdf - | grep -c "关键词"  # 精确计数
```

### 铁律 6：对 HTML 做精确替换，不要用模糊正则

❌ `re.sub(r'<div class="qr-.*?">.*?</div>', ...)` — 贪婪匹配会删错
✅ 精确匹配整个 HTML 片段

## 铁律 7：交付后主动问归档

用户偏好：**交付文件后主动问"要不要存 Get笔记？"**，方便手机查看。

Get笔记限制：
- **不支持文件上传**（ZIP/PDF 不行），只支持纯文本/链接/图片
- 文件内容 → 拼成一条长 Markdown 笔记（`plain_text` 类型）
- 内容限制 ~9500 字符，超出截断并标注
- int64 ID 处理：`re.sub(r'"(id|note_id|next_cursor|parent_id)"\s*:\s*(\d{16,})', r'"\1":"\2"', raw)`

## 每层"对受众有啥用"模板

每层末尾必须加一个表格，格式：

```
## 这 X 条对开发者和企业经营者有啥用？

| 角色 | 你可以参考 |
|---|---|
| 开发者（AI 工程师） | ... |
| 开发者（QA） | ... |
| 企业经营者 | ... |
```

## 附录：文件结构说明模板

最后一章必须加附录，列出 PDF 每个章节对应的源文件：

```
| PDF 章节 | 对应源文件 | 内容 |
|---|---|---|
| 1 人格 | 01_人格_谁是Siri/01_它自我介绍原文.txt | ... |
```

## 附：参考文件

| 文件 | 内容 |
|---|---|
| `references/siri-example-report-structure.md` | Siri 实际产出结构（189文件→49页PDF的完整记录） |
| `references/prd-v1-summary.md` | PromptXray PRD v1.0 要点（产品定位、双轨模式、竞品、MVP路线、商业模式） |
| `templates/pdf-report-template.md` | PDF 渲染 HTML 模板（封面/章节封面/二维码水印/CSS/Chrome Headless 命令） |

## Step 6：交付 & 归档

**做什么**：报告生成后，主动询问归档方式。

**操作**：
1. **问用户**："要不要存到 Get笔记？"（用户偏好：交付文件后主动问）
2. 如果存 Get笔记 → 用 `getnote` skill 的 save API，`plain_text` 类型，Markdown 内容
3. **可选**：生成复盘报告（如果用户说"你怎么做到的"/"复盘一下"）
4. **可选**：打包 skill 本身为 ZIP → `zip -r prompt-xray-skill.zip prompt-xray/`
5. 告知用户本地路径 + Get笔记状态

**复盘报告模板**（如果用户要求）：
- 任务全貌（输入→输出）
- 7 阶段时间线
- 核心方法论
- 踩坑记录
- 工具链一览
- 关键数据
- "如果再做一次"优化建议

## 报告视觉规范

- 封面：深蓝渐变 + ⚠️ 版本警告条（如语料来自逆向提取）
- 章节封面：浅蓝渐变 + 大号章节号 + 标题 + 英文标签
- 正文：12pt、1.8 行高、JetBrains Mono 代码块
- 每页右下角：公众号二维码水印（22mm×22mm，position:fixed）
- 表头：深灰背景白字
- 偶数行：浅蓝灰底

## 工具依赖

- `unrar` / `unzip` / `tar`：解压
- `python3` + `pathlib`/`json`/`re`：批量处理
- `google-chrome --headless --no-pdf-header-footer --print-to-pdf=`：HTML→PDF
- `pdftotext`：PDF 文本验证
- `pdftoppm`：PDF 页面转 PNG（预览用）
- `html-to-pdf-report` skill：PDF 渲染模板参考
