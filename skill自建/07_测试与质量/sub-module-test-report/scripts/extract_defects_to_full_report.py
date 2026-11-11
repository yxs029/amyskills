#!/usr/bin/env python3
"""V3: 精修去重逻辑 — 同一模块内按描述核心内容去重"""
import re, os
from html import unescape

REPORT_DIR = '/home/aaronmy/SRMPRO/文档库/05-S_交付层/HTML报告/'
FULL_REPORT = '/home/aaronmy/SRMPRO/文档库/05-S_交付层/全量报告/SRMPRO文档库_全量测试报告_v3.1_20260707.html'

def strip_tags(text):
    text = re.sub(r'<br\s*/?>', ' | ', text)
    text = re.sub(r'<[^>]+>', '', text)
    return re.sub(r'\s+', ' ', unescape(text)).strip()

def normalize_desc(desc):
    """归一化描述用于去重：取前30个非空字符，忽略标点差异"""
    desc = re.sub(r'[^\w\u4e00-\u9fff]', '', desc)  # 只保留字母数字和中文
    return desc[:30].lower()

def extract_defects(html, module_name):
    defects = []
    seen_keys = set()
    
    def add(tc_id, severity, desc, actual):
        # 去重策略：
        # 1. 有tc_id → 按tc_id去重
        # 2. 无tc_id → 先按描述前15字符检查是否已有同描述的记录（不管tc_id）
        norm = normalize_desc(desc)
        
        # 先检查是否已有相同描述（跨tc_id/desc两种来源去重）
        for d in defects:
            if normalize_desc(d['desc']) == norm:
                # 已有相同描述，补充信息
                if not d['tc_id'] and tc_id:
                    d['tc_id'] = tc_id
                if not d['actual'] and actual:
                    d['actual'] = actual[:200]
                if d['severity'] == 'P?' and severity != 'P?':
                    d['severity'] = severity
                return
        
        # 再按tc_id检查
        if tc_id:
            for d in defects:
                if d['tc_id'] == tc_id:
                    if not d['actual'] and actual:
                        d['actual'] = actual[:200]
                    if d['severity'] == 'P?' and severity != 'P?':
                        d['severity'] = severity
                    return
        
        key = f"tc:{tc_id}" if tc_id else f"desc:{norm}"
        seen_keys.add(key)
        defects.append({
            'module': module_name, 'tc_id': tc_id, 'severity': severity,
            'desc': desc[:200], 'actual': actual[:200]
        })
    
    # 方式1: defect-table
    for table in re.findall(r'<table class="defect-table">(.*?)</table>', html, re.DOTALL):
        for row in re.findall(r'<tr>(.*?)</tr>', table, re.DOTALL):
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if not cells:
                continue
            clean = [strip_tags(c) for c in cells]
            if clean[0] in ('#', '序号'):
                continue
            if len(clean) >= 4:
                if clean[1] in ('P0', 'P1', 'P2', 'P?', 'INFO'):
                    add('', clean[1], clean[2], clean[3] if len(clean) > 3 else '')
                else:
                    add(clean[1], clean[2] if len(clean) > 2 else 'P?',
                        clean[3] if len(clean) > 3 else '', clean[4] if len(clean) > 4 else '')
            elif len(clean) == 3:
                if clean[1] in ('P0', 'P1', 'P2', 'P?', 'INFO'):
                    add('', clean[1], clean[2], '')
                else:
                    add(clean[1], 'P?', clean[2], '')
    
    # 方式2: defect-box — 用[^|]限制描述不含管道符
    for box in re.findall(r'<div class="defect-box">(.*?)</div>', html, re.DOTALL):
        text = strip_tags(box)
        m = re.match(r'.*?缺陷\s*\[([P012\?]+|INFO)\]\s*:?\s*([^|]*?)(?:\s*\|\s*实际\s*:?\s*(.*))?$', text, re.DOTALL)
        if m:
            add('', m.group(1), m.group(2).strip(), m.group(3).strip() if m.group(3) else '')
    
    # 方式3: defect div
    for div in re.findall(r'<div class="defect[^"]*">(.*?)</div>', html, re.DOTALL):
        text = strip_tags(div)
        if not text or len(text) < 5:
            continue
        m1 = re.match(r'.*?(TC-[A-Z]+-\d+).*?:(.*?)(?:缺陷描述\s*:?\s*(.*))?$', text, re.DOTALL)
        if m1:
            add(m1.group(1), 'P1', (m1.group(3) or m1.group(2)).strip()[:200], '')
            continue
        for bug_id, bug_desc in re.findall(r'(BUG-[A-Z]+-\d+-\d+)\s*:\s*(.*?)(?=BUG-|$)', text, re.DOTALL):
            add(bug_id, 'P1', bug_desc.strip()[:200], '')
    
    # 方式4: ch-fail 用例
    for tc_id, title, severity, actual in re.findall(
        r'ch-fail.*?❌?失败\s*(TC-[A-Z]+-\d+)\s*:\s*(.*?)\s+(P[012])\s+实际结果\s*:?\s*(.*?)(?:步骤|$)',
        html, re.DOTALL):
        add(tc_id, severity, strip_tags(title), strip_tags(actual))
    
    # 方式5: P0安全缺陷
    for sec in re.findall(r'🚨\s*(P0安全缺陷.*?)</div>', html, re.DOTALL):
        add('', 'P0', strip_tags(sec)[:200], '')
    
    return defects

def sev_color(s):
    return {'P0': '#ff4d4f', 'P1': '#faad14', 'P2': '#1890ff', 'P?': '#909399', 'INFO': '#909399'}.get(s, '#909399')

def sev_weight(s):
    return {'P0': 0, 'P1': 1, 'P2': 2, 'P?': 3, 'INFO': 4}.get(s, 5)

# ══════════════════════════════════════════════
all_defects = []
module_stats = {}
reports = sorted([f for f in os.listdir(REPORT_DIR) if f.endswith('_测试报告.html')])

print(f"扫描 {len(reports)} 个子模块报告...\n")
for rpt in reports:
    mod = rpt.replace('_测试报告.html', '')
    with open(os.path.join(REPORT_DIR, rpt), 'r') as f:
        html = f.read()
    defects = extract_defects(html, mod)
    all_defects.extend(defects)
    module_stats[mod] = len(defects)
    print(f"  {mod}: {len(defects)} 个缺陷")
    for d in defects:
        tc = f" [{d['tc_id']}]" if d['tc_id'] else ""
        print(f"    {d['severity']}{tc} {d['desc'][:60]}")

all_defects.sort(key=lambda d: (sev_weight(d['severity']), d['module']))
print(f"\n总计: {len(all_defects)} 个缺陷（去重后）")

# ══════════════════════════════════════════════
# 生成HTML
sev_counts = {}
for d in all_defects:
    sev_counts[d['severity']] = sev_counts.get(d['severity'], 0) + 1

stats_html = f'''
<div class="summary-cards">
    <div class="card danger"><div class="num">{len(all_defects)}</div><div class="label">🐛 缺陷总数</div></div>
    <div class="card danger"><div class="num">{sev_counts.get("P0", 0)}</div><div class="label">P0 严重</div></div>
    <div class="card warning"><div class="num">{sev_counts.get("P1", 0)}</div><div class="label">P1 重要</div></div>
    <div class="card info"><div class="num">{sev_counts.get("P2", 0)}</div><div class="label">P2 一般</div></div>
    <div class="card"><div class="num">{sev_counts.get("INFO", 0) + sev_counts.get("P?", 0)}</div><div class="label">其他/INFO</div></div>
</div>
'''

table_rows = ''
for i, d in enumerate(all_defects, 1):
    color = sev_color(d['severity'])
    tc = d['tc_id'] if d['tc_id'] else '—'
    report_file = f"../HTML报告/{d['module']}_测试报告.html"
    module_link = f'<a href="{report_file}" class="module-link" target="_blank">{d["module"]}</a>'
    actual = d['actual'][:150] if d['actual'] else '—'
    desc = d['desc'][:200] if d['desc'] else '—'
    table_rows += f'''<tr>
        <td>{i}</td>
        <td>{module_link}</td>
        <td><code>{tc}</code></td>
        <td class="severity" style="color:{color};font-weight:bold">{d['severity']}</td>
        <td>{desc}</td>
        <td style="color:#666;font-size:12px">{actual}</td>
    </tr>\n'''

defect_table_html = f'''{stats_html}
<table class="detail-table">
<thead><tr><th>#</th><th>模块</th><th>用例ID</th><th>严重度</th><th>缺陷描述</th><th>实际结果</th></tr></thead>
<tbody>
{table_rows}
</tbody>
</table>
<p style="color:#909399;font-size:13px;margin-top:10px">💡 缺陷数据自动从各子模块HTML报告中提取，点击模块名可跳转查看详情</p>'''

# 更新全量报告
with open(FULL_REPORT, 'r') as f:
    full_html = f.read()

old_section = re.search(r'<h2>6\. 缺陷.*?(?=<h2>7\.)', full_html, re.DOTALL)
if old_section:
    heatmap_rows = ''
    for mod, cnt in sorted([(k,v) for k,v in module_stats.items() if v > 0], key=lambda x: x[1], reverse=True):
        width = max(30, cnt * 30)
        color = '#ff4d4f' if cnt >= 4 else '#faad14' if cnt >= 2 else '#409EFF'
        report_file = f"../HTML报告/{mod}_测试报告.html"
        heatmap_rows += f'    <div class="heatmap-row">\n        <div class="heatmap-label"><a href="{report_file}" class="module-link" target="_blank">{mod}</a></div>\n        <div class="heatmap-bar" style="width:{width}px;background:{color}">{cnt}个缺陷</div>\n    </div>\n'
    if not heatmap_rows:
        heatmap_rows = '<div style="color:#67C23A;padding:20px;font-size:16px">✅ 所有模块均无缺陷</div>\n'
    
    new_section = f'''<h2>6. 缺陷汇总（从子模块报告自动提取）</h2>
{defect_table_html}

<h3>缺陷热力图（按模块分布）</h3>
{heatmap_rows}
'''
    full_html = full_html.replace(old_section.group(0), new_section)
    print("\n✅ 缺陷汇总区域已替换")

with open(FULL_REPORT, 'w') as f:
    f.write(full_html)

print(f"✅ 全量报告已更新")
print(f"   缺陷总数: {len(all_defects)}")
print(f"   P0: {sev_counts.get('P0', 0)} | P1: {sev_counts.get('P1', 0)} | P2: {sev_counts.get('P2', 0)} | 其他: {sev_counts.get('INFO', 0) + sev_counts.get('P?', 0)}")
