#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


DEFAULT_MIN_SCORE = 75
DEFAULT_MAX_MAJOR = 0
DEFAULT_MAX_MINOR = 3


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def load_manifest(path: Path | None) -> dict[int, dict[str, Any]]:
    if not path or not path.exists():
        return {}
    data = read_json(path)
    pages = data.get("pages") if isinstance(data.get("pages"), list) else []
    out: dict[int, dict[str, Any]] = {}
    for idx, page in enumerate(pages, start=1):
        if isinstance(page, dict):
            out[idx] = page
    return out


def int_value(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return int(value)
    return default


def issue_counts(summary: dict[str, Any]) -> dict[str, int]:
    counts = summary.get("quality_issue_counts")
    if isinstance(counts, dict):
        return {
            "critical": int_value(counts.get("critical")),
            "major": int_value(counts.get("major")),
            "minor": int_value(counts.get("minor")),
        }
    issues = all_issues(summary, {})
    return {
        "critical": sum(1 for i in issues if i.get("severity") == "critical"),
        "major": sum(1 for i in issues if i.get("severity") == "major"),
        "minor": sum(1 for i in issues if i.get("severity") == "minor"),
    }


def all_issues(summary: dict[str, Any], packet: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for key in ("issue_candidates", "slide_issues", "top_issues"):
        value = summary.get(key)
        if isinstance(value, list):
            issues.extend(i for i in value if isinstance(i, dict))
    if not issues:
        signals = packet.get("quality_signals") if isinstance(packet.get("quality_signals"), dict) else {}
        value = signals.get("issue_candidates")
        if isinstance(value, list):
            issues.extend(i for i in value if isinstance(i, dict))
    return issues


def slide_lookup(packet: dict[str, Any]) -> dict[int, dict[str, Any]]:
    slides = packet.get("slides") if isinstance(packet.get("slides"), list) else []
    out: dict[int, dict[str, Any]] = {}
    for slide in slides:
        if not isinstance(slide, dict):
            continue
        slide_no = int_value(slide.get("slide"), -1)
        if slide_no > 0:
            out[slide_no] = slide
    return out


def repair_guidance(issue_type: str) -> str:
    table = {
        "blank": "重建该页；不要保留空框或占位内容。",
        "low_signal": "减少空容器面积，放大主要图表/表格/论点；补 2-4 个有信息量的标注或数据点。",
        "empty_space": "缩小或删除大面积空白卡片，把关键结论、证据、对比项分配到空白区域。",
        "imbalance": "重新分配左右/上下内容重量；不要一边堆文字、一边只放装饰或空框。",
        "crowding": "拆页或删减次要信息；保持正文可读，不要靠继续缩小字号解决。",
        "clipping": "把内容拉回安全边距，页脚/来源不要贴边。",
        "readability": "提高字号和对比度；正文优先 16-22，表格 12-16，来源 9-11。",
        "chart": "让图表表达一个清晰判断；增加轴、标签、注释，或改成紧凑表格。",
        "table": "减少列/行或拆表；保证单元格文字不会挤压。",
        "overlap": "移动或缩小元素，先解决物理重叠再谈美化。",
        "content": "补足与任务相关的证据、结论或行动建议。",
        "traceability": "补来源、假设、口径或风险提示。",
    }
    return table.get(issue_type, "按证据修复该页；保持 no-template 自由布局，但必须可读、均衡、信息密度合理。")


def gate_reasons(
    summary: dict[str, Any],
    counts: dict[str, int],
    min_score: int,
    max_major: int,
    max_minor: int,
) -> list[str]:
    reasons: list[str] = []
    hard_gates = summary.get("hard_gate_failures")
    if isinstance(hard_gates, list) and hard_gates:
        reasons.append(f"hard_gate_failures:{','.join(str(x) for x in hard_gates)}")
    status = str(summary.get("final_status") or summary.get("status") or "")
    if status == "fail":
        reasons.append("status_fail")
    score = summary.get("final_score")
    if isinstance(score, (int, float)) and not isinstance(score, bool) and score < min_score:
        reasons.append(f"score_below_{min_score}:{score}")
    if counts["critical"] > 0:
        reasons.append(f"critical_issues:{counts['critical']}")
    if counts["major"] > max_major:
        reasons.append(f"major_issues:{counts['major']}>{max_major}")
    if counts["minor"] > max_minor:
        reasons.append(f"minor_issues:{counts['minor']}>{max_minor}")
    return reasons


def markdown_report(
    summary: dict[str, Any],
    packet: dict[str, Any],
    manifest: dict[int, dict[str, Any]],
    issues: list[dict[str, Any]],
    reasons: list[str],
) -> str:
    slides = slide_lookup(packet)
    grouped: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for issue in issues:
        grouped[issue.get("slide", "deck")].append(issue)

    lines = [
        "# PPTX Repair Plan",
        "",
        f"- artifact: `{summary.get('artifact_id') or packet.get('artifact_id') or 'unknown'}`",
        f"- score: `{summary.get('final_score')}`",
        f"- status: `{summary.get('final_status') or summary.get('status')}`",
        f"- visual score: `{summary.get('visual_score')}`",
        f"- repair required: `{'yes' if reasons else 'no'}`",
        f"- reasons: `{', '.join(reasons) if reasons else 'none'}`",
        "",
        "## Rules",
        "",
        "- Do not add fixed templates.",
        "- Repair the `.page` files, then rerun checker, guard, conversion, judge, and this gate.",
        "- Do not solve crowding by shrinking body text below readable sizes.",
        "- Prefer deleting empty containers over decorating them.",
        "",
    ]
    if not issues:
        lines.extend(["## Slide Repairs", "", "- none"])
        return "\n".join(lines) + "\n"

    lines.extend(["## Slide Repairs", ""])
    def sort_key(item: tuple[Any, list[dict[str, Any]]]) -> tuple[int, int]:
        key, _ = item
        return (0, int(key)) if isinstance(key, int) else (1, 999)

    for slide_no, slide_issues in sorted(grouped.items(), key=sort_key):
        page = manifest.get(slide_no if isinstance(slide_no, int) else -1, {})
        slide = slides.get(slide_no if isinstance(slide_no, int) else -1, {})
        title = slide.get("title_guess") or page.get("intent") or "deck-level issue"
        file_path = page.get("file", "")
        lines.append(f"### Slide {slide_no}: {title}")
        if file_path:
            lines.append(f"- page file: `{file_path}`")
        vm = slide.get("visual_metrics") if isinstance(slide.get("visual_metrics"), dict) else {}
        metrics = []
        for key in ("non_white_ratio", "edge_density", "largest_background_component_ratio", "quadrant_imbalance"):
            if key in vm:
                metrics.append(f"{key}={vm[key]}")
        if metrics:
            lines.append(f"- visual metrics: `{', '.join(metrics)}`")
        for issue in slide_issues:
            issue_type = str(issue.get("issue_type") or issue.get("dimension") or "other")
            severity = str(issue.get("severity") or "minor")
            evidence = str(issue.get("evidence") or "").strip()
            recommendation = str(issue.get("recommendation") or "").strip()
            lines.append(f"- [{severity}] `{issue_type}`: {evidence}")
            lines.append(f"  Repair: {recommendation or repair_guidance(issue_type)}")
            extra = repair_guidance(issue_type)
            if extra not in recommendation:
                lines.append(f"  Gate guidance: {extra}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Turn PPTX judge output into a blocking repair gate for PPTD swarm projects.")
    parser.add_argument("--summary", required=True, help="summary.json from pptx-judge.py")
    parser.add_argument("--packet", default="", help="packet.json from pptx-judge.py")
    parser.add_argument("--page-manifest", default="", help="page_manifest.json from the PPTD project")
    parser.add_argument("--out", default="", help="write markdown repair plan here")
    parser.add_argument("--min-score", type=int, default=DEFAULT_MIN_SCORE)
    parser.add_argument("--max-major", type=int, default=DEFAULT_MAX_MAJOR)
    parser.add_argument("--max-minor", type=int, default=DEFAULT_MAX_MINOR)
    parser.add_argument("--warn-only", action="store_true")
    args = parser.parse_args()

    summary_path = Path(args.summary).expanduser().resolve()
    packet_path = Path(args.packet).expanduser().resolve() if args.packet else summary_path.parent / "packet.json"
    manifest_path = Path(args.page_manifest).expanduser().resolve() if args.page_manifest else None
    out_path = Path(args.out).expanduser().resolve() if args.out else summary_path.parent / "repair_plan.md"

    summary = read_json(summary_path)
    packet = read_json(packet_path) if packet_path.exists() else {}
    manifest = load_manifest(manifest_path)
    counts = issue_counts(summary)
    issues = all_issues(summary, packet)
    reasons = gate_reasons(summary, counts, args.min_score, args.max_major, args.max_minor)
    write_text(out_path, markdown_report(summary, packet, manifest, issues, reasons))

    result = {
        "summary": str(summary_path),
        "packet": str(packet_path) if packet_path.exists() else None,
        "repair_plan": str(out_path),
        "repair_required": bool(reasons),
        "reasons": reasons,
        "final_score": summary.get("final_score"),
        "final_status": summary.get("final_status") or summary.get("status"),
        "quality_issue_counts": counts,
        "thresholds": {
            "min_score": args.min_score,
            "max_major": args.max_major,
            "max_minor": args.max_minor,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.warn_only:
        return 0
    return 2 if reasons else 0


if __name__ == "__main__":
    sys.exit(main())
