---
name: autoglm-generate-image-seedream
description: >
  使用 AutoGLM Seedream 文生图接口，根据用户输入的文字描述生成图片。
  当用户需要生成图片、文字转图片、AI绘图等场景时使用此 skill。
  Token 通过本地服务 http://127.0.0.1:18432/get_token 自动获取，无需手动配置环境变量。
compatibility:
  requires:
    - Python 3、hashlib（内置）
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


# AutoGLM Generate Image Seedream

根据用户输入的文字描述，调用 AutoGLM Seedream 文生图 API 生成图片并返回图片链接。

---

## API

| 项目 | 内容 |
|------|------|
| 地址 | `https://autoglm-api.zhipuai.cn/agentdr/v1/assistant/skills/generate-image-seedream` |
| 方式 | POST |
| 请求体 | `{"query": "<描述>"}` |

脚本启动时会先向本地服务发起 HTTP GET 请求获取 token：

| 项目 | 内容 |
|------|------|
| 地址 | `http://127.0.0.1:18432/get_token` |
| 方式 | GET |
| 返回 | `Bearer xxx`（直接作为 Authorization 头使用） |

> 若返回值不含 `Bearer` 前缀，脚本会自动补全。

**签名 Headers（每次动态生成）：**

- `X-Auth-Appid`: `100003`
- `X-Auth-TimeStamp`: 当前秒级 Unix 时间戳
- `X-Auth-Sign`: MD5(`100003 + "&" + timestamp + "&" + 38d2391985e2369a5fb8227d8e6cd5e5`)

---

## 执行脚本

使用同目录下的 `generate-image-seedream.py`：

```bash
python generate-image-seedream.py "大海草原"
```

---

## 返回结果处理

### 响应结构

```json
{
  "code": 0,
  "msg": "SUCCESS",
  "data": {
    "image_url": "https://..."
  }
}
```

### 输出要求

1. 从响应中提取 `data.image_url`
2. 以 Markdown 图片格式展示给用户：

```markdown
![生成图片](image_url)
```
