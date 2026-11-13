---
name: hermes-longtask-commander
description: "Hermes 任务清单驱动的长任务执行指挥手册: todo 全生命周期方法论(何时建/怎么拆/状态流转铁律/熔断恢复) + 长任务配置基线表(max_turns/max_iterations/spawn_depth/timeout 查改回滚) + 启动前 preflight 检查脚本 + 执行 SOP。触发词: 任务清单/任务管理/长任务/长会话/复杂任务/todo/跑长任务/任务拆解/longtask/commander/长跑任务/多步任务"
version: 1.0.0
author: 测测 (CeCe) for 袁雪松
license: MIT
metadata:
  hermes:
    tags: [devops, hermes, long-task, todo, tasklist, playbook]
    related_skills: [hermes-long-task, subagent-driven-development, hermes-agent]
---

# Hermes LongTask Commander — 任务清单驱动的长任务指挥手册

> 2026-11-13 从火山语音视觉接入（6 轮 todo / 39 模型实测 / 三资产发布）实战沉淀。

## 一、定位与分工

1. 【本 skill = 编排层】任务清单怎么建怎么管 + 长任务配置基线怎么查改 + 执行节奏怎么控
2. 【配套 hermes-long-task = 工具层】循环检测 watchdog / long_run.sh 三模式 / orchestrator 分工模板 / 输出熔断红线——遇到副作用细节加载它（devops/hermes-long-task）
3. 【一句话分工】commander 管「打什么仗、按什么节奏打」，long-task 管「武器怎么用、炸膛了怎么办」

## 二、任务清单方法论（todo 全生命周期）

### 2.1 何时建清单

1. 【必建】3 步以上任务；用户一次给多条指令（"1、2都做，然后…再…"）；多资产多阶段交付
2. 【不建】单工具调用能完成的问询/查询（反而增加开销）
3. 【时机】任务开始第一件事就是建清单——先拆解再动手，拆解本身就是需求澄清

### 2.2 怎么拆任务

1. 【粒度】一步可验证：每个任务的完成判据必须可核验（文件存在/命令退出码/测试 PASS），拆不到可核验就继续拆
2. 【编号】id 用数字 1/2/3…（排序即执行优先级）
3. 【依赖】有依赖关系的按顺序排；可并行的任务相邻放置（节省 in_progress 切换）
4. 【修订】失败任务转 cancelled 并立即补一条修订任务（不删除不隐藏失败痕迹）

### 2.3 状态流转铁律

1. 【唯一推进】同时只能有 1 个 in_progress——双线作战是长任务跑偏的头号原因
2. 【即时闭环】完成即标 completed，不留"其实做完了但没标"的尾巴（误导恢复判断）
3. 【merge 语义】增量更新用 merge=true；全盘重排（新阶段）用 merge=false 替换整表
4. 【读清单】todo() 无参调用 = 读当前清单，恢复现场的第一动作

### 2.4 与长任务节奏协同

1. 【启动】建全量清单 → preflight 查配置（见 §3）→ 规划长命令全部走 background
2. 【执行中】每 10 步 todo 对账一次；每个任务完成立即标记再进下一个
3. 【熔断/中断恢复】查 todo（知道停在哪）→ 查盘 ls/wc（知道产物在哪）→ 查进程（daemon 存活）→ 从停处续，不从头重做
4. 【收尾】清单全 completed 才允许交付报告；报告里附任务清单完成态对照

## 三、长任务配置基线（查 / 改 / 回滚）

### 3.1 基线表（2026-11-13 实测）

| 参数 | 默认值 | 当前基线 | 作用 |
|---|---|---|---|
| agent.max_turns | 90 | 1800 | 主会话步数上限 |
| delegation.max_iterations | 50 | 500 | 子 Agent 迭代上限 |
| delegation.max_spawn_depth | 1 | 2 | orchestrator spawn 层数 |
| terminal.timeout | 180 | 600 | 前台命令上限(秒) |
| process.wait_max_seconds | 60 | 60 | process wait 被静默夹到的值 |

### 3.2 查 / 改 / 回滚三步

```bash
# 查(或直接跑 scripts/longtask_preflight.py)
grep -nE "max_turns|max_iterations|max_spawn_depth|timeout" ~/.hermes/config.yaml
# 改(改前必备份)
cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak.$(date +%Y%m%d-%H%M%S)
hermes config set agent.max_turns 1800
# 回滚 = cp 备份回来 + 重启会话
```

1. 【生效时机】部分配置热生效，max_turns 等会话级参数新会话生效——改完验证要开新会话
2. 【config.yaml 是保护文件】patch/write_file 工具直写会被拒，必须走 `hermes config` 命令
3. 【注意】process wait 的 timeout 无论传多少实际最多等 wait_max_seconds(60s)——这是行为不是 bug，长等待靠 notify_on_complete

## 四、长任务执行 SOP

1. 【启动前】① 建全量 todo ② 跑 preflight 脚本确认长任务模式达标 ③ 预估长命令全部规划 background+notify_on_complete ④ 输出目录规划（> /tmp/xxx.log 2>&1）
2. 【执行中】① 每 10 步对账 ② 长命令后台跑+看 log 不等结果 ③ 中间产物落盘不在对话里传（防截断）
3. 【熔断恢复】查 todo → 查盘 → 查进程 → 续跑；先核验不重做
4. 【收尾】todo 逐条核对全 completed → 交付物 ls/wc 核验 → 报告附清单对照
5. 【副作用细节】循环检测/分工模板/输出熔断红线 → 加载 devops/hermes-long-task

## 五、坑表（2026-11-13 实战）

1. 【wait 夹 60s】process(action='wait', timeout=120) 实际最多等 60s——长等待靠 notify_on_complete 信号，别指望 wait 参数
2. 【background stdout】后台进程 stdout 重定向文件后才可靠（> /tmp/run.log 2>&1），output_preview 经常拿不到
3. 【MCP reload】MCP 服务器重载后工具列表变化，新注册工具要新会话才可用——当前会话工具集可能漂移，用前先确认
4. 【被拒命令不重试】门禁拒绝的命令不原样重试、不换个皮重试，先读懂拒绝原因再改道
5. 【terminal heredoc】多行 python 走 terminal heredoc 会触发门禁——用 execute_code 工具跑
6. 【config 保护】config.yaml 被 patch 工具保护拒绝直写——一律走 hermes config 命令
7. 【暂停续跑】上下文压缩会保留 todo 清单（active list preserved）——恢复后第一件事读清单对齐进度

## 工程护栏（better-skill 补丁 · 2026-11-13）

### 触发时机（必修 P0-1）
当用户提出本技能覆盖的任务、或明确点名本技能时使用；同一意图的不同说法（改述）也应能触发。

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。
