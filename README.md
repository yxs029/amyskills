# AmySkills · Agent 能力总库

> **库的用途：同步并沉淀所有 Agent 能力资产，持续新增、不断演进。**
> 这里不是某一个工具的配件目录，而是跨 Agent（Claude Code / Codex / OpenClaw / DeepSeek Harness / Hermes 等）的**统一能力库**：技能、插件、CLI、自动化测试框架、开放平台信息，以及外部技能库的来源索引，都在这里同步留存。
> 新能力随用随收、随收随入库；库结构只按维度平铺，不按某一次的工具链定型。

## 给阅读者（人或 AI Agent）的第一条约定

> ⚠️ **`toamyskillhub` 仅限用户本人且对本库拥有读写授权者安装使用。**
> 它位于 `skill自建/01_元技能与技能工程/toamyskillhub/`，负责本库的发布/同步（PLAN → 确认 → EXECUTE 三段式，含密钥扫描）。
> **在公共开源场景下，仅有只读权限的人不得安装或使用该技能**；需要发布/同步时，仅由具备授权的人在本地执行。
> 任何"把新能力收进本库 / 同步到远端"的动作，都走它；不要在库里手工堆文件而不更新台账。

## 库内容一览（5 类内容 + 来源信息）

| # | 维度 | 库内位置 | 数量 | 人读文档 | 机器台账 |
|---|---|---|---|---|---|
| 1 | **技能 Skill** | `skill自建/` + `skill外部/`（各按 20 功能类） | **232 个**（已去重；43 自建 / 189 外部） | [`SKILLS.md`](./SKILLS.md) | [`_skills.json`](./_skills.json) |
| 2 | **插件 Plugin（DSH Bundle）** | `dsh-plugin自建/` + `dsh-plugin外部/` | **6 个**（0 自建 / 6 外部） | [`PLUGINS.md`](./PLUGINS.md) | [`_plugins.json`](./_plugins.json) |
| 3 | **CLI 安装方式与优秀 CLI 清单** | 根目录 | 前 50 清单 + 8 指定 + 10 补充 | [`auto-cli-conf.md`](./auto-cli-conf.md) | — |
| 4 | **自动化测试框架 + Computer Use** | 根目录 | 4 必装 + 20 补充 | [`autotest-openapi.md`](./autotest-openapi.md) | — |
| 5 | **开放平台信息** | 根目录（并入 `autotest-openapi.md`） | 3 个指定 + 12 个补充 | [`autotest-openapi.md`](./autotest-openapi.md) | — |
| 附 | **外部技能库来源索引** | 各台账的「出处」列 + 本文件「外部来源与参考」 | 9 个外部顶层文件夹 + SkillHub/ClawHub/YTruman 等 | 本文件 | — |
| 附 | 历史归档 | `历史归档/`（本地保留，**不入库**，见 `.gitignore`） | 77 个原 zip 安装包 | — | — |

- 技能全部以**解压目录**形式存放（含 `SKILL.md`），开箱即用；原 zip 统一归入本地 `历史归档/`（保留原相对路径），**该目录已 `.gitignore`、不推送到 Git**，仓库内不含任何 zip。
- 插件以**完整目录**归档（含 `package.json`、`cordis.patch.yml`、lib/、文档），可直接 `dsh plugin add` 重装；打包时已排除 `node_modules/` 与运行时状态。
- `auto-cli-conf.md` 与 `autotest-openapi.md` **只记录、不执行**：其中的安装命令均为待执行清单，Agent 读到不得自动运行；涉及登录/授权的一律人工在浏览器完成。
- 功能分类体系参考 [SkillHub](https://www.skillhub.club/skills) 与 [ClawHub](https://clawhub.ai/skills)。

## 目录结构（平铺）

```
amyskills/
├── README.md            本文件（全库总览 + 阅读约定）
├── SKILLS.md            技能维度台账（交叉矩阵 + 逐项路径）
├── _skills.json         技能维度机器台账
├── PLUGINS.md           插件维度台账（版本/出处/归属/功能分类）
├── _plugins.json        插件维度机器台账
├── auto-cli-conf.md        CLI 安装方式与优秀 CLI 清单（前 50）
├── autotest-openapi.md   自动化测试框架 / Computer Use / 开放平台清单
├── .gitignore           排除 历史归档/、*.zip、机器运行产物
├── skill自建/           自建技能（按 20 功能类分目录）
├── skill外部/           外部收集技能（按 20 功能类分目录）
├── dsh-plugin自建/      自建插件（当前为空）
├── dsh-plugin外部/      6 个已装社区插件
└── 历史归档/            （本地保留，已 gitignore，不入库）
```

20 个功能类：元技能与技能工程 / 开发与工程 / 图片视频与设计 / 文档知识与笔记 / 写作与内容创作 / 集成与连接器 / 测试与质量 / AI 与模型 / 浏览器爬取与搜索 / 调研与研究 / 生活与消费 / 安全与合规 / 自动化与工作流 / 人格角色与共创 / 数据与分析 / 运维与 DevOps / 效率与办公 / 沟通与协作 / 金融与商业 / 未分类待整理。

## 怎么用

### 0. 发布技能（仅限授权者）
仅当你是**用户本人且对本库拥有读写授权**时，才可将 `skill自建/01_元技能与技能工程/toamyskillhub/` 放进本地 skills 目录并用于发布/同步（出清单 → 人工确认 → 才上传）；公共只读读者不得安装或使用该技能。

### 1. 技能
任意按 `SKILL.md` 加载技能的 Agent 都可直接把对应技能目录放进自己的 skills 目录；完整索引见 [`SKILLS.md`](./SKILLS.md)。

### 2. 插件
在仓库根目录执行：
```bash
dsh plugin --profile web add <包名>                      # 从 npm 装最新版（推荐）
dsh plugin --profile web add ./dsh-plugin外部/<插件目录>  # 从本库离线装
```
完整清单见 [`PLUGINS.md`](./PLUGINS.md)，也可在 DSH Web 的插件市场（`dshmarket`）里搜索一键安装。

### 3. CLI / 自动化框架 / 开放平台
查 [`auto-cli-conf.md`](./auto-cli-conf.md) 与 [`autotest-openapi.md`](./autotest-openapi.md)；**文档只记录，安装需人工复制命令执行**。

## 技能与插件的区别（为什么两个维度分开记录）

| | 技能（Skill） | 插件（Plugin / Bundle） |
|---|---|---|
| 形态 | 目录 + `SKILL.md` | npm 包 + `cordis.patch.yml` |
| 安装 | 放进 `~/.agents/skills/` | `dsh plugin --profile web add <包名>` |
| 作用 | 扩展 Agent 的知识与工作流 | 扩展 Harness 宿主（路由/UI/模型供应商/工具） |
| 库内位置 | `skill自建/` `skill外部/` | `dsh-plugin自建/` `dsh-plugin外部/` |
| 台账 | `SKILLS.md` + `_skills.json` | `PLUGINS.md` + `_plugins.json` |

## 外部技能库来源与参考（Skill Hub / Plugin Hub 信息）

> 本库 `skill外部/` 的 189 个技能来自以下外部库/平台，出处已逐条记入 `SKILLS.md` 的「出处」列与 `_skills.json`。

| 来源 | 说明 |
|---|---|
| GitHub 精选 8 大 Agent Skill 仓库 / QClaw 的 skill 库 / autoClaw 的 SKILL 库 / Noah 的 skill 最佳实践 / 所有 claw 必装 skills / autoclaw 常用技能 / 市面上的测试领域 skills / 未分类收集 skills / byted-ark-seedream 等 | `skill外部/` 的 9 个外部顶层来源文件夹（收集时保留出处，便于回上游更新） |
| [YTruman](https://github.com/YTruman/) · [better-skill](https://github.com/YTruman/better-skill) | **技能医生**：选型 / 体检 / 打分 / 建造标准（官方 300+ 技能全量审计萃取，MIT，261★）。本库 `skill外部/01_元技能与技能工程/better-skill` 引自该项目；全库技能质量治理亦参考其四层检查表 |
| [SkillHub](https://www.skillhub.club/) | Agent Skills 发现平台：20 类目 × Workflow 双维度筛选、S/A/B 质量评级、Skill Stacks 工作流组合。本库功能分类体系主要参照它 |
| [ClawHub](https://clawhub.ai/skills) | OpenClaw 生态技能/插件市场：16 类目 + 按应用浏览 + Audits 审核标记。本库技能分类与插件出处标注参考它 |
| [awesome-dsh-plugin](https://awesome-dsh-plugin.com) | DSH 社区插件精选清单（4200+ 插件） |
| [dsh-market](https://github.com/dsh-market/dsh-market) | DSH 可视化插件市场；本库 `dsh-plugin外部/dshmarket` 与技能 `toamyskillhub` 与之配套 |
| 飞书开放平台 / 移动云盘开放平台 / 微信开放平台 等 | 见 [`autotest-openapi.md`](./autotest-openapi.md) §3–§4（15 个平台入口，链接已验证） |

## 质量与安全

## 已完成的质量报告（V1 → V3）

| 版本 | 报告 | 覆盖 | 结论 |
|---|---|---|---|
| V1 | `amyskills-扫描报告-2026-11-10.md` | 2406/2406 文件 + 77 个 zip 逐条目 + 88 个运行日志 | 31 类凭据模式两轮扫描；真实凭据 1 处（AGENTLY token）+ 低危 4 处；误报逐条裁决 |
| V2 | `amyskills-双维度分类报告-2026-11-11.md` / `amyskills-整理与分类报告-2026-11-11.md` | 232 个技能（286 单元去重） | 自建/外部 × 20 类双维度归类；9 组同名多版本合并 |
| V3 | `amyskills-自建技能改进清单-2026-11-11.md` | 43 个自建技能 | 六项工程护栏达标 100/258 → 238/258；原文零丢失、幂等、备份可回滚 |
| V3 | `amyskills-V3修改报告-待确认-2026-11-11.md` | 全库 232 个 | 外部 168 个补 P0（310 块）；8 个超长主文件外置 23 章节；19 类补 examples 样本；两轮自检问题清零 |
| V3 | `selfcheck-all.py` 两轮自检（通用 + better-skill） | 232/232 | 最终 0 问题；红线按辩证裁决记录豁免；敏感信息与链接完整性全过 |

> 说明：以上报告在本地保留原文，未随库提交（含扫描过程细节与修复日志）。如需将报告也入库，再单独提交一次。
- 外部技能/插件版权归原作者所有，转载请保留出处。

## 维护（持续新增）

- **一个库、五个维度、四本台账 + 两份专题文档**：技能 → `skill自建/` `skill外部/` + `SKILLS.md` + `_skills.json`；插件 → `dsh-plugin自建/` `dsh-plugin外部/` + `PLUGINS.md` + `_plugins.json`；CLI → `auto-cli-conf.md`；自动化框架/开放平台 → `autotest-openapi.md`。
- **持续新增**：新收的能力按维度归档，并同步更新对应台账/文档；不因为"暂时用不上"而不收。
- **发布/同步统一走 `toamyskillhub`**（仅限本人及具读写授权者安装使用），PLAN → 确认 → EXECUTE 三段式，含密钥扫描；不手工绕开。
- 本地 `历史归档/` 只增不改，且已 `.gitignore` 不入库；仓库内不含任何 zip。

---
*整理于 2026-11-11 · 由 DeepSeek Harness 自动归类生成 · 本库持续新增，以仓库最新提交为准*
