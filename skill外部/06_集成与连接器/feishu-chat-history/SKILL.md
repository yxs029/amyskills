---
name: feishu-chat-history
description: >
  Fetch and summarize Feishu group chat history. Use when the user asks
  to read, review, or summarize messages from a Feishu group chat.
  Triggers: "看群聊记录", "群里聊了啥", "帮我看看这个群", "群消息历史",
  "chat history", "what did the group discuss".
  NOT for: sending messages (use message tool), reading documents
  (use feishu-doc skill), or wiki operations (use feishu-wiki skill).
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


# Feishu Chat History

Fetch message history from a Feishu group chat and summarize or present it to the user.

## When to Use

- User asks what was discussed in a group
- User wants a summary or review of recent messages
- User provides a chat_id or is in a group and asks about its history

## How to Fetch Messages

Use the Feishu IM API directly via Python. See `references/api.md` for full details.

**Quick summary:**
1. Read credentials from config → `channels.feishu.appId` / `appSecret`
2. Get `tenant_access_token` via `POST /auth/v3/tenant_access_token/internal`
3. Fetch messages via `GET /im/v1/messages?container_id_type=chat&container_id={chat_id}&page_size=50`

## Identifying the chat_id

- If the user is asking about the **current group chat**, use the `chat_id` from the inbound metadata (`chat:oc_xxxxx` → strip the `chat:` prefix to get the raw ID)
- If the user provides a different group, ask for the chat_id

## Presenting Results

Parse each message and present a clean summary:
- Filter out `msg_type=system` (join/leave events) unless relevant
- For `msg_type=text`: extract `.body.content` as JSON, get the `text` field
- For `msg_type=interactive`: extract text nodes from the `elements` array
- For `msg_type=image`: note as `[图片]`
- Include sender name (from `mentions` or known bot app_ids), timestamp, and content
- Group by thread if `root_id` is present
- End with a human-readable summary of topics discussed

## Pagination

If `has_more=true`, fetch more pages using `page_token`. Default: fetch 1 page (50 messages). Ask user if they want more.
