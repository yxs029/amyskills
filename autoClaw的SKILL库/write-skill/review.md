# Review Pipeline Reference

工序 3:闸门按顺序跑,每道闸门可 pass 或 fail → 就地 rewrite。

```
report / longread 模式(4 道全跑):
section_editor(每章并行) → transition_editor(跨章) → intro_conclusion_reviewer → citation_manager

brief fast path(只跑 2 道):
section_editor(每章并行) → citation_manager
```

每章 × 每闸门最多 2 轮 rewrite。第 3 次仍 fail → 降级(见末段)。

## Section Editor(每章并行)

每章一个 editor worker,审本章是否达标。

审什么:

- **Completeness** — outline 每个 H4 是否都覆盖 / 字数在 ±20% 内 / 必备元素(表/案例)齐
- **Density** — 每段是否有信息密度,不是注水
- **Analytical depth** — 陈述完事实是否有 so-what / 跨实体对比 / implication
- **Citation hygiene** — 关键数据是否都有 [N] / 编号是否来自合法池(verify 高/中信度)
- **Anti-patterns** — 套话开头、万能转折、情怀金句、抽象套词是否出现(详细原则见 content.md "反模式"节)
- **Visual compliance** — 表后有 ≥100 字分析段 / 没用 ASCII art / bullet 只用于真清单

Fail 时:把问题列表 **逐条**(段落定位 + 修改方向)inline 进 rewrite spawn prompt,原 writer 在同一文件就地改写。不要给"整体重写一遍"这种指令。

## Transition Editor(跨章节,report / longread 才跑)

单 worker,读所有 `_sec{NN}.md` 文件。

审什么:

- 章际衔接 — 上一章末是否自然过渡到本章开头
- 术语一致 — 同一概念在不同章是否同名(不要一章"自进化"、另一章"自我改进")
- 逻辑递进 — 后章是否真用到了前章发现,还是各写各的
- 数据一致 — 同一数字 / 实体在不同章是否一致("$50B" vs "约 $50B" vs "$50.2B")
- 冗余去重 — 相同观点在多章重复 → 决定保留在哪章,其余删

Fail 时:delegate 给相关章节的原 writer。rewrite prompt 必须附**所有相关章节**的对应段落 excerpt,不让 writer 自己去翻。

## Intro / Conclusion Reviewer(report / longread 才跑)

必须在 transition editor 之后跑(章节稳定后才能审首尾)。

审什么:

- **引言** — 是否准确反映成稿(不是 outline 期望)/ 3-5 个关键发现是否亮出来 / 是否预告章节路径但不剧透
- **结论** — 是否真做跨章 synthesis(不是顺序复述各章观点)/ 是否给可执行建议或前瞻 / 是否坦承 limitations / 不用"综上所述"

Fail 时:引言 / 结论若是独立章节,让原 writer 改;若散在各章,各章对应段落 fix。

## Citation Manager(所有模式都跑)

最后一步,产 `{filename}_ref.md`。

输入:所有 `_sec{NN}.md` 文件、上游 research 引用池(`verify.md` + `dive_NN.md`)。

工作:

1. 扫所有 `_sec` 文件,提取所有 [N] 引用编号
2. 按 URL / DOI / 论文 ID / 标题 去重合并
3. 按文中**首次出现顺序**重编号为 [1] [2] [3] ...
4. 同步替换所有 `_sec` 文件里的编号(就地改)
5. 产出 `{filename}_ref.md`,纯参考文献列表,无标题、无说明文字:
   ```
   [1] Author A, Author B. Title. arXiv:2605.22794, 2026-05-22.
   [2] Anthropic. Brain-Hands Architecture. https://..., 2026-05-19.
   ```

### 与上游引用池的契约

本 skill 没有 `.citation.jsonl` 这类专用基础设施。引用池约定:

- 引用池来源 = `verify.md` 的高/中信度池 + `dive_NN.md` 各文末 source 段
- writer 写文章时原样照抄上游编号(如 `[G3]`、`[F11]`、`[^49^]`),禁止重编号
- citation_manager 在最后一步统一去重 + 按首次出现顺序重编号 `[1] [2] [3]`
- writer 编了个池外的 [N](查无源):替换为 [?],记录到 citation_manager 报告里
- 是否回 section_editor 补:由 orchestrator 决定(可补或留 [?] 标记并在 chat 告知用户)

参考文献格式:作者 / 标题 / 来源 / 日期。简洁优先,不强制 GB/T 7714。

### 引用充分性的软指标

citation_manager 完成后,orchestrator 主观判断一项:**verify 高信度池里有没有明显该用而没用的来源?**

判断材料:
- `_ref.md` 实际引用条目
- `verify.md` 高信度池条目(尤其是被标为"⭐⭐⭐⭐" 以上的)
- material_analyst 工序 1 时圈出的"关键素材"清单

判断结果:
- 明显合理 → 进工序 4
- 明显有富矿被压扁 → 回 section_editor 跑一轮"补来源"(限对应章节,不全跑)
- 不确定 → 进工序 4,在 chat 里告知用户"以下高信度来源未被引用,如需展开请说"

不设硬阈值——70% 之类数字没有数据支撑,容易把判断变成对数字的优化而非对内容的优化。

## Failure 处理(降级)

每章 × 每闸门最多 2 轮 rewrite。第 3 次仍 fail:

1. stdout 记录 `[REVIEW DEGRADED] sec{NN} gate={name} reason={1-line}`
2. 保留当前版本
3. 继续下一个闸门 / 下一章,不阻塞流水线
4. 工序 4 拼接完成后,在 chat 里告诉用户:哪些章节 / 闸门降级、原因、建议人工 review 位置

不中断流水线、不回滚、不重跑全部。
