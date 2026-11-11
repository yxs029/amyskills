## 关键经验（踩坑沉淀）

### 1. vision 工具的局限性
- **不要相信 `browser_vision` 对深色/中文 UI 的内容判断**
- 它会把"单篇文章下载"识别为"Json格式化工具"（实测）
- 它有时会瞎说"未附带截图"
- **正确用法：vision 只用来存档截图，文字判断用 browser_snapshot**

### 2. Nuxt/Next SPA 的特性
- 所有未知路径 fallback 到 `index.html`，**HTTP 200**
- 必须主动探测关键 API endpoint 看是不是 404
- `<title>` 经常为空（客户端渲染）
- 真实内容在 `<div id="__nuxt">` 或 `<div id="__next">` 容器里

### 3. Cloudflare 防护
- 首次访问会触发 Turnstile 验证
- 自动化浏览器**必须等待 3-5 秒**让 JS 跑完
- 用 `curl` 不带 UA 会触发 403
- 用 `curl` 带正常 UA + 等待是可绕过的

### 4. AG-Grid 等企业级组件
- License key 通常在 JS bundle 中明文暴露
- 列标题可能是机翻的英文占位符（如"具有标题选择的列"）
- 这是 A11y 问题（屏幕阅读器不友好）

### 5. AI 探索测试的 ROI
- **15 分钟 ≈ 14 个 issue** = 人工数小时
- 关键不是"找得多"，是"分类准"
- 建议每个测试都过一遍 4 级严重性 + 6 类分类

### 6. 登录页 CAPTCHA 滑块解锁（verify-move-block 模式）
（2026-06-03 SRM-PRO 实战沉淀）

**场景识别：** 登录页有"向右滑动解锁"提示，登录按钮 disabled，常见于 Vue + Element UI 企业系统（SRM/ERP/CRM）。滑块组件 class 命名：
- `.verify`（外层 308×46 容器）
- `.verify-move-block`（内层 46×46 可拖动方块）
- `.verify-icon.icon-right`（内部箭头图标 ➡）

**为什么登录按钮一直 disabled：** 滑块未拖到底 → `el-button` 持续有 `is-disabled` class。**不是 bug，是状态联动**。

**解锁 JS 模板（实测可复制）：**
```javascript
(function() {
  const moveBlock = document.querySelector('.verify-move-block');
  const container = document.querySelector('.verify-bar-area');
  if (!moveBlock || !container) return 'elements not found';

  const startRect = moveBlock.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  // 起点：滑块中心
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  // 终点：容器右边
  const endX = containerRect.left + containerRect.width - startRect.width / 2;
  const endY = startY;

  // 1. mousedown 必须派发到滑块本体（不要派到 window）
  moveBlock.dispatchEvent(new MouseEvent('mousedown', {
    view: window, bubbles: true, cancelable: true,
    clientX: startX, clientY: startY, button: 0, buttons: 1
  }));

  return new Promise((resolve) => {
    // 2. mousemove 派发 30 步（Vue 监听累计距离，1 步会被忽略）
    const steps = 30;
    let step = 0;
    function tick() {
      step++;
      const progress = step / steps;
      const cx = startX + (endX - startX) * progress;
      const cy = startY;
      // ⚠️ 关键：必须同时派发到 window AND document
      //    Vue/Element 可能在不同层挂监听，缺一就检测不到
      window.dispatchEvent(new MouseEvent('mousemove', {
        view: window, bubbles: true, cancelable: true,
        clientX: cx, clientY: cy, button: 0, buttons: 1
      }));
      document.dispatchEvent(new MouseEvent('mousemove', {
        view: window, bubbles: true, cancelable: true,
        clientX: cx, clientY: cy, button: 0, buttons: 1
      }));
      if (step < steps) {
        setTimeout(tick, 20);
      } else {
        // 3. mouseup 同样双派发
        window.dispatchEvent(new MouseEvent('mouseup', {
          view: window, bubbles: true, cancelable: true,
          clientX: endX, clientY: endY, button: 0, buttons: 0
        }));
        document.dispatchEvent(new MouseEvent('mouseup', {
          view: window, bubbles: true, cancelable: true,
          clientX: endX, clientY: endY, button: 0, buttons: 0
        }));
        // 4. 验证：滑块 style.left 应被 Vue 设为 260px 左右，登录按钮 is-disabled 移除
        setTimeout(() => {
          const mb = document.querySelector('.verify-move-block');
          const lb = document.querySelector('.el-button--primary');
          resolve({
            success: true,
            slider_left: mb?.style.left,
            login_disabled: lb?.disabled,
            login_class: lb?.className
          });
        }, 1000);
      }
    }
    setTimeout(tick, 50);
  });
})()
```

**4 大关键参数：**
1. **派发到 BOTH `window` 和 `document`**（Vue/Element 可能挂在不同层）
2. **30 步而非 1 步**（1 步大位移会被忽略/被反作弊检测）
3. **mousedown 派发到滑块本体**（不是 window），因为 Vue 监听的是滑块上的 `@mousedown`
4. **mouseup 同样双派发**（window + document），并等 1 秒让 Vue 重新计算 button state

**⚠️ 这个方案不适用于：**
- ❌ 图灵/点选/算式验证码（需要外部 OCR + 点击）
- ❌ 极验/网易易盾（gpush/netease captcha）— 这些有自己的 jsbridge
- ❌ Google reCAPTCHA v2/v3
- ❌ hCaptcha
- **只适用**：自研/简单库的 verify-move-block 横向滑动

- v1.7.0 (2026-06-03 20:30) — SRM-PRO 申请库 4 层深度实战增订:
  - **关键经验 #6 补充 - 滑块解锁替代方案 (Vue ref 注入 + removeAttribute + click)**: 当 JS 派发被反作弊拦截时, 用 `__vue__.$refs.instance.status/isEnd/moveBlockLeft` 直接改内部状态 + `btn.removeAttribute('disabled')` + `btn.click()` 强制登录; 实测在 SRM-PRO 有效
  - **关键经验 #18 el-table DOM 列错位检测**: 通过对比表头 th 顺序 vs 行 td 内容, 100% 检出 el-table column key 错配 bug; 5 步诊断模板
  - **关键经验 #19 隐藏 dialog 强制 display 探查技巧**: 数 `.el-dialog__wrapper` 全量后, 临时 `style.display = ''` 让隐藏 dialog 可见, 收集 bodyText/inputs/btns; 适合"有副作用不敢点"的 dialog
**⚠️ 关键警告 (2026-06-03 SRM-PRO 实测): 上述 JS 派发方案在该站点已不工作！**
- SRM-PRO 用了**前端反作弊拦截**：直接派发 MouseEvent 会被检测，Vue 状态不切换
- 试过的方法（全部失败）：
  - `moveBlock.dispatchEvent(mousedown/move/up)` 30 步 — Vue 不响应
  - 同时派发到 `window` + `document` — Vue 仍不响应
  - 直接改 `style.left` + `barWidth` — 视觉变但状态不变
  - 改 `inst.status = true; inst.isEnd = true; inst.end()` — 状态被 Vue 重置
- **必须用 playwright 物理鼠标**（`page.mouse.move/down/up`），纯 JS 派发已无解
- 判断标准：如果派发 30 步后 `login_disabled` 还是 `true`，就**放弃 JS 路径**，改用 playwright
- 终极方案：跳过滑块，**通过 API endpoint 直接登录**（admin 提供账号时往往能拿到 cookie）

**✅ 但 v1.7.0 发现更稳的方案 - Vue ref 注入 + removeAttribute + click（实测 SRM-PRO 有效）:**

```javascript
// 步骤 1: 找滑块 Vue 实例 (深遍历)
const findInstance = () => {
  const app = document.querySelector('#app').__vue__;
  let target = null;
  const find = (v, depth = 0) => {
    if (depth > 6 || !v || target) return;
    if (v.$refs && v.$refs.instance) { target = v; return; }
    if (v.$children) v.$children.forEach(c => find(c, depth + 1));
  };
  find(app);
  return target?.$refs.instance;
};

// 步骤 2: 改 instance 内部状态（不调 start/move/end，因为 start 内部要 event.stopPropagation）
const inst = findInstance();
if (inst) {
  inst.moveBlockLeft = inst.leftBarWidth;  // 视觉上滑块到右边
  inst.status = true;                        // 状态：成功
  inst.isEnd = true;                          // 状态：结束
  inst.iconClass = 'success';                 // ✅ 图标
  inst.iconColor = '#67c23a';                 // ✅ 绿色
  inst.text = '验证成功';                     // 提示文字
  inst.finishText = '验证成功';
}

// 步骤 3: 关键 - 移除登录按钮的 disabled 属性 (Vue v-bind 还卡着)
const btn = [...document.querySelectorAll('button')]
  .find(b => b.textContent.trim() === '登录');
btn.removeAttribute('disabled');

// 步骤 4: 强制 click 触发登录
btn.click();
// 等待 2.5s 让路由跳转
await new Promise(r => setTimeout(r, 2500));
// URL 应跳到 /index (主页) 或 /404 (登录成功但路由不存在)
```

**核心原理**:
- 步骤 2 让 Vue 实例的内部数据变成"验证成功", 但 v-bind 的 buttonDisabled 不会立刻重算
- 步骤 3 直接移除 HTML 属性, **绕过 v-bind 检查** (这是关键 trick!)
- 步骤 4 触发 Vue 监听的 click 事件, 但按钮 onClick 不会检查 disabled (因为我们强制移除了)

**为什么不调 `inst.end()` / `inst.success()`?**
- 这些方法内部会触发更多 Vue 状态变更, 可能被反作弊重置
- 直接改 `moveBlockLeft/status/isEnd/iconClass` 三个属性更"低层", 副作用更少
- `forceUpdate` 在 v1.7 实测**无效**, Vue 不会重新计算 buttonDisabled

**适用边界:**
- ✅ 自研 verify-move-block 横向滑块 (SRM-PRO / 类似企业 SSO)
- ✅ 滑块 instance 有 `moveBlockLeft / status / isEnd / iconClass / text` 这几个属性
- ❌ 图灵/点选/算式验证码 (需要 OCR)
- ❌ 极验/网易易盾 (有 jsbridge)
- ❌ Google reCAPTCHA v2/v3
- ❌ hCaptcha

**v1.7 vs v1.6 失败方法的对比:**
| 方法 | v1.6 (派发 mouse) | v1.7 (Vue ref + removeAttribute) |
|---|---|---|
| 反作弊拦截 | ❌ 被拦截 | ✅ 绕过 (直接改内部数据) |
| Vue 状态重置 | ❌ 立即重置 | ✅ 状态已对 (改的是终态) |
| 按钮 disabled | ❌ 持续 true | ✅ 强制移除 |
| 依赖 playwright | ❌ 必须 | ✅ 不需要 |
| SRM-PRO 实测 | ❌ 失败 | ✅ 成功登录 |

**实战速查：**
| 信号 | 含义 |
|---|---|
| 页面提示"向右滑动解锁" | 几乎肯定是 verify-move-block |
| 登录按钮 disabled 且无密码错误提示 | 滑块未解锁导致，不是密码错 |
| `style.left` 设了像素值（如 260px）| 滑块已视觉响应但 Vue 状态未必切换 |
| 登录按钮的 class 出现 `is-disabled` | 滑块未解锁 |
| 派发 30 步 MouseEvent 后按钮还 disabled | **反作弊拦截**，换 playwright 物理鼠标 |

### 7. Element UI cascader 三级菜单导航 (2026-06-03 SRM-PRO 实战, 2026-06-03 17:19 补完)

**场景识别：** 顶导菜单 hover/click 后弹出多级 cascader，**子菜单在水平 panel 排列**（不是 popup-in-popup）。

**真实 DOM 结构：**
```html
<button class="menu-btn el-popover__reference">供应商</button>     <!-- L1 顶导 -->
  ↓ hover/click 触发
<div class="el-cascader__dropdown">                                  <!-- el-popover 容器 -->
  <div class="el-cascader-menu">                                    <!-- L2 panel -->
    <div class="el-cascader-node">供应商主数据</div>                 <!-- L2 节点 -->
    <div class="el-cascader-node">供应商认证</div>
    ...
  </div>
  <div class="el-cascader-menu">                                    <!-- L3 panel（仅 L2 节点 hover 时显示）-->
    <div class="el-cascader-node">申请库</div>                       <!-- L3 节点 -->
    <div class="el-cascader-node">资源库</div>
    ...
  </div>
</div>
```

**关键导航技巧：**
1. **不能用 `display: none` 检测可见**——cascader 节点都有 DOM，但 `getBoundingClientRect()` 宽/高 = 0 时才是不可见
2. **必须 hover L2 节点才会展开 L3 panel**——直接 click L2 不会跳，只展开下一级
3. **路由跳转只发生在 click 末级节点时**——L2 click 只展开，L3 click 触发 `router.push`
4. **判断节点是否在可视 panel 的方法**：
   ```javascript
   const visibleNodes = Array.from(document.querySelectorAll('.el-cascader-node'))
     .filter(n => {
       const r = n.getBoundingClientRect();
       return r.width > 0 && r.height > 0;
     });
   ```

**L3 展开的完整事件序列 (实测可复制 — 2026-06-03 补完)：**
```javascript
// 1) 找 L2 节点
const dataNode = Array.from(document.querySelectorAll('.el-cascader-node'))
  .find(n => n.textContent?.trim() === '供应商主数据' && n.getBoundingClientRect().width > 0);
const dRect = dataNode.getBoundingClientRect();

// 2) 派发 hover 三件套 - 关键! 只 mouseenter 不够
['mouseenter', 'mouseover', 'mousemove'].forEach(t => {
  dataNode.dispatchEvent(new MouseEvent(t, {
    bubbles: true, cancelable: true, view: window,
    clientX: dRect.x + 5, clientY: dRect.y + 5  // 必须带坐标! Vue 内部算 mouse distance
  }));
});
await new Promise(r => setTimeout(r, 500));  // 等 Vue 异步展开 L3 panel

// 3) 找 L3 节点 + 派发完整 click 事件链
const appLib = Array.from(document.querySelectorAll('.el-cascader-node'))
  .find(n => n.textContent?.trim() === '申请库' && n.getBoundingClientRect().width > 0);
const aRect = appLib.getBoundingClientRect();
['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'].forEach(t => {
  appLib.dispatchEvent(new MouseEvent(t, {
    bubbles: true, cancelable: true, view: window,
    clientX: aRect.x + 5, clientY: aRect.y + 5, button: 0
  }));
});
appLib.click();
await new Promise(r => setTimeout(r, 2500));
// 此时 URL 才切到 /SupplierManagement/supplier/apply
```

**4 大关键参数：**
1. **mouseenter + mouseover + mousemove 三件套** (只 mouseenter 不会展开)
2. **clientX/Y 必须真实坐标** (Vue 内部算 mouse distance, 0,0 会被忽略)
3. **mousedown 也必须派发** (Vue 路由跳转可能监听 down 事件)
4. **三件套后等 500ms** (Vue 异步展开 L3, 不等就会找不到 L3 节点)

**陷阱：** cascader 节点在 DOM 里**全部存在**（hidden 的也有），用 `document.querySelectorAll` 一次拿全然后 filter 比 click-each-test 高效 10 倍。

**老大截图里的子模块识别模式：** 截图红框 = 末级（L3）菜单的"展开态"——这是企业 SaaS 多级菜单**最常见的视觉干扰源**，建议从截图的 panel 数量推断层级（1 个 panel = L1/L2，2 个 = L3，3 个 = L4）。

**陷阱 #2 (2026-06-03 新发现)：直接 `browser_navigate` 路由 = 假 bug**
- 如果你 `browser_navigate('https://test.esicint.com/SupplierManagement/supplier/apply')` 直接访问路由，**主内容区会空白**（main.innerHTML = 442 bytes）
- 这时如果**不经验证就直接报 P1 严重 bug** = **误报**！因为：
  - 用户实际不会这样操作（必须从 cascader 走）
  - cascader 流程下路由完全正常（main.innerHTML = 41525 bytes）
- **正确做法**: 报 bug 之前**先验证用户路径**（从 cascader 进入）是否也空白
  - 如果 cascader 流程正常 + 直访空白 = **P3 优化级**（可作 chunk loading order 改进项）
  - 如果 cascader 流程也空白 = 真 P1 严重 bug
  - 验证脚本: 见下方关键经验 #8 增补

### 8. Vue Router lazy-load 异常诊断 (2026-06-03 SRM-PRO 发现)

**症状模式：** 路由切换后**主内容区空白**，但框架（顶导/侧栏）正常，**没有任何错误提示**。

**快速诊断 3 步：**
```javascript
// 1) 检查主内容区是否真的空了
const main = document.querySelector('.app-main, .main-container, [class*="main"]');
const isEmpty = !main || main.innerHTML.length < 1000;  // 正常页面应该 10K+ HTML

// 2) 检查 console 异常
const errCount = window.__consoleErrors?.length || 0;  // 或显式 browser_console 看

// 3) 验证路由确实切换了
JSON.stringify({url: location.href, mainEmpty: isEmpty, errCount})
```

**如果 3 步诊断全中**（main < 1000 bytes + errCount > 0 + URL 已切换）：

**根因可能性（按概率）：**
1. **chunk 加载失败**——JS bundle 网络/解析异常，Vue 没法 mount 组件
2. **路由 component import 路径错**——dev/prod 路径不一致
3. **父级 keep-alive 缓存** + 组件内部 v-if 条件——刷新后条件不满足
4. **错误边界没捕获**——mount 失败时 console 报错但 UI 不弹 toast

**对测试的影响：**
- ❌ **从 cascader 一路 click 进入也未必能渲染**（同 chunk 同样失败）
- ✅ 真正能用的方式：直接 `browser_navigate(url)` 强制 SPA fallback
- ⚠️ 报告里**必须把这个列为 P1 严重 issue**（用户刷新/直访都不可用）

**记入 issue 模板：**
```json
{
  "id": "Issue-XXX",
  "title": "<路由名>路由直接访问/刷新时页面空白",
  "severity": "P1-严重",
  "category": "Functional/Routing",
  "repro": [
    "1. 登录",
    "2. 地址栏输入完整 URL",
    "3. 观察主内容区"
  ],
  "evidence": {
    "main_innerHTML_length": 442,
    "console_error_count": 6,
    "url": "<实际 URL>"
  }
}
```

### 10. Element UI 弹框全量检测 (2026-06-03 SRMPRO 申请库探索新发现)

**场景：** 列表页有 N 个按钮，每个按钮弹不同 dialog。**只测点击过的按钮**会漏掉那些**只有特定流程才触发的隐藏弹框**。

**全量检测方法 — 数 `.el-dialog__wrapper`：**
```javascript
// 一行就拿到所有 dialog 模板
const allDialogs = Array.from(document.querySelectorAll('.el-dialog__wrapper')).map(w => {
  const d = w.querySelector('.el-dialog');
  return {
    title: d?.querySelector('.el-dialog__title')?.textContent?.trim(),
    width: d?.getAttribute('style')?.match(/width:\s*(\d+px)/)?.[1],
    hidden: w.getAttribute('style')?.includes('display: none'),
    bodyLen: d?.querySelector('.el-dialog__body')?.innerHTML?.length || 0,
  };
});
```

**关键洞察：** 即使弹框**从未打开过**，它的 wrapper 也在 DOM 里（`display: none`）。通过数 wrapper 数量 = 该页面的弹框总数。

**实战 (SRMPRO 申请库):** 数到 5 个 wrapper = 5 个 dialog：
- 邀请新供应商 (640px) — 列表页"邀请新供应商"按钮触发
- 分享链接给供应商 (500px) — **邀请成功后**触发
- 分享邀请链接 (500px) — **邀请成功后**触发
- 版本 (40%) × 2 — header/footer 触发

**给报告的"待探索弹框"清单模板：**
```markdown
| 弹框名 | 宽度 | 触发方式 | 状态 |
|---|---|---|---|
| 邀请新供应商 | 640px | 列表页"邀请新供应商"按钮 | ✅ 已探索 |
| 分享链接给供应商 | 500px | 邀请成功后弹出 | 🔍 隐藏待探索 |
```

**为什么不主动点开测试？** 因为触发链可能需要"邀请供应商成功"这种**有副作用的操作**（会发邮件）。建议：
- 已知安全触发器 → 主动点
- 副作用大的 → 标"待探索"，让用户确认要不要跑

### 18. el-table DOM 列错位检测 (2026-06-03 SRM-PRO 申请库发现)

**场景:** 列表数据"看起来对"但表头和数据**列对不上**。视觉正常但 el-table 的 column key 配错, 导致数据展示在错误的列下面。SRM-PRO 申请库 v2 实测: 10 行 100% 错位, 但**用户日常不会察觉** (因为数据本身有真实内容)。

**5 步诊断模板 (必备):**

```javascript
// 步骤 1: 找目标表格 (申请库是第 2 张表, 跳过消息列表)
const tables = document.querySelectorAll('.el-table');
const t = tables[1];  // 申请库主表

// 步骤 2: 拿表头顺序
const cols = [...t.querySelectorAll('th')].map((h, i) => ({
  idx: i,
  text: h.textContent.trim(),
  width: h.offsetWidth,
  classes: h.className.substring(0, 40)
}));

// 步骤 3: 拿第一行数据
const firstRow = t.querySelector('tbody tr');
const cells = [...firstRow.querySelectorAll('td')].map((c, i) => ({
  idx: i,
  width: c.offsetWidth,
  text: c.textContent.trim().substring(0, 30)
}));

// 步骤 4: 对比 width 一致性 (同列宽应一致)
const widthMatch = cols.slice(0, -1).every((c, i) => c.width === cells[i].width);

// 步骤 5: 看每行数据, 对比跨行的"同一列"内容是否一致
const rows = [...t.querySelectorAll('tbody tr')];
const rowData = rows.slice(0, 5).map(r =>
  [...r.querySelectorAll('td')].map(c => c.textContent.trim().substring(0, 20))
);

// 错位信号:
// - 多行 col 1 都是同一个固定词 (e.g. "邀请修改" 10 次 = 操作列的按钮文字)
// - 多行 col 2 都是真实供应商名 (e.g. AAA钢材 / ccc / ces) = 应该是供应商名称列
```

**错位 bug 模板 (P1 严重):**

```json
{
  "id": "Issue-005",
  "title": "申请库列表列错位 (操作列内容渲染到供应商名称列)",
  "severity": "P1-严重",
  "category": "Functional/Display",
  "repro": [
    "1. 登录 SRM-PRO",
    "2. cascader → 供应商 → 供应商主数据 → 申请库",
    "3. 观察列表"
  ],
  "evidence": {
    "header_cols": ["(checkbox)", "操作", "供应商名称", "公司网站", "状态", "更新时间", "供应产品名称"],
    "actual_col1_all_rows": "邀请修改 (×10)",
    "actual_col2_all_rows": "真实供应商名 (AAA钢材/ccc/ces/nyxtest1/test完成率/test5/test02/test123456/mailtest/testYang)",
    "root_cause_guess": "el-table column prop 顺序与数据 key 不匹配, 或 column 定义 prop 字段名拼错"
  }
}
```

**为什么用户日常察觉不到:**
- 列表行**视觉上**有"操作"列 (显示"邀请修改"按钮) — 看起来对
- "供应商名称"列显示真实供应商名 — 看起来对
- 但实际上是**操作列的内容渲染到供应商名称列**, **供应商名称列的内容渲染到公司网站列**
- 用户看 row1 = 邀请修改/AAA钢材 ✓, row2 = 邀请修改/ccc ✓, **不会发现"col 1 始终是同一固定词"**
- 只有用 DOM 探针对比表头 vs 内容, 才能 100% 检出

**给报告的"列完整性"清单模板:**

```markdown
| 表头 | col 1 内容（10 行） | col 2 内容（10 行） | col 3 内容（10 行） |
|---|---|---|---|
| 操作 / 供应商名称 / 公司网站 | 邀请修改 ×10 | AAA钢材/ccc/ces/... | (空) |
| **是否错位** | ✅ 错位 | | |
```

### 19. 隐藏 dialog 强制 display 探查技巧 (2026-06-03 SRM-PRO 申请库 4 dialog 实战)

**场景:** 列表页有 N 个 dialog 模板 (`.el-dialog__wrapper`), 但**只测点击过的按钮**会漏掉**只有特定流程才触发的隐藏弹框**。例如"分享链接给供应商"是邀请新供应商**成功之后**才弹, 直接点按钮不会触发。

**为什么不主动点开测试?**
- 部分 dialog 触发链有副作用 (发邮件/写库)
- 不知道触发条件就乱点, 可能造成脏数据
- 客户/老板的环境不能乱搞

**强制 display 探查模板:**

```javascript
// 步骤 1: 数所有 dialog wrapper (关键经验 #10 复盘)
const allDialogs = [...document.querySelectorAll('.el-dialog__wrapper')];
const inventory = allDialogs.map(d => ({
  title: d.querySelector('.el-dialog__title')?.textContent?.trim(),
  width: d.querySelector('.el-dialog')?.offsetWidth,
  display: d.style.display,
  hidden: d.getAttribute('style')?.includes('display: none'),
  bodyText: d.querySelector('.el-dialog__body')?.textContent?.trim().substring(0, 200),
  inputs: [...d.querySelectorAll('.el-input__inner')].map(i => i.placeholder || i.type),
  btns: [...d.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t && t.length < 12)
}));

// 步骤 2: 强制 display 让所有 dialog 可见 (用于截图/详细探查)
allDialogs.forEach(d => d.style.display = '');
// 但注意: offsetParent 仍可能 null (因为父 wrapper 是 display: none)
// 所以 bodyText 仍然能拿, 截图不一定能看到
```

**SRM-PRO 申请库实战结果 (4 个 dialog 全识别):**

| Dialog | 宽度 | 触发器 | inputs | btns |
|---|---|---|---|---|
| 邀请新供应商 | 640px | 顶部"邀请新供应商"按钮 | 联系人/邮件地址/供应商名称 | 取消/发送邀请邮件 |
| 分享链接给供应商 | 500px | 行操作"邀请修改" | (单 input, 标签"邀请邮件地址") | 取消/提交 |
| 分享邀请链接 | 500px | 邀请成功后 | (无 input) | 取消/复制 |
| 版本 | 506px | header/footer 触发 | (无 input) | 确定 |

**为什么用 bodyText 探查足够:**
- 即使 dialog 不可见, DOM 里的 `.el-dialog__body` 内容已渲染
- 拿到 `bodyText` 就知道"这个 dialog 是干什么的"
- 截图可以**强制 display** 后截, 但 vision 对中文识别率低, **不如 DOM 探查**

**给报告的"待探索 dialog"清单模板:**

```markdown
| 弹框名 | 宽度 | 触发方式 | 状态 |
|---|---|---|---|
| 邀请新供应商 | 640px | 列表页按钮 | ✅ 已探索 |
| 分享链接给供应商 | 500px | 邀请成功后 | 🔍 隐藏待探索 |
| 分享邀请链接 | 500px | 邀请成功后 | 🔍 隐藏待探索 |
| 版本 | 506px ×2 | header/footer | ⏭️ 跳过（系统弹窗）|
```

**⚠️ 副作用警告:** 主动 click 触发 dialog 之前**先评估副作用**:
- ✅ 安全: 邀请新供应商填测试邮箱 (admin@xxx.com, 后端会拒绝但不发邮件)
- ⚠️ 中等: 分享链接给供应商填合法邮箱 → 会真发邮件
- ❌ 危险: 任何 "创建/删除/修改" 类弹窗, 会真改后端数据
- **判断标准**: dialog 标题含"邀请/分享/预览"= 安全; 含"创建/删除/确认"= 危险

### 20. session 断线恢复 (2026-06-03 SRM-PRO 申请库探索实战)

**场景:** 浏览器在某次 `browser_navigate` 后被重置到 `about:blank`, 或 session 过期, 或刷新掉登录态。**常见原因:**
- 上一次探索调用了 `browser_navigate('about:blank')` 显式重置
- sessionStorage/cookie 被清
- 浏览器超过 N 分钟无活动被服务端踢

**快速诊断:**

```javascript
JSON.stringify({url: location.href, title: document.title, mainLen: document.body.innerHTML.length})
// url=about:blank + mainLen=0 = session 断线
```

**恢复步骤 (3 步搞定, 不需要走 cascader):**

```bash
# 步骤 1: 直接 navigate 业务路由 (绕过 cascader)
browser_navigate("https://test.esicint.com/SupplierManagement/supplier/apply")

# 步骤 2: 会跳到登录页, 重复滑块 + 登录 5 步法
# (账号密码 + 滑块 Vue ref 注入 + removeAttribute disabled + click)

# 步骤 3: 等待 2.5s, URL 应直接跳回业务路由 (带 session)
# 然后继续探索
```

**为什么不需要走 cascader:**
- 业务路由 `/SupplierManagement/supplier/apply` 是**纯路径**, 不依赖 cascader 状态
- 登录后 Vue Router 会**自动重定向**回原 URL (因为带了 `?redirect=` 参数)
- 整个框架 (顶导/侧栏/cascader) 会自动加载
- 节省 30 秒 cascader hover 时间

**session 保持的标志:**
- 登录后 `document.cookie` 包含 SESSION/TOKEN
- `localStorage` 有 vuex/pinia 持久化数据
- URL 从 `/login?redirect=...` 自动跳回原业务路由
- main.innerHTML > 100K (框架已加载)

**踩坑 (2026-06-03):** 一次"想看 cascader hover 状态"误操作 `browser_navigate('about:blank')` 把整个 session 重置了, 后续每次 browser_navigate 都跳登录页。**教训: 调试时**别主动 navigate 到 about:blank, 用 DOM 探测 / console / visibility 切换代替。

**老大偏好沉淀:** 老大说"恢复时从 active 中拿任务继续, 不重头开始", 所以 session 断线后**优先恢复业务路由**, 不要浪费时间重做 cascader 导航。

**给 todo 系统的恢复信号:**
- `active.md` 有任务但 session 断线 → **先 session 恢复** → 再继续
- 步骤: 1) 验证登录态 2) 滑块 + 登录 3) navigate 业务路由 4) 检查 active 任务状态 5) 继续执行

**核心场景：** 弹框表单点提交 → 触发表单校验 → 错误消息显示。

**3 类校验触发方式：**
1. **空白提交**：必填字段不填，直接点提交
2. **格式错误**：填了值但格式错（如邮箱不是邮箱）
3. **联动校验**：填了字段 A 才校验字段 B（如"确认密码"）

**触发空白校验的标准模板：**
```javascript
// 找提交按钮
const submitBtn = Array.from(document.querySelectorAll('.el-dialog button'))
  .find(b => b.textContent?.trim() === '发送邀请邮件');

// 派发 click (含真实坐标)
const r = submitBtn.getBoundingClientRect();
submitBtn.dispatchEvent(new MouseEvent('click', {
  bubbles: true, cancelable: true, view: window,
  clientX: r.x + 10, clientY: r.y + 10, button: 0
}));
submitBtn.click();  // 双保险
await new Promise(r => setTimeout(r, 800));

// 收集错误消息
const errorMsgs = Array.from(document.querySelectorAll('.el-form-item__error'))
  .map(e => e.textContent?.trim()).filter(Boolean);
```

**错误消息格式异常检测：**
```javascript
// 国际化配置 bug 模式：error 消息只有 label，没有描述
if (errorMsgs.includes('联系人') && errorMsgs.includes('供应商名称')) {
  // 错误！应该是 "请输入联系人" / "请输入供应商名称"
  // 实际显示是 label 名 → 国际化 key 配错
}
```

**填数据触发格式校验：**
```javascript
const inputs = Array.from(document.querySelectorAll('.el-dialog input'));
const sampleData = ['张三', 'invalid-email', '测试供应商有限公司'];
inputs.forEach((inp, i) => {
  inp.focus();
  inp.value = sampleData[i];
  // 触发 Vue v-model 监听
  inp.dispatchEvent(new Event('input', {bubbles: true}));
  inp.dispatchEvent(new Event('change', {bubbles: true}));
});
// 触发 blur 让校验
inputs.forEach(i => i.dispatchEvent(new Event('blur', {bubbles: true})));
await new Promise(r => setTimeout(r, 500));
```

**取消/关闭弹框验证：**
```javascript
// 点击取消
const cancelBtn = Array.from(document.querySelectorAll('.el-dialog button'))
  .find(b => b.textContent?.trim() === '取消');
cancelBtn.click();
await new Promise(r => setTimeout(r, 800));

// 验证所有 wrapper 都是 display: none
const stillOpen = Array.from(document.querySelectorAll('.el-dialog__wrapper'))
  .some(w => !w.getAttribute('style')?.includes('display: none'));
```

**Issue 模板（错误提示格式不完整 P3 轻微）：**
```json
{
  "id": "Issue-XXX",
  "title": "<弹框名>必填错误提示格式不完整",
  "severity": "P3-轻微",
  "category": "UX/Internationalization",
  "repro": [
    "1. 进入 <页面>",
    "2. 点击 <按钮>",
    "3. 弹框打开",
    "4. 空白直接点提交"
  ],
  "evidence": {
    "errorMsgs": ["联系人", "邮箱格式不正确", "供应商名称"],
    "expected": ["请输入联系人", "邮箱格式不正确", "请输入供应商名称"]
  },
  "root_cause_guess": "i18n key 配错, requiredMessage 未设"
}
```

### 9. Worker 状态监控 vs 真实执行的"两层皮"问题 (2026-06-03 AI Todo 协同实战)

**场景：** 测测有"AI Todo 协同系统"——`coordinator.py` 后台心跳读 `todo_active.md` 显示"3 个 active 任务运行中"，但**实际去跑那些任务的 worker 不存在**（可能用 `delegate_task` 一次性跑了，没留后台进程）。

**陷阱：**
- ❌ 看到 `coordinator status` 显示"🟢 运行中"就以为有 worker 跑——**不是！coordinator 是"心跳监控"，不是"任务执行器"**
- ❌ 看到 `A001 last seen: 16:53:50`（30 秒前）就以为 worker 还活着——**那是 todo_active.md 文件最后修改时间，不是 worker 进程心跳**

**正确诊断方法：**
```bash
# 1) 看 coordinator 是不是只看文件
ps -ef | grep coordinator.py
# 看到 coordinator 进程 = 监控在跑

# 2) 看真正干活的 worker 进程存不存在
ps -ef | grep -E "browser|chromium|playwright" | grep -v grep
# 没有 = worker 实际没跑

# 3) 看 worker 的实际工作目录 / 输出文件
ls /tmp/worker-A001/ 2>/dev/null  # 实际产出
```

**写进 issue 报告时：** 必须**区分**"系统层监控状态"和"实际执行状态"——前者看 `coordinator status`（存活），后者看 `ps`/`ls`（真在做）。

**修复方案：** coordinator 改成**真后台 worker**——用 `nohup browser-use ... &` 启真实进程，PID 写入 worker 状态文件，coordinator 同时检查 PID 存活和文件 mtime。

