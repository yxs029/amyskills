# Outline Design Reference

工序 1 目标:产一份**可执行**的大纲。
可执行 = 每个 H4 都是一段具体内容,writer 拿到不需再做判断。

## Worker 编排(3 worker,两波)

| Worker | 任务 | 输出 |
|---|---|---|
| `requirement_analyst` | 拆解 user query:显性 + 隐性需求、目标读者、scope、不能漏的话题 | 需求清单 |
| `material_analyst` | 读所有素材(research 产物 / 用户文件),提炼主题、关键数据、矛盾点、引用池范围 | 主题与证据图谱 |
| `structure_designer` | 吃前两份输出,直接产带 H4 内容点的执行级骨架:章节层级 + 字数分配 + 必备元素 + H4 段落点 | 完整 outline 草稿 |

**第一波**:`requirement_analyst` + `material_analyst` 同一波 spawn,并行。
**第二波**:拿到两份输出后 spawn `structure_designer`,它一个人把骨架和内容点一次性产出。

orchestrator 拿到 structure_designer 草稿后,做轻量过滤(剔除装饰性内容),写入 `{filename}.outline.md`。

## 用户提供文件的特别处理

如果用户在工序 0 给了原始文件(PDF / 既有文档 / brief),`material_analyst` 必须**单独读这些文件**,不要只读 research 产物的二次抽取。原始文件里的精确数字 / 公式 / 论点细节会在 dive_NN.md 里丢失,后面 writer 要靠它兜底。

material_analyst 产物必须**显式列出**用户文件路径 + 每章可能需要的具体段落,后面 orchestrator 把这些路径塞进对应 writer 的 task prompt。

## 4 级标题体系

```
# {标题}                  ← H1,文档名,不编号
## 1. {章节}              ← H2,章节,对应一个 _sec 文件
### 1.1 {小节}            ← H3,小节
#### 1.1.1 {段落点}        ← H4,原子内容单元
```

不用 H5。深度溢出时把内容拍平到 H4 同级并列。

## H4 = 原子内容单元

H4 是 writer 的 task list:outline 里写什么,writer 就产什么。
H4 必须是**具体陈述**,不是话题。

| 反例(vague) | 正例(具体) |
|---|---|
| 1.1.1 讨论一下趋势 | 1.1.1 2026 Q1 SWE-bench 提交从 12 个涨到 47 个,提交方从单一实验室扩散到 5 家厂商 |
| 1.1.1 自我进化的意义 | 1.1.1 MOSS 通过重写 harness 源码实现自进化,相比改 prompt 是性质上的跃迁 |

vague H4 → vague 内容。

## H2 必备元素声明

每个 H2 在 outline 里必须注明四项:

```
## 3. 评测体系 (~3500 字, 2 表, 1 案例)
关键素材:dive_03.md §2-4、verify.md K1-K8
```

字数 / 表格数 / 案例数 / 关键素材引用——目录即执行 spec。
一份素材最多分给两章;同一份被三章以上引用 → 提取到独立章节,避免重复。

## target_form 决定密度

target_form 在工序 0 已定,工序 1 决定总字数与章节数(见 SKILL.md target_form 表)。
`brief` 模式特殊:章节数通常 ≤4,工序 2 走单轮并行,工序 3 走 fast path 两道闸门。

## 输出格式

`{filename}.outline.md`,纯 markdown:

```markdown
# {文档标题}

> target_form: report
> 总字数预估: ~22000
> 章节数: 8
> 素材根目录: /path/to/research/
> 用户提供文件: [若有,列在这]

## 1. {第一章标题} (~3000 字, 2 表)
关键素材:dive_01.md §1-3、verify.md G1-G5
用户文件需读:[若有]

### 1.1 {小节标题}
#### 1.1.1 {具体陈述}
#### 1.1.2 {具体陈述}

### 1.2 {小节标题}
#### 1.2.1 ...

## 2. {第二章标题} (~2800 字, 1 表, 1 案例)
关键素材:dive_02.md §1-2、scan_02.md
...
```

## 落盘后必经:跟用户对齐

outline 写盘后,主 agent **必须**用一句话跟用户对齐再进工序 2。这是用户**唯一**能在写完前介入的窗口。

措辞参考(不照搬,语义即可):
> "outline 准备好了:N 章共约 X 万字,主线是 [一句话主旨]。要看下再开写,还是直接开始?"

用户的回复决定下一步:
- "直接开" → 进工序 2
- "看下" / "改一下" → 把 outline 完整发出,等修订指令,改完再问一次
- "只要 outline" → 不进工序 2,本 skill 收尾

## Outline 自检 Checklist(orchestrator 落盘前过一遍)

1. 总字数累加是否在 target_form 范围
2. 关键矛盾点 / 高信度结论是否都进了某个 H4
3. 用户提供文件是否被列入 ≥1 章的"用户文件需读"

任一项不满足 → orchestrator 让 structure_designer 重产一次。

## Worker 输出纪律

每个 outline worker 只产分析内容,不带任何 meta 装饰(结构图、分工建议、emoji、亮点说明等)。orchestrator 合成时若混入直接删掉。
