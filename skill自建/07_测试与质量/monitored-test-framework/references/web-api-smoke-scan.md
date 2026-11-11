# Web API 接口层冒烟扫描方法论（v11 新增 · 2026-07-28）

> **位置**：monitored-test-framework skill 第 8 层（接口层）
> **触发场景**：用户说"遍历所有 API 接口找 bug"、"扫接口报错"、"接口冒烟"
> **实战来源**：SCC (scc.esicint.com:48080) 全量 API 扫描 2026-07-28（572 接口 / 21 秒 / 找出 11 个 500 + 83 个 400 + 2 个慢接口）

## 适用场景

- 拿到一个 Web 系统的 URL + 账号，需要快速判断后端 API 健康度
- 想找服务端空指针、参数校验缺失、慢接口、信息泄露
- 不想深度业务流程遍历，只想冒烟全部接口
- **和 monitored-test-framework UI 层的区别**：UI 层深度操作单页面，本模式批量扫所有接口的状态码

## 三层工作流

### Layer 1：静态 API 路径提取（5 分钟）

**核心思路**：从前端打包 JS 里 grep 出所有 URL 路径，不依赖字典爆破。

```python
import re, subprocess

# 1. 抓主入口 HTML 找 JS bundle
r = subprocess.run(["curl", "-s", "https://target.com/", "--max-time", "30"], capture_output=True, text=True)
js_files = sorted(set(re.findall(r'static/js/[a-zA-Z0-9_./\-]*\.js', r.stdout)))

# 2. 对每个 JS 文件 grep URL 模式
all_paths = set()
for js_file in js_files:
    r = subprocess.run(
        ["curl", "-s", f"https://target.com/{js_file}", "--max-time", "60"],
        capture_output=True, text=True
    )
    # 多个 URL 模式尝试
    patterns = [
        r'["\'`](/admin-api/[a-zA-Z][a-zA-Z0-9_\-/]+)["\'`]',  # Spring Boot /admin-api/* 风格
        r'["\'`](/api/[a-zA-Z][a-zA-Z0-9_\-/]+)["\'`]',
        r'["\'`](/[a-zA-Z][a-zA-Z0-9_\-]+/[a-zA-Z][a-zA-Z0-9_\-]+(?:/[a-zA-Z][a-zA-Z0-9_\-]+)+)["\'`]',
    ]
    for pat in patterns:
        all_paths.update(re.findall(pat, r.stdout))
```

**提取效果**：SCC 系统一次提取出 **572 个业务 API 路径**，比字典爆破覆盖率高 10 倍。

**避坑**：
- JS bundle 可能 17MB，curl 加 `--max-time 60`
- webpack 数字 ID（如 `e("940b")`）不是 chunk hash，要进 chunk 内反查（netdisk-security-audit skill 有说）
- Vue 项目通常找 `src/utils/request.js` 看 axios 的 baseURL，找到了 `http://scc.esicint.com:48080/admin-api/`

### Layer 2：浏览器上下文内绕过滑块登录（3 分钟）

**关键经验（SCC 实战确认）**：

直接用 `urllib.request` 或 `curl` 打后端 48080 端口**会被防火墙挡住**（虽然 DNS 解析正常）。

**唯一有效方式**：用 Playwright 启动浏览器 → 加载首页 → 在浏览器 fetch 上下文内发请求。

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path="/usr/bin/chromium-browser",  # 系统已有的 chromium，避免下载
        args=['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    )
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    page.goto("http://scc.esicint.com/", timeout=30000)
    page.wait_for_timeout(2000)
    
    # 在浏览器内直接打登录 API（绕过前端滑块验证）
    login_resp = page.evaluate("""async () => {
        const r = await fetch('/admin-api/system/auth/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: 'admin', password: 'Esic@2024'})
        });
        return {status: r.status, data: await r.json()};
    }""")
    token = login_resp['data']['data']['accessToken']
```

**关键发现**：Element UI 的 `verify-move-block` 滑块**服务器不二次校验**，前端绕过即可登录。

### Layer 3：批量扫描所有 API（核心，21 秒扫 572 个）

**5 个组合配方**：

```python
# 1. 用相对路径 fetch（走 nginx 反代到 48080 后端）
url = f"/admin-api{api_path}"

# 2. 自动判断 GET/POST（按路径名推测）
is_post = any(kw in api.lower() for kw in [
    'save', 'update', 'create', 'delete', 'submit',
    'export', 'upload', 'config', 'authorize',
    'login', 'logout', 'send', 'forget', 'bind',
    'sign', 'postpone', 'reject', 'approve', 'undo'
])

# 3. ⚠️ 必须带的两个头（缺一个就 500）
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json',
    'locale': 'zh_CN'  # 必备！否则 500: "Required request header 'locale'"
}

# 4. POST 时 body 必须有效 JSON（不能 None 或空字符串）
body = "{}" if is_post else None

# 5. 用 page.evaluate 而不是 context.request（前者走浏览器网络栈，会保留 cookie）
result = page.evaluate("""async (args) => {
    const t0 = performance.now();
    try {
        const r = await fetch(args.url, {
            method: args.method,
            headers: args.headers,
            body: args.body
        });
        const body = await r.json();
        return {status: r.status, body, duration: performance.now() - t0};
    } catch (e) {
        return {error: e.toString()};
    }
}""", {"url": url, "method": "POST" if is_post else "GET", "headers": headers, "body": body})
```

**关键发现 1：locale 头遗漏导致 500 误判**

跑 SCC 时第一次扫描发现 11 个 500 错误，其中 3 个实际上是**缺 `locale` 请求头**：
```
Required request header 'locale' for method parameter of type String
```
这种 500 是**客户端 bug**，不是服务端 bug。加了 `locale: 'zh_CN'` 后这 3 个变成正常的 1006000000 系列业务错误。

**教训**：扫描前**先抓一个已知接口**测试必需头，不要一上来就 200 个并发扫。

**关键发现 2：405 错误是 GET/POST 不匹配**

扫描时按路径名推测 GET/POST，SCC 实际有 108 个 405 Method Not Allowed。**不是 bug，是扫描策略限制**。

## 结果分类标签

| label | 含义 | 是否 bug |
|---|---|---|
| OK | code=0 或 200 | ✓ 正常 |
| AUTH_ERR | code=401 token 失败 | 配置问题（重置 token）|
| BIZ_ERR_400 | 请求参数缺失或格式错 | ⚠️ 前端没做表单校验（关注高频接口）|
| BIZ_ERR_404 | 接口路径不存在 | ❌ **真实路径错误**（可能前端代码引用了删除的接口）|
| BIZ_ERR_500 | Java 异常（NPE/JSON 解析）| 🔴 **严重服务端 bug** |
| BIZ_ERR_405 | GET/POST 不匹配 | 扫描策略限制，非 bug |
| UNKN | 响应非 JSON | 看具体 body |

## SCC 实战数据（2026-07-28）

| 维度 | 数据 |
|---|---|
| 总 API | 572 |
| 扫描耗时 | 21 秒 |
| OK | 34（5.9%）|
| 🔴 500 错误 | 11 |
| 🟡 400 错误 | 83 |
| ⚫ 405 不匹配 | 108 |
| 慢接口 >1s | 2 |

**最严重发现**：`/ov/ai-agent/prepare-converse` 错误信息含内网 IP `192.0.2.178:8080`
**NPE 高发模块**：rfq（询价报价）43 个错误，scar（供应商改善）22 个

## 与 UI 层的协作

**推荐组合**：UI 层（monitored-test-framework 主框架）做深度单页面验证，接口层（本方法）做冒烟广覆盖。

```yaml
v11 协作模式:
  ui_layer:
    tool: browser-use / Playwright
    目标: 单页面深度操作 + DOM 断言
    耗时: 单页面 30s-2min
  api_layer:
    tool: Playwright 浏览器上下文 + fetch
    目标: 全部接口冒烟扫描
    耗时: 572 接口 / 21 秒
```

**互补关系**：
- UI 层找到"按钮点了没反应" → 接口层能查到是哪个 API 返回 500
- 接口层找到"500 错误" → UI 层能做业务流重现

## 与 TestersAI skill 的协作

| TestersAI 能力 | 本方法提供 |
|---|---|
| Bug Detection | ✅ 直接给出 BUG 清单（含 500 + 400）|
| Test Case Generation | 本方法的 API 清单 = 用例蓝图 |
| Persona Feedback | UI 层做 |
| Test Execution | Playwright 浏览器跑 |

## 必读踩坑（Pitfalls）

### 踩坑 1：绝对 URL 被防火墙挡
```
urllib.request 打 http://target:48080/admin-api/system/menu → 超时
但 page.evaluate 在浏览器内 fetch /admin-api/system/menu → 成功
原因：内网后端端口没暴露公网，nginx 反代才是公网入口
```
**修复**：永远用浏览器内 fetch 或相对路径。绝对 URL 仅在已知 nginx 暴露时用。

### 踩坑 2：locale 头遗漏 → 误判 500 误报为服务端 bug
**修复**：扫描前先打一个已知接口确认必需头。SCC 至少需要 `Authorization + locale`。

### 踩坑 3：axios 实例未暴露 → 不能 hook
参考 netdisk-security-audit skill 的 XHR/fetch 拦截脚本。

### 踩坑 4：超时设置过短 → 后端慢接口被误判为失败
**修复**：单接口 timeout 8 秒 + 总超时 5 分钟。

### 踩坑 5：错把扫描策略误判当 bug
108 个 405 不是 bug，是扫描时猜错 GET/POST。**报告里必须说明"扫描策略限制"**，避免误导。

## 输出物清单

- `api_scan_full.json` - 完整结果（含所有 label）
- `api_scan_quick.json` - 30 个核心接口快速版
- `scc-api-scan-report.html` - 暗色主题 HTML 报告
- 中间产物：`api_scan.py`（可重跑脚本）

## 下一步可做

1. **业务流程遍历**：用真实用户操作（登录→下询价单→审批→下单）触发更深 bug
2. **并发压测**：locust/k6 跑核心 API 找性能瓶颈
3. **逆向 JS chunk**：从静态提取的 JS 里分析加密 / 鉴权 / 风控逻辑
4. **接口 + UI 对账**：每个接口至少触发一次 UI 操作确认
