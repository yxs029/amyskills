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

