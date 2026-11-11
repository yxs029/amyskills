# SRMPRO 文档库权限测试参考 (2026-06-16)

## 页面结构

文档库 URL: `https://test.esicint.com/SupplierManagement/newDocument`

### 实际结构（非 PRD 描述的"树形列表"）

页面是**表格+可展开行**，不是 el-tree：

```
┌──────────────────────────────────────────────────┐
│  [统计卡片: 文档类型总数 | 已上传 | 即将过期 | 已过期]  │
├──────────────────────────────────────────────────┤
│  [搜索框] [展开全部] [收起全部]                       │
│  ┌─ 财务相关资料 (1类)  78份  68供应商  已过期1      │
│  │  └─ 付款资料        78    68       1            │
│  ├─ 供应商资质文档 (12类) 991份 724供应商  已过期14   │
│  │  ├─ 营业执照        165   120      0            │
│  │  ├─ 医疗器械经营许可  0     0        0            │
│  │  ├─ ... (12个子类型)                              │
│  ├─ 供应商协议文档 (9类)  67份  55供应商  已过期6     │
│  │  ├─ 采购合同        15    13       2            │
│  │  ├─ ... (9个子类型)                               │
│  ├─ 供应商审核报告 (9类)  2056份 1319供应商 已过期3   │
│  └─ 供应商文档 (4类)     1541份 1531供应商 已过期4   │
├──────────────────────────────────────────────────┤
│  [资质文档统计下载]  [协议签署统计下载]                │
└──────────────────────────────────────────────────┘
```

### 关键选择器

```python
# 展开全部按钮
page.click('text=展开全部')

# 分类行中的"展开"链接
page.query_selector('td:has-text("展开")')

# 导出按钮
page.query_selector('button:has-text("资质文档统计下载")')
page.query_selector('button:has-text("协议签署统计下载")')

# 搜索框
page.query_selector('input[placeholder*="搜索"], .el-input__inner')

# ❌ 不存在的选择器（页面不是 el-tree）
# .el-tree-node__expand-icon
# .el-tree-node__content
```

## 权限测试发现

### 三个账号的实际行为

| 维度 | admin (管理员) | testadmin (采购员A) | aarontest (无权限) |
|------|---------------|--------------------|--------------------|
| 登录 | ✅ storage_state 复用 | ✅ robust_login | ✅ robust_login |
| 文档库页面 | ✅ 正常加载 | ✅ 正常加载 | ❌ 404错误页 |
| 统计卡片 | 53类/4747份/28过期 | **53类/4747份/28过期**(一致!) | 无法访问 |
| 分类行数据 | 全量(5行+35子行) | **全量(5行,数据与admin完全一致)** | 无法访问 |
| 展开全部 | ✅ 可展开 | ❌ 弹出"没有该操作权限" | 无法访问 |
| 导出按钮 | ✅ 可点击 | ✅ 按钮存在 | 无法访问 |

### 核心缺陷

1. **汇总层未过滤**: testadmin 看到的统计卡片和分类行数据与 admin 完全一致，未按归属关系过滤
2. **操作层拦截替代数据过滤**: 点击"展开全部"弹出权限错误，而非展示过滤后的数据
3. **404替代空状态**: aarontest 直接访问 URL 返回 404，而非展示空数据页面（违反 R-04 规则）
4. **子公司维度无法验证**: 因展开被拦截，深圳深南/无锡深南的子公司权限无法在 UI 验证

### 验证方法

**自动化脚本判断不够**，必须做视觉验证：
1. 分别用 admin 和 testadmin 登录，截图同一页面
2. 用 AI 视觉工具对比两张截图的数据是否一致
3. v3 脚本曾误判为"pass"（因汇总数据一致被当作正常），v4 加入对比逻辑后才正确标记为 fail

### ⚠️ Excel 下载落地验证 — v5 误判 / v6 修正 (2026-06-17 实战)

**踩坑**: 数据权限测试 v5 报告 P0 通过率 80%（仅 1 个 P0 失败），但 v6 加入 Excel 真实下载校验后变成 **20%（4/5 P0 失败）**。差异完全来自**导出验证不到位**。

**v5 缺陷**: 点击导出按钮后只判断 `clicked=True`，下载文件 `files=[]` 当 warn 处理，结果 testadmin/admin 导出**都未真正落盘**，对比逻辑被跳过 → 越权数据被误判通过。

**v6 修正模板**（已验证准确捕获 4 个 P0 越权缺陷）:

```python
# 1) 导出 + 落盘
def click_export(page, btn_text, save_prefix):
    info = {"clicked": False, "files": [], "msg": ""}
    btn = page.query_selector(f'button:has-text("{btn_text}")')
    if not btn or not btn.is_visible():
        info["msg"] = "未找到按钮"; return info
    info["clicked"] = True
    try:
        # ⚠️ 单位是毫秒! 不是秒! (见 SKILL.md expect_download 陷阱)
        with page.expect_download(timeout=30000) as dl_info:
            btn.click()
        dl = dl_info.value
        save_path = DOWNLOAD_DIR / f"{save_prefix}_{dl.suggested_filename}"
        dl.save_as(str(save_path))
        info["files"].append(str(save_path))
    except Exception as e:
        info["msg"] = f"无下载: {str(e)[:100]}"
    return info

# 2) Excel 行数 + 关键字 + 表头校验 (openpyxl)
def check_excel_for_supplier(file_path, keyword):
    import openpyxl
    wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    return {
        "total_rows": len(rows),
        "data_rows": len(rows) - 1 if rows else 0,
        "header": [str(c)[:30] if c else "" for c in (rows[0] or [])[:10]],
        "contains_keyword": any(keyword in str(c) for r in rows[1:] for c in r if c)
    }

# 3) 越权判定 (3 个维度都要查)
admin_rows = admin_qual.get("data_rows", 0)  # 基准
ta_rows = xlsx.get("data_rows", 0)
has_s3 = xlsx.get("contains_keyword", False)  # 搜 "重庆智博" 等 S3 关键字
if has_s3 or (ta_rows >= admin_rows and admin_rows > 0):
    defect = "P0 越权"
```

**判定规则三件套**:
- ❌ `ta_rows >= admin_rows and admin_rows > 0` → **未过滤**
- ❌ `contains_keyword=True`（搜 S3 名称如"重庆智博"）→ **越权**
- ✅ `ta_rows < admin_rows` 且 不含 S3 关键字 → 通过

### 📊 测试环境基准数 (2026-06-17 实战采集，可用作快速判断)

| 维度 | admin (全量) | 越权识别值 |
|------|-------------|-----------|
| 统计汇总 | `共 53 类文档，4747 份文件` | testadmin 看到相同 → P0 越权 |
| 主表格行数 | 40 行（5 分类 + 35 子类型） | testadmin = 40 行 → P0 越权 |
| 已过期 | 28 份 | - |
| 资质文档导出 | **3236 行** | testadmin = 3236 行 → P0 越权 |
| 协议签署导出 | **3236 行** | testadmin = 3236 行 → P0 越权 |
| 资质表头 | 供应商编码/供应商名称/供应商简称 | - |
| 协议表头 | 供应商编码/供应商名称/供应商简称/**归属公司名称** | 多一列归属 |
| 已知 S3 越权关键字 | "重庆智博"（重庆智博粉末冶金有限公司）| 出现即 P0 |

**注意**: 后端如果修了权限过滤，admin 数 3236 应保持不变（admin 是基准），变化的是 testadmin 应降到合理子集。aarontest 应为 0 行（仅表头）。

### 🚨 当前已知 P0 缺陷（2026-06-17 v6 复测确认仍未修）

8 个 P0 缺陷全部存在：
1. testadmin 统计汇总未过滤（53类/4747份与admin一致）
2. testadmin 主表格未过滤（40 行=admin 40 行）
3. testadmin 资质导出未过滤（3236 行）
4. testadmin 协议导出未过滤（3236 行）
5. 协议文档子公司中间层（深圳深南/无锡深南）**未实现**（PRD 3.2.2，与 TC-TREE-005 同根）
6. 协议导出含无锡深南行（采购员A仅关联深圳深南）
7. testadmin 资质导出含 S3 "重庆智博"
8. testadmin 协议导出含 S3 "重庆智博"

**根因**: 后端 `/SupplierManagement/newDocument` 相关 API 完全没做归属关系数据过滤，前端只有"操作层拦截"（点展开弹"没有该操作权限"），数据出口全部裸奔。修复必须在 API 层做。

### 📌 长测脚本调度模板（2026-06-17 实战）

权限测试一次跑完 6 个用例 + 多账号 robust_login + 截图 ~5 分钟，**前台 terminal 600s clamp + 后台 wait 60s clamp** 都不够。正确方式：

```bash
# 启动后台 + tee 日志
terminal(command="python3 run_perm_tests.py 2>&1 | tee /tmp/perm_test.log",
         background=True, notify_on_complete=True)

# 中途分段 poll（每次 sleep 60-90 + tail 日志），不要试图一次 wait 完
terminal(command="sleep 90; tail -80 /tmp/perm_test.log; ps aux|grep run_perm|grep -v grep|wc -l")
```

**单进程结束信号**: `ps aux | grep run_perm_tests | grep -v grep | wc -l` 返回 `0`。日志末尾应有"执行完成 耗时 XXXs"和摘要。

## Playwright 自动化测试模板

```python
# 多账号登录 + 对比模式
from playwright.sync_api import sync_playwright
import sys, os
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')

def login_account(p, username, password, state_path=None):
    """登录任意账号，返回 (browser, context, page)"""
    browser = p.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'])
    
    # admin 可以复用 storage_state
    if username == "admin" and state_path and os.path.exists(state_path):
        context = browser.new_context(
            viewport={'width': 1280, 'height': 900},
            storage_state=state_path)
        page = context.new_page()
        page.goto('https://test.esicint.com/index', wait_until='networkidle', timeout=30000)
        import time; time.sleep(2)
        if '/login' not in page.url:
            return browser, context, page
    
    # 其他账号用 robust_login
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    os.environ['TEST_USERNAME'] = username
    os.environ['TEST_PASSWORD'] = password
    from robust_login import robust_login
    robust_login(page, {
        'base_url': 'https://test.esicint.com/index',
        'username': username, 'password': password,
        'max_retries': 3, 'wait_after_login': 5})
    time.sleep(3)
    return browser, context, page

# 使用示例
with sync_playwright() as p:
    # 登录 admin，获取基准数据
    br1, ctx1, pg1 = login_account(p, "admin", "Esic@2024", STATE_PATH)
    pg1.goto('https://test.esicint.com/SupplierManagement/newDocument')
    admin_screenshot = pg1.screenshot(path="admin_doc.png")
    
    # 登录 testadmin，对比
    br2, ctx2, pg2 = login_account(p, "testadmin", "Esic@2024")
    pg2.goto('https://test.esicint.com/SupplierManagement/newDocument')
    testadmin_screenshot = pg2.screenshot(path="testadmin_doc.png")
    
    # 用 AI 视觉工具对比两张截图
    # ...
    
    br1.close(); br2.close()
```
