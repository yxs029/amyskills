## 📋 文档库页面结构 (2026-06-16 实战确认)

文档库 `/SupplierManagement/newDocument` 的实际结构：

- **不是** 传统 el-tree 树形控件
- **是** 表格+可展开行结构（类似 el-table 的 expand row）
- 统计卡片（4个：文档类型总数/已上传/即将过期/已过期）在顶部
- 表格 5 个分类行（财务/资质/协议/审核/文档），每行有"展开"按钮
- "展开全部"按钮选择器: `text=展开全部`
- 展开后显示子类型行（如营业执照/ISO证书等），共 35 个子类型
- 导出按钮: "资质文档统计下载" / "协议签署统计下载"

**⚠️ 权限控制关键发现:**
- 汇总统计卡片和分类行数据是**全量数据**，未按采购员归属关系过滤
- 权限控制在**操作层拦截**（点击展开弹出"没有该操作权限"），而非数据层过滤
- 无权限用户(aarontest)直接访问文档库 URL 返回 **404 错误页**，而非空数据页
- 这意味着: 视觉对比（admin vs testadmin 截图）是验证权限的**必需步骤**，自动化脚本判断不够

**自动化测试选择器:**
```python
# 展开全部
page.click('text=展开全部')  # ✅ 有效
page.query_selector('.el-tree-node__expand-icon')  # ❌ 找不到（不是 el-tree）

# 导出按钮
page.query_selector('button:has-text("资质文档统计下载")')  # ✅
page.query_selector('button:has-text("协议签署统计下载")')  # ✅

# 搜索框
page.query_selector('input[placeholder*="搜索"], .el-input__inner')  # ✅
```

**📚 详细参考文档 (linked files):**
- `references/document-library-permission-testing.md` — 三账号权限对比测试模板 (admin/testadmin/aarontest)。**2026-06-17 v6 更新**: 新增 Excel 下载落地验证模板 (`expect_download` + openpyxl 行数/关键字/表头三件套)、测试环境基准数表 (admin=3236 行, S3 越权关键字"重庆智博")、长测脚本后台调度模板 (`tee` + 分段 poll)、8 个 P0 已知缺陷清单。**v5 教训**: 不做下载落盘验证会让 P0 通过率虚高 (v5 80% 实际 20%)
- `references/document-library-filter-testing.md` — 筛选区 (搜索行+分段器) 测试，含 13 个 TC-SEARCH/SEG 用例的精确选择器、视口外点击陷阱 (`force=True`)、Playwright EPIPE 崩溃规避、HTML 报告 `%` 格式化陷阱、已发现的 2 个 P1 缺陷 (重置按钮不生效/空状态文案通用化)
- `references/document-library-tree-testing.md` — 树形列表区 (16 个 TC-TREE 用例) 测试，含 16 个用例实测结果、3 个真实缺陷 (含 1 个 P0: 协议文档三级结构缺失)、精确选择器、JS evaluate 引号转义陷阱、行展开操作模板
- `references/document-library-modal-testing.md` — 文档详情弹窗 (26 个 TC-MODAL 用例) 测试，含 5 个核心模式 (弹窗检测/打开/关闭/JS批量样式采样/接口路由拦截)、5 个真实缺陷 (4 个 P1 样式规则未落地)、与树形列表区背景色规则不一致的强信号、弹窗持久化共享设计
- `references/srmpro-layout-shift-pitfalls.md` - **2026-07-08 新增**：展开全部后搜索框/分页器不可见导致 Playwright fill/click 30s 超时的 3 种解法（JS evaluate 设值 / 先收起再操作 / force=True 强制点击）
- `references/playwright-evaluate-pitfalls.md` - **必读**：`pg.evaluate()` 内 `document.querySelector*` 不支持 Playwright 自定义伪类 (`:visible` / `:has-text()` / `:nth-match()`)，会抛 SyntaxError 让整个用例 fail。给出 SRMPRO 弹窗场景下 3 种修法（推荐：`offsetParent !== null` + `wrapper.style.display !== 'none'` 原生判可见）+ 写脚本前 grep 自检命令。2026-06-17 数据权限 v5 测试 3 处踩坑教训。
- `references/batch-execution-log-merge.md` - **2026-07-17 新增**：38 个用例分 4 批执行 + 日志合并恢复完整方案（EPIPE 崩溃规避、JSON 覆盖问题、正则提取用例结果）
- `references/element-ui-select-dropdown-pitfall.md` - **2026-07-18 新增**：Element UI el-select 大量选项时 Playwright click 30s 超时陷阱（109 个选项只有 10 个 visible）。解法：用 JS evaluate 遍历 `offsetParent !== null` 找可见选项。含 SRMPRO 图纸库上传弹窗真实 DOM 选择器对照表

