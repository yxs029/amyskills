# SRMPRO 文档库 - 文档详情弹窗测试参考 (2026-06-17)

> 适用范围: `/SupplierManagement/newDocument` 页面点击文档类型节点后弹出的"供应商文档详情"弹窗。覆盖 26 个用例 TC-MODAL-001 ~ TC-MODAL-026。

## 关键结构认知

**弹窗结构** (Element-UI el-dialog):
```
.el-dialog (width: 80vw, max-width: 960px, max-height: 85vh)
├─ .el-dialog__header        # 标题栏: "供应商文档详情" + el-tag(文档类型名,如"营业执照") + 数字徽标
├─ .el-dialog__body
│   ├─ 筛选区: 供应商搜索框 + 搜索/重置按钮 + 分段器(全部/有效/即将过期/已过期)
│   ├─ 数据表格 (7列): 供应商名称 | 供应商状态 | 文件名称 | 上传时间 | 上传人 | 到期日期 | 有效期状态
│   └─ .el-pagination          # 共 N 条 + 页码
└─ .el-dialog__footer         # 底部"关闭"按钮
```

**实测尺寸**: 960×597 (admin/营业执照 165条数据), 符合 80vw + max-width 960px 规则。

## 弹窗操作 5 个核心模式

### 模式1: 检测当前是否有弹窗打开

```python
def get_modal(page):
    """获取当前打开的弹窗。注意 .el-dialog__wrapper 即使隐藏也存在于 DOM,要用 is_visible() 过滤"""
    for sel in [
        '.el-dialog__wrapper:not([style*="display: none"]) .el-dialog',
        '.el-dialog:visible',
        '[role="dialog"]:visible',
        '.el-dialog'
    ]:
        try:
            els = page.query_selector_all(sel)
            for el in els:
                if el.is_visible():
                    return el
        except: pass
    return None
```

### 模式2: 通过点击表格行打开弹窗

文档库不是 el-tree,弹窗通过点击**叶子文档类型行**触发(不是工具栏按钮)。

```python
def open_modal_via_click(page):
    """先展开全部, 再点击任一含已知文档类型名的行"""
    # 1. 展开全部
    btn = page.query_selector('button:has-text("展开全部")') or page.query_selector('text=展开全部')
    if btn:
        btn.click()
        time.sleep(2)
    
    # 2. 找含目标文档类型的行(优先 ISO9001/营业执照/法人/保密协议/组织机构)
    for r in page.query_selector_all('tr, .el-table__row'):
        try:
            txt = (r.inner_text() or '').strip()
            if any(k in txt for k in ['ISO9001', '营业执照', '法人', '保密协议', '组织机构']):
                clickable = r.query_selector('a, span.link, .clickable, td:nth-child(2)') or r
                clickable.click()
                time.sleep(2.5)
                if get_modal(page):
                    return True
        except: pass
    return False
```

### 模式3: 关闭弹窗(优先级:✕按钮 > Esc键 > 遮罩点击)

```python
def close_modal(page):
    modal = get_modal(page)
    if not modal: return
    # 优先点 ✕ 按钮
    for sel in ['.el-dialog__close', '.el-dialog__headerbtn', '[aria-label="Close"]']:
        btn = page.query_selector(sel)
        if btn and btn.is_visible():
            btn.click()
            time.sleep(1.5)
            return
    # 备用: Esc
    page.keyboard.press("Escape")
    time.sleep(1)
```

⚠️ **不要默认点遮罩层关闭**: 实测 SRMPRO 的弹窗 `close-on-click-modal=false`,点击遮罩**不会**关闭(TC-MODAL-004 缺陷)。

### 模式4: JS 批量采样表格列样式(到期日期颜色/状态标签/行背景)

Python 单元格逐个 `getComputedStyle` 太慢,用 JS 一次性批量采样:

```python
# 采样到期日期列(第6列)的颜色
colors = modal.evaluate("""el => {
    const rows = el.querySelectorAll('.el-table__body tr, tbody tr');
    const result = [];
    rows.forEach((r, i) => {
        if (i >= 30) return;
        const cells = r.querySelectorAll('td');
        if (cells.length >= 6) {
            const cell = cells[5];
            const text = cell.innerText.trim();
            const color = window.getComputedStyle(cell).color;
            const inner = cell.querySelector('span, div');
            const innerColor = inner ? window.getComputedStyle(inner).color : '';
            result.push({ text: text.substring(0, 20), color, innerColor });
        }
    });
    return result;
}""")

# 行背景色采样(TC-MODAL-021)
bg_info = modal.evaluate("""el => {
    const rows = el.querySelectorAll('.el-table__body tr, tbody tr');
    return Array.from(rows).slice(0, 30).map((r, i) => ({
        idx: i,
        bg: window.getComputedStyle(r).backgroundColor,
        text: r.innerText.substring(0, 80),
        hasExpired: r.innerText.includes('已过期'),
        hasSoon: r.innerText.includes('即将过期')
    }));
}""")

# 期望颜色规则:
#   已过期文本颜色:    rgb(245, 34, 45)   → #f5222d
#   即将过期文本颜色:  rgb(255, 153, 0)   → #ff9900
#   默认日期颜色:      rgb(41, 45, 46)    → #292d2e
#   已过期行背景:      rgb(255, 242, 240) → #fff2f0 淡红
#   即将过期行背景:    rgb(255, 251, 240) → #fffbf0 淡橙
#   正常行背景:        rgb(255, 255, 255) → 白
```

### 模式5: 接口异常注入(TC-MODAL-023)

通过 Playwright `context.route()` 拦截 API 返回 500,验证弹窗错误处理:

```python
def block(route):
    url = route.request.url
    if 'detail' in url.lower() or 'modal' in url.lower() or 'document' in url.lower():
        route.fulfill(status=500, body='{"code":500,"msg":"Internal Server Error"}')
    else:
        route.continue_()

ctx = page.context
ctx.route('**/api/**', block)
# ... 触发弹窗打开 ...
ctx.unroute('**/api/**')  # 测试完毕务必取消, 否则后续用例全坏
```

⚠️ **务必 unroute**: 忘记取消会让后续用例的 API 全 500,污染整轮测试。

## 选择器速查

```python
# 标题栏
TITLE_BAR = '.el-dialog__header, [class*="title"]'
TITLE_BADGE = '.el-tag, .ant-tag, [class*="badge"]'  # 文档类型名徽标 + 数字角标

# 筛选区
SEARCH_INPUT = 'input[placeholder*="供应商"], input[placeholder*="搜索"]'
SEARCH_BTN = 'button:has-text("搜索"), .el-button--primary'
RESET_BTN = 'button:has-text("重置"), button:has-text("清除")'
SEGMENT_OPTS = '.el-radio-group .el-radio-button, .el-segmented .el-segmented__item'

# 表格 (7列)
TABLE_HEADERS = '.el-table__header th, thead th'
TABLE_ROWS = '.el-table__body tr, tbody tr'
COL_SUPPLIER     = 'td:nth-child(1)'  # 供应商名称(应为链接)
COL_STATUS       = 'td:nth-child(2)'  # 供应商状态(应用 .el-tag)
COL_FILENAME     = 'td:nth-child(3)'  # 文件名称(应为链接,点击下载)
COL_UPLOAD_TIME  = 'td:nth-child(4)'  # 上传时间 YYYY-MM-DD
COL_UPLOADER     = 'td:nth-child(5)'  # 上传人(空显示 —)
COL_EXPIRY_DATE  = 'td:nth-child(6)'  # 到期日期(应按状态着色)
COL_EXPIRY_TAG   = 'td:nth-child(7)'  # 有效期状态标签

# 关闭
CLOSE_X = '.el-dialog__close, .el-dialog__headerbtn'
FOOTER_CLOSE = '.el-dialog__footer button:has-text("关闭")'

# 分页
PAGINATION = '.el-pagination'
PREV_BTN = '.btn-prev'
NEXT_BTN = '.btn-next'
ACTIVE_PAGE = '.el-pager li.is-active'
```

## 26 用例实测结果 (2026-06-17, admin / 营业执照 165条数据)

**通过率**: 76.9% (20/26), P1 通过率 75.0% (15/20)

| TC | 优先级 | 验证点 | 结果 | 备注 |
|----|------|--------|------|------|
| 001 | P1 | 弹窗结构+尺寸 80vw/max960 | ✅ | 实测 960×597 |
| 002 | P1 | 标题栏文档类型徽标 | ✅ | "营业执照" + 165 |
| 003 | P1 | 协议三级节点子公司标签 | ⏭️ SKIP | 与 TC-TREE-005 P0 同因 |
| 004 | P2 | 点击遮罩关闭 | ❌ FAIL | close-on-click-modal=false |
| 005 | P1 | ✕ 按钮关闭 | ✅ | |
| 006 | P2 | 底部关闭按钮 | ✅ | |
| 007 | P1 | 供应商模糊搜索 | ✅ | 10→1行 |
| 008 | P1 | 分段器过滤 | ✅ | 全部165/有效1/即将0/已过期0 |
| 009 | P2 | 分段器颜色 | ✅ | |
| 010 | P1 | 搜索+分段 AND 交集 | ✅ | 1→0 |
| 011 | P1 | 重置按钮 | ✅ | |
| 012 | P1 | 7列完整 | ✅ | 7/7 全匹配 |
| 013 | P1 | 供应商名称跳转 | ❌ FAIL | 第1列无链接样式 |
| 014 | P1 | 供应商状态标签 | ❌ FAIL | 纯文本未用 .el-tag |
| 015 | P1 | 文件名下载 | ✅ | rohs2.png |
| 016 | P2 | 上传时间 YYYY-MM-DD | ✅ | 10/10 |
| 017 | P3 | 上传人空显示 — | ✅ | |
| 018 | P1 | 到期日期颜色规则 | ❌ FAIL | 颜色单一 rgb(41,45,46) |
| 019 | P1 | 长期有效文案 | ✅ | |
| 020 | P1 | 有效期状态标签颜色 | ✅ | |
| 021 | P1 | 行背景色规则 | ❌ FAIL | 全白,未实现 #fff2f0/#fffbf0 |
| 022 | P1 | 数据为空提示 | ✅ | |
| 023 | P1 | 接口异常处理 | ✅ | 弹窗仍可打开 |
| 024 | P1 | 分页器基本功能 | ✅ | 共 165 条,17页 |
| 025 | P2 | 首页 prev 置灰 | ✅ | |
| 026 | P1 | 切换筛选回第1页 | ✅ | |

## 已确认缺陷 (5个)

1. **TC-MODAL-004 [P2]** 弹窗 `close-on-click-modal` 配置为 false,违反 PRD 4.1.4 遮罩关闭要求
2. **TC-MODAL-013 [P1]** 表格供应商名称列无 `<a>` 链接样式,无法跳转主数据页(违反 PRD 4.3.2)
3. **TC-MODAL-014 [P1]** 供应商状态使用纯文本而非 `.el-tag` 组件(违反 PRD 4.3.3)
4. **TC-MODAL-018 [P1]** 到期日期颜色全为默认色 rgb(41,45,46),未按"即将过期=橙/已过期=红"区分(违反 PRD 4.3.7)
5. **TC-MODAL-021 [P1]** 表格行背景色全为白色,未实现"已过期=#fff2f0淡红 / 即将过期=#fffbf0淡橙"规则(违反 PRD 4.3.10,**与树形列表区背景色规则不一致** — 树形那边正常实现)

## 通用执行模板

参考 `~/SRMPRO/文档库/run_modal_tests.py` (60KB, 26用例, ~70张截图)

关键设计决策:
- **弹窗持久化**: 大部分用例共用同一个已打开的弹窗(避免反复 open/close 慢)
- **每5用例自检**: `if (i+1) % 5 == 0: if not get_modal(page): open_modal_via_click(page)` 防止意外关闭后续用例全跳过
- **超时熔断**: `if elapsed > 45*60: 剩余标 SKIP` 防止 26 用例总时长爆 cron 55 分钟限制
- **接口拦截后立刻 unroute**: TC-MODAL-023 完毕必须 `ctx.unroute('**/api/**')`,否则污染 024+

报告生成器: `~/SRMPRO/文档库/gen_modal_report.py` (独立的 HTML 渲染脚本,从 modal_results.json 读取)

## 跨模块联动注意

- 协议文档三级节点弹窗(TC-MODAL-003)依赖 TC-TREE-005,该 P0 缺陷不修复前 003 永远 SKIP
- 行背景色规则(TC-MODAL-021)与树形列表区 TC-TREE-009/010 共享同一套颜色规则,树形已实现而弹窗未实现 — 这是**前后端实现不一致**的强信号,建议作为单独缺陷上报
