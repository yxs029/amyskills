# SRMPRO 布局变化导致的 Playwright 超时陷阱

> 2026-07-08 实战沉淀：展开全部 -> 搜索框/分页器不可见 -> fill/click 30s 超时

## 触发条件

SRMPRO 文档库 `/SupplierManagement/newDocument` 页面有"展开全部"按钮，点击后：
- 表格从 5 行分类 -> 56 行子分类
- 页面高度增加，搜索框被推到折叠区
- Playwright `.fill()` / `.click()` 报 `element is not visible`，30s 超时

## 受影响的操作

| 操作 | 选择器 | 症状 |
|------|--------|------|
| 搜索框 fill | `input[placeholder*="文档"]` | fill 超时 30s |
| 搜索按钮 click | `button:has-text("搜索")` | 通常正常（在顶部） |
| 分页器下一页 click | `.el-pagination .btn-next` | click 超时 30s（搜索无结果时 disabled） |

## 标准修复模板

```python
# 1. 检查元素是否真正可见
is_visible = page.evaluate("""() => {
    const el = document.querySelector('input[placeholder*="文档"]');
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}""")

# 2. 不可见时用 JS 设值（绕过 Playwright 可见性检查）
if not is_visible:
    page.evaluate("""() => {
        const inp = document.querySelector('input[placeholder*="文档"]');
        if (inp) {
            inp.focus();
            inp.value = '关键词';
            inp.dispatchEvent(new Event('input', {bubbles: true}));
            inp.dispatchEvent(new Event('change', {bubbles: true}));
        }
    }""")
else:
    search_input.fill("关键词")

# 3. 分页器检查 disabled 状态
next_enabled = page.evaluate("""() => {
    const btn = document.querySelector('.el-pagination .btn-next');
    return btn && !btn.disabled && btn.getBoundingClientRect().width > 0;
}""")
if next_enabled:
    next_btn.click(timeout=5000)
else:
    # 数据不足1页，记 warn 不记 fail
```

## 关联 skill

- `web-exploratory-tester` 关键经验 #35
- `srmpro-login` references/document-library-filter-testing.md
