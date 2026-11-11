## ⚠️ 共享登录模块 login_helper.py（2026-07-17 实战验证）

**问题**: 9 个测试脚本各自复制粘贴了 broken 的 `smart_login` 函数（简单 fill+click），全部卡在登录按钮 disabled。逐个修复耗时巨大且容易遗漏。

**解决方案**: 写一个共享 `login_helper.py`，所有脚本 `from login_helper import login_admin` 一行搞定：

```python
# login_helper.py 放在 scripts/ 目录下
import sys
BI_AUTO_DIR = "/home/aaronmy/.openclaw/workspace/bi-automation"
if BI_AUTO_DIR not in sys.path:
    sys.path.insert(0, BI_AUTO_DIR)
from robust_login import robust_login

EXEC_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"

ACCOUNTS = {
    "admin": {"username": "admin", "password": "Esic@2024"},
    "testadmin": {"username": "testadmin", "password": "Esic@2024"},
    "aarontest": {"username": "aarontest", "password": "Esic@2024"},
}

def create_browser(headless=False):
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=headless, executable_path=EXEC_PATH,
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'],
    )
    return pw, browser

def login_admin(page, account_type="admin"):
    acct = ACCOUNTS.get(account_type, ACCOUNTS["admin"])
    robust_login(page, {
        'base_url': 'https://test.esicint.com/index',
        'username': acct['username'], 'password': acct['password'],
        'max_retries': 3, 'wait_after_login': 5,
    })
    return '/login' not in page.url.lower()
```

**使用方式**（在每个测试脚本中）：
```python
def smart_login(page, account_type="admin"):
    from login_helper import login_admin as _login
    _login(page, account_type)
    page.wait_for_timeout(2000)
    return True
```

**批量替换旧 smart_login**：用正则 `def smart_login\(page.*?\):\n.*?(?=\ndef |\nclass |\n# ===)` 匹配旧函数体，替换为 4 行 import 版本。

**验证结果**: 2026-07-17 实战，9 个脚本全部一次性登录成功（滑块一次过），M01 38 个用例全 PASS。

