# -*- coding: utf-8 -*-
"""解析 .drawio 文件，提取节点/连线/文本/父级关系，输出 JSON。

用法: python parse_drawio.py <file.drawio> [--out out.json]
"""
import sys, os, json, re
import xml.etree.ElementTree as ET
from html import unescape


def clean_value(raw):
    """清理 mxCell value（HTML 标签 → 空格，保留换行语义）"""
    if not raw:
        return ""
    v = unescape(raw)
    v = v.replace("<br>", " / ").replace("<br/>", " / ").replace("<br />", " / ")
    v = re.sub(r"<[^>]+>", " ", v)  # 去其余标签
    v = re.sub(r"\s+", " ", v).strip()
    return v


def parse_drawio(path):
    tree = ET.parse(path)
    root = tree.getroot()
    pages = []
    for diag in root.findall("diagram"):
        name = diag.get("name", "未命名")
        cells = {}
        graph = diag.find("mxGraphModel/root")
        if graph is None:
            continue
        for cell in graph.findall("mxCell"):
            cid = cell.get("id")
            is_edge = cell.get("edge") == "1"
            cells[cid] = {
                "id": cid,
                "parent": cell.get("parent", ""),
                "edge": is_edge,
                "source": cell.get("source", "") if is_edge else "",
                "target": cell.get("target", "") if is_edge else "",
                "value": clean_value(cell.get("value")),
                "style": cell.get("style", ""),
            }
        # 关联连线文本：edge 的 value 为空时也可引用 source/target
        nodes = [c for c in cells.values() if not c["edge"] and c["value"]]
        edges = [c for c in cells.values() if c["edge"]]
        for e in edges:
            e["source_text"] = cells.get(e["source"], {}).get("value", "")[:60]
            e["target_text"] = cells.get(e["target"], {}).get("value", "")[:60]
        pages.append({
            "page_name": name,
            "nodes": nodes,
            "edges": edges,
        })
    return pages


def main():
    if len(sys.argv) < 2:
        print("用法: python parse_drawio.py <file.drawio> [--out out.json]")
        sys.exit(1)
    path = sys.argv[1]
    pages = parse_drawio(path)
    print(f"=== {os.path.basename(path)} 解析完成 ===")
    for pg in pages:
        print(f"\n[页面] {pg['page_name']}  节点={len(pg['nodes'])} 连线={len(pg['edges'])}")
        print("--- 节点 ---")
        for n in pg["nodes"]:
            print(f"  [{n['id']}] {n['value'][:50]!r}")
        print("--- 连线 ---")
        for e in pg["edges"]:
            print(f"  {e['source_text'][:20]!r} -> {e['target_text'][:20]!r}  label={e['value'][:20]!r}")
    if "--out" in sys.argv:
        idx = sys.argv.index("--out")
        out_path = sys.argv[idx + 1]
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(pages, f, ensure_ascii=False, indent=2)
        print(f"\nJSON 已写入: {out_path}")


if __name__ == "__main__":
    main()
