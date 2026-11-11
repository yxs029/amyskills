#!/usr/bin/env python3
"""
test-report skill · 全量测试报告生成器
从子模块HTML报告自动聚合数据 + 套用V2样式模板

用法:
    python3 gen_full_report.py \
        --modules-dir ~/SRMPRO/文档库/05-S_交付层/HTML报告/ \
        --template assets/fullreport_template.html \
        --output ~/SRMPRO/文档库/05-S_交付层/全量报告/全量测试报告_v5.html
"""
import re, os, math, argparse
from html import unescape
from pathlib import Path

def strip_tags(text):
    text = re.sub(r'<br\s*/?>', ' ', text)
    text = re.sub(r'<[^>]+>', '', text)
    return re.sub(r'\s+', ' ', unescape(text)).strip()

def normalize_desc(desc):
    desc = re.sub(r'[^\w\u4e00-\u9fff]', '', desc)
    return desc[:30].lower()

# ══════════════════════════════════════════════
# 缺陷提取（5种格式 + 智能去重）
# ══════════════════════════════════════════════
def extract_defects(html, module_name):
    """从单个子模块HTML提取缺陷，返回统一格式列表"""
    defects = []
    seen_keys = set()

    def add(tc_id, severity, desc, actual):
        # 去重：先按描述，再按tc_id
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
        defects.append({
            'module': module_name, 'tc_id': tc_id, 'severity': severity,
            'desc': desc[:200], 'actual': actual[:200]
        })

    # 格式1: defect-table（筛选区/E2E/统计/集成）
    for table in re.findall(r'<table class="defect-table">(.*?)</table>', html, re.DOTALL):
        for row in re.findall(r'<tr>(.*?)</tr>', table, re.DOTALL):
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            if not cells: continue
            clean = [strip_tags(c) for c in cells]
            if clean[0] in ('#', '序号'): continue
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

    # 格式2: defect-box（卡片式）
    for box in re.findall(r'<div class="defect-box">(.*?)</div>', html, re.DOTALL):
        text = strip_tags(box)
        m = re.match(r'.*?缺陷\s*\[([P012\?]+|INFO)\]\s*:?\s*([^|]*?)(?:\s*\|\s*实际\s*:?\s*(.*))?$', text, re.DOTALL)
        if m:
            add('', m.group(1), m.group(2).strip(), m.group(3).strip() if m.group(3) else '')

    # 格式3: defect div（树形/报表）
    for div in re.findall(r'<div class="defect[^"]*">(.*?)</div>', html, re.DOTALL):
        text = strip_tags(div)
        if not text or len(text) < 5: continue
        m1 = re.match(r'.*?(TC-[A-Z]+-\d+).*?:(.*?)(?:缺陷描述\s*:?\s*(.*))?$', text, re.DOTALL)
        if m1:
            add(m1.group(1), 'P1', (m1.group(3) or m1.group(2)).strip()[:200], '')
            continue
        for bug_id, bug_desc in re.findall(r'(BUG-[A-Z]+-\d+-\d+)\s*:\s*(.*?)(?=BUG-|$)', text, re.DOTALL):
            add(bug_id, 'P1', bug_desc.strip()[:200], '')

    # 格式4: ch-fail用例（数据权限控制）
    for tc_id, title, severity, actual in re.findall(
        r'ch-fail.*?❌?失败\s*(TC-[A-Z]+-\d+)\s*:\s*(.*?)\s+(P[012])\s+实际结果\s*:?\s*(.*?)(?:步骤|$)',
        html, re.DOTALL):
        add(tc_id, severity, strip_tags(title), strip_tags(actual))

    # 格式5: P0安全缺陷
    for sec in re.findall(r'🚨\s*(P0安全缺陷.*?)</div>', html, re.DOTALL):
        add('', 'P0', strip_tags(sec)[:200], '')

    return defects

# ══════════════════════════════════════════════
# 提取模块统计数据（从子模块HTML）
# ══════════════════════════════════════════════
def extract_module_stats(html):
    """从子模块HTML提取统计卡片数据"""
    stats = {'total': 0, 'pass': 0, 'fail': 0, 'skip': 0, 'p0_pass': 0, 'p0_total': 0}

    # 模式1: 4列统计卡片
    for label, num in re.findall(r'class="label">([^<]+)</div>\s*<div class="number[^"]*">(\d+)</div>', html):
        label = label.strip()
        if '总' in label: stats['total'] = int(num)
        elif '通过' in label and '失败' not in label: stats['pass'] = int(num)
        elif '失败' in label: stats['fail'] = int(num)
        elif '跳过' in label: stats['skip'] = int(num)

    # 模式2: 优先级统计（P0/P1/P2 通过 X/Y）
    for pri, passed, total in re.findall(r'P[012][^"]*</div>\s*<div[^>]*>\s*(\d+)\s*/\s*(\d+)', html):
        # 简单计数：找P0行
        pass

    return stats

# ══════════════════════════════════════════════
# 渲染各个区块
# ══════════════════════════════════════════════
def render_module_row(seq, name, total, p0_pass, p0_total, rate, verdict, cls, has_report=True):
    """渲染模块表格的1行"""
    if total == 0:
        return f'''  <tr>
    <td><span class="num">{seq:02d}</span></td>
    <td><b>{name}</b></td>
    <td style="text-align:center;color:#8c8c8c">—</td>
    <td style="text-align:center;color:#8c8c8c">—</td>
    <td><div class="bar-cell"><div class="track"><div class="fill" style="width:0%"></div></div><div class="pct" style="color:#8c8c8c">—</div></div></td>
    <td style="text-align:center"><span class="tag" style="background:#8c8c8c">—</span></td>
  </tr>'''

    rate_color = '#52c41a' if rate >= 80 else '#faad14' if rate >= 50 else '#f5222d'
    p0_color = '#52c41a' if p0_pass == p0_total and p0_total > 0 else '#f5222d'
    p0_text = f'{p0_pass}/{p0_total}' if p0_total > 0 else '—'

    if has_report:
        name_cell = f'<a href="../HTML报告/{name}_测试报告.html" target="_blank" style="color:#1890ff;text-decoration:none"><b>{name}</b></a>'
    else:
        name_cell = f'<b>{name}</b>'

    return f'''  <tr>
    <td><span class="num">{seq:02d}</span></td>
    <td>{name_cell}</td>
    <td style="text-align:center">{total}</td>
    <td style="text-align:center;color:{p0_color};font-weight:700">{p0_text}</td>
    <td><div class="bar-cell"><div class="track"><div class="fill" style="width:{rate}%;background:{rate_color}"></div></div><div class="pct" style="color:{rate_color}">{rate}%</div></div></td>
    <td style="text-align:center"><span class="tag {cls}">{verdict}</span></td>
  </tr>'''


def render_module_card(seq, name, total, passing, failing, skipping, rate, verdict, cls, finding, time, has_report=True):
    """渲染1个模块详情卡"""
    if total == 0:
        return ''
    rate_color = '#52c41a' if rate >= 80 else '#faad14' if rate >= 50 else '#f5222d'
    link = ''
    if has_report:
        link = f' <a href="../HTML报告/{name}_测试报告.html" target="_blank" style="font-size:12px;color:#1890ff;text-decoration:none;margin-left:8px">📊 查看 →</a>'

    tag_text = {'pass': '✅ 通过', 'fail': '❌ 不通过', 'warn': '⚠️ 警告'}.get(cls, '⚠️ 警告')

    return f'''  <div class="module-card {cls}">
    <div class="head">
      <h4><span class="seq">{seq:02d}</span>{name}<span class="tag {cls}">{tag_text}</span>{link}</h4>
      <div class="stats">
        <span>用例 <b>{total}</b></span>
        <span style="color:#52c41a">通过 <b>{passing}</b></span>
        <span style="color:#f5222d">失败 <b>{failing}</b></span>
        <span style="color:#faad14">跳过 <b>{skipping}</b></span>
        <span style="color:{rate_color}"><b>{rate}%</b></span>
        <span style="color:#8c8c8c;font-size:12px">⏰ {time}</span>
      </div>
    </div>
    <div class="body">
      <div class="finding"><b>🎯 核心发现：</b>{finding}</div>
    </div>
  </div>'''


def render_defect_card(d, cls='p0'):
    """渲染1个缺陷卡"""
    tc = d['tc_id'] if d['tc_id'] else '—'
    sev_color = {'P0': '#cf1322', 'P1': '#fa8c16', 'P2': '#faad14', 'INFO': '#1890ff', 'P?': '#909399'}.get(d['severity'], '#909399')
    desc = d['desc'][:150]
    actual = d['actual'][:100] if d['actual'] else ''
    actual_html = f'<div style="font-size:11px;color:#8c8c8c;margin-top:4px;font-family:Courier New,monospace">实际: {actual}</div>' if actual else ''

    return f'''    <div class="defect {cls}">
      <div class="top"><span class="id">{tc}</span><span class="sev" style="background:{sev_color}">{d['severity']}</span></div>
      <div class="desc">{desc}</div>
      {actual_html}
      <div class="module">📂 {d['module']}</div>
    </div>'''


def render_donut(p0, p1, p2, info):
    """渲染SVG严重度饼图"""
    total = p0 + p1 + p2 + info
    if total == 0:
        return '<div style="color:#67C23A;padding:20px;font-size:16px">✅ 无缺陷</div>'

    r = 92.0
    circum = 2 * math.pi * r

    p0_pct = p0 / total * 100
    p1_pct = p1 / total * 100
    p2_pct = p2 / total * 100
    info_pct = info / total * 100

    def seg(pct, offset):
        L = circum * pct / 100
        return f'<circle cx="110" cy="110" r="{r}" fill="none" stroke="{{color}}" stroke-width="36" stroke-dasharray="{L:.2f} {circum-L:.2f}" stroke-dashoffset="{offset:.2f}"/>'

    p0_off, p1_off, p2_off, info_off = 0, 0, 0, 0
    p1_off = -circum * p0_pct / 100
    p2_off = p1_off - circum * p1_pct / 100
    info_off = p2_off - circum * p2_pct / 100

    return f'''<svg width="220" height="220" viewBox="0 0 220 220" style="transform:rotate(-90deg)">
        <circle cx="110" cy="110" r="{r}" fill="none" stroke="#f0f2f5" stroke-width="36"/>
        <circle cx="110" cy="110" r="{r}" fill="none" stroke="#cf1322" stroke-width="36" stroke-dasharray="{circum*p0_pct/100:.2f} {circum-circum*p0_pct/100:.2f}" stroke-dashoffset="0"/>
        <circle cx="110" cy="110" r="{r}" fill="none" stroke="#fa8c16" stroke-width="36" stroke-dasharray="{circum*p1_pct/100:.2f} {circum-circum*p1_pct/100:.2f}" stroke-dashoffset="{p1_off:.2f}"/>
        <circle cx="110" cy="110" r="{r}" fill="none" stroke="#faad14" stroke-width="36" stroke-dasharray="{circum*p2_pct/100:.2f} {circum-circum*p2_pct/100:.2f}" stroke-dashoffset="{p2_off:.2f}"/>
        <circle cx="110" cy="110" r="{r}" fill="none" stroke="#1890ff" stroke-width="36" stroke-dasharray="{circum*info_pct/100:.2f} {circum-circum*info_pct/100:.2f}" stroke-dashoffset="{info_off:.2f}"/>
      </svg>'''


# ══════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description='从子模块报告生成全量测试报告')
    parser.add_argument('--modules-dir', required=True, help='子模块报告所在目录')
    parser.add_argument('--template', default=str(Path(__file__).parent.parent / 'assets/fullreport_template.html'))
    parser.add_argument('--output', required=True, help='输出HTML路径')
    parser.add_argument('--module-stats', default=None, help='可选：手工汇总的模块统计JSON（当子模块报告无法自动提取统计时）')
    parser.add_argument('--system-name', default='SRMPRO 文档库')
    parser.add_argument('--version', default='v4.0')
    parser.add_argument('--test-date', default='2026-07-07')
    parser.add_argument('--test-url', default='test.esicint.com/SupplierManagement/newDocument')
    parser.add_argument('--test-users', default='admin / testadmin / aarontest')
    parser.add_argument('--engine', default='Playwright + Cron · GLM-5.2')
    parser.add_argument('--tools', default='Hermes Cron + Playwright Chromium 1134')
    args = parser.parse_args()

    # ─── 1. 扫描子模块报告 ───
    modules_dir = Path(args.modules_dir)
    reports = sorted([f for f in modules_dir.iterdir() if f.name.endswith('_测试报告.html')])
    print(f"📂 扫描 {len(reports)} 份子模块报告")

    # ─── 2. 提取每个模块的统计数据 ───
    module_data = []
    all_defects = []

    # 优先用人工提供的统计数据
    if args.module_stats and os.path.exists(args.module_stats):
        import json
        with open(args.module_stats) as f:
            module_data = json.load(f)
        print(f"✅ 从 {args.module_stats} 加载 {len(module_data)} 个模块统计")
    else:
        # 自动从子模块报告提取
        for rpt in reports:
            mod_name = rpt.stem.replace('_测试报告', '')
            with open(rpt) as f:
                html = f.read()
            stats = extract_module_stats(html)
            defects = extract_defects(html, mod_name)
            all_defects.extend(defects)

            if stats['total'] > 0:
                rate = round(stats['pass'] / stats['total'] * 100, 1)
                verdict = '通过' if rate >= 80 and stats['fail'] == 0 else '失败' if stats['fail'] > 0 and rate < 50 else '警告'
                cls = 'pass' if verdict == '通过' else 'fail' if verdict == '失败' else 'warn'
                module_data.append({
                    'name': mod_name, 'total': stats['total'],
                    'pass': stats['pass'], 'fail': stats['fail'], 'skip': stats['skip'],
                    'p0_pass': stats['p0_pass'], 'p0_total': stats['p0_total'],
                    'rate': rate, 'verdict': verdict, 'cls': cls,
                    'finding': '', 'time': ''
                })

    # ─── 3. 如果没聚合到模块数据，提示用户补充 ───
    if not module_data:
        print("⚠️  自动提取失败，请用 --module-stats 提供JSON文件")
        print("    格式: [{name, total, pass, fail, skip, p0_pass, p0_total, rate, verdict, cls, finding, time}, ...]")
        return

    # ─── 4. 计算全量汇总 ───
    total_cases = sum(m['total'] for m in module_data)
    total_pass = sum(m['pass'] for m in module_data)
    total_fail = sum(m['fail'] for m in module_data)
    total_skip = sum(m['skip'] for m in module_data)
    pass_rate = round(total_pass / total_cases * 100, 1) if total_cases else 0
    p0_pass = sum(m['p0_pass'] for m in module_data)
    p0_total = sum(m['p0_total'] for m in module_data)
    p0_rate = round(p0_pass / p0_total * 100, 1) if p0_total else 0

    print(f"\n📊 汇总: {total_cases}用例 / {total_pass}通过 / {total_fail}失败 / {total_skip}跳过")
    print(f"   通过率 {pass_rate}%, P0 {p0_pass}/{p0_total} = {p0_rate}%")
    print(f"🐛 缺陷: {len(all_defects)} 个 (自动提取)")

    # ─── 5. 缺陷分级 ───
    sev_weight = {'P0': 0, 'P1': 1, 'P2': 2, 'P?': 3, 'INFO': 4}
    all_defects.sort(key=lambda d: (sev_weight.get(d['severity'], 5), d['module']))

    p0_defects = [d for d in all_defects if d['severity'] == 'P0']
    p1_defects = [d for d in all_defects if d['severity'] == 'P1']
    p2_defects = [d for d in all_defects if d['severity'] == 'P2']
    other_defects = [d for d in all_defects if d['severity'] in ('INFO', 'P?')]
    total_defects = len(all_defects)

    # ─── 6. 渲染各区块 ───
    mod_rows = '\n'.join(render_module_row(i+1, m['name'], m['total'], m['p0_pass'], m['p0_total'],
                                              m['rate'], m['verdict'], m['cls'])
                          for i, m in enumerate(module_data))

    module_cards = '\n'.join(render_module_card(i+1, m['name'], m['total'], m['pass'], m['fail'], m['skip'],
                                                  m['rate'], m['verdict'], m['cls'], m.get('finding', ''),
                                                  m.get('time', ''))
                              for i, m in enumerate(module_data))

    donut_svg = render_donut(len(p0_defects), len(p1_defects), len(p2_defects), len(other_defects))
    p0_cards = '\n'.join(render_defect_card(d, 'p0') for d in p0_defects)
    p1_cards = '\n'.join(render_defect_card(d, 'p1') for d in p1_defects)
    other_cards = '\n'.join(render_defect_card(d, 'info') for d in p2_defects + other_defects)

    # ─── 7. 模板替换 ───
    template = Path(args.template).read_text(encoding='utf-8')

    # 提取截图数（从子模块报告目录的"测试截图"子目录）
    screenshot_dir = modules_dir / '测试截图'
    screenshot_count = len(list(screenshot_dir.glob('*.png'))) if screenshot_dir.exists() else 0

    # 门禁判定
    gate_pass = (p0_pass == p0_total) and (pass_rate >= 85)
    gate_verdict = '✅ 发布门禁：通过' if gate_pass else '❌ 发布门禁：不通过'
    gate_text = '通过' if gate_pass else '不通过'
    gate_reasons_list = []
    if p0_pass != p0_total:
        gate_reasons_list.append(f'▸ <b>P0 通过率仅 {p0_rate}%</b>（要求 100%）')
    gate_reasons_list.append(f'▸ <b>{len(p0_defects)} 个 P0 级缺陷</b>未修复')
    blocking_modules = [m['name'] for m in module_data if m['cls'] == 'fail' and m.get('finding')]
    if blocking_modules:
        gate_reasons_list.append(f'▸ 阻断模块：{" / ".join(blocking_modules[:4])}')
    gate_reasons = ' &nbsp;&nbsp;'.join(gate_reasons_list)

    substitutions = {
        'SYSTEM_NAME': args.system_name,
        'VERSION': args.version,
        'MODULE_COUNT': str(len(module_data)),
        'CASE_COUNT': str(total_cases),
        'PASS_COUNT': str(total_pass),
        'FAIL_COUNT': str(total_fail),
        'SKIP_COUNT': str(total_skip),
        'PASS_RATE': str(pass_rate),
        'PASS_RATE_PCT': str(pass_rate),
        'FAIL_RATE_PCT': str(round(total_fail/total_cases*100, 1) if total_cases else 0),
        'SKIP_RATE_PCT': str(round(total_skip/total_cases*100, 1) if total_cases else 0),
        'P0_PASS': str(p0_pass),
        'P0_TOTAL': str(p0_total),
        'P0_RATE': str(p0_rate),
        'ENGINE': args.engine,
        'TEST_DATE': args.test_date,
        'TEST_URL': args.test_url,
        'TEST_USERS': args.test_users,
        'TEST_TOOLS': args.tools,
        'SCREENSHOT_COUNT': str(screenshot_count),
        'GATE_VERDICT': gate_verdict,
        'GATE_VERDICT_TEXT': gate_text,
        'GATE_REASONS': gate_reasons,
        'MOD_TABLE_ROWS': mod_rows,
        'DONUT_SVG': donut_svg,
        'MODULE_CARDS': module_cards,
        'DEFECT_COUNT': str(total_defects),
        'P0_DEFECT_COUNT': str(len(p0_defects)),
        'P1_DEFECT_COUNT': str(len(p1_defects)),
        'P2_DEFECT_COUNT': str(len(p2_defects)),
        'INFO_DEFECT_COUNT': str(len(other_defects)),
        'P0_DEFECT_PCT': str(round(len(p0_defects)/total_defects*100) if total_defects else 0),
        'P1_DEFECT_PCT': str(round(len(p1_defects)/total_defects*100) if total_defects else 0),
        'P2_DEFECT_PCT': str(round(len(p2_defects)/total_defects*100) if total_defects else 0),
        'INFO_DEFECT_PCT': str(round(len(other_defects)/total_defects*100) if total_defects else 0),
        'DEFECT_P0_CARDS': p0_cards,
        'DEFECT_P1_CARDS': p1_cards,
        'DEFECT_OTHER_CARDS': other_cards,
        'P2_DEFECT_COUNT_INFO_TOTAL': str(len(p2_defects) + len(other_defects)),
        'REC_CARDS': '<div class="rec urgent"><h4>🔴 请根据上述缺陷定优先级修复</h4><ul><li>数据来源：从子模块报告自动提取</li><li>详见每个模块的子报告</li></ul></div>',
        'GEN_TIME': '2026-07-07',
    }

    html_out = template
    for key, value in substitutions.items():
        html_out = html_out.replace('{{' + key + '}}', str(value))

    # 写文件
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html_out, encoding='utf-8')

    print(f"\n✅ 全量报告已生成: {output_path}")
    print(f"   文件大小: {len(html_out):,} chars")


if __name__ == '__main__':
    main()
