---
name: post-task-methodology-loop
description: 5-step post-task methodology loop — read prior methodology → execute task → write report → update methodology → next. Prevents the "rediscover from scratch" failure mode during long batch task chains. Use when the user assigns a list of homogeneous sub-tasks (test N modules, scan N pages, process N files, run N migrations) and says "一直推" / "继续推进" / "全部跑完" / "do them all", or when the agent starts re-debugging things it has already seen in this session/sessions.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# Post-Task Methodology Loop

## Why this exists

The classic agent failure on long batch task chains:
- User: "Run all 25 sub-modules"
- Agent: does module 1, makes mistakes, debugs for 30 min, finally gets it
- Agent: moves to module 2... and **re-solves the same problems from scratch**
- Agent: finishes module 25 having learned the same lesson 25 times

**The fix**: a mandatory 5-step loop after EVERY task. Treat the methodology files as a **persistent memory across sub-tasks** that the agent re-reads before each new task.

## When to use

Trigger this skill when ANY of:
- User assigns a **batch of N homogeneous sub-tasks** (N ≥ 3, same shape, possibly different targets)
- User says **"一直推" / "全部跑完" / "do them all" / "推进到全部任务干完"** without per-task checkpoints
- Agent catches itself **re-debugging something it already saw** (e.g. "wait, I just fixed this hover bug for module 3, now it's broken again on module 7")
- The user has explicitly set up a **methodology directory** (e.g. `测测测试方法论/_全局/`, `notes/_methodology/`, `docs/_playbooks/`) that the user has previously asked the agent to maintain

## When NOT to use

- Single isolated task (no batch)
- Tasks with fundamentally different shapes (each task needs its own ad-hoc approach)
- User wants speed and doesn't care about cross-task learning
- Tasks where the user wants per-task approval before proceeding

## The 5-step loop (run after EVERY task)

### 1. READ (before starting the task)
- Read the most recent methodology file(s) — e.g. `_全局/4层深度方法论.md` + `_全局/{domain}_已探索结构.md`
- Read the **previous task's report** to understand the prior result
- Read the **last 5 lines of any log** (`coordinator.log`, `tail -50 /tmp/batch.log`)
- This takes 5-10 seconds and saves 5-10 minutes of re-debugging

### 2. EXECUTE
- Run the task with the existing script/tool (don't rewrite it!)
- Use the same parameter shape (path, target, etc.) that worked before
- If a step fails, **fix the SCRIPT for the next task** — don't just patch this one invocation

### 3. WRITE REPORT
- Output goes to a stable location with consistent naming: `测试报告/{子模块名}/4层深度探索报告_v2.md` or similar
- Report structure must be **template-shaped** so all reports are diff-comparable
- Include: scope (4 layers), findings (Bugs with ID/severity), per-layer results, process data references

### 4. UPDATE METHODOLOGY
- **Add new pitfall** to the global pitfall list (坑 N+1)
- **Update the "已探索结构"** with this task's outcome (✅ done / ❌ cancel, key data: row count, button count, dialog count)
- **Add any new discovered patterns** to the playbook
- This is the MOST important step. Skip it and the loop breaks.

### 5. MARK TASK DONE + SUGGEST NEXT
- `done A001` (or equivalent state machine)
- `suggest` returns the next task automatically
- Don't batch all "done"s at the end — do it per-task so the system knows you're alive

## Anti-patterns (the failure modes this skill prevents)

1. **"I'll write the methodology at the end"** — you won't, and even if you do, it's too late for the next task
2. **"This task is so similar, I don't need to re-read"** — exactly the tasks where re-reading saves the most time
3. **"I'll fix this in the script for the next run"** — then forget; commit the fix immediately
4. **"Each task is unique, methodology won't apply"** — usually wrong; even unique findings reveal reusable patterns
5. **"Methodology is overhead, let's just go fast"** — fast on task 1, slow on tasks 2-25, breaks user trust by task 10

## How to persist methodology

The user will tell you where; common patterns:
- `测测测试方法论/_全局/{topic}.md` (4 layers + project structure + pitfalls)
- `notes/_playbooks/{domain}.md`
- `docs/_methodology/{module}.md`
- The user owns the location; respect it

Each methodology file should have at least:
- **Trigger**: when to read this file
- **Step-by-step procedure**: numbered with exact commands
- **Pitfalls section**: numbered list, "Symptom → Cause → Fix"
- **Versioning rule**: append-only, never delete old pitfalls

## Composes well with

- `self-improving-agent` — that one captures *reactive* learnings (after failures/corrections). This skill is the *proactive* per-task loop.
- `ai-todo-push` — the 4-file todo system is the data layer. This skill is the *meta-routine* on top of it.
- `web-exploratory-tester` / `srmpro-login` / domain-specific tools — these are the *tools* the loop drives.

## Minimum-viable version

If the user just says "run all 25" and there's no existing methodology:
1. After task 1: write `_methodology/{topic}.md` with whatever you learned (even if just 3 bullets)
2. After tasks 2-3: append new pitfalls to the same file
3. By task 5: the methodology is non-trivial, and tasks 6-25 are 2-3x faster than task 1

This is the **30-second-after-each-task cost** that buys you **5-10 minutes saved per future task**.

## Verifying it's working

After 5 tasks in a batch, check:
- [ ] Has the methodology file grown? (yes = good)
- [ ] Are you reusing the same script (with small fixes) vs rewriting? (reuse = good)
- [ ] Is each task's report in a consistent shape? (yes = good)
- [ ] Has the user stopped correcting you? (best signal)

If any answer is "no" → you skipped step 4. Go back and do it now.
