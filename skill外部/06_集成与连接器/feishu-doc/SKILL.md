---
name: feishu-doc
description: Fetch content from Feishu (Lark) Wiki, Docs, Sheets, and Bitable. Automatically resolves Wiki URLs to real entities and converts content to Markdown.
tags: [feishu, lark, wiki, doc, sheet, document, reader, writer]
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。

### 触发时机（必修 P0-1）
当用户提出本技能覆盖的任务、或明确点名本技能时使用；同一意图的不同说法（改述）也应能触发。


# Feishu Doc Skill

Fetch content from Feishu (Lark) Wiki, Docs, Sheets, and Bitable. Write and update documents.

## Prerequisites

- Install `feishu-common` first.
- This skill depends on `../feishu-common/index.js` for token and API auth.

## Capabilities

- **Read**: Fetch content from Docs, Sheets, Bitable, and Wiki.
- **Create**: Create new blank documents.
- **Write**: Overwrite document content with Markdown.
- **Append**: Append Markdown content to the end of a document.
- **Blocks**: List, get, update, and delete specific blocks.

## Long Document Handling (Unlimited Length)

To generate long documents (exceeding LLM output limits of ~2000-4000 tokens):
1. **Create** the document first to get a `doc_token`.
2. **Chunk** the content into logical sections (e.g., Introduction, Chapter 1, Chapter 2).
3. **Append** each chunk sequentially using `feishu_doc_append`.
4. Do NOT try to write the entire document in one `feishu_doc_write` call if it is very long; use the append loop pattern.

## Usage

```bash
# Read
node index.js --action read --token <doc_token>

# Create
node index.js --action create --title "My Doc"

# Write (Overwrite)
node index.js --action write --token <doc_token> --content "# Title\nHello world"

# Append
node index.js --action append --token <doc_token> --content "## Section 2\nMore text"
```

## Configuration

Create a `config.json` file in the root of the skill or set environment variables:

```json
{
  "app_id": "YOUR_APP_ID",
  "app_secret": "YOUR_APP_SECRET"
}
```

Environment variables:
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
