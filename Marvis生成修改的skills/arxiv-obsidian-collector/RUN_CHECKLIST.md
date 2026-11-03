# arXiv Pipeline 运行前检查清单

> **每次 arxiv cron 触发时,先完整读一遍这个文件,按清单逐项执行。**
> 跑成功的条目删掉,新发现的问题加进来。往复循环,错误越来越少。

> **📂 Vault 路径(2026-09-08 起变更)**:`F:\软件测试\30AI技术知识树\arxivForAI`
> 旧路径 `F:\移动云盘同步盘\30AI技术知识树\arxivForAI` 已废弃,config.yaml / config-ollama.yaml / 两个 fixup 脚本均已改。历史日志(logs/)里的旧路径是历史记录,不用改。

---

## ⚠️ 最重要的规则:所有 pre-flight 步骤必须在同一条 bash 命令里

**bash tool 每次调用是独立 shell,`$env:` 变量不跨调用保留。**
2026-08-24 的 401 事故就是因为步骤 1(设 key)和步骤 3(跑 pipeline)分成了独立 bash 调用,
步骤 3 的新 shell 里 key 是空的,python 继承了 daemon 快照的占位符 → 182 次 401。

**正确做法:把设 key + probe arXiv + 跑 pipeline 写在一个 PowerShell 脚本块里,一次 bash 调用完成。**

---

## 运行前必做(Pre-flight)— 复制下面整段,一次执行

```powershell
# ===== 0. 切到 skill 目录 =====
Set-Location C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector
New-Item -ItemType Directory -Force -Path logs | Out-Null

# ===== 1. 加载并验证 API Key(必须和 pipeline 在同一个 shell!) =====
$env:MINIMAX_M3_API_KEY = [System.Environment]::GetEnvironmentVariable("MINIMAX_M3_API_KEY", "User")
if ($env:MINIMAX_M3_API_KEY.Length -lt 50) {
    Write-Error "API Key 异常(长度 $($env:MINIMAX_M3_API_KEY.Length)),应为 125 字符。检查 User-env 或呼用户。"
    exit 1
}
Write-Output "✅ API Key OK, length: $($env:MINIMAX_M3_API_KEY.Length)"

# ===== 2. Probe arXiv 是否可用 =====
$probe = python -c "import requests; r=requests.get('https://export.arxiv.org/api/query',params={'search_query':'all:cat','max_results':2},timeout=20,verify=r'C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem'); print(r.status_code)"
Write-Output "🔍 arXiv probe: $probe"
if ($probe -ne "200") {
    Write-Output ("⚠️ arXiv 首次 probe 非 200($probe),快速再 probe 3 次确认(间隔 15s)...")
    $stillDown = $true
    for ($j=1; $j -le 3; $j++) {
        Start-Sleep -Seconds 15
        $probe2 = python -c "import requests; r=requests.get('https://export.arxiv.org/api/query',params={'search_query':'all:cat','max_results':2},timeout=20,verify=r'C:\Users\AaronMY\AppData\Roaming\MiniMax\system-ca-certs.pem'); print(r.status_code)"
        Write-Output ("  re-probe $j: $probe2")
        if ($probe2 -eq "200") { $stillDown = $false; break }
    }
    if ($stillDown) {
        Write-Output "❌ arXiv 持续不可用($probe),按用户'失败 3 次停'规则,本轮放弃 + 设 cron-once 1.5h 后重试"
        exit 1
    }
}
Write-Output "✅ arXiv OK"

# ===== 2.5 Probe LLM Token Plan 余额(问题 9 改进,2026-09-11 L5 验证) =====
# 避免 9-2/9-9 那种跑了几十篇才撞 429 污染 vault 的情况
# probe_tokenplan.py 从 config.yaml 读 api_base/model,自动适配 5 层
$probe_rc = python -u scripts\probe_tokenplan.py --config config.yaml
$probe_exit = $LASTEXITCODE
if ($probe_exit -eq 1) {
    Write-Output "❌ LLM token plan 已耗尽(429),按'失败 3 次停'规则 + 问题 9 经验,本轮放弃"
    exit 2
}
if ($probe_exit -ne 0) {
    Write-Output "❌ LLM probe 异常(exit=$probe_exit,可能网络/SDK/auth 问题),先停手排查"
    exit 3
}

# ===== 3. 跑 pipeline(-u unbuffered 确保日志实时落盘) =====
$layer = "L1"  # ← cron 触发时改成对应层:L1/L2/L3/L4/L5
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
python -u scripts\pipeline.py --layer $layer --config config.yaml 2>&1 | Tee-Object -FilePath "logs\${layer}_$ts.log"
```

**四重保险**:
1. 上面的脚本在同一个 shell 里设 key + 跑 pipeline(env 不丢)
2. `pipeline.py` 顶层有 ctypes `GetEnvironmentVariableW` 兜底(即使 shell env 丢了,python 进程内也会现读 Windows User-env)
3. pre-flight probe arXiv 避免在 arXiv 限流时硬跑烧 token
4. pre-flight probe_tokenplan.py 避免在 token plan 耗尽时硬跑污染 vault(2026-09-11 L5 验证)

---

## 已知问题与改进状态

### 问题 1: arXiv 429 限流(早高峰 9-10 点,偶发 14:00+)
- **首次发现**: 2026-08-21(早 9 点持续 429)
- **改进方案**: 5 层 cron 从 09:00 改到 14:00(Asia/Shanghai)
- **新发现**: 2026-08-27 14:00 L4 触发也撞 429(2 次 probe 30s timeout + 1 次 429) — 14:00 不再绝对安全
- **进一步改进**: 取消阻塞式 30 分钟 sleep(浪费 token),改为快速 3 次 probe(间隔 15s),3 次都非 200 则立即放弃 + 设 cron-once 1.5h 后重试
- **验证状态**: 8-24 L1 / 8-25 L2 / 8-26 L3 14:00 跑过无 429,但 8-27 L4 14:00 失败 → 14:00 仍可能撞 429(可能 arXiv 全天限流策略变了)。cron-once 重试机制兜底

### 问题 2: API Key 跨 bash 调用丢失(2026-08-24 根因确认)
- **现象**: pre-flight 步骤 1 设了真 key(125 字符),步骤 3 跑 pipeline 时 91 篇全 401
- **根因**: **bash tool 每次调用是独立 shell,`$env:` 不跨调用保留**。步骤 1 和步骤 3 分成独立 bash 调用后,步骤 3 的 shell 里 key 是空的,python 继承 daemon 快照的占位符
- **改进方案**:
  1. ✅ checklist 改为单条 bash 命令(设 key + probe + 跑 pipeline 在同一个 shell)
  2. ✅ `pipeline.py` 顶层加 ctypes `GetEnvironmentVariableW` 兜底(代码层根治)
  3. ✅ 5 个 arxiv cron prompt 已更新为单条命令模式
- **验证状态**: ✅ 8-25 L2(8/25 周二 14:00)首次验证通过,87 篇 0 个 401,API key 125 字符,arXiv probe 200,fixup 0 篇(只 1 篇 LLM JSON 解析失败但已 fixup 修好,4.5/below_average)。问题 2 闭环

### 问题 3: 日志丢失(print 缓冲 + 30min 硬杀)
- **改进方案**: 用 `python -u` unbuffered 运行 + Tee-Object 落盘
- **验证状态**: 8-24 L1 日志完整(1091 行,158KB),已闭环

### 问题 4: 429 retry 策略不够激进
- **改进方案**: Pre-flight probe arXiv,不在已知 429 时硬跑
- **验证状态**: 8-24 下午跑只遇到 2 次限流重试后成功,基本闭环

### 问题 5: daemon env 快照(代码层已兜底)
- **现象**: mavis daemon 启动时快照 env,后续 User-env 更新不同步到子进程
- **改进方案**: `pipeline.py` 顶层 ctypes `GetEnvironmentVariableW` 现读 Windows User-env(注册表级别),覆盖 daemon 快照
- **验证状态**: 代码已合入,待下次 cron 验证
- **长期修复(需用户操作)**: 重启 MiniMax Code 桌面端刷新 daemon 快照

### 问题 6: LLM 全部 401 后落盘降级 .md(已修复)
- **现象**: 401 时 pipeline 不退出,落盘 quality_score=5.0 + unknown 的降级 .md
- **恢复方案**: `scripts/fixup_l1_20260824.py` 重跑 score + summary(8/24 已修复 91 篇,0 失败)
- **预防**: 问题 2 修复后不应再出现;如果再出现,fixup 脚本支持 resume(已修复的 .md 自动跳过)
- **验证状态**: 8/24 fixup 完成,91 篇全部有真评分和中文摘要,vault 0 含 401 错误

---

## 运行后检查(Post-flight)

跑完后检查:
1. vault 对应层目录下有没有新 `.md` 文件(mtime > 今天)
2. 抽查 2-3 篇 .md 的 frontmatter:quality_score 不应该是 5.0 + unknown,quality_reasons 不应该含 "401"
3. 如果有新文件 → 统计 N categories / M papers / K filtered,汇报
4. 如果没新文件 → 看日志判断是 429 全空还是其他错误,记到本清单
5. 如果发现新问题 → 加到"已知问题"区,下次运行前验证改进方案

---

## 人工介入记录

- [ ] **重启 MiniMax Code 桌面端**: 刷新 daemon env 快照。用户方便时重启即可,不急。ctypes 兜底已生效,不重启也不影响。

### 问题 7: PDF 下载代理 127.0.0.1:7892 不可用(2026-08-26 首次发现)
- **现象**: L3 pipeline 跑 81 篇,~50 篇 PDF 下载报 `ProxyError('Unable to connect to proxy', NewConnectionError("HTTPSConnection(host='127.0.0.1', port=7892): Failed to establish a new connection: [WinError 10061]"))`;但 arXiv API 搜索阶段(用同一个 verify CA bundle)正常,只有 arxiv.org 的 PDF 下载链接走代理失败
- **影响**: pipeline 退化成只用 abstract 评分,LLM 评分和中文摘要仍正常生成(24 篇入库 0 个 401);但缺 PDF 全文导致评分粒度略低(基于标题+摘要的评分,可能漏掉 experimental 细节)
- **猜测根因**: 代理客户端(Clash Verge / v2rayN)未启动、或端口变了;PDF 下载走代理而 arXiv API 搜索走直连(配置差异)
- **改进方案(待确认)**:
  1. 跑 pipeline 前先 probe 代理端口 `Test-NetConnection -ComputerName 127.0.0.1 -Port 7892`,失败时提醒用户启动代理
  2. 或在 pipeline.py 里 PDF 下载时 detect proxy 失败 → 自动 fallback 到无 proxy 重试
  3. 或长期:让 PDF 下载和 API 搜索走同一个网络通道(都是 export.arxiv.org / arxiv.org)
- **验证状态**: 本次 cron(8-26 14:00 L3)24 篇入库 0 失败 0 401,质量问题闭环;代理修复待用户介入启动代理客户端后再验证

### 问题 8: LLM Token Plan 429 配额耗尽(2026-09-02 L3)
- **现象**: L3 pipeline 跑 53/65 篇时,从第 45 篇开始所有 LLM 调用(评分 + 中文摘要生成)都返回 429: `已达到 Token Plan 用量上限:请升级 Token Plan 套餐或购买积分补充用量。`
- **影响**: 剩余 8 篇(paper 45-52)被记为 quality_score=5.0 + quality_category=unknown 的降级笔记,无中文摘要;pipeline 仍继续把降级笔记落盘,等于无意义入库
- **猜测根因**: Token Plan 配额(包年/包月)在 9-2 14:30 左右耗尽(m3 模型),可能是 L1+L2+L3 三层累计消耗,或 m3 调用单价较高
- **改进方案**:
  1. **短期**:在 pipeline 顶层加 token plan 余额 probe(LLM ping),429 连续 3 次立即退出并写降级 .md 列表到 `logs/degraded_*.json`,供 fixup 后续追跑
  2. **中期**:当 429 出现时,pipeline 不再继续写笔记(避免污染 vault),改为把所有未完成 papers 写到 `_pending_fixup.json` 留待 fixup
  3. **长期**:升级 Token Plan 或切换到按量付费的 API key,避免配额耗尽影响 cron
- **应对**: 9-2 L3 在 paper 53/65 时手动 task_stop 终止(遵守"失败 3 次停"规则,不烧 token 硬跑),已保存 36 篇(28 篇实评 + 8 篇 429 降级),后续 fixup 脚本可重跑
- **验证状态**: 待 fixup 脚本支持 token 余额不足时重试

### 问题 9: LLM Token Plan 429 月度配额 9-9 L3 一开始就撞(2026-09-09)
- **现象**: 9-9 14:06 L3 cron 触发,Pass 1 顺利(12 分类全搜过,仅"文档解析"分类 SSL EOF 失败但 pipeline 跳到下一分类),71 篇去重后进入 Pass 2,**第 1 篇论文就撞 429**,全部 5 篇入库论文(包含 TANGO/ReCite/Learning Length-Extrapolatable/SyncWorld/Vector Bundles)都是 quality_score=5.0 + quality_category=unknown + scoring failed: Token Plan 429
- **影响**: Pass 2 全部 LLM 调用(score + summary)都返回 429 "已达到 Token Plan 用量上限",说明 9 月配额在 9-9 已经耗尽(可能 8 月剩余没结转 + 9-1 重置后 L1/L2 已用完)
- **应对**: 在第 5 篇 .md 落盘时按"失败 3 次停"规则手动 Stop-Process pipeline,5 .md + 5 .pdf 移到 `_trash_20260909_failed_score/`,0 论文真正入库
- **根因确认**: 9-2 那次 L3 是跑到 paper 45 才撞 429(说明 L1+L2 已用部分,9-2 用完),9-9 是 L3 第一个 paper 就撞(说明 L1 9-7 + L2 9-8 累计用完了 9 月配额)
- **改进方案(同问题 8 + 新的)**:
  1. **立即**: 升级 Token Plan 或切换到按量付费 API key,9 月剩余 21 天内需要这个 cron 工作
  2. **代码层**: pipeline.py 加 token plan 余额 probe(LLM ping),429 连续 3 次立即退出(不要再硬跑)
  3. **新经验**: 5 层 cron 周一到周五分散跑 ≠ 分散 token 消耗,只要 LLM 调用都走同一个 token plan 配额,集中耗尽风险一样高
  4. **临时**: 9-10 起 L4(周三) / L5(周四)大概率也会撞 429;如果想跑,L4/L5 cron 之前先 probe token plan 余额,余额不足则跳过该层
- **验证状态**: ✅ 2026-09-11 L5 cron 跑通(token plan 已恢复,probe OK,36 篇入库 0 401 0 429,评分 5.0-8.5/avg 6.58,详见问题 10 闭环证据)
- **关键发现**: 9-11 token plan 配额可用 = 9-10 23:59 ~ 9-11 之间自然重置(可能周/月度配额滚动),不是月末 9-30。下次撞 429 的可能时机是 9-11 后跑更多 L1-L4 累计用完。

### 问题 11: arXiv 全面 429 + ReadTimeout 组合(2026-09-15 L2 首次发现,1.5h retry 仍失败)
- **现象 1(14:00 首次)**: 2026-09-15 14:00 L2 cron 触发,首次 probe 429,re-probe 1=429 / re-probe 2=429 / re-probe 3=ReadTimeout 20s(export.arxiv.org:443 SSL read 超时)。3+1 全失败,按"失败 3 次停"放弃本轮。
- **现象 2(16:03 1.5h retry)**: 首次 probe 直接 ReadTimeout(20s SSL read),后续 re-probe 阶段因 Tee-Object buffer 没新 stdout 输出(卡在 PowerShell stdout 缓存层,实际 python 进程在跑但 PS 没 flush)无法判断。手动 task_stop 止损。
- **与纯 429 的区别**: 纯 429 走快速 retry,几秒就拿到响应;ReadTimeout 触发的是 socket.read 超时,服务端可能挂了或网络中断,20s 后才返回。这条要等到本轮结束才报错,等 3 次总耗时 ~80s+。
- **应对**: 16:03 retry 失败后,按用户决定放弃今天,等下周二(2026-09-22)14:00 L2 自然窗口再跑。**不设新 cron-once**。
- **长期**: arXiv 9-15 限流窗口从 14:00 延续到 16:00+(1.5h backoff 不够),可能与全网 arXiv 流量或出口 IP 限流策略调整有关;若持续如此,需要在 cron 触发后做更长的 backoff(2h → 4h → 6h)+ 缩短 probe 超时到 10s 节省 token
- **Tee-Object buffer 坑**: PowerShell 的 Tee-Object 在 stdout 累积但未达 buffer 上限时不会 flush,导致 task_output 看不到实时进度。如果看到 re-probe 输出迟迟不刷,不要立即 stop — 等满 105s(3 cycle × 35s)还没新行才能 abort。改进方向:probe 阶段不用 Tee-Object,直接 `>> $log.txt` 追加,或者用 `Out-File -Encoding utf8 -Append`,或者纯 python 内部 sleep+print(走 python `-u` 自动 flush)

### 问题 10: Pre-flight Token Plan Probe 已实现并验证(2026-09-11 L5 闭环)
- **触发**: 9-9 L3 一开始就撞 429 后,改进方案要求"pipeline 顶层加 token plan 余额 probe",但没落地。
- **改进**: 9-11 L5 cron 触发时,新建 `scripts/probe_tokenplan.py`,从 config.yaml 读 api_base/model/key,做一次最小 LLM ping,返回码区分 0=OK / 1=429 用尽 / 2=其他错误。
- **集成**: checklist pre-flight 脚本在 arXiv probe 之后、跑 pipeline 之前调 probe_tokenplan,429 时直接 exit 2(按"失败 3 次停"规则停手),不再硬跑污染 vault。
- **验证状态**: ✅ 2026-09-11 14:00 L5 cron:probe_tokenplan.py 输出 `LLM_OK elapsed=1.11s reply='Pong!'`,token plan 余额可用;52 篇下载 36 篇入库 0 401 0 429,vault 干净。
- **长期**: 升级 Token Plan 或切按量付费 key 是根本解决(月度配额到 14:30 左右反复耗尽)。probe_tokenplan.py 给的是"探活 + 早停"止血,不能补充配额。

