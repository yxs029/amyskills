---
name: write-skill
description: >
  多 worker 长文档写作:把一包事实素材组织成有结构、有引用、有判断的 markdown 长文档。
  工序 0 输入勘察 → 工序 1 大纲(3 worker 并行)→ 工序 2 分章写作(per-chapter writer
  + Round 派发)→ 工序 3 四道闸门审稿 → 工序 4 拼装。产物 `{filename}.final.md`,
  纯 markdown,不含视觉 / 形态指令。

  与零散写作的本质区别:强制章节文件级隔离、≥3 worker outline、Round 派发处理依赖、
  4 道闸门审稿(section / transition / bookend / citation)。

  输入是事实素材——任何来源都接:研究产物 / 用户文件 / brief / 已有 outline / draft。
  本 skill 不内置研究、不内置渲染:无素材让用户先调研,产物 markdown 交下游处理。

  触发词:写报告 / 写文档 / 起草 / 长文 / report / draft / write-up / longread / brief。
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。


# Write Skill

把事实素材组织成长 markdown 文档。**主流程 skill,接管专家模式工作流**——`<plan>` 和执行都按下面的工序走,通用 SOP 5 段不适用。进度协议、[来源] 标注、通用约束仍生效。skill 跑完后产物是 markdown 文件,后续形态由 SOP 路由按 description 命中自选,不在本 skill 内固化。

## 对外措辞

工序号、worker 名、Round 序号、文件命名、target_form 档位都是**内部标签**,不在**用户可见处**出现——包括 chat 消息**和最终交付物**(final.md / 后续渲染物)。对外只汇报实质动作与产出,用自然白话。

- 别说:"工序 2 Round 1 派发了 5 个 writer worker"
- 改说:"开始分章写作,前 5 章先并行"

---

## 工序 0 — 输入勘察

任何工序开始前先校准:

- **本 skill 不内置研究**:不调 search 工具、不自派调研 worker、不"快速搜几条凑数"。轻量替代品会撞专家模式 SOP 的反例触发条件。
- **三件必备**:素材 / target_form / filename,缺一不进工序 1
- **全程 [N]**:任何外部事实必带 inline 引用,沿用上游素材的全局编号

### Workflow Decision Tree(用户进入本 skill 的 5 种入口)

主 agent 在工序 0 先判断用户给的是哪类输入,走对应分支:

| 输入形态 | 走法 |
|---|---|
| 给了**研究素材包**(典型:deep-research 产物目录) | 工序 0 → 工序 1 → 2 → 3 → 4 |
| 给了**用户文件**(brief / 摘录 / PDF / 之前的草稿摘要) | 工序 0 → 工序 1 → 2 → 3 → 4 |
| 给了**现成 outline**,要正文 | 跳过工序 1,直进工序 2 |
| 给了**现成 draft**,要审稿 / 改写 | 跳过工序 1-2,直进工序 3 |
| **只要 outline**,不要正文 | 工序 1 完跟用户对齐后停 |
| **没有素材** | 暂停,跟用户对齐补素材方式(deep-research 调研或补文件) |

### target_form(决定后续密度,工序 1 用)

| target_form | 总字数 | 章节数 | 单章字数 | 工序 3 闸门 |
|---|---|---|---|---|
| `report` 研究报告 | 15k-30k | 6-10 | 2k-4k | 4 道全跑 |
| `longread` 杂志长文 | 6k-12k | 4-7 | 1k-2k | 4 道全跑 |
| `brief` 简报(含 memo 短结论) | 1.5k-4k | 3-5 | 400-1k | fast path:只跑 section + citation 两道 |

`slides` 等"翻页型"形态不在本 skill 范围——叙事单位是页不是章,由 SOP 路由到 PPT 形态的渲染 skill。

### filename

输出文件主名,全程作为产物前缀。

---

## 工序 1 — 大纲

读 [outline.md](./outline.md)。

3 个 worker 并行,综合后产 `{filename}.outline.md`:

1. `requirement_analyst` + `material_analyst` 同一波 spawn
2. `structure_designer` 吃前两份输出,直接产**带 H4 的执行级骨架**(不再单设 content_planner)

落盘后**必须**用一句话跟用户对齐:"outline 准备好了,要不要看一下再开写,还是直接开始?" 用户的修改窗口只有这一次。

发 `<plan>`,steps 含每个章节(用 outline 标题做 label)+ "审稿" + "拼装"。

---

## 工序 2 — 分章写作

读 [content.md](./content.md)。

每章一个 writer worker,文件级隔离,产 `{filename}_sec{NN}.md`。

- **章节数 ≤4**:一律单轮并行,不画依赖图
- **章节数 ≥5**:Round 派发——画依赖图,summary / conclusion / 跨章 synthesis 类章节晚一轮,后轮 writer 拿前轮**实际产物**作 context(不用素材的二次复述)
- 一章一 task,**永不合写**

主 agent 把 `<plan>` 对应章节 step 切到 running;writer 落盘后通过 auto-announce 推回,主 agent 切到 done。

---

## 工序 3 — 审稿

读 [review.md](./review.md)。

```
section_editor(每章并行,quality gate) → transition_editor(跨章一致性)
  → intro_conclusion_reviewer(首尾) → citation_manager(去重重编号 + 产 _ref.md)
```

`brief` 模式 fast path:只跑 section + citation 两道,跳过 transition 和 bookend。
每章 × 每闸门最多 2 轮就地 rewrite,第 3 次仍 fail → 降级标记,不阻塞流水线。

---

## 工序 4 — 拼装

1. 前置闸:`{filename}_ref.md` 不在就不准拼
2. merger worker 顺序拼接所有 `_sec{NN}.md` + `_ref.md`,产 `{filename}.final.md`
3. 终版 `<plan>`,所有 step 标 done
4. 告诉用户产物路径,**不**在 chat 复述章节内容
5. 由 SOP 路由判断是否进 Phase 5 交付(交付载体不在本 skill 内)

---

## Core Principles

1. **Resolution Principle.** Spawn writer 前,orchestrator 把 voice / target_form 派生的章节 spec / 引用规则 / 上下文摘录全部 inline 成具体值,worker 不读外部配置。
2. **全局编号引用,后置去重.** Writer 原样照抄上游 search 工具或 `dive_NN.md` 里的原始编号;`citation_manager` 在工序 3 末统一去重 + 按出现顺序重编号。
3. **User-supplied sources reach writers.** 用户提供的原始文件(brief / PDF / 文档)的**路径**要塞进每个相关 writer 的 task prompt,即使 material_analyst 已读过——研究抽取会丢失精确数字 / 公式 / 论点细节,writer 需要原文兜底。
4. **Strict UTF-8.** 读 / 拼接 `_sec` 文件时一律 `encoding='utf-8'` 无 fallback;遇 `UnicodeDecodeError` → 重派该章 writer。**禁用** `latin-1` / `gbk` / `cp1252` / `errors='ignore'` / `errors='replace'`——这些把可检测错误转成 silent mojibake。

## 文件命名

```
{filename}.outline.md      ← 工序 1 产物
{filename}_sec01.md         ← 第 1 章
...
{filename}_sec{NN}.md       ← 第 N 章
{filename}_ref.md           ← 工序 3 末 citation_manager 产
{filename}.final.md         ← 工序 4 拼装产物
```

工作目录由 orchestrator 自取,所有 spawn prompt 里给死绝对路径,worker 不自取名。
