---
name: cron-scheduled-test-runner
description: 将结构化测试执行文档转化为 cron 定时自动化测试任务。读取测试说明文档（含用例表/步骤/预期结果），配置 hermes cron job 按序执行，每步截图，生成 HTML 报告。适用场景：用户给出多份测试执行文档 + 要求定时跑/批量跑。触发词："配置定时测试"、"cron 跑测试"、"把测试任务加到 cron"、"每小时跑一个"、"按文档执行自动化测试"。
version: 1.0.0
metadata:
  hermes:
    tags: [qa, testing, cron, automation, playwright, scheduled, batch-test]
    related_skills: [srmpro-login, web-exploratory-tester, e2e-testing-patterns, playwright-test-generator]
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# Cron-Scheduled Test Runner

将结构化测试执行文档转化为定时自动化测试流水线。

## 适用场景

- 用户给出一组测试执行说明文档（每份 = 1 个模块/区域）
- 要求"每小时/每30分钟执行一个"
- 要求"每步截图 + 输出测试报告"
- 要求"前一个未完成则跳过下一个"

## 工作流程（5 步）

### Step 1: 读取所有执行文档，提取元信息

对每份文档提取：
- 任务 ID / 名称
- 用例编号列表（如 TC-STAT-001, TC-PERM-002）
- 各用例优先级（P0/P1/P2/P3）
- 所需账号角色
- 前置条件
- 关键操作步骤摘要

**用 `delegate_task` 并行读取多份文档**（每3份一组），避免逐个串行耗时。

### Step 2: 确定执行顺序 + 排期

**排序原则（按 README 建议）：**
1. P0 最多的模块优先（安全基线先过）
2. 数据权限 → 报表下载 → 筛选/列表 → 统计卡片 → 详情弹窗 → 集成 → E2E
3. 同优先级按用例数少的先跑（快速验证）

**Cron 间隔：**
- 老大说"每30分钟" = `*/30 * * * *`
- 老大说"每1小时" = `0 HH * * *`（从指定小时开始，逐小时递增）
- 如果老大没指定开始时间，默认从下一整点开始

### Step 3: 配置 Cron Job

每个任务一个 cron job，关键配置：
- `schedule`: 按排期设时间
- `deliver`: origin（结果推回对话）
- `prompt` 内包含：
  - 任务信息（模块名/用例数/优先级/文档路径）
  - 测试地址 + 账号（⚠️ 用实际密码，不要脱敏）
  - 执行要求（读文档→登录→逐用例执行→每步截图→生成HTML报告）
  - 超时保护（单用例10min，整任务55min）
  - 截图命名规范：`TC-XXX_stepN_描述.png`
  - 报告路径：`~/SRMPRO/文档库/report/<模块名>_测试报告.html`

**⚠️ 密码处理：** 在 cron prompt 中直接写明文密码。cron job 运行在隔离 session，不泄露到对话。不要用 `***` 脱敏——会导致子 agent 登不了。

**⚠️ 滑块处理：** prompt 中必须包含"如果无头浏览器无法登录过滑块，改用有头浏览器 headless=False"。

### Step 4: 验证环境

在配 cron 前确认：
- Playwright + Chromium 可用（`python3 -c "from playwright.sync_api import sync_playwright; ..."`)
- 交付目录存在（`mkdir -p ~/SRMPRO/文档库/report`）
- 进度追踪文件初始化（`.task_progress`, `.task_lock`, `.task_current`）

### Step 5: 输出排期表给老大确认

排期表必须包含：
| 序号 | 任务 | 用例数 | 优先级 | 执行时间 | 所需账号 |

老大确认后才正式生效（cron 已创建但排期表让老大校对）。

## 报告生成规范

每个任务完成后输出 HTML 报告，结构：
```html
<h1>{模块名} 测试报告</h1>
<h2>执行摘要</h2>
<table>通过/失败/跳过/P0通过率</table>
<h2>用例详情</h2>
<div class="test-case">
  <h3>TC-XXX 用例名 [P0] ✅/❌</h3>
  <table>步骤|操作|预期|实际|截图</table>
</div>
<h2>缺陷列表</h2>
```

截图用相对路径 `<img src="TC-XXX_stepN_描述.png">`，与报告同目录。

## 进度追踪

- `.task_progress` — 已完成任务列表（`task_id | done | timestamp`）
- `.task_lock` — 运行锁（含 PID + 开始时间，超时1h自动释放）
- `.task_current` — 当前任务信息

**轮次重置：** 8个任务全部完成后，`.task_progress` 重置，开始新一轮。

> 📎 该章节已外置：[`references/OFFLOADED_关键经验.md`](./references/OFFLOADED_关键经验.md)（better-skill P1-4 引用库离线化）

## 重跑失败模块（Re-run Workflow）

首轮跑完后，通常有部分模块失败（环境问题/脚本 bug/真 Bug 混杂）。需要重跑失败模块做对比，区分真 Bug vs 环境噪声。

### 触发时机
- 首轮 8 模块全跑完，老大说"重跑失败的" / "再跑一遍 X 模块"
- 老大说"对比一下首轮和重跑结果"

### 重跑排期策略

**按严重度排序，错峰执行（不是同时跑）：**
1. P0 最多的模块先重跑（最严重的问题优先验证）
2. 用 `cronjob action=update` 设置相对时间偏移（`"25m"`, `"50m"`, `"75m"` ...），每 25 分钟一个
3. 最严重的模块用 `cronjob action=run` 立即触发（不等排期）

```python
# 立即触发最严重的模块
cronjob(action="run", job_id="0d06d382d277")  # 01-数据权限控制

# 其余按 25 分钟间隔排队
cronjob(action="update", job_id="e8645fffaf45", schedule="25m")   # 02-报表下载
cronjob(action="update", job_id="0e6d5b9916df", schedule="50m")   # 08-E2E
cronjob(action="update", job_id="9d601fd857f0", schedule="75m")   # 07-集成测试
cronjob(action="update", job_id="fcc9e89f528d", schedule="100m")  # 04-树形列表区
cronjob(action="update", job_id="bf08c7d8dca8", schedule="125m")  # 06-文档详情弹窗
```

**为什么 25 分钟间隔？** 老大原话接受 25 分钟（不是 1 小时）。重跑比首轮快（只跑失败模块），25 分钟足够上一个任务跑完。首轮用 1 小时间隔是因为模块大、用例多。

### 重跑完成后

1. **恢复原 schedule**：重跑用的相对时间（`25m` 等）是一次性的，跑完后必须用 `cronjob action=update` 恢复为原始 cron 表达式（如 `0 19 * * *`）
2. **汇总对比**：首轮 vs 重跑结果对比表，区分：
   - 首轮 fail → 重跑 pass = 环境/脚本问题（误报）
   - 首轮 fail → 重跑 fail = 真 Bug（确认缺陷）
   - 首轮 pass → 重跑 fail = 回归（需警惕）
3. **更新全量报告**：用重跑结果更新 `SRMPRO文档库_全量测试报告.md`

### 注意事项

- 重跑前**不要修改 cron prompt**——保持与首轮一致，确保对比公平
- 重跑会覆盖 report/ 下的同名 HTML 报告（如果文件名相同），重跑前可备份首轮报告
- 如果重跑结果与首轮差异大，考虑第三轮（但通常两轮足够定性）

## 下次复用配方库

每个被测模块跑完后，应提炼出可复用的执行配方写入 `references/<module>-recipe.md`，包含：
- 真实 DOM 选择器（含反例：哪些看似对实际找不到）
- 真实 API 路径（用 `page.on('request')` 探测后再写 route）
- 已发现缺陷清单
- 成功/失败配方代码片段
- 实测时间预算

已就绪的配方：
- `references/srmpro-html-report-format-spec.md` - **7 区块 HTML 报告格式规范**（2026-07-20，从 srpro-report-format 合并）：7 区块结构、配色规则、缺陷提取纪律、登录选择器
- `references/srmpro-stats-card-recipe.md` - 统计卡片区（2026-06-16）
- `references/srmpro-integration-test-recipe.md` — 集成测试区（2026-06-17）：modal 检测兜底、cron-unsafe SKIP 纪律、多账号 browser 模式
- `references/srmpro-e2e-test-recipe.md` — E2E 端到端测试（2026-06-17）：浏览器下载捕获、数据预检模板、叠加过滤态弹窗 OBSERVATION 纪律
- `references/srmpro-aggregate-report-recipe.md` — **全量汇总报告 + 缺陷热力图 Dashboard**（2026-06-17）：8 模块 JSON+HTML 聚合成 MD 全量报告、SVG 热力图配色规则、headless Chrome HTML→PNG 截图、飞书三连发顺序
- `references/srmpro-v3-batch-recipe.md` — **v3 大批量扩展**（2026-07-07）：14 模块 130 用例 / 109 分钟实战。共享工具模块 test_base.py 模式、6 新脚本统一骨架、runner 硬超时 + kill 机制、异构脚本日志聚合纪律、OPRASE 6 层同步更新（2026-07-07）
- `references/srmpro-html-report-enhancement-recipe.md` — **HTML 报告截图增强**（2026-07-07）：4 种 HTML 格式检测 + base64 内嵌截图 + lightbox 灯箱。96 用例 454 截图关联到 12 份报告。**无截图用例显示灰色备注框**（用户明确要求不留空）

## 报告格式规范（7 区块结构）

生成 SRMPRO 单模块 HTML 报告时必须遵循 7 区块结构：标题区 / 4列统计卡片 / 3列优先级统计 / 通过率进度条 / 用例详情(含截图画廊) / 缺陷汇总表 / 测试总结。

**核心要求**：
- 文件路径：`/home/aaronmy/SRMPRO/文档库/report/enhanced/*.html`
- 登录选择器：`button:has-text("common.logIn")` 而非 `button[type="submit"]`
- 缺陷必须从子模块报告自动提取，不能手动编辑
- 截图 < 10KB 标 `blank-shot` class（橙色虚线边框 + 警告文字）

完整规范见 `references/srmpro-html-report-format-spec.md`。

## 全量汇总环节（cron 跑完之后）

cron 跑完 8 个模块只是中间产物。**最后一步是汇总交付**--老大要的是"昨天的全量报告"，不是 8 份独立报告。

### 触发时机
- 老大说"全量报告 / 总报告 / 汇总报告"
- 老大说"画一份 / dashboard / 热力图 / 可视化"
- 老大说"给开发的缺陷清单"
- cron 8 任务全跑完，主动问要不要出全量报告

### 三种产物按需出
1. **MD 全量报告**（默认）—— 6 章节：概览/严重度/门禁/各模块/P0聚焦/修复建议
2. **HTML 仪表盘 + PNG 预览** —— KPI 卡 / 热力图矩阵 / Donut 圆环 / 通过率横条
3. **缺陷清单**（按模块归类，只列 P0/P1）—— 给开发的

完整模板和易错点见 `references/srmpro-aggregate-report-recipe.md`。

### 关键纪律（SKILL.md 顶层强调）

1. **不要相信 HTML regex 抽数字**——优先 JSON，HTML 只兜底（实测过数字抽错的 case）
2. **P0 通过率独立统计**——发布门禁要求 P0=100%，不能用总通过率代替
3. **HTML→PNG 后两个文件都要发飞书**——PNG 秒看预览，HTML 留给老大交互查看
4. **headless chrome window-size 至少 1800 高**——不然下半截截不到
5. **报告生成完不要主动存 Get 笔记**——先问老大（老大固定偏好）
6. **跨模块根因关联**——同一 bug 在多个模块表现要在报告里串起来说"跨模块影响"

## 故障排查

| 问题 | 解决 |
|---|---|
| `Executable doesn't exist at .../chrome-headless-shell-1223/...` | 用 `executable_path` 指向 `/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome`（见经验#11）|
| `Foreground timeout 3200s exceeds the maximum of 600s` | 改用 `background=True, notify_on_complete=True`（见经验#12）|
| Playwright `ElementHandle.evaluate_handle: SyntaxError: missing ) after argument list` | Python 三引号 + JS 单引号避免转义（见经验#13）|
| Playwright chromium 找不到（其他）| `python3 -m playwright install chromium --with-deps` |
| 滑块过不去 | prompt 中加"改用有头浏览器 headless=False" |
| Cron job 401 登录失败 | 检查 prompt 中密码是否被脱敏为 `***` |
| 截图没保存 | 检查 report 目录权限，确保 `mkdir -p` |
| 报告 HTML 打不开 | 检查图片路径是否是相对路径且图片存在 |
| 内存不足跑不动 Playwright | 先跑 `sync && sudo sysctl -w vm.drop_caches=3` |

## 与其他 Skill 的关系

- **`srmpro-login`**: 本 skill 的 cron job 内部应参考 srmpro-login 的滑块绕过方案
- **`web-exploratory-tester`**: 本 skill 是"按文档执行"，不是"自由探索"——互补而非替代
- **`e2e-testing-patterns`**: E2E 模块的执行可参考其 flaky test 消除经验
- **`verify-slider-bypass`**: 滑块绕不过时参考 5 阶梯回退

## 版本历史

- v1.0.0 (2026-06-16) — 初版。基于 SRMPRO 文档库 8 模块 88 用例 cron 排期实战抽象。
- v1.1.0 (2026-06-17) — 加入经验#23（modal 兜底选择器）、#24（cron-unsafe SKIP 纪律 + INFO 严重度 + [OBS] 标签）、#25（多账号集成测试 browser 模式）。集成测试配方落入 `references/srmpro-integration-test-recipe.md`。
- v1.2.0 (2026-06-17) — 加入经验#26（浏览器下载捕获 accept_downloads + page.on('download')）、#27（测试数据缺失标 skip + INFO 而非 fail）、#28（叠加过滤态下点击节点不响应是 OBSERVATION 不是 P0 失败）。E2E 配方落入 `references/srmpro-e2e-test-recipe.md`。
- v1.3.0 (2026-06-17) — 补全工作流"最后一步": 全量汇总报告 + 缺陷热力图 Dashboard 章节。配方落入 `references/srmpro-aggregate-report-recipe.md`，覆盖 MD 全量报告 6 章节模板、SVG 热力图配色规则、headless Chrome HTML→PNG 截图、飞书 PNG+HTML+总结三连发顺序。SKILL.md 顶层加 6 条汇总纪律。
- v1.4.0 (2026-06-17) — 修正经验#6（cronjob update 可直接改 schedule，不需要删除重建）。新增"重跑失败模块"工作流章节（按严重度排序 + 25 分钟错峰 + cronjob run 立即触发 + 重跑后恢复原 schedule + 首轮 vs 重跑对比策略）。
- v1.5.0 (2026-07-07) — 大规模批量测试（14 模块 130 用例 / 109 分钟）实战新增 4 条关键经验：#29（Playwright 循环体内每步必须 cap 超时 ≤5s + try/except）、#30（Python stdout 通过 tee 重定向会缓冲，进程活着但日志静止，必须 ps/CPU 二判）、#31（runner 必须有 stuck-script kill 机制 + 标记 skip 继续走）、#32（异构脚本结果聚合优先解析执行日志，其次 HTML，JSON 最后）。新增配方 `references/srmpro-v3-batch-recipe.md` 覆盖共享工具模块 + OPRASE 6 层更新模式。
- v1.6.0 (2026-07-07) — 新增经验#33（HTML 报告截图增强：base64 内嵌 + lightbox 灯箱）。4 种 HTML 格式检测与注入策略、CSS vs HTML 误匹配坑、case-id 正则陷阱。新增配方 `references/srmpro-html-report-enhancement-recipe.md`。
