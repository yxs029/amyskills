---
name: feishu-cron-reminder
description: >
  Create scheduled reminders for Feishu chats. This skill now delegates to the
  unified AutoClaw IM cron flow; use it when the user asks for Feishu scheduled
  reminders, periodic notifications, cron jobs, or delayed replies.
---

# Feishu Cron Reminder

Feishu scheduled tasks now use the same unified AutoClaw IM cron entry as QQ,
Weixin, DingTalk, and WeCom.

Use `im_remind` first. Do not use the old main-session system-event workaround
and do not manually construct raw `cron` JSON for Feishu IM reminders.

Required behavior:
- Keep the target as the current Feishu conversation by default.
- For fixed text tasks, set `executionMode` to `direct_reply`.
- For flexible tasks that may choose wording or call tools, set `executionMode` to `agent_task`.
- Put the user-requested execution content in `content`.

Example:

```json
{
  "action": "add",
  "name": "feishu-once",
  "time": "1分钟后",
  "content": "只回复「[飞书] once fired at 当前时间」",
  "executionMode": "direct_reply"
}
```
