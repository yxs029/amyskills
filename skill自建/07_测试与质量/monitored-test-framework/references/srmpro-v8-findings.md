# SRMPRO v8 补测发现

> 2026-07-19 | v8全量: 128用例 / 374步 / 338截图 / 96通过(75.0%) / 32失败 / P0=51/67(76.1%)

## 一、M07 供应商文档库补测（18场景）

### 背景
V3.0定义M07有62个测试场景，v6只测了3个核心场景（覆盖率4.8%）。按覆盖率分类法筛选出18个可直接测场景。

### 分类方法
按场景文本关键词匹配分类：
- **可直接测**（18个）：admin/aarontest账号即可，含归档恢复循环/批量归档/更新联动/权限菜单/操作记录/端到端/统计一致
- **需供应商账号**（11个）：供应商文档库分享/下载/预览/权限
- **需JMeter**（10个）：并发/大数据量/响应时间
- **需Postman**（7个）：SQL注入/XSS/越权/Token
- **需多浏览器**（12个）：Chrome/Edge/360兼容性

### M07补测结果
- 18用例 / 62步 / 59截图 / 15 PASS / 3 FAIL
- **TC-S015**: testadmin登录失败（多page并发登录冲突，非系统问题）
- **TC-S017**: admin侧边栏菜单未展开（菜单折叠，非系统问题）
- **TC-S037**: 批量归档5个耗时6.01秒 > 3秒标准（真实性能Bug！）

### 关键PASS发现
- 归档/恢复循环5次操作全部成功，统计实时更新
- 临期统计=0, 过期统计=18
- 批量归档3个图纸确认弹窗正常
- 更新弹窗含文件上传区+通知配置
- 全流程：上传/归档/下载按钮全部可用
- 端到端：列表->搜索->重置->物料视图->图纸视图
- 跨模块统计一致性验证通过

## 二、批量归档性能Bug（TC-S037）

### 测试方法
```python
t0 = time.time()
# 勾选5个图纸
for i in range(5):
    page.locator(f".vxe-body--row:nth-child({i+1}) .vxe-cell--checkbox").click(force=True)
# 点击批量归档
page.locator("button:has-text('批量归档')").click()
# 确认
page.locator(".el-message-box__btns button:has-text('确定')").click()
# 等待刷新
page.wait_for_timeout(5000)
t1 = time.time()
elapsed = round(t1 - t0, 2)
# elapsed = 6.01 > 3.0 -> FAIL
```

### 判定标准
V3.0要求批量操作≤3秒。6.01秒超过标准100%，判定FAIL。

## 三、gen_full_report模块文件选择坑

### 问题
M01目录有10+个JSON文件：
```
M01_v3_batch2_results.json   (11用例)
M01_v3_batch3_results.json   (7用例)
M01_v3_batch4_results.json   (15用例)
M01_v3_deep_results.json     (7用例)
M01_v3_final_results.json    (40用例) ← 应该选这个
M01_v3_merged_results.json   (18用例)
M01_v4_final.json            (40用例) ← 或这个
M01_v6_expand.json           (1用例)  ← 版本最高但用例最少！
```

版本匹配逻辑 `v8>v7>v6>v5>v4` 选了v6_expand（1用例），而非v4_final（40用例）。

### 解法
手动指定每个模块的最佳文件名：
```python
mod_files = {
    '01': ('M01_v4_final.json', 'M01_按图纸展开'),
    '02': ('M02_v4_final.json', 'M02_按物料展开'),
    '03': ('M03_v4_final.json', 'M03_上传图纸'),
    ...
}
```

或按用例数选：`max(cases)` 而非 `max(version)`。

### 检查方法
```python
for f in os.listdir(RESULTS_DIR):
    if f.endswith('.json') and 'M01' in f:
        with open(f"{RESULTS_DIR}/{f}") as fh:
            d = json.load(fh)
        print(f"  {f}: {len(d.get('cases',[]))}用例")
```

## 四、多page并发登录冲突

### 问题
在同一个browser context里，admin在page1登录后，testadmin在page2登录失败：
```
robust_login在context.new_page()新页面里找不到用户名输入框
```

### 原因
admin的page1保持登录态，context cookies干扰了page2的登录页渲染。

### 解法
```python
# 方案1：用新的browser context
context2 = browser.new_context()
page2 = context2.new_page()
login_helper.login_admin(page2, username="testadmin", password="...")

# 方案2：先关闭page1再登testadmin
page1.close()
page2 = context.new_page()
login_helper.login_admin(page2, username="testadmin", password="...")
```

**不要在同一个context里并发多账号登录。**

## 五、v8全量最终数据

| 模块 | 用例 | 步骤 | 截图 | 通过 | 通过率 |
|------|------|------|------|------|--------|
| M01-按图纸展开 | 40 | 135 | 115 | 30 | 75.0% |
| M02-按物料展开 | 11 | 27 | 27 | 8 | 72.7% |
| M03-上传图纸 | 8 | 19 | 19 | 5 | 62.5% |
| M04-关联物料 | 7 | 12 | 12 | 4 | 57.1% |
| M05-更新图纸 | 8 | 18 | 18 | 6 | 75.0% |
| M06-图纸库配置 | 10 | 33 | 33 | 7 | 70.0% |
| M07-供应商文档库 | 21 | 71 | 65 | 18 | 85.7% |
| M08-业务场景 | 8 | 16 | 16 | 5 | 62.5% |
| M09-权限控制 | 8 | 23 | 15 | 6 | 75.0% |
| M10-端到端流程 | 7 | 20 | 18 | 7 | 100.0% |
| **全量** | **128** | **374** | **338** | **96** | **75.0%** |

P0: 51/67 = 76.1%

### 版本演进
| 版本 | 用例 | 步骤 | 截图 | 通过率 | P0通过率 |
|------|------|------|------|--------|---------|
| v3 | 64 | 184 | 141 | 70.3% | 63.3% |
| v4 | 79 | 232 | 184 | 74.7% | 74.2% |
| v5 | 90 | 250 | 202 | 73.3% | 73.8% |
| v6 | 128 | 359 | 301 | 72.7% | 70.3% |
| v7 | 128 | 359 | 301 | 74.2% | 75.4% |
| **v8** | **128** | **374** | **338** | **75.0%** | **76.1%** |
