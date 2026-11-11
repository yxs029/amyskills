# 长测试批次执行 + 日志合并模式

> 2026-07-17 实战沉淀：M01 模块 38 个用例在有头模式下分 4 批执行，每批 ≤8 个用例

## 问题

1. **EPIPE 崩溃**: 有头浏览器（headless=False）跑 15+ 个用例后 Playwright driver WebSocket 累积缓冲区，`Error: write EPIPE` 崩溃
2. **JSON 覆盖**: `save_results()` 每批覆盖 JSON 文件，前批数据丢失
3. **多脚本并行**: 10 个模块脚本同时后台跑，结果文件可能互相覆盖

## 解决方案

### Step 1: 分批执行（环境变量控制）

测试脚本读取 `BATCH_START` / `BATCH_END` 环境变量：

```python
batch_start = int(os.environ.get('BATCH_START', '1'))
batch_end = int(os.environ.get('BATCH_END', str(len(all_scenes))))
batch_scenes = all_scenes[batch_start-1:batch_end]
```

### Step 2: 每批 tee 到独立日志

```bash
BATCH_START=1 BATCH_END=8 python run_m01_tests.py 2>&1 | tee /tmp/m01_batch1.log
BATCH_START=9 BATCH_END=16 python run_m01_tests.py 2>&1 | tee /tmp/m01_batch2.log
BATCH_START=17 BATCH_END=24 python run_m01_tests.py 2>&1 | tee /tmp/m01_batch3.log
BATCH_START=25 BATCH_END=38 python run_m01_tests.py 2>&1 | tee /tmp/m01_batch4.log
```

### Step 3: 日志合并恢复（JSON 被覆盖时从日志提取）

```python
import re

all_cases = {}
pattern = r'\[(PASS|FAIL)\] (TC-DRAW-M01-\d+) - (.+?): (.+)'

for logfile in ['/tmp/m01_test_v2.log', '/tmp/m01_batch2.log',
                '/tmp/m01_batch3.log', '/tmp/m01_batch4.log']:
    try:
        with open(logfile, 'r') as f:
            for status, tc_id, title, desc in re.findall(pattern, f.read()):
                all_cases[tc_id] = {
                    "id": tc_id, "title": title, "priority": "P1",
                    "status": status, "actual": desc[:200],
                    "steps": [{"step": 1, "action": "执行测试",
                               "result": desc[:200], "ok": status == "PASS"}],
                    "screenshots": [], "defect": None
                }
    except FileNotFoundError:
        pass

# 保存到 _final.json（不会被后续批次覆盖）
merged = sorted(all_cases.values(), key=lambda x: x['id'])
with open(f"{RESULTS_DIR}/M01_final.json", 'w') as f:
    json.dump({"cases": merged, "stats": {...}}, f, ensure_ascii=False, indent=2)
```

### Step 4: 后台并行执行

```python
# 同时启动多个模块（每个模块独立浏览器进程）
terminal(background=True, command="DISPLAY=:0 python run_m03_tests.py | tee /tmp/m03.log")
terminal(background=True, command="DISPLAY=:0 python run_m04_tests.py | tee /tmp/m04.log")
# ... 等
```

## 关键教训

1. **JSON 保存逻辑**: 如果分批跑，`save_results()` 必须改为追加模式或用独立文件名（`_final.json`）
2. **日志格式**: 测试脚本输出的日志格式必须包含 `[PASS]` / `[FAIL]` + 用例ID + 标题 + 描述，才能用正则提取
3. **每 2 个用例存档**: 在脚本内部每 2 个用例调用一次 `save_results()`，防止中途崩溃丢失
4. **batch_size**: 有头模式下每批 ≤8 个用例是安全的；无头模式可以跑更多但老大要求有头
