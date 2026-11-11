# SRMPRO v6 最终版测试发现

> 2026-07-19 | 128用例 / 359步 / 301截图 / 93通过(72.7%) / 35失败 / P0=45/64(70.3%)

## 一、M06 配置页面探测方法论（功能未实现发现模式）

### 背景
V3.0测试过程定义了"图纸库配置"页面，含2个需求点：
1. 删除时间窗口配置（影响删除按钮显示时间）
2. 邮件提醒配置（临期/过期自动发邮件）

### 探测流程（5步法）

| 步骤 | 方法 | 结果 |
|------|------|------|
| 1. 侧边栏菜单扫描 | `document.querySelectorAll('.el-menu-item, .el-submenu__title')` | 只有：首页/供应商/价格/图纸库/订单/交付计划/对账单/帮助中心，无配置入口 |
| 2. 全页元素搜索 | 遍历所有`*`找含"配置"/"删除时间"/"邮件提醒"的元素 | 只有"保存配置"/"重置配置"按钮，属于主题设置面板 |
| 3. URL路由探测 | 尝试21个可能的配置URL（/draw/config, /draw/setting等） | 全部404 |
| 4. Vue路由表提取 | `app.__vue_app__.config.globalProperties.$router.getRoutes()` | 路由表不可达（Vue3 + 框架封装） |
| 5. 主题面板验证 | 检查"保存配置"按钮所属容器 | `setting-drawer-content`类，内容=主题颜色/TopNav/Tags-Views，非业务配置 |

### 结论
**V3.0要求的"图纸库配置"功能在系统中未实现**。"保存配置"/"重置配置"按钮是RuoYi框架自带的主题风格设置。

### 探测脚本参考
```python
# URL批量探测
test_urls = [
    "/draw/draw-config", "/draw/drawConfig", "/draw/config", "/draw/setting",
    "/draw/draw/setting", "/draw/library-config", "/draw/libraryConfig",
    "/draw/delete-config", "/draw/email-config", "/draw/notify-config",
    "/system/draw-config", "/system/drawConfig", "/system/setting",
    "/system/config", "/system/email-config", "/admin/config",
    "/admin/draw-config", "/admin/setting", "/draw/draw/config",
    "/draw/draw/delete-config", "/draw/draw/email-config"
]
for url_path in test_urls:
    resp = page.goto(f"https://test.esicint.com{url_path}", timeout=3000)
    body = page.evaluate("() => document.body.innerText.substring(0, 80)")
    is_404 = '找不到' in body or '404' in body
    if not is_404 and resp.status == 200:
        found_urls.append(url_path)
```

## 二、浅用例补齐流程

### 审计方法
```python
for case in cases:
    step_count = len(case.get("steps", []))
    shot_count = len([s for s in case.get("steps", []) if s.get("screenshot")])
    if step_count <= 1:
        print(f"🔴 {case['id']}: 浅测试(仅{step_count}步) - 不可信PASS")
    elif shot_count == 0:
        print(f"🔴 {case['id']}: 无截图 - 不可信PASS")
```

### v6补齐数据
- 补齐前：90用例中10个浅用例（steps≤1）
- 补齐后：10个用例全部扩到3-4步+截图+DOM断言

### 补齐模板
```python
# 之前（1步假通过）
step(case, 1, "检查元素存在", "元素存在", True, screenshot)

# 之后（3-4步深度验证）
step(case, 1, "记录初始状态", f"行数={rows}", True, s2b(page, "tc_s1"))
step(case, 2, "执行操作", f"操作结果={result}", True, s2b(page, "tc_s2"))
step(case, 3, "验证效果", f"变化={before}->{after}", result_ok, s2b(page, "tc_s3"))
step(case, 4, "恢复状态", f"恢复={restored}", True, s2b(page, "tc_s4"))
```

## 三、模块扩展流程

### 判断模块是否需要扩展
1. 读取V3.0文件，提取每个模块的测试场景数
2. 对比已测用例数
3. 已测 < V3.0场景数 → 需要扩展

### v6扩展数据
| 模块 | V3.0场景 | 扩展前 | 扩展后 |
|------|---------|--------|--------|
| M08业务场景 | 11 | 5 | 13 |
| M09权限控制 | 8 | 5 | 13 |
| M10端到端 | 7 | 3 | 10 |

### 扩展用例设计原则
- 按V3.0测试点逐个写用例
- 每用例3-6步+截图+DOM断言
- 权限测试需切换账号（admin/aarontest/testadmin）
- 端到端测试需跨模块验证数据一致性

## 四、gen_full_report.py 参数格式

### 正确调用方式
```bash
python3 gen_full_report.py \
    --modules-dir /tmp/v6_modules \
    --module-stats /tmp/v6_modules/module_stats.json \
    --output output.html \
    --system-name "SRMPRO图纸库" \
    --version "v6-最终版" \
    --test-date "2026-07-19" \
    --test-url "https://test.esicint.com/draw/draw" \
    --test-users "admin/aarontest/testadmin" \
    --engine "Playwright+Python" \
    --tools "Chrome 1134"
```

### module_stats.json 完整字段
```json
{
    "name": "M01-按图纸展开",
    "total": 41,
    "pass": 31,
    "fail": 10,
    "skip": 0,           // 必须有，否则KeyError
    "rate": 75.6,
    "verdict": "良好",    // 优秀/良好/合格/需改进
    "cls": "good",       // excellent/good/fair/poor
    "finding": "失败摘要",
    "time": "深度步骤测试",
    "steps": 139,
    "shots": 119,
    "p0_total": 15,
    "p0_pass": 12
}
```

### modules-dir 目录结构
```
/tmp/v6_modules/
├── M01-按图纸展开_v6.json      // 每个模块一个JSON
├── M02-按物料展开_v6.json
├── ...
└── module_stats.json            // 汇总统计
```

### 常见报错
| 报错 | 原因 | 修复 |
|------|------|------|
| `KeyError: 'skip'` | stats缺skip字段 | 加`"skip": 0` |
| `KeyError: 'name'` | stats用`module`字段 | 改为`name` |
| `KeyError: 'p0_pass'` | stats缺p0字段 | 加`"p0_total"`和`"p0_pass"` |
| `--result`参数报错 | gen_full不需要result | 用`--modules-dir`+`--module-stats` |

## 五、f-string backslash 语法坑

### 问题
Python f-string 的 expression 部分不能包含 backslash（`\`）。

### 错误写法
```python
# JS代码含\'导致f-string报SyntaxError
dlg_open = f"弹窗={'open' if ev(page, '()=>{const d=document.querySelector(\'.el-dialog\');return d?true:false}') else 'closed'}"
# SyntaxError: f-string expression part cannot include a backslash
```

### 正确写法
```python
# 把JS表达式提取到变量先求值
js = "() => { const d=document.querySelector('.el-dialog'); return d?true:false; }"
dlg_open = ev(page, js)
result_str = f"弹窗={'open' if dlg_open else 'closed'}"
step(case, 1, "打开弹窗", result_str, dlg_open, screenshot)
```

## 六、v6全量最终数据

| 模块 | 用例 | 步骤 | 截图 | 通过 | 通过率 | 评级 |
|------|------|------|------|------|--------|------|
| M01-按图纸展开 | 41 | 139 | 119 | 31 | 75.6% | 良好 |
| M02-按物料展开 | 12 | 30 | 30 | 9 | 75.0% | 良好 |
| M03-上传图纸 | 9 | 22 | 22 | 6 | 66.7% | 合格 |
| M04-关联物料页面 | 9 | 18 | 18 | 5 | 55.6% | 合格 |
| M05-更新图纸 | 8 | 18 | 18 | 6 | 75.0% | 良好 |
| M06-图纸库配置 | 10 | 33 | 33 | 5 | 50.0% | 合格 |
| M07-供应商文档库 | 3 | 9 | 6 | 3 | 100.0% | 优秀 |
| M08-业务场景 | 13 | 29 | 20 | 9 | 69.2% | 合格 |
| M09-权限控制 | 13 | 32 | 16 | 9 | 69.2% | 合格 |
| M10-端到端流程 | 10 | 29 | 19 | 10 | 100.0% | 优秀 |
| **全量** | **128** | **359** | **301** | **93** | **72.7%** | - |
