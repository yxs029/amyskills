#!/usr/bin/env python3
"""
api_probe.py - 后端 API 批量探测

Usage:
    python3 api_probe.py <base_url> <endpoint> [options]
    python3 api_probe.py <base_url> --inventory endpoints.txt

Example:
    python3 api_probe.py https://down.mptext.top /api/public/v1/account
    python3 api_probe.py https://down.mptext.top /api/public/v1/account --probes all
"""
import argparse
import json
import sys
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, List, Tuple


# 标准探测用例
PROBES = {
    'baseline': ('GET，不带任何参数', {}),
    'with_xss': ('GET，XSS 试探', {'params': {'keyword': '<script>alert(1)</script>'}}),
    'with_sqli': ('GET，SQL 注入试探', {'params': {'keyword': "' OR 1=1 --"}}),
    'with_path_traversal': ('GET，路径穿越', {'path_suffix': '/../v1/account'}),
    'with_bad_method': ('PUT，错误方法', {'method': 'PUT', 'body': '{}', 'headers': {'Content-Type': 'application/json'}}),
    'with_empty_body': ('POST，非法 JSON', {'method': 'POST', 'body': '{invalid', 'headers': {'Content-Type': 'application/json'}}),
    'with_origin': ('GET，带 Origin 头（CORS 测试）', {'headers': {'Origin': 'https://evil.com'}}),
}


def probe(url, method='GET', params=None, headers=None, body=None, timeout=10):
    """执行一次 HTTP 探测。"""
    headers = headers or {}
    headers.setdefault('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')

    if params:
        query = urllib.parse.urlencode(params)
        url = f"{url}?{query}"

    req = urllib.request.Request(url, method=method, headers=headers)
    data = body.encode('utf-8') if body else None

    try:
        with urllib.request.urlopen(req, data=data, timeout=timeout) as r:
            content = r.read(2000).decode('utf-8', errors='replace')
            return {
                'success': True,
                'status': r.status,
                'headers': dict(r.headers),
                'content': content,
                'final_url': r.url,
            }
    except urllib.error.HTTPError as e:
        content = e.read(2000).decode('utf-8', errors='replace') if e.fp else ''
        return {
            'success': False,
            'status': e.code,
            'headers': dict(e.headers) if e.headers else {},
            'content': content,
            'error': str(e),
        }
    except Exception as e:
        return {
            'success': False,
            'status': 0,
            'error': f'{type(e).__name__}: {e}',
        }


def probe_endpoint(base_url, endpoint, probes_to_run=None):
    """对单个 endpoint 跑所有探测。"""
    if probes_to_run is None:
        probes_to_run = list(PROBES.keys())

    url = base_url.rstrip('/') + endpoint
    results = []

    for name in probes_to_run:
        desc, opts = PROBES[name]
        method = opts.get('method', 'GET')
        params = opts.get('params', {})
        headers = opts.get('headers', {})
        body = opts.get('body')

        path_suffix = opts.get('path_suffix', '')
        target_url = url + path_suffix

        result = probe(target_url, method=method, params=params, headers=headers, body=body)
        result['probe'] = name
        result['description'] = desc
        result['url'] = target_url
        result['method'] = method
        results.append(result)

    return results


def analyze_results(results):
    """分析一组探测结果，识别常见问题。"""
    issues = []

    # 1. 错误消息一致性
    errors = [r for r in results if r.get('status') and 400 <= r.get('status', 0) < 500]
    if len(errors) >= 2:
        bodies = [r.get('content', '') for r in errors]
        if len(set(bodies)) == 1:
            issues.append({
                'severity': 'Medium',
                'title': '所有错误响应内容完全相同',
                'detail': '无法通过响应区分 401/403/404，可能存在信息泄露或调试困难',
                'evidence': errors[0].get('content', '')[:300],
            })

    # 2. CORS 配置
    cors_results = [r for r in results if 'with_origin' in r.get('probe', '')]
    for r in cors_results:
        acao = r.get('headers', {}).get('Access-Control-Allow-Origin', '')
        if acao == '*':
            issues.append({
                'severity': 'High',
                'title': 'CORS 允许所有来源（Access-Control-Allow-Origin: *）',
                'detail': '如该 endpoint 同时接受鉴权，攻击者可从恶意网站调用',
            })

    # 3. SQL/XSS 反射
    for r in results:
        if r.get('probe') == 'with_xss':
            if '<script>alert(1)</script>' in r.get('content', ''):
                issues.append({
                    'severity': 'Critical',
                    'title': 'XSS 反射漏洞（输入未做 HTML 编码）',
                    'detail': f"在 {r['url']} 中输入的 XSS payload 被原样反射",
                    'evidence': r.get('content', '')[:300],
                })

    # 4. 路径穿越成功
    for r in results:
        if r.get('probe') == 'with_path_traversal' and r.get('status') == 200:
            issues.append({
                'severity': 'High',
                'title': '路径穿越可能成功',
                'detail': f"路径 {r['url']} 返回 200，应为 400 或 404",
            })

    # 5. 5xx 错误
    server_errors = [r for r in results if r.get('status', 0) >= 500]
    for r in server_errors:
        issues.append({
            'severity': 'High',
            'title': f"服务端错误 {r['status']}",
            'detail': f"{r['method']} {r['url']} 触发 5xx",
            'evidence': r.get('content', '')[:300] or r.get('error', ''),
        })

    return issues


def render_report(base_url, endpoint, results, issues):
    """渲染单个 endpoint 的探测报告。"""
    out = []
    out.append(f"## API: `{endpoint}`\n")
    out.append(f"**Base URL:** {base_url}\n")
    out.append("| 探测 | 方法 | URL | 状态 | 内容预览 |")
    out.append("|---|---|---|---|---|")
    for r in results:
        preview = (r.get('content', '') or r.get('error', ''))[:100].replace('\n', ' ').replace('|', '\\|')
        out.append(f"| {r['description']} | {r['method']} | `{r['url']}` | {r['status']} | `{preview}` |")
    out.append("")

    if issues:
        out.append(f"### 🚨 发现 {len(issues)} 个问题\n")
        for i, iss in enumerate(issues, 1):
            out.append(f"**{i}. [{iss['severity']}] {iss['title']}**")
            out.append(f"   {iss['detail']}")
            if iss.get('evidence'):
                out.append(f"   ```\n   {iss['evidence']}\n   ```")
            out.append("")
    else:
        out.append("✅ 未发现明显问题\n")

    return '\n'.join(out)


def main():
    parser = argparse.ArgumentParser(description='后端 API 探测工具')
    parser.add_argument('base_url', help='目标基础 URL (如 https://example.com)')
    parser.add_argument('endpoint', nargs='?', help='单个 API endpoint (如 /api/v1/users)')
    parser.add_argument('--inventory', help='从文件读取 endpoint 列表（每行一个）')
    parser.add_argument('--probes', default='all', help='逗号分隔的探测名 (默认 all)')
    parser.add_argument('--output', '-o', help='输出文件 (默认 stdout)')
    parser.add_argument('--format', choices=['md', 'json'], default='md')
    args = parser.parse_args()

    if args.inventory:
        with open(args.inventory) as f:
            endpoints = [l.strip() for l in f if l.strip() and not l.startswith('#')]
    elif args.endpoint:
        endpoints = [args.endpoint]
    else:
        parser.error('必须提供 endpoint 或 --inventory')

    probes_to_run = list(PROBES.keys()) if args.probes == 'all' else args.probes.split(',')

    all_reports = []
    all_issues = []

    for ep in endpoints:
        print(f"[*] 探测 {ep}...", file=sys.stderr)
        results = probe_endpoint(args.base_url, ep, probes_to_run)
        issues = analyze_results(results)
        all_issues.extend([(ep, i) for i in issues])
        all_reports.append({
            'endpoint': ep,
            'results': results,
            'issues': issues,
        })

    # 渲染输出
    if args.format == 'json':
        output = json.dumps(all_reports, indent=2, ensure_ascii=False, default=str)
    else:
        out = [f"# API 探测报告\n", f"**目标:** {args.base_url}\n"]
        for rep in all_reports:
            out.append(render_report(args.base_url, rep['endpoint'], rep['results'], rep['issues']))
        # 总览
        out.append("\n---\n## 📊 总览\n")
        if all_issues:
            out.append(f"共发现 {len(all_issues)} 个问题:\n")
            for ep, iss in all_issues:
                out.append(f"- `{ep}` - [{iss['severity']}] {iss['title']}")
        else:
            out.append("✅ 所有 endpoint 未发现明显问题")
        output = '\n'.join(out)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"[✓] 报告已写入 {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == '__main__':
    main()
