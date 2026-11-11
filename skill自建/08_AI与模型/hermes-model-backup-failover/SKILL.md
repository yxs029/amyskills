---
name: hermes-model-backup-failover
description: "把一台 Hermes 的大模型配置方案（主模型 + 多级 fallback_providers 容灾链 + providers 模型目录 + custom_providers 扩展）连同备份/回滚机制，可复现地迁移集成到另一台 Hermes。覆盖火山方舟 Agent Plan / Coding Plan、MiniMax-M3(1M)、DeepSeek、OpenRouter 等 OpenAI/Anthropic 双协议接入，config.yaml 四块结构（model/providers/fallback_providers/custom_providers），.env 密钥分离，时间戳备份 + golden 回滚，第三方 CLI 覆盖主模型的坑，curl→config check→AIAgent 三级验证。当用户说『把我的模型配置/备份方案迁到另一个 hermes』『给 hermes 配主模型+备用模型容灾』『模型配置备份回滚』时使用。"
version: 1.1.0
author: 测测 (CeCe) for 袁雪松
license: MIT
metadata:
  hermes:
    tags: [hermes, configuration, model, fallback, failover, backup, rollback, migration, volcengine]
    related_skills: [hermes-agent, hermes-upgrade, hermes-volcengine-fallback]
---

# Hermes 大模型配置 · 备份 · 多级容灾迁移方案

把「主模型 + 多级 fallback 容灾链 + 备份/回滚」整套方案，从一台 Hermes 无密钥泄漏地复刻到另一台。

> **v1.1 修订（2026-09-20 本机校准）**：① 修复 `verify-model.sh` 旧版 curl 鉴权头被打码成 `Bearer ***` 且引号断裂、L1 必失败的 bug，改为 `local auth="Authorization: Bearer $key"` 单变量传头；② 模板 coding-plan 模型目录补全为真实 11 个；③ custom_providers 补真实存在的 `minimax`(Agent Plan Anthropic) 端点。
> **实测记录（2026-09-20，老大已澄清）**：本机 `VOLCENGINE_API_KEY` 走 Coding Plan 的 MiniMax-M3 返回 `400 InvalidSubscription`，**实为 MiniMax 周限额用尽触发（老大确认当周额度已用完），不是订阅过期、也不是 key 失效**——火山这个错误码有歧义，配额/限额问题也会回它。判断要点：①同一 key 走 Agent Plan 主模型正常 → key 本身有效；②OpenRouter 兜底 200；③等周限额重置或换额度后重跑 L1 应恢复 200。**切勿一见 InvalidSubscription 就判订阅失效/换 key**，先去控制台核对套餐与周配额用量。

## 0. 这个方案长什么样（老大的生产拓扑）

- **主模型**：火山方舟 **Agent Plan** 的 `ark-code-latest`（Anthropic 协议，base_url 不带版本号）。
- **容灾链 `fallback_providers`（列表，可多级）**：
  1. 火山方舟 **Coding Plan** 的 `MiniMax-M3`（1M 上下文，OpenAI 协议 `/api/coding/v3`）；
  2. `openrouter/free`（兜底中的兜底）。
- **`providers` 模型目录**：两个方舟 plan 各挂 11 个模型 + `context_length`，`/model` 可随时切。
- **`custom_providers` 扩展**：DeepSeek 1M、longCat、stepfun 等额外 OpenAI 兼容端点。
- **密钥分离**：真实 key 只放 `~/.hermes/.env`（chmod 600），config 里用 `${VAR}` 引用；skill / 模板 / 备份交付件里**绝不出现明文 key**。
- **备份**：每次改动前 `cp` 时间戳备份 + 维护一个 `config.yaml.golden` 已知可用版本，回滚一条 `cp` 搞定。

> ⚠️ **版本分水岭（实测）**：新版 Hermes（`_config_version: 22`，2026-08 后）用 **`fallback_providers:` 列表，支持多级 fallback 链**；官方 `hermes-agent` skill 里写的旧版是**单个 `fallback_model`，只能配一个备胎**。迁移前先在目标机 `grep -E 'fallback_(model|providers)' ~/.hermes/config.yaml` 确认是哪种结构，按对应模板配。

---

## 1. 迁移前置检查（目标机）

```bash
hermes --version                       # 确认版本；老版本只有 fallback_model
hermes config path                     # 一般是 ~/.hermes/config.yaml
grep -nE '_config_version|fallback_(model|providers)' ~/.hermes/config.yaml
ls -la ~/.hermes/.env 2>/dev/null      # 密钥文件
```

- 看到 `fallback_providers:`（列表）→ 用本 skill 多级链模板。
- 只看到 `fallback_model:`（单对象）→ 只能配一个备胎，或建议先 `hermes update`。

---

## 2. 四步接入（在目标机执行）

### 步骤 1 —— 先备份（铁律，任何改动之前）

```bash
bash scripts/hermes-model-backup.sh
# 产出：~/.hermes/config.yaml.bak.YYYYMMDD-HHMMSS
# 首次可把当前可用版本存为 golden：
# bash scripts/hermes-model-backup.sh --golden
```

### 步骤 2 —— 把密钥写进 `~/.hermes/.env`（不要进 config 明文、不要进 skill）

```bash
chmod 600 ~/.hermes/.env
# 需要哪些变量取决于你启用哪些 provider（见 references/rollback-runbook.md 的变量对照表）
# 老大方案用到：VOLCENGINE_API_KEY / OPENROUTER_API_KEY / MINIMAX_CN_API_KEY 等
```

### 步骤 3 —— 合并四块配置到 `~/.hermes/config.yaml`

复制 `templates/config-model-blocks.yaml` 里对应的块，**按目标机实际 key 选择密钥形态**：

- 首选 `${VOLCENGINE_API_KEY}` 环境变量引用（可移植、安全）；
- 若该 Hermesis 版本 fallback 路径不展开 `${...}`（见第 5 节坑表），退回在 `providers.*.api_key` 写明文 key，但 config 必须 `chmod 600` 且该文件**永不打包交付**。

四块职责：

1. **`model:`** —— 主模型三件套 `default / provider / base_url`。
   - Anthropic 协议：base_url **不带** `/v3`（如 `/api/plan`），并在 provider 里设 `api_mode: anthropic_messages`。
   - OpenAI 协议：base_url **带**版本（如 `/api/plan/v3`、`/api/coding/v3`），`api_mode: chat_completions`。
2. **`providers:`** —— key=自定义 provider 名（`model.provider` 必须与此**完全一致、大小写敏感**）；挂 `models:` 目录 + 每个模型 `context_length`。
3. **`fallback_providers:`**（新版列表）—— 每项 `provider / model / base_url / api_mode / api_key_env / context_length`。主模型遇到 **429 / 529 / 503 / 连接失败**时按顺序降级；**内容审核、prompt 非法、工具报错不触发**。
4. **`custom_providers:`**（可选）—— 额外 OpenAI/Anthropic 兼容端点（DeepSeek 1M、longCat、stepfun…）。

> 用 `patch` / 手工编辑合并，**不要整文件覆盖**目标机 config；也**不要跑**第三方 CLI 的 `enter hermes-agent` 自动配置（会重写 `model:`，见坑表）。

### 步骤 4 —— 三级验证（curl → config → 真实 Agent）

```bash
bash scripts/verify-model.sh           # curl 直连每个端点 + hermes config check
```

- **L1 curl**：证明 key 和端点通。
- **L2 `hermes config check` + `hermes config show|head`**：确认 YAML 合法、`model.default` 仍是你的主模型（没被覆盖）。
- **L3 真实 AIAgent 往返**（可选但推荐）：fallback 只在主模型挂掉后才触发，平时测不到；用 `scripts/verify-model.sh --agent` 临时把主模型指向备用 provider 跑一轮真实对话再还原（脚本自动备份+还原）。

验证通过后，把这份存为新的 golden：`bash scripts/hermes-model-backup.sh --golden`。

---

## 3. 备份与回滚（日常保命）

详见 `references/rollback-runbook.md`。核心两条：

```bash
# 回滚到最近一次时间戳备份
bash scripts/hermes-model-backup.sh --rollback-latest
# 回滚到已知可用 golden（模型被第三方 CLI 写坏时用）
bash scripts/hermes-model-backup.sh --rollback-golden
hermes config show | head -20          # 回滚后必须核对 model.default
```

- 每次跑第三方安装器 / `hermes update` / 手改 config **之前**都先备份。
- 老大机器上已有 16+ 份 `config.yaml.bak.*`，命名统一 `YYYYMMDD-HHMMSS`，golden 用固定名 `config.yaml.golden`。
- 改完**重启生效**：gateway 用 `/restart`，CLI 退出重进。

---

## 4. 交付到另一台 Hermes 的清单

把整个 skill 目录拷给目标机即可（**不含任何明文密钥**）：

- [ ] 目标机版本/结构已确认（第 1 节）
- [ ] 四块 config 已按模板合并（`model/providers/fallback_providers/custom_providers`）
- [ ] `.env` 已单独、离线给到对方并 `chmod 600`（**不走 skill 包、不走聊天**）
- [ ] 三级验证通过（curl / config check / 至少一次真实对话）
- [ ] golden 备份已建立
- [ ] 已告知对方：第三方 CLI 自动配置会覆盖主模型、改完要重启

安装到对方 Hermes：把目录放进 `~/.hermes/skills/devops/hermes-model-backup-failover/`，新会话即可被检索到。

---

## 5. 坑表（都是实测踩过的）

- **`${ENV}` 在部分版本 fallback 路径不展开**：报 `Could not resolve authentication method…`。对策：测试时直接 `AIAgent(api_key=os.environ['VAR'])`；或 config 明文 key（chmod 600，单机）；或升级 Hermes。
- **协议/base_url 配错 → 404/auth 失败**：`anthropic_messages` 用不带版本的 base_url（客户端自动补 `/v1/messages`）；`chat_completions` 用带 `/v3` 的。同一主机两套协议并存，去掉 `/v3` 即切 Anthropic。
- **Anthropic 协议默认强 thinking**：`max_tokens:256` 会被 thinking 吃光，`text` 为空。curl 测试给 `max_tokens>=1024` 或 body 带 `"thinking":{"type":"disabled"}`。
- **第三方 CLI 覆盖 `model:`**：`ark-helper enter hermes-agent`、claude-code、opencode 安装器会把主模型改成自己。永远手工合并 + 先备份。
- **provider 名大小写敏感**：`model.provider` 必须和 `providers:` 下 key 逐字符一致。
- **只有一个 fallback 槽（旧版）**：`fallback_model` 不支持链式 A→B→C；要多级先升级到 `fallback_providers` 列表版。
- **显示出来的 key 是打码的**：`security.redact_secrets: true` 会让终端里 key 显示成 `ark-xxxx-****`，文件里其实是完整的。核对真实值用 `awk` 抽取，别信 grep 回显。
- **fallback 不响应内容审核/工具错误**：只对 429/529/503/连接失败生效；主模型「慢」不会触发。
- **BOM 编码**：Windows 上手改 config 存成带 BOM 的 UTF-8 会 HTTP 400，确保无 BOM。

## 6. 文件索引

- `templates/config-model-blocks.yaml` —— 四块配置模板（密钥全 `${VAR}` 占位，含老大生产拓扑注释）
- `scripts/hermes-model-backup.sh` —— 时间戳备份 / golden / 回滚
- `scripts/verify-model.sh` —— curl 直连 + config check（`--agent` 跑真实往返）
- `references/rollback-runbook.md` —— 备份回滚手册 + 环境变量对照表 + 协议/base_url 速查
