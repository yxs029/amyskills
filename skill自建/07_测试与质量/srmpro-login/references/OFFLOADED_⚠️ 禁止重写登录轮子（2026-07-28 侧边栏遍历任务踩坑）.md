## ⚠️ 禁止重写登录轮子（2026-07-28 侧边栏遍历任务踩坑）

**踩坑背景**：老大要求 "把侧边栏遍历到最底层目录"，本 agent 从零写了个 `sidebar_traversal_test.py`，完全没意识到已有本 skill 提供的 `login_helper.py` + bi-automation venv + robust_login.py 黄金组合。结果：

- ❌ 5+ 次登录失败（dispatchEvent / 真实 mouse / Xvfb / launch_persistent_context 全部尝试）
- ❌ 自己造了 Playwright headless + system Chrome 路径，又造了坐标定位 + DOM 截图分析，浪费 1 小时
- ❌ 最终决定"任务未完成"归档，让老大失望

**铁律**：

1. **任何 SRMPRO 登录需求** → 加载本 skill，**直接用** `templates/login_helper.py` 或 `bi-automation/robust_login.py`
2. **不要从零写登录脚本** —— 滑块验证、Vue ref、ESIC 解锁、设备指纹、浏览器路径全部踩过坑
3. **不要相信 "用 images 估算坐标 + mouse.click" 能成功** —— 视觉反馈 ≠ 服务端验证通过，UI 显示绿色但按钮仍 disabled 的情况反复出现
4. **bi-automation venv 路径**：`/home/aaronmy/.openclaw/workspace/bi-automation/venv/bin/python` —— 这是唯一验过能过 SRMPRO 滑块的 venv
5. **老大 2026-07-17 明确要求 headless=False** —— 即使是后台脚本，也必须有 X server 跑（`$DISPLAY=:0`）

**如何正确处理新任务**（如侧边栏遍历）：

```bash
# Step 1: 加载 srmpro-login skill（已完成）
# Step 2: 用 login_helper 一行登录
from login_helper import login_admin
login_admin(page, "admin")  # 拿到已登录 page

# Step 3: 写真正的测试逻辑（不重新造登录代码）
for menu_item in get_all_menu_items(page):
    test_menu(page, menu_item)
```

**判别标准**（"是不是在重写轮子"）：
- ❌ 自己写 `page.fill('input[placeholder*=用户]')` —— 用 `login_helper.login_admin()`
- ❌ 自己写 mouse.down / move / up 拖滑块 —— 用 `robust_login()`
- ❌ 自己定义 `BASE_URL` 找凭据 —— 用 `ACCOUNTS['admin']`
- ❌ 自己选浏览器 executable_path —— 用 `login_helper.create_browser()`

**结论**：本 skill 是 SRMPRO 登录的唯一入口。加载即用，不重写。

---

