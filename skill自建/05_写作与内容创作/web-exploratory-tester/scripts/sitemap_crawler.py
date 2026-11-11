#!/usr/bin/env python3
"""
sitemap_crawler.py - 从 HTML / JS bundle 自动抓路由

Usage:
    python3 sitemap_crawler.py <base_url> [--output FILE] [--depth 2]

Example:
    python3 sitemap_crawler.py https://down.mptext.top --output sitemap.md
"""
import argparse
import json
import re
import sys
from urllib.parse import urljoin, urlparse
from collections import deque
import urllib.request
import urllib.error


def fetch(url, timeout=10):
    """带 User-Agent 的 GET 请求。"""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8', errors='replace'), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, '', {}
    except Exception as e:
        print(f"[!] fetch {url}: {e}", file=sys.stderr)
        return 0, '', {}


def extract_html_links(html, base_url):
    """从 HTML 中抓所有内链。"""
    links = set()
    # <a href="...">
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\']', html, re.I):
        href = m.group(1)
        if href.startswith('#') or href.startswith('mailto:') or href.startswith('javascript:'):
            continue
        full = urljoin(base_url, href)
        if urlparse(full).netloc == urlparse(base_url).netloc:
            links.add(full.split('#')[0].split('?')[0])
    # <link rel="canonical" href="...">
    for m in re.finditer(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']', html, re.I):
        full = urljoin(base_url, m.group(1))
        links.add(full)
    return sorted(links)


def extract_js_routes(js_text):
    """从 JS bundle 抓路由模式（Nuxt/Next/React Router 通用）。"""
    routes = set()
    # Nuxt: path: '/foo/bar'
    for m in re.finditer(r'path:\s*["\']([/][^"\']+)["\']', js_text):
        routes.add(m.group(1))
    # Nuxt: '/foo/bar': ComponentName
    for m in re.finditer(r'["\']([/][a-zA-Z0-9_\-]+(?:[/][a-zA-Z0-9_\-:]+){1,3})["\']\s*:\s*[A-Z]', js_text):
        routes.add(m.group(1))
    # Vue Router: { path: '/foo' }
    for m in re.finditer(r'\{\s*path:\s*["\']([/][^"\']+)["\']', js_text):
        routes.add(m.group(1))
    # React Router: <Route path="/foo" />
    for m in re.finditer(r'<Route[^>]*path=["\']([/][^"\']+)["\']', js_text):
        routes.add(m.group(1))
    # Next.js: pathname: '/foo'
    for m in re.finditer(r'pathname:\s*["\']([/][^"\']+)["\']', js_text):
        routes.add(m.group(1))
    # 过滤：必须有字母，至少 2 段（/x/y）
    routes = {r for r in routes if re.match(r'^/[a-zA-Z][a-zA-Z0-9_\-]*(?:/[a-zA-Z0-9_\-:]+)+/?$', r)}
    return sorted(routes)


def extract_api_paths(js_text):
    """从 JS bundle 抓 API 路径。"""
    apis = set()
    # /api/... 模式
    for m in re.finditer(r'["\']([/]api[/][^"\']+)["\']', js_text):
        path = m.group(1)
        # 去掉模板字符串中的 ${} 占位
        path = re.sub(r'\$\{[^}]+\}', '{id}', path)
        if path.count('/') >= 2 and path.count('{') <= 2:
            apis.add(path)
    return sorted(apis)


def find_js_bundles(html, base_url):
    """从 HTML 中找 JS bundle 路径。"""
    bundles = set()
    # <script src="...">
    for m in re.finditer(r'<script[^>]+src=["\']([^"\']+\.js)["\']', html, re.I):
        full = urljoin(base_url, m.group(1))
        bundles.add(full)
    # modulepreload
    for m in re.finditer(r'<link[^>]+rel=["\']modulepreload["\'][^>]+href=["\']([^"\']+\.js)["\']', html, re.I):
        full = urljoin(base_url, m.group(1))
        bundles.add(full)
    return sorted(bundles)


def normalize_paths(urls, base_url):
    """URL 列表 → 路径列表（去重 + 排序）。"""
    seen = set()
    out = []
    for u in urls:
        p = urlparse(u).path
        if p and p not in seen:
            seen.add(p)
            out.append(p)
    return sorted(out, key=lambda x: (x.count('/'), x))


def crawl(base_url, depth=2):
    """BFS 抓路由。"""
    print(f"[*] 开始爬取 {base_url} (depth={depth})", file=sys.stderr)

    visited = set()
    queue = deque([(base_url, 0)])
    all_links = set()
    all_routes = set()
    all_apis = set()
    all_bundles = set()
    status_map = {}

    while queue:
        url, d = queue.popleft()
        if url in visited or d > depth:
            continue
        visited.add(url)
        status, html, headers = fetch(url)
        status_map[url] = status
        print(f"  [{d}] {status} {url}", file=sys.stderr)

        if not html:
            continue

        # 抓 HTML 链接
        for link in extract_html_links(html, url):
            all_links.add(link)
            if d < depth:
                queue.append((link, d + 1))

        # 抓 JS bundle
        for bundle in find_js_bundles(html, url):
            all_bundles.add(bundle)

    # 抓所有 bundle 的路由
    for bundle in all_bundles:
        print(f"  [JS] {bundle}", file=sys.stderr)
        _, js_text, _ = fetch(bundle)
        if js_text:
            all_routes.update(extract_js_routes(js_text))
            all_apis.update(extract_api_paths(js_text))

    return {
        'base_url': base_url,
        'depth': depth,
        'pages_visited': len(visited),
        'status_map': status_map,
        'html_links': normalize_paths(all_links, base_url),
        'js_routes': sorted(all_routes),
        'api_paths': sorted(all_apis),
        'js_bundles': sorted(all_bundles),
    }


def render_markdown(result):
    """渲染成 markdown。"""
    out = []
    out.append(f"# Sitemap 自动发现报告\n")
    out.append(f"**目标:** {result['base_url']}")
    out.append(f"**深度:** {result['depth']}")
    out.append(f"**访问页面数:** {result['pages_visited']}\n")

    out.append(f"## 📊 统计\n")
    out.append(f"- HTML 链接: {len(result['html_links'])}")
    out.append(f"- JS 路由: {len(result['js_routes'])}")
    out.append(f"- API 路径: {len(result['api_paths'])}")
    out.append(f"- JS Bundle: {len(result['js_bundles'])}\n")

    out.append(f"## 🗺 HTML 链接（页面）\n")
    for p in result['html_links']:
        out.append(f"- {p}")
    out.append("")

    if result['js_routes']:
        out.append(f"## 🔀 JS 路由（前端路由）\n")
        for r in result['js_routes']:
            out.append(f"- {r}")
        out.append("")

    if result['api_paths']:
        out.append(f"## 🔌 API 路径\n")
        for a in result['api_paths']:
            out.append(f"- `{a}`")
        out.append("")

    if result['js_bundles']:
        out.append(f"## 📦 JS Bundle\n")
        for b in result['js_bundles']:
            out.append(f"- {b}")
        out.append("")

    return '\n'.join(out)


def main():
    parser = argparse.ArgumentParser(description='自动发现 Web 应用的 sitemap')
    parser.add_argument('url', help='目标 URL')
    parser.add_argument('--depth', type=int, default=2, help='爬取深度 (默认 2)')
    parser.add_argument('--output', '-o', help='输出文件 (默认 stdout)')
    parser.add_argument('--format', choices=['md', 'json'], default='md', help='输出格式')
    args = parser.parse_args()

    result = crawl(args.url, args.depth)

    if args.format == 'json':
        output = json.dumps(result, indent=2, ensure_ascii=False)
    else:
        output = render_markdown(result)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"[✓] 报告已写入 {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == '__main__':
    main()
