---
name: defuddle
description: Extract clean Markdown from HTML pages with Defuddle CLI.
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


# Defuddle

Use Defuddle CLI to extract clean readable content from web pages. Prefer over WebFetch for standard web pages — it removes navigation, ads, and clutter, reducing token usage.

If not installed: `npm install -g defuddle`

## Usage

Always use `--md` for markdown output:

```bash
defuddle parse <url> --md
```

Save to file:

```bash
defuddle parse <url> --md -o content.md
```

Extract specific metadata:

```bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## Output formats

| Flag | Format |
|------|--------|
| `--md` | Markdown (default choice) |
| `--json` | JSON with both HTML and markdown |
| (none) | HTML |
| `-p <name>` | Specific metadata property |
