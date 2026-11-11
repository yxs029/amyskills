## 关键经验（续 — 跨 session 长任务持续推进模式）

### 21. 跨 session 长任务持续推进模式 (2026-06-03 SRM-PRO 24 子模块实战)

**场景：** 老大要求"一直执行完所有任务, 不要停, 任务编号顺序 N011→N012→N008→N013→...→A002-A007 直到清零"。**单个 session 工具调用 120 次**会撞上限, 必须**跨 session 持续推进**。

**核心架构 (4 文件 todo + cron 协同):**
```
~/aitodolist/
├── todo_active.md     # 进行中 (保持 1 个)
├── todo_next.md       # 待开始 (按编号排队)
├── todo_fin.md        # 已完成
├── todo_cancel.md     # 已取消
├── todo_manager.py    # 8 命令 CLI
└── cron_push.sh       # 9am/5pm 飞书推送
```

**节奏控制原则:**
- 老大说"不要停" = **主动串行执行, 不等指令**
- 老大说"等通知/看看你的待办" = **停下来等, 不擅自 start**
- **判断信号**: 老大用陈述句"开始/启动/执行"= 主动, 疑问句"做完了吗/怎么样"= 被动汇报

**串行而非并发的 3 个理由:**
1. **资源独占**: 浏览器/截图/文件 IO 共享, 并发会冲突
2. **状态清晰**: 1 个 active 容易追踪, 5 个 active 谁先谁后混乱
3. **中断友好**: session 撞 120 次上限时, 只丢 1 个 active 任务的进度, 重启即续

**5 大命令的固定执行模板:**
```bash
cd ~/aitodolist
python3 todo_manager.py add    <title> -m <note> --path <dir>   # 加任务
python3 todo_manager.py start  N001                            # 启动 (移到 active)
python3 todo_manager.py done   A001                            # 完成 (移到 fin)
python3 todo_manager.py status                                  # 统计
python3 todo_manager.py suggest                                 # 推荐下一个
```

**完成一个任务的"标准 4 步收尾"** (见 #26):
1. 写方法论 → `<项目>/测测测试方法论/<子模块>/v2_xxx.md`
2. 写报告 → `<项目>/测试报告/<子模块>/v2_xxx.md`
3. done 任务 → `python3 todo_manager.py done A001`
4. start 下一个 → `python3 todo_manager.py start N012` (按 next 编号顺序)

### 22. todo_manager.py done 命令的 -m 标志陷阱 (2026-06-03 SRMPRO 实战)

**坑:** `done` 命令**只接位置参数 id**, **不支持 -m 标志**。如果写:
```bash
python3 todo_manager.py done A001 -m "4层深度完成"
# ❌ 报错: error: unrecognized arguments: -m
```

**正确:**
```bash
python3 todo_manager.py done A001
# ✅ 移动到 fin, 输出 "✅ F012 已完成"
```

**add 命令支持 -m, 但 done 不支持** — 不对称设计。如果要给 fin 加备注, 直接编辑 `todo_fin.md`。

**start 命令也不支持 -m**, 但 start 输出会显示备注 (从 next 复制过来)。

### 23. 工具调用 120 次上限的批次规划 (2026-06-03 SRMPRO 实战)

**实测:** 1 个 session 撞 120 次工具调用上限后, 系统会强制要求"提供最终响应"。这时如果还有大量未完成任务, **需要 5 步规划**:

1. **把已经做的工作落盘** (写报告/方法论/done 任务)
2. **写"下一 session 恢复清单"** 包含: active 状态 + 当前进度 + 待办编号
3. **不浪费剩余步骤**: 用最后几次工具调用把"报告/方法论"写完
4. **告诉老大"已撞上限, 恢复点在哪"**, 等下一个 session 自然开始
5. **恢复时从 active 拿任务继续**, 不重头开始 (老大明确偏好)

**批次规划 (典型 1.5 小时 session):**
| 时段 | 工具调用 | 任务 |
|---|---|---|
| 0-30 min | 1-30 | 登录 + cascader 导航 + L1 列表探索 |
| 30-60 min | 31-60 | L2 顶部按钮 + L3 行操作 |
| 60-90 min | 61-90 | L4 链接/dialog + 报告 + 方法论 |
| 90-120 min | 91-120 | 写阶段报告 + done + 启动下一个 |

**关键经验:** 报告 + 方法论 2-3 次 write_file 算 1 个任务完成, **不要在最后 30 次还开新任务的探索**。提前 30 次开始收尾。

### 24. active 保持 1 个 + next 串行执行 (2026-06-03 SRM-PRO 24 子模块实战)

**老大原话:** "如果 active 中任务执行完成就从 next 取 3 个任务, 任务编号顺序 N011, N012, N008, N013, N014, N015, ……一直到完成所有的 next 中的任务为止"

**解读:** 不是并行 3 个, 是**串行 1 个, 完成后立刻从 next 取下一个**。

**为什么 1 个 active:**
- 浏览器 session 只能 1 个主框架页面
- 滑块 + 登录 + cascader 是串行依赖
- 截图/报告是子任务独立
- 撞 120 次上限时, 重启 = 继续 active 那 1 个

**next 按编号顺序的检查模板:**
```bash
cd ~/aitodolist
python3 todo_manager.py suggest
# 输出 next 队列, 按编号 N001 → N002 → ... 排序
```

**踩坑:** `add` 时如果没指定 `--path`, 任务没关联子目录, 后续 done 不影响归档。如果要按子目录归档, **每次 add 都带 --path**。

### 25. 每小时汇报一次的 3 段式模板 (2026-06-03 SRMPRO 老大偏好)

**老大原话:** "执行过程中每个小时向我汇报一次, 但是不需要中断执行的内容"

**3 段式汇报模板 (不打断节奏, 但要清楚):**

```markdown
