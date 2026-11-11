---
name: web-exploratory-tester
description: AI-driven Web 探索性测试工具 - 给一个 URL，自动输出 dogfood 报告。报告支持 3 种格式：单文件 Markdown / 5M 分卷 / Obsidian vault 双链版（每条 issue 一个文件 + `[[双链]]` + 截图实时显示）。当用户说"测一下这个网站"、"跑一遍探索测试"、"帮我 dogfood 一下"、"AI 测 XX 系统"、"做个 Web 端的探索测试"、"放到 Obsidian 看"、"用双链格式出报告"、"每超过 5M 分一个报告"时触发。基于 dogfood skill 方法论升级，封装了 sitemap 自动发现、API 探测、404 检查、控制台收集、报告自动生成。
version: 1.11.0
metadata:
  hermes:
    tags: [qa, testing, web, exploratory, ai-testing, agent, element-ui, vue, e2e, enterprise-sso, cascader, dialog, dropdown, pagination, table-misalign, dialog-discovery]
    related_skills: [dogfood, browser-use, fast-browser-use, nova-act-usability, test-sentinel]
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。


# Web Exploratory Tester — AI 驱动的探索性测试 Agent

## 这是什么

一个 **AI 探索测试的工程化工具**。给一个 Web 应用 URL，AI Agent 自动：
1. 探索页面/路由（自动 sitemap 发现）
2. 测试关键交互（按钮、表单、状态）
3. 探测后端 API（鉴权、错误处理、信息泄露）
4. 收集浏览器控制台错误
5. 输出**结构化 dogfood 报告**——支持 3 种格式：
   - **单文件 Markdown**（默认）
   - **分卷 Markdown**（每 5M 自动 split + INDEX.md 汇总）
   - **Obsidian 双链**（每条 issue 一个文件 + `[[双链]]` + 截图实时显示，可直接进 vault）

## 🎯 核心理念：图多于文

**每个 Issue 必须带截图**——这是硬性要求，不接受只写文字描述。

为什么？
- 用户（产品/老板/客户）不需要懂技术，看图就能理解
- 截图是最强的证据，比任何文字描述都直观
- 一张图胜过一千字描述

**截图标准：**
- ✅ 每个 Issue 至少 1 张、推荐 2-3 张
- ✅ 第 1 张：缺陷发生时的页面全貌
- ✅ 第 2 张（推荐）：标注化的元素位置（`annotate=true`）
- ✅ 第 3 张（推荐）：对比图（如正确状态 vs 错误状态）
- ❌ 拒绝"无图 Issue"（必须先有图才能写 Issue）

## 适用场景

- ✅ **接到一个新网站/SaaS**，想快速摸底质量
- ✅ **上线前 dogfood 自测**（开发/产品/测试都可以用）
- ✅ **第三方系统接入前的尽职调查**（公众号文章下载、爬虫 SaaS 等）
- ✅ **AI 测试架构师 demo**（向团队/客户展示 AI 自动化测试能力）
- ✅ **CI/CD 流水线中的"探索测试"环节**（每次发版后跑一遍）

## 不适用场景

- ❌ 需要登录后才能看到的功能（除非用户提供账号）
- ❌ 性能/压力测试（用 k6 / locust）
- ❌ 跨浏览器兼容性（需要 Selenium Grid）
- ❌ 移动端原生 APP（用 appium / adb）
- ❌ 渗透测试（用专门的 pentest 工具）

## 输入参数

```yaml
target_url: "https://example.com"      # 必填：目标 URL
scope: "full" | "specific_routes"       # full=全站探索；specific=只测指定路由
output_dir: "./dogfood-output"          # 报告输出目录（默认 ./dogfood-output）
depth: 1-3                              # 探索深度（默认 2：首页 + 一层子路由）
include_api_probe: true                 # 是否做后端 API 探测（默认 true）
include_console_check: true             # 是否收集浏览器 console 错误
time_budget_minutes: 15                 # 时间预算（默认 15 分钟）
```

> 📎 该章节已外置：[`references/OFFLOADED_工作流程（5 阶段）.md`](./references/OFFLOADED_工作流程（5 阶段）.md)（better-skill P1-4 引用库离线化）

## 工具调用清单

| Phase | 主要工具 | 关键命令 |
|---|---|---|
| 1. Plan | terminal | `curl -I`, `curl -s` |
| 2. Explore | browser_* | `browser_navigate`, `browser_snapshot`, `browser_console`, `browser_vision` |
| 3. API Probe | terminal | `scripts/api_probe.py` |
| 4. Collect | browser_console, terminal | `scripts/console_collector.py` |
| 5. Report | write_file | `scripts/report_renderer.py` |

## 关键脚本

| 脚本 | 用途 | 调用方式 |
|---|---|---|
| `scripts/sitemap_crawler.py` | 从 HTML/JS bundle 自动抓路由 | `python3 scripts/sitemap_crawler.py <url>` |
| `scripts/api_probe.py` | 批量探测后端 API | `python3 scripts/api_probe.py <url> <endpoint> [method]` |
| `scripts/dead_link_checker.py` | 404 行为探测 | `python3 scripts/dead_link_checker.py <url> <path>` |
| `scripts/console_collector.py` | 收集浏览器 console（agent 内嵌用）| (主要由 agent 通过 browser_console 调用) |
| `scripts/report_renderer.py` | 渲染最终报告（3 种模式）| 见下方"报告输出模式"章节 |

## 报告输出模式（3 种）

`report_renderer.py` 支持 3 种输出模式，按使用场景选：

### 模式 1: 单文件（默认）
```bash
python3 report_renderer.py issues.json report.md
```
- 适合：issue 少（<20）、一次性的报告
- 产出：单个 `.md` 文件

### 模式 2: 分卷（5M/卷）
```bash
python3 report_renderer.py issues.json ./output/ --parted
# 可选：python3 report_renderer.py issues.json ./output/ --parted --max-size 10485760
```
- 适合：issue 多（20+）、报告 > 5M、需要分批查看
- 产出：`report-part1.md` + `report-part2.md` + ... + `INDEX.md`
- 截图用 `MEDIA:path` 引用，**不重复放进报告**（文件保持小）
- 触发场景：用户说"报告太大了，分几个文件" / "每超过 5M 分卷"

### 模式 3: Obsidian 双链 ⭐（个人知识库整合）
```bash
python3 report_renderer.py issues.json /path/to/vault/Reports/2026-06-03_esicint/ \
  --obsidian --screenshots-src ./screenshots/
```
- 适合：用户有 Obsidian vault 知识库，希望报告成为 vault 的一部分
- 产出（在 vault 内）：
  ```
  2026-06-03_esicint/
  ├── INDEX.md                 # 入口（双链到所有 issue）
  ├── Executive-Summary.md     # 执行摘要（严重性/分类统计）
  ├── Issue-01-空dialog登录.md
  ├── Issue-02-2012日期暴露.md
  ├── ...
  ├── screenshots/             # 截图被复制到此，Obsidian 双链才认
  │   ├── 01-issue-1-bug.png
  │   └── ...
  ```
- 关键设计：
  - **每条 issue 独立文件**（方便单独双链到其他笔记）
  - **截图用 `![[filename.png]]` 双链**（Obsidian 实时渲染图片）
  - **issue 之间用 `[[Issue-01-xxx]]` 串联**（支持跳转）
  - **底部有"上一条/下一条"导航**
  - **文件名清理为 ASCII-safe**（中文标题转拼音/slug）
- 触发场景：用户说"报告放到 Obsidian / vault" / "用双链格式" / "在笔记里查看报告" / 提到 `Obsidian` `vault` `双链` `[[ ]]`

### 模式选择决策树
```
报告输出问题
  ├─ 给团队/老板看 (PDF/邮件)        → 单文件
  ├─ issue 很多 (>5M)                → 分卷
  ├─ 用户有 Obsidian / 提到 vault     → Obsidian 双链 ⭐
  └─ 默认                            → 单文件
```

## 输出结构

```
<output_dir>/
├── plan.md                    # Phase 1 产出：测试计划
├── sitemap.md                 # 自动发现的路由
├── api_inventory.md           # 后端 API 清单
├── console.log                # 浏览器 console 错误汇总
├── issues.json                # 结构化 issue 列表
├── report.md                  # 最终 dogfood 报告（人读）
└── screenshots/               # 证据截图
    ├── 01-homepage.png
    ├── 02-empty-dialog-bug.png
    └── ...
```

> 📎 该章节已外置：[`references/OFFLOADED_关键经验（踩坑沉淀）.md`](./references/OFFLOADED_关键经验（踩坑沉淀）.md)（better-skill P1-4 引用库离线化）

> 📎 该章节已外置：[`references/OFFLOADED_关键经验（续 — 跨 session 长任务持续推进模式）.md`](./references/OFFLOADED_关键经验（续 — 跨 session 长任务持续推进模式）.md)（better-skill P1-4 引用库离线化）

## 📊 A001 申请库 4 层深度 进度（1/4 层完成）

### ✅ 已完成
| 层级 | 内容 | 状态 |
|---|---|---|
| L1 列表 | 搜索/翻页/改条数 | ✅ |
| L2 顶部 | 邀请新供应商弹框 | ✅ |
| L3 行操作 | 邀请修改 dropdown | 🔄 |
| L4 链接/dialog | 4 个 dialog 模板 | ⏳ |

### 🐛 新发现 Bug
**Issue #005 [高] 申请库列表列错位**
- 表头 vs 实际内容错位
- 详细: 测试过程数据/01_申请库/v2_4层深度/Issue_005_列错位.md

### 📁 已落库文件
| 路径 | 内容 |
|---|---|
| v2_4层深度/阶段1_登录和菜单结构.md | 滑块 5 步法 + cascader 12 入口 |
| v2_4层深度/Issue_005_列错位.md | 列错位 bug 详细报告 |
| v2_4层深度/screenshots/03-issue-005-column-misalign.png | 截图 |

### ⏭️ 下一步
继续 L3 行操作 + L4 链接 + 剩余 3 个 dialog, 预计还要 1-1.5 小时。
```

**3 段式的核心:**
- ✅ 进度 (已完成/进行中/待办)
- 🐛 问题 (发现的 bug)
- 📁 落库 (写了什么文件)

**别啰嗦:** 不要写 "我现在准备做什么", 老大要看的是**结果**而不是 "我的想法"。

### 26. 标准 4 步收尾流程 (2026-06-03 SRM-PRO 24 子模块实战)

**每个子模块完成后, 严格按 4 步走:**

```bash
# 步骤 1: 写方法论 (4-5K 字节, 含版本/触发条件/陷阱/对比表)
write_file 测测测试方法论/<子模块>/<版本>_xxx.md

# 步骤 2: 写报告 (3-5K 字节, 含范围/用例/Bug 模板/过程数据/方法论索引)
write_file 测试报告/<子模块>/<版本>_xxx.md

# 步骤 3: done 任务
python3 todo_manager.py done A001
# 输出: ✅ F012 已完成: 申请库 4 层深度探索（重跑）

# 步骤 4: 启动下一个 (按 next 编号)
python3 todo_manager.py start N012
# 输出: 🚀 A002 已开始: 资源库 4 层深度探索（重跑）
```

**4 步是原子操作, 不能拆开:** 不允许 "写完方法论但不 done, 先做下一个" — 会导致 fin 状态错位。

**踩坑:** 步骤 1 + 2 是 write_file 2 次, 步骤 3 + 4 是 shell 命令 2 次, **共 4 次工具调用**, 加上前面探索的几十次, 加上后面的几十次, 1 个子模块 = ~80-100 次工具调用 = **单 session 只能做 1 个完整子模块**。

**反模式:** 把 4 步压缩到下个 session 做 = 中断累积, 一旦系统挂了就丢。所以**一定在本 session 内完成 4 步**。

### 27. 中断恢复 5 步速查 (2026-06-03 SRM-PRO 24 子模块实战)

**session 撞上限 / 老大说 "恢复一下" 时, 按 5 步走:**

```bash
# 步骤 1: 看 active 状态
cd ~/aitodolist
cat todo_active.md
# 输出: A002 资源库 4 层深度探索 (进行中, 2026-06-03 20:34 开始)

# 步骤 2: 看 fin 最新
tail -20 todo_fin.md
# 验证上一个任务已 done

# 步骤 3: 看 next 队列
python3 todo_manager.py suggest
# 取第一个未启动的编号

# 步骤 4: 恢复浏览器 session (如果断了)
browser_navigate <业务路由>  # 滑块 + 登录 5 步法

# 步骤 5: 继续 active 任务
# 不重新 start, 直接接着做 active 中那个
```

**绝不能:**
- ❌ 重新 start active 中的任务 (会覆盖进度)
- ❌ 跳过 done 直接做下一个 (fin 错位)
- ❌ 重新做已 done 任务 (浪费时间)

**老大偏好:** 老大说"恢复" = 从 active 拿, 不重头。

### 28. 截图路径管理 (2026-06-03 SRM-PRO 实战踩坑)

**坑 1: vision 工具持续误报"未收到截图"**
- vision 看不到 DOM 渲染内容, 经常说"未附带截图", 但**截图文件已生成**
- 截图路径在 `~/.hermes/cache/screenshots/browser_screenshot_<hash>.png`

**处理方式:**
```bash
# 截图生成后, 立即复制到过程数据目录
cp ~/.hermes/cache/screenshots/browser_screenshot_*.png \
   ~/文档/移动云盘同步盘/.../测试过程数据/.../screenshots/NN-描述.png
```

**命名规范:** `NN-<类型>-<描述>.png`
- `NN` 顺序号
- `<类型>`: `dialog` / `list` / `bug` / `loaded` / `empty`
- `<描述>` 英文短横线连接

**坑 2: vision 生成的截图无法直接被另一个 vision 复用**
- 每次 vision 调用都生成新截图, 但只显示给当前 session
- 跨 session 看截图, 必须复制到过程数据目录

**坑 3: 强制 display: none 后, offsetParent 仍可能为 null**
- DOM 探查 (textContent) OK, 但截图可能看不到
- 解决: 拿 textContent/bodyText 即可, 不强求截图

> 📎 该章节已外置：[`references/OFFLOADED_故障排查.md`](./references/OFFLOADED_故障排查.md)（better-skill P1-4 引用库离线化）

## 与 dogfood skill 的关系

- **dogfood** 是**方法论**（SKILL.md，5 阶段流程）
- **web-exploratory-tester** 是**工程化工具**（脚本 + 模板 + 自动化）
- 两者**互补**：本 skill 调用 dogfood 的思路，但把流程脚本化

> 📎 该章节已外置：[`references/OFFLOADED_版本历史.md`](./references/OFFLOADED_版本历史.md)（better-skill P1-4 引用库离线化）

## 关键经验（续 - 批量子模块探索架构）

### 15. 3 文件夹报告架构 (2026-06-03 SRMPRO 24 子模块实战)

**核心原则:** 探索测试产出按**用途**分 3 类, 落到 3 个独立目录, 命名一一对应。

```
<项目根>/
├── 测测测试方法论/<子模块名>/   # 方法论沉淀 (v1_浅层探索方法论.md, v2_4层深度方法论.md)
├── 测试报告/<子模块名>/         # 报告 + 截图 (v1_浅层探索报告.md, v2_4层深度报告.md)
└── 测试过程数据/<子模块名>/     # 脚本 + 原始数据 + 截图源
    ├── v1_浅层探索/
    └── v2_4层深度/
```

**为什么必须 3 分离:**

| 文件夹 | 用途 | 谁看 |
|---|---|---|
| 测测测试方法论 | 沉淀 trick/经验, 跨项目复用 | AI 自己 (下次遇到类似场景快速 load) |
| 测试报告 | 给老大/团队的 dogfood 报告 | 人 (产品/老板/客户) |
| 测试过程数据 | 原始截图/脚本/日志, 复现证据 | 自己/QA 复现 |

**踩坑 (2026-06-03 SRMPRO):** 之前 `测试报告/2026-06-03_esicint-dogfood/` 是误建空目录, 删了。**约定 > 临时结构**, 一次性建齐 24×3=72 个子目录 (24 个方法论 + 24 个报告 + 24 个过程数据), 后续按需填。

**批量建子目录的 shell 模板 (24 个子模块):**
```bash
cd ~/文档/移动云盘同步盘/10ESIC软件测试/SRMPRO
M=测测测试方法论; R=测试报告; P=测试过程数据/2026-06-03_esicint
for D in 01_申请库 02_资源库 03_信息变更申请单 ... 24_能力矩阵评估结果; do
  mkdir -p "$M/$D" "$R/$D"
done
mkdir -p $P/{19_认证总览,...,24_能力矩阵评估结果}  # 过程数据补漏
```

**命名规范:** `NN_<子模块名>` (2 位序号 + 下划线 + 子模块名), 序号按主菜单顺序排, 便于排序对齐。

### 16. v1/v2 迭代模式 (2026-06-03 SRMPRO 申请库/资源库重跑实战)

**场景:** 第一次跑浅层探索 (1-2 层), 发现问题; 老大要求 4 层深度重跑. **不能直接覆盖 v1 数据** (那是历史基线).

**标准操作:**

```bash
cd 测试过程数据/<项目>/<子模块>/
# 1) 把原 screenshots 移到 v1 子目录
mkdir -p v1_浅层探索 v2_4层深度
mv screenshots/* v1_浅层探索/ 2>/dev/null
rmdir screenshots 2>/dev/null
# 现在结构:
#   v1_浅层探索/  (历史)
#   v2_4层深度/   (本次产出)
```

**v1/v2 报告/方法论的命名:**
```
测测测试方法论/01_申请库/
  ├── v1_浅层探索方法论.md   # 历史 (deprecated 但保留)
  └── v2_4层深度方法论.md    # 当前 (被 fin 引用)
测试报告/01_申请库/
  ├── v1_浅层探索报告.md
  └── v2_4层深度报告.md
```

**方法论文件内的"版本说明"模板:**
```markdown
> 版本: v1 (浅层) | 状态: 已被 v2 4 层深度覆盖 | 保留作为历史基线
```

**为什么这么做:**
- ✅ 老大的"撤销"请求可以 5 分钟回滚 (v1 完整)
- ✅ v1 的 bug 发现 (Issue #001 等) 在 v2 里能快速对照"修了没"
- ✅ AI 自己回顾时, 看 v1 → v2 看到方法论进化轨迹
- ❌ 反模式: 直接覆盖, 1 周后想看"v1 当时发现啥"找不到了

### 17. cascader 子模块截图识别模式 (2026-06-03 SRMPRO 批量 12 子模块)

**场景:** 老大发 6 张 cascader 菜单截图, 问"把这些子模块加到 todo 探索". **怎么批量识别子模块清单?**

**3 个识别规则:**

1. **Panel 数量 = 菜单层级**
   - 1 个 panel = L1 顶导 (供应商/价格/订单/...)
   - 2 个 panel = L2 二级 (供应商主数据/供应商认证/...)
   - 3 个 panel = L3 三级 (申请库/资源库/...) ← **红框所在层**

2. **红框位置 = 末级节点**
   - 红框里的菜单名就是要探索的子模块
   - 一个截图一个红框 = 一次性识别 1 个子模块
   - 老大发了 6 张图 = 6 个 L3 子模块 (本次识别 12 个, 因为 1 张图有 2 个 L3)

3. **L1 (主菜单) 从左侧色块判断**
   - "供应商"色块 vs "价格"色块 = 不同主菜单
   - 多张图来自不同主菜单 = 跨模块批量

**识别结果 (2026-06-03 SRMPRO 6 图 → 12 子模块):**
- 图 1: 供应商→供应商认证→认证总览/征信报告 (2 个)
- 图 2: 供应商→供应商分级管理→分级总览/评级申请单 (2 个)
- 图 3: 供应商→供应商主数据→丰致严选库 (1 个)
- 图 4: 价格→询报价→询价首页/供应商报价首页/询报价统计分析 (3 个)
- 图 5: 价格→BOM分析首页/招投标总览 (2 个)
- 图 6: 价格→项目选点→项目总览/物料总览 (1+1=2 个)
- 总计 12 个, 全部 add 到 next, 编号 N013-N024

**踩坑:** 一开始以为"图 5"只显示 1 个红框 (BOM分析首页), 仔细看 4 个 L2 都有红框 (BOM分析首页/项目选点/招投标总览/框架价格标准库) → 实际 4 个子模块, 但当时只识别 1 个。**教训: 截图里所有视觉上"被框选"的都是目标**.

**给 todo 系统的批量 add 模板:**
```bash
cd ~/aitodolist
for task in "丰致严选库:07_丰致严选库" "询价首页:08_询价首页" ...; do
  title=${task%:*}; dir=${task#*:}
  python3 todo_manager.py add -p 2 "$title 探索测试" \
    -m "供应商→供应商主数据→$title" \
    --path "10ESIC软件测试/SRMPRO/测试过程数据/2026-06-03_esicint/$dir/"
done
```

> 📎 该章节已外置：[`references/OFFLOADED_关键经验（续 — 复杂列表页）.md`](./references/OFFLOADED_关键经验（续 — 复杂列表页）.md)（better-skill P1-4 引用库离线化）

