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

# 踩坑记录 II — 2026-11-03 第二次迭代（计划/确认/执行三段式）

## 13. `-LiteralPath` + `-Include` 组合会静默失效 → 扫描变慢 38 倍
- 现象：密钥扫描 `Get-ChildItem -LiteralPath X -Recurse -File -Include *.md,...` 实测 91.6 秒——`-Include` 配 `-LiteralPath` **根本不过滤**，连 84MB 的二进制 zip 都被 `Select-String` 当文本逐行正则了。
- 解法：先 `Get-ChildItem -Recurse -File | Where-Object { $_.Extension -in ".md",".json",... }` 再 `Select-String`，同样范围只要 2.4 秒。
- 规则：**`-Include` 只配合 `-Path`（带通配）或 `-Recurse` + `-Path` 可靠；`-LiteralPath` 下改用 `Where-Object` 过滤。**

## 14. 方法调用参数列表里 `-f` 只绑定第一个表达式
- 现象：`$sb.AppendLine("| {0} | {1} |" -f $a, $b)` 报 FormatError「索引必须大于或等于零且小于参数列表的大小」，且**表格行悄悄丢失**（清单里只见表头不见数据）。
- 根因：在 `.Method(...)` 的参数列表里，逗号是**参数分隔符**，`-f` 运算符只吃掉紧随其后的第一个表达式 → `AppendLine( ("fmt" -f $a), $b, ... )`，占位符 2 个、格式参数只有 1 个。
- 解法：把整个 `-f` 表达式包进括号：`AppendLine( ("| {0} | {1} |" -f $a, $b) )`。赋值/管道上下文里没问题，**唯独方法调用参数列表会踩**。

## 15. 同一脚本内的哈希循环比独立运行慢 50 倍（未解之谜，已绕开）
- 现象：同一段「枚举 1423 文件 → 逐文件 git blob SHA1」的循环，独立在 shell 里跑 22.8 秒完成；放进 .ps1 脚本执行却每文件 ~0.8 秒，两次实测分别卡死在 400+/1423、500+/1423（停滞点漂移），600 秒都跑不完。逐文件计时定位无果。
- 处置：不硬磕。默认对比改为「修改时间+大小 vs 暂存树」（robocopy 保留 mtime，等价且秒级完成）；逐文件哈希与远端精确对比降级为可选 `-DeepCompare`。哈希函数（`Get-BlobHash`）保留在脚本中备用。
- 教训：**性能诡异物化时，先找等价而更便宜的算法，而不是死磕根因**——mtime+size 恰好也更贴合「根据技能更新时间决定是否更新」的需求。

## 16. 三段式设计的动机（防呆边界）
- Agent 的「自动上传」对用户是不可逆动作（远端历史、其他设备会同步）。因此：
  - 未确认的调用以 **exit 3** 结束（区别于错误码 0/1/2），Agent 见到 3 就该去问用户；
  - `-Confirmed` 是脚本里唯一能触达远端写操作的开关；
  - 清单里同名技能异径、密钥命中、超大文件全部前置暴露，确认时一次看清。
- 另一 Agent 会并行推送同一仓库（如 `autoclaw常用技能/` 目录），源目录没有这些文件 → 清单会列在「源中已不存在但仓库仍有的路径」，**默认保留**是正确行为，别轻易 `-Mirror`。
