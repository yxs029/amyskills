# Format Preservation Rules: xlsx → MD

Complete mapping table for converting Excel cell formats to Markdown.

## Inline Text Formatting

| xlsx Format | MD Mapping | Notes |
|---|---|---|
| Cell-level bold (`font.bold=True`) | `**text**` | Wrap entire cell text |
| Rich text run bold (`TextBlock.font.bold`) | `**text**` | Wrap individual run |
| Strikethrough (`font.strike=True`) | `~~text~~` | Preserve even if original has none |
| Non-black font color (`font.color.rgb != FF000000`) | `<span style="color:#XXXXXX">text</span>` | Strip `FF` prefix; black not rendered |
| Theme color index (non-string rgb) | No color tag | Cannot resolve; skip |
| Cell-level color (non-bold cell) | `<span style="color:#XXXXXX">text</span>` | Same as rich text |

## Cell Value Types

| xlsx Type | MD Mapping | Notes |
|---|---|---|
| Plain string | `str(value)` | Direct |
| Rich text (`CellRichText`) | Concatenate `run_md(block.text, block.font)` per block | See inline rules above |
| Formula (`str.startswith("=")`) | Use `data_only=True` cached value | If cache is None, output formula as-is |
| DateTime | Format per `number_format` | See datetime formatting below |
| Number | `str(value)` | Direct |
| Boolean | `str(value)` | Direct |

## DateTime Formatting

Map Excel `number_format` tokens to Python `strftime`:

| Excel Token | Python Token | Example |
|---|---|---|
| `yyyy` | `%Y` | 2022 |
| `yy` | `%y` | 22 |
| `mmmm` | `%B` | July |
| `mmm` | `%b` | Jul |
| `mm` | `%m` | 07 |
| `dd` | `%d` | 11 |
| `hh` | `%H` | 00 |
| `ss` | `%S` | 00 |

**Algorithm**:
1. If datetime has zero time component, treat as date only.
2. If `number_format` contains date tokens (`yyyy`/`yy`/`mm`/`dd`), replace tokens left-to-right (longest first: `mmmm` before `mm`).
3. Strip quote characters from format string.
4. If no date tokens in format, default to `%Y-%m-%d`.

**Example**: `datetime(2022,7,11)` with format `mm-dd-yy` → `07-11-22`.

## Merged Cells

| Merged Cell Pattern | MD Mapping | Notes |
|---|---|---|
| Title row (merged across columns, bold) | `### text` heading | Use top-left cell value |
| Subtitle row (merged, bold) | `**text**` bold paragraph | |
| In-table merged (vertical/horizontal) | Output in first cell only | Remaining cells empty |
| Multi-row merged title (e.g. A1:L3) | `### text` single heading | Extract from top-left |

## Table Headers

| Header Pattern | MD Mapping | Notes |
|---|---|---|
| Single-row header (bold) | `**header1** \| **header2**` | Bold via `get_val` (already has `**`) |
| Dual-row header (English + Chinese) | `**English**<br>**Chinese**` | Merge two rows with `<br>` |
| Header with trailing space | Preserve space in cell | Do not strip |

**Important**: Do NOT double-wrap headers with `**`. If `get_val` already returns `**text**` (because cell font is bold), use it directly without additional wrapping.

## Table Cell Escaping

| Character | Escape Rule |
|---|---|
| `\|` (pipe) | `\|` (backslash-pipe) |
| `\n` (newline in cell) | `<br>` (in table context) |
| `\n` (newline in paragraph) | Preserve as line break |

## Sheet Type Detection

| Sheet Pattern | MD Structure | Example |
|---|---|---|
| Pure table (header row + data rows) | Markdown table | 版本记录, 功能清单 |
| Mixed (title + list + table) | `###` headings + ordered list + table | 客户&业务定位 |
| Image-only (one image, minimal text) | `{{IMAGE:图片名}}` placeholder | 页面流转图 |
| Image + notes (image + side text) | Image placeholder + notes paragraph | 业务流程 |

## Title Extraction

| Source | Method |
|---|---|
| Merged cell range (top-left) | `plain_text(cell.value).strip()` |
| Rich text title (all bold) | `title_md(value)` — preserve color span, ignore bold (heading is already bold) |
| Adjacent same-color runs | Merge into single `<span>` to avoid fragmentation |

## Inline MD Helper Functions

```
run_md(text, font):
    if font.strike: text = "~~" + text + "~~"
    if font.bold:   text = "**" + text + "**"
    color = font_color_hex(font)  # None if black
    if color: text = '<span style="color:#' + color + '">' + text + '</span>'
    return text

title_md(value):  # for headings — preserve color, skip bold
    merge adjacent same-color runs
    wrap each non-black run in <span>
    skip ** (heading already bold)
    return concatenated text
```