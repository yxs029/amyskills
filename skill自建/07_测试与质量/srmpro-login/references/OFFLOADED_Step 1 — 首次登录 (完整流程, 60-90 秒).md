## Step 1 — 首次登录 (完整流程, 60-90 秒)

### 1.1 准备
```bash
# 关键路径 (固定, 不要改)
PW_BIN="/home/aaronmy/.openclaw/workspace/bi-automation/venv/bin/python"
PW_DIR="/home/aaronmy/.openclaw/workspace/bi-automation"
STATE_PATH="/home/aaronmy/文档/移动云盘同步盘/10ESIC软件测试/SRMPRO/测试过程数据/00_通用工具/srmpro_storage_state.json"
SCREENSHOT_PATH="/tmp/srmpro_logged_in.png"
```

### 1.2 环境变量加载
```bash
export TEST_USERNAME="admin"
export TEST_PASSWORD="Esic@2024"  # 老大 2026-06-03 明确给出
```

### 1.3 登录脚本
```python
import sys, os
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')
os.environ['TEST_USERNAME'] = 'admin'
os.environ['TEST_PASSWORD'] = 'Esic@2024'

from playwright.sync_api import sync_playwright
from robust_login import robust_login  # ← 关键! bi-automation 项目里已有

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,  # 无显示器环境必须 headless
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'],
    )
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    config = {
        'base_url': 'https://test.esicint.com/index',
        'username': 'admin',
        'password': 'Esic@2024',
        'max_retries': 3,
        'wait_after_login': 5,
    }

    robust_login(page, config)  # ← 真实 mouse 拖动, ease-out 曲线

    # ✅ 验证: URL 应该是 /index, 不是 /login
    assert '/index' in page.url, f"登录失败! URL: {page.url}"
    print(f"✅ 登录成功! URL: {page.url}")

    # 💾 保存 storage_state (永久跳过滑块)
    context.storage_state(path=STATE_PATH)
    print(f"💾 storage_state: {STATE_PATH}")

    # 📸 截图
    page.screenshot(path=SCREENSHOT_PATH, full_page=False)
    print(f"📸 截图: {SCREENSHOT_PATH}")

    browser.close()
```

### 1.4 成功标志
- `URL: https://test.esicint.com/index` (不是 `/login?redirect=...`)
- `srmpro_storage_state.json` 写入 (49KB 左右)
- 截图里有 SRMPRO dashboard, 没有"请登录"

---

