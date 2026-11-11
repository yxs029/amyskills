# SRMPRO 文档库 - 筛选区测试参考 (2026-06-16)

> 适用范围: `/SupplierManagement/newDocument` 页面的搜索行 + 分段器测试

## 精确选择器 (2026-06-16 验证)

```python
# 搜索输入框 — placeholder 是"请输入文档名称"，不是"搜索"
SEARCH_INPUT = 'input[placeholder="请输入文档名称"]'

# 搜索按钮 — 多个搜索按钮中第一个是页面搜索（不是搜索弹窗）
SEARCH_BTN = 'button.el-button--primary:has-text("搜索")'

# 重置按钮 — 与搜索按钮相同尺寸/样式，唯一区分是 el-button--default
RESET_BTN = 'button.el-button--default:has-text("重置")'

# 分段器 — 三个选项都是 .status-segment__item
# text 格式: "全部 4747" / "即将过期 0" / "已过期 28" (数字带空格)
SEG_SELECTOR = '.status-segment__item'
SEG_ALL = '.status-segment__item:has-text("全部")'
SEG_EXPIRING = '.status-segment__item:has-text("即将过期")'
SEG_EXPIRED = '.status-segment__item:has-text("已过期")'

# 展开/收起
EXPAND_ALL_BTN = 'button:has-text("展开全部")'
COLLAPSE_ALL_BTN = 'button:has-text("收起全部")'
```

## ⚠️ 视口外点击陷阱 (重要)

**问题症状**: `ElementHandle.click: Timeout 30000ms exceeded. ... element is outside of the viewport`

**根本原因**: 分段器 `.status-segment__item` 在 1280×800 视口下，"已过期" 选项会滚出可视区域。Playwright 默认 click() 会等元素进入视口并稳定，但有时滚动不生效导致 30s 超时。

**解决方案** (任一):
```python
# 方案 1: 强制点击 (推荐)
item.click(force=True, timeout=5000)

# 方案 2: 先 scroll_into_view 再 click
item.scroll_into_view_if_needed()
time.sleep(0.3)
item.click(timeout=5000)

# 方案 3: 扩大视口高度 (从 800 到 900+)
context = browser.new_context(viewport={'width': 1280, 'height': 900})
```

**踩坑实录**: 2026-06-16 TC-SEG-002 第一次跑时，所有"已过期"点击都超时 30s。加上 `force=True` 后秒过。

## 分段器信息提取

```python
# 用 JS 一次拿完所有分段器信息 (选中态 + 徽标数字)
seg_info = page.evaluate('''() => {
    const items = document.querySelectorAll('.status-segment__item');
    return Array.from(items).map(item => ({
        text: item.textContent.trim(),
        active: item.classList.contains('is-active'),
        number: (item.textContent.match(/\\d+/) || [null])[0]
    }));
}''')
// 返回示例:
// [{'text': '全部 4747', 'active': True, 'number': '4747'},
//  {'text': '即将过期 0', 'active': False, 'number': '0'},
//  {'text': '已过期 28', 'active': False, 'number': '28'}]
```

## 徽标颜色提取

```python
# 注意: 数字 0 的徽标颜色应为 #FF4949 (红)，与"全部"未选中的 #B5B7B9 (灰) 区分
badge_info = page.evaluate('''() => {
    const items = document.querySelectorAll('.status-segment__item');
    return Array.from(items).map(item => {
        const badge = item.querySelector('.el-badge__content, sup');
        return {
            text: item.textContent.trim().substring(0, 10),
            badgeBg: badge ? window.getComputedStyle(badge).backgroundColor : null,
            badgeColor: badge ? window.getComputedStyle(badge).color : null
        };
    });
}''')
```

## 空状态检测

```python
def is_empty_state(page):
    # el-table 加载中显示"暂无数据"，搜索无匹配也复用这个
    el = page.query_selector('.el-table__empty-text')
    return el is not None and el.is_visible()

# ⚠️ TC-SEARCH-007 缺陷发现:
# 搜索无匹配时，复用 el-table 默认空状态"暂无数据"
# 期望: 搜索场景专用文案"暂无符合条件的文档"
# 实际: 通用 el-table 文案，体验差
```

## 重置按钮行为验证 (TC-SEARCH-005 缺陷)

```python
# ⚠️ 真实缺陷 (2026-06-16):
# 点击"重置"后，搜索框的值未清空，分段器未恢复"全部"
# 应在测试报告中明确标记为 P1 缺陷

# 验证方法: 记录"搜索+分段器+展开"综合状态 → 点击重置 → 三项都应恢复 S0
```

## 字符上限验证 (TC-SEARCH-004)

```python
# 验证 maxlength=50 是否生效
search_el = page.wait_for_selector(SEARCH_INPUT, timeout=5000)

# 粘贴 60 字符
long_text = "a" * 60
search_el.fill(long_text)
actual_len = len(search_el.input_value())
assert actual_len <= 50, f"maxlength 未生效: {actual_len}"

# 验证 maxlength 属性
assert search_el.get_attribute("maxlength") == "50"
```

## 防重复点击验证 (TC-SEARCH-006)

```python
request_urls = []
page.on("request", lambda req: request_urls.append(req.url))

# 快速点击 3 次
btn = page.query_selector(SEARCH_BTN)
for _ in range(3):
    try: btn.click(timeout=500, force=True)
    except: pass
time.sleep(3)

# 检查搜索相关请求数 (期望 <= 1)
search_reqs = [u for u in request_urls if any(k in u.lower() for k in ['search', 'keyword', 'document'])]
print(f"搜索请求数: {len(search_reqs)}")
```

## 🐛 Playwright EPIPE 崩溃陷阱

**问题症状**: 长时间运行的测试脚本意外中断，控制台抛出:
```
Error: write EPIPE
    at afterWriteDispatched ...
Emitted 'error' event on Socket instance
```

**根本原因**: Playwright driver (Node.js 子进程) 与 Python 主进程的 socket 通信断开。常见触发:
1. Python 脚本被 kill -9 强制终止
2. 主进程意外收到 SIGPIPE
3. chromium 进程先于 driver 退出

**预防**:
- 不要在 timeout 边界跑长任务
- 每个测试用例独立 try/except，单个失败不污染全局
- 用 `with sync_playwright() as p:` 上下文确保 driver 进程清理
- 避免在同一 context 内做大量操作 (考虑每 N 个用例重启 browser)

**诊断**: 用 `timeout` 命令包裹 python 调用，超时后能拿到部分输出:
```bash
timeout 480 /home/aaronmy/.openclaw/workspace/bi-automation/venv/bin/python test.py
```

## 📝 HTML 报告生成陷阱

**问题症状**: `ValueError: unsupported format character ';' (0x3b)`

**根本原因**: HTML/CSS 字符串中常有 `rgba(0,0,0,0.08)` 这种含 `0.0`/`;` 的内容。如果用 `%` 格式化 (`%s`/`%d`)，CSS 里的 `%` 会被当成格式化标记。

**解决方案**:
```python
# ❌ 错误: 用 % 格式化长 HTML
html = """<style>.x{opacity: 0.5}</style>...%s...""" % content  # 报错

# ✅ 正确: 用字符串拼接
html = """<style>.x{opacity: 0.5}</style>...""" + content + """..."""

# ✅ 或者: 用 str.format() + 在 CSS 里把 % 写成 %%
# ✅ 或者: 用 Template 字符串
from string import Template
html = Template("""...$content...""").substitute(content=content)
```

## 13个筛选区测试用例执行清单

| TC | 名称 | 优先级 | 关键验证点 |
|----|------|--------|----------|
| TC-SEARCH-001 | 按文档名称模糊搜索 | P0 | 搜索功能基本可用 + 大小写不敏感 |
| TC-SEARCH-002 | 空关键字搜索 | P2 | 按钮 disabled 状态 / 不发请求 |
| TC-SEARCH-003 | 搜索不区分大小写 | P1 | iso/ISO/Iso 结果完全一致 |
| TC-SEARCH-004 | 输入字符上限50个 | P2 | maxlength=50 + 实际截断 |
| TC-SEARCH-005 | 重置按钮功能 | P1 | **已知缺陷**: 搜索框/分段器未清空 |
| TC-SEARCH-006 | 搜索按钮防重复点击 | P2 | 3次连点只发1次请求 |
| TC-SEARCH-007 | 无匹配结果时的搜索 | P1 | **已知缺陷**: 复用 el-table 通用空状态 |
| TC-SEG-001 | 默认选中"全部" | P1 | 首次加载 is-active class |
| TC-SEG-002 | 切换到"即将过期" | P0 | force-click + 列表过滤 |
| TC-SEG-003 | 切换到"已过期" | P0 | force-click + 已过期 28 份可见 |
| TC-SEG-004 | 搜索+分段器交集 | P0 | 反向顺序结果一致 |
| TC-SEG-005 | 徽标颜色规则 | P2 | 灰/橙/红 三色正确 |
| TC-SEG-006 | 数量为0时显示"0" | P2 | "即将过期 0" 仍显示 0 |

## 完整可执行模板

参考 `~/SRMPRO/文档库/run_filter_tests_v4.py` (47KB, 13个用例, 71张截图)
- 用 `results = []` 累积结果
- 用 `defects = []` 累积缺陷
- 每个用例独立 try/except
- 最后用 `generate_html_report()` 输出报告
- 报告路径: `~/SRMPRO/文档库/report/筛选区_测试报告.html`
