#!/usr/bin/env python3
"""Generate AI-MUSE weekly CSV and statistics from a JSON news list.

Input JSON format: a list of objects with fields:
date, title, source, url, muse, subcategory, summary, why_muse, confidence

Example:
python generate_news_csv.py --input news.json --out-dir ./output --date 20260512
"""

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

FIELDNAMES = [
    "date",
    "title",
    "source",
    "url",
    "muse",
    "subcategory",
    "summary",
    "why_muse",
    "confidence",
]

MUSE_ORDER = ["M 奇迹层", "U 使用层", "S 创业层", "E 变革层"]


def load_items(input_path: Path) -> list[dict]:
    with input_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("Input JSON must be a list of news item objects.")
    normalized = []
    for idx, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Item {idx} must be an object.")
        row = {field: str(item.get(field, "")).strip() for field in FIELDNAMES}
        if row["muse"] not in MUSE_ORDER:
            raise ValueError(
                f"Item {idx} has invalid muse value: {row['muse']!r}. "
                f"Allowed values: {', '.join(MUSE_ORDER)}"
            )
        if not row["title"] or not row["source"] or not row["url"]:
            raise ValueError(f"Item {idx} must include title, source, and url.")
        normalized.append(row)
    return normalized


def write_csv(items: list[dict], csv_path: Path) -> None:
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(items)


def write_stats(items: list[dict], stats_path: Path, report_date: str) -> None:
    total = len(items)
    muse_count = Counter(item["muse"] for item in items)
    source_count = Counter(item["source"] for item in items)
    topic_count = Counter(item["subcategory"] for item in items if item["subcategory"])

    with stats_path.open("w", encoding="utf-8") as f:
        f.write(f"# {report_date} AI 新闻 MUSE 分类统计\n\n")
        f.write(f"本次共整理 **{total}** 条 AI 新闻与研究线索。\n\n")
        f.write("| MUSE 分类 | 数量 | 占比 |\n|---|---:|---:|\n")
        for muse in MUSE_ORDER:
            count = muse_count[muse]
            pct = count / total if total else 0
            f.write(f"| {muse} | {count} | {pct:.1%} |\n")

        f.write("\n## 来源分布\n\n")
        f.write("| 来源 | 数量 |\n|---|---:|\n")
        for source, count in source_count.most_common():
            f.write(f"| {source} | {count} |\n")

        f.write("\n## 主题分布\n\n")
        f.write("| 主题 | 数量 |\n|---|---:|\n")
        for topic, count in topic_count.most_common():
            f.write(f"| {topic} | {count} |\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate AI-MUSE weekly CSV and stats.")
    parser.add_argument("--input", required=True, help="Path to input JSON news list.")
    parser.add_argument("--out-dir", required=True, help="Output directory.")
    parser.add_argument("--date", required=True, help="Report date prefix, e.g. 20260512.")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    items = load_items(input_path)
    csv_path = out_dir / f"{args.date}_ai_news_muse.csv"
    stats_path = out_dir / f"{args.date}_ai_news_muse_stats.md"
    write_csv(items, csv_path)
    write_stats(items, stats_path, args.date)

    print(csv_path)
    print(stats_path)
    print(len(items))


if __name__ == "__main__":
    main()
