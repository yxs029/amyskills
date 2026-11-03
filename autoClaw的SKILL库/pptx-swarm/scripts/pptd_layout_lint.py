#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


SLIDE_W = 1280.0
SLIDE_H = 720.0
SAFE = (60.0, 45.0, 1160.0, 630.0)


@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float

    @property
    def area(self) -> float:
        return max(0.0, self.w) * max(0.0, self.h)

    def intersect(self, other: "Box") -> "Box":
        x1 = max(self.x, other.x)
        y1 = max(self.y, other.y)
        x2 = min(self.x + self.w, other.x + other.w)
        y2 = min(self.y + self.h, other.y + other.h)
        return Box(x1, y1, max(0.0, x2 - x1), max(0.0, y2 - y1))


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def extract_pages(pptd: Path) -> list[str]:
    lines = read_text(pptd).splitlines()
    pages: list[str] = []
    in_pages = False
    base_indent = None
    for line in lines:
        if re.match(r"^\s*pages\s*:\s*$", line):
            in_pages = True
            base_indent = len(line) - len(line.lstrip())
            continue
        if not in_pages:
            continue
        indent = len(line) - len(line.lstrip())
        if line.strip() and base_indent is not None and indent <= base_indent and not line.lstrip().startswith("-"):
            break
        match = re.match(r"^\s*-\s*['\"]?([^'\"\s#]+\.page)['\"]?", line)
        if match:
            pages.append(match.group(1))
    return pages


def load_page(path: Path) -> dict[str, Any]:
    if yaml is None:
        raise RuntimeError("PyYAML is required to parse .page files")
    data = yaml.safe_load(read_text(path))
    if not isinstance(data, dict):
        return {}
    return data


def clean_text(raw: Any) -> str:
    if not raw:
        return ""
    text = str(raw)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"[ \t]+", " ", text).strip()


def text_weight(text: str) -> float:
    weight = 0.0
    for ch in text:
        if ch == "\n":
            continue
        if "\u4e00" <= ch <= "\u9fff":
            weight += 1.0
        elif ch.isspace():
            weight += 0.35
        elif ch.isascii():
            weight += 0.55
        else:
            weight += 0.9
    return weight


def font_size(el: dict[str, Any]) -> float:
    content = el.get("content") if isinstance(el.get("content"), dict) else {}
    for key in ("fontSize",):
        value = content.get(key)
        if isinstance(value, (int, float)):
            return float(value)
    style = str(content.get("style", "")).lower()
    element_id = str(el.get("elementId", "")).lower()
    if "title" in style or "title" in element_id:
        return 28.0
    if "source" in element_id or "foot" in element_id:
        return 10.0
    return 16.0


def element_box(el: dict[str, Any]) -> Box | None:
    bounds = el.get("bounds")
    if not isinstance(bounds, list) or len(bounds) != 4:
        return None
    try:
        return Box(*(float(v) for v in bounds))
    except (TypeError, ValueError):
        return None


def is_decorative_shape(el: dict[str, Any], box: Box) -> bool:
    if el.get("elementType") != "shape":
        return False
    if box.h <= 3 or box.w <= 3:
        return True
    fill = el.get("fill") if isinstance(el.get("fill"), dict) else {}
    fill_color = str(fill.get("color", "")).lower()
    return fill_color in {"#ffffff", "$background", "$bg", "$bgalpha"} and box.area > 100000


def union_area(boxes: list[Box]) -> float:
    if not boxes:
        return 0.0
    xs = sorted({b.x for b in boxes} | {b.x + b.w for b in boxes})
    area = 0.0
    for x1, x2 in zip(xs, xs[1:]):
        if x2 <= x1:
            continue
        intervals: list[tuple[float, float]] = []
        for b in boxes:
            if b.x < x2 and b.x + b.w > x1:
                intervals.append((b.y, b.y + b.h))
        intervals.sort()
        merged: list[list[float]] = []
        for y1, y2 in intervals:
            if not merged or y1 > merged[-1][1]:
                merged.append([y1, y2])
            else:
                merged[-1][1] = max(merged[-1][1], y2)
        area += (x2 - x1) * sum(y2 - y1 for y1, y2 in merged)
    return area


def clipped_area(box: Box, clip: Box) -> float:
    return box.intersect(clip).area


def table_text_cells(el: dict[str, Any]) -> list[str]:
    rows = el.get("rows")
    if not isinstance(rows, list):
        return []
    cells: list[str] = []
    for row in rows:
        if not isinstance(row, list):
            continue
        for cell in row:
            if isinstance(cell, dict):
                content = cell.get("content") if isinstance(cell.get("content"), dict) else {}
                cells.append(clean_text(content.get("text", "")))
            else:
                cells.append(clean_text(cell))
    return cells


def lint_page(page_path: Path) -> dict[str, Any]:
    data = load_page(page_path)
    page_type = str(data.get("pageType", "content"))
    elements = data.get("elements") if isinstance(data.get("elements"), list) else []
    findings: list[dict[str, str]] = []
    boxes: list[tuple[str, str, Box]] = []
    info_boxes: list[Box] = []

    def add(severity: str, code: str, message: str) -> None:
        findings.append({"severity": severity, "code": code, "message": message})

    for i, el in enumerate(elements):
        if not isinstance(el, dict):
            continue
        box = element_box(el)
        if not box:
            continue
        etype = str(el.get("elementType", "unknown"))
        eid = str(el.get("elementId", f"el_{i}"))
        boxes.append((eid, etype, box))

        if box.x < -1 or box.y < -1 or box.x + box.w > SLIDE_W + 1 or box.y + box.h > SLIDE_H + 1:
            add("error", "out_of_slide", f"{eid} bounds exceed slide: {[box.x, box.y, box.w, box.h]}")

        if etype in {"text", "table", "chart", "image"}:
            info_boxes.append(box)

        if etype == "text":
            content = el.get("content") if isinstance(el.get("content"), dict) else {}
            text = clean_text(content.get("text", ""))
            fs = font_size(el)
            if text and fs < 10:
                add("error", "font_too_small", f"{eid} fontSize {fs:g} is below 10")
            elif text and fs < 13 and box.y < 635:
                add("warning", "font_small", f"{eid} fontSize {fs:g} is small for body content")

            wrap = content.get("wrap", True)
            weighted = text_weight(text)
            est_width = weighted * fs * 0.58
            if wrap is False and est_width > box.w * 1.05:
                add("warning", "nowrap_overflow", f"{eid} estimated text width {est_width:.0f}px exceeds box width {box.w:.0f}px")
            if text and wrap is not False:
                chars_per_line = max(1.0, box.w / max(5.0, fs * 0.58))
                lines = max(text.count("\n") + 1, math.ceil(weighted / chars_per_line))
                required_h = lines * fs * 1.28
                if required_h > box.h * 1.18:
                    add("error", "text_overflow", f"{eid} estimated height {required_h:.0f}px exceeds box height {box.h:.0f}px")
                elif required_h > box.h * 0.96:
                    add("warning", "text_tight", f"{eid} estimated height {required_h:.0f}px nearly fills box height {box.h:.0f}px")

        if etype == "table":
            cells = table_text_cells(el)
            style = el.get("style") if isinstance(el.get("style"), dict) else {}
            fs = float(style.get("fontSize", 12) or 12)
            if fs < 11:
                add("warning", "table_font_small", f"{eid} table fontSize {fs:g} is small")
            if cells:
                avg_cell_area = box.area / max(1, len(cells))
                max_text = max(text_weight(c) for c in cells)
                if avg_cell_area < 900 and max_text > 7:
                    add("warning", "table_crowded", f"{eid} has small cells for its text volume")

        if etype == "chart":
            data_rows = el.get("data")
            if isinstance(data_rows, list):
                row_count = len(data_rows)
                if box.area > 170000 and row_count <= 3:
                    add("warning", "chart_low_signal", f"{eid} uses a large chart area with only {row_count} data rows")
            if box.w < 260 or box.h < 180:
                add("warning", "chart_too_small", f"{eid} chart bounds are small for readable labels")

    solid = [(eid, etype, box) for eid, etype, box in boxes if etype in {"text", "table", "chart", "image"}]
    for idx, (id_a, type_a, a) in enumerate(solid):
        for id_b, type_b, b in solid[idx + 1:]:
            inter = a.intersect(b)
            if inter.area <= 600:
                continue
            ratio = inter.area / max(1.0, min(a.area, b.area))
            if ratio > 0.08:
                add("error", "element_overlap", f"{id_a} overlaps {id_b} by {ratio:.0%} of smaller element")

    safe_box = Box(*SAFE)
    clipped = [b.intersect(safe_box) for b in info_boxes if b.intersect(safe_box).area > 0]
    density = union_area(clipped) / safe_box.area if safe_box.area else 0.0
    if page_type not in {"cover", "final", "chapter"}:
        if density < 0.16:
            add("warning", "low_information_density", f"information bounds cover only {density:.0%} of safe area")
        elif density > 0.78:
            add("warning", "high_information_density", f"information bounds cover {density:.0%} of safe area")

    left = Box(SAFE[0], SAFE[1], SAFE[2] / 2, SAFE[3])
    right = Box(SAFE[0] + SAFE[2] / 2, SAFE[1], SAFE[2] / 2, SAFE[3])
    top = Box(SAFE[0], SAFE[1], SAFE[2], SAFE[3] / 2)
    bottom = Box(SAFE[0], SAFE[1] + SAFE[3] / 2, SAFE[2], SAFE[3] / 2)
    left_area = union_area([b.intersect(left) for b in info_boxes if b.intersect(left).area > 0])
    right_area = union_area([b.intersect(right) for b in info_boxes if b.intersect(right).area > 0])
    top_area = union_area([b.intersect(top) for b in info_boxes if b.intersect(top).area > 0])
    bottom_area = union_area([b.intersect(bottom) for b in info_boxes if b.intersect(bottom).area > 0])
    if density > 0.2:
        lr = min(left_area, right_area) / max(1.0, max(left_area, right_area))
        tb = min(top_area, bottom_area) / max(1.0, max(top_area, bottom_area))
        if lr < 0.18:
            add("warning", "left_right_imbalance", f"left/right information area ratio is {lr:.2f}")
        if tb < 0.18:
            add("warning", "top_bottom_imbalance", f"top/bottom information area ratio is {tb:.2f}")

    score = 100
    for f in findings:
        score -= 14 if f["severity"] == "error" else 5
    score = max(0, score)
    return {
        "file": str(page_path),
        "page_type": page_type,
        "score": score,
        "density": round(density, 3),
        "errors": [f for f in findings if f["severity"] == "error"],
        "warnings": [f for f in findings if f["severity"] == "warning"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Static no-template layout lint for PPTD/.page decks.")
    parser.add_argument("pptd")
    parser.add_argument("--min-score", type=int, default=90)
    parser.add_argument("--warn-only", action="store_true")
    args = parser.parse_args()

    pptd = Path(args.pptd).expanduser().resolve()
    project = pptd.parent
    pages = extract_pages(pptd)
    results = []
    for page in pages:
        page_path = project / page
        if page_path.exists():
            results.append(lint_page(page_path))
        else:
            results.append({
                "file": str(page_path),
                "page_type": "missing",
                "score": 0,
                "density": 0,
                "errors": [{"severity": "error", "code": "missing_page", "message": "referenced page is missing"}],
                "warnings": [],
            })

    errors = [e for r in results for e in r["errors"]]
    low_score = [r for r in results if r["score"] < args.min_score]
    summary = {
        "pptd": str(pptd),
        "page_count": len(results),
        "min_score": min((r["score"] for r in results), default=0),
        "avg_score": round(sum((r["score"] for r in results), 0) / max(1, len(results)), 1),
        "error_count": len(errors),
        "warning_count": sum(len(r["warnings"]) for r in results),
        "low_score_pages": [{"file": r["file"], "score": r["score"]} for r in low_score],
        "pages": results,
        "ok": not errors and not low_score,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.warn_only:
        return 0
    return 0 if summary["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
