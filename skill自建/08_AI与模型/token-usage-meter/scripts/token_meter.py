#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
token_meter.py — 路线A：基于 Hermes state.db 的 token 用量计量（零侵入）

原理：sessions 表的 input/output/cache_read tokens 与 api_call_count 在会话进行中
即实时累加。在每个"最小循环单元"开始/结束时各读一次快照做差分，即得单元级精确用量。

子命令：
  snapshot   读某会话当前累计（不写账），用于自查
  start      单元开始埋点（监控点）：记基线
  end        单元结束埋点（监控点）：与最近 start 差分，落一条单元账
  session    汇总一个/多个会话（项目级精确）
  turns      按 user turn 切分单个会话（历史会话，字符占比分摊，标[估算]）
  project    聚合某 project 下所有已埋点单元（复盘点）
  ledger     查看原始账本

通用参数：--db（默认 ~/.hermes/state.db）；--session 可用 auto（当前进行中的非cron会话）。
"""
import argparse, json, os, sqlite3, sys, time

DB = os.path.expanduser("~/.hermes/state.db")
LEDGER_DIR = os.path.expanduser("~/.hermes/token_meter")
LEDGER = os.path.join(LEDGER_DIR, "ledger.jsonl")
FIELDS = ["input_tokens", "output_tokens", "cache_read_tokens",
          "cache_write_tokens", "reasoning_tokens", "api_call_count"]

def conn(db):
    c = sqlite3.connect(db); c.row_factory = sqlite3.Row; return c

def auto_session(c):
    r = c.execute("""SELECT id FROM sessions
        WHERE ended_at IS NULL AND id NOT LIKE 'cron_%'
        ORDER BY started_at DESC LIMIT 1""").fetchone()
    return r["id"] if r else None

def read_totals(c, sid):
    r = c.execute("""SELECT id,title,model,input_tokens,output_tokens,
        cache_read_tokens,cache_write_tokens,reasoning_tokens,api_call_count,
        message_count,tool_call_count,started_at,ended_at
        FROM sessions WHERE id=?""", (sid,)).fetchone()
    if not r:
        sys.exit(f"会话不存在：{sid}")
    return dict(r)

def now(): return time.time()

def append(rec):
    os.makedirs(LEDGER_DIR, exist_ok=True)
    rec["ts"] = now()
    with open(LEDGER, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")

def fmt(n): return f"{n:,}" if isinstance(n, int) else str(n)

# ---------- 子命令 ----------
def cmd_snapshot(a):
    c = conn(a.db); sid = a.session
    if sid == "auto": sid = auto_session(c)
    t = read_totals(c, sid)
    print(json.dumps({k: t[k] for k in ["id"]+FIELDS}, ensure_ascii=False, indent=1))

def cmd_start(a):
    c = conn(a.db); sid = a.session
    if sid == "auto": sid = auto_session(c) or sys.exit("找不到进行中的会话")
    t = read_totals(c, sid)
    rec = {"phase": "start", "session": sid, "project": a.project,
           "unit_type": a.unit_type, "tag": a.tag, "model": t["model"]}
    for k in FIELDS: rec[k.replace("_tokens", "")] = t[k]
    append(rec)
    print(f"[start] {a.project or '-'} / {a.unit_type} / {a.tag} @ {sid[-6:]}  "
          f"in={t['input_tokens']} cacheR={t['cache_read_tokens']} api={t['api_call_count']}")

def cmd_end(a):
    c = conn(a.db); sid = a.session
    if sid == "auto": sid = auto_session(c) or sys.exit("找不到进行中的会话")
    t = read_totals(c, sid)
    # 找最近一条未闭合 start（同 session+tag；tag 省略则取该会话最近 start）
    starts = []
    if os.path.exists(LEDGER):
        for line in open(LEDGER, encoding="utf-8"):
            try: r = json.loads(line)
            except: continue
            if r.get("phase") == "start" and r.get("session") == sid:
                if a.tag is None or r.get("tag") == a.tag:
                    starts.append(r)
    if not starts:
        sys.exit("没有匹配的 start 埋点，请先 start")
    s = starts[-1]
    key = lambda k: k.replace("_tokens", "")
    delta = {k: (t[k] or 0) - (s.get(key(k)) or 0) for k in FIELDS}
    total = delta["input_tokens"] + delta["output_tokens"] + \
            delta["cache_read_tokens"] + delta["cache_write_tokens"] + delta["reasoning_tokens"]
    rec = {"phase": "unit", "session": sid, "project": s.get("project"),
           "unit_type": s.get("unit_type"), "tag": s.get("tag"),
           "model": t["model"], "dur_s": round(now() - s["ts"], 1), **delta,
           "total_tokens": total}
    append(rec)
    print(f"[unit] {rec['project'] or '-'} / {rec['unit_type']} / {rec['tag']}")
    print(f"  total={fmt(total)} in={fmt(delta['input_tokens'])} out={fmt(delta['output_tokens'])} "
          f"cacheR={fmt(delta['cache_read_tokens'])} api={delta['api_call_count']} {rec['dur_s']}s")

def cmd_session(a):
    c = conn(a.db)
    ids = []
    for s in a.sessions:
        ids.append(auto_session(c) if s == "auto" else s)
    agg = {k: 0 for k in FIELDS}; grand = 0
    rows = []
    for sid in ids:
        t = read_totals(c, sid)
        tot = sum((t[k] or 0) for k in FIELDS)
        grand += tot
        for k in FIELDS: agg[k] += (t[k] or 0)
        rows.append((sid, t, tot))
    print("# 会话级 token 用量（精确，来自网关累计）\n")
    for sid, t, tot in rows:
        print(f"- **{sid[-6:]}** {t['title'] or ''}  model={t['model']}")
        print(f"  - 总量 {fmt(tot)} ｜ 输入 {fmt(t['input_tokens'])} ｜ 输出 {fmt(t['output_tokens'])} "
              f"｜ 缓存读 {fmt(t['cache_read_tokens'])} ｜ 缓存写 {fmt(t['cache_write_tokens'])} "
              f"｜ 推理 {fmt(t['reasoning_tokens'])}")
        print(f"  - API调用 {t['api_call_count']} ｜ 消息 {t['message_count']} ｜ 工具调用 {t['tool_call_count']}")
    print(f"\n**合计 {len(ids)} 会话：总量 {fmt(grand)}**")
    print(f"- 输入 {fmt(agg['input_tokens'])} ｜ 输出 {fmt(agg['output_tokens'])} "
          f"｜ 缓存读 {fmt(agg['cache_read_tokens'])} ｜ 缓存写 {fmt(agg['cache_write_tokens'])} "
          f"｜ 推理 {fmt(agg['reasoning_tokens'])} ｜ API {agg['api_call_count']}")

def cmd_turns(a):
    # 历史会话最小单元近似：按 user 消息切 turn，用 assistant 输出字符占比分摊会话总量
    c = conn(a.db); sid = a.session
    if sid == "auto": sid = auto_session(c)
    t = read_totals(c, sid)
    msgs = c.execute("""SELECT id,role,timestamp,length(content) L,
        (length(tool_calls)) TC FROM messages WHERE session_id=? ORDER BY id""", (sid,)).fetchall()
    bounds = [i for i,m in enumerate(msgs) if m["role"] == "user"]
    bounds.append(len(msgs))
    turns = []
    for bi in range(len(bounds)-1):
        lo, hi = bounds[bi], bounds[bi+1]
        seg = msgs[lo:hi]
        w = sum((m["L"] or 0) for m in seg) + sum((m["TC"] or 0) for m in seg)
        ntool = sum(1 for m in seg if m["role"] == "tool")
        turns.append((w, ntool, len(seg)))
    wsum = sum(x[0] for x in turns) or 1
    print(f"# 会话 {sid[-6:]} 按 user-turn 切分（共 {len(turns)} 个循环单元，[估算]按内容占比分摊）\n")
    tin = t["input_tokens"] or 0; tout = t["output_tokens"] or 0; tcr = t["cache_read_tokens"] or 0
    for i,(w,ntool,nm) in enumerate(turns, 1):
        ratio = w/wsum
        print(f"- 单元{i}: 总量≈{fmt(int((tin+tout+tcr)*ratio))} "
              f"in≈{fmt(int(tin*ratio))} out≈{fmt(int(tout*ratio))} cacheR≈{fmt(int(tcr*ratio))} "
              f"｜工具{ntool} 消息{nm}  [估算]")

def cmd_project(a):
    if not os.path.exists(LEDGER): sys.exit("账本为空")
    units = []
    for line in open(LEDGER, encoding="utf-8"):
        try: r = json.loads(line)
        except: continue
        if r.get("phase") == "unit" and r.get("project") == a.project:
            units.append(r)
    if not units: sys.exit(f"项目 {a.project} 无单元账")
    agg = {k: 0 for k in FIELDS}; gt = 0; dur = 0
    by_type = {}
    for u in units:
        for k in FIELDS: agg[k] += u.get(k, 0)
        gt += u.get("total_tokens", 0); dur += u.get("dur_s", 0)
        d = by_type.setdefault(u["unit_type"], {"n":0,"total":0})
        d["n"] += 1; d["total"] += u.get("total_tokens", 0)
    print(f"# 项目「{a.project}」token 复盘（{len(units)} 个最小循环单元）\n")
    for ty, d in sorted(by_type.items(), key=lambda x:-x[1]["total"]):
        print(f"- **{ty}**：{d['n']} 次，合计 {fmt(d['total'])}，单元均耗 {fmt(int(d['total']/d['n']))}")
    print(f"\n**项目总量 {fmt(gt)}**")
    print(f"- 输入 {fmt(agg['input_tokens'])} ｜ 输出 {fmt(agg['output_tokens'])} "
          f"｜ 缓存读 {fmt(agg['cache_read_tokens'])} ｜ 缓存写 {fmt(agg['cache_write_tokens'])} "
          f"｜ API {agg['api_call_count']} ｜ 总耗时 {round(dur)}s")

def cmd_ledger(a):
    if not os.path.exists(LEDGER): print("(空)"); return
    for line in open(LEDGER, encoding="utf-8"):
        line = line.strip()
        if a.project and f'"{a.project}"' not in line: continue
        print(line)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    sub = ap.add_subparsers(dest="cmd", required=True)
    def common(p, tag=False):
        p.add_argument("--session", default="auto")
        p.add_argument("--project", default="")
        p.add_argument("--unit-type", default="generic")
        if tag: p.add_argument("--tag")
        else: p.add_argument("--tag", default=None)
    common(sub.add_parser("start"), True)
    common(sub.add_parser("end"))
    sp = sub.add_parser("snapshot"); sp.add_argument("--session", default="auto")
    se = sub.add_parser("session"); se.add_argument("sessions", nargs="+")
    st = sub.add_parser("turns"); st.add_argument("--session", default="auto")
    pr = sub.add_parser("project"); pr.add_argument("project")
    le = sub.add_parser("ledger"); le.add_argument("--project", default="")
    a = ap.parse_args()
    {"snapshot":cmd_snapshot,"start":cmd_start,"end":cmd_end,"session":cmd_session,
     "turns":cmd_turns,"project":cmd_project,"ledger":cmd_ledger}[a.cmd](a)

if __name__ == "__main__":
    main()
