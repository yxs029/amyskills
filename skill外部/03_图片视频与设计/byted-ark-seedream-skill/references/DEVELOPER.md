# Seedream Agent 开发指南

本文档面向 Agent 开发者，包含图片预处理、脚本调用方式与结果展示。

运行时模型清单来自 `generate.js --list-models`。下文 Flash / Pro 的限制是内置基线，新增模型按已发布配置校验。动态配置与维护流程见 [MODEL_REGISTRY.md](MODEL_REGISTRY.md)。

---

## 🖼️ 图片预处理（Agent 层负责）

Skill 接受以下格式的参考图片文件，Agent 层需要负责转换：

### 支持的格式
```javascript
// 1. Base64 Data URI（推荐）
"data:image/jpeg;base64,/9j/4AAQSkZJRg..."
"data:image/png;base64,iVBORw0KGgo..."

// 2. HTTP/HTTPS URL（需要公网可访问）
"https://example.com/image.jpg"
```

**图片限制：** 按所选模型和场景执行 [MODELS.md](MODELS.md) 的限制；Flash / Pro 最多10张，拆图层/透明编辑恰好1张。

---

## 📝 调用脚本方式

### 方式一：单张图片生成
```bash
# 基本用法
node scripts/generate.js --prompt "一只可爱的小猫"

# 完整参数
node scripts/generate.js \
  --prompt "一只可爱的小猫" \
  --size "2K" \
  --mode "text-to-image" \
  --watermark true \
  --optimize true \
  --response_format "jpeg"
```

**输出示例（JSON）：**
```json
{
  "success": true,
  "images": [
    {
      "url": "https://ark.example.com/images/xxx.jpg",
      "local_path": "/Users/xxx/Desktop/Seedream-Images/2026-04-27/seedream_123456_1.jpg",
      "width": 2048,
      "height": 2048
    }
  ],
  "metadata": {
    "generation_time": 12.5,
    "size": "2K",
    "mode": "text-to-image",
    "image_count": 1
  }
}
```

---

### 方式二：图层拆分

```bash
node scripts/generate.js --model flash --layer_decomposition true \
  --reference_images '["https://example.com/poster.png"]'
```

Flash / Pro 都支持拆图层。所有资源一次性返回，底图和透明图层须按实际格式保存；保留 `z_index` 和 `bounding_box` 等 metadata。当前模型不支持连贯组图和流式输出，不能把多张图层当作连贯组图。

---

## 🎯 Agent 层结果展示规范（重要）

Skill 采用 stderr / stdout 分离设计：

| 输出流 | 内容 | 用途 | Agent 层处理方式 |
|--------|------|------|------------------|
| **stderr** | 生成进度、日志、提示信息 | 人类可读的实时反馈 | 逐行打印给用户看 |
| **stdout** | 最终 JSON 结果（含图片链接） | Agent 解析使用 | 不要直接打印，要解析后结构化展示 |

### ✅ 正确的处理流程

```javascript
// 1. 分别捕获 stderr 和 stdout
const { stderr, stdout } = await execAsync('node scripts/generate.js --prompt "xxx"');

// 2. stderr 直接逐行展示给用户（实时进度反馈）
showToUser(stderr);

// 3. stdout 解析 JSON，然后格式化展示最终结果
const result = JSON.parse(stdout);

// 4. 最终结果：必须展示图片文件给用户！
if (result.success && result.images) {
  for (const img of result.images) {
    if (img.download_success) {
      // ✅ 重点：把本地文件发送给用户（不要只发路径字符串）
      sendFileToUser(img.local_path);
      // 可以同时展示在线链接
      sendTextToUser(`🔗 在线链接: ${img.url}`);
    } else {
      sendTextToUser(`❌ 第 ${img.index} 张下载失败: ${img.download_error}\n🔗 原始链接: ${img.url}`);
    }
  }
}
```

### ❌ 常见错误

- 只展示 stderr，不解析 stdout JSON → 用户看不到图片链接/文件
- 把 stdout JSON 直接打印给用户 → 用户看到乱码
- 只展示在线链接，不读取本地文件发送 → 用户体验差

---

## 🔌 支持的原生 API 接口

### 文生图 / 图生图 / 图层拆分（统一接口）
```http
POST https://ark.cn-beijing.volces.com/api/plan/v3/images/generations
Content-Type: application/json
Authorization: Bearer ark-xxx

{
  "model": "doubao-seedream-5-0-flash",
  "prompt": "一只可爱的小猫",
  "size": "2K",
  "response_format": "url"
}
```

请求体由 `buildRequestBody` 构造。内置 Flash / Pro 不发送 `stream`、`tools`、`sequential_image_generation`；后续兼容模型只有声明相应能力才启用这些字段。当前执行器不发送 `reference_strength` 或后付费组图数量字段。已发布的扩展标量参数经过类型/枚举/范围校验后透传。

---

## ⚠️ 错误处理建议

Agent 层应该处理以下常见错误：

| 错误类型 | 建议处理 |
|----------|---------|
| API Key 未配置 | 指导用户在本地配置 ARK_API_KEY，不要求在聊天中提供密钥；临时 Key 默认不保存 |
| 网络错误 | 返回错误；生成请求不自动重试，避免重复生成 |
| 图片下载失败 | 返回生成的在线 URL，提示用户手动保存 |
| 参数不合法 | 请求前校验；不静默改变用户要求 |
