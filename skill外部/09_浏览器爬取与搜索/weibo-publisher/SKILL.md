---
name: weibo-publisher
description: Publish text and image posts to Weibo (m.weibo.cn) using browser automation. Use when the user needs to post content to Weibo programmatically, including text-only posts, image posts, or automated publishing workflows. Requires existing login session via browser cookies.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


# Weibo Publisher

Publish content to Weibo through browser automation on m.weibo.cn (mobile web version).

## Prerequisites

- Browser must be running with valid Weibo login session
- Images must be placed in `/tmp/openclaw/uploads/` before upload
- Requires manual verification after posting (compose page doesn't auto-redirect)

## Publishing Workflow

### 1. Open Compose Page

```
browser open https://m.weibo.cn/compose
```

### 2. Input Text Content

Get snapshot to find textbox ref, then type content:

```javascript
// Example: Post text
browser act kind=type ref=<textbox-ref> text="Your post content here"
```

### 3. Upload Images (Optional)

**Important:** Images must be in `/tmp/openclaw/uploads/` directory.

```bash
# Prepare image (example)
cp /path/to/image.png /tmp/openclaw/uploads/
```

Upload using the upload button ref (not the hidden file input):

```javascript
// Upload image - use the upload button ref
browser upload inputRef=<upload-button-ref> paths=["/tmp/openclaw/uploads/image.png"]

// Wait 2-3 seconds for upload to complete
// Take screenshot to verify preview appears
```

**Verification:** Wait 2-3 seconds, then screenshot to confirm image preview is visible on page.

### 4. Publish Post

Click the send button:

```javascript
browser act kind=click ref=<send-button-ref>
```

### 5. Verify Publication (Critical)

**Do NOT rely on page redirect** - compose page stays open.

Verification steps:
1. Wait 5 seconds for backend processing
2. Navigate to personal page:
   ```
   browser open https://m.weibo.cn
   browser act kind=click ref=<profile-avatar-ref>  // Top-left avatar
   ```
3. Check latest post matches what was just published
4. **Close compose page** to prevent accidental repost:
   ```
   browser action=close targetId=<compose-tab-id>
   ```

### 6. Cleanup (Required)

After successful publication, clean up temporary files:

```bash
# Remove uploaded image from temp directory
rm /tmp/openclaw/uploads/<filename>

# Optional: Clean up browser screenshots older than 7 days
find ~/.openclaw/media/browser/ -type f -mtime +7 -delete
```

**Note:** Temporary files are NOT automatically cleaned up. **Cleanup is required** - always run it after publishing.

## Page Element References

Common refs on m.weibo.cn/compose:
- Text input: `ref=e15` (textbox "分享新鲜事…")
- Send button: `ref=e10` ("发送")
- Image upload button: `ref=e25` or `ref=e29` ( icon)

**Note:** Refs are dynamic - always get fresh snapshot before interacting.

## Error Handling

| Issue | Solution |
|-------|----------|
| Image upload shows "图片选择失败" | File not in `/tmp/openclaw/uploads/`. Move file to correct location. |
| Send button not responding | Check if textbox is empty. Weibo requires at least text or image. |
| Post not appearing after 5s | Wait longer (network delay) or check login status. |

## Anti-Duplication Measures

- Always verify post exists on personal page before considering task complete
- Always close compose tab after successful verification
- If uncertain whether post succeeded, check personal page before retrying

## References

See [references/workflow-examples.md](08AI操作系统/MySkills/Noah的skill最佳实践/weibo-publisher/references/workflow-examples.md) for complete code examples.
