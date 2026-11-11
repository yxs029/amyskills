#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
zap_redact.py — ZAP 交付物脱敏（红线工具）
ZAP 自动导出的 html/json/md/xml/sarif 会原样带登录邮箱、JWT/会话 token、口令，
进交付目录前必须脱敏。原始证据应保留在 ~/.ZAP 与 testdata，本工具只处理对外导出件。

用法：
  python3 zap_redact.py --dir <报告目录> \
      [--secret-file 03-被测网站信息.md] [--extra 'literal1,literal2'] \
      [--ext .html,.json,.md,.xml,.txt]
默认正则：邮箱、JWT、常见 bearer/长 token。口令等字面值从 --secret-file 动态提取（不硬编码）。
"""
import argparse, os, re, sys

EMAIL = re.compile(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
JWT   = re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}(?:\.[A-Za-z0-9_\-]{5,})?")
BEARER= re.compile(r"(?i)(bearer|token|authorization)([\"'=\s:]+)([A-Za-z0-9_\-\.]{24,})")
# 从内部信息文件提取“密码：xxx”形态
PWLINE= re.compile(r"(?:密码|password|passwd|pwd)\s*[：:]\s*(\S+)")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--secret-file", default="")
    ap.add_argument("--extra", default="", help="逗号分隔的额外字面值")
    ap.add_argument("--ext", default=".html,.json,.md,.xml,.txt,.sarif")
    a = ap.parse_args()
    exts = tuple(x if x.startswith(".") else "."+x for x in a.ext.split(","))

    literals = set(x.strip() for x in a.extra.split(",") if x.strip())
    if a.secret_file and os.path.exists(a.secret_file):
        for m in PWLINE.findall(open(a.secret_file, encoding="utf-8", errors="ignore").read()):
            literals.add(m.strip())

    changed = 0
    for dp, _, fs in os.walk(a.dir):
        for fn in fs:
            if not fn.endswith(exts):
                continue
            p = os.path.join(dp, fn)
            c = open(p, encoding="utf-8", errors="ignore").read()
            n = c
            for lit in literals:
                if len(lit) >= 4:
                    n = n.replace(lit, "[REDACTED-PASSWORD]")
            n = BEARER.sub(lambda m: m.group(1)+m.group(2)+"[REDACTED-TOKEN]", n)
            n = JWT.sub("[REDACTED-JWT]", n)
            n = EMAIL.sub("[REDACTED-EMAIL]", n)
            if n != c:
                open(p, "w", encoding="utf-8").write(n)
                changed += 1
                print("  redacted:", os.path.relpath(p, a.dir))

    # 校验 JSON/XML 脱敏后仍合法
    import json, xml.etree.ElementTree as ET
    bad = []
    for dp, _, fs in os.walk(a.dir):
        for fn in fs:
            p = os.path.join(dp, fn)
            try:
                if fn.endswith(".json") or fn.endswith(".sarif"):
                    json.load(open(p, encoding="utf-8"))
                elif fn.endswith(".xml"):
                    ET.parse(p)
            except Exception as e:
                bad.append(f"{fn}: {e}")
    print(f"[zap_redact] 处理 {changed} 个文件；格式校验 {'全部合法' if not bad else '异常'}")
    for b in bad:
        print("  BAD", b)
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
