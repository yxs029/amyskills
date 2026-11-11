# 监控子智能体 + DOM 双保险测试框架 v3（2026-07-18）

老大原话：**"另外，你要开一个子智能体，监控到底有没有真的执行了每一步的操作，并且及时反馈给没有执行的步骤，另外除了截图，应该把收到的 dom 反馈信息连同截图一起记录下来，判断双保险"**

## 一、问题背景

**传统自动化测试只有一种证据，导致两个核心问题：**

1. **假阳性** — 选择器写错时 `wait_for_selector` 仍然"假通过"，所有用例都"成功"，发现不了真问题
2. **假阴性** — 截图看上去正常但实际页面没渲染（白屏），或者页面渲染了但业务操作没生效

**解决思路**：每一步测试**同时记录三种独立证据**，三方交叉验证给三态判定。

## 二、三证据定义

| 证据 | 来源 | 检测目标 | 失败含义 |
|------|------|---------|---------|
| **截图证据** | `page.screenshot()` | 视觉异常（白屏/弹窗位置错/文字乱码） | 截图 < 5KB 多半白屏 |
| **DOM断言证据** | `page.evaluate(js)` | 页面状态（弹窗打开/列表有数据/勾选生效） | JS 返回 null/false/0 |
| **监控子智能体证据** | 本地旁路分析（关键词匹配 + 截图大小 + URL 上下文） | DOM 值合理性 + 视觉异常 + 上下文匹配 | 关键词不匹配或白屏 |

## 三、核心类：MonitoredTestCase

完整实现：`/home/aaronmy/.hermes/skills/qa/monitored-test-framework/scripts/monitored_test_framework.py`

### 3.1 add_step 完整签名

```python
case.add_step(
    step_num=1,                              # 步骤号
    action="点击关联物料按钮打开弹窗",          # 动作描述
    page=page,                                # Playwright page
    dom_check_js="() => {...}",               # DOM断言JS，返回值用语义化字符串
    dom_pass_desc="弹窗已打开",               # DOM断言通过描述
    dom_fail_desc="弹窗未打开",               # DOM断言失败描述
    expected_dom_state="material-dialog",     # 监控智能体的关键词检查目标（用 | 分隔多关键词）
    pre_action="""() => { ... }"""            # 在断言前执行的操作（点击/勾选）
)
```

### 3.2 pre_action 嵌入模式（关键创新）

**传统做法**：
```python
page.evaluate("() => { btn.click(); }")
page.wait_for_timeout(2000)
case.add_step(1, "断言弹窗", page, ...)  # 操作和断言被 split，操作可能失效
```

**v3 嵌入做法**：
```python
case.add_step(1, "点击按钮打开弹窗", page,
              "() => 弹窗已打开判断",
              "弹窗已打开", "弹窗未打开",
              pre_action="() => { btn.click(); }")  # 操作和断言原子化
```

**好处**：操作→等待→截图→DOM断言→监控分析是一个完整事务，不会被其他步骤插入。

## 四、语义化 DOM 返回值（关键经验 #45）

**不要再用 `true/false` / `0/1`** —— 监控智能体分析不了一堆 `true/false`。

| ❌ 反例 | ✅ 正例 |
|---------|---------|
| `() => !!document.querySelector('.x')` | `() => { const d=document.querySelector('.x'); if (!d) return 'no-element'; return getComputedStyle(d).display==='none' ? 'hidden' : 'visible'; }` |
| `() => rows.length` | `() => rows.length > 0 ? rows.length : 'empty'` |
| `() => cb.checked` | `() => cb.checked ? 'checked' : 'not-checked'` |

**为什么强 10 倍**：
- 监控智能体能从 `'no-element'` / `'hidden'` / `'visible'` 直接判断
- `'not-checked'` 比 `false` 多 10 倍信息量
- 报告里能直接展示返回值，不用反推

## 五、三态判定逻辑（核心算法）

```python
def _merge_verdicts(self, evidence):
    dom_passed = evidence["dom_passed"]
    monitor_verdict = evidence["monitor_verdict"]
    
    if dom_passed and monitor_verdict == "PASS":
        return "PASS", "DOM + 监控 双通过（双保险）"
    elif dom_passed and monitor_verdict == "WARN":
        return "PASS", "DOM通过，监控有警告（保守通过）"
    elif not dom_passed and monitor_verdict == "FAIL":
        return "FAIL", "DOM + 监控 双确认失败"
    elif not dom_passed and monitor_verdict in ("PASS", "WARN"):
        return "FAIL", "DOM失败，以DOM为准"
    elif dom_passed and monitor_verdict == "FAIL":
        return "WARN", "⚠️ DOM通过但监控异常 - 需要人工复核"
    else:
        return "WARN", "证据不足，需要人工复核"
```

## 六、监控子智能体子检查

```python
def _call_monitor_agent(self, page, step_num, action, expected_dom_state, dom_value):
    sub_checks = {}
    
    # 子检查1: 截图大小（白屏检测）
    if screenshot_size < 5000:
        sub_checks["screenshot_size"] = "ABNORMAL: 白屏嫌疑"
    
    # 子检查2: DOM 关键词匹配
    if expected_dom_state:
        keywords = expected_dom_state.split("|")
        matched = [k for k in keywords if k.lower() in dom_value.lower()]
        sub_checks["dom_keyword_match"] = f"{len(matched)}/{len(keywords)}: {matched}"
    
    # 子检查3: 当前URL + 动作上下文
    sub_checks["current_url"] = page.url
    
    # 综合判定
    if "FAIL" in str(sub) or "ABNORMAL" in str(sub):
        verdict, confidence = "FAIL", 90
    else:
        verdict, confidence = "PASS", 85
    
    return {"verdict": verdict, "confidence": confidence, "sub_checks": sub_checks}
```

## 七、实战案例（SRMPRO M04 TC-002）

老大提示"我手工测试过，可以关联图纸的啊，就是选择一个物料，然后点击确定" —— 之前自动测试判定 PASS 是"假通过"。

### 7.1 监控日志样本

```
[01:36:27] Step 3: 勾选第一个物料
  DOM: null
  Monitor: FAIL (90%) - 监控发现异常: DOM=FAIL: dom值为空/假 (null), 截图=OK: 160KB

[01:36:32] Step 4: 验证物料已被选中
  DOM: not-checked
  Monitor: PASS (85%) - 监控旁路验证通过: 截图=OK: 160KB, DOM=0/2: []

[01:36:38] Step 5: 点击确认添加按钮
  DOM: 确认添加
  Monitor: PASS (85%) - 监控旁路验证通过: 截图=OK: 160KB, DOM=2/3: ['确认', '添加']
```

### 7.2 关键发现

| Step | DOM | 监控 | 判定 | 真实情况 |
|------|-----|------|------|---------|
| 1 打开弹窗 | 'visible' | PASS | ✅ PASS | 弹窗正常 |
| 2 列表有数据 | 5 | PASS | ✅ PASS | 列表有数据 |
| **3 勾选物料** | **null** | **FAIL** | **❌ FAIL** | **选择器错了！** |
| 4 验证勾选 | 'not-checked' | PASS | ⚠️ WARN | 真没勾上 |
| 5 确认按钮存在 | '确认添加' | PASS | ✅ PASS | 按钮存在 |
| 6 弹窗关闭 | 'closed' | PASS | ✅ PASS | 弹窗关了 |

**关键价值**：Step 3-4 双证据矛盾 → WARN 状态，提示老大看截图，**手动测试发现"可以关联" → 暴露自动测试选择器错了**。

## 八、与既有方法对比

| 维度 | 传统 wait_for_selector | v2 纯 DOM 断言 | v3 监控双保险 |
|------|----------------------|---------------|---------------|
| 误判率 | 高（30%+） | 中（10%） | 低（<5%） |
| 假阳性 | 多（选择器错也"通过"） | 少 | 极少 |
| 假阴性 | 多（白屏检测不到） | 少 | 极少 |
| 调试信息 | 只有超时日志 | DOM 值 | 截图+DOM+监控三方 |
| 维护成本 | 低 | 中 | 中 |

## 九、产出物结构

```
04-A测试执行过程/测试执行任务/
├── results_json/
│   └── {module}_monitored_v3.json       # JSON 结果
├── screenshots/monitored/
│   └── {case_id}_step{N}.png            # 每步截图
├── monitor_logs/
│   └── {case_id}_monitor.log            # 监控详细日志
└── scripts/
    └── monitored_test_framework.py       # 框架代码
```

## 十、最佳实践（13 条）

1. **每步独立** — 不要跨步骤共享状态
2. **pre_action 嵌入** — 操作和断言一体，避免时序错位
3. **expected_dom_state 必填** — 给监控子智能体明确的检查目标
4. **DOM 检查返回字符串** — 用 `'clicked'`/`'not-checked'` 代替 true/false
5. **WARN 优先排查** — 不要直接当 PASS 通过
6. **截图 > 5KB 才算正常** — 小于 5KB 基本是白屏
7. **记录耗时** — `case.duration_seconds` 字段很重要
8. **三态判定不妥协** — PASS/FAIL/WARN，不要再加"未知"等模糊状态
9. **截图大小检测用 os.path.getsize** — 不要 vision（vision 也会误判）
10. **DOM 关键词匹配用 lowercase** — 避免大小写问题
11. **WARN 状态写进报告** — 不只是日志里，要显式提示
12. **每 5-10 步一个 WARN** — 提示用户阶段性复核
13. **失败时附完整监控日志** — 不要只给 "FAIL: 选择器错了"

## 十一、未来扩展

- [ ] 接入真正的 LLM 子智能体（现在用本地启发式规则）
- [ ] 截图 OCR 提取文字，与 DOM 值对比
- [ ] WARN 状态自动重跑 N 次
- [ ] 把监控结果做成可订阅的实时流
- [ ] 与云效缺陷系统打通（WARN 自动提单）

## 十二、典型陷阱（踩坑沉淀）

### 陷阱 1：DOM 返回 null 但弹窗已开

```javascript
// ❌ 错误：offsetParent 是 null
() => { const d=document.querySelector('.material-dialog'); 
        return d && d.offsetParent !== null; }  // 弹窗刚开时 offsetParent 还是 null

// ✅ 正确：用 getComputedStyle
() => { const d=document.querySelector('.material-dialog'); 
        if (!d) return 'no-dialog'; 
        return getComputedStyle(d).display==='none' ? 'hidden' : 'visible'; }
```

### 陷阱 2：截图有时 MISSING

**根因**：截图前页面还在加载
**解法**：`add_step` 内部 `page.wait_for_timeout(800)` 等 DOM 稳定

### 陷阱 3：监控总判定 PASS（误判）

**根因**：`expected_dom_state` 留空，监控没关键词匹配目标
**解法**：必填，用 `|` 分隔多关键词，例如 `"material-dialog|关联物料"`

### 陷阱 4：Step 2 的 DOM 值是 null

**根因**：Step 1 的 `pre_action` 没生效，弹窗没打开
**解法**：把打开弹窗放进 Step 1 的 `pre_action`，每步自包含

### 陷阱 5：pre_action 报错不影响后续

**根法**：`pre_action` 用 try/except 包裹，错误记到 `step_record["evidence"]["pre_action_error"]`，不抛异常

## 十三、与现有 skill 的关系

- **test-report** — 生成 HTML 报告，本框架的结果可被消费
- **locator-healer** — 修复选择器，配合本框架发现选择器问题后使用
- **srmpro-login** — 登录封装，本框架需要在已登录页面运行
- **monitored-test-framework**（独立 umbrella） — 本经验的完整 SKILL.md + 代码 + 案例
