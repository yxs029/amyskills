---
name: monitored-test-framework
description: 监控子智能体 + DOM双保险自动化测试框架。每个测试步骤同时记录三种证据：(1) 截图，(2) DOM断言返回值，(3) 监控子智能体旁路验证。综合三方证据给出 PASS/WARN/FAIL 三态判定，避免"假阳性"和"假阴性"。当用户说"用监控子智能体"、"双保险测试"、"DOM断言+截图双证据"时使用。
tags: []
related_skills: []
content: |
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。

name: monitored-test-framework
description: 监控子智能体 + DOM双保险自动化测试框架。每个测试步骤同时记录三种证据：(1) 截图，(2) DOM断言返回值，(3) 监控子智能体旁路验证。综合三方证据给出 PASS/WARN/FAIL 三态判定，避免"假阳性"和"假阴性"。当用户说"用监控子智能体"、"双保险测试"、"DOM断言+截图双证据"时使用。
tags: []
related_skills: []
content: |
# 🛡️ 监控子智能体 + DOM 双保险测试框架 v1.9

> 本文件是 P层方法论的索引。完整内容见 references/ 支持文件，以及 v3-v10 历史踩坑沉淀。

## 一、核心架构

**三证据采集**：每个步骤同时记录截图 + DOM断言 + 监控子智能体旁路验证。详见 references/integration-with-other-skills.md。

## 二、关键规则（用户核心偏好 - 不可破坏）

1. **假阳性检测**：`steps<=1` 或 `shots==0` 的 PASS 不可信，必须标记为不可信 PASS 或转为 FAIL
2. **深度步骤**：每个用例 ≥ 3 步，每步必带截图 + DOM 断言返回值
3. **汇报格式：清单体**（①②③ + 加粗短语），**禁止用 Markdown 表格**（老大原话："你用清单体给我吧，不要列表格，列表格我实在看不清楚"）。此规则适用于所有汇报/交付/复盘场景，不是建议而是红线。
4. **场景说明**：补测用例必须先讲"场景是什么"->再讲"步骤"->最后讲"实际发现"
5. **vxe-table vs el-table**：SRMPRO图纸库用 vxe-table，行选择器 `.vxe-body--row`（不是 `.el-table__row`）
6. **术语红线：DOM 不是 BOM**（老大原话："错了，不是BOM，是DOM，DOM，DOM，不是没有BOM"）。截图证据链的三层是：像素层 / DOM层 / 监控层。禁止用"BOM"指代DOM断言数据。
7. **5个1步浅用例 = 真实系统Bug（默认FAIL）** - 1步+异常actual=真Bug保留FAIL；1步+正常actual=假阳性补深
8. **测试模块完成后立即停止cron** - 老大说"停止定时测试吧，这个模块目前测完了"。删除该模块的所有测试cron，只保留系统级cron（内存清理等）。

## 三、5个监督维度（怎么监督测试到底有没有测过）

1. **步骤深度审计**：统计所有用例的steps分布，`steps<=1` 或 `shots==0` 的PASS不可信
2. **截图覆盖率**：截图数/用例数 >= 2.0 为达标；100%用例有截图
3. **DOM断言返回值**：每个步骤必须含具体数值（如"前=10->筛选=10"），不能只说"成功"
4. **进度可见性**：后台进程 + tee日志 + 定时poll；脚本输出到 /tmp/*.log
5. **交叉验证**：普通用户+管理员两个账号跑权限用例，发现菜单权限缺失Bug

## 四、DOM证据链数据结构

截图三证据 = 像素层 + DOM层 + 监控层。每步JSON结构：
```
{
  "step": 1,
  "action": "点击已过期统计卡片",
  "result": "列表行数从 20 -> 10",
  "ok": true,
  "screenshot": "iVBORw0KGgo..."  # base64
}
```

**DOM层建议扩展结构**（待老大确认）：
```
{
  "dom_snapshot": {
    "component": "vxe-table",
    "rows": 20,
    "columns": ["文件名","版本","有效期","操作"],
    "cell_values": [["TI-001.pdf","v1","2026-12-31","查看|更新|归档"]]
  },
  "dom_assertion": {
    "selector": ".vxe-body--row",
    "expected": ">=1",
    "actual": 20
  }
}
```

## 五、完整内容位置

- 完整 P 层方法论：SKILL.md（已归档）
- v10复盘（8个踩坑+5个解决+5个监督+DOM+43个未想到点）：references/srmpro-v10-retrospective.md
- 14个真实 FAIL 案例：references/srmpro-v3-findings.md
- v4 修正（vxe-checkbox/双击行弹版本弹窗）：references/srmpro-v5-dom-findings.md
- v6 最终版（vxe-table/调试脚本/性能Bug）：references/srmpro-v6-findings.md
- v8/v10 最终（vxe-table大坑/3 ERROR根因/APIFox CLI/清单体汇报）：references/srmpro-v9-v10-findings.md
- **v11 接口层冒烟扫描（572 接口 / 21 秒 / SCC 实战）**：references/web-api-smoke-scan.md
- Element UI 交互模式：references/element-ui-interaction-patterns.md
- 与其他 skill 集成：references/integration-with-other-skills.md

## 六、模板与脚本

- 深度步骤测试脚本模板：templates/deep_step_test_template.py
- 框架代码：scripts/monitored_test_framework.py
- 使用示例：scripts/example_usage.py

## 七、v12新增（2026-07-19 v10最终版复盘）

1. **云效批量提单28个缺陷0失败** - 8段模板 + RICHTEXT + base64截图，title格式 `AI提单-{主模块}-{子模块}：{用例}，{操作结果}`
2. **debug_empty_list诊断脚本** - 5秒定位真实表格组件（el-table vs vxe-table）
3. **覆盖率审计标准清单体模板** - 用 `①②③` 列出"已测/未测/未测原因/可补测数量"
4. **APIFox CLI** - 已安装（`npm install -g apifox-cli`），命令体系已学习，待老大给token后可补15个性能场景+9个安全场景
5. **v10全量数据**：128用例/398步/362截图/100通过(78.1%)/P0=53/66(80.3%)/假阳性=0
6. **5个监督维度正式归档** - 步骤深度/截图覆盖/DOM断言返回值/进度可见性/交叉验证
7. **DOM证据链数据结构** - 截图三证据=像素层+DOM层+监控层，扩展dom_snapshot+dom_assertion结构

## 八、v11新增（2026-07-28 接口层冒烟扫描）

**新增"Layer 8 接口层"模式** —— 给 UI 层补的批量冒烟打法。详见 references/web-api-smoke-scan.md。

关键经验三条：

1. **绝对 URL 走不通**：urllib/curl 打 `http://target:48080` 会被防火墙挡，必须用 Playwright **浏览器内 fetch**（走 nginx 反代相对路径）
2. **locale 头必带**：很多 Spring Boot 后端要 `locale: 'zh_CN'`，否则 500 误报为服务端 bug。**扫描前先打一个已知接口确认必需头**
3. **静态提取优于字典爆破**：从 `index.js` 里 grep 出 572 个 API 路径，比字典爆破覆盖率高 10 倍。配套正则：`/["\'`](/admin-api/[a-zA-Z][a-zA-Z0-9_\-/]+)["\'`]/`

SCC 实战数据：572 接口 / 21 秒 / 11 个 500 错误（含内网 IP 泄露）+ 83 个 400 + 2 个慢接口 + 543 个 405/401/未知。

**协作分工**：UI 层做深度单页面 + DOM 断言；接口层做广覆盖。互补关系——UI 找不到后端根因时把可疑 API 拿过来跑接口层扫描；接口层发现 500 后用 UI 层重现业务流程。