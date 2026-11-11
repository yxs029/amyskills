# AmySkills · Skill & Plugin Library

个人 Agent 资产库，**一个库、两个维度**：**技能（Skill）** 与 **插件（Plugin / DSH Bundle）**。顶层目录全部平铺，两类台账各自独立成文、放在库根。

## 库内容一览

| 维度 | 目录 | 数量 | 人读台账 | 机器读台账 |
|---|---|---|---|---|
| **技能 Skill** | `skill自建/` + `skill外部/`（各按 20 功能类） | **232 个**（已去重；43 自建 / 189 外部） | [`SKILLS.md`](./SKILLS.md) | [`_skills.json`](./_skills.json) |
| **插件 Plugin** | `dsh-plugin自建/` + `dsh-plugin外部/` | **6 个**（0 自建 / 6 外部） | [`PLUGINS.md`](./PLUGINS.md) | [`_plugins.json`](./_plugins.json) |
| 历史归档 | `历史归档/`（本地保留，**不入库**，见 `.gitignore`） | 77 个原 zip 安装包 | — | — |

- 技能全部以**解压目录**形式存放（含 `SKILL.md`），开箱即用；原 zip 统一归入本地 `历史归档/`（保留原相对路径），**该目录已 `.gitignore`、不推送到 Git**。
- 插件以**完整目录**归档（含 `package.json`、`cordis.patch.yml`、lib/、文档），可直接 `dsh plugin add` 重装；打包时已排除 `node_modules/` 与运行时状态。
- 功能分类体系参考 [SkillHub](https://www.skillhub.club/skills) 与 [ClawHub](https://clawhub.ai/skills)。

## 目录结构（平铺）

```
amyskills/
├── README.md            本文件（全库总览，合并自技能/插件两份说明）
├── SKILLS.md            技能维度台账（交叉矩阵 + 逐项路径）
├── _skills.json         技能维度机器台账
├── PLUGINS.md           插件维度台账（版本/出处/归属/功能分类）
├── _plugins.json        插件维度机器台账
├── skill自建/           自建技能（按 20 功能类分目录）
├── skill外部/           外部收集技能（按 20 功能类分目录）
├── dsh-plugin自建/      自建插件（当前为空）
├── dsh-plugin外部/      6 个已装社区插件
└── 历史归档/            原 zip 安装包（本地保留，已 gitignore，不入库）
```

20 个功能类：元技能与技能工程 / 开发与工程 / 图片视频与设计 / 文档知识与笔记 / 写作与内容创作 / 集成与连接器 / 测试与质量 / AI 与模型 / 浏览器爬取与搜索 / 调研与研究 / 生活与消费 / 安全与合规 / 自动化与工作流 / 人格角色与共创 / 数据与分析 / 运维与 DevOps / 效率与办公 / 沟通与协作 / 金融与商业 / 未分类待整理。

## 怎么用

### 技能
任意按 `SKILL.md` 加载技能的 Agent（Claude Code / Codex / OpenClaw / DeepSeek Harness 等）都可直接把对应技能目录放进自己的 skills 目录；完整索引见 [`SKILLS.md`](./SKILLS.md)。

### 插件
在仓库根目录执行：
```bash
dsh plugin --profile web add <包名>                      # 从 npm 装最新版（推荐）
dsh plugin --profile web add ./dsh-plugin外部/<插件目录>  # 从本库离线装
```
完整清单见 [`PLUGINS.md`](./PLUGINS.md)。也可在 DSH Web 的插件市场（`dshmarket`）里搜索一键安装。

## 技能与插件的区别（为什么两个维度分开记录）

| | 技能（Skill） | 插件（Plugin / Bundle） |
|---|---|---|
| 形态 | 目录 + `SKILL.md` | npm 包 + `cordis.patch.yml` |
| 安装 | 放进 `~/.agents/skills/` | `dsh plugin --profile web add <包名>` |
| 作用 | 扩展 Agent 的知识与工作流 | 扩展 Harness 宿主（路由/UI/模型供应商/工具） |
| 库内位置 | `skill自建/` `skill外部/` | `dsh-plugin自建/` `dsh-plugin外部/` |
| 台账 | `SKILLS.md` + `_skills.json` | `PLUGINS.md` + `_plugins.json` |

## 外部来源与参考（Skill Hub / Plugin Hub 信息）

| 来源 | 说明 |
|---|---|
| [YTruman](https://github.com/YTruman/) · [better-skill](https://github.com/YTruman/better-skill) | **技能医生**：AI Agent 技能的选型 / 体检 / 打分 / 建造标准（官方 300+ 技能全量审计萃取，MIT，261★）。本库 `skill外部/01_元技能与技能工程/better-skill` 引自该项目；技能质量治理亦参考其四层检查表。 |
| [SkillHub](https://www.skillhub.club/) | Agent Skills 发现平台：20 类目 × Workflow 双维度筛选、S/A/B 质量评级、Skill Stacks 工作流组合。本库功能分类体系主要参照它。 |
| [ClawHub](https://clawhub.ai/skills) | OpenClaw 生态技能/插件市场：16 类目 + 按应用浏览 + Audits 审核标记。本库技能分类与插件出处标注参考它。 |
| [awesome-dsh-plugin](https://awesome-dsh-plugin.com) | DSH 社区插件精选清单（4200+ 插件）。 |
| [dsh-market](https://github.com/dsh-market/dsh-market) | DeepSeek Harness 可视化插件市场；本库 `dsh-plugin外部/dshmarket` 与技能 `toamyskillhub` 均与之配套。 |

## 质量与安全

- 全库技能已做密钥泄漏扫描与 better-skill 四层体检（见 `amyskills-扫描报告-2026-11-10.md` / `amyskills-双维度分类报告-2026-11-11.md`）。
- ⚠️ 本地 `历史归档/QClaw的skill库/skills.zip` 内曾发现真实凭据（`agent-email/.env` 的 AGENTLY token），已在库内副本脱敏；该目录不入库。**仍请确认已吊销原 token**（远端旧 Git 对象里可能仍有）。
- 插件打包前已排除 `node_modules/`、`.env*`、运行状态，预检无凭据泄漏。
- 外部技能/插件版权归原作者所有，转载请保留出处。

## 维护

- **一个库、两个维度、四本台账**：技能改动 → `skill自建/` `skill外部/` + `SKILLS.md` + `_skills.json`；插件改动 → `dsh-plugin自建/` `dsh-plugin外部/` + `PLUGINS.md` + `_plugins.json`。
- 新增技能：放进 `skill自建/<功能类>/<技能名>/`（含 `SKILL.md`）；新增插件：放进 `dsh-plugin自建/` 或 `dsh-plugin外部/`。
- 发布/同步：使用本库 `toamyskillhub` 技能（PLAN → 确认 → EXECUTE 三段式，含密钥扫描）。
- 本地 `历史归档/` 只增不改，且已 `.gitignore` 不入库；仓库内不含任何 zip。

---
*整理于 2026-11-11 · 由 DeepSeek Harness 自动归类生成*
