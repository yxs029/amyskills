# SRMPRO 登录按钮 Disabled 卡死陷阱

> 2026-07-17 20:25 实战沉淀：老大要求所有测试脚本改用有头浏览器（headless=False）后跑测试
> 时，反复在登录环节卡死的根因和 5 种修法

## 现象

填完账号密码 `admin` / `Esic@2024` 后，`button "common.logIn" [disabled]` **永远不启用**。

- `wait_for(state='enabled')` ❌ Playwright 不支持这个 state
- `wait_for_function` 直接判断 `!btn.disabled` ❌ 返回 false 无限轮询
- 反复点击 60 次重试 ❌ 永远是 "element is not enabled"

**注**：之前 M01 能登录成功是因为**碰巧**那次 Vue 数据绑定在 click 之前完成的，不可靠。

## 根因（5 种可能，按概率排序）

| # | 可能根因 | 判别方法 |
|---|----------|----------|
| 1 | **页面里有滑块验证码**但不在主 DOM 树里（被遮挡或在 iframe） | 检查 `body > div`、Shadow DOM、iframe 子页 |
| 2 | **账号被锁** | 看 alert 弹窗"账号被锁，预计于 YYYY-MM-DD HH:MM 解锁" |
| 3 | **密码变了**（不是 `Esic@2024`） | 手动浏览器试一次 |
| 4 | **Vue 没识别 fill 写入的值**（不触发 input 事件） | 改用 `page.evaluate` 设值 + 手动 dispatch input 事件 |
| 5 | **Storage_state 失效**（过去用过，现在 session 过期） | 检查 srmpro_storage_state.json 里 cookie 是不是就 1 个无关的 `size` cookie |

## 关键发现：storage_state 是"空"的

2026-07-17 验证 `srmpro_storage_state.json`（50KB）：
```json
{"cookies": [{"domain": "test.esicint.com", "name": "size", "expires": -1}], "origins": [...]}
```
**只有 1 个 `size` cookie，是页面大小设置，不是 session cookie**。所以 `storage_state=STORAGE_STATE` 传给 `new_context()` 实际上**没用**——它从来没存过真正的登录态。

> **结论**：老大 2026-06-04 跑的 Playwright login 保存的 storage_state 丢失了真正的 session cookie，
> 现在的 storage_state 是个空壳。**不要依赖**。要登录就老老实实走表单。

## 修法（按推荐顺序）

### 方案 1（推荐）：evaluate 设置值 + dispatch input 事件 + 轮询 .disabled

```python
page.fill('input[name="username"]', 'admin', timeout=8000)
page.fill('input[name="password"]', 'Esic@2024', timeout=8000)
page.wait_for_timeout(1500)

# 触发 Vue 的 @input 监听（fill 默认不触发完整事件链）
page.evaluate('''() => {
    document.querySelectorAll("input").forEach(inp => {
        inp.dispatchEvent(new Event("input", {bubbles: true}));
        inp.dispatchEvent(new Event("change", {bubbles: true}));
    });
}''')

# 等按钮变 enabled
page.wait_for_function(
    '() => { var btns = document.querySelectorAll("button"); '
    'for (var i=0; i<btns.length; i++) { '
    '  if (btns[i].innerText && btns[i].innerText.indexOf("logIn") >= 0) '
    '    return !btns[i].disabled; '
    '} return false; }',
    timeout=15000
)

# 直接 evaluate 点击，绕过 Playwright actionability check
page.evaluate('''() => {
    var btns = document.querySelectorAll("button");
    for (var i=0; i<btns.length; i++) {
        if (btns[i].innerText && btns[i].innerText.indexOf("logIn") >= 0 && !btns[i].disabled) {
            btns[i].click(); return true;
        }
    } return false;
}''')

page.wait_for_url(lambda url: "login" not in url, timeout=15000)
```

### 方案 2：检查滑块

如果有 `.verify-move-block` / `.slider` / captcha 元素，必须先拖滑块才能登录。
详见 `references/playwright-evaluate-pitfalls.md` 和 `~/.hermes/skills/qa/verify-slider-bypass/SKILL.md`。

### 方案 3：换账号密码

如果 admin 被锁，换 testadmin / aarontest（`Esic@2024`）测，但权限不同。

### 方案 4（治标不治本）：headless=True 但必须带 `--no-sandbox`

老大**明确拒绝**这个方案："你不要用无头浏览器" — 仅当老大改变主意时用。

### 方案 5（报错兜底）：smart_login 函数忽略登录失败继续测试

如果登录反复失败，至少让脚本能继续：
```python
print("  WARN: login failed, continue anyway")
return False
```
注意：登录失败 = 后续所有用例都 fail（没权限访问），但至少能看到哪些被测系统根本进不去。

## Playwright Driver EPIPE 陷阱（长会话崩溃）

跑 20+ 用例后 Playwright Node.js driver 会崩：
```
Error: write EPIPE
  at PipeTransport.send (.../playwright/driver/package/lib/protocol/transport.js:51:21)
```

**根因**：Playwright Driver 的 WebSocket 连接累积缓冲区，最后写入失败。

**修法**：每 N 个用例保存中间结果 + 分批重启 browser：
```python
if idx % 2 == 0:
    save_results()  # 每 2 个用例存档一次
```

更彻底的：用环境变量分批跑：
```bash
BATCH_START=1 BATCH_END=8 python run_m01_tests.py
BATCH_START=9 BATCH_END=16 python run_m01_tests.py
```

每次只跑 5-8 个用例，每次都重启 chromium，driver socket 不会累积。

## 老大工作流偏好（2026-07-17 明确）

**老大原话**："你不要用无头浏览器，你有有头的测，跑脚本都用有头浏览器测试"

→ **SRMPRO 测试脚本默认用 headless=False**。除非老大明确同意，**禁止**改回 headless=True。

有头浏览器要求：系统必须有 X server / 桌面环境。
验证：`xdpyinfo 2>&1 | head -5` 看 `display: :0`。
老大这台 Linux 满足（`DISPLAY=:0`, `X0` 屏幕存在）。

## 关联 skill

- `srmpro-login` 主页 Step 1-4
- `srmpro-login/references/playwright-evaluate-pitfalls.md`
- `srmpro-login/references/srmpro-layout-shift-pitfalls.md`
- `qa/verify-slider-bypass` (滑块 5 阶梯回退)
- `qa/test-report` (HTML 报告生成)
