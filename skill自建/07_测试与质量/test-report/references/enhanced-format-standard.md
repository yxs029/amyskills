# Enhanced Format Standard for SRMPRO HTML Reports (User Mandate 2026-07-08)

**This document captures the exact, non-negotiable format that the user requires for all HTML deliverables.**
Derived from analyzing the reference files in `SRMPRO/文档库/report/enhanced/*.html`.

> **User quote**: "以后交付用的HTML报告，都用这个文件夹里面的报告格式，这才是让人类能够判断你是不是测试到位的报告格式"

## 1. Required 7-Block Structure

Every generated HTML report **must** contain these blocks, in this order:

### Block 1: Title Area
- System name, module name, execution time, test URL, test accounts, test person/tool.
- HTML pattern:
```html
<div class="report-header">
  <h1>🧭 {MODULE_NAME} 测试报告</h1>
  <div class="subtitle">
    系统: {SYSTEM_NAME} | 执行时间: {TEST_TIME}<br>
    测试地址: {TEST_URL} | 测试账号: {TEST_USERS} | 测试人: {TEST_PERSON}
  </div>
</div>
```

### Block 2: 4-Column Statistics Cards
- Total Cases (blue `#1890ff`), Passed (green `#52c41a`), Failed (red `#ff4d4f`), Skipped (orange `#faad14`).
- Each card: large number + label + colored top border.
```html
<div class="stats-row">
  <div class="stat-card stat-total"><div class="stat-num">{TOTAL}</div><div class="stat-label">总用例</div></div>
  <div class="stat-card stat-pass"><div class="stat-num">{PASS}</div><div class="stat-label">通过</div></div>
  <div class="stat-card stat-fail"><div class="stat-num">{FAIL}</div><div class="stat-label">失败</div></div>
  <div class="stat-card stat-skip"><div class="stat-num">{SKIP}</div><div class="stat-label">跳过</div></div>
</div>
```

### Block 3: 3-Column Priority Statistics
- P0 (red `#cf1322`), P1 (orange `#fa8c16`), P2 (blue `#1890ff`).
- Each column shows: `已通过/总数` + `通过率%`.

### Block 4: Pass-rate Progress Bar
- Overall pass-rate % with colored bar:
  - >=80%: green `#52c41a`
  - 50-79%: orange `#faad14`
  - <50%: red `#ff4d4f`

### Block 5: Case Detail Block (the core - repeat for every test case)
Each test case card **must** include ALL of the following:

1. **Header**: Case ID + title + priority tag (P0/P1/P2) + status tag (PASS/FAIL/WARN).
2. **Precondition** (if applicable): what state the system was in before the test.
3. **Actual Result**: the observed outcome after executing the steps.
4. **Defect Box** (only when `status = fail`):
   - Format: `⚠️ 缺陷 [{severity}] {title}`
   - Content: description, expected vs. actual comparison, reproduction steps.
   - CSS class: `defect-box` with red left border.
5. **Step List**: for **each** step:
   - Step number, action description, result text.
   - Status class: `step-pass` (green left border), `step-fail` (red left border), `step-obs` (blue left border).
6. **Screenshot Gallery**: **base64-embedded** `<img src="data:image/png;base64,...">` tags.
   - Each screenshot has a label and optional description.
   - Clickable thumbnail opens a full-screen lightbox overlay.
   - Screenshots < 10KB get `blank-shot` class (orange dashed border + warning text).

```html
<div class="case-card {STATUS_CLASS}">
  <div class="case-header">
    <span class="case-id">{CASE_ID}</span>
    <span class="case-title">{CASE_TITLE}</span>
    <span class="priority-tag pri-{PRIORITY}">{PRIORITY}</span>
    <span class="status-tag status-{STATUS}">{STATUS_TEXT}</span>
  </div>
  <div class="case-body">
    <div class="actual-result">实际结果: {ACTUAL_RESULT}</div>
    <!-- defect-box only if status=fail -->
    <div class="defect-box">
      ⚠️ 缺陷 [{SEVERITY}] {DEFECT_TITLE}<br>
      {DEFECT_DESCRIPTION}<br>
      预期: {EXPECTED} | 实际: {ACTUAL}
    </div>
    <!-- steps -->
    <div class="steps">
      <div class="step step-pass"><span class="step-num">1</span> {ACTION} → {RESULT}</div>
    </div>
    <!-- screenshots -->
    <div class="screenshot-gallery">
      <div class="shot-thumb" onclick="openLightbox('data:image/png;base64,...')">
        <img src="data:image/png;base64,...">
        <div class="shot-label">{SCREENSHOT_LABEL}</div>
      </div>
    </div>
  </div>
</div>
```

### Block 6: Defect Summary Table
- Columns: `#`, 用例 (case ID), 严重度 (severity colored), 描述, 实际结果.
- Severity colors: P0-red, P1-orange, P2-blue, INFO-gray.
- Must list **all** defects extracted automatically from child reports.

### Block 7: Test Summary
- Human-readable wrap-up:
  - ✅ 通过用例: X | ⚠️ 警告用例: Y | ❌ 失败用例: Z | 📸 截图数量: N
- 🎯 本轮关键经验: free-text bullet list (populated from test run).
- Test conclusion: **通过** / **有条件通过** / **不通过** based on P0/P1 criteria.

## 2. Per-Case Evidence Requirements

For **every** test case (regardless of pass/fail) the report **must** include:
- **Test Case ID and descriptive title**.
- **Detailed Steps**: ordered list of actions with explicit results.
- **Actual Result**: the observed outcome after executing the steps.
- **Screenshot Evidence**: at least one screenshot per significant step, base64-embedded.
- **Defect Attachment** (only for failed cases): a `defect-box` showing expected vs. actual and reproduction steps.

> **User quote**: "这才是让人类能够判断你是不是测试到位的报告格式"
> -> The format above supplies the evidence chain (steps + screenshots + actual vs. expected) that lets a human reviewer judge test thoroughness.

## 3. Enforcement Rules (Non-Negotiable)

1. **Never hand-craft a template in chat** - always use the skill's `assets/submodule_template.html` and `scripts/gen_submodule_report.py`.
2. **All 7 blocks must be present**; missing any block = validation failure.
3. **Screenshots must be base64-encoded** and inline; external `<img src="file.png">` prohibited.
4. **Defect-box** appears **iff** `status = fail`; its data must flow automatically from child reports.
5. **Pass-rate color thresholds** are fixed: >=80% green, 50-79% orange, <50% red.
6. **Report filename**: `{{MODULE_NAME}}_{{DATE}}_{{PASS_RATE}}%_test_report.html`.
7. **Trigger**: any user request mentioning "使用这个格式", "以后交付用的HTML报告", or "子模块测试报告" **must** invoke the `test-report` skill.

## 4. Technical Requirements

- **Single-file self-contained**: all CSS/JS/screenshots inline. No external dependencies.
- **Lightbox interaction**: click thumbnail to enlarge, ESC or click overlay to close.
- **Responsive**: max-width 1200px, screenshot gallery `auto-fill, minmax(200px, 1fr)`.
- **Print-friendly**: white background sections for printing/emailing.

## 5. Reference Implementation

- See `assets/submodule_template.html` for the skeleton with `{{VARIABLE}}` placeholders.
- See `scripts/gen_submodule_report.py` for the rendering logic that populates the 7 blocks from the JSON contract.
- See `references/submodule-spec.md` for the exact placeholder-to-JSON mapping.
- See `references/checklist.md` for a pre-delivery checklist.
- See `references/enhanced-html-patterns.md` for concrete CSS/HTML/JS code snippets extracted from the reference reports.

## 6. Change Log

- **2026-07-08**: Created this document to capture the user's explicit standard after reviewing `report/enhanced/*.html`.
- **2026-07-13**: Cleaned up garbled characters in Block 5 description. Added concrete HTML patterns for each block. Added reference to `enhanced-html-patterns.md`.
