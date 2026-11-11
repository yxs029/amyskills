---
name: xlsx2prd
description: Convert an Excel requirements document (.xlsx) into a structured PRD Markdown document, or convert xlsx/xls documents into Markdown format while preserving original content and formatting (bold, strikethrough, colors, image positions). This skill should be used when the user asks to convert xlsx/xls requirement specs (FRD/SRS/需求文档) into PRD Markdown format, convert xlsx documents to Markdown (md), extract and embed images, convert embedded diagrams (mindmaps/flowcharts/logic diagrams) into Mermaid or PlantUML source code, and assemble everything into a standards-compliant PRD with appendices. Triggers: xlsx转PRD, xlsx转md, xlsx2prd, 需求文档转md, 需求文档转PRD, 把xlsx转换为PRD, Excel转Markdown需求文档, 将xlsx转换为md, convert xlsx to PRD, convert xlsx to markdown.
agent_created: true
---

# xlsx2prd: Excel 需求文档 → PRD/Markdown 转换

## Overview

将 Excel 需求文档（.xlsx）完整转换为标准 PRD Markdown 文档，或按需仅转换为 Markdown（md）格式，保留原文内容与格式（加粗、删除线、颜色、图片位置），将内嵌图片自动转换为 Mermaid（思维导图）或 PlantUML（流程图/逻辑图等）源码，最终组装为含目录、附录、双向链接的 PRD 文档。

**两种用途**：
- **xlsx → md**：仅将 xlsx 转换为 Markdown（保留内容与格式，图片按原位置嵌入），不套 PRD 外壳。
- **xlsx → PRD**：在 md 基础上追加标准 PRD 外壳（文档信息/目录/背景目标/非功能需求/术语表/附录）与图片 UML 转换、双向链接。

## When to Use

- 用户提供 .xlsx 需求文档（FRD/SRS/需求清单），要求转换为 Markdown
- 需要将 xlsx 中的图片（流程图/思维导图）转为 UML 代码
- 需要将多个 sheet 整合为一个 PRD 文档
- 用户提到"PRD"、"需求文档转md"、"xlsx转PRD"

## Prerequisites

- Python 3.13+ with `openpyxl` and `Pillow` installed
- Node.js 22+ with `mermaid` and `jsdom` installed (for syntax validation)
- Internet access (for PlantUML online rendering fallback)

## Workflow (9 Steps)

### Step 0: Configuration

Collect configuration parameters. Output `_convert/config.json`.

| Parameter | Default | Description |
|---|---|---|
| `link_format` | `wikilink` | `[[文件名]]` or `[文件名](路径)` |
| `check_level` | `L2` | `L1` (quick) / `L2` (content diff) / `L3` (visual render) |
| `max_iterations` | `3` | Max check-fix iterations per step |
| `image_type_override` | `{}` | Manual image type override, e.g. `{"图名": "mindmap"}` |
| `version_source` | `xlsx` | Appendix version source: `xlsx` (read version sheet) or `auto` |
| `prd_shell_sections` | see below | PRD shell sections to supplement |

**`prd_shell_sections`** (only sections NOT already in xlsx are added):
- Pre-body: 文档信息 / 目录 / 背景与目标
- Post-body: 非功能需求 / 术语表 / 附录

Output directory: `{xlsx所在目录}/md版本文档整理/` (create if not exists).
Temp directory: `{xlsx所在目录}/_convert/` (for scripts, fragments, SVGs).

### Step 1: Parse xlsx → Three Inventories

Load xlsx with `openpyxl` using **two instances**:
- `rich_text=True` — for cell formatting (bold/strike/color)
- `data_only=True` — for formula cached values

Output three JSON inventories to `_convert/`:

**Inventory A — Sheet Content**: per-sheet list with `sheet_name`, `sheet_index`, `max_row`, `max_col`, `merged_ranges`, and per-cell records (`row`, `col`, `coord`, `type`, `text`, `font`, `number_format`, `cached_value`).

**Inventory B — Images**: per-image record with `sheet`, `filename` (`{sheet名}_{序号}.png`), `anchor_row` (1-based, = `anchor._from.row + 1`), `anchor_col`, `width`, `height`. Extract image bytes via `img._data()` to `images/`.

**Inventory C — Format Stats**: aggregate counts (`bold_count`, `strike_count`, `colors`, `merged_count`, `formula_cells`, `datetime_cells`, `images`) for L2 verification.

**L1 check**: image file count = Inventory B length; each image file size > 0.

> **Rule**: Inventory C is **read-only after Step 1**. Conversion functions (`run_md`/`inline_md`) must be pure (no side effects on inventories); format markers are counted once in the Step 1 parsing loop. (Pitfall #9)

### Step 2: Each Sheet → MD Fragment

Convert each sheet to an independent MD fragment (no integration, no images yet). Store in `_convert/fragments/`.

**Format preservation rules**: see `references/format_rules.md` for the complete mapping table. Key rules:
- Bold → `**text**`; Strike → `~~text~~`; Non-black color → `<span style="color:#XXXXXX">`
- Formula → cached value from `data_only` instance
- DateTime → format per Excel `number_format`
- Merged cell (title) → `###` heading; Merged cell (in-table) → first cell only
- Dual-row header → merge with `<br>`
- Cell `\n` → `<br>` in tables; `|` → `\|`

**Sheet type dispatch**:
- Pure table sheet → markdown table
- Mixed sheet (title + list + table) → `###` headings + ordered lists + tables
- Image-only sheet → output `{{IMAGE:图片名}}` placeholder (replaced in Step 3)

**L1 check**: each fragment file non-empty, UTF-8.

### Step 3: Integrate → MD Document + Insert Images

1. Concatenate fragments by `sheet_index` order from Inventory A.
2. Prefix each sheet with `## N. {sheet名}`.
3. Iterate Inventory B: for each image, locate its sheet section, insert `![图片名](images/图片名.png)` at the position corresponding to `anchor_row`.
4. Add document title `# {xlsx文件名去扩展名}` + blockquote description at top.

**Output**: `{xlsx文件名}.md` in `md版本文档整理/` **plus** `_convert/raw_integrated.md` (raw copy for idempotent Step 7).

**L1 check**: `![...](images/...)` count = Inventory B length; all referenced images exist; sheet section count = Inventory A length.

### Step 4: L2 Content Check + Fix (≤ max_iterations)

**Method**:
1. Parse all tables and non-table text from the generated MD.
2. For each non-empty xlsx cell: normalize (strip `**`/`~~`/`<span>`/`<br>` → plain text), search in MD.
3. Compare format marker counts (bold/strike/color) with Inventory C.

**Convergence strategy**:
```
Round 1: full check → N differences found → fix
Round 2: re-check only Round 1 differences → M found → fix
Round 3: re-check only Round 2 differences → K found → fix
Round 4 (if K>0): STOP, mark remaining as "⚠️ 待人工确认"
```

**Auto-fix rules**: see `references/known_pitfalls.md` for the full fix table. Common fixes:
- Formula column showing `=ROW()-3` → use cached value
- Header `****text****` double-bold → remove duplicate wrapping
- DateTime as `2022-07-11 00:00:00` → reformat per number_format
- Dual-row header missing Chinese row → merge with `<br>`
- Title color lost → add `<span>` color tag

**Output**: corrected MD + `转换核对报告.md` (standalone file with check method, differences, fixes, conclusion).

**L2 check pass**: differences = 0 OR max_iterations reached.

### Step 5: Images → Mermaid / PlantUML (per image, ≤ max_iterations)

For each image in Inventory B:

#### 5a. Determine image type
- Check `image_type_override` first; if present, use it.
- Otherwise, AI multimodal analysis:
  - Central node with radiating branches → `mindmap` → **Mermaid mindmap**
  - Directional flow / state transitions / page navigation / process steps / system architecture / data relationships / interaction sequence / user scenarios → `plantuml` → **PlantUML** (all PlantUML-expressible types)
  - Pure UI screenshot / photo / table screenshot / hand-drawn sketch → `other` → skip (keep original image only)
- If AI uncertain, default to `plantuml` (broadest coverage), mark "⚠️ type待确认".

**PlantUML diagram type selection** (see `references/known_pitfalls.md` for syntax):
| Original image | PlantUML type | Keyword |
|---|---|---|
| Page flow / state machine | State Diagram | `state` |
| Business process / steps | Activity Diagram | `start`/`if`/`fork` |
| Module dependency / architecture | Component Diagram | `component` |
| Object relation / data model | Class Diagram | `class` |
| System interaction / message | Sequence Diagram | `participant`/`->` |
| User roles & features | Use Case Diagram | `usecase`/`actor` |

#### 5b. Write code
- `mindmap` → Mermaid syntax (see pitfalls: `classDef` inside block end, no `root` keyword)
- `plantuml` → PlantUML syntax (see pitfalls: avoid `<<history>>` keyword, use skinparam for colors)

#### 5c. Syntax validation loop (≤ max_iterations)
- **Mermaid**: local `mermaid.parse()` (with jsdom DOM injection) → fallback to `mermaid.ink` online
- **PlantUML**: local `@plantuml/core` parse → fallback to `plantuml.com` online (`~h` HEX encoding: `text.encode("utf-8").hex()`)
- On pass → render SVG → verify SVG contains all key text nodes from original image → if missing, fix code and retry.

#### 5d. Package as MD file
- Filename = image name without extension + `.md` (e.g. `业务流程_1.md`)
- MD structure: `# {图片标题}` → description → original image reference → ` ```mermaid ` or ` ```plantuml ` code block → format check table → syntax check table

**L2 check**: syntax validation passed; SVG contains all key nodes; filename matches image name.

### Step 6: Embed Image-Conversion Links

For each converted image, insert link **above** the image reference in the main MD document:
- `wikilink`: `> 📎 UML 源码：[[图片名]]`
- `standard`: `> 📎 UML 源码：[图片名](图片名.md)`

**L1 check**: link count = number of converted images; each linked MD file exists.

> **Note**: When embedding links, also sync the changes into `_convert/raw_integrated.md` so Step 7 preserves them.

### Step 7: Wrap with PRD Shell

**Core rules**:
- **Version record sheet** → extract to PRD shell "文档信息" section; remove from body.
- **All other sheets** → strictly maintain xlsx original order in body; headings demoted one level (`#`→`##`, `##`→`###`); content text unchanged.

**Operations**:
0. **Read from `_convert/raw_integrated.md`** (not the current main MD) — guarantees idempotency across re-runs. (Pitfall #16)
1. Demote all original MD headings by one level.
2. Extract version record sheet content → PRD shell "文档信息" as revision history table. Use **4 columns**: `版本 | 日期 | 修订人 | 修订内容`, mapped from original columns `日期|版本|编辑内容|创建人`. (Pitfall #15)
3. Insert pre-body shell: `# {项目名} PRD` → `## 文档信息` → `## 目录` → `## 背景与目标` (placeholder if no corresponding sheet).
4. Body: `## 正文` → `### 1. {sheet2}` → `### 2. {sheet3}` → ... (skip version record, renumber from 1).
5. Insert post-body shell: `## 非功能需求` (placeholder) → `## 术语表` (placeholder) → `## 附录`.

**PRD shell template**: see `references/prd_shell_template.md`.

**L1 check**: body sheet order = Inventory A order (minus version record); version record in shell not duplicated in body; character count (excluding headings/whitespace) matches Step 3 output minus version record.

### Step 8: Appendix Generation

Append to PRD document tail:

```markdown
## 附录

### A. 目录结构
（tree of md版本文档整理/, file names as [[文件名]] links）

### B. Sheet → MD 映射表
| 序号 | xlsx Sheet | MD 章节标题 | PRD 位置 | 行数 | 列数 |

### C. 图片 → UML 映射表
| 图片文件名 | 所属Sheet | 锚定行 | 图片类型 | 转换格式 | 输出MD文件 | 语法校验 |
（输出MD文件列用 [[文件名]] 链接）

### D. 转换元数据
- 源文件 / 转换时间(ISO 8601) / Skill版本 / 迭代版本 / 检查级别 / 检查迭代轮数

### E. 已知问题与人工确认项
（unresolved differences marked ⚠️, or "无"）

### F. 核对报告
链接：[[转换核对报告]]
```

**Link rules**: `[[文件名]]` for standalone MD files (main doc, image-conversion docs, check report); plain text for sheet names and .png filenames.

**L1 check**: six subsections (A-F) present; B table rows = sheet count; C table rows = converted image count; all `[[文件名]]` targets exist.

## Global Constraints

1. **Do not modify original content**: Steps 2-6 body text matches xlsx; Step 7 only adjusts heading levels and extracts version record; Step 8 only appends.
2. **Preserve xlsx order**: body sheet order = xlsx sheet order (except version record extracted to shell).
3. **Check convergence cap**: all iterative checks max `max_iterations` rounds; exceed → degrade to "⚠️ 待人工确认" marker, never block.
4. **Temp file isolation**: all temp files in `_convert/`, never pollute delivery directory `md版本文档整理/`.
5. **Validation service degradation chain**: local parse > online render > skip + mark.
6. **File naming**: MD doc = xlsx filename; image MD = image filename; image file = `{sheet名}_{序号}.png`.
7. **UTF-8 encoding**: all output files UTF-8 no BOM, **LF line endings** (`open(path, "w", encoding="utf-8", newline="\n")`) — CRLF breaks cross-platform regex/validation (Pitfall #14).
8. **Link consistency**: `link_format` config determines link format across entire document (including appendix), never mix.

## Resources

### references/
- `format_rules.md` — Complete xlsx→MD format preservation mapping table (bold/strike/color/formula/datetime/merged/dual-header)
- `known_pitfalls.md` — Known pitfalls and auto-fix rules (xlsx parsing, Mermaid syntax, PlantUML syntax, URL encoding, Windows platform, PRD shell)
- `prd_shell_template.md` — PRD shell template (pre-body + body + post-body structure)
- `case_study.md` — Full worked example (AVPL xlsx → PRD) with sheet-type mapping, PRD structure, verification results, and reproduction steps

Load these references when executing the corresponding steps for detailed rules and pitfall avoidance.