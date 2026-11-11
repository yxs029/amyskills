#!/usr/bin/env python3
"""
audit_list.py v3.0 — PRD2YTlist 清单体格式体检（**机械可判定**部分）

职责边界（务必与 check_32.py 分工，避免双口径）：
  audit_list.py → **结构**（标签 / 层级 / 锚点 / 表格 / 标记统计）
  check_32.py   → **字数**（Profile B 逐行 ≤32，含 R10 豁免）

检查项：
  R1 标题不加粗
  R2 一级点浓缩标签
       · Profile A：一级点须为 `- **标签**：内容`（纯短句 ≤12 字或目录项豁免）
       · Profile B：增补「标签 ≤8 字」——`- **标签**：内容` 且标签 ≥9 字时，标签须单独成行
  R3 分级字数（**仅 Profile A**，软约束：速读卡 ≤50 / 正文点 ≤150）
       Profile B 的字数判定由 scripts/check_32.py 负责（含 R10 豁免），本脚本不判
  R4 标记统计（有序行 / 无序行，供 A+B 人工复核，不判违规）
  R5 表格判据
       · Profile A：文档元信息表无条件保留；其余表任一单元格 >50 字 → 提示转清单体
       · Profile B（v3.1 口径）：**正文表格一律照抄，不判单元格字数**。
         表格与图片 / 代码块同级 —— 属「原样搬运」对象，单元格 >32 字**不计入问题**，
         仅作**提示**输出。理由是正文表格承载列结构与行列对应关系，为救个别超长
         单元格而拆整张表会破坏结构，代价远大于收益。
         例外：底部「**待办事项**」「**名词解释**」两张表**须转清单体** ——
         转换后已不是表格，其行由 check_32.py 按常规 32 字约束，本脚本不另判。
  R6 层级深度
       · Profile A：≤3 合规 / **4 容忍（提示，不计入问题总数）** / >4 违规
       · Profile B：**≤4 合规** / >4 违规
  R7 锚点有效性（目录锚点 vs 标题生成锚点）
  R9 冒号后并列描述宜拆二级（**建议项，不计入问题总数**；仅 Profile A）

档位（--profile）：
  a（默认）标准清单体，正文点 ≤150 字（软）
  b        32 字扫读版，单行 ≤32 字（硬）—— 字数交 check_32.py，本脚本只判结构

用法：
  python audit_list.py <清单体文件> [文件2 ...] [--profile a|b] [--detail]
"""
import re
import sys

try:  # Windows 控制台默认 GBK，强制 UTF-8 输出
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

CJK = r"\u4e00-\u9fff\u3400-\u4dbf"

# 一级点「纯交叉引用短句」豁免 R2 的字数门槛
SHORT_POINT_EXEMPT = 12
# Profile A 表格单元格转清单体的触发阈值
CELL_LIMIT_A = 50
# 两个档位的单行上限（仅用于 R5 单元格判定）
CELL_LIMIT_B = 32


def anchor_of(heading: str) -> str:
    """按 GitHub 风格由标题生成锚点（小写 → 去标点 → 空格转连字符）。"""
    s = heading.strip().lower()
    s = re.sub(r"[`*_]", "", s)          # 去 markdown 标记
    s = s.replace(" ", "-")              # 空格转连字符
    out = []
    for ch in s:
        if ch == "-" or ch.isalnum():
            out.append(ch)
        elif re.match(f"[{CJK}]", ch):
            out.append(ch)
    return "".join(out)


def visible_len(text: str) -> int:
    """可见字符数 = 去列表标记 → 去 markdown 标记 → 去链接 URL（保留链接文字）。

    ⚠️ v3.0 修复：v2.x 用 `^[-\\d.\\sa-zA-Z]+` 剥前缀，会把行首英文单词
    （如 `**ASL 推送状态**：…` 的 `ASL `）一并剥掉，导致 Profile A 的 R3
    字数**系统性低估**。本版只剥真正的列表标记 `- ` / `1. `。
    """
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text.strip())   # [文字](url) -> 文字
    t = re.sub(r"[`*]", "", t)
    t = re.sub(r"^(?:[-+]\s+|\d+\.\s+)", "", t)                  # 只剥列表标记
    return len(t.strip())


def limit_of(section: str, profile: str) -> int:
    """按档位返回**单行**字数上限（仅 Profile A 用）。"""
    if profile == "b":
        return CELL_LIMIT_B
    return 50 if "速读卡" in section else 150


def cells_of(row: str) -> list:
    """拆表格行为单元格可见文本列表。"""
    s = row.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def is_sep_row(row: str) -> bool:
    """表格对齐行 `| --- | --- |`。"""
    return bool(re.match(r"^\s*\|[\s:\-|]+\|\s*$", row))


def audit(path: str, detail: bool = True, profile: str = "a"):
    lines = open(path, encoding="utf-8").read().split("\n")

    issues = []          # 计入问题总数
    advice = []          # 提示 / 建议，不计入问题总数
    headings = []
    in_fence = False
    section = "（文件头）"
    ordered = unordered = 0
    anchors_used = []
    prev_nonempty = ""   # 表格块前的最近一行非空文本（判定是否元信息表）

    # 预收集标题（用于锚点校验）
    for i, ln in enumerate(lines):
        m = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if m:
            headings.append((i + 1, m.group(2).strip()))
    heading_anchors = {anchor_of(h) for _, h in headings}

    i = 0
    while i < len(lines):
        ln = lines[i]
        n = i + 1

        # ---- 代码块开关（整块跳过） ----
        if ln.strip().startswith("```"):
            in_fence = not in_fence
            i += 1
            continue
        if in_fence:
            i += 1
            continue

        # ---- R5 表格块（整体处理） ----
        if ln.strip().startswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append((i + 1, lines[i]))
                i += 1
            is_meta = "元信息" in prev_nonempty or "元信息" in section
            body_rows = [(k, r) for k, r in block if not is_sep_row(r)]
            if profile == "b":
                # Profile B（v3.1）：正文表格**照抄不判** —— 表格与图片 / 代码块同级，
                # 属「原样搬运」对象，单元格 >32 字**不计入问题**（避免为救个别单元格
                # 而拆掉整张表、丢失列结构与行列对应关系）。
                # 仅作**提示**输出，供人工判断是否为底部「待办事项 / 名词解释」表
                # （该两张表须转清单体，转后由 check_32.py 按 32 字常规约束）。
                over = []
                for k, r in body_rows:
                    for c in cells_of(r):
                        if visible_len(c) > CELL_LIMIT_B:
                            over.append((k, c))
                if over:
                    advice.append((
                        "R5", over[0][0], section,
                        f"表格含 {len(over)} 个 >32 字单元格（正文表格照抄即可；"
                        f"仅「待办事项 / 名词解释」表须转清单体）",
                        over[0][1][:50]))
            else:
                # Profile A：元信息表无条件保留；其余表任一单元格 >50 → 提示
                if not is_meta:
                    over = [c for _, r in body_rows
                            for c in cells_of(r) if visible_len(c) > CELL_LIMIT_A]
                    if over:
                        advice.append((
                            "R5", body_rows[0][0], section,
                            f"表格 {len(over)} 个单元格 >50 字 → 宜转清单体",
                            over[0][:46]))
            continue

        if not ln.strip():
            i += 1
            continue
        prev_nonempty = ln.strip()

        # ---- 当前小节 ----
        m = re.match(r"^#{1,6}\s+(.*)$", ln)
        if m:
            section = m.group(1).strip()

        # ---- R1 标题不加粗 ----
        if m and "**" in m.group(1):
            issues.append(("R1", n, section, "标题内出现加粗", ln.strip()[:60]))

        # ---- 引用块：整段跳过（豁免编号与字数） ----
        if ln.strip().startswith(">"):
            i += 1
            continue

        # ---- 提取锚点 ----
        for a in re.findall(r"\]\(#([^)]+)\)", ln):
            anchors_used.append((n, a))

        # ---- 列表行 ----
        mo = re.match(r"^(\s*)(\d+)\.\s+(.*)$", ln)
        mu = re.match(r"^(\s*)-\s+(.*)$", ln)
        if mo or mu:
            if mo:
                ordered += 1
                indent, body = len(mo.group(1)), mo.group(3)
                is_ordered = True
            else:
                unordered += 1
                indent, body = len(mu.group(1)), mu.group(2)
                is_ordered = False
            level = 1 + indent // 2
            vl = visible_len(body)
            is_toc = "](#" in ln
            has_label = bool(re.match(r"^\*\*[^*]+\*\*", body))
            label_text = ""
            if has_label:
                label_text = re.match(r"^\*\*([^*]+)\*\*", body).group(1)

            # R3（仅 Profile A；Profile B 交 check_32.py）
            if profile == "a" and not is_toc:
                limit = limit_of(section, profile)
                if vl > limit:
                    kind = "有序点" if is_ordered else "无序点"
                    issues.append(("R3", n, section,
                                   f"{kind} L{level} 超限 {vl}>{limit}",
                                   body[:50]))

            # R6 层级
            if profile == "b":
                if level > 4:
                    issues.append(("R6", n, section,
                                   f"嵌套层级 {level} > 4（硬上限）", body[:40]))
            else:
                if level > 4:
                    issues.append(("R6", n, section,
                                   f"嵌套层级 {level} > 4（硬上限）", body[:40]))
                elif level > 3:
                    # v3.0：Profile A 的 L4 为「容忍」，改为提示，不计入问题总数
                    advice.append(("R6", n, section,
                                   f"嵌套层级 {level}（容忍上限，建议收窄）",
                                   body[:40]))

            # R2 一级点浓缩标签
            if level == 1 and not is_toc:
                if not re.match(r"^\*\*[^*]+\*\*.*[：:]", body):
                    if len(body) > SHORT_POINT_EXEMPT:
                        issues.append(("R2", n, section,
                                       "一级点缺浓缩标签", body[:50]))
                elif profile == "b" and len(label_text) >= 9:
                    # Profile B：标签 ≥9 字 → **提示**（建议单独成行）
                    # 硬约束只由 32 字上限承担：整行 ≤32 时不判违规，只提示；
                    # 整行 >32 时由 check_32.py 报超限，那时才「必须」改。
                    rest = body.split("**", 2)[-1]
                    rest = re.sub(r"^[：:]\s*", "", rest).strip()
                    if rest:
                        advice.append((
                            "R2", n, section,
                            f"标签 {len(label_text)} 字 ≥9（建议单独成行）",
                            body[:50]))

            # R9 建议（仅 Profile A）：冒号后含「；」并列描述 → 宜拆二级
            if profile == "a" and level == 1 and not is_toc and "速读卡" not in section:
                m_lbl = re.match(r"^\*\*[^*]+\*\*[：:](.*)$", body)
                if m_lbl:
                    q = m_lbl.group(1).count("；")
                    if q >= 2 or (q == 1 and vl >= 80):
                        advice.append(("R9", n, section,
                                       f"含 {q} 个「；」→ 宜拆为二级子点",
                                       body[:46]))

        i += 1

    # ---- R7 锚点校验 ----
    for n, a in anchors_used:
        if a not in heading_anchors:
            issues.append(("R7", n, "—", f"失效锚点 #{a}", ""))

    # ---- 汇总 ----
    print(f"=== {path.split(chr(92))[-1].split('/')[-1]} ===  [Profile {profile.upper()}]")
    print(f"标题数: {len(headings)}   有序行: {ordered}   无序行: {unordered}")
    by_rule = {}
    for r, *_ in issues:
        by_rule[r] = by_rule.get(r, 0) + 1
    print("问题分布: " + (", ".join(f"{k}={v}" for k, v in sorted(by_rule.items())) or "无"))
    print(f"问题总数: {len(issues)}")
    if advice:
        by_adv = {}
        for r, *_ in advice:
            by_adv[r] = by_adv.get(r, 0) + 1
        print(f"提示/建议: {len(advice)} 项（不计入问题总数）  "
              + ", ".join(f"{k}={v}" for k, v in sorted(by_adv.items())))
        if detail:
            for r, n, sec, desc, sample in advice:
                print(f"  [{r}] L{n:<4} {sec[:22]:<24} {desc}")
                if sample:
                    print(f"        └ {sample}")
    if issues and detail:
        print("-" * 70)
        for r, n, sec, desc, sample in issues:
            print(f"[{r}] L{n:<4} {sec[:22]:<24} {desc}")
            if sample:
                print(f"        └ {sample}")
    return len(issues)


if __name__ == "__main__":
    args = sys.argv[1:]
    detail = "--detail" in args
    profile = "a"
    if "--profile" in args:
        i = args.index("--profile")
        if i + 1 < len(args):
            profile = args[i + 1].strip().lower()
        args = args[:i] + args[i + 2:]
    if profile not in ("a", "b"):
        print(f"未知档位 --profile {profile}（应为 a 或 b）")
        sys.exit(2)
    files = [a for a in args if not a.startswith("--")]
    if not files:
        print("用法: python audit_list.py <文件1> [文件2] ... [--profile a|b] [--detail]")
        sys.exit(1)
    total = 0
    for f in files:
        total += audit(f, detail=detail, profile=profile)
        print()
    print(f"=== 合计问题数: {total} ===")
