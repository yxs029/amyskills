# 踩坑记录 — 来自 2026-11-03 首次真实发布

本次把 260MB / 1400+ 文件的技能库发布到 GitHub 时实际遇到的全部问题与解法，脚本已内置这些处理，此处记录原理备查。

## 1. 直连 GitHub 被重置 → 必须走本机代理
- 现象：`git push` 报 `Recv failure: Connection was reset`；不带代理的 `ls-remote` 挂 210 秒超时。
- 根因：网络环境直连 github.com:443 不稳定；系统在注册表配了代理（`HKCU:\...\Internet Settings` 的 `ProxyEnable=1`、`ProxyServer=127.0.0.1:7892`），但 **git 不读 IE/WinINET 代理设置**。
- 解法：推送时加 `-c http.proxy=http://127.0.0.1:7892 -c https.proxy=http://127.0.0.1:7892`。脚本 auto 模式自动读注册表 → 测端口（900ms 超时）→ 存活则代理优先推送，失败再回退直连。
- 持久化：`git config --global http.proxy http://127.0.0.1:7892`。

## 2. GitHub 单文件 100MB 硬限制
- 现象：`pptx-swarm/scripts/pptd_dsl.pyz` 249.6MB。一旦 commit 进历史，之后**每次 push 都会失败**，即使后续删除文件也无效（历史里还在），只能重写历史。
- 解法：必须在复制/提交**之前**过滤。脚本用 robocopy `/MAX:104857600` 在复制阶段直接排除 >100MB 文件。
- 50–100MB 的文件能推但 GitHub 会警告（建议走 Git LFS），脚本单独列出提醒。

## 3. robocopy 退出码语义
- 0=无变化、1=有复制、2=有多余文件、4=不匹配——**0–7 都是成功**；≥8 才是失败。
- 若按常规「非零即失败」判断，成功复制会被误判为错误。

## 4. PowerShell 5.1 与 git stderr 的坑
- 现象：`git push 2>&1` 在 `$ErrorActionPreference='Stop'` 下，git 往 stderr 写进度（push 的进度都走 stderr）会抛 `NativeCommandError`，且输出一堆红色"错误"但实际推送成功。
- 解法：封装 `Invoke-Git`，函数内临时 `$ErrorActionPreference='Continue'`，把 2>&1 结果全部字符串化，**只看 `$LASTEXITCODE`** 判成败；最终以 `ls-remote` SHA 比对为准。

## 5. git 身份未配置导致首次 commit 失败
- 现象：`fatal: unable to auto-detect email address`。
- 解法：仓库级配置（不动全局）：`git config --local user.name/email`。邮箱用 GitHub noreply 格式 `用户名@users.noreply.github.com` 避免泄露真实邮箱。

## 6. 嵌套 .git 的 submodule 陷阱
- 现象：源目录里某个收藏技能自带 `.git`（如 skill3-humanizer）。整目录复制后，外层 git 会把它当 submodule 引用，**内容不会被上传**，远端只剩一个空目录指针。
- 解法：复制时排除一切名为 `.git` 的目录（robocopy `/XD .git`），并对暂存区残留的嵌套 .git 做清理。

## 7. CRLF 刷屏无害
- `warning: LF will be replaced by CRLF` 是换行符提示，不影响内容。脚本设 `core.safecrlf false` 静音；无需过度处理。

## 8. SKILL.md frontmatter 的多行描述
- 大量技能的 description 用 YAML 块标量（`>`、`|`、`>-`），单行正则提取会拿到空值。
- 解法：见脚本 `Get-SkillMeta` —— 命中块标量标记后继续吞并缩进行，直到出现非缩进行（frontmatter 结束或下一个键）。

## 9. 增量同步的关键：暂存目录要持久
- 首次推送 236MB 需要几分钟；若每次都新建暂存目录会全量重推。
- 解法：固定 `-StageDir`（脚本默认 `~\amyskills-stage`），robocopy 增量复制 + git 只提交差异，后续同步秒级完成。

## 10. 认证
- 有 GUI 的机器：Git Credential Manager 首次推送会弹浏览器登录 GitHub。
- 无 GUI / CI：用 PAT 嵌入 remote URL 或 `git credential` 存储；PAT 权限给 repo 范围即可。

## 11. 密钥安全
- 技能内 key 多为占位符（`你的key`）可直接传；但**调研笔记类 md 常含真实 Key**（本次 Skill资源 里有 Brave/Apify 真实 Key，因此该目录未上传）。
- 推送前按 SKILL.md Step 2 的命令扫描；发现真实 Key 一律先报告用户再决定。

## 12. 封装 git 函数必须显式指定工作目录（本次最隐蔽的坑）
- 现象：脚本内 `git add -A` 报 `fatal: not a git repository` 但被 `| Out-Null` 吞掉；下游 `git status --porcelain` 的**错误文本本身**让"有变更"判断为真，接着 commit 在错误目录失败，而错误信息恰好为空 → 三连静默失败，只有最终 exit code 暴露问题。
- 根因：`Invoke-Git` 定义了 `$WorkingDir` 参数却没使用，所有 git 都跑在调用方的 CWD（不在仓库内）。
- 解法：函数内统一 `git -C $WorkingDir ...`；禁止依赖调用方 CWD；且不要吞掉 add 的退出码。调试技巧：封装层把 stdout/stderr **分开**落临时文件再读，报错时两个流都打出来。
