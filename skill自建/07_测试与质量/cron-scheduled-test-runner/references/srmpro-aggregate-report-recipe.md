# SRMPRO 全量汇总报告 + 缺陷热力图 Dashboard 配方

**适用场景**：8 个模块独立 cron 跑完后，老大要"昨天的全量测试报告，MD 格式" / "缺陷热力图"。
这是 cron-scheduled-test-runner 工作流的**最后一步**——汇总交付。

实战日期：2026-06-17（SRMPRO 文档库 88 用例跑完后）。

---

## 0. 核心原则

### 0.1 数据源优先级
- **JSON 优先**（`*_结果.json` / `test_summary.json` / `modal_results.json`）—— 字段精确
- **HTML 兜底**（`*_测试报告.html`）—— 部分模块没生成 JSON，必须 strip_tags 后 regex 抽数字
- **不要相信 HTML 中正则抽出的数字！** HTML 里 "通过 5 失败 1 总计 6" 这种文本，regex 容易匹配到 "通过率" 字段而抽出错的数（实测：02 报表的 HTML regex 抽出 `通过=30.0%`，但 JSON 里其实是 `passed=3`）。**关键模块至少手工核对一次。**

### 0.2 Schema 不统一是常态
不同模块的 JSON 结构都不一样（这次实测）：

| 模块 | results 形态 | 关键字段 |
|---|---|---|
| 03 筛选区 | `list[dict]` | `total/passed/failed/pass_rate/p0_rate/p0_passed/p0_total` |
| 05 统计卡片 | `dict[case_id → result]` | `status` (pass/fail) |
| 06 弹窗 | `dict[case_id → {status,priority}]` | `status` 是大写 PASS/FAIL |
| 07/08 集成/E2E | `list[dict]` | `module/total/passed/failed/p0/p1/p2/defects/defect_list` |
| 02 报表 | `summary + results: list[dict]` | `tc_id/name/priority/status/steps/defects` |
| 01 / 04 | **无 JSON**，只有 HTML | 必须 strip_tags + regex |

**不要一次写一个通用 parser**——直接 hardcode 8 个模块的数字，配合人工核对一份就够了。后续再迭代。

### 0.3 三种产物，按需输出
- **MD 全量报告** —— 老大要细读/转知识库的（默认产出）
- **HTML 仪表盘** —— 老大要"画一份"/给老板看的（视觉冲击）
- **缺陷清单** —— 给开发的（按模块归类，只列 P0/P1）

老大没明说就先出 MD，主动问要不要 dashboard / 缺陷清单。

---

## 1. MD 全量报告生成器

```python
# scripts/aggregate_report.py
import json, re
from pathlib import Path
from datetime import datetime
from html import unescape

REPORT_DIR = Path("/home/aaronmy/SRMPRO/文档库/report")
OUTPUT = Path("/home/aaronmy/SRMPRO/文档库/SRMPRO文档库_全量测试报告_{YYYYMMDD}.md")

# Step 1: hardcode 8 模块的统计（从 JSON+HTML 手工核对一遍后填）
modules_data = [
    {"no":"01","name":"数据权限控制","total":6,"passed":1,"failed":5,"skipped":0,
     "pass_rate":"16.7%","p0":"1/5 (20.0%)","verdict":"❌ 不通过",
     "defects":[("P0","BUG-PERM-001","汇总未按归属过滤"), ...]},
    # ... 8 个
]

# Step 2: 全局聚合
g_total = sum(m['total'] for m in modules_data)
g_passed = sum(m['passed'] for m in modules_data)
# ...

# Step 3: P0 通过率（从字符串 "1/5 (20.0%)" 抽 1 和 5）
p0_total, p0_pass = 0, 0
for m in modules_data:
    s = m['p0']
    if '/' in s and 'INFO' not in s:
        n, total_str = s.split(' ')[0].split('/')
        p0_pass += int(n); p0_total += int(total_str)

# Step 4: 拼 MD
md = ["# 📋 SRMPRO 文档库 全量自动化测试报告", ""]
md += [f"> 生成时间: {datetime.now():%Y-%m-%d %H:%M}  "]
# ... 见模板
OUTPUT.with_name(OUTPUT.name.format(YYYYMMDD=datetime.now():%Y%m%d')).write_text("\n".join(md), encoding='utf-8')
```

### MD 报告 6 大章节（必含）
1. **总体执行概览** —— KPI 表（总用例/通过/失败/P0通过率/截图数/HTML报告数）
2. **缺陷分级统计** —— P0/P1/P2/INFO 数量 + 占比
3. **发布门禁判定** —— 用 ``` 代码块写"❌ 不通过 — P0 通过率 X%（要求 100%）"
4. **各模块详细发现** —— 每模块一节：执行时间/结果/判定/核心发现/缺陷清单
5. **P0 关键缺陷聚焦** —— 4 大根因板块（影响/现象/推断/证据）
6. **修复建议（按优先级）** + **测试沉淀**（已沉淀的 skill）

### 关键纪律
- **门禁判定醒目放第一屏**——老大首屏就要看到"过没过"
- **跨模块根因关联**——E2E-002 的"三级子公司未识别"和 TC-TREE-005 是同一 bug，必须在报告里串起来说"跨模块影响"
- **不要堆截图清单**——MD 里只列总数和路径，截图本身在 HTML 报告里看
- **修复建议要分 P0/P1/P2 三档**——开发好排期

---

## 2. 缺陷分布热力图 HTML Dashboard

实测产物：`~/SRMPRO/文档库/缺陷分布热力图_dashboard.html`（19KB）+ headless 截图 PNG（500KB）。

### 2.1 模板结构（5 区块）

```
┌─────────────────────────────────────┐
│ Header: 标题 + 测试元信息 + 门禁徽章   │
├─────────────────────────────────────┤
│ KPI Grid (6 卡): 总用例/通过/失败/    │
│   跳过/通过率/P0通过率                │
├──────────────────┬──────────────────┤
│ 热力图矩阵        │ 严重度 Donut 图   │
│ (8 模块 × 4 严重度)│ (P0/P1/P2/INFO)  │
├──────────────────┼──────────────────┤
│ 模块通过率横条    │ P0 关键缺陷卡片   │
│ (8 行排序)       │ (TOP 5)         │
└──────────────────┴──────────────────┘
```

### 2.2 配色规则（关键）

```python
def cell_color(severity, val):
    """热力图单元格配色：值越大颜色越深"""
    if val == 0:
        return "background:#f5f6f8;color:#c0c4cc"  # 浅灰=无缺陷
    if severity == 'P0':  # 红系：1→5 浅到深
        levels = [(1,'#ffd6d6','#cf1322'),(2,'#ff7875','#fff'),
                  (3,'#ff4d4f','#fff'),(4,'#cf1322','#fff'),(5,'#820014','#fff')]
    elif severity == 'P1':  # 橙系
        levels = [(1,'#ffe7ba','#ad4e00'),(2,'#ffc069','#fff'),...]
    elif severity == 'P2':  # 黄系
        levels = [(1,'#fff7e6','#ad6800'),(2,'#ffe58f','#874d00'),...]
    else:  # INFO 蓝系
        levels = [(1,'#e6f7ff','#003a8c'),(2,'#bae7ff','#003a8c'),...]
    for thresh, bg, fg in levels:
        if val <= thresh:
            return f"background:{bg};color:{fg};font-weight:700"
    return f"background:{levels[-1][1]};color:{levels[-1][2]};font-weight:700"

def pass_rate_color(rate):
    if rate >= 80: return "#52c41a"   # 绿
    if rate >= 60: return "#faad14"   # 黄
    if rate >= 40: return "#fa8c16"   # 橙
    return "#f5222d"                   # 红
```

### 2.3 Donut SVG 圆环

不要引入 ECharts/Chart.js（体积大、还要联网）。用纯 SVG 手写：

```python
import math
cx, cy, r = 100, 100, 70
circ = 2 * math.pi * r
offset = 0
svg = f'<svg width="200" height="200" viewBox="0 0 200 200">'
svg += f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#f0f2f5" stroke-width="30"/>'
for label, val, color in segments:  # [('P0',9,'#cf1322'), ...]
    if val == 0: continue
    pct = val / total
    dash = pct * circ; gap = circ - dash
    svg += (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" '
            f'stroke="{color}" stroke-width="30" '
            f'stroke-dasharray="{dash:.2f} {gap:.2f}" '
            f'stroke-dashoffset="{-offset:.2f}"/>')
    offset += dash
svg += '</svg>'
# 注意：<svg> 用 transform: rotate(-90deg) 让起点从顶部开始
```

### 2.4 Header 渐变色 + 卡片左侧色条

```css
body {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
}
.kpi { position:relative; overflow:hidden; }
.kpi::before {
  content:'';position:absolute;left:0;top:0;width:4px;height:100%;
}
.kpi.total::before { background:#1890ff; }   /* 蓝 */
.kpi.passed::before { background:#52c41a; }  /* 绿 */
.kpi.failed::before { background:#f5222d; }  /* 红 */
.kpi.p0::before { background:#cf1322; }      /* 深红 */
```

### 2.5 单元格 hover 放大效果（用户体验加分）

```css
table.heatmap td:hover {
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
  z-index: 2;
  position: relative;
}
```

### 2.6 完整模板放在哪里

完整 HTML 模板 ~700 行（含 CSS 和数据填充逻辑），见生成脚本 `scripts/heatmap_dashboard.py`（如果以后整理）。现在直接参考实战产物：
`~/SRMPRO/文档库/缺陷分布热力图_dashboard.html`

---

## 3. HTML → PNG 截图（飞书展示用）

飞书发 .html 文件用户得下载打开。**先生成 HTML，再用 headless Chrome 截一张 PNG**，两个文件一起发——PNG 用户秒看到，HTML 留给老大想交互查看时双击打开。

```bash
google-chrome --headless --disable-gpu --no-sandbox \
  --window-size=1400,1800 \
  --screenshot=/path/to/output.png \
  file:///absolute/path/to/dashboard.html
```

**实测要点：**
- `--window-size=宽,高`：高度要足够（1800+），否则下半截内容截不到
- `--no-sandbox` 必须（容器/无头环境）
- `file://` 必须用绝对路径
- 大概 500KB-1MB，飞书直接秒发
- 异步图表/字体加载——加 `--virtual-time-budget=5000` 等 5 秒（不一定需要）

```python
# 推荐 wrapper
import subprocess
def html_to_png(html_path, png_path, w=1400, h=1800):
    subprocess.run([
        "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
        f"--window-size={w},{h}",
        f"--screenshot={png_path}",
        f"file://{html_path}"
    ], check=True, timeout=30)
```

---

## 4. 飞书发送顺序（用户体验）

```python
# 1. 先发 PNG（用户秒看预览）
send_message(target="feishu",
             message=f"📊 **缺陷分布热力图仪表盘** 已生成！\n\n**预览图**：\nMEDIA:{png_path}")

# 2. 再发 HTML 源文件（用户想交互时点开）
send_message(target="feishu",
             message=f"📁 **HTML 源文件（可双击打开交互查看）**：\nMEDIA:{html_path}")

# 3. 最后用文字总结要点 + 提供后续选项（不要光发文件就走）
```

**不要把 MD 报告内容直接复制到飞书消息里**——10KB+ 的 MD 在飞书里读体验差，发 MEDIA: 文件让飞书做附件预览。

---

## 5. 主动问后续动作（老大偏好）

报告发完后**总要问一句**："要不要存到 Get 笔记 / 生成缺陷清单单发给开发 / 画 dashboard"。

老大记忆里有"交付问 Get 笔记"——这是他的固定偏好。**不要主动存 Get 笔记，先问**。

---

## 6. 易错点 Checklist

- [ ] **不要相信 HTML regex 抽出的数字**——优先 JSON，HTML 只用作兜底
- [ ] **P0 通过率独立统计**——不能用总通过率代替，门禁要求 P0=100%
- [ ] **跨模块根因关联**——同一 bug 在多个模块表现要在报告里串起来
- [ ] **修复建议分级 P0/P1/P2**——开发好排期，不要一锅炖
- [ ] **HTML→PNG 截图后两个文件都要发**——PNG 给秒看，HTML 给交互
- [ ] **headless chrome window-size 至少 1800 高**——不然下半截被截
- [ ] **报告生成完不要主动存 Get 笔记**——先问老大

---

## 7. 实战产物归档

2026-06-17 SRMPRO 文档库全量汇总：
- 输入：`~/SRMPRO/文档库/report/` 下 8 份 HTML + 6 份 JSON + 327 张截图
- 输出 1：`SRMPRO文档库_全量测试报告_20260617.md`（13 KB / 320 行）
- 输出 2：`缺陷分布热力图_dashboard.html`（19 KB）+ `_preview.png`（500 KB）
- 关键数字：88 用例 / 通过率 64.8% / P0 通过率 47.6% / 9 个 P0 缺陷
- 门禁：❌ 不通过（4 大阻断模块：01/02/04/08）
