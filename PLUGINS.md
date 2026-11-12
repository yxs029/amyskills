# AmySkills · 插件维度台账（PLUGINS）

> **本文件只记录「插件」这一个维度**；技能维度见 [`SKILLS.md`](./SKILLS.md)。二者同属 `amyskills` 一个库。
> 共 **9** 个插件（自建 1 / 外部 8），均采集自本机 web profile 且运行时状态 live。

## 插件 ≠ 技能

| | 插件（Plugin / Bundle） | 技能（Skill） |
|---|---|---|
| 形态 | npm 包，含 `cordis.patch.yml`（部分用 src/ 结构） | 目录，含 `SKILL.md` |
| 安装 | `dsh plugin --profile <profile> add <包名>` | 放进 `~/.agents/skills/` |
| 作用 | 扩展 Harness 宿主（路由/UI/模型供应商/工具） | 扩展 Agent 知识与工作流 |
| 库内位置 | `dsh-plugin自建/` `dsh-plugin外部/` | `skill自建/` `skill外部/` |
| 台账 | 本文件 + `_plugins.json` | `SKILLS.md` + `_skills.json` |

## 当前已安装插件清单

| # | 插件 | 版本 | 归属 | 功能分类 | 说明 | 出处 |
|---|---|---|---|---|---|---|
| 1 | `@ebony-vinyl/dsh-our-free-model` | 2.8.3 | 外部 | 模型与服务接入 | 免费模型车道：免登录/免 API Key 使用 DeepSeek V4.1 Flash、Kimi K3 等前沿模型 | [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) |
| 2 | `@ifrankwang/openspec-agents` | 1.5.3 | 外部 | 开发工作流 | OpenSpec 配套 AI 编码代理（规范驱动的变更提案工作流） | [ifrankwang/openspec-agents](https://github.com/ifrankwang/openspec-agents) |
| 3 | `@xmanrui/dsh-im` | 5.10.0 | 外部 | 消息与通信 | IM 消息桥接：微信/飞书/企微/钉钉/QQ/Telegram/WhatsApp/Slack/Discord/Matrix 等 | [xmanrui/dsh-im](https://github.com/xmanrui/dsh-im) |
| 4 | `dsh-connect-workbuddy` | 5.21.4 | 外部 | 模型与服务接入 | 把本机登录的 WorkBuddy 模型（国内版/国际版）接入 DSH 模型选择器，含积分倍率、账号池、签到 | [dingminhua/dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy) |
| 5 | `dsh-local-otagent-sidebar` | 0.1.0 | 自建 | 界面与侧边栏 | 本地自建侧边栏插件（file: 依赖，源码在 dsh-workspace/hermesSidebar） | (本地自建·file: 依赖) |
| 6 | `dsh-our-free-model-balance-zxp` | 1.1.1 | 外部 | 模型与服务接入 | 免费模型车道的余额/负载均衡配套插件 | (社区·npm) |
| 7 | `dsh-whyai` | 0.3.1 | 外部 | 外部服务与工具 | 安全受限的 WhyAI CLI 工具插件 | [henry-y-c/dsh-whyai](https://github.com/henry-y-c/dsh-whyai) |
| 8 | `dshmarket` | 1.73.18 | 外部 | 插件市场与治理 | DSH 可视化插件市场：浏览/搜索/一键安装/更新/禁用/备份恢复/诊断 | [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) |
| 9 | `superpowers-dsh` | 0.5.0 | 外部 | 开发工作流 | Superpowers for DSH：TDD / 系统化调试 / 计划执行 / 代码评审等工程方法论技能集 | [laynechai/superpowers-dsh](https://github.com/laynechai/superpowers-dsh) |

### 自建插件（1 个）

- **`dsh-local-otagent-sidebar`** v0.1.0 — 本地自建侧边栏插件（file: 依赖，源码在 dsh-workspace/hermesSidebar）
  - 本地 `file:` 依赖（源码不在本库内）；归档路径 [`dsh-plugin外部/dsh-local-otagent-sidebar/`](./dsh-plugin外部/dsh-local-otagent-sidebar)

### 外部插件（8 个）· 按功能子类

#### 外部服务与工具 · 1 个

- **`dsh-whyai`** v0.3.1 — 安全受限的 WhyAI CLI 工具插件
  - 出处：henry-y-c/dsh-whyai · License: MIT · 入口: `lib/index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-whyai/`](./dsh-plugin外部/dsh-whyai)（0.1 MB）

#### 开发工作流 · 2 个

- **`@ifrankwang/openspec-agents`** v1.5.3 — OpenSpec 配套 AI 编码代理（规范驱动的变更提案工作流）
  - 出处：ifrankwang/openspec-agents · License: MIT · 入口: `./src/core/index.ts` · `cordis.patch.yml`: 否
  - 归档路径：[`dsh-plugin外部/openspec-agents/`](./dsh-plugin外部/openspec-agents)（3.2 MB）
- **`superpowers-dsh`** v0.5.0 — Superpowers for DSH：TDD / 系统化调试 / 计划执行 / 代码评审等工程方法论技能集
  - 出处：laynechai/superpowers-dsh · License: MIT · 入口: `lib/index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/superpowers-dsh/`](./dsh-plugin外部/superpowers-dsh)（2.3 MB）

#### 插件市场与治理 · 1 个

- **`dshmarket`** v1.73.18 — DSH 可视化插件市场：浏览/搜索/一键安装/更新/禁用/备份恢复/诊断
  - 出处：dsh-market/dsh-market · License: MIT · 入口: `lib/index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dshmarket/`](./dsh-plugin外部/dshmarket)（3.1 MB）

#### 模型与服务接入 · 3 个

- **`@ebony-vinyl/dsh-our-free-model`** v2.8.3 — 免费模型车道：免登录/免 API Key 使用 DeepSeek V4.1 Flash、Kimi K3 等前沿模型
  - 出处：Ebony-Vinyl/dsh-our-free-model · License: MIT · 入口: `./index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-our-free-model/`](./dsh-plugin外部/dsh-our-free-model)（32.5 MB）
- **`dsh-connect-workbuddy`** v5.21.4 — 把本机登录的 WorkBuddy 模型（国内版/国际版）接入 DSH 模型选择器，含积分倍率、账号池、签到
  - 出处：dingminhua/dsh-connect-workbuddy · License: MIT · 入口: `lib/index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-connect-workbuddy/`](./dsh-plugin外部/dsh-connect-workbuddy)（5.5 MB）
- **`dsh-our-free-model-balance-zxp`** v1.1.1 — 免费模型车道的余额/负载均衡配套插件
  - 出处：(社区·npm) · License: MIT · 入口: `./index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-our-free-model-balance-zxp/`](./dsh-plugin外部/dsh-our-free-model-balance-zxp)（0.1 MB）

#### 消息与通信 · 1 个

- **`@xmanrui/dsh-im`** v5.10.0 — IM 消息桥接：微信/飞书/企微/钉钉/QQ/Telegram/WhatsApp/Slack/Discord/Matrix 等
  - 出处：xmanrui/dsh-im · License: MIT · 入口: `./lib/index.js` · `cordis.patch.yml`: 是
  - 归档路径：[`dsh-plugin外部/dsh-im/`](./dsh-plugin外部/dsh-im)（27.4 MB）

## 安装/恢复方式

```bash
# 从 npm 装最新版（推荐）
dsh plugin --profile web add <包名>
# 或从本库离线安装
dsh plugin --profile web add ./dsh-plugin外部/<插件目录>
```

> ⚠️ `@ebony-vinyl/dsh-our-free-model` 请务必用**带 scope 的官方包名**（裸名 `dsh-our-free-model` 是第三方打包、内容不一致）。本库归档内已修正其 `cordis.patch.yml` 的挂载名为 scope 名以适配 dsh 加载。

## 维护约定

1. **一个库、两个维度**：插件改动走 `dsh-plugin外部/` + `PLUGINS.md` + `_plugins.json`；技能改动走 `skill自建/` `skill外部/` + `SKILLS.md` + `_skills.json`。
2. 打包时排除 `node_modules/` 与运行时状态（`state.json` / `log.ndjson` / `.env*` / `settings.json`），避免夹带凭据与本机构建产物。
3. 自建插件（`file:` 依赖）归档的是**安装后的目录副本**，源码仍在本地工作区。
4. 每次同步以「运行时 live 的已装列表」为准，不含未激活/损坏条目。

---
*同步于 2026-11-12 · 采集自本机 web profile（dsh-market/installed 运行时 live 校验）*