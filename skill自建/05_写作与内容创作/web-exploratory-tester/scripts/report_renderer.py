#!/usr/bin/env python3
"""
report_renderer.py - 把结构化 issues 渲染成最终 dogfood 报告

支持 3 种模式：
1. 默认 (单文件)        python3 report_renderer.py issues.json report.md
2. 分卷 (--parted 5M)   python3 report_renderer.py issues.json out/ --parted
3. Obsidian (--obsidian) python3 report_renderer.py issues.json vault/path/ --obsidian
"""
import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime


SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low']
SEVERITY_EMOJI = {'Critical': '🔴', 'High': '🟠', 'Medium': '🟡', 'Low': '🔵'}

# 报告分卷阈值（5MB）
PART_SIZE_LIMIT = 5 * 1024 * 1024  # bytes


def sanitize_filename(s: str) -> str:
    """清理文件名（去掉特殊字符）"""
    s = re.sub(r'[^\w\-一-龥]', '_', s)
    s = re.sub(r'_+', '_', s)
    return s[:80].strip('_') or 'untitled'


def sort_issues(issues):
    """按严重性 + URL + ID 排序"""
    return sorted(
        issues,
        key=lambda x: (SEVERITY_ORDER.index(x.get('severity', 'Low')),
                       x.get('url', ''),
                       x.get('id', 0))
    )


# ============================================================
# 模式 1: 单文件
# ============================================================
def render_issue(issue):
    """渲染单个 issue。图多于文：每个 issue 至少 1 张截图。"""
    sev_emoji = SEVERITY_EMOJI.get(issue['severity'], '⚪')
    out = []
    out.append(f"### Issue #{issue['id']}: {issue['title']}\n")
    out.append(f"| Field | Value |")
    out.append(f"|-------|-------|")
    out.append(f"| **Severity** | {sev_emoji} {issue['severity']} |")
    out.append(f"| **Category** | {issue['category']} |")
    out.append(f"| **URL** | `{issue.get('url', 'N/A')}` |")
    out.append("")
    out.append(f"**Description:**")
    out.append(f"{issue.get('description', '')}\n")
    out.append(f"**Steps to Reproduce:**")
    for i, step in enumerate(issue.get('steps_to_reproduce', []), 1):
        out.append(f"{i}. {step}")
    out.append("")
    out.append(f"**Expected Behavior:**")
    out.append(f"{issue.get('expected', '')}\n")
    out.append(f"**Actual Behavior:**")
    out.append(f"{issue.get('actual', '')}\n")

    screenshot = issue.get('screenshot')
    if screenshot:
        out.append(f"**📸 缺陷截图（全貌）：**")
        out.append(f"![Issue {issue['id']} screenshot]({screenshot})")
        out.append(f"MEDIA:{screenshot}\n")
    else:
        out.append(f"> ⚠️ **警告：此 Issue 缺少截图证据**\n")

    annotated = issue.get('screenshot_annotated')
    if annotated:
        out.append(f"**📸 元素位置标注：**")
        out.append(f"![Issue {issue['id']} annotated]({annotated})")
        out.append(f"MEDIA:{annotated}\n")

    compare = issue.get('screenshot_compare')
    if compare:
        out.append(f"**📸 对比图：**")
        out.append(f"![Issue {issue['id']} compare]({compare})")
        out.append(f"MEDIA:{compare}\n")

    if issue.get('console_errors'):
        out.append(f"**Console Errors:**")
        out.append(f"```")
        out.append(f"{issue['console_errors']}")
        out.append(f"```")
    return '\n'.join(out)


def render_report(data):
    """单文件模式"""
    issues = sort_issues(data.get('issues', []))
    for i, iss in enumerate(issues, 1):
        iss['_render_id'] = i

    severity_count = Counter(i.get('severity', 'Low') for i in issues)
    category_count = Counter(i.get('category', 'Other') for i in issues)

    out = []
    out.append(f"# Dogfood QA Report\n")
    out.append(f"**Target:** {data.get('target_url', 'N/A')}")
    out.append(f"**Date:** {data.get('date', datetime.now().strftime('%Y-%m-%d'))}")
    out.append(f"**Scope:** {data.get('scope', 'full site')}")
    out.append(f"**Duration:** {data.get('duration_minutes', 15)} minutes")
    out.append(f"**Tester:** Hermes Agent (Web Exploratory Tester skill)\n")
    out.append(f"---\n")

    out.append(f"## Executive Summary\n")
    out.append(f"| Severity | Count |")
    out.append(f"|----------|-------|")
    for sev in SEVERITY_ORDER:
        out.append(f"| {SEVERITY_EMOJI[sev]} {sev} | {severity_count.get(sev, 0)} |")
    out.append(f"| **Total** | **{len(issues)}** |\n")

    if category_count:
        out.append(f"### Issues by Category\n")
        out.append(f"| Category | Count |")
        out.append(f"|---|---|")
        for cat, cnt in sorted(category_count.items(), key=lambda x: -x[1]):
            out.append(f"| {cat} | {cnt} |")
        out.append("")

    out.append(f"**Overall Assessment:** {data.get('overall_assessment', 'TBD')}\n")
    out.append(f"---\n")

    out.append(f"## Issues\n")
    for iss in issues:
        original_id = iss.get('id')
        iss['id'] = iss['_render_id']
        out.append(render_issue(iss))
        out.append(f"\n---\n")
        iss['id'] = original_id

    out.append(f"\n## Issues Summary Table\n")
    out.append(f"| # | Title | Severity | Category | URL |")
    out.append(f"|---|-------|----------|----------|-----|")
    for iss in issues:
        out.append(f"| {iss['_render_id']} | {iss['title']} | {SEVERITY_EMOJI[iss.get('severity', 'Low')]} {iss.get('severity', 'Low')} | {iss.get('category', 'Other')} | `{iss.get('url', 'N/A')}` |")
    out.append("")

    cov = data.get('coverage', {})
    if cov:
        out.append(f"\n---\n## Testing Coverage\n")
        if cov.get('pages_tested'):
            out.append(f"### Pages Tested")
            for p in cov['pages_tested']: out.append(f"- {p}")
            out.append("")
        if cov.get('features_tested'):
            out.append(f"### Features Tested")
            for f in cov['features_tested']: out.append(f"- {f}")
            out.append("")
        if cov.get('not_tested'):
            out.append(f"### Not Tested / Out of Scope")
            for n in cov['not_tested']: out.append(f"- {n}")
            out.append("")
        if cov.get('blockers'):
            out.append(f"### Blockers")
            for b in cov['blockers']: out.append(f"- {b}")
            out.append("")

    if data.get('notes'):
        out.append(f"\n---\n## Notes\n")
        out.append(data['notes'])
        out.append("")

    out.append(f"\n---\n*Generated by: web-exploratory-tester skill v1.0.0*")
    return '\n'.join(out)


# ============================================================
# 模式 2: 分卷 (5M/part)
# ============================================================
def render_report_parts(data, max_part_size=PART_SIZE_LIMIT):
    """分卷模式"""
    issues = sort_issues(data.get('issues', []))
    for i, iss in enumerate(issues, 1):
        iss['_render_id'] = i

    severity_count = Counter(i.get('severity', 'Low') for i in issues)
    category_count = Counter(i.get('category', 'Other') for i in issues)

    rendered_issues = []
    for iss in issues:
        original_id = iss.get('id')
        iss['id'] = iss['_render_id']
        content = render_issue(iss) + "\n\n---\n\n"
        rendered_issues.append((iss['_render_id'], iss, content, len(content.encode('utf-8'))))
        iss['id'] = original_id

    # 分卷
    parts = []
    current_part = []
    current_size = 0
    for rid, iss, content, size in rendered_issues:
        if current_size + size > max_part_size and current_part:
            parts.append(current_part)
            current_part = [(rid, iss, content, size)]
            current_size = size
        else:
            current_part.append((rid, iss, content, size))
            current_size += size
    if current_part:
        parts.append(current_part)

    total_parts = len(parts)
    output_parts = []
    for idx, part in enumerate(parts, 1):
        issue_ids = [rid for rid, _, _, _ in part]
        header = (
            f"# Dogfood QA Report — Part {idx}/{total_parts}\n"
            f"**Target:** {data.get('target_url', 'N/A')}\n"
            f"**Date:** {data.get('date', datetime.now().strftime('%Y-%m-%d'))}\n"
            f"**Scope:** {data.get('scope', 'full site')}\n"
            f"**This part:** {len(issue_ids)} issues (#{min(issue_ids)}-#{max(issue_ids)})\n"
            f"---\n"
        )
        body = ''.join(content for _, _, content, _ in part)
        # 总结表
        summary = ["\n## 📋 Part Summary\n", "| # | Title | Severity | URL |", "|---|-------|----------|-----|"]
        for rid, iss, _, _ in part:
            summary.append(f"| {rid} | {iss['title']} | {SEVERITY_EMOJI.get(iss.get('severity', 'Low'), '⚪')} {iss.get('severity', 'Low')} | `{iss.get('url', 'N/A')}` |")
        summary.append("")
        summary.append(f"*Part {idx}/{total_parts}*")
        output_parts.append((f"report-part{idx}.md", header + "\n" + body + '\n'.join(summary), issue_ids))

    # 第一个 part 加执行摘要
    if output_parts:
        first_filename, first_content, first_ids = output_parts[0]
        summary_block = [
            f"## Executive Summary\n",
            f"| Severity | Count |",
            f"|----------|-------|",
        ]
        for sev in SEVERITY_ORDER:
            summary_block.append(f"| {SEVERITY_EMOJI[sev]} {sev} | {severity_count.get(sev, 0)} |")
        summary_block.append(f"| **Total** | **{len(issues)}** |\n")
        if category_count:
            summary_block.append(f"### Issues by Category\n")
            summary_block.append(f"| Category | Count |")
            summary_block.append(f"|---|---|")
            for cat, cnt in sorted(category_count.items(), key=lambda x: -x[1]):
                summary_block.append(f"| {cat} | {cnt} |")
            summary_block.append("")
        summary_block.append(f"**Overall Assessment:** {data.get('overall_assessment', 'TBD')}\n")
        summary_block.append(f"---\n")

        first_split = first_content.split("---\n", 1)
        if len(first_split) == 2:
            new_first = first_split[0] + "---\n\n" + '\n'.join(summary_block) + first_split[1]
            output_parts[0] = (first_filename, new_first, first_ids)

    # 最后一个 part 加 coverage + notes
    if output_parts:
        last_filename, last_content, last_ids = output_parts[-1]
        cov = data.get('coverage', {})
        appendix = []
        if cov:
            appendix.append(f"\n---\n## Testing Coverage\n")
            if cov.get('pages_tested'):
                appendix.append(f"### Pages Tested")
                for p in cov['pages_tested']: appendix.append(f"- {p}")
                appendix.append("")
            if cov.get('features_tested'):
                appendix.append(f"### Features Tested")
                for f in cov['features_tested']: appendix.append(f"- {f}")
                appendix.append("")
            if cov.get('not_tested'):
                appendix.append(f"### Not Tested / Out of Scope")
                for n in cov['not_tested']: appendix.append(f"- {n}")
                appendix.append("")
            if cov.get('blockers'):
                appendix.append(f"### Blockers")
                for b in cov['blockers']: appendix.append(f"- {b}")
                appendix.append("")
        if data.get('notes'):
            appendix.append(f"\n---\n## Notes\n")
            appendix.append(data['notes'])
            appendix.append("")
        new_last = last_content + '\n'.join(appendix)
        output_parts[-1] = (last_filename, new_last, last_ids)

    return output_parts


# ============================================================
# 模式 3: Obsidian 双链
# ============================================================
def render_obsidian_reports(data, output_dir, screenshots_source_dir=None):
    """Obsidian 双链模式"""
    import shutil

    os.makedirs(output_dir, exist_ok=True)
    issues = sort_issues(data.get('issues', []))
    for i, iss in enumerate(issues, 1):
        iss['_render_id'] = i

    severity_count = Counter(i.get('severity', 'Low') for i in issues)
    category_count = Counter(i.get('category', 'Other') for i in issues)

    # 复制 screenshots
    vault_screenshots = os.path.join(output_dir, 'screenshots')
    os.makedirs(vault_screenshots, exist_ok=True)
    if screenshots_source_dir and os.path.isdir(screenshots_source_dir):
        for f in os.listdir(screenshots_source_dir):
            src = os.path.join(screenshots_source_dir, f)
            dst = os.path.join(vault_screenshots, f)
            if os.path.isfile(src):
                shutil.copy2(src, dst)

    # === Executive-Summary.md ===
    summary = []
    summary.append(f"# 📊 Executive Summary - {data.get('target_url', 'N/A')}\n")
    summary.append(f"**日期:** {data.get('date', 'N/A')}")
    summary.append(f"**范围:** {data.get('scope', 'full')}")
    summary.append(f"**耗时:** {data.get('duration_minutes', 15)} 分钟")
    summary.append(f"**测试者:** Hermes Agent\n---\n")

    summary.append(f"## 🎯 严重性分布\n")
    summary.append(f"| Severity | Count |")
    summary.append(f"|----------|-------|")
    for sev in SEVERITY_ORDER:
        summary.append(f"| {SEVERITY_EMOJI[sev]} {sev} | {severity_count.get(sev, 0)} |")
    summary.append(f"| **Total** | **{len(issues)}** |\n")

    if category_count:
        summary.append(f"## 📂 按分类\n")
        summary.append(f"| Category | Count |")
        summary.append(f"|---|---|")
        for cat, cnt in sorted(category_count.items(), key=lambda x: -x[1]):
            summary.append(f"| {cat} | {cnt} |")
        summary.append("")

    summary.append(f"## 💡 总体评估\n{data.get('overall_assessment', 'TBD')}\n---\n")

    summary.append(f"## 📑 Issue 清单\n")
    for iss in issues:
        rid = iss['_render_id']
        sev = SEVERITY_EMOJI.get(iss.get('severity', 'Low'), '⚪')
        slug = sanitize_filename(iss['title'])
        summary.append(f"- {sev} [[Issue-{rid:02d}-{slug}|Issue #{rid} {iss['title']}]]")
    summary.append("")
    with open(os.path.join(output_dir, 'Executive-Summary.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(summary))

    # === 每个 issue 一个 .md ===
    issue_files = []
    for iss in issues:
        rid = iss['_render_id']
        slug = sanitize_filename(iss['title'])
        filename = f"Issue-{rid:02d}-{slug}.md"

        c = []
        c.append(f"# Issue #{rid}: {iss['title']}\n")
        c.append(f"| Field | Value |")
        c.append(f"|-------|-------|")
        c.append(f"| **Severity** | {SEVERITY_EMOJI.get(iss.get('severity', 'Low'), '⚪')} {iss.get('severity', 'Low')} |")
        c.append(f"| **Category** | {iss.get('category', 'Other')} |")
        c.append(f"| **URL** | `{iss.get('url', 'N/A')}` |")
        c.append("")

        c.append(f"## 📝 描述\n{iss.get('description', '')}\n")
        c.append(f"## 🔄 复现步骤")
        for i, step in enumerate(iss.get('steps_to_reproduce', []), 1):
            c.append(f"{i}. {step}")
        c.append("")
        c.append(f"## ✅ 期望\n{iss.get('expected', '')}\n")
        c.append(f"## ❌ 实际\n{iss.get('actual', '')}\n")

        # 截图（Obsidian 双链）
        screenshot = iss.get('screenshot')
        if screenshot:
            img_name = os.path.basename(screenshot)
            c.append(f"## 📸 缺陷截图\n![[{img_name}]]\n")
        annotated = iss.get('screenshot_annotated')
        if annotated:
            img_name = os.path.basename(annotated)
            c.append(f"## 📸 元素位置标注\n![[{img_name}]]\n")
        compare = iss.get('screenshot_compare')
        if compare:
            img_name = os.path.basename(compare)
            c.append(f"## 📸 对比图\n![[{img_name}]]\n")

        dom = iss.get('dom_snapshot')
        if dom:
            c.append(f"## 🔍 DOM 证据\n```\n{dom[:2000]}\n```\n")
        console_err = iss.get('console_errors')
        if console_err:
            c.append(f"## 🐛 Console 错误\n```\n{console_err}\n```\n")

        c.append("\n---\n")
        if rid > 1:
            prev_slug = sanitize_filename(issues[rid-2]['title'])
            c.append(f"← 上一条: [[Issue-{rid-1:02d}-{prev_slug}]]")
        if rid < len(issues):
            next_slug = sanitize_filename(issues[rid]['title'])
            c.append(f"  | 下一条: → [[Issue-{rid+1:02d}-{next_slug}]]")
        c.append("")
        c.append(f"[[Executive-Summary|← 返回摘要]]")

        with open(os.path.join(output_dir, filename), 'w', encoding='utf-8') as f:
            f.write('\n'.join(c))
        issue_files.append(filename)

    # === INDEX.md ===
    idx = []
    idx.append(f"# 📚 测试报告索引 - {data.get('target_url', 'N/A')}\n")
    idx.append(f"**日期:** {data.get('date', 'N/A')}  |  **范围:** {data.get('scope', 'full')}\n---\n")
    idx.append(f"## 🎯 入口\n- [[Executive-Summary]] - 执行摘要\n- 本次测试共 **{len(issues)}** 个 issue\n")

    idx.append(f"## 📋 Issue 详细列表\n")
    for iss in issues:
        rid = iss['_render_id']
        sev = SEVERITY_EMOJI.get(iss.get('severity', 'Low'), '⚪')
        slug = sanitize_filename(iss['title'])
        cat = iss.get('category', 'Other')
        url = iss.get('url', 'N/A')
        idx.append(f"- {sev} [[Issue-{rid:02d}-{slug}|#{rid} {iss['title']}]] - {cat} - `{url}`")
    idx.append("")

    cov = data.get('coverage', {})
    if cov:
        idx.append(f"## 📊 测试覆盖\n")
        if cov.get('pages_tested'):
            idx.append(f"### 已测页面")
            for p in cov['pages_tested']: idx.append(f"- {p}")
            idx.append("")
        if cov.get('features_tested'):
            idx.append(f"### 已测功能")
            for f in cov['features_tested']: idx.append(f"- {f}")
            idx.append("")
        if cov.get('not_tested'):
            idx.append(f"### 未测/Out of Scope")
            for n in cov['not_tested']: idx.append(f"- {n}")
            idx.append("")
        if cov.get('blockers'):
            idx.append(f"### 阻塞")
            for b in cov['blockers']: idx.append(f"- {b}")
            idx.append("")

    if data.get('notes'):
        idx.append(f"## 📝 备注\n{data['notes']}\n")

    idx.append(f"\n---\n*Generated by: web-exploratory-tester skill v1.0.0 (Obsidian mode)*")
    with open(os.path.join(output_dir, 'INDEX.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(idx))

    return {
        'output_dir': output_dir,
        'index_file': 'INDEX.md',
        'summary_file': 'Executive-Summary.md',
        'issue_files': issue_files,
        'total_files': 2 + len(issue_files),
        'screenshots_copied': len(os.listdir(vault_screenshots)) if os.path.isdir(vault_screenshots) else 0,
    }


# ============================================================
# Main 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='渲染 dogfood 报告（支持 3 种模式）')
    parser.add_argument('input', help='输入 JSON 文件')
    parser.add_argument('output', help='输出路径（单文件 / 分卷目录 / Obsidian 目录）')
    parser.add_argument('--parted', action='store_true', help='分卷模式（每 5M 一个文件 + INDEX.md）')
    parser.add_argument('--obsidian', action='store_true', help='Obsidian 双链模式（生成 vault 目录结构）')
    parser.add_argument('--max-size', type=int, default=PART_SIZE_LIMIT, help='每 part 字节上限（默认 5M）')
    parser.add_argument('--screenshots-src', help='截图源目录（Obsidian 模式复制图片用）')
    args = parser.parse_args()

    with open(args.input, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if args.obsidian:
        # Obsidian 模式
        result = render_obsidian_reports(data, args.output, args.screenshots_src)
        print(f"[✓] Obsidian 报告已生成到: {result['output_dir']}")
        print(f"    INDEX: {result['index_file']}")
        print(f"    Summary: {result['summary_file']}")
        print(f"    Issue 文件: {len(result['issue_files'])} 个")
        print(f"    截图复制: {result['screenshots_copied']} 张")
    elif args.parted:
        # 分卷模式
        out_dir = args.output
        os.makedirs(out_dir, exist_ok=True)
        parts = render_report_parts(data, args.max_size)
        for filename, content, issue_ids in parts:
            fp = os.path.join(out_dir, filename)
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"[✓] {fp} — {len(issue_ids)} issues, {len(content.encode('utf-8'))/1024:.1f} KB")
        print(f"\n📊 共 {len(parts)} 个分卷")
    else:
        # 单文件模式
        report = render_report(data)
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        sev = Counter(i.get('severity', 'Low') for i in data.get('issues', []))
        print(f"[✓] 报告已渲染: {args.output}")
        print(f"    包含 {len(data.get('issues', []))} 个 issue, 严重性: {dict(sev)}")


if __name__ == '__main__':
    main()
