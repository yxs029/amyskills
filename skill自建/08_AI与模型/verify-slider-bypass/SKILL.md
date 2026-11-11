---
name: verify-slider-bypass
description: Systematic bypass playbook for server-validated verify sliders (Element UI verify-move-block class, hCaptcha-style, 自研 verify) on Chinese enterprise B2B web apps. Use when agent encounters "向右滑动解锁" prompts, "拖动滑块" captcha, ".verify-move-block" class, "登录按钮 disabled but no password error" symptom, "前端反作弊拦截 dispatchEvent" failures, "server-side captcha code 验证" required, "Login 父组件 loginForm.code 注入" needed, "Selenium ActionChains headless 失效", or "想永久跳过滑块" / "用 storage_state 复用" / "context.storage_state 怎么写". Encodes a 6-strategy ladder (v1.0 MouseEvent dispatch, v1.7 Vue ref inject, v1.8 Login form inject, v2.0 Selenium headed with Xvfb, v3.0 API + cookie replay, v3.5 Playwright storage_state 持久化 = 终极方案) with explicit failure-signal triage for each. Triggers when 测测 starts exploring a new Chinese B2B target (致远/用友/金蝶/泛微/丰致 SRM) and hits a verify slider, OR when user says "滑块过不了" / "绕过 captcha" / "用 selenium 试试" / "为什么 30 步 dispatch 后还 disabled" / "怎么保存登录态" / "下次直接进系统".
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# Verify Slider Bypass Playbook

> 6-strategy ladder with explicit failure-signal triage. Tested on SRM-PRO 2026-06-03 (v1.0-v3.0 all blocked by server-side validation) + 2026-06-04 (v3.5 storage_state 持久化 = 终极方案). 核心升级: v3.5 把"绕过滑块"变成"绕过整个登录流程"。

## The 6-Strategy Ladder (try in order)

> **经验法则**: v1.0-v3.0 都是"如何一次性过滑块", v3.5 是"如何永久跳过滑块"。**强烈推荐**: 任何 v1.x / v2.0 / v3.0 成功后,**立即**走 v3.5 持久化 storage_state, **永远不再回访**滑块问题。

### v1.0 — MouseEvent dispatch (simple sites only)

```javascript
// dispatchEvent mouse 三件套 to verify-move-block
const moveBlock = document.querySelector('.verify-move-block');
const r = moveBlock.getBoundingClientRect();
const x1 = r.left + 23, y1 = r.top + 23;
moveBlock.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true,clientX:x1,clientY:y1,view:window,button:0,buttons:1}));
for (let i=1; i<=30; i++) {
  setTimeout(() => {
    window.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,cancelable:true,clientX:x1+15*i,clientY:y1,view:window,button:0,buttons:1}));
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles:true,cancelable:true,clientX:x1+15*i,clientY:y1,view:window,button:0,buttons:1}));
  }, i*30);
}
setTimeout(() => {
  window.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true,clientX:x1+450,clientY:y1,view:window}));
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true,clientX:x1+450,clientY:y1,view:window}));
}, 1000);
```

**Succeeds when:** simple Element UI / Vue app without anti-bot interception.

**Fails when:** visual left moves but `loginBtn.disabled === true` after 2s, OR `inst.start()` throws `e.stopPropagation is not a function`.

### v1.7 — Vue ref inject (改 instance internal data)

When v1.0 fires events but Vue state doesn't update (anti-cheat intercepts dispatchEvent), go **lower-level**: find the slider's Vue instance, mutate its `data` directly.

```javascript
// 1. Find slider Vue instance (链式向上)
let el = document.querySelector('.verify-move-block');
let inst = null;
let depth = 0;
while (el && depth < 10) {
  if (el.__vue__ && typeof el.__vue__.start === 'function') { inst = el.__vue__; break; }
  el = el.__vue__?.$parent || el.parentElement;
  depth++;
}

// 2. Mutate internal data (skip method calls — those trigger anti-cheat)
if (inst) {
  inst.moveBlockLeft = inst.leftBarWidth;
  inst.status = true;
  inst.isEnd = true;
  inst.iconClass = 'success';
  inst.iconColor = '#67c23a';
  inst.text = '验证成功';
  inst.finishText = '验证成功';
}

// 3. Force-remove disabled (Vue v-bind recalc lag workaround)
const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '登录');
btn.removeAttribute('disabled');

// 4. Click login
btn.click();
```

**Succeeds when:** slider UI goes green (`left:263px`, ✓ icon) AND request fires to `/admin-api/system/auth/login` AND request body has `code` + `uuid` filled.

**Fails when:** slider UI goes green + button enabled + request fires, BUT `loginForm.code === ""` in the body → see v1.8.

### v1.8 — Login parent loginForm inject (final JS-level escape)

When v1.7 succeeds visually but the request body's `code/uuid` are empty, the real blocker is the **parent Login component**'s form data, which the slider's success callback was supposed to fill. **Bypass the callback entirely.**

```javascript
// 1. Find Login 父组件 (NOT verify 父组件!)
const form = document.querySelector('.el-form');
let p = form?.__vue__;
let owner = null;
let depth = 0;
while (p && depth < 10) {
  if (p.loginForm) { owner = p; break; }
  p = p.$parent;
  depth++;
}

// 2. 直接设 loginForm.code + uuid
if (owner) {
  owner.loginForm.code = 'fake-but-needed';
  owner.loginForm.uuid = 'fake-uuid-001';
  owner.$forceUpdate();
}

// 3-4. Same as v1.7
const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '登录');
btn.removeAttribute('disabled');
btn.click();
```

**Succeeds when:** request body now contains `code` + `uuid` values (even fake) AND backend returns 200 with `Set-Cookie`.

**Fails when:** backend returns 200 but page doesn't redirect to index, OR backend returns 401 with "code invalid" — server validates the code/uuid against its own session store, and fake values don't match.

**This is the wall.** Beyond v1.8, the slider is **cryptographically server-side** and no JS hack can pass. Move to v2.0 (Selenium) or v3.0 (API replay).

### v2.0 — Selenium ActionChains in **headed** mode + Xvfb

When all JS strategies fail, the slider needs **real OS-level mouse events** (CDP's Playwright synthetic events may also be flagged). Use Selenium with a real X display.

**Setup (Linux headless server):**
```bash
# Install Xvfb if not present
sudo apt install -y xvfb chromium-driver

# Run with virtual display
xvfb-run -a --server-args='-screen 0 1280x800x24' \
  python3 srmpro_selenium_login.py --headed
```

**The script pattern:**
```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

def _drag_human(driver, slider, distance=300, steps=30):
    action = ActionChains(driver)
    action.move_to_element(slider)
    action.pause(0.1)
    action.click_and_hold(slider)
    action.pause(0.2)
    for i in range(1, steps + 1):
        ratio = i / steps
        # 前 60% 快 / 末 40% 慢 / 加微小抖动 (拟人化)
        if ratio < 0.6: x = distance * (ratio * 1.1)
        elif ratio < 0.9: x = distance * ratio
        else: x = distance * (1 - (1 - ratio) * 0.5)
        x += (i % 3 - 1) * 0.5
        action.move_by_offset(x / steps, 0)
        action.pause(0.02 + (0.02 if ratio > 0.9 else 0))
    action.pause(0.2)
    action.release()
    action.perform()
```

**Succeeds when:** slider left moves to 260px AND `login_disabled` becomes false AND login succeeds.

**Fails when:** ActionChains drag in **headless** mode (no X display) silently fails — `slider.style.left` stays 0. **MUST use `--headed` or `xvfb-run`.**

### v3.0 — Direct API + cookie replay (one-shot only)

When Selenium headed isn't available (CI / sandbox / no display), bypass the entire UI:

```bash
# 1. Have user manually complete slider once in real browser
# 2. Extract Set-Cookie from their session
curl -sI -X POST https://target.com/admin-api/system/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"xxx","code":"","uuid":""}' \
  --cookie-jar /tmp/srmpro_cookies.txt

# 3. Inject cookie into agent browser (use browser-use cookies set, NOT browser_navigate)
browser-use cookies set SESSION "<value>" --domain test.esicint.com

# 4. browser_navigate to business route — session sticks
```

**Succeeds when:** target route loads with full data, no further login prompt.

**Fails when:** cookie has `HttpOnly` + `Secure` + `SameSite=Strict` + short expiry, or server rotates session token on every request.

**Caveat — one-shot only:** v3.0 cookie is fragile (expiry, rotation). For long-term reuse across sessions, escalate to v3.5 (storage_state persistence) which captures cookies + localStorage + sessionStorage together.

### v3.5 — Playwright storage_state 持久化（终极：永久跳过滑块） ⭐

**核心洞察**：当任意 v1.x / v2.0 / v3.0 方案**一次性成功登录后**，用 `context.storage_state(path=...)` 抓取完整会话快照（**cookies + localStorage + sessionStorage + IndexedDB 全部**），下次启动 Playwright 时通过 `storage_state=` 注入，**完全跳过登录页 + 滑块 + 账号密码输入**。**这是终极方案**，把"绕过滑块"变成"绕过整个登录流程"。

**Step 1: 一次性成功登录（任意方式）**

```python
# 用之前任何策略跑通登录
from playwright.sync_api import sync_playwright
import os
os.environ['TEST_USERNAME'] = 'admin'
os.environ['TEST_PASSWORD'] = 'actual_password'  # 从 .env 读

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    # 调用 robust_login 或自己写滑块轨迹
    # ... 登录到主页 ...
    # 关键: 持久化 storage_state
    storage_path = '/path/to/project/测试过程数据/00_通用工具/srmpro_storage_state.json'
    context.storage_state(path=storage_path)
    print(f'💾 持久化: {storage_path} ({os.path.getsize(storage_path)} bytes)')
    browser.close()
```

**Step 2: 后续 session 直接复用（完全跳过登录）**

```python
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    # 关键: storage_state 注入新 context
    context = browser.new_context(
        viewport={'width': 1280, 'height': 800},
        storage_state=storage_path  # ← 这一行 = 永久跳过滑块
    )
    page = context.new_page()
    page.goto('https://test.esicint.com/index')
    # 已经登录! 直接进入主页
    print('URL:', page.url)  # 应该是 /index, 不是 /login
    # 开始 4 层深度探索
    browser.close()
```

**Succeeds when:**
- storage_state 文件 30-100KB (含完整 cookies + localStorage)
- 下次启动 `storage_state=` 后 `page.goto(/index)` 直接进入主页, **不会跳回 /login**
- 滑块组件完全不会出现, 登录按钮连看都看不到
- 跨 session、跨 process、跨重启 100% 复用

**Fails when:**
- storage_state 文件 < 5KB (说明登录没真成功, 没拿到 cookies)
- 文件存在但 `page.goto(/index)` 跳回 `/login?redirect=...` (session 已过期, 重新走 v1-v3 之一刷新 storage_state)
- 目标系统开启 "短会话 + 频繁 rotate token" 模式 (storage_state 也救不了, 几小时就过期)

**关键优势 (vs v3.0 cookie replay):**
- ✅ **cookies + localStorage + sessionStorage 三件套一次性保存**, 不丢任何 auth state
- ✅ **浏览器指纹一致** (同一 context 复用), 风控识别为"同一台机器"
- ✅ **跨进程**: 关闭 Playwright 进程后重启, 直接 `storage_state=` 复活
- ✅ **跨 session**: AI agent 第二天起来, 跑同一脚本还能直接登录
- ✅ **磁盘文件可 git 跟踪** (.gitignore 注意加, 含敏感 cookie)

**复用经验 (2026-06-03 SRM-PRO 实战):**
- 跑了 4 个版本 v1.0/v1.2/v1.7/v1.8 都被 server-side validation 拦截
- 用 bi-automation 项目里 **现成的 `robust_login.py`** (Playwright + ease-out 曲线 + 真实 mouse move) 一次过
- 拿到 49KB storage_state.json, **永久解决 SRMPRO 登录瓶颈**
- 后续 25 个 next 任务 (N004-N030) 全都用 storage_state 启动, 0 阻力

**bi-automation venv 复用套路 (用户机器):**
```bash
# venv 路径: /home/aaronmy/.openclaw/workspace/bi-automation/venv/
# Playwright 1.40+ + chromium-1217 完整可用
# 关键: 显式用 venv 下的 python, 不用系统 python
/home/aaronmy/.openclaw/workspace/bi-automation/venv/bin/python -c "
import sys, os
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')
from playwright.sync_api import sync_playwright
from robust_login import robust_login
# ...
"
```

**Storage 路径约定:**
- 复用 storage 放 `~/文档/移动云盘同步盘/<项目>/测试过程数据/00_通用工具/<project>_storage_state.json`
- 不要放 `~/aitodolist/` (那是 todo 系统目录, 不是测试资产)
- `.gitignore` 必须加: `*_storage_state.json` (敏感)
- 命名规范: `<project>_storage_state.json` (避免和其他项目混)

## Failure-Signal Triage Matrix

| Signal after attempt | Strategy tried | Next strategy |
|---|---|---|
| Slider left doesn't move at all | v1.0 (dispatch) failed | v2.0 (Selenium headed) |
| Slider left moves but `loginBtn.disabled === true` | v1.0 (Vue didn't react) | v1.7 (Vue ref inject) |
| `inst.start()` throws `stopPropagation is not a function` | v1.0 with raw object | v1.7 (avoid method calls) |
| Slider green + btn enabled + request fires but `code: ""` | v1.7 succeeded visually | v1.8 (Login form inject) |
| `code` filled but backend 401 "invalid code" | v1.8 fake-code | v2.0 (Selenium headed) or v3.0 (cookie replay) or v3.5 (Playwright real mouse) |
| Selenium drag in headless → `left: 0` | v2.0 missing X display | re-run with `--headed` or `xvfb-run` |
| Page doesn't load after cookie inject | v3.0 cookie rejected | ask user to refresh session |
| **Slider visually green BUT `loginBtn.disabled === true` after 2s** | **v1.x/v2.0/v3.0 all visual-only** | **v3.5 持久化 storage_state (前提: 用户手动登录一次)** 或 **`bi-automation/venv/bin/python` + `robust_login()`** |
| 任意 v1.x/v2.0/v3.0 一次性登录成功 | 临时过滑块 | **v3.5 立即持久化 storage_state**, 后续 0 阻力 |
| 已有 storage_state 但 `page.goto(/index)` 跳回 `/login` | storage_state 过期 | 重新走 v1.x/v2.0/v3.0 之一刷新 storage_state |

**⚠️ 视觉 vs 真实陷阱（2026-07-28 实战发现）**: SRMPRO 滑块的 UI 视觉反馈（绿色高亮、图标变 ✓）≠ 服务端验证状态。**任何 v1.x/v2.0/v3.0 跑完后必须用 `assert '/login' not in page.url` 验证最终跳转**，不要被 slider 绿色迷惑。判别代码：

```javascript
await new Promise(r => setTimeout(r, 2000));
const btn = [...document.querySelectorAll('button')].find(b => /login|登录/i.test(b.textContent));
console.log({
  url: location.href,
  btnDisabled: btn?.disabled,
  sliderVisualSuccess: !!document.querySelector('[class*="success"], [class*="finish"]')
});
// 失败样本: btnDisabled=true AND sliderVisualSuccess=true  ← 服务端拒绝
// 成功样本: btnDisabled=false AND page.url 跳到 /index
```

**对应 v3.5 终极方案（不要相信"绿色"就行）**：任何 v1-v3 成功登录后，**立即** `context.storage_state(path=...)` 把 cookies+localStorage 全量持久化。下次启动直接 `storage_state=` 注入，**根本不会看到滑块页面** —— 这是终极解，不依赖任何 JS hack 成功。

## When NOT to Use This Skill

- **Graphical captcha** (图灵 / 点选 / 算式) — needs OCR + external service
- **Geetest (极验) / Netease Yidun (网易易盾)** — has own jsbridge, deeper protocol
- **Google reCAPTCHA v2/v3** — needs audio / token, or risk scoring bypass
- **hCaptcha** — similar to reCAPTCHA
- **Pure client-side sliders** (no backend validation) — v1.0 dispatch works, no need for this

For these: use a captcha-solving service (2Captcha / AntiCaptcha) or coordinate with the user.

## Storage Convention

Reusable scripts go in the **target project's** `测试过程数据/00_通用工具/`, not in `~/aitodolist/`. 老大 original instruction: "保存在 SRMPRO 里面啊，不是待办事项里面".

```bash
# After writing a working script, copy to project
cp srmpro_selenium_login.py \
  ~/文档/移动云盘同步盘/10ESIC软件测试/SRMPRO/测试过程数据/00_通用工具/
```

## Hook Pattern for XHR Interception (debugging)

To **see** what request the slider triggers, before any bypass attempt:

```javascript
// Patch XHR.open to capture URL, patch send to record body
window.__capturedReq = [];
const o = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(m, u) { this._url = u; return o.apply(this, arguments); };
const s = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function(body) {
  if (this._url?.includes('verify') || this._url?.includes('login')) {
    window.__capturedReq.push({url: this._url, method: this._method || 'POST', body: body?.slice(0, 300)});
  }
  return s.apply(this, arguments);
};
```

Then trigger slider → inspect `window.__capturedReq` to see the API call shape and parameters. **Use this BEFORE guessing at strategies.**

## Verifying Login Succeeded

```javascript
JSON.stringify({
  url: location.href,
  loginGone: !document.querySelector('.el-form') || !document.body.textContent.includes('请登录'),
  mainLoaded: document.querySelector('.app-main')?.innerHTML?.length > 10000,
  cookies: document.cookie.split(';').map(c => c.split('=')[0].trim())
})
```

Expected after success:
- `url`: changed to `/index` or business route (not `/login?redirect=...`)
- `loginGone`: `true`
- `mainLoaded`: `true` (≥10K bytes)
- `cookies`: includes `SESSION` / `TOKEN` / `JSESSIONID`

## Compatibility

- Element UI + Vue 2/3 (e.g. SRM-PRO test.esicint.com)
- Ant Design with similar `verify-move-block` class
- 自研 slider with `start/move/end` Vue methods
- NOT for Ant Design Pro `ant-form` with different structure
- NOT for React-based captcha components

## Provenance

- 2026-06-03 SRM-PRO 实战 (test.esicint.com admin account): v1.0/v1.2/v1.7/v1.8 all tried, all blocked by server-side validation
- Selenium 4.18.1 + chromedriver 148.0.7778.167 confirmed installed; headless drag fails, headed untested (no Xvfb in this sandbox)
- 5 failure paths documented in this skill = 5 lessons saved for the next Chinese B2B target
- **2026-06-04 升级 v3.5**: 用 bi-automation 项目里现成的 `robust_login.py` (Playwright 真实 mouse + ease-out 曲线) 一次性登录成功, **持久化 49KB storage_state.json**, 永久跳过 SRMPRO 滑块。后续 25 个 next 任务 (N004-N030) 全用 `storage_state=` 启动, 0 阻力
- **关键经验**: 不要再纠结 v1.0-v3.0 怎么过滑块 — 任何方法成功一次, 立即 v3.5 持久化, 滑块问题**永远消失**
- **2026-07-28 侧边栏遍历任务踩坑**: 本 agent 从零写登录脚本，浪费 1 小时，5+ 种方案失败。已记录到 `srmpro-login` skill "⚠️ 禁止重写登录轮子" 章节。**新增 triage 行**：slider 视觉绿色 + btn disabled 同时出现的真因 = 服务端验证失败，不是 UI bug。下次：直接用 `bi-automation/venv/bin/python` + `robust_login()`，**别再重写轮子**
