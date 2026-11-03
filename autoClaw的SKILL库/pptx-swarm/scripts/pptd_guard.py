#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path


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


def page_type(page_path: Path) -> str:
    if not page_path.exists():
        return "missing"
    match = re.search(r"^\s*pageType\s*:\s*['\"]?([^'\"\s#]+)", read_text(page_path), re.MULTILINE)
    return match.group(1).strip() if match else "unknown"


def full_slide_image_like(page_path: Path) -> bool:
    if not page_path.exists():
        return False
    text = read_text(page_path)
    if "elementType: image" not in text:
        return False
    for match in re.finditer(r"elementType:\s*image[\s\S]{0,500}?bounds:\s*\[([^\]]+)\]", text):
        nums = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", match.group(1))]
        if len(nums) == 4:
            x, y, w, h = nums
            if x <= 10 and y <= 10 and w >= 1200 and h >= 660:
                return True
    return False


def load_manifest(project_dir: Path) -> dict | None:
    path = project_dir / "page_manifest.json"
    if not path.exists():
        return None
    return json.loads(read_text(path))


def manifest_type(page: dict | None) -> str | None:
    if not isinstance(page, dict):
        return None
    value = page.get("page_type") or page.get("pageType") or page.get("type")
    return str(value).strip() if value else None


def validate_manifest_contract(manifest_pages: list[dict], errors: list[str]) -> None:
    required = ["layout_skeleton", "content_budget", "density_intent", "qa_risks"]
    allowed_density = {"low", "normal", "dense"}
    for idx, page in enumerate(manifest_pages, start=1):
        file_name = page.get("file") or f"page#{idx}"
        for field in required:
            value = page.get(field)
            if value in (None, "", []):
                errors.append(f"page_manifest missing {field}: {file_name}")
        density = str(page.get("density_intent") or "").strip()
        if density and density not in allowed_density:
            errors.append(f"page_manifest invalid density_intent for {file_name}: {density}")
        risks = page.get("qa_risks")
        if risks is not None and not isinstance(risks, list):
            errors.append(f"page_manifest qa_risks must be a list: {file_name}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Guard rails for PPTD swarm projects.")
    parser.add_argument("pptd")
    parser.add_argument("--pre-spawn", action="store_true")
    parser.add_argument("--post-pages", action="store_true")
    parser.add_argument("--allow-extra-pages", action="store_true")
    args = parser.parse_args()

    pptd = Path(args.pptd).expanduser().resolve()
    project = pptd.parent
    errors: list[str] = []
    warnings: list[str] = []
    expected_missing: list[str] = []

    if not pptd.exists():
        errors.append(f"missing pptd: {pptd}")
    sibling_pptds = sorted(project.glob("*.pptd"))
    if len(sibling_pptds) > 1:
        errors.append("project directory contains multiple .pptd files; create a clean child project directory")
    if args.pre_spawn and any((project / "DELIVERY").glob("*.pptx")):
        errors.append("DELIVERY/ already contains .pptx files before this run; create a clean project directory")
    for required in ["design.md", "outline.md", "page_manifest.json"]:
        if not (project / required).exists():
            errors.append(f"missing required file: {required}")
    if not (project / "pages").is_dir():
        errors.append("missing pages/ directory")

    pages = extract_pages(pptd) if pptd.exists() else []
    if not pages:
        errors.append("no .page entries found in pptd pages list")

    manifest = load_manifest(project)
    manifest_files: list[str] = []
    manifest_pages: list[dict] = []
    manifest_by_file: dict[str, dict] = {}
    if manifest:
        manifest_pages = [p for p in manifest.get("pages", []) if isinstance(p, dict)]
        manifest_files = [p.get("file", "") for p in manifest_pages]
        manifest_by_file = {str(p.get("file")): p for p in manifest_pages if p.get("file")}
        if manifest_files and manifest_files != pages:
            errors.append("page_manifest.json order/files do not exactly match pptd pages list")
        validate_manifest_contract(manifest_pages, errors)
    else:
        errors.append("page_manifest.json is invalid or unreadable")

    referenced = {project / p for p in pages}
    missing = [str(p) for p in referenced if not p.exists()]
    if missing and args.pre_spawn:
        expected_missing = sorted(missing)
    elif missing:
        errors.extend(f"missing referenced page: {p}" for p in sorted(missing))

    if (project / "pages").is_dir() and not args.allow_extra_pages:
        actual = set((project / "pages").glob("*.page"))
        extra = actual - referenced
        if extra:
            errors.extend(f"stale unreferenced page: {p}" for p in sorted(str(p) for p in extra))

    types = [page_type(project / p) if (project / p).exists() else (manifest_type(manifest_by_file.get(p)) or "missing") for p in pages]
    structure_types = {"chapter", "section", "divider"}
    chapter_count = sum(1 for t in types if t in structure_types)
    max_chapters = min(2, math.ceil(len(pages) * 0.12)) if pages else 0
    if chapter_count > max_chapters:
        errors.append(f"too many chapter/divider/section pages: {chapter_count} > {max_chapters}")

    full_images = [p for p in pages if full_slide_image_like(project / p)]
    if len(full_images) > 1:
        warnings.append(f"full-slide image-like pages exceed default cap: {len(full_images)}")

    print(json.dumps({
        "pptd": str(pptd),
        "page_count": len(pages),
        "page_types": {t: types.count(t) for t in sorted(set(types))},
        "expected_missing_pre_spawn_pages": expected_missing,
        "full_slide_image_like_pages": full_images,
        "errors": errors,
        "warnings": warnings,
        "ok": not errors,
    }, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
