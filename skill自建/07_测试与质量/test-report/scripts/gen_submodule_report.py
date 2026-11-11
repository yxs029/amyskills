#!/usr/bin/env python3
"""
test-report skill · 子模块测试报告生成器
读取测试结果JSON + 套用子模块HTML模板 -> 输出单文件自包含HTML

用法:
    python3 gen_submodule_report.py \
        --result test_results.json \
        --template assets/submodule_template.html \
        --output ~/SRMPRO/文档库/05-S_交付层/HTML报告/筛选区_测试报告.html

JSON 兼容性（2026-07-17 修复）:
    - module_name / module 两种 key 都支持
    - screenshots 支持预编码 base64 和文件路径两种格式
"""
import re, os, json, argparse, base64
from pathlib import Path

# ══════════════════════════════════════════════
# 模板渲染（按{{变量}}替换）
# ══════════════════════════════════════════════

def render_case_section(case):
    """渲染1个用例详情卡（含步骤+截图+缺陷框）"""
    pri_color = {'P0': '#cf1322', 'P1': '#fa8c16', 'P2': '#faad14', 'P?': '#909399'}.get(case.get('priority', 'P1'), '#909399')
    status_cls = case.get('status', 'PASS').lower()  # pass/fail/skip
    tc_id = case.get('id', '')
    title = case.get('title', '')
    actual = case.get('actual', '')
    precondition = case.get('precondition', '')
    defect = case.get('defect', None)
    steps = case.get('steps', [])
    screenshots = case.get('screenshots', [])  # [{file, label, description, base64?, size_kb?}]

    # 缺陷框
    defect_html = ''
    if defect and status_cls == 'fail':
        defect_html = f'''
        <div class="defect-box">
          <div class="defect-header">⚠️ 缺陷 [{defect.get('severity', 'P1')}] {defect.get('title', '')}</div>
          <div class="expected-vs-actual">
            <div class="row"><span class="lbl">预期:</span><span>{defect.get('expected', '')}</span></div>
            <div class="row"><span class="lbl">实际:</span><span class="actual">{defect.get('actual', '')}</span></div>
            <div class="row"><span class="lbl">复现:</span><span class="code">{defect.get('reproduce_path', '')}</span></div>
          </div>
        </div>'''
    elif defect:
        # INFO 级别的备注框（如 cron-unsafe 跳过说明）
        defect_html = f'''
        <div class="defect-box" style="background:#f5f5f5;border-color:#d9d9d9">
          <div class="defect-header" style="color:#666">ℹ️ 备注 [{defect.get('severity', 'INFO')}] {defect.get('title', '')}</div>
          {defect.get('actual', '')}
        </div>'''

    # 步骤
    steps_html = ''
    for i, step in enumerate(steps, 1):
        step_ok = step.get('ok', False)
        step_class = 'step-pass' if step_ok else 'step-fail'
        expected_html = ''
        if not step_ok and step.get('expected'):
            expected_html = f'<div class="step-expected"><span class="lbl">预期:</span>{step["expected"]}</div>'
        steps_html += f'''
        <div class="step {step_class}">
          <div class="step-num">{i}</div>
          <div class="step-body">
            <div class="step-action">{step.get('action', '')}</div>
            <div class="step-result">{step.get('result', '')}</div>
            {expected_html}
          </div>
        </div>'''

    # 截图画廊（base64内嵌）- 支持预编码base64和文件路径两种格式
    gallery_html = ''
    if screenshots:
        imgs = ''
        for ss in screenshots:
            # 优先使用预编码的 base64 数据（2026-07-17 兼容性修复）
            b64 = ss.get('base64', '')
            if not b64:
                # 回退到文件路径方式
                file_path = ss.get('file', '')
                if file_path and os.path.exists(file_path):
                    b64 = image_to_base64(file_path)
            if b64:
                # 确保 base64 带 data URI 前缀
                if not b64.startswith('data:'):
                    b64 = f'data:image/png;base64,{b64}'
                # 白屏检测
                size_kb = ss.get('size_kb', 0)
                is_blank = size_kb > 0 and size_kb < 10
                blank_cls = 'blank-shot' if is_blank else ''
                label = ss.get('label', ss.get('file', ''))
                imgs += f'<div class="shot-thumb {blank_cls}" onclick="openLightbox(this)"><img src="{b64}" alt="{label}"><div class="shot-label">{label}</div></div>'
        if imgs:
            gallery_html = f'''
            <div class="sc-gallery">
              <h4>📸 截图 ({len(screenshots)})</h4>
              <div class="sc-grid">{imgs}</div>
            </div>'''

    return f'''
    <div class="case-card {status_cls}">
      <div class="case-header">
        <span class="case-id">{tc_id}</span>
        <span class="case-title">{title}</span>
        <span class="case-pri" style="background:{pri_color}">{case.get('priority', '')}</span>
        <span class="case-status {status_cls}">{'✅ 通过' if status_cls == 'pass' else '❌ 失败' if status_cls == 'fail' else '⏭️ 跳过'}</span>
      </div>
      <div class="case-body">
        {f'<div class="case-precondition"><b>前置条件:</b> {precondition}</div>' if precondition else ''}
        <div class="case-actual"><b>实际结果:</b> <span class="actual-text">{actual}</span></div>
        {defect_html}
        <div class="case-steps">
          <h4>📋 执行步骤</h4>
          {steps_html}
        </div>
        {gallery_html}
      </div>
    </div>'''


def image_to_base64(image_path):
    """图片转base64"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def render_summary_cards(stats):
    """4列统计卡片"""
    return f'''
    <div class="stats">
      <div class="stat-card total"><div class="number">{stats['total']}</div><div class="label">总用例</div></div>
      <div class="stat-card pass"><div class="number">{stats['pass']}</div><div class="label">通过</div></div>
      <div class="stat-card fail"><div class="number">{stats['fail']}</div><div class="label">失败</div></div>
      <div class="stat-card skip"><div class="number">{stats['skip']}</div><div class="label">跳过</div></div>
    </div>'''


def render_priority_stats(p0, p1, p2):
    """3列优先级统计"""
    def render_card(label, passed, total, color):
        rate = round(passed / total * 100, 1) if total else 0
        return f'<div class="pstat" style="border-left:3px solid {color}"><div class="p-label">{label}</div><div class="p-rate">{passed}/{total}</div><div class="p-pct">{rate}%</div></div>'
    return f'''
    <div class="priority-stats">
      {render_card('P0 紧急', p0['pass'], p0['total'], '#cf1322')}
      {render_card('P1 高优', p1['pass'], p1['total'], '#fa8c16')}
      {render_card('P2 一般', p2['pass'], p2['total'], '#faad14')}
    </div>'''


def render_defect_table(defects):
    """缺陷汇总表"""
    if not defects:
        return '<div class="no-defect">✅ 本次测试无缺陷</div>'
    rows = ''
    for i, d in enumerate(defects, 1):
        sev_color = {'P0': '#ff4d4f', 'P1': '#faad14', 'P2': '#1890ff', 'INFO': '#909399'}.get(d.get('severity', 'INFO'), '#909399')
        rows += f'''
        <tr>
          <td>{i}</td>
          <td style="color:{sev_color};font-weight:bold">{d.get('severity', 'INFO')}</td>
          <td>{d.get('title', '')}</td>
          <td>{d.get('actual', '')}</td>
        </tr>'''
    return f'''
    <table class="defect-table">
      <tr><th>#</th><th>严重度</th><th>描述</th><th>实际结果</th></tr>
      {rows}
    </table>'''


# ══════════════════════════════════════════════
# 主流程
# ══════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--result', required=True, help='测试结果JSON路径')
    parser.add_argument('--template', default=str(Path(__file__).parent.parent / 'assets/submodule_template.html'))
    parser.add_argument('--output', required=True, help='输出HTML路径')
    args = parser.parse_args()

    # 1. 读测试结果
    with open(args.result) as f:
        result = json.load(f)

    # 2026-07-17 兼容性修复：支持 module_name 和 module 两种 key
    module_name = result.get('module_name') or result.get('module', 'Unknown Module')
    system_name = result.get('system_name', 'SRMPRO')
    test_time = result.get('test_time', '2026-07-07')
    test_url = result.get('test_url', 'https://test.esicint.com/SupplierManagement/newDocument')
    test_users = result.get('test_users', 'admin / testadmin / aarontest')
    test_person = result.get('test_person', '测测(自动化)')
    stats = result.get('stats', {'total': 0, 'pass': 0, 'fail': 0, 'skip': 0})
    priorities = result.get('priorities', {'p0': {'pass': 0, 'total': 0}, 'p1': {'pass': 0, 'total': 0}, 'p2': {'pass': 0, 'total': 0}})
    cases = result.get('cases', [])
    defects = result.get('defects', [])
    pass_rate = round(stats['pass'] / stats['total'] * 100, 1) if stats['total'] else 0
    rate_color = '#52c41a' if pass_rate >= 80 else '#faad14' if pass_rate >= 50 else '#ff4d4f'

    # 2. 渲染各区块
    cases_html = '\n'.join(render_case_section(c) for c in cases)
    summary_html = render_summary_cards(stats)
    priority_html = render_priority_stats(priorities['p0'], priorities['p1'], priorities['p2'])
    defect_table_html = render_defect_table(defects)

    # 3. 模板替换
    template = Path(args.template).read_text(encoding='utf-8')
    substitutions = {
        'MODULE_NAME': module_name,
        'MODULE_ICON': '🧪',  # 老模板兼容
        'SYSTEM_NAME': system_name,
        'TEST_TIME': test_time,
        'EXEC_TIME': test_time,  # 老模板兼容
        'TEST_URL': test_url,
        'TEST_USERS': test_users,
        'ACCOUNT': test_users,  # 老模板兼容
        'TEST_PERSON': test_person,
        'TESTER': test_person,  # 老模板兼容
        'AGENT_NAME': test_person,  # 老模板兼容
        'PASS_RATE': str(pass_rate),
        'PASS_RATE_COLOR': rate_color,
        'SUMMARY_CARDS': summary_html,
        'PRIORITY_STATS': priority_html,
        'CASE_LIST': cases_html,
        'TEST_CASES_HTML': cases_html,  # 老模板兼容
        'DEFECT_TABLE': defect_table_html,
        'DEFECT_TABLE_HTML': defect_table_html,  # 老模板兼容
        'TOTAL_CASES': str(stats['total']),
        'TOTAL': str(stats['total']),  # 老模板兼容
        'PASSED_CASES': str(stats['pass']),
        'PASS': str(stats['pass']),  # 老模板兼容
        'FAILED_CASES': str(stats['fail']),
        'FAIL': str(stats['fail']),  # 老模板兼容
        'SKIPPED_CASES': str(stats['skip']),
        'SKIP': str(stats['skip']),  # 老模板兼容
        'DEFECT_COUNT': str(len(defects)),
        'CONCLUSION': '通过' if pass_rate >= 80 else '警告' if pass_rate >= 50 else '不通过',  # 老模板兼容
    }
    html_out = template
    for k, v in substitutions.items():
        html_out = html_out.replace('{{' + k + '}}', str(v))

    # 4. 写文件（同时输出到交付层和镜像）
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html_out, encoding='utf-8')

    # 5. 镜像副本
    mirror = output_path.parent.parent.parent / 'report' / 'enhanced' / output_path.name
    if '交付层' in str(output_path) and not mirror.exists():
        try:
            mirror.parent.mkdir(parents=True, exist_ok=True)
            mirror.write_text(html_out, encoding='utf-8')
            print(f"📋 镜像副本: {mirror}")
        except Exception:
            pass

    print(f"\n✅ 子模块报告已生成: {output_path}")
    print(f"   文件大小: {len(html_out):,} chars")
    print(f"   用例: {stats['total']} | 通过: {stats['pass']} | 失败: {stats['fail']} | 跳过: {stats['skip']}")
    print(f"   通过率: {pass_rate}% | 缺陷: {len(defects)}")


if __name__ == '__main__':
    main()
