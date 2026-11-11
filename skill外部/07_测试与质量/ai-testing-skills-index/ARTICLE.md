# AI 测试 Skill 大全，我日常在用的 27个，夯爆了！

> 原创：狂师｜公众号：测试开发技术｜2026-11-05 08:50｜湖北
> 原文：https://mp.weixin.qq.com/s/jP9sRqey8bJk6kzDGp8Tlw
>
> 本文为公众号正文的忠实转写（用于离线收藏检索）。仅对网页排版做 Markdown 归一化，未改写措辞、未增删条目。文中图片说明以文字保留。版权归原作者所有。

---

之前有人问我，你天天说的 Agent Skill 到底是啥，你平常有用哪些呢？

我平常在用的 Skill 种类有很多，办公提效、创作类、自动化工作流相关的，零零散散加起来不少，后面有机会再给大家分享。今天单独说一说与AI测试强相关的。

其实早在前两个月，我就已经分享过一篇关于[AI 测试Skill大全](https://mp.weixin.qq.com/s?__biz=MzA4NDUyNzA0Ng%3D%3D&mid=2247510287&idx=1&sn=7f57b77e48fc699d58256e229fd373e2&scene=21#wechat_redirect) 的文章，但还是会有很多读者会在后台留言咨询，且这段时间也陆续增加了几个新的Skill，索性再给大家分享一下。

AI测试，主力有27个Skill，且这 27 个都是我自己造的，围绕软件测试的完整流程建的，从需求拆解用例设计、脚本生成、自动化测试、端到端业务场景测试，一路到测试报告、CI流水线，每一个都是围绕企业团队真实在用的，不是收藏夹里的摆设。**文末有Skill获取方式**。

先给一张AI 测试Skill全景清单。

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

27 个 Skill 按流程分三组，需求与用例设计 6 个，接口自动化 12 个，UI 自动化 9 个。

三组各自能串成链，链上每个环节皆可独立可用，也能支持上下游自动衔接。

## 一、需求与用例设计，6 个

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

## 二、接口自动化，12 个

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

> 〔原文配图说明〕全链路流水线执行完毕，所有环节均已成功。

### 17. api-scenario-modeler

场景建模Skill。把「注册 → 登录 → 加购 → 下单 → 支付」这类自然语言描述的业务链路，翻译成标准化的 scenario_xxx.yaml 场景编排文件，接口全部对照 api_definitions.json 匹配绝不虚构，token、订单号这类动态值一律变量注入不写死，AI 没把握的存疑点如实列出来留给人工确认。

### 18. api-scenario-runner

链路执行引擎Skill。把编排文件真实跑起来，按序发请求、变量自动提取注入、鉴权头统一注入，步骤断言加终态数据库断言层层校验，失败即停保留完整现场，交给 api-failure-diagnoser 接着诊断，也能一键编译成 pytest 链路脚本并入执行调度体系，单接口和业务场景从此在同一个体系里跑。

> 〔原文配图说明〕执行完成后，自动生成一份全链路端到端测试报告：

## 三、UI 自动化，9 个

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

## 四、这 27 个Skill怎么串起来用

单拎出来每个都是独立工具，串起来才是完整的生产线。

### 需求分析与测试用例设计流程

需求工作进来先过前 6 个Skill，用户故事、测试点、用例、评审、补漏，将生成好的用例再喂给接口和 UI 两条流水线。

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

接口这条线，从第 7 个Skill开始，接口定义解析、造数、生成脚本、优化、打标，然后交给执行引擎跑，失败的诊断修复，跑完数据清理，最后报告生成，或者干脆一句话调流水线调度，一步到位。单接口之外还有一条业务场景线，第 17、18 个Skill把「注册 → 加购 → 下单 → 支付」整条业务链路建成编排文件再真实执行，单接口测的是点，业务场景串的是线，两条线共用同一套执行、诊断、报告体系。

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

### UI自动化测试全流程

UI 这条线，从第 19 个Skill开始，页面解析、脚本生成、增强、视觉断言、打标，后面执行、诊断、报告同样成链，ui-pipeline-scheduler 一键跑完全程。

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

27 个 Skill，从头到尾把一条测试流水线焊起来了。

## 五、Skill从哪里可以下载

上述所有自研开发的 skill，会统一上传到 GitHub中，球员可按需自取。

同时，目前所有 Skill 均已统一上传至网站 testfather.cn 中 Skill 技能商店中。

地址是 `https://testfather.cn/skills` ，注册登录后可以逐个查看。知识星球「AI 测开进化圈」的成员进圈即领全套Skill，还会持续更新新的测试提效Skill技能包哦。

用 `Claude Code`、`Codex`、`WorkBuddy` 或其他支持 Agent Skill 的工具，把 Skill 装进工程的 skills 目录就能用，每个技能的详细说明和触发方式，网站上都有介绍。

```
## 在线安装
npx skills add xxx/api-scenario-modeler
npx skills add xxx/api-scenario-runner

# 克隆仓库
git clone git@github.com:xxx/skills.git

# 复制到 Claude Code 技能目录
cp -r skills/api-scenario-modeler ~/.claude/skills/
cp -r skills/api-scenario-runner ~/.claude/skills/

# 或复制到 WorkBuddy 技能目录
cp -r skills/api-scenario-modeler /Users/xxx/.workbuddy/skills/
cp -r skills/api-scenario-runner /Users/xxx/.workbuddy/skills/
```

还有哪些工作中，有想让我做的新技能，评论区留言，点赞呼声高的下个月安排～

---

我是狂师，公众号长期分享 AI 提效实战与测试开发技术干货。

最近，我创建了一个「**AI测开进化圈**」知识星球，聚焦 AI 测试方向，交付的是能直接用的AI提效工具包、Skill自研技能包、AI 面试刷题、路线带学和全年答疑，AI测试全套Skill。(全都是自研)

想踏实学 AI 测试、不靠东拼西凑浪费时间的话，相信我，直接冲。
