# Skill 使用说明书（15 个：14 测试/安全/观测/复盘 + 1 Hermes 基础设施）

**生成时间**: 2026-09-11 11:05（初版 2026-08-18）  
**总 skill 数**: 14 个  
  - 来自 `~/.hermes/skills/qa/`: 11 个
  - 来自 `~/.hermes/skills/software-development/`: 1 个（test-driven-development, TDD）
  - 来自 `~/.hermes/skills/token-usage-meter/`: 1 个（token 用量观测）
  - 顶层 double-triangle-review: 1 个（双三角复盘）
**归集位置**: `~/测测的工作空间/skills/`（zip 包 + 2 个解压目录并存）  
**本次新增（2026-09-11）**: `web-security-scanning` v2.2.0、`token-usage-meter` v1.0.0；补录 `double-triangle-review`（07-10 归档）

> 命名：历史 11 个为 zip 归档（`<name>__<ver>__20260818.zip`）；新增 2 个同时提供 **zip 包（`__20260911`）和同名解压目录**（可直接浏览，运行时以 `~/.hermes/skills/` 为准）。

---

## 📖 这是什么？

这是你测试工作流用到的 11 个 skill 的离线备份。
每个 skill 一个 zip，文件名格式 `<name>__<version>__<日期>.zip`。

### 怎么用

- **自己看**：打开本文件
- **给其他 AI 看**：`01_SKILLS_INDEX.json` 是机器可读的
- **要用哪个**：解压对应 zip 到目标机器

```bash
# 例：解压 monitored-test-framework 到 Claude Code skill 目录
unzip ~/文档/test\ skill\ zip/zips/monitored-test-framework__n-a__20260818.zip \
      -d ~/.claude/skills/
```

---

## 🎯 OPRASE 六层映射

OPRASE = **O**bjective / **P**rocess / **R**esource / **A**ction / **S**ubmit / **E**valuate

### O_目标层 — 测什么、为什么测

（本层暂无 skill）

### P_方法层 — 怎么测、用什么策略

**3 个 skill**：

#### `post-task-methodology-loop`

- **包文件**: `post-task-methodology-loop__n-a__20260818.zip` (3 KB)
- **版本**: n/a
- **所属**: `~/.hermes/skills/qa/post-task-methodology-loop/`
- **描述**: 5-step post-task methodology loop — read prior methodology → execute task → write report → update methodology → next. Prevents the "rediscover from scratch" failure mode during long batch task chains. Use when the user assigns a list of homogeneous sub-tasks (test N modules, scan N pages, process N files, run N migrations) and says "一直推" / "继续推进" / "全部跑完" / "do them all", or when the agent starts re-debugging things it has already seen in this session/sessions.

#### `prompt-xray`

- **包文件**: `prompt-xray__1.0.0__20260818.zip` (20 KB)
- **版本**: 1.0.0
- **所属**: `~/.hermes/skills/qa/prompt-xray/`
- **描述**: Agent 系统提示词语料库拆解分析。输入 ZIP/RAR/文件夹/文本，输出结构化解析报告（PDF+MD）。5步流程：解包→画像→分类→精读→输出，5层框架：人格/原则/资产/执行/表现。

#### `test-driven-development`

- **包文件**: `test-driven-development__1.1.0__20260818.zip` (4 KB)
- **版本**: 1.1.0
- **所属**: `~/.hermes/skills/software-development/test-driven-development/`
- **描述**: "TDD: enforce RED-GREEN-REFACTOR, tests before code."


### R_数据层 — 登录/数据/环境

**3 个 skill**：

#### `cron-scheduled-test-runner`

- **包文件**: `cron-scheduled-test-runner__1.0.0__20260818.zip` (52 KB)
- **版本**: 1.0.0
- **所属**: `~/.hermes/skills/qa/cron-scheduled-test-runner/`
- **描述**: 将结构化测试执行文档转化为 cron 定时自动化测试任务。读取测试说明文档（含用例表/步骤/预期结果），配置 hermes cron job 按序执行，每步截图，生成 HTML 报告。适用场景：用户给出多份测试执行文档 + 要求定时跑/批量跑。触发词："配置定时测试"、"cron 跑测试"、"把测试任务加到 cron"、"每小时跑一个"、"按文档执行自动化测试"。

#### `srmpro-login`

- **包文件**: `srmpro-login__n-a__20260818.zip` (45 KB)
- **版本**: n/a
- **所属**: `~/.hermes/skills/qa/srmpro-login/`
- **描述**: SRMPRO (test.esicint.com) 一键登录封装。集成 Playwright 真实 mouse 滑块绕过、storage_state 永久复用、verify-slider-bypass 5 阶梯回退。Use when user says "登录 SRMPRO" / "登录 test.esicint.com" / "开始探索 SRMPRO" / "刷新 SRMPRO session" / "用 storage_state 登录" / "老大要进 SRMPRO 系统" / "SRMPRO 滑块过不了" / "开始申请库探索" / "开始供应商主数据探索" / "开始价格探索" / "开始能力矩阵探索" / "继续 SRMPRO 任务" / "SRMPRO session 过期了". Returns a ready-to-use Playwright `page` object OR sets main agent browser cookies. Triggers whenever agent touches a SRMPRO module (申请库/资源库/价格/能力矩阵/供应商主数据) and needs authenticated session.

#### `verify-slider-bypass`

- **包文件**: `verify-slider-bypass__n-a__20260818.zip` (8 KB)
- **版本**: n/a
- **所属**: `~/.hermes/skills/qa/verify-slider-bypass/`
- **描述**: Systematic bypass playbook for server-validated verify sliders (Element UI verify-move-block class, hCaptcha-style, 自研 verify) on Chinese enterprise B2B web apps. Use when agent encounters "向右滑动解锁" prompts, "拖动滑块" captcha, ".verify-move-block" class, "登录按钮 disabled but no password error" symptom, "前端反作弊拦截 dispatchEvent" failures, "server-side captcha code 验证" required, "Login 父组件 loginForm.code 注入" needed, "Selenium ActionChains headless 失效", or "想永久跳过滑块" / "用 storage_state 复用" / "context.storage_state 怎么写". Encodes a 6-strategy ladder (v1.0 MouseEvent dispatch, v1.7 Vue ref inject, v1.8 Login form inject, v2.0 Selenium headed with Xvfb, v3.0 API + cookie replay, v3.5 Playwright storage_state 持久化 = 终极方案) with explicit failure-signal triage for each. Triggers when 测测 starts exploring a new Chinese B2B target (致远/用友/金蝶/泛微/丰致 SRM) and hits a verify slider, OR when user says "滑块过不了" / "绕过 captcha" / "用 selenium 试试" / "为什么 30 步 dispatch 后还 disabled" / "怎么保存登录态" / "下次直接进系统".


### A_执行层 — 直接执行测试

**3 个 skill**：

#### `web-security-scanning` 🆕2026-09-11

- **包文件**: `web-security-scanning__2.2.0__20260911.zip` (30 KB)（另有同名解压目录）
- **版本**: 2.2.0
- **所属**: `~/.hermes/skills/qa/web-security-scanning/`
- **描述**: OWASP ZAP 登录态全站安全测试（daemon API）。覆盖 CSRF 登录 + httpSessions 手工会话注入、ZAP 2.17 API 差异（createEmptySession/includeInContext/HttpStateEnabled/option 走 GET）、Spider maxDuration 防无限爬、路径模板抽样 200~300 页、限速主动扫描（3线程50ms）防 WAF、PII 等四类高频误报人工复核、交付物脱敏与 QC、OPRASE 六层产出、防熔断纪律。自带 4 个脚本：`zap_preflight.py`(开扫前一键自检)、`zap_redact.py`(交付脱敏)、`zap_delivery_qc.py`(交付前QC)、`zap_scaffold.py`(六层项目骨架)。触发词："WEB安全测试"、"ZAP扫描"、"漏洞扫描"、"对某URL做安全评估"、"登录态B2B站扫描"。首个落地：xplorechips（9645请求/542告警/复核11类中低危/无确认高危）。

#### `monitored-test-framework`

- **包文件**: `monitored-test-framework__n-a__20260818.zip` (50 KB)
- **版本**: n/a
- **所属**: `~/.hermes/skills/qa/monitored-test-framework/`
- **描述**: 监控子智能体 + DOM双保险自动化测试框架。每个测试步骤同时记录三种证据：(1) 截图，(2) DOM断言返回值，(3) 监控子智能体旁路验证。综合三方证据给出 PASS/WARN/FAIL 三态判定，避免"假阳性"和"假阴性"。当用户说"用监控子智能体"、"双保险测试"、"DOM断言+截图双证据"时使用。

#### `web-exploratory-tester`

- **包文件**: `web-exploratory-tester__1.11.0__20260818.zip` (294 KB)
- **版本**: 1.11.0
- **所属**: `~/.hermes/skills/qa/web-exploratory-tester/`
- **描述**: AI-driven Web 探索性测试工具 - 给一个 URL，自动输出 dogfood 报告。报告支持 3 种格式：单文件 Markdown / 5M 分卷 / Obsidian vault 双链版（每条 issue 一个文件 + `[[双链]]` + 截图实时显示）。当用户说"测一下这个网站"、"跑一遍探索测试"、"帮我 dogfood 一下"、"AI 测 XX 系统"、"做个 Web 端的探索测试"、"放到 Obsidian 看"、"用双链格式出报告"、"每超过 5M 分一个报告"时触发。基于 dogfood skill 方法论升级，封装了 sitemap 自动发现、API 探测、404 检查、控制台收集、报告自动生成。


### S_交付层 — 报告/缺陷提交

**3 个 skill**：

#### `sub-module-test-report`

- **包文件**: `sub-module-test-report__1.0-deprecated__20260818.zip` (14 KB)
- **版本**: 1.0-deprecated
- **所属**: `~/.hermes/skills/qa/sub-module-test-report/`
- **描述**: ⚠️ 已废弃 — 能力已合并到 qa/test-report v2.0+，不要再使用此skill

#### `test-report`

- **包文件**: `test-report__2.7__20260818.zip` (65 KB)
- **版本**: 2.7
- **所属**: `~/.hermes/skills/qa/test-report/`
- **描述**: 测试报告生成 — 子模块 + 全量两层流水线。当需要输出HTML测试报告、汇总模块结果给老板看、做发布门禁报告时使用。生成的报告包含用例详情、截图、缺陷、修复建议。老大的样式偏好是V2深色渐变+白色卡片+6列KPI+发布门禁Banner。全量报告的缺陷数据必须100%从子模块报告自动提取，不手写。

#### `yunxiao-defect-submit`

- **包文件**: `yunxiao-defect-submit__1.1__20260818.zip` (21 KB)
- **版本**: 1.1
- **所属**: `~/.hermes/skills/qa/yunxiao-defect-submit/`
- **描述**: 云效(Yunxiao)缺陷自动提单 — 从测试报告提取缺陷数据，按老大指定的模板格式提交到阿里云云效项目。标题格式「AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}」，描述含8段模板（前置/问题链接/用户账号/供应商账号/步骤/问题/期望/定位），截图base64内嵌描述。当用户说"提交缺陷到云效"、"提单到云效"、"批量提单"、"更新云效缺陷"、"用提单格式"时触发。


### E_复盘层 — 方法论迭代

**2 个 skill**：

#### `double-triangle-review`

- **包文件**: `double-triangle-review.zip` (101 KB)
- **版本**: n/a（2026-07-10 归档）
- **所属**: `~/.hermes/skills/double-triangle-review/`
- **描述**: 一堂双三角复盘（量化版·自动评分+双报告）。用双三角清单体量化 6 大能力维度 27 子模块，基于项目实际表现自动评分（无需手答 108 题）。报告1=可视化复盘（SVG 雷达图+段位+90天成长主线），报告2=场景迭代建议（直接喂下一轮 AI）。触发词："复盘"、"双三角"、"能力测评"、"段位判定"、"项目复盘"、"AI协作效果评估"。

#### `token-usage-meter` 🆕2026-09-11

- **包文件**: `token-usage-meter__1.0.0__20260911.zip` (7 KB)（另有同名解压目录）
- **版本**: 1.0.0
- **所属**: `~/.hermes/skills/token-usage-meter/`（observability 类）
- **描述**: 基于 Hermes `state.db` 的 LLM token 用量计量，零侵入。会话/项目级精确（input/output/cache_read/cache_write/reasoning/API调用数）；最小循环单元用 `start/end` 快照差分精确计量（一篇文章提炼、一条用例执行、一个需求转清单、一次子智能体派发）；历史会话按 user-turn 分摊 `[估算]`。提供监控点（start/end）与复盘点（project 聚合），输出单元级 token 账单与"每篇/每条"人效比。工具 `scripts/token_meter.py`，账本 `~/.hermes/token_meter/ledger.jsonl`。触发词："统计/监控token"、"子智能体成本"、"按最小单元记账"、"token复盘"。实测：xplorechips 6 会话总量 31,049,313（缓存读占88%）。
- **边界**: 火山方舟 Coding Plan 网关未回单价，token 真实、成本需另配（路线B）。

---

## 📋 完整清单（按 skill 名排序）

- **`cron-scheduled-test-runner`** [R] (qa/) — 将结构化测试执行文档转化为 cron 定时自动化测试任务。读取测试说明文档（含用例表/步骤/预期结果），配置 hermes cron job 按序执行，每步截图，生成 HTML 报告。适用场景：用户给出多份测试执行文档 + 要求定时跑/批量跑。触发词："配置定时测试"、"cron 跑测试"、"把测试
- **`double-triangle-review`** [E] (顶层/) — 一堂双三角复盘（量化版·自动评分+双报告）。6 大能力维度 27 子模块，基于项目表现自动评分，出 SVG 雷达图+段位+90天成长主线 + 下一轮迭代建议。用于复盘、能力测评、AI协作效果评估。
- **`hermes-model-backup-failover`** v1.1.0 [基础设施] (devops/) 🆕 — Hermes 大模型配置+多级容灾+备份回滚迁移方案。主模型(方舟 Agent Plan ark-code-latest)+多级 fallback_providers 容灾链(Coding Plan MiniMax-M3 1M→OpenRouter)，四块模板(model/providers/fallback_providers/custom_providers)+.env 密钥分离+时间戳/golden 备份回滚+curl→config check→AIAgent 三级验证脚本。用于把模型/备份方案迁到另一台 hermes、配主备容灾。v1.1 已按本机真实 config 校准并修复验证脚本。

- **`monitored-test-framework`** [A] (qa/) — 监控子智能体 + DOM双保险自动化测试框架。每个测试步骤同时记录三种证据：(1) 截图，(2) DOM断言返回值，(3) 监控子智能体旁路验证。综合三方证据给出 PASS/WARN/FAIL 三态判定，避免"假阳性"和"假阴性"。当用户说"用监控子智能体"、"双保险测试"、"DOM断言+截图双证据
- **`post-task-methodology-loop`** [P] (qa/) — 5-step post-task methodology loop — read prior methodology → execute task → write report → update methodology → next. Prevents the "rediscover from sc
- **`prompt-xray`** [P] (qa/) — Agent 系统提示词语料库拆解分析。输入 ZIP/RAR/文件夹/文本，输出结构化解析报告（PDF+MD）。5步流程：解包→画像→分类→精读→输出，5层框架：人格/原则/资产/执行/表现。
- **`srmpro-login`** [R] (qa/) — SRMPRO (test.esicint.com) 一键登录封装。集成 Playwright 真实 mouse 滑块绕过、storage_state 永久复用、verify-slider-bypass 5 阶梯回退。Use when user says "登录 SRMPRO" / "登录 test.
- **`sub-module-test-report`** [S] (qa/) — ⚠️ 已废弃 — 能力已合并到 qa/test-report v2.0+，不要再使用此skill
- **`test-driven-development`** [P] (software-development/) — "TDD: enforce RED-GREEN-REFACTOR, tests before code."
- **`test-report`** [S] (qa/) — 测试报告生成 — 子模块 + 全量两层流水线。当需要输出HTML测试报告、汇总模块结果给老板看、做发布门禁报告时使用。生成的报告包含用例详情、截图、缺陷、修复建议。老大的样式偏好是V2深色渐变+白色卡片+6列KPI+发布门禁Banner。全量报告的缺陷数据必须100%从子模块报告自动提取，不手写。
- **`token-usage-meter`** [E] (observability/) 🆕 — LLM token 用量计量（零侵入读 state.db）。会话/项目精确 + 最小循环单元 start/end 差分 + 历史 turns 估算，输出总量/输入/输出/缓存/API数与单元人效比。用于子智能体/每篇文章/每条用例成本监控与复盘。
- **`verify-slider-bypass`** [R] (qa/) — Systematic bypass playbook for server-validated verify sliders (Element UI verify-move-block class, hCaptcha-style, 自研 verify) on Chinese enterprise B
- **`web-exploratory-tester`** [A] (qa/) — AI-driven Web 探索性测试工具 - 给一个 URL，自动输出 dogfood 报告。报告支持 3 种格式：单文件 Markdown / 5M 分卷 / Obsidian vault 双链版（每条 issue 一个文件 + `[[双链]]` + 截图实时显示）。当用户说"测一下这个网站"、
- **`web-security-scanning`** [A] (qa/) 🆕 — OWASP ZAP 登录态全站安全测试（spider+ascan+报告）。含 ZAP2.17 会话注入、限速防WAF、四类误报复核、交付脱敏QC、OPRASE六层产出，自带 preflight/redact/delivery_qc/scaffold 4 脚本。用于 WEB/ZAP 安全扫描、漏洞评估。
- **`yunxiao-defect-submit`** [S] (qa/) — 云效(Yunxiao)缺陷自动提单 — 从测试报告提取缺陷数据，按老大指定的模板格式提交到阿里云云效项目。标题格式「AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}」，描述含8段模板（前置/问题链接/用户账号/供应商账号/步骤/问题/期望/定位），截图base64内嵌描述。当用户说"提交

---

## 🔧 测试工作流串联（OPRASE 闭环）

```
  [需求]
     ↓
  O_目标层：requirements-to-tests（需求→测试用例）
     ↓
  P_方法层：post-task-methodology-loop（复用上次方法论）
           + test-driven-development（写代码前先写测试）
           + prompt-xray（提示词体检）
     ↓
  R_数据层：srmpro-login（登录被测系统）
           + cron-scheduled-test-runner（定时跑）
           + verify-slider-bypass（绕过滑块）
     ↓
  A_执行层：monitored-test-framework（监控双保险执行）
           + web-exploratory-tester（探索性测试）
           + web-security-scanning（ZAP 登录态安全扫描）
     ↓
  S_交付层：test-report / sub-module-test-report（出报告）
           + yunxiao-defect-submit（提缺陷到云效）
     ↓
  E_复盘层：token-usage-meter（最小循环单元 token 成本复盘）
           + post-task-methodology-loop（方法论迭代）
```

---

## 🛠 维护说明

- **包文件命名**: `<skill-name>__<version>__<日期>.zip`
- **历史归档（11 个）**: 20260818 zip；**新增（2 个）**: 20260911，zip + 解压目录并存
- **不打**: node_modules / __pycache__ / >5MB 文件
- **同步策略**: 手动触发（老大偏好）。⚠️ `~/.hermes/skills/` 主技能更新后，本目录副本不会自动同步，需手动 `cp -r` 并重打包
- **新增脚本验证**: 打包后 `python3 -m py_compile scripts/*.py`，并与源目录 `diff -rq` 确认一致

## 📊 分布

- `~/.hermes/skills/qa/`: 11 个（核心测试 + 安全工具集，含 web-security-scanning）
- `~/.hermes/skills/software-development/`: 1 个（TDD 方法论）
- `~/.hermes/skills/token-usage-meter/`: 1 个（token 用量观测，独立顶层技能）
- `~/.hermes/skills/double-triangle-review/`: 1 个（双三角复盘，独立顶层技能）
- `~/.hermes/skills/devops/hermes-model-backup-failover/`: 1 个（Hermes 模型配置/容灾/备份基础设施，非测试向）

## 🆕 2026-09-11 更新要点

- 新增 **web-security-scanning v2.2.0**（A 执行层）：ZAP 登录态安全测试标准化，首个落地 xplorechips 零封号、QC 42/42。
- 新增 **token-usage-meter v1.0.0**（E 复盘层）：最小循环单元级 token 计量，支撑人效比复盘。
- 补录 **double-triangle-review**（E 复盘层，07-10 归档）：6维27子模块量化复盘，与 token-usage-meter 共同支撑 E 层。
- 共 15 个技能（14 测试向 + 1 Hermes 基础设施）；OPRASE 六层中 A/S/E 三层均有对应技能。

## 🆕 2026-09-20 更新要点

- 新增 **hermes-model-backup-failover v1.0.0**（devops 基础设施，不占 OPRASE 六层）：沉淀老大的大模型生产拓扑——方舟 Agent Plan 主模型 + 多级 fallback_providers（MiniMax-M3 1M→OpenRouter）+ providers 模型目录 + custom_providers 扩展；含四块 YAML 模板、时间戳/golden 备份回滚脚本、curl→config check→AIAgent 三级验证脚本；密钥全走 .env，交付件零明文。关键差异：新版 `_config_version:22` 用 fallback_providers 列表(多级)，旧版仅单个 fallback_model(单槽)。
- 升级 **hermes-model-backup-failover v1.1.0**（同日按本机真实 config 校准）：
  - 修复 `verify-model.sh` 旧版 curl 鉴权头被密钥打码层改写成 `Bearer ***` 且引号断裂、导致 L1 探测必失败的 bug；改为 `local auth="Authorization: Bearer *** 单变量传头，bash -n 通过、实跑可发正确请求。
  - 模板 coding-plan 模型目录从 6 个补全为真实 11 个；custom_providers 补真实存在的 `minimax`(Agent Plan Anthropic) 端点。
  - 本机实测：`hermes config check` ✅、OpenRouter 兜底 200 ✅、主模型 Agent Plan 正常；Coding Plan 的 MiniMax-M3 当时回 `400 InvalidSubscription`，**经老大确认是 MiniMax 周限额用尽，并非订阅过期/key 失效**（火山该错误码有歧义；同 key 走 Agent Plan 正常即证明 key 有效，等额度重置后恢复）——已把此判断要点写入 SKILL.md 与 runbook 故障速判，避免下次误判换 key。
  - 已同步工作空间解压目录 + 重打 `hermes-model-backup-failover__1.1.0__20260920.zip`，diff -rq 与源完全一致，交付件零明文密钥。