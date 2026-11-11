#!/usr/bin/env python3
"""
dead_link_checker.py - 404 行为探测（SPA fallback 副作用专项）

Usage:
    python3 dead_link_checker.py <base_url> [path ...]
    echo "/foo /bar" | python3 dead_link_checker.py <base_url> --stdin

Example:
    python3 dead_link_checker.py https://down.mptext.top /dashboard/admin /dashboard/nonexistent /api/v1/xxx
"""
import argparse
import sys
import urllib.request
import urllib.error
from collections import defaultdict


COMMON_PATHS = [
    # 前端路由
    '/admin', '/login', '/signup', '/register', '/dashboard',
    '/dashboard/admin', '/dashboard/settings', '/dashboard/account',
    '/api', '/api/v1', '/api/v2',
    # 后端
    '/api/v1/users', '/api/v1/admin', '/api/internal',
    '/.env', '/.git/HEAD', '/robots.txt', '/sitemap.xml',
    # 错误页
    '/404', '/error', '/not-found',
    # 备份文件
    '/backup.sql', '/database.sql', '/dump.sql',
    '/app.zip', '/source.zip', '/backup.tar.gz',
]


def check(url, timeout=5):
    """检查单个 URL。"""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    })
    req.method = 'HEAD'
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return {
                'url': url,
                'status': r.status,
                'content_type': r.headers.get('Content-Type', ''),
                'content_length': r.headers.get('Content-Length', ''),
            }
    except urllib.error.HTTPError as e:
        return {
            'url': url,
            'status': e.code,
            'content_type': e.headers.get('Content-Type', '') if e.headers else '',
            'content_length': e.headers.get('Content-Length', '') if e.headers else '',
        }
    except Exception as e:
        return {
            'url': url,
            'status': 0,
            'error': f'{type(e).__name__}: {e}',
        }


def analyze(results):
    """分析结果，识别 SPA fallback 等问题。"""
    issues = []

    # 1. 200 但不是预期类型（HTML 落到不存在的路径）
    for r in results:
        if r['status'] == 200 and 'text/html' in r.get('content_type', ''):
            # 检查 content_length: 真实 404 也可能返回 HTML
            cl = r.get('content_length', '')
            # SPA fallback 通常返回完整 index.html (大体积)
            try:
                if cl and int(cl) > 10000:  # 完整 SPA bundle 通常 20KB+
                    issues.append({
                        'severity': 'High',
                        'title': f"SPA Fallback 副作用: {r['url']} 返回 200 HTML",
                        'detail': f"Content-Length={cl}, 很可能是 Nuxt/Next fallback 到 index.html\n"
                                  f"**影响:** SEO 抓取会索引垃圾 URL；死链检测失效",
                    })
            except ValueError:
                pass

    # 2. 备份文件/敏感路径
    sensitive_patterns = ['.env', '.git', 'backup', 'dump', '.sql', '.zip', '.tar']
    for r in results:
        path = r['url']
        if any(p in path for p in sensitive_patterns) and r['status'] == 200:
            issues.append({
                'severity': 'Critical',
                'title': f"敏感文件暴露: {path}",
                'detail': f"状态 {r['status']}, 可能泄露源码/数据/环境变量",
            })

    # 3. 内部 API 端点
    internal_patterns = ['/admin', '/api/internal', '/_debug', '/graphql']
    for r in results:
        path = r['url']
        if any(p in path for p in internal_patterns) and r['status'] == 200:
            issues.append({
                'severity': 'Medium',
                'title': f"内部端点可访问: {path}",
                'detail': f"未鉴权状态返回 200，应至少鉴权后访问",
            })

    return issues


def main():
    parser = argparse.ArgumentParser(description='404 / 死链 / 敏感路径探测')
    parser.add_argument('base_url', help='目标基础 URL')
    parser.add_argument('paths', nargs='*', help='要探测的路径（可多个）')
    parser.add_argument('--stdin', action='store_true', help='从 stdin 读路径列表')
    parser.add_argument('--common', action='store_true', help='探测常见敏感路径')
    parser.add_argument('--output', '-o', help='输出文件')
    args = parser.parse_args()

    base = args.base_url.rstrip('/')
    paths = list(args.paths)

    if args.stdin:
        for line in sys.stdin:
            line = line.strip()
            if line and not line.startswith('#'):
                paths.append(line)

    if args.common:
        paths.extend(COMMON_PATHS)

    if not paths:
        parser.error('必须提供 paths / --stdin / --common')

    # 去重
    paths = sorted(set(paths))

    print(f"[*] 探测 {len(paths)} 个路径...", file=sys.stderr)
    results = [check(base + p) for p in paths]
    issues = analyze(results)

    # 渲染输出
    out = [f"# 死链 / 404 行为探测报告\n", f"**目标:** {base}\n"]
    out.append("| 路径 | 状态 | Content-Type | Content-Length | 错误 |")
    out.append("|---|---|---|---|---|")
    for r in results:
        out.append(f"| `{r['url'].replace(base, '')}` | {r['status']} | {r.get('content_type', '')[:40]} | {r.get('content_length', '')} | {r.get('error', '')[:30]} |")
    out.append("")

    if issues:
        out.append(f"## 🚨 发现 {len(issues)} 个问题\n")
        for i, iss in enumerate(issues, 1):
            out.append(f"**{i}. [{iss['severity']}] {iss['title']}**")
            out.append(f"   {iss['detail']}\n")
    else:
        out.append("✅ 未发现明显问题\n")

    output = '\n'.join(out)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"[✓] 报告已写入 {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == '__main__':
    main()
