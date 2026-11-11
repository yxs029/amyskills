#!/usr/bin/env python3
"""
check_32.py v3.0 — PRD2YTlist Profile B（32 字扫读版）逐行字数体检

职责边界（务必与 audit_list.py 分工，避免双口径）：
  check_32.py               → **字数**（逐行 ≤32，含 R10 豁免）
  audit_list.py --profile b → **结构**（R2 标签 / R5 表格 / R6 层级 / R7 锚点）

计数口径（R3′，与 SKILL.md 写死的公式一致）：
  可见字数 = 原始行
           → 去行首缩进
           → 去列表标记（"- " 或 "1. "）
           → 去 markdown 标记（"**"、"`"）
           → 去链接 URL（保留链接文字）
           → 剩余字符数
  中文 / 英文 / 数字 / 符号各按 1 字；**空格计入**。

豁免（R10，不计入 32 字约束，单独统计）：
  - 代码块内容（mermaid / plantuml 等源码）
  - 目录项（含 `](#` 的行）
  - 表格行（以 `|` 开头）—— ⚠️ 已保留表格的**单元格 ≤32** 由
    `audit_list.py --profile b` 的 R5 负责，本脚本不再重复判定
  - 一级标题行（`# ` 开头）；**其余标题（`## `~`###### `）仍计入**
  - 图片行（`![...]`）
  - 附件链接行（整行为 `[...]()` 链接）
  - 整行引号固定文案（**见下方严格口径**）

★ 引号豁免的严格口径（2026-09-17 AVPL 全量跑实测补充）：
  必须同时满足三条才豁免 ——
    ① 可见文本**首字符**是 `"` `「` `『`
    ② **末字符**是配对的 `"` `」` `』`（其后可跟一个句末标点 `。.！!？?`）
    ③ **去掉首尾引号后的中间部分不得再出现任何引号**
  实测反例：`- "已取消优势价格…执行"。`
    → 末位是 `。`，剥掉首尾后中间仍含结束引号 `"` → **不豁免** → 报 34 字。
    → 修正方式：去掉句末 `。`（或让引号成为整行末尾）后即豁免。
  → 推论（重要）：**Profile B 的长固定文案必须独占一行**
    （写成 `      - "……"`）；`文案：` / `提示：` / `弹窗文案：` 等前缀
    一律不能与引号同行，否则前缀会计入 32 字。

★ 引用块（`> `）**不在豁免清单内**：
  `visible()` 只剥行首缩进与列表标记，**不剥 `> `**，故 `> ` 的 2 个字符
  计入 32 字。长引用块须拆成多行 `> `，或转成 `- **标签**：` 清单体。

用法：
  python check_32.py <文件> [--detail] [--stats]
        --stats 额外输出行长分布与 ≤16 字短行清单（S6 切分时定位"合并候选"用）
"""
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

LIMIT = 32

# 整行引号固定文案：首尾引号配对，且中间不再出现引号（允许句末标点）
QUOTE_RE = re.compile(r'^["「『][\s\S]*["」』][。.！!？?]?$')


def visible(text: str) -> str:
    """去掉列表标记与 markdown 标记，返回可见文本。"""
    t = re.sub(r"^\s*", "", text)
    t = re.sub(r"^(?:[-*+]\s+|\d+\.\s+)", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)   # 链接 -> 文字
    t = re.sub(r"[*`]", "", t)
    return t.strip()


def check(path: str, detail: bool = False, stats: bool = False) -> int:
    lines = open(path, encoding="utf-8").read().split("\n")

    bad = []
    bad_bold = []
    counted_lines = []
    exempt = {"code": 0, "toc": 0, "table": 0, "h1": 0,
              "img": 0, "attach": 0, "quote": 0}
    counted = 0
    in_fence = False
    quote_block_lines = 0      # 引用块行数（**不豁免**，仅提示用）

    for i, ln in enumerate(lines):
        n = i + 1
        s = ln.strip()

        if s.startswith("```"):
            in_fence = not in_fence
            exempt["code"] += 1
            continue
        if in_fence:
            exempt["code"] += 1
            continue
        if not s:
            continue
        if "](#" in ln:
            exempt["toc"] += 1
            continue
        if s.startswith("|"):
            exempt["table"] += 1
            continue
        if s.startswith("# ") and not s.startswith("## "):
            exempt["h1"] += 1
            continue
        if "![" in s:
            exempt["img"] += 1
            continue
        if s.startswith(">"):
            quote_block_lines += 1

        body = visible(ln)
        # 附件链接行：整行为 link，或 link 后仅剩标点
        if re.match(r"^\[[^\]]*\]\([^)]*\)[。.；;]?$", body):
            exempt["attach"] += 1
            continue
        # 整行引号固定文案（R10）
        if len(body) > LIMIT and QUOTE_RE.match(body) \
                and body[1:-1].find(body[0]) < 0:
            exempt["quote"] += 1
            continue

        # R12 准则 3：** 加粗不可跨行（行内 ** 计数为奇数 = 未闭合）
        if ln.count("**") % 2 == 1:
            bad_bold.append((n, ln.strip()))

        counted += 1
        v = body
        counted_lines.append((n, len(v), v))
        if len(v) > LIMIT:
            bad.append((n, len(v), v))

    print(f"=== {path.split(chr(92))[-1].split('/')[-1]} ===")
    print(f"计数行数: {counted}   超限: {len(bad)}   加粗跨行: {len(bad_bold)}")
    print("豁免统计: " + ", ".join(f"{k}={v}" for k, v in exempt.items()))
    if quote_block_lines:
        print(f"提示: 引用块 {quote_block_lines} 行 —— **不在豁免清单内**，"
              f"已按普通行计入 32 字（`> ` 的 2 字符也计入）")
    if bad_bold:
        print("-" * 70)
        for n, v in bad_bold:
            print(f"[加粗跨行] L{n:<5} {v[:60]}")
    if bad:
        print("-" * 70)
        for n, L, v in bad:
            print(f"[超限] L{n:<5} {L} 字")
            print(f"        └ {v}")
    if stats and counted_lines:
        lens = sorted(L for _, L, _ in counted_lines)
        print("-" * 70)
        print(f"可见字数: 最短 {lens[0]} / 平均 {sum(lens) // len(lens)} / "
              f"中位 {lens[len(lens) // 2]} / 最长 {lens[-1]}")
        short = [(n, L, v) for n, L, v in counted_lines if L <= 16]
        print(f"≤16 字的短行: {len(short)} 行（合并候选）")
        frag = [(n, L, v) for n, L, v in counted_lines
                if v.endswith(("、", "，", "；", "："))]
        print(f"以「、，；：」结尾的碎片行: {len(frag)} 行（句子被切断处）")
        for n, L, v in short[:40]:
            print(f"  L{n:<5} {L:>3} 字  {v[:46]}")
    return len(bad) + len(bad_bold)


if __name__ == "__main__":
    detail = "--detail" in sys.argv
    stats = "--stats" in sys.argv
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not files:
        print("用法: python check_32.py <文件> [--detail] [--stats]")
        sys.exit(1)
    total = 0
    for f in files:
        total += check(f, detail, stats)
        print()
    print(f"=== 合计超限行数: {total} ===")
