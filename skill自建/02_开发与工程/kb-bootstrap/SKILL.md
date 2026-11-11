---
name: kb-bootstrap
version: 1.0.0
description: >-
  一键打通 Aaron(袁雪松) 五个知识库/云盘的引导式 skill，供任何 Hermes/Agent 在新机器或新环境复用，
  免人工复制粘贴流程。五库：①Get笔记(openapi.biji.com HTTP API)、②IMA腾讯(ima.qq.com HTTP API)、
  ③中国移动云盘(原和彩云/139云盘，官方python脚本+session授权)、④一堂WHYAI(whyai CLI SSO)、
  ⑤飞书(lark-cli 两步 PTY 授权)。能力：五库连通性一体体检(只读零泄密)、逐库接入引导(含每库授权命令与踩坑)、
  打通后总验收、来源识别路由(防 IMA↔Get笔记混淆)、续期/故障自愈指引。
  触发词：打通知识库、配置五个库、知识库接入、新机器初始化知识库、IMA/云盘/飞书授权、五库体检、知识库又混了、
  把知识库接到另一个 agent、kb bootstrap。日常存取路由请配合 kb-router skill。
author: 测测(CeCe) for 袁雪松
license: MIT
metadata:
  hermes:
    tags: [knowledge-base, onboarding, getnote, ima, cloud-disk, whyai, feishu, bootstrap, aaron]
    related_skills: [kb-router, getnote, ima-skill, cm-cloud-manage, lark-shared]
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# kb-bootstrap —— Aaron 五库打通引导器

> 目标：让任何 Agent 在新环境**照脚本走一遍**就把 5 个库全部打通并稳定调用，**不需要人每次复制粘贴凭证和步骤**。
> 日常"存哪/读哪"的防混淆路由见姊妹 skill **`kb-router`**；本 skill 只负责"从 0 打通 + 验收 + 续期"。

## 0. 铁律

1. **密钥零落地对话/文档**：凭证只写进凭证文件（600/700 权限）或 keychain；脚本只读、只打印状态，`绝不 echo 密钥`。
2. **需要人点链接的授权只有 3 处**：移动云盘 loginUrl、飞书 config init、飞书 auth login。脚本负责生成链接，Agent 负责把链接发给用户，不代点。
3. **读/搜可自主；写/删/上传/移动先确认目标库**；任何写操作后必须回读校验。
4. **"笔记/知识库"五库通用，不能凭词猜库**，用第 5 节识别表。
5. 各库 ID/token/目录互不串用；Get笔记 int64 ID 当字符串。

## 1. 三步打通（Agent 主流程）

### Step 1 —— 一体体检（只读，开工必跑）
```bash
bash scripts/kb-healthcheck.sh
```
输出每个库 `[OK] 可用` / `[LOCK] 需授权` / `[!!] 需修复`。全 `[OK]` 直接跳到 Step 3。

### Step 2 —— 按 [LOCK]/[!!] 逐库接入
对照 `references/onboarding-playbook.md` 里该库小节执行（含精确命令、授权链接取法、踩坑）。要点：

- **① Get笔记**：凭证已在 `~/.openclaw/openclaw.json` 通常开箱即用；缺文件则让用户提供 apiKey+clientId 安全落盘。
- **② IMA**：用户从 https://ima.qq.com/agent-interface 取 client(32)/key(76) → 写 `~/.config/ima/` → **curl 直连**验证（apiPath 必须带 `v1`）。
- **③ 移动云盘**：`python3 <cm脚本> login` 取 `loginUrl` 发用户 → 用户点 → **再跑一次 login 换票** → `list /` 验证。
- **④ 一堂 whyai**：`whyai status --json`；未登录 `whyai login` 走浏览器 SSO。
- **⑤ 飞书（两步都必须 PTY 后台）**：
  - `terminal(background=true, pty=true, command="lark-cli config init --new --lang zh")` → wait 取 `user_code` 链接发用户；
  - 再 `... auth login --domain docs,drive,wiki`（同样 pty）→ wait 取 OAuth 链接发用户；
  - 查个人资源用 `--as user`。

### Step 3 —— 总验收
再跑一次 `scripts/kb-healthcheck.sh`，要求 5 行全 `[OK]`；并对每库做一次只读回读（见 playbook 验收清单）。
全绿后用 `scripts/post-bootstrap-check.sh` 做交付门禁（权限、密钥泄漏扫描、回读证据）。

## 2. 一键探路（可选）

```bash
bash scripts/detect-env.sh     # 只探测：命令是否安装、凭证文件是否存在、给出待办清单，不做任何修改
```
适合先告诉用户"这台机器还缺哪几步"，再决定是否授权。

## 3. 续期 / 故障自愈

| 体检/调用现象 | 自愈动作（详见 playbook 第 6 节） |
|---|---|
| IMA 401 `skill auth failed` | 重取凭证落盘，curl 验证；有效期 1 年 |
| IMA 脚本静默空返回 | 弃用 ima_api.cjs，改 curl；确认带 `v1` |
| 云盘 `need_auth` | login→发新链接→用户点→再 login 换票 |
| whyai 掉登录 | `whyai login` |
| 飞书 `10217 app deleted` | config init --new(pty) 重建 + auth login(pty) |
| 飞书个人资源 99991672 | 补 user 授权并 `--as user` |
| 飞书交互命令无输出 | 必须 background + pty=true |

## 4. 打通后交给谁

打通只做"连通 + 凭证 + 验收"。**后续读写路由统一加载 `kb-router`**：
- 开工先体检 → 识别表判库 → 加载该库具体 skill 拿参数 → 读自主/写确认 → 回读校验。

## 5. 30 秒来源识别表（防混淆）

| 特征词 / 形态 | 库 |
|---|---|
| 剪藏、存链接、网页正文/AI摘要、OCR、录音转写、biji、"我存过的"语义搜 | ① Get笔记 |
| IMA、ima.qq.com、微信生态笔记/资料库 | ② IMA |
| 和彩云/139云盘、照片备份、上传下载文件、PDF/照片/压缩包本体 | ③ 移动云盘 |
| 一堂、whyai、行动营、课程笔记、方法论(清单体/双三角/调研课) | ④ 一堂 |
| 飞书文档/表格/多维表、云空间、wiki、日程、协作文档 | ⑤ 飞书 |

只说"我存的那个笔记"无限定词 → **先问是哪个库，不替用户选**。

## 6. 文件

- `scripts/kb-healthcheck.sh` —— 五库只读一体体检（零泄密），开工/续期后跑
- `scripts/detect-env.sh` —— 环境与凭证探测，产出待办，不修改任何东西
- `scripts/post-bootstrap-check.sh` —— 打通交付门禁：权限/密钥泄漏/每库回读
- `references/onboarding-playbook.md` —— 逐库接入全流程（命令+PTY 取链+踩坑+验收+续期）
