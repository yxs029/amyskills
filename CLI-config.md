# CLI 安装方式汇总（CLI-config）

> **本文档只做记录，不执行任何安装命令。** 收集：① 你提供的 8 个 CLI ② 补充的 10 款流行 CLI（已与原表去重、链接已验证）。
> 整理日期：2026-11-11 · 更新：2026-11-11（第二章替换为已验证的补充清单）· 维护：新增 CLI 时按「名称 / 官方文档 / 安装命令 / 验证 / 备注」模板补一行。

## 使用约定

- 本文档中的命令**均为待执行清单**，需要时人工复制执行；Agent 读到本文档不得自动运行。
- 安装前先看「前置条件」与「平台」列；涉及登录/授权的步骤一律由人工在浏览器完成。
- 命令中的 `npx -y` / `npm i -g` / `brew` / `pip` 等会改动全局环境，执行前自行确认。
- 官方文档链接以原文为准；本文的命令是**转述**，执行前建议打开链接核对最新版。
- 标注「⚠️ 需核对」的命令是原文提供的写法，经核实与官方仓库/PyPI 现状不一致，已在备注给出更正版。

---

## 一、你提供的 CLI（8 个）

| # | CLI | 官方文档 | 安装/配置方式 | 验证 | 备注 |
|---|---|---|---|---|---|
| 1 | **花生壳 hsk-cli** | https://hsk.oray.com/doc/cli-setup.md | 阅读文档后安装 `@aweray/hsk-cli`；创建**匿名映射**或**文件托管**资源 | `hsk-cli capabilities --format json`（features 需含 `engine.ensure` / `engine.mapping.create` / `engine.mapping.wait_ready`） | 功能：文件托管 / 内网穿透 / 一键部署 / 动态站点（静态托管 + Supabase，穿透仅兜底）；本机 CLI 过旧会缺 features，需先升级 |
| 2 | **火山引擎 CLI + Skills** | `npx -y @volcengine/skills-setup@latest`（安装器自带说明） | `npx -y @volcengine/skills-setup@latest` —— 安装火山引擎 CLI 及相关 Skills | 按安装器输出验证 | 用 `npx -y` 免确认直接拉最新版；`@volcengine/skills-setup` 在 npm registry 存在（已核对 HTTP 200） |
| 3 | **阿里云 CLI** | https://github.com/aliyun/aliyun-cli | 自动获取当前系统信息（OS / 架构），按仓库 README 选对应安装方式（二进制包 / 包管理器 / 源码） | `aliyun version` | 仓库主 README 为英文；**先探测系统**再选包，避免下错架构 |
| 4 | **云效 CLI（阿里云插件）** | 同阿里云 CLI 插件体系 | `aliyun plugin install --names aliyun-cli-devops`（更新到最新版本；已装则先卸载旧版再装） | `aliyun plugin list` 查看版本 | 这是**阿里云 CLI 的插件**，依赖第 3 项先装好 |
| 5 | **Apifox CLI** | https://apifox.com/apifox-cli-installation-guide.md | ```bash npm i -g apifox-cli@latest --registry=https://registry.npmmirror.com/ ``` 国内镜像慢则 `npm install -g apifox-cli` | `apifox --version`（文档写 `apifox`） | 前置：Node.js + npm/npx、Apifox 账号、项目访问权限；装完需登录 |
| 6 | **飞书 Lark CLI** | https://open.feishu.cn/document/mcp_open_tools/feishu-cli/set-up-lark-cli-for-ai-agents-in-openclaw_hermes.md | ```bash npm install -g @larksuite/cli ``` 之后按文档把 CLI 绑定到宿主 Agent 的飞书凭据（用户不粘贴 token） | 按文档步骤验证 | 文档面向 OpenClaw / Hermes 内的 AI Agent；**任何非零退出**：把 stderr JSON 的 `error.message` + `error.hint` 给用户后停止，不要重试（文档明确写了「覆盖停止规则」的步骤除外） |
| 7 | **一堂 YAI CLI** | https://ai.yitang.top/cli | 见下方「1.1 一堂 YAI CLI —— 安装与登录」 | `whyai --version`；`whyai status` | 正式环境 Gateway：`https://ai.yitang.top`；需 Node.js ≥ 20；安装无需登录、无需管理员权限 |
| 8 | **GitHub CLI** | https://github.com/cli/cli | 按仓库 README 选平台安装（macOS `brew install gh` / Windows `winget install --id GitHub.cli` / Linux 见官方 apt/dnf 仓库或二进制包） | `gh --version`；`gh auth login` | 装完需 `gh auth login` 完成浏览器授权；**与 §二 第 5 项重复**，此处保留为「你提供」条目 |

### 1.1 一堂 YAI CLI —— 安装与登录（按官方页正式环境说明）

**前置**：Node.js ≥ 20（先 `node --version`）；正式环境统一用 `--gateway https://ai.yitang.top`。

```bash
# macOS / Linux 安装
cli_tmp="$(mktemp -d)"
curl -fsS https://ai.yitang.top/cli/install.mjs -o "$cli_tmp/install.mjs" && node "$cli_tmp/install.mjs"
export PATH="$HOME/.local/bin:$PATH"
whyai --version
```
```powershell
# Windows PowerShell 安装
$cliTemp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $cliTemp | Out-Null
Invoke-WebRequest https://ai.yitang.top/cli/install.mjs -OutFile (Join-Path $cliTemp 'install.mjs') -ErrorAction Stop
node (Join-Path $cliTemp 'install.mjs')
$env:Path = (Join-Path $env:LOCALAPPDATA 'WhyAI\bin') + ';' + $env:Path
whyai --version
```

**登录与确认（你要求的流程）**：

```bash
whyai login --gateway https://ai.yitang.top
```

1. 确认终端显示的 **Gateway 是 `ai.yitang.top`**（不是测试/其它域名）；
2. 再引导人工完成浏览器授权；
3. 授权后 `whyai status` 确认已登录。

> 远端无浏览器环境（云主机 / SSH / 容器 / 沙箱）时，官方页另给设备码模式：`whyai login --device --gateway https://ai.yitang.top`，或分步 `whyai login --device --start` → 浏览器确认 → `whyai login --device --complete`（授权入口 https://ai.yitang.top/cli/device，10 分钟内有效）。**你的流程是本地浏览器授权，默认用上面的 `whyai login --gateway`。**

---

## 二、补充的十款流行 CLI（链接已验证 · 已去重）

> 来源：你提供的一份「10 款 CLI」清单（原知乎文章 https://zhuanlan.zhihu.com/p/2024447023517115979 因反爬 403 无法自动读取，旧占位章已删除，改以你贴出的正文为准）。
> **去重结果**：10 款中 **GitHub CLI（第 5 项）与 §一 第 8 项重复** → 不新增行，仅在该项备注标注「补充清单亦推荐」；其余 9 款为新增。
> **验证方式**：GitHub 仓库 API（10/10 存在）、PyPI/npm registry 包存在性、附加链接 HTTP 状态，均于 2026-11-11 实测。

### 2.1 链接验证结果（先说结论）

| # | CLI | GitHub 仓库 | 验证 | 附加链接 / 包名 | 验证 |
|---|---|---|---|---|---|
| 1 | CLI Anything | https://github.com/HKUDS/CLI-Anything | ✅ 200（★58,578） | `pip install cli-anything` | ❌ **PyPI 404**，见 2.2 更正 |
| 2 | Notebook LM CLI | https://github.com/teng-lin/notebooklm-py | ✅ 200（★20,196） | `notebooklm-py` on PyPI | ✅ 200 |
| 3 | Stripe CLI | https://github.com/stripe/stripe-cli | ✅ 200（★2,232） | `brew install stripe/stripe-cli/stripe` | ✅ 仓库存在 |
| 4 | FFmpeg | https://github.com/FFmpeg/FFmpeg | ✅ 200（★66,955） | https://ffmpeg.org/ | ✅ 200（首次超时，重试通过） |
| 5 | GitHub CLI | https://github.com/cli/cli | ✅ 200（★46,960） | — | **与 §一 重复** |
| 6 | Vercel CLI | https://github.com/vercel/vercel | ✅ 200（★16,565） | `vercel` on npm | ✅ 200 |
| 6b | Vercel Skills 合集 | https://github.com/vercel/ai-sdk-skills | ❌ **404**（该仓库不存在） | — | 见 2.2 更正 |
| 7 | Supabase CLI | https://github.com/supabase/cli | ✅ 200（★2,463） | https://github.com/supabase/scoop-bucket | ✅ 200 |
| 8 | Playwright CLI | https://github.com/microsoft/playwright-cli | ✅ 200（★15,118） | `playwright` on npm | ✅ 200 |
| 9 | LLMFit | https://github.com/AlexsJones/llmfit | ✅ 200（★38,906） | `llmfit` on PyPI | ⚠️ 未取得有效响应（见 2.2） |
| 10 | GWS (Google Workspace CLI) | https://github.com/googleworkspace/cli | ✅ 200（★32,249） | `@googleworkspace/cli` on npm | ✅ 200 |

> 你原文第 10 项链接被截断为 `https://github.com/googleworksp`，已按仓库名补全为 `googleworkspace/cli` 并验证通过。

### 2.2 需要核对/更正的点（诚实标注，未替你改掉原意）

| 项 | 原文写法 | 核实结果 | 建议 |
|---|---|---|---|
| CLI Anything 安装 | `pip install cli-anything` + `cli-anything init` | **PyPI 无 `cli-anything` 包（404）**；官方 README 的实际入口是 **CLI-Hub**：`pip install cli-anything-hub`，然后 `cli-hub install <name>`；`cli-anything init` 并非标准命令（仓库描述的是为开源项目生成 CLI 的 7-phase harness / Agent Skill） | 安装前以 https://github.com/HKUDS/CLI-Anything 的 Quick Start 为准 |
| Vercel Skills 合集 | https://github.com/vercel/ai-sdk-skills | **404**；`vercel/vercel-skills`、`vercel/skills` 亦 404 | 该链接失效，需作者给正确地址；Vercel 官方 Skills 入口建议从 https://github.com/vercel/vercel 仓库说明查 |
| LLMFit 包名 | `pip install llmfit` + `llmfit scan` | GitHub 仓库 ✅；PyPI 查询未返回有效结果 | 以仓库 README 为准，可能需从源码安装 |
| FFmpeg | `brew install ffmpeg` / `sudo apt install ffmpeg` | 通用写法，✅ 有效（ffmpeg.org 200） | 无需更正 |

### 2.3 十款 CLI 清单（去重后 9 新增 + 1 重复）

| # | CLI | 用途（一句话） | 安装命令（原文） | GitHub | 与 §一 重复? |
|---|---|---|---|---|---|
| 1 | **CLI Anything** | 元工具：指向任意开源项目，自动生成可让 Agent 从终端控制的 CLI（Blender / OBS / Inkscape 等无 CLI 的软件） | `pip install cli-anything` + `cli-anything init` ⚠️ 见 2.2 更正 | https://github.com/HKUDS/CLI-Anything | 否 |
| 2 | **Notebook LM CLI** | 把 YouTube 链接/资料交给 NotebookLM 分析（视频摘要、时间戳、播客、幻灯片、测验、闪卡），结果带回 Agent；算力在 Google 侧 | `pip install notebooklm-py` | https://github.com/teng-lin/notebooklm-py | 否 |
| 3 | **Stripe CLI** | 终端里创建产品/价格/订阅、管理支付，免后台点选 | `brew install stripe/stripe-cli/stripe`（Windows `scoop install stripe`） | https://github.com/stripe/stripe-cli | 否 |
| 4 | **FFmpeg** | 视频/音频/字幕处理瑞士军刀：压缩、切帧、提取音频、加字幕、转格式 | `brew install ffmpeg` / `sudo apt install ffmpeg` | https://github.com/FFmpeg/FFmpeg | 否 |
| 5 | **GitHub CLI** | 提交/推送/分支/PR 全在终端完成 | `brew install gh` / `scoop install gh` | https://github.com/cli/cli | ✅ **重复**（§一 #8） |
| 6 | **Vercel CLI** | 终端控制部署流程，与 GitHub CI/CD 集成；官方另有给 Agent 用的 Skills（链接待核） | `npm i -g vercel` | https://github.com/vercel/vercel | 否 |
| 7 | **Supabase CLI** | 开源 Firebase 替代，数据库 + 认证一体化；支持完全本地运行 | `brew install supabase/tap/supabase`（Windows scoop 见原文） | https://github.com/supabase/cli | 否 |
| 8 | **Playwright CLI** | 让 Agent 启动自己的 Chrome 实例完成抓取/填表/截图/录屏；官方对比称 CLI 比 MCP 更快、省 ~9 万 token | `npm i -g playwright` + `playwright install` | https://github.com/microsoft/playwright-cli | 否 |
| 9 | **LLMFit** | 扫描本机硬件，从 Ollama 海量模型中推荐最适合的本地模型，省去逐个下载试错 | `pip install llmfit` + `llmfit scan` ⚠️ 见 2.2 | https://github.com/AlexsJones/llmfit | 否 |
| 10 | **GWS (Google Workspace CLI)** | 终端接管整个 Google Workspace（邮件/文档/表格/日历），带沙盒过滤器与防提示词注入 | `npm install -g @googleworkspace/cli` + `gws auth login` | https://github.com/googleworkspace/cli | 否 |

> 安全提示：**GWS** 授权范围极大（全部邮件），原文建议用沙盒/过滤器限制可访问目录，并先克隆仓库让 Agent 分析「该装哪些 Skill」再决定。**任何安装/授权都需人工确认，本文档不代执行。**

---

## 三、快速索引（按用途）

| 场景 | 用哪个 |
|---|---|
| 内网穿透 / 静态托管 / 一键部署 | 花生壳 `@aweray/hsk-cli`；Vercel CLI |
| 火山引擎（模型/Endpoint/Skills） | `npx -y @volcengine/skills-setup@latest` |
| 阿里云资源管理 / 云效 | `aliyun` CLI / `aliyun-cli-devops` 插件 |
| API 文档 / 自动化测试 | `apifox-cli`；Playwright CLI |
| 飞书（OpenClaw/Hermes 集成） | `@larksuite/cli` |
| 一堂 YAI / WhyAI 服务 | `whyai` |
| GitHub / PR / Issue | `gh`（§一 #8 与 §二 #5 同一工具） |
| 视频/音频/字幕处理 | FFmpeg；Notebook LM CLI（视频内容分析） |
| 支付/订阅 | Stripe CLI |
| 后端 / 数据库 / 本地 Supabase | Supabase CLI |
| 本地模型选型 | LLMFit |
| Google Workspace 全家桶 | GWS `@googleworkspace/cli` |
| 元工具（给软件造 CLI） | CLI Anything（安装方式需按官方更正） |

---

## 四、维护记录

| 日期 | 变更 |
|---|---|
| 2026-11-11 | 初版：录入 8 个 CLI；知乎文章因 403 留去重占位；核对花生壳、Apifox、飞书、YAI 官方页命令要点 |
| 2026-11-11（本次） | **删除第二章 403 占位**；改为「补充的十款流行 CLI」：10/10 GitHub 仓库验证通过、包名/附加链接核实；发现 3 处需更正（cli-anything 包 404、vercel/ai-sdk-skills 404、llmfit 待核）；与 §一 去重（GitHub CLI 重复 1 项）；同步更新 §一 #8 备注与 §三 快速索引 |
