# Delivery QC reference

在 ZAP 安全测试项目完成扫描/复核/报告后，做交付物检查。42 项检查涵盖：

| 类别 | 检查项 |
|---|---|
| 存在性 | 原始报告5格式、复核triage数据、白话版、正式HTML/PDF、SOP、深度复盘、双三角、原始Session沟通 |
| PDF | 页数8-20、无页码占位符、含关键内容 |
| HTML | 闭合（grep '</html>'）、table 配平、无残留占位 |
| 脱敏 | ZAP 自动导出文件可能含邮箱/JWT，必须过脱敏脚本后进交付目录；正式PDF用pdftotext反查 |
| 关键数字 | 请求数9645、告警数542、扫描页数253、有效11(中5/低6)、误报3/接受8 |
| JSON/XML合法性 | json.load / xml.etree.ElementTree.parse |

## 脚本参考

- `18_delivery_qc.py`：自动化 42 项检查脚本（从 `03-被测网站信息.md` 动态读取口令用于脱敏校验）
- `19_redact_and_fix.py`：对01目录统一脱敏（邮箱→[REDACTED-EMAIL]、JWT→[REDACTED-JWT]、口令→[REDACTED-PASSWORD]）

## 首轮QC典型发现（本次实战）

1. 9个ZAP原始导出含登录邮箱和JWT → 修复后JSON/XML仍合法，PDF反查无泄漏
2. 正式HTML残留 `__PAGES__` 占位 → 按实际页数回填
3. 复盘缺原始告警数542 → 补入对齐

修复后复检全部PASS再交付。