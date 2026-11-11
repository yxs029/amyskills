---
name: test-report
description: 测试报告生成 — 子模块 + 全量两层流水线。当需要输出HTML测试报告、汇总模块结果给老板看、做发布门禁报告时使用。生成的报告包含用例详情、截图、缺陷、修复建议。老大的样式偏好是V2深色渐变+白色卡片+6列KPI+发布门禁Banner。全量报告的缺陷数据必须100%从子模块报告自动提取，不手写。
version: 2.7
updated: 2026-07-17
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

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

> 📎 该章节已外置：[`references/OFFLOADED_踩过的坑（避免重犯）.md`](./references/OFFLOADED_踩过的坑（避免重犯）.md)（better-skill P1-4 引用库离线化）

