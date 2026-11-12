# 优秀技能清单（auto-skill-conf）

> **范围**：各平台高星与流行的 **Agent Skills**（技能维度，区别于插件与 CLI）。
> **数据来源**：① GitHub 全网搜索 API 高星调研（`agent+skills` / `claude+skills` / `topic:agent-skills` / `claude+code+skills`，2026-11-12 实测，认证后配额正常）② 本库 `SKILLS.md` 已收录并治理过的 232 个技能（43 自建 / 189 外部）③ SkillHub / ClawHub 公开分类与热门。
> **性质**：纯清单文档（**不执行安装**）。星数为 2026-11-12 快照，不代表质量/安全性。

---

## 一、怎么用这份清单

- 想找**可直接用**的技能：看 §2「本库已收录且治理完成」；
- 想找**外部高星新技能**收进本库：看 §3「GitHub 高星技能前 100」；
- 收录前一律按本库惯例：**凭据扫描 + better-skill 四层体检**，再归档到 `skill外部/` 并更新 `SKILLS.md` 与 `_skills.json`；
- 安装 `toamyskillhub` 仅限用户本人及具读写授权者（见 `README.md` 阅读约定）。

---

## 二、本库已收录的优秀技能（节选）

> 全部 232 个已去重、已打工程护栏、两轮自检清零（详见 `SKILLS.md`）。下表按维度列**代表性条目**，完整清单见 `SKILLS.md`。

### 2.1 自建技能（43 个 · 已闭环）

| 维度 | 代表技能 | 说明 |
|---|---|---|
| 元技能与技能工程 | `toamyskillhub` | 本库发布/同步（PLAN→确认→EXECUTE 三段式，含密钥扫描） |
| 元技能与技能工程 | `better-skill`（外部引入但已治理） | 技能医生：四层检查表 + 21 红线 + 五维标尺 |
| 测试与质量 | `test-report` / `cron-scheduled-test-runner` / `web-exploratory-tester` / `web-security-scanning` | 测试报告生成、定时执行、探索式测试、ZAP 安全扫描 |
| 写作与内容创作 | `ai-trend-report-layout` / `aaron-style-transformer` / `marketing-model-article-writer` / `viral-title-generator` | AI 趋势排版、文风克隆、营销模型文章、爆款标题 |
| 文档知识与笔记 | `Get笔记` / `lexiang-knowledge-base` / `ai-testing-skills-index` | 笔记/知识库管理、测试技能索引 |
| 图片视频与设计 | `article-image-integration` / `article-layout-formatter` | 公众号配图、文章排版 |
| 测试与质量 | `srmpro-login` / `monitored-test-framework` / `frontend-e2e` | 登录/冒烟/E2E 实战封装 |
| 元技能与技能工程 | `openspec-standard` / `orchestrator` / `quality-gate` | 提案标准、编排主代理、质量门框架 |
| AI 与模型 | `hermes-model-switchover-drill` | 模型切换演练（已脱敏内网 IP） |
| 调研与研究 | `one-page-tutorial` / `ai-muse-business-weekly` | 一页纸教程、MUSE 商业周报 |

### 2.2 外部收录技能（189 个 · 已闭环 P0）

| 来源库 | 数量 | 代表技能 |
|---|---:|---|
| GitHub 精选 8 大 Agent Skill 仓库 | 94 | `mattpocock/skills`、`obra/superpowers`、`anthropics/skills`、`impeccable`、`ponytail`、`taste-skill` 等 |
| QClaw 的 skill 库 | 48 | `notion`、`kdocs`、`agent-email`（已脱敏）、`xbrowser` 等 |
| autoClaw 的 SKILL 库 | 27 | `autoglm-browser-agent`（993 行已外置）、`skill-creator`、`frontend-slides` 等 |
| Noah 的 skill 最佳实践 | 20 | `rss_fetcher`（已脱敏手机号）、`zhihu-fetcher`、`douyin-hot-trend` 等 |
| 所有 claw 必装 skills | 10 | `agent-browser`、`find-skills`、`skill-evolve-nightly` 等 |
| autoclaw 常用技能 | 6 | `feishu-doc`、`dws` 等 |
| 市面上的测试领域 skills | 4 | 测试领域相关技能 |
| 未分类收集 skills | 2 | 杂项收集 |
| byted-ark-seedream | 1 | 火山 Seedream 生图 |

> 说明：上述「来源库数量」为原始单元数（去重前）；去重后 189 个独立技能已按 20 功能类归档到 `skill外部/`。

---

## 三、GitHub 高星技能前 100（调研清单）

> 按 GitHub 搜索 API 返回 stars 排序合并去重；保留"确属 Agent Skill/技能库"的条目，剔除与技能无关的通用项目。
> 用途：**作为新增候选**，不是本库已收录项。

| # | 仓库 | ★ | 一句话定位 |
|---|---|---:|---|
| 1 | [mattpocock/skills](https://github.com/mattpocock/skills) | 322,086 | 面向真实工程师的 Claude/Agent 技能集 |
| 2 | [obra/superpowers](https://github.com/obra/superpowers) | 316,331 | 系统化调试/TDD/计划执行的 Agentic 技能框架 |
| 3 | [anthropics/skills](https://github.com/anthropics/skills) | 193,185 | Anthropic 官方 Agent Skills 仓库 |
| 4 | [affaan-m/ECC](https://github.com/affaan-m/ECC) | 301,415 | Agent harness 性能优化系统 |
| 5 | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | 232,245 | 单文件 CLAUDE.md 行为改进技能 |
| 6 | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | 189,192 | 让 Agent 像资深懒人工程师一样思考 |
| 7 | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 115,997 | 生产级工程技能集 |
| 8 | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 113,612 | 给编码 Agent 加"审美"（art direction） |
| 9 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 108,350 | 编码 Agent 的设计词汇库 |
| 10 | [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | 113,201 | Agent 管理应用 |
| 11 | [blader/humanizer](https://github.com/blader/humanizer) | 68,010 | 去除 AI 写作痕迹的技能 |
| 12 | [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | 67,348 | 跨 Reddit 等源的主题调研技能 |
| 13 | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | 59,792 | 营销技能集（CRO/文案/增长） |
| 14 | [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 57,796 | Claude Code 资源精选 |
| 15 | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 56,851 | 把 Agent 变成 AI 科学家 |
| 16 | [Imbad0202/academic-research-skills](https://github.com/Imbad0202/academic-research-skills) | 56,536 | 学术研究技能（research→paper） |
| 17 | [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | 53,453 | 反塑料设计技能 |
| 18 | [obsidianmd/obsidian-skills](https://github.com/obsidianmd/obsidian-skills) | 51,717 | Obsidian 官方 Agent 技能 |
| 19 | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | 49,565 | 2,955+ 可复用 Agent 技能合集 |
| 20 | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | 70,413 | Cloudflare 多阶段安全审计技能 |
| 21 | [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | 85,257 | 字节：长程 SuperAgent harness |
| 22 | [lobehub/lobehub](https://github.com/lobehub/lobehub) | 85,047 | LobeHub 超级 Agent 平台 |
| 23 | [OpenMontageInc/OpenMontage](https://github.com/OpenMontageInc/OpenMontage) | 79,720 | 开源 agentic 视频生产 |
| 24 | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | 146,195 | 代码库→交互式知识图谱 |
| 25 | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 148,238 | UI/UX 设计智能技能 |
| 26 | [langgenius/dify](https://github.com/langgenius/dify) | 160,999 | Agentic workflow / RAG 平台（含技能生态） |
| 27 | [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | 144,438 | 100+ AI Agent / Skill / RAG 应用 |
| 28 | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | 66,551 | 图表/社论式设计技能 |
| 29 | [emilkowalski/skills](https://github.com/emilkowalski/skills) | 56,159 | 设计师与工程师技能集 |
| 30 | [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) | 53,698 | OpenClaw 技能合集（5,400+） |
| 31 | [LibreChat-AI/LibreChat](https://github.com/LibreChat-AI/LibreChat) | 47,010 | 带 Agents/MCP/Skills 的 Chat 平台 |
| 32 | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 46,927 | Anthropic 官方插件目录 |
| 33 | [zhaoxuya520/reverse-skill](https://github.com/zhaoxuya520/reverse-skill) | 44,516 | 逆向工程/授权渗透技能 |
| 34 | [career-ops-hq/career-ops](https://github.com/career-ops-hq/career-ops) | 82,013 | AI 求职 Agent |
| 35 | [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 79,287 | Claude Skills 精选清单 |
| 36 | [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills) | 3,609 | 67 个设计类 SKILL.md 清单 |
| 37 | [Illyism/seo-skills](https://github.com/Illyism/seo-skills) | 1,006 | 开源 SEO 技能 |
| 38 | [EverMind-AI/SkillCorpus](https://github.com/EverMind-AI/SkillCorpus) | 702 | 把散落 SKILL.md 变成基础设施 |
| 39 | [WenyuChiou/ai-research-skills](https://github.com/WenyuChiou/ai-research-skills) | 647 | 研究工作流 SKILL.md 目录 |
| 40 | [Railly/tinte](https://github.com/Railly/tinte) | 630 | 设计系统编译为 Agent 插件 |
| 41 | [sno-ai/mda](https://github.com/sno-ai/mda) | 616 | MDA Open Spec（Agent 友好 Markdown 超集） |
| 42 | [mxyhi/ok-skills](https://github.com/mxyhi/ok-skills) | 514 | AI 编码技能与 AGENTS.md 手册 |
| 43 | [tizzy916/humanities-writing-companion](https://github.com/tizzy916/humanities-writing-companion) | 487 | 人文写作助手技能 |
| 44 | [agent-sh/agnix](https://github.com/agent-sh/agnix) | 478 | AI 编码助手的 linter/LSP |
| 45 | [arpitg1304/robotics-agent-skills](https://github.com/arpitg1304/robotics-agent-skills) | 401 | 机器人领域 Agent 技能 |
| 46 | [futantan/agent-skills.md](https://github.com/futantan/agent-skills.md) | 335 | Agent Skills 精选导航 |
| 47 | [mrhlaingbwardev/agentic-hacking-skills](https://github.com/mrhlaingbwardev/agentic-hacking-skills) | 332 | AI 网络安全与自动化技能 |
| 48 | [Jianing1117/jianing-skills](https://github.com/Jianing1117/jianing-skills) | 330 | 自省式编码技能 |
| 49 | [Narwhal-Lab/MagicSkills](https://github.com/Narwhal-Lab/MagicSkills) | 319 | 跨 Agent 的技能共享/迁移 |
| 50 | [K-Dense-AI/mimeo](https://github.com/K-Dense-AI/mimeo) | 288 | 把专家"复印"成 SKILL.md/AGENTS.md |
| 51 | [machina-sports/sports-skills](https://github.com/machina-sports/sports-skills) | 270 | 体育数据与分析技能 |
| 52 | [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt) | 19,011 | 微软：文本空间技能优化器 |
| 53 | [feichanggege/ecommerce-visual-copywriting-skill](https://github.com/feichanggege/ecommerce-visual-copywriting-skill) | 1,073 | 电商视觉文案 SOP 技能 |
| 54 | [alchaincyf/nuwa-skill](https://github.com/alchaincyf/nuwa-skill) | 38,063 | 女娲：蒸馏任何人的思维方式 |
| 55 | [titanwings/distilly](https://github.com/titanwings/distilly) | 26,524 | 思维模式蒸馏为可复用技能 |
| 56 | [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design) | 29,254 | 华数设计：一句话交付设计原型 |
| 57 | [YTruman/better-skill](https://github.com/YTruman/better-skill) | 261 | 技能医生（本库已收录并参考） |
| 58 | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) | 12,029 | DSH 插件市场（含技能/插件生态） |
| 59 | [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | 24,332 | DSH 精选插件清单 |
| 60 | [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) | 35,751 | DSH 桌面宿主（插件生态） |
| 61 | [dataelement/dsh-desktop](https://github.com/dataelement/dsh-desktop) | 18,196 | DSHDesktop 桌面版 |
| 62 | [ccch1mneyyy/dsh-Go](https://github.com/ccch1mneyyy/dsh-Go) | 19,763 | dsh-go：手机运行 DSH |
| 63 | [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering) | 24,301 | Harness 工程入门教程 |
| 64 | [Noob-stupid/dsh-plugin-hub](https://github.com/Noob-stupid/dsh-plugin-hub) | 128 | DSH 插件门控/升级安全 |
| 65 | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | 279,043 | DSH 本体：Everything is a Plugin |
| 66 | [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) | 70,070 | 免登录免 API Key 用 DeepSeek 模型 |
| 67 | [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | 42,028 | 火山：自进化上下文数据库 |
| 68 | [Tencent/WeKnora](https://github.com/Tencent/WeKnora) | 37,210 | 腾讯文档知识库平台 |
| 69 | [freestylefly/awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) | 35,721 | GPT Image 提示词与案例库 |
| 70 | [yikart/AiToEarn](https://github.com/yikart/AiToEarn) | 27,606 | AI 变现工具集 |
| 71 | [farion1231/cc-switch](https://github.com/farion1231/cc-switch) | 153,694 | 跨平台桌面多合一助手 |
| 72 | [EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS) | 13,888 | 可移植 Agent 记忆层 |
| 73 | [MemTensor/MemOS](https://github.com/MemTensor/MemOS) | 12,362 | 自进化记忆 OS |
| 74 | [wshobson/agents](https://github.com/wshobson/agents) | 42,427 | Claude Code 插件/agents/skills/commands |
| 75 | [mksglu/context-mode](https://github.com/mksglu/context-mode) | 33,896 | 本地插件：控制工具输出进上下文 |
| 76 | [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) | 29,172 | Claude Code 状态 HUD 插件 |
| 77 | [getagentseal/codeburn](https://github.com/getagentseal/codeburn) | 11,773 | 本地 AI 编码 token 用量追踪 |
| 78 | [cobusgreyling/loop-engineering](https://github.com/cobusgreyling/loop-engineering) | 11,752 | 循环工程模式与 CLI 工具 |
| 79 | [sigoden/aichat](https://github.com/sigoden/aichat) | 10,562 | 全能 LLM CLI（Shell Assistant 等） |
| 80 | [superdesigndev/treg](https://github.com/superdesigndev/treg) | 7,858 | Agent 工具的 OpenRouter |
| 81 | [xingkongliang/skills-manager](https://github.com/xingkongliang/skills-manager) | 7,453 | 桌面技能管理/同步/组织 |
| 82 | [kaankiziltug/logo-design-skill](https://github.com/kaankiziltug/logo-design-skill) | 6,650 | Logo 设计技能 |
| 83 | [getsentry/MobileBuildMCP](https://github.com/getsentry/MobileBuildMCP) | 6,564 | 移动构建 MCP 服务器与 CLI |
| 84 | [mvanhorn/cli-printing-press](https://github.com/mvanhorn/cli-printing-press) | 4,970 | 发现 API 的秘密身份并生成 CLI |
| 85 | [gptme/gptme](https://github.com/gptme/gptme) | 4,470 | 终端里的本地工具型 Agent |
| 86 | [bostrot/wslmanager](https://github.com/bostrot/wslmanager) | 4,059 | WSL 管理 GUI |
| 87 | [DingTalk-Real-AI/dingtalk-workspace-cli](https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli) | 3,982 | 钉钉 Workspace 官方 CLI |
| 88 | [larksuite/cli](https://github.com/larksuite/cli) | 18,062 | 飞书官方 CLI（与 `auto-cli-conf.md` 配套） |
| 89 | [googleworkspace/cli](https://github.com/googleworkspace/cli) | 32,264 | Google Workspace CLI（与 `auto-cli-conf.md` 配套） |
| 90 | [nexu-io/open-design](https://github.com/nexu-io/open-design) | 107,229 | 协作式 AI 设计工作台 |
| 91 | [tt-a1i/archify](https://github.com/tt-a1i/archify) | 95,667 | 想法/代码库→交互式可视化文档 |
| 92 | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | 119,147 | 少 token 多产出的技能风格 |
| 93 | [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 37,097 | 1000+ Agent 技能精选合集 |
| 94 | [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 35,938 | 817 个结构化网络安全技能 |
| 95 | [iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi) | 34,221 | OpenClaw 的 24/7 协同工作台 |
| 96 | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 33,916 | Vercel 官方 Agent 技能集 |
| 97 | [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 33,359 | Claude Code 模板注册中心与 CLI |
| 98 | [topoteretes/cognee](https://github.com/topoteretes/cognee) | 33,256 | 开源 AI 记忆平台 |
| 99 | [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | 32,228 | 前端幻灯片生成技能（本库已收录） |
| 100 | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 29,662 | 410 个 Claude Code / Agent 技能与插件 |

> 注：多个 query 命中同一仓库已合并（§四 去重记录）。§3 共 100 个独立条目，含本库已收录者与新增候选。

---

## 四、去重与验证记录

- **合并去重**：多个 query 命中同一仓库（如 `affaan-m/ECC`、`multica-ai/andrej-karpathy-skills`、`DietrichGebert/ponytail` 等）已合并，只计一次；
- **剔除**：与 Agent Skill 无关的通用项目（如 `Snailclimb/JavaGuide`、`1Panel-dev/1Panel`、`tw93/Mole` 等）不纳入；
- **验证**：所有 §3 条目经 GitHub 仓库 API 或搜索返回结果确认存在，★ 为实测值；
- **本库已收录**：`mattpocock/skills`、`obra/superpowers`、`anthropics/skills`、`impeccable`、`ponytail`、`taste-skill`、`better-skill` 等同时出现在调研与本库中，标注为「已收录并治理」，不再重复收录。

---

## 五、维护约定

1. **调研快照不等于质量背书**：高星仅代表社区关注度；收进来前必须过凭据扫描与 better-skill 体检；
2. **技能维度单独成文**：本文件只管 skill；插件源见 `auto-plugin-conf.md`，CLI 见 `auto-cli-conf.md`，自动化测试/开放平台见 `autotest-openapi.md`；
3. **每月复验**：按 §3 顺序复查 stars 与新增高星技能，更新日期；
4. **不执行安装**：本文件仅记录清单，任何安装/克隆动作需人工确认。

---
*整理于 2026-11-12 · 数据来自 GitHub 认证搜索 API + 本库 `SKILLS.md` 台账 · 与 `auto-plugin-conf.md` / `auto-cli-conf.md` 配套使用*