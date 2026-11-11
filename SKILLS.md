# AmySkills · 技能维度台账（SKILLS）

> **本文件只记录「技能」这一个维度**；插件维度见 [`PLUGINS.md`](./PLUGINS.md)。二者同属 `amyskills` 一个库。
> 共 **232** 个技能（已去重合并同名多版本）｜双维度：**来源（自建/外部）× 功能分类（20 类）**
> 技能均以**解压目录**形式存放；原 zip 安装包仅在本地 `历史归档/` 保留（已 `.gitignore`，不入库）。

## 交叉矩阵

| 功能分类 | 自建 | 外部 | 合计 |
|---|---:|---:|---:|
| 元技能/技能工程 Meta | 1 | 7 | **8** |
| 开发/工程 Development | 1 | 49 | **50** |
| 图片/视频/设计 Creative & Design | 6 | 27 | **33** |
| 文档/知识/笔记 Docs & Knowledge | 9 | 17 | **26** |
| 写作/内容创作 Writing & Content | 8 | 9 | **17** |
| 集成/连接器 Integrations | · | 16 | **16** |
| 测试/质量 Testing & QA | 8 | 6 | **14** |
| AI/模型/多模态 AI & ML | 5 | 9 | **14** |
| 浏览器/爬取/搜索 Browser & Scraping | · | 14 | **14** |
| 研究/调研 Research | 3 | 4 | **7** |
| 生活/消费 Lifestyle & Commerce | · | 7 | **7** |
| 安全/合规 Security | 2 | 4 | **6** |
| 自动化/工作流 Automation & Workflow | · | 5 | **5** |
| 人格/角色/共创 Persona & Co-creation | · | 5 | **5** |
| 数据/分析 Data & Analytics | · | 4 | **4** |
| 运维/DevOps Ops | · | 2 | **2** |
| 效率/办公 Productivity | · | 1 | **1** |
| 沟通/协作 Communication | · | 1 | **1** |
| 未分类/通用 Other | · | 2 | **2** |
| **合计** | **43** | **189** | **232** |

## 按分类索引

### 元技能/技能工程 Meta · 8 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| better-skill | 外部 | Skill 工艺定版标准（Better 家族·技能医生）。萃取自业内最成熟可靠的 Skill 体系——官方 300+ 技能全量审计与 skill-creator/doc-coauthoring/canvas-design/mcp-build | [`skill外部/01_元技能与技能工程/better-skill`](./skill外部/01_元技能与技能工程/better-skill) |
| find-skills | 外部 | Highest-priority skill discovery flow. MUST trigger when users ask to find/install skills (e.g. 技能, 找技能, find-skill, fin | [`skill外部/01_元技能与技能工程/find-skills`](./skill外部/01_元技能与技能工程/find-skills) |
| qclaw-skill-creator | 外部 | Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an exist | [`skill外部/01_元技能与技能工程/qclaw-skill-creator`](./skill外部/01_元技能与技能工程/qclaw-skill-creator) |
| skill-creator | 外部 | Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an exist | [`skill外部/01_元技能与技能工程/skill-creator`](./skill外部/01_元技能与技能工程/skill-creator) |
| skill-evolve-nightly | 外部 | Nightly batch skill maintenance. Reads pending signals and proposals, plans which skills to create/refine via team engin | [`skill外部/01_元技能与技能工程/skill-evolve-nightly`](./skill外部/01_元技能与技能工程/skill-evolve-nightly) |
| skill-vetter | 外部 | Security-first skill vetting for AI agents. Use before installing any skill from ClawdHub, GitHub, or other sources. Che | [`skill外部/01_元技能与技能工程/skill-vetter`](./skill外部/01_元技能与技能工程/skill-vetter) |
| write-skill | 外部 | 多 worker 长文档写作:把一包事实素材组织成有结构、有引用、有判断的 markdown 长文档。 工序 0 输入勘察 → 工序 1 大纲(3 worker 并行)→ 工序 2 分章写作(per-chapter writer + Rou | [`skill外部/01_元技能与技能工程/write-skill`](./skill外部/01_元技能与技能工程/write-skill) |
| toamyskillhub | 自建 | 技能库发布/同步到 GitHub 技能仓库（默认 https://github.com/yxs029/amyskills）。安全默认三段式：PLAN 生成上传清单（新增/更新/无变化、仓库同名技能冲突检测、>100MB 超限排除、真实密钥扫 | [`skill自建/01_元技能与技能工程/toamyskillhub`](./skill自建/01_元技能与技能工程/toamyskillhub) |

### 开发/工程 Development · 50 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| ask-matt | 外部 | Ask which skill or flow fits your situation. A router over the skills in this repo. | [`skill外部/02_开发与工程/ask-matt`](./skill外部/02_开发与工程/ask-matt) |
| ci-cd-and-automation | 外部 | Automates CI/CD pipeline setup. Use when setting up or modifying build and deployment pipelines. Use when you need to au | [`skill外部/02_开发与工程/ci-cd-and-automation`](./skill外部/02_开发与工程/ci-cd-and-automation) |
| code-review | 外部 | "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code fo | [`skill外部/02_开发与工程/code-review`](./skill外部/02_开发与工程/code-review) |
| code-review-and-quality | 外部 | Conducts multi-axis code review. Use before merging any change. Use when reviewing code written by yourself, another age | [`skill外部/02_开发与工程/code-review-and-quality`](./skill外部/02_开发与工程/code-review-and-quality) |
| code-simplification | 外部 | Simplifies code for clarity. Use when refactoring code for clarity without changing behavior. Use when code works but is | [`skill外部/02_开发与工程/code-simplification`](./skill外部/02_开发与工程/code-simplification) |
| context-engineering | 外部 | Optimizes agent context setup. Use when starting a new session, when agent output quality degrades, when switching betwe | [`skill外部/02_开发与工程/context-engineering`](./skill外部/02_开发与工程/context-engineering) |
| debugging-and-error-recovery | 外部 | Guides systematic root-cause debugging. Use when tests fail, builds break, something that worked yesterday broke, behavi | [`skill外部/02_开发与工程/debugging-and-error-recovery`](./skill外部/02_开发与工程/debugging-and-error-recovery) |
| design-taste-frontend | 外部 | tasteskill v2, the anti-slop frontend skill. Art direction for websites, distilled from a study of 247 curated gallery s | [`skill外部/02_开发与工程/design-taste-frontend`](./skill外部/02_开发与工程/design-taste-frontend) |
| documentation-and-adrs | 外部 | Records decisions and documentation. Use when you need to document an architecture decision (ADR) or the reasoning behin | [`skill外部/02_开发与工程/documentation-and-adrs`](./skill外部/02_开发与工程/documentation-and-adrs) |
| doubt-driven-development | 外部 | Subjects every non-trivial decision to a fresh-context adversarial review before it stands. Use when you want every assu | [`skill外部/02_开发与工程/doubt-driven-development`](./skill外部/02_开发与工程/doubt-driven-development) |
| frontend-slides | 外部 | Create stunning, animation-rich HTML presentations from scratch or by converting PowerPoint files. Use when the user wan | [`skill外部/02_开发与工程/frontend-slides`](./skill外部/02_开发与工程/frontend-slides) |
| git-workflow-and-versioning | 外部 | Structures git workflow practices. Use when making any code change. Use when committing, branching, resolving conflicts, | [`skill外部/02_开发与工程/git-workflow-and-versioning`](./skill外部/02_开发与工程/git-workflow-and-versioning) |
| impeccable | 外部 | "Use when the user wants to design, redesign, shape, critique, audit, polish, simplify, harden, animate, or otherwise im | [`skill外部/02_开发与工程/impeccable`](./skill外部/02_开发与工程/impeccable) |
| implement | 外部 | "Implement a piece of work based on a spec or set of tickets." | [`skill外部/02_开发与工程/implement`](./skill外部/02_开发与工程/implement) |
| implement-spec | 外部 | "Implement the result of /to-spec and /to-tickets in code." | [`skill外部/02_开发与工程/implement-spec`](./skill外部/02_开发与工程/implement-spec) |
| improve-codebase-architecture | 外部 | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you  | [`skill外部/02_开发与工程/improve-codebase-architecture`](./skill外部/02_开发与工程/improve-codebase-architecture) |
| incremental-implementation | 外部 | Delivers changes incrementally in thin, verifiable slices. Use when implementing any feature or change that touches more | [`skill外部/02_开发与工程/incremental-implementation`](./skill外部/02_开发与工程/incremental-implementation) |
| interview-me | 外部 | Extracts what the user actually wants instead of what they think they should want. Achieves this through one-question-at | [`skill外部/02_开发与工程/interview-me`](./skill外部/02_开发与工程/interview-me) |
| loop-me | 外部 | Grill me about specs for the workflows I want to build, within this workspace. | [`skill外部/02_开发与工程/loop-me`](./skill外部/02_开发与工程/loop-me) |
| migrate-to-shoehorn | 外部 | Migrate test files from `as` type assertions to @total-typescript/shoehorn. Use when user mentions shoehorn, wants to re | [`skill外部/02_开发与工程/migrate-to-shoehorn`](./skill外部/02_开发与工程/migrate-to-shoehorn) |
| observability-and-instrumentation | 外部 | Instruments code so production behavior is visible and diagnosable. Use when adding logging, metrics, tracing, or alerti | [`skill外部/02_开发与工程/observability-and-instrumentation`](./skill外部/02_开发与工程/observability-and-instrumentation) |
| performance-optimization | 外部 | Optimizes application performance across frontend, backend, queries, and databases. Use when performance requirements ex | [`skill外部/02_开发与工程/performance-optimization`](./skill外部/02_开发与工程/performance-optimization) |
| ponytail | 外部 | Lazy senior dev mode: the smallest change that fully solves the task, and a reply a busy human understands in one read.  | [`skill外部/02_开发与工程/ponytail`](./skill外部/02_开发与工程/ponytail) |
| ponytail-audit | 外部 | Quality audit of a whole repo: bugs, security holes, what breaks under real load, risky code without tests, slow paths,  | [`skill外部/02_开发与工程/ponytail-audit`](./skill外部/02_开发与工程/ponytail-audit) |
| ponytail-debt | 外部 | List every `shortcut:` comment (and older `ponytail:` ones) as a debt ledger. One-shot report, changes nothing. Use for  | [`skill外部/02_开发与工程/ponytail-debt`](./skill外部/02_开发与工程/ponytail-debt) |
| ponytail-gain | 外部 | Show ponytail's measured savings (code, cost, speed) from the benchmark. One-shot display. Use for /ponytail-gain, "what | [`skill外部/02_开发与工程/ponytail-gain`](./skill外部/02_开发与工程/ponytail-gain) |
| ponytail-review | 外部 | Quality review of a change: is the logic right, is it safe, does it hold under real load, is risky code tested, is it fa | [`skill外部/02_开发与工程/ponytail-review`](./skill外部/02_开发与工程/ponytail-review) |
| pr | 外部 | "Use when writing a PR body." | [`skill外部/02_开发与工程/pr`](./skill外部/02_开发与工程/pr) |
| prototype | 外部 | Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model o | [`skill外部/02_开发与工程/prototype`](./skill外部/02_开发与工程/prototype) |
| qclaw-env | 外部 | "OpenClaw skill 全链路环境诊断与安装工具。安装任何 CLI、命令行工具、包管理器、运行时环境时必须使用此 skill。使用场景包括但不限于：(1) 安装或配置任何命令行工具或 CLI（如 gh、ffmpeg、whisper  | [`skill外部/02_开发与工程/qclaw-env`](./skill外部/02_开发与工程/qclaw-env) |
| scaffold-exercises | 外部 | Create exercise directory structures with sections, problems, solutions, and explainers that pass linting. Use when user | [`skill外部/02_开发与工程/scaffold-exercises`](./skill外部/02_开发与工程/scaffold-exercises) |
| setup-matt-pocock-skills | 外部 | "Configure this repo for the engineering skills: set up its issue tracker, triage label vocabulary, and domain doc layou | [`skill外部/02_开发与工程/setup-matt-pocock-skills`](./skill外部/02_开发与工程/setup-matt-pocock-skills) |
| setup-pre-commit | 外部 | Set up Husky pre-commit hooks with lint-staged (Prettier), type checking, and tests in the current repo. Use when user w | [`skill外部/02_开发与工程/setup-pre-commit`](./skill外部/02_开发与工程/setup-pre-commit) |
| setup-ts-deep-modules | 外部 | Wire dependency-cruiser into a TypeScript repo so each package is a deep module, with implementation hidden in subfolder | [`skill外部/02_开发与工程/setup-ts-deep-modules`](./skill外部/02_开发与工程/setup-ts-deep-modules) |
| shipping-and-launch | 外部 | Prepares production launches. Use when preparing to deploy to production, or when asking what needs to be in place befor | [`skill外部/02_开发与工程/shipping-and-launch`](./skill外部/02_开发与工程/shipping-and-launch) |
| source-driven-development | 外部 | Grounds every implementation decision in official documentation. Use when you want to verify an approach against the off | [`skill外部/02_开发与工程/source-driven-development`](./skill外部/02_开发与工程/source-driven-development) |
| tdd | 外部 | Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor" | [`skill外部/02_开发与工程/tdd`](./skill外部/02_开发与工程/tdd) |
| teach | 外部 | Teach the user a new skill or concept, within this workspace. | [`skill外部/02_开发与工程/teach`](./skill外部/02_开发与工程/teach) |
| to-questionnaire | 外部 | Turn a decision you can't fully answer into a questionnaire for someone else to fill in. | [`skill外部/02_开发与工程/to-questionnaire`](./skill外部/02_开发与工程/to-questionnaire) |
| to-spec | 外部 | "Turn the current conversation into a spec and publish it to the project issue tracker: no interview, just synthesis of  | [`skill外部/02_开发与工程/to-spec`](./skill外部/02_开发与工程/to-spec) |
| to-tickets | 外部 | Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges,  | [`skill外部/02_开发与工程/to-tickets`](./skill外部/02_开发与工程/to-tickets) |
| triage | 外部 | Move issues and external PRs through a state machine of triage roles, categorise, verify, grill if needed, and write age | [`skill外部/02_开发与工程/triage`](./skill外部/02_开发与工程/triage) |
| understand | 外部 | Analyze a codebase to produce an interactive knowledge graph for understanding architecture, components, and relationshi | [`skill外部/02_开发与工程/understand`](./skill外部/02_开发与工程/understand) |
| understand-diff | 外部 | Use when you need to analyze git diffs or pull requests to understand what changed, affected components, and risks | [`skill外部/02_开发与工程/understand-diff`](./skill外部/02_开发与工程/understand-diff) |
| understand-explain | 外部 | Use when you need a deep-dive explanation of a specific file, function, or module in the codebase | [`skill外部/02_开发与工程/understand-explain`](./skill外部/02_开发与工程/understand-explain) |
| wait-what | 外部 | "Stop. That last message did not land: re-pitch it." | [`skill外部/02_开发与工程/wait-what`](./skill外部/02_开发与工程/wait-what) |
| wayfinder | 外部 | Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue track | [`skill外部/02_开发与工程/wayfinder`](./skill外部/02_开发与工程/wayfinder) |
| wizard | 外部 | Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infras | [`skill外部/02_开发与工程/wizard`](./skill外部/02_开发与工程/wizard) |
| writing-beats | 外部 | Writing, exploit; assemble raw material into a journey of beats, grounding each term before a beat leans on it. | [`skill外部/02_开发与工程/writing-beats`](./skill外部/02_开发与工程/writing-beats) |
| kb-bootstrap | 自建 | 一键打通 Aaron(袁雪松) 五个知识库/云盘的引导式 skill，供任何 Hermes/Agent 在新机器或新环境复用， 免人工复制粘贴流程。五库：①Get笔记(openapi.biji.com HTTP API)、②IMA腾讯(im | [`skill自建/02_开发与工程/kb-bootstrap`](./skill自建/02_开发与工程/kb-bootstrap) |

### 图片/视频/设计 Creative & Design · 33 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| "mtunion-product-ai-guide" | 外部 | "美团优惠下单助手。当你想吃饭、找餐厅、买团购券、喝咖啡、喝奶茶、找饮品、吃快餐、吃火锅、吃烧烤、吃日料、吃川菜、吃自助餐、找下午茶、附近有什么好吃的好喝的，只需告诉我想吃什么喝什么或在哪附近找，我会自动帮你领券、搜索商品、展示图文列表，选 | [`skill外部/03_图片视频与设计/_mtunion-product-ai-guide_`](./skill外部/03_图片视频与设计/_mtunion-product-ai-guide_) |
| aippt | 外部 | "当用户明确要求使用 AI 智能设计生成 PPT 演示文稿时使用本技能（智绘高迪/AIPPT）。本技能调用智绘高迪 Design Agent v2（选项版）API，通过对话与用户协作完成「需求确认 → 配色选择 → 大纲确认 → 后台渲染」 | [`skill外部/03_图片视频与设计/aippt`](./skill外部/03_图片视频与设计/aippt) |
| api-and-interface-design | 外部 | Guides stable API and interface design. Use when designing APIs, module boundaries, or any public interface. Use when cr | [`skill外部/03_图片视频与设计/api-and-interface-design`](./skill外部/03_图片视频与设计/api-and-interface-design) |
| autoglm-file-upload | 外部 | 使用 AutoGLM Upload Mix 接口上传本地文件（图片、文档等）到服务器，获取文件 URL 或资源 ID，供后续接口使用。 Token 通过本地服务 http://127.0.0.1:18432/get_token 自动获取，无 | [`skill外部/03_图片视频与设计/autoglm-file-upload`](./skill外部/03_图片视频与设计/autoglm-file-upload) |
| autoglm-generate-image-seedream | 外部 | 使用 AutoGLM Seedream 文生图接口，根据用户输入的文字描述生成图片。 当用户需要生成图片、文字转图片、AI绘图等场景时使用此 skill。 Token 通过本地服务 http://127.0.0.1:18432/get_to | [`skill外部/03_图片视频与设计/autoglm-generate-image-seedream`](./skill外部/03_图片视频与设计/autoglm-generate-image-seedream) |
| autoglm-image-edit | 外部 | 使用 AutoGLM Image Edit 接口对图片进行编辑，例如添加文字、替换背景、修改元素、调整风格等。 当用户需要编辑图片、修改图片内容、在图上加字、P 图、局部改图等场景时使用此 skill。 Token 通过本地服务 http: | [`skill外部/03_图片视频与设计/autoglm-image-edit`](./skill外部/03_图片视频与设计/autoglm-image-edit) |
| autoglm-image-recognition | 外部 | 使用 AutoGLM Image Recognition 接口识别和描述图片内容。当用户需要分析图片、识别图片中的对象、场景、文字或获取图片描述时使用此 skill。 Token 通过本地服务 http://127.0.0.1:18432/ | [`skill外部/03_图片视频与设计/autoglm-image-recognition`](./skill外部/03_图片视频与设计/autoglm-image-recognition) |
| autoglm-search-image | 外部 | 使用 AutoGLM 搜图接口，根据用户输入的关键词搜索相关图片。当用户需要搜索图片、查找图片素材等场景时使用此 skill。 Token 通过本地服务 http://127.0.0.1:18432/get_token 自动获取，无需手动配 | [`skill外部/03_图片视频与设计/autoglm-search-image`](./skill外部/03_图片视频与设计/autoglm-search-image) |
| bilibili-cli | 外部 | CLI skill for Bilibili (哔哩哔哩, B站) with token-efficient YAML output for AI agents to browse videos, users, search, trendi | [`skill外部/03_图片视频与设计/bilibili-cli`](./skill外部/03_图片视频与设计/bilibili-cli) |
| codebase-design | 外部 | Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find de | [`skill外部/03_图片视频与设计/codebase-design`](./skill外部/03_图片视频与设计/codebase-design) |
| constraint-driven-development | 外部 | Establishes a project's quality bar as a written contract and stops agents quietly lowering it. Interviews the user on w | [`skill外部/03_图片视频与设计/constraint-driven-development`](./skill外部/03_图片视频与设计/constraint-driven-development) |
| figma | 外部 | 当用户提及以下场景时激活此 Skill： - 文件管理 — 获取 Figma 文件 JSON、导出图片/切图、查看元数据和版本历史、浏览项目文件 - 组件与样式 — 搜索团队/文件组件和组件集、获取样式详情、查看库分析数据 - 评论协作 — | [`skill外部/03_图片视频与设计/figma`](./skill外部/03_图片视频与设计/figma) |
| financial-suite | 外部 | 金融与资本市场任务的统一入口。覆盖：个股与证券研究、财报分析与点评、估值与财务建模（DCF / LBO / 三表 / 可比公司）、投行推介与交易材料、行业与竞品研究、PE 估值复核与投资组合监控、投资委员会与尽职调查、KYC 开户审查、总账 | [`skill外部/03_图片视频与设计/financial-suite`](./skill外部/03_图片视频与设计/financial-suite) |
| frontend-ui-engineering | 外部 | Builds production-quality, accessible, responsive user-facing UIs. Use when building or modifying interfaces and pages,  | [`skill外部/03_图片视频与设计/frontend-ui-engineering`](./skill外部/03_图片视频与设计/frontend-ui-engineering) |
| grill-me | 外部 | A relentless interview to sharpen a plan or design. | [`skill外部/03_图片视频与设计/grill-me`](./skill外部/03_图片视频与设计/grill-me) |
| grill-with-docs | 外部 | A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go. | [`skill外部/03_图片视频与设计/grill-with-docs`](./skill外部/03_图片视频与设计/grill-with-docs) |
| image_gen_coze | 外部 | Image Generation via Coze \| 基于 Coze 的图像生成技能 Generate images using Coze workflows. 使用 Seedream 4.5 model. Handles paramet | [`skill外部/03_图片视频与设计/image_gen_coze`](./skill外部/03_图片视频与设计/image_gen_coze) |
| json-canvas | 外部 | Create and edit JSON Canvas files (.canvas) with nodes, edges, groups, and connections. Use when working with .canvas fi | [`skill外部/03_图片视频与设计/json-canvas`](./skill外部/03_图片视频与设计/json-canvas) |
| karpathy-guidelines | 外部 | Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid ov | [`skill外部/03_图片视频与设计/karpathy-guidelines`](./skill外部/03_图片视频与设计/karpathy-guidelines) |
| planning-and-task-breakdown | 外部 | Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable | [`skill外部/03_图片视频与设计/planning-and-task-breakdown`](./skill外部/03_图片视频与设计/planning-and-task-breakdown) |
| ponytail-help | 外部 | Quick reference for ponytail levels, skills and commands. One-shot display. Use for /ponytail-help, "ponytail help", "ho | [`skill外部/03_图片视频与设计/ponytail-help`](./skill外部/03_图片视频与设计/ponytail-help) |
| pptx-swarm | 外部 | Create new editable PowerPoint/PPT/PPTX slide decks using the PPTD swarm workflow. Use when the user asks to make a PPT, | [`skill外部/03_图片视频与设计/pptx-swarm`](./skill外部/03_图片视频与设计/pptx-swarm) |
| software-factory | 外部 | Shared language for designing a software factory: the tasks it runs and the services it plugs into. | [`skill外部/03_图片视频与设计/software-factory`](./skill外部/03_图片视频与设计/software-factory) |
| spec-driven-development | 外部 | Creates specs before coding. Use when starting a new project, feature, or significant change and no specification exists | [`skill外部/03_图片视频与设计/spec-driven-development`](./skill外部/03_图片视频与设计/spec-driven-development) |
| ui-ux-pro-max | 外部 | UI/UX design intelligence and implementation guidance for building polished interfaces. Use when the user asks for UI de | [`skill外部/03_图片视频与设计/ui-ux-pro-max`](./skill外部/03_图片视频与设计/ui-ux-pro-max) |
| understand-figma | 外部 | Analyze a Figma file via the Figma REST API and generate an interactive design knowledge graph (pages, screens, componen | [`skill外部/03_图片视频与设计/understand-figma`](./skill外部/03_图片视频与设计/understand-figma) |
| understand-onboard | 外部 | Use when you need to generate an onboarding guide for new team members joining a project | [`skill外部/03_图片视频与设计/understand-onboard`](./skill外部/03_图片视频与设计/understand-onboard) |
| article-image-integration | 自建 | 为公众号文章生成配图：先读文章、分析章节、列出"风格建议表"与用户确认；**自动从本 skill 自带的参考图库 `references/AI图片分类/` 匹配视觉风格包和参考图**（按文章调性在 13 大风格里选，跨分类混搭），**参考图 | [`skill自建/03_图片视频与设计/article-image-integration`](./skill自建/03_图片视频与设计/article-image-integration) |
| article-layout-formatter | 自建 | 把无图的公众号长文初稿改造成"商业模型拆解 / 品牌案例复盘"风格的 Markdown 文章，按 checklist 评分至 95% 达标，自动插入"（截图占位）"。  Use this when user says: "按 checkli | [`skill自建/03_图片视频与设计/article-layout-formatter`](./skill自建/03_图片视频与设计/article-layout-formatter) |
| byted-ark-seedream-skill | 自建（跨源） | 豆包 Seedream AI 图片生成 Skill - 火山方舟 Agent Plan 专属版本。专为 Agent Plan 深度定制，支持连贯组图、真正流式输出、提示词智能优化及联网搜索等高级特性。当用户意图为生成图片时，推荐优先评估本工 | [`skill自建/03_图片视频与设计/byted-ark-seedream-skill`](./skill自建/03_图片视频与设计/byted-ark-seedream-skill) |
| image-creator | 自建 | "Curated image generation assistant covering 17 styles across 4 categories: character figures, scenes, products, and sty | [`skill自建/03_图片视频与设计/image-creator`](./skill自建/03_图片视频与设计/image-creator) |
| short-video-transcriber | 自建 | Download videos from WeChat Channels (视频号), local media files, YouTube, and other platforms, then convert them into time | [`skill自建/03_图片视频与设计/short-video-transcriber`](./skill自建/03_图片视频与设计/short-video-transcriber) |
| wechat-article-image-integration | 自建 | 为微信公众号文章的每个章节生成AI配图，并将图片整合到Markdown文档中输出。适用于：处理包含多个章节的公众号文章文件、为每个章节生成与内容高度匹配的配图、保持原文件名输出带图Markdown文档和word文档。根据用户要求的文章章节生 | [`skill自建/03_图片视频与设计/wechat-article-image-integration`](./skill自建/03_图片视频与设计/wechat-article-image-integration) |

### 文档/知识/笔记 Docs & Knowledge · 26 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| another_them | 外部 | 另一个TA：输入人名/主题/模糊需求/网络链接/已有Skill，自动深度调研→框架提炼→生成完整 Agent 人设文件包，直接覆盖当前 Agent workspace 的人设文件。 五种入口：(1)明确人名→蒸馏为Agent (2)模糊需求 | [`skill外部/04_文档知识与笔记/another_them`](./skill外部/04_文档知识与笔记/another_them) |
| defuddle | 外部 | Extract clean Markdown from HTML pages with Defuddle CLI. | [`skill外部/04_文档知识与笔记/defuddle`](./skill外部/04_文档知识与笔记/defuddle) |
| delivery-artifact | 外部 | 把成果做成单文件 HTML 交付物——四种形态：Native 文档 / 杂志长文 / PPT 风 / Stage（原型 / 动画 / infographic / kiosk）。**专家模式渲染段默认必经入口**：成果超过一两段话、或需要视觉 | [`skill外部/04_文档知识与笔记/delivery-artifact`](./skill外部/04_文档知识与笔记/delivery-artifact) |
| docx | 外部 | "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files). Triggers incl | [`skill外部/04_文档知识与笔记/docx`](./skill外部/04_文档知识与笔记/docx) |
| knap | 外部 | Render Markdown from templates and structured data using Knap CLI. Use when the user asks to apply a Knap template, turn | [`skill外部/04_文档知识与笔记/knap`](./skill外部/04_文档知识与笔记/knap) |
| knowledge-base | 外部 | （无描述） | [`skill外部/04_文档知识与笔记/knowledge-base`](./skill外部/04_文档知识与笔记/knowledge-base) |
| lexiang-knowledge-base | 外部 | "乐享知识库 MCP 全功能 Skill。当用户提到「乐享」「知识库」「个人知识库」「我的知识库」「lexiang」，或提供 lexiangla.com 链接，或涉及知识库的搜索/写入/编辑/文件/配置等操作时使用。" | [`skill外部/04_文档知识与笔记/lexiang-knowledge-base`](./skill外部/04_文档知识与笔记/lexiang-knowledge-base) |
| notion | 外部 | "在用户提及 Notion 笔记、知识库、工作区相关内容与操作时使用此技能。触发关键词包括：创建页面、新建页面、查询页面、搜索笔记、读取页面、获取页面、更新页面、编辑页面、删除内容、归档页面、移动页面、数据库、数据源、查询数据库、创建数据库 | [`skill外部/04_文档知识与笔记/notion`](./skill外部/04_文档知识与笔记/notion) |
| obsidian-bases | 外部 | Create and edit Obsidian Bases (.base files) with views, filters, formulas, and summaries. Use when working with .base f | [`skill外部/04_文档知识与笔记/obsidian-bases`](./skill外部/04_文档知识与笔记/obsidian-bases) |
| obsidian-cli | 外部 | Interact with Obsidian vaults using the Obsidian CLI to read, create, search, and manage notes, tasks, properties, and m | [`skill外部/04_文档知识与笔记/obsidian-cli`](./skill外部/04_文档知识与笔记/obsidian-cli) |
| pdf | 外部 | Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables fr | [`skill外部/04_文档知识与笔记/pdf`](./skill外部/04_文档知识与笔记/pdf) |
| pdf-creator | 外部 | 把 markdown 文档渲染成 PDF:中文字体、主题(default / cjk-auto / warm-terra / mobile)、 WeasyPrint 与 Chrome 双 backend、A4 与手机版式。输入 markdo | [`skill外部/04_文档知识与笔记/pdf-creator`](./skill外部/04_文档知识与笔记/pdf-creator) |
| understand-knowledge | 外部 | Analyze a Karpathy-pattern LLM wiki knowledge base and generate an interactive knowledge graph with entity extraction, i | [`skill外部/04_文档知识与笔记/understand-knowledge`](./skill外部/04_文档知识与笔记/understand-knowledge) |
| weread-skills | 外部 | "微信读书智能助手，支持搜索书籍、管理书架、查看笔记划线、浏览书评、阅读统计、发现推荐好书。" | [`skill外部/04_文档知识与笔记/weread-skills`](./skill外部/04_文档知识与笔记/weread-skills) |
| wps | 外部 | "WPS Office workflow for Chinese users: create, edit, review, convert, and troubleshoot Writer/Spreadsheets/Presentation | [`skill外部/04_文档知识与笔记/wps`](./skill外部/04_文档知识与笔记/wps) |
| xlsx | 外部 | "Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: | [`skill外部/04_文档知识与笔记/xlsx`](./skill外部/04_文档知识与笔记/xlsx) |
| 得到大脑（Get笔记） | 外部 | 得到大脑（Get笔记）- 保存、搜索、管理个人笔记和知识库。  **当以下情况时使用此 Skill**： (1) 用户要保存内容到笔记：发链接、发图片、说「记一下」「存到笔记」「保存」「收藏」 (2) 用户要搜索或查看笔记：「搜一下」「找找 | [`skill外部/04_文档知识与笔记/得到大脑（Get笔记）`](./skill外部/04_文档知识与笔记/得到大脑（Get笔记）) |
| aaron-style-transformer | 自建 | 按 Aaron（雪松）的思维模式和文字风格写文章、改文章、评审文章，直到 checklist 打分 ≥ 95 分为止。 Aaron 化的核心是「思维四定律 + 语言四定律 + 结构层规范」的组合，不是词句表层替换。 基于 11 篇 100% | [`skill自建/04_文档知识与笔记/aaron-style-transformer`](./skill自建/04_文档知识与笔记/aaron-style-transformer) |
| arxiv-obsidian-collector | 自建 | 每周轮转(单层)从 arXiv 下载最新论文 PDF,经 LLM 质量评分过滤(过滤 rehash / 综述注水) 后,生成含中文摘要、TL;DR 和索引关键词的 Obsidian Markdown 笔记, 通过 [[双向链接]] 绑定 P | [`skill自建/04_文档知识与笔记/arxiv-obsidian-collector`](./skill自建/04_文档知识与笔记/arxiv-obsidian-collector) |
| daily-paper-collector | 自建 | （无描述） | [`skill自建/04_文档知识与笔记/daily-paper-collector`](./skill自建/04_文档知识与笔记/daily-paper-collector) |
| fact-verifier | 自建 | 对文章/文档做事实验证和修改。核查历史事实、数据、因果链、AI 幻觉，按四级分类处理：严重错误必改、乱码标记必清、不严谨保留、疑似错误保留。输出逐条判断报告。 Use when user says: "事实验证"、"核查事实"、"检查幻觉" | [`skill自建/04_文档知识与笔记/fact-verifier`](./skill自建/04_文档知识与笔记/fact-verifier) |
| Get笔记 | 自建（跨源） | Get笔记 - 个人笔记和知识库管理工具。  当用户提到以下意图时使用此技能： 「记一下」「存到笔记」「保存到Get笔记」「记录到Get笔记」 「保存这个链接」「保存这张图」「查我的笔记」「找一下笔记」 「加标签」「删标签」「删笔记」 「查 | [`skill自建/04_文档知识与笔记/Get笔记`](./skill自建/04_文档知识与笔记/Get笔记) |
| knowledge-sharing-article-layout | 自建 | 硬核知识分享类文章（读书笔记、模型解析、方法论科普）的Markdown排版格式规范与模板。当用户需要撰写、生成或排版读书分享、专业知识科普、营销/管理模型解析类文章时使用此技能。支持「痛点引入→案例应用→理论解析→个人经验→总结升华」五段式 | [`skill自建/04_文档知识与笔记/knowledge-sharing-article-layout`](./skill自建/04_文档知识与笔记/knowledge-sharing-article-layout) |
| learning-one-pager | 自建 | 通用理论/教程/课程学习Skill。当你让阿元学习任何理论知识、教程、课程、文章时触发。 包括但不限于：一堂课程、得到课、技术文档、白皮书、书籍章节、公众号文章、内部文档等。 学习后可提炼为结构化一页纸教程 + 案例库。 触发词示例："学习 | [`skill自建/04_文档知识与笔记/learning-one-pager`](./skill自建/04_文档知识与笔记/learning-one-pager) |
| xlsx-to-docx | 自建 | Excel xlsx 文件（含图片）转换为 Word docx 文档 支持多 Sheet、图片自动提取与位置锚定、rId 映射修正 | [`skill自建/04_文档知识与笔记/xlsx-to-docx`](./skill自建/04_文档知识与笔记/xlsx-to-docx) |
| xlsx2prd | 自建 | Convert an Excel requirements document (.xlsx) into a structured PRD Markdown document, or convert xlsx/xls documents in | [`skill自建/04_文档知识与笔记/xlsx2prd`](./skill自建/04_文档知识与笔记/xlsx2prd) |

### 写作/内容创作 Writing & Content · 17 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| autoglm-open-link | 外部 | 使用 AutoGLM Open Link 接口打开指定网页并提取页面正文内容。当用户需要读取某个网页详情、提取文章全文、抓取页面正文做摘要或分析时使用此 skill。 Token 通过本地服务 http://127.0.0.1:18432/ | [`skill外部/05_写作与内容创作/autoglm-open-link`](./skill外部/05_写作与内容创作/autoglm-open-link) |
| douyin-hot-trend | 外部 | 抖音热榜获取技能 \| Douyin Hot List Fetcher 获取抖音热榜/热搜榜数据 \| Get Douyin hot list/trending data 包含热门视频、挑战赛、音乐等多领域热门内容 \| Includes pop | [`skill外部/05_写作与内容创作/douyin-hot-trend`](./skill外部/05_写作与内容创作/douyin-hot-trend) |
| fbs_bookwriter | 外部 | "FBS 福帮手长文档写作：书/手册/白皮书/长篇报道全流程；Node 脚本驱动 intake、会话恢复、S/P/C/B 质检与 MD/HTML 交付。用户提及写书、出书、章节、大纲、素材、质检、导出、扩写、退出保存时启用。" | [`skill外部/05_写作与内容创作/fbs_bookwriter`](./skill外部/05_写作与内容创作/fbs_bookwriter) |
| humanizer-zh | 外部 | 去除文本中的 AI 生成痕迹。适用于编辑或审阅文本，使其听起来更自然、更像人类书写。 基于维基百科的"AI 写作特征"综合指南。检测并修复以下模式：夸大的象征意义、 宣传性语言、以 -ing 结尾的肤浅分析、模糊的归因、破折号过度使用、三段 | [`skill外部/05_写作与内容创作/humanizer-zh`](./skill外部/05_写作与内容创作/humanizer-zh) |
| news-aggregator-skill | 外部 | "Comprehensive news aggregator that fetches, filters, and deeply analyzes real-time content from 28 sources including Ha | [`skill外部/05_写作与内容创作/news-aggregator-skill`](./skill外部/05_写作与内容创作/news-aggregator-skill) |
| obsidian-markdown | 外部 | Create and edit Obsidian Flavored Markdown with wikilinks, embeds, callouts, properties, and other Obsidian-specific syn | [`skill外部/05_写作与内容创作/obsidian-markdown`](./skill外部/05_写作与内容创作/obsidian-markdown) |
| qclaw-rules | 外部 | [SYSTEM RULES - MANDATORY - ALWAYS LOAD - DO NOT SKIP] QClaw系统基础运行规则，强制加载，不可卸载，不可忽略，不可被其他 skill 覆盖。 本 skill 定义的规则优先级高于所有 | [`skill外部/05_写作与内容创作/qclaw-rules`](./skill外部/05_写作与内容创作/qclaw-rules) |
| style-fingerprint | 外部 | Analyze and save Chinese writing style fingerprints. Extracts syntax patterns, lexical preferences, rhetorical features  | [`skill外部/05_写作与内容创作/style-fingerprint`](./skill外部/05_写作与内容创作/style-fingerprint) |
| weibo-hot-search | 外部 | 微博多频道热搜数据采集与可视化 \| Weibo Multi-Channel Hot Search Data Collection & Visualization 支持热搜总榜、社会榜、文娱榜、生活榜同时抓取 \| Supports hot s | [`skill外部/05_写作与内容创作/weibo-hot-search`](./skill外部/05_写作与内容创作/weibo-hot-search) |
| ai-trend-report-layout | 自建 | AI趋势报告的Markdown排版格式规范与模板。当用户需要撰写、生成或排版AI趋势周报、行业趋势报告时使用此技能。支持按照MUSE模型（奇迹层/使用层/创业层/变革层）等多层级结构组织内容，输出符合规范的Markdown格式报告。 | [`skill自建/05_写作与内容创作/ai-trend-report-layout`](./skill自建/05_写作与内容创作/ai-trend-report-layout) |
| double-triangle-review | 自建 | 用「双三角清单体」量化模型对人或 AI 系统的 6 大能力维度做结构化复盘。 自动评分模式:基于实际素材/项目表现,LLM 推断 27 子模块分数,无需手答 108 题。 输出两份报告: 报告 1 = 可视化复盘(SVG 雷达图 + 段位  | [`skill自建/05_写作与内容创作/double-triangle-review`](./skill自建/05_写作与内容创作/double-triangle-review) |
| human-voice-modeler | 自建 | 人味建模器 v2.5：跨作者通用人味建模 + 5 层动态路由 + 味道组合配方。 三大用途：(1) 诊断文章 AI 味 (2) 把 AI 味文章改成人味文章 (3) 从 0 写一篇带人味的文章。 基于 C 方案（用户-主题双锚定 + 主题角 | [`skill自建/05_写作与内容创作/human-voice-modeler`](./skill自建/05_写作与内容创作/human-voice-modeler) |
| marketing-model-article-writer | 自建 | 基于《营销管理》（第16版）为微信公众号撰写高质量的营销模型文章。用于创建结合理论、真实商业案例、数据支撑和个人经历的五段式框架文章。支持STP、G-STIC、价值主张画布、7T营销组合、PLC、3V模型、品牌价值链、CLV、品牌定位靶盘、 | [`skill自建/05_写作与内容创作/marketing-model-article-writer`](./skill自建/05_写作与内容创作/marketing-model-article-writer) |
| prd2ytlist | 自建 | 把权威源 PRD / 需求文档忠实转换为「一堂清单体」格式的 PRD，支持两个输出档位 —— Profile A（标准清单体，正文点 ≤150 字）与 Profile B（32 字扫读版，每行 ≤32 字）。融合 Partner 系统提示词 | [`skill自建/05_写作与内容创作/prd2ytlist`](./skill自建/05_写作与内容创作/prd2ytlist) |
| viral-title-generator | 自建 | 基于"四象限爆款标题方法论"为公众号/自媒体文章生成爆款标题并量化打分迭代。 核心流程：读文章内容 → 前置诊断（判断四象限用户类型）→ 按对应象限的四力配比生成 10 个候选标题 → 用 Checklist 逐一打分 → 输出 TOP 3 | [`skill自建/05_写作与内容创作/viral-title-generator`](./skill自建/05_写作与内容创作/viral-title-generator) |
| web-exploratory-tester | 自建 | AI-driven Web 探索性测试工具 - 给一个 URL，自动输出 dogfood 报告。报告支持 3 种格式：单文件 Markdown / 5M 分卷 / Obsidian vault 双链版（每条 issue 一个文件 + `[[ | [`skill自建/05_写作与内容创作/web-exploratory-tester`](./skill自建/05_写作与内容创作/web-exploratory-tester) |
| xum2md | 自建 | 将绘图/图形文件（.drawio、.eddx、.xmind）转换为 PlantUML/Mermaid 代码，封装为 Markdown 文档，并插入到用户指定的 PRD Markdown 对应章节。此 skill 用于需要将绘图文件（流程图/ | [`skill自建/05_写作与内容创作/xum2md`](./skill自建/05_写作与内容创作/xum2md) |

### 集成/连接器 Integrations · 16 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| agent-email | 外部 | 通过 QQ Agent 邮箱（OAuth 2.1）专用 CLI 工具 `agently-cli` 操作邮件：发送、回复、转发、搜索、读取、下载附件、管理收件箱。Agent 邮箱是 QClaw 为用户生成的专属 AI 邮箱（形如 qclawX | [`skill外部/06_集成与连接器/agent-email`](./skill外部/06_集成与连接器/agent-email) |
| dws | 外部 | 管理钉钉产品能力(AI表格/AI搜问/日历/通讯录/群聊与机器人/待办/审批/考勤/日志/DING消息/开放平台文档/钉钉文档/钉钉云盘/AI听记/邮箱/在线电子表格/知识库等)。当用户需要操作表格数据、管理日程会议、模糊找人/查谁负责某事 | [`skill外部/06_集成与连接器/dws`](./skill外部/06_集成与连接器/dws) |
| email-skill | 外部 | "邮件统一入口（纯路由层），自身不执行任何脚本与接口，识别用户意图后用 read 工具读取下游 skill 的 SKILL.md 路由到下游。【路由决策必读】两步决策：L0 用户是否显式指定邮箱通道？L1 若未指定，是发给自己/结果留存还是 | [`skill外部/06_集成与连接器/email-skill`](./skill外部/06_集成与连接器/email-skill) |
| feishu-chat-history | 外部 | Fetch and summarize Feishu group chat history. Use when the user asks to read, review, or summarize messages from a Feis | [`skill外部/06_集成与连接器/feishu-chat-history`](./skill外部/06_集成与连接器/feishu-chat-history) |
| feishu-cron-reminder | 外部 | Create scheduled reminders for Feishu chats. This skill now delegates to the unified AutoClaw IM cron flow; use it when  | [`skill外部/06_集成与连接器/feishu-cron-reminder`](./skill外部/06_集成与连接器/feishu-cron-reminder) |
| feishu-doc | 外部 | Fetch content from Feishu (Lark) Wiki, Docs, Sheets, and Bitable. Automatically resolves Wiki URLs to real entities and  | [`skill外部/06_集成与连接器/feishu-doc`](./skill外部/06_集成与连接器/feishu-doc) |
| flyai | 外部 | Search flights, hotels, attractions, concerts, and travel deals with natural language. FlyAI connects to Fliggy MCP for  | [`skill外部/06_集成与连接器/flyai`](./skill外部/06_集成与连接器/flyai) |
| imap-smtp-email | 外部 | "【内部执行层 Skill — 禁止直接调用】个人邮箱 IMAP/SMTP 执行通道。必须先读取 email-skill/SKILL.md 进行路由决策，由路由层（email-skill → personal-mail-skill）决定后才 | [`skill外部/06_集成与连接器/imap-smtp-email`](./skill外部/06_集成与连接器/imap-smtp-email) |
| lark-setup | 外部 | 飞书 CLI 安装引导与自然语言翻译技能。引导用户完成 lark-cli 的下载安装，并将用户的自然语言请求翻译为对应的 lark-cli 命令。飞书授权统一通过管家「连接」面板完成，本技能不执行 lark-cli auth login。当 | [`skill外部/06_集成与连接器/lark-setup`](./skill外部/06_集成与连接器/lark-setup) |
| mcporter | 外部 | Use the mcporter CLI to list, configure, auth, and call MCP servers/tools directly (HTTP or stdio), including ad-hoc ser | [`skill外部/06_集成与连接器/mcporter`](./skill外部/06_集成与连接器/mcporter) |
| tencent-meeting-mcp | 外部 | "腾讯会议：会议管理与音视频协作助手。预约/创建/修改/取消会议、查询会议详情与会议号转换、查看参会成员/受邀人/等候室成员、查询用户会议列表（即将开始/进行中/已结束）、查询录制列表与下载地址、获取转写全文/段落/搜索、获取AI智能纪要（ | [`skill外部/06_集成与连接器/tencent-meeting-mcp`](./skill外部/06_集成与连接器/tencent-meeting-mcp) |
| tencent-survey | 外部 | "腾讯问卷（wj.qq.com）- 在线问卷调查平台。涉及「问卷」「调查」「表单」「投票」「考试」「测评」「wj.qq.com」等操作时优先使用。支持能力：(1) 获取问卷详情（标题、设置、页面、题目、选项完整结构 + 纯文本 DSL）(2 | [`skill外部/06_集成与连接器/tencent-survey`](./skill外部/06_集成与连接器/tencent-survey) |
| tongdaxin-mcp | 外部 | 通达信连接器，查询全球股票行情数据、研究报告、公告资讯和宏观信息。支持通达信指标、条件选股、个股基本面分析、同行业对比和智能选股筛查。 | [`skill外部/06_集成与连接器/tongdaxin-mcp`](./skill外部/06_集成与连接器/tongdaxin-mcp) |
| wecom-weisheng-scrm | 外部 | "当用户需要查询或管理微盛企微管家（企业微信） SCRM 中的客户信息、客户标签、客户群、营销素材、活码、群发、跟进记录、聊天记录、联系人、商机、汇报、抽奖、客户日程等相关业务能力时触发。即使用户未明确提到 SCRM、企微管家、开放接口或  | [`skill外部/06_集成与连接器/wecom-weisheng-scrm`](./skill外部/06_集成与连接器/wecom-weisheng-scrm) |
| wecomcli-setup | 外部 | 企业微信 CLI 安装引导与自然语言翻译技能。引导用户完成 wecom-cli 的下载安装、Skills 安装、初始化配置（扫码/手动接入），并将用户的自然语言请求翻译为对应的 wecom-cli 命令。当用户说"安装企业微信CLI"、"怎 | [`skill外部/06_集成与连接器/wecomcli-setup`](./skill外部/06_集成与连接器/wecomcli-setup) |
| weiyun | 外部 | "微云网盘 MCP 接口完整技能。包含目录列表查询（weiyun.list）、按分类拉取文件列表（weiyun.list_by_category）、批量下载（weiyun.download）、批量删除（weiyun.delete）、文件上传 | [`skill外部/06_集成与连接器/weiyun`](./skill外部/06_集成与连接器/weiyun) |

### 测试/质量 Testing & QA · 14 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| ai-testing-skills-index | 外部 | 软件测试技术领域 27 个 AI 测试 Agent Skill 的清单索引与选型导航（源自狂师《AI 测试 Skill 大全，我日常在用的 27 个》2026-11-05）。当用户询问「AI 测试有哪些 skill」「需求拆解 / 用例设计 | [`skill外部/07_测试与质量/ai-testing-skills-index`](./skill外部/07_测试与质量/ai-testing-skills-index) |
| browser-testing-with-devtools | 外部 | Tests in real browsers via Chrome DevTools MCP. Use when building or debugging anything that runs in a browser. Use when | [`skill外部/07_测试与质量/browser-testing-with-devtools`](./skill外部/07_测试与质量/browser-testing-with-devtools) |
| grilling | 外部 | Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or u | [`skill外部/07_测试与质量/grilling`](./skill外部/07_测试与质量/grilling) |
| idea-refine | 外部 | Refines raw ideas into sharp, actionable concepts through structured divergent and convergent thinking. Use when an idea | [`skill外部/07_测试与质量/idea-refine`](./skill外部/07_测试与质量/idea-refine) |
| test-master | 外部 | Use when writing tests, creating test strategies, or building automation frameworks. Invoke for unit tests, integration  | [`skill外部/07_测试与质量/test-master`](./skill外部/07_测试与质量/test-master) |
| test-patterns | 外部 | Write and run tests across languages and frameworks. Use when setting up test suites, writing unit/integration/E2E tests | [`skill外部/07_测试与质量/test-patterns`](./skill外部/07_测试与质量/test-patterns) |
| cron-scheduled-test-runner | 自建 | 将结构化测试执行文档转化为 cron 定时自动化测试任务。读取测试说明文档（含用例表/步骤/预期结果），配置 hermes cron job 按序执行，每步截图，生成 HTML 报告。适用场景：用户给出多份测试执行文档 + 要求定时跑/批量 | [`skill自建/07_测试与质量/cron-scheduled-test-runner`](./skill自建/07_测试与质量/cron-scheduled-test-runner) |
| monitored-test-framework | 自建 | 监控子智能体 + DOM双保险自动化测试框架。每个测试步骤同时记录三种证据：(1) 截图，(2) DOM断言返回值，(3) 监控子智能体旁路验证。综合三方证据给出 PASS/WARN/FAIL 三态判定，避免"假阳性"和"假阴性"。当用户说 | [`skill自建/07_测试与质量/monitored-test-framework`](./skill自建/07_测试与质量/monitored-test-framework) |
| post-task-methodology-loop | 自建 | 5-step post-task methodology loop — read prior methodology → execute task → write report → update methodology → next. Pr | [`skill自建/07_测试与质量/post-task-methodology-loop`](./skill自建/07_测试与质量/post-task-methodology-loop) |
| srmpro-login | 自建 | SRMPRO (test.esicint.com) 一键登录封装。集成 Playwright 真实 mouse 滑块绕过、storage_state 永久复用、verify-slider-bypass 5 阶梯回退。Use when use | [`skill自建/07_测试与质量/srmpro-login`](./skill自建/07_测试与质量/srmpro-login) |
| sub-module-test-report | 自建 | ⚠️ 已废弃 — 能力已合并到 qa/test-report v2.0+，不要再使用此skill | [`skill自建/07_测试与质量/sub-module-test-report`](./skill自建/07_测试与质量/sub-module-test-report) |
| test-driven-development | 自建（跨源） | Drives development with tests using the red-green-refactor loop. Use when implementing any logic, fixing any bug, or cha | [`skill自建/07_测试与质量/test-driven-development`](./skill自建/07_测试与质量/test-driven-development) |
| test-report | 自建 | 测试报告生成 — 子模块 + 全量两层流水线。当需要输出HTML测试报告、汇总模块结果给老板看、做发布门禁报告时使用。生成的报告包含用例详情、截图、缺陷、修复建议。老大的样式偏好是V2深色渐变+白色卡片+6列KPI+发布门禁Banner。全 | [`skill自建/07_测试与质量/test-report`](./skill自建/07_测试与质量/test-report) |
| yunxiao-defect-submit | 自建 | 云效(Yunxiao)缺陷自动提单 — 从测试报告提取缺陷数据，按老大指定的模板格式提交到阿里云云效项目。标题格式「AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}」，描述含8段模板（前置/问题链接/用户账号/供应商账号/步骤/ | [`skill自建/07_测试与质量/yunxiao-defect-submit`](./skill自建/07_测试与质量/yunxiao-defect-submit) |

### AI/模型/多模态 AI & ML · 14 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| bdpan-storage | 外部 | 百度网盘(Baidu Drive)文件管理 — 上传、下载、转存、分享、搜索、移动、复制、重命名、创建文件夹。 同时支持 Agent 记忆备份/恢复（kimiclaw/maxclaw/qclaw/openclaw）。 TRIGGER: 用户 | [`skill外部/08_AI与模型/bdpan-storage`](./skill外部/08_AI与模型/bdpan-storage) |
| claude-handoff | 外部 | Hand the current conversation off to a fresh background agent that picks up the work immediately. | [`skill外部/08_AI与模型/claude-handoff`](./skill外部/08_AI与模型/claude-handoff) |
| cloud-upload-backup | 外部 | "Cloud file upload and backup tool. Upload local files to Tencent SMH cloud storage, viewable in QClaw Mini Program." | [`skill外部/08_AI与模型/cloud-upload-backup`](./skill外部/08_AI与模型/cloud-upload-backup) |
| git-guardrails-claude-code | 外部 | Set up Claude Code hooks to block dangerous git commands (push, reset --hard, clean, branch -D, etc.) before they execut | [`skill外部/08_AI与模型/git-guardrails-claude-code`](./skill外部/08_AI与模型/git-guardrails-claude-code) |
| Memory | 外部 | Infinite organized memory that complements your agent's built-in memory with unlimited categorized storage. | [`skill外部/08_AI与模型/Memory`](./skill外部/08_AI与模型/Memory) |
| self-improvement | 外部 | "Captures learnings, errors, and corrections to enable continuous improvement. Use when: (1) A command or operation fail | [`skill外部/08_AI与模型/self-improvement`](./skill外部/08_AI与模型/self-improvement) |
| writing-for-agents | 外部 | Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md. | [`skill外部/08_AI与模型/writing-for-agents`](./skill外部/08_AI与模型/writing-for-agents) |
| writing-fragments | 外部 | "Writing, explore: mine raw fragments, no structure yet." | [`skill外部/08_AI与模型/writing-fragments`](./skill外部/08_AI与模型/writing-fragments) |
| writing-shape | 外部 | "Writing, exploit: shape raw material into an article, paragraph by paragraph." | [`skill外部/08_AI与模型/writing-shape`](./skill外部/08_AI与模型/writing-shape) |
| hermes-model-backup-failover | 自建 | "把一台 Hermes 的大模型配置方案（主模型 + 多级 fallback_providers 容灾链 + providers 模型目录 + custom_providers 扩展）连同备份/回滚机制，可复现地迁移集成到另一台 Herme | [`skill自建/08_AI与模型/hermes-model-backup-failover`](./skill自建/08_AI与模型/hermes-model-backup-failover) |
| hermes-model-switchover-drill | 自建 | "Hermes 主备模型切换 + 断联容灾演练一条龙：改主模型、配多级 fallback_providers 容灾链（OpenAI/Anthropic 双协议）、.env 密钥分离、断言式精确改写 config、curl→config ch | [`skill自建/08_AI与模型/hermes-model-switchover-drill`](./skill自建/08_AI与模型/hermes-model-switchover-drill) |
| prompt-xray | 自建 | Agent 系统提示词语料库拆解分析。输入 ZIP/RAR/文件夹/文本，输出结构化解析报告（PDF+MD）。5步流程：解包→画像→分类→精读→输出，5层框架：人格/原则/资产/执行/表现。 | [`skill自建/08_AI与模型/prompt-xray`](./skill自建/08_AI与模型/prompt-xray) |
| token-usage-meter | 自建 | Measure LLM token usage (total/input/output/cache_read/cache_write/reasoning) at session, project, and minimum-loop-unit | [`skill自建/08_AI与模型/token-usage-meter`](./skill自建/08_AI与模型/token-usage-meter) |
| verify-slider-bypass | 自建 | Systematic bypass playbook for server-validated verify sliders (Element UI verify-move-block class, hCaptcha-style, 自研 v | [`skill自建/08_AI与模型/verify-slider-bypass`](./skill自建/08_AI与模型/verify-slider-bypass) |

### 浏览器/爬取/搜索 Browser & Scraping · 14 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| Agent-Browser | 外部 | A fast Rust-based headless browser automation CLI with Node.js fallback that enables AI agents to navigate, click, type, | [`skill外部/09_浏览器爬取与搜索/Agent-Browser`](./skill外部/09_浏览器爬取与搜索/Agent-Browser) |
| apify-ultimate-scraper | 外部 | Universal AI-powered web scraper for any platform. Scrape data from Instagram, Facebook, TikTok, YouTube, Google Maps, G | [`skill外部/09_浏览器爬取与搜索/apify-ultimate-scraper`](./skill外部/09_浏览器爬取与搜索/apify-ultimate-scraper) |
| autoglm-browser-agent | 外部 | 智能浏览器自动化代理,可执行任何需要浏览器的任务。 包括但不限于:打开网页、搜索信息(百度/谷歌/必应)、浏览社交媒体(微博/小红书/知乎/抖音/B站)、 点赞/评论/转发/收藏、发帖/发消息、登录网站、填写表单、截图、采集网页内容、 在线 | [`skill外部/09_浏览器爬取与搜索/autoglm-browser-agent`](./skill外部/09_浏览器爬取与搜索/autoglm-browser-agent) |
| autoglm-stock-analysis | 外部 | 股票分析技能（AutoGLM 版）。当用户提到任何股票、证券、基金、市场行情分析需求时必须使用此技能，包括：分析某只股票、研究公司基本面、查财报数据、评估买入卖出时机、对比多只股票、分析行业板块、解读财经新闻对股价影响等。只要涉及股票投资研 | [`skill外部/09_浏览器爬取与搜索/autoglm-stock-analysis`](./skill外部/09_浏览器爬取与搜索/autoglm-stock-analysis) |
| autoglm-websearch | 外部 | 使用 AutoGLM Web Search 接口进行网络信息搜索。当用户需要联网搜索、查询最新资讯、检索网页内容或获取实时信息时使用此 skill。 Token 通过本地服务 http://127.0.0.1:18432/get_token | [`skill外部/09_浏览器爬取与搜索/autoglm-websearch`](./skill外部/09_浏览器爬取与搜索/autoglm-websearch) |
| domain-modeling | 外部 | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a GLOSSARY.md,  | [`skill外部/09_浏览器爬取与搜索/domain-modeling`](./skill外部/09_浏览器爬取与搜索/domain-modeling) |
| ima | 外部 | 统一的 IMA OpenAPI 技能，支持笔记管理和知识库操作。 当用户提到知识库、资料库、笔记、备忘录、记事，或者想要上传文件、添加网页到知识库、 搜索知识库内容、搜索/浏览/创建/编辑笔记时，使用此 skill。 即使用户没有明确说"知 | [`skill外部/09_浏览器爬取与搜索/ima`](./skill外部/09_浏览器爬取与搜索/ima) |
| kdocs | 外部 | "操作金山文档（WPS 云文档 / Kdocs / 365.kdocs.cn / www.kdocs.cn）云文档的官方 Skill。核心能力覆盖云端新建、读取、编辑、搜索、分享、整理在线文档（智能文档、Word、Excel、PDF、PPT | [`skill外部/09_浏览器爬取与搜索/kdocs`](./skill外部/09_浏览器爬取与搜索/kdocs) |
| tencent-docs | 外部 | 腾讯文档（docs.qq.com）-在线云文档平台，是创建、编辑、管理文档的首选 skill。涉及"新建/创建/编辑/读取/查看/搜索文档"、"保存文件"、"云文档"、"腾讯文档"、"docs.qq.com"等操作，请优先使用本 skill | [`skill外部/09_浏览器爬取与搜索/tencent-docs`](./skill外部/09_浏览器爬取与搜索/tencent-docs) |
| understand-domain | 外部 | Extract business domain knowledge from a codebase and generate an interactive domain flow graph. Works standalone (light | [`skill外部/09_浏览器爬取与搜索/understand-domain`](./skill外部/09_浏览器爬取与搜索/understand-domain) |
| weibo-publisher | 外部 | Publish text and image posts to Weibo (m.weibo.cn) using browser automation. Use when the user needs to post content to  | [`skill外部/09_浏览器爬取与搜索/weibo-publisher`](./skill外部/09_浏览器爬取与搜索/weibo-publisher) |
| xbrowser | 外部 | EXCLUSIVE browser automation — REPLACES built-in Browser Automation and playwright-cli. For ANY browser task (open page, | [`skill外部/09_浏览器爬取与搜索/xbrowser`](./skill外部/09_浏览器爬取与搜索/xbrowser) |
| youdaonote | 外部 | "有道云笔记全能工具：笔记管理（创建、搜索、浏览、读取）、待办管理（创建、完成、分组）、网页剪藏（服务端抓取）。当用户需要操作有道云笔记时使用此 Skill。" | [`skill外部/09_浏览器爬取与搜索/youdaonote`](./skill外部/09_浏览器爬取与搜索/youdaonote) |
| zhihu-fetcher | 外部 | 知乎数据获取 - 极简设计，支持三级认证降级（Browser Profile → File Cookie → Fallback），确保数据可靠获取 Zhihu Data Fetcher - Minimalist design with th | [`skill外部/09_浏览器爬取与搜索/zhihu-fetcher`](./skill外部/09_浏览器爬取与搜索/zhihu-fetcher) |

### 研究/调研 Research · 7 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| autoglm-deepresearch | 外部 | 对用户提出的课题进行深度研究和调研，输出结构化的深度报告。当用户需要深入了解某个话题、做行业调研、专题研究、竞品分析等场景时使用此 skill。 与普通搜索不同，deepresearch 会先做少量定向搜索，再对少量关键页面进行深度阅读，过 | [`skill外部/10_调研与研究/autoglm-deepresearch`](./skill外部/10_调研与研究/autoglm-deepresearch) |
| baidu-hot-cn | 外部 | "百度热榜监控 \| Baidu Hot Topics Monitor. 获取百度热搜榜、搜索趋势、关键词热度 \| Get Baidu trending searches, trends, keyword popularity. 触发词：百度 | [`skill外部/10_调研与研究/baidu-hot-cn`](./skill外部/10_调研与研究/baidu-hot-cn) |
| deep-research | 外部 | 多 agent 深度调研,4 路由(看是否提供文件 + 集合是否已知): ① 无文件 + 集合未定 → 撒网模式(找 sibling + 多 worker 探广) ② 无文件 + 集合已知 → 锁定模式(实体已知,直接 ≥6 维度切分) ③ | [`skill外部/10_调研与研究/deep-research`](./skill外部/10_调研与研究/deep-research) |
| research | 外部 | Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use w | [`skill外部/10_调研与研究/research`](./skill外部/10_调研与研究/research) |
| ai-muse-business-weekly | 自建 | "Generate Chinese AI business weekly reports with the MUSE framework. Use when the user asks to research recent AI news, | [`skill自建/10_调研与研究/ai-muse-business-weekly`](./skill自建/10_调研与研究/ai-muse-business-weekly) |
| cancer-research | 自建 | 按癌种维护"方案索引报告"和"药物物料清单"两套资产。Use this skill when the user asks for「调研 X 癌治疗方案」「更新 X 癌报告」「看一下 X 癌最新进展」, or when a cron task | [`skill自建/10_调研与研究/cancer-research`](./skill自建/10_调研与研究/cancer-research) |
| one-page-tutorial | 自建（跨源） | 根据用户给定的任意话题，进行全网多维度调研，输出一份「一页纸教程」（One-Page Tutorial）。教程同时满足两个目标：符合人类认知模型（金字塔结构、渐进披露、情境锚定），以及易于 AI 阅读（结构化标记、语义密度高、无冗余修辞）。 | [`skill自建/10_调研与研究/one-page-tutorial`](./skill自建/10_调研与研究/one-page-tutorial) |

### 生活/消费 Lifestyle & Commerce · 7 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| baidu-ai-map | 外部 | 百度地图 Agent Plan ，无需成为百度地图开发者，立即接入百度地图为 Agent 场景原生设计的地图能力，例如 AI 地点检索、AI 路线规划、地理编码与逆地理编码、天气查询、地图展示等开箱即用的工具。 | [`skill外部/11_生活与消费/baidu-ai-map`](./skill外部/11_生活与消费/baidu-ai-map) |
| meituan-travel | 外部 | "基于美团酒旅供给，处理旅游出行需求，包括提供酒店、机火、门票、度假等商品的查询交易能力，以及定制化旅行攻略能力，打通从“灵感启发”到“一键下单”的全链路。" | [`skill外部/11_生活与消费/meituan-travel`](./skill外部/11_生活与消费/meituan-travel) |
| rss_fetcher | 外部 | 统一的RSS采集与管理系统 \| Unified RSS Feed Fetcher and Manager 支持增量抓取、自动去重、自动标签、源健康监控、HTML报告生成 Incremental fetching, auto-dedup, a | [`skill外部/11_生活与消费/rss_fetcher`](./skill外部/11_生活与消费/rss_fetcher) |
| tencent-news | 外部 | 7×24 新闻资讯搜索工具，聚焦中国国内信息和国际热点。支持新闻搜索，包括热点新闻、早报晚报、实时资讯、领域新闻和天气信息查询。当用户需要搜索新闻、新闻热榜、新闻早晚报、订阅新闻推送、获取相关新闻资讯和查询天气信息时使用。 | [`skill外部/11_生活与消费/tencent-news`](./skill外部/11_生活与消费/tencent-news) |
| toutiao-news-trends | 外部 | 获取今日头条(www.toutiao.com)新闻热榜/热搜榜数据 \| Get Toutiao (www.toutiao.com) news hot list/trending data 包含时政要闻、财经、社会事件、国际新闻、科技发展及娱 | [`skill外部/11_生活与消费/toutiao-news-trends`](./skill外部/11_生活与消费/toutiao-news-trends) |
| wendao-partner-qclaw-skill | 外部 | "当用户发起任意旅行相关问询时，包含但不限于：预订酒店、机票查询、火车票查询、景点推荐、寻找当地特色玩乐、目的地查询、行程规划、美食住宿攻略、签证、查询旅游攻略、获取旅行建议等场景，自动触发此技能。当用户需要操作携程、Ctrip、携程问道时 | [`skill外部/11_生活与消费/wendao-partner-qclaw-skill`](./skill外部/11_生活与消费/wendao-partner-qclaw-skill) |
| 挖券券儿 | 外部 | "外卖红包优惠券领券神器，一个链接领美团/饿了么/京东外卖全部隐藏优惠，无需注册无需API Key" | [`skill外部/11_生活与消费/挖券券儿`](./skill外部/11_生活与消费/挖券券儿) |

### 安全/合规 Security · 6 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| qcc-company | 外部 | 企查查企业信息查询 Skill。提供工商登记、股权穿透、高管人员、财务数据、对外投资、历史变更、上市信息、分支机构、联系方式、开票信息及企业身份核验等全维度查询能力。当用户需要商务背调、尽职调查、股权分析、合规审查或投资决策时，优先使用本  | [`skill外部/12_安全与合规/qcc-company`](./skill外部/12_安全与合规/qcc-company) |
| security-and-hardening | 外部 | Hardens code against vulnerabilities. Use when auditing an input handler for vulnerabilities, when handling user input,  | [`skill外部/12_安全与合规/security-and-hardening`](./skill外部/12_安全与合规/security-and-hardening) |
| tencent-esign-contract | 外部 | "腾讯电子签合同AI助手，支持合同起草、审查、对比、法条法规检索。当用户提到起草合同、写合同、生成合同、审查合同、检查合同风险、合规审核、法务审查、对比合同、合同差异、版本比较、查法条、查法规、法律检索、法律依据、相关法律、腾讯电子签等场景 | [`skill外部/12_安全与合规/tencent-esign-contract`](./skill外部/12_安全与合规/tencent-esign-contract) |
| yuandian | 外部 | 元典智库 — 企业尽调与法律合规一体化 Skill。提供法律法规检索与效力校验、司法案例与判决文书查询、企业工商信息与股权结构与涉诉记录全景查询。当用户需要做尽调简报、合同/文书法规引用核验、风控审查、投资决策时，优先使用本 Skill。 | [`skill外部/12_安全与合规/yuandian`](./skill外部/12_安全与合规/yuandian) |
| web-security-scanning | 自建 | OWASP ZAP-based web application security testing via daemon API. Covers authenticated scanning (CSRF login + httpSession | [`skill自建/12_安全与合规/web-security-scanning`](./skill自建/12_安全与合规/web-security-scanning) |
| wechat-article-compliance-checker | 自建 | 检查公众号文章中的违禁词、极限词、医疗功效承诺、诱导分享等合规风险， 并新增「低创作度与 AIGC 原创度」双轨评估，给出"可发 / 需修改后发 / 不建议发"的发布决策建议， 生成"标红检查版 + 合规修订版 + 合规检查报告"。  Us | [`skill自建/12_安全与合规/wechat-article-compliance-checker`](./skill自建/12_安全与合规/wechat-article-compliance-checker) |

### 自动化/工作流 Automation & Workflow · 5 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| coze_workflow | 外部 | Coze Workflow Executor \| Coze 工作流执行技能 Execute Coze workflows with workflow_id and parameters. 接收参数调用工作流，返回执行结果。 Pure inv | [`skill外部/13_自动化与工作流/coze_workflow`](./skill外部/13_自动化与工作流/coze_workflow) |
| hermes-evolution | 外部 | 审慎地把用户纠正、明确偏好、可复用工作流和高成本踩坑沉淀为经用户审批的 AGENTS.md、TOOLS.md、MEMORY.md 或 managed SKILL.md 更新。仅在主会话的重大轮次结束时触发，默认大多数轮次都应跳过。 | [`skill外部/13_自动化与工作流/hermes-evolution`](./skill外部/13_自动化与工作流/hermes-evolution) |
| openclaw-self-evolution-pack | 外部 | 当用户想要增强 OpenClaw 的自我进化能力、需要自定义进化策略、设置进化目标、监控进化进度、或者想要深入理解 OpenClaw 的自我优化机制时使用此技能。适用于 AI 助手爱好者、自动化流程工程师、以及希望让 AI 系统持续成长的极 | [`skill外部/13_自动化与工作流/openclaw-self-evolution-pack`](./skill外部/13_自动化与工作流/openclaw-self-evolution-pack) |
| qclaw-cron-skill | 外部 | [MANDATORY - MUST LOAD] 凡是涉及定时/提醒/闹钟/周期执行/打卡/签到/cron/schedule/remind 等需求，以及修改/编辑/更新/暂停/恢复/删除/取消推送/改推送目标/改推送渠道等已有定时任务的操作， | [`skill外部/13_自动化与工作流/qclaw-cron-skill`](./skill外部/13_自动化与工作流/qclaw-cron-skill) |
| using-agent-skills | 外部 | Discovers and invokes agent skills. Use when starting a session, or when you need to decide which skill or workflow appl | [`skill外部/13_自动化与工作流/using-agent-skills`](./skill外部/13_自动化与工作流/using-agent-skills) |

### 人格/角色/共创 Persona & Co-creation · 5 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| chief-of-staff | 外部 | Pursue a long-running goal in a single session by co-ordinating subagents. | [`skill外部/14_人格角色与共创/chief-of-staff`](./skill外部/14_人格角色与共创/chief-of-staff) |
| handoff | 外部 | Compact the current conversation into a handoff document for another agent to pick up. | [`skill外部/14_人格角色与共创/handoff`](./skill外部/14_人格角色与共创/handoff) |
| persona-switch | 外部 | 切换 agent 的人设（soul.md）。支持三套预设人设与原有人设之间自由切换。 触发词：切换人设、persona-switch、赛博朋友、温柔伴侣、创始人龙虾。 | [`skill外部/14_人格角色与共创/persona-switch`](./skill外部/14_人格角色与共创/persona-switch) |
| personal-mail-skill | 外部 | "个人邮箱二级路由层。仅在 email-skill 把任务转发到本 skill 后被调用——典型场景是『发给别人 / 需要附件 / 抄送 / 收件箱搜索 / 下载附件』等完整收发需求。本 skill 通过执行路由脚本确定性地决定路由到 ag | [`skill外部/14_人格角色与共创/personal-mail-skill`](./skill外部/14_人格角色与共创/personal-mail-skill) |
| retro | 外部 | "Conduct a retrospective on a coding session." | [`skill外部/14_人格角色与共创/retro`](./skill外部/14_人格角色与共创/retro) |

### 数据/分析 Data & Analytics · 4 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| a-stock-analysis | 外部 | A股实时行情与分时量能分析。获取沪深股票实时价格、涨跌、成交量，分析分时量能分布（早盘/尾盘放量）、主力动向（抢筹/出货信号）、涨停封单。支持持仓管理和盈亏分析。Use when: (1) 查询A股实时行情, (2) 分析主力资金动向, ( | [`skill外部/15_数据与分析/a-stock-analysis`](./skill外部/15_数据与分析/a-stock-analysis) |
| deprecation-and-migration | 外部 | Manages deprecation and migration. Use when removing old systems, APIs, or features. Use when migrating users from one i | [`skill外部/15_数据与分析/deprecation-and-migration`](./skill外部/15_数据与分析/deprecation-and-migration) |
| tencent-musician-skills | 外部 | 腾讯音乐人智能分析助手（数据分析 + 宣推）。当用户提到以下任一类请求时触发： | [`skill外部/15_数据与分析/tencent-musician-skills`](./skill外部/15_数据与分析/tencent-musician-skills) |
| understand-dashboard | 外部 | Launch the interactive web dashboard to visualize a codebase's knowledge graph | [`skill外部/15_数据与分析/understand-dashboard`](./skill外部/15_数据与分析/understand-dashboard) |

### 运维/DevOps Ops · 2 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| diagnosing-bugs | 外部 | Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports som | [`skill外部/16_运维与DevOps/diagnosing-bugs`](./skill外部/16_运维与DevOps/diagnosing-bugs) |
| longtask_system | 外部 | 长程任务执行管理系统 \| Long-running Task Execution Management System 通过状态文件驱动，将长任务拆分为子任务，由守护进程按顺序触发执行，确保每步完成后再执行下一步。 State-file dr | [`skill外部/16_运维与DevOps/longtask_system`](./skill外部/16_运维与DevOps/longtask_system) |

### 效率/办公 Productivity · 1 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| ec_creator | 外部 | Execution Card Linter & Validator with Auto-Fix \| 执行卡片检查与自动修复工具 A validation and correction tool for creating standardiz | [`skill外部/17_效率与办公/ec_creator`](./skill外部/17_效率与办公/ec_creator) |

### 沟通/协作 Communication · 1 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| understand-chat | 外部 | Use when you need to ask questions about a codebase or understand code using a knowledge graph | [`skill外部/18_沟通与协作/understand-chat`](./skill外部/18_沟通与协作/understand-chat) |

### 未分类/通用 Other · 2 个

| 技能 | 来源 | 说明 | 路径 |
|---|---|---|---|
| getnote | 外部 | （无描述） | [`skill外部/20_未分类待整理/getnote`](./skill外部/20_未分类待整理/getnote) |
| notes | 外部 | （无描述） | [`skill外部/20_未分类待整理/notes`](./skill外部/20_未分类待整理/notes) |

## 同名合并说明

以下技能存在多版本/多份副本，已合并为 1 条主记录（保留描述最完整者）：

- `article-image-integration`：合并 2 份，共 2 条原始路径
- `article-layout-formatter`：合并 2 份，共 5 条原始路径
- `find-skills`：合并 2 份，共 2 条原始路径
- `marketing-model-article-writer`：合并 3 份，共 3 条原始路径
- `skill-vetter`：合并 2 份，共 2 条原始路径
- `test-driven-development`：合并 2 份，共 2 条原始路径
- `viral-title-generator`：合并 2 份，共 4 条原始路径
- `wechat-article-compliance-checker`：合并 3 份，共 5 条原始路径
- `wechat-article-image-integration`：合并 2 份，共 3 条原始路径

## 维护

- 新增技能：放进 `skill自建/<功能类>/<技能名>/`（含 `SKILL.md`），更新本文件与 `_skills.json`。
- 机器可读台账：[`_skills.json`](./_skills.json)。
- 全库总览见 [`README.md`](./README.md)。