## 核心功能：记笔记 & 查笔记

### 笔记列表

```
GET /open/api/v1/resource/note/list?since_id=0
```

参数：
- since_id (int64, 必填) - 游标，首次传 0，后续用 next_cursor

返回：notes[], has_more, next_cursor, total（每次固定 20 条）

> ⚠️ **响应 JSON 可能包含未转义的控制字符**（笔记 content 中的原始换行符），建议用支持容错解析的 JSON 库处理，或在解析前对 content 字段做预处理。

> ⚠️ **`id`、`next_cursor`、`parent_id` 均为 int64**，JavaScript 环境必须在 `JSON.parse` 前做字符串化处理（见「笔记 ID 处理规则」）。**务必用字符串保存这些值**，不要做数值运算，后续调详情、加知识库等操作直接透传字符串即可。

**笔记类型 note_type**：
- `plain_text` - 纯文本
- `img_text` - 图片笔记
- `link` - 链接笔记
- `audio` - 即时录音
- `meeting` - 会议录音
- `local_audio` - 本地音频
- `internal_record` - 内录音频
- `class_audio` - 课堂录音
- `recorder_audio` - 录音卡长录
- `recorder_flash_audio` - 录音卡闪念

---

### 笔记详情

```
GET /open/api/v1/resource/note/detail?id={note_id}
```

参数：id (int64, 必填) - 笔记 ID

**详情独有字段**（列表不返回）：`audio.original`、`audio.play_url`、`audio.duration`、`web_page.content`、`web_page.url`、`web_page.excerpt`、`attachments[]`。详见 [references/api-details.md](08AI操作系统/MySkills/Manus生成微信文章技能/Get笔记-Manus适用/references/api-details.md)。

---

### 新建笔记

```
POST /open/api/v1/resource/note/save
Content-Type: application/json
```

**仅支持新建，不支持编辑**。

请求体：
```json
{
  "title": "笔记标题",
  "content": "Markdown 内容",
  "note_type": "plain_text",
  "tags": ["标签1", "标签2"],
  "parent_id": 0,
  "link_url": "https://...",
  "image_urls": ["https://..."]
}
```

- `plain_text`：同步返回，立即完成
- `link` / `img_text`：返回 task_id，**必须轮询** /task/progress

详细字段说明见 [references/api-details.md](08AI操作系统/MySkills/Manus生成微信文章技能/Get笔记-Manus适用/references/api-details.md)。

---

### 查询任务进度

```
POST /open/api/v1/resource/note/task/progress
Content-Type: application/json
```

请求体：
```json
{"task_id": "task_abc123xyz"}
```

返回：
- status: pending | processing | success | failed
- note_id: 成功时返回笔记 ID
- error_msg: 失败时返回错误信息

> ⚠️ **note_id 是 int64**，JavaScript 环境须按「笔记 ID 处理规则」做字符串化，拿到后直接当字符串透传。

**建议 10-30 秒间隔轮询，直到 success 或 failed**。

---

### 删除笔记

```
POST /open/api/v1/resource/note/delete
Content-Type: application/json
```

请求体：
```json
{"note_id": 123456789}
```

笔记移入回收站，需要 note.content.trash scope。

---

