# 狂师《AI 测试 Skill 大全，我日常在用的 27 个》清单索引

> **性质说明**：这是一个**清单索引包**，不是 27 个技能本体。文章未公开真实 GitHub 仓库，`testfather.cn/skills` 需登录，全套技能包为知识星球成员权益。本包只忠实整理公开文章中的技能名称、功能说明与流程关系，不含任何 `SKILL.md` 本体。**27 个技能目前全部处于「本体待补」状态**，见文末清单。

| 项目 | 内容 |
| --- | --- |
| 原文标题 | AI 测试 Skill 大全，我日常在用的 27个，夯爆了！ |
| 作者 / 公众号 | 狂师 / 测试开发技术 |
| 发布时间 | 2026-11-05 08:50（湖北） |
| 原文链接 | https://mp.weixin.qq.com/s/jP9sRqey8bJk6kzDGp8Tlw |
| 收录日期 | 2026-11-05 |
| 收录分类 | 市面上的测试领域skills |
| 技能数 | 27（需求与用例设计 6 + 接口自动化 12 + UI 自动化 9） |
| 本体文件 | **0 个**（未获取，见「待补清单」） |

---

## 一、全景目录（原文）

```
skills/
├── req-to-user-story/           # 需求 → 用户故事
├── review-user-stories/         # 用户故事审查
├── generator-testcase-xmind/    # 测试用例 XMind 生成器
├── generator-testcase-excel/    # 测试用例 Excel 生成器
├── review-testcase/             # 测试用例质量评审
├── safe-testcase/               # 测试场景遗漏补全
├── api-schema-parser/           # 接口定义解析器
├── api-testdata-generator/      # 测试数据自动化构造
├── api-testscript-generator/    # 接口自动化测试脚本生成
├── api-test-optimizer/          # 接口自动化脚本质量检查与优化
├── api-test-tagger/             # 接口测试脚本智能标签化管理
├── api-test-executor/           # 接口测试智能执行调度引擎
├── api-failure-diagnoser/       # 测试失败智能诊断与自动修复
├── api-testdata-cleaner/        # 接口测试数据清理工具
├── api-report-generator/        # 接口测试智能报告生成专家
├── api-pipeline-scheduler/      # 接口自动化全链路流水线调度器
├── api-scenario-modeler/        # 多接口业务场景建模
├── api-scenario-runner/         # 多接口业务场景链路执行引擎
├── ui-page-parser/              # UI 页面解析器
├── ui-testscript-generator/     # UI 测试脚本生成
├── ui-testscript-enhancer/      # UI 测试脚本增强
├── ui-visual-assert/            # UI 视觉断言
├── ui-test-tagger/              # UI 测试脚本智能标签化
├── ui-test-executor/            # UI 测试智能执行调度引擎
├── ui-failure-diagnoser/        # UI 测试失败诊断与自动修复
├── ui-report-generator/         # UI 测试报告生成专家
├── ui-pipeline-scheduler/       # UI 自动化全链路流水线调度器
└── ...                          # 更多技能持续添加中
```

作者自述：这 27 个都是自己造的，围绕软件测试的完整流程建的，从需求拆解、用例设计、脚本生成、自动化测试、端到端业务场景测试，一路到测试报告、CI 流水线，每一个都是围绕企业团队真实在用的。三组各自能串成链，链上每个环节皆可独立可用，也能支持上下游自动衔接。

---

## 二、需求与用例设计，6 个（逐条原文说明）

### 1. req-to-user-story
需求转用户故事Skill。把口语化、乱糟糟的原始需求自动拆成结构化的用户故事，角色、主流程、替代流程、异常场景、前后置条件全部识别出来，直接粘贴需求文档就行。

### 2. review-user-stories
用户故事审查Skill。对拆出来的用户故事做系统性体检，专查场景遗漏和维度缺失，拆完不放心就让它过一遍。

### 3. generator-testcase-xmind
测试点生成Skill。基于用户故事拆测试点，输出 XMind 思维导图，功能、边界值、异常、业务规则、非功能五大维度全覆盖，按 P0 到 P2 标好优先级。

### 4. generator-testcase-excel
测试用例生成Skill。把需求用户故事或者 XMind 测试点转成格式化的 Excel 测试用例，编号、前置条件、步骤、测试数据、预期结果、关联需求一应俱全，可以直接进用例库。

### 5. review-testcase
用例质量评审Skill。对 AI 生成的用例做分级判定（可用、待修改、错误无效），五个维度打分，七项量化指标统计，逐条给扣分原因和改进建议，AI 生成用例的最后质检关。

### 6. safe-testcase
场景遗漏补全Skill。专挖人工最容易漏的场景，历史 BUG 复盘、非功能、安全、兼容性、业务隐藏规则，输入已有用例，它把漏的补上并打标记。

---

## 三、接口自动化，12 个（逐条原文说明）

### 7. api-schema-parser
接口定义解析Skill。Swagger、Postman、HAR 抓包、YApi 导出、纯文本描述，不管什么格式什么来源，统一解析成标准的接口定义文件，后面所有环节共用这一份数据。

### 8. api-testdata-generator
测试数据构造Skill。接口定义、字段规则、自然语言三种模式随便挑，自动生成正向、边界、异常、安全四个维度的测试数据。

### 9. api-testscript-generator
接口脚本生成Skill。基于接口定义批量生成 `Python+Requests+Pytest+Allure` 的分层脚本工程，数据驱动，生成了就能直接跑。

### 10. api-test-optimizer
脚本质量优化Skill。对生成的脚本做语法、规范、健壮性、逻辑四类校验，再做十个维度的场景补齐，输出校验报告加优化后的可执行脚本。

### 11. api-test-tagger
脚本标签化Skill。五维标签体系（优先级、模块、场景、执行策略、环境）批量打标，自动检测标签冲突，从此按标签圈用例，不再按文件瞎翻。

### 12. api-test-executor
执行调度引擎Skill。跑测试就用它，说人话就行，比如，「跑一下冒烟」「在 test 环境跑登录模块的 P0」，自然语言圈定范围，输出结构化执行结果。

### 13. api-failure-diagnoser
失败诊断修复Skill。把失败的用例分成环境、数据、脚本、产品缺陷四类，脚本问题的直接生成修复补丁，改完自动验证。

### 14. api-testdata-cleaner
测试数据清理Skill。数据库、Redis 缓存、本地临时文件三层一次清干净，支持 CI 定时调用，生产环境强制拦截，想误删都删不了。

### 15. api-report-generator
报告生成Skill。聚合执行结果、诊断结论和历史数据，产出可视化 HTML 报告，风险分级、高频失败接口识别、优化建议都带，还和 Allure 双报告联动。

### 16. api-pipeline-scheduler
全流程编排Skill。上面几个的串场总指挥，一句话把执行、清理、报告三步串完，单环节挂了可以配置要不要继续。

### 17. api-scenario-modeler
场景建模Skill。把「注册 → 登录 → 加购 → 下单 → 支付」这类自然语言描述的业务链路，翻译成标准化的 scenario_xxx.yaml 场景编排文件，接口全部对照 api_definitions.json 匹配绝不虚构，token、订单号这类动态值一律变量注入不写死，AI 没把握的存疑点如实列出来留给人工确认。

### 18. api-scenario-runner
链路执行引擎Skill。把编排文件真实跑起来，按序发请求、变量自动提取注入、鉴权头统一注入，步骤断言加终态数据库断言层层校验，失败即停保留完整现场，交给 api-failure-diagnoser 接着诊断，也能一键编译成 pytest 链路脚本并入执行调度体系，单接口和业务场景从此在同一个体系里跑。

---

## 四、UI 自动化，9 个（逐条原文说明）

### 19. ui-page-parser
页面解析Skill。给一个 URL 或一段用例描述，输出标准化的 pages.yaml 页面对象定义，Playwright 动态抓取、CDP 连接、推断兜底三级降级，是整条 UI 链的数据起点。

### 20. ui-testscript-generator
UI 脚本生成Skill。pages.yaml 加业务用例，生成 Playwright 加 POM 加 Pytest 的标准脚本，用例涉及什么才生成什么，不多写一行废代码。

### 21. ui-testscript-enhancer
脚本增强Skill。专治脚本不稳，智能等待、验证码识别、弹窗处理、iframe 切换、异常重试、失败截图录屏，一次加满，flaky 用例的救星。

### 22. ui-visual-assert
视觉断言Skill。给脚本加视觉回归和跨浏览器能力，像素级截图比对、动态区域遮罩、三引擎差异容忍，「页面改版了有没有变形」「手机端布局对不对」这种问题交给它。

### 23. ui-test-tagger
UI 脚本标签化Skill。六维标签体系批量打标，解析脚本语义自动推荐标签，按模块按浏览器圈用例都是一句话的事。

### 24. ui-test-executor
UI 执行调度Skill。标签筛选、浏览器环境自动检测、执行全程监控，截图、录屏、Trace、网络日志自动采集，失败现场一个不落。

### 25. ui-failure-diagnoser
UI 失败诊断修复Skill。六类失败十四种根因定位，定位漂移自动修复，和 pages.yaml 比对找回走丢的元素，红线是不动用例的断言语义。

### 26. ui-report-generator
UI 报告生成Skill。单文件 HTML 报告，状态分布、模块通过率、浏览器矩阵、风险分级，失败详情里截图录屏 Trace 一键打开，根因聚类直接给结论。

### 27. ui-pipeline-scheduler
UI 全流程编排Skill。执行、诊断、重试、合并、报告五步一条龙自动串完，带熔断兜底，「一键全跑 UI 自动化」说的就是它。

---

## 五、原文三条流水线图

### 需求分析与测试用例设计流程

```
原始需求
  │
  ▼
req-to-user-story ──→ 结构化用户故事
  │
  ▼
review-user-stories ──→ 用户故事审查（补全遗漏）
  │
  ├──→ generator-testcase-xmind ──→ XMind 测试点
  │
  ├──→ generator-testcase-excel ──→ Excel 测试用例
  │
  ▼
safe-testcase ──→ 场景遗漏补全
  │
  ▼
review-testcase ──→ 用例质量评审（评分 + 分级）
```

### 接口自动化测试全流程

```
接口文档（Swagger/Postman/HAR 等）
  │
  ▼
api-schema-parser ──→ 标准化接口数据 (api_definitions.json)
  │
  ├──→ api-testdata-generator ──→ 全场景测试数据
  │  │
  │  ▼
  │  api-testscript-generator ──→ 接口自动化脚本工程
  │  │
  │  ▼
  │  api-test-optimizer ──→ 脚本质量检查与优化
  │  │
  │  ▼
  │  api-test-tagger ──→ 智能标签化管理
  │  │
  │  ▼
  │  api-test-executor ──→ 智能执行调度
  │  │
  │  ├──→ api-failure-diagnoser ──→ 失败诊断与自动修复
  │  │
  │  └──→ api-pipeline-scheduler ──→ 全链路流水线调度
  │          │
  │          ├── api-test-executor（执行测试）
  │          ├── api-testdata-cleaner（清理数据）
  │          └── api-report-generator（生成报告）
  │
  ├──→ api-scenario-modeler ──→ 业务场景编排文件 (scenario_xxx.yaml)
  │  │
  │  ▼
  │  api-scenario-runner ──→ 链路真实执行（三级断言 + 终态 DB 校验）
  │  │
  │  ├──→ run 模式，直接执行并出报告，失败现场完整保留
  │  └──→ compile 模式，编译 pytest 链路脚本并入 api-test-executor 调度
  │
  └──→ 也可直接进入 generator-testcase-xmind/excel 生成接口级测试用例
```

### UI 自动化测试全流程

```
页面 URL / 测试用例描述
  │
  ▼
ui-page-parser ──→ 标准化页面对象 (pages.yaml)
  │
  ▼
ui-testscript-generator ──→ Playwright + POM + Pytest 测试脚本
  │
  ▼
ui-testscript-enhancer ──→ 脚本健壮性增强（智能等待/验证码/弹窗/重试）
  │
  ▼
ui-visual-assert ──→ 视觉回归 + 跨浏览器 + 响应式测试
  │
  ▼
ui-test-tagger ──→ 六维智能标签化管理（优先级/模块/场景/页面/策略/浏览器）
  │
  ▼
ui-test-executor ──→ 智能执行调度（标签筛选/浏览器矩阵/失败 artifact 采集）
  │         │
  │         ├──→ ui-failure-diagnoser ──→ 失败诊断与自动修复（6 类分类 + 14 种根因）
  │         │
  │         └──→ ui-pipeline-scheduler ──→ 全链路流水线调度（执行→诊断→重试→报告）
  │                 │
  │                 ├── ui-test-executor（首轮执行）
  │                 ├── ui-failure-diagnoser（诊断修复）
  │                 ├── ui-test-executor（重试失败用例）
  │                 ├── merge_reports（多轮 XML 合并）
  │                 └── ui-report-generator（生成最终报告）
  │
  └──→ 也可直接调子技能独立执行：
        - ui-test-executor：单独跑测试
        - ui-failure-diagnoser：单独诊断已有失败
        - ui-report-generator：基于 JUnit XML 出报告
```

---

## 六、版本差异：25 个 → 27 个

| 版本 | 时间 | 需求与用例设计 | 接口自动化 | UI 自动化 | 合计 |
| --- | --- | --- | --- | --- | --- |
| 旧版 | 2026-09-29（腾讯云开发者社区转载《我日常在用的 25 个》） | 6 | 10 | 9 | 25 |
| 本版 | 2026-11-05（公众号《我日常在用的 27个》） | 6 | 12 | 9 | 27 |

**新增 2 个**（接口自动化的业务场景线）：

| 技能 | 作用 |
| --- | --- |
| `api-scenario-modeler` | 自然语言业务链路 → `scenario_xxx.yaml` 编排文件，接口严格对照 `api_definitions.json`，动态值变量注入，存疑点留人工确认 |
| `api-scenario-runner` | 编排文件真实执行，变量提取注入、鉴权统一注入、步骤断言 + 终态 DB 断言，失败即停保留现场；支持 run / compile 两种模式 |

单接口测的是点，业务场景串的是线，两条线共用同一套执行、诊断、报告体系。

---

## 七、获取渠道与核验结论（2026-11-05 实查）

| 渠道 | 原文给的地址 | 实测结论 |
| --- | --- | --- |
| 作者 GitHub 仓库 | `git clone git@github.com:xxx/skills.git`、`npx skills add xxx/api-scenario-modeler` | **`xxx` 是占位符，真实地址未公开**。GitHub 仓库搜索 `testfather skills` 返回 0；`req-to-user-story` / `api-scenario-modeler` 关键词无相关技能仓库 |
| Skill 技能商店 | `https://testfather.cn/skills` | 页面返回「立即登录」，需注册登录才能逐个查看 |
| 知识星球「AI 测开进化圈」 | 文中仅提及名称 | 成员进圈即领全套 Skill，属付费权益，未代取 |

作者原文：「上述所有自研开发的 skill，会统一上传到 GitHub 中，球员可按需自取」（"球员"应为"学员"）。用 `Claude Code`、`Codex`、`WorkBuddy` 或其他支持 Agent Skill 的工具，把 Skill 装进工程的 skills 目录就能用。

**结论**：本包为**公开文章描述的忠实整理**，不是从上游下载的技能本体；也没有尝试绕过登录或付费墙。

---

## 八、本体待补清单（27 / 27 全部待补）

拿到技能包后，把下列目录（每个应含 `SKILL.md`）放进本分类或本机 skills 目录，再回来把状态改为「已收录」：

| 状态 | 技能目录名 |
| --- | --- |
| ⬜ 待补 | `req-to-user-story` |
| ⬜ 待补 | `review-user-stories` |
| ⬜ 待补 | `generator-testcase-xmind` |
| ⬜ 待补 | `generator-testcase-excel` |
| ⬜ 待补 | `review-testcase` |
| ⬜ 待补 | `safe-testcase` |
| ⬜ 待补 | `api-schema-parser` |
| ⬜ 待补 | `api-testdata-generator` |
| ⬜ 待补 | `api-testscript-generator` |
| ⬜ 待补 | `api-test-optimizer` |
| ⬜ 待补 | `api-test-tagger` |
| ⬜ 待补 | `api-test-executor` |
| ⬜ 待补 | `api-failure-diagnoser` |
| ⬜ 待补 | `api-testdata-cleaner` |
| ⬜ 待补 | `api-report-generator` |
| ⬜ 待补 | `api-pipeline-scheduler` |
| ⬜ 待补 | `api-scenario-modeler` |
| ⬜ 待补 | `api-scenario-runner` |
| ⬜ 待补 | `ui-page-parser` |
| ⬜ 待补 | `ui-testscript-generator` |
| ⬜ 待补 | `ui-testscript-enhancer` |
| ⬜ 待补 | `ui-visual-assert` |
| ⬜ 待补 | `ui-test-tagger` |
| ⬜ 待补 | `ui-test-executor` |
| ⬜ 待补 | `ui-failure-diagnoser` |
| ⬜ 待补 | `ui-report-generator` |
| ⬜ 待补 | `ui-pipeline-scheduler` |

> **注意**：不要为了让目录"看起来齐"而按本文描述生成占位 `SKILL.md`，那会把整理资料误变成假技能，污染技能库。

---

## 九、文件清单

| 文件 | 内容 |
| --- | --- |
| `SKILL.md` | 导航型技能：边界声明、三组速查、Mermaid 流水线图、本体获取渠道 |
| `README.md` | 本文件：27 条完整索引、原文流程图、25→27 差异、核验结论、待补清单 |
| `ARTICLE.md` | 公众号原文忠实转写 |
| `SOURCE.md` | 来源、核验过程、免责说明 |
