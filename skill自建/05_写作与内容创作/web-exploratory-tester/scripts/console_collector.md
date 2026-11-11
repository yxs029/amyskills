# Console Errors 收集工具说明

## 用途
在 AI 探索测试过程中，集中收集所有浏览器控制台错误，最终汇总到 `<output_dir>/console.log`。

## Agent 端调用模式

```python
# 在 SKILL.md 的 Phase 4 中调用
def collect_console_errors():
    """调用 browser_console 获取错误，存入 log。"""
    errors = browser_console(clear=False)
    if errors.get('js_errors'):
        with open('console.log', 'a') as f:
            for err in errors['js_errors']:
                f.write(f"[{datetime.now()}] {err}\n")
    return errors
```

## 触发时机

在以下事件**之后**调用：

1. 每次 `browser_navigate` 后
2. 每次 `browser_click` 后
3. 每次 `browser_type` 后
4. 每次页面长时间等待后

## 关注三类输出

1. **`js_errors`** — 未捕获 JS 异常（最严重）
2. **4xx/5xx 网络错误**（控制台 Failed to load resource）
3. **deprecation warnings**（生产环境不应有）

## console.log 输出格式

```
[2026-06-03 12:30:15] [NAV] https://target/dashboard
[2026-06-03 12:30:18] [ERROR] Uncaught TypeError: Cannot read property 'foo' of undefined
  at handleClick (app.js:123)
[2026-06-03 12:30:20] [WARN] [Deprecation] ...
[2026-06-03 12:30:25] [CLICK] @e25 (登录公众号按钮)
[2026-06-03 12:30:30] [ERROR] Failed to load resource: 401 Unauthorized
```

## 关联到 Issue

发现 console error 时，**如果对应 issue 存在**，添加证据：
```json
{
  "console_errors": "[2026-06-03 12:30:18] Uncaught TypeError..."
}
```

如果 console error **没有对应 issue**（孤立错误），单独记录为新 issue：
- 严重性：看错误类型
  - `Uncaught Error/TypeError` → High
  - `404` → Medium
  - `deprecation` → Low
