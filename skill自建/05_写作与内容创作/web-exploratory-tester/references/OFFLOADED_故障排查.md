## 故障排查

| 问题 | 解决方案 |
|---|---|
| 浏览器一片空白 | 等待 5 秒让 JS 跑完；或检查 Turnstile 验证 |
| vision 瞎描述 | 忽略内容，**用 DOM snapshot 重新分析** |
| 找不到路由 | 抓 JS bundle 用 grep 找 `path:` / `route:` 模式 |
| API 全返回 200 | 几乎一定是 SPA fallback，**主动 curl 后端 endpoint** |
| Cloudflare 403 | 加 User-Agent 头 + 等待 |
| 登录按钮一直 disabled | 查页面是否有"滑动解锁"，按"关键经验 #6 + #29"模板解锁（v1.7 策略实测最稳）|
| 工具调用撞 120 次上限 | 按 #23 收尾 (写报告/done/启动下一个), 用 #27 5 步恢复 |
| vision 持续说"未收到截图" | 截图实际已生成, 复制到过程数据目录即可 (#28) |
| cascader 展开后 L3 click 不导航 | hover L2 节点需要 mouseenter+mouseover+mousemove 三件套 (#7) |
| cascader 找不到节点 | 用 getBoundingClientRect().width>0 过滤可见节点 (#7) |
| session 断线 (about:blank) | 直接 navigate 业务路由 + 滑块 + 登录, 不重走 cascader (#20) |
| 资源库"暂无数据" | 必须先在综合搜索框输入关键词 + 点搜索 (#新发现) |
| todo 文件找不到 | 实际命名是 `todo_active.md`/`todo_next.md`/`todo_fin.md`/`todo_cancel.md`，**带 todo_ 前缀**（#30）|
| compaction 后 active 状态不明 | 立刻 `cat todo_active.md` 确认 active，再 `tail todo_fin.md` 验证上一个 done (#31) |
| 滑块拖动视觉变但 Vue 不响应 | v1.2 dispatchEvent 失效；改用 v1.7 Vue ref + removeAttribute 方案 (#29) |
| `inst.start()` 报 `e.stopPropagation is not a function` | 必须传 event-like 对象（含 stopPropagation 方法），不是裸 `{x,y}` (#29) |
| 滑块视觉成功 + 按钮 enabled + 请求发出，但 loginForm.code="" | v1.7 漏了 Login 父组件；改用 v1.8 手动设 owner.loginForm.code + uuid (#33) |
| v1.7/v1.8 反复设 code 被 Vue 重置 | 滑块有 watcher；走回调方案 A 或 API 方案 B (#33) |

### 29. 滑块 v1.7 策略完整模板 — Vue ref 注入 + removeAttribute + click (2026-06-03 SRM-PRO 实测)

**前置识别：什么时候用 v1.7 而不是 v1.2？**
- v1.2 (`dispatchEvent` mouse 三件套): 简单站点 OK，但 SRM-PRO 这类**有前端反作弊的**不工作
- 判断信号：派发 30 步后 `moveBlock.style.left` 有变化（视觉上动了）但 `login_disabled` 还是 `true` → 派发路径被反作弊拦截，**直接换 v1.7**
- 派发抛 `e.stopPropagation is not a function` → 说明滑块实例要的是 Event-like 对象，不是裸 `{x,y}`，**也换 v1.7**

**v1.7 完整模板（4 步，30 秒搞定）：**

```javascript
// 步骤 1: 找滑块 Vue 实例
// 关键路径：DOM element → el.__vue__ → __vue__.$parent (链式向上)
//          在每一层检查是否有 start/move/end 方法
(function findSlider() {
  let el = document.querySelector('.verify-move-block');
  let depth = 0;
  while (el && depth < 10) {
    if (el.__vue__ && typeof el.__vue__.start === 'function') {
      window.__sliderInst = el.__vue__;  // 缓存
      return depth;
    }
    el = el.__vue__?.$parent || el.parentElement;
    depth++;
  }
  return -1;
})()

// 步骤 2: 直接改内部数据属性（绕过反作弊对 method 调用的拦截）
const inst = window.__sliderInst;
if (inst) {
  inst.moveBlockLeft = inst.leftBarWidth;  // 视觉：滑块到右边
  inst.status = true;                       // 状态：成功
  inst.isEnd = true;                         // 状态：结束
  inst.iconClass = 'success';                // ✅ 绿色勾
  inst.iconColor = '#67c23a';
  inst.text = '验证成功';
  inst.finishText = '验证成功';
}

// 步骤 3: 强制移除登录按钮的 disabled（绕过 v-bind 的 buttonDisabled 重算）
const btn = [...document.querySelectorAll('button')]
  .find(b => b.textContent.trim() === '登录');
btn.removeAttribute('disabled');

// 步骤 4: 触发登录 click
btn.click();
// 等 2.5s 看 URL 跳没跳
```

**为什么 v1.7 比 v1.2/v1.6 都稳？**

| 维度 | v1.2 (dispatch) | v1.6 (Vue 调 start) | v1.7 (改 data + 移除 disabled) |
|---|---|---|---|
| 反作弊拦截 method | ❌ | ❌ 调 start 抛 stopPropagation 错 | ✅ 改的是终态 data，method 根本不调 |
| Vue 状态重置 | ❌ dispatch 完 Vue 不更新 | ❌ inst.end() 触发更多重置 | ✅ data 已对，不依赖响应式 |
| 按钮 disabled 解除 | ❌ 派发后 v-bind 不重算 | ❌ 同上 | ✅ 物理移除 HTML 属性 |
| SRM-PRO 实测 | ❌ | ❌ | ✅ |

**关键 trick：为什么步骤 3（removeAttribute）是灵魂？**
- 滑块验证成功后，Vue 会把 `loginDisabled = false` 写回按钮
- 但 v-bind 的 class/style 重算有时延（nextTick）
- 物理 `removeAttribute('disabled')` 直接改 DOM，**Vue 不会撤销**
- 后续 `btn.click()` 触发的是原生 click，不检查 v-bind 状态

**为什么用 `__vue__.$parent` 链而不是 `__vue__.$refs.instance`？**
- 经验上滑块实例的 start/move/end 直接挂在 el.__vue__ 上
- `$refs.instance` 是项目特定路径（如申请库的引用方式），不一定通用
- 直接检测 method 存在更鲁棒

**复用价值：**
- 这个模式适用于**所有"前端反作弊拦截 + 后端无验证"**的 verify 类滑块
- 不需要 playwright 物理鼠标（那需要 puppeteer 桥接）
- 不需要破解图形验证码/点选/算式

### 33. 滑块 v1.8 终极方案 — 绕过滑块改 Login 父组件 loginForm (2026-06-03 23:15 SRM-PRO 实测)

**前置识别：v1.7 都不够的信号：**
- ✅ 滑块视觉变绿（left:263px + 绿色背景 + ✅ icon）
- ✅ 登录按钮 `removeAttribute('disabled')` 成功
- ✅ `btn.click()` 触发请求 `/admin-api/system/auth/login`
- ❌ **但请求 body 里 `code=""` 和 `uuid=""` 仍是空字符串**
- ❌ 后端静默拒绝（不报错、页面不跳）

**根本原因：**
- v1.7 只改了**滑块组件内部 data**（visual/state 看起来成功了）
- 但**真正决定请求 body 的是 Login 父组件的 `loginForm.code` 和 `loginForm.uuid` 字段**
- 这两个字段由**滑块的 success 回调**（`parent.$emit('success', {isPassing:true})`）注入
- v1.7 路径**绕过了这个回调**，所以 code/uuid 没注入
- 后端校验 code 失败 → 静默拒绝（前端不发错 toast）

**v1.8 完整模板（5 步，30 秒搞定，**实测 SRM-PRO 有效**）：**

```javascript
// 步骤 1: 找 Login 父组件（不是 verify 父组件！）
// 关键路径：document.querySelector('.el-form') → __vue__ → 沿 $parent 链找 loginForm 字段
(function findLoginForm() {
  const form = document.querySelector('.el-form');
  let p = form?.__vue__;
  let depth = 0;
  while (p && depth < 10) {
    if (p.loginForm) {
      window.__loginFormOwner = p;  // 缓存
      return { depth, hasCode: p.loginForm.code !== undefined, hasUuid: p.loginForm.uuid !== undefined };
    }
    p = p.$parent;
    depth++;
  }
  return { error: 'no loginForm found' };
})();

// 步骤 2: 直接设 loginForm.code + uuid（绕过滑块）
const owner = window.__loginFormOwner;
if (owner) {
  owner.loginForm.code = '1234';        // ⭐ 关键: 填 loginForm.code
  owner.loginForm.uuid = 'test-uuid';   // ⭐ 关键: 填 loginForm.uuid
  owner.$forceUpdate();                  // 触发响应式更新
  return { code: owner.loginForm.code, uuid: owner.loginForm.uuid };
}

// 步骤 3: 移除 disabled（v1.7 套路继承）
const btn = [...document.querySelectorAll('button')]
  .find(b => b.textContent.trim() === '登录');
btn.removeAttribute('disabled');

// 步骤 4: 强制 click
btn.click();

// 步骤 5: 等待 2.5s 验证
// URL 应跳到 /index (主页) 或业务路由
// network 里 auth/login 请求的 body 应包含 "code":"1234"
```

**为什么 v1.8 必杀 v1.7？**

| 维度 | v1.7 (改 verify instance) | v1.8 (改 Login loginForm) |
|---|---|---|
| 改的位置 | 滑块组件内部 data | Login 父组件的 form data |
| 触发回调 | ❌ 没触发 parent.$emit('success') | ✅ loginForm 直接 set |
| loginForm.code 注入 | ❌ 空字符串 | ✅ 真值 |
| 后端 code 校验 | ❌ 失败 | ✅ 通过 |
| 适用场景 | 滑块回调能 emit 成功事件 | **滑块回调被反作弊拦截** |
| SRM-PRO 实测 | ❌ 仍被拒 | ✅ 登录成功 |

**备选方案 A：用滑块回调注入（更优雅）**

如果 v1.8 直接设 code 不行（后端要真值），可尝试让滑块 emit success 事件让回调自动填：

```javascript
// 找 verify 父组件 emit success
let el = document.querySelector('.verify-move-block');
let v = null;
while (el) {
  if (el.__vue__?.$parent?.$listeners?.success) { v = el.__vue__.$parent; break; }
  el = el.__vue__?.$parent || el.parentElement;
}
v?.$emit('success', { isPassing: true, code: '1234', uuid: 'test-uuid' });
```

**备选方案 B：根本绕过（最快）**

如果目标是直接登录拿业务数据，**别走滑块**了：

```bash
# 1) curl 后端 login API，绕过前端滑块
curl -X POST https://test.esicint.com/admin-api/system/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"xxx","code":"","uuid":""}'

# 2) 拿到 Set-Cookie: SESSION=xxx; 写入浏览器 cookie
# 3) browser_navigate 到业务路由，session 自动带过去
```

**v1.8 故障排查信号对照表：**

| 信号 | 含义 | 下一步 |
|---|---|---|
| 滑块 left=263px + 绿色 | 视觉成功 | 继续验证 loginForm |
| loginForm.code="" | 滑块回调没触发 | 改用 v1.8 手动设 |
| loginForm.code 有值但请求体 code="" | 数据绑定有问题 | 调 owner.$forceUpdate() |
| 请求发出但被静默拒 | 后端 code 校验失败 | 备选方案 B: 走 API |
| 反复设值被 Vue 重置 | 滑块有 watcher | 备选方案 A: 走回调 |

**复用价值（类级别）：**
- ✅ 适用于**所有**"verify 滑块有反作弊 + Login 组件用 loginForm 收集 code"的场景
- ✅ 不需要破解图形验证码/点选/算式
- ✅ 不需要 playwright 物理鼠标
- ❌ **不适用** Login 组件不暴露 loginForm（用 vuex 集中管理）的场景——那是更深的反爬

### 30. ai-todo 4 文件命名约定 (2026-06-03 实战踩坑)

**坑：** 以为 todo 文件叫 `active.md`/`next.md`/`fin.md`/`cancel.md`，实际命名是：

```bash
# ✅ 正确
~/aitodolist/todo_active.md
~/aitodolist/todo_next.md
~/aitodolist/todo_fin.md
~/aitodolist/todo_cancel.md

# ❌ 错误（会导致 read_file 报 not found）
~/aitodolist/active.md
```

**前缀带 `todo_` 的原因：** 4 文件架构里 `todo_` 前缀让 `ls ~/aitodolist/` 一眼分清"todo 文件 vs 脚本/日志"。

**验证脚本：**
```bash
ls ~/aitodolist/todo_*.md
# 应输出 4 个文件
```

### 32. 被测系统专属脚本的归宿 (2026-06-03 老大反馈)

**踩坑：** 写完 `srmpro_login.py` 后**默认放到了 `~/aitodolist/`**，老大立刻纠正：

> "保存在 SRMPRO 里面啊，不是待办事项里面"

**类识别（适用于所有被测系统）：**
- 任何**对被测系统做的可复用脚本资产**（登录封装、导航助手、组件选择器库、API 探测封装）
- 不应放在 agent 自己的 todo/memo 目录（`~/aitodolist/`、`~/.hermes/memory/`）
- 应该放在**被测系统项目目录**的 `测试过程数据/00_通用工具/` 子目录里

**目录约定模板：**

```
<被测系统项目根>/                          # e.g. SRMPRO
├── 测测测试方法论/<子模块>/                  # 方法论沉淀
├── 测试报告/<子模块>/                       # dogfood 报告
└── 测试过程数据/
    ├── 00_通用工具/                        # ⭐ 项目级可复用脚本
    │   ├── srmpro_login.py                # 登录封装（含滑块 5 步法）
    │   ├── cascader_navigator.py          # cascader 三级导航
    │   └── common_selectors.py            # 公共组件选择器库
    └── <日期>_<系统>/
        ├── 01_<子模块>/v1_浅层探索/
        ├── 02_<子模块>/v2_4层深度/
        └── ...
```

**为什么必须这样分类：**
- ✅ 脚本跟项目走，**项目换了/停了/交付了**，脚本一并交付
- ✅ 项目其他人/AI 接替时，一眼看到 `00_通用工具/` 知道这是"基础设施"
- ✅ 不要污染 `aitodolist/`（那是 agent 自己的事）
- ❌ 反模式：把项目脚本放 `~/aitodolist/` → 老大问"我 SRMPRO 资产呢？"→ 找不到

**触发条件（什么时候想起来要这么做）：**
- 写"这个系统以后还会用到"的脚本（登录/导航/公共 helper）
- 老大说"你以后还要做 XX 项目类似的事"
- 看到自己无意识地把脚本放 `~/aitodolist/` 或 `~/.hermes/`

**老大原话**："每次登录为什么要重新做呢，可以做成固定的脚本吗？"——意味着**老大期望这种脚本是"项目的一部分"**，不是"agent 的备忘"。

**对应到 4 文件夹报告架构（#15）的扩展：**

```
3 文件夹 + 1 通用工具 = 完整的项目资产结构
├─ 测测测试方法论/        # AI 自己看
├─ 测试报告/              # 人看
├─ 测试过程数据/00_通用工具/  # 项目可复用脚本 ⭐ 新增
└─ 测试过程数据/<日期>/     # 原始过程数据
```

**故障排查表新增：**

| 问题 | 解决方案 |
|---|---|
| 脚本该放哪？| 被测系统项目目录的 `测试过程数据/00_通用工具/`，**不**是 `~/aitodolist/`（#32）|

### 31. 上下文压缩后恢复 5 步 (2026-06-03 实战)

**场景：** session 上下文撞上限被压缩，**不要假设** active 任务状态 = 之前记得的。必须**显式验证**。

```bash
# 步骤 1: 状态总览
cd ~/aitodolist && python3 todo_manager.py status
# 输出: active 1 / next 25 / cancel 5 / fin 12

# 步骤 2: 读 active（验证进行中任务）
cat ~/aitodolist/todo_active.md

# 步骤 3: 读 fin 末尾（验证最后完成时间）
tail -30 ~/aitodolist/todo_fin.md

# 步骤 4: 读 next 头部（看下一个该做的）
head -20 ~/aitodolist/todo_next.md

# 步骤 5: 检查浏览器 session
browser_navigate 业务路由  # 可能要滑块 + 登录
```

**5 步不能省：** 任何一步省略都可能导致：
- ❌ 重复 start 已 active 任务（覆盖进度）
- ❌ 重复 done 已完成任务
- ❌ 跳过该 start 的下一个任务
- ❌ session 断了误以为还在

**老大偏好：** 老大说"恢复" = 从 active 拿，不重头。5 步验证是底线。

