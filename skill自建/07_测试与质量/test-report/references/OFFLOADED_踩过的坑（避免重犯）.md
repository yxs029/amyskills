## 踩过的坑（避免重犯）

### 1. Chromium 截图路径问题
```bash
# ❌ 这样写 --screenshot 写到 cwd，不是 /tmp/
chromium --headless --screenshot=/tmp/xxx.png file:///tmp/xxx.html
# 实际写入：./xxx.png（当前目录），且 /tmp/xxx.html 因 chromium snap 沙箱无法访问

# ✅ 正确写法：HTML和截图都放家目录
cp /tmp/report.html ~/
chromium --headless --screenshot=/home/aaronmy/xxx.png \
  "file:///home/aaronmy/report.html"
```

### 2. 模板变量名兼容性
老模板用 `{{TOTAL}}` `{{PASS}}` 这种简短名，新脚本用 `{{TOTAL_CASES}}` `{{PASSED_CASES}}` 全名。
`gen_submodule_report.py` 同时支持两种命名（已内置在 substitutions 字典），但**生成新模板时统一用全名**，避免混乱。

### 3. Python 脚本里的拼写错误
写 SVG donut chart 时容易把 `circum` 拼成 `circ` 导致 NameError。检查所有变量引用，统一命名为 `circum`（周长）。

### 4. defect 去重要按描述前30字符匹配 + tc_id 匹配
不能只用其中一种：
- 只用描述 → 统计卡片区6条"测试执行异常"会合并成1条
- 只用 tc_id → defect-table 和 defect-box 两条同缺陷记录会重复

→ `extract_defects()` 已实现双重去重，详见代码。

### 5. 云效API三个关键坑
- **域名**: 用 `openapi-rdc.aliyuncs.com`，不是 `devops.cn-hangzhou.aliyuncs.com`（后者返回404）
- **字段配置API路径**: `/oapi/v1/projex/organizations/{orgId}/projects/{projectId}/workitemTypes/{typeId}/fields` — 路径中间**必须有** `/projects/{projectId}/` 段，否则404
- **assignedTo**: 用 userId（如 `5f30dcae42509b3c32f367e8`），不用邮箱（邮箱返回400）
- **必填字段**: SRMPRO项目配了7个必填自定义字段（功能分类/严重程度/优先级/问题类型/发布环境/问题原因），缺任何一个都返回400
- **字段值格式**: seriousLevel/priority 的值是**选项ID**；功能分类/问题类型/发布环境的值是**选项值文本本身**（因为value=id）

### 6. 不可逆操作需先确认
session中尝试用 `mv` 重命名旧skill时，触发了"重命名/删除需要用户确认"的安全拦截。**应先 read 再 write，慎用 mv/rm**。如果只是废弃+指向新skill，留在原目录加废弃说明更安全。

### 7. 云效更新工作项用PUT不是PATCH
- ❌ `PATCH /oapi/v1/projex/organizations/{orgId}/workitems/{id}` → 404
- ✅ `PUT /oapi/v1/projex/organizations/{orgId}/workitems/{id}` → 204
description会被自动转为RICHTEXT格式。问题原因字段也可通过同一PUT更新。

### 8. 云效附件上传API不可用 → 改用base64内嵌描述
3步流程的新版OpenAPI路径全部404。→ **不要浪费时间尝试附件API**。
替代方案：截图转base64直接嵌入描述HTML的`<img src="data:image/png;base64,...">`标签中，
PUT更新后云效自动存为RICHTEXT格式，网页端打开缺陷即可看到图片（2026-07-08验证通过）。
详见 `skill_view(name='yunxiao-defect-submit')`。

### 9. 缺陷描述必须用老大的模板格式
老大2026-07-08指定了缺陷描述模板，已迁移到独立skill `qa/yunxiao-defect-submit`。
标题格式：`AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}`
描述8段模板：前置/问题链接/用户账号/供应商账号/步骤/问题/期望/定位。
截图用base64内嵌描述HTML中。详见 `skill_view(name='yunxiao-defect-submit')`。

### 10. 截图白屏检测和标注（2026-07-08 实战）
生成 HTML 报告时，对 <10KB 的截图自动标注 `blank-shot` class（橙色虚线边框 + "⚠️可能空白"文字），让读者一眼区分有效截图和白屏截图。不要删除白屏截图--它们仍有诊断价值（证明页面在那个时间点没渲染完）。

### 11. 子模块报告可直接从 test_results.json 内联生成（无需模板脚本）
当测试脚本已输出标准 `test_results.json`（含 summary + results 数组），可直接用 Python 内联生成 HTML 报告，不必走 `gen_submodule_report.py` 模板流程。关键步骤：读 JSON -> 遍历 results -> 截图转 base64 内嵌 -> 7 区块结构（标题/统计卡/优先级/通过率/用例详情可折叠/缺陷表/总结）-> 灯箱交互全内联 -> 单文件 HTML（3-4MB）。适合一次性测试报告；模板脚本适合批量多模块流水线。

### 12. 复盘报告 = 7区块 + 双三角分析 + 踩坑总结（2026-07-13 实战）
当老大说"用上面的格式和方法论继续做总结"时，意味着用已认可的 enhanced 7区块 HTML 格式 + 一堂双三角框架做复盘报告。复盘报告的"用例"可以是探索发现（如"自动登录"/"菜单遍历"/"长程任务验证"），状态可以是 PASS/FAIL/WARN。在标准7区块后追加：双三角分析区块 + 踩坑总结区块 + 改进方法论区块。详见 `references/retrospective-report-format.md`。

### 13. AI测试方法论：零上下文盲测 = 浅薄产出（2026-07-13 核心教训）
**"大而泛"比"小而深"更危险**。全量跑45个页面生成1376条用例，但全是"验证点击效果和状态变更"模板，等于没有测试。相比之下只测2个功能（登录+搜索）但有详细步骤+截图+预期对比的报告质量远高。正确方法：给详细上下文（需求/用例/字段说明）+ 模块范围足够小 + 明确产出标准 + Hermes长程执行能力。

### 14. 大篇幅HTML报告的分文件写入策略（2026-07-13 实战验证）
当生成 **10000字以上的HTML报告** 时，**不要**把整个HTML塞进一个Python f-string。中文字符变量 + 正则反斜杠 + 嵌套引号会导致 `SyntaxError: f-string expression part cannot include a backslash` 和 `NameError` 等问题，极难调试。

**正确策略 — 分文件写入 + 拼接**：
1. 将CSS写入 `/tmp/report_css.txt`
2. 将HTML按区块拆分为 `part_01.html` ~ `part_10.html`（每个用 `write_file` 独立写入）
3. 写一个 Python 拼接脚本读取所有 part 文件 + CSS，拼成最终 HTML
4. 字符串拼接用 `+` 或 `"".join()`，不用 f-string 嵌入大段中文

```python
# 拼接脚本示例
parts = []
for i in range(1, 11):
    with open(f"/tmp/report_parts/part_{i:02d}.html", "r") as f:
        parts.append(f.read())
css = open("/tmp/report_css.txt").read()
html = f"<html><head><style>{css}</style></head><body>{''.join(parts)}</body></html>"
with open("/tmp/final_report.html", "w") as f:
    f.write(html)
```

**适用场景**：复盘报告（20000字+）、阶段总结报告、深度分析报告。普通子模块报告（3-4MB）不需要此策略。

### 15. 渐进式字数扩充技术（2026-07-13 实战）
当老大指定目标字数（如"约20000字"）时，不要试图一次写到位。用渐进式 patch 策略：
1. 第一轮写出全部区块的骨架（约目标字数的50-70%）
2. 统计中文字数：`len(re.findall(r'[\u4e00-\u9fff]', content))`
3. 差额分摊到各 part 文件，用 `patch` 在已有段落中插入分析性内容（不是水话）
4. 每轮扩充后重新统计，直到达标

实战记录：7040 → 14224 → 17089 → 18304 → 19127 → 19677 → 19969 → 20044（6轮扩充）。

### 16. Chrome headless 转 PDF（2026-07-13 实战）
```bash
google-chrome --headless --disable-gpu --no-sandbox \
  --print-to-pdf="/tmp/report.pdf" \
  --print-to-pdf-no-header \
  "file:///tmp/report.html"
```
- ⚠️ SSL handshake 错误可忽略（不影响本地 `file://` 协议渲染）
- ⚠️ 如果 HTML 文件含 base64 截图，PDF 会很大（20000字+4张截图 ≈ 6.3MB）
- ⚠️ `--no-sandbox` 在 root/容器环境必须加

### 17. gen_submodule_report.py 的 JSON key 兼容性（2026-07-17 实战）
测试脚本输出的 JSON 用 `"module"` 作为 key，但 `gen_submodule_report.py` 硬编码读取 `result['module_name']`，导致 `KeyError` 崩溃。
**修复**：脚本已改为 `result.get('module_name') or result.get('module', 'Unknown Module')`。
**教训**：所有 JSON 字段读取必须用 `.get()` 带默认值，永远不要用 `result['key']` 硬编码访问。测试脚本和报告脚本可能由不同的人/不同的 session 编写，key 名不一定一致。

### 18. 截图数据支持两种格式：文件路径 vs 预编码 base64（2026-07-17 实战）
`gen_submodule_report.py` 原来只支持 `{"file": "path/to.png"}` 格式（从磁盘读文件转 base64）。
但实际测试脚本为了方便，经常在 JSON 里直接存 `{"base64": "data:image/png;base64,..."}` 预编码数据。
**修复**：脚本已改为优先检查 `ss.get('base64')`，如果有直接用；否则才走 `image_to_base64(ss['file'])` 文件路径方式。
**教训**：报告生成脚本必须兼容两种截图数据格式--文件路径和预编码 base64。

### 19. Playwright 测试脚本三个高频崩溃点（2026-07-17 实战）
写 Playwright 自动化测试脚本时，以下三个问题反复导致整个测试套件中途崩溃：

1. **`element.fill()` 对不可见元素超时**：SRMPRO 的搜索框在列表展开后可能滚出视口或被遮挡，`fill('text')` 会重试14次然后 TimeoutError。
   - ✅ **解决方案**：用 `page.evaluate()` + JS 直接设值并触发 input 事件：
   ```python
   page.evaluate("""() => {
       const inputs = document.querySelectorAll('input.el-input__inner');
       for (const inp of inputs) {
           if (inp.offsetParent !== null && inp.offsetHeight > 0) {
               inp.value = '搜索词';
               inp.dispatchEvent(new Event('input', {bubbles: true}));
               break;
           }
       }
   }""")
   ```

2. **`element.inner_text(timeout=N)` 不接受 timeout 参数**：Playwright Python 版的 `inner_text()` 方法不支持 `timeout` 关键字参数，传了会直接 TypeError。
   - ✅ **解决方案**：去掉 timeout 参数，用 `element.inner_text()` 或改用 `page.wait_for_timeout()` 前置等待。

3. **单个测试用例异常导致整个模块测试终止**：一个用例的 Playwright 异常会冒泡终止整个测试函数，后续用例全部丢失。
   - ✅ **解决方案**：将测试函数按需求点/功能点拆分为独立小函数，主函数中用 `try/except` 逐个调用：
   ```python
   for name, fn in [("需求点1", test_req1), ("需求点2", test_req2)]:
       try:
           fn(page)
       except Exception as e:
           print(f"❌ {name}异常: {e}")
           traceback.print_exc()
   ```

### 20. cron-unsafe 标记模式：自动化测试中的写操作安全跳过（2026-07-17 实战）
在 cron 自动化测试中，涉及文件上传、数据修改、配置变更、删除等不可逆操作的用例必须自动跳过，否则会污染测试环境数据。
**标记模式**：在 `add_result()` 中将这类用例标记为 `status="skip"`，并在 `defect` 字段中说明跳过原因：
```python
add_result(results, "TC-XXX-001", "上传图纸验证", "P0", "skip",
    [{"step": 1, "action": "上传文件", "result": "SKIP - 涉及文件上传", "ok": True}],
    "涉及文件上传有持久副作用，cron自动跳过",
    [ss], {"severity": "INFO", "title": "此用例需手动执行", "actual": "cron-unsafe操作已跳过"})
```
**分类**：文件上传、数据创建/修改/删除、配置变更、权限修改 = cron-unsafe；列表查看、搜索筛选、权限对比 = cron-safe。

### 21. 共享登录模块 + 批量替换模式（2026-07-17 实战）
9 个测试脚本各自有 broken 的 `smart_login`（简单 fill+click，不处理滑块），全部卡在登录按钮 disabled。解决方案：写一个 `login_helper.py` 共享模块（调用 `robust_login`），所有脚本 `from login_helper import login_admin` 一行搞定。批量替换用正则 `def smart_login\(page.*?\):\n.*?(?=\ndef |\nclass |\n# ===)` 匹配旧函数体，替换为 4 行 import 版本。详见 `srmpro-login` skill 的「共享登录模块」章节。

### 22. 长测试批次执行 + 日志合并（2026-07-17 实战）
38 个用例的模块在有头模式下跑 ~15 个就 EPIPE 崩溃。解法：用 `BATCH_START`/`BATCH_END` 环境变量分批跑（每批 ≤8 个），每批 `tee` 到独立日志文件。但 `save_results()` 每批覆盖 JSON 文件丢失前批数据！必须从日志用正则 `r'\[(PASS|FAIL)\] (TC-\S+) - (.+?): (.+)'` 提取每个用例结果，合并保存到 `_final.json`（不会被后续批次覆盖的文件名）。教训：分批执行时，JSON 保存逻辑必须改为追加或用独立文件名。

### 23. AI 生成测试脚本的 CSS 选择器不可靠（2026-07-17 核心教训）
M04-M10 共 44 个用例全部 FAIL，根因：脚本中的 CSS 选择器（如 `button.upload-btn`、`.drawing-row button.update`、`.document-row a.filename`）是 AI 根据功能描述**猜测**的，不是真实页面 DOM。实际页面用 Element UI 组件，class 名称完全不同。

**判别方法**: 如果一个模块的测试结果**全 FAIL**，且错误信息全是 `Timeout 30000ms exceeded. waiting for locator("button.xxx")`，说明选择器是猜的，不是从真实 DOM 提取的。

**正确方法**:
1. 先用 Playwright 打开页面，`page.content()` 或 `page.query_selector_all('*')` 探索真实 DOM
2. 用浏览器 DevTools 或 `browser_snapshot` 工具获取实际 class 名
3. 或参考已有探索测试的选择器（如 `srmpro-login` skill 的 references 里的选择器清单）
4. M01 之所以 38/38 全 PASS，是因为它用了之前探索测试积累的真实选择器

**反模式**: 直接让 AI「根据功能描述写测试脚本」-> 选择器必猜错 -> 全 FAIL -> 报告没有价值。

### 24. 多模块测试结果 JSON 格式不统一（2026-07-17 实战）
10 个测试脚本输出了 3 种不同 JSON 格式：
- `{"cases": [...], "stats": {...}}` - 标准格式（M01/M02）
- `[{scene_id, result: {pass, message}}]` - 列表格式（M04-M10）
- `{"results": [...]}` - 另一种格式

报告生成脚本 `gen_submodule_report.py` 需要 `.get('cases')` 或 `.get('module_name')` 等字段，格式不匹配会 KeyError。

**解决方案**: 写统一转换脚本，把 3 种格式都转成标准格式（`module_name` + `stats` + `priorities` + `cases` + `defects`），保存为 `M*_standard.json`，再喂给报告生成器。所有字段读取用 `.get()` 带默认值。

### 25. 批量生成子模块报告的完整流水线（2026-07-17 实战验证）
10 个模块的标准 JSON 生成后，批量生成 HTML 子模块报告 + 全量报告的完整流程：

```bash
# 1. 为每个模块生成标准 JSON（统一格式）
# -> M01_standard.json ~ M10_standard.json

# 2. 批量生成 10 份子模块 HTML 报告
for f in M*_standard.json; do
  python gen_submodule_report.py --result $f --template submodule_template.html --output ${f/_standard.json/_测试报告.html}
done

# 3. 生成 module_stats.json（全量报告输入）
# 包含: name, total, pass, fail, skip, p0_pass, p0_total, rate, verdict, cls, finding, time

# 4. 生成全量报告
python gen_full_report.py --modules-dir HTML报告/ --module-stats module_stats.json --output 全量报告.html
```

**验证结果**: 10 份子模块报告 + 1 份全量报告，总计 90 用例 / 42 通过 / 44 失败 / 4 跳过，通过率 46.7%。

### 26. 模板文件路径（2026-07-18 实战修正）
`gen_submodule_report.py` 的 `--template` 参数默认从 `templates/` 目录读，但实际模板在 `assets/submodule_template.html`。两个常见错误：
- ❌ `--template templates/submodule_template.html` → `FileNotFoundError`
- ✅ `--template assets/submodule_template.html`

**根因**: skill 文件结构里 `assets/` 才是模板所在目录，`templates/` 不存在。

### 27. JSON 格式不一致的两个常见 KeyError（2026-07-18 实战）
批量跑 10 个模块时，遇到两个反复出现的 KeyError：

1. **list vs dict**: 测试脚本输出的 JSON 顶层是 `[{scene_id, ...}]`，但生成器读 `result.get('module_name')` → `AttributeError: 'list' object has no attribute 'get'`
2. **priorities 大小写**: 测试脚本输出 `{"P0": {total, pass}}`，但生成器读 `priorities['p0']` → `KeyError: 'p0'`

**修复脚本**:
```python
import json
data = json.load(open(fpath))
if isinstance(data, list):
    # list 转标准 dict
    converted = {
        "module_name": "xxx",
        "stats": {"total": ..., "pass": ..., "fail": ..., "skip": 0},
        "priorities": {"p0": {...}, "p1": {...}, "p2": {...}},  # ⚠️ 小写key
        "cases": [...],
        "defects": []
    }
else:
    # 修复 priorities 大小写
    if "priorities" in data:
        data["priorities"] = {k.lower(): v for k, v in data["priorities"].items()}
```

**核心教训**: 报告生成器的字段读取要有容错，**永远用 `.get('field')`** 带默认值，不要硬编码 key 名和大小写。

### 12. 参考报告的 CSS/HTML 模式必须沉淀为 reference 文件
用户指定的 `SRMPRO/文档库/report/enhanced/*.html` 是格式基准。这些报告中的 CSS 类名、颜色值、HTML 结构、灯箱 JS 逻辑等细节应提取到 `references/enhanced-html-patterns.md`，避免下次生成报告时凭记忆手写样式导致偏差。生成报告时直接从该文件复制 CSS 块，不要自己发明类名或颜色值。

### 28. gen_full_report.py vs gen_submodule_report.py 参数混淆（2026-07-19 实战）
两个脚本的输入参数**完全不同**，极易混淆：

| 脚本 | 必需参数 | 错误用法 |
|------|---------|---------|
| `gen_submodule_report.py` | `--result <json>` `--output <html>` | ❌ `--modules-dir`（不存在） |
| `gen_full_report.py` | `--modules-dir <dir>` `--module-stats <json>` `--output <html>` | ❌ `--result <json>`（报错 `the following arguments are required: --modules-dir`） |

**口诀**：子模块用 `--result`（单个JSON），全量用 `--modules-dir`（子模块HTML目录）+ `--module-stats`（聚合统计JSON）。

**完整全量报告生成流程**：
```bash
# 1. 先生成各子模块HTML（用gen_submodule_report.py --result M01.json --output M01.html）
# 2. 准备module_stats.json（含name/total/pass/fail/skip/p0_pass/p0_total/rate/verdict/cls/finding/time）
# 3. 生成全量：
python gen_full_report.py \
  --modules-dir ~/SRMPRO/.../HTML报告/submodules \
  --template assets/fullreport_template.html \
  --module-stats module_stats.json \
  --output 全量报告.html \
  --system-name "SRMPRO图纸库" --version "v5" \
  --test-date "2026-07-19" --test-url "https://..." \
  --test-users "admin" --engine "Playwright" --tools "深度步骤"
```

### 29. gen_full_report.py 自动扫描子模块HTML失败（2026-07-19 实战）
`gen_full_report.py` 的 `--modules-dir` 参数扫描的是**子模块HTML文件**（用于自动提取缺陷），不是JSON文件。如果目录里只有JSON没有HTML，会输出 `扫描 0 份子模块报告`，且不会生成全量HTML。

**解法**：必须先用 `gen_submodule_report.py` 生成所有子模块HTML，放在同一目录，再用 `gen_full_report.py --modules-dir <该目录>` 扫描。同时用 `--module-stats` 提供聚合统计数据（因为自动提取统计不可靠）。

### 30. module_stats.json 必须包含的完整字段（2026-07-19 实战）
`gen_full_report.py` 读取 `module_stats.json` 时，以下字段缺任何一个都会 KeyError：
- `name` - 模块名（不是 `module`）
- `total` / `pass` / `fail` / `skip` - 用例统计（`skip` 必须有，即使=0）
- `p0_total` / `p0_pass` - P0统计
- `rate` - 通过率百分比
- `verdict` - 优秀/良好/合格/需改进
- `cls` - excellent/good/fair/poor（CSS class）
- `finding` - 失败摘要
- `time` - 测试时间

**完整模板**：
```json
{
  "name": "M01-按图纸展开",
  "total": 40, "pass": 30, "fail": 10, "skip": 0,
  "p0_total": 15, "p0_pass": 12,
  "rate": 75.0, "verdict": "良好", "cls": "good",
  "finding": "已过期筛选无效/列表下载无反应",
  "time": "2026-07-19"
}
```

### 31. 多模块JSON文件版本选择坑（2026-07-19 实战）
一个模块可能有10+个JSON文件（各batch/各版本），自动选最新版本会选错：
- M01有 `M01_v4_final.json`(40用例) 和 `M01_v6_expand.json`(1用例)
- 版本匹配 `v6>v4` 选了v6_expand(1用例)，丢失39个用例

**解法**：手动指定每个模块的最佳文件名，或按用例数选 `max(cases)` 而非 `max(version)`：
```python
mod_files = {
    '01': 'M01_v4_final.json',  # 手动指定
    '07': 'M07_v8_final.json',
}
# 或自动按用例数选
best = max(mod_jsons, key=lambda f: len(json.load(open(f))['cases']))
```

### 32. 术语红线：DOM 不是 BOM（2026-07-19 老大三次强调）
老大原话："错了，不是BOM，是DOM，DOM，DOM，不是没有BOM"
- 截图证据链的三层是：**像素层 / DOM层 / 监控层**
- 禁止用"BOM"指代DOM断言数据（行数/字段值/状态文本）
- JSON schema 中字段名用 `dom_snapshot` 和 `dom_assertion`，不用 `bom`
- 此规则已同步写入 `monitored-test-framework` skill v1.9 第二节关键规则第6条

### 33. 测试模块完成后立即停止cron（2026-07-19 实战）
老大说"停止定时测试吧，这个模块目前测完了"。操作流程：
1. `cronjob action=list` 查看所有cron
2. 识别该模块的所有测试cron（按名称含模块名/系统名筛选）
3. 逐个 `cronjob action=remove job_id=xxx` 删除
4. 保留系统级cron（内存清理/反钓鱼周报等）
5. 13个SRMPRO测试cron全部删除，0误删系统cron

### 34. 清单体汇报格式红线（2026-07-19 再次强化）
老大原话："你用清单体给我吧，不要列表格，列表格我实在看不清楚"
- **所有汇报/交付/复盘场景**必须用清单体（①②③ + 加粗短语）
- **禁止用Markdown表格**，即使数据是表格结构也要转成清单体
- 如必须用表格（如模块统计），要简短且后续用清单解释
- 此规则已写入 `monitored-test-framework` skill v1.9 + memory
