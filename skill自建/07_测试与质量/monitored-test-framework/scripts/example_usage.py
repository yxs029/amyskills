#!/usr/bin/env python3
"""
监控双保险测试框架 - 最小可运行示例
演示：测试图纸库关联物料弹窗
"""
import sys, os
sys.path.insert(0, '/home/aaronmy/.hermes/skills/qa/monitored-test-framework/scripts')
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')

from playwright.sync_api import sync_playwright
from monitored_test_framework import MonitoredTestCase
from login_helper import login_admin

EXEC_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"
TARGET_URL = "https://test.esicint.com/draw/draw"


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, executable_path=EXEC_PATH)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        login_admin(page, "admin")

        case = MonitoredTestCase("TC-DEMO-001", "演示用例：打开关联物料弹窗", "P0", "DEMO")
        page.goto(TARGET_URL)
        page.wait_for_timeout(3000)

        # Step 1: 验证页面加载
        case.add_step(1, "验证图纸库加载", page,
                      "() => !!document.querySelector('.vxe-table')",
                      "vxe-table存在", "vxe-table不存在",
                      expected_dom_state="vxe-table")

        # Step 2: 点击关联物料按钮
        case.add_step(2, "点击关联物料按钮", page,
                      "() => { const d=document.querySelector('.material-dialog'); return d && getComputedStyle(d).display !== 'none'; }",
                      "弹窗已打开", "弹窗未打开",
                      expected_dom_state="material-dialog",
                      pre_action="""() => {
                          const w = document.querySelector('.vxe-table--fixed-left-wrapper');
                          const rows = w?.querySelectorAll('.vxe-body--row') || [];
                          const btns = rows[0]?.querySelectorAll('button') || [];
                          for (const b of btns) {
                              if (b.innerText.includes('关联')) { b.click(); break; }
                          }
                      }""")

        # Step 3: 验证弹窗内容
        case.add_step(3, "验证弹窗内容", page,
                      "() => document.querySelectorAll('.material-dialog .vxe-body--row, .material-dialog table tbody tr').length > 0",
                      "物料列表存在", "物料列表为空",
                      expected_dom_state="vxe-body--row|物料")

        # 判定
        all_pass = all(s["verdict"] == "PASS" for s in case.steps)
        case.finalize("PASS" if all_pass else "FAIL",
                      "演示完成" if all_pass else "演示失败")
        
        print(f"\n{'='*50}")
        print(f"用例: {case.case_id}")
        print(f"状态: {case.status}")
        for s in case.steps:
            print(f"  Step {s['step']}: {s['verdict']:5s} | {s['reasoning']}")
        
        browser.close()


if __name__ == "__main__":
    main()
