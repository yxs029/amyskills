# 授权配置

## 概述

通过设备授权流程为用户完成授权并写入配置。适用于「配置 Get笔记」「连接 Get笔记」等场景。

---

## 触发条件

每次调用 API 前，先检查 `$GETNOTE_API_KEY` 是否存在。若不存在，引导用户完成授权配置，配置完成后继续执行用户原本的请求。

---

## 手动配置（推荐）

1. 前往 [Get笔记开放平台](https://www.biji.com/openapi) 创建应用
2. 获取 Client ID 和 API Key
3. 在 `~/.openclaw/openclaw.json` 中添加：

```json
{
  "skills": {
    "entries": {
      "getnote": {
        "apiKey": "gk_live_你的key",
        "env": {
          "GETNOTE_CLIENT_ID": "cli_你的id",
          "GETNOTE_OWNER_ID": "ou_你的飞书ID（可选，用于权限控制）"
        }
      }
    }
  }
}
```

---

## 设备授权流程（编程方式）

适合需要引导用户完成授权的场景。

### 步骤 1：申请授权码

```
POST https://openapi.biji.com/open/api/v1/oauth/device/code
Content-Type: application/json
```

请求体：
```json
{
  "client_id": "cli_a1b2c3d4e5f6789012345678abcdef90"
}
```

> ⚠️ **client_id 固定为 `cli_a1b2c3d4e5f6789012345678abcdef90`**，这是 Get笔记 为 OpenClaw 预注册的应用。

返回：
```json
{
  "success": true,
  "data": {
    "code": "abc123...",
    "verification_uri": "https://biji.com/openapi/oauth/authorize?code=abc123...",
    "user_code": "ABCD-1234",
    "expires_in": 600,
    "interval": 5
  }
}
```

| 字段 | 说明 |
|------|------|
| `code` | 授权码，轮询时使用 |
| `verification_uri` | 授权链接，**发送给用户点击** |
| `user_code` | 确认码，**必须展示给用户核对** |
| `expires_in` | 授权码有效期（秒），默认 600 |
| `interval` | 建议轮询间隔（秒），默认 5 |

### 步骤 2：展示授权链接

将 `verification_uri` 和 `user_code` 发送给用户：

> 🔗 请点击链接完成授权：
> 
> {verification_uri}
> 
> ⚠️ **请核对确认码**：`{user_code}`
> 
> 授权页面会显示确认码，请确保与上面一致后再点击授权。授权码 10 分钟内有效。

**安全提醒**：`user_code` 用于防止钓鱼攻击。用户在授权页面看到的确认码必须与 Agent 展示的一致，不一致请勿授权。

发送授权链接给用户后，立即启动后台轮询（步骤 3）。

### 步骤 3：轮询等待授权

```
POST https://openapi.biji.com/open/api/v1/oauth/token
Content-Type: application/json
```

请求体：
```json
{
  "grant_type": "device_code",
  "client_id": "cli_a1b2c3d4e5f6789012345678abcdef90",
  "code": "{code}"
}
```

**轮询策略**：
- **间隔**：5 秒查询一次
- **超时**：最多轮询 10 分钟（与授权码有效期一致）
- **并行**：轮询在后台进行，不阻塞用户其他操作
