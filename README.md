# AmySkills — 我的 AI Agent 技能库

> 个人 Agent Skills 收藏与创作库。覆盖 **微信公众号写作、软件测试工程、知识萃取与复盘、浏览器自动化、金融分析、内容采集** 等场景。
> 所有技能均遵循通用 Agent Skills 规范（含 `SKILL.md`），兼容 Claude Skills / OpenClaw / Codex / autoClaw 等主流 Agent 平台。

📊 **规模**：75 个技能目录（`SKILL.md`）+ 70+ 原始安装包（`.zip` / `.skill`） | 📅 更新：2026-11-03

---

## 📁 目录总览

| 分类目录 | 技能数 | 说明 |
| --- | --- | --- |
| [autoclaw常用技能](./autoclaw常用技能/) | 6 | 2026-11-03 去重增补：本机常用且库内尚未收录（飞书三件套、钉钉 dws、getnote、skill-vetter） |
| [autoClaw的SKILL库](./autoClaw的SKILL库/) | 26 | autoClaw 平台安装的通用技能（浏览器、搜索、金融、PPT、写作等） |
| [Manus生成微信文章技能](./Manus生成微信文章技能/) | 6 | 微信公众号文章创作全流程（Manus 制作）+ 原始 zip 包 |
| [Marvis生成修改的skills](./Marvis生成修改的skills/) | 12 | 与 Marvis 协作生成/迭代的技能（排版、配图、人味建模、合规检查等） |
| [Noah的skill最佳实践](./Noah的skill最佳实践/) | 12 | Noah 分享的热榜采集、Coze 工作流、长任务管理等最佳实践技能 |
| [所有claw必装skills](./所有claw必装skills/) | 7 | OpenClaw 基础必装（浏览器、技能发现、Get笔记、自我进化） |
| [我做的测试领域skills](./我做的测试领域skills/) | 1 | 自研测试领域技能（xlsx-to-docx）+ 测试相关 zip 包 |
| [市面上的测试领域skills](./市面上的测试领域skills/) | 0（23 个 zip） | 市面收集的测试技能安装包（未解包） |
| [知识萃取和复盘相关skill](./知识萃取和复盘相关skill/) | 2 | 每日论文收集、学习一页纸教程 |
| [未分类收集skills](./未分类收集skills/) | 2 | 新闻聚合、AI 味去除等零散收藏 |
| [codex的skill](./codex的skill/) | 0（1 个 zip） | Codex 侧技能（feishu2slide 便携版） |
| [QClaw的skill库](./QClaw的skill库/) | 0（1 个 zip） | QClaw 技能合集包 |
| [toamyskillhub](./toamyskillhub/) | 1 | 🔧 技能库发布工具：一键生成 README 清单 + 排除超大文件 + 代理回退推送 |

---

## 🧩 技能清单

### 1️⃣ autoClaw的SKILL库（26 个）

| 技能 | 简介 |
| --- | --- |
| [a-stock-analysis](./autoClaw的SKILL库/a-stock-analysis/) | A股实时行情与分时量能分析：涨跌、成交量、主力动向、涨停封单、持仓盈亏管理 |
| [apify-ultimate-scraper](./autoClaw的SKILL库/apify-ultimate-scraper/) | 全能网页爬虫：覆盖 Instagram / TikTok / YouTube / Google Maps 等 55+ 平台 |
| [autoglm-browser-agent](./autoClaw的SKILL库/autoglm-browser-agent/) | 智能浏览器自动化代理：打开网页、搜索、社交媒体操作、表单、截图、比价 |
| [autoglm-deepresearch](./autoClaw的SKILL库/autoglm-deepresearch/) | 深度研究与调研，输出结构化深度报告（行业调研、竞品分析） |
| [autoglm-file-upload](./autoClaw的SKILL库/autoglm-file-upload/) | 上传本地文件获取 URL / 资源 ID |
| [autoglm-generate-image-seedream](./autoClaw的SKILL库/autoglm-generate-image-seedream/) | Seedream 文生图接口，文字描述生成图片 |
| [autoglm-image-edit](./autoClaw的SKILL库/autoglm-image-edit/) | 图片编辑：加字、换背景、改元素、调风格 |
| [autoglm-image-recognition](./autoClaw的SKILL库/autoglm-image-recognition/) | 图片识别与内容描述（含 K 线图等图表分析） |
| [autoglm-open-link](./autoClaw的SKILL库/autoglm-open-link/) | 打开网页并提取正文内容 |
| [autoglm-search-image](./autoClaw的SKILL库/autoglm-search-image/) | 关键词搜图、查找图片素材 |
| [autoglm-stock-analysis](./autoClaw的SKILL库/autoglm-stock-analysis/) | 股票综合分析（websearch + open-link + yfinance 三路组合） |
| [autoglm-websearch](./autoClaw的SKILL库/autoglm-websearch/) | AutoGLM 联网搜索，查询最新资讯 |
| [bilibili-cli](./autoClaw的SKILL库/bilibili-cli/) | B站 CLI：视频 / 用户 / 热门 / 动态 / 收藏浏览，YAML 输出省 token |
| [deep-research](./autoClaw的SKILL库/deep-research/) | 多 agent 深度调研：4 路由 × ≥6 维度 × ≥10 search，≥110 searches/run |
| [delivery-artifact](./autoClaw的SKILL库/delivery-artifact/) | 成果单文件 HTML 交付物：文档 / 杂志长文 / PPT 风 / Stage 四形态 |
| [financial-suite](./autoClaw的SKILL库/financial-suite/) | 金融任务统一入口：个股研究、估值建模（DCF/LBO/三表）、尽调、KYC 等 30 个子技能索引 |
| [frontend-slides](./autoClaw的SKILL库/frontend-slides/) | 动画丰富的 HTML 演示文稿制作 / PPTX 转网页 |
| [hermes-evolution](./autoClaw的SKILL库/hermes-evolution/) | 把用户纠正、偏好、工作流沉淀为 AGENTS.md / MEMORY.md / SKILL.md 更新 |
| [memory](./autoClaw的SKILL库/memory/) | 无限分类存储的组织化记忆系统 |
| [pdf-creator](./autoClaw的SKILL库/pdf-creator/) | Markdown 渲染 PDF：中文字体、多主题、WeasyPrint / Chrome 双引擎 |
| [pptx-swarm](./autoClaw的SKILL库/pptx-swarm/) | PPTD swarm 工作流批量生成可编辑 PPT（⚠️ 249.6MB 的 pptd_dsl.pyz 超出 GitHub 限制，未随库上传） |
| [skill-creator](./autoClaw的SKILL库/skill-creator/) | 官方元技能：指导创建高质量新技能 |
| [ui-ux-pro-max](./autoClaw的SKILL库/ui-ux-pro-max/) | UI/UX 设计智能：设计系统、组件规范、可访问性、前端代码落地 |
| [wps](./autoClaw的SKILL库/wps/) | WPS Office 工作流：文档 / 表格 / 演示、格式兼容、批注修订、导出 PDF |
| [write-skill](./autoClaw的SKILL库/write-skill/) | 多 worker 长文档写作：大纲 → 分章 → 四道闸门审稿 → 拼装 |
| [挖券券儿](./autoClaw的SKILL库/挖券券儿/) | 外卖红包优惠券领券神器：美团 / 饿了么 / 京东外卖隐藏优惠 |

### 2️⃣ Manus生成微信文章技能（6 个 + 原始包）

| 技能 | 简介 |
| --- | --- |
| [ai-trend-report-layout](./Manus生成微信文章技能/ai-trend-report-layout/) | AI 趋势报告排版规范与模板（MUSE 模型：奇迹/使用/创业/变革四层结构） |
| [Get笔记-Manus适用](./Manus生成微信文章技能/Get笔记-Manus适用/) | Get笔记个人知识库管理：记笔记、存链接、查知识库、博主订阅（⚠️ 内置个人 Key 配置位） |
| [knowledge-sharing-article-layout](./Manus生成微信文章技能/knowledge-sharing-article-layout/) | 硬核知识分享类文章排版：痛点引入→案例应用→理论解析→个人经验→总结升华五段式 |
| [viral-title-generator](./Manus生成微信文章技能/viral-title-generator/) | 四象限爆款标题方法论：生成 10 个候选标题 → Checklist 打分 → TOP 3 推荐 |
| [wechat-article-compliance-checker](./Manus生成微信文章技能/wechat-article-compliance-checker/) | 公众号违禁词与广告法检查，输出标红版 + 干净版 |
| [wechat-article-image-integration](./Manus生成微信文章技能/wechat-article-image-integration/) | 为公众号文章每章节生成 AI 配图并整合进 Markdown |

**原始安装包**：`ai-muse-business-weekly.zip`、`marketing-model-article-writer.zip`（V1/V2）、`one-page-tutorial.zip`（V1）、`article-layout-formatter.zip`（V1/MAVIS）、`viral-title-generator.zip`（V1.skill）、`wechat-article-compliance-checkerV1.0.zip`、`wechat-article-image-integration.zip`（-1 / V1.skill）、`Get笔记-Manus适用.zip` 等见 [Manus生成微信文章技能/](./Manus生成微信文章技能/)；子目录「知识萃取技能-个人通用学习知识萃取全套」含 `corpus-semantic-parser.skill`（语料语义解析）与 `short-video-transcriber.zip`（短视频转写）。

### 3️⃣ Marvis生成修改的skills（12 个 + 原始包）

| 技能 | 简介 |
| --- | --- |
| [aaron-style-transformer](./Marvis生成修改的skills/aaron-style-transformer/) | 按 Aaron（雪松）思维四定律 + 语言四定律改写文章，checklist 打分 ≥95 分 |
| [article-image-integration](./Marvis生成修改的skills/article-image-integration/) | 公众号配图生成 v3：自带 13 大风格参考图库，看图决策直接批量生成 |
| [article-layout-formatter](./Marvis生成修改的skills/article-layout-formatter/) | 长文初稿改造为「商业模型拆解 / 品牌案例复盘」风格，评分至 95% 达标 |
| [arxiv-obsidian-collector](./Marvis生成修改的skills/arxiv-obsidian-collector/) | 每周轮转抓取 arXiv 论文，LLM 评分过滤后生成 Obsidian 双链笔记（66 个分类） |
| [byted-ark-seedream](./Marvis生成修改的skills/byted-ark-seedream/) | 豆包 Seedream 图片生成（火山方舟 Agent Plan 定制版，支持组图 / 流式 / 联网） |
| [cancer-research](./Marvis生成修改的skills/cancer-research/) | 按癌种维护「方案索引报告」+ 药物 SQLite 物料清单（中西医双 tag） |
| [double-triangle-review](./Marvis生成修改的skills/double-triangle-review/) | 双三角清单体量化复盘：6 大能力维度 27 子模块自动评分，SVG 雷达图 + 90 天成长线 |
| [human-voice-modeler](./Marvis生成修改的skills/human-voice-modeler/) | 人味建模器 v2.5：诊断 AI 味 → 改写 → 从 0 写人味文章，5 层动态路由 30 步流程 |
| [image-creator](./Marvis生成修改的skills/image-creator/) | 图像生成助手：4 大类 17 种风格（手办 / 场景 / 产品 / 风格转换） |
| [viral-title-generator](./Marvis生成修改的skills/viral-title-generator/) | 爆款标题生成器（Marvis 迭代版，含四力模型参考文档） |
| [wechat-article-compliance-checker](./Marvis生成修改的skills/wechat-article-compliance-checker/) | 公众号合规检查 v2：违禁词 + 低创作度 + AIGC 原创度双轨评估，给出发布决策（附反向案例图库） |

**原始安装包**：`fact-verifier.zip`（事实核查）、`double-triangle-review-V1-L3等级.zip`、`arxiv-obsidian-collector.zip`、各 MAVIS 版本包等，见 [Marvis生成修改的skills/](./Marvis生成修改的skills/)。

### 4️⃣ Noah的skill最佳实践（12 个 + 原始包）

| 技能 | 简介 |
| --- | --- |
| [baidu-hot-cn](./Noah的skill最佳实践/baidu-hot-cn-1/) | 百度热榜监控：热搜榜、搜索趋势、关键词热度 |
| [coze_workflow](./Noah的skill最佳实践/coze-workflow-1.1.3/) | Coze 工作流执行器：按 workflow_id + 参数调用并返回结果（纯净调用层） |
| [douyin-hot-trend](./Noah的skill最佳实践/douyin-hot-trend-1/) | 抖音热榜：热门视频、挑战赛、音乐，输出标题 / 热度 / 链接 |
| [ec_creator](./Noah的skill最佳实践/ec_creator/) | 执行卡片（Execution Card）Linter 校验与自动修复 |
| [image_gen_coze](./Noah的skill最佳实践/image-gen-coze-1.1.3/) | 基于 Coze 工作流的图像生成（Seedream 4.5） |
| [longtask_system](./Noah的skill最佳实践/longtask_system/) | 长程任务管理：状态文件驱动拆分子任务，守护进程顺序触发 |
| [rss_fetcher](./Noah的skill最佳实践/rss_fetcher/) | 统一 RSS 采集管理：增量抓取、去重、自动标签、源健康监控、HTML 报告 |
| [style-fingerprint](./Noah的skill最佳实践/style_fingerprint/) | 中文写作风格指纹提取与保存，供写作 agent 调用（纯 Python 无依赖） |
| [toutiao-news-trends](./Noah的skill最佳实践/toutiao-news-trends-0/) | 今日头条热榜：时政 / 财经 / 社会 / 国际 / 科技 / 娱乐 |
| [weibo-hot-search](./Noah的skill最佳实践/weibo-fresh-posts-0/) | 微博多频道热搜采集与可视化（总榜 / 社会 / 文娱 / 生活） |
| [weibo-publisher](./Noah的skill最佳实践/weibo-publisher/) | 浏览器自动化发微博（文本 / 图片），需已有登录态 cookie |
| [zhihu-fetcher](./Noah的skill最佳实践/zhihu-fetcher/) | 知乎数据获取：三级认证降级（Browser Profile → File Cookie → Fallback） |

### 5️⃣ 所有claw必装skills（7 个 + 原始包）

| 技能 | 简介 |
| --- | --- |
| [Agent Browser](./所有claw必装skills/agent-browser/) | Rust 高性能无头浏览器自动化 CLI（导航 / 点击 / 输入 / 快照） |
| [find-skills](./所有claw必装skills/find-skills/) | 技能发现最高优先级流程：中文用户优先 skillhub，回退 clawhub |
| [Get笔记](./所有claw必装skills/getnote-openclaw-main/) | Get笔记 OpenClaw 版（同 Manus 版能力） |
| [one-page-tutorial](./所有claw必装skills/one-page-tutorial/) | 任意话题全网调研 → 一页纸教程（人机双友好） |
| [openclaw-self-evolution-pack](./所有claw必装skills/openclaw-self-evolution-pack/) | OpenClaw 自我进化能力包：自定义进化策略、目标、进度监控 |
| [skill-evolve-nightly](./所有claw必装skills/skill-evolve-nightly/) | 每夜批量技能维护（daemon 调度，不手动加载） |
| [self-improvement](./所有claw必装skills/skill2-self-improving/) | 自我改进：捕获失败、纠正、缺失能力，持续学习复盘 |

**原始安装包**：`skill-vetter.zip`（技能安全评估元技能）、`metaphor-scholar.zip`、`getnote.zip` 等。

### 6️⃣ 测试领域技能

| 技能 | 位置 | 简介 |
| --- | --- | --- |
| [xlsx-to-docx](./我做的测试领域skills/xlsx-to-docx/) | 我做的测试领域skills | ✍️ 自研：多 Sheet xlsx（含图片）转 Word docx，图片自动提取与位置锚定 |
| test-patterns 1.0.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 多语言测试基础框架（Node/Python/Go/Rust），🔴 高优必装 |
| test-runner | [市面上的测试领域skills/](./市面上的测试领域skills/) | 单元 / 集成 / E2E 测试执行管理 |
| test-driven-development 1.1.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 完整 TDD 流程指导 |
| web-exploratory-tester 1.11.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | Web 探索式测试 |
| web-security-scanning 2.2.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | Web 安全扫描 |
| test-report 2.7 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 测试报告生成 |
| cron-scheduled-test-runner 1.0.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 定时调度测试执行 |
| monitored-test-framework | [市面上的测试领域skills/](./市面上的测试领域skills/) | 带监控的测试框架 |
| test-master 0.1.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 全面测试策略规划 |
| yunxiao-defect-submit 1.1 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 云效缺陷提交 |
| xlsx2prd / xum2md | [市面上的测试领域skills/](./市面上的测试领域skills/) | 需求文档转换（xlsx→PRD、xum→md） |
| prd2ytlist | [市面上的测试领域skills/](./市面上的测试领域skills/) | PRD 转有道云任务清单 |
| token-usage-meter 1.0.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | Token 用量计量 |
| prompt-xray 1.0.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | Prompt 透视分析 |
| hermes-model-backup-failover 1.1.0 | [市面上的测试领域skills/](./市面上的测试领域skills/) | 模型备份与故障切换 |
| kb-bootstrap | [市面上的测试领域skills/](./市面上的测试领域skills/) | 知识库初始化 |
| post-task-methodology-loop | [市面上的测试领域skills/](./市面上的测试领域skills/) | 任务后方法论沉淀循环 |
| sub-module-test-report（已废弃） | [市面上的测试领域skills/](./市面上的测试领域skills/) | 子模块测试报告（deprecated） |
| verify-slider-bypass | [市面上的测试领域skills/](./市面上的测试领域skills/) | 滑块验证绕过测试 |
| srmpro-login | [市面上的测试领域skills/](./市面上的测试领域skills/) | SRM 系统登录自动化 |
| double-triangle-review.zip | [市面上的测试领域skills/](./市面上的测试领域skills/) | 双三角复盘（测试版） |

### 7️⃣ 知识萃取和复盘相关skill（2 个 + 原始包）

| 技能 | 简介 |
| --- | --- |
| [daily-paper-collector](./知识萃取和复盘相关skill/daily-paper-collector/) | 每日 arXiv 论文收集：AI + 自主测试方向，白话解读，存档 memory/ 与得到大脑 |
| [learning-one-pager](./知识萃取和复盘相关skill/learning-one-pager/) | 通用理论 / 教程 / 课程学习：提炼结构化一页纸教程 + 案例库（附课程笔记 references） |

**原始安装包**：`double-triangle-review-V2-L6等级.zip`、`daily-paper-collector.zip`。

### 8️⃣ 未分类收集skills（2 个 + 资料）

| 技能 | 简介 |
| --- | --- |
| [news-aggregator-skill](./未分类收集skills/skill1-news-aggregator/news-aggregator-skill/) | 全网新闻聚合：28 信源（HN / GitHub / HF Papers / 华尔街见闻 / 微博 / 播客），含 110 RSS 源脚本与每日简报 |
| [humanizer-zh](./未分类收集skills/skill3-humanizer/) | AI 味去除器：基于维基百科「AI 写作特征」指南，修复夸大象征、宣传语、破折号滥用等 9 类模式 |

**其他资料**：`trumanskill.md`（许楚视角引擎，Nuwa 蒸馏案例）、`学习虾-说明书.pdf`、`multi-writing-skills教程.pdf`。

### 9️⃣ codex 与 QClaw 技能包

| 安装包 | 简介 |
| --- | --- |
| [feishu2slide-portable-release](./codex的skill/) | 飞书文档转幻灯片便携版（84.5MB） |
| [skills.zip](./QClaw的skill库/) | QClaw 技能库合集包 |
| [byted-ark-seedream-skill.zip](./byted-ark-seedream-skill.zip) | 豆包 Seedream 官方原包（根目录） |

---

### 🔟 autoclaw常用技能（6 个，2026-11-03 去重增补）

本机 autoClaw 技能目录 21 个候选与库内已有 64 个技能逐文件比对去重后，收录库内缺失的 6 个；其余 15 个与库内副本内容一致（仅换行与商店元数据差异）跳过，平台内部与官方已开源技能不重复收录。详见 [autoclaw常用技能/README.md](./autoclaw常用技能/README.md)。

| 技能 | 简介 |
| --- | --- |
| [feishu-doc](./autoclaw常用技能/feishu-doc/) | 飞书 Wiki/文档/表格/Bitable 抓取转 Markdown（凭据走环境变量，已剔除私有 cache/） |
| [feishu-chat-history](./autoclaw常用技能/feishu-chat-history/) | 飞书群聊历史记录获取 |
| [feishu-cron-reminder](./autoclaw常用技能/feishu-cron-reminder/) | 飞书定时提醒任务 |
| [dws](./autoclaw常用技能/dws/) | 钉钉全家桶：AI 表格/文档/日历/通讯录/群机器人/待办/审批/考勤/日志/邮箱/知识库 |
| [getnote](./autoclaw常用技能/getnote/) | Get 笔记 autoClaw 安装版（与库内 Manus 版 / OpenClaw 版为不同变体，references 更全） |
| [skill-vetter](./autoclaw常用技能/skill-vetter/) | 技能安装前安检元技能：红旗、权限范围、可疑模式检查 |

> 注：feishu-doc 的本机 cache/ 目录含私有飞书文档内容，未随库上传；pptx-swarm 的 249.6MB pyz 维持库内既有约定不传。

### 1️⃣1️⃣ toamyskillhub（1 个）

| 技能 | 简介 |
| --- | --- |
| [toamyskillhub](./toamyskillhub/) | 技能库一键发布到 GitHub：自动生成 README 技能清单（解析 SKILL.md frontmatter）、暂存复制（排除 >100MB 超限文件 / `__pycache__` / 嵌套 `.git`）、git 初始化提交、直连失败自动切系统代理重试、远端分叉自动 rebase、推送后 SHA 校验。附踩坑手册与跨平台手工步骤 |

---

## 📦 安装使用

```bash
# 方式一：直接克隆整个技能库
git clone https://github.com/yxs029/amyskills.git

# 方式二：只取某个技能目录，放入 Agent 的 skills 目录
# Claude Code:    ~/.claude/skills/<skill-name>/
# OpenClaw:       ~/.openclaw/skills/<skill-name>/
# Codex / 其他:   参照对应平台的 skills 路径
```

每个技能目录含 `SKILL.md`（YAML frontmatter 的 `name` + `description` + 使用流程），部分含 `scripts/`（脚本）、`references/`（参考文档 / 案例库）。

**安装前建议**：用 [skill-vetter](./所有claw必装skills/) 类元技能或 Snyk 扫描做一次安全评估。

---

## ⚠️ 已知说明

1. **超大文件**：`pptx-swarm/scripts/pptd_dsl.pyz`（249.6MB）超出 GitHub 单文件 100MB 限制，未上传；需要完整版请自行打包。
2. **密钥安全**：所有技能内的 API Key 均为占位符（如 `你的key`），无真实密钥泄露；`Get笔记`、`coze_workflow` 等技能使用前需填入自己的 Key。
3. **环境依赖**：部分技能依赖本地服务（如 AutoGLM 系列 token 来自 `http://127.0.0.1:18432/get_token`）、Python / Node 运行时或浏览器登录态，使用前请阅读各 SKILL.md。
4. **重复版本**：部分技能同时保留「解包目录 + 历史版本 zip」，以解包目录为准，zip 供版本回溯。

## 🙏 致谢与来源

部分技能收集自社区开源项目与技能市场，感谢以下来源：

- [anthropics/skills](https://github.com/anthropics/skills)（skill-creator 等）、[awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
- [ClawHub](https://clawhub.ai/)、[skills.sh](https://www.skills.sh/)、[awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)
- Noah（rss_fetcher、热榜系列，[Skills_Repo](https://github.com/noah-1106/Skills_Repo)）、Datawhale 社区案例（learning 虾、Book2Skills 等）
- Manus / Marvis / autoClaw / QClaw / Codex 各平台生态

> 📌 相关调研笔记（技能市场渠道、测试技能选型矩阵、Datawhale 案例合集）存于本机知识库，未随本库上传。

---

*Licensed for personal learning & reference. 各技能版权归原授权方所有，二次分发请遵循对应开源协议。*
