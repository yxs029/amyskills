# SRMPRO 统计卡片区 — 已验证执行配方

> 2026-06-16 cron 任务 #5 (45827708d516) 实战提炼。
> 通过 5 轮迭代才稳定，每轮踩了不同的坑。可作为后续类似任务的参考配方。

## 模块结构

| 卡片 | Label | Value selector | Unit | 默认颜色 | 异常颜色 |
|---|---|---|---|---|---|
| 1 | 文档类型总数 | `.stats-card__value` | 类 | `rgb(41,45,46)` | — |
| 2 | 已上传文档 | 同上 | 份 | `rgb(41,45,46)` | — |
| 3 | 即将过期 | 同上 | 份 | `rgb(41,45,46)`(=0时) / `rgb(255,186,0)`(>0时) | — |
| 4 | 已过期文档 | 同上 | 份 | `rgb(255,73,73)`(>0时) / `rgb(41,45,46)`(=0时) | "—"（设计预期，实际是 "0"） |

DOM 选择器：
- 容器：`.document-stats-cards`
- 卡片：`.el-card.stats-card`（4 个）
- Label：`.stats-card__label`
- Value：`.stats-card__value`（带 inline `style="color: rgb(...)"`）
- Unit：`.stats-card__unit`

## 真实数据基线（test.esicint.com）

```
文档类型总数: 53 类
已上传文档:   4747 份
即将过期:     0 份
已过期文档:   28 份
```

数据校验锚点：`.document-library__summary` 文案 = `共 53 类文档，4747 份文件`

## 真实 API 路径（必须用 on('request') 先探测再写 route）

```
GET /admin-api/supplier/doc-repository/statistics
GET /admin-api/supplier/doc-repository/tree-list
GET /admin-api/supplier/doc-repository/list
```

⚠️ **不要假设** `/api/statistics/...` 或 `/stat/...`。SRMPRO 用 `admin-api/<module>/<entity>` 命名空间。

## 已发现的真实缺陷

| 编号 | 优先级 | 模块 | 描述 |
|---|---|---|---|
| D-STAT-001 | P1 | 统计卡片区 | `/admin-api/supplier/doc-repository/statistics` 返回 500 时，卡片显示 "0" 而非设计预期的 "—" |

这正是 TC-STAT-006 用 page.route 拦截验证出来的——把测试做对，就能挖出真实缺陷。

## TC-STAT-006 成功配方

```python
# Step 1: 登录（必须用 networkidle，跟 TC-001 一致）
page.goto(f"{BASE_URL}/index", wait_until="networkidle", timeout=30000)
if "/login" in page.url:
    from robust_login import robust_login
    robust_login(page, {'base_url': f'{BASE_URL}/index',
                         'username': 'admin', 'password': 'Esic@2024',
                         'max_retries': 3, 'wait_after_login': 5})
time.sleep(2)

# Step 2: 第一次加载，建立 session 和统计 API 缓存
page.goto(DOC_URL, wait_until="domcontentloaded", timeout=30000)
page.wait_for_selector('.document-stats-cards .stats-card', timeout=15000)
baseline = get_card_data(page)  # 53/4747/0/28

# Step 3: 注册 SPECIFIC 路由（不要用 **/*）
def handler(route):
    if '/admin-api/supplier/doc-repository/statistics' in route.request.url:
        route.fulfill(status=500, content_type='application/json',
                      body='{"code":500,"msg":"ISE"}')
    else:
        route.continue_()
page.route('**/admin-api/supplier/doc-repository/statistics*', handler)

# Step 4: 用 goto 而非 reload 触发（reload 会丢 session）
page.goto(DOC_URL, wait_until="domcontentloaded", timeout=30000)
time.sleep(8)

# Step 5: 观察 fallback
fallback_cards = get_card_data(page)
# 实际: ['0', '0', '0', '0']  (设计期望 '—')
```

## 颜色验证 JS

```python
def get_color(page, label):
    return page.evaluate(f'''() => {{
        const cards = document.querySelectorAll('.document-stats-cards .stats-card');
        for (const c of cards) {{
            if (c.querySelector('.stats-card__label')?.innerText?.trim() === '{label}') {{
                const v = c.querySelector('.stats-card__value');
                return window.getComputedStyle(v).color;
            }}
        }}
        return null;
    }}''')
```

期望值：
- `rgb(41, 45, 46)` ≈ #292D2E（默认深色）
- `rgb(255, 186, 0)` ≈ #FFBA00（即将过期橙色）
- `rgb(255, 73, 73)` ≈ #FF4949（已过期红色）

## 三档分辨率验证（TC-STAT-004）

```python
for w, h in [(1366, 768), (1920, 1080), (2560, 1440)]:
    ctx = browser.new_context(viewport={'width': w, 'height': h})
    page = ctx.new_page()
    login_and_open_doc(page)
    rect = page.evaluate("""() => {
        const c = document.querySelector('.document-stats-cards');
        return {sw: c.scrollWidth, cw: c.clientWidth};
    }""")
    assert rect['sw'] <= rect['cw'] + 2, f"overflow at {w}x{h}"
    ctx.close()
```

## 报告生成（HTML 模板）

复用 cron-scheduled-test-runner SKILL.md 里的 CSS，关键组件：
- `.stats` grid 4 列（总/通过/失败/跳过）
- `.priority-stats` grid 3 列（P0/P1/P2 独立通过率）
- `.test-case.case-fail` 红色左边框
- `.defect-table` 缺陷列表
- `.case-screenshots` 截图链接（相对路径）

报告路径：`~/SRMPRO/文档库/report/<模块>_测试报告.html`
截图命名：`TC-XXX_stepN_<描述>.png`（与报告同目录）

## 时间预算（实测）

| 用例 | 实际耗时 |
|---|---|
| TC-STAT-001 | ~65s |
| TC-STAT-002 | ~48s |
| TC-STAT-003 | ~47s |
| TC-STAT-004 | ~140s（3 个分辨率）|
| TC-STAT-005 | ~80s |
| TC-STAT-006 | ~100s |
| **总计** | **~480s（8 分钟）** |

留 10 分钟 buffer 给登录重试 + 网络抖动 → 60 分钟 cron 间隔完全够用。

## 下次复用清单

- [ ] 复用 `get_card_data(page)` / `login_and_open_doc(page)` 函数
- [ ] 复用 `get_color(page, label)` 颜色提取 JS
- [ ] 复用 SPECIFIC route glob 模式（不要 **/*）
- [ ] 复用 CDP Page.captureScreenshot 处理字体等待
- [ ] 复用 networkidle 登录模式（与 TC-001 一致）