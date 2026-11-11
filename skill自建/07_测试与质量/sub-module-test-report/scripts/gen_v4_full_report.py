#!/usr/bin/env python3
"""V4报告生成 - V2样式 + V3.1数据 + 14模块版本"""
import re, os
from html import unescape
import math

def strip_tags(text):
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'<[^>]+>', '', text)
    return re.sub(r'\s+', ' ', unescape(text)).strip()

# 14个模块数据
modules = [
    {"seq": 1, "name": "数据权限控制", "code": "PERM", "total": 10, "pass": 3, "fail": 3, "skip": 4, "p0_pass": 0, "p0_total": 5, "rate": 30.0, "verdict": "失败", "cls": "fail", "finding": "P0安全缺陷：testadmin看到全量数据与admin一致，权限控制未生效", "time": "07-07 14:22"},
    {"seq": 2, "name": "安全测试", "code": "SEC", "total": 12, "pass": 11, "fail": 0, "skip": 1, "p0_pass": 4, "p0_total": 4, "rate": 91.7, "verdict": "通过", "cls": "pass", "finding": "XSS/SQL注入/CSRF防护均通过，仅1个HTTPS跳过", "time": "07-07 14:45"},
    {"seq": 3, "name": "数据一致性测试", "code": "CONS", "total": 8, "pass": 4, "fail": 4, "skip": 0, "p0_pass": 0, "p0_total": 4, "rate": 50.0, "verdict": "失败", "cls": "fail", "finding": "卡片数据与树形列表数据不一致，P0全部失败", "time": "07-07 15:10"},
    {"seq": 4, "name": "报表下载", "code": "REPORT", "total": 10, "pass": 5, "fail": 4, "skip": 1, "p0_pass": 1, "p0_total": 4, "rate": 50.0, "verdict": "失败", "cls": "fail", "finding": "Excel文件验证失败(openpyxl缺失)，下载功能部分可用", "time": "07-07 15:38"},
    {"seq": 5, "name": "筛选区", "code": "SEARCH", "total": 13, "pass": 11, "fail": 2, "skip": 0, "p0_pass": 4, "p0_total": 4, "rate": 84.6, "verdict": "通过", "cls": "pass", "finding": "P0 100%通过，2个P1体验问题(重置按钮/空状态)", "time": "07-07 16:01"},
    {"seq": 6, "name": "树形列表区", "code": "TREE", "total": 16, "pass": 12, "fail": 2, "skip": 2, "p0_pass": 1, "p0_total": 2, "rate": 75.0, "verdict": "警告", "cls": "warn", "finding": "2个P1失败(点击超时/JS语法错误)，协议三级结构问题", "time": "07-07 16:25"},
    {"seq": 7, "name": "统计卡片区", "code": "STAT", "total": 6, "pass": 0, "fail": 0, "skip": 6, "p0_pass": 0, "p0_total": 1, "rate": 0.0, "verdict": "跳过", "cls": "warn", "finding": "6个用例全部执行异常(环境问题)，需重跑", "time": "07-07 16:50"},
    {"seq": 8, "name": "集成测试", "code": "INT", "total": 7, "pass": 4, "fail": 1, "skip": 2, "p0_pass": 1, "p0_total": 2, "rate": 57.1, "verdict": "警告", "cls": "warn", "finding": "1个P1弹窗未触发，2个INFO跳过(上传/后台修改)", "time": "07-07 17:15"},
    {"seq": 9, "name": "E2E端到端测试", "code": "E2E", "total": 4, "pass": 2, "fail": 2, "skip": 0, "p0_pass": 1, "p0_total": 2, "rate": 50.0, "verdict": "失败", "cls": "fail", "finding": "Happy Path弹窗未打开，三级子公司节点未识别", "time": "07-07 17:40"},
    {"seq": 10, "name": "并发竞态测试", "code": "CONCUR", "total": 12, "pass": 12, "fail": 0, "skip": 0, "p0_pass": 2, "p0_total": 2, "rate": 100.0, "verdict": "通过", "cls": "pass", "finding": "并发操作无竞态问题，数据一致性良好", "time": "07-07 18:05"},
    {"seq": 11, "name": "异常容错测试", "code": "EXC", "total": 18, "pass": 18, "fail": 0, "skip": 0, "p0_pass": 3, "p0_total": 3, "rate": 100.0, "verdict": "通过", "cls": "pass", "finding": "异常输入/网络中断/超时处理全部正确", "time": "07-07 18:30"},
    {"seq": 12, "name": "用户场景测试", "code": "SCN", "total": 14, "pass": 14, "fail": 0, "skip": 0, "p0_pass": 2, "p0_total": 2, "rate": 100.0, "verdict": "通过", "cls": "pass", "finding": "7个典型用户场景全部通过", "time": "07-07 18:55"},
    {"seq": 13, "name": "文档详情弹窗", "code": "MODAL", "total": 0, "pass": 0, "fail": 0, "skip": 0, "p0_pass": 0, "p0_total": 0, "rate": 0, "verdict": "—", "cls": "warn", "finding": "无独立报告", "time": ""},
    {"seq": 14, "name": "性能响应测试", "code": "PERF", "total": 0, "pass": 0, "fail": 0, "skip": 0, "p0_pass": 0, "p0_total": 0, "rate": 0, "verdict": "—", "cls": "warn", "finding": "无独立报告", "time": ""},
]

total_cases = sum(m["total"] for m in modules)
total_pass = sum(m["pass"] for m in modules)
total_fail = sum(m["fail"] for m in modules)
total_skip = sum(m["skip"] for m in modules)
overall_rate = round(total_pass / total_cases * 100, 1) if total_cases else 0
p0_total = sum(m["p0_total"] for m in modules)
p0_pass = sum(m["p0_pass"] for m in modules)
p0_rate = round(p0_pass / p0_total * 100, 1) if p0_total else 0

# 提取缺陷
REPORT_DIR = '/home/aaronmy/SRMPRO/文档库/05-S_交付层/HTML报告/'

def normalize_desc(desc):
    desc = re.sub(r'[^\w\u4e00-\u9fff]', '', desc)
    return desc[:30].lower()

def extract_defects(html, module_name):
    defects = []
    seen_keys = set()
    def add(tc_id, severity, desc, actual):
        norm = normalize_desc(desc)
        for d in defects:
            if normalize_desc(d['desc']) == norm:
                if not d['tc_id'] and tc_id: d['tc_id'] = tc_id
                if not d['actual'] and actual: d['actual'] = actual[:200]
                if d['severity'] == 'P?' and severity != 'P?': d['severity'] = severity
                return
        if tc_id:
            for d in defects:
                if d['tc_id'] == tc_id:
                    if not d['actual'] and actual: d['actual'] = actual[:200]
                    return
        key = f"tc:{tc_id}" if tc_id else f"desc:{norm}"
        seen_keys.add(key)
        defects.append({'module': module_name, 'tc_id': tc_id, 'severity': severity, 'desc': desc[:200], 'actual': actual[:200]})
    for table in re.findall(r'<table class="defect-table">(.*?)</table>', html, re.DOTALL):
        for row in re.findall(r'<tr>(.*?)</tr>', table, re.DOTALL):
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if not cells: continue
            clean = [strip_tags(c) for c in cells]
            if clean[0] in ('#', '序号'): continue
            if len(clean) >= 4:
                if clean[1] in ('P0', 'P1', 'P2', 'P?', 'INFO'): add('', clean[1], clean[2], clean[3] if len(clean) > 3 else '')
                else: add(clean[1], clean[2] if len(clean) > 2 else 'P?', clean[3] if len(clean) > 3 else '', clean[4] if len(clean) > 4 else '')
            elif len(clean) == 3:
                if clean[1] in ('P0', 'P1', 'P2', 'P?', 'INFO'): add('', clean[1], clean[2], '')
                else: add(clean[1], 'P?', clean[2], '')
    for box in re.findall(r'<div class="defect-box">(.*?)</div>', html, re.DOTALL):
        text = strip_tags(box)
        m = re.match(r'.*?缺陷\s*\[([P012\?]+|INFO)\]\s*:?\s*([^|]*?)(?:\s*\|\s*实际\s*:?\s*(.*))?$', text, re.DOTALL)
        if m: add('', m.group(1), m.group(2).strip(), m.group(3).strip() if m.group(3) else '')
    for div in re.findall(r'<div class="defect[^"]*">(.*?)</div>', html, re.DOTALL):
        text = strip_tags(div)
        if not text or len(text) < 5: continue
        m1 = re.match(r'.*?(TC-[A-Z]+-\d+).*?:(.*?)(?:缺陷描述\s*:?\s*(.*))?$', text, re.DOTALL)
        if m1:
            add(m1.group(1), 'P1', (m1.group(3) or m1.group(2)).strip()[:200], '')
            continue
        for bug_id, bug_desc in re.findall(r'(BUG-[A-Z]+-\d+-\d+)\s*:\s*(.*?)(?=BUG-|$)', text, re.DOTALL):
            add(bug_id, 'P1', bug_desc.strip()[:200], '')
    for tc_id, title, severity, actual in re.findall(r'ch-fail.*?❌?失败\s*(TC-[A-Z]+-\d+)\s*:\s*(.*?)\s+(P[012])\s+实际结果\s*:?\s*(.*?)(?:步骤|$)', html, re.DOTALL):
        add(tc_id, severity, strip_tags(title), strip_tags(actual))
    for sec in re.findall(r'🚨\s*(P0安全缺陷.*?)</div>', html, re.DOTALL):
        add('', 'P0', strip_tags(sec)[:200], '')
    return defects

all_defects = []
for rpt in sorted(os.listdir(REPORT_DIR)):
    if not rpt.endswith('_测试报告.html'): continue
    mod = rpt.replace('_测试报告.html', '')
    with open(os.path.join(REPORT_DIR, rpt), 'r') as f:
        html = f.read()
    all_defects.extend(extract_defects(html, mod))

sev_weight = {'P0': 0, 'P1': 1, 'P2': 2, 'P?': 3, 'INFO': 4}
all_defects.sort(key=lambda d: (sev_weight.get(d['severity'], 5), d['module']))

p0_defects = [d for d in all_defects if d['severity'] == 'P0']
p1_defects = [d for d in all_defects if d['severity'] == 'P1']
p2_defects = [d for d in all_defects if d['severity'] == 'P2']
other_defects = [d for d in all_defects if d['severity'] in ('INFO', 'P?')]
total_defects = len(all_defects)

# 饼图
r = 92.0
circum = 2 * math.pi * r
p0_pct = p0_defects.__len__() / total_defects * 100 if total_defects else 0
p1_pct = len(p1_defects) / total_defects * 100 if total_defects else 0
p2_pct = len(p2_defects) / total_defects * 100 if total_defects else 0
info_pct = 100 - p0_pct - p1_pct - p2_pct
p0_len = circum * p0_pct / 100
p1_len = circum * p1_pct / 100
p2_len = circum * p2_pct / 100
info_len = circum * info_pct / 100
p0_off = 0
p1_off = -p0_len
p2_off = -(p0_len + p1_len)
info_off = -(p0_len + p1_len + p2_len)

# 模块表
mod_rows = ''
for m in modules:
    if m["total"] == 0:
        mod_rows += f'          <tr><td><span class="num">{m["seq"]:02d}</span></td><td><b>{m["name"]}</b></td><td style="text-align:center;color:#8c8c8c">—</td><td style="text-align:center;color:#8c8c8c">—</td><td><div class="bar-cell"><div class="track"><div class="fill" style="width:0%"></div></div><div class="pct" style="color:#8c8c8c">—</div></div></td><td style="text-align:center"><span class="tag" style="background:#8c8c8c">—</span></td></tr>\n'
        continue
    rate_color = '#52c41a' if m["rate"] >= 80 else '#faad14' if m["rate"] >= 50 else '#f5222d'
    p0_color = '#52c41a' if m["p0_pass"] == m["p0_total"] else '#f5222d'
    p0_text = f'{m["p0_pass"]}/{m["p0_total"]}' if m["p0_total"] > 0 else '—'
    tag_cls = {'pass': 'pass', 'fail': 'fail', 'warn': 'warn'}.get(m["cls"], 'warn')
    has_report = m["code"] not in ('MODAL', 'PERF')
    if has_report:
        name_cell = f'<a href="../HTML报告/{m["name"]}_测试报告.html" target="_blank" style="color:#1890ff;text-decoration:none"><b>{m["name"]}</b></a>'
    else:
        name_cell = f'<b>{m["name"]}</b> <span style="font-size:11px;color:#8c8c8c">(详见V2)</span>'
    mod_rows += f'          <tr><td><span class="num">{m["seq"]:02d}</span></td><td>{name_cell}</td><td style="text-align:center">{m["total"]}</td><td style="text-align:center;color:{p0_color};font-weight:700">{p0_text}</td><td><div class="bar-cell"><div class="track"><div class="fill" style="width:{m["rate"]}%;background:{rate_color}"></div></div><div class="pct" style="color:{rate_color}">{m["rate"]}%</div></div></td><td style="text-align:center"><span class="tag {tag_cls}">{m["verdict"]}</span></td></tr>\n'

# 模块详情卡
module_cards = ''
for m in modules:
    if m["total"] == 0: continue
    rate_color = '#52c41a' if m["rate"] >= 80 else '#faad14' if m["rate"] >= 50 else '#f5222d'
    has_report = m["code"] not in ('MODAL', 'PERF')
    link = f' <a href="../HTML报告/{m["name"]}_测试报告.html" target="_blank" style="font-size:12px;color:#1890ff;text-decoration:none;margin-left:8px">📊 查看 →</a>' if has_report else ''
    card_cls = m["cls"]
    tag_cls = {'pass': 'pass', 'fail': 'fail', 'warn': 'warn'}.get(card_cls, 'warn')
    tag_text = {'pass': '✅ 通过', 'fail': '❌ 不通过', 'warn': '⚠️ 警告'}.get(card_cls, '⚠️ 警告')
    module_cards += f'''    <div class="module-card {card_cls}">
      <div class="head">
        <h4><span class="seq">{m["seq"]:02d}</span>{m["name"]}<span class="tag {tag_cls}">{tag_text}</span>{link}</h4>
        <div class="stats">
          <span>用例 <b>{m["total"]}</b></span>
          <span style="color:#52c41a">通过 <b>{m["pass"]}</b></span>
          <span style="color:#f5222d">失败 <b>{m["fail"]}</b></span>
          <span style="color:#faad14">跳过 <b>{m["skip"]}</b></span>
          <span style="color:{rate_color}"><b>{m["rate"]}%</b></span>
          <span style="color:#8c8c8c;font-size:12px">⏰ {m["time"]}</span>
        </div>
      </div>
      <div class="body">
        <div class="finding"><b>🎯 核心发现：</b>{m["finding"]}</div>
      </div>
    </div>
'''

# 缺陷卡片
def defect_cards(defects, cls):
    cards = ''
    for d in defects:
        tc = d['tc_id'] if d['tc_id'] else '—'
        sev_color = {'P0': '#cf1322', 'P1': '#fa8c16', 'P2': '#faad14', 'INFO': '#1890ff', 'P?': '#909399'}.get(d['severity'], '#909399')
        desc = d['desc'][:150]
        actual = d['actual'][:100] if d['actual'] else ''
        actual_html = f'<div style="font-size:11px;color:#8c8c8c;margin-top:4px;font-family:Courier New,monospace">实际: {actual}</div>' if actual else ''
        cards += f'      <div class="defect {cls.lower()}"><div class="top"><span class="id">{tc}</span><span class="sev" style="background:{sev_color}">{d["severity"]}</span></div><div class="desc">{desc}</div>{actual_html}<div class="module">📂 {d["module"]}</div></div>\n'
    return cards

pass_pct = overall_rate

html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>SRMPRO 文档库 全量自动化测试报告 v4</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%);min-height:100vh;color:#262626;line-height:1.6}}
.container{{max-width:1320px;margin:0 auto;padding:24px}}
.hero{{background:linear-gradient(135deg,#fff 0%,#f8fafc 100%);border-radius:16px;padding:32px 36px;margin-bottom:20px;box-shadow:0 10px 40px rgba(0,0,0,.2);position:relative;overflow:hidden}}
.hero::before{{content:'';position:absolute;top:0;left:0;width:100%;height:6px;background:linear-gradient(90deg,#52c41a 0%,#52c41a {pass_pct}%,#f5222d {pass_pct}%,#f5222d 100%)}}
.hero h1{{font-size:30px;color:#1a1a2e;margin-bottom:8px;display:flex;align-items:center;gap:12px}}
.hero .subtitle{{color:#666;font-size:14px;margin-bottom:18px}}
.hero .meta{{display:flex;flex-wrap:wrap;gap:16px;font-size:13px;color:#595959}}
.hero .meta span{{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:#f0f5ff;border-radius:16px}}
.hero .verdict{{position:absolute;top:32px;right:36px;padding:10px 22px;border-radius:24px;background:linear-gradient(135deg,#cf1322,#a8071a);color:#fff;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(207,19,34,.4)}}
.kpi-grid{{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:20px}}
.kpi{{background:#fff;border-radius:12px;padding:20px;box-shadow:0 6px 20px rgba(0,0,0,.15);position:relative;overflow:hidden;transition:transform .2s}}
.kpi:hover{{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.2)}}
.kpi::before{{content:'';position:absolute;left:0;top:0;width:4px;height:100%}}
.kpi.total::before{{background:#1890ff}}
.kpi.passed::before{{background:#52c41a}}
.kpi.failed::before{{background:#f5222d}}
.kpi.skipped::before{{background:#faad14}}
.kpi.rate::before{{background:#722ed1}}
.kpi.p0::before{{background:#cf1322}}
.kpi .label{{font-size:12px;color:#8c8c8c;margin-bottom:8px;font-weight:500}}
.kpi .value{{font-size:30px;font-weight:700;color:#1a1a2e;line-height:1;margin-bottom:4px}}
.kpi .sub{{font-size:11px;color:#bfbfbf}}
.kpi.p0 .value{{color:#cf1322}}
.section{{background:#fff;border-radius:12px;padding:28px;margin-bottom:20px;box-shadow:0 6px 20px rgba(0,0,0,.15)}}
.section h2{{font-size:20px;color:#1a1a2e;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #f0f2f5;display:flex;align-items:center;gap:10px}}
.section h2 .icon{{font-size:24px}}
.two-col{{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;margin-bottom:20px}}
table.mod-table{{width:100%;border-collapse:separate;border-spacing:0;font-size:14px}}
table.mod-table thead th{{background:#1a1a2e;color:#fff;padding:12px 10px;font-weight:600;text-align:left;font-size:13px}}
table.mod-table thead th:first-child{{border-radius:8px 0 0 0}}
table.mod-table thead th:last-child{{border-radius:0 8px 0 0}}
table.mod-table tbody td{{padding:12px 10px;border-bottom:1px solid #f0f2f5}}
table.mod-table tbody tr:hover{{background:#fafafa}}
table.mod-table .num{{color:#1890ff;font-weight:600;font-size:13px}}
.tag{{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;color:#fff}}
.tag.pass{{background:#52c41a}}
.tag.warn{{background:#faad14}}
.tag.fail{{background:#f5222d}}
.bar-cell{{display:flex;align-items:center;gap:8px}}
.bar-cell .track{{flex:1;height:8px;background:#f0f2f5;border-radius:4px;overflow:hidden}}
.bar-cell .fill{{height:100%;border-radius:4px;transition:width .8s}}
.bar-cell .pct{{font-weight:700;font-size:13px;min-width:50px;text-align:right}}
.module-card{{background:#fff;border-radius:10px;padding:0;margin-bottom:14px;border:1px solid #f0f2f5;overflow:hidden}}
.module-card .head{{padding:14px 18px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(90deg,#fafafa,#fff);border-bottom:1px solid #f0f2f5;flex-wrap:wrap;gap:12px}}
.module-card .head h4{{font-size:15px;color:#1a1a2e;display:flex;align-items:center;gap:10px;flex-wrap:wrap}}
.module-card .head .seq{{width:30px;height:30px;border-radius:6px;background:#1890ff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}}
.module-card .head .stats{{display:flex;align-items:center;gap:16px;font-size:13px;color:#595959}}
.module-card .body{{padding:18px;background:#fafbfc}}
.module-card .finding{{background:#fff7e6;border-left:3px solid #faad14;padding:10px 14px;border-radius:4px;font-size:13px;color:#262626;margin-bottom:12px}}
.module-card.fail .finding{{background:#fff1f0;border-left-color:#f5222d}}
.module-card.pass .finding{{background:#f6ffed;border-left-color:#52c41a}}
.defects-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px;margin-top:14px}}
.defect{{border-radius:8px;padding:14px 18px;background:#fff;border:1px solid #f0f0f0;border-left:4px solid #d9d9d9}}
.defect.p0{{border-left-color:#cf1322;background:linear-gradient(90deg,#fff5f5 0%,#fff 70%)}}
.defect.p1{{border-left-color:#fa8c16;background:linear-gradient(90deg,#fff7e6 0%,#fff 70%)}}
.defect.info{{border-left-color:#1890ff}}
.defect .top{{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}}
.defect .id{{font-family:'Courier New',monospace;font-weight:700;font-size:13px;color:#1a1a2e}}
.defect .sev{{padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;color:#fff}}
.defect .desc{{font-size:13px;color:#595959;line-height:1.5}}
.defect .module{{font-size:11px;color:#8c8c8c;margin-top:6px}}
.donut-wrap{{display:flex;align-items:center;justify-content:center;flex-direction:column;padding:10px;position:relative}}
.donut-center{{position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% - 18px));text-align:center}}
.donut-center .num{{font-size:36px;font-weight:700;color:#1a1a2e}}
.donut-center .lab{{font-size:12px;color:#8c8c8c;margin-top:4px}}
.legend{{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:14px}}
.legend .item{{display:flex;align-items:center;gap:6px;font-size:12px;color:#595959}}
.legend .dot{{width:12px;height:12px;border-radius:3px}}
.gate-banner{{background:linear-gradient(135deg,#cf1322,#820014);color:#fff;padding:24px 32px;border-radius:12px;margin-bottom:20px;display:flex;align-items:center;gap:24px;box-shadow:0 8px 28px rgba(207,19,34,.3)}}
.gate-banner .icon{{font-size:48px;line-height:1}}
.gate-banner .text h3{{font-size:22px;margin-bottom:8px}}
.gate-banner .text .reasons{{font-size:14px;opacity:.95;line-height:1.7}}
.rec-list{{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px;margin-top:14px}}
.rec{{background:#fff;border:1px solid #f0f0f0;border-radius:10px;padding:18px;border-top:4px solid #1890ff}}
.rec.urgent{{border-top-color:#cf1322}}
.rec.high{{border-top-color:#fa8c16}}
.rec h4{{font-size:15px;color:#1a1a2e;margin-bottom:10px;display:flex;align-items:center;gap:8px}}
.rec ul{{padding-left:18px;font-size:13px;color:#595959;line-height:1.8}}
.rec ul li{{margin-bottom:4px}}
.rec code{{background:#f5f5f5;padding:1px 5px;border-radius:3px;font-family:'Courier New';font-size:12px}}
footer{{text-align:center;color:rgba(255,255,255,.7);font-size:12px;padding:30px 0;line-height:1.8}}
@media (max-width:1024px){{.kpi-grid{{grid-template-columns:repeat(3,1fr)}}.two-col{{grid-template-columns:1fr}}.hero .verdict{{position:static;margin-top:14px;display:inline-block}}}}
@media (max-width:640px){{.kpi-grid{{grid-template-columns:repeat(2,1fr)}}.defects-grid{{grid-template-columns:1fr}}.rec-list{{grid-template-columns:1fr}}}}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    <h1>📋 SRMPRO 文档库 全量自动化测试报告 <span style="font-size:14px;color:#cf1322;font-weight:600;background:#fff1f0;padding:4px 10px;border-radius:6px">v4.0</span></h1>
    <div class="subtitle">14 模块 · {total_cases} 用例 · 全自动化执行 · Playwright + Cron · GLM-5.2</div>
    <div class="meta">
      <span>📅 测试日期: 2026-07-07</span>
      <span>🌐 test.esicint.com/SupplierManagement/newDocument</span>
      <span>👥 admin / testadmin / aarontest</span>
      <span>🤖 Hermes Cron + Playwright Chromium 1134</span>
      <span>📸 461 张截图证据</span>
    </div>
    <div class="verdict">❌ 发布门禁：不通过</div>
  </div>
  <div class="kpi-grid">
    <div class="kpi total"><div class="label">📋 总用例</div><div class="value">{total_cases}</div><div class="sub">14 个模块</div></div>
    <div class="kpi passed"><div class="label">✅ 通过</div><div class="value">{total_pass}</div><div class="sub">{round(total_pass/total_cases*100,1)}%</div></div>
    <div class="kpi failed"><div class="label">❌ 失败</div><div class="value">{total_fail}</div><div class="sub">{round(total_fail/total_cases*100,1)}%</div></div>
    <div class="kpi skipped"><div class="label">⏭️ 跳过</div><div class="value">{total_skip}</div><div class="sub">{round(total_skip/total_cases*100,1)}%</div></div>
    <div class="kpi rate"><div class="label">🎯 通过率</div><div class="value">{overall_rate}%</div><div class="sub">门禁要求 ≥85%</div></div>
    <div class="kpi p0"><div class="label">🚨 P0 通过率</div><div class="value">{p0_rate}%</div><div class="sub">{p0_pass}/{p0_total} · 要求 100%</div></div>
  </div>
  <div class="gate-banner">
    <div class="icon">🚫</div>
    <div class="text">
      <h3>发布门禁判定：不通过</h3>
      <div class="reasons">▸ <b>P0 通过率仅 {p0_rate}%</b>（要求 100%）&nbsp;&nbsp;▸ <b>{len(p0_defects)} 个 P0 级缺陷</b>未修复&nbsp;&nbsp;▸ 阻断模块：数据权限/数据一致性/报表下载/E2E</div>
    </div>
  </div>
  <div class="two-col">
    <div class="section" style="margin:0">
      <h2><span class="icon">📊</span>各模块执行结果</h2>
      <table class="mod-table">
        <thead><tr><th style="width:40px">#</th><th>模块</th><th style="width:60px;text-align:center">用例</th><th style="width:60px;text-align:center">P0</th><th style="width:160px">通过率</th><th style="width:80px;text-align:center">判定</th></tr></thead>
        <tbody>
{mod_rows}        </tbody>
      </table>
    </div>
    <div class="section" style="margin:0">
      <h2><span class="icon">🍩</span>缺陷严重度分布</h2>
      <div class="donut-wrap">
        <svg width="220" height="220" viewBox="0 0 220 220" style="transform:rotate(-90deg)">
          <circle cx="110" cy="110" r="{r}" fill="none" stroke="#f0f2f5" stroke-width="36"/>
          <circle cx="110" cy="110" r="{r}" fill="none" stroke="#cf1322" stroke-width="36" stroke-dasharray="{p0_len:.2f} {circum-p0_len:.2f}" stroke-dashoffset="{p0_off:.2f}"/>
          <circle cx="110" cy="110" r="{r}" fill="none" stroke="#fa8c16" stroke-width="36" stroke-dasharray="{p1_len:.2f} {circum-p1_len:.2f}" stroke-dashoffset="{p1_off:.2f}"/>
          <circle cx="110" cy="110" r="{r}" fill="none" stroke="#faad14" stroke-width="36" stroke-dasharray="{p2_len:.2f} {circum-p2_len:.2f}" stroke-dashoffset="{p2_off:.2f}"/>
          <circle cx="110" cy="110" r="{r}" fill="none" stroke="#1890ff" stroke-width="36" stroke-dasharray="{info_len:.2f} {circum-info_len:.2f}" stroke-dashoffset="{info_off:.2f}"/>
        </svg>
        <div class="donut-center"><div class="num">{total_defects}</div><div class="lab">缺陷总数</div></div>
      </div>
      <div class="legend">
        <div class="item"><div class="dot" style="background:#cf1322"></div><span><b>P0</b> {len(p0_defects)} ({p0_pct:.0f}%)</span></div>
        <div class="item"><div class="dot" style="background:#fa8c16"></div><span><b>P1</b> {len(p1_defects)} ({p1_pct:.0f}%)</span></div>
        <div class="item"><div class="dot" style="background:#faad14"></div><span><b>P2</b> {len(p2_defects)} ({p2_pct:.0f}%)</span></div>
        <div class="item"><div class="dot" style="background:#1890ff"></div><span><b>INFO</b> {len(other_defects)} ({info_pct:.0f}%)</span></div>
      </div>
    </div>
  </div>
  <div class="section">
    <h2><span class="icon">🔍</span>模块详细发现</h2>
{module_cards}  </div>
  <div class="section">
    <h2><span class="icon">🚨</span>P0 关键缺陷聚焦（{len(p0_defects)} 个 · 必须修复）</h2>
    <div class="defects-grid">
{defect_cards(p0_defects, 'P0')}    </div>
  </div>
  <div class="section">
    <h2><span class="icon">⚠️</span>P1 高优缺陷（{len(p1_defects)} 个）</h2>
    <div class="defects-grid">
{defect_cards(p1_defects, 'P1')}    </div>
  </div>
  <div class="section">
    <h2><span class="icon">📝</span>P2/INFO 其他缺陷（{len(p2_defects) + len(other_defects)} 个）</h2>
    <div class="defects-grid">
{defect_cards(p2_defects + other_defects, 'INFO')}    </div>
  </div>
  <div class="section">
    <h2><span class="icon">🔧</span>修复建议（按优先级）</h2>
    <div class="rec-list">
      <div class="rec urgent">
        <h4>🔴 1. 数据权限重构（PERM）</h4>
        <ul>
          <li><b>后端</b>：文档库汇总接口加 <code>用户ID → 归属供应商</code> 过滤</li>
          <li><b>前端</b>：移除"拦截展开"兜底，正常展示过滤后数据</li>
          <li><b>验证</b>：testadmin 应看到 &lt; 53 类</li>
          <li><b>覆盖</b>：E2E-001, TC-PERM-001~004</li>
        </ul>
      </div>
      <div class="rec urgent">
        <h4>🔴 2. 数据一致性修复（CONS）</h4>
        <ul><li><b>排查</b>：卡片与树形列表数据同步逻辑</li><li><b>覆盖</b>：CONS-001~004</li></ul>
      </div>
      <div class="rec urgent">
        <h4>🔴 3. 报表下载链路修复（REPORT）</h4>
        <ul><li><b>排查</b>：下载接口响应头 + openpyxl依赖</li><li><b>覆盖</b>：TC-REPORT-001~004</li></ul>
      </div>
      <div class="rec urgent">
        <h4>🔴 4. E2E Happy Path 修复（E2E）</h4>
        <ul><li><b>覆盖</b>：E2E-001, E2E-002</li></ul>
      </div>
      <div class="rec" style="border-top-color:#faad14">
        <h4>🟡 5. 统计卡片区重跑（STAT）</h4>
        <ul><li>6个用例全部执行异常，需重跑</li></ul>
      </div>
      <div class="rec" style="border-top-color:#faad14">
        <h4>🟡 6. 其他优化</h4>
        <ul><li>TREE-003/005 操作列和JS语法修复</li><li>SEARCH-005/007 筛选区体验优化</li><li>ITG-002 集成测试弹窗修复</li></ul>
      </div>
    </div>
  </div>
  <footer>
    📋 SRMPRO 文档库 · 全量自动化测试报告 v4.0（V2样式）<br>
    测测 (CeCe) · 服务对象：袁雪松（老大）· 生成时间：2026-07-07<br>
    数据来源：12 份 HTML子模块报告 + 461 张截图 · 模型：GLM-5.2 · 缺陷数据从子模块报告自动提取
  </footer>
</div>
</body>
</html>'''

output_path = '/home/aaronmy/SRMPRO/文档库/05-S_交付层/全量报告/SRMPRO文档库_全量测试报告_v4_20260707.html'
with open(output_path, 'w') as f:
    f.write(html)

print(f"✅ V4报告已生成: {output_path}")
print(f"   文件大小: {len(html):,} chars")
print(f"   总用例: {total_cases}, 通过: {total_pass}, 失败: {total_fail}, 跳过: {total_skip}")
print(f"   通过率: {overall_rate}%, P0: {p0_pass}/{p0_total} = {p0_rate}%")
print(f"   缺陷: P0={len(p0_defects)}, P1={len(p1_defects)}, P2={len(p2_defects)}, INFO={len(other_defects)}")
