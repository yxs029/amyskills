# 复盘报告格式规范（Retrospective Report Format）

> 2026-07-13 首次使用：SRMPRO全量冒烟测试阶段二复盘报告
> 2026-07-13 升级：阶段三复盘报告扩展为12区块结构（20044字），增加模块对比、深度思考、时间线、交付物区块

## 何时使用

当老大说"用上面的格式和方法论继续做总结"时，说明上一阶段的报告格式（7区块enhanced HTML）+ 分析框架（一堂双三角）已经认可，需要在复盘报告中复用。

**触发词**："复盘报告"/"阶段二总结"/"阶段三报告"/"人机互动分析"/"双三角分析"/"探索期报告"

## 两种复盘报告规格

### 短版（10区块）- 适用单轮测试复盘
标准7区块 + 3追加区块（双三角分析 + 踩坑总结 + 改进方法论）

### 长版（12区块）- 适用多轮测试阶段性复盘（2026-07-13 实战验证）

当复盘覆盖多轮测试（如v1+v2两轮、132用例、461张截图）且老大要求约20000字时，用12区块结构：

| 区块 | 内容 | 来源 |
|------|------|------|
| 1 | 核心结论 | 三轮递进探索总结，3-5个关键数字 |
| 2 | 两轮测试全景 | v1/v2模块切分对比 + 方法论进化 |
| 3 | N模块详情 | 按通过率分3档（≥80%/50-79%/<50%）深度分析 |
| 4 | 缺陷汇总与自动提单 | 缺陷分类统计 + 修复优先级排序 |
| 5 | 一堂双三角框架 | 6维度各3层 + 进化路线图 |
| 6 | N个典型踩坑详解 | 每个坑含截图对比 + 共性分析 |
| 7 | 测试工程流程 | OPRASE + SOP + Skill清单 |
| 8 | 模型能力对比 | GLM-5.1 vs 5.2 + 深层原因分析 |
| 9 | 成功沉淀与改进方向 | 4成功 + 5改进（或类似） |
| 10 | 深度思考 | AI易错题本 + 不可替代能力 + 行业展望 |
| 11 | 项目时间线 | 3个关键转折点 |
| 12 | 交付物清单 | 测试资产总量 + 复用价值评估 |

### 长版报告生成策略 - 分文件写入（重要）

**不要**把20000字的HTML塞进一个Python f-string。用分文件写入+拼接策略：

1. CSS写入 `/tmp/report_css.txt`
2. 每个区块写入 `/tmp/report_parts/part_01.html` ~ `part_12.html`
3. Python脚本读取所有part文件 + CSS，拼接成最终HTML
4. 字数不足时用渐进式patch扩充（见skill踩坑#15）

实战记录（阶段三报告）：
- 初始：7040字 -> 6轮渐进patch -> 20044字 ✅
- HTML大小：917KB（含4张base64截图）
- PDF大小：6.3MB（Chrome headless转换）

### 标准7区块（与子模块报告完全一致）

1. **标题区** - 系统/模块/执行时间/账号/探索模式/模型
2. **4列统计卡片** - 总用例/通过/失败/跳过（警告）
3. **3列优先级统计** - P0/P1/P2 通过率
4. **通过率进度条** - 颜色规则同子模块
5. **用例详情** - 每个用例含步骤+实际结果+截图+缺陷框
6. **缺陷汇总表** - 自动从用例中提取
7. **测试总结** - 通过率/P0/P1/P2/缺陷数/测试结论

### 追加区块8: 一堂双三角框架分析

#### 框架定义

- **人的三角**（测试指挥官维度）：
  - 创造力：实验方向是否大胆、有无创新思路
  - 审美：对产出有无判断力、能否识别"浅薄"
  - 体系：是否给了足够上下文、是否设定了产出标准

- **AI的三角**（执行者维度）：
  - 基本功：代码生成/工具使用/问题排查能力
  - 数据：收集的信息质量和深度
  - 场景：对业务逻辑的理解程度

- 每个维度评3层：基础❌ / 进阶⚠️ / 高阶✅

#### 红线规则（老大2026-06-11确认）

**框架指向分析对象，不是描述自己。** 不要写"我怎么做的"，要写"这次测试过程中人的创造力和AI的基本功表现如何"。

#### HTML结构

```html
<div class="analysis-section">
  <h3>人的三角 × AI的三角 - 人机协作深度复盘</h3>
  <div class="triangle-grid">
    <div class="tri-card">
      <h4>👤 人的三角</h4>
      <table>
        <tr><th>维度</th><th>层级</th><th>表现</th><th>评分</th></tr>
        <tr><td>创造力</td><td>进阶</td><td>...</td><td>✅</td></tr>
        ...
      </table>
    </div>
    <div class="tri-card">
      <h4>🤖 AI的三角</h4>
      <table>...</table>
    </div>
  </div>
  <div class="insight-box">
    <div class="insight-title">💡 核心洞察</div>
    <p>...</p>
  </div>
</div>
```

### 追加区块9: 踩坑总结

每个坑用 `.pitfall-box`（黄色背景）：

```html
<div class="pitfall-box">
  <div class="pitfall-title">坑N: 一句话标题</div>
  <p>现象描述。<b>改进</b>：具体措施。</p>
</div>
```

### 追加区块10: 改进方法论

用 `.insight-box`（蓝色背景），输出核心结论 + 可执行改进建议。

## 复盘报告的"用例"设计

传统测试报告的用例 = 测试用例（有pass/fail）。
复盘报告的用例 = **探索发现**，可以是：

| 用例类型 | 示例 | 状态 |
|----------|------|------|
| 功能验证 | "自动登录与站点接入" | PASS |
| 覆盖度评估 | "10大菜单遍历扫描" | WARN（部分成功） |
| 质量评估 | "45子页面深度遍历" | WARN（用例无业务价值） |
| 失败分析 | "整站URL批量扫描" | FAIL |
| 质量检测 | "截图质量与白屏检测" | WARN |
| 稳定性 | "探索脚本稳定性" | FAIL |
| 能力验证 | "长程任务通宵执行" | PASS |

## CSS追加样式

```css
.analysis-section{background:#fff;border-radius:8px;padding:24px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.analysis-section h3{font-size:18px;margin-bottom:12px;color:#1890ff}
.analysis-section .triangle-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0}
.analysis-section .tri-card{background:#f6f8fa;border-radius:8px;padding:16px}
.analysis-section .tri-card h4{font-size:15px;margin-bottom:10px}
.analysis-section .tri-card table{width:100%;border-collapse:collapse;font-size:13px}
.analysis-section .tri-card th,.analysis-section .tri-card td{border:1px solid #e8e8e8;padding:6px 10px;text-align:left}
.insight-box{background:#e6f7ff;border:1px solid #91d5ff;border-radius:8px;padding:16px;margin:12px 0}
.insight-box .insight-title{font-weight:700;color:#1890ff;margin-bottom:8px}
.pitfall-box{background:#fffbe6;border:1px solid #ffe58f;border-radius:8px;padding:16px;margin:12px 0}
.pitfall-box .pitfall-title{font-weight:700;color:#d48806;margin-bottom:8px}
```

## 署名格式（页脚）

```
报告生成: 测测(Hermes Agent) 自动化测试系统 | {日期} | 模型: {模型名}
署名: Aaron雪松 / 一堂商业起盘大航海 / AI Agent: 测测Hermes
```

## PDF生成

```bash
cp /tmp/report.html ~/ && google-chrome --headless --disable-gpu \
  --print-to-pdf="~/report.pdf" --no-margins \
  "file:///home/aaronmy/report.html"
```

## 关键经验沉淀

### 1. 零上下文盲测 = 浅薄产出
不给业务上下文（需求文档/用例设计/字段说明），AI只能做控件枚举，1376条用例全是"验证点击效果"，等于没有测试。

### 2. "大而泛"比"小而深"更危险
全量跑45个页面看似覆盖广，但每个浅尝辄止。阶段一登录+搜索只测2功能但每个有详细步骤+截图+预期对比，质量远高于1376条模板。

### 3. 长程任务 + 精准上下文 = 最佳组合
Hermes通宵执行能力已验证，但必须配合人工提供的业务上下文。

### 4. SPA路由识别是AI测试常见坑
Element UI侧边栏菜单点击后Vue Router切换组件但URL可能不变，AI脚本误判页面已切换。需要监听路由钩子或等待特定DOM元素。

### 5. 白屏检测不可少
导航后立即截图会导致22%白屏率。必须三层智能等待：networkidle + wait_for_selector + DOM稳定检测 + 额外1秒。

### 6. 人工梳理+WorkBuddy产生详细测试任务说明 -> AI执行（2026-07-13 核心洞察）
不是把PRD直接扔给AI。正确流程：人工梳理业务逻辑 -> 用WorkBuddy/对话产生详细的测试任务执行说明文档（含字段、步骤、预期）-> AI按照说明文档执行。AI负责沟通执行方案+执行，人类负责文档梳理+上下文工程思维。

### 7. GLM模型升级对测试执行能力影响显著（2026-07-13 实测）
GLM-5.1 -> 5.2 升级后，长程任务稳定性、DOM操作精度、滑块绕过成功率均有提升。模型迭代是AI测试能力增长的核心驱动力之一。

### 8. 分文件写入策略解决大篇幅HTML报告的技术瓶颈（2026-07-13 实战）
20000字HTML报告在Python f-string中频繁触发语法错误（反斜杠/嵌套引号/中文字符变量）。分文件写入（part_01~part_12独立文件 + 拼接脚本）彻底解决此问题。详见skill踩坑#14。

### 9. 渐进式字数扩充确保内容质量（2026-07-13 实战）
目标20000字时，先写骨架（7000字）再分6轮patch插入分析性段落。每轮扩充选择信息密度最低的区块插入。不要在单轮试图写完——容易引入水话和语法错误。
