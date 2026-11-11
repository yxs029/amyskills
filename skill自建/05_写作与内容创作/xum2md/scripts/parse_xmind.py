# -*- coding: utf-8 -*-
"""解析 .xmind 文件，提取思维导图节点树，输出 JSON。

xmind 是 ZIP 包，现代版本内部含 content.json（结构化 JSON），旧版本含 content.xml。
此脚本优先解析 content.json，缺失则回退 content.xml。

用法: python parse_xmind.py <file.xmind> [--out out.json]
"""
import sys, os, json, zipfile
import xml.etree.ElementTree as ET


def parse_node_json(node):
    """递归解析 content.json 中的 topic 节点 → {id, title, children[]}"""
    title = node.get("title", "")
    # 兼容 title 为富文本对象的情况（部分版本 title 是 dict）
    if isinstance(title, dict):
        title = title.get("text", "")
    out = {"id": node.get("id", ""), "title": title, "children": []}
    children = node.get("children") or {}
    attached = children.get("attached") or []
    for c in attached:
        out["children"].append(parse_node_json(c))
    return out


def count_nodes(node):
    return 1 + sum(count_nodes(c) for c in node["children"])


def max_depth(node, d=1):
    return max([d] + [max_depth(c, d + 1) for c in node["children"]])


def parse_content_json(path):
    """从 content.json 解析 → sheets 列表"""
    with zipfile.ZipFile(path) as zf:
        data = json.loads(zf.read("content.json").decode("utf-8"))
    sheets = []
    for s in data:
        root_topic = s.get("rootTopic") or {}
        root = parse_node_json(root_topic)
        sheets.append({
            "sheet_name": s.get("title", "未命名"),
            "root": root,
            "node_count": count_nodes(root),
            "max_depth": max_depth(root),
        })
    return sheets


def parse_node_xml(topic):
    """递归解析 content.xml 中的 <topic> → {id, title, children[]}"""
    title = ""
    t_el = topic.find("title")
    if t_el is not None and t_el.text:
        title = t_el.text.strip()
    out = {"id": topic.get("id", ""), "title": title, "children": []}
    topics = topic.findall("children/topics/topic")
    for t in topics:
        out["children"].append(parse_node_xml(t))
    return out


def parse_content_xml(path):
    """旧版 content.xml 回退解析 → sheets 列表"""
    with zipfile.ZipFile(path) as zf:
        xml_bytes = zf.read("content.xml")
    root = ET.fromstring(xml_bytes)
    sheets = []
    for s in root.iter("sheet"):
        name = s.get("title") or s.get("name") or "未命名"
        topics = s.findall("topic")
        for t in topics:
            node = parse_node_xml(t)
            sheets.append({
                "sheet_name": name,
                "root": node,
                "node_count": count_nodes(node),
                "max_depth": max_depth(node),
            })
    return sheets


def parse_xmind(path):
    """入口：优先 content.json，缺失回退 content.xml"""
    with zipfile.ZipFile(path) as zf:
        names = set(zf.namelist())
    if "content.json" in names:
        sheets = parse_content_json(path)
    elif "content.xml" in names:
        sheets = parse_content_xml(path)
    else:
        raise FileNotFoundError("xmind 内未找到 content.json 或 content.xml")
    return {"sheets": sheets}


def main():
    if len(sys.argv) < 2:
        print("用法: python parse_xmind.py <file.xmind> [--out out.json]")
        sys.exit(1)
    path = sys.argv[1]
    data = parse_xmind(path)
    print(f"=== {os.path.basename(path)} 解析完成 ===")
    print(f"Sheet 数: {len(data['sheets'])}")
    for s in data["sheets"]:
        print(f"\n[Sheet] {s['sheet_name']}  节点={s['node_count']}  深度={s['max_depth']}")
        print("--- 节点树 ---")

        def dump(node, depth=0):
            print("  " * depth + f"[{node['id']}] {node['title'][:60]!r}")
            for c in node["children"]:
                dump(c, depth + 1)
        dump(s["root"])
    if "--out" in sys.argv:
        idx = sys.argv.index("--out")
        out_path = sys.argv[idx + 1]
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\nJSON 已写入: {out_path}")


if __name__ == "__main__":
    main()
