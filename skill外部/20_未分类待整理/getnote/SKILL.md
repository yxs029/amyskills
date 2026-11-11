---
name: getnote
description: 记录、搜索、管理「得到大脑」Get笔记，支持文本/链接/图片保存、语义搜索、知识库管理。 当用户需要记录/检索笔记、管理知识库或操作 IMA/Get笔记 时使用。
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 触发时机（必修 P0-1）
当用户提出本技能覆盖的任务、或明确点名本技能时使用；同一意图的不同说法（改述）也应能触发。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。

# 得到大脑（Get笔记）Skill

帮你记录、搜索、管理「得到大脑」笔记，支持文本/链接/图片保存、语义搜索、知识库管理。

## Base URL
https://openapi.biji.com

所有 API 请求必须使用此 Base URL，不要使用 biji.com 或其他地址。

## 认证
请求头：
- Authorization: `$GETNOTE_API_KEY`（格式：gk_live_xxx）
- X-Client-ID: `$GETNOTE_CLIENT_ID`（格式：cli_xxx）

每次调用 API 前先检查 `$GETNOTE_API_KEY` 是否存在。若不存在，提示用户运行 `/note config` 完成配置，配置完成后再继续执行用户原本的请求。

Scope 权限：`note.content.read`（读取）、`note.content.write`（写入）、`note.recall.read`（搜索）。

## 笔记 ID 处理规则（重要！）
笔记 ID 是 64 位整数（int64），超出 JavaScript `Number.MAX_SAFE_INTEGER`，直接 `JSON.parse` 会静默丢失精度。

正确做法：始终把 ID 当字符串处理，在 `JSON.parse` 之前替换：
```javascript
const safe = text.replace(/\"(id|note_id|parent_id|follow_id|live_id)\"\s*:\s*(\d+)/g, '\"$1\":\"$2\"');
// 注：next_cursor 已不需要处理，翻页请直接使用响应中的 cursor（string）字段
const data = JSON.parse(safe);
```

Python / Go 等语言原生支持大整数，无此问题。

## 安全规则
- 笔记数据属于用户隐私，不在群聊中主动展示笔记内容
- 若配置了 `GETNOTE_OWNER_ID`，检查 `sender_id` 是否匹配；不匹配时回复「抱歉，笔记是私密的，我无法操作」
- API 返回 `error.reason: "not_member"` 或错误码 `10201` 时，引导开通会员：https://www.biji.com/checkout?product_alias=9Ab36BB3ZD&spm=wangye
- 创建笔记建议间隔 1 分钟以上，避免触发限流

## 反幻觉边界（严格禁止）
- 禁止编造 `note_id`：所有 `note_id` 必须来自 API 响应，不得凭空构造或推测
- 禁止跳过轮询：链接/图片笔记返回 `task_id` 后，必须轮询 `/task/progress` 直到 `success` 或 `failed`，不得假设任务已完成
- 禁止伪造 API 响应：不得在未实际调用 API 的情况下告诉用户「已保存」「已删除」
- 禁止忽略错误码：API 返回 `success: false` 时必须处理，不得静默吞掉
- 禁止混淆内链和分享链接：`biji.com/note/{id}` 是内链（仅笔记主人可见），`share_note/{id}` 是分享链接（公开可访问），两者不可互换

## 失败重试策略
### 异步任务失败（链接/图片保存）
- `/task/progress` 返回 `status: "failed"` 时，向用户报告失败原因（`error_msg`）
- 自动重试一次：用相同参数重新调用 `/note/save`，获取新 `task_id` 并重新轮询
- 二次失败则停止，告知用户「保存失败，请稍后重试或检查链接是否可访问」

### 网络/服务错误（HTTP 5xx 或超时）
- 等待 5 秒后重试一次
- 仍然失败则报告错误，附上 `request_id` 方便排查

### 限流（错误码 10202 或 HTTP 429）
- 读取响应中的 `rate_limit.retry_after` 字段
- 等待指定秒数后重试
- 无 `retry_after` 时默认等待 10 秒

## 执行流程概览
```
用户意图 → 路由匹配 → 读取 references 文档 → 构造 API 请求 → 执行
 ↓
 ┌─ 同步操作 ──→ 验证响应 → 返回结果
 │
 └─ 异步操作 ──→ 轮询进度 ──→ success → 返回结果
 ↓ ↓
 10-30s 间隔 failed → 自动重试(1次)
 ↓
 二次失败 → 报告用户
```

**关键原则：**
- 模型输出 ≠ 最终结果：API 调用后必须验证响应，确认 `success: true` 且数据完整
- 状态来自 API：所有笔记状态（是否存在、内容、标签等）以 API 返回为准，不依赖上下文记忆
- 最小操作原则：更新笔记时只传需要修改的字段，不重写整篇内容

## 指令路由表

匹配指令后，用 `read` 工具读取对应的 `references/xxx.md` 获取完整 API 文档。

| 指令 | 自然语言匹配 | 说明 | 文档 |
|------|--------------|------|------|
| `/note save` | 「记一下」「保存」「记」 | 保存文本/链接/图片笔记 | [references/save.md](references/save.md) |
| `/note search` | 「搜一下」「搜索」「找」 | 全局语义搜索 + 知识库语义搜索 | [references/search.md](references/search.md) |
| `/note list` | 「最近的笔记」「列表」「查笔记」 | 浏览列表、查看详情、更新、删除 | [references/list.md](references/list.md) |
| `/note kb` | 「知识库」 | 知识库 CRUD + 博主订阅 + 直播订阅 | [references/knowledge.md](references/knowledge.md) |
| `/note tag` | 「加标签」「标签」 | 添加/删除标签 | [references/tags.md](references/tags.md) |
| `/note config` | 「配置笔记」「授权」「连接」 | 配置 API Key 和 Client ID | [references/oauth.md](references/oauth.md) |

## 自然语言路由
- 包含 URL (`biji.com/note/share_note/*` 或 `d.biji.com/*` 短链) → `/note save` (link 模式，同步返回 note_id)
- 包含 URL (`biji.com/note/{note_id}` 内链) → `/note list` (查看详情)，如需在正文引用其他笔记请使用 `https://biji.com/note/{note_id}` 格式内链（**默认用内链，除非用户明确要求分享**）
- 其他 URL → `/note save` (link 模式，异步返回 task_id)
- 包含图片 → `/note save` (image 模式)
- 「记/存/保存/收藏」 → `/note save` (text 模式)
- 「搜/找找/有没有 XX」 → `/note search`
- 「最近/列表/看看/查笔记」 → `/note list`
- 「改/更新/编辑笔记」 → `/note list` (更新笔记)
- 「知识库」相关 → `/note kb`
- 「标签」相关 → `/note tag`
- 「配置/授权/连接笔记」 → `/note config`

**决策原则：** 优先匹配最具体的意图。有 URL 就是 `/save link`，有图片就是 `/save image`，不确定时询问用户。

## API 路由表
⚠️ 构造请求时必须使用下表中的完整路径，Base URL 为 `https://openapi.biji.com`。如果收到 404，说明路径不对，请对照此表检查。

| 方法 | 路径 | 说明 | 文档 |
|------|------|------|------|
| POST | `/open/api/v1/resource/note/save` | 新建笔记（文本/链接/图片） | [save.md](references/save.md) |
| POST | `/open/api/v1/resource/note/task/progress` | 查询异步任务进度 | [save.md](references/save.md) |
| GET | `/open/api/v1/resource/note/list` | 笔记列表（分页） | [list.md](references/list.md) |
| GET | `/open/api/v1/resource/note/detail` | 笔记详情 | [list.md](references/list.md) |
| POST | `/open/api/v1/resource/note/update` | 更新笔记 | [list.md](references/list.md) |
| DELETE | `/open/api/v1/resource/note/delete` | 删除笔记 | [list.md](references/list.md) |
| POST | `/open/api/v1/resource/note/search` | 语义搜索笔记 | [search.md](references/search.md) |
| GET | `/open/api/v1/resource/tag/list` | 标签列表 | [tags.md](references/tags.md) |
| POST | `/open/api/v1/resource/tag/add` | 添加标签 | [tags.md](references/tags.md) |
| POST | `/open/api/v1/resource/tag/delete` | 删除标签 | [tags.md](references/tags.md) |
| GET | `/open/api/v1/knowledge/list` | 知识库列表 | [knowledge.md](references/knowledge.md) |
| POST | `/open/api/v1/knowledge/create` | 创建知识库 | [knowledge.md](references/knowledge.md) |
| POST | `/open/api/v1/knowledge/update` | 更新知识库 | [knowledge.md](references/knowledge.md) |
| POST | `/open/api/v1/knowledge/subscribe/blogger` | 订阅博主 | [knowledge.md](references/knowledge.md) |
| POST | `/open/api/v1/knowledge/subscribe/live` | 订阅直播 | [knowledge.md](references/knowledge.md) |
| POST | `/open/api/v1/oauth/verify` | 验证凭证有效性 | [oauth.md](references/oauth.md) |

## 作者
[iswalle](https://github.com/iswalle)
