#!/usr/bin/env python3
"""
check_verbatim.py v1.0 — R10 / R11「逐字守恒」机械校验（S7 辅助工具）

## 为什么需要它

R10 要求**代码块 / 图片 / 附件链接 / 目录项 / 引号内固定文案**一律「保留不处理、
逐字原样」；R11 要求**交叉引用编号、数值+单位**等不可断行单元不得被切开。

v2.0 的机械校验里，这些约束**只被"豁免"，从未被"校验"** ——
`check_32.py` 把代码块/引号行"放过"了，但没有任何脚本确认它们**真的原样搬了过来**。
AVPL v12 全量跑实测：§3.11.3 的 `{供应商名称}` 占位符、§3.4.3 的整句固定文案，
都出现过"被改写/被切走"的情况，只能靠子智能体肉眼看出来。

本脚本用**精确串多重集比较**把这一类补上：A 稿（基准）里出现过的精确串，
B 稿（待验）里必须原样存在。**不做词频、不做模糊匹配**——因为只有"精确串消失"
才是不可争辩的 R10/R11 违反。

> 反面教材：曾尝试用「全局词频差集」做限定词扫描，AVPL 实测输出 109 条候选，
> 5 条真问题**一条都没命中**（长短语被切分后词频自然波动，信噪比极低）。
> → 词级/语义级丢失仍须由**独立子智能体**判定；本脚本只做**精确串**这一层。

## 六类校验

  V1 代码块         ``` 围栏块**逐块内容**（含 mermaid / plantuml）多重集比较
  V2 图片行         `![alt](src)`
  V3 附件链接行     `[xxx](path)`（排除目录锚点与图片）
  V4 引号内固定文案  `"…"` / `「…」` 的**完整内容串**
  V5 交叉引用        `3.13.1` 形式的编号 + `§x.y` 引用
  V6 目录章节号      目录项的**章节号集合**（如 `3.11.3`）
                     ⚠️ 只比章节号、**不比锚点串** —— Profile B 按 R1′ 缩短标题后
                       锚点必然变化，逐串比对是预期内噪声；锚点有效性由
                       `audit_list.py` 的 R7 在**同一份文件内部**校验

用法：
  python check_verbatim.py <A稿.md> <B稿.md> [--detail] [--max N]
退出码 = B 稿相对 A 稿缺失的精确串条数（0 表示通过）。
"""
import re
import sys
from collections import Counter

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# V1：``` 围栏块
FENCE_RE = re.compile(r"^```[^\n]*\n([\s\S]*?)^```", re.M)
# V2：图片
IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
# V3：链接（排除锚点与图片）
LINK_RE = re.compile(r"(?<!!)\[([^\]]+)\]\(([^)#][^)]*)\)")
# V4：引号内文案。中文弯引号与直角引号分别配对
QUOTE_RE = re.compile(r'“([^”\n]+)”|「([^」\n]+)」')
# V5：交叉引用编号与 § 引用
NUM_REF_RE = re.compile(r"\d+\.\d+(?:\.\d+)*")
SEC_REF_RE = re.compile(r"§\s*\d+(?:\.\d+)*")
# V6：目录项（**只比章节号，不比锚点串**）
#   Profile B 按 R1′ 缩短标题后锚点必然变化，逐串比对会产生大量预期内噪声；
#   锚点有效性本身由 audit_list.py 的 R7 负责（在**同一份文件内部**校验）。
TOC_LINE_RE = re.compile(r"\]\(#[^)]+\)")
TOC_NUM_RE = re.compile(r"[§#]?\s*(\d+(?:\.\d+)*)")


def load(path: str) -> str:
    return open(path, encoding="utf-8").read()


def norm_code(text: str) -> str:
    """代码块内容归一化：只去行尾空白，保留缩进与空行（mermaid 对缩进敏感）。"""
    return "\n".join(ln.rstrip() for ln in text.split("\n")).strip("\n")


def collect(text: str):
    codes = Counter(norm_code(m.group(1)) for m in FENCE_RE.finditer(text))
    imgs = Counter(IMG_RE.findall(text))
    links = Counter(f"[{m.group(1)}]({m.group(2)})" for m in LINK_RE.finditer(text))
    quotes = Counter()
    for m in QUOTE_RE.finditer(text):
        s = (m.group(1) or m.group(2)).strip()
        if s:
            quotes[s] += 1
    numrefs = Counter(NUM_REF_RE.findall(text))
    secrefs = Counter(m.group(0) for m in SEC_REF_RE.finditer(text))
    toc_nums = Counter()
    for ln in text.split("\n"):
        if TOC_LINE_RE.search(ln):
            m = TOC_NUM_RE.search(ln)
            if m:
                toc_nums[m.group(1)] += 1
    return {
        "V1 代码块": codes,
        "V2 图片行": imgs,
        "V3 附件链接": links,
        "V4 引号内固定文案": quotes,
        "V5 交叉引用编号": numrefs,
        "V5 交叉引用 §引用": secrefs,
        "V6 目录章节号": toc_nums,
    }


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    detail = "--detail" in sys.argv
    limit = 30
    if "--max" in sys.argv:
        k = sys.argv.index("--max")
        if k + 1 < len(sys.argv):
            limit = int(sys.argv[k + 1])
            args = [a for a in args if a != sys.argv[k + 1]]
    if len(args) < 2:
        print("用法: python check_verbatim.py <A稿.md> <B稿.md> [--detail] [--max N]")
        sys.exit(1)

    a_path, b_path = args[0], args[1]
    A = collect(load(a_path))
    B = collect(load(b_path))

    print("=== check_verbatim v1.0 · R10/R11 逐字守恒校验 ===")
    print(f"A（基准）: {a_path.split(chr(92))[-1].split('/')[-1]}")
    print(f"B（待验）: {b_path.split(chr(92))[-1].split('/')[-1]}")
    print()

    missing_total = 0
    for key in A:
        ca, cb = A[key], B[key]
        miss = []
        for item, cnt in ca.items():
            if cb.get(item, 0) < cnt:
                miss.append((item, cnt, cb.get(item, 0)))
        miss.sort(key=lambda r: (r[2] - r[1], -len(r[0])))
        missing_total += len(miss)
        flag = "✅" if not miss else "❌"
        print(f"{flag} {key:<20} A={sum(ca.values()):<5} B={sum(cb.values()):<5} "
              f"缺失精确串 = {len(miss)}")
        if miss and detail:
            for item, x, y in miss[:limit]:
                shown = item.replace("\n", "⏎")[:64]
                print(f"     A={x} B={y}  {shown}")
            if len(miss) > limit:
                print(f"     …（另有 {len(miss) - limit} 条，未展示）")
    print()
    if missing_total == 0:
        print("=== ✅ 通过：R10/R11 逐字守恒校验无缺失 ===")
    else:
        print(f"=== ❌ 需修正：{missing_total} 个精确串在 B 稿缺失（见上）===")
        print("=== 注意：本校验只覆盖「精确串」；限定词/否定词/语义丢失"
              "仍须由独立子智能体逐条确认 ===")
    sys.exit(0 if missing_total == 0 else missing_total)


if __name__ == "__main__":
    main()
