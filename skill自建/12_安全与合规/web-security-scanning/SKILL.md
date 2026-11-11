---
name: web-security-scanning
description: OWASP ZAP-based web application security testing via daemon API. Covers authenticated scanning (CSRF login + httpSessions session injection), ZAP 2.17 API quirks (createEmptySession, includeInContext, HttpStateEnabled), spider with maxDuration anti-infinite-loop, active scan, alert review, OPRASE 6-layer KB output, and report generation (HTML/JSON/MD/XML). Use when user asks for web page security testing, ZAP scanning, vulnerability assessment for URLs, authenticated B2B site scanning.
version: 2.2.0
author: agent (session-derived)
triggers:
  - 用户要求"WEB 安全测试"、"ZAP 扫描"、"安全扫描"、"漏洞扫描"
  - 需要对某个 URL 做安全评估（spider + active scan + report）
  - 需要启动 ZAP daemon 并通过 API 查看 alerts / 生成报告
  - 需要做 CSRF 登录态认证扫描（B2B 商城类站点登录后全站扫描）
  - 需要做带 session 注入的 ZAP 扫描（登录后注入 Cookie 再跑 spider + active scan）
  - 需要做 OPRASE 格式的安全测试项目（6 层知识库结构）
  - 提到"zap-cli"、"zap"、"OWASP ZAP"并要求安装/连接
class: security-testing
dependencies: ZAP installed at /opt/zap (zap.sh available at /usr/local/bin/zap); Python 3.11/3.12 wrapper at ~/bin/zap-cli; Chrome/Chromium for AJAX Spider (optional), requests library for proxy verification
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。


# web-security-scanning

Class-level umbrella for OWASP ZAP-based web security scanning via CLI.

## What this covers
- Quick scans (spider + active vulnerability scan + HTML report) against target URLs
- ZAP daemon start/stop/status with API key authentication
- Alert extraction filtered by risk level (High/Medium/Low/Informational/All)
- Integration with existing system ZAP installations — wrapper connects to `/opt/zap`

## When to trigger
- User asks to scan a website for security issues / vulnerabilities
- User asks to install or configure `zap-cli` to connect to an existing ZAP installation
- User needs automated web security testing in a CLI/CI context

## Key tool / wrapper
- **Wrapper**: `~/bin/zap-cli` (Python wrapper, executable, connects to `/usr/local/bin/zap` → `/opt/zap`)
- **Real PyPI package**: `zapcli` (package name is `zapcli`, not `zap-cli`; install via `pip install zapcli`) — note older versions have `urllib3`/`six` build issues on newer Python; wrapper avoids this
- **ZAP binary**: `/usr/local/bin/zap` (symlink to `/opt/zap/zap.sh`)

## Usage patterns (verified working)

```bash
# Quick vulnerability scan + HTML report
zap-cli quick-scan -t https://example.com -o /tmp/zap-report.html

# Start daemon (API on port 8080) — use with -p 8090 if needed
zap-cli start
zap-cli status
zap-cli shutdown

# View alerts at given risk level
zap-cli alerts High
zap-cli alerts All
## Authentication scan (CSRF + session injection via httpSessions API)

### CSRF 登录流程（xplorechips 模式）
- B2B/商城类站点：GET `/signin` → 解析 `name="_csrf" value="..."` 输入 → POST `/account` 带 `email`/`password`/`_csrf`/`keep-me`/`returnUrl` → 302 到 `/` → 3 个会话 Cookie：`userSecret`、`session`、`authToken`（JWT）
- 密码通过环境变量 `XPLORE_PASS` 传入，脚本不落明文
- 验证：带 clean jar 经 ZAP 代理 GET `/account/`，检查"退出"/"logout"/用户名出现

### 关键：ZAP 2.17 的 HttpStateEnabled 必须开启
- ZAP 2.17 默认 `HttpStateEnabled=false`，不跟踪会话
- 开启方式：**GET** 请求（不是 POST），参数名 `Boolean`：
  ```
  GET /JSON/core/action/setOptionHttpStateEnabled/?Boolean=true
  ```
- 验证：`GET /JSON/core/view/optionHttpStateEnabled/` → `{"HttpStateEnabled":"true"}`

### Session injection into ZAP（ZAP 2.17 API 已验证）
1. 建空会话：`POST /JSON/httpSessions/action/createEmptySession/?site=www.example.com:443&session=auth`
2. 注入 token：`POST /JSON/httpSessions/action/setSessionTokenValue/?site=www.example.com:443&session=auth&sessionToken=userSecret&tokenValue=xxx`
3. 激活会话：`POST /JSON/httpSessions/action/setActiveSession/?site=www.example.com:443&session=auth`（注意：参数是 `session` 传会话名，不是 `sessionId`）
4. 验证：GET `/JSON/httpSessions/view/activeSession/?site=www.example.com:443` → `{"active_session":"auth"}`

### ZAP 2.17 API 差异（重要！）
- 建会话：`createEmptySession`（不是 `createSession`）
- 注 token：参数名 `sessionToken`/`tokenValue`（不是 `name`/`value`）
- 激活会话：参数 `session`（会话名，不是 `sessionId`）
- 会话结构：`{"sessions": [{"session": ["name", {tokenDict}]}]}` — session 是数组不是对象
- Context include：`includeInContext`（不是 `addIncludeRegex`）— 参数 `contextName` + `regex`
- Context inScope：`setContextInScope`（参数 `booleanInScope`，不是 `booleanInScope`）
- 所有 context action 在 ZAP 2.17 的 UI 页面 `/UI/context/` 可查，不以 `/UI/context/action/addIncludeRegex/` 存在
- ExcludeFromProxy：`/JSON/core/action/excludeFromProxy/` 参数 `regex`
- 选项设置：`setOptionXxx` 参数名取决于选项类型（`Integer`、`Boolean`、`String`），选项名列表从 `/UI/<component>/` 页面获取
- `setOptionHttpStateEnabled` **必须用 GET 请求**（不是 POST），参数 `Boolean=true` — 用 POST 报 400 missing_parameter
- `setOptionMaxDuration` 参数 `Integer` 单位分钟，默认 0=无限
- `setOptionMaxScanDurationInMins` 参数 `Integer` 单位分钟（主动扫描总时长上限）
- `setOptionMaxRuleDurationInMins` 参数 `Integer` 单位分钟（单条规则超时上限）
- `setOptionThreadPerHost` 参数 `Integer`
- `setOptionDelayInMs` 参数 `Integer`
- `setOptionHandleAntiCSRFTokens` 参数 `Boolean`

### 排除 URL（防副作用）
- 登出/改密/支付/下单/删购物车/短信验证码/注册 URL 必须排除：
  `logout|signout|loginout|requestPassword|resetPassword|account/password|account/.*(delete|remove)|order/.*(cancel|delete|confirm|pay)|cart/.*(delete|remove|checkout)|pay/.*|payment/.*|sms.*|sendCode.*|validcode.*|captcha.*|register.*|signup.*`
- 同时设置 context 级排除（`excludeFromContext`）和全局排除（`excludeFromProxy`）

## Spider 爬虫（关键参数）

### 防无限爬取（重要！）
- 带分页/商品列表的站（如 MRO 商城）URL 可能无限 → 必须设 `maxDuration`：
  ```
  POST /JSON/spider/action/setOptionMaxDuration/?Integer=10
  ```
  单位：分钟。默认 0=无限。
- 其他轻量选项：
  ```
  POST /JSON/spider/action/setOptionThreadCount/?Integer=3
  POST /JSON/spider/action/setOptionMaxDepth/?Integer=8
  POST /JSON/spider/action/setOptionParseComments/?Boolean=true
  POST /JSON/spider/action/setOptionParseRobotsTxt/?Boolean=true
  POST /JSON/spider/action/setOptionParseSitemapXml/?Boolean=true
  ```

### Spider API 调用
```
POST /JSON/spider/action/scan/?url=https://target.com/&contextName=xplorechips&subtreeOnly=true&maxChildren=0
```
返回 `{"scan": "0"}` — scan id 是字符串。

### 监控进度
```
GET /JSON/spider/view/status/?scanId=0          → {"status":"35"} (百分比)
GET /JSON/spider/view/results/?scanId=0          → {"results":["url1","url2",...]}
GET /JSON/spider/view/fullResults/               → 完整结果（注意：名称为 fullResults 非 resultsFull，且不需要 scanId）
```

### 停止爬虫
```bash
POST /JSON/spider/action/stop/?scanId=0
```

## AJAX Spider（Selenium 模式）

### 依赖
- ZAP 内置 ChromeDriver 支持特定 Chrome 版本（ZAP 2.17 内置 Chrome 143）
- 本机 Chrome 版本必须匹配，否则 AJAX Spider 启动后立即停止
- 验证：`google-chrome --version`
- 切换浏览器：`/JSON/ajaxSpider/action/setOptionBrowserId/?String=chrome-headless`

### 已知问题
- 浏览器版本不匹配时 AJAX Spider 启动后立刻停止，不报错
- 选择方案：匹配版本安装 Chrome 143 或跳过 AJAX Spider（普通 Spider 通常够用）
- Firefox headless 在 Linux 无桌面环境也可能不可用

## Active Scan (主动扫描)

### 目标 URL 去重（MRO/商品目录站点关键）

站点树 1991 节点、149 模板时，不扫所有 URL，按模板去重：
1. 功能页（account/cart/order/quote/upload/about/service/signin）：**全部保留**
2. 品类页：按 `(controller, path_template, query_keys)` 分组，每组保留 1-3 个代表 URL
3. 排除：`/.git/` 等自动探测路径
4. 典型 250-350 个目标 URL

### 限速配置（防 WAF 封禁）

```python
settings = [
    ("/JSON/ascan/action/setOptionThreadPerHost/", {"Integer": "3"}),
    ("/JSON/ascan/action/setOptionDelayInMs/", {"Integer": "50"}),
    ("/JSON/ascan/action/setOptionMaxRuleDurationInMins/", {"Integer": "5"}),
    ("/JSON/ascan/action/setOptionMaxScanDurationInMins/", {"Integer": "90"}),
    ("/JSON/ascan/action/setOptionMaxAlertsPerRule/", {"Integer": "0"}),
    ("/JSON/ascan/action/setOptionHandleAntiCSRFTokens/", {"Boolean": "true"}),
    ("/JSON/ascan/action/setOptionAddQueryParam/", {"Boolean": "false"}),
]
```

以上全部用 GET 请求，参数名与类型匹配（Integer/Boolean/String）。

### 启动扫描

```python
base = "http://127.0.0.1:8090"
params = {"url": "https://target.com/", "contextId": "4",
          "recurse": "true", "inScopeOnly": "true",
          "scanPolicyName": "Default Policy", "method": "", "postData": ""}
req = urllib.request.Request(base + "/JSON/ascan/action/scan/",
                             data=urllib.parse.urlencode(params).encode())
# response: {"scan": "0"}
```

### 监控（轻量，避免拉全量告警）

```python
import json, time, urllib.request
# 只读 scans 状态，不拉 alert 列表（16000+ 实例时会卡住）
while True:
    s = gj("/JSON/ascan/view/scans/")["scans"][0]
    print(f"{s['state']} {s['progress']}% req={s['reqCount']}")
    if s["state"] in ("FINISHED","STOPPED"): break
    time.sleep(30)
```

### 告警去重与分级

- 从 alertsByRisk 获取汇总（非全量 alerts）
- 中危告警按类型合并（CSP Missing / X-Frame-Options Missing / SRI Missing 等全站安全头问题，每个类型只记1条）
- 高危告警优先人工复核

## 人工复核（高危告警）

### PII 假阳性复核（见 references/zap-pii-false-positive.md）

ZAP PII 扫描器（plugin 10062）在电商/品类筛选页**极易误报**：相邻的筛选器属性值 + 商品数量被拼接成卡号。

**复核步骤**：
1. 从 alert 取 `messageId` → `GET /JSON/core/view/message/?id=xxx`
2. 在 response body 中定位证据数字前后 200-300 字符上下文
3. 判断是筛选器 ID + 统计数（假阳性）还是连续 13-19 位 PAN（真实）
4. 假阳性标记：`UPDATE /JSON/alert/action/updateAlertsConfidence/` 参数 `ids=4336,4337 & confidenceId=0`
5. 保存证据到 `step6_pii_false_positive_review.json`

### 其他中危告警复核重点

| 告警 | 验证方法 | 典型结果 |
|---|---|---|
| HTTPS to HTTP Insecure Transition | 检查表单 action 是否指向 HTTP 第三方域 | `/cart` 隐藏表单提交到 `http://digikey.com.cn` |
| 缺少反CSRF令牌 | 检查表单中是否有 `_csrf`/`csrf_token` 等字段 | /cart 表单缺 CSRF（但隐藏且不可交互） |
| 跨域配置错误 | 检查响应头 `Access-Control-Allow-Origin` | `/sitemap.xml` 返回 `*`（OSS 静态 404 页） |
| Application Error Disclosure | 取 messageId 检查响应正文是否有堆栈/Traceback | 偶发500但无堆栈泄露 |

## 未登录授权验证

未登录访问敏感路径时，正确的行为是 302 跳转到 `/signin?returnUrl=...`：

```
GET /account/ → 302 /signin?returnUrl=%2Faccount%2F ✓
GET /order/list → 302 /signin?returnUrl=%2Forder%2Flist ✓
GET /quote → 302 /  ✓
```

使用 clean requests.Session()，不经过 ZAP 代理，不设 Cookie.

## Knowledge base structure (OPRASE 6-layer)
- 扫描项目知识库统一用 OPRASE 六层结构：
  - `00-顶层文档-OPRASE格式.md`：O 目标 + P 方法 + R 数据
  - `01-使用工具概要和skill.md`：工具清单
  - `02-本次执行积累的SOP.md`：执行中积累的 SOP + 踩坑 checklist
  - `03-被测网站信息和基础信息.md`：R 层 — 目标 URL、账号、域名、侦察信息
  - `04-测试过程/`：A 层 — script/ / testdata/ / testcase/ 子目录
  - `05-测试报告/`：S 层 — 原始报告 + 白话版 + 专业版 HTML + PDF
  - `06-测试复盘/`：E 层 — 深度复盘 + 双三角复盘报告
- 报告格式偏好：专业版用腾讯大厂样式 HTML，同时出 PDF 副本
- 交付物清单：原始报告（HTML/JSON/MD/XML 4份）、白话版 MD、专业版 HTML、PDF

### 报告导出（reports API）

```python
# 多格式一次性导出
import urllib.request, urllib.parse
base = "http://127.0.0.1:8090"
# 列出可用模板
# GET /JSON/reports/view/templates/ → ["traditional-html", "traditional-json", "traditional-md", "traditional-xml", "sarif-json", ...]
params = {
    "template": "traditional-html",
    "theme": "",
    "description": "Xplorechips ZAP Security Scan",
    "contexts": "xplorechips,",  # comma-separated context names
    "sites": "https://www.xplorechips.com",
    "sections": "",
    "includedConfidences": "",
    "includedRisks": "",
    "reportFileName": "xplorechips-zap-final",
    "reportFolder": "/path/to/reports/",  # ⚠️ must exist
    "reportDir": "",  # leave empty — folder is the output dir
    "display": "false"
}
data = urllib.parse.urlencode(params).encode()
req = urllib.request.Request(base + "/JSON/reports/action/generate/", data=data)
# 返回 {"code": "OK", "reportPath": "...", "reportFileName": "xplorechips-zap-final.html"}
```

5 种模板各生成一次：`traditional-html`, `traditional-json`, `traditional-md`, `traditional-xml`, `sarif-json`。

### 全数据量优化

当扫描产生 15,000+ 告警实例时，不要直接从 `/JSON/alert/view/alerts/` 拉全量：
- 先查 `alertCountsByRisk` 获知风险分布：`GET /JSON/alert/view/alertCountsByRisk/?baseurl=https://target.com`
- 用 `numberOfAlerts` 获知告警数量：`GET /JSON/alert/view/numberOfAlerts/?baseurl=https://target.com`
- 调试视图 `messages` 也需要谨慎——500条消息 × 请求/响应头 = ~166MB，不要一次性拉全量
- 始终用 `count` + `start` 分批读取，或在独立脚本内过滤
- 告警实例数过多（如17,102）时监控脚本别拉全量 alerts，只拉 scans 状态

### 人工复核标记

```python
# 更新告警置信度（标记误报）
# confidenceId=0 → false positive
get(f"/JSON/alert/action/updateAlertsConfidence/?ids=4336,4337&confidenceId=0")
# 更新告警风险等级（降级）
get(f"/JSON/alert/action/updateAlertsRisk/?ids=4336,4337&riskId=1")  # 0=info, 1=low, 2=medium, 3=high
```

批量操作（16,000+ 告警中一批标记）在独立 Python 脚本内执行，避免工具调用超时。

## User preferences (from this session)
- 老大要求：先确认授权再扫描；OPRASE 格式方案；清单体回复；报告腾讯样式+PDF；全程自主执行不打扰
- **输出纪律（重要）**：老大明确要求**分段输出到文件，不一次性吐出长内容**。所有大交付物（报告 HTML/PDF、SOP、复盘）必须拆脚本分段写盘（p1/p2/p3 追加模式），不要一次性生成全量内容推入对话。长任务（扫描、监控）用 `background=true + notify_on_complete` 跑，中间产物落盘，只回结论。
- **文档量级控制**：单个输出 > 50KB 的原始数据（全量 alerts、大 JSON）不进对话，在 `execute_code` 或独立脚本内聚合后只回结论。中间产物放 `testdata/*.json` 或 `data/` 子目录。

## Agent 执行纪律（防限流/防熔断/防打断）

本 skill 对应的是"多个并行 + 7-9 步串行"的长链路任务，极易触发 Agent 的工具调用上限或输出长度熔断。本节是本次实测后沉淀的**红线级纪律**。

### 两种限制，区分清楚

- **工具调用次数熔断（iteration cap）**：单个回合 tool call 累计到上限被叫停。与字数无关。解决：脚本化、后台通知。
- **输出长度截断（⚠️ Response truncated / output length limit）**：单条工具返回或一次回复太长，显示层截断。通常文件已落盘成功，只是对话里没显示全。解决：先 `ls/wc/grep` 核验再决定是否重做。
- 另有**长任务命令的 wait 被 clamp**（想等 120s 实际等 60s）——属正常，不代表失败。

### 严格遵守的标准做法

- 长任务（扫描、导出、监控）一律 `terminal(background=true, notify_on_complete=true)`，不用同步长轮询。
- 数据处理放 `execute_code`/独立脚本内**聚合后只回结论**，别把上万条原始告警灌进对话。
- 中间产物落盘 `04-测试过程/testdata/*.json`，跨会话可续。
- 字符串里疑似密钥/URL 会被显示层打码进而改坏脚本——用字符串拼接/环境变量规避，落盘前用 `ast.parse` 校验。
- 大交付物（正式 HTML/PDF/SOP/复盘）**分段写文件**：拆成 p1/p2/p3 子脚本，每个只追加一段，分别执行，不要一次生成全量文本推入对话。
- 单次输出 > 50KB 的数据不进对话：在脚本内过滤/聚合/落盘后，只回结论行（1-2 句）。
- **编辑既有文件用追加（>>）或 patch，慎用整文件 write_file 覆盖**。覆盖前先 read 或备份。本次曾两次误覆盖 SOP 和 QC 报告，靠重建浪费一轮。
- **新工具/新版本先拉自描述**：动手前用 `/UI/<component>/` 或 `/JSON/<component>/view/` 一次性取全 action/view 及参数名，把 ZAP 2.17 的 API 试错次数压到 0。
- **监控只看计数**：ascan 进行中只轮询 `scans`（state/progress/reqCount/alertCount），**FINISHED 后才拉一次明细**。拉 1.7 万 alerts 会卡死。

### 熔断后的续跑策略

如果任务在中间被打断（存返回/工具调用上限/输出截断）：
1. 先落盘/查盘确认"哪些其实已完成"，不重做。
2. 用 todo 标出剩余项，按"一个脚本=一批"粒度推进，每批一句话汇报。
3. 被截断时判断：是调用次数熔断（拆批）还是输出截断（文件可能已成功，先 `ls/wc/grep` 核验再决定）。
4. 检查 ZAP daemon 是否存活：`GET /JSON/core/view/version/`
5. 检查扫描状态：`GET /JSON/ascan/view/scans/`
6. 从上次停下处续跑——不要从头来

### 跨多个 session 的续跑

- 项目目录里的 `04-测试过程/script/` 脚本是幂等的（可重跑）
- session 注入的 httpSession 在 ZAP 重启后失效，需要重新注入
- context 定义在 ZAP 重启后也需要重建

### 交付物脱敏红线（本次 QC 真抓到的）

- **ZAP 自动导出的原始报告（html/json/md/xml/sarif）含登录账号邮箱和 JWT**，不能直接当交付物。
- 纪律：ZAP 原始证据保留在 `~/.ZAP` 与 `04-测试过程/testdata`；放进交付目录的导出件**一律过脱敏脚本**（邮箱→`[REDACTED-EMAIL]`、JWT→`[REDACTED-JWT]`、口令→`[REDACTED-PASSWORD]`）。
- 正式 PDF 也要用 `pdftotext` 反查一遍邮箱/JWT/占位符，不能只信 HTML 源。
- 脚本里不硬编码密钥：要校验脱敏时，从内部信息文件（如 `03-被测网站信息.md`）动态读取目标口令再去交付物里搜。

### 交付前跑 QC 脚本

一条命令做全部检查，发现三类问题挡在交付前：

| 检查项 | 命令/脚本 |
|---|---|
| 存在性/非空 | `ls -la` + `wc -c` |
| PDF 页数/占位/关键内容 | `pdftotext` 反查 `__PAGES__` |
| HTML 闭合/table 配平 | `grep -c '</html>'` |
| 脱敏（邮箱/口令/JWT） | 从 `03-信息.md` 动态取口令 → 交付物搜 |
| 关键数字一致性 | `grep "9645"` / `grep "542"` |
| JSON/XML 合法性 | `json.load()` / `xml.etree.ElementTree.parse()` |

见 `script/18_delivery_qc.py` 参考实现（42项检查，全部 PASS 后交付）。

## 可执行工具脚本（scripts/，已实测）

本 skill 自带 3 个泛化工具，跨项目直接调用（不绑定具体目标）：

1. **启动前自检**：`scripts/zap_preflight.py --base http://127.0.0.1:8090 [--need-browser]`
   - 体检 daemon/版本、HttpStateEnabled、2.17 关键 API 是否存在（createEmptySession/includeInContext/fullResults/scans/templates）、限速选项、Chrome-driver 版本。
   - 退出码 0 通过 / 1 有 FAIL。**开扫前先跑**，把 API 试错次数压到 0。
2. **项目骨架**：`scripts/zap_scaffold.py --target <新项目目录>`
   - 一键创建 OPRASE 六层目录（00~06 全部模板 md + 空 subdir），开新站先跑这个，不必一次扫完所有需求。
3. **交付脱敏**：`scripts/zap_redact.py --dir <报告目录> [--secret-file 03-信息.md]`
   - 正则替换邮箱/JWT/bearer token，并从内部信息文件动态提取口令字面值（脚本不硬编码）；脱敏后回校 JSON/XML 合法性。原始证据留在 ~/.ZAP 与 testdata。
3. **交付前 QC**：`scripts/zap_delivery_qc.py --root <交付根> --out <QC.md> --pdf <rel> --html <rel> --scan-dirs <d1,d2> [--secret-file ...] [--must-contain 'rel:kw,kw'] [--expect-number 9645]`
   - 检查 PDF 页数/占位/内容、HTML 闭合与 table 配平、JSON/XML 合法、脱敏（含 PDF 反查）、关键数字一致性，落盘 Markdown。

> 首个完整落地参考：`~/测测的工作空间/ZAP安全测试-xplorechips/`（脚本 01~19 + SOP v1.1 + QC 42 项全过）。

## Important pitfalls / lessons

### ZAP 2.17 API 陷阱
- `setOptionXxx` 参数名取决于选项类型（`Integer`、`Boolean`、`String`），不是统一叫 `value`。查 `/UI/<component>/` 页面确认参数名。
- `setOptionHttpStateEnabled` 必须用 **GET** 请求（不是 POST），参数 `Boolean=true` — 用 POST 报 400 missing_parameter。
- 会话管理 API 名与旧版不同：建会话是 `createEmptySession`，注 token 参数是 `sessionToken`/`tokenValue`，激活用 `session`（会话名，非 id）。
- Context include API 名：`includeInContext`（非 `addIncludeRegex`）。
- Spider 视图名：`fullResults`（非 `resultsFull`），`results` 需要 `scanId` 参数。

### 会话注入流程
- 必须先开启 `HttpStateEnabled=true`，否则 ZAP 不跟踪会话
- httpSessions 注入的会话独立于 ZAP session（newSession 不会清空它）
- 但 context 定义会被 newSession 清空 → 确保 context 建在 session 之后
- 注入后验证：用 clean local cookie jar 经 ZAP 代理请求需登录页面，检查 200 且含登录标记

### 爬虫防无限
- 带分页的商品站必须设 `maxDuration`（单位分钟），默认 0=无限
- 首次 3% 时 URL 可能已达 8000+ 条，但树节点只有 600+ → 分页循环
- `results` 返回的是 URL 字符串列表，`fullResults` 返回的是完整对象

## Session-specific details (see references/)
- Wrapper source code and ZAP installation paths
- Actual scan output verification
- Daemon start/stop patterns with API key config
- `references/zap-ascan-patterns.md`: Active scan rate limiting, URL template dedup, monitoring, auth verification
- `references/zap-pii-false-positive.md`: PII alert false positive triage method (plugin 10062 on e-commerce/catalog filter pages)
- `references/zap-cli-session.md`: CLI session details
- `references/zap-session-detail.md`: Detailed session injection example

## Related skills / overlaps
- `web-exploratory-tester` (qa): exploratory web testing / dogfood — overlaps on web page testing but this skill is specifically for security scanning with ZAP, not general exploration
- `security-reviewer` (openclaw-imports): code/infrastructure security review, not URL-level vulnerability scanning
- `dogfood`: exploratory bug-finding on web apps — complementary, not overlapping in tool (ZAP vs manual exploration)
- Note: if consolidation is needed, `web-security-scanning` (this) should stay as the ZAP-specific scanning umbrella; `security-reviewer` handles code-level audits.
