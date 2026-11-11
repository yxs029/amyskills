# Playwright 自动化测试脚本模式（2026-07-17 实战总结）

从 SRMPRO 图纸库 10 模块 57 场景自动化测试中提炼的可复用模式。

## 1. 测试脚本骨架结构

```python
#!/usr/bin/env python3
import sys, os, json, time, base64, traceback
from datetime import datetime
from playwright.sync_api import sync_playwright

CHROME_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"
STATE_PATH = "path/to/storage_state.json"
TEST_URL = "https://test.esicint.com/..."
LOGIN_URL = "https://test.esicint.com/login"
SCREENSHOT_DIR = "path/to/screenshots"
RESULTS_DIR = "path/to/results_json"

all_results = {}

def init_results(module_name):
    """初始化结果数据结构"""
    return {
        "module": module_name,  # 注意：用 "module" 不是 "module_name"
        "system_name": "SRMPRO 图纸库",
        "test_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "test_url": TEST_URL,
        "test_users": "admin",
        "test_person": "测测(自动化)",
        "stats": {"total": 0, "pass": 0, "fail": 0, "skip": 0},
        "priorities": {"p0": {"pass": 0, "total": 0}, "p1": {"pass": 0, "total": 0}, "p2": {"pass": 0, "total": 0}},
        "cases": [],
        "defects": []
    }

def take_screenshot(page, name):
    """截图并自动重试白屏"""
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    try:
        page.screenshot(path=path, timeout=10000)
        if os.path.exists(path) and os.path.getsize(path) < 1024:
            time.sleep(2)
            page.screenshot(path=path, timeout=10000)
        return path
    except:
        return path

def add_result(results, tc_id, title, priority, status, steps, actual, screenshots, defect=None):
    """添加测试结果 - 截图自动转 base64 内嵌"""
    results["stats"]["total"] += 1
    if status == "pass": results["stats"]["pass"] += 1
    elif status == "fail": results["stats"]["fail"] += 1
    elif status == "skip": results["stats"]["skip"] += 1
    
    prio_key = priority.lower()
    if prio_key in results["priorities"]:
        results["priorities"][prio_key]["total"] += 1
        if status == "pass": results["priorities"][prio_key]["pass"] += 1
    
    # 截图转 base64 内嵌
    screenshots_b64 = []
    for ss_path in screenshots:
        if os.path.exists(ss_path):
            with open(ss_path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode()
                screenshots_b64.append({
                    "file": os.path.basename(ss_path),
                    "label": os.path.basename(ss_path).replace('.png',''),
                    "description": os.path.basename(ss_path),
                    "base64": f"data:image/png;base64,{b64}",
                    "size_kb": round(os.path.getsize(ss_path)/1024, 1)
                })
    
    case = {"id": tc_id, "title": title, "priority": priority, "status": status.upper(),
            "precondition": "用户已登录", "actual": actual, "defect": defect,
            "steps": steps, "screenshots": screenshots_b64}
    results["cases"].append(case)
    if defect: results["defects"].append(defect)
```

## 2. JS 设值避免搜索框不可见问题

```python
def js_set_input(page, value):
    """用 JS 设值避免搜索框不可见问题"""
    page.evaluate(f"""() => {{
        const inputs = document.querySelectorAll('input.el-input__inner, input[placeholder*="搜索"], input[type="text"]');
        for (const inp of inputs) {{
            if (inp.offsetParent !== null && inp.offsetHeight > 0) {{
                inp.value = '{value}';
                inp.dispatchEvent(new Event('input', {{bubbles: true}}));
                break;
            }}
        }}
    }}""")
    time.sleep(1)
    page.keyboard.press('Enter')
    time.sleep(2)
```

## 3. 按需求点拆分 + try/except 防崩溃

```python
# 主函数中按需求点独立调用，防止单个异常终止全部测试
req_sections = [
    ("需求点1-统计筛选", lambda: test_req1(page)),
    ("需求点2-高级搜索", lambda: test_req2(page)),
    # ...
]
for name, fn in req_sections:
    try:
        fn()
    except Exception as e:
        print(f"❌ {name}异常: {e}")
        traceback.print_exc()
```

## 4. cron-unsafe 标记模式

```python
# 涉及写操作的用例自动标记 skip
add_result(results, "TC-XXX-001", "上传文件验证", "P0", "skip",
    [{"step": 1, "action": "上传文件", "result": "SKIP - 涉及文件上传", "ok": True}],
    "涉及文件上传有持久副作用，cron自动跳过",
    [ss],
    {"severity": "INFO", "title": "此用例需手动执行", "actual": "cron-unsafe操作已跳过"})
```

**cron-unsafe 分类**：
- 文件上传/下载
- 数据创建/修改/删除
- 配置变更
- 权限修改

**cron-safe 分类**：
- 列表查看
- 搜索筛选
- 权限对比（只读）
- 页面元素存在性检查

## 5. 多账号权限测试模式

```python
def test_permissions(page, playwright):
    """多账号权限对比测试"""
    # 主账号（admin）已在 page 上登录
    # 用独立 browser 实例测试其他账号
    for username, password in [("testadmin", "Esic@2024"), ("aarontest", "Esic@2024")]:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME_PATH,
            args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page2 = context.new_page()
        try:
            login(page2, username, password)
            # 执行权限验证...
        except Exception as e:
            # 记录异常但不终止测试
            pass
        finally:
            browser.close()
```

## 6. 结果保存

```python
# 每个模块的结果保存为独立 JSON
for name, r in all_results.items():
    path = os.path.join(RESULTS_DIR, f"{name}_results.json")
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(r, f, ensure_ascii=False, indent=2)
```

## 7. 常见 Playwright API 陷阱

| API | 陷阱 | 解决方案 |
|-----|------|----------|
| `element.fill(text, timeout=N)` | 元素不可见时超时崩溃 | 用 `page.evaluate()` + JS 设值 |
| `element.inner_text(timeout=N)` | **不接受** timeout 参数 | 去掉 timeout，用 `page.wait_for_timeout()` 前置等待 |
| `page.query_selector(selector)` | 返回 None 时不报错 | 必须检查 `if el:` 再操作 |
| `page.screenshot()` | 白屏截图 <1KB | 检测 size <1024 时 sleep+重试 |
| 并发 browser 实例 | storage_state 冲突 | 每个账号用独立 browser + context |
