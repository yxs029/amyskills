# 子模块测试报告 - 登录搜索功能 (test_results.json v1.1 规范)

## 适用场景
- SRMPRO 文档库登录+搜索功能的自动化测试
- 需要生成符合 `SRMPRO/文档库/report/enhanced/*.html` 格式的子模块报告

## test_results.json v1.1 输入格式

```json
{
  "summary": {
    "total": 10,
    "passed": 7,
    "failed": 0,
    "warns": 3,
    "pass_rate": 70.0,
    "p0_pass": 4,
    "p0_total": 5,
    "p1_pass": 3,
    "p1_total": 5,
    "p2_pass": 0,
    "p2_total": 0
  },
  "results": [
    {
      "tc_id": "TC-LOGIN-001",
      "title": "storage_state复用登录",
      "priority": "P0",
      "status": "pass",
      "expected": "URL含/newDocument",
      "actual": "URL=https://test.esicint.com/SupplierManagement/newDocument",
      "steps": [
        {"step_num": 1, "action": "执行测试步骤", "result": "预期: URL含/newDocument", "ok": true},
        {"step_num": 2, "action": "验证实际结果", "result": "URL=https://test.esicint.com/SupplierManagement/newDocument", "ok": true}
      ],
      "screenshots": ["TC-LOGIN-001_step1.png", "TC-LOGIN-001_step2.png"],
      "defect": null
    },
    {
      "tc_id": "TC-SEARCH-002",
      "title": "有效关键词搜索(营业执照)",
      "priority": "P0",
      "status": "warn",
      "expected": "搜到结果",
      "actual": "结果=rows:0",
      "steps": [...],
      "screenshots": [],
      "defect": null
    }
  ]
}
```

## 截图铁律 (v1.1)

❌ 禁止进入页面后立即截图  
✅ 必须等待页面所有控件加载完毕后再截图

### 智能等待策略
1. `wait_for_load_state('networkidle')`
2. `wait_for_selector` 等关键DOM元素
3. DOM稳定检测
4. 额外等待1秒

### 截图白屏检测
- 截图后检查文件大小 < 10KB → 自动标记 ⚠️ 警告
- 小于10KB的截图可能是白屏，需要重试

## 报告生成命令

```bash
python3 scripts/gen_submodule_report.py \
  --result logs/test_results.json \
  --template assets/submodule_template.html \
  --output ../05-S_交付层/HTML报告/SRMPRO登录搜索_测试报告_2026-07-08_70%.html \
  --screenshots-dir screenshots
```

## 优先级颜色映射

| 优先级 | 颜色 | 说明 |
|--------|------|------|
| P0 | #cf1322 (红) | 核心功能，用例 |
| P1 | #fa8c16 (橙) | 重要功能，用例 |
| P2 | #1890ff (蓝) | 一般功能，用例 |

## 状态颜色映射

| 状态 | 颜色 | 说明 |
|------|------|------|
| pass | #52c41a (绿) | 通过 |
| fail | #ff4d4f (红) | 失败 |
| warn | #faad14 (橙) | 警告 |

## 测试范围限定

- 仅测试登录+搜索功能
- 测试账号：admin / testadmin / aarontest
- 测试地址：https://test.esicint.com/SupplierManagement/newDocument

## 报告文件名约定

`{{MODULE_NAME}}_{{TEST_DATE}}_{{PASS_RATE}}%_test_report.html`

示例：`SRMPRO登录搜索_测试报告_2026-07-08_70%.html`