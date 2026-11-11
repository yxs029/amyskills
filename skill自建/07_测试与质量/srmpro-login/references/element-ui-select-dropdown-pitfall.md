# Element UI el-select 下拉框不可见选项陷阱

> **2026-07-18 SRMPRO 图纸库 M03 上传图纸测试实战发现**

## 问题

Element UI 的 `el-select` 组件在有大量选项时（如 SRMPRO 采购组织有 109 个选项），
**只有最后 ~10 个选项 `offsetParent !== null`（可见）**，前面的选项 DOM 存在但不可见。

Playwright 的 `page.click(".el-select-dropdown__item:not(.is-disabled)")` 会匹配到第一个选项（不可见），
然后 **30 秒超时**，因为 Playwright 会等待元素 visible + stable + enabled 才点击。

### 错误日志特征

```
Page.click: Timeout 30000ms exceeded.
Call log:
  waiting for locator(".el-select-dropdown__item:not(.is-disabled)")
  - locator resolved to 109 elements. Proceeding with the first one
  - attempting click action
  - waiting for element to be visible, enabled and stable
  - element is not visible
  - retrying click action, attempt #1
  ... (重复 62 次直到超时)
```

## 解法

**永远用 `page.evaluate()` + JS 遍历找 visible 选项，不要用 Playwright `click()`。**

```python
# ❌ 错误：Playwright click 会卡在第一个不可见的选项上
page.click(".el-select-dropdown__item:not(.is-disabled)")  # 30s 超时

# ✅ 正确：JS 遍历找 offsetParent !== null 的选项
option_selected = page.evaluate("""() => {
    const items = document.querySelectorAll('.el-select-dropdown__item');
    for (const item of items) {
        if (item.offsetParent !== null && !item.classList.contains('is-disabled')) {
            item.click();
            return item.innerText.trim();  // 返回选中值方便验证
        }
    }
    return false;
}""")
```

## 完整交互流程（3 步）

```python
# Step 1: 点击 el-select 的 input 打开下拉
page.evaluate("""() => {
    const dlg = document.querySelector('.upload-drawing-dialog');
    const select = dlg?.querySelector('.el-select');
    const input = select?.querySelector('input');
    if (input) input.click();
    return true;
}""")
page.wait_for_timeout(1000)  # 等下拉动画完成

# Step 2: JS 选择第一个 visible 选项
selected_value = page.evaluate("""() => {
    const items = document.querySelectorAll('.el-select-dropdown__item');
    for (const item of items) {
        if (item.offsetParent !== null && !item.classList.contains('is-disabled')) {
            item.click();
            return item.innerText.trim();
        }
    }
    return false;
}""")
page.wait_for_timeout(1000)

# Step 3: 验证选中值
actual_value = page.evaluate("""() => {
    const dlg = document.querySelector('.upload-drawing-dialog');
    const input = dlg?.querySelector('.el-select input');
    return input ? input.value : '';
}""")
assert actual_value == selected_value, f"选择失败: expected={selected_value}, actual={actual_value}"
```

## 为什么选项不可见

Element UI 的 `el-select` 在选项过多时会使用虚拟滚动或简单的 CSS 隐藏。
DOM 中所有选项都存在（`querySelectorAll` 能找到 109 个），但前面的选项被 `display: none` 或 `visibility: hidden` 隐藏。

**判别方法**：
```javascript
// 检查选项是否真的可见
const items = document.querySelectorAll('.el-select-dropdown__item');
items.length;  // 109（DOM 总数）
items[0].offsetParent;  // null（不可见）
items[104].offsetParent;  // <div>（可见，最后几个）
```

## 通用性

这个陷阱适用于**所有 Element UI 应用**，不限于 SRMPRO：
- 致远 OA 的组织架构选择器（500+ 部门）
- 用友 NC 的物料分类选择器（1000+ 分类）
- 金蝶云星空的客商选择器（800+ 供应商）

**铁律**：当 `el-select-dropdown__item` 数量 > 20 时，**不要用 Playwright click**，改用 JS evaluate。

---

## SRMPRO 图纸库真实 DOM 选择器（2026-07-18 探索确认）

### 图纸库主页面 `/draw/draw`

| 元素 | 错误选择器（AI猜的） | 正确选择器（DOM探索确认） |
|------|---------------------|------------------------|
| 上传图纸按钮 | `button.upload-btn` | `button.el-button--primary:has-text('上传图纸')` |
| 上传弹窗 | `.material-dialog` | `.el-dialog.upload-drawing-dialog` |
| 弹窗标题 | - | `.upload-dialog-title` 或 `.el-dialog__title` |
| 采购组织下拉 | `#purchase-org-select` | `.upload-drawing-dialog .el-select input[placeholder="请选择采购组织"]` |
| 文件上传 input | `input[accept="application/pdf"]` | `input[type="file"][accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.html,.csv"]` |
| 下一步按钮 | `button.confirm-upload` | 弹窗内 `button:has-text('下一步')`（选中采购组织后 enabled） |
| 取消按钮 | - | 弹窗内 `button:has-text('取消')` |
| 关闭按钮 | - | `.el-dialog__headerbtn` 或 `.el-icon-close` |

### 关键发现

1. **file input 不在弹窗内**：进入步骤 2 后，`input[type="file"]` 挂在 body 上而非 `.upload-drawing-dialog` 内。搜索时需要扩大到整个页面。
2. **弹窗步骤切换**：步骤 1 选采购组织 -> 步骤 2 文件上传。切换后弹窗 body_text 包含 "步骤 2" 字样。
3. **下一步按钮初始 disabled**：未选采购组织时 `button:has-text('下一步')` 有 `is-disabled` class，选择后移除。
4. **vxe-table 表格**：图纸列表用 vxe-table（非 el-table），行选择器是 `.vxe-body--row`（不是 `.el-table__row`）。
