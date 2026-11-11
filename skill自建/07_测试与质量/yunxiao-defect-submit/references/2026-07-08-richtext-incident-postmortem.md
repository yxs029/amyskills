# 2026-07-08 RICHTEXT渲染事故复盘

## 事故概要

- **日期**：2026-07-08
- **影响**：12条SRMPRO测试缺陷全部在云效网页端显示原始HTML标签，老大看到的不是富文本而是代码（`<article><p>` 原文）
- **触发动作**：批量提交12条缺陷到云效（云效项目SRMPRO）
- **根因**：3条规则同时被违反

## 完整时间线

### T0：第一批提交（11条 CreateWorkitem）
- 错误地使用 `"formatType": "MARKDOWN"`
- 描述用 Python 三引号 `"""..."""` 拼接，引入大量换行符
- HTML属性值用单引号：`class='4ever-article'`

### T0+1：发现渲染异常
- 老大反馈：「你的提单为啥都是这样的啊」（附了显示原始HTML的截图）
- 老大：「我都你没法看」

### T1：第一次修复尝试（误诊）
- 仅 PUT 更新 formatType = "RICHTEXT"
- 直接 GET 原 description 原样 PUT 回去
- 结论：❌ 失败，渲染依旧异常
- 误诊原因：只改了 formatType，原始内容里的单引号和换行符没变

### T2：根因定位
- 对比 E2E-001（老大之前单独修过，显示正常）和 E2E-002
- E2E-001 是 2026-07-08 之前手工 PUT 过的，HTML是双引号+无换行+有hr
- E2E-002 是新提交的，HTML是单引号+有换行+无hr

### T3：最终修复
- 重新生成12条缺陷的HTML（双引号+紧凑+hr）
- 全部 PUT 更新 description + formatType=RICHTEXT
- 12/12 通过验证脚本

## 3条根因规则

| # | 规则 | 错误做法 | 正确做法 |
|---|------|---------|---------|
| 1 | HTML属性值用**双引号** | `class='4ever-article'` | `class="4ever-article"` |
| 2 | HTML**紧凑无换行** | `<article>\n<p>...</p>\n</article>` | `<article><p>...</p></article>` |
| 3 | 各段用**`<hr>`分隔** | `</p>\n<p>下一段` | `</p><hr><p>下一段` |

**触发条件**：3条必须**同时**满足，缺一不可。

## 触发条件2：formatType字段

- ❌ `"formatType": "MARKDOWN"` → 把HTML当纯文本显示
- ✅ `"formatType": "RICHTEXT"` → 正常渲染

CreateWorkitem 时就要传 RICHTEXT，不要先传 MARKDOWN 再 PUT 改。

## 触发条件3：只改formatType不够

- ❌ GET读取原description → 原样PUT回去 + 只改formatType → 仍然渲染失败
- ✅ 重新生成符合规范的HTML → PUT新内容 + formatType=RICHTEXT → 成功

原因：MARKDOWN模式下存储的description可能含有单引号/换行，只改formatType不改变内容结构。

## 验证脚本（直接可用）

```python
# ~/.hermes/skills/qa/yunxiao-defect-submit/scripts/verify_defects.py
python3 ~/.hermes/skills/qa/yunxiao-defect-submit/scripts/verify_defects.py
```

输出示例（2026-07-08 修复后）：
```
✅ 12/12 全部通过，可以交付给老大 🎉
```

## 防止再犯的措施

1. **Skill SKILL.md** 已添加「描述HTML格式规范」章节
2. **踩过的坑 #8-10** 已记录根因+验证方法
3. **Checklist B1-B7** 已加入skill，提单后必须逐条核对
4. **可复用脚本**：
   - `scripts/build_defect_html.py` — 生成合规HTML
   - `scripts/verify_defects.py` — 批量验证格式

## 经验教训

1. **Python字符串拼接的隐藏陷阱**：
   - 三引号 `"""..."""` 会保留换行符，破坏RICHTEXT
   - f-string + 三引号 `f"""..."""` 更糟（换行+变量替换）
   - 用单引号 + `()` 隐式拼接是最安全的

2. **诊断要深入到字节级**：
   - 第一轮"修复"只改了formatType，没改内容
   - 正确做法是GET回来对比字节差异，发现是引号和换行

3. **User feedback 是金**：
   - 老大「我都你没法看」一句话点出问题严重性
   - 立刻分析根因，不要试图蒙混过关
