# Known Pitfalls and Auto-Fix Rules

Pitfalls encountered during xlsx→PRD conversion, with automatic fix strategies.

## v1.1 追加（第一轮测试发现，2026-08-07）

### 9. Inventory C `colors` set-to-list lifecycle conflict
- **Symptom**: `AttributeError: 'list' object has no attribute 'add'` when Step 2 reuses conversion functions.
- **Root cause**: Format-stat functions (`run_md`/`inline_md`) had side effects on `inventory_C["colors"]`; Step 1 serialized it to a list before Step 2 ran.
- **Fix**: Decouple stats from conversion. Make `run_md`/`inline_md` pure functions; count format markers in a dedicated loop inside Step 1 parsing.
- **Rule**: Inventory C is **read-only after Step 1**; later steps must not mutate it.

### 10. Non-string cell values skip font formatting
- **Symptom**: Numeric cell (e.g. priority `2`, orange `#9C5700`) rendered as plain text without `<span>`.
- **Root cause**: `get_val()` routed int/bool/other types through `str()` directly, bypassing `inline_md`.
- **Fix**: Route ALL value types through `inline_md(str(value), cell_font)`.

### 11. Bold and color mutually exclusive in inline_md
- **Symptom**: Cell with bold + color (e.g. data note, blue `#0066FF` + bold) rendered only `**text**`, color lost.
- **Root cause**: Early `return "**%s**"` in the bold branch skipped color handling.
- **Fix**: Stack markers like `run_md`: strike → bold → color, no early return.

### 12. title_md loses color for plain-string headings
- **Symptom**: Plain-string heading cells (e.g. `客户定位1：`, blue `#0070C0` + bold) rendered as `### text` without color.
- **Root cause**: `title_md` used `plain_text()` for non-rich-text values, ignoring cell font.
- **Fix**: Add `cell_font` parameter to `title_md`; for plain values, wrap in color span from font.

### 13. White `#FFFFFF` table headers cause false color mismatch
- **Symptom**: White-font headers (dark background in Excel) counted as missing colors in L2 check.
- **Decision**: `#FFFFFF` white is background-dependent (dark header row); in Markdown tables it is meaningless → **do NOT render, do NOT count**.
- **Fix**: Exclude `FFFFFF` in both `run_md` color handling and inventory C color stats.

### 14. Windows CRLF line endings break cross-platform regex/validation
- **Symptom**: Mermaid code-block regex ```` ```mermaid\n ```` fails to match generated MD files; all files use CRLF.
- **Root cause**: Python `open()` on Windows defaults to text mode → `\n` written as `\r\n`.
- **Fix**: Write ALL output files with `open(path, "w", encoding="utf-8", newline="\n")` (force LF).
- **Rule**: All skill outputs use LF line endings regardless of platform.

### 15. PRD 文档信息 table column count mismatch
- **Symptom**: 文档信息 table has 4-column header but 5-column data rows (extra 序号 column, wrong column order).
- **Root cause**: Version-record row parsed as 5 columns with 序号 output.
- **Fix**: Normalize to 4 columns: `版本 | 日期 | 修订人 | 修订内容`, mapped from original columns `日期|版本|编辑内容|创建人`.

### 16. Step 7 not idempotent — repeated run double-wraps PRD shell
- **Symptom**: Second run of Step 7 reads the already-wrapped PRD; shell headings (文档信息/目录/正文) become body sections and nest again.
- **Root cause**: Step 7 reads the current main MD, which previous runs may have overwritten with PRD output.
- **Fix**: Step 3 also saves the raw integrated doc to `_convert/raw_integrated.md`; Step 6 syncs links into it; Step 7 ALWAYS reads from `raw_integrated.md`. This makes Step 7 idempotent/re-runnable.

## xlsx Parsing Pitfalls

### 1. Formula cells output as formula text
- **Symptom**: Cell with `=ROW()-3` outputs as `=ROW()-3` instead of computed value (e.g. `1`, `2`, `3`...)
- **Root cause**: `openpyxl` with `rich_text=True` returns formula string, not computed value.
- **Fix**: Load a second workbook instance with `data_only=True`; use its cached value. If cache is None (file never opened in Excel), fall back to formula text.
- **Auto-fix rule**: In `get_val()`, check if `value.startswith("=")` → use `wb_val` cached value.

### 2. DateTime displayed as full ISO string
- **Symptom**: `2022-07-11 00:00:00` instead of Excel display `07-11-22`.
- **Root cause**: `str(datetime)` includes time component; Excel display depends on `number_format`.
- **Fix**: Format per `number_format` using token mapping (see `format_rules.md`).
- **Auto-fix rule**: In `get_val()`, if `isinstance(value, (datetime, date))` → `fmt_datetime(value, cell.number_format)`.

### 3. Double-bold headers (`****text****`)
- **Symptom**: Table header shows `****序号****` (four asterisks each side).
- **Root cause**: `get_val()` returns `**text**` (cell font bold), then header construction wraps again with `**`.
- **Fix**: Do NOT re-wrap headers. Use `get_val()` result directly as header cell.
- **Auto-fix rule**: Remove `"**%s**" % md_text` pattern in header construction; use `md_text` directly.

### 4. Dual-row header only captures English row
- **Symptom**: User story table header shows only `Category` instead of `Category<br>类别`.
- **Root cause**: Header construction only reads one row (e.g. row 4), missing the Chinese row (row 5).
- **Fix**: Read both header rows; merge with `<br>`: `"%s<br>%s" % (en, cn)`.
- **Auto-fix rule**: Detect dual-row header by checking if row+1 has same column count and bold font.

### 5. Title color lost in headings
- **Symptom**: `### SRM 2.0 标准版 物料库 功能清单` — blue "物料库" color lost.
- **Root cause**: `plain_text()` strips all formatting from rich text.
- **Fix**: Use `title_md()` which preserves color spans but skips bold (headings are already bold).
- **Auto-fix rule**: Merge adjacent same-color runs to avoid fragmented `<span>` tags.

### 6. Merged cell title not detected
- **Symptom**: Sheet with merged title rows (e.g. A1:L3) outputs without heading.
- **Root cause**: Merged cell value only in top-left; iteration may skip or misplace.
- **Fix**: Check `ws.merged_cells.ranges`; if cell is top-left of merged range → treat as title.

### 7. Image anchor row is 0-based
- **Symptom**: Image inserted at wrong position (off by one).
- **Root cause**: `anchor._from.row` is 0-based; sheet rows are 1-based.
- **Fix**: `anchor_row = anchor._from.row + 1`.

### 8. Permission denied when overwriting SVG files
- **Symptom**: `PermissionError` when saving rendered SVG to same path multiple times.
- **Root cause**: File handle not released or sandbox trash restriction.
- **Fix**: Save to unique filename (append timestamp) or use `shutil.move()` to temp dir.

## Mermaid Syntax Pitfalls

### 1. `root` keyword causes "Unknown diagram error"
- **Symptom**: `mindmap\n  root((text))\n    child` → parse error.
- **Fix**: Remove `root` keyword; first indented node is automatically root:
  ```
  mindmap
    text
      child
  ```

### 2. `((text))` circle syntax for root fails
- **Symptom**: `((AVPL业务流程))` as first line → error.
- **Fix**: Use plain text as root (default shape is rounded rectangle):
  ```
  mindmap
    AVPL业务流程
      child
  ```

### 3. `classDef` outside mindmap block → "only one root"
- **Symptom**: `classDef` after `mindmap` block → "There can be only one root. No parent could be found for classDef".
- **Fix**: Place `classDef` **inside** the mindmap block as the last child node:
  ```
  mindmap
    Root:::rootStyle
      child1
      child2
      classDef rootStyle fill:#1FA862
  ```

### 4. Mermaid 11 requires DOM for `parse()`
- **Symptom**: `mermaid.parse(code)` → "DOMPurify.addHook is not a function".
- **Fix**: Inject jsdom before calling parse:
  ```js
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // ... set other globals
  ```

### 5. `navigator` is read-only in Node 22
- **Symptom**: `Cannot set property navigator of #<Object> which has only a getter`.
- **Fix**: Use `Object.defineProperty`:
  ```js
  try { Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true }); } catch {}
  ```

### 6. jsdom lacks `SVGElement.getBBox()`
- **Symptom**: `text2.getBBox is not a function` during `mermaid.render()`.
- **Root cause**: jsdom does not implement SVG layout measurement.
- **Fix**: Use `mermaid.parse()` (syntax-only, no rendering) for validation. For visual rendering, use online service or real browser.

## PlantUML Syntax Pitfalls

### 1. `<<history>>` stereotype conflicts with built-in keyword
- **Symptom**: 4th state node with `<<history>>` stereotype not rendered; other 3 states fine.
- **Root cause**: `history` is a PlantUML built-in keyword (UML history pseudo-state).
- **Fix**: Rename stereotype to avoid keywords: `<<history>>` → `<<hist>>`.
- **Keywords to avoid**: `history`, `deepHistory`, `start`, `end`, `fork`, `join`, `choice`, `entry`, `exit`.

### 2. PlantUML URL encoding — base64 character table mismatch
- **Symptom**: PlantUML server returns "This URL does not look like DEFLATE data" or "HUFFMAN data".
- **Root cause**: PlantUML uses custom base64 table `0-9A-Za-z-_` (not standard `A-Za-z0-9+/`).
- **Fix**: Use `~h` HEX encoding (no compression, most stable):
  ```python
  encoded = code.encode("utf-8").hex()
  url = f"https://www.plantuml.com/plantuml/svg/~h{encoded}"
  ```

### 3. URL prefix mapping
- `~1` = HUFFMAN (new default)
- `~2` = DEFLATE (zlib stream)
- `~h` = HEX (no compression, most reliable)
- No prefix = legacy DEFLATE (may not work on new servers)

### 4. `@plantuml/core` is browser-only API
- **Symptom**: `render()` expects DOM element; `renderToString()` needs callback.
- **Root cause**: `@plantuml/core` is TeaVM-compiled browser engine.
- **Fix**: In Node, use `renderToString(lines, onSuccess, onError)` with jsdom + `viz-global.js` loaded. Note: layout rendering still fails on jsdom (no `getBBox`), but syntax parsing succeeds (check for `StateDiagramFactory` in logs).

### 5. `note right of` with `====` separator
- **Syntax**: Use `====` to separate sections within a note:
  ```
  note right of State
  **Section 1:**
  - item
  ====
  **Section 2:**
  - item
  end note
  ```

### 6. State diagram `data-diagram-type` shows "CLASS"
- **Symptom**: PlantUML SVG header shows `data-diagram-type="CLASS"` for a state diagram.
- **Root cause**: PlantUML state diagrams are internally rendered via class diagram engine.
- **Note**: This is normal; verify by checking for `data-qualified-name` attributes matching state names.

## Validation Service Degradation Chain

| Service | Primary | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Mermaid syntax | Local `mermaid.parse()` + jsdom | `mermaid.ink` online | Skip + mark ⚠️ |
| Mermaid render | Local `mermaid.render()` (needs browser) | `mermaid.ink` online | Skip visual check |
| PlantUML syntax | Local `@plantuml/core` parse | `plantuml.com` online (`~h` HEX) | Skip + mark ⚠️ |
| PlantUML render | `plantuml.com` online (`~h` HEX) | Local `@plantuml/core` (jsdom, limited) | Skip visual check |

## Auto-Fix Decision Table

| Check Difference | Auto-Fix Action | Max Retries |
|---|---|---|
| Formula as text | Switch to `data_only` cached value | 1 |
| Double-bold header | Remove `**` wrapping in header construction | 1 |
| DateTime full ISO | Reformat per `number_format` | 1 |
| Missing Chinese header row | Merge with `<br>` | 1 |
| Lost title color | Use `title_md()` with color span | 1 |
| Mermaid syntax error | Apply pitfall fix from table above | 3 |
| PlantUML syntax error | Apply pitfall fix from table above | 3 |
| SVG missing key nodes | Fix code to include all original text | 3 |
| Unresolved after max_iterations | Mark "⚠️ 待人工确认" in report | — |