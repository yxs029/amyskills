---
name: sub-module-test-report
description: ⚠️ 已废弃 — 能力已合并到 qa/test-report v2.0+，不要再使用此skill
version: 1.0-deprecated
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 触发时机（必修 P0-1）
当用户提出本技能覆盖的任务、或明确点名本技能时使用；同一意图的不同说法（改述）也应能触发。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# ⚠️ 此 skill 已废弃 (2026-07-07)

能力已合并到 **`qa/test-report`** (v2.0+)。请使用新skill。

**原因**：
- 老skill只覆盖子模块报告（单层）
- 新skill覆盖 子模块+全量 两层流水线
- 新skill用V2样式（老大最爱的深色渐变）

**迁移**：
- `scripts/extract_defects_to_full_report.py` → `~/.hermes/skills/qa/test-report/scripts/gen_full_report.py`
- `template_子模块测试报告模板.html` → `assets/submodule_template.html`（仍可用，但scripts同时支持老变量名）

**调用差异**：
```bash
# 旧（已废弃）
python3 scripts/extract_defects_to_full_report.py

# 新
python3 scripts/gen_full_report.py \
  --modules-dir ~/SRMPRO/文档库/05-S_交付层/HTML报告/ \
  --module-stats module_stats.json \
  --output 全量报告_v5.html
```

如果cron job还引用此skill的旧路径，需要更新到新skill。

---

## 全量报告 V4（V2样式 + 14模块数据）

**脚本位置**：`scripts/gen_v4_full_report.py`

**输出**：`SRMPRO文档库_全量测试报告_v4_{日期}.html`

**核心特性**：采用V2的深色渐变背景 + 白色卡片样式（老大最爱的样式），填入最新14模块数据

**版块结构**（8个区）：
1. **Hero**：标题+版本徽章+副标题+元信息条+门禁判定大徽章
2. **KPI网格**：6个关键指标（总用例/通过/失败/跳过/通过率/P0通过率）
3. **门禁Banner**：红色醒目区域列出未达标原因
4. **双栏（模块表+缺陷饼图）**：14模块执行结果表 + 严重度环形图
5. **模块详情卡**：12个模块详情（带跳转链接）
6. **P0关键缺陷聚焦**：P0缺陷卡片网格
7. **P1高优缺陷**：P1缺陷卡片网格
8. **P2/INFO其他缺陷**：剩余缺陷卡片
9. **修复建议**：按优先级排序的rec卡片

**与V3.1区别**：
- V3.1：完整详情页面（每模块统计+所有用例明细）
- V4：决策导向页面（门禁→KPI→模块→缺陷→建议）

**使用时机**：每月/每周做决策汇报时，V4 是给老板看的总结页
