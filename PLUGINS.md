# AmySkills · 插件维度台账（PLUGINS）

> **本文件只记录「插件」这一个维度**；技能维度见 [`SKILLS.md`](./SKILLS.md)。二者同属 `amyskills` 一个库。
> 共 **6** 个插件（0 自建 / 6 外部），按功能子类分组。

## 插件 ≠ 技能

| | 插件（Plugin / Bundle） | 技能（Skill） |
|---|---|---|
| 形态 | npm 包，含 `cordis.patch.yml`（部分用 src/ 结构） | 目录，含 `SKILL.md` |
| 安装 | `dsh plugin --profile <profile> add <包名>` | 放进 `~/.agents/skills/` |
| 作用 | 扩展 Harness 宿主（路由/UI/模型供应商/工具） | 扩展 Agent 知识与工作流 |
| 库内位置 | `dsh-plugin自建/` `dsh-plugin外部/` | `skill自建/` `skill外部/` |
| 台账 | 本文件 + `_plugins.json` | `SKILLS.md` + `_skills.json` |

## 当前已安装插件清单（打包自本机 web profile）

| # | 插件 | 版本 | 归属 | 功能分类 | 说明 | 出处 |
|---|---|---|---|---|---|---|
| 1 | `dshmarket` | 1.73.17 | 外部 | 插件市场与治理 | DSH 可视化插件市场：浏览/搜索/一键安装/更新/禁用/备份恢复/诊断 | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) |
| 2 | `dsh-connect-workbuddy` | 5.21.3 | 外部 | 模型与服务接入 | 把本机登录的 WorkBuddy 模型（国内版/国际版）接入 DSH 模型选择器，含积分倍率、账号池、签到 | [dingminhua/dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy) |
| 3 | `dsh-whyai` | 0.3.1 | 外部 | 外部服务与工具 | 安全受限的 WhyAI CLI 工具插件 | [henry-y-c/dsh-whyai](https://github.com/henry-y-c/dsh-whyai) |
| 4 | `@xmanrui/dsh-im` | 5.10.0 | 外部 | 消息与通信 | IM 消息桥接：微信/飞书/企微/钉钉/QQ/Telegram/WhatsApp/Slack/Discord/Matrix 等 | [xmanrui/dsh-im](https://github.com/xmanrui/dsh-im) |
| 5 | `@ifrankwang/openspec-agents` | 1.5.0 | 外部 | 开发工作流 | OpenSpec 配套 AI 编码代理（规范驱动的变更提案工作流） | [ifrankwang/openspec-agents](https://github.com/ifrankwang/openspec-agents) |
| 6 | `superpowers-dsh` | 0.5.0 | 外部 | 开发工作流 | Superpowers for DSH：TDD / 系统化调试 / 计划执行 / 代码评审等工程方法论技能集 | [laynechai/superpowers-dsh](https://github.com/laynechai/superpowers-dsh) |

### 自建插件（0 个）

当前插件全部为外部社区/GitHub 引入，**没有自建插件**。`dsh-plugin自建/` 目录保留为空，供以后开发自己的插件时归类。

### 外部插件（6 个）· 按功能子类

#### 外部服务与工具 · 1 个

- **`dsh-whyai`** v0.3.1 — 安全受限的 WhyAI CLI 工具插件
  - 出处：[henry-y-c/dsh-whyai](https://github.com/henry-y-c/dsh-whyai) · License: MIT · 入口: `lib/index.js` · 含 `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-whyai/`](./dsh-plugin外部/dsh-whyai)（0.1 MB）

#### 开发工作流 · 2 个

- **`@ifrankwang/openspec-agents`** v1.5.0 — OpenSpec 配套 AI 编码代理（规范驱动的变更提案工作流）
  - 出处：[ifrankwang/openspec-agents](https://github.com/ifrankwang/openspec-agents) · License: MIT · 入口: `./src/core/index.ts` · 含 `cordis.patch.yml`: 否
  - 归档路径：[`dsh-plugin外部/openspec-agents/`](./dsh-plugin外部/openspec-agents)（3.2 MB）
- **`superpowers-dsh`** v0.5.0 — Superpowers for DSH：TDD / 系统化调试 / 计划执行 / 代码评审等工程方法论技能集
  - 出处：[laynechai/superpowers-dsh](https://github.com/laynechai/superpowers-dsh) · License: MIT · 入口: `lib/index.js` · 含 `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/superpowers-dsh/`](./dsh-plugin外部/superpowers-dsh)（2.3 MB）

#### 插件市场与治理 · 1 个

- **`dshmarket`** v1.73.17 — DSH 可视化插件市场：浏览/搜索/一键安装/更新/禁用/备份恢复/诊断
  - 出处：[dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) · License: MIT · 入口: `lib/index.js` · 含 `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dshmarket/`](./dsh-plugin外部/dshmarket)（3.0 MB）

#### 模型与服务接入 · 1 个

- **`dsh-connect-workbuddy`** v5.21.3 — 把本机登录的 WorkBuddy 模型（国内版/国际版）接入 DSH 模型选择器，含积分倍率、账号池、签到
  - 出处：[dingminhua/dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy) · License: MIT · 入口: `lib/index.js` · 含 `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-connect-workbuddy/`](./dsh-plugin外部/dsh-connect-workbuddy)（5.5 MB）

#### 消息与通信 · 1 个

- **`@xmanrui/dsh-im`** v5.10.0 — IM 消息桥接：微信/飞书/企微/钉钉/QQ/Telegram/WhatsApp/Slack/Discord/Matrix 等
  - 出处：[xmanrui/dsh-im](https://github.com/xmanrui/dsh-im) · License: MIT · 入口: `./lib/index.js` · 含 `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-im/`](./dsh-plugin外部/dsh-im)（27.4 MB）

## 安装/恢复方式

在 `amyskills` 仓库根目录执行：

```bash
dsh plugin --profile web add <包名>                     # 从 npm 装最新版（推荐）
dsh plugin --profile web add ./dsh-plugin外部/<插件目录>  # 从本库离线装
```

或在 DSH Web 的插件市场（`dshmarket`）里搜索插件名一键安装。

## 维护约定

1. **一个库、两个维度**：插件改动走 `dsh-plugin自建/` `dsh-plugin外部/` + `PLUGINS.md`；技能改动走 `skill自建/` `skill外部/` + `SKILLS.md`；两份台账互不混放。
2. 新装插件后更新 `PLUGINS.md` 与 `_plugins.json`（作者/版本/出处/归属/功能分类）。
3. 自建插件放 `dsh-plugin自建/`，必须附 `package.json`（建议同时有 `cordis.patch.yml`）。
4. 打包时排除 `node_modules/` 与运行时状态（`state.json` / `log.ndjson` / `.env*`），避免夹带凭据与本机构建产物。

- 机器可读台账：[`_plugins.json`](./_plugins.json) · 全库总览见 [`README.md`](./README.md)。

---
*整理于 2026-11-11 · 采集自本机 web profile*