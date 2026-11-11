## 笔记整理

### 添加标签

```
POST /open/api/v1/resource/note/tags/add
Content-Type: application/json
```

请求体：
```json
{
  "note_id": 123456789,
  "tags": ["工作", "重要"]
}
```

**标签类型 type**：
- ai - AI 自动生成
- manual - 用户手动添加
- system - 系统标签（**不可删除**）

---

### 删除标签

```
POST /open/api/v1/resource/note/tags/delete
Content-Type: application/json
```

请求体：
```json
{
  "note_id": 123456789,
  "tag_id": "123"
}
```

⚠️ system 类型标签不允许删除。

---

### 知识库列表

```
GET /open/api/v1/resource/knowledge/list?page=1
```

参数：
- page: 页码，从 1 开始，默认 1（固定每页 20 条）

返回：topics[], has_more, total

每个 topic 包含：
- `topic_id` / `topic_id_alias`：知识库 ID
- `name`、`description`、`cover`
- `created_at` / `updated_at`：时间字符串（YYYY-MM-DD HH:MM:SS）
- `stats`：统计数据
  - `note_count`：笔记数
  - `file_count`：文件数
  - `blogger_count`：订阅博主数
  - `live_count`：已完成直播数

---

### 创建知识库

```
POST /open/api/v1/resource/knowledge/create
Content-Type: application/json
```

请求体：
```json
{
  "name": "知识库名称",
  "description": "描述",
  "cover": ""
}
```

⚠️ 每天最多创建 50 个知识库（北京时间 00:00 重置）。

---

### 知识库笔记列表

```
GET /open/api/v1/resource/knowledge/notes?topic_id=abc123&page=1
```

参数：
- topic_id (string, 必填) - 知识库 ID（alias id）
- page: 页码，从 1 开始

每页固定 20 条，用 has_more 判断是否有下一页。

---

### 知识库选择逻辑

当用户说「存到对应的知识库」或「存到相关知识库」时：
1. 先调用 GET /knowledge/list 获取所有知识库列表
2. 根据笔记标题、内容、标签，与知识库名称和描述做模糊匹配
3. 匹配置信度高时直接执行，并告知用户存入了哪个知识库
4. 置信度低或有歧义时，列出候选知识库让用户选择
5. 用户未提及知识库时，**不要擅自存入**任何知识库

---

### 添加笔记到知识库

```
POST /open/api/v1/resource/knowledge/note/batch-add
Content-Type: application/json
```

请求体：
```json
{
  "topic_id": "abc123",
  "note_ids": [123456789, 123456790]
}
```

⚠️ 每批最多 20 条。已存在的笔记会跳过。

---

### 从知识库移除笔记

```
POST /open/api/v1/resource/knowledge/note/remove
Content-Type: application/json
```

请求体：
```json
{
  "topic_id": "abc123",
  "note_ids": [123456789]
}
```

---

