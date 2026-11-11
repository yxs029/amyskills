## 异步任务流程

> ⚠️ **必须遵循的体验流程**：链接笔记和图片笔记是异步生成的，必须按以下方式与用户沟通。

### 链接笔记完整流程

**步骤 1**：提交任务
```
POST /open/api/v1/resource/note/save {note_type:"link", link_url:"https://..."}
```
返回 task_id 后，**立即发消息给用户**：
> ✅ 链接已保存，正在抓取原文和生成总结，稍后告诉你结果...

> ⚠️ **重复链接处理**：若响应中包含 `duplicate_count > 0` 且没有 `task_id`，说明该链接已存在于你的笔记中，无需轮询，直接告知用户「该链接已存在于你的笔记中」。

**步骤 2**：后台轮询（10-30 秒间隔）
```
POST /open/api/v1/resource/note/task/progress {task_id} → 直到 status=success/failed
```

**步骤 3**：任务完成后，**调详情接口展示价值**
```
GET /open/api/v1/resource/note/detail?id={note_id}
```
然后发第二条消息，包含具体内容：
> ✅ 笔记生成完成！
> - 📄 **原文**：已保存 {web_page.content 字数} 字
> - 📝 **总结**：{content 内容，即 AI 生成的摘要}
> - 🔗 **来源**：{web_page.url}

### 图片笔记完整流程

**步骤 1-3**：获取凭证 → 上传 OSS → 提交任务
```
1. GET /open/api/v1/resource/image/upload_token?mime_type=jpg → 获取上传凭证
2. POST {host} 上传文件到 OSS
3. POST /open/api/v1/resource/note/save {note_type:"img_text", image_urls:[access_url]} → 返回 task_id
```
拿到 task_id 后，**立即发消息给用户**：
> ✅ 图片已保存，正在识别内容，稍后告诉你结果...

**步骤 4**：后台轮询
```
POST /open/api/v1/resource/note/task/progress {task_id} → 直到 status=success/failed
```

**步骤 5**：任务完成后，**调详情接口展示价值**
```
GET /open/api/v1/resource/note/detail?id={note_id}
```
然后发第二条消息：
> ✅ 图片笔记生成完成！
> - 📝 **识别内容**：{content 内容}
> - 🏷️ **标签**：{tags}

### 图片上传凭证

```
GET /open/api/v1/resource/image/upload_token?mime_type=jpg&count=1
```

参数：
- mime_type: jpg | png | gif | webp，默认 png
- count: 需要的 token 数量，默认 1，最大 9

⚠️ **mime_type 必须与实际文件格式一致**，否则 OSS 签名失败。

返回字段说明见 [references/api-details.md](08AI操作系统/MySkills/Manus生成微信文章技能/Get笔记-Manus适用/references/api-details.md)。

### OSS 上传示例

> ⚠️ **字段顺序必须严格遵守**，否则 OSS 签名验证失败。正确顺序：`key → OSSAccessKeyId → policy → signature → callback → Content-Type → file`

```bash
curl -X POST "$host" \
  -F "key=$object_key" \
  -F "OSSAccessKeyId=$accessid" \
  -F "policy=$policy" \
  -F "signature=$signature" \
  -F "callback=$callback" \
  -F "Content-Type=$oss_content_type" \
  -F "file=@/path/to/image.jpg"
```

---

