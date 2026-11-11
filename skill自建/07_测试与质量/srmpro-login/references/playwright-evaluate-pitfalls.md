# Playwright `page.evaluate()` 内 CSS 选择器陷阱（SRMPRO 测试常踩）

## 一句话规则
**`page.evaluate()` / `pg.evaluate()` 内部跑的是浏览器原生 JS，里面的 `document.querySelector*`
只接受标准 CSS 选择器**。Playwright 自定义伪类（`:visible`、`:has-text()`、`:nth-match()`、
`:light()`、`>>` 链式）**全部不可用**，会抛 `SyntaxError: Failed to execute 'querySelector'`。

这些伪类只在 **Playwright 侧 API**（`page.locator()`、`page.query_selector*`、
`page.wait_for_selector` 等 Python/Node 接口）里有效，因为是 Playwright 自己解析的。

## 在 SRMPRO 测试里的典型炸点

SRMPRO 的弹窗（Element UI `.el-dialog`）经常需要在 evaluate 里读表格行数 / 分页文本 /
单元格内容，最容易写出这种坏代码：

```python
# ❌ 错：evaluate 内用 :visible
modal_rows = pg.evaluate("""() => {
    const modal = document.querySelector(
        '.el-dialog__wrapper:not([style*="display: none"]) .el-dialog, .el-dialog:visible'
    );
    if (!modal) return 0;
    return modal.querySelectorAll('tbody tr').length;
}""")
# → playwright._impl._errors.Error: Page.evaluate: SyntaxError:
#    '.el-dialog:visible' is not a valid selector
```

整个用例会直接 fail，且报错堆栈定位的是 `_frame.py:278 evaluate`，新人很容易误以为
是 Playwright 自己的 bug。

## 修法（按推荐顺序）

### 方案 1（推荐）：纯原生 DOM 判可见
SRMPRO 弹窗结构稳定，Element UI 的 `.el-dialog__wrapper` 隐藏时一定带 `style="display: none"`：
```javascript
() => {
    const modals = document.querySelectorAll('.el-dialog');
    let modal = null;
    for (const m of modals) {
        const wrapper = m.closest('.el-dialog__wrapper');
        if (wrapper && wrapper.style.display !== 'none' && m.offsetParent !== null) {
            modal = m;
            break;
        }
    }
    if (!modal) return 0;
    return modal.querySelectorAll('.el-table__body tr, tbody tr').length;
}
```
原生可见性常用三件套：`offsetParent !== null`、`getBoundingClientRect().width > 0 && height > 0`、
`getComputedStyle(el).display !== 'none'`。

### 方案 2：Python 侧 query_selector 拿到句柄，再传给 evaluate
```python
modal_el = pg.query_selector('.el-dialog:visible')   # 这里 :visible 合法
if modal_el:
    rows = pg.evaluate("(m) => m.querySelectorAll('tbody tr').length", modal_el)
```

### 方案 3：完全用 Locator API，跳过 evaluate
```python
modal = pg.locator('.el-dialog').filter(has=pg.locator('visible=true')).first
modal_rows = modal.locator('tbody tr').count()
```

## 写脚本前自检 grep
跑测试前先扫一遍，10 秒能省一个 fail：
```bash
grep -nE ":visible|:has-text\(|:nth-match\(|:light\(|>>" yourtest.py | grep -i evaluate
```
任何输出都意味着 evaluate 里夹了 Playwright-only 选择器，必须改。

## 同类区分点
- `pg.query_selector_all('.el-dialog:visible')` ✅ 走 Playwright 引擎，合法
- `pg.evaluate("() => document.querySelectorAll('.el-dialog:visible')")` ❌ 走浏览器引擎，炸
- `el.evaluate("(e) => e.querySelectorAll('.x:visible')")` ❌ 走浏览器引擎，炸

判断标准：**这条 selector 字符串最终是被 `document.*` / `element.querySelector*` 在 evaluate
内部消费的吗？是 → 必须标准 CSS。**

## 来源
2026-06-17 SRMPRO 数据权限控制测试 v5（`run_perm_tests_v5.py` 第 352/575/580 行共 3 处）。
TC-PERM-001 整个用例因此 fail，定位+修复后 6 个用例 5 通过、P0 通过率 4/5 (80%)。
