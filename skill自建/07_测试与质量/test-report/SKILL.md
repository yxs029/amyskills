---
name: test-report
description: 测试报告生成 — 子模块 + 全量两层流水线。当需要输出HTML测试报告、汇总模块结果给老板看、做发布门禁报告时使用。生成的报告包含用例详情、截图、缺陷、修复建议。老大的样式偏好是V2深色渐变+白色卡片+6列KPI+发布门禁Banner。全量报告的缺陷数据必须100%从子模块报告自动提取，不手写。
version: 2.7
updated: 2026-07-17
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# 测试报告生成（test-report）

子模块 + 全量两层流水线。先单独跑一个模块的详细报告，再用脚本汇总到全量报告。

**核心架构**：先子模块 → 再全量（避免重复编写缺陷数据）

```
┌─────────────────────────────────────┐
│ gen_submodule_report.py              │  流水线1
│ 输入: 测试结果JSON + 截图           │  单模块 → 子报告
│ 输出: 子模块_测试报告.html          │
└──────────────┬──────────────────────┘
               │ 自动扫描12份
               ▼
┌─────────────────────────────────────┐
│ gen_full_report.py                  │  流水线2
│ 输入: 子模块报告目录                │  全量汇总
│ 输出: 全量测试报告_v{版本}.html     │
└─────────────────────────────────────┘
```

## 老大的样式偏好（重要）

全量报告默认采用 **V2 深色渐变样式**（老大2026-07-07明确指定）：
- 深色渐变背景 `linear-gradient(135deg, #0f2027, #203a43, #2c5364)`
- 白色圆角卡片（`border-radius:12px` + `box-shadow`）
- 顶部Hero带绿→红渐变进度条（按通过率比例）
- 6列KPI仪表盘（总用例/通过/失败/跳过/通过率/P0通过率）
- 红色发布门禁Banner（第一优先级输出）
- 双栏布局（左表右图）：模块表 + 严重度饼图
- 缺陷卡片网格（auto-fill, minmax(420px, 1fr)）

**子模块报告样式**（相对朴素）：白底+浅灰背景，4列统计卡+3列优先级卡+用例详情表（适合打印/邮件）。

## 何时触发

- ✅ 输出单个模块的测试报告（含步骤、截图、缺陷）
- ✅ 多个子模块完成后汇总成全量报告给老板
- ✅ 发布门禁判定（自动算通过率/P0/P1）

## 关键规则

**全量报告的缺陷数据必须从子模块报告自动提取，不要手写**（老大原话："缺陷什么的应该就是各个子模块的HTML报告中的缺陷数据"）。

→ 用 `gen_full_report.py` 自动扫描+提取，**永远不要**在`module_stats.json`或脚本里硬编码缺陷数据。

## Explicit User Standard Requirement（2026-07-08 强制规范）

🛑 **所有 HTML 交付物必须使用 `SRMPRO/文档库/report/enhanced/*.html` 的格式**（用户原话："以后交付用的HTML报告，都用这个文件夹里面的报告格式，这才是让人类能够判断你是不是测试到位的报告格式"）。

**核心契约（每份生成的报告必须编码这 7 个区块）**：
1. **标题区** — 系统/模块/执行时间/账号
2. **4列统计卡片** — 总用例/通过/失败/跳过（带颜色）
3. **3列优先级统计** — P0/P1/P2 通过率（红/橙/蓝）
4. **通过率进度条** — 颜色：≥80%绿 `#52c41a`，50-79%橙 `#faad14`，<50%红 `#ff4d4f`
5. **用例详情** — 每个用例必须有：**测试用例ID+标题**、**详细步骤**（步骤号+动作+结果+状态类）、**实际结果**、**截图画廊**（base64内嵌）、**缺陷框**（仅失败用例）
6. **缺陷汇总表** — 自动提取子模块报告所有缺陷，含严重度（颜色）/描述/实际结果
7. **测试总结** — 通过/警告/失败/截图数量 + 🎯 关键经验

**强制规则**：
- ❌ **绝不在对话里手写模板** — 始终复用 `assets/submodule_template.html` + `scripts/gen_submodule_report.py`
- ❌ 缺任一区块 = 校验失败
- ❌ 截图必须 base64 内嵌，禁止外链 `<img src="file.png">`
- ✅ 缺陷框仅当 `status=fail` 时出现，数据自动从子模块流到缺陷表
- ✅ 报告文件名：`{{MODULE_NAME}}_{{DATE}}_{{PASS_RATE}}%_test_report.html`
- ✅ 触发词："使用这个格式"/"以后交付用的HTML报告"/"子模块测试报告" → 必须调用本 skill

**7040字规范**：每份生成的HTML报告（含代码、标签、变量、注释）总字数必须达到7040字。此规则已在 `gen_report.py` 中实现统计，确保符合老大要求的 "改回原来的7040字"。

详见 `references/enhanced-format-standard.md`（用户强制的7区块规范与每个用例缺陷要求）。
具体 CSS/HTML/JS 代码片段见 `references/enhanced-html-patterns.md`（从参考报告提取的设计模式）。
Playwright 自动化测试脚本模式见 `references/playwright-test-patterns.md`（测试骨架/JS设值/防崩溃/cron-unsafe/多账号权限）。

## 文件结构

```
~/.hermes/skills/qa/test-report/
├── SKILL.md                          ← 本文件（入口）
├── assets/
│   ├── submodule_template.html       ← 子模块模板（带{{变量}}）
│   └── fullreport_template.html      ← 全量模板（V2深色样式）
├── scripts/
│   ├── gen_submodule_report.py       ← 流水线1
│   └── gen_full_report.py            ← 流水线2
└── references/
        │   ├── submodule-spec.md             ← 子模块7区块规范
        │   ├── full-report-spec.md           ← 全量9区块规范
        │   ├── variable-list.md              ← 模板变量清单
        │   ├── checklist.md                  ← 输出前必检项
        │   ├── yunxiao-defect-submission.md  ← 云效缺陷自动提单参考
        │   ├── enhanced-format-standard.md   ← 用户强制的7区块规范与每个用例缺陷要求
        │   ├── enhanced-html-patterns.md     ← 参考报告提取的CSS/HTML/JS代码片段
        │   └── playwright-test-patterns.md    ← Playwright自动化测试脚本模式（骨架/JS设值/防崩溃/cron-unsafe）
└── examples/
    ├── test_result_sample.json       ← 子模块JSON样例（流水线1输入）
    └── module_stats_sample.json      ← 全量JSON样例（流水线2输入，14模块聚合数据）
```

---

## 流水线0：生成复盘报告（retrospective report）

当需要对人机协作测试过程做深度复盘时（不是单纯输出测试结果，而是分析"AI测试方法论是否有效"），可在标准7区块基础上追加分析区块。

**触发词**："复盘报告"/"阶段二总结"/"人机互动分析"/"双三角分析"/"探索期报告"

### 复盘报告 = 7区块 + 3追加区块（短版）或 12区块（长版）

**短版（10区块）** - 适用于单轮测试复盘：
| 区块 | 内容 | 来源 |
|------|------|------|
| 1-7 | 标准enhanced 7区块 | 同子模块报告 |
| 8 | **一堂双三角框架分析** | 人的三角(创造力/审美/体系) × AI的三角(基本功/数据/场景)，各3层(基础/进阶/高阶) |
| 9 | **踩坑总结与改进方向** | 每个坑：现象 + 根因 + 改进措施 |
| 10 | **改进方法论** | 核心结论 + 可执行改进建议 |

**长版（12区块）** - 适用于多轮测试阶段性复盘（2026-07-13 阶段三报告验证，20044字）：
1. 核心结论
2. 两轮测试全景（模块切分对比 + 方法论进化）
3. N模块详情（按通过率分3档深度分析）
4. 缺陷汇总与自动提单
5. 一堂双三角框架（6维度各3层 + 进化路线图）
6. N个典型踩坑详解（含截图对比 + 共性分析）
7. 测试工程流程（OPRASE + SOP + Skill清单）
8. 模型能力对比（GLM-5.1 vs 5.2）
9. 成功沉淀与改进方向
10. 深度思考（AI易错题本 + 不可替代能力 + 行业展望）
11. 项目时间线
12. 交付物清单

> ⚠️ 长版报告必须用**分文件写入策略**（part_01~part_12独立文件 + 拼接脚本），不要用单个f-string。详见踩坑#14。

### 一堂双三角框架说明

- **人的三角**：创造力（实验方向是否大胆）/ 审美（对产出有无判断力）/ 体系（是否给了足够上下文）
- **AI的三角**：基本功（代码/工具能力）/ 数据（收集的信息质量）/ 场景（对业务的理解深度）
- 每个维度评3层：基础❌ / 进阶⚠️ / 高阶✅
- 框架指向**分析对象**（本次测试过程），不是描述"我怎么做的"

> 📌 **量化评分时加载独立 skill `double-triangle-review`**：当老大要求**量化打分**（6维度×27子模块×540分 + SVG雷达图 + 段位判定）而非简单3层定性时，必须加载 `skill_view(name='double-triangle-review')`。该 skill 含 LLM 自动评分脚本（`scripts/auto_assess.py`）、评分提示词（`scripts/eval_prompt.md`）、双报告生成器（`scripts/generate_report.py`），能输出可视化复盘报告 + 场景迭代建议。test-report 的复盘报告区块负责 HTML 格式框架，double-triangle-review 负责 27 子模块的量化打分和数据。

### 复盘报告的"用例"可以是探索发现

传统测试报告的用例 = 测试用例（有pass/fail）。复盘报告的用例 = **探索发现**（如"自动登录与站点接入"/"10大菜单遍历扫描"/"长程任务通宵执行验证"），状态可以是 PASS/FAIL/WARN。

### HTML样式追加

复盘报告在标准7区块CSS基础上，追加：
- `.analysis-section` - 白色卡片容器，内含双三角表格和洞察框
- `.insight-box` - 蓝色背景洞察框（核心结论）
- `.pitfall-box` - 黄色背景踩坑框（现象+根因+改进）
- `.triangle-grid` - 双栏布局（左人的三角，右AI的三角）

### 署名格式

复盘报告页脚必须包含：`署名: Aaron雪松 / 一堂商业起盘大航海 / AI Agent: 测测Hermes`

详见 `references/retrospective-report-format.md`（双三角框架完整说明 + 复盘报告HTML生成要点）

---

## 流水线1：生成子模块报告

### 输入格式（JSON）
```json
{
  "module_name": "筛选区",
  "system_name": "SRMPRO 文档库",
  "test_time": "2026-07-07 16:01:23",
  "test_url": "https://test.esicint.com/SupplierManagement/newDocument",
  "test_users": "admin / testadmin / aarontest",
  "test_person": "测测(自动化)",
  "stats": {"total": 13, "pass": 11, "fail": 2, "skip": 0},
  "priorities": {
    "p0": {"pass": 4, "total": 4},
    "p1": {"pass": 5, "total": 7},
    "p2": {"pass": 2, "total": 2}
  },
  "cases": [
    {
      "id": "TC-SEARCH-001",
      "title": "搜索框基础功能",
      "priority": "P0",
      "status": "PASS",
      "precondition": "用户已登录文档库",
      "actual": "输入'ISO'，列表显示5行匹配结果",
      "defect": null,
      "steps": [
        {"action": "输入'ISO'", "result": "列表显示5行匹配", "ok": true},
        {"action": "清空搜索", "result": "恢复全量数据", "ok": true}
      ],
      "screenshots": [
        {"file": "TC-SEARCH-001_step1.png", "label": "步骤1截图", "description": "输入ISO"}
      ]
    }
  ],
  "defects": [
    {"severity": "P1", "title": "重置按钮未完全恢复状态", "actual": "搜索框值=[质量] 分段器全部选中=False"}
  ]
}
```

### 命令
```bash
python3 scripts/gen_submodule_report.py \
  --result test_results.json \
  --template assets/submodule_template.html \
  --output ~/SRMPRO/文档库/05-S_交付层/HTML报告/筛选区_测试报告.html
```

### 输出包含7个区块
1. 标题区（系统/模块/执行时间/账号）
2. 4列统计卡片
3. 3列优先级统计
4. 通过率进度条
5. 用例详情（每个含步骤+实际结果+截图画廊+缺陷框）
6. 缺陷汇总表
7. 测试总结

**单文件自包含**：所有CSS/JS/截图base64内嵌，可邮件发人

详见 `references/submodule-spec.md`

---

## 流水线2：生成全量报告

### 工作方式
1. **扫描子模块目录**所有 `*_测试报告.html`
2. **自动提取缺陷**（5种格式 + 智能去重）
3. **聚合模块统计**（可通过 `--module-stats` 提供JSON）
4. **套用V2样式模板**（深色渐变 + 白色卡片）

### 命令
```bash
python3 scripts/gen_full_report.py \
  --modules-dir ~/SRMPRO/文档库/05-S_交付层/HTML报告/ \
  --module-stats module_stats.json \
  --output ~/SRMPRO/文档库/05-S_交付层/全量报告/SRMPRO文档库_全量测试报告_v5.html
```

### 输出包含8个区块
1. Hero（标题+版本徽章+元信息条+门禁判定胶囊）
2. KPI仪表盘（6列：总用例/通过/失败/跳过/通过率/P0通过率）
3. 发布门禁Banner（红色醒目区域）
4. 双栏：模块表 + 严重度饼图
5. 模块详情卡（带跳转链接到子模块报告）
6. P0关键缺陷聚焦
7. P1高优缺陷
8. P2/INFO其他缺陷
9. 修复建议

详见 `references/full-report-spec.md`

### 缺陷去重策略
- **按描述前30字符**匹配（去掉标点空格）
- **按tc_id** 匹配
- 已存在则**补充**actual/severity，不重复添加

支持5种缺陷格式：
1. `<table class="defect-table">` — 筛选区/E2E/统计/集成
2. `<div class="defect-box">` — 卡片式
3. `<div class="defect">` — 树形列表/报表下载
4. `class="ch-fail"` 用例 — 数据权限控制
5. `🚨 P0安全缺陷` — 数据权限控制

---

## 关键设计原则

**为什么分两层？**
- 子模块报告 = **完整证据链**（每步截图+缺陷框）→ 给测试人/开发定位问题
- 全量报告 = **决策仪表盘**（门禁/KPI/汇总）→ 给老板做发布决策
- 全量报告的缺陷**100%从子模块报告自动提取**，不重复编写

**为什么用V2样式？**
- 深色渐变背景 + 白色卡片 = 现代Dashboard风格
- 顶部渐变进度条 = 一眼看到整体健康度
- 发布门禁Banner = 第一优先级输出

---

## 流水线3：缺陷提单到云效（可选）

测试报告生成后，可将提取的缺陷自动提交到阿里云云效项目。

**→ 完整提单规范已迁移到独立skill `qa/yunxiao-defect-submit`**

请加载 `skill_view(name='yunxiao-defect-submit')` 获取：
- 标题格式：`AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}`
- 描述8段模板：前置/问题链接/用户账号/供应商账号/步骤/问题/期望/定位
- 截图base64内嵌描述方法
- API调用流程（4步）+ 8个必填字段 + P0/P1/P2映射
- 提单脚本 `scripts/submit_defect.py`（单条/批量/更新）
- 描述模板+JSON格式示例 `references/defect-template-example.md`

---

## 检查清单（输出前必检）

子模块报告：
- [ ] 4个统计卡片数字相加=总用例数
- [ ] 失败用例有 defect-box（含预期vs实际）
- [ ] 每个用例有步骤（步骤号+动作+结果）
- [ ] 每个用例有截图（base64内嵌）
- [ ] 缺陷汇总表与失败用例一一对应
- [ ] HTML单文件可独立打开

全量报告：
- [ ] 6个KPI数字与子模块聚合一致
- [ ] P0缺陷数 = 子模块报告中所有P0之和
- [ ] 12个有独立报告的模块都能跳转
- [ ] 门禁Banner文案与KPI数据一致
- [ ] 严重度饼图百分比之和=100%

详见 `references/checklist.md`

---

## 旧版本

`qa/sub-module-test-report` skill（v1.0）已废弃，其能力合并到此skill。

如果看到旧版引用，请用 `gen_submodule_report.py` + `gen_full_report.py` 替代。

---

## 踩过的坑（避免重犯）

### 1. Chromium 截图路径问题
```bash
# ❌ 这样写 --screenshot 写到 cwd，不是 /tmp/
chromium --headless --screenshot=/tmp/xxx.png file:///tmp/xxx.html
# 实际写入：./xxx.png（当前目录），且 /tmp/xxx.html 因 chromium snap 沙箱无法访问

# ✅ 正确写法：HTML和截图都放家目录
cp /tmp/report.html ~/
chromium --headless --screenshot=/home/aaronmy/xxx.png \
  "file:///home/aaronmy/report.html"
```

### 2. 模板变量名兼容性
老模板用 `{{TOTAL}}` `{{PASS}}` 这种简短名，新脚本用 `{{TOTAL_CASES}}` `{{PASSED_CASES}}` 全名。
`gen_submodule_report.py` 同时支持两种命名（已内置在 substitutions 字典），但**生成新模板时统一用全名**，避免混乱。

### 3. Python 脚本里的拼写错误
写 SVG donut chart 时容易把 `circum` 拼成 `circ` 导致 NameError。检查所有变量引用，统一命名为 `circum`（周长）。

### 4. defect 去重要按描述前30字符匹配 + tc_id 匹配
不能只用其中一种：
- 只用描述 → 统计卡片区6条"测试执行异常"会合并成1条
- 只用 tc_id → defect-table 和 defect-box 两条同缺陷记录会重复

→ `extract_defects()` 已实现双重去重，详见代码。

### 5. 云效API三个关键坑
- **域名**: 用 `openapi-rdc.aliyuncs.com`，不是 `devops.cn-hangzhou.aliyuncs.com`（后者返回404）
- **字段配置API路径**: `/oapi/v1/projex/organizations/{orgId}/projects/{projectId}/workitemTypes/{typeId}/fields` — 路径中间**必须有** `/projects/{projectId}/` 段，否则404
- **assignedTo**: 用 userId（如 `5f30dcae42509b3c32f367e8`），不用邮箱（邮箱返回400）
- **必填字段**: SRMPRO项目配了7个必填自定义字段（功能分类/严重程度/优先级/问题类型/发布环境/问题原因），缺任何一个都返回400
- **字段值格式**: seriousLevel/priority 的值是**选项ID**；功能分类/问题类型/发布环境的值是**选项值文本本身**（因为value=id）

### 6. 不可逆操作需先确认
session中尝试用 `mv` 重命名旧skill时，触发了"重命名/删除需要用户确认"的安全拦截。**应先 read 再 write，慎用 mv/rm**。如果只是废弃+指向新skill，留在原目录加废弃说明更安全。

### 7. 云效更新工作项用PUT不是PATCH
- ❌ `PATCH /oapi/v1/projex/organizations/{orgId}/workitems/{id}` → 404
- ✅ `PUT /oapi/v1/projex/organizations/{orgId}/workitems/{id}` → 204
description会被自动转为RICHTEXT格式。问题原因字段也可通过同一PUT更新。

### 8. 云效附件上传API不可用 → 改用base64内嵌描述
3步流程的新版OpenAPI路径全部404。→ **不要浪费时间尝试附件API**。
替代方案：截图转base64直接嵌入描述HTML的`<img src="data:image/png;base64,...">`标签中，
PUT更新后云效自动存为RICHTEXT格式，网页端打开缺陷即可看到图片（2026-07-08验证通过）。
详见 `skill_view(name='yunxiao-defect-submit')`。

### 9. 缺陷描述必须用老大的模板格式
老大2026-07-08指定了缺陷描述模板，已迁移到独立skill `qa/yunxiao-defect-submit`。
标题格式：`AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}`
描述8段模板：前置/问题链接/用户账号/供应商账号/步骤/问题/期望/定位。
截图用base64内嵌描述HTML中。详见 `skill_view(name='yunxiao-defect-submit')`。

### 10. 截图白屏检测和标注（2026-07-08 实战）
生成 HTML 报告时，对 <10KB 的截图自动标注 `blank-shot` class（橙色虚线边框 + "⚠️可能空白"文字），让读者一眼区分有效截图和白屏截图。不要删除白屏截图--它们仍有诊断价值（证明页面在那个时间点没渲染完）。

### 11. 子模块报告可直接从 test_results.json 内联生成（无需模板脚本）
当测试脚本已输出标准 `test_results.json`（含 summary + results 数组），可直接用 Python 内联生成 HTML 报告，不必走 `gen_submodule_report.py` 模板流程。关键步骤：读 JSON -> 遍历 results -> 截图转 base64 内嵌 -> 7 区块结构（标题/统计卡/优先级/通过率/用例详情可折叠/缺陷表/总结）-> 灯箱交互全内联 -> 单文件 HTML（3-4MB）。适合一次性测试报告；模板脚本适合批量多模块流水线。

### 12. 复盘报告 = 7区块 + 双三角分析 + 踩坑总结（2026-07-13 实战）
当老大说"用上面的格式和方法论继续做总结"时，意味着用已认可的 enhanced 7区块 HTML 格式 + 一堂双三角框架做复盘报告。复盘报告的"用例"可以是探索发现（如"自动登录"/"菜单遍历"/"长程任务验证"），状态可以是 PASS/FAIL/WARN。在标准7区块后追加：双三角分析区块 + 踩坑总结区块 + 改进方法论区块。详见 `references/retrospective-report-format.md`。

### 13. AI测试方法论：零上下文盲测 = 浅薄产出（2026-07-13 核心教训）
**"大而泛"比"小而深"更危险**。全量跑45个页面生成1376条用例，但全是"验证点击效果和状态变更"模板，等于没有测试。相比之下只测2个功能（登录+搜索）但有详细步骤+截图+预期对比的报告质量远高。正确方法：给详细上下文（需求/用例/字段说明）+ 模块范围足够小 + 明确产出标准 + Hermes长程执行能力。

### 14. 大篇幅HTML报告的分文件写入策略（2026-07-13 实战验证）
当生成 **10000字以上的HTML报告** 时，**不要**把整个HTML塞进一个Python f-string。中文字符变量 + 正则反斜杠 + 嵌套引号会导致 `SyntaxError: f-string expression part cannot include a backslash` 和 `NameError` 等问题，极难调试。

**正确策略 — 分文件写入 + 拼接**：
1. 将CSS写入 `/tmp/report_css.txt`
2. 将HTML按区块拆分为 `part_01.html` ~ `part_10.html`（每个用 `write_file` 独立写入）
3. 写一个 Python 拼接脚本读取所有 part 文件 + CSS，拼成最终 HTML
4. 字符串拼接用 `+` 或 `"".join()`，不用 f-string 嵌入大段中文

```python
# 拼接脚本示例
parts = []
for i in range(1, 11):
    with open(f"/tmp/report_parts/part_{i:02d}.html", "r") as f:
        parts.append(f.read())
css = open("/tmp/report_css.txt").read()
html = f"<html><head><style>{css}</style></head><body>{''.join(parts)}</body></html>"
with open("/tmp/final_report.html", "w") as f:
    f.write(html)
```

**适用场景**：复盘报告（20000字+）、阶段总结报告、深度分析报告。普通子模块报告（3-4MB）不需要此策略。

### 15. 渐进式字数扩充技术（2026-07-13 实战）
当老大指定目标字数（如"约20000字"）时，不要试图一次写到位。用渐进式 patch 策略：
1. 第一轮写出全部区块的骨架（约目标字数的50-70%）
2. 统计中文字数：`len(re.findall(r'[\u4e00-\u9fff]', content))`
3. 差额分摊到各 part 文件，用 `patch` 在已有段落中插入分析性内容（不是水话）
4. 每轮扩充后重新统计，直到达标

实战记录：7040 → 14224 → 17089 → 18304 → 19127 → 19677 → 19969 → 20044（6轮扩充）。

### 16. Chrome headless 转 PDF（2026-07-13 实战）
```bash
google-chrome --headless --disable-gpu --no-sandbox \
  --print-to-pdf="/tmp/report.pdf" \
  --print-to-pdf-no-header \
  "file:///tmp/report.html"
```
- ⚠️ SSL handshake 错误可忽略（不影响本地 `file://` 协议渲染）
- ⚠️ 如果 HTML 文件含 base64 截图，PDF 会很大（20000字+4张截图 ≈ 6.3MB）
- ⚠️ `--no-sandbox` 在 root/容器环境必须加

### 17. gen_submodule_report.py 的 JSON key 兼容性（2026-07-17 实战）
测试脚本输出的 JSON 用 `"module"` 作为 key，但 `gen_submodule_report.py` 硬编码读取 `result['module_name']`，导致 `KeyError` 崩溃。
**修复**：脚本已改为 `result.get('module_name') or result.get('module', 'Unknown Module')`。
**教训**：所有 JSON 字段读取必须用 `.get()` 带默认值，永远不要用 `result['key']` 硬编码访问。测试脚本和报告脚本可能由不同的人/不同的 session 编写，key 名不一定一致。

### 18. 截图数据支持两种格式：文件路径 vs 预编码 base64（2026-07-17 实战）
`gen_submodule_report.py` 原来只支持 `{"file": "path/to.png"}` 格式（从磁盘读文件转 base64）。
但实际测试脚本为了方便，经常在 JSON 里直接存 `{"base64": "data:image/png;base64,..."}` 预编码数据。
**修复**：脚本已改为优先检查 `ss.get('base64')`，如果有直接用；否则才走 `image_to_base64(ss['file'])` 文件路径方式。
**教训**：报告生成脚本必须兼容两种截图数据格式--文件路径和预编码 base64。

### 19. Playwright 测试脚本三个高频崩溃点（2026-07-17 实战）
写 Playwright 自动化测试脚本时，以下三个问题反复导致整个测试套件中途崩溃：

1. **`element.fill()` 对不可见元素超时**：SRMPRO 的搜索框在列表展开后可能滚出视口或被遮挡，`fill('text')` 会重试14次然后 TimeoutError。
   - ✅ **解决方案**：用 `page.evaluate()` + JS 直接设值并触发 input 事件：
   ```python
   page.evaluate("""() => {
       const inputs = document.querySelectorAll('input.el-input__inner');
       for (const inp of inputs) {
           if (inp.offsetParent !== null && inp.offsetHeight > 0) {
               inp.value = '搜索词';
               inp.dispatchEvent(new Event('input', {bubbles: true}));
               break;
           }
       }
   }""")
   ```

2. **`element.inner_text(timeout=N)` 不接受 timeout 参数**：Playwright Python 版的 `inner_text()` 方法不支持 `timeout` 关键字参数，传了会直接 TypeError。
   - ✅ **解决方案**：去掉 timeout 参数，用 `element.inner_text()` 或改用 `page.wait_for_timeout()` 前置等待。

3. **单个测试用例异常导致整个模块测试终止**：一个用例的 Playwright 异常会冒泡终止整个测试函数，后续用例全部丢失。
   - ✅ **解决方案**：将测试函数按需求点/功能点拆分为独立小函数，主函数中用 `try/except` 逐个调用：
   ```python
   for name, fn in [("需求点1", test_req1), ("需求点2", test_req2)]:
       try:
           fn(page)
       except Exception as e:
           print(f"❌ {name}异常: {e}")
           traceback.print_exc()
   ```

### 20. cron-unsafe 标记模式：自动化测试中的写操作安全跳过（2026-07-17 实战）
在 cron 自动化测试中，涉及文件上传、数据修改、配置变更、删除等不可逆操作的用例必须自动跳过，否则会污染测试环境数据。
**标记模式**：在 `add_result()` 中将这类用例标记为 `status="skip"`，并在 `defect` 字段中说明跳过原因：
```python
add_result(results, "TC-XXX-001", "上传图纸验证", "P0", "skip",
    [{"step": 1, "action": "上传文件", "result": "SKIP - 涉及文件上传", "ok": True}],
    "涉及文件上传有持久副作用，cron自动跳过",
    [ss], {"severity": "INFO", "title": "此用例需手动执行", "actual": "cron-unsafe操作已跳过"})
```
**分类**：文件上传、数据创建/修改/删除、配置变更、权限修改 = cron-unsafe；列表查看、搜索筛选、权限对比 = cron-safe。

### 21. 共享登录模块 + 批量替换模式（2026-07-17 实战）
9 个测试脚本各自有 broken 的 `smart_login`（简单 fill+click，不处理滑块），全部卡在登录按钮 disabled。解决方案：写一个 `login_helper.py` 共享模块（调用 `robust_login`），所有脚本 `from login_helper import login_admin` 一行搞定。批量替换用正则 `def smart_login\(page.*?\):\n.*?(?=\ndef |\nclass |\n# ===)` 匹配旧函数体，替换为 4 行 import 版本。详见 `srmpro-login` skill 的「共享登录模块」章节。

### 22. 长测试批次执行 + 日志合并（2026-07-17 实战）
38 个用例的模块在有头模式下跑 ~15 个就 EPIPE 崩溃。解法：用 `BATCH_START`/`BATCH_END` 环境变量分批跑（每批 ≤8 个），每批 `tee` 到独立日志文件。但 `save_results()` 每批覆盖 JSON 文件丢失前批数据！必须从日志用正则 `r'\[(PASS|FAIL)\] (TC-\S+) - (.+?): (.+)'` 提取每个用例结果，合并保存到 `_final.json`（不会被后续批次覆盖的文件名）。教训：分批执行时，JSON 保存逻辑必须改为追加或用独立文件名。

### 23. AI 生成测试脚本的 CSS 选择器不可靠（2026-07-17 核心教训）
M04-M10 共 44 个用例全部 FAIL，根因：脚本中的 CSS 选择器（如 `button.upload-btn`、`.drawing-row button.update`、`.document-row a.filename`）是 AI 根据功能描述**猜测**的，不是真实页面 DOM。实际页面用 Element UI 组件，class 名称完全不同。

**判别方法**: 如果一个模块的测试结果**全 FAIL**，且错误信息全是 `Timeout 30000ms exceeded. waiting for locator("button.xxx")`，说明选择器是猜的，不是从真实 DOM 提取的。

**正确方法**:
1. 先用 Playwright 打开页面，`page.content()` 或 `page.query_selector_all('*')` 探索真实 DOM
2. 用浏览器 DevTools 或 `browser_snapshot` 工具获取实际 class 名
3. 或参考已有探索测试的选择器（如 `srmpro-login` skill 的 references 里的选择器清单）
4. M01 之所以 38/38 全 PASS，是因为它用了之前探索测试积累的真实选择器

**反模式**: 直接让 AI「根据功能描述写测试脚本」-> 选择器必猜错 -> 全 FAIL -> 报告没有价值。

### 24. 多模块测试结果 JSON 格式不统一（2026-07-17 实战）
10 个测试脚本输出了 3 种不同 JSON 格式：
- `{"cases": [...], "stats": {...}}` - 标准格式（M01/M02）
- `[{scene_id, result: {pass, message}}]` - 列表格式（M04-M10）
- `{"results": [...]}` - 另一种格式

报告生成脚本 `gen_submodule_report.py` 需要 `.get('cases')` 或 `.get('module_name')` 等字段，格式不匹配会 KeyError。

**解决方案**: 写统一转换脚本，把 3 种格式都转成标准格式（`module_name` + `stats` + `priorities` + `cases` + `defects`），保存为 `M*_standard.json`，再喂给报告生成器。所有字段读取用 `.get()` 带默认值。

### 25. 批量生成子模块报告的完整流水线（2026-07-17 实战验证）
10 个模块的标准 JSON 生成后，批量生成 HTML 子模块报告 + 全量报告的完整流程：

```bash
# 1. 为每个模块生成标准 JSON（统一格式）
# -> M01_standard.json ~ M10_standard.json

# 2. 批量生成 10 份子模块 HTML 报告
for f in M*_standard.json; do
  python gen_submodule_report.py --result $f --template submodule_template.html --output ${f/_standard.json/_测试报告.html}
done

# 3. 生成 module_stats.json（全量报告输入）
# 包含: name, total, pass, fail, skip, p0_pass, p0_total, rate, verdict, cls, finding, time

# 4. 生成全量报告
python gen_full_report.py --modules-dir HTML报告/ --module-stats module_stats.json --output 全量报告.html
```

**验证结果**: 10 份子模块报告 + 1 份全量报告，总计 90 用例 / 42 通过 / 44 失败 / 4 跳过，通过率 46.7%。

### 26. 模板文件路径（2026-07-18 实战修正）
`gen_submodule_report.py` 的 `--template` 参数默认从 `templates/` 目录读，但实际模板在 `assets/submodule_template.html`。两个常见错误：
- ❌ `--template templates/submodule_template.html` → `FileNotFoundError`
- ✅ `--template assets/submodule_template.html`

**根因**: skill 文件结构里 `assets/` 才是模板所在目录，`templates/` 不存在。

### 27. JSON 格式不一致的两个常见 KeyError（2026-07-18 实战）
批量跑 10 个模块时，遇到两个反复出现的 KeyError：

1. **list vs dict**: 测试脚本输出的 JSON 顶层是 `[{scene_id, ...}]`，但生成器读 `result.get('module_name')` → `AttributeError: 'list' object has no attribute 'get'`
2. **priorities 大小写**: 测试脚本输出 `{"P0": {total, pass}}`，但生成器读 `priorities['p0']` → `KeyError: 'p0'`

**修复脚本**:
```python
import json
data = json.load(open(fpath))
if isinstance(data, list):
    # list 转标准 dict
    converted = {
        "module_name": "xxx",
        "stats": {"total": ..., "pass": ..., "fail": ..., "skip": 0},
        "priorities": {"p0": {...}, "p1": {...}, "p2": {...}},  # ⚠️ 小写key
        "cases": [...],
        "defects": []
    }
else:
    # 修复 priorities 大小写
    if "priorities" in data:
        data["priorities"] = {k.lower(): v for k, v in data["priorities"].items()}
```

**核心教训**: 报告生成器的字段读取要有容错，**永远用 `.get('field')`** 带默认值，不要硬编码 key 名和大小写。

### 12. 参考报告的 CSS/HTML 模式必须沉淀为 reference 文件
用户指定的 `SRMPRO/文档库/report/enhanced/*.html` 是格式基准。这些报告中的 CSS 类名、颜色值、HTML 结构、灯箱 JS 逻辑等细节应提取到 `references/enhanced-html-patterns.md`，避免下次生成报告时凭记忆手写样式导致偏差。生成报告时直接从该文件复制 CSS 块，不要自己发明类名或颜色值。

### 28. gen_full_report.py vs gen_submodule_report.py 参数混淆（2026-07-19 实战）
两个脚本的输入参数**完全不同**，极易混淆：

| 脚本 | 必需参数 | 错误用法 |
|------|---------|---------|
| `gen_submodule_report.py` | `--result <json>` `--output <html>` | ❌ `--modules-dir`（不存在） |
| `gen_full_report.py` | `--modules-dir <dir>` `--module-stats <json>` `--output <html>` | ❌ `--result <json>`（报错 `the following arguments are required: --modules-dir`） |

**口诀**：子模块用 `--result`（单个JSON），全量用 `--modules-dir`（子模块HTML目录）+ `--module-stats`（聚合统计JSON）。

**完整全量报告生成流程**：
```bash
# 1. 先生成各子模块HTML（用gen_submodule_report.py --result M01.json --output M01.html）
# 2. 准备module_stats.json（含name/total/pass/fail/skip/p0_pass/p0_total/rate/verdict/cls/finding/time）
# 3. 生成全量：
python gen_full_report.py \
  --modules-dir ~/SRMPRO/.../HTML报告/submodules \
  --template assets/fullreport_template.html \
  --module-stats module_stats.json \
  --output 全量报告.html \
  --system-name "SRMPRO图纸库" --version "v5" \
  --test-date "2026-07-19" --test-url "https://..." \
  --test-users "admin" --engine "Playwright" --tools "深度步骤"
```

### 29. gen_full_report.py 自动扫描子模块HTML失败（2026-07-19 实战）
`gen_full_report.py` 的 `--modules-dir` 参数扫描的是**子模块HTML文件**（用于自动提取缺陷），不是JSON文件。如果目录里只有JSON没有HTML，会输出 `扫描 0 份子模块报告`，且不会生成全量HTML。

**解法**：必须先用 `gen_submodule_report.py` 生成所有子模块HTML，放在同一目录，再用 `gen_full_report.py --modules-dir <该目录>` 扫描。同时用 `--module-stats` 提供聚合统计数据（因为自动提取统计不可靠）。

### 30. module_stats.json 必须包含的完整字段（2026-07-19 实战）
`gen_full_report.py` 读取 `module_stats.json` 时，以下字段缺任何一个都会 KeyError：
- `name` - 模块名（不是 `module`）
- `total` / `pass` / `fail` / `skip` - 用例统计（`skip` 必须有，即使=0）
- `p0_total` / `p0_pass` - P0统计
- `rate` - 通过率百分比
- `verdict` - 优秀/良好/合格/需改进
- `cls` - excellent/good/fair/poor（CSS class）
- `finding` - 失败摘要
- `time` - 测试时间

**完整模板**：
```json
{
  "name": "M01-按图纸展开",
  "total": 40, "pass": 30, "fail": 10, "skip": 0,
  "p0_total": 15, "p0_pass": 12,
  "rate": 75.0, "verdict": "良好", "cls": "good",
  "finding": "已过期筛选无效/列表下载无反应",
  "time": "2026-07-19"
}
```

### 31. 多模块JSON文件版本选择坑（2026-07-19 实战）
一个模块可能有10+个JSON文件（各batch/各版本），自动选最新版本会选错：
- M01有 `M01_v4_final.json`(40用例) 和 `M01_v6_expand.json`(1用例)
- 版本匹配 `v6>v4` 选了v6_expand(1用例)，丢失39个用例

**解法**：手动指定每个模块的最佳文件名，或按用例数选 `max(cases)` 而非 `max(version)`：
```python
mod_files = {
    '01': 'M01_v4_final.json',  # 手动指定
    '07': 'M07_v8_final.json',
}
# 或自动按用例数选
best = max(mod_jsons, key=lambda f: len(json.load(open(f))['cases']))
```

### 32. 术语红线：DOM 不是 BOM（2026-07-19 老大三次强调）
老大原话："错了，不是BOM，是DOM，DOM，DOM，不是没有BOM"
- 截图证据链的三层是：**像素层 / DOM层 / 监控层**
- 禁止用"BOM"指代DOM断言数据（行数/字段值/状态文本）
- JSON schema 中字段名用 `dom_snapshot` 和 `dom_assertion`，不用 `bom`
- 此规则已同步写入 `monitored-test-framework` skill v1.9 第二节关键规则第6条

### 33. 测试模块完成后立即停止cron（2026-07-19 实战）
老大说"停止定时测试吧，这个模块目前测完了"。操作流程：
1. `cronjob action=list` 查看所有cron
2. 识别该模块的所有测试cron（按名称含模块名/系统名筛选）
3. 逐个 `cronjob action=remove job_id=xxx` 删除
4. 保留系统级cron（内存清理/反钓鱼周报等）
5. 13个SRMPRO测试cron全部删除，0误删系统cron

### 34. 清单体汇报格式红线（2026-07-19 再次强化）
老大原话："你用清单体给我吧，不要列表格，列表格我实在看不清楚"
- **所有汇报/交付/复盘场景**必须用清单体（①②③ + 加粗短语）
- **禁止用Markdown表格**，即使数据是表格结构也要转成清单体
- 如必须用表格（如模块统计），要简短且后续用清单解释
- 此规则已写入 `monitored-test-framework` skill v1.9 + memory
