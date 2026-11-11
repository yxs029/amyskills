---
name: feishu-cron-reminder
description: >
  Create scheduled reminders for Feishu chats. This skill now delegates to the
  unified AutoClaw IM cron flow; use it when the user asks for Feishu scheduled
  reminders, periodic notifications, cron jobs, or delayed replies.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


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
