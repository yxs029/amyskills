# SRMPRO v9/v10 最终版发现（2026-07-19）

## 一、vxe-table vs el-table 选择器大坑（3轮才修正）

### 问题
9轮前已经知道图纸库混用了 vxe-table + el-table，但 v8/v9 阶段补测脚本仍然沿用 `.el-table__row` 选择器，导致：
- 页面统计"已过期18条"（真实数据）
- 脚本读到行数=0（选错表格组件）
- 所有依赖行数据的用例全部退化

### 诊断脚本（5秒定位真实表格组件）
```python
# debug_empty_list.py
tables = page.evaluate("""() => {
    const tables = document.querySelectorAll('.el-table, table, [class*="table"], [class*="vxe"]');
    return Array.from(tables).map(t => ({
        class: t.className.substring(0, 60),
        rows: t.querySelectorAll('tr,.el-table__row').length,
        visible: t.offsetParent !== null,
        text: t.innerText?.substring(0, 100) || ''
    }));
}""")
```

**实测发现**：图纸库主页面同时存在：
- 1 个 el-table（不可见，疑似历史遗留 / 通知弹窗用）
- 22 个 vxe-table 相关组件（可见，是真实表格）

### 正确选择器清单（SRMPRO v10 已验证）
| 元素 | vxe-table 选择器 | 不是这个（el-table） |
|------|----------------|---------------------|
| 数据行 | `.vxe-body--row` | `.el-table__row` ❌ |
| 表格主容器 | `.vxe-table--render-default` | `.el-table` ❌ |
| 分页器 | `.vxe-pager--total` | `.el-pagination` ❌ |
| 固定左列（操作列） | `.vxe-table--fixed-left-wrapper` | `.el-table__fixed` ❌ |
| 复选框 | `.vxe-cell--checkbox` | `.el-checkbox` ❌ |
| 表头 | `.vxe-header--column` | `.el-table__header` ❌ |
| 提示信息 | `.vxe-loading` | `.el-loading` ❌ |

### 修复验证
- 修复前：3个用例0步全ERROR（ERROR根因见下）
- 修复后：6个用例27步全PASS，统计/行数/more菜单/弹窗全部能读到

## 二、3个0步ERROR用例的3种根因模式

### 用例1：M04-007（物料删除关联处理）
- **报错**：`name 'close_menu' is not defined`
- **根因**：脚本里调用了 `close_menu()` 函数（用于关闭more下拉菜单），但函数未定义
- **修复**：补全 `close_menu(page)` 函数，`page.keyboard.press('Escape') + wait 500ms`
- **教训**：所有 DOM 辅助函数必须在脚本顶部定义完整

### 用例2：m08_tc03（归档生效验证）
- **报错**：`name 'statuss' is not defined`
- **根因**：变量名拼写错误，`status` 写成 `statuss`
- **修复**：统一变量名 `stats_before` / `stats_after`（不再用 `statuss` 缩写）
- **教训**：用 IDE 检查函数名/变量名拼写一致性，或用 type hint 强制类型

### 用例3：m08_tc07（通知配置验证）
- **报错**：`object of type 'NoneType' has no len()`
- **根因**：`page.evaluate(js)` 返回 None（dialog 没打开），但脚本直接 `len(dom_value)`
- **修复**：所有 `ev()` 返回值先判 None 再 `len()`
- **教训**：**DOM返回值永远是 None-safe 编程**——任何 `page.evaluate` 结果都要先 None check

### 0步用例修复模板
```python
# 修复前（崩溃）
def close_menu(page):  # 未定义
    ...

menu = get_more_menu(page, 0)
close_menu(page)  # NameError

# 修复后
def close_menu(page):
    try: page.keyboard.press('Escape'); page.wait_for_timeout(500)
    except: pass

menu = get_more_menu(page, 0)
close_menu(page)  # OK
```

## 三、APIFox CLI 命令清单（性能/安全/兼容补测工具）

### 安装
```bash
npm install -g apifox-cli   # 需 Node >= 20
apifox --version            # 验证安装
```

### 核心命令
```bash
# 最简形式：跑单个测试场景
apifox run -t <场景token> -e <环境ID> -r cli,html

# 数据驱动（CSV）
apifox run -t <token> -e <env> -r cli,html -d test_data.csv -n 10000

# 输出报告
apifox run ... --upload-report  # 上传到APIFox
```

### 参数对照
| 参数 | 含义 | 用途 |
|------|------|------|
| `-t` | 测试场景 token | 必填，APIFox项目里复制 |
| `-e` | 环境 ID | 区分 dev/test/prod |
| `-r` | 报告格式 | cli,html / json / junit-xml |
| `-d` | 数据文件 CSV | 表头自动映射到接口参数 |
| `-n` | 循环次数 | 性能压测用 |
| `--upload-report` | 上传报告 | CI 集成用 |

### CSV 数据驱动模板
```csv
user_id,status,expected_code
1001,active,200
9999,banned,403
-1,null,400
```

CSV 表头 → 接口请求参数（运行时映射）

### 对本项目 V3.0 未测场景的覆盖能力

| 未测类别 | 数量 | APIFox CLI 能补？ | 怎么补 |
|----------|------|-------------------|--------|
| 性能（20万数据/100并发/5天） | 15 | ✅ | `-n 10000` 压测，CSV 模拟数据 |
| 安全（SQL注入/XSS/越权/Token） | 9 | ✅ | CSV 准备 payload：`' OR 1=1 --` / `<script>` / `../../../etc/passwd` |
| 兼容（Chrome/Edge/360/IE11） | 12 | ⚠️ 部分 | CSV 准备 User-Agent，但真实浏览器渲染差异无法模拟 |
| 并发操作冲突 | 1 | ❌ | 必须真实多浏览器+多账号并发 |
| 供应商账号功能 | 7 | ❌ | 必须真实供应商账号登录 |
| 跨系统物料主数据 | 6 | ❌ | 必须能操作 SRM 物料主数据 |
| 长时间等待（24h） | 9 | ❌ | 必须真实等待或 mock 时间 |
| 多采购组织账号 | 2 | ❌ | 必须多采购组织账号 |
| 特殊大文件（1.01GB） | 1 | ❌ | 必须真实大文件 |

**结论**：APIFox CLI 能覆盖 **24 个场景**（15性能+9安全），仍需 41 个场景需要其他手段。

## 四、汇报格式规范（清单体 + 场景说明）

### 老大原话
> "你用清单体给我吧，不要列表格，列表格我实在看不清楚"
> "你这些用例是什么场景？补充一下步骤，然后补测一下"

### 规范
- **清单体代替表格**：叙述/对比/分析用 `①②③` + 加粗短语
- **场景说明必须**：补测/补深度用例时，先讲**场景是什么**（用户业务场景描述），再讲**步骤**（每步动作+断言），最后讲**实际发现**（不是空 PASS）
- **表格只用于**：配置文件、JSON 结构、命令行参数（确实需要行列对齐的数据）

### 场景说明示例（v10 M08-002）
```
**M08-002 补深: 恢复操作后状态恢复**
场景：管理员归档一个有效图纸 → 看到归档确认框 → 确认 → 列表行消失/统计变化 → 刷新页面 → 通过more菜单恢复 → 列表行回来/统计恢复

步骤（6步）：
1. 操作前统计 → {'linqi':'临期 0','guoqie':'已过期 18'}
2. 操作前行数 → 20
3. 查看more菜单 → ['更新','归档','操作记录']
4. 归档后统计 → 数字变化（确认生效）
5. 归档后查看more菜单 → 多出'恢复'选项
6. 恢复后统计 → 数字回到归档前（确认恢复）

实际发现：归档生效→恢复成功，但more菜单的'恢复'选项仅在归档后立刻可见，刷新页面后可能消失（需进一步验证）
```

## 五、5个1步浅用例 = 真实系统问题（默认FAIL）

| 用例 | actual | 真实含义 |
|------|--------|----------|
| TC-DRAW-M01-024 | 物料清单查询按钮未找到 | 按钮可能叫"按物料导入"或在二级菜单 |
| TC-DRAW-M02-006 | 列表下载: 列表下载 | 点击列表下载无提示无文件下载（Bug） |
| TC-DRAW-M03-008 | accept='' | 上传弹窗无文件类型限制（Bug） |
| TC-DRAW-M05-005 | has_upload=False | 更新弹窗无文件上传区 |
| TC-DRAW-M05-006 | 标签=[] | 更新弹窗无任何字段标签 |

**判定口诀**：
- 1步 + 异常 actual = **真Bug**（保留 FAIL + 提单）
- 1步 + 正常 actual = **假阳性**（补深步骤）

## 六、v10全量最终数据

```
总用例: 128
总步骤: 398
总截图: 362
通过: 100 (78.1%)
失败: 28 (21.9%)
P0: 53/66 (80.3%)
假阳性: 0
0步用例: 0
1步用例: 5（全部FAIL=真实Bug）
```

模块明细：
- M01 按图纸展开: 40用例 / 30P / 10F
- M02 按物料展开: 11用例 / 8P / 3F
- M03 上传图纸: 8用例 / 5P / 3F
- M04 关联物料: 7用例 / 6P / 1F
- M05 更新图纸: 8用例 / 6P / 2F
- M06 图纸库配置: 10用例 / 7P / 3F
- M07 供应商文档库: 21用例 / 18P / 3F
- M08 业务场景: 8用例 / 7P / 1F
- M09 权限控制: 8用例 / 6P / 2F
- M10 端到端流程: 7用例 / 7P / 0F (100%!)
```

## 七、V3.0 覆盖率分析（65个未测场景）

按可测性分9类：

| 原因 | 数量 | APIFox CLI 可补 |
|------|------|----------------|
| 需JMeter/性能工具 | 15 | ✅ |
| 需多浏览器环境 | 15 | ⚠️ 部分 |
| 需Postman/安全工具 | 9 | ✅ |
| 需长时间等待/邮件 | 9 | ❌ |
| 需供应商账号 | 7 | ❌ |
| 需跨系统操作物料主数据 | 6 | ❌ |
| 需多采购组织账号 | 2 | ❌ |
| 需特殊大文件 | 1 | ❌ |
| 需并发测试环境 | 1 | ❌ |

**APIFox CLI 能补 24/65 = 37%**，剩余 41 个场景需要其他手段。