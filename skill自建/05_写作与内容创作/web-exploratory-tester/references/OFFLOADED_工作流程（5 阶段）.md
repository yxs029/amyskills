## 工作流程（5 阶段）

### Phase 1: Plan（计划）

**目标：** 拿到目标 URL 后，先做侦察，定出"测什么"。

1. **DNS + HTTP 探活** — 用 `terminal` 跑 `curl -I` 确认站点活着、识别 CDN/WAF
2. **技术栈指纹** — 抓首页 HTML，看 `<title>`、`<meta>`、JS bundle 路径、响应头
3. **自动 sitemap 发现** — 调用 `scripts/sitemap_crawler.py`：
   - 从首页 HTML 抓所有 `<a href>` 链接
   - 从 JS bundle（`_nuxt/*.js`、`/static/*.js`、`/assets/*.js`）用正则抓路由
   - 抓 `robots.txt` 和 `sitemap.xml`（如果有）
   - 输出去重后的路由清单
4. **后端 API 推断** — 抓 JS bundle 找 `/api/...` 路径模板
5. **生成探索计划** — 输出到 `<output_dir>/plan.md`，包含：
   - 目标 URL + 状态
   - 发现的路由清单
   - 推断的 API 清单
   - 时间分配建议（每路由 2-3 分钟）

### Phase 2: Explore（探索）

**目标：** 走遍关键页面，触发所有能触发的功能。

1. **路由遍历** — 对 sitemap 中每个路由：
   - `browser_navigate(url)`
   - `browser_console(clear=true)` — 清空后再观察
   - `browser_snapshot()` — 拿 DOM 结构（**核心，最可靠**）
   - 等待 2-3 秒让 JS 渲染
   - 再次 `browser_console()` — **静默错误最值钱**
   - `browser_vision(question="...", annotate=true)` — 拿标注截图存档
2. **关键交互** — 至少测试：
   - 顶栏所有按钮
   - 搜索/筛选/排序
   - 表单（必填字段、非法输入、空提交、SQL 注入试探）
   - 弹窗/dialog/modal
   - 错误状态（断网、清空数据、删除后操作）
3. **登录态测试** — 如果有"登录"按钮，**点击它看会不会进入登录流程**（Issue #1 类）
4. **登录后功能跳过** — 记录"未登录不可达功能"清单，不强行测
5. **登录按钮 disabled 排查**（如果提供了账号但点不动登录）：
   - 用 JS 查 `document.querySelectorAll('button')` 看哪些按钮有 `is-disabled`/`disabled`
   - 查页面文字是否有"向右滑动解锁"/"拖动滑块"/"verify"等关键词
   - 查 DOM 找 `.verify-move-block`/`.slider-btn`/`.captcha` 等滑块组件
   - 滑块不是 bug，是**前置验证**。参考"关键经验 #6"模板解锁

**关键经验：**
- ✅ **以 DOM snapshot 为准**，vision 仅作截图存档
- ✅ **每次导航后查 console**，静默错误是高价值发现
- ✅ **不要相信 vision 对深色/中文 UI 的描述**（本次教训）

### Phase 3: API Probe（后端探测）

**目标：** 不依赖前端 UI，直接 curl 后端 API，发现安全问题。

调用 `scripts/api_probe.py`，对每个推断出的 API endpoint：

```bash
# 1. 不传任何参数（看鉴权行为）
curl https://target/api/v1/resource

# 2. 传非法参数（XSS 试探）
curl 'https://target/api/v1/resource?q=<script>alert(1)</script>'

# 3. SQL 注入试探
curl "https://target/api/v1/resource?id=1' OR '1'='1"

# 4. 路径穿越
curl 'https://target/api/v1/../v1/resource'

# 5. HTTP 方法测试
curl -X OPTIONS https://target/api/v1/resource -H 'Origin: https://evil.com'
```

输出：
- API 清单（含方法、URL、参数、响应码）
- 鉴权矩阵（哪些要鉴权、哪些不要）
- 错误消息一致性检查
- 信息泄露发现（如 license key、internal domain）

### Phase 4: Collect Evidence（收集证据）— **图多于文是硬性要求**

**目标：** 每个 issue 都要有可重现的证据，**且每个 issue 至少 1 张截图**。

#### 4.1 截图标准流程

发现缺陷后，**按以下顺序抓证据**：

```
1. 📸 全貌截图（必选）
   browser_vision(question="<缺陷描述>", annotate=false)
   → 把 screenshot_path 存到 issue.screenshot

2. 📸 标注截图（强烈推荐）
   browser_vision(question="<缺陷相关元素定位>", annotate=true)
   → 存到 issue.screenshot_annotated

3. 📸 对比截图（可选）
   - 如果有"正常状态"可对比，再截一张作为 issue.screenshot_compare
   - 例如：错误提示 vs 正常提示
```

**每个 issue 的截图清单：**

| 字段 | 用途 | 必选？ |
|---|---|---|
| `screenshot` | 缺陷发生时的页面全貌 | ✅ 必选 |
| `screenshot_annotated` | 标注了问题元素的位置 | ⭐ 强烈推荐 |
| `screenshot_compare` | 与正常状态的对比 | 💡 可选 |

#### 4.2 DOM snapshot 必存

即使是"图多于文"，文字证据也要留底（用 DOM 文本）：
```
issue.dom_snapshot = browser_snapshot()  # 文本证据，机器可读
```

#### 4.3 console 错误收集

调用 `scripts/console_collector.py` 聚合所有 console 输出：
- `Uncaught Error/TypeError` → High
- `404` → Medium
- `deprecation` → Low

#### 4.4 截图归档规范

```
<output_dir>/screenshots/
├── 01-homepage.png                    # Phase 2 流程截图
├── 02-issue-1-empty-dialog.png        # Issue #1 必选
├── 02-issue-1-annotated.png           # Issue #1 标注
├── 03-issue-2-date-string.png         # Issue #2
├── 04-issue-3-spa-fallback.png        # Issue #3
└── ...
```

**命名规则：** `NN-issue-N-<简短描述>.png`
- `NN` 顺序号
- `issue-N` 关联到 issue ID
- `<简短描述>` 英文短横线连接

#### 4.5 反模式（禁止）

- ❌ Issue 没有 screenshot 字段
- ❌ screenshot 路径是相对路径但找不到文件
- ❌ 截图看不清（如全白屏，但 vision 说"看不清"就不写了）
- ❌ 一张截图复用在多个 issue 上（除非是同一问题）

### Phase 5: Categorize & Report（分类 + 报告）

**目标：** 输出可交付的 dogfood 报告。

1. **去重** — 把"同一个 bug 在不同页面"合并为一条
2. **严重性分级** — 套 `references/issue-taxonomy.md` 的 4 级标准
3. **分类** — Functional / Visual / Accessibility / Console / UX / Content
4. **排序** — Critical → High → Medium → Low
5. **渲染报告** — 调用 `scripts/report_renderer.py`，用 `templates/report.md.j2` 生成最终报告

