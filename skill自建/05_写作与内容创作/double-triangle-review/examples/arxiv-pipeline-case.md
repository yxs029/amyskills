# 案例:arxiv 自动化采集 pipeline 全过程复盘

**复盘时间**:2026-07-10
**复盘范围**:从解压 `arxiv-obsidian-collector.skill` 到 m3/proxy 排错的完整 20+ 轮对话

---

## 一句话回顾

从一个 Ubuntu 路径下的 downloads skill 文件出发,经过"分层轮转 + 评分过滤 + mavis cron 调度 + m3/Anthropic 协议切换 + proxy 兜底"五次架构变更,走到一个工程化的、可定时运行的实际 pipeline,中间踩过五个坑(协议 / Unicode / proxy / key / cron 不继承 env)。

---

## 1️⃣ 创造力

### 做了什么
- **Mavis**:提了 5 周一轮 vs 5 天轮转两种方案让你选;提出"评分过滤 + 虾评审计"作为打分双轨;提了 mavis cron + 协议归一;发现并修复 proxy 不继承
- **你**:第一次纠正 5 周是过度设计;砍掉虾评;提"按层 + 每周一次 + 不要每天跑";明确用 MiniMax-M3 不用 OpenAI;选 A 方案坚持修出网

### 段位
- Mavis:**进阶**(提假设大胆,但偶尔过度抽象)
- 你:**进阶 ↑**(多次精准纠正,但底层仍是组合现有工具)

### 提升建议
- Mavis:做方案前先把自己的假设写下来,和你对一遍
- 你:从"挑我喜欢哪个方案"上升到"我自己设计一个 cadence"
- 共同:每次大方案变更前 30 秒写"我会重新设计什么"

---

## 2️⃣ 审美

### 做了什么
- **Mavis**:原始 skill 评价分两栏亮点/毛病;给方案粗打分(v0.5 vs v1);提 Anthropic / OpenAI 两套 SDK 让协议跟 endpoint 对齐;把 gpt-5-mini 全换 m3 断尾干净
- **你**:拒绝虾评理由"免得干扰你";用 m3 不用 OpenAI 是自家栈偏好;ASCII alias 替代中文层名;删 register_weekly.ps1 + run-layer.ps1 改用 mavis cron

### 段位
- Mavis:**进阶**(能到,但中途有软糯姿态)
- 你:**进阶 +**(每个选择背后都有审美理念)

### 提升建议
- Mavis:用正负表 + 粗打分做方案对比。比如:

  | 维度 | 方案 A | 方案 B |
  |---|---|---|
  | 稳定性 | 95 | 60 |
  | 可读性 | 80 | 95 |
  | 调试难度 | 90 | 70 |
  | 综合 | **88** | **75** |

- 你:把"自有栈最佳实践"沉淀成 check list

---

## 3️⃣ 体系

### 做了什么
- **Mavis**:建立 5 层 × N 分类的 MECE 体系;拆解 config.yaml / dispatcher / pipeline / scorer / SKILL.md / cron-prompts 各司其职;加 breakpoint resume + .rejected-*.json + 不变量兜底
- **你**:提了清晰的"分层 + 每周 + 单 cron" 三层结构;在 5 天调度上选了"每天一层"这个最均衡的方式

### 段位
- Mavis:**进阶 → 高阶 边缘**(矩阵分得很整齐,但缺 reference/runbook 沉淀)
- 你:**进阶**(有方法论感,但只体现在需求描述里,没显式输出体系)

### 提升建议
- 双方:为 pipeline 写一份 runbook,放在 SKILL_REFERENCE.md
- Mavis:踩坑(proxy / unicode / protocol mismatch / cron env not inherit)沉淀成文档
- 你:把 pipeline 的外延想清楚——能否迁移到其他场景(github trending、youtube 字幕、特定 arxiv 子领域)

---

## 4️⃣ AI 基本功

### 做了什么
- **Mavis**:mavis cron(5 条)+ mavis-trash + mavis CLI 全用;mavis daemon 出 ASCII prompt 解决 unicode 损坏;切换 OpenAI SDK → Anthropic SDK 解决 404;写 proxy 兜底应对 cron 不继承 env
- **你**:把 mavis cron 当默认调度工具;m3 endpoint 直接告诉我让 Mavis 立即判断协议;选 mavis Agent 而非普通 shell

### 段位
- Mavis:**进阶**(工具选择是对的,但"如何有效利用 mavis"还在学)
- 你:**进阶 → 高阶**(选 mavis + 自家 m3 + mavis cron 这套,本身就是搭自进化武器库)

### 提升建议
- Mavis:把"mavis skill 落地套路"沉淀成 checklist
- 你:继续推进 mavis 私有化工具栈——比如让 mavis 自定义 hook、自定义 daemon agent 角色

---

## 5️⃣ AI 数据

### 做了什么
- **Mavis**:给了 quality_score / category / reasons / tl_dr 写回 frontmatter;.rejected-YYYY-MM-DD.json 留底;breakpoint resume 防止重复 fetch;Logcat-style 日志输出
- **你**:vault 路径用 `F:/软件测试/30AI技术知识树/arxivForAI`(2026-09-08 起从移动云盘同步盘迁来,有复利);用 Get笔记 + arxivForAI 同时持有结构化数据;已经做持续数据积累

### 段位
- Mavis:**基础**(搭了 schema,但数据飞轮没有闭环)
- 你:**进阶**(数据敏感度高、知道留底和复利)

### 提升建议
- 共同:把 arxiv 流水线做成真正的数据飞轮:

  ```
  论文入库 → 你浏览 → 隐式反馈(打分?忽略?)
           → 反馈给评分 prompt 校准
           → 反馈给 query 关键词权重
           → 数据复利:30 周后 = 私人 AI 论文雷达图
  ```

- Mavis:在 frontmatter 加 human_rating 字段,你看完论文随手打分
- 你:继续把"非结构化场景"(扫读 PDF 的笔记、心得)和"结构化数据"(frontmatter 字段)分开积累

---

## 6️⃣ AI 场景

### 做了什么
- **Mavis**:识别子场景:评分过滤 / 批量回填 / 断点续跑;给 ROI:评分过滤 60% 噪音,周 25-50 篇 × 1.5k token;提"虾评审计"作为二级 ROI(被砍)
- **你**:明确场景:arxiv 周报进 Obsidian,优先级清晰;不要 shell-based ad-hoc,要 production-grade cadence;选 mavis cron 而非 OS task scheduler

### 段位
- Mavis:**进阶**(提场景+ROI,但偶尔造出伪场景)
- 你:**进阶 → 高阶**(非常清楚场景边界)

### 提升建议
- Mavis:每次提方案前显式过 4 个 ROI 维度:能不能稳定复现?成本多少?谁是受益者?何时退役?
- 你:把 arxiv pipeline 抽象成可迁移的 skill template

---

## 综合诊断

| 要素 | Mavis | 你 |
|---|---|---|
| 创造力 | 进阶 | 进阶 ↑ |
| 审美 | 进阶 | 进阶 + |
| 体系 | 进阶 → 高阶边缘 | 进阶 |
| AI基本功 | 进阶 | 进阶 → 高阶 |
| AI数据 | 基础 | 进阶 |
| AI场景 | 进阶 | 进阶 → 高阶 |

### 主特征
- **Mavis 短板**:创新偶有过度抽象;**数据基本没沉淀**
- **你 特征**:审美高 + 基本功/场景都偏"高阶";短板是**体系沉淀**
- **共同短板**:没有形成反馈闭环

## 下一步可以马上做的

1. **跑通这一次链路** — 给 m3 key,trigger L1 验证完整链路
2. **沉淀 runbook** — 把 5 个坑写到 references/runbook.md
3. **加 human_rating 字段** — 在 frontmatter 加此字段,建立数据飞轮起点
4. **拆解 reusable template** — 把 pipeline 抽象成 datacollector-skill-template

---

## 这份案例怎么用

- **作为模板**:下次复盘时,照着这个结构填自己的内容
- **作为反例参考**:看哪些段位判断可能有争议,自己复盘时避免类似偏差
- **作为演进步伐**:6 个月后再做这个项目复盘,看段位有没有涨