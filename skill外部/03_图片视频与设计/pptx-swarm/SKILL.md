---
name: pptx-swarm
description: >-
  Create new editable PowerPoint/PPT/PPTX slide decks using the PPTD swarm
  workflow. Use when the user asks to make a PPT, PPTX, presentation, slide deck,
  research seminar deck, business deck, proposal, report deck, course deck, or
  slides from PDFs, documents, data, or web research. This skill is for creating
  new editable PPTX decks, not for editing, reading, or reverse-converting
  existing PPT/PPTX files.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。


# Definition
The pptx skill is responsible for generating and creating PPTX presentations. This skill defines an intermediate layer (with the .pptd extension) that further abstracts OOXML, making presentation generation effortless.

This skill is self-contained. It physically contains the required `format/`, `guideline/`, `scripts/`, and `zh/` files. Do not depend on another skill directory at runtime.

# .pptd Format
- The .pptd format is a simplified abstraction layer over OOXML, based on YAML syntax, designed specifically for AI to read and write presentations. This abstraction retains the core content of OOXML (themes, page layouts, element positions and definitions, etc.) while removing complex nested logic such as Masters, making each page self-contained and WYSIWYG.
- Usage: Follow the instructions below and use the CLI tools to convert .pptd files into .pptx files. Users can then open the .pptx file directly.
- Read format/pptd.md for the detailed definition of the .pptd format.

# PPTX Generation
When the user requests: creating a PPT / converting a document to PPT / recreating an image or website as a PPT / creating a PPT in a reference style, read guideline/generate_slides.md for more guidance.

# PPTX Delivery
After the PPTD presentation is complete, you **must** use the built-in checker to verify the file and ensure there are no format errors or unexpected overflow issues. After all issues are fixed, the main agent can use the following CLI command to convert the .pptd file into a .pptx file and deliver it to the user:

```bash
scripts/convert.sh input.pptd -o output.pptx
```

**Note: Since sub-agents usually only work on part of the .page files, the project is incomplete at that stage. Therefore, conversion is a final integration step run by the main agent after all .page files have been created and checked. It is strictly prohibited to convert and deliver the file immediately after a sub-agent completes only part of the .page files!**

# Skill File Tree

```
skill/
├── SKILL.md                        ← This file (skill entry point)
├── format/                         → PPTD format specification
│   ├── pptd.md                     → PPTD full specification
│   ├── shapes.md                   → Complete shape list
│   └── fonts.md                    → Available font list
├── guideline/                      → Workflow guidelines
│   ├── generate_slides.md          → Presentation generation
│   ├── content/                    → Content design modes
│   │   ├── outline_mode.md         → Outline mode
│   │   ├── summary_mode.md         → Summary mode
│   │   └── search_mode.md          → Search mode
│   ├── design/                     → Visual design modes
│   │   ├── creative_mode.md        → Creative mode
│   │   ├── reference_mode.md       → Reference/replication mode
│   │   └── profiles/               → Scene style presets
│   ├── subagent/                   → Sub-agent guidelines
│   │   ├── attention.md            → Sub-agent notes
│   │   ├── search_writing.md       → Search writing guide
│   │   ├── summary_writing.md      → Summary writing guide
│   │   └── qa_review.md            → QA agent review guide
│   └── search/                     → Search guidelines
│       └── text_search.md          → Information search
└── scripts/                        → Scripts and source code
    ├── convert.sh                  → PPTD → PPTX conversion script
    ├── check.sh                    → PPTD checker (format validation + overflow/occlusion detection)
    ├── pptd_guard.py               → Guard for workdir, page_manifest, and .pptd/page integrity
    ├── pptd_layout_lint.py         → Optional advisory static layout diagnostics
    ├── pptx_repair_gate.py         → Post-render judge gate to produce slide-level repair plans
    ├── requirements.txt            → Python dependencies to install when installing the skill
    └── pptd_dsl.pyz                → Bundled PPTD checker/converter runtime
└── references/
    └── layout-quality.md           → Optional advisory QA checklist
```

# ATTENTION

## Basic Guidelines
1. Scope of operations: Directly operating on .pptx files is strictly prohibited. All your operations should apply to .pptd files, then use the CLI tools to convert .pptd to .pptx.
2. File dependency awareness: .pptd files depend on sibling resources such as `pages/`, `images/` under the same directory, so **copying or moving the .pptd file alone is strictly prohibited**. If relocation is required, the entire directory must be migrated together — otherwise the CLI conversion tool will fail.
3. Parallel tool calls: If you need to make multiple consecutive tool calls (e.g., generating multiple .page files in sequence; making multiple edit tool calls to modify different locations in the same file, etc.), you should make multiple parallel tool calls in a single output, rather than making separate thinking-toolcall, thinking-toolcall rounds. This avoids context redundancy caused by multiple rounds of output.
4. When the user requests creating multiple presentations, **you must adopt a generate-all-first, then check-one-by-one strategy!** That is: serially complete the creation or modification of each PPT (including .page files and .pptd files), and only proceed to unified checking, fixing, and delivery after all presentations are created. **Never complete one PPT and immediately check, fix, and deliver it before creating the next PPT**.
5. Slide count is not a downgrade rule: once this `pptx-swarm` skill is selected, **do not switch to the non-swarm `pptx` skill merely because the deck has fewer slides**. The main agent still owns visual design, outline design, and `.pptd` construction; slide count only affects how many `.page` files or sub-agent batches are assigned. For normal decks, plan real page-agent handoffs and use multiple small agents when pages can be split coherently.

## Additional Rules
6. Workdir isolation: create one clean, unique project directory for every deck. Never use a shared batch root, `DELIVERY`, or a previous run directory as the active project directory. When inside a batch directory, create a child directory named for the deck.
7. Required project shape before page production:
   ```
   <ppt-dir>/
   ├── design.md
   ├── outline.md
   ├── page_manifest.json
   ├── <deck>.pptd
   ├── pages/
   ├── qa/
   └── DELIVERY/
   ```
8. `page_manifest.json` is the page ownership contract. It must list every page file, page type, intent, required source, owner, and a short layout contract for that page: `layout_skeleton`, `content_budget`, `density_intent`, and `qa_risks`. The `.pptd pages:` list must exactly match this manifest order.
9. Run pre-spawn guard before page agents:
   ```bash
   python3 scripts/pptd_guard.py <deck>.pptd --pre-spawn
   ```
   Missing `.page` files are allowed only as expected pre-spawn pages. Any guard error must be fixed before spawning page agents.
10. Page agents may only write their assigned `.page` files from `page_manifest.json`. They must follow `guideline/subagent/*`, and must not edit `.pptd`, `design.md`, `outline.md`, or unrelated page files. Assign 2-4 related pages per page agent by default; avoid assigning a whole deck to one worker or mixing cover/chapter pages with dense data pages in the same task.
11. Do not treat a page agent as done based only on its text response. The main agent must verify every assigned `.page` exists at the exact manifest path. Missing files are a failed handoff; retry the agent, split the assignment smaller, or reassign the page, and record the recovery under `qa/handoff_failures.md`.
12. After all pages are present, run the bundled checker until it reports `0 errors, 0 warnings`, then run:
   ```bash
   python3 scripts/pptd_guard.py <deck>.pptd --post-pages
   ```
13. Run `scripts/pptd_layout_lint.py` before conversion and review the complete output. It is advisory, not a fixed-template enforcer: repair findings that correspond to real low density, crowding, edge-touch, or imbalance, but do not fail delivery only because a heuristic score is low. If it conflicts with the selected design profile or intentional layout, trust rendered preview and post-render judge.
14. Spawn an independent QA agent for every deck after the page files exist and before final delivery. The QA agent must read `guideline/subagent/qa_review.md`, inspect `page_manifest.json`, `design.md`, `outline.md`, source files, `.page` files, checker/lint output, and rendered slide images when available, then write `qa/subagent_qa.md`. Major QA findings must be assigned to page/fix agents and rechecked; do not close the deck with unresolved major QA findings.
15. After conversion, render or preview the PPTX and create QA evidence under `qa/` when possible. If rendered slide images, a visual judge packet, or deterministic packet generation is available, run the repair gate as the minimum delivery gate, then run:
   ```bash
   python3 scripts/pptx_repair_gate.py --summary qa/judge/summary.json --packet qa/judge/packet.json --page-manifest page_manifest.json --out qa/repair_plan.md --min-score 75 --max-major 0 --max-minor 3
   ```
   If the repair gate fails, assign the listed `.page` files to page/fix agents, then rerun checker, guard, convert, judge, and repair gate. Do not deliver as done while the repair gate fails.
16. Final response must include the absolute `.pptx` path, page count, one-line design summary, known remaining defects if any, and a final line exactly: `任务已结束`.
17. Do not copy fixed output templates into PPTD. However, you may reference bundled design profiles or other deck-design references when they fit the deck. Translate principles into native PPTD theme/layout decisions; do not copy HTML templates, CSS classes, or locked HTML slide structures.
18. Do not hide weak pages behind decorative containers. A chapter/transition/discussion page must carry a real message, agenda, comparison, question set, or visual anchor. More than 2 low-signal structure pages, or more than 12% low-signal pages in the deck, is a deck-level defect to repair before delivery.
