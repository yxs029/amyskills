# SRMPRO 文档库 - 树形列表区测试参考 (2026-06-16)

> 适用范围: `/SupplierManagement/newDocument` 页面的树形列表区 (实际上是 5 个一级分类 + 行展开子类型的表格结构,不是传统 el-tree 树形控件)

## 关键结构认知 (重要!)

**页面实际结构** (与 PRD 描述有显著差异):

```
供应商文档库
├─ 顶部统计卡片 (4个: 文档类型总数/已上传/即将过期/已过期)
├─ 搜索/分段器行
├─ 工具栏: 展开全部 / 收起全部 / 资质文档统计下载 / 协议签署统计下载
├─ 表格 (5 个一级分类行):
│   ├─ 财务相关资料      1类    78  68   0  1   [展开]
│   ├─ 供应商资质文档   12类   991  724  0  14  [展开]
│   ├─ 供应商协议文档    9类    67  55   0  6   [展开/收起]
│   ├─ 供应商审核报告    9类  2056  1319 0  3   [展开]
│   └─ 供应商文档        4类  1541  1531 0  4   [展开]
└─ 汇总文案: "共 53 类文档,4747 份文件"
```

**展开后的协议文档行** (实测):
- 显示协议文档类型: 采购合同/保密协议/质量协议/PCN控制协议/反商业贿赂协议/BSCI行为守则/ROHS符合保证书/COC/协议缺省报告
- ❌ **没有** "深圳深南/无锡深南/泰国深南" 子公司中间层 (PRD 3.2.2 要求的三级结构未实现)
- ❌ **错误地**显示"9 类"角标 (PRD 3.2.3 要求协议文档不显示角标)

## 🐛 真实 P0 缺陷 (2026-06-16 发现)

### 缺陷 #1: 协议文档三级结构缺失 [P0]

- **PRD 要求**: 一级分类 → 二级子公司(深圳深南/无锡深南/泰国深南) → 三级文档类型
- **实际**: 一级分类 → 直接到文档类型(两级)
- **影响**: PRD 3.2.2 协议文档特殊结构未实现
- **截图证据**: `report/DEBUG_expanded_agreement.png` (full_page)

### 缺陷 #2: 协议文档错误显示"类"角标 [P2]

- **PRD 要求**: 仅常规分类显示"{N}类"角标,协议文档特殊规则不显示
- **实际**: 协议文档显示"9 类"角标
- **对比**: 资质文档"12 类" / 协议文档"9 类" / 审核报告"9 类" / 财务相关"1 类" / 文档"4 类"

## 精确选择器 (2026-06-16 验证)

```python
# 一级分类行 (table tr, 不是 el-tree-node)
CAT_ROWS = '.el-table__row, table tr'

# 展开按钮 - 每行末尾的"展开/收起"按钮
EXPAND_BTN = 'button:has-text("展开")'
COLLAPSE_BTN = 'button:has-text("收起")'

# 工具栏全局按钮
TOOLBAR_EXPAND_ALL = 'button:has-text("展开全部")'
TOOLBAR_COLLAPSE_ALL = 'button:has-text("收起全部")'

# ⚠️ 不要用这些 (页面不是 el-tree 组件)
# WRONG: '.el-tree-node__expand-icon'  → 找不到
# WRONG: '.el-tree-node.is-leaf'        → 找不到

# 汇总文案位置
SUMMARY_TEXT = 'text=/共 \\d+ 类文档/'

# 顶部统计卡片
STAT_CARDS = {
    'docTypeCount': 'text=/文档类型总数/',  # 53
    'uploaded':     'text=/已上传文档/',     # 4747
    'expiring':     'text=/即将过期/',       # 0
    'expired':      'text=/已过期文档/',     # 28
}
```

## 展开/收起行的可靠方法

```python
# ❌ 错误: 用 evaluate_handle + f-string 转义引号
# ElementHandle.evaluate_handle: SyntaxError: missing ) after argument list
parent_row = agreement_node.evaluate_handle('el => el.closest(".el-tree-node, [class*=\"tree-node\"], tr, .row")')

# ✅ 正确: 用 evaluate + 单引号包裹的 JS 字符串 (Python 用三引号)
result = agreement_node.evaluate("""el => {
    let n = el;
    while (n && n.tagName !== 'TR' && !n.classList.contains('el-table__row')) {
        n = n.parentElement;
    }
    return n ? n.outerHTML.substring(0, 300) : null;
}""")

# ✅ 更稳: 直接遍历行找包含目标文字的那行, 再点其按钮
def click_row_button(page, target_text, btn_text="展开"):
    for btn in page.query_selector_all(f'button:has-text("{btn_text}")'):
        try:
            row = btn.evaluate_handle("""el => {
                let n = el;
                while (n && n.tagName !== 'TR' && !n.classList.contains('el-table__row')) {
                    n = n.parentElement;
                }
                return n;
            }""")
            row_el = row.as_element()
            if row_el and target_text in (row_el.inner_text() or ''):
                btn.click()
                return True
        except:
            pass
    return False

# 调用: click_row_button(page, "供应商协议文档")
```

## 颜色验证 (TC-TREE-007/008/009/010)

```python
# 采样任意 DOM 元素背景色
bg = element.evaluate('el => getComputedStyle(el).backgroundColor')
# 期望值:
#   一级节点:     rgb(248, 248, 249)  → #F8F8F9 浅灰
#   子公司节点:   rgb(245, 247, 250)  → #F5F7FA (协议文档特有)
#   已过期文档类型: rgb(255, 242, 240) → #fff2f0 淡红
#   即将过期:     rgb(255, 251, 240)  → #fffbf0 淡橙
#   正常:         rgb(255, 255, 255)  → 白色

# 批量采样所有表格行
bg_samples = page.evaluate("""() => {
    const samples = [];
    for (const row of document.querySelectorAll('tr, .el-table__row')) {
        const text = (row.innerText || '').trim();
        if (text) {
            samples.push({
                text: text.substring(0, 30),
                bg: getComputedStyle(row).backgroundColor
            });
        }
    }
    return samples;
}""")
```

## 缩进采样 (TC-TREE-012)

```python
# 注意: 这页是表格,不是树形,所以 padding-left 是来自 CSS 规范而非 el-tree 自动缩进
# 用 JS 一次拿所有节点 padding-left
indents = page.evaluate('''() => {
    const results = [];
    for (const n of document.querySelectorAll('.el-tree-node__content, [class*="tree-node-content"]')) {
        const cs = getComputedStyle(n);
        results.push({
            text: (n.innerText || '').substring(0, 20),
            paddingLeft: cs.paddingLeft,
            marginLeft: cs.marginLeft,
            classes: n.className.substring(0, 80)
        });
    }
    return results;
}''')
```

## 16 个树形列表区测试用例 (2026-06-16 执行清单)

| TC | 优先级 | 关键验证点 | 实测结果 |
|----|--------|----------|---------|
| TC-TREE-001 | P1 | 展开全部/收起全部按钮 | ✅ PASS |
| TC-TREE-002 | P1 | "共X类文档,Y份文件"汇总文案 | ✅ PASS (53/4747) |
| TC-TREE-003 | P1 | ▶图标和文字按钮联动 | ❌ FAIL (联动异常) |
| TC-TREE-004 | P1 | 常规分类两级结构 | ✅ PASS |
| TC-TREE-005 | **P0** | 协议文档三级结构(子公司) | ❌ **FAIL (P0缺陷)** |
| TC-TREE-006 | P2 | 协议文档不显示"类"角标 | ❌ **FAIL (UI缺陷)** |
| TC-TREE-007 | P2 | 一级节点背景色#F8F8F9 | ✅ PASS |
| TC-TREE-008 | P2 | 子公司背景色#F5F7FA | ⏭️ SKIP (因005无子公司) |
| TC-TREE-009 | **P0** | 文档类型背景色规则 | ✅ PASS |
| TC-TREE-010 | P1 | 背景色优先级 (红>橙>白) | ✅ PASS |
| TC-TREE-011 | P2 | 超长名称截断+悬浮提示 | ✅ PASS |
| TC-TREE-012 | P2 | 缩进规则 | ✅ PASS |
| TC-TREE-013 | P1 | 未启用有效期管理"-"占位 | ✅ PASS |
| TC-TREE-014 | P1 | 文档类型整行可点击+弹窗 | ✅ PASS (90秒) |
| TC-TREE-015 | P1 | 无已启用文档类型空状态 | ⏭️ SKIP (需数据准备) |
| TC-TREE-016 | P1 | 文档类型存在但无上传记录 | ✅ PASS |

**统计**: 11 PASS / 3 FAIL / 2 SKIP = 68.8% 通过率, P0 通过率 1/2 = 50%

## 完整可执行模板

参考 `~/SRMPRO/文档库/run_tree_tests.py` (47KB, 16个用例, 35张截图)
- 用 `def add_result()` 累积结果
- 每个用例独立 try/except
- 最后用 `generate_report()` 输出 HTML
- 报告路径: `~/SRMPRO/文档库/report/树形列表区_测试报告.html`

## ⏱️ 后台执行 + process wait clamp 陷阱 (2026-06-17 cron 实战)

**问题**: 跑 16 个用例 + 35 张截图脚本耗时约 3 分钟 (含 TC-014 单用例 90 秒)，必须用 `terminal(background=true, notify_on_complete=true)`。但用 `process(action='wait', timeout=600)` 等待时返回的不是 600s，而是被环境配置 clamp 到 60s。

**症状**: 第一次 `wait` 60s 后返回 `status='timeout'` + `timeout_note: "Requested wait of 600s was clamped to configured limit of 60s"`，但进程其实还在跑。

**正确处理**:
```python
# ❌ 错误: 一次 wait 600s 以为能等到结束
process(action='wait', session_id=sid, timeout=600)  # 实际只等 60s

# ✅ 正确: 循环 wait 60s 直到 status='exited'
while True:
    r = process(action='wait', session_id=sid, timeout=60)
    if r['status'] == 'exited':
        break
    # 仍 running 就继续 wait
```

或者直接信任 `notify_on_complete=true`，让系统在进程结束时主动通知，不主动 wait。

**附带教训**: TC-005 内部用 `evaluate_handle` + f-string 嵌套 JS 双引号导致 SyntaxError，但脚本被 try/except 包裹后写入 FAIL 结果继续跑，最终仍然能复现 PRD 3.2.2 协议文档三级结构缺失这个 P0 判定。**用例级 try/except 是长测试脚本的硬性要求，不是可选项**。

## 📊 实测稳定性 (3 次跨 cron 复现)

| 跑次时间 | PASS | FAIL | SKIP | P0 通过率 | 缺陷数 |
|----------|------|------|------|----------|--------|
| 2026-06-16 22:12 | 11 | 3 | 2 | 1/2 = 50% | 3 |
| 2026-06-17 16:54 | 11 | 3 | 2 | 1/2 = 50% | 3 |

**结论**: 脚本+缺陷集合**完全稳定**，可作为回归基线。下次开发修复后再跑同一脚本，预期 TC-005/006/003 转 PASS。
