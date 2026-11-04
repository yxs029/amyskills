---
name: toamyskillhub
description: 技能库发布/同步到 GitHub 技能仓库（默认 https://github.com/yxs029/amyskills）。安全默认三段式：PLAN 生成上传清单（新增/更新/无变化、仓库同名技能冲突检测、>100MB 超限排除、真实密钥扫描）→ 展示报告给用户确认（未确认以退出码 3 结束，不上传任何内容）→ -Confirmed 后执行 robocopy 暂存、git 提交、推送（直连失败自动切系统代理、远端分叉自动 rebase）、SHA 校验。当用户要求「上传技能」「发布技能库」「同步到 amyskills」「更新技能仓库」「push skills」「publish skills」「生成上传清单」或首次把技能收藏发布为仓库时使用。Use when the user wants to publish or sync a local Agent Skills library to the amyskills GitHub repo, with a manifest-driven confirm-before-upload flow.
---

# toamyskillhub — 技能库一键发布到 GitHub

把本地技能库（一批含 `SKILL.md` 的技能目录 + zip 安装包）发布/增量同步到 GitHub 技能仓库。**安全默认：先出上传清单、经用户确认，才会真正上传。** 本技能由一次真实发布过程蒸馏而来，已内置该次踩过的全部坑（网络重置、100MB 限制、代理探测、身份配置等）。

## 三段式流程（安全默认）

```
PLAN（清单） ──► CONFIRM（等用户说"确认"） ──► EXECUTE（上传）
   exit 0/3          不上传任何东西              exit 0/1/2
```

- **PLAN**：扫描源目录，按「修改时间+大小」与暂存树对比（或加 `-DeepCompare` 与远端 blob 哈希精确对比），生成 Markdown 上传清单（新增/更新/无变化、同名技能异径冲突、超限排除、大文件警告、密钥扫描），保存到 `%TEMP%\toamyskillhub-manifest-latest.md`。
- **CONFIRM**：不带 `-Confirmed` 运行时，清单照出但**绝不触碰远端**，以退出码 3 结束——Agent 必须把清单呈现给用户，得到明确"确认"后才能进入下一步。
- **EXECUTE**：`-Confirmed` 才会 robocopy 暂存 → git 提交 → 推送（代理回退 + 远端分叉自动 rebase）→ `ls-remote` SHA 校验。

## 何时使用

- 用户要求把本地技能/技能库上传、发布、同步到 GitHub（默认 `amyskills` 仓库）
- 技能库内容更新后需要推送新版本；或只想看看「会传什么」的上传清单

**不适用**：单纯 git push 已有仓库（直接 git 即可）；发布非技能类内容。

## 快速开始

```powershell
# 1) 生成上传清单（只读，不上传；exit 3 = 等待确认）
powershell -ExecutionPolicy Bypass -File <技能目录>\scripts\push_to_amyskills.ps1 -SourceDir "<技能库根目录>"

# 2) 用户确认后，真正执行上传
powershell -ExecutionPolicy Bypass -File <技能目录>\scripts\push_to_amyskills.ps1 -SourceDir "<技能库根目录>" -Confirmed
```

## 参数说明

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `-SourceDir` | 环境变量 `AMS_SOURCE_DIR`，否则 `F:\OPRASE-AMY\08AI操作系统\MySkills` | 技能库源目录（必填，其他机器务必显式传入） |
| `-TargetRepo` | `https://github.com/yxs029/amyskills.git` | 目标 GitHub 仓库 |
| `-StageDir` | 环境变量 `AMS_STAGE_DIR`，否则 `~\amyskills-stage` | 暂存仓库目录。**保持固定路径可实现增量推送**，首次 236MB，之后秒级 |
| `-Branch` | `main` | 推送分支 |
| `-Proxy` | `auto` | `auto`=自动探测系统代理（直连失败时启用）；`none`=强制直连；或显式 `http://127.0.0.1:7892` |
| `-IdentityName/-IdentityEmail` | `yxs029` / `yxs029@users.noreply.github.com` | 仓库级 git 身份（不影响全局配置） |
| `-CommitMessage` | `chore: sync skills from <目录> (时间)` | 提交信息 |
| `-ExcludeDirs` | `__pycache__ .git node_modules .venv venv` | 复制时排除的目录名 |
| `-GenerateReadme` | 关 | 强制重新生成 README 骨架。**已有手工润色版 README 时不要开启** |
| `-Mirror` | 关 | 暂存与源完全镜像（源里删掉的文件仓库里也删，慎用） |
| `-PlanOnly` | 关 | 只生成并保存清单就退出（exit 0），不进入"等待确认"状态 |
| `-Confirmed` | 关 | **唯一允许上传的开关**。用户明确确认后由 Agent 加上它重新运行 |
| `-ManifestPath` | `%TEMP%\toamyskillhub-manifest-latest.md` | 上传清单的保存路径 |
| `-DeepCompare` | 关 | 对每个文件计算 git blob 哈希并与远端树精确对比（默认按修改时间+大小与暂存树对比，秒级完成） |
| `-DryRun` | 关 | （旧）只预演配置与代理探测，不改动任何东西 |

## Agent 工作流程

### Step 1 确认输入
- 向用户确认（或从上下文推断）：技能库源目录、目标仓库（默认 amyskills）。
- 目标仓库不存在时，提醒用户先在 GitHub 上创建空仓库（不要勾选自动生成 README，避免推送冲突），或用 `gh repo create yxs029/amyskills --private` 创建。

### Step 2 生成上传清单（PLAN，只读）
```powershell
& "<技能目录>\scripts\push_to_amyskills.ps1" -SourceDir "<SourceDir>" [-StageDir <路径>]
```
脚本会输出并保存上传清单，内容包含：
- 动作表：每个技能/包单元标为 **新增 / 更新 / 无变化**（默认按修改时间+大小与暂存树对比；`-DeepCompare` 则逐文件算 blob 哈希与远端精确对比）
- **同名技能检测**：新增单元若与仓库其他路径下同名技能重名，会在备注列标 ⚠️
- 源中已删除但仓库仍有的路径（默认保留；`-Mirror` 才同步删除）
- 超大文件排除（>100MB）、大文件警告（50–100MB）
- **密钥扫描**：疑似真实 API Key 只列文件路径+行号（绝不显示内容），命中时必须停下询问用户

### Step 3 向用户展示报告，等待明确确认（铁律）
- 把清单的「需要关注的动作」表 + 汇总行 + 密钥扫描结果讲给用户。
- **未得到用户明确"确认"之前，绝不加 `-Confirmed` 运行**。脚本本身也会用退出码 3 拦住未确认执行。
- 用户可能要求调整（如改用 `-Mirror`、改提交信息、排除某目录）——调整后重跑 PLAN 再确认。

### Step 4 执行上传（EXECUTE）
```powershell
& "<技能目录>\scripts\push_to_amyskills.ps1" -SourceDir "<SourceDir>" -Confirmed [-CommitMessage "..."]
```
执行阶段：robocopy 暂存（排除超大文件/垃圾目录）→ git 提交 → 推送（直连失败自动切系统代理；远端分叉自动 rebase 重推，冲突则保护性中止）→ 远端 SHA 校验。

### Step 5 验证与汇报
脚本末尾会自动 `git ls-remote` 比对远端/本地 SHA。向用户汇报：
- 仓库地址 + 分支 + 最新 commit SHA
- 本次新增/变更的技能（与清单核对）
- 大文件警告（50–100MB 能推但有警告；>100MB 已被自动排除，README 需注明）
- 若失败：按「排障」小节给出原因与下一步

## 退出码

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功（PLAN 模式：清单已生成；EXECUTE 模式：已推送且远端 SHA 校验一致） |
| 1 | 推送失败（直连与代理均失败 / 认证失败 / SHA 校验不一致） |
| 2 | 参数或环境错误（源目录不存在、暂存目录与目标仓库不匹配等） |
| 3 | **等待用户确认**：清单已生成，未加 `-Confirmed`，没有上传任何内容 |

## 排障速查

| 现象 | 原因与处理 |
| --- | --- |
| `Connection was reset` / `Could not connect` | 直连 GitHub 被网络重置。脚本 auto 模式会读注册表系统代理并重试；也可显式 `-Proxy http://127.0.0.1:7892`，或 `git config --global http.proxy http://127.0.0.1:7892` 持久化 |
| `schannel: failed to receive handshake, SSL/TLS connection failed` | Windows 默认 schannel 后端经本地 HTTP 代理时握手失败，`ls-remote` / `fetch` / `push` 会一起挂（2026-11-04 实测）。脚本已在**所有 git 调用**统一注入 `-c http.sslBackend=openssl`；手工推送加同一参数：`git -c http.proxy=http://127.0.0.1:7892 -c https.proxy=http://127.0.0.1:7892 -c http.sslBackend=openssl push origin main` |
| `Authentication failed` / 弹不出浏览器 | 首次推送需要凭据：装了 Git Credential Manager 会弹浏览器登录；无 GUI 环境改用 PAT：`git remote set-url origin https://<用户名>:<PAT>@github.com/yxs029/amyskills.git` |
| `File ... exceeds GitHub's file size limit` | 有 >100MB 文件混入。脚本已用 robocopy `/MAX:104857600` 自动排除；若手工操作需同样过滤 |
| push 输出一堆红色 NativeCommandError 但显示成功 | PowerShell 5.1 把 git 的 stderr 进度当错误流显示，**以最终 `ls-remote` SHA 校验为准**，脚本已处理 |
| LF/CRLF warning 刷屏 | 换行符提示，无害。脚本已设 `core.safecrlf false` 静音 |
| 技能目录里嵌套 .git 变成 submodule 引用 | 复制时已排除一切 `.git` 目录，天然规避 |
| robocopy 报错但文件都复制了 | robocopy 退出码 0–7 都算成功（1=有复制），≥8 才是真失败，脚本已按此判断 |

详细踩坑记录见 [references/lessons-learned.md](./references/lessons-learned.md)；非 Windows / 无法执行脚本的 Agent 用 [references/manual-steps.md](./references/manual-steps.md) 的手工命令序列。

## 维护约定

- 暂存目录里人工润色过的 `README.md` 优先级最高，脚本只在缺失时生成骨架。
- 新增技能只需放进 SourceDir 对应分类目录（含 `SKILL.md`），重跑脚本即为增量同步。
- 本技能位于 SourceDir 内部，同步时会把自己也带进仓库（便于分发）；不希望如此时加 `-ExcludeDirs toamyskillhub`。
