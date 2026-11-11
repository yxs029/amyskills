#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
zap_delivery_qc.py — ZAP 安全报告交付前 QC（通用版）
检查：文件存在非空、PDF 页数/占位符/关键词、HTML 闭合与标签配平、JSON/XML 合法、
      脱敏（邮箱/JWT/口令）、可选关键数字一致性。结果打印并落盘 Markdown。

用法：
  python3 zap_delivery_qc.py --root <项目交付根> --out <QC报告.md> \
      [--pdf 相对路径] [--html 相对路径] \
      [--secret-file 内部信息.md] \
      [--scan-dirs 相对目录1,相对目录2] \
      [--must-contain 报告相对路径:关键词,关键词] \
      [--expect-number 9645]
退出码：0 全过；1 有 FAIL。
"""
import argparse, os, re, json, subprocess, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--pdf", default="")
    ap.add_argument("--html", default="")
    ap.add_argument("--secret-file", default="")
    ap.add_argument("--scan-dirs", default=".")
    ap.add_argument("--must-contain", default="", help="relpath:kw1,kw2;relpath2:kw")
    ap.add_argument("--expect-number", default="")
    a = ap.parse_args()
    R = []
    def chk(ok, item, detail=""):
        R.append(("PASS" if ok else "FAIL", item, detail))

    def P(*x): return os.path.join(a.root, *x)

    # PDF
    pdf_text = ""
    if a.pdf:
        pp = P(a.pdf)
        if os.path.exists(pp):
            data = open(pp, "rb").read()
            pages = len(re.findall(rb"/Type\s*/Page[^s]", data))
            chk(5 <= pages <= 60, "PDF 页数合理", f"{pages} 页")
            pdf_text = subprocess.run(["pdftotext", "-layout", pp, "-"],
                                      capture_output=True, text=True).stdout
            chk("__PAGES__" not in pdf_text, "PDF 无页码占位符")
            chk("安全" in pdf_text and ("风险" in pdf_text or "漏洞" in pdf_text), "PDF 含报告性内容")
        else:
            chk(False, "PDF 存在", a.pdf)

    # HTML
    if a.html:
        hp = P(a.html)
        if os.path.exists(hp):
            h = open(hp, encoding="utf-8", errors="ignore").read()
            chk(h.rstrip().endswith("</html>"), "HTML 正常闭合")
            chk("__PAGES__" not in h, "HTML 无残留占位符")
            chk(h.count("<table") == h.count("</table>"), "HTML table 标签配平",
                f"{h.count('<table')}/{h.count('</table>')}")
        else:
            chk(False, "HTML 存在", a.html)

    # JSON/XML 合法性 + 脱敏
    secrets = []
    if a.secret_file and os.path.exists(a.secret_file):
        for m in re.findall(r"(?:密码|password)\s*[：:]\s*(\S+)",
                            open(a.secret_file, encoding="utf-8", errors="ignore").read()):
            secrets.append(m)
    mail = re.compile(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+")
    jwt = re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")
    leak = 0
    for d in a.scan_dirs.split(","):
        base = P(d)
        if not os.path.isdir(base):
            continue
        for dp, _, fs in os.walk(base):
            for fn in fs:
                p = os.path.join(dp, fn)
                rel = os.path.relpath(p, a.root)
                try:
                    if fn.endswith((".json", ".sarif")):
                        json.load(open(p, encoding="utf-8"))
                    elif fn.endswith(".xml"):
                        import xml.etree.ElementTree as ET
                        ET.parse(p)
                except Exception as e:
                    R.append(("FAIL", f"格式非法: {rel}", str(e)[:120]))
                if fn.endswith((".html", ".json", ".md", ".xml", ".txt", ".sarif")):
                    c = open(p, encoding="utf-8", errors="ignore").read()
                    hits = []
                    if any(s and s in c for s in secrets): hits.append("口令")
                    if jwt.search(c): hits.append("JWT")
                    # 邮箱：允许示例域 example.com，其余视为泄漏
                    realmail = [x for x in mail.findall(c) if "example." not in x and "example.com" not in x]
                    if realmail: hits.append("邮箱")
                    if hits:
                        leak += 1
                        R.append(("FAIL", f"脱敏泄漏: {rel}", ",".join(hits)))
    chk(leak == 0, "交付目录脱敏（口令/JWT/真实邮箱）", f"泄漏 {leak} 文件")
    if pdf_text:
        chk(not jwt.search(pdf_text) and not [x for x in mail.findall(pdf_text) if "example" not in x],
            "PDF 反查无 JWT/真实邮箱")

    # 关键词
    for spec in filter(None, a.must_contain.split(";")):
        if ":" not in spec: continue
        rel, kws = spec.split(":", 1)
        pp = P(rel.strip())
        if os.path.exists(pp):
            c = open(pp, encoding="utf-8", errors="ignore").read()
            for kw in kws.split(","):
                kw = kw.strip()
                if kw: chk(kw in c, f"{os.path.basename(rel)} 含「{kw}」")
    if a.expect_number:
        # 至少在 PDF 或任一 md/html 中出现
        num = a.expect_number
        found = num in pdf_text
        if not found:
            for d in a.scan_dirs.split(","):
                for dp, _, fs in os.walk(P(d)):
                    for fn in fs:
                        if fn.endswith((".md", ".html", ".txt")) and num in open(os.path.join(dp, fn), encoding="utf-8", errors="ignore").read():
                            found = True
            chk(found, f"关键数字 {num} 出现在交付物")

    fails = [r for r in R if r[0] == "FAIL"]
    lines = ["# 交付物输出检查（QC）", "",
             f"> 检查 {len(R)} ｜ 通过 {len(R)-len(fails)} ｜ 失败 {len(fails)}", ""]
    for lv, item, detail in R:
        lines.append(f"- {'✅' if lv=='PASS' else '❌'} **{item}**" + (f" — {detail}" if detail else ""))
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    open(a.out, "w", encoding="utf-8").write("\n".join(lines))
    print(f"[QC] {len(R)} checks, FAIL {len(fails)} -> {a.out}")
    for lv, item, detail in fails:
        print("  FAIL:", item, detail)
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
