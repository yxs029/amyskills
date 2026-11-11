#!/usr/bin/env python3
"""
SRMPRO 测试 - 共享登录模块模板
所有测试脚本 import 此模块的 login_admin() 函数
使用 robust_login.py 的真实鼠标滑块绕过

使用方法:
1. 复制此文件到测试脚本同目录的 scripts/ 下
2. 在测试脚本中:
   from login_helper import login_admin
   login_admin(page, "admin")  # 或 "testadmin" / "aarontest"

验证记录: 2026-07-17 实战, 9 个脚本全部一次性登录成功
"""
import sys, os, time, logging

# 加入 bi-automation 项目路径以 import robust_login
BI_AUTO_DIR = "/home/aaronmy/.openclaw/workspace/bi-automation"
if BI_AUTO_DIR not in sys.path:
    sys.path.insert(0, BI_AUTO_DIR)

from playwright.sync_api import sync_playwright, Page, BrowserContext
from robust_login import robust_login

logger = logging.getLogger(__name__)

# 浏览器路径
EXEC_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"

# 登录配置
ACCOUNTS = {
    "admin":      {"username": "admin",      "password": "Esic@2024"},
    "testadmin":  {"username": "testadmin",  "password": "Esic@2024"},
    "aarontest":  {"username": "aarontest",  "password": "Esic@2024"},
}

def create_browser(headless=False):
    """创建浏览器（老大要求 headless=False）"""
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=headless,
        executable_path=EXEC_PATH,
        args=['--no-sandbox', '--disable-dev-shm-usage',
              '--disable-blink-features=AutomationControlled'],
    )
    return pw, browser

def login_admin(page, account_type="admin"):
    """
    使用 robust_login 登录 SRMPRO
    - 真实鼠标拖动滑块
    - _force_submit 移除 disabled 并 click
    - 等待 URL 跳转到 /index

    Returns: True if login success
    """
    acct = ACCOUNTS.get(account_type, ACCOUNTS["admin"])

    config = {
        'base_url': 'https://test.esicint.com/index',
        'username': acct['username'],
        'password': acct['password'],
        'max_retries': 3,
        'wait_after_login': 5,
    }

    try:
        robust_login(page, config)
        if '/login' not in page.url.lower():
            print(f"  ✅ 登录成功: {page.url}")
            return True
        else:
            print(f"  ❌ 登录后仍在登录页: {page.url}")
            return False
    except Exception as e:
        print(f"  ❌ robust_login 异常: {e}")
        return False

def login_and_navigate(page, target_url, account_type="admin"):
    """登录后直接导航到目标URL"""
    success = login_admin(page, account_type)
    if success:
        page.goto(target_url, timeout=30000)
        page.wait_for_timeout(2000)
        print(f"  ✅ 已导航到: {page.url}")
    return success

if __name__ == "__main__":
    # 快速测试
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
    pw, browser = create_browser(headless=False)
    try:
        page = browser.new_page()
        ok = login_admin(page, "admin")
        if ok:
            print(f"✅ 登录验证通过, URL: {page.url}")
        else:
            print("❌ 登录失败!")
    finally:
        browser.close()
        pw.stop()
