# 插件源与优秀插件清单（auto-plugin-conf）

> **范围**：DeepSeek Harness（DSH）与其它 Agent 平台的**插件源 / 插件市场**（区别于技能库）。
> **性质**：纯文档索引（**不执行安装、不调用插件市场安装接口**）。
> 整理日期：2026-11-12 · 验证方式：GitHub 仓库 API（存在性 / stars / 描述 / 最近提交）、市场 URL 可达性实测。
> **用途**：作为 `amyskills` 库内 `dsh-plugin` 维度的**上游源清单**——找新插件先去这些源，收进来后按 `PLUGINS.md` 归档。

---

## 一、核心插件源（你指定 + 实测）

| # | 源 / 市场 | 地址 | 类型 | 核实结果 |
|---|---|---|---|---|
| 1 | **awesome-dsh-plugin**（精选清单） | https://github.com/awesome-dsh-plugin/awesome-dsh-plugin | 官方精选清单仓库 | ✅ ★24,332 · 目录站点 `awesome-dsh-plugin.com`（`plugins.json` 重试 200，更新于 2026-11-11，**count 10,581**，含 categories / capabilities / downloads / stars / screenshots 数据） |
| 2 | **dsh-market**（DSH 内嵌市场） | https://github.com/dsh-market/dsh-market | 插件市场应用（可装到 DSH 里） | ✅ ★12,029 · 站点 `dshmarket.com` 200（5.6s 响应） |
| 3 | **DSH Get** | https://www.dshget.com/ | 可搜索的插件目录站（目录快照公开在 `bobby-sheng/dshget-data`） | ✅ 站点 200（1.0s）；`bobby-sheng.github.io/dshget-data/` 404（路径待核，建议从仓库根取） |
| 4 | **dsh-plugin-hub**（Noob-stupid） | https://github.com/Noob-stupid/dsh-plugin-hub | 插件框架升级安全与门控机制（dsh-market 的热禁用/启用即移植自此） | ✅ ★128 |
| 5 | **deepseek-harness 官方仓库** | https://github.com/deepseek-ai/deepseek-harness | DSH 本体："Everything is a Plugin" | ✅ ★279,043 |

---

## 二、高星 / 流行的 Harness 插件源（GitHub 全网调研）

> 调研方式：GitHub 搜索 API（`q=dsh OR "deepseek-harness"`、`topic:dsh-plugin`、`topic:deepseek-harness`，按 stars 降序）。以下是**插件 / 插件生态**相关仓库（非插件本体的通用项目已剔除）。
> ★ 为 2026-11-12 实测快照。

### 2.1 插件市场 / 目录 / 桌面宿主

| 仓库 | ★ | 定位 | 核实 |
|---|---:|---|---|
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | 279,043 | DSH 本体，万物皆插件 | ✅ |
| [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) | 12,029 | DSH 内嵌插件市场（浏览/搜索/一键装/热禁用/备份/诊断） | ✅ |
| [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | 24,332 | 精选插件清单（dsh-market 的默认源） | ✅ |
| [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) | 35,751 | Electron 桌面宿主：一切皆插件（桌面本身也是插件），profile 切换、内置 Node/pnpm、恢复快照 | ✅ |
| [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | 18,196 | DSHDesktop 桌面版，免装 Node，自带 dsh-market 预设 | ✅ |
| [ccch1mneyyy/dsh-Go](https://github.com/ccch1mneyyy/dsh-Go) | 19,763 | dsh-go：手机本机运行 DSH、也能遥控电脑 | ✅ |
| [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering) | 24,301 | Harness 工程入门教程（0→1） | ✅ |
| [Noob-stupid/dsh-plugin-hub](https://github.com/Noob-stupid/dsh-plugin-hub) | 128 | 插件门控/升级安全机制（市场热开关移植源） | ✅ |

### 2.2 高星插件（生态里最流行的插件实例）

> 说明：这些是**插件本身**，不是"源"。列出是为了判断"哪些插件值得从源收进来"。收录进本库时按 `dsh-plugin外部/` 归档。

| 插件仓库 | ★ | 用途 |
|---|---:|---|
| [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) | 70,070 | 装上即可免登录/免 API Key 用 DeepSeek V4.1 Flash 等模型 |
| [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | 42,028 | 火山：自进化上下文数据库（Agent 记忆/上下文统一） |
| [alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | 38,063 | 女娲：蒸馏任何人的思维方式为可运行技能 |
| [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | 29,254 | 华数设计：一句话拿回可交付的网页/App 原型 |
| [titanwings/distilly](https://github.com/titanwings/distilly) | 26,524 | 蒸馏思维模式为可复用 Skills |
| [esengine/DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix) | 36,159 | 复杂工程任务的可靠编码 agent |
| [nexu-io/open-design](https://github.com/nexu-io/open-design) | 107,225 | 协作式 AI 设计工作台（本地优先） |
| [tt-a1i/archify](https://github.com/tt-a1i/archify) | 95,653 | 把想法/计划/代码库变成交互式可视化文档 |
| [Tencent/WeKnora](https://github.com/Tencent/WeKnora) | 37,210 | 腾讯：文档 → 知识库问答平台 |
| [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) | 35,721 | GPT Image 提示词与案例库 |
| [yikart/AiToEarn](https://github.com/yikart/AiToEarn) | 27,606 | AI 变现工具集 |
| [farion1231/cc-switch](https://github.com/farion1231/cc-switch) | 153,675 | 跨平台桌面多合一助手（Claude Code 等） |
| [EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS) | 13,888 | 可移植 Agent 记忆层（本地优先） |
| [MemTensor/MemOS](https://github.com/MemTensor/MemOS) | 12,362 | 自进化记忆 OS |

> 注：上表为调研快照，**星数不代表质量/安全性**。收录前仍需按本库惯例做凭据扫描与 better-skill 体检（见 `PLUGINS.md` 维护约定）。

---

## 三、其它 Agent 平台的插件/扩展市场（跨平台参考）

| 平台 | 入口 | 说明 |
|---|---|---|
| **SkillHub** | https://www.skillhub.club/ | 技能（SKILL.md）发现平台：20 类目 × Workflow、S/A/B 评级、Skill Stacks。**与插件市场不同维度**（技能 vs 插件），但分类方法可复用 |
| **ClawHub** | https://clawhub.ai/skills | OpenClaw 生态技能/插件市场：16 类目 + 按应用浏览 + Audits |
| **VS Code Marketplace** | https://marketplace.visualstudio.com/ | 编辑器扩展（非 Agent 插件，注意区分） |
| **Obsidian Community Plugins** | https://obsidian.md/plugins | Obsidian 插件目录（含大量 Claude/Agent 相关插件） |
| **JetBrains Marketplace** | https://plugins.jetbrains.com/ | IDE 插件目录 |
| **Homebrew** | https://formulae.brew.sh/ | CLI 工具包管理（配合 `auto-cli-conf.md` 的 brew 安装命令） |
| **npm registry** | https://www.npmjs.com/search?q=dsh | 插件的实际分发渠道（`dsh plugin add <包名>` 的源） |
| **PyPI** | https://pypi.org/ | Python 系 CLI/Agent 工具源 |

---

## 四、选型建议（何时用哪个源）

| 我要…… | 用哪个 |
|---|---|
| 给 DSH 装插件市场本身 | `dsh plugin --profile web add dshmarket`（即 `dsh-market/dsh-market`） |
| 找精选插件 | awesome-dsh-plugin 清单（dsh-market 默认源，本库 `dsh-plugin外部/dshmarket` 同源） |
| 按目录浏览插件/查更新 | dshmarket.com 或 dshget.com |
| 找桌面宿主（免装 Node） | dataelement/dsh-desktop 或 anywhere-labs/dsh-desktop |
| 手机跑 DSH | ccch1mneyyy/dsh-Go |
| 找新插件收进本库 | §2.2 高星清单 → 验证后归档到 `dsh-plugin外部/` 并更新 `PLUGINS.md` |
| 查技能（非插件） | SkillHub / ClawHub（见 `amyskills/README.md` 外部来源表） |

---

## 五、验证与去重记录

- **10/10 核心仓库** 经 GitHub API 验证存在（★ 已核）：awesome-dsh-plugin / dsh-market / dsh-plugin-hub / deepseek-harness / 2 个 dsh-desktop / dsh-Go / learn-harness-engineering / nuwa-skill / dsh-our-free-model。
- **目录站点**：`dshmarket.com` 200、`dshget.com` 200；`awesome-dsh-plugin.com/plugins.json` 首试超时、**重试 200**（count 10,581，2026-11-11）。
- **失效/待核链接**（如实标注）：
  - `bobby-sheng.github.io/dshget-data/` → **404**（应改从 `bobby-sheng/dshget-data` 仓库根取数据）
  - `dsh-market.github.io/` → **404**（市场文档应走 `dshmarket.com` 或 GitHub 仓库 README）
  - `vercel/ai-sdk-skills` → 404（沿自 `auto-cli-conf.md` 的历史记录，非本次新验）
- **去重**：`dshmarket` 与 `awesome-dsh-plugin` 是"市场应用"与"清单源"的关系，非重复项；`dsh-our-free-model` 与火山/官方模型源是插件，不是模型仓库，已分开标注。

---

## 六、维护约定

1. **新源先验证再入库**：仓库存在 + 目录可达 + 无凭据泄漏，才写入本文件；
2. **只记录、不执行**：本文件中的安装命令均为待执行清单，Agent 读到不得自动运行；
3. 插件实例收进来走 `dsh-plugin外部/` + `PLUGINS.md` + `_plugins.json`，源信息只放本文件；
4. 星数与描述以 GitHub API 为准，定期（建议每月）复验一次并更新日期。

---
*整理于 2026-11-12 · 调研与验证由 DeepSeek Harness 完成 · 本文件属于 amyskills 库的「插件源」维度，与技能维度分开记录 · 同日更名为 auto-plugin-conf.md 并新增 §七 优秀插件前 50 清单*

---

## 七、优秀插件清单（前 50 · 2026-11-12 调研）

> 来源：GitHub 高星搜索（DSH/Harness/Claude Code 插件生态）+ awesome-dsh-plugin 目录 + 本库已装 6 插件。★ 为实测快照。**带「已装」标注的 6 个是本机 web profile 实际安装的（见 `PLUGINS.md`）。**

| # | 插件 / 仓库 | ★ | 一句话定位 | 状态 |
|---|---|---:|---|---|
| 1 | [dshmarket](https://github.com/dsh-market/dsh-market) | 12,029 | DSH 可视化插件市场 | **已装** v1.73.17 |
| 2 | [dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy) | 3,000+ | WorkBuddy 模型接入（积分/账号池/签到） | **已装** v5.21.3 |
| 3 | [dsh-whyai](https://github.com/henry-y-c/dsh-whyai) | 500+ | 安全受限 WhyAI CLI 插件 | **已装** v0.3.1 |
| 4 | [dsh-im](https://github.com/xmanrui/dsh-im) | 5,000+ | IM 消息桥接（微信/飞书/企微/钉钉等 10+） | **已装** v5.10.0 |
| 5 | [openspec-agents](https://github.com/ifrankwang/openspec-agents) | 1,000+ | OpenSpec 规范驱动变更提案 | **已装** v1.5.0 |
| 6 | [superpowers-dsh](https://github.com/laynechai/superpowers-dsh) | 2,000+ | TDD/系统化调试/评审方法论技能集 | **已装** v0.5.0 |
| 7 | [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) | 70,070 | 免登录免 Key 用 DeepSeek 系模型 | 候选 |
| 8 | [mksglu/context-mode](https://github.com/mksglu/context-mode) | 33,896 | 控制工具输出是否进上下文 | 候选 |
| 9 | [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) | 29,172 | Claude Code 状态 HUD | 候选 |
| 10 | [getagentseal/codeburn](https://github.com/getagentseal/codeburn) | 11,773 | AI 编码 token 用量追踪 | 候选 |
| 11 | [wshobson/agents](https://github.com/wshobson/agents) | 42,427 | Claude Code 插件/agents/skills 合集 | 候选 |
| 12 | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | 49,920 | 浏览器自动化（可作 DSH 插件源） | 候选 |
| 13 | [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) | 22,149 | computer use 桌面控制 | 候选 |
| 14 | [googleworkspace/cli](https://github.com/googleworkspace/cli) | 32,264 | Google Workspace CLI（GWS） | 候选 |
| 15 | [larksuite/cli](https://github.com/larksuite/cli) | 18,063 | 飞书官方 CLI | 候选 |
| 16 | [DingTalk-Real-AI/dingtalk-workspace-cli](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli) | 3,982 | 钉钉 Workspace CLI | 候选 |
| 17 | [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | 42,028 | 火山自进化上下文数据库 | 候选 |
| 18 | [EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS) | 13,888 | 可移植 Agent 记忆层 | 候选 |
| 19 | [MemTensor/MemOS](https://github.com/MemTensor/MemOS) | 12,362 | 自进化记忆 OS | 候选 |
| 20 | [topoteretes/cognee](https://github.com/topoteretes/cognee) | 33,256 | AI 记忆平台 | 候选 |
| 21 | [OrchestratorInc/agent-orchestrator](https://github.com/OrchestratorInc/agent-orchestrator) | 14,454 | 多 agent 编排/监督 | 候选 |
| 22 | [alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | 38,063 | 思维蒸馏技能 | 候选 |
| 23 | [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | 29,260 | 设计交付 | 候选 |
| 24 | [titanwings/distilly](https://github.com/titanwings/distilly) | 26,525 | 思维模式蒸馏 | 候选 |
| 25 | [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | 113,201 | Agent 管理应用 | 候选 |
| 26 | [farion1231/cc-switch](https://github.com/farion1231/cc-switch) | 153,694 | 跨平台桌面多合一助手 | 候选 |
| 27 | [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) | 35,751 | DSH Electron 桌面宿主 | 候选 |
| 28 | [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | 18,196 | DSHDesktop 桌面版 | 候选 |
| 29 | [ccch1mneyyy/dsh-Go](https://github.com/ccch1mneyyy/dsh-Go) | 19,763 | 手机运行 DSH | 候选 |
| 30 | [iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi) | 34,221 | OpenClaw 24/7 协同工作台 | 候选 |
| 31 | [NanmiCoder/cc-haha](https://github.com/NanmiCoder/cc-haha) | 15,406 | Claude Code 桌面工作台 | 候选 |
| 32 | [chenhg5/cc-connect](https://github.com/chenhg5/cc-connect) | 16,328 | 桥接本地 AI 编码 agent | 候选 |
| 33 | [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) | 8,786 | 多 AI agent 终端管理 | 候选 |
| 34 | [runkids/skillshare](https://github.com/runkids/skillshare) | 3,045 | 技能/MCP/插件跨 CLI 同步 | 候选 |
| 35 | [xingkongliang/skills-manager](https://github.com/xingkongliang/skills-manager) | 7,453 | 桌面技能管理 | 候选 |
| 36 | [graykode/abtop](https://github.com/graykode/abtop) | 3,845 | AI agent 监控 | 候选 |
| 37 | [akitaonrails/ai-memory](https://github.com/akitaonrails/ai-memory) | 15,684 | agent 长期记忆 | 候选 |
| 38 | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 56,851 | AI 科学家技能包 | 候选 |
| 39 | [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 79,287 | Claude 技能精选 | 候选 |
| 40 | [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) | 53,698 | OpenClaw 技能合集 | 候选 |
| 41 | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | 49,565 | 2955+ 可复用技能 | 候选 |
| 42 | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 46,927 | Anthropic 官方插件目录 | 候选 |
| 43 | [zhaoxuya520/reverse-skill](https://github.com/zhaoxuya520/reverse-skill) | 44,516 | 逆向工程/渗透技能 | 候选 |
| 44 | [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 35,938 | 817 网络安全技能 | 候选 |
| 45 | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 33,916 | Vercel 官方 agent 技能 | 候选 |
| 46 | [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 33,359 | Claude Code 模板注册中心 | 候选 |
| 47 | [NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector) | 25,480 | AI 技能安全扫描器 | 候选 |
| 48 | [citrolabs/ego-lite](https://github.com/citrolabs/ego-lite) | 22,560 | AI agent 专用浏览器 | 候选 |
| 49 | [Orchestra-Research/AI-Research-SKILLs](https://github.com/Orchestra-Research/AI-Research-SKILLs) | 14,466 | AI 研究技能库 | 候选 |
| 50 | [lsdefine/GenericAgent](https://github.com/lsdefine/GenericAgent) | 14,409 | 自进化技能树 agent | 候选 |

> 注：★ 标 "N,000+" 的为约数（本轮搜索快照未逐条命中精确值，取最近观测值）。#2–#5 的精确值见 `PLUGINS.md`。**收录任何候选插件前必须凭据扫描 + 出处核验**（见 §六 维护约定）。

### 7.1 按用途速查

| 场景 | 首选 |
|---|---|
| 模型接入 | dsh-connect-workbuddy（已装）/ dsh-our-free-model |
| 插件市场 | dshmarket（已装） |
| IM/办公 | dsh-im（已装）/ larksuite/cli / dingtalk-workspace-cli / googleworkspace/cli |
| 记忆/上下文 | OpenViking / EverOS / MemOS / cognee / ai-memory / context-mode |
| 多 agent 管理 | claude-squad / agent-orchestrator / claude_codex_bridge |
| 桌面宿主 | dsh-desktop（两个版本）/ dsh-Go / cc-haha |
| 安全 | SkillSpector / Anthropic-Cybersecurity-Skills / reverse-skill |
