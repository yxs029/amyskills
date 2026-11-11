# 常见 SPA 路由模式（自动 sitemap 发现用）

## Nuxt (Vue 2/3)

**JS bundle 路径：**
- `/_nuxt/<hash>.js`
- `/_nuxt/<name>.js`

**路由声明模式（在 JS bundle 中搜索）：**
```js
// 静态路由
{ path: '/dashboard', component: Dashboard }
{ path: '/dashboard/account', component: Account }

// 动态路由
{ path: '/article/:id', component: Article }
{ path: '/user/:id(\\d+)', component: User }
```

**正则：**
```python
r'path:\s*["\']([/][a-zA-Z0-9_/\-:]+)["\']'
r'["\']([/][a-zA-Z0-9_/\-:]{2,})["\']:\s*[A-Z][a-zA-Z]+'
```

**Nuxt 链接组件：**
```html
<nuxt-link to="/dashboard/account">
<router-link to="/dashboard">
```
HTML 中找 `to="/..."` 属性。

## Next.js (React)

**JS bundle 路径：**
- `/_next/static/chunks/pages/<page>.js`
- `/_next/static/chunks/app/<page>.js` (App Router)

**路由模式：**
- Pages Router: 文件路径即路由
- App Router: `app/<segment>/page.tsx`

**正则：**
```python
r'["\']pathname["\']:\s*["\']([/][^"\']+)["\']'
```

## React Router (CRA / Vite + React Router)

**路由模式：**
```jsx
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/article/:id" />
```

**正则：**
```python
r'path=["\']([/][^"\']+)["\']'
r'<Route[^>]*path=["\']([/][^"\']+)["\']'
```

## VitePress / VuePress

**路由：** 目录结构即路由
- `/guide/getting-started.md` → `/guide/getting-started`

## 静态 HTML (传统多页)

直接抓 `<a href="...">` 即可。

## 通用的"发现"步骤

1. **从 HTML 抓所有内链：**
   ```python
   soup.find_all('a', href=True)
   ```
   去重，过滤外链，保留站内 `/xxx` 路径。

2. **从 JS bundle 抓路由：**
   ```python
   # Nuxt
   r'["\'](\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-:]+)*)["\']'
   # 配合 context: 路径后面跟 component/page/Route
   ```

3. **从 robots.txt / sitemap.xml：**
   ```bash
   curl https://target/robots.txt
   curl https://target/sitemap.xml
   ```

4. **从导航/面包屑**：HTML 中 `<nav>`、`.menu`、`.breadcrumb` 元素

5. **从 API 推断**：JS bundle 中 `/api/...` 路径可推断前端必有的对应页面

## 已知陷阱

| 陷阱 | 表现 | 解法 |
|---|---|---|
| SPA 全部 200 | 所有路径都返回 200 | 不要用 HTTP 状态码判断路径是否存在 |
| JS 路径含 hash | `/_nuxt/abc123.js` 是真文件 | 用 file_pattern 过滤 |
| 动态段 | `/article/[id]` | 用 `(\[\w+\])` 匹配但标记为"动态" |
| 多语言 | `/en/about` `/zh/about` | 看 HTML lang 属性决定 |
| CDN 子域 | `cdn.target.com/x.js` | 主域外不抓 |
| 认证墙 | `/admin` 200 但内容是登录框 | 看 DOM 内容 |
