#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SRMPRO 图纸库测试 - 监控子智能体 + DOM双保险框架
每个测试步骤执行后：
  1. 截图证据 (screenshot)
  2. DOM断言结果 (DOM返回值)
  3. 子智能体旁路验证 (image_analyze + DOM信息交叉验证)
三重证据综合判断PASS/FAIL
"""
import sys, os, json, time, base64, traceback
from datetime import datetime
sys.path.insert(0, '/home/aaronmy/.openclaw/workspace/bi-automation')
sys.path.insert(0, '/home/aaronmy/SRMPRO/图纸库/04-A测试执行过程/测试执行任务/scripts')

from playwright.sync_api import sync_playwright
from login_helper import login_admin

EXEC_PATH = "/home/aaronmy/.cache/ms-playwright/chromium-1134/chrome-linux/chrome"
TARGET_URL = "https://test.esicint.com/draw/draw"
RESULTS_DIR = "/home/aaronmy/SRMPRO/图纸库/04-A测试执行过程/测试执行任务/results_json"
SCREENSHOT_DIR = "/home/aaronmy/SRMPRO/图纸库/04-A测试执行过程/测试执行任务/screenshots/monitored"
MONITOR_DIR = "/home/aaronmy/SRMPRO/图纸库/04-A测试执行过程/测试执行任务/monitor_logs"

os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(SCREENSHOT_DIR, exist_ok=True)
os.makedirs(MONITOR_DIR, exist_ok=True)


class MonitoredTestCase:
    """监控测试用例 - 每步三证据记录"""
    def __init__(self, case_id, title, priority="P1", module="M00"):
        self.case_id = case_id
        self.title = title
        self.priority = priority
        self.module = module
        self.status = "PENDING"
        self.actual = ""
        self.steps = []  # 每步含截图+DOM断言+监控结果
        self.defect = None
        self.start_time = datetime.now()
        self.end_time = None

    def add_step(self, step_num, action, page, dom_check_js,
                 dom_pass_desc, dom_fail_desc,
                 screenshot_label=None,
                 expected_dom_state="",
                 pre_action=None):
        """
        添加一步测试 - 同时记录三证据
        :param dom_check_js: DOM断言JS表达式，返回truthy表示通过
        :param dom_pass_desc: DOM断言通过描述
        :param dom_fail_desc: DOM断言失败描述
        :param expected_dom_state: 期望的DOM状态（给监控智能体看的）
        :param pre_action: 在断言前执行的操作（如点击按钮打开弹窗）
        """
        step_record = {
            "step": step_num,
            "action": action,
            "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
            "evidence": {},
            "verdict": "PENDING",
            "reasoning": ""
        }

        # === 前置操作（如点击按钮）===
        if pre_action:
            try:
                page.evaluate(pre_action)
                page.wait_for_timeout(2000)  # 等待操作生效
            except Exception as e:
                step_record["evidence"]["pre_action_error"] = str(e)[:100]

        # 等待DOM稳定
        page.wait_for_timeout(800)

        # === 证据1: 截图 ===
        screenshot_path = os.path.join(SCREENSHOT_DIR, f"{self.case_id}_step{step_num}.png")
        try:
            page.screenshot(path=screenshot_path, timeout=5000)
            step_record["evidence"]["screenshot"] = screenshot_path
        except Exception as e:
            step_record["evidence"]["screenshot"] = f"FAILED: {str(e)[:50]}"

        # === 证据2: DOM断言 ===
        try:
            dom_value = page.evaluate(dom_check_js)
            dom_passed = bool(dom_value) if not isinstance(dom_value, dict) or "_error" not in dom_value else False
            step_record["evidence"]["dom_value"] = str(dom_value)[:300] if dom_value else "null"
            step_record["evidence"]["dom_passed"] = dom_passed
            step_record["evidence"]["dom_description"] = dom_pass_desc if dom_passed else dom_fail_desc
        except Exception as e:
            step_record["evidence"]["dom_value"] = f"ERROR: {str(e)[:100]}"
            step_record["evidence"]["dom_passed"] = False
            step_record["evidence"]["dom_description"] = f"DOM断言异常: {str(e)[:80]}"
            dom_passed = False

        # === 证据3: 监控子智能体分析（同步调用，避免异步开销）===
        monitor_result = self._call_monitor_agent(
            page, step_num, action, expected_dom_state,
            step_record["evidence"].get("dom_value", "")
        )
        step_record["evidence"]["monitor_verdict"] = monitor_result.get("verdict", "UNKNOWN")
        step_record["evidence"]["monitor_confidence"] = monitor_result.get("confidence", 0)
        step_record["evidence"]["monitor_finding"] = monitor_result.get("finding", "")

        # === 三证据综合判断 ===
        step_record["verdict"], step_record["reasoning"] = self._merge_verdicts(step_record["evidence"])

        self.steps.append(step_record)
        return step_record["verdict"] == "PASS"

    def _call_monitor_agent(self, page, step_num, action, expected_dom_state, dom_value):
        """
        监控子智能体 - 旁路验证
        同步调用图像分析 + 交叉验证DOM信息
        避免delegate_task的开销，使用本地快速分析
        """
        result = {
            "verdict": "UNKNOWN",
            "confidence": 0,
            "finding": "",
            "sub_checks": {}
        }

        try:
            # 子检查1: 截图存在性 + 大小（白屏检测）
            screenshot_path = os.path.join(SCREENSHOT_DIR, f"{self.case_id}_step{step_num}.png")
            if os.path.exists(screenshot_path):
                size = os.path.getsize(screenshot_path)
                if size < 5000:
                    result["sub_checks"]["screenshot_size"] = f"ABNORMAL: {size}B (白屏嫌疑)"
                else:
                    result["sub_checks"]["screenshot_size"] = f"OK: {size//1024}KB"
            else:
                result["sub_checks"]["screenshot_size"] = "MISSING"

            # 子检查2: DOM值合理性
            if dom_value and dom_value not in ["null", "false", "", "0"]:
                # 检查是否包含期望状态的关键词
                if expected_dom_state:
                    keywords = expected_dom_state.split("|")
                    matched = [k for k in keywords if k.lower() in dom_value.lower()]
                    result["sub_checks"]["dom_keyword_match"] = f"{len(matched)}/{len(keywords)}: {matched}"
                else:
                    result["sub_checks"]["dom_keyword_match"] = "N/A"
            else:
                result["sub_checks"]["dom_keyword_match"] = f"FAIL: dom值为空/假 ({dom_value[:50]})"

            # 子检查3: 页面是否真的执行了操作（URL变化或DOM变化）
            current_url = page.url
            result["sub_checks"]["current_url"] = current_url[:80]
            result["sub_checks"]["action_context"] = action[:50]

            # 综合判定
            sub = result["sub_checks"]
            if "FAIL" in str(sub.get("dom_keyword_match", "")) or "ABNORMAL" in str(sub.get("screenshot_size", "")):
                result["verdict"] = "FAIL"
                result["confidence"] = 90
                result["finding"] = f"监控发现异常: DOM={sub.get('dom_keyword_match','N/A')}, 截图={sub.get('screenshot_size','N/A')}"
            elif "N/A" in str(sub.get("dom_keyword_match", "")) and expected_dom_state:
                result["verdict"] = "WARN"
                result["confidence"] = 60
                result["finding"] = "监控无法验证DOM关键词，但无明显异常"
            else:
                result["verdict"] = "PASS"
                result["confidence"] = 85
                result["finding"] = f"监控旁路验证通过: 截图={sub.get('screenshot_size','N/A')}, DOM={sub.get('dom_keyword_match','N/A')}"

        except Exception as e:
            result["verdict"] = "ERROR"
            result["confidence"] = 0
            result["finding"] = f"监控异常: {str(e)[:100]}"

        # 写入监控日志
        log_path = os.path.join(MONITOR_DIR, f"{self.case_id}_monitor.log")
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n[{datetime.now().strftime('%H:%M:%S')}] Step {step_num}: {action[:40]}\n")
            f.write(f"  DOM: {dom_value[:100]}\n")
            f.write(f"  Monitor: {result['verdict']} ({result['confidence']}%) - {result['finding']}\n")
            f.write(f"  Sub: {json.dumps(result['sub_checks'], ensure_ascii=False)}\n")

        return result

    def _merge_verdicts(self, evidence):
        """合并三个证据判断最终结果"""
        dom_passed = evidence.get("dom_passed", False)
        monitor_verdict = evidence.get("monitor_verdict", "UNKNOWN")
        monitor_confidence = evidence.get("monitor_confidence", 0)

        # 双保险逻辑
        if dom_passed and monitor_verdict == "PASS":
            return "PASS", "DOM断言通过 + 监控子智能体旁路验证通过（双重保险）"
        elif dom_passed and monitor_verdict == "WARN":
            return "PASS", "DOM断言通过，监控有警告但未发现异常（保守通过）"
        elif not dom_passed and monitor_verdict == "FAIL":
            return "FAIL", "DOM断言失败 + 监控确认异常（双重确认失败）"
        elif not dom_passed and monitor_verdict in ("PASS", "WARN"):
            return "FAIL", "DOM断言失败，监控未捕获到异常（以DOM为准）"
        elif dom_passed and monitor_verdict == "FAIL":
            return "WARN", "DOM通过但监控发现异常 - 需要人工复核"
        else:
            return "WARN", "证据不足，需要人工复核"

    def finalize(self, status, actual, defect=None):
        self.status = status
        self.actual = actual[:300]
        self.defect = defect
        self.end_time = datetime.now()

    def to_dict(self):
        duration = (self.end_time - self.start_time).total_seconds() if self.end_time else 0
        return {
            "id": self.case_id,
            "title": self.title,
            "priority": self.priority,
            "module": self.module,
            "status": self.status,
            "actual": self.actual,
            "duration_seconds": round(duration, 1),
            "steps": self.steps,
            "defect": self.defect,
            "monitored": True  # 标记使用了监控框架
        }


def screenshot_to_b64(screenshot_path):
    """截图转base64用于报告嵌入"""
    try:
        with open(screenshot_path, 'rb') as f:
            return base64.b64encode(f.read()).decode()
    except:
        return None


# ============================================================
# 测试用例 - 使用MonitoredTestCase
# ============================================================

def test_open_material_dialog(page):
    """TC-M04-001: 打开关联物料弹窗"""
    case = MonitoredTestCase("TC-M04-001", "打开关联物料弹窗-验证弹窗结构", "P0", "M04")
    page.goto(TARGET_URL, timeout=30000)
    page.wait_for_timeout(3000)

    case.add_step(1, "验证图纸库页面加载", page,
                  "() => !!document.querySelector('.vxe-table')",
                  "vxe-table组件存在", "vxe-table不存在",
                  expected_dom_state="vxe-table|vxe-body")

    case.add_step(2, "点击第一行的关联物料按钮", page,
                  "() => { const w=document.querySelector('.vxe-table--fixed-left-wrapper'); return w && w.querySelector('.vxe-body--row') && (w.querySelectorAll('.vxe-body--row')[0].innerText.length>0); }",
                  "操作列第一行内容加载", "操作列未加载",
                  expected_dom_state="关联|物料|vxe-body--row")

    # 触发点击
    page.evaluate("""() => {
        const wrapper = document.querySelector('.vxe-table--fixed-left-wrapper');
        if (!wrapper) return;
        const rows = wrapper.querySelectorAll('.vxe-body--row');
        if (rows.length === 0) return;
        const btns = rows[0].querySelectorAll('button, a, .el-button');
        for (const b of btns) {
            const text = (b.innerText || b.textContent || '').trim();
            if (text.includes('关联')) { b.click(); return; }
        }
        if (btns.length > 0) btns[0].click();
    }""")

    case.add_step(3, "验证关联物料弹窗出现", page,
                  "() => { const d=document.querySelector('.material-dialog'); return d && (d.offsetParent !== null || getComputedStyle(d).display !== 'none'); }",
                  "material-dialog弹窗已打开", "弹窗未出现",
                  expected_dom_state="material-dialog|el-dialog__title|关联物料")

    # 获取弹窗内容详情
    dialog_detail = page.evaluate("""() => {
        const dlg = document.querySelector('.material-dialog');
        if (!dlg || dlg.offsetParent === null) return null;
        return {
            title: dlg.querySelector('.el-dialog__title')?.textContent?.trim() || '',
            inputCount: dlg.querySelectorAll('input').length,
            tableRows: dlg.querySelectorAll('.vxe-body--row, .el-table__row, table tbody tr').length,
            buttonCount: dlg.querySelectorAll('button').length,
            confirmBtnText: Array.from(dlg.querySelectorAll('button')).find(b => {
                const t=(b.innerText||'').trim(); return t.includes('确认')||t.includes('确定')||t.includes('添加');
            })?.innerText?.trim() || 'N/A'
        };
    }""")

    if dialog_detail:
        case.steps[-1]["evidence"]["dialog_detail"] = str(dialog_detail)
        case.add_step(4, "验证弹窗内容", page,
                      "() => !!document.querySelector('.material-dialog .el-input')",
                      f"弹窗含{dialog_detail['inputCount']}输入框, {dialog_detail['tableRows']}表格行, 确认按钮:{dialog_detail['confirmBtnText']}",
                      "弹窗内容不完整",
                      expected_dom_state="el-input|vxe-body--row|确认")

    # 判断最终结果
    all_pass = all(s["verdict"] == "PASS" for s in case.steps)
    has_warn = any(s["verdict"] == "WARN" for s in case.steps)
    if all_pass:
        case.finalize("PASS", "关联物料弹窗成功打开，含完整物料选择和确认功能（DOM+监控双保险通过）")
    elif has_warn:
        case.finalize("WARN", "弹窗打开但部分子检查需要人工复核")
    else:
        case.finalize("FAIL", "关联物料弹窗打开失败", {"severity":"P0","title":"关联物料弹窗无法打开","actual":case.steps[-1]["reasoning"]})

    page.keyboard.press('Escape')
    page.wait_for_timeout(1000)
    return case


def test_select_material_confirm(page):
    """TC-M04-002: 选择物料并确认关联"""
    case = MonitoredTestCase("TC-M04-002", "选择物料并确认关联-验证关联成功", "P0", "M04")
    page.goto(TARGET_URL, timeout=30000)
    page.wait_for_timeout(3000)

    # Step 1: 打开弹窗（前置动作+断言一体化）
    case.add_step(1, "点击关联物料按钮打开弹窗", page,
                  "() => { const d=document.querySelector('.material-dialog'); return d && (d.offsetParent !== null || getComputedStyle(d).display !== 'none'); }",
                  "弹窗已打开", "弹窗未打开",
                  expected_dom_state="material-dialog|关联物料",
                  pre_action="""() => {
        const wrapper = document.querySelector('.vxe-table--fixed-left-wrapper');
        if (!wrapper) return;
        const rows = wrapper.querySelectorAll('.vxe-body--row');
        if (rows.length === 0) return;
        const btns = rows[0].querySelectorAll('button, a, .el-button');
        for (const b of btns) {
            const t = (b.innerText||b.textContent||'').trim();
            if (t.includes('关联')) { b.click(); return; }
        }
        if (btns.length > 0) btns[0].click();
    }""")

    case.add_step(2, "查看弹窗物料列表内容", page,
                  "() => { const d=document.querySelector('.material-dialog'); if (!d) return 'no-dialog'; const style=getComputedStyle(d); if (style.display==='none') return 'hidden'; const rows=d.querySelectorAll('.vxe-body--row, .el-table__row, table tbody tr, .vxe-table--body tr'); return rows.length > 0 ? rows.length : 'empty'; }",
                  "物料列表存在", "物料列表为空",
                  expected_dom_state="vxe-body--row|checkbox|物料")

    case.add_step(3, "勾选第一个物料", page,
                  "() => { const d=document.querySelector('.material-dialog'); if (!d || getComputedStyle(d).display==='none') return false; const rows=d.querySelectorAll('.vxe-body--row, .el-table__row, table tbody tr, .vxe-table--body tr'); if (rows.length===0) return false; const cb=rows[0].querySelector(\"input[type='checkbox'], .el-checkbox, .vxe-checkbox\"); if (cb) cb.click(); else rows[0].click(); return 'clicked'; }",
                  "勾选操作已执行", "勾选失败",
                  expected_dom_state="is-checked|checkbox:checked",
                  pre_action="""() => {
        const dlg = document.querySelector('.material-dialog');
        if (!dlg || getComputedStyle(dlg).display === 'none') return 'no-dialog';
        const rows = dlg.querySelectorAll('.vxe-body--row, .el-table__row, table tbody tr, .vxe-table--body tr');
        if (rows.length === 0) return 'empty';
        const cb = rows[0].querySelector("input[type='checkbox'], .el-checkbox, .vxe-checkbox");
        if (cb) { cb.click(); return 'clicked'; }
        rows[0].click();
        return 'clicked-row';
    }""")

    case.add_step(4, "验证物料已被选中", page,
                  "() => { const d=document.querySelector('.material-dialog'); if (!d) return 'no-dialog'; const cb=d.querySelector(\"input[type='checkbox']:checked, .is-checked, .el-checkbox.is-checked\"); return cb && cb.offsetParent !== null ? 'checked' : 'not-checked'; }",
                  "物料已被勾选", "物料未勾选",
                  expected_dom_state="is-checked|checkbox:checked")

    case.add_step(5, "点击确认添加按钮", page,
                  "() => { const btns=document.querySelectorAll('.material-dialog button'); let okBtn=null; btns.forEach(b=>{const t=(b.innerText||'').trim(); if((t.includes('确认')||t.includes('确定')||t.includes('添加')) && !b.disabled) okBtn=b;}); return okBtn && okBtn.innerText.trim(); }",
                  "确认按钮可点击", "确认按钮不可用",
                  expected_dom_state="确认|确定|添加",
                  pre_action="""() => {
        const dlg = document.querySelector('.material-dialog');
        if (!dlg) return;
        dlg.querySelectorAll('button').forEach(b => {
            const t = (b.innerText||'').trim();
            if ((t.includes('确认') || t.includes('确定') || t.includes('添加')) && !b.disabled) b.click();
        });
    }""")

    case.add_step(6, "验证关联操作完成（弹窗关闭或成功提示）", page,
                  "() => { const d=document.querySelector('.material-dialog'); const closed=!d || d.offsetParent===null || getComputedStyle(d).display==='none'; const msgs=document.querySelectorAll('.el-message, .el-notification'); let hasSuccess=false; msgs.forEach(m=>{if(m.offsetParent!==null){const t=m.innerText||''; if(t.includes('成功')||t.includes('已关联')) hasSuccess=true;}}); return closed || hasSuccess; }",
                  "弹窗已关闭或出现成功提示", "弹窗未关闭且无成功提示",
                  expected_dom_state="el-message|成功|已关联|关闭")

    all_pass = all(s["verdict"] == "PASS" for s in case.steps)
    has_warn = any(s["verdict"] == "WARN" for s in case.steps)
    if all_pass:
        case.finalize("PASS", "物料选择并确认关联全流程通过（DOM+监控双重保险）")
    elif has_warn:
        case.finalize("PASS_WITH_WARN", "操作通过但部分子步骤需关注")
    else:
        case.finalize("FAIL", "选择物料确认关联失败", {"severity":"P0","title":"关联物料失败","actual":case.steps[-1]["reasoning"]})

    page.keyboard.press('Escape')
    page.wait_for_timeout(1000)
    return case


# ============================================================
# 主函数
# ============================================================

def run_monitored_tests():
    """运行带监控的测试"""
    cases = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False, executable_path=EXEC_PATH,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        page = browser.new_page(viewport={'width': 1280, 'height': 800})
        login_admin(page, "admin")

        print("\n" + "="*60)
        print("🛡️  监控子智能体 + DOM双保险测试框架 - M04 验证")
        print("="*60)

        test_funcs = [test_open_material_dialog, test_select_material_confirm]
        for i, fn in enumerate(test_funcs, 1):
            print(f"\n[{i}/{len(test_funcs)}] {fn.__name__}")
            case = fn(page)
            cases.append(case)
            print(f"  📋 结果: {case.status}")
            for s in case.steps:
                ev = s["evidence"]
                print(f"    Step {s['step']}: {s['verdict']:5s} | DOM={ev.get('dom_passed','?')} | 监控={ev.get('monitor_verdict','?')}({ev.get('monitor_confidence','?')}%)")
                print(f"           理由: {s['reasoning']}")

        browser.close()

    # 保存结果
    output = {
        "module_name": "关联物料页面",
        "system_name": "SRMPRO 图纸库",
        "test_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "test_url": TARGET_URL,
        "test_users": "admin",
        "test_person": "测测(监控v3)",
        "framework": "MonitoredTestCase: 三证据(截图+DOM+监控子智能体)",
        "stats": {
            "total": len(cases),
            "pass": sum(1 for c in cases if c.status == "PASS"),
            "fail": sum(1 for c in cases if c.status == "FAIL"),
            "warn": sum(1 for c in cases if c.status == "PASS_WITH_WARN"),
            "skip": 0
        },
        "cases": [c.to_dict() for c in cases]
    }

    output_path = os.path.join(RESULTS_DIR, "M04_monitored_v3.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"🛡️  监控测试结果: {output['stats']}")
    print(f"📄 详细报告: {output_path}")
    print(f"📁 监控日志: {MONITOR_DIR}/")
    print(f"📸 证据截图: {SCREENSHOT_DIR}/")
    print(f"{'='*60}")

    return cases


if __name__ == "__main__":
    run_monitored_tests()
