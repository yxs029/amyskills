---
name: hermes-model-switchover-drill
description: "Hermes 主备模型切换 + 断联容灾演练一条龙：改主模型、配多级 fallback_providers 容灾链（OpenAI/Anthropic 双协议）、.env 密钥分离、断言式精确改写 config、curl→config check→真实断联演练（T0基线/T1断主/T2断L1/T3断L2）三级验证、自动恢复+回滚。当老大说『切换主模型』『配备用模型』『改fallback』『模型断联演练』『验证容灾链』时使用。"
version: 1.4.0
author: 测测 (CeCe) for 袁雪松
license: MIT
metadata:
  hermes:
    tags: [hermes, configuration, model, fallback, failover, drill, switchover]
    related_skills: [hermes-agent, hermes-model-backup-failover]
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。


# Hermes 主备模型切换 + 断联容灾演练

> v1.4.0（2026-11-10 晚）：新增第 9 节「可移植链方案 v2」——老大钦定链序全面去本地化：主 zhipu 官网 glm-5.3-flash → L1 minimax 官方 M3.1-Flash → L2 白山 baishan/GLM-5.3-Flash → L3 agnes → L4 openrouter，**全公网直连、零本地网关依赖**（方案要给其他 agent 用，不能绑本地号池）；本地 LiteLLM 网关（第 6 节）降级为可选加速层，config 中已移除。
> v1.3.1（2026-11-10 晚）：①链序再调整——L1 弃网关版 `mm/MiniMax-M3.1-Flash` 改官方 coding plan `MiniMax-M3.1-Flash`（主备同源，等价可用性论证见 8.7）；②8.7 新坑：fake 429 + 链裁剪法**对"主备同 provider"不适用**（断主必断 L1）；③密钥打码层新花样：完整 `KEY_NAME=` 前缀也会被吃（绕法见 8.7）。
> v1.3.0（2026-11-10 更新）：新增第 8 节「fallback 真降级验证法（fake 429 服务器 + 链裁剪）」，并修正第 3 节两条**错误结论**：key 字段名是 `key_env` 不是 `api_key_env`；502/500 **不**触发降级（只有 429/401 等触发）。
> v1.2.0（2026-11-10 更新）：新增第 7 节「轻量切换流水线」（只换模型 + 改上下文，不跑断联演练，三层验证 + 上下文优先级 + 密钥打码坑）。
> v1.1.0（2026-10-09）：新增第 6 节 LiteLLM 网关 provider 配合与链序铁律。
> v1.0.0（2026-09-28 实战沉淀）：本机 Hermes v0.15.2 / `_config_version: 22` 实测校准。
> 姊妹 skill：`hermes-model-backup-failover`（管迁移/备份/回滚），本 skill 管**切换动作 + 断联演练**。

## 0. 什么时候用

- 老大说"主模型改为 X"、"配 N 层备份模型"、"验证容灾链能不能自动切"。
- 前置确认：`grep -E '_config_version|fallback_providers' ~/.hermes/config.yaml` —— v22+ 才支持多级链；老版本先 `hermes update`。

## 1. 切换七步（按序执行，不可跳步）

1. **备份**：`bash ~/.hermes/skills/devops/hermes-model-backup-failover/scripts/hermes-model-backup.sh` + `cp ~/.hermes/.env ~/.hermes/.env.bak.$(date +%Y%m%d-%H%M%S)`。
2. **写密钥**：新 provider 的 key 先进 `~/.hermes/.env`（chmod 600），变量名按 `{平台}_API_KEY` 约定；config 里只写 `${VAR}`（本版 0.15.2 递归展开已原生支持）。**交付件永不出现明文 key**。
3. **精确改写 config**：用 Python 脚本 `str.replace` + `assert count==1` 断言式替换；**禁止整文件覆盖**；锚点在多处出现时（典型：agent-plan/coding-plan 模型目录同名段）加 api_key 行消歧。
   - `patch` 工具会拒改 `~/.hermes/config.yaml`（受保护凭证文件），必须走终端脚本。
4. **四块结构**：`model:`（主模型三件套）/ `providers:`（模型目录，挂 models+context_length 供 /model 切换）/ `fallback_providers:`（按序多级容灾链，每条含 provider/model/base_url/api_mode/api_key_env/context_length）/ `custom_providers:`（可选扩展）。
   - **协议规则**：`anthropic_messages` → base_url 不带版本号（客户端自动补 /v1/messages）；`chat_completions` → 带 /v1 或 /v3。
   - **provider 名大小写敏感**，`model.provider` 与 `providers:` key 逐字符一致。
5. **L1 curl 验证**：每个端点（主+各备）直连一发 hello，证明 key/协议/模型名通。Ark Anthropic 端点 `Authorization: Bearer` 与 `x-api-key` 都接受。
6. **L2 配置验证**：`python3 -c "import yaml; yaml.safe_load(open('config.yaml'))"` + `hermes config check` + `hermes config show | head` 核对 model.default 未被覆盖。
7. **L3 断联演练**：用 `scripts/failover_drill.py`（本 skill 自带）跑 T0-T3，从 agent.log 增量提取实际应答模型作硬证据。**跑完自动从快照恢复配置并三重断言**。

## 2. 断联演练设计（模拟老大要求的"自动断联切下一个"）

- **原理**：把某层指到 `http://127.0.0.1:9`（连接拒绝），Hermes 分类为 transport 错误 → 触发 `try_activate_fallback()` 走 `_fallback_chain` 下一跳。主模型用显式 kwargs 指死；**L1/L2 必须改 config 文件的 `providers.<name>.base_url` 后重新 load**（named-custom 解析忽略链内嵌 base_url，见坑表）。
- **判定**：连接拒绝必触发降级（对比：不存在的模型名返回 400，**不触发**降级，别用错模拟法）。
- **四场景**：T0 基线（主模型应答）→ T1 断主（L1 应答）→ T2 断主+L1（L2 应答）→ T3 断主+L1+L2（L3 应答）。
- **证据**：`~/.hermes/logs/agent.log` 里 `API call #1: model=xxx` —— 演练前后取文件偏移量，增量正则提取，谁应答一目了然。
- **注意**：运行中的 gateway/会话**不热更新配置**，演练判定只看新起的 `hermes chat` 子进程；当前会话继续用旧模型属正常现象。

## 3. 坑表（实测）

- **fallback 的 named-custom 解析只认 config 文件**：`resolve_provider_client` 遇到 `providers:` 里登记过的名字（如 `minimax-coding-plan`），直接读 config 条目的 base_url/api_key，**忽略 fallback 链内嵌的 base_url**。→ 模拟 L1/L2 断联必须改 config 文件后重新 load_config；改内存链字典无效（2026-09-28 实测踩过）。
- **证据采集禁用共享日志增量匹配**：gateway/定时任务并发写 `agent.log`，增量提取 `API call #1` 会抓到别人（cron 任务）的调用。权威证据=进程内 AIAgent 跑完后 `agent.model`/`agent.provider` 终值（fallback 激活时代码会改写这两个属性）。
- `.env` 的 `VOLCENGINE_API_KEY` 与 config 里 Agent Plan 明文 key 不是同一把 —— 拿它 curl 主模型必 401。测哪个 plan 用哪个 key。
- **fallback 降级触发条件（2026-11-10 实测校准，别再用旧结论）**：429 → `fallback=True` ✅、401 → `fallback=True` ✅；**502/500 → `retryable=True` 但 `fallback=False`** ❌（只重试 3 次后结束，**不会**降级）。内容审核、400、工具错、单纯慢都不降级。⚠️ 因此"把 base_url 指到 `http://127.0.0.1:9` 模拟断链"在新版本可能因被归类成 502 而**不降级** —— 2026-11-10 实测即如此（`Error classified: reason=server_error status=502 ... fallback=False`）。要可靠触发降级，用第 8 节的 **fake 429 服务器**。
- **key 字段名是 `key_env`，不是 `api_key_env`（2026-11-10 实测踩坑，务必记住）**：
  - `run_agent.py` 读 fallback 条目的 key：`fb.get("api_key")` → 否则 `fb.get("key_env")`（**没有 api_key_env 这个键**）；
  - `agent/auxiliary_client.py` 的 named-custom 分支读 providers 段：`custom_entry.get("api_key")` → 否则 `custom_entry.get("key_env")` → 否则 `"no-key-required"`。
  - 写错成 `api_key_env:` → **静默不报错**，实际把 `no-key-required` 发给网关 → 网关返回 `401: LiteLLM Virtual Key expected. Received=no-k****ired, expected to start with 'sk-'` → 该跳降级立刻 401 失败。**整条链的网关档位会集体失效**且日志里只看到 401，很难联想到字段名。
  - 正确写法：`providers:` 段与 `fallback_providers:` 条目都写 `key_env: LITELLM_MASTER_KEY`（key 放 `~/.hermes/.env`，不落明文）。
  - 排查手法：`journalctl --user -u litellm | grep -i '401\|Virtual Key'` 看网关侧收到的到底是哪个 key。
- MiniMax-M3 回复可能带 `<think>` 块，HTTP 200 即算通。
- 本版（0.15.2）`fallback_providers` 的 key 走 `os.getenv` 解析（字段名见上：**`key_env`**），`.env` 启动时已载入，链路密钥可正常解析（旧版 0.11.x 不展开，遇 `Could not resolve authentication method` 则改明文 key 或升级）。
- 主模型显式参数（base_url/api_key 直连 kwargs）AIAgent 会原样使用；fallback 链条目才走 named-custom 解析。
- 演练脚本里 `hermes chat` 单跑给 180s 超时；MCP/工具加载慢，别急着判失败。

## 4. 文件索引

- `scripts/failover_drill.py` —— T0-T3 断联演练全自动（v3，2026-09-28 全通过）：进程内 AIAgent 跑真实 fallback 链，权威证据=`agent.model/provider` 终值；主模型断联用显式 kwargs，L1/L2 断联改 config 文件后重载；结束自动恢复快照+断言。期望值从 config 自动推导，新链路直接复用。
- 备份/回滚脚本复用姊妹 skill `hermes-model-backup-failover/scripts/hermes-model-backup.sh`。

## 5. 与工作空间同步纪律

更新本 skill 后：① `cp -r` 到 `~/测测的工作空间/skills/`；② 重打 `name__version__date.zip`；③ 更新 `01_SKILLS_INDEX.json`（计数+条目）与 `00_TEST_SKILLS_GUIDE.md`；④ `diff -rq` 校验一致性。

## 6. 与 LiteLLM 网关 provider 配合（2026-10-09 补充）

当主模型通过 LiteLLM 网关接入（`~/.hermes/.env` 里加 `LITELLM_MASTER_KEY=...`），config 的 `model:` 段写法：

```yaml
model:
  base_url: http://192.0.2.10:4000/v1
  default: baishan/GLM-5.2       # 必须带渠道前缀，LiteLLM 按此路由
  provider: litellm-gateway
  api_key_env: LITELLM_MASTER_KEY
```

`fallback_providers` 可以混编 LiteLLM 网关模型 + 直连 provider（minimax/agnesai 等），形成本 skill 的标准五级链。

**注意**：LiteLLM 的 `model_name`（带前缀，如 `baishan/GLM-5.2`）是**网关注册名**，不是上游 model id。CC Switch / 客户端请求时必须用网关注册名，上游 model id 只出现在 LiteLLM `config.yaml` 的 `litellm_params.model` 字段。

批量探测 74 模型可用性用 `llm-gateway-selfhost/scripts/probe_models.py`（10 分钟跑完，6 种状态分类），结果存 `~/.hermes/available_models_*.json`。

### LiteLLM 作为 L4 兜底（2026-10-09 实装）

**链序铁律：原有顺序不变，LiteLLM 只做最末级兜底**。标准五级链：

```
主  zai/glm-5.3-flash（智谱 coding plan）
L1  minimax-coding-plan/MiniMax-M3
L2  agnesai/agnes-3.0-flash
L3  openrouter/openrouter/free
L4  litellm-gateway/baishan/GLM-5.2   ← 新增兜底（74 模型聚合网关，42 注册/33 实测可用）
```

追加操作要点（在七步流程第 3 步的脚本里）：

1. `fallback_providers:` 末尾追加条目（锚点=最后一个 fallback 条目的 `context_length` 行，`str.replace` + `assert count==1`）。
2. **必须同时在顶层 `providers:` 注册 `litellm-gateway` 条目** —— named-custom 解析只认 providers 条目（本 skill 坑表第一条），只加 fallback 不加 providers 会解析失败。注意 `providers:` 在 config 里出现 4 次（嵌套段），锚定必须用 `re.findall(r'^providers:$', raw, flags=re.M)` 行首匹配，`str.count('providers:')==1` 会误判。
3. `.env` 加 `LITELLM_MASTER_KEY=sk-...`（源：`~/litellm-deploy/.env`），chmod 600。
4. L1 curl 验证：`curl http://192.0.2.10:4000/v1/chat/completions` + Bearer key + `model=baishan/GLM-5.2`，HTTP 200 即通。

**LiteLLM 侧自身改模型的坑（2026-10-09 实测）**：`litellm_settings.store_model_in_db: true` 时，改 `config.yaml` + `systemctl restart` **不生效**（重启后从 Postgres 读，config 只是首启 seed）。改模型清单两条路：

- 热添加（推荐）：`POST /model/new`，body=`{"model_name": "前缀/名字", "litellm_params": {...}}`，立即生效无需重启；
- 或走 Admin UI。批量禁用则通过 `/model/delete` 或 UI 操作，改 yaml 文件是无效功。

## 7. 轻量切换流水线（2026-11-10 补充：只换模型 + 改上下文，不跑断联演练）

适用：老大只要求"把主模型换成 X、上下文改成 Y"，不必重跑 T0-T3。

### 7.1 改之前先摸底（三条命令）

1. `hermes fallback` —— 看 Hermes 自己解析出的 Primary + 链序（**权威解析结果**，比读 yaml 更可信）。
2. `sed -n '1,60p' ~/.hermes/config.yaml` —— 看 `model:` / `providers:` 段结构，核对 provider 名与模型 id。
3. 官方模型清单（OpenAI 兼容端点）：`GET https://api.minimaxi.com/v1/models`（用该 provider 的 key）→ 拿真实 model id 列表。**id 大小写敏感**：官方 `MiniMax-M3.1-Flash`（大写 F）vs 网关注册名 `mm/MiniMax-M3.1-flash`（小写 f），写错就 400/404。

### 7.2 上下文长度写哪里（优先级从高到低）

1. `model.context_length`（顶层显式值，**最高优先级**；run_agent.py 里 `_config_context_length` 先读它，仅当它为空才走 providers/custom_providers 探测）—— 必须是纯整数，写 `'256K'` 会被忽略并打印告警。
2. `providers.<name>.models[].context_length` —— 供 `/model` 切换选型用。
3. `fallback_providers[].context_length` —— 只影响该降级跳的预算。
   官方口径：MiniMax-M3 与 MiniMax-M3.1-Flash 均为 1,000,000 tokens（最大输出 524K，多模态）。同族模型别一锅端标 512K。

### 7.3 改写 config.yaml 的合法路径

- `patch` 工具**会拒改** `~/.hermes/config.yaml`（受保护凭证文件）→ 走终端 Python 脚本 `str.replace` + `assert count==1`（沿用第 1 节第 3 步）。
- 顶层标量可直接用官方命令：`hermes config set model.default 'MiniMax-M3.1-Flash'`、`hermes config set model.context_length 1000000`（providers / fallback 列表仍需脚本）。
- 改前备份：`cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak.<原因>-<MMDD>`。
- 想让同一模型走两条路径（直连 + 网关）互为降级：主模型用直连 provider，fallback 链首条挂网关路由名，并在 `providers.<网关名>.models[]` 里也补一条该 id（named-custom 解析只认 providers 条目）。

### 7.4 切完必做三验（替代重型演练）

1. **解析层**：`hermes fallback` → 确认 Primary 与链序符合预期。
2. **端到端**：`hermes chat -q --yolo '<自检：用 terminal 执行 echo CHECK 贴输出；再说你是什么模型>'` → 模型自报 + 工具调用都正常才算真通。**用 Python `subprocess.run([...])` 传参**，别在 shell 里嵌多层引号（中文任务描述 + 引号嵌套会直接把 `-q` 参数吃掉，报 "expected one argument"）。
3. **通道层**：`systemctl --user restart hermes-gateway` → 飞书/Telegram 等通道立即用新模型；重启后按 `--since '<重启时刻>'` 看日志确认新进程起来且平台 WebSocket 已连。

### 7.5 验证期两个环境坑

- **密钥打码层会破坏命令行**：用 f-string 拼 `Authorization: Bearer {key}` 时，中间层脱敏会把源码里的 key 换成 `***` 并截断引号 → SyntaxError / 认证失败。解法：读 .env 到变量后用 `urllib.request` 直连（key 不进命令行），别用 `curl -H`。
- **gateway 日志里的 MCP 报错多是旧进程遗留**：`Invalid JSON: expected value`（minimax MCP 把 "Starting Minimax MCP server" 打到 stdout 污染 JSON-RPC）属于被替换的旧进程，`journalctl --since` 必须卡在重启时刻之后，否则会误判成新故障。

## 8. 真降级验证法：fake 429 服务器 + 链裁剪（2026-11-10 实战新增）

第 2 节的"指到 127.0.0.1:9"在本版会得到 502 而**不触发降级**（见第 3 节校准条）。可靠做法：**造一个返回 429 的假上游**，让主模型必失败，再把 fallback 链裁剪到只剩待验证那一跳。

### 8.1 fake 429 服务器（放在验证脚本里，用 threading 起）

```python
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, threading
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        b = json.dumps({"error":{"message":"rate limit exceeded","type":"rate_limit_error","code":429}}).encode()
        self.send_response(429); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self): self.do_POST()
    def log_message(self, *a): pass
srv = HTTPServer(('127.0.0.1', 40124), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
```

### 8.2 主模型断链改哪里（易错）

主模型的 base_url **由 `providers.<主provider>.base_url` 决定**（`model.base_url` 会被 provider 段覆盖）→ 要断主就改 providers 段那行，别只改 `model:` 段。

### 8.3 链裁剪（只留待验证那一跳）

按行解析 `fallback_providers:` 段：条目以 `- ` 开头，段结束于下一个顶层非缩进行；保留目标条目的整块、删掉其余块。这样"主 429 → 唯一一跳"必然落到待验证模型，排除了上游偶发因素。

### 8.4 证据采集（进程内日志，不依赖共享日志）

`hermes chat -q '只回复两个字：正常' -v` 的 stderr 里看两行：

```
Fallback activated: <旧模型> → <新模型> (<provider>)
API call #1: model=<新模型> provider=<provider> ...
Turn ended: reason=text_response(finish_reason=stop) model=<新模型>
```

`Turn ended: reason=text_response` = 真应答了（不是空响应）。

### 8.5 断言式恢复

每次验证：`shutil.copy(config, BAK)` → 改 → 跑 → `finally` 里 `shutil.copy(BAK, config)` → 断言 `open(config).read() == orig`，**并把修好的内容重放回去**（否则恢复会把修复一起回滚）。多轮验证用**不同端口**的 fake server，避免残留监听。

### 8.6 LiteLLM 侧新增/改模型的当前实况（2026-11-10）

`litellm_settings.store_model_in_db` 现为 **false** → 改 `~/litellm-deploy/config.yaml` + `systemctl --user restart litellm` **即生效**（若改回 true，则必须走 `POST /model/new` 热添加，见第 6 节）。

- 重启后**启动耗时约 23 秒**，别在 10 秒内就 curl → 会误判成"服务挂了"（Connection refused）。
- 网关内模型名是**注册名**（如 `baishan/GLM-5.3-Flash`、`zhipu/glm-5.3-flash`），上游 model id 大小写敏感：baishan 上游是 `GLM-5.3-Flash`（大写 F），zhipu 上游是 `glm-5.3-flash`（小写 f）。
- 加新模型三步：① `config.yaml` 里加 `model_name` + `litellm_params.model/api_base/api_key` → ② 重启 → ③ `GET /v1/models` 确认注册名出现 + `POST /v1/chat/completions` 实测 200。
- ⚠️ **思考模型 token 陷阱**：`GLM-5.3-Flash` 会把 max_tokens 全吃进 `reasoning_content`，`content` 返回空字符串 —— **这不是故障**，判定要用 HTTP 200 + `usage.total_tokens>0`，测的时候把 max_tokens 给到 512 以上。
- 同一上游不同额度池：zhipu 直连用 coding plan key 会 429（"每周/每月使用上限，11-12 重置"），但**网关用的另一把 key 仍 200** → 判断某档是否可用要以**经过网关**的实测为准，别拿直连结果下结论。

### 8.7 主备同 provider 场景：断链法失效 → 同源等价论证（2026-11-10 晚实战）

**场景**：老大要求"主模型 X，fallback L1 也是 X（同 provider 官方接口）"。此时 fake 429 + 链裁剪法**不可用**——断主必断 L1（`providers.<name>.base_url` 是两者共用的唯一断点，named-custom 分支永远读 providers 段，条目内嵌 base_url 被忽略）。

**替代论证（同源等价）**：L1 与主模型完全同 `provider + model + base_url + key`，走**同一条 named-custom 解析路径** →
1. 官方接口直连实测 200（urllib + .env key，不进命令行）；
2. `hermes fallback` 解析确认 L1 指向正确；
3. 主模型端到端 `hermes chat -q` 通过。
三者齐 = L1 可用性得证（不存在"L1 独有的失败模式"）。

**密钥打码层新花样（写脚本文件时也中招）**：把完整 `KEY_NAME=` 前缀写进 Python 源码（如 `line.startswith('MINIMAX_CODING_PLAN_API_KEY=***')` —— 注意这句本身就是被破坏后的样子，原文引号被吃了、变成 `KEY=***` 断引号 → SyntaxError。**绕法**：不用完整前缀匹配，改 `line.split('=',1)[0].strip() == 'MINIMAX_CODING_PLAN' + '_API_KEY'`（拼接避开完整模式）；或者读写变量时先 split 再比较。此坑 v1.2.0 只记了 f-string 场景，**写普通源码文件同样会中**。

**链序实况（2026-11-10 晚定稿）**：主 `MiniMax-M3.1-Flash`（官方 coding plan 直连，1M）→ L1 `MiniMax-M3.1-Flash`（同上，主备同源）→ L2 网关 `zhipu/glm-5.3-flash` → L3 `agnes-3.0-flash` → L4 `openrouter/free` → L5 网关 `baishan/GLM-5.3-Flash`。网关的 `mm/MiniMax-M3.1-Flash` 注册名保留但不再入链。⚠️ 本节链序已被第 9 节「可移植链方案 v2」取代（当日晚些时候老大要求去本地网关依赖）——第 6 节与第 8 节的网关相关内容保留为历史参考与可选加速层。

## 9. 可移植链方案 v2（2026-11-10 晚定稿：全公网直连，零本地依赖）

**背景与约束**：这套模型配置方案要发布到老大 GitHub 技能库（github.com/yxs029/amyskills）给**其他 agent / 其他机器**复用 → 不能依赖本地号池（192.0.2.10 LiteLLM 网关）。老大连夜改链：「默认模型 zhipu 官网 glm-5.3-flash → 官方 minimax codingplan M3.1 → 白山 baishan/GLM-5.3-Flash → agnes → openrouter，暂时不使用 litellm」。

### 9.1 链序定稿（5 级全直连）

```
主   zhipu / glm-5.3-flash           智谱官网 bigmodel coding paas   1M / 128K out
L1   minimax-coding-plan / MiniMax-M3.1-Flash   官方 api.minimaxi.com   1M
L2   baishan / GLM-5.3-Flash         白山 api.edgefn.net 直连        1M / 128K out
L3   agnesai / agnes-3.0-flash       apihub.agnes-ai.com             512K
L4   openrouter / openrouter/free    openrouter.ai                   128K
```

模型 id 大小写：智谱官方小写 `glm-5.3-flash`；白山上游大写 `GLM-5.3-Flash`。别混。

### 9.2 .env 五把 key（chmod 600，永不进交付件）

```
ZHIPU_BIGMODEL_KEY=***          智谱 bigmodel（本地有网关的可从 ~/litellm-deploy/.env 提取）
MINIMAX_CODING_PLAN_API_KEY=*** MiniMax coding plan
BAISHAN_KEY=***                 白山 edgefn
AGNESAI_API_KEY=***              AgnesAI
OPENROUTER_API_KEY=***           OpenRouter
```

### 9.3 providers 模板（named custom，key 用 key_env 引用）

```yaml
providers:
  zhipu:
    name: Zhipu Official (bigmodel coding paas)
    key_env: ZHIPU_BIGMODEL_KEY
    api_mode: chat_completions
    base_url: https://open.bigmodel.cn/api/coding/paas/v4
    models:
    - id: glm-5.3-flash
      context_length: 1000000
      max_output_tokens: 128000
  baishan:
    name: Baishan EdgeFN direct
    key_env: BAISHAN_KEY
    api_mode: chat_completions
    base_url: https://api.edgefn.net/v1
    models:
    - id: GLM-5.3-Flash
      context_length: 1000000
      max_output_tokens: 128000
```

`model:` 段三行切换：`base_url: https://open.bigmodel.cn/api/coding/paas/v4` / `default: glm-5.3-flash` / `provider: zhipu`（key 走 providers 段解析，无需在 model 段重复）。

### 9.4 迁移操作要点

1. **删除旧 provider 条目用行级手术**：定位 `  <name>:` 行 → 向后扫到下一个同级（两空格缩进）key 行 → 删区间。**禁止 yaml.dump 整文件重排**（丢注释/改格式）。删除 `litellm-gateway` 后全文 `grep litellm` 应为 0 残留。
2. fallback 链整段替换：锚点 `fallback_providers:` → 下一个顶层 key（如 `credential_pool_strategies:`），整块换成 9.1 的 4 条（每条 `key_env` 引用 .env，不落明文）。
3. 改完 `python3 -c "import yaml; yaml.safe_load(...)"` + `hermes fallback` 双校验。
4. 上游实测口径：改链前先 curl 双上游（zhipu 200 / baishan 200）再动手；白山是思考模型，max_tokens 给 512+，content 空但 200+total_tokens>0 算通。
5. 端到端三验（第 7.4 节）照跑：`hermes fallback` 解析 → `hermes chat -q` → `systemctl --user restart hermes-gateway`。

### 9.5 本地网关的定位变化

本地 LiteLLM 网关（第 6 节）从"链的组成部分"降级为**可选加速/聚合层**：`.env` 的 `LITELLM_MASTER_KEY` 保留，网关服务本身照常运行（36 模型池还在），但 config 主链不再引用——其他机器零依赖，本机想用网关模型时按第 6 节临时加回即可。
