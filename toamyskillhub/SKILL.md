---
name: toamyskillhub
description: 技能库发布/同步到 GitHub 技能仓库（默认 https://github.com/yxs029/amyskills）。自动完成：生成 README 技能清单（从各 SKILL.md frontmatter 提取名称与描述）、暂存复制（排除 >100MB 超限文件、__pycache__、嵌套 .git、node_modules）、git 初始化与提交、直连失败时自动探测系统代理并重试推送、推送后 SHA 比对校验。当用户要求「上传技能」「发布技能库」「同步到 amyskills」「更新技能仓库」「push skills」「publish skills」或首次把技能收藏发布为仓库时使用。Use when the user wants to publish or sync a local Agent Skills library to the amyskills GitHub repo.
---

# toamyskillhub — 技能库一键发布到 GitHub

把本地技能库（一批含 `SKILL.md` 的技能目录 + zip 安装包）发布/增量同步到 GitHub 技能仓库。本技能由一次真实发布过程蒸馏而来，已内置该次踩过的全部坑（网络重置、100MB 限制、代理探测、身份配置等）。

## 何时使用

- 用户要求把本地技能/技能库上传、发布、同步到 GitHub（默认 `amyskills` 仓库）
- 技能库内容更新后需要推送新版本

**不适用**：单纯 git push 已有仓库（直接 git 即可）；发布非技能类内容。

## 快速开始（一条命令）

```powershell
powershell -ExecutionPolicy Bypass -File <技能目录>\scripts\push_to_amyskills.ps1 -SourceDir "<技能库根目录>"
```

脚本会自动完成：校验源目录 → 暂存复制（排除超大文件/垃圾目录）→ 缺 README 时自动生成技能清单 → git 初始化/提交 → 推送（直连失败自动切系统代理）→ 远端 SHA 校验 → 输出总结报告。

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
| `-DryRun` | 关 | 只预演：列出技能数、大文件、代理探测结果，不改动任何东西 |

## Agent 工作流程

### Step 1 确认输入
- 向用户确认（或从上下文推断）：技能库源目录、目标仓库（默认 amyskills）。
- 目标仓库不存在时，提醒用户先在 GitHub 上创建空仓库（不要勾选自动生成 README，避免推送冲突），或用 `gh repo create yxs029/amyskills --private` 创建。

### Step 2 上传前安全检查（强烈建议）
扫描源目录是否含真实 API Key（本次经验：全部命中均为占位符则安全）：

```powershell
Get-ChildItem "<SourceDir>" -Recurse -File -Include *.md,*.json,*.py,*.js,*.txt |
  Select-String -Pattern "gk_live_[A-Za-z0-9]{8,}","ark-[A-Za-z0-9]{16,}","sk-[A-Za-z0-9]{20,}" |
  Where-Object { $_.Line -notmatch "你的|xxx|placeholder|<" } |
  Select-Object Path, LineNumber, Line
```

**发现真实 Key 必须先报告用户**：脱敏、排除该文件，或确认仓库为私有后再继续。

### Step 3 生成 README 技能清单
- 脚本在暂存目录缺少 `README.md` 时会自动生成骨架（分类总览表 + 每技能一行：名称/简介/路径）。
- 若要更高质量清单，Agent 可在推送前用下面的提取命令拿全量元数据，手工撰写润色版 README（含分类导航、安装说明、致谢）：

```powershell
Get-ChildItem "<SourceDir>" -Recurse -Filter SKILL.md | ForEach-Object {
  $lines = Get-Content $_.FullName -TotalCount 40 -Encoding UTF8
  # 提取 frontmatter 的 name 与 description（支持 > | 多行块）
  # 完整逻辑已内置于 scripts/push_to_amyskills.ps1 的 Get-SkillMeta 函数
}
```

### Step 4 执行发布
```powershell
& "<技能目录>\scripts\push_to_amyskills.ps1" -SourceDir "<SourceDir>" [-StageDir <路径>] [-DryRun]
```

### Step 5 验证与汇报
脚本末尾会自动 `git ls-remote` 比对远端/本地 SHA。向用户汇报：
- 仓库地址 + 分支 + 最新 commit SHA
- 本次新增/变更的技能
- 大文件警告（50–100MB 能推但有警告；>100MB 已被自动排除，README 需注明）
- 若失败：按「排障」小节给出原因与下一步

## 退出码

| 退出码 | 含义 |
| --- | --- |
| 0 | 成功：已推送且远端 SHA 校验一致 |
| 1 | 推送失败（直连与代理均失败 / 认证失败） |
| 2 | 参数或环境错误（源目录不存在、暂存目录与目标仓库不匹配等） |

## 排障速查

| 现象 | 原因与处理 |
| --- | --- |
| `Connection was reset` / `Could not connect` | 直连 GitHub 被网络重置。脚本 auto 模式会读注册表系统代理并重试；也可显式 `-Proxy http://127.0.0.1:7892`，或 `git config --global http.proxy http://127.0.0.1:7892` 持久化 |
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
