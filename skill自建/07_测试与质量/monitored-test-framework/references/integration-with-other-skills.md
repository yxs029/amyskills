# 与其他 Skill 的集成关系

本文件说明 monitored-test-framework 与其他相关 skill 的具体集成点，避免下次使用时重复探索。

## 集成 skill 一览

| Skill | 集成点 | 状态 |
|-------|-------|------|
| **qa/test-report** | 本框架的结果 JSON 可被 `gen_submodule_report.py` 消费 | ✅ 2026-07-17 已验证 |
| **qa/cron-scheduled-test-runner** | 多 batch 跑完后用本框架的结果从日志合并 | ✅ 2026-07-18 已验证 |
| **qa/test-sentinel** | 本框架是"加强版 sentinel"——每步三证据 | ⚠️ 待整合 |
| **qa/locator-healer** | 发现选择器问题后用本框架定位，配合 locator-healer 修复 | ⚠️ 待整合 |

## 集成点详解

### 1. 与 test-report 集成

**输入**：本框架生成的 `{module}_monitored_v3.json`
```json
{
  "stats": {"total": N, "pass": X, "fail": Y, "skip": Z},
  "priorities": {"p0": {"total": ..., "pass": ...}, ...},
  "cases": [{"id": "TC-X-001", "title": "...", "priority": "P0", "status": "PASS", "actual": "...", "steps": [...], "defect": null}, ...],
  "defects": []
}
```

**命令**：
```bash
python3 ~/.hermes/skills/qa/test-report/scripts/gen_submodule_report.py \
  --result {module}_monitored_v3.json \
  --template ~/.hermes/skills/qa/test-report/assets/submodule_template.html \
  --output {module}_测试报告.html
```

⚠️ **坑**：模板路径不是 `templates/` 而是 `assets/`，`--template` 参数要带对路径。详见 test-report 经验#26。

### 2. 与 cron-scheduled-test-runner 集成

**场景**：cron 后台跑 30+ 用例，分 5 个 batch，每 batch 独立 tee 到日志。

**集成点**：cron-scheduled-test-runner 经验#22b 提供了多 batch 合并 SOP，本框架的结果 JSON 是合并的目标文件。

**完整流水线**：
```
cron 后台跑 → 每个 batch 写入 M01_batchN.log → 用 SOP#22b 合并到 M01_results.json
            → 本框架的 MonitoredTestCase 写 evidence.evidence.monitor_verdict 字段
            → test-report 消费合并后的 JSON 生成 HTML
```

⚠️ **坑**：每个 batch 末尾 `json.dump()` 会覆盖前一批数据，必须用 SOP#22b 从日志重新合并。

### 3. 与 test-sentinel 关系

test-sentinel 写测试用例，本框架"加强"了 sentinel——每步三证据采集。如果新任务只需要基础测试用 test-sentinel；如果涉及关键业务流 / 多步骤复合操作 / 防止选择器误判，必须用本框架。

**触发判断**：
- 1-2 步操作 + 不关心误判率 → test-sentinel
- ≥3 步操作 + 关键业务流（上传/删除/支付）→ monitored-test-framework

### 4. 与 locator-healer 关系

本框架的 WARN 状态（DOM 通过但监控异常）是 locator-healer 的输入信号：DOM 返回 false 但选择器设计本应命中。

**完整修复循环**：
```
monitored-test-framework 跑出 WARN
     ↓
查询 monitor_logs/{case_id}_monitor.log 看 DOM 真实值
     ↓
locator-healer 修复选择器
     ↓
单独重跑该 step（不要整个用例）
     ↓
WARN → PASS 才算修复完成
```

## 待办

- [ ] 把本框架的 `MonitoredTestCase` 类抽取为独立 Python 包，让 test-sentinel 可以 `import` 用
- [ ] 与 `yunxiao-defect-submit` 打通：WARN 自动提单
- [ ] 与 `cron-scheduled-test-runner` 共享日志合并 SOP，不要两个 skill 各自重复定义

## 版本历史

| 版本 | 日期 | 主要变化 |
|------|------|---------|
| 1.0 | 2026-07-18 | 初版。定义 MonitoredTestCase 类，10 条踩坑，3 典型实战 |
