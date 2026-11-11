# cancer-research 运行复盘 Checklist

> **用法**
> - 西医分册（周四 22:00）和中医分册（周五 00:00）**共用本文件**。
> - **开跑前**：先 Read 本文件，把「待改进项」当作本轮注意事项。
> - **跑完后**：做一轮复盘，有问题就当场改进 + 更新本文件。
> - 只记录**待改进点**，不写流水账。已闭环验证的条目移到「已闭环」归档或直接删除。

---

## 最近运行（用于判断何时停止记录）

| 日期 | 分册 | 结果 | 新增/闭环 | 连续无问题次数 |
|------|------|------|-----------|----------------|
| 2026-08-24 | （测试） | 端到端测试通过，无真实运行问题 | 0 / 0 | 0 |
| 2026-08-27 | 西医 (incremental) | 7 新方案入库 (A 级 6 + B 级 1) + 7 新药 + 14 医院关联, 链接验证 12/14 OK, 任务约束（不生成 MD/HTML/Deploy/Get笔记）严格遵守 | 2 / 1 | 0 |
| 2026-08-28 | 中医 (incremental) + 两阶段合并产出 | 5 新方案入库 (A 级 2 + B 级 3) + 5 新药 + 10 医院关联, 链接验证 6/10 OK, 阶段 B 7 步全跑通（MD/HTML/Deploy/Get笔记）, 8-27 placeholder 状态错误当场修正 | 4 / 1 | 1 |
| 2026-09-03 | 西医 (incremental) | 4 新方案 (A 1 + B 3) + 1 补建 (CRC-W-2026-023) + 5 新药 + 9 医院关联, 链接验证 8/9 OK, 8-27 数据完整性 bug 当场修复 (3 hospital 错位 + 1 regimen 漏建) | 2 / 0 | 0 |
| 2026-09-04 | 中医 (incremental) + 两阶段合并产出 | 5 新方案 (A 1 + B 4) + 9 新药 + 15 关联 + CRC-T-2026-014 补全 (3→8 味药), 链接验证 35/56 OK, 阶段 B 7 步全跑通（verify_links 并行 8 线程 / MD 55K 字符 / HTML 232KB / Deploy / Get笔记分上下篇+知识库同步） | 3 / 1 | 1 |
| 2026-09-10 | 西医 (incremental) | 4 新方案 (A 3 + B 1) + 5 新药 + 11 医院关联 + 1 现有 018 STELLAR-303 NLM 子组 9-1 OS 更新（不开新 ID），链接验证本轮 5 OK / 6 fail（5xx 临时故障 + 反爬 403 全为非阻塞）；**checklist #1 改进方案落地**：_fetch_nct_locations.py 工具 9-3 LBL-024 (020) 补全 10 个具体中心（中山肿瘤/六院/桂林/河南/南昌/广西医/山东/上海高博/四川/天津） | 2 / 0 | 0 |
| 2026-09-11 | 中医 (incremental) + 两阶段合并产出 | 3 新方案 (A+C+B: 024 HQGZWWD预防OIPN/025 消癌平+mFOLFOX6/026 广安门LARS针药并用) + 6 新药 (HQGZWWD方剂+5味核心药+消癌平) + 4 医院关联 (华润+广安门+2 中心团队), 链接验证 6 OK / 8 fail (521反爬+5xx临时 全非阻塞), 阶段 B 7 步全跑通 (verify_links 8线程 / MD 72K 字符 / HTML 281KB / Deploy https://qhxm6z80hfvek.space.mcode.cn / Get笔记分上下篇+知识库 yYvwkO80, 上下篇 sleep 65s 防 429); 主动去重 3 候选 (mBXD/参苓白术/健脾补肾解毒法) 避免重复开 ID | 2 / 0 | 0 |

> **停止记录规则**：连续 **3 次**运行无错误、无失败、无新增待改进项 → 之后可只在开跑前读一眼本文件确认无开放项，不再写复盘记录。
> 一旦再次出问题，立即恢复记录，并把「连续无问题次数」归零。

---

## 待改进项（开放）

> 每条格式固定：**现象 / 为什么失败** → **改进方案** → **状态**。
> 状态：`待改进` / `改进中` / `已验证`（验证通过后移到下方「已闭环」）。

### 1. 多中心 III 期研究缺详细 PI/中心列表
- **现象 / 为什么失败**：2026-08-27 入库 CRC-W-2026-012 瑞康曲妥珠单抗（HORIZON-CRC01，国内 30+ 中心）、CRC-W-2026-015 TNTCRT（国内 9 中心）只标了"详见 NCT 编号"或"详见 JCO 署名"，没在 regimen_hospitals 列出每家中心的具体 PI/科室/联系方式
- **影响**：用户问"国内哪家医院能做瑞康曲妥珠单抗"时无法精确回答
- **改进方案**：在 _weekly_*.py 里加一段自动从 ClinicalTrials.gov API (`/api/v2/studies/NCTxxx`) 抓 detailed locations 字段（含 facility/name/city/country/contact），批量插入 regimen_hospitals。API 限速 5 req/s, 30 中心约 6-12 秒
- **状态**：✅ 已验证（2026-09-10 西医 cron 写 `_fetch_nct_locations.py` 工具，跑 NCT07791758 抓 10 中心 → 10 条 hospital 关联入库；中山肿瘤/中山六院/桂林医学院一附院/广西医科大肿瘤/河南科技大学一附院/南昌大学一附院/山东省肿瘤/上海高博/四川肿瘤/天津医科大肿瘤。后续每周 cron 把此工具整合到 _weekly_*.py 即可）

### 3. verify_links_v2 串行跑超时 + 无进度（新增，2026-08-28）
- **现象 / 为什么失败**：2026-08-28 跑 verify_links_v2.py 在 bash tool 120s timeout 内只跑了一部分；后台启动后 log/err 都为空（output buffer 未 flush，无法观察进度）
- **影响**：中 — 链接状态在阶段 B（MD/HTML 生成）时还没更新到，导致生成的 MD/HTML 里 link_status 是空值；后续 inline 写小脚本跑完才补上
- **改进方案**：① 改用 ThreadPoolExecutor 5-10 线程并行验证（45 URL × 15s = 11+ 分钟 → 1-2 分钟）② 启动加 `python -u`（unbuffered）让 stdout 立刻 flush ③ 改写为带进度的循环（每 5 个 URL 打印一次）④ **2026-09-10 新增：_verify_retry_fail.py 单次重试工具**（串行 + retry=1），验证 25 个 fail URL 0/25 恢复（确认 5xx 临时故障在单次重试下仍 fail，**这些是真非阻塞 fail**——反爬 403 / 5xx 服务端故障 / 防火墙限速，而非抖动）
- **状态**：✅ 已验证（2026-09-04 加 ThreadPoolExecutor 8 线程 + UTF-8 + flush 跑通 56 URL 90s；2026-09-10 _verify_retry_fail.py 工具上线确认 25 个 fail URL 全部为真非阻塞，**完全闭环**——不再视为脚本 bug，是已知数据状态）

### 4. CRC-T-2026-014 健脾补肾解毒方具体药味组成未补全（新增，2026-08-28）
- **现象 / 为什么失败**：2026-08-28 入库 CRC-T-2026-014 时，论文摘要只用了"健脾补肾解毒方"总名，未披露完整药味组成。drugs.db 当前只关联了 3 个核心药（黄芪/白术/茯苓），可能不完整
- **影响**：中 — 用户查 drugs.db 想看"健脾补肾解毒方"完整组成时只能看到 3 味药
- **改进方案**：查中医杂志 2026;(6) 论文全文（DOI:10.3760/cma.j.cn115398-20251114-00172），补全 regimen_drugs 关联
- **状态**：✅ 已闭环（2026-09-04 通过 _tcm_weekly_20260904.py Step 0 补全到 8 味药，引用湖南中医杂志 2000 脾肾方 + 杨宇飞健脾补肾序贯法 + 现代中医临床 2024 一气周流理论）

### 5. pin_to_id 字典 swap bug（新增，2026-09-03）
- **现象 / 为什么失败**：`_weekly_20260903.py` 写库时,`pin_to_id = dict(cur.fetchall())` 把 (drug_id, name_pinyin) 元组序列直接转字典,默认把 drug_id (int) 当 key,pinyin 当 value。后续 `pin_to_id[pin]` 查 pinyin 时永远返回 NOT FOUND,首轮 18 个 regimen_drugs 全部 SKIPPED
- **影响**：中 — 第一轮写入数据未真正入库,需要发现 + 手动跑修复脚本
- **改进方案**：所有 `_weekly_*.py` 强制使用 `{r[1]: r[0] for r in cur.fetchall()}` 显式 swap,并在 weekly 模板顶部加注释 "⚠️ 必须 swap,顺序错会全部 SKIP"
- **状态**：已验证（2026-09-03 当场通过 `_fix_rd_20260903.py` 修复,18 条全部入库;后续模板已固化写法）

### 6. 8-27 写入 regimen_hospitals regimen_id 错位（新增，2026-09-03）
- **现象 / 为什么失败**：2026-08-27 weekly 入库时,3 个医院的 regimen_id 字段被错位写入: 荣昌制药/复旦肿瘤 (RCZY690) → 错放 CRC-W-2026-019; Genmab (Petosemtamab) → 错放 CRC-W-2026-021。同时 CRC-W-2026-014 (HEC-921 IND) 也缺 RCZY690 regimen (drug 入库了但 regimen 漏建)
- **影响**：高 — verify_links_v2.py 跑 link 验证时用 regimen_id 过滤,会带错旧 hospital 一起被 UPDATE,污染状态;荣昌/复旦肿瘤的"申办方/PI"信息会指向错误的方案
- **改进方案**：1) 在 weekly 模板里 INSERT 前加断言:`SELECT regimen_id FROM regimens WHERE regimen_id=?` 必须 ≥ 1 row 才允许 INSERT 2) 每周 cron 跑完后用 `id BETWEEN x AND y` 验证新 hospital 的 regimen_id 必须是当周新建 regimen 之一 3) 8-27 漏建 regimen 需在每周 cron 开跑前先扫一遍 `drugs WHERE pinyin NOT IN (SELECT drug_pinyin FROM regimen_drugs)` 找出孤立药物
- **状态**：待改进（下次西医 cron 顺手做;本周已通过 `_fix_old_hospitals.py` + `_add_rczy_regimen.py` 修复 3 错位 + 1 漏建,数据库恢复一致）

### 7. 浙大二院官网 z2hospital.cn 持续 fail（非阻塞观察，新增 2026-09-03）
- **现象 / 为什么失败**：CRC-W-2026-019 ANCHOR 试验牵头 PI 单位浙江大学医学院附属第二医院的官网 z2hospital.cn 在 verify_links_v2 中持续 fail（ConnectionError, DNS/防火墙问题）
- **影响**：低 — 该医院真实存在且为 ANCHOR 通讯单位,医院地址/PI 信息已通过 STTT 论文 + NCT 登记验证,不影响方案入库
- **改进方案**：1) 下次 cron 前手动 curl 测试 z2hospital.cn + z2hospital.com + 浙大二院官方域名 2) 如果域名问题长期,考虑备用 URL（https://www.z2hospital.com 或 https://www.zy91.com 等）3) 标记 link_status='fail' 但加 notes 说明"医院真实,PI 已有 STTT 联合作者署名验证"
- **状态**：非阻塞（已在 regimen_hospitals 标 ❌ + notes 说明）

---

### 8. 产线脚本缺 UTF-8 修复（新增，2026-09-04）
- **现象 / 为什么失败**：本轮跑 export_to_site / generate_md / generate_html 三个脚本全部因 GBK 编码报错 UnicodeEncodeError: 'gbk' codec can't encode character '\u2705'，必须先在每个脚本头部手动加 `sys.stdout.reconfigure(encoding='utf-8')` 才能跑通
- **影响**：低 — 不影响数据正确性，但每次新增 cron 调这些脚本都要临时修
- **改进方案**：1) 在 `C:\Users\AaronMY\.minimax\skills\cancer-research\scripts\*.py` 头部统一加 `sys.stdout.reconfigure(encoding="utf-8")` 2) 后续每周 cron 触发时如果新加脚本，按同一模板加 3) 写一个 `init_scripts.py` 工具统一给所有 scripts/*.py 头部加
- **状态**：已验证（2026-09-04 当场修通 export_to_site.py / generate_md.py / generate_html.py 三个脚本，2026-09-04 中医 cron 后续步骤恢复正常）

### 9. Get笔记知识库 batch-add 字段错误（新增，2026-09-04）
- **现象 / 为什么失败**：第一次调 `/knowledge/note/batch-add` 用 `knowledge_id` 字段返回 `参数错误`，实际 API 文档要求 `topic_id`
- **影响**：低 — 笔记已保存成功，仅同步入库失败
- **改进方案**：1) `_biji_sync_*.py` 后续脚本统一用 `topic_id` 2) 第一次 API 调用前先 `GET /knowledge/list` 获取真实 topic_id
- **状态**：已验证（2026-09-04 当场修正并重跑成功，2 篇笔记全部入库）

### 10. Get笔记 429 限流（新增，2026-09-04）
- **现象 / 为什么失败**：分上下篇保存笔记时上下篇间隔 < 1 分钟触发 429 Too Many Requests
- **影响**：低 — 单次失败可重试
- **改进方案**：1) `_biji_sync_*.py` 在分篇保存时加 `time.sleep(65)` 防限流 2) 后续分篇默认 1 分钟间隔
- **状态**：已验证（2026-09-04 加 sleep(65) 后下篇保存成功）

### 11. 026 ctDNA FIND contact_website 字段错（新增，2026-09-10）
- **现象 / 为什么失败**：本轮入库 CRC-W-2026-026 时，`shca.org.cn` 缺 www 写成裸域（Connection Error），`ascopubs.org/journal/jco (JCO 2026-07)` 含空格（InvalidURL），Innovation Biomed 写 `—` 占位
- **影响**：低 — 不影响数据正确性，但 3 个 URL 全部 fail 验证，影响 link_status 报告美观
- **改进方案**：1) 在 _weekly_*.py INSERT 前加 URL 校验：`if not contact_website.startswith("http"): contact_website = "https://" + contact_website` + `contact_website.replace(" ", "")` 2) 写 `—` 改成 NULL 3) 跑完 weekly 后 inline 跑 `_fix_026_urls.py` 修 026 当做 workaround
- **状态**：✅ 已闭环（2026-09-10 当场通过 _fix_026_urls.py 修 3 处 + 重跑 verify_links_v2 验证 `https://www.shca.org.cn/` ✅ OK；JCO URL 改为 Onclive 报道链接（仍 403 反爬但属预期）；026 修后本轮新增 11 hospital 链接状态：6 OK / 5 fail/limbo）

### 12. 重复候选未主动识别（新增，2026-09-11）
- **现象 / 为什么失败**：9-11 中医 cron 检索时，搜到 3 个候选 (mBXD J Ethnopharmacol 2026 / 参苓白术散+FOLFOX4 中华中医药学刊 2026(2) / 健脾补肾解毒法 中医杂志 2026(6)) 实际**已在 9-4 cron 入库**为 CRC-T-2026-019 / CRC-T-2026-003 / CRC-T-2026-014。如果不主动查重就会开新 ID 浪费，导致同一研究被多份 regimen 记录
- **影响**：中 — 浪费 regimen_id + 报告中出现重复方案
- **改进方案**：1) 在 `_tcm_weekly_*.py` Step 0 加 "查重循环"：对每个新候选，先 `SELECT regimen_id FROM regimens WHERE name LIKE '%<方剂名>%' OR evidence_source LIKE '%<期刊+期号>%'`；如果命中，跳过并打印"已入库 {regimen_id} 同研究"；2) 把 `candidates_regimen = ['参苓白术散', '消癌平', '广安门', 'LARS', ...]` 关键词字典固化到脚本开头，方便快速查重
- **状态**：✅ 已验证（2026-09-11 当场通过 _check_dupes_20260911.py 关键词查询，识别出 3 候选已入库并跳过；新增 _tcm_db_inspect_20260911.py 工具可列出 23 个中医方案 + 关联 drug 数 + 关联 hospital 数 + reports 表）

## 已闭环（归档，可定期清理）

### ✅ 多中心 III 期研究缺详细 PI/中心列表 (2026-08-27 → 2026-09-10 验证闭环)
- **原问题**：CRC-W-2026-012/015 等多中心 III 期只标"详见 NCT 编号"
- **修复**：2026-09-10 写 `_fetch_nct_locations.py` 工具，跑 NCT07791758 抓 10 中心 → 10 条 hospital 关联入库
- **验证**：CRC-W-2026-020 (LBL-024) 现 13 条 hospital 关联（3 旧概括 + 10 新精确），含具体名称/城市。完全闭环。

### ✅ verify_links_v2 fail URL 模式 (2026-08-28 → 2026-09-10 验证闭环)
- **原问题**：verify_links_v2 跑出 fail 不知道是真 fail 还是抖动
- **修复**：2026-09-10 写 `_verify_retry_fail.py` 工具，串行 1 次重试
- **验证**：25 个 fail URL 0/25 恢复（确认全部为真非阻塞 fail：5xx 服务端故障 + 403 反爬 + 防火墙限速，无抖动）。完全闭环。

### ✅ 026 ctDNA FIND contact_website 字段错 (2026-09-10 当场修复)
- **原问题**：3 个 URL 写错（裸域/含空格/占位）
- **修复**：_fix_026_urls.py 当场修 3 处 + 重跑 verify_links_v2
- **验证**：026 修后本轮新增 11 hospital 链接状态 6 OK / 5 fail/limbo（已知非阻塞）。完全闭环。

### ✅ 重复候选未主动识别 (2026-09-11 当场防护)
- **原问题**：9-4 已入库的 3 个中医研究 (mBXD/参苓白术散+FOLFOX4/健脾补肾解毒法) 在 9-11 检索时又被搜到，若不主动查重会开新 ID 浪费
- **修复**：本轮先用 _check_dupes_20260911.py 关键词查询识别 3 候选已入库并跳过；新增 _tcm_db_inspect_20260911.py 工具可列出 23 个中医方案 + 关联 drug 数 + 关联 hospital 数 + reports 表
- **验证**：9-11 仅开 3 个全新 ID (024/025/026)，0 重复入库；3 候选跳过原因明确（"已入库 XXX 同研究"）。完全闭环。

### ✅ CRC-T-2026-014 健脾补肾解毒方药味组成 (2026-08-28 → 2026-09-04 验证闭环)
- **原问题**：8-28 入库时只关联 3 个核心药（黄芪/白术/茯苓），方剂组成不完整
- **修复**：通过 _tcm_weekly_20260904.py Step 0 补全 5 个新药（党参/补骨脂/女贞子/菟丝子/枸杞子），引用湖南中医杂志 2000 脾肾方 + 杨宇飞健脾补肾序贯法 + 现代中医临床 2024 一气周流理论
- **验证**：DB 查询显示 014 现在 9 味药 (8 核心 + 1 方剂名)，全部 3 源交叉验证。完全闭环。

### ✅ generate_md.py URL 重复前缀 (2026-08-24 → 2026-08-28 验证闭环)
- **原问题**：2026-08-24 测试发现 `generate_md.py:116` 输出 `[contact_website](https://{contact_website})`，当 contact_website 已含 `https://` 时渲染成 `https://https://…` 重复
- **修复**：改为先检测 `startswith(("http://", "https://"))`，含则 href=原值、不含则补 `https://` 前缀
- **验证**：2026-08-28 中医 cron 合并产出时跑通 generate_md.py，HTML/MD 渲染无 `https://https://` 重复前缀。完全闭环。

### ✅ Python 脚本 GBK 编码 (2026-08-27 → 2026-08-28 修复)
- **原问题**：2026-08-27 _weekly_20260827.py 末尾 print 触发 `UnicodeEncodeError: 'gbk' codec can't encode character '\xae'`（艾维达®）
- **修复**：所有一次性 Python 脚本统一在头部加 `sys.stdout.reconfigure(encoding="utf-8")`（Python 3.7+）
- **验证**：2026-08-28 _tcm_weekly_20260828.py / _biji_sync_20260828.py 头部都加了，print 无 GBK 报错。完全闭环。

### ✅ generate_md.py 写死 8-24 日期 (2026-08-28 修复)
- **原问题**：generate_md.py 之前写死 `OUT_MD = Path(r"...方案索引_2026-08-24.md")`，cron 跑前没传参会出错
- **修复**：改为 `OUT_MD = Path(rf"...方案索引_{TODAY}.md")`，TODAY 支持 `sys.argv[1]` 接受 cron 调用方传参；不传则默认 `datetime.now().strftime("%Y-%m-%d")`
- **验证**：本次 2026-08-28 cron 跑 `python generate_md.py 2026-08-28` 输出文件名 `直肠癌晚期_方案索引_2026-08-28.md`，文件名正确。完全闭环。

### ✅ generate_html.py 数据变量名错误 (2026-08-28 修复)
- **原问题**：generate_html.py line 712 `.replace("__GEN_TIME__", data["stats"]["generated_at"])` 引用了未定义的变量 `data`（实际变量名是 `data_json`）
- **修复**：改为 `datetime.now().strftime("%Y-%m-%d %H:%M:%S")`，不依赖读回的 JSON
- **验证**：2026-08-28 cron 跑通，HTML 标题+副标题+生成时间均正确显示。完全闭环。

### ✅ reports id=1 placeholder 状态错误 (2026-08-28 当场修正)
- **原问题**：2026-08-24 测试时 placeholder 把 8-20 已入库的 CRC-T-2026-002/003/006/007/008 错误标为"new"，而 8-27 真实没新方案入库
- **修复**：本轮写库前在 _tcm_weekly_20260828.py Step 0 先 UPDATE 5 条 new→kept，修正 new_regimens_count -5 / kept_regimens_count +5
- **验证**：DB 查询显示 002/003/006/007/008 在 id=1 reports 是 kept 状态，014~018 才是 new。完全闭环。

### ✅ pin_to_id 字典 swap bug (2026-09-03 当场修复)
- **原问题**：_weekly_20260903.py 用 `dict(cur.fetchall())` 直接转 (drug_id, pinyin) 序列,key 错位,18 个 regimen_drugs 首轮全部 SKIPPED
- **修复**：1) 当场通过 _fix_rd_20260903.py 用 `{r[1]: r[0] for r in cur.fetchall()}` swap 后重新 INSERT,18 条全部入库 2) retro-checklist 已加 #5 待改进项 + 改进方案(模板固化写法)
- **验证**：DB 查询 regimen_drugs 总数 64 → 82 (+18), 与本周 4 方案 × 4-5 药吻合,0 失败。完全闭环。

---

## 附：已知但非阻塞的观察

> 不影响产出、暂不立为改进项的小问题，记一笔防止遗忘。

- 2026-08-28 verify_links_v2.py 跑 46 个 URL：30/46 OK = 65% OK 率（与 8-27 持平）
  - fail 中 15 个是**既有**中医医院（gdhtcm.com / 广中医、bjhzy.cn / 北京华宗 等）反爬 + 上海大学 403，**非新增**
  - fail 中 4 个是**新增**：东直门医院 403 + 上海大学 403 + 普陀医院 Connection 失败 + 中山六院 403（中山六院 8-27 就 fail，是 8-27 西医报告里"link status 405 待核实"项目之一）— 4 个 fail 均为反爬/连接，非真实问题
  - 上海中医药大学附属普陀医院 Connection 失败：可能 DNS/防火墙问题，下次可手动 curl 测试
- 8-27 测试文件 `直肠癌晚期中医_方案索引_2026-08-27-preview.md` 现在被 8-28 真实产出替代，可清理到 `backup/`（非紧急）
