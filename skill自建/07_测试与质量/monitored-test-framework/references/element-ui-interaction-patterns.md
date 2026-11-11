# Element UI 交互模式速查（Playwright + JS）

> 来源：SRMPRO 图纸库 9 轮假设思维探索 + v4 修正（2026-07-18）
> 适用：Element UI 2.x + Vue 2.x + vxe-table 的 Web 应用

## 核心法则：触发器 vs 菜单项的点击方式相反

| 元素类型 | 点击方式 | 原因 |
|---------|---------|------|
| **el-dropdown 触发器**（el-icon-more 等） | Playwright `locator.click(force=True)` | Vue 的 `@click` 绑定在组件层，JS `.click()` 只触发原生事件 |
| **el-dropdown-menu__item**（菜单项） | JS `element.click()` | Playwright 认为 `position:absolute` 元素 not visible，JS click 不受此限制 |
| **el-select 下拉选项** | JS `page.evaluate()` 遍历 `offsetParent !== null` | 109 个选项只有 ~10 个 visible，Playwright click 30s 超时 |
| **vxe-cell--checkbox**（vxe-table 勾选框） | Playwright `locator.click(force=True)` | 是 span 不是 input，JS `.click()` 返回 false 不生效 |
| **el-button 普通按钮** | 两者皆可 | 无特殊限制 |

## 代码模板

### 1. 打开 el-dropdown 菜单并点击菜单项

```python
# Step 1: 用 Playwright 打开菜单（触发器）
page.locator('.vxe-table--fixed-left-wrapper .vxe-body--row:first-child .el-icon-more').first.click(force=True, timeout=5000)
page.wait_for_timeout(1000)

# Step 2: 用 JS 点击菜单项（不能用 Playwright，会报 not visible）
page.evaluate("""() => {
    const items = document.querySelectorAll('.el-dropdown-menu__item');
    for (const item of items) {
        if (item.offsetParent !== null && item.innerText.trim() === '归档') {
            item.click();
            return;
        }
    }
}""")
page.wait_for_timeout(2000)

# Step 3: 验证确认框
confirm = page.evaluate("""() => {
    const msgBox = document.querySelector('.el-message-box');
    if (msgBox && msgBox.offsetParent !== null) {
        return msgBox.innerText.substring(0, 150);
    }
    return null;
}""")
```

### 2. el-select 选择大量选项

```python
# 不用 page.click()，改用 JS 遍历找 visible 选项
page.evaluate("""() => {
    const dlg = document.querySelector('.upload-drawing-dialog');
    const input = dlg?.querySelector('.el-select input');
    if (input) input.click();  // 打开下拉
}""")
page.wait_for_timeout(1000)
page.evaluate("""() => {
    const items = document.querySelectorAll('.el-select-dropdown__item');
    for (const item of items) {
        if (item.offsetParent !== null && !item.classList.contains('is-disabled')) {
            item.click();  // 选第一个可见的
            return;
        }
    }
}""")
```

### 3. 搜索框设值（Vue 响应式）

```python
# Playwright fill() 对 Vue 绑定的 input 可能不生效，用 JS 原生 setter
page.evaluate("""() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
        if (inp.offsetParent === null) continue;
        if (inp.placeholder && inp.placeholder.includes('图纸文件名')) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(inp, '搜索关键词');
            inp.dispatchEvent(new Event('input', {bubbles: true}));
            inp.dispatchEvent(new Event('change', {bubbles: true}));
            inp.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true, key: 'Enter'}));
            return;
        }
    }
}""")
```

### 4. vxe-checkbox 勾选（v4 新增）

```python
# vxe-table 的 checkbox 是 span.vxe-cell--checkbox，不是 input
# JS .click() 返回 false 不生效，必须用 Playwright locator.click(force=True)
page.locator('.vxe-table--fixed-left-wrapper .vxe-body--row:first-child .vxe-cell--checkbox').first.click(force=True, timeout=5000)
page.wait_for_timeout(1000)

# 验证勾选状态：检查 class 是否含 is--checked
checked = page.evaluate("""() => {
    const w = document.querySelector('.vxe-table--fixed-left-wrapper');
    const cb = w?.querySelector('.vxe-body--row:first-child .vxe-cell--checkbox');
    return cb ? cb.classList.contains('is--checked') : false;
}""")
```

### 5. 文件预览 + 下载（v4 修正）

```python
import urllib.parse, subprocess

# 点击文件名 -> 打开预览新标签页（不是弹窗！）
with context.expect_page(timeout=10000) as new_page_info:
    page.locator('.vxe-table--fixed-left-wrapper .vxe-body--row:first-child button.el-button--text').first.click(force=True, timeout=5000)
new_page = new_page_info.value
new_page.wait_for_load_state("domcontentloaded")
page.wait_for_timeout(2000)

# 预览页面只有 <img>，无下载按钮
# 从 URL 参数提取文件直链
parsed = urllib.parse.parse_qs(urllib.parse.urlparse(new_page.url).query)
file_url = parsed.get('fileUrl', [''])[0]
file_name = parsed.get('fileName', [''])[0]

# 用 curl + cookie 下载（Playwright goto 不触发 download 事件）
cookies = context.cookies()
cookie_str = "; ".join([f"{c['name']}={c['value']}" for c in cookies])
subprocess.run(["curl", "-s", "-o", f"{save_path}/{file_name}", "-H", f"Cookie: {cookie_str}", "-L", file_url], timeout=30)
```

### 6. 双击行弹出版本确定弹窗（v4 新增）

```python
# 物料视图双击行 -> 弹出"版本确定"弹窗（与点击文件名效果相同）
page.locator('.vxe-table--fixed-left-wrapper .vxe-body--row:first-child').first.dblclick(force=True, timeout=5000)
page.wait_for_timeout(3000)
# 检查弹窗
dialog = page.evaluate("""() => {
    const dialogs = document.querySelectorAll('.el-dialog');
    for (const d of dialogs) {
        if (d.offsetParent !== null && getComputedStyle(d).display !== 'none') {
            return d.querySelector('.el-dialog__title')?.innerText?.trim() || '';
        }
    }
    return null;
}""")
```

## 常见陷阱

### 搜索框 placeholder 混淆
- `placeholder="搜索页面名称"` -> 全局导航搜索框（y≈11，页面顶部）
- `placeholder="图纸文件名、物料编码"` -> 图纸搜索框（在高级搜索面板里，需先勾选条件）
- **教训**：不要假设第一个找到的搜索框就是目标搜索框

### 文件名点击打开预览新页面（v4 修正）
- `button.el-button--text` 文件名点击后**打开新标签页** `filePreview.html?fileUrl=...&fileName=...`
- 预览页面只有一个 `<img>` 标签，body 为空，**无下载按钮**
- **下载方法**：从新页面 URL 的 `fileUrl` 参数提取文件直链，用 `curl -H "Cookie: ..." -L -o savepath fileUrl` 下载（需带登录 cookie）
- Playwright 捕获新页面：`with context.expect_page(timeout=10000) as np: page.locator(...).click(force=True)`
- **教训**：R9 探索时因为弹窗检测逻辑只查 `.el-dialog`，漏检了新标签页，误判为"不触发预览"。下次探索弹窗时必须同时检查 `context.expect_page` 和 `.el-dialog`
- el-icon-document 点击无反应（可能是装饰图标，预览入口是文件名按钮）
- **双击物料行**也会弹出"版本确定"弹窗（与点击文件名效果相同）

### vxe-checkbox 是 span 不是 input（v4 新增）
- `vxe-cell--checkbox` 是 `<span>` 元素，没有 `input[type=checkbox]`
- JS `.click()` 返回 false 不生效，**必须用 Playwright `locator.click(force=True)`**
- 勾选状态检查：`classList.contains('is--checked')`（不是 `:checked` 伪类）
- 物料视图勾选后**不会出现批量归档/删除按钮**（归档在按图纸视图的 more 菜单里）

### 物料视图 vs 图纸视图的 more 菜单不同（v4 新增）
- **按图纸展开**的 more 菜单：`['更新', '归档', '操作记录', '']`
- **按物料展开**的 more 菜单：`['下载', '']`（只有下载，没有归档）
- **教训**：不要假设两个视图的操作菜单相同

### file-count-trigger 点击无展开效果（v4 新增）
- 物料视图"关联图纸"列的 `.file-count-trigger`（显示 `+1`）点击后只弹 tooltip，不展开子列表
- 悬停也不展开
- 关联图纸的查看入口是**双击行**弹出版本确定弹窗

### 批量归档未勾选无提示
- 点击顶部"归档"按钮（不勾选任何行）-> 无 el-message 提示
- **可能原因**：系统 Bug 或需要先勾选行再操作

### el-dropdown-menu 的 wait_for_selector 超时
- `page.wait_for_selector('.el-dropdown-menu', state='visible')` 会超时
- 原因：el-dropdown-menu 的 `display` 属性由 Vue 控制，Playwright 的 visible 检测不认
- **解法**：用 `page.wait_for_timeout(1000)` 固定等待 + JS 检查 `offsetParent !== null`

## 调试技巧

### 找隐藏的可见元素
```javascript
// 找所有 visible 的元素（offsetParent !== null = visible）
document.querySelectorAll('*').filter(el => el.offsetParent !== null)

// 找高 z-index 元素（弹窗/提示）
document.querySelectorAll('div[style*="z-index"]').filter(el => {
    const z = parseInt(el.style.zIndex || '0');
    return z > 1000 && el.offsetParent !== null;
})
```

### 检查弹窗是否打开
```javascript
// 不用 offsetParent（可能误判），用 getComputedStyle
const dlg = document.querySelector('.target-dialog');
if (dlg && getComputedStyle(dlg).display !== 'none') {
    // 弹窗确实打开
}
```

### 探索弹窗时必须同时检查新标签页（v4 教训）
```python
# 错误：只检查 .el-dialog
dialog = page.evaluate("() => document.querySelector('.el-dialog:not([style*=display:none])')")

# 正确：同时检查 .el-dialog 和 context.expect_page
try:
    with context.expect_page(timeout=5000) as np:
        page.locator(selector).click(force=True)
    new_page = np.value  # 新标签页打开了
except:
    # 没有新标签页，检查弹窗
    dialog = page.evaluate("() => document.querySelector('.el-dialog:not([style*=display:none])')")
```
