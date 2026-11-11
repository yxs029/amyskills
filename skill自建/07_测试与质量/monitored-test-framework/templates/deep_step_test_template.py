#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
深度步骤测试模板 - 每个用例3-6步，每步截图+DOM断言
复制此模板，按V3.0测试场景拆步骤，用真实DOM选择器

使用方法:
1. 先用 explore 脚本探索真实DOM选择器
2. 按V3.0测试场景拆成3-6步
3. 每步: 操作 -> 等待 -> 截图 -> DOM断言
4. 用假阳性检测脚本审计结果

关键原则:
- 一个"一次性通过"的用例不算通过，是假阳性
- 每步必须有截图(base64) + DOM返回值(语义化字符串)
- 用V3.0场景描述拆步骤，不要自己猜
"""
import os, sys, json, time, base64
from datetime import datetime
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')
from playwright.sync_api import sync_playwright
from login_helper import login_admin

EXEC = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"
URL = "https://test.esicint.com/draw/draw"
RESULTS_DIR = "./results_json"
SD = "./screenshots/deep"
os.makedirs(SD, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# ============================================================
# 工具函数
# ============================================================
def s2b(page, name):
    """截图并返回base64"""
    try:
        path = f"{SD}/{name}.png"
        page.screenshot(path=path, timeout=8000)
        with open(path, 'rb') as f:
            return base64.b64encode(f.read()).decode()
    except:
        return ""

def ev(page, js):
    """安全执行JS，返回结果"""
    try: return page.evaluate(js)
    except: return None

def rows(page):
    """获取当前列表行数"""
    return ev(page, "() => { const w = document.querySelector('.vxe-table--fixed-left-wrapper, .vxe-table--body-wrapper'); return w ? w.querySelectorAll('.vxe-body--row').length : 0; }")

def step(case, n, action, result, ok, shot=None):
    """添加步骤 - 每步必须有action/result/ok/screenshot"""
    case["steps"].append({"step":n,"action":action,"result":result,"ok":ok,"screenshot":shot or ""})

def fin(case, status, actual):
    """结束用例"""
    case["status"]=status; case["actual"]=actual; case["pass"]=(status=="PASS"); case["message"]=actual

def fill_search_input(page, text):
    """用JS设值搜索框（避免fill超时）"""
    page.evaluate(f"""() => {{
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {{
            if (inp.offsetParent !== null && inp.placeholder && inp.placeholder.includes('图纸文件名')) {{
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                setter.call(inp, '{text}');
                inp.dispatchEvent(new Event('input', {{bubbles: true}}));
                inp.dispatchEvent(new Event('change', {{bubbles: true}}));
                return;
            }}
        }}
    }}""")

def click_btn_by_text(page, text):
    """用JS按文字找按钮并点击"""
    page.evaluate(f"""() => {{
        const btns = document.querySelectorAll('button');
        for (const b of btns) {{
            if (b.innerText.trim() === '{text}' && b.offsetParent !== null && !b.disabled) {{
                b.click(); return true;
            }}
        }}
        return false;
    }}""")

def click_more_menu_item(page, item_text):
    """点el-icon-more(Playwright) -> 菜单项(JS click) - 注意两种相反的点击方式"""
    page.locator('.vxe-table--fixed-left-wrapper .vxe-body--row:first-child .el-icon-more').first.click(force=True, timeout=5000)
    page.wait_for_timeout(800)
    page.evaluate(f"""() => {{
        const items = document.querySelectorAll('.el-dropdown-menu__item');
        for (const item of items) {{
            if (item.offsetParent !== null && item.innerText.trim() === '{item_text}') {{
                item.click(); return;
            }}
        }}
    }}""")

# ============================================================
# 示例用例：高级搜索-单条件查询（6步深度验证）
# V3.0场景: 在高级搜索的物料编码字段输入"ABC"，点击查询，观察返回结果
# ============================================================
def tc_example_single_search(page):
    case = {"id":"TC-EXAMPLE-001","title":"高级搜索-单条件查询","priority":"P0","module":"M01","steps":[],"defect":None}
    
    # Step 1: 记录初始行数
    before = rows(page)
    step(case, 1, "记录初始行数", f"初始行数={before}", True, s2b(page, "tc001_s1"))
    
    # Step 2: 打开高级搜索面板
    page.locator('button:has-text("高级搜索")').first.click(force=True, timeout=5000)
    page.wait_for_timeout(1500)
    labels = ev(page, """() => {
        const labels = document.querySelectorAll('.el-form-item__label');
        return Array.from(labels).filter(l => l.offsetParent !== null).length;
    }""")
    step(case, 2, "打开高级搜索面板", f"面板字段数={labels}", labels > 3, s2b(page, "tc001_s2"))
    
    # Step 3: 输入搜索关键词
    fill_search_input(page, "zzz_nonexist_99999")
    page.wait_for_timeout(500)
    step(case, 3, "输入搜索关键词'zzz_nonexist_99999'", "已输入", True, s2b(page, "tc001_s3"))
    
    # Step 4: 点击搜索
    click_btn_by_text(page, "搜索")
    page.wait_for_timeout(3000)
    after = rows(page)
    step(case, 4, "点击搜索按钮", f"搜索后行数={after}", True, s2b(page, "tc001_s4"))
    
    # Step 5: 验证搜索结果过滤生效
    search_ok = after < before
    step(case, 5, "验证搜索结果过滤", f"前={before}, 后={after}, 过滤生效={search_ok}", search_ok)
    
    # Step 6: 重置搜索
    click_btn_by_text(page, "重置")
    page.wait_for_timeout(2000)
    reset_count = rows(page)
    step(case, 6, "点击重置恢复", f"重置后行数={reset_count}", reset_count >= before, s2b(page, "tc001_s6"))
    
    # 关闭面板
    page.locator('button:has-text("高级搜索")').first.click(force=True, timeout=5000)
    page.wait_for_timeout(1000)
    
    fin(case, "PASS" if search_ok else "FAIL",
         f"单条件搜索: 前={before}->搜索={after}->重置={reset_count}")
    return case

# ============================================================
# 假阳性检测函数 - 生成报告前必须运行
# ============================================================
def audit_shallow_tests(cases):
    """检测假阳性：steps<=1 或 screenshots==0 的用例"""
    shallow = 0
    no_shot = 0
    for c in cases:
        sc = len(c.get("steps", []))
        sh = len([s for s in c.get("steps", []) if s.get("screenshot")])
        if sc <= 1:
            print(f"🔴 {c['id']}: 浅测试(仅{sc}步) - 不可信PASS")
            shallow += 1
        elif sh == 0:
            print(f"🔴 {c['id']}: 无截图 - 不可信PASS")
            no_shot += 1
    total = len(cases)
    deep = total - shallow - no_shot
    print(f"\n审计结果: {total}用例, 🔴浅={shallow}, 🔴无截图={no_shot}, 🟢深={deep}")
    if shallow > total * 0.3:
        print(f"⚠️ 警告: {shallow*100//total}%用例是浅测试，报告不可信！")
    return shallow, no_shot

# ============================================================
# 主执行
# ============================================================
if __name__ == "__main__":
    all_cases = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, executable_path=EXEC)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        login_admin(page, "admin")
        page.goto(URL)
        page.wait_for_timeout(4000)

        # 执行测试
        case = tc_example_single_search(page)
        all_cases.append(case)
        browser.close()

    # 假阳性检测（生成报告前必须运行）
    print("\n" + "="*60)
    print("🔍 假阳性检测")
    print("="*60)
    audit_shallow_tests(all_cases)

    # 保存结果
    passed = sum(1 for c in all_cases if c["status"]=="PASS")
    failed = sum(1 for c in all_cases if c["status"]=="FAIL")
    total_steps = sum(len(c["steps"]) for c in all_cases)
    total_shots = sum(len([s for s in c.get("steps",[]) if s.get("screenshot")]) for c in all_cases)
    
    result = {
        "module":"模板示例","test_time":datetime.now().isoformat(),"version":"deep-step-template",
        "stats":{"total":len(all_cases),"pass":passed,"fail":failed,"skip":0},
        "cases":all_cases,
        "summary":f"{len(all_cases)}用例, {total_steps}步, {total_shots}截图"
    }
    
    out = f"{RESULTS_DIR}/template_example.json"
    with open(out,'w',encoding='utf-8') as f:
        json.dump(result,f,ensure_ascii=False,indent=2)
    print(f"\n📄 结果已保存: {out}")
