# 模板变量清单

## 子模块模板（submodule_template.html）

| 变量 | 说明 | 来源 |
|------|------|------|
| `{{MODULE_NAME}}` | 模块名（中文） | test_result.json |
| `{{SYSTEM_NAME}}` | 系统名 | test_result.json |
| `{{TEST_TIME}}` | 执行时间 | test_result.json |
| `{{TEST_URL}}` | 测试URL | test_result.json |
| `{{TEST_USERS}}` | 测试账号 | test_result.json |
| `{{TEST_PERSON}}` | 测试人 | test_result.json |
| `{{PASS_RATE}}` | 通过率 | 计算 stats.pass/stats.total |
| `{{PASS_RATE_COLOR}}` | 进度条颜色 | ≥80绿/50-79橙/<50红 |
| `{{SUMMARY_CARDS}}` | 4列统计卡HTML | render_summary_cards() |
| `{{PRIORITY_STATS}}` | 3列优先级卡HTML | render_priority_stats() |
| `{{CASE_LIST}}` | 用例详情列表 | render_case_section()每用例 |
| `{{DEFECT_TABLE}}` | 缺陷汇总表HTML | render_defect_table() |
| `{{TOTAL_CASES}}` | 总用例数 | stats.total |
| `{{PASSED_CASES}}` | 通过数 | stats.pass |
| `{{FAILED_CASES}}` | 失败数 | stats.fail |
| `{{SKIPPED_CASES}}` | 跳过数 | stats.skip |
| `{{DEFECT_COUNT}}` | 缺陷总数 | len(defects) |

## 全量模板（fullreport_template.html）

| 变量 | 说明 |
|------|------|
| `{{SYSTEM_NAME}}` | 系统名 |
| `{{VERSION}}` | 版本号（如v4.0） |
| `{{MODULE_COUNT}}` | 模块数 |
| `{{CASE_COUNT}}` | 总用例数 |
| `{{PASS_COUNT}}` | 通过数 |
| `{{FAIL_COUNT}}` | 失败数 |
| `{{SKIP_COUNT}}` | 跳过数 |
| `{{PASS_RATE}}` | 通过率（带%号） |
| `{{PASS_RATE_PCT}}` | 通过率（纯数字，给KPI小字） |
| `{{FAIL_RATE_PCT}}` | 失败率（纯数字） |
| `{{SKIP_RATE_PCT}}` | 跳过率（纯数字） |
| `{{P0_PASS}}` | P0通过数 |
| `{{P0_TOTAL}}` | P0总数 |
| `{{P0_RATE}}` | P0通过率 |
| `{{ENGINE}}` | 测试引擎 |
| `{{TEST_DATE}}` | 测试日期 |
| `{{TEST_URL}}` | 测试URL |
| `{{TEST_USERS}}` | 测试账号 |
| `{{TEST_TOOLS}}` | 测试工具链 |
| `{{SCREENSHOT_COUNT}}` | 截图总数 |
| `{{GATE_VERDICT}}` | 门禁判定胶囊文案（含emoji） |
| `{{GATE_VERDICT_TEXT}}` | 门禁判定纯文本（Banner标题用） |
| `{{GATE_REASONS}}` | 门禁未达标原因列表 |
| `{{MOD_TABLE_ROWS}}` | 模块表格所有行HTML |
| `{{DONUT_SVG}}` | 严重度饼图SVG |
| `{{MODULE_CARDS}}` | 所有模块详情卡HTML |
| `{{DEFECT_COUNT}}` | 缺陷总数 |
| `{{P0_DEFECT_COUNT}}` | P0缺陷数 |
| `{{P1_DEFECT_COUNT}}` | P1缺陷数 |
| `{{P2_DEFECT_COUNT}}` | P2缺陷数 |
| `{{INFO_DEFECT_COUNT}}` | INFO缺陷数 |
| `{{P0_DEFECT_PCT}}` | P0缺陷百分比 |
| `{{P1_DEFECT_PCT}}` | P1缺陷百分比 |
| `{{P2_DEFECT_PCT}}` | P2缺陷百分比 |
| `{{INFO_DEFECT_PCT}}` | INFO缺陷百分比 |
| `{{DEFECT_P0_CARDS}}` | P0缺陷卡HTML |
| `{{DEFECT_P1_CARDS}}` | P1缺陷卡HTML |
| `{{DEFECT_OTHER_CARDS}}` | P2/INFO缺陷卡HTML |
| `{{P2_DEFECT_COUNT_INFO_TOTAL}}` | P2+INFO总数 |
| `{{REC_CARDS}}` | 修复建议卡HTML |
| `{{GEN_TIME}}` | 生成时间 |

## 替换规则

所有变量用 `{{NAME}}` 格式，**全文替换**（不用regex）。缺失变量保留原样（不会报错）。
