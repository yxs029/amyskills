# SRMPRO 图纸库 v5 深度测试 DOM 发现（2026-07-19）

本文件记录 v5 补齐测试中发现的新 DOM 结构和交互模式，补充 `element-ui-interaction-patterns.md` 未覆盖的部分。

## M05 更新弹窗结构

```
按钮: ['添加关联', '取消', '保存更新']
关联物料: 通过"添加关联"按钮进入子区域，非弹窗内默认展示
文件上传区: 无（has_upload=False）-- 上传入口在独立的上传图纸弹窗
采购组织字段: el-select，labels 可能为空（动态加载）
```

**教训**：不要假设更新弹窗 = 文件上传 + 关联物料。更新弹窗是表单编辑，上传是独立入口。

## M01 物料清单查询弹窗

```
入口按钮文案: 可能不是"按物料清单查询"（V3.0描述）
弹窗按钮: ['取消', '下载模板', '开始查询']
功能: 可下载Excel模板，上传后按物料清单批量查询图纸
```

## M01 分页器

```javascript
// vxe-pagination 存在
// 文本格式: "共 24 条" / "3 页"
// 验证方式:
const pager = document.querySelector('.vxe-pager--total, .vxe-pager');
return pager ? pager.innerText : 'no-pager';
```

## M01 关联物料悬停 popover

```
触发: file-count-trigger 的 mouseover 事件
标题: "关联物料列表 (N)"  // N=关联数量
内容: 完整物料行
  - 物料编码 (如 AVPL-01, 111111)
  - 物料类型 (如 "普通物料")
  - 制造商: -
  - 料号: -
  - 客户: -
  - 客户物料: -
```

## M01 批量归档确认弹窗

```
组件: el-message-box（不是 el-dialog）
文案: "确认归档以下图纸吗？{文件名1} {文件名2}..."
按钮: ['取消', '确定']
验证: document.querySelector('.el-message-box') !== null
       && document.querySelector('.el-message-box').innerText.includes('确认归档')
```

## M01 列表下载 - 疑似Bug

```
操作: 点击"列表下载"按钮
预期: 触发文件下载（Excel/ZIP）
实际: 无提示、无文件下载、无download事件
判定: FAIL - 真实Bug，需提单
验证方式: page.expect_download() 等待5秒，无download事件=FAIL
```

## M01 操作记录弹窗

```
标题: "操作记录"
结构: 可能是分页表格，初始为空也是正常状态
验证: 弹窗存在即可，空表格 ≠ 无操作记录
```

## M03 上传弹窗结构

```
组件: el-dialog
内容: 采购组织选择器(el-select) + 文件上传区
文件类型限制: input[accept] 实测为空字符串（无限制或动态设置）
关闭方式: 取消按钮 或 X 按钮（ESC可能不绑）
```

## M07 文件预览 + 下载完整流程

```
1. 点击文件名 -> 打开新标签页 filePreview.html?fileUrl=...&fileName=...
2. 新页面只有一个 <img> 标签，无下载按钮
3. 从URL参数提取 fileUrl
4. 用 curl + cookie 下载:
   curl -L -o "filename" -H "Cookie: ACCESS_TOKEN=***" "fileUrl"
5. 验证: 文件大小 > 0
```

## M06 图纸库配置页面（v8正确URL版）

**URL: `/system/moduleconfiguration/drawConfig`（不在侧边栏，需直接访问）**

老大给的URL，之前探测21个路径全404后误判"功能未实现"。

### 真实DOM结构

```
页面标题: 图纸库配置
├── 图纸类型表格 (el-table, 2行数据)
│   ├── ROHS        | 是否启用: 开启(el-switch is-checked) | 有效期必填: (空) | updateTime: 2026-02-28 11:28:26
│   └── 供应商图纸   | 是否启用: 开启(el-switch is-checked) | 有效期必填: (空) | updateTime: 2026-02-28 11:28:34
├── 删除图纸时间窗口: [3] 小时 [保存]
│   ├── input[type=text]: 第9个input, value=3
│   ├── 父级文本: "删除图纸时间窗口:\n小时保存"
│   └── 定位方式: 遍历input找父级innerText含"时间窗口"或"小时"
├── 保存按钮: button文本="保存"（业务配置）
└── 主题面板按钮: "保存配置"/"重置配置"（RuoYi框架,非业务配置）
```

### 定位时间窗口输入框的JS

```javascript
// 方法: 遍历所有text input，找父级含"时间窗口"/"小时"的
const inputs = document.querySelectorAll('input[type="text"]');
let target = null;
for(const inp of inputs) {
    if(inp.offsetParent === null) continue;
    let p = inp.parentElement;
    for(let i = 0; i < 6 && p; i++) {
        const t = p.innerText || '';
        if(t.includes('时间窗口') || t.includes('小时') || t.includes('删除图纸')) {
            target = inp; break;
        }
        p = p.parentElement;
    }
    if(target) break;
}
// fallback: 最后一个有数字值的text input
if(!target) {
    for(const inp of inputs) {
        if(inp.offsetParent !== null && /^\d+$/.test(inp.value)) target = inp;
    }
}
```

### 真实Bug: 保存不生效（TC-003）

```
操作: 修改值3->5, 点击保存, 刷新页面
预期: 值变为5
实际: 值仍为3
判定: FAIL - 真实Bug, Vue v-model绑定或保存接口未写入
```

### 输入校验正常（TC-006）

```
输入"abc" -> 值保持3（被拒绝）
输入"-1" -> 值保持3（被拒绝）
输入"3.5" -> 值保持3（被拒绝）
输入"0" -> 值保持3（被拒绝）
有前端校验，但保存接口可能有Bug
```

### 邮件提醒配置确实未实现

V3.0要求的"邮件提醒配置"（提前提醒天数/提醒人员/邮件模板）在正确URL页面也未找到相关元素，功能确实未实现。

## 覆盖率审计快照

| 模块 | V3.0场景 | v5已测 | 覆盖率 | 备注 |
|------|---------|--------|--------|------|
| M01 | 59 | 40 | 68% | 核心P0已覆盖 |
| M02 | 10 | 11 | 110% | 超覆盖(拆细) |
| M03 | 8 | 8 | 100% | 全覆盖 |
| M04 | 10 | 7 | 70% | 核心已覆盖 |
| M05 | 10 | 6 | 60% | 核心已覆盖 |
| M06 | 7 | 2 | 29% | 配置类待补 |
| M07 | 105 | 3 | 3% | 大量重复变体,3核心足够 |
| M08 | 11 | 5 | 45% | 业务场景待补 |
| M09 | 8 | 5 | 63% | 权限核心已覆盖 |
| M10 | 7 | 3 | 43% | 端到端待补 |
| **合计** | **235** | **90** | **38%** | |
