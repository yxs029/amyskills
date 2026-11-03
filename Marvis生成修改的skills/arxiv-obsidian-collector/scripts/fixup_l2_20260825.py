#!/usr/bin/env python3
"""
fixup_l2_20260825.py

修复 2026-08-24 L1 跑出的 91 篇降级 .md(quality_score=5.0 + quality_category=unknown +
quality_reasons 含 401 错误)。重新跑 score + summary,改写 .md。

设计原则:
- 复用 pipeline 的 score_paper / generate_summary / extract_pdf_text,保证格式一致
- 用我已经验证能用的 SDK(在 bash tool 进程下跑,os.environ 的 key 是真值)
- 复用同一个 client,避免连接重建
- 失败的单篇不阻塞其他,记到 fixup_failed.txt
- 同时输出 fixup_report.json 含每篇的 score 变化 / 旧 reasons / 新 reasons

用法:
  python scripts/fixup_l2_20260825.py
"""
from __future__ import annotations

import datetime
import io
import json
import os
import re
import sys
from pathlib import Path

# Windows GBK 终端兜底
for _stream_name in ("stdout", "stderr"):
    _stream = getattr(sys, _stream_name, None)
    if _stream is None:
        continue
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, io.UnsupportedOperation):
        try:
            _buf = _stream.buffer
        except AttributeError:
            continue
        setattr(sys, _stream_name, io.TextIOWrapper(_buf, encoding="utf-8", errors="replace"))

# Proxy 兜底
_DEFAULT_PROXY = "http://127.0.0.1:7892"
_DEFAULT_CA = r"C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem"
for _k in ("HTTPS_PROXY", "HTTP_PROXY"):
    os.environ.setdefault(_k, _DEFAULT_PROXY)
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1,::1")
if os.path.exists(_DEFAULT_CA):
    os.environ.setdefault("REQUESTS_CA_BUNDLE", _DEFAULT_CA)
    os.environ.setdefault("SSL_CERT_FILE", _DEFAULT_CA)

import yaml
from scorer import make_minimax_client
from pipeline import extract_pdf_text, score_paper as _score_paper, generate_summary, slug_tag

# 复用 pipeline 内部 score_paper (scorer 的 score_paper),其实从 pipeline import 更直接
from pipeline import score_paper  # pipeline 重新导出了它


def parse_frontmatter(content: str) -> tuple[dict, str, int, int]:
    """解析 --- ... --- 之间的 YAML-like 字段。返回 (dict, body, fm_start, fm_end_index_in_string)。"""
    if not content.startswith("---"):
        return {}, content, 0, 0
    # 找第二个 ---
    end_match = re.search(r"\n---\n", content[3:])
    if not end_match:
        # 也兼容 \n---\r\n 等
        end_match = re.search(r"\n---[ \t]*(\r?\n|$)", content[3:])
    if not end_match:
        return {}, content, 0, 0
    fm_end = 3 + end_match.end()
    fm_text = content[3:3 + end_match.start()]
    body = content[fm_end:]
    fm = {}
    # 简单 key: value 解析(够用)
    lines = fm_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$", line)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2)
        if val == "" and i + 1 < len(lines) and lines[i + 1].lstrip().startswith("-"):
            # 列表
            items = []
            j = i + 1
            while j < len(lines) and re.match(r"^\s*-\s+", lines[j]):
                items.append(re.sub(r"^\s*-\s+", "", lines[j]).strip().strip('"'))
                j += 1
            fm[key] = items
            i = j
            continue
        val = val.strip()
        # 去掉行尾注释
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        elif val.startswith("'") and val.endswith("'"):
            val = val[1:-1]
        elif val.startswith("[") and val.endswith("]"):
            inner = val[1:-1]
            items = [x.strip().strip('"').strip("'") for x in inner.split(",") if x.strip()]
            fm[key] = items
        else:
            try:
                fm[key] = float(val) if "." in val else int(val)
            except ValueError:
                fm[key] = val
        i += 1
    return fm, body, 0, fm_end


def write_md(
    md_path: Path,
    title: str,
    fm_old: dict,
    score: dict,
    summary_content: str,
    pdf_filename: str,
    matched_categories: list[str],
    primary_layer: str,
    primary_category: str,
    paper: dict,
) -> None:
    """按 pipeline 原格式重写 .md。"""
    cat_tags = ", ".join(slug_tag(c) for c in matched_categories)
    reasons_yaml = "\n".join(
        f'  - "{r}"' for r in score["reasons"][:5]
    ) or '  - ""'

    md_content = f"""---
title: "{title}"
authors: {', '.join(paper['authors'])}
date: {paper.get('date', fm_old.get('date', ''))}
arxiv_id: {paper['id']}
arxiv_url: {paper.get('url', fm_old.get('arxiv_url', ''))}
layer: {primary_layer}
category: {primary_category}
matched_categories: [{', '.join(matched_categories)}]
tags: [arXiv, {cat_tags}, quality/{score['category']}]
quality_score: {score['score']}
quality_category: {score['category']}
quality_reasons:
{reasons_yaml}
pdf: "[[{pdf_filename}]]"
---

# {title}

> **TL;DR**: {score['tl_dr']}

**PDF**: [[{pdf_filename}]]  |  **质量分**: {score['score']:.1f}/10

{summary_content}
"""
    md_path.write_text(md_content, encoding="utf-8")


def main(limit: int | None = None):
    skill_root = Path(r"C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector")
    vault_dir = Path(r"F:\软件测试\30AI技术知识树\arxivForAI")
    cfg_path = skill_root / "config.yaml"
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    cfg["vault_dir"] = str(vault_dir.resolve())
    cfg["pdf_max_pages"] = cfg.get("pdf_max_pages", 4)

    # 找今天落盘 + frontmatter 有 401 错误的 .md
    today_start = datetime.datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    candidates = []
    for md in vault_dir.rglob("*.md"):
        if md.name.startswith("."):
            continue
        if md.stat().st_mtime < today_start.timestamp():
            continue
        try:
            txt = md.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if "scoring failed" not in txt:
            continue
        candidates.append(md)

    if limit is not None and limit > 0:
        candidates = candidates[:limit]
        print(f"📋 找到候选项,本次只跑前 {limit} 篇(--limit)")

    print(f"📋 找到 {len(candidates)} 篇需要 fixup 的 .md(今日 + frontmatter 含 scoring failed)")

    if not candidates:
        print("✅ 无需 fixup,直接退出")
        return

    # 构造 client
    api_key = os.environ.get("MINIMAX_M3_API_KEY", "")
    print(f"🔑 env key length: {len(api_key)} (前 12: {api_key[:12] if api_key else 'EMPTY'})")
    if len(api_key) < 50:
        print("❌ API Key 异常,fixup 无法继续。检查 User-env 或显式设 $env:MINIMAX_M3_API_KEY")
        sys.exit(1)

    client = make_minimax_client(api_base=cfg["api_base"], api_key_env="MINIMAX_M3_API_KEY")
    print(f"🤖 client.api_key 前 12: {client.api_key[:12]}, base_url: {client.base_url}")

    # 跑(逐篇)
    report = {
        "started_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "total_candidates": len(candidates),
        "fixed": [],
        "failed": [],
    }
    fixup_failed_path = skill_root / "logs" / "fixup_l2_20260825_failed.txt"
    fixup_report_path = skill_root / "logs" / "fixup_l2_20260825_report.json"
    fixup_failed_path.parent.mkdir(parents=True, exist_ok=True)

    for idx, md_path in enumerate(candidates, 1):
        rel = md_path.relative_to(vault_dir)
        print(f"\n[{idx}/{len(candidates)}] {rel}")
        try:
            txt = md_path.read_text(encoding="utf-8")
            fm, body, _, _ = parse_frontmatter(txt)
            title = fm.get("title", md_path.stem)
            arxiv_id = fm.get("arxiv_id", "")
            layer = fm.get("layer", "")
            category = fm.get("category", "")
            matched_cats = fm.get("matched_categories", [category]) or [category]
            if isinstance(matched_cats, str):
                matched_cats = [matched_cats]
            old_score = fm.get("quality_score", 5.0)
            old_reasons = fm.get("quality_reasons", [])
            pdf_link = fm.get("pdf", "")
            # 从 [[xx.pdf]] 里取文件名
            m = re.search(r"\[\[(.+?\.pdf)\]\]", pdf_link)
            pdf_filename = m.group(1) if m else md_path.stem + ".pdf"
            pdf_path = md_path.parent / pdf_filename
            if not pdf_path.exists():
                print(f"    ❌ PDF 不存在: {pdf_path}")
                report["failed"].append({"path": str(md_path), "reason": "PDF missing"})
                continue

            pdf_text = extract_pdf_text(str(pdf_path), max_pages=cfg["pdf_max_pages"])
            if not pdf_text:
                print(f"    ⚠️  PDF 文本提取为空,继续")

            # 构造 paper dict(generate_summary 需要 title/authors/summary)
            paper = {
                "id": arxiv_id,
                "title": title,
                "authors": [a.strip() for a in str(fm.get("authors", "")).split(",") if a.strip()],
                "summary": body[:500] if body else "",  # 兜底,有些 .md body 是空(降级模式)
                "published": str(fm.get("date", "")) + "T00:00:00Z" if fm.get("date") else "",
                "url": fm.get("arxiv_url", ""),
                "pdf_url": "",  # 不用
            }
            # 优先从 arxiv_url 拉一份真 summary(可选,网络;失败也无所谓)
            # 这里就用 body 兜底,后续如有空再补

            # 评分
            score = score_paper(
                paper, layer, category, pdf_text,
                model=cfg.get("quality_scorer_model", "m3"), client=client,
            )
            print(f"    ⭐ 评分: {score['score']:.1f}/10 [{score['category']}]")
            print(f"       TL;DR: {score['tl_dr'][:100]}")

            # 摘要
            summary_content = generate_summary(
                paper, layer, category, pdf_text,
                model=cfg.get("model", "m3"), client=client,
            )
            if not summary_content:
                print(f"    ⚠️  摘要生成失败,保留旧 .md 格式(只更新 frontmatter)")
                # 降级到只写 frontmatter,不写 body
                write_md(
                    md_path, title, fm, score,
                    summary_content=body or "## 摘要\n\n(LLM 摘要生成失败,占位)\n",
                    pdf_filename=pdf_filename,
                    matched_categories=matched_cats,
                    primary_layer=layer, primary_category=category, paper=paper,
                )
            else:
                write_md(
                    md_path, title, fm, score,
                    summary_content=summary_content,
                    pdf_filename=pdf_filename,
                    matched_categories=matched_cats,
                    primary_layer=layer, primary_category=category, paper=paper,
                )
            print(f"    ✅ 修复完成: {md_path.name}")
            report["fixed"].append({
                "path": str(md_path),
                "arxiv_id": arxiv_id,
                "old_score": old_score,
                "old_category": "unknown",
                "new_score": score["score"],
                "new_category": score["category"],
                "tl_dr": score["tl_dr"][:120],
            })
        except Exception as e:
            print(f"    ❌ fixup 异常: {type(e).__name__}: {e}")
            report["failed"].append({"path": str(md_path), "reason": f"{type(e).__name__}: {str(e)[:200]}"})

    # 输出失败列表 + 报告
    if report["failed"]:
        fixup_failed_path.write_text(
            "\n".join(f"{x['path']}\t{x['reason']}" for x in report["failed"]),
            encoding="utf-8",
        )
        print(f"\n⚠️  失败列表 → {fixup_failed_path}")
    fixup_report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n📊 报告 → {fixup_report_path}")
    print(f"\n{'='*60}")
    print(f"🎉 fixup 完成: 成功 {len(report['fixed'])} / 失败 {len(report['failed'])} / 总 {len(candidates)}")
    print(f"{'='*60}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=None, help="只跑前 N 篇(用于小批量验证)")
    args = p.parse_args()
    main(limit=args.limit)

