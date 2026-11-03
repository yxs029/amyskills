---
name: autoglm-file-upload
description: >
  使用 AutoGLM Upload Mix 接口上传本地文件（图片、文档等）到服务器，获取文件 URL 或资源 ID，供后续接口使用。
  Token 通过本地服务 http://127.0.0.1:18432/get_token 自动获取，无需手动配置环境变量。
compatibility:
  requires:
    - Python 3、hashlib、mimetypes、uuid（均为内置）
---

# AutoGLM File Upload Skill

上传本地文件到 AutoGLM 服务器，返回可供其他接口使用的文件资源信息。

---

## Token 获取

脚本启动时自动向本地服务发起 HTTP GET 请求获取 token：

| 项目 | 内容 |
|------|------|
| 地址 | `http://127.0.0.1:18432/get_token` |
| 方式 | GET |
| 返回 | `Bearer xxx`（直接作为 Authorization 头使用） |

> 若返回值不含 `Bearer` 前缀，脚本会自动补全。

---

## Upload Mix API

| 项目 | 内容 |
|------|------|
| 地址 | `https://autoglm-api.zhipuai.cn/agentdr/v1/assistant/upload-mix` |
| 方式 | POST |
| 请求体 | `multipart/form-data`，字段名为 `files` |

**签名 Headers（每次动态生成）：**

- `X-Auth-Appid`: `100003`
- `X-Auth-TimeStamp`: 当前秒级 Unix 时间戳
- `X-Auth-Sign`: MD5(`100003 + "&" + timestamp + "&" + 38d2391985e2369a5fb8227d8e6cd5e5`)

---

## 执行脚本

使用同目录下的 `upload-mix.py`：

```bash
python upload-mix.py "<本地文件路径>"
```

**示例：**

```bash
# 上传图片
python upload-mix.py "/path/to/image.jpg"

# 上传文档
python upload-mix.py "/path/to/document.pdf"
```

脚本会自动识别文件的 MIME 类型并填入请求中。

---

## 返回结果处理

### 响应结构

```json
{
  "code": 0,
  "msg": "SUCCESS",
  "time": 1773199477734,
  "trace": "78dd001f3ec04c37b6a1d58b5db70fce",
  "data": {
    "message": "",
    "oss_info": [
      {
        "filename": "SKILL.md",
        "oss_name": "auto_fly/8a4e6ab6-c2ab-4e88-b4af-fb62db9379af/SKILL.md",
        "oss_url": "https://autoglm-agent.aminer.cn/auto_fly/8a4e6ab6-c2ab-4e88-b4af-fb62db9379af/SKILL.md"
      }
    ]
  }
}
```

### 输出要求

**1. 提取文件 URL**
从 `data.oss_info[0].oss_url` 字段获取上传后的文件地址，可直接用于 `image-recognition` 等后续接口的 `image_url` 参数。

**2. 典型联动流程**
```
upload_mix（上传本地文件）→ 获取 url → image_recognition（识别图片内容）
```