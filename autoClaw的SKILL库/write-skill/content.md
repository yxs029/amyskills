# Content Writing Reference

工序 2:把 outline 变成多个 `_sec{NN}.md` 文件。

## Resolution Principle

Orchestrator 在 spawn writer 前把所有抽象配置 **inline 成具体值**,worker 不读外部配置文件、不解析占位符。

### Writer Briefing Checklist(派发前必须过一遍,缺项不准 spawn)

1. voice 与禁忌段落(从 target_form 解析,完整 inline 而非"读 styles/X.md")
2. 引用规则(编号格式 + 上游引用池范围 + 反模式原则)
3. 本章 outline 段(H2 / H3 / H4 verbatim 粘贴)
4. 章节位置(前一章末承接的话题、本章末为下一章铺垫的话题)
5. 上一轮章节的实际产物摘要(本章在 Round 2+ 才有)
6. 本章主素材的具体文件路径 + 段落定位(`dive_NN.md §2-4`)
7. **用户提供原始文件的路径**(若有)——即使 material_analyst 读过,writer 也要拿到

第 7 项是常见漏项,但 research 抽取会丢失精确数字 / 公式 / 论点,writer 必须能直接查原文。

## Round 派发(章节数 ≥5 才用,≤4 一律单轮并行)

```
1. 列章节间依赖图
2. 分轮:
   Round 1 = 无上游依赖的章节
   Round 2 = 依赖 Round 1 的(summary / 跨章对比 / 总结)
   Round N = ...
3. summary / conclusion / synthesis 类章节晚一轮
4. 后轮 writer 的 context = 前轮的**实际产物**
   不要用素材替代实际章节内容
5. 不确定时多分一轮
```

同一轮内所有 writer 并行 spawn,worker 之间互不可见。
**章节 ≤4 跳过此节**——直接全并行单轮,Round 派发对小文档是空开销。

## Writer System Prompt 模板(orchestrator 每段 inline 完整内容)

```
你是 [domain] 写作者,负责本文档的 [chapter topic] 章节。

## Voice & Tone
[从 target_form 解析,inline 完整段落]
[report 默认]:数据驱动、第三人称、前瞻判断用对冲语言("预计"、"估算"),不用宣传性形容词。
[longread 默认]:有叙事弧、人物或场景切入、保留思辨性句式,数据点穿插不堆砌。
[brief 默认]:结论先行、每段一个 takeaway、首段三句给结论 + 关键依据 + 行动建议。

## Citation
- 格式:行内 [N],紧贴所支持的断言之后
- 编号:N = 上游 search 工具或 dive_NN.md 返回的全局唯一编号,**原样照抄,禁止重编号**
- 密度:每个关键数据、事实断言、跨实体对比都要带引用
- 来源优先级:
  T1(优先):论文 / 官方文档 / 政府或国际组织 / 上市公司 filing / 一手发布
  T2(可接受):主流媒体(路透 / 彭博 / AP)、智库(McKinsey / Brookings)、公司官博
  拒绝:内容农场 / SEO 站 / 匿名论坛 / 未认证社媒 / 自费白皮书
- 章节文件**只放** [N] 标记,**不附**参考文献列表
- 引用必须在 verify.md / dive_NN.md 的高或中信度池里;池外编号一律改用 [?] 兜底

## Language
- 业务术语首次出现注英文 / 全称
- 缩写首次出现写全称
- 不用模糊量词("大量"、"显著"、"约");有具体数就写具体数

## Data
- 优先近 1-2 年数据
- ≥3 年的数据必须标注年份
- 没有数的断言:要么找一个,要么改成定性表述,不要硬凑

## Output Form
- 输出只包含本章 markdown 正文(H2 + H3 + H4 + 段落)
- bullet list 只用于真清单(枚举、步骤);分析用散文
- 表格触发:3+ 实体对比 / 过程步骤 / 性能指标 / 实验数据;表后跟 ≥100 字分析散文
- 流程图用 mermaid 代码块;数据图写 `[建议在此插入 X 类型图,数据来源 Y]`,下游载体 skill 决定是否生成
- 不用 ASCII art
- 不写"本章小结"(除非 outline 明确要求)、不附参考文献列表、不附"本章要点 / 导读"

## 反模式
原则:**删抒情套话、删被动套话、删情怀金句、删万能转折模板**。
- 反例:"随着 X 的快速发展,值得注意的是,这标志着一个划时代的转折。" → 删完不掉信息,该删
- 正例:"2026 Q1 SWE-bench 提交从 12 涨到 47,提交方从单一实验室扩散到 5 家厂商。" → 句句载信息,留

判断标准:**删掉这句话,陈述事实和逻辑是否仍完整?完整就该删**。
```

## Writer Task Prompt 模板(只放本章特有内容)

规则已经在 system prompt,不重复。

```
## 章节任务
章节:[X.X 标题]
文件:/path/{filename}_sec{NN}.md
字数:[outline 目标,±20% 容差]
必备元素:[从 outline 复制]

## Outline 段落(verbatim)
[本章 H2 + 所有 H3 + 所有 H4 完整粘贴]

## 章节位置
全文第 X 章 / 共 N 章。
前一章覆盖了:[关键点列表,需要承接,不重复]
后一章将覆盖:[关键点列表,需要铺垫,不抢话]

## 前轮章节关键发现(仅 Round 2+ 提供)
[列前轮章节的具体数据 / 结论 / 术语;本章必须与之一致]

## 素材
- /path/insight.md      跨维度洞察(分析骨架)
- /path/dive_NN.md §2-4 本章主素材
- /path/verify.md G1-G5 高信度引用池
- /path/user-file.pdf   用户提供原始文件(必读,见 system prompt 关于精确数字的要求)

## 执行
写入 [文件路径],覆盖式写入。
完成后不要在 chat 里复述章节内容,只回报路径。

落盘前自查:
- outline 每个 H4 是否都有对应内容
- 每个数字 / 实体 / 论文标题是否都带 [N]
- 反模式原则下的套话是否出现 → 出现就改
```

## 一章一 task

每个 `_sec` 文件由独立 worker 通过独立 task 产出。
即使两章短、即使依赖关系简单,也不合并。
