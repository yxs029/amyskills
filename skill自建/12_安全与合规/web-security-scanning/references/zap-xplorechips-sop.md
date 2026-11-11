# xplorechips SOP（沉淀于 2026-09-10 授权实测）

适用于：需要登录后才能看全功能的网站；目标有 WAF/CDN；Linux headless + ZAP daemon；Agent 自动化执行。

## 流程概览

1. 授权与红线（先做）
2. ZAP daemon 启动（仅绑本机）
3. 直连验证登录 → 建 context（含 17 条排除）→ 手工会话注入（HttpStateEnabled → createEmptySession → setSessionTokenValue → setActiveSession）→ 干净 jar 硬验证
4. Spider（必须设 maxDuration=10min）→ 路径模板去重（250-350 代表页）
5. Active Scan（3线程/50ms延迟/90min硬上限/Anti-CSRF）
6. 轻量监控（只轮询 scans，不拉全量 alerts）
7. 扫描后拉明细逐条复核（PII/时间戳/注释/.git 四类优先按 SOP 证伪）
8. 导出 5 格式（过脱敏脚本）→ 正式 HTML/PDF → 白话版 → SOP → QC

## 完整 SOP 文档

见 session 项目 `02-本次执行积累的SOP.md`（v1.1，含熔断红线第 8 章）。

## 踩坑 Checklist

- [x] option 类 API 用 GET，不用 POST
- [x] 建会话用 createEmptySession；写 token 参数 sessionToken/tokenValue；激活传会话名
- [x] context include 用 includeInContext / setContextRegexs（2.17 无 addIncludeRegex）
- [x] Spider 结果视图是 fullResults（非 resultsFull），scan 结果用 results/?scanId=
- [x] Spider 必须设 maxDuration
- [x] option 名不存在会 400，设置要容错
- [x] 扫描中不拉全量 alerts（1.7 万实例会卡死），只轮询 scans 状态
- [x] 重建 context 后要重加 include/exclude，但 httpSession 仍在
- [x] PDF 页码占位需两遍渲染（先算页数→回填源头→再渲染）
- [x] ZAP 导出含邮箱/JWT，交付前必须脱敏
- [x] 编辑既有文件用追加/patch，不用整文件 write_file 覆盖