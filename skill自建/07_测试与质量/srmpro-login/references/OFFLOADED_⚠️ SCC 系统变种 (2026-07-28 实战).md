## ⚠️ SCC 系统变种 (2026-07-28 实战)

**关键发现**: SCC 系统 (`http://scc.esicint.com`) 用的是**和 SRMPRO 完全相同的 verify 组件**，但有以下差异：

| 项目 | SRMPRO (test.esicint.com) | SCC (scc.esicint.com) |
|------|--------------------------|------------------------|
| 账号密码 | admin/Esic@2024 | **admin/Esic@2024 (相同！)** |
| 滑块 selector | `.verify-btn` | **`.verify-btn` (相同！)** |
| 后端 API 前缀 | `/admin-api/` | `/admin-api/` |
| 浏览器路径 | 系统 chromium 即可 | **系统 chromium 即可** |
| 菜单结构 | 侧边栏 el-menu-item | **悬停弹出 popover（不是侧边栏！）** |
| 登录后主页 | `/index` | `/index` (相同) |
| 登录按钮 | `el-button--primary` | **`el-button--primary` (相同)** |
| 注意坑 | 多账号需独立 context | 菜单 hover 后**会消失**，必须每次重新 hover |

**SCC 菜单遍历关键陷阱（2026-07-28 踩坑）**:

SCC 用的是 **`.menu-btn.el-popover__reference` 悬停弹出菜单**，不是 el-submenu 侧边栏。每次点击子菜单后弹层消失，**必须重新 hover 一级菜单**才能继续点下一个。

```python
# 错：连续 hover 完再点 → 菜单已消失
for sub_text in sub_items:
    sub_elem.click()  # ❌ 第二次点击找不到子菜单

# 对：每次点前重新 hover
for sub_text in sub_items:
    menu.hover()  # ✅ 重新弹层
    page.wait_for_timeout(300)
    sub_elem = page.locator(f'.el-cascader-node:has-text("{sub_text}")').first
    sub_elem.click()
```

子菜单 selector：`.el-cascader-node`（在弹出的 popover 里），**不是** `.el-submenu` 或 `.el-menu-item`。

**SCC 后端路径发现**（从 `index.js` 静态提取）：

- baseURL: `http://scc.esicint.com:48080/admin-api/`
- **但 48080 端口外网直连 timeout**——必须通过 nginx 反代（前端域名）
- 浏览器内 `fetch('/admin-api/...')` 才能通
- API 572 个，11 个 500 错误，最严重是 `/ov/ai-agent/prepare-converse` 泄露内网 IP

**SCC 与 SRMPRO 的核心共同点**（决定了可以复用本 skill 的 `login_helper.py`）：

1. 同 verify 组件 → 同滑块绕过策略
2. 同 admin 账号 → 同密码复用
3. 同 `/admin-api/` 前缀 → 同 Bearer Token 鉴权
4. 同 `/index` 登录后跳转 → 验证逻辑一致

→ **结论**：SCC 系统登录直接走本 skill 的 Step 1（首次）或 Step 2（复用 storage_state），不需要新写轮子。

