---
name: arxiv-obsidian-collector
description: >
  每周轮转(单层)从 arXiv 下载最新论文 PDF,经 LLM 质量评分过滤(过滤 rehash / 综述注水)
  后,生成含中文摘要、TL;DR 和索引关键词的 Obsidian Markdown 笔记,
  通过 [[双向链接]] 绑定 PDF 文件,输出到指定 Vault 目录。
  覆盖五层 AI 技术分类体系(专用小模型/大模型基底层/大模型组件层/智能体工程层/行业应用层),
  共 66 个分类。
  当用户需要:按层轮转抓 arXiv 周报、断点续跑的 AI 论文知识库、
  按质量分排序的论文 Obsidian 库,使用此技能。
  支持:--layer <name> 单层 / --config <yaml> 自定义 / 可选接虾评 API 做评分审计。
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# arXiv to Obsidian — AI 论文周报收集器

把 arXiv 上"过去 7 天、5 层 66 个细分分类"的 AI 论文,每周自动下 PDF、经过滤、生成结构化中文笔记,直接落到你的 Obsidian Vault。**质量低于阈值的不入库**,被拒的论文留 `.rejected-*.json` 底,事后可翻案。

## 输出目录结构

PDF 与笔记同目录,层 → 分类 → 论文.md + 论文.pdf:

```
<vault_dir>/arxivForAI/
├── 第一层-专用小模型/
│   ├── 轻量化模型架构/
│   │   ├── 论文标题.pdf
│   │   ├── 论文标题.md        ← 含 [[论文标题.pdf]] 双向链接
│   │   └── .rejected-2026-07-08.json  ← 被拒论文明细
│   └── ...
├── 第二层-大模型基底层/
├── 第三层-大模型组件层/
├── 第四层-智能体工程层/
└── 第五层-行业应用层/
```

## 快速使用

### 安装依赖

```bash
pip install PyPDF2 openai requests pyyaml
```

### 运行

```bash
# 跑指定层(最常用 — 由 cron 调)
python scripts/pipeline.py --layer "第一层-专用小模型"

# 全量回填(首次使用或漏跑补齐)
python scripts/pipeline.py --layer all      # 注意:需把代码中 layer=None 改成 layer='all' 时实现;默认 None 即跑全部

# 测试模式(不评分,只跑第一层第一个分类,验证流程)
python scripts/pipeline.py --test

# 用 dispatcher(由 cron / 任务计划调,推荐)
python scripts/dispatcher.py --layer "第一层-专用小模型"
```

## Obsidian 笔记格式

每篇笔记包含**带质量评分的 frontmatter** + 结构化正文:

```markdown
---
title: "论文标题"
authors: 作者1, 作者2
date: 2026-07-08
arxiv_id: 2407.xxxxx
arxiv_url: https://arxiv.org/abs/2407.xxxxx
layer: 第一层-专用小模型
category: 轻量化模型架构
tags: [arXiv, 轻量化模型架构, quality/high_quality]
quality_score: 8.5
quality_category: high_quality
quality_reasons:
  - "提出新的量化感知训练框架"
  - "在多个基准上超越 SOTA"
pdf: "[[论文标题.pdf]]"
---

# 论文标题

> **TL;DR**: 一句话总结本文核心贡献

**PDF**: [[论文标题.pdf]]  |  **质量分**: 8.5/10

## 核心研究问题
## 中文摘要
## 关键贡献
## 方法与技术路线
## 主要实验结论
## 索引关键词
## 研究价值与应用场景
```

`quality_score` 写在 frontmatter 里,**Obsidian 配合 Dataview** 就可以按分排序、做分类雷达图、`#quality/top` 自动建索引页。

## 质量过滤

每篇论文在生成笔记前由 LLM 评审打分(0-10):

| 分数区间 | 等级 | 默认行为 |
|---|---|---|
| 9-10 | `top`            | 必读 |
| 7-8  | `high_quality`   | 推荐 |
| 5-6  | `medium_quality` | 一般 |
| 3-4  | `low_quality`    | **过滤** |
| 0-2  | `reject`         | **过滤** |

- **阈值可调**: 修改 `config.yaml` 的 `quality_threshold`
- **被过滤论文**: 仍下载 PDF(留底),写 `.rejected-YYYY-MM-DD.json`,事后可翻案
- **评分失败**: 自动兜底 5.0(中性),不阻塞流水线

### 降级模式(no-LLM)

如果 `MINIMAX_M3_API_KEY`(或 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`)全部未配置,
流水线进入降级模式,不再 `sys.exit(1)`:

- 跳过 LLM 评分(所有论文都保留,quality_score 占位为 7.0,quality_category 为 `no_llm`)
- 跳过中文摘要(笔记里只放元信息 + PDF 链接 + 英文 arXiv 摘要,顶部加 `⚠️ LLM 摘要暂不可用` 提示)
- arXiv 搜索 + PDF 下载 + 文本提取照常进行

修复方法:设置环境变量后重跑即可,已有 PDF/MD 不会重复处理(断点续跑)。

## 五层分类体系

| 层级 | 分类数 |
|---|---|
| 第一层:专用小模型层 | 15 |
| 第二层:大模型基底层 | 16 |
| 第三层:大模型组件层 | 12 |
| 第四层:智能体工程层 | 12 |
| 第五层:行业应用层 | 11 |
| **合计** | **66** |

详见 `scripts/pipeline.py` 顶部 `SEARCH_CATEGORIES` 字典。

## 调度(每周轮转 — MiniMax Code 定时任务)

推荐: **Mavis cron**(MiniMax Code 的定时任务),每周一-周五各跑一层:

```powershell
# 在 skill 目录下执行(任意 PowerShell 即可,不需要管理员)
cd "C:\Users\AaronMY\.mavis\skills\arxiv-obsidian-collector"
powershell -ExecutionPolicy Bypass -File .\register_cron.ps1
```

注册完 5 个 cron(挂在 agent `mavis` 下):

| Cron 名 | schedule | 跑 |
|---|---|---|
| `arxiv-L1` | `0 9 * * 1` 每周一 09:00 | L1 (`--layer L1`) |
| `arxiv-L2` | `0 9 * * 2` 每周二 09:00 | L2 |
| `arxiv-L3` | `0 9 * * 3` 每周三 09:00 | L3 |
| `arxiv-L4` | `0 9 * * 4` 每周四 09:00 | L4 |
| `arxiv-L5` | `0 9 * * 5` 每周五 09:00 | L5 |
| — | 周六、日 | 不跑(arXiv 周末休刊) |

> **为什么用 ASCII 别名 L1-L5?**
> 早期用中文层名做 mavis cron prompt 时,mavis storage 把 unicode 当 ANSI 解析,
> 中文字段显示成 `?`,prompt 实际不可用。改用纯 ASCII 短码彻底规避。
> `pipeline.py` 收到 `--layer L1` 后由 `LAYER_ALIAS` 映射回中文层名。

### 常用命令

```powershell
# 查看所有 cron 状态
mavis cron list mavis | findstr arxiv

# 立即触发 L1(测试用,不走调度器)
mavis cron trigger mavis arxiv-L1

# 禁用某个 cron(暂停不删)
mavis cron disable mavis arxiv-L1

# 重新启用
mavis cron enable mavis arxiv-L1

# 删除(完全卸载)
powershell -ExecutionPolicy Bypass -File .\register_cron.ps1 -Unregister
```

### 手动运行(不走 cron)

```powershell
# 单层跑
cd "C:\Users\AaronMY\.mavis\skills\arxiv-obsidian-collector"
python scripts\pipeline.py --layer L1

# 全量(谨慎,会跑所有 5 层)
python scripts\pipeline.py

# 测试流水线
python scripts\pipeline.py --test
```

## 关键配置项(`config.yaml`)

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `vault_dir` | `./arxivForAI` | Obsidian Vault 目录(支持中文路径) |
| `search_days` | `7` | 搜索时间窗口 |
| `max_results_per_query` | `5` | 每 query 最多返回篇数 |
| `max_papers_per_category` | `5` | 每分类最终保留篇数 |
| `model` | `m3` | 中文摘要 LLM(走 MiniMax-M3) |
| `quality_scorer_model` | `m3` | 评分 LLM(可与摘要模型不同) |
| `api_base` | `https://api.minimaxi.com/anthropic` | MiniMax-M3 endpoint(Anthropic Messages API 风格) |
| `api_key_env` | `MINIMAX_M3_API_KEY` | 读 API Key 的环境变量名 |
| `quality_threshold` | `5.0` | 评分过滤阈值(0 = 关闭) |

## 网络代理(强制)

你的 mavis 电脑出口走 HTTP proxy(Clash/Mihomo 类),地址 `http://127.0.0.1:7892`。

当前 shell 通常已经继承 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量,
但 **mavis cron 启动的子进程不继承这些 env**,会拿到 `Connection error`。

所以 `scripts/pipeline.py` 和 `scripts/scorer.py` 顶部硬补了兜底:

```python
_DEFAULT_PROXY = "http://127.0.0.1:7892"
_DEFAULT_CA    = r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem"
for _k in ("HTTPS_PROXY", "HTTP_PROXY"):
    os.environ.setdefault(_k, _DEFAULT_PROXY)
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,::1")
if os.path.exists(_DEFAULT_CA):
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _DEFAULT_CA)
    os.environ.setdefault("SSL_CERT_FILE", _DEFAULT_CA)
```

CA bundle 同步带上 —— 代理软件对 HTTPS 做 MITM 时,Python 不认它注入的
自签证书会 SSL error。Node 已经把 CA 放在 `system-ca-certs.pem`,Python 用同一个。

> 改了代理端口 / CA 路径?直接改这两个常量即可。

## LLM 配置(MiniMax-M3 / Anthropic Messages API)

所有 LLM 调用都通过 `anthropic` Python SDK + `base_url` 指向
`https://api.minimaxi.com/anthropic`(MiniMax-M3 提供的 Anthropic 兼容端点)。

> 早期用 OpenAI SDK 实测对该端点会拿到 `404 page not found`,
> 故采用 Anthropic SDK。SDK 探测结果:401 authentication_error 表示协议对齐,
> 只差有效 key。

### 配置方式

1. **设置 API Key**(推荐,Session / Machine 级都行):
   ```powershell
   # 临时(当前 shell 窗口)
   $env:MINIMAX_M3_API_KEY = "<your-m3-key>"

   # 永久(用户级,重启 shell 还在)
   [System.Environment]::SetEnvironmentVariable("MINIMAX_M3_API_KEY", "<your-m3-key>", "User")

   # 如果 key 配在 daemon 内部 secret store,scheduler session 会自动注入,
   # 这种情况你不用管 env
   ```

2. **改 endpoint**(默认就是 MiniMax 官方,但你想换自部署 / 别的供应商):
   ```yaml
   api_base: "https://api.minimaxi.com/anthropic"
   # 或自部署:vLLM / Ollama 之类提供的 Anthropic 兼容代理
   ```

3. **改模型名**(在你服务上的实际模型 id):
   ```yaml
   model: "m3"                   # 摘要
   quality_scorer_model: "m3"    # 评分(可不同,例如用更便宜的子模型)
   ```

### 兼容路径

`scorer.make_minimax_client` 读 key 的优先级:
1. `<api_key_env>`(默认 `MINIMAX_M3_API_KEY`,可在 yaml 改)
2. `ANTHROPIC_API_KEY`(标准 Anthropic 用法)
3. `OPENAI_API_KEY`(历史兜底)

任何其一有值即可。

## 注意事项

- arXiv API 有限流保护,脚本内置重试(429 退避 + 单 query 间隔 3-8s)
- 已下载的 PDF 和已生成的 md **自动跳过**,支持断点续跑
- API Key 走环境变量,不要 hardcode
  - 默认:`MINIMAX_M3_API_KEY`
  - 兜底:`ANTHROPIC_API_KEY` 或 `OPENAI_API_KEY`
- **数据归属**: 下载的 arXiv PDF 与生成的 md 笔记均为个人知识整理用途,
  不再分发、不用于商业训练语料
- **评分 LLM 调用成本**: 每周约 25-50 篇 × ~1.5k token,按 MiniMax 自家定价计费

## 自定义

1. 改 `SEARCH_CATEGORIES`(分类和搜索词): 编辑 `scripts/pipeline.py` 顶部
2. 改 Obsidian 笔记模板: 编辑 `scripts/pipeline.py` 中 `md_content = """..."""` 段
3. 改评分 prompt: 编辑 `scripts/scorer.py` 中 `SCORER_PROMPT`
