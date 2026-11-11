# SRMPRO 图纸库 v3 深度步骤测试 14 个真实失败案例沉淀

> 来源：2026-07-18 SRMPRO 图纸库 v3 全量测试（55 用例，163 步骤，120 截图）。
> 用途：下次会话遇到类似现象，直接对照本表找已验证的根因和修复建议。

---

## 类别 A：前端逻辑 Bug（需要提单到云效）

### A1 已过期筛选无效果（TC-DRAW-M01-002）
- **步骤**：记录初始 10 行 → 点"已过期"数字牌 → 等待 2s → 再记录行数
- **DOM 返回**：`前=10, 后=10, 变化=False`
- **真实原因**：临期数字牌正确（10→3），但已过期数字牌的过滤逻辑可能未绑定或绑错数据源
- **下次应对**：第一轮必跑 → 提单 UFFF-7050 系列
- **截图**：`screenshots/m01_v3/tc002_step2.png`

### A2 批量归档未勾选无提示（TC-DRAW-M01-012）
- **步骤**：未勾选任意行 → 点"批量归档"按钮 → 等 2s → 检查 `.el-message` / `.el-message-box`
- **DOM 返回**：`提示=None`
- **真实原因**：按钮 click handler 没做"空选"校验
- **下次应对**：UI 层前端校验缺陷，提单 `qa/yunxiao-defect-submit`

### A3 批量归档勾选后无确认弹窗（TC-DRAW-M19 / M08-005）
- **步骤**：勾选第一行（vxe-checkbox）→ 点"批量归档" → 等 2s → 检查 `.el-message-box`
- **DOM 返回**：`弹窗=None`，但真实选择器和 JS 都触发了
- **真实原因**：批量归档入口走的是另一个 API，可能 click 后直接归档，跳过二次确认
- **下次应对**：分两种情况：跳过确认（设计如此）= 备注 "无二次确认"，或系统 Bug = 提单

### A4 PNG/Word 文件名点击无预览（TC-DRAW-M01-020）
- **步骤**：找 `.png` 文件按钮 → locator(force=True).click(force=True) → 等 3s → 检查 dialog/image-viewer
- **DOM 返回**：`弹窗=none, 媒体=None`
- **真实原因**：文件名是 `<button class="el-button--text">` 但 click 不触发预览；预览入口可能是 `el-icon-document` 或者鼠标悬停 → 双击
- **下次应对**：试 hover + click 双击；都不行 → 提单"图片预览入口缺失"
- **R9 假设**：PNG/Word 预览 → locator(force=True).click → 无弹窗（**已验证为 Bug，写入本表**）

### A5 列表刷新数据消失（TC-DRAW-M01-023）
- **步骤**：记录 10 行 → 点"刷新"按钮或重新 `page.goto(URL)` → 等 3s → 再记录
- **DOM 返回**：`前=10, 后=0, 一致=False`
- **真实原因**：刷新触发了高级搜索面板残留状态，清空了列表
- **下次应对**：刷新步骤前先按 ESC 关闭高级搜索面板，再 refresh

---

## 类别 B：选择器/交互模式（脚本侧问题，下次直接用正确选择器）

### B1 ESC 不能关闭弹窗（TC-DRAW-M03-004 / M05-002）
- **现象**：`page.keyboard.press('Escape')` 后弹窗仍显示
- **真实原因**：Element UI dialog 默认绑 ESC，但被 preventDefault 屏蔽了
- **下次应对**：用 `.el-dialog__close` 点击关闭，或 `.el-dialog__wrapper` 点击外部

### B2 el-select 大量选项只 10 个 visible（来源 R3）
- **现象**：109 个选项 DOM 存在但 `offsetParent === null`，Playwright `click()` 30s 超时
- **真实原因**：Element UI 用虚拟滚动，只渲染可视区选项
- **下次应对**（已沉淀到 element-ui-interaction-patterns.md）：
  ```python
  page.evaluate("""() => {
      const opts = document.querySelectorAll('.el-select-dropdown__item');
      for (const o of opts) {
          if (o.offsetParent !== null && !o.classList.contains('selected')) {
              o.click(); return;
          }
      }
  }""")
  ```

### B3 el-icon-more 与 el-dropdown-menu__item 用相反的 click（来源 R5/R7）
- **现象**：选择器对，但点击无反应
- **真实原因**：Vue 组件事件绑定 vs 原生 click 事件的兼容性问题
- **下次应对**（已写入 SKILL 踩坑表）：
  - **触发器（more icon）**：用 `page.locator(sel).click(force=True)`
  - **菜单项（el-dropdown-menu__item）**：用 JS `element.click()`

### B4 上传弹窗步骤 2 file input 在 body 上（来源 R3）
- **现象**：弹窗 DOM 找 `input[type="file"]` 找不到
- **真实原因**：上传组件用了 `<el-upload>`，file input 渲染到 body 末尾
- **下次应对**：全页扫描 `document.querySelectorAll('input[type="file"]')`

### B5 图纸搜索框在高级搜索面板里（来源 R5）
- **现象**：页面顶部"搜索页面名称"才是全局搜索，不是图纸搜索
- **真实原因**：两个搜索框不同：全局搜索在 navbar，图纸搜索在高级搜索面板
- **下次应对**：图纸搜索框 `placeholder="图纸文件名、物料编码"`，需先勾选"条件字段"才出现

### B6 SVG class=`is-checked` / `vxe-checkbox--icon` 跨组件差异
- **现象**：标准 `.el-checkbox__input.is-checked` 对 vxe-table 失效
- **下次应对**：vxe-table 用 `.vxe-checkbox--icon.is-checked` 或 fallback `.is-checked`

---

## 类别 C：权限/数据隔离（需要切换账号验证）

### C1 管理员菜单权限测试结果不一致（TC-DRAW-M09-001）
- **现象**：admin 账号在抽屉式菜单里找不到"图纸库"和"配置"按钮
- **真实原因**：admin 登录后默认显示 top menu，但 `.el-menu-item` 在子菜单里，主菜单里只有 `.el-submenu__title`
- **下次应对**：菜单选择器应该是 `.el-submenu__title:has-text("配置")`

### C2 数据隔离看不出效果（TC-DRAW-M09-002）
- **现象**：单采购组织"深圳采购组织"账号看不到其他组织数据
- **下次应对**：必须用多组织账号（如 aarontest）登录才能验证隔离；当前 admin 测试本身就是"我能看到自己组织的数据"= PASS

### C3 supplier 操作权限隔离（TC-DRAW-M07-002）
- **现象**：aarontest（供应商）能看到上传按钮——可能权限漏洞
- **下次应对**：必须切换账号，每个账号独立跑一遍 M07 全套用例

---

## 类别 D：架构问题（需要回到M层决策）

### D1 多 batch 跑导致 JSON 覆盖（已踩过多次）
- **现象**：batch1 写好的 `M01_results.json`，batch2 又写一遍覆盖了
- **下次应对**：脚本只写日志 (`tee /tmp/Mxx_batchN.log`)，最后用 `re.findall` 从所有日志合并到 `*_final.json`

### D2 汇总 module_stats 重复计数
- **现象**：batch1 的 case_id 被 batch2 又合并了一次
- **下次应对**：合并时显式 `set(case_id)` 去重

---

## 老大原话（v3 全量测试复盘）

> "你的每个测试场景里面有没有列步骤啊？如果没有列步骤，一次性怎么过的呢？每个测试场景里面都有好多步骤哎"
>
> "继续后面的所有"
>
> "好的，就是这样"

**关键结论**：每个用例**必须**有 3-6 步，每步**必须**有截图 + DOM 断言返回值 + 截图大小白屏检测。"1 步假通过"不算通过。

**统计**：v3 全量 55 用例 / 163 步 / 120 截图，平均每用例 3 步，截图覆盖率 73.6%。

---

## 后续行动清单

1. **本 14 个 FAIL 中至少 8 个属于系统 Bug**：用 `qa/yunxiao-defect-submit` 提交到云效
2. **本表作为下次会话的快速参考**：下次遇到相同 FAIL 模式直接查表，不重复假设思维
3. **下次 v4 改进**：所有选择器改用 V3+R5/R7 已验证的真实 DOM 选择器（见 references/element-ui-interaction-patterns.md）
