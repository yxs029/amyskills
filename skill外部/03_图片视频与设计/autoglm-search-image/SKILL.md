---
name: autoglm-search-image
description: >
  使用 AutoGLM 搜图接口，根据用户输入的关键词搜索相关图片。当用户需要搜索图片、查找图片素材等场景时使用此 skill。
  Token 通过本地服务 http://127.0.0.1:18432/get_token 自动获取，无需手动配置环境变量。
compatibility:
  requires:
    - Python 3.x（标准库，无需额外安装）
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


# AutoGLM Search Image Skill

根据用户输入的关键词，调用 AutoGLM 搜图 API 返回相关图片列表。

---

## API

| 项目 | 内容 |
|------|------|
| 地址 | `https://autoglm-api.zhipuai.cn/agentdr/v1/assistant/skills/search-image` |
| 方式 | POST |
| 请求体 | `{"query": "<搜索关键词>"}` |

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

使用同目录下的 `search-image.py`：
```bash
python search-image.py "猫咪"
```

无需安装第三方依赖，仅使用 Python 标准库。

---

## 返回结果处理

### 响应结构
```json
{
  "code": 0,
  "msg": "SUCCESS",
  "data": {
    "results": [
      {
        "original_url": "图片链接",
        "caption": "图片描述",
        "source": "来源",
        "original_width": 1267,
        "original_height": 845
      }
    ],
    "query": "搜索词",
    "count": 4
  }
}
```

### 输出要求

遍历 `data.results`，以 Markdown 格式展示每张图片及其描述：
```markdown
**1. 图片描述（来源）**
![图片描述](original_url)
```
