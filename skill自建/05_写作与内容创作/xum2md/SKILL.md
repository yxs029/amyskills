---
name: xum2md
description: 将绘图/图形文件（.drawio、.eddx、.xmind）转换为 PlantUML/Mermaid 代码，封装为 Markdown 文档，并插入到用户指定的 PRD Markdown 对应章节。此 skill 用于需要将绘图文件（流程图/架构图/状态图/思维导图）转为 UML 代码、且需要关联到现有 PRD 文档的场景。触发词：drawio 转 uml、eddx 转 md、xmind 转 md、思维导图转 md、绘图转 PRD、把图插入 PRD、流程图画代码化。转换前必须先执行「目录扫描」让用户选择文件、再确认目标 PRD 信息，缺一不可。
agent_created: true
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# XUM2MD: drawio/eddx/xmind → UML/Mermaid → MD → PRD

## Overview

将 `.drawio`（draw.io）、`.eddx`（EdrawMax）和 `.xmind`（XMind）绘图/思维导图文件转换为标准 PlantUML 或 Mermaid 代码，封装为自包含的 Markdown 文档（含 UML 源码 + 封装信息表），并将链接插入到用户指定的 PRD Markdown 文档对应章节。

- **drawio / eddx**：流程图、架构图、状态图、页面流转图 → PlantUML / Mermaid
- **xmind**：思维导图（中心辐射树）→ **Mermaid mindmap**（默认唯一选型）

## 状态流程（必须严格按序执行）

本 skill 包含 **3 个状态流程**，每个状态必须**完成并确认后才可进入下一状态**，不得跳过：

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐
│ 状态1 目录扫描    │ ───▶ │ 状态2 确认 PRD   │ ───▶ │ 状态3 转换执行       │
│ (选择转换文件)    │      │ (确认目标 PRD)   │      │ (转换+封装+插入PRD)   │
└─────────────────┘      └─────────────────┘      └─────────────────────┘
```

### 状态 1：目录扫描（输入端）

1. 扫描用户指定目录（默认当前工作目录）下的所有 `.drawio`、`.eddx` 与 `.xmind` 文件。
2. 列出候选文件清单，编号展示（含文件名、大小、修改时间）。
3. **必须让用户选择**要转换的文件（支持多选，输入编号或用逗号分隔；用户也可直接 @ 引用文件）。
4. 校验：确认选择结果并让用户复核。**若选择未完成（用户未确认文件清单）→ 停留在此状态，绝不进入状态 2。**

**文件格式判定：**
- `.drawio`：纯 XML（`<mxfile>` 根节点，内含 `<diagram>` 页）。⚠️ **注意**：drawio 默认压缩格式，`<diagram>` 内容为 base64 → deflate → urlencode 三层编码，`parse_drawio.py` 已自动处理。
- `.eddx`：ZIP 压缩包（`PK\x03\x04` 文件头），内部含 `pages/page1.xml` + `thumbnail.jpeg`，需先解压再解析。
- `.xmind`：ZIP 压缩包（`PK\x03\x04` 文件头），内部含 `content.json`（现代版本）或 `content.xml`（旧版），`parse_xmind.py` 已自动处理。

### 状态 2：确认关联的 PRD 信息

1. 检查用户是否已提供目标 PRD 文件路径与插入章节位置。
2. **若用户未提供 → 主动询问以下信息（必须全部确认）：**
   - 目标 PRD 的 Markdown 文件路径（或文件名）
   - 插入章节的标题（如 `#### 供应商分级产品结构图`）或定位描述（如"在 X 章节之后"）
3. **若用户已提供 → 跳过本状态的询问步骤**，直接进入状态 3。
4. 记录插入位置信息，作为状态 3 的链接插入依据。

### 状态 3：转换执行

将状态 1 选定的文件 + 状态 2 确认的 PRD 信息作为输入，逐文件执行转换：

1. **解析**：按格式调用 `scripts/parse_drawio.py` 或 `scripts/parse_eddx.py` 或 `scripts/parse_xmind.py` 提取节点、文本、连线、分组。
2. **选型**：按 `references/conversion-guide.md` 的选型表确定 PlantUML 还是 Mermaid，先输出结论再继续。
3. **生成代码**：映射为目标 UML 语法，中文文案原样保留，避开关键字。
4. **校验**：调用 `scripts/validate_uml.mjs`（Mermaid 本地 parse；PlantUML 本地 `@plantuml/core` → 在线 plantuml.com 降级链），失败则修复重试（≤3 轮），最终仍未过则标记 `⚠️ 待人工确认`。
5. **分支节点纯净性检查**（mindmap 必做）：扫描 mindmap 代码块，确保分支节点文本中不含颜色色号（`#XXXXXX`）、unicode 转义（`\uXXXX`）、样式标记（`:::class`）、classDef 定义行。详见 `references/conversion-guide.md` 映射要点第 6 条。
6. **封装**：生成 `{源文件名}.md`（含 UML 源码 + 图结构说明 + 封装信息表 + 格式检查表），输出到 PRD 同目录的 `md版本文档整理/`。
7. **插入链接**：按 `references/prd-embed-rules.md` 在目标 PRD 指定章节插入 `> 📎 UML 源码：[[源文件名]]`，同步更新附录 A/C/D。
8. **验收**：按 `references/conversion-guide.md` 的验收清单核对。

## 转换流程速查

```
解析源文件 → 选型(PlantUML/Mermaid) → 生成UML代码 → 语法校验(≤3轮) → 分支纯净性检查(mindmap) → 封装MD → 插入PRD链接 → 更新附录 → 验收
```

## Resources

### scripts/
- `parse_drawio.py` — 解析 .drawio（XML，含 base64+deflate+urlencode 解码），输出节点/文本/连线/父级关系 JSON。
- `parse_eddx.py` — 解析 .eddx（ZIP → page1.xml），输出 Shape 节点/文本/层级 JSON。
- `parse_xmind.py` — 解析 .xmind（ZIP → content.json/content.xml），输出思维导图节点树 JSON。
- `validate_uml.mjs` — 校验 Mermaid（mermaid.parse + jsdom）与 PlantUML（本地 `@plantuml/core` → 在线 plantuml.com 降级链）。

### references/
- `conversion-guide.md` — 完整转换方法：选型表、语法映射、校验降级链、封装 MD 模板、验收清单。
- `prd-embed-rules.md` — PRD 插入规则：正文链接格式、附录 A/C/D 更新方法、目录结构约定。
- `case-study.md` — 四个真实转换案例（drawio→Mermaid、eddx→PlantUML、xmind→Mermaid mindmap、xlsx 内嵌图片→Mermaid mindmap），含输入特征、解析命令、选型结论、代码片段、校验结果、PRD 插入位置、关键经验。案例四含 classDef 修正经验（分支节点纯净性规则）。

## 常用命令

```bash
# drawio 解析
python scripts/parse_drawio.py <file.drawio>
# eddx 解析
python scripts/parse_eddx.py <file.eddx>
# xmind 解析
python scripts/parse_xmind.py <file.xmind>
# UML 校验（自动识别 mermaid/plantuml 代码块）
# 默认：Mermaid 本地 parse；PlantUML 本地渲染→在线降级
node scripts/validate_uml.mjs <output.md>
# 强制在线校验 PlantUML（需网络）
node scripts/validate_uml.mjs <output.md> --online
# 跳过本地 PlantUML 渲染（等价旧版行为，需 --online）
node scripts/validate_uml.mjs <output.md> --no-local --online
```

## 依赖

- Python 3.13+
- Node.js 22+
- npm 依赖（mermaid、jsdom、@plantuml/core）：**不随 skill 打包**，首次使用执行 `npm install` 安装（node_modules 约 200MB，装完即可离线校验 Mermaid 与 PlantUML）
- 网络（PlantUML 在线降级校验使用；本地不可靠时自动降级）
