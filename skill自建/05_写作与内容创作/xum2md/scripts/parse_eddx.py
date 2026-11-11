# -*- coding: utf-8 -*-
"""解析 .eddx（EdrawMax）文件，提取 Shape 节点/文本/层级，输出 JSON。

eddx 是 ZIP 包，内部含 pages/page1.xml。此脚本自动解压到临时目录再解析。

用法: python parse_eddx.py <file.eddx> [--out out.json]
"""
import sys, os, json, re, tempfile, shutil, zipfile
import xml.etree.ElementTree as ET


def txt_of(shape):
    """提取 Shape 内所有 <tp> 文本（去重）"""
    parts = []
    seen = set()
    for t in shape.iter("Text"):
        for tp in t.iter():
            tag = tp.tag.split("}")[-1]
            if tag == "tp" and tp.text:
                v = tp.text.strip()
                if v and v not in seen:
                    seen.add(v)
                    parts.append(v)
            elif tp.text and tp.text.strip() and tag in ("t", "Txt"):
                v = tp.text.strip()
                if v and v not in seen:
                    seen.add(v)
                    parts.append(v)
    return " ".join(parts)


def parse_eddx(path):
    """解压 eddx，解析 page1.xml，返回节点/连线信息"""
    tmp = tempfile.mkdtemp(prefix="eddx_")
    try:
        with zipfile.ZipFile(path) as zf:
            zf.extractall(tmp)
        xml_path = os.path.join(tmp, "pages", "page1.xml")
        if not os.path.exists(xml_path):
            raise FileNotFoundError("eddx 内未找到 pages/page1.xml")
        tree = ET.parse(xml_path)
        root = tree.getroot()

        shapes = list(root.iter("Shape"))
        nodes, edges = [], []
        for s in shapes:
            sid = s.get("ID")
            typ = s.get("Type", "")
            text = txt_of(s)
            # 连线特征：MMConnector / ConnectLine / Line 类
            is_edge = typ in ("MMConnector", "ConnectLine", "Line", "Curve", "Polyline")
            item = {
                "id": sid,
                "type": typ,
                "text": text,
                "is_edge": is_edge,
            }
            if is_edge:
                # 父级（SuperLevel）与连线坐标
                ld = s.find("LevelData")
                if ld is not None:
                    sl = ld.find("SuperLevel")
                    item["super_level"] = sl.get("V") if sl is not None else None
                cp = s.find("ConPoints")
                if cp is not None:
                    for tagname in ("BeginX", "BeginY", "EndX", "EndY"):
                        el = cp.find(tagname)
                        item[tagname.lower()] = el.get("V") if el is not None else None
                edges.append(item)
            else:
                if text:
                    nodes.append(item)
        return {"shapes_total": len(shapes), "nodes": nodes, "edges": edges}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    if len(sys.argv) < 2:
        print("用法: python parse_eddx.py <file.eddx> [--out out.json]")
        sys.exit(1)
    path = sys.argv[1]
    data = parse_eddx(path)
    print(f"=== {os.path.basename(path)} 解析完成 ===")
    print(f"Shape 总数: {data['shapes_total']}  节点: {len(data['nodes'])}  连线: {len(data['edges'])}")
    print("\n--- 节点 ---")
    for n in data["nodes"]:
        print(f"  [{n['id']}] {n['type']:12s} {n['text'][:50]!r}")
    print("\n--- 连线 ---")
    for e in data["edges"]:
        print(f"  [{e['id']}] {e['type']}  super={e.get('super_level')}")
    if "--out" in sys.argv:
        idx = sys.argv.index("--out")
        out_path = sys.argv[idx + 1]
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\nJSON 已写入: {out_path}")


if __name__ == "__main__":
    main()
