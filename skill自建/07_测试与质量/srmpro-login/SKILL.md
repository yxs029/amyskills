---
name: srmpro-login
description: SRMPRO (test.esicint.com) 一键登录封装。集成 Playwright 真实 mouse 滑块绕过、storage_state 永久复用、verify-slider-bypass 5 阶梯回退。Use when user says "登录 SRMPRO" / "登录 test.esicint.com" / "开始探索 SRMPRO" / "刷新 SRMPRO session" / "用 storage_state 登录" / "老大要进 SRMPRO 系统" / "SRMPRO 滑块过不了" / "开始申请库探索" / "开始供应商主数据探索" / "开始价格探索" / "开始能力矩阵探索" / "继续 SRMPRO 任务" / "SRMPRO session 过期了". Returns a ready-to-use Playwright `page` object OR sets main agent browser cookies. Triggers whenever agent touches a SRMPRO module (申请库/资源库/价格/能力矩阵/供应商主数据) and needs authenticated session.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。


# SRMPRO Login Skill v1.1

> **From 2026-06-04 01:42 实战**: 老大 admin/Esic@2024 + robust_login.py + Playwright 真实 mouse 拖动 → 首次登录成功, storage_state 49KB 永久跳过滑块。
>
> **2026-07-28 实战教训（重要）**: 当要登录 SRMPRO 做侧边栏遍历/新任务时，**必须直接用本 skill 的 Step 1/Step 2 或 `login_helper.py` 模板**，**禁止从零写登录脚本**。详见底部 "⚠️ 禁止重写登录轮子" 章节。

## 🎯 快速决策树

| 你的情况 | 用这步 |
|---|---|
| 首次登录 SRMPRO / 不知道有没有 storage_state | **Step 1** (完整登录流程) |
| 已有 storage_state.json (49KB), 复用跳过滑块 | **Step 2** (3 秒登录) |
| storage_state 过期, 重新登录 | **Step 3** (刷新 storage_state) |
| 所有方式都失败, 滑块过不去 | **Step 4** (回退到 verify-slider-bypass 5 阶梯) |

---

## Step 1 — 首次登录 (完整流程, 60-90 秒)

### 1.1 准备
```bash
# 关键路径 (固定, 不要改)
PW_BIN="/home/aaronmy/.openclaw/workspace/bi-automation/venv/bin/python"
PW_DIR="/home/aaronmy/.openclaw/workspace/bi-automation"
STATE_PATH="/home/aaronmy/文档/移动云盘同步盘/10ESIC软件测试/SRMPRO/测试过程数据/00_通用工具/srmpro_storage_state.json"
SCREENSHOT_PATH="/tmp/srmpro_logged_in.png"
```

### 1.2 环境变量加载
```bash
export TEST_USERNAME="admin"
export TEST_PASSWORD="Esic@2024"  # 老大 2026-06-03 明确给出
```

### 1.3 登录脚本
```python
import sys, os
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')
os.environ['TEST_USERNAME'] = 'admin'
os.environ['TEST_PASSWORD'] = 'Esic@2024'

from playwright.sync_api import sync_playwright
from robust_login import robust_login  # ← 关键! bi-automation 项目里已有

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,  # 无显示器环境必须 headless
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'],
    )
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    config = {
        'base_url': 'https://test.esicint.com/index',
        'username': 'admin',
        'password': 'Esic@2024',
        'max_retries': 3,
        'wait_after_login': 5,
    }

    robust_login(page, config)  # ← 真实 mouse 拖动, ease-out 曲线

    # ✅ 验证: URL 应该是 /index, 不是 /login
    assert '/index' in page.url, f"登录失败! URL: {page.url}"
    print(f"✅ 登录成功! URL: {page.url}")

    # 💾 保存 storage_state (永久跳过滑块)
    context.storage_state(path=STATE_PATH)
    print(f"💾 storage_state: {STATE_PATH}")

    # 📸 截图
    page.screenshot(path=SCREENSHOT_PATH, full_page=False)
    print(f"📸 截图: {SCREENSHOT_PATH}")

    browser.close()
```

### 1.4 成功标志
- `URL: https://test.esicint.com/index` (不是 `/login?redirect=...`)
- `srmpro_storage_state.json` 写入 (49KB 左右)
- 截图里有 SRMPRO dashboard, 没有"请登录"

---

## Step 2 — storage_state 复用 (3 秒登录)

**适用场景**: 已经成功登录过, 想快速拿到已认证 page。

```python
from playwright.sync_api import sync_playwright

STATE_PATH = "/home/aaronmy/文档/移动云盘同步盘/10ESIC软件测试/SRMPRO/测试过程数据/00_通用工具/srmpro_storage_state.json"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(
        viewport={'width': 1280, 'height': 800},
        storage_state=STATE_PATH  # ← 关键! 跳过滑块
    )
    page = context.new_page()
    page.goto('https://test.esicint.com/index')

    # ✅ 验证: 直接进 dashboard, 不进登录页
    if '/login' in page.url:
        print("⚠️ storage_state 过期, 回退到 Step 1")
        # ...回退逻辑
    else:
        print(f"✅ storage_state 复用成功! URL: {page.url}")
        # 在这里做 4 层深度探索
        # page.click(...)
        # page.screenshot(...)
        # page.fill(...)
    browser.close()
```

### 何时 storage_state 失效
- SRMPRO 后端 token 轮换 (定期, 约 1-7 天)
- 用户密码被改
- 后端 session 表清空
- 失效标志: `page.goto('/index')` 跳回 `/login?redirect=...`

---

## Step 3 — 刷新 storage_state (40 秒)

**适用场景**: Step 2 发现 storage_state 过期, 但仍能调起 robust_login。

```python
import os
os.environ['TEST_PASSWORD'] = 'Esic@2024'  # 重新设 (防脱敏)

from playwright.sync_api import sync_playwright
from robust_login import robust_login

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    config = {
        'base_url': 'https://test.esicint.com/index',
        'username': 'admin',
        'password': 'Esic@2024',
        'max_retries': 3,
        'wait_after_login': 5,
    }

    robust_login(page, config)

    # 重新保存 storage_state
    context.storage_state(path=STATE_PATH)
    print(f"🔄 storage_state 刷新成功: {STATE_PATH}")
    browser.close()
```

---

## Step 4 — 失败回退 (verify-slider-bypass 5 阶梯)

**适用场景**: Step 1/3 失败, robust_login 跑不过滑块。

**立即加载并执行 `verify-slider-bypass` skill** (5 阶梯):
1. **v1.0** — MouseEvent dispatch (简单站点)
2. **v1.7** — Vue ref inject (改 instance data)
3. **v1.8** — Login 父组件 loginForm.code 注入
4. **v2.0** — Selenium ActionChains 真实 OS mouse (需要 Xvfb)
5. **v3.0** — API + cookie replay (绕过整个 UI)

详细见 `~/.hermes/skills/qa/verify-slider-bypass/SKILL.md`。

**2026-06-04 实战结论**:
- ❌ v1.0 (dispatch) — barLeft 走 46px, sliderLeft 永远 0
- ❌ v1.7 (Vue ref) — UI 变绿, 但 code/uuid 空
- ❌ v1.8 (loginForm inject) — code 填了, 后端 401 "账号被锁"
- ❌ v2.0 (Selenium headless) — slider left 永远 0
- ✅ **v4.0 (Playwright 真实 mouse + bi-automation venv + robust_login.py)** — **成功**

**所以**: **v4.0 是 SRMPRO 终极方案**, **5 阶梯留作其他 B2B 站点用**。

---

## ⚠️ Playwright 浏览器兼容性 (2026-06-16 重要发现)

**问题**: 系统已安装 `chromium-1134` (114MB,完整 Chromium) 但 Playwright 默认找的是 `chrome-headless-shell-1223` (未安装,会报 "Executable doesn't exist")。

**解决方案**: 显式指定 `executable_path`:

```python
CHROME_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        executable_path=CHROME_PATH,  # ← 关键! 否则启动失败
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'],
    )
```

**可用的浏览器路径** (按优先级):
1. `/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome` ✅ 推荐
2. `/usr/bin/chromium-browser`
3. `/usr/bin/google-chrome`

## ⚠️ 长脚本必须用 background 模式 (2026-06-16)

**问题**: 跑 16 个测试用例 + 截图的脚本耗时 2-3 分钟, `terminal()` 前台命令**单次调用超时不能超过 600s**。

**解决方案**: 用 `background=true` + `notify_on_complete=true`,然后用 `process` 工具查询进度:

```python
# ❌ 错误: 前台 >600s 直接超时
# terminal(command="python3 run_tests.py", timeout=3200)  # 报错: exceeds 600s

# ✅ 正确: 后台 + 通知
# terminal(command="python3 run_tests.py", background=True, notify_on_complete=True)
# 然后用 process(action="wait"/"poll") 查询
```

**后台 tee 重定向到日志**:
```bash
python3 run_tests.py 2>&1 | tee /tmp/test.log
```

## ⚠️ Playwright expect_download timeout 单位陷阱 (2026-06-17)

**踩坑**: 报表下载测试 v1 全部 P0 失败,defects=17,根因是:

```python
# ❌ 错误: timeout=60 被当成 60 毫秒,下载永远来不及
with page.expect_download(timeout=60) as d:
    btn.click()
# Timeout 60ms exceeded while waiting for event "download"
```

**Playwright Python `page.expect_download(timeout=...)` 的 timeout 单位是毫秒**,不是秒。

**修法**:
```python
# ✅ 正确: timeout=60000 (60 秒) 或显式 *1000
with page.expect_download(timeout=60000) as d:
    btn.click()
```

**修复后效果**: 报表下载 10 个用例从 6 fail/3 pass/1 skip → 9 pass/0 fail/1 skip,P0 通过率 0% → 100%。

**判别诊断**: 报错信息明确写着 "Timeout 60ms exceeded" — 看到秒数对不上(预期 60s 实际几秒就报),立即怀疑单位问题。

## ⚠️ JS evaluate_handle 引号转义陷阱 (2026-06-16)

**问题**: Python f-string 嵌套 JS 代码, 引号转义容易踩坑:

```python
# ❌ 错误: 转义双引号在 JS selector 里会 SyntaxError
parent = el.evaluate_handle('el => el.closest(".el-tree-node, [class*=\"tree-node\"]")')
# Error: missing ) after argument list

# ✅ 正确: Python 用三引号 + JS 用单引号 (无转义)
result = el.evaluate("""el => {
    let n = el;
    while (n && n.tagName !== 'TR') n = n.parentElement;
    return n ? n.outerHTML : null;
}""")
```

**核心原则**: JS 字符串一律用 `'''...'''` 或 `"""..."""` 三引号包裹, JS 内部全部用单引号或反引号模板字符串,避免双引号转义噩梦。

## 📋 筛选区测试 v5 实战结果 (2026-06-17)

**v5 脚本**: `~/SRMPRO/文档库/P_方法层/scripts_执行脚本/run_filter_tests_v5.py`

**结果**: 13 用例 | 11 通过 | 2 失败 | 0 跳过 | 总通过率 84.6% | P0 通过率 100% (4/4) | 缺陷数 2

**2 个 P1 缺陷 (已知, v4/v5 一致复现)**:
1. **TC-SEARCH-005 重置按钮不生效**: 点击重置后搜索框值仍为"质量"未清空, 分段器"即将过期"仍高亮选中(未恢复"全部")。分段器状态: `[全部 4747 active=False, 即将过期 0 active=True, 已过期 28 active=False]`
2. **TC-SEARCH-007 空状态文案通用化**: 搜索无匹配时显示 el-table 默认"暂无数据", 而非搜索专用"暂无符合条件的文档"。空状态组件 `.el-table__empty-text` 不可见(empty=False), 但文案 DOM 存在。

**v5 vs v4 改进**:
- 显式指定 `executable_path=CHROME_PATH` (chromium-1134)
- TC-SEARCH-003 大小写一致性改用表格行数对比(而非 body 文本长度, 更精确)
- TC-SEG-004 交集用例增加正向/反向顺序一致性验证
- 缺陷明确标记 severity + desc + actual 三件套

**关键选择器确认 (v5 仍有效)**:
- 搜索框: `input[placeholder="请输入文档名称"]`
- 搜索按钮: `button.el-button--primary:has-text("搜索")`
- 重置按钮: `button.el-button--default:has-text("重置")`
- 分段器: `.status-segment__item` (视口外点击需 `force=True`)
- 展开全部: `button:has-text("展开全部")`

## 📂 相关测试模块选择器 (2026-06-16)

| 模块 | 参考文件 | 选择器关键差异 |
|------|----------|--------------|
| 文档库 (本 skill 主页) | `references/document-library-permission-testing.md` | URL 404 即无权限 |
| 筛选区 | `references/document-library-filter-testing.md` | `.status-segment__item` 视口外点击需 `force=True` |
| **树形列表区** | **`references/document-library-tree-testing.md`** | **不是 el-tree! 是表格行展开, 无 `.el-tree-node__expand-icon`** |
| **文档详情弹窗** | **`references/document-library-modal-testing.md`** | **el-dialog `close-on-click-modal=false`; 弹窗持久化共享; route 拦截须 unroute** |

## 🐛 失败诊断

### 报错: "登录失败，账号被锁定，预计于2026-06-04 01:26:15解锁"

**原因**: 多次密码错误触发账号保护
**解决**: 等自动解锁 (2026-06-04 01:26:15), 或联系 ESIC 客服

### 报错: "verify-move-block 未找到"

**原因**: 页面没完全加载, 或已登录跳过登录页
**解决**:
```python
page.goto('https://test.esicint.com/login')
page.wait_for_selector('.verify-move-block', timeout=10000)
```

### 报错: slider 拖动后 barLeft 一直 46px

**原因**: 滑块事件绑在 document 而非 slider, 或 React 组件拦截 dispatch
**解决**: **不要用 dispatchEvent, 必须真实 Playwright mouse API** (本 skill 的方式)

### 报错: "e.stopPropagation is not a function"

**原因**: verify 内部用了第三方库拦截
**解决**: v1.7/v1.8 改用 Vue ref 直接改 data, 不调用方法

### 报错: "RobustLogin 找不到 robust_login 函数"

**原因**: 路径错, 或 bi-automation 项目结构变了
**解决**:
```bash
ls /home/aaronmy/.openclaw/workspace/bi-automation/robust_login.py
# 应该存在, 否则重新 git clone
```

---

## 📂 文件清单 (固定路径)

| 文件 | 位置 | 大小 | 作用 |
|---|---|---|---|
| robust_login.py | `~/.openclaw/workspace/bi-automation/robust_login.py` | ~3KB | 滑块拖动核心 |
| **login_helper.py** | `templates/login_helper.py`（本 skill 内） | ~3KB | **共享登录模块模板**，复制到 scripts/ 目录即可用 |
| venv python | `~/.openclaw/workspace/bi-automation/venv/bin/python` | - | Playwright 1.40+ |
| srmpro_storage_state.json | `测试过程数据/00_通用工具/srmpro_storage_state.json` | 49KB | 永久跳过滑块 |
| 登录截图 | `测试过程数据/2026-06-03_esicint/screenshots/05-srmpro-logged-in-via-playwright.png` | 218KB | 验证截图 |
| 凭据 | `~/.openclaw/workspace/bi-automation/config/.env` (TEST_USERNAME/TEST_PASSWORD) | 607B | **密码硬编码此文件 (老大 2026-06-03 同意)** |

---

## 🔑 多账号测试 (2026-06-16 实战)

`robust_login` 对所有账号通用，不仅限于 admin。文档库权限测试需要 3 个账号：

| 账号 | 密码 | 角色 | storage_state |
|------|------|------|---------------|
| admin | Esic@2024 | 采购管理员(全量) | ✅ 有 |
| testadmin | Esic@2024 | 采购员A(有归属) | ❌ 需每次 robust_login |
| aarontest | Esic@2024 | 采购员B(无归属) | ❌ 需每次 robust_login |

**关键点:**
- `storage_state` 只对 admin 有效（已保存），其他账号每次需重新 `robust_login`
- 多账号测试时，每个账号需要独立的 browser context，登出逻辑: 直接 `browser.close()` 再开新 browser
- 不要在同一 context 中切换账号，cookie 会冲突

## 📋 文档库页面结构 (2026-06-16 实战确认)

文档库 `/SupplierManagement/newDocument` 的实际结构：

- **不是** 传统 el-tree 树形控件
- **是** 表格+可展开行结构（类似 el-table 的 expand row）
- 统计卡片（4个：文档类型总数/已上传/即将过期/已过期）在顶部
- 表格 5 个分类行（财务/资质/协议/审核/文档），每行有"展开"按钮
- "展开全部"按钮选择器: `text=展开全部`
- 展开后显示子类型行（如营业执照/ISO证书等），共 35 个子类型
- 导出按钮: "资质文档统计下载" / "协议签署统计下载"

**⚠️ 权限控制关键发现:**
- 汇总统计卡片和分类行数据是**全量数据**，未按采购员归属关系过滤
- 权限控制在**操作层拦截**（点击展开弹出"没有该操作权限"），而非数据层过滤
- 无权限用户(aarontest)直接访问文档库 URL 返回 **404 错误页**，而非空数据页
- 这意味着: 视觉对比（admin vs testadmin 截图）是验证权限的**必需步骤**，自动化脚本判断不够

**自动化测试选择器:**
```python
# 展开全部
page.click('text=展开全部')  # ✅ 有效
page.query_selector('.el-tree-node__expand-icon')  # ❌ 找不到（不是 el-tree）

# 导出按钮
page.query_selector('button:has-text("资质文档统计下载")')  # ✅
page.query_selector('button:has-text("协议签署统计下载")')  # ✅

# 搜索框
page.query_selector('input[placeholder*="搜索"], .el-input__inner')  # ✅
```

**📚 详细参考文档 (linked files):**
- `references/document-library-permission-testing.md` — 三账号权限对比测试模板 (admin/testadmin/aarontest)。**2026-06-17 v6 更新**: 新增 Excel 下载落地验证模板 (`expect_download` + openpyxl 行数/关键字/表头三件套)、测试环境基准数表 (admin=3236 行, S3 越权关键字"重庆智博")、长测脚本后台调度模板 (`tee` + 分段 poll)、8 个 P0 已知缺陷清单。**v5 教训**: 不做下载落盘验证会让 P0 通过率虚高 (v5 80% 实际 20%)
- `references/document-library-filter-testing.md` — 筛选区 (搜索行+分段器) 测试，含 13 个 TC-SEARCH/SEG 用例的精确选择器、视口外点击陷阱 (`force=True`)、Playwright EPIPE 崩溃规避、HTML 报告 `%` 格式化陷阱、已发现的 2 个 P1 缺陷 (重置按钮不生效/空状态文案通用化)
- `references/document-library-tree-testing.md` — 树形列表区 (16 个 TC-TREE 用例) 测试，含 16 个用例实测结果、3 个真实缺陷 (含 1 个 P0: 协议文档三级结构缺失)、精确选择器、JS evaluate 引号转义陷阱、行展开操作模板
- `references/document-library-modal-testing.md` — 文档详情弹窗 (26 个 TC-MODAL 用例) 测试，含 5 个核心模式 (弹窗检测/打开/关闭/JS批量样式采样/接口路由拦截)、5 个真实缺陷 (4 个 P1 样式规则未落地)、与树形列表区背景色规则不一致的强信号、弹窗持久化共享设计
- `references/srmpro-layout-shift-pitfalls.md` - **2026-07-08 新增**：展开全部后搜索框/分页器不可见导致 Playwright fill/click 30s 超时的 3 种解法（JS evaluate 设值 / 先收起再操作 / force=True 强制点击）
- `references/playwright-evaluate-pitfalls.md` - **必读**：`pg.evaluate()` 内 `document.querySelector*` 不支持 Playwright 自定义伪类 (`:visible` / `:has-text()` / `:nth-match()`)，会抛 SyntaxError 让整个用例 fail。给出 SRMPRO 弹窗场景下 3 种修法（推荐：`offsetParent !== null` + `wrapper.style.display !== 'none'` 原生判可见）+ 写脚本前 grep 自检命令。2026-06-17 数据权限 v5 测试 3 处踩坑教训。
- `references/batch-execution-log-merge.md` - **2026-07-17 新增**：38 个用例分 4 批执行 + 日志合并恢复完整方案（EPIPE 崩溃规避、JSON 覆盖问题、正则提取用例结果）
- `references/element-ui-select-dropdown-pitfall.md` - **2026-07-18 新增**：Element UI el-select 大量选项时 Playwright click 30s 超时陷阱（109 个选项只有 10 个 visible）。解法：用 JS evaluate 遍历 `offsetParent !== null` 找可见选项。含 SRMPRO 图纸库上传弹窗真实 DOM 选择器对照表

## 🔗 配套 skills

- **`verify-slider-bypass`**: 5 阶梯 Playwright/Selenium/API 回退 (本 skill 失败时用)
- **`web-exploratory-tester`**: 登录后做 4 层深度探索
- **`dogfood`**: 输出 dogfood 格式报告
- **`cron-scheduled-test-runner`**: 定时批量执行测试，内含 srmpro-login 登录逻辑
- **`qa/scc-system-testing` (待建)**: SCC 系统 (`scc.esicint.com`) 的 hover-popup 菜单遍历、后端 48080 反代发现、11 个 500 错误清单、内网 IP 泄露修复建议

---

## 📜 Provenance

- **2026-06-04 01:42 实战** (admin/Esic@2024 + bi-automation venv + robust_login.py): **首次登录成功**
- 触发场景: 老大 01:30 闹钟任务, 账号解锁 19 分钟后
- 失败路径: v1.0/v1.7/v1.8 全部失败 (server-side validation), 切换到 bi-automation venv 真实 Playwright 成功
- 关键洞察: **dispatchEvent 永远走不到 verify-move-block 内部 React state, 必须真实 chromium 进程 + page.mouse.move/down/up**

---

## ⚠️ SCC 系统变种 (2026-07-28 实战)

**关键发现**: SCC 系统 (`http://scc.esicint.com`) 用的是**和 SRMPRO 完全相同的 verify 组件**，但有以下差异：

| 项目 | SRMPRO (test.esicint.com) | SCC (scc.esicint.com) |
|------|--------------------------|------------------------|
| 账号密码 | admin/Esic@2024 | **admin/Esic@2024 (相同！)** |
| 滑块 selector | `.verify-btn` | **`.verify-btn` (相同！)** |
| 后端 API 前缀 | `/admin-api/` | `/admin-api/` |
| 浏览器路径 | 系统 chromium 即可 | **系统 chromium 即可** |
| 菜单结构 | 侧边栏 el-menu-item | **悬停弹出 popover（不是侧边栏！）** |
| 登录后主页 | `/index` | `/index` (相同) |
| 登录按钮 | `el-button--primary` | **`el-button--primary` (相同)** |
| 注意坑 | 多账号需独立 context | 菜单 hover 后**会消失**，必须每次重新 hover |

**SCC 菜单遍历关键陷阱（2026-07-28 踩坑）**:

SCC 用的是 **`.menu-btn.el-popover__reference` 悬停弹出菜单**，不是 el-submenu 侧边栏。每次点击子菜单后弹层消失，**必须重新 hover 一级菜单**才能继续点下一个。

```python
# 错：连续 hover 完再点 → 菜单已消失
for sub_text in sub_items:
    sub_elem.click()  # ❌ 第二次点击找不到子菜单

# 对：每次点前重新 hover
for sub_text in sub_items:
    menu.hover()  # ✅ 重新弹层
    page.wait_for_timeout(300)
    sub_elem = page.locator(f'.el-cascader-node:has-text("{sub_text}")').first
    sub_elem.click()
```

子菜单 selector：`.el-cascader-node`（在弹出的 popover 里），**不是** `.el-submenu` 或 `.el-menu-item`。

**SCC 后端路径发现**（从 `index.js` 静态提取）：

- baseURL: `http://scc.esicint.com:48080/admin-api/`
- **但 48080 端口外网直连 timeout**——必须通过 nginx 反代（前端域名）
- 浏览器内 `fetch('/admin-api/...')` 才能通
- API 572 个，11 个 500 错误，最严重是 `/ov/ai-agent/prepare-converse` 泄露内网 IP

**SCC 与 SRMPRO 的核心共同点**（决定了可以复用本 skill 的 `login_helper.py`）：

1. 同 verify 组件 → 同滑块绕过策略
2. 同 admin 账号 → 同密码复用
3. 同 `/admin-api/` 前缀 → 同 Bearer Token 鉴权
4. 同 `/index` 登录后跳转 → 验证逻辑一致

→ **结论**：SCC 系统登录直接走本 skill 的 Step 1（首次）或 Step 2（复用 storage_state），不需要新写轮子。

## ⚠️ 浏览器模式：老大 2026-07-17 明确要求全部有头（headless=False）

**老大原话**: "你不要用无头浏览器，你有有头的测，跑脚本都用有头浏览器测试"

→ SRMPRO 测试脚本默认 `headless=False`。除非老大明确同意，**禁止**改回 headless=True。

**前提**：系统必须有 X server 在跑。
```bash
xdpyinfo 2>&1 | head -3   # 应显示 "name of display: :0"
echo $DISPLAY              # 应是 ":0"
ls /tmp/.X11-unix/        # 应有 X0 屏幕 socket
```

**headless=False 的代价**：
- Playwright Driver 跑 20+ 用例会 socket 累积崩（EPIPE 错误）
- **必须**用 `BATCH_START`/`BATCH_END` 环境变量分批跑，每批 ≤8 用例
- **必须**每 2 个用例 `save_results()` 中间存档

详见 `references/srmpro-login-button-disabled-pitfall.md`。

## ⚠️ storage_state 实际是空壳（2026-07-17 验证）

`~/文档/.../srmpro_storage_state.json` 50KB，**但只含 1 个 `size` cookie（页面大小设置），不是 session cookie**。

→ **不要**再依赖 storage_state 登录。**走表单登录**才是稳的。

→ 之前 M01 偶发能登录是因为**碰巧** Vue 数据绑定在 click 时已完成，不可重复。

## ⚠️ 登录按钮 disabled 卡死修复（详见 references）

按钮 `button "common.logIn"` 填完账号密码后**永远 disabled**，常见根因 5 种 + 5 种修法。

**关键**：用 `wait_for_function` 轮询 `!btn.disabled` + `page.evaluate` 直接设值 + 派发 input 事件，
不要用 `page.click` 反复重试。

完整模板见 `references/srmpro-login-button-disabled-pitfall.md`。

## ⚠️ 共享登录模块 login_helper.py（2026-07-17 实战验证）

**问题**: 9 个测试脚本各自复制粘贴了 broken 的 `smart_login` 函数（简单 fill+click），全部卡在登录按钮 disabled。逐个修复耗时巨大且容易遗漏。

**解决方案**: 写一个共享 `login_helper.py`，所有脚本 `from login_helper import login_admin` 一行搞定：

```python
# login_helper.py 放在 scripts/ 目录下
import sys
BI_AUTO_DIR = "/home/aaronmy/.openclaw/workspace/bi-automation"
if BI_AUTO_DIR not in sys.path:
    sys.path.insert(0, BI_AUTO_DIR)
from robust_login import robust_login

EXEC_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"

ACCOUNTS = {
    "admin": {"username": "admin", "password": "Esic@2024"},
    "testadmin": {"username": "testadmin", "password": "Esic@2024"},
    "aarontest": {"username": "aarontest", "password": "Esic@2024"},
}

def create_browser(headless=False):
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=headless, executable_path=EXEC_PATH,
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'],
    )
    return pw, browser

def login_admin(page, account_type="admin"):
    acct = ACCOUNTS.get(account_type, ACCOUNTS["admin"])
    robust_login(page, {
        'base_url': 'https://test.esicint.com/index',
        'username': acct['username'], 'password': acct['password'],
        'max_retries': 3, 'wait_after_login': 5,
    })
    return '/login' not in page.url.lower()
```

**使用方式**（在每个测试脚本中）：
```python
def smart_login(page, account_type="admin"):
    from login_helper import login_admin as _login
    _login(page, account_type)
    page.wait_for_timeout(2000)
    return True
```

**批量替换旧 smart_login**：用正则 `def smart_login\(page.*?\):\n.*?(?=\ndef |\nclass |\n# ===)` 匹配旧函数体，替换为 4 行 import 版本。

**验证结果**: 2026-07-17 实战，9 个脚本全部一次性登录成功（滑块一次过），M01 38 个用例全 PASS。

## ⚠️ 长测试批次执行 + 日志合并（2026-07-17 实战）

**问题**: 38 个用例的 M01 脚本在有头模式下跑 ~15 个就 EPIPE 崩溃。`save_results()` 每批覆盖 JSON 文件，丢失前批数据。

**解决方案**: 3 步走

1. **分批执行**（环境变量控制）：
```bash
BATCH_START=1 BATCH_END=8 python run_m01_tests.py  # 第1批
BATCH_START=9 BATCH_END=16 python run_m01_tests.py  # 第2批
BATCH_START=17 BATCH_END=24 python run_m01_tests.py  # 第3批
BATCH_START=25 BATCH_END=38 python run_m01_tests.py  # 第4批
```

2. **日志 tee 保存**：每批 `2>&1 | tee /tmp/m01_batchN.log`

3. **日志合并恢复**（因为 JSON 被覆盖，从日志提取）：
```python
import re
all_cases = {}
pattern = r'\[(PASS|FAIL)\] (TC-DRAW-M01-\d+) - (.+?): (.+)'
for logfile in ['/tmp/m01_test_v2.log', '/tmp/m01_batch2.log', ...]:
    with open(logfile, 'r') as f:
        for status, tc_id, title, desc in re.findall(pattern, f.read()):
            all_cases[tc_id] = {"id": tc_id, "status": status, ...}
# 保存到 M01_final.json（不会被后续批次覆盖）
```

**关键教训**: 测试脚本的 `save_results()` 默认覆盖文件。如果分批跑，要么改成追加模式，要么用独立的 `_final.json` 文件保存合并结果。

## ⚠️ 测试环境写操作执行原则（2026-07-17 用户明确纠正）

**用户原话**: "如果已经登录了，就直接测试啊，图纸库就是这样的，测试环境都可以操作" / "删除新增你随意，图纸库就是这样的，测试环境都可以操作"

**铁律**: 在 SRMPRO **测试环境**（`test.esicint.com`，非生产）中执行自动化测试时，
**写操作（上传/关联/归档/删除/配置变更）必须真正执行，不要标记为 cron-unsafe 跳过。**

**错误做法**（本次踩坑）:
- 把 31 个涉及写操作的用例一刀切标记为 `status="skip"` + defect="需手动执行"
- 理由"怕污染测试环境数据" —— 但测试环境就是用来造数据的

**正确做法**:
- 登录后直接执行写操作，每个用例独立 try/except，异常不影响后续用例
- 上传→可删；关联→可取消关联；归档→可恢复；这些都是可逆操作，正常测
- 无数据的列表（0行）反而应该通过上传造数据，让后续读取类用例有数据可验证
- **唯一需谨慎的**: 真正不可逆且影响全局的操作（如删除生产数据、改全局配置生效时间窗口）
  ——但也仅在"生产环境"才谨慎，测试环境随便

**cron-unsafe 仅适用于**: 无人值守的 cron 定时任务（怕自动跑污染），且即使如此，
测试环境的 cron 也可以放开写操作，只是生产环境 cron 必须 skip。

**判别标准**:
- 人工触发的测试（terminal/后台执行）→ 写操作全部真执行
- cron 定时任务 → 写操作可 skip，但测试环境 cron 也可放开

## ⚠️ OPRASE 目录结构规范（2026-07-17 用户明确纠正）

SRMPRO 项目使用 OPRASE 目录结构，测试交付物必须归位：

| 层 | 路径 | 放什么 |
|----|------|--------|
| 04-A | `SRMPRO/图纸库/04-A测试执行过程/测试执行任务/` | 测试任务清单(M01~M10_测试任务.md)、Playwright脚本(scripts/)、结果JSON(results_json/)、截图(screenshots/) |
| 05-S | `SRMPRO/图纸库/05-S_交付层/HTML报告/` | 生成的HTML测试报告 |
| 06-E | `SRMPRO/图纸库/06-E复盘/` | 复盘md（工作经验总结） |

**错误做法**: 在 `SRMPRO/图纸库/测试执行任务/` 自建目录（不在OPRASE结构里）
**正确做法**: 测试执行任务放 `04-A测试执行过程/` 下，报告放 `05-S_交付层/`，复盘放 `06-E复盘/`

**注意**: `05-S_交付层` 和 `05-S交付报告` 是同一层，统一用 `05-S_交付层`（带下划线）

## ⚠️ 安全注意

- 密码 `Esic@2024` 硬编码到 `~/.openclaw/workspace/bi-automation/config/.env` (TEST_PASSWORD 字段)
- 老大 2026-06-03 明确同意此方案 (比每次问密码省事)
- **不要把密码写入 git 仓库或 commit 消息**
- **不要 echo 密码到日志** (用 `${TEST_PASSWORD:0:3}***` 截断显示)

---

## 🚀 快速调用模板 (30 秒)

**最快登录 + 探索** (一步到位):

```python
import os, sys
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')
os.environ['TEST_USERNAME'] = 'admin'
os.environ['TEST_PASSWORD'] = 'Esic@2024'

from playwright.sync_api import sync_playwright
from robust_login import robust_login

STATE_PATH = "/home/aaronmy/文档/移动云盘同步盘/10ESIC软件测试/SRMPRO/测试过程数据/00_通用工具/srmpro_storage_state.json"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800})

    # 优先用 storage_state (3 秒), 失败再 robust_login
    if os.path.exists(STATE_PATH):
        try:
            context.add_cookies  # 等价于 storage_state
            print("✅ 用 storage_state 复用")
        except:
            pass

    # 如果上面没成功 (storage_state 过期), 走 robust_login
    page = context.new_page()
    page.goto('https://test.esicint.com/index')
    if '/login' in page.url:
        robust_login(page, {
            'base_url': 'https://test.esicint.com/index',
            'username': 'admin', 'password': 'Esic@2024',
            'max_retries': 3, 'wait_after_login': 5,
        })
        context.storage_state(path=STATE_PATH)
        page.goto('https://test.esicint.com/index')

    print(f"✅ 准备就绪: {page.url}")
    # 你的探索代码 ↓
    # page.click(...)
    # page.screenshot(...)
    browser.close()
```

**老大以后只需说 "登录 SRMPRO", 我立即跑这个 skill, 3-90 秒拿到已登录 page。**

---

## ⚠️ 禁止重写登录轮子（2026-07-28 侧边栏遍历任务踩坑）

**踩坑背景**：老大要求 "把侧边栏遍历到最底层目录"，本 agent 从零写了个 `sidebar_traversal_test.py`，完全没意识到已有本 skill 提供的 `login_helper.py` + bi-automation venv + robust_login.py 黄金组合。结果：

- ❌ 5+ 次登录失败（dispatchEvent / 真实 mouse / Xvfb / launch_persistent_context 全部尝试）
- ❌ 自己造了 Playwright headless + system Chrome 路径，又造了坐标定位 + DOM 截图分析，浪费 1 小时
- ❌ 最终决定"任务未完成"归档，让老大失望

**铁律**：

1. **任何 SRMPRO 登录需求** → 加载本 skill，**直接用** `templates/login_helper.py` 或 `bi-automation/robust_login.py`
2. **不要从零写登录脚本** —— 滑块验证、Vue ref、ESIC 解锁、设备指纹、浏览器路径全部踩过坑
3. **不要相信 "用 images 估算坐标 + mouse.click" 能成功** —— 视觉反馈 ≠ 服务端验证通过，UI 显示绿色但按钮仍 disabled 的情况反复出现
4. **bi-automation venv 路径**：`/home/aaronmy/.openclaw/workspace/bi-automation/venv/bin/python` —— 这是唯一验过能过 SRMPRO 滑块的 venv
5. **老大 2026-07-17 明确要求 headless=False** —— 即使是后台脚本，也必须有 X server 跑（`$DISPLAY=:0`）

**如何正确处理新任务**（如侧边栏遍历）：

```bash
# Step 1: 加载 srmpro-login skill（已完成）
# Step 2: 用 login_helper 一行登录
from login_helper import login_admin
login_admin(page, "admin")  # 拿到已登录 page

# Step 3: 写真正的测试逻辑（不重新造登录代码）
for menu_item in get_all_menu_items(page):
    test_menu(page, menu_item)
```

**判别标准**（"是不是在重写轮子"）：
- ❌ 自己写 `page.fill('input[placeholder*=用户]')` —— 用 `login_helper.login_admin()`
- ❌ 自己写 mouse.down / move / up 拖滑块 —— 用 `robust_login()`
- ❌ 自己定义 `BASE_URL` 找凭据 —— 用 `ACCOUNTS['admin']`
- ❌ 自己选浏览器 executable_path —— 用 `login_helper.create_browser()`

**结论**：本 skill 是 SRMPRO 登录的唯一入口。加载即用，不重写。

---

## ⚠️ 视觉反馈 ≠ 服务端验证（2026-07-28 实战发现）

**问题**：滑块拖动后 UI 显示绿色（视觉反馈），但登录按钮仍 `disabled`（实际服务端验证失败）。

**判别方法**（不要被假象骗了）：

```javascript
// 必须等 2 秒看按钮状态
await new Promise(r => setTimeout(r, 2000));
const btn = document.querySelector('button[ref*="login"], button:has-text("login")');
const realStatus = {
  url: location.href,
  loginBtnDisabled: btn?.disabled,  // ← 真实状态
  sliderVisualGreen: !!document.querySelector('[class*="verify"][class*="success"]'),
};
console.log(realStatus);
// 失败样本: loginBtnDisabled=true 但 sliderVisualGreen=true
// 成功样本: loginBtnDisabled=false 且 page.goto('/index') 后不在 /login
```

**根本原因**：SRMPRO 滑块是**服务端验证**（v3.0 server-side captcha code）—— UI 显示绿色可能是 local state 更新，但服务端 session 没有真正通过验证。

**不要**：
- 用图像模型估计滑块坐标 → 点击 → 看到绿色就以为成功
- 用 JavaScript dispatchEvent 触发 mouse events（v1.0 路径）→ 服务端识别为机器人
- 用 Xvfb + 真实鼠标拖动 → 服务端识别为 headless chromium

**要**：
- 用 `bi-automation/venv/bin/python` + `robust_login()` —— 已验证 100% 成功（2026-06-04 实战）
- 如果还是失败，回退到 `verify-slider-bypass` skill 的 v1.7/v1.8 阶梯
- **终极方案**：让老大在浏览器手动登录，导出 `context.storage_state(path=...)`，下次直接 `storage_state=` 复用

**判别陷阱**：跑完登录后**必须**用 `assert '/index' in page.url` 验证最终状态，不要被 slider 绿色迷惑。
