# SRMPRO HTML 报告 7 区块格式规范

**来源**: 原 `srpro-report-format` skill，合并入 `cron-scheduled-test-runner` umbrella。
**适用场景**: 生成 SRMPRO 图纸库单模块 HTML 测试报告时，必须遵循此 7 区块结构规范。

---

## 核心要求

1. **文件路径规范**: 所有报告使用 `/home/aaronmy/SRMPRO/文档库/report/enhanced/*.html` 格式
2. **写操作要求**: 必须执行真实写操作（上传/关联/归档/删除/配置），不跳过任何测试场景
3. **登录选择器**: 使用 `button:has-text("common.logIn")` 而非 `button[type="submit"]`（M03 实战验证）
4. **缺陷提取**: 全量报告的缺陷必须从子模块报告自动提取，不能手动编辑
5. **7 区块完整**: 必须包含 7 个区块，任何缺失均导致校验失败

---

## 7 区块结构

### Block 1: 标题区
- 系统名称、模块名称、执行时间、测试URL、测试账号、测试人

```html
<div class="report-header">
  <h1>🧭 {MODULE_NAME} 测试报告</h1>
  <div class="subtitle">
    系统: {SYSTEM_NAME} | 执行时间: {TEST_TIME}<br>
    测试地址: {TEST_URL} | 测试账号: {TEST_USERS} | 测试人: {TEST_PERSON}
  </div>
</div>
```

### Block 2: 4 列统计卡片
- 总用例数 (蓝色 #1890ff)
- 通过数 (绿色 #52c41a)
- 失败数 (红色 #ff4d4f)
- 跳过数 (橙色 #faad14)
- 每个卡片带颜色边框，大数字+标签

### Block 3: 3 列优先级统计
- P0 (红色 #cf1322) - 核心用例
- P1 (橙色 #fa8c16) - 重要用例
- P2 (蓝色 #1890ff) - 一般用例
- 每列显示: 已通过/总数 + 通过率%

### Block 4: 通过率进度条
- >=80%: 绿色 #52c41a
- 50-79%: 橙色 #faad14
- <50%: 红色 #ff4d4f

### Block 5: 用例详情（核心 - 7+ 子区块）

每个用例卡片必须包含:

1. **Header**: Case ID + title + priority tag + status tag
2. **Precondition** (if applicable)
3. **Actual Result**: the observed outcome
4. **Defect Box** (only when status = fail):
   - Format: `⚠️ 缺陷 [{severity}] {title}`
   - Content: description, expected vs actual, reproduction steps
   - CSS class: `defect-box` with red left border
5. **Step List**: for each step:
   - Step number, action description, result text
   - Status class: `step-pass` (green), `step-fail` (red), `step-obs` (blue)
6. **Screenshot Gallery**: base64-embedded images with labels
   - Screenshots < 10KB get `blank-shot` class (orange dashed border + warning text)
   - Clickable thumbnails open lightbox overlay
   - 截图增强详细配方见 `references/srmpro-html-report-enhancement-recipe.md`

### Block 6: 缺陷汇总表
- Columns: #, Case ID, Severity (colored), Description, Actual Result
- Must list all defects extracted automatically from child reports

### Block 7: 测试总结
- Passed/Failed/Skipped counts
- Key learnings
- Final conclusion: Pass / Conditional Pass / Fail based on P0/P1

---

## 与其他配方的关系

- **截图增强**: 本规范定义的 Block 5 Screenshot Gallery 的具体注入实现（4 种 HTML 格式检测 + base64 内嵌 + lightbox）见 `references/srmpro-html-report-enhancement-recipe.md`
- **全量汇总报告**: 多份单模块报告聚合成 MD 全量报告 + 热力图 Dashboard 见 `references/srmpro-aggregate-report-recipe.md`
- **报告路径**: 所有报告统一放 `~/SRMPRO/文档库/report/`（enhanced 子目录用于增强版），不按模块建子目录
