# 备份 / 回滚 Runbook

> 适用：Hermes 大模型配置（`~/.hermes/config.yaml` 的 model/providers/fallback_providers/custom_providers 四块）。
> 原则：**改前必备份、密钥不入库、回滚必核对、改完要重启。**

## 1. 备份文件命名约定

| 文件 | 含义 |
|---|---|
| `config.yaml.bak.YYYYMMDD-HHMMSS` | 每次改动前的时间戳快照，可保留多份 |
| `config.yaml.golden` | 已知「能正常工作」的基线版本，回滚首选 |
| `config.yaml` | 当前生效配置（chmod 600） |

一键脚本：`scripts/hermes-model-backup.sh`
- `--golden`：把当前 config 存为 golden
- `--rollback-latest`：回滚到最近时间戳备份
- `--rollback-golden`：回滚到 golden

## 2. 什么时候必须备份

- 跑任何第三方安装器 / `xxx enter hermes-agent`（ark-helper、claude-code、opencode 等）**之前**
- `hermes update` 之前（可另设 `updates.pre_update_backup: true`）
- 手工改 `model:` / `providers:` / `fallback_*` 之前
- 切换主模型做 fallback 演练之前（verify 脚本会自动备份+还原）

## 3. 标准回滚步骤

```bash
# 1) 先看有哪些备份
ls -lt ~/.hermes/config.yaml.bak.* ~/.hermes/config.yaml.golden 2>/dev/null

# 2) 回滚（二选一）
bash scripts/hermes-model-backup.sh --rollback-golden      # 推荐：已知可用
bash scripts/hermes-model-backup.sh --rollback-latest      # 或：最近一次

# 3) 合法性 + 主模型核对（关键！防止回滚到也被写坏的版本）
hermes config check
hermes config show | head -20        # model.default 必须是你的主模型，不是第三方的

# 4) 重启生效
#   gateway：会话里发 /restart
#   CLI：退出重进
```

回滚后仍异常 → 换下一个更早的时间戳备份重复 2~4 步。

## 4. 密钥 / 环境变量对照

真实值只放 `~/.hermes/.env`（`chmod 600`），通过 config 的 `${VAR}` 或 fallback 的 `api_key_env: 变量名` 引用。

| 用途 | .env 变量名 | 用在哪 |
|---|---|---|
| 火山方舟 Agent/Coding Plan | `VOLCENGINE_API_KEY` | providers 两个 plan + fallback[0] + deepseek custom |
| OpenRouter 兜底 | `OPENROUTER_API_KEY` | fallback[1] |
| MiniMax CN（直连时） | `MINIMAX_CN_API_KEY` | 自定义 minimax provider |
| 长猫 LongCat | `LONGCAT_API_KEY` | custom_providers.longCat |
| 阶跃 StepFun | `STEPFUN_API_KEY` | custom_providers.stepfun |

> 注意区分：
> - `providers.*.api_key: ${VOLCENGINE_API_KEY}` —— 带 `${}` 包裹
> - `fallback_providers[].api_key_env: VOLCENGINE_API_KEY` —— 只写裸变量名

### .env 安全写入（避免引号/特殊字符问题，用 awk）

```bash
ENV_FILE=$HOME/.hermes/.env
chmod 600 "$ENV_FILE"
KEY_ID="ark-你的key"
awk -v k="$KEY_ID" '/^VOLCENGINE_API_KEY=/{print "VOLCENGINE_API_KEY="k; next} {print}' \
    "$ENV_FILE" > "${ENV_FILE}.tmp" && mv "${ENV_FILE}.tmp" "$ENV_FILE"
grep -q '^VOLCENGINE_API_KEY=' "$ENV_FILE" || echo "VOLCENGINE_API_KEY=$KEY_ID" >> "$ENV_FILE"
```

## 5. 协议 / base_url 速查

| Plan / 平台 | OpenAI 协议 (`chat_completions`) | Anthropic 协议 (`anthropic_messages`) |
|---|---|---|
| 火山方舟 Coding Plan | `https://ark.cn-beijing.volces.com/api/coding/v3` | `https://ark.cn-beijing.volces.com/api/coding`（客户端补 /v1/messages）|
| 火山方舟 Agent Plan | `https://ark.cn-beijing.volces.com/api/plan/v3` | `https://ark.cn-beijing.volces.com/api/plan` |
| OpenRouter | `https://openrouter.ai/api/v1` | — |
| DeepSeek 直连 | `https://api.deepseek.com/v1` | — |
| Kimi CN | `https://api.moonshot.cn/v1` | — |

规则：
- `api_mode: chat_completions` → base_url **带**版本后缀。
- `api_mode: anthropic_messages` → base_url **不带**版本后缀；同主机去掉 `/v3` 即切到 Anthropic。
- Anthropic 协议默认强 thinking：curl 测试 `max_tokens>=1024`，或 body 加 `"thinking":{"type":"disabled"}`。

## 6. 迁移到全新机器后的最小冒烟

```bash
hermes doctor
bash scripts/verify-model.sh              # L1 curl + L2 config check
hermes chat -q "你好，报一下你的模型名"    # 真实对话，确认主模型出应答
```

## 7. 故障速判

| 症状 | 大概率原因 | 处理 |
|---|---|---|
| `Could not resolve authentication method` | `${VAR}` 在 fallback 路径没展开 | config 明文 key(chmod 600) 或升级；测试用 `AIAgent(api_key=...)` |
| 404 / URL not found | api_mode 与 base_url 版本后缀不匹配 | anthropic 去掉 `/v3`；chat 保留 `/v3` |
| 主模型变成了别的厂商 | 跑过第三方 CLI 自动配置 | `--rollback-golden`，以后只手工合并 |
| 应答 `text` 为空、`stop_reason=max_tokens` | Anthropic thinking 吃光预算 | max_tokens≥1024 或关 thinking |
| HTTP 400 (Windows) | config.yaml 带 BOM | 存为无 BOM 的 UTF-8 |
| fallback 不生效 | 触发的是审核/工具错，或仅单槽旧版 | 确认 429/529/503/连接失败；旧版升级 |
| Coding Plan 回 `400 InvalidSubscription` | **多为周/套餐配额用尽，不一定是订阅过期或 key 失效（火山错误码有歧义，2026-09-20 老大实测确认）** | 同一 key 走 Agent Plan 主模型正常即证明 key 有效；去火山控制台核对套餐与周配额用量，等额度重置或换额度后重跑 L1，别急着换 key/续费 |
