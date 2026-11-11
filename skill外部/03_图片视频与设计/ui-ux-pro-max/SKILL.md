---
name: ui-ux-pro-max
description: UI/UX design intelligence and implementation guidance for building polished interfaces. Use when the user asks for UI design, UX flows, information architecture, visual style direction, design systems/tokens, component specs, copy/microcopy, accessibility, or to generate/critique/refine frontend UI (HTML/CSS/JS, React, Next.js, Vue, Svelte, Tailwind). Includes workflows for (1) generating new UI layouts and styling, (2) improving existing UI/UX, (3) producing design-system tokens and component guidelines, and (4) turning UX recommendations into concrete code changes.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


Follow these steps to deliver high-quality UI/UX output with minimal back-and-forth.

## 1) Triage
Ask only what you must to avoid wrong work:
- Target platform: web / iOS / Android / desktop
- Stack (if code changes): React/Next/Vue/Svelte, CSS/Tailwind, component library
- Goal and constraints: conversion, speed, brand vibe, accessibility level (WCAG AA?)
- What you have: screenshot, Figma, repo, URL, user journey

If the user says "全部都要" (design + UX + code + design system), treat it as four deliverables and ship in that order.

## 2) Produce Deliverables (pick what fits)
Always be concrete: name components, states, spacing, typography, and interactions.

- **UI concept + layout**: Provide a clear visual direction, grid, typography, color system, key screens/sections.
- **UX flow**: Map the user journey, critical paths, error/empty/loading states, edge cases.
- **Design system**: Tokens (color/typography/spacing/radius/shadow), component rules, accessibility notes.
- **Implementation plan**: Exact file-level edits, component breakdown, and acceptance criteria.

## 3) Use Bundled Assets
This skill bundles data you can cite for inspiration/standards.

- **Design intelligence data**: Read from `skills/ui-ux-pro-max/assets/data/` when you need palettes, patterns, or UI/UX heuristics.
- **Upstream reference**: If you need more phrasing/examples, consult `skills/ui-ux-pro-max/references/upstream-skill-content.md`.

## 4) Optional Script (Design System Generator)
If you need to quickly generate tokens and page-specific overrides, use the bundled script:

```bash
python3 skills/ui-ux-pro-max/scripts/design_system.py --help
```

Prefer running it when the user wants a structured token output (ASCII-friendly).

## Output Standards
- Default to ASCII-only tokens/variables unless the project already uses Unicode.
- Include: spacing scale, type scale, 2-3 font pair options, color tokens, component states.
- Always cover: empty/loading/error, keyboard navigation, focus states, contrast.
