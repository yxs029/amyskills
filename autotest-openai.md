# 自动化测试与开放平台资源清单（autotest-openai）

> **用途**：记录自动化测试必装框架、AI/Computer Use 生态、以及各类开放平台入口，供 AI Agent 与测试工程快速查阅。
> **性质**：纯文档索引（**不执行安装、不调用 API**）。整理日期：2026-11-11。
> **数据说明**：★ = GitHub Stars（2026-11-11 快照，来自 GitHub API）；补充条目经网上检索 + GitHub 核实，与用户给定条目去重。

---

## 一、自动化必装框架（用户指定）

| 类别 | 框架 | 官方地址 | 说明 | 核实 |
|---|---|---|---|---|
| **视觉识别** | Midscene | [web-infra-dev/midscene](https://github.com/web-infra-dev/midscene) | "See interfaces like a human" —— 用自然语言做 E2E，视觉/AI 驱动定位，不依赖脆弱选择器；TypeScript | ★15,581 · MIT · 活跃 |
| **通用识别（Web E2E）** | Playwright | [microsoft/playwright](https://github.com/microsoft/playwright) | 单 API 覆盖 Chromium / Firefox / WebKit，Web 测试与自动化事实标准 | ★99,828 · Apache-2.0 · 当日有提交 |
| **移动端** | Appium | [appium/appium](https://github.com/appium/appium) | 基于 W3C WebDriver 协议的跨平台自动化（iOS / Android / 桌面 / 混合应用） | ★22,208 · Apache-2.0 |
| **Python 测试框架** | pytest | [中文文档](https://pytest.cn/en/stable/index.html) · [官方文档](https://docs.pytest.org/en/stable/) | Python 单元/集成测试标准框架，fixture / 参数化 / 插件生态 | 两站点均可达(200) · GitHub ★14,681 |

### 1.1 四者如何配合（测试金字塔视角）

| 层 | 选型 | 理由 |
|---|---|---|
| 单元 / 接口 | **pytest** (+ requests / httpx) | 快、稳、断言强 |
| Web 端到端（稳定回归） | **Playwright** | 选择器可靠、跨浏览器、trace/screenshot 证据完整 |
| Web 端到端（探索/免维护脚本） | **Midscene** | 自然语言 + 视觉定位，页面改版不易失效，适合 AI 驱动 |
| 移动端 / 桌面端 | **Appium** | W3C 标准、跨平台、生态成熟 |

> 实践建议：稳定回归用 Playwright 保确定性，探索性/易变页面用 Midscene 补灵活性；不要让 AI 视觉方案承担全部回归。

---

## 二、AI 补充：网上流行的各类自动化框架

> 与第一节去重（Playwright / pytest 不再重复）。按用途分组，均为社区高流行度项目，★ 为核实值。

### 2.1 传统/经典自动化框架

| 框架 | 地址 | 定位 | ★ |
|---|---|---|---|
| Selenium | [seleniumhq/selenium](https://github.com/seleniumhq/selenium) | 浏览器自动化老牌生态，WebDriver 标准、多语言 | 34,580 |
| Cypress | [cypress-io/cypress](https://github.com/cypress-io/cypress) | 前端 E2E，时间旅行调试、开发体验好 | 51,024 |
| Robot Framework | [robotframework/robotframework](https://github.com/robotframework/robotframework) | 关键字驱动、验收测试/ATDD，生态库丰富 | 11,985 |
| WebdriverIO | [webdriverio/webdriverio](https://github.com/webdriverio/webdriverio) | Node.js 全栈自动化（Web + 移动 + 桌面） | 高流行 |
| Puppeteer | [puppeteer/puppeteer](https://github.com/puppeteer/puppeteer) | Chrome DevTools Protocol 轻量控制 | 高流行 |
| Maestro | [mobile-dev-inc/maestro](https://github.com/mobile-dev-inc/maestro) | 移动端 YAML 声明式 E2E，比 Appium 轻量 | 高流行 |
| Airtest | [AirtestProject/Airtest](https://github.com/AirtestProject/Airtest) | 网易出品，图像识别驱动的跨端（游戏/App）自动化 | 高流行 |
| HttpRunner | [httprunner/httprunner](https://github.com/httprunner/httprunner) | 国产接口/场景测试框架，YAML/JSON 用例 | 高流行 |
| k6 | [grafana/k6](https://github.com/grafana/k6) | 性能/负载测试（JS 脚本） | 高流行 |
| Locust | [locustio/locust](https://github.com/locustio/locust) | Python 分布式压测 | 高流行 |

### 2.2 Computer Use / AI 驱动自动化（重点补充）

> 这一类正是 "Computer User：AI 可以进一步补充" 的方向——让 AI 像人一样看屏幕、点按钮。

| 项目 | 地址 | 定位 | ★ |
|---|---|---|---|
| browser-use | [browser-use/browser-use](https://github.com/browser-use/browser-use) | 开源 Python AI 浏览器 Agent，把网页可访问性树交给 LLM 驱动 | **120,656** |
| Stagehand | [browserbase/stagehand](https://github.com/browserbase/stagehand) | Browserbase 出品：AI 与代码混合的浏览器 SDK（`act` / `extract` / `observe`） | 25,995 |
| Skyvern | [Skyvern-AI/skyvern](https://github.com/Skyvern-AI/skyvern) | 用 LLM + 视觉自动化浏览器工作流，抗页面改版 | 23,376 |
| OmniParser | [microsoft/OmniParser](https://github.com/microsoft/OmniParser) | 微软：纯视觉屏幕解析，把 UI 截图转成结构化元素（CUA 的"眼睛"） | 25,615 |
| CUA (trycua) | [trycua/cua](https://github.com/trycua/cua) | 开源 computer-use 2.0 驱动，跨平台沙箱 + 模型，规模化管理 | 32,163 |
| UI-TARS | [bytedance/UI-TARS](https://github.com/bytedance/UI-TARS) | 字节：端到端原生 GUI Agent 模型（视觉→动作） | 高流行 |
| OpenAI Operator / CUA | [openai.com/index/operator](https://openai.com/index/operator/) · [Computer-Using Agent](https://platform.openai.com/docs/guides/tools-computer-use) | 云端 CUA：看截图、鼠标键盘操作浏览器 | 商业服务 |
| Claude Computer Use | [anthropic.com/news/3-5-models-and-computer-use](https://www.anthropic.com/news/3-5-models-and-computer-use) | Anthropic 的 computer use API（截图 + 坐标点击） | 商业 API |
| Playwright MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 把 Playwright 能力通过 MCP 暴露给 AI Agent（结构化快照，非纯视觉） | 官方 |
| Midscene（已列） | 见 §1 | 国产视觉 E2E，与 CUA 思路同源 | — |

**选型提示**：
- 要**确定性回归** → Playwright / Selenium / Cypress（§1、§2.1）；
- 要**AI 自主完成未知流程** → browser-use / Skyvern / CUA（§2.2）；
- 要**给 Agent 加浏览器工具** → Playwright MCP；
- 纯视觉 vs 结构化的取舍：视觉方案（OmniParser/UI-TARS）抗改版但慢且贵；DOM/可访问性树方案（browser-use/Playwright MCP）快且省，但依赖页面结构。

---

## 三、开放平台（用户指定）

| 平台 | 入口 | 用途 | 状态 |
|---|---|---|---|
| **飞书开放平台** | https://open.feishu.cn/document/home/index?lang=zh-CN | 飞书应用/机器人/消息/文档/审批/多维表格等 API，配套 Lark CLI | 200 |
| **移动云盘开放平台（139）** | https://open.yun.139.com/#/help-document-new/index?type=API&id=51 | 中国移动云盘开放 API（文件/存储能力接入） | 200 |
| **微信开放平台** | https://developers.weixin.qq.com/doc/oplatform/openApi/ | 微信开放平台 OpenAPI（移动应用/网站应用/第三方平台） | 200 |

> 三者区别：飞书=企业协作生态；移动云盘=网盘存储能力；微信开放平台=微信体系应用接入（区别于「微信公众平台/小程序」，见 §4）。

---

## 四、AI 补充：网上流行的各类开放平台

> 与 §3 去重；按生态分组，链接均已验证可达（200）。

### 4.1 企业协作 / 办公

| 平台 | 入口 | 说明 |
|---|---|---|
| 钉钉开放平台 | https://open.dingtalk.com/ | 钉钉应用/机器人/审批/群会话 |
| 企业微信开发者中心 | https://work.weixin.qq.com/api/doc | 企微应用/客户联系/消息 API（注意与「微信开放平台」不同） |

### 4.2 支付 / 交易

| 平台 | 入口 | 说明 |
|---|---|---|
| 支付宝开放平台 | https://open.alipay.com/ | 支付/小程序/生活号/芝麻等 |
| 微信支付 | https://pay.weixin.qq.com/wiki/doc/api/index.html | 支付 API（与 §3 的开放平台是不同文档域） |

### 4.3 内容 / 流量 / 小程序

| 平台 | 入口 | 说明 |
|---|---|---|
| 抖音开放平台 | https://open.douyin.com/ | 抖音小程序/视频/达人/数据开放 |
| 微信小程序 | https://developers.weixin.qq.com/miniprogram/dev/framework/ | 小程序开发框架（区别于 §3 的「微信开放平台」OpenAPI） |
| 微信公众平台 | https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html | 公众号/服务号接口 |

### 4.4 云 / AI / 地图能力

| 平台 | 入口 | 说明 |
|---|---|---|
| 腾讯云 API | https://cloud.tencent.com/document/api | 云产品 API 总目录 |
| 阿里云 OpenAPI | https://next.api.aliyun.com/ | 阿里云 API 门户（与 `aliyun-cli` 配套，见 `CLI-config.md`） |
| 高德开放平台 | https://lbs.amap.com/api | 地图/定位/路径规划 |
| 百度智能云 / AI 开放平台 | https://cloud.baidu.com/ · https://ai.baidu.com/ | AI 能力（OCR/语音/NLP）开放 |
| 火山引擎 | https://www.volcengine.com/docs | 与 `CLI-config.md` 的火山 CLI 配套 |

### 4.5 检索说明

- 本节的"流行"依据：Bing 检索结果提及 + 各平台官方域名可达性核实 + 开发者生态常识；**未做精确的排名统计**，如需按活跃度/API 数量排序可再补。
- 开放平台 ≠ 自动化测试框架：前者是**被测对象/集成对象**（要调它的 API），后者是**测试工具**（§1、§2）。测试这些平台接口时，用 §1 的 pytest + requests/HttpRunner 即可。

---

## 五、一页速查

| 我要做什么 | 用哪个 |
|---|---|
| 写稳定的 Web 回归用例 | Playwright |
| 页面老改版、不想维护选择器 | Midscene |
| 用大白话指挥浏览器 | browser-use / Stagehand / Skyvern |
| 让 AI 像人一样操作整个桌面 | CUA / UI-TARS / Claude Computer Use / OpenAI Operator |
| 给 Agent 装浏览器工具 | Playwright MCP |
| 测手机 App | Appium 或 Maestro / Airtest |
| 测接口 / 写单测 | pytest（+ HttpRunner / k6 压测） |
| 给飞书/企微/钉钉发消息、读文档 | 对应开放平台 §3/§4 + Lark CLI（`CLI-config.md`） |
| 接支付宝/微信支付 | §4.2 |
| 接小程序/抖音 | §4.3 |

---

## 六、维护记录

| 日期 | 变更 |
|---|---|
| 2026-11-11 | 初版：录入用户指定 4 框架 + 3 开放平台；补充 10 个传统框架、10 个 Computer Use/AI 项目、12 个开放平台（均已与用户条目去重）；GitHub ★ 与链接可达性已核实 |
