## 关键经验（续 — 复杂列表页）

### 12. Element UI 复杂列表页探索模式 (2026-06-03 SRM-PRO 资源库实战)

**场景识别：** 列表页满足以下任一特征就需要本模式：
- 表格 ≥ 10 列
- 每行有 N 个行操作（按钮组 / el-dropdown "更多" / el-popover）
- 顶部有 3+ 批量操作按钮（批量创建/导出/导入/删除）
- 翻页 + 改每页条数 + 搜索 + 高级搜索 + 多筛选 同时存在
- 后端返回数据量大（>1000 条）

**标准探索清单（按这个顺序跑，每项必出证据）：**

```yaml
phase_a_页面结构:
  - HTML 字节数: 检查 main.innerHTML.length（100K+ = 复杂页）
  - 表格列数: .el-table__header th 数量
  - 可见 vs 隐藏弹框: 数 .el-dialog__wrapper (× 关键经验 #10)
  - 数据量: .el-pagination 共 X 条 / X 页
  - 顶部按钮清单 + 坐标
  - 顶部输入框清单（搜索 + 高级搜索）
  - 行操作菜单清单（el-dropdown li 列表 — 详见下方）

phase_b_搜索:
  - 输入唯一关键词 + 点搜索 → 验证结果数变化
  - 点重置 → 验证恢复总数
  - 触发 input/change/keydown 三件套（Vue v-model 必填 — 关键经验 #11）

phase_c_翻页:
  - 当前页 X，点 .btn-next → 验证跳到 X+1
  - 改每页条数 10→50 → 验证页数从 322 变 65
  - 直接跳页（输入页码 + Enter）

phase_d_批量操作:
  - 批量创建: 大概率是 dialog 但**0 个 form item**（下载模板/上传模式）
  - 批量导出: 大概率是 el-message-box（确认弹窗，**不是 dialog**）
  - 批量删除/导入: 几乎都是 message-box 二次确认

phase_e_行操作:
  - hover `.el-dropdown-selfdefine` 触发下拉（实际不可靠 — 见下方技巧）
  - **备选**: 直接读 `el-dropdown-menu ul` 的所有 li（即使 display:none 也能拿到）

phase_f_数据完整性:
  - 对比后端数据 vs 前端展示（数据是否完整/截断）
  - 异常值（公司地址过长截断、邮箱格式异常、必填项为空）
```

**el-dropdown 行操作菜单的全量发现 (2026-06-03 资源库实战):**

```javascript
// 关键技巧：直接读所有 dropdown menu 的 li，**不依赖 hover 触发**
const allMenus = Array.from(document.querySelectorAll('.el-dropdown-menu'))
  .filter(m => m.id.startsWith('dropdown-menu-'));  // 排除 header 顶部 menu

// 拿每个 menu 的所有 li（即使 display:none 也能读到 textContent）
const dropdownItems = allMenus.map(m => ({
    id: m.id,
    display: m.style.display,
    items: Array.from(m.querySelectorAll('.el-dropdown-menu__item'))
      .map(i => i.textContent?.trim()).filter(Boolean)
}));

// 实战结果（SRM-PRO 资源库第一行）：
// {
//   id: "dropdown-menu-7505",
//   items: ["征信信息", "邀请修改", "变更状态", "供应商档案",
//           "修改基础信息", "修改银行信息", "修改系统和资质",
//           "编辑文档", "修改ERP信息", "修改供应商编码"]
// }
```

**为什么不 hover 触发？** Element UI el-dropdown 用 `vue-popper` 渲染，**纯 JS 派发 mouseenter/over/move 在 Vue/Element 内部可能被忽略**（和 cascader 类似）。但所有 menu 都在 DOM 里 pre-render，**直接读比触发更可靠**。

**给报告的标准模板（每行操作一栏）：**
```markdown
| # | 操作名 | 触发结果 |
|---|---|---|
| 1 | 征信信息 | 🔍 隐藏弹框（未探索）|
| 2 | 邀请修改 | 🔍 隐藏弹框 |
| ... | ... | ... |
```

### 13. el-message-box vs el-dialog 区分 (2026-06-03 SRM-PRO 资源库实战)

**核心区别:**

| 特征 | el-dialog | el-message-box |
|---|---|---|
| 用途 | 复杂交互（表单/列表/嵌套内容）| 简单确认（是否.../确认...）|
| 复杂度 | 高 | 低 |
| 关闭按钮 | 有 X | 通常只有取消/确定 |
| 触发模式 | 主动弹（多按钮可点）| 触发即阻拦操作（必须点确认）|
| 数量 | 页面多个并存 | 通常一次只一个 |
| DOM selector | `.el-dialog` / `.el-dialog__wrapper` | `.el-message-box` / `.el-message-box__wrapper` |
| 关闭方式 | click 取消/确认/X | click 取消/确认 |

**资源库实战（点击"批量导出"触发的是 message-box 不是 dialog）:**
```javascript
// 关闭 message-box 的正确方式
const cancelBtn = Array.from(document.querySelectorAll('.el-message-box button, .el-message-box__btns button'))
  .find(b => b.textContent?.trim() === '取消' && b.getBoundingClientRect().width > 0);
cancelBtn.click();

// 验证关闭
const stillOpen = !!document.querySelector('.el-message-box');
```

**为什么误判容易？** DOM 里 `.el-message-box` 和 `.el-dialog__wrapper` **同时存在**（多弹框模板），仅看 selector 不区分就会错过 message-box 的特殊性。

**给报告的提示**：测批量操作时**主动列两种 selector**，避免漏测：
```javascript
const allOverlays = {
    dialogs: Array.from(document.querySelectorAll('.el-dialog__wrapper'))
        .filter(w => !w.getAttribute('style')?.includes('display: none'))
        .map(w => w.querySelector('.el-dialog__title')?.textContent?.trim()),
    msgBoxes: Array.from(document.querySelectorAll('.el-message-box'))
        .filter(b => b.getBoundingClientRect().width > 0)
        .map(b => b.textContent?.trim().slice(0, 100))
};
```

### 14. 翻页/翻页条数 DOM 探针标准模板 (2026-06-03 SRM-PRO 资源库实战)

**el-pagination 完整探针：**

```javascript
// 1) 找分页器
const pagination = document.querySelector('.el-pagination');
if (!pagination) return 'no pagination';

// 2) 列出所有按钮 + 状态
const buttons = Array.from(pagination.querySelectorAll('button, .number, .el-icon-more'))
  .map(b => ({
    tag: b.tagName,
    class: b.className,
    text: b.textContent?.trim().slice(0, 10),
    visible: b.getBoundingClientRect().width > 0
  }));

// 3) 关键翻页测试模板
const testPagination = async () => {
  const firstPage = pagination.querySelector('.number');  // 第 1 页
  const nextBtn = pagination.querySelector('.btn-next');
  const sizeSelect = pagination.querySelector('.el-select');
  const currentPage = pagination.querySelector('.el-input__inner')?.value;
  const totalText = pagination.textContent?.trim().slice(0, 100);

  // 测下一页
  nextBtn.click();
  await new Promise(r => setTimeout(r, 1000));
  const afterNextActive = pagination.querySelector('.number.active')?.textContent;

  return { firstPage, nextBtn, sizeSelect, currentPage, totalText, afterNextActive };
};
```

**⚠️ 翻页按钮双触发陷阱 (Issue #003):**
```javascript
// ❌ 错误：双重 click 跳 2 页
nextBtn.click();
nextBtn.dispatchEvent(new MouseEvent('click', {bubbles: true, ...}));

// ✅ 正确：只 .click() 一次
nextBtn.click();
await new Promise(r => setTimeout(r, 1000));
```

**改每页条数探针：**
```javascript
// 点 el-select 触发下拉
const sizeSelect = document.querySelector('.el-pagination .el-select');
sizeSelect.click();
await new Promise(r => setTimeout(r, 500));

// 等下拉出现，找 50条/页 选项
const options = Array.from(document.querySelectorAll('.el-select-dropdown__item'))
  .filter(o => o.textContent?.trim() === '50条/页' && o.getBoundingClientRect().width > 0);

if (options[0]) {
  options[0].click();
  await new Promise(r => setTimeout(r, 800));
  // 验证：pagination 总数会从 322 页变 65 页（3211 / 50 = 65）
}
```

**给报告的"高级搜索无反应"Issue 模板 (P2):**
```json
{
  "id": "Issue-XXX",
  "title": "<页面名> 高级搜索按钮点击无反应",
  "severity": "P2-中等",
  "category": "Functional/Button",
  "repro": [
    "1. 进入 <页面名>",
    "2. 点击 高级搜索 按钮"
  ],
  "evidence": {
    "url_before": "https://...",
    "url_after": "https://...",
    "url_unchanged": true,
    "new_form_items_count": 0,
    "vue_event_listeners": 0
  },
  "root_cause_guess": "按钮只装饰（无 Vue 监听）/ handler 绑错 / 高级搜索是独立页面但 router 异常"
}
```
