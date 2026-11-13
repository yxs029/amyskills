# Seedream 配置

## 凭据

优先在本地设置 `ARK_API_KEY`；不要要求用户在聊天中提供密钥。选择顺序是本次显式 `--api_key` / `--api-key` / `--apiKey`、`ARK_API_KEY`、当前平台的既有 AgentPlan 配置、通用凭据环境变量。显式临时 Key 不触发对其他平台配置的扫描。

当前平台配置支持 OpenClaw 的 `models.providers.*.apiKey`、Hermes 的 `model.api_key`、Claude Code 的 `ANTHROPIC_AUTH_TOKEN` 或 settings.json 中同名字段；只接受 `ark-` 格式。通用兼容变量包括 `ANTHROPIC_AUTH_TOKEN`、`API_KEY`、`API_Key`、`API_Keys`、`api_key`、`apiKey`。

临时 Key 默认不保存。只有用户明确要求持久保存时才使用 `--save_api_key true`；写入检测到的平台配置并创建脱敏备份，权限为0600。此设置会影响该平台其他 AgentPlan 功能。`--dry-run` 不读取或保存凭据，也不能同时要求保存 Key。

## 路径与环境变量

| 变量 | 用途 |
|---|---|
| `ARK_SEEDREAM_MODEL` / `ARK_MODEL` | 默认模型；CLI `--model` 优先，`--model auto` 恢复自动路由 |
| `ARK_SEEDREAM_SAVE_PATH` / `ARK_SAVE_PATH` | 保存目录；默认依次尝试桌面、主目录、当前目录中的 Seedream-Images |
| `ARK_SEEDREAM_API_BASE_URL` / `ARK_API_BASE_URL` | 兼容旧配置，只接受 `https://ark.cn-beijing.volces.com/api/plan/v3`；其他地址在读取 Key 前拒绝 |
| `ARK_SEEDREAM_REGISTRY_MODE` | `offline` 跳过飞书 |
| `ARK_SEEDREAM_REGISTRY_CACHE_DIR` | 默认 `~/.cache/ark-seedream` |
| `ARK_SEEDREAM_REGISTRY_FILE` | 运维指定的本地已发布 JSON，仍执行完整校验和缓存隔离 |
| `LARK_CLI_BIN` | 运维指定 CLI 路径，否则从 PATH 查找；表格不能设置此项 |
| `ARK_SEEDREAM_DOWNLOAD_TIMEOUT_MS` | 单文件下载时限，默认90000，允许1000–300000毫秒 |
| `ARK_SEEDREAM_TIMEOUT_MS` | 生图 API 请求超时，默认120000毫秒 |

模型数据和飞书读取规则见 [MODEL_REGISTRY.md](MODEL_REGISTRY.md)。表格不接管凭据、API地址或本地路径。缺少飞书登录不妨碍使用缓存/内置模型；公开网页分享不等于已配置 CLI 认证。

## 提示词

`optimize` 是本地提示词增强；`optimize_prompt_mode` 是模型服务端模式。用户要求保留原词时设置 `--optimize false`。精准编辑、拆图层、透明编辑默认关闭本地增强；具体参数见 [MODELS.md](MODELS.md)。
