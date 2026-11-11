---
name: yunxiao-defect-submit
description: 云效(Yunxiao)缺陷自动提单 — 从测试报告提取缺陷数据，按老大指定的模板格式提交到阿里云云效项目。标题格式「AI提单-{主模块}-{子模块}：{用例标题}，{操作结果}」，描述含8段模板（前置/问题链接/用户账号/供应商账号/步骤/问题/期望/定位），截图base64内嵌描述。当用户说"提交缺陷到云效"、"提单到云效"、"批量提单"、"更新云效缺陷"、"用提单格式"时触发。
version: 1.1
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。


# 云效缺陷自动提单（yunxiao-defect-submit）

从测试报告提取缺陷 → 按老大指定模板格式 → 提交到云效项目。

## 何时触发

- ✅ 将测试发现的缺陷提交到云效项目
- ✅ 批量提单（从测试报告HTML提取所有缺陷）
- ✅ 更新已有云效缺陷的描述/标题/字段
- ✅ 用户问"怎么提单"、"提单格式是什么"

## 核心规范（老大2026-07-08指定）

### 标题格式

```
AI提单-{主模块}-{子模块}：{测试用例标题}，{操作结果}
```

**示例**：
```
AI提单-文档库-E2E端到端：核心浏览流程Happy Path，弹窗未弹出且展开全部失效
AI提单-文档库-筛选区：重置按钮功能，搜索框值未清空
AI提单-文档库-数据权限控制：供应商文档列表越权访问，普通用户可查看其他供应商文档
```

**规则**：
- `AI提单-` 前缀**必须**有，标识AI自动提交
- `{主模块}` = 被测系统的大模块名（如"文档库"）
- `{子模块}` = 测试子模块名（如"E2E端到端"、"筛选区"）
- `{测试用例标题}` = 测试用例的名称
- `{操作结果}` = 失败的核心现象（一句话概括）

### 描述模板格式（8段）

描述字段**必须**按以下模板填写，用HTML格式（支持base64图片内嵌）：

```
前置：（什么条件下才会出现缺陷？）
[系统状态 + 页面 + 登录状态 + 数据状态等前置条件]

问题链接：[被测系统URL]
用户账号：[测试时使用的账号，如 admin / Esic@2024]
供应商账号：[如涉及供应商账号则填，没有写"无"]

步骤：（回想一下缺陷产生的操作步骤）
1. [步骤1动作] → [步骤1结果]
2. [步骤2动作] → [步骤2结果]
...
-
问题：（具体问题描述，可以放在步骤中）
N. [步骤动作] → [实际结果，标注异常]
[📷 在关键错误步骤后嵌入base64截图]
-
期望：（正常功能是什么样的？）
1. [期望行为1]
2. [期望行为2]
...
定位：（推断出问题的原因是什么？）
[根因推断，分点列出可能的原因链路]
```

**模板要点**：
- **前置**：什么条件下才会出现缺陷（系统状态+页面+数据状态）
- **用户账号**：测试时用哪个账号操作的
- **供应商账号**：没有就写"无"
- **步骤**：回想缺陷产生的操作步骤，每步含动作+结果（用 → 分隔）
- **问题**：具体问题描述，可放在步骤中（如"点击xxx按钮，出现问题为xxx"）
- **期望**：正常功能是什么样的
- **定位**：推断出问题的原因
- **截图**：配上错误截图（base64内嵌到描述HTML中）

### 截图嵌入方法（2026-07-08验证通过）

截图通过base64直接嵌入描述HTML中，云效网页端打开缺陷即可看到图片：

```python
import base64

screenshot_path = "测试截图/E2E-001_step11_弹窗打开.png"
with open(screenshot_path, 'rb') as f:
    b64 = base64.b64encode(f.read()).decode()

# 嵌入到描述HTML中（⚠️ 注意：属性值必须用双引号）
img_html = f'<p><img src="data:image/png;base64,{b64}" style="max-width:100%;border:1px solid #ddd;border-radius:4px"/></p>'
```

**关键点**：
- 描述字段用HTML格式（`<article>` + `<p>` + `<img>` 标签）
- PUT请求会自动将description存为RICHTEXT格式
- 每张截图约75KB → base64约100KB，3张约300KB，云效可正常存储
- 截图放在对应步骤后面，不要全部堆在最后

### 描述HTML格式规范（2026-07-08血泪教训）

云效 RICHTEXT 渲染引擎对 HTML 格式有严格要求，以下3条规则**必须同时满足**，否则网页端会显示原始 HTML 标签而非渲染后的富文本：

| # | 规则 | ✅ 正确 | ❌ 错误 | 后果 |
|---|------|--------|--------|------|
| 1 | **属性值用双引号** | `class="4ever-article"` | `class='4ever-article'` | 渲染引擎不识别单引号属性，整个标签当文本显示 |
| 2 | **HTML紧凑无换行** | `<article><p>内容</p><p>内容2</p></article>` | `<article>\n<p>内容</p>\n</article>` | 换行符破坏RICHTEXT解析 |
| 3 | **用`<hr>`分隔各段** | `...</p><hr><p><strong>步骤</strong>...` | `...</p>\n<p>步骤...` | 无分隔时段落结构不清晰，渲染异常 |

**标准HTML模板**（直接复制使用，用Python f-string填充）：

```python
html = (
    '<article class="4ever-article">'
    f'<p><strong>前置：</strong>{precondition}</p>'
    f'<p>问题链接：{system_url}</p>'
    f'<p>用户账号：{user_account}</p>'
    f'<p>供应商账号：{supplier_account}</p>'
    '<hr>'
    f'<p><strong>步骤：</strong></p>'
    f'{steps_html}'
    '<hr>'
    f'<p><strong>问题：</strong></p>'
    f'{problem_html}'
    '<hr>'
    f'<p><strong>期望：</strong></p>'
    f'{expected_html}'
    '<hr>'
    f'<p><strong>定位：</strong></p>'
    f'<p>{root_cause}</p>'
    '</article>'
)
```

⚠️ **Python字符串拼接时**：
- 用单引号 `'...'` 包裹HTML字符串，这样HTML内的双引号不需要转义
- 不要用三引号 `"""..."""`，会引入换行符
- 不要用 `f"""..."""`，换行符 + 单引号混用会触发渲染失败

## API调用流程

### 前置准备

读取凭证文件 `~/SRMPRO/文档库/03-R_数据层/yunxiao_id.md`：

```
yunxiao_token=pt-xxx
yunxiao_org_id=5f30dccc5fd102f22f6ba1c4
yunxiao_space_id=8fd106d2e9114df21947be9a14
```

### SRMPRO项目固定参数

| 参数 | 值 |
|------|---|
| 域名 | `https://openapi-rdc.aliyuncs.com` |
| 组织ID | `5f30dccc5fd102f22f6ba1c4` |
| 项目空间ID | `8fd106d2e9114df21947be9a14` |
| 缺陷类型ID | `37da3a07df4d08aef2e3b393` |
| 袁雪松userId | `5f30dcae42509b3c32f367e8` |

### 4步调用顺序

```
步骤1: ListWorkitemTypes     → 确认缺陷类型ID
步骤2: GetWorkitemTypeFieldConfig → 获取字段配置（⚠️路径含/projects/{projectId}/）
步骤3: ListProjectMembers    → 获取指派人userId
步骤4: CreateWorkitem         → 创建缺陷
```

### API路径（实测确认）

```
# 列出工作项类型
GET /oapi/v1/projex/organizations/{orgId}/workitemTypes?spaceId={spaceId}

# 获取字段配置（⚠️路径含 /projects/{projectId}/ 中间段）
GET /oapi/v1/projex/organizations/{orgId}/projects/{projectId}/workitemTypes/{typeId}/fields

# 获取项目成员
GET /oapi/v1/projex/organizations/{orgId}/projects/{projectId}/members

# 创建缺陷
POST /oapi/v1/projex/organizations/{orgId}/workitems

# 更新缺陷（⚠️用PUT，不是PATCH）
PUT /oapi/v1/projex/organizations/{orgId}/workitems/{workitemId}

# 查询缺陷详情（验证用）
GET /oapi/v1/projex/organizations/{orgId}/workitems/{workitemId}
```

所有请求Header: `x-yunxiao-token: {token}` + `Content-Type: application/json`

## 8个必填字段

| # | 字段名 | fieldId | 类型 | 值格式 |
|---|--------|---------|------|--------|
| 1 | 标题 | `subject` | NativeField | 文本（AI提单-...格式） |
| 2 | 负责人 | `assignedTo` | NativeField | userId |
| 3 | 功能分类 | `11a84d02dfe22457200ccee776` | CustomField(list) | 选项值文本 |
| 4 | 严重程度 | `seriousLevel` | SystemCustomField | 选项ID |
| 5 | 优先级 | `priority` | SystemCustomField | 选项ID |
| 6 | 问题类型 | `0886f9621f999f923838979136` | CustomField(list) | 选项值文本 |
| 7 | 发布环境 | `dcc3ef7a2b06518658e170bc10` | CustomField(list) | 选项值文本 |
| 8 | 问题原因 | `564b87a47ec3cc38200eb22606` | CustomField(text) | 自由文本 |

### P0/P1/P2 → 严重程度+优先级映射

| 报告等级 | 严重程度 | 严重程度ID | 优先级 | 优先级ID |
|---------|---------|-----------|--------|---------|
| P0 | 1-致命 | `5f4d4efe6250247696204dc6dd` | 紧急 | `c44dc2d43d2106e892d98cee47` |
| P0 | 2-严重 | `39d1172d0a91194bdd785fa88b` | 高 | `d215fd28f4ccf4e4ada063e92e` |
| P1 | 3-一般 | `8dcb72afefd944c445e1a7ee8f` | 中 | `ea2dde53407a08c5815ab78748` |
| P2/INFO | 4-轻微 | `5452c36be91ff150751335b6b6` | 低 | `0a73c6a9f04d34dd2d90f91926` |

### 默认选项值

| 字段 | 默认值 | 备注 |
|------|--------|------|
| 功能分类 | `供应商模块` | SRMPRO默认 |
| 问题类型 | `功能错误（报错不符合设计）` | 可选值见下表 |
| 发布环境 | `内测环境` | 测试环境默认 |

### 问题类型可选值（2026-07-08实测确认）

| 值 | 适用场景 |
|----|---------|
| `需求缺陷（设计或逻辑问题）` | 需求本身有问题 |
| `功能错误（报错不符合设计）` | 功能不符合设计（默认） |
| `UI/UX问题（WEB兼容性）` | 界面/交互/兼容性问题 |
| `对接问题（三方接口对接）` | 第三方接口对接问题 |
| `配置或部署问题` | 环境配置/部署问题 |
| `非问题（提错单）` | 非缺陷（如测试跳过、需人工验证） |
| `暂不处理问题` | 暂不处理 |
| `其他` | 其他 |

⚠️ 值必须**完全匹配**上表文本，否则返回400 `字段【问题类型】所填值无效`。之前用 `UI/UX问题`（缺后缀）和 `权限问题`（不在列表中）导致4条缺陷提交失败。

## 创建缺陷请求体

```python
body = {
    "subject": "AI提单-文档库-E2E端到端：核心浏览流程Happy Path，弹窗未弹出且展开全部失效",
    "description": "<article class=\"4ever-article\"><p><strong>前置：</strong>...</p><hr><p><strong>步骤：</strong></p><p>1. ... → ...</p><p><img src=\"data:image/png;base64,...\" style=\"max-width:100%;border:1px solid #ddd;border-radius:4px\"/></p><hr><p><strong>问题：</strong>...</p><hr><p><strong>期望：</strong>...</p><hr><p><strong>定位：</strong>...</p></article>",
    "formatType": "RICHTEXT",  # ⚠️ 必须用RICHTEXT！MARKDOWN会把HTML标签当纯文本显示
    "spaceId": "8fd106d2e9114df21947be9a14",
    "spaceIdentifier": "8fd106d2e9114df21947be9a14",
    "spaceType": "Project",
    "workitemTypeId": "37da3a07df4d08aef2e3b393",
    "assignedTo": "5f30dcae42509b3c32f367e8",
    "customFieldValues": {
        "11a84d02dfe22457200ccee776": "供应商模块",
        "seriousLevel": "5f4d4efe6250247696204dc6dd",  # P0=1-致命
        "priority": "c44dc2d43d2106e892d98cee47",       # P0=紧急
        "0886f9621f999f923838979136": "功能错误（报错不符合设计）",
        "dcc3ef7a2b06518658e170bc10": "内测环境",
        "564b87a47ec3cc38200eb22606": "前端对空结果集边界条件处理不完善"
    }
}

resp = requests.post(url, headers=headers, json=body)
# 返回 {"id": "工作项ID"}
```

## 更新已有缺陷（PUT方法）

```python
update_body = {
    "subject": "AI提单-文档库-E2E端到端：新标题",  # 可选
    "description": "新描述HTML",                    # 可选
    "564b87a47ec3cc38200eb22606": "新的问题原因"     # 可选
}

resp = requests.put(f"{url}/{workitemId}", headers=headers, json=update_body)
# 返回 HTTP 204 = 成功
```

⚠️ **PATCH返回404**，必须用PUT。

## 提交策略

**先提交1条验证** → 用户在云效确认无误 → 批量提交剩余缺陷。

```
1. 从测试报告提取所有缺陷 → defects.json
2. 提交第1条 → 用户到云效确认格式
3. 用户确认后 → 批量提交剩余
4. 每条间隔1秒（避免频率限制）
```

## 已有资产

**scripts/**（skill内可复用脚本）
- `scripts/build_defect_html.py` — 8段描述HTML生成器（`from build_defect_html import build_defect_html`）
- `scripts/submit_defect.py` — 单条/批量提单脚本（支持dry-run）
- `scripts/verify_defects.py` — **批量验证脚本，提单后必跑**：`python3 scripts/verify_defects.py`

**references/**
- `references/defect-template-example.md` — 完整JSON示例+字段说明
- `references/2026-07-08-richtext-incident-postmortem.md` — 渲染事故复盘（双引号/换行/hr的根因时间线）

**外部资产**（项目工作区）
- 提单脚本: `~/SRMPRO/文档库/05-S_交付层/缺陷提单/submit_defects_to_yunxiao.py`
- 缺陷数据: `~/SRMPRO/文档库/05-S_交付层/缺陷提单/defects_for_yunxiao.json`

## 踩过的坑

### 1. 域名错误
- ❌ `devops.cn-hangzhou.aliyuncs.com` → 404
- ✅ `openapi-rdc.aliyuncs.com` → 200

### 2. 字段配置API路径
- ❌ `/oapi/v1/projex/organizations/{orgId}/workitemTypes/{typeId}/fieldConfig` → 404
- ✅ `/oapi/v1/projex/organizations/{orgId}/projects/{projectId}/workitemTypes/{typeId}/fields` → 200

关键：路径中间**必须**有 `/projects/{projectId}/` 段。

### 3. assignedTo用userId不用邮箱
- ❌ `"assignedTo": "yxs029@139.com"` → 400
- ✅ `"assignedTo": "5f30dcae42509b3c32f367e8"` → 200

### 4. 7个必填自定义字段
SRMPRO项目配了7个必填自定义字段，缺任何一个返回400。调字段配置API时看 `required: true`。

### 5. 字段值格式差异
- `seriousLevel`/`priority`：值是**选项ID**（如 `5f4d4efe6250247696204dc6dd`）
- `功能分类`/`问题类型`/`发布环境`：值是**选项值文本本身**（如 `"供应商模块"`）

### 6. 更新用PUT不是PATCH
- ❌ `PATCH` → 404
- ✅ `PUT` → 204

### 7. 附件上传API不可用
3步流程的新版OpenAPI路径全部404。→ 截图用base64内嵌描述HTML中，不需要附件API。

### 8. 描述HTML必须用双引号+紧凑+hr分隔（最高优先级！）
2026-07-08重大事故：12条缺陷全部在云效网页端显示原始HTML标签（`<article><p>`），老大看到的不是富文本而是代码。

**根因3条**（必须同时满足，缺一不可）：
1. HTML属性值必须用**双引号**：`class="4ever-article"` ❌不能用单引号 `class='...'`
2. HTML必须**紧凑无换行**：`<article><p>...</p></article>` ❌不能有`\n`
3. 各段之间必须用**`<hr>`分隔**：`</p><hr><p><strong>步骤` ❌不能直接接

**验证方法**：PUT更新后，GET读取该缺陷，检查description前100字符：
```python
assert "'" not in desc[:100]     # 无单引号
assert "\n" not in desc[:300]    # 无换行符
assert "<hr>" in desc             # 有hr分隔
assert desc.startswith('<article class="4ever-article">')  # 双引号开头
```

### 9. formatType必须用RICHTEXT不能MARKDOWN
- ❌ `"formatType": "MARKDOWN"` → 云效把HTML标签当纯文本显示，网页上看到的是 `<article><p>` 原文
- ✅ `"formatType": "RICHTEXT"` → 云效正常渲染HTML，网页上看到富文本格式
- CreateWorkitem时就要传RICHTEXT，不要先传MARKDOWN再PUT改
- 2026-07-08：12条缺陷全部因MARKDOWN格式导致显示异常，已批量PUT修复为RICHTEXT

### 10. 只改formatType不够，必须重新生成HTML内容
- ❌ GET读取原始description → 原样PUT回去 + 只改formatType → 仍然渲染失败
- ✅ 重新生成双引号+紧凑+hr格式的HTML → PUT新内容 + formatType=RICHTEXT → 渲染成功
- 原因：MARKDOWN模式下存储的description可能含有单引号/换行，只改formatType不改变内容格式

## 提单后Checklist（每次批量提单后必须逐条核对）

⚠️ **以下checklist为强制执行项，每完成一批提单后必须全部核对完毕才能交付。**

### A. 提交阶段核对（CreateWorkitem后）

| # | 核对项 | 方法 | 通过标准 |
|---|--------|------|---------|
| A1 | 每条都返回了workitem ID | 检查API返回的`id`字段 | 成功条数 = 计划条数 |
| A2 | 标题格式正确 | 检查subject字段 | 以`AI提单-`开头，含`：`和`，` |
| A3 | 问题类型值合法 | 检查无400错误 | 0条返回`字段【问题类型】所填值无效` |
| A4 | 7个必填字段全部填写 | 检查无400错误 | 0条返回必填字段缺失 |

### B. 格式核对（PUT更新description后，每条GET验证）

| # | 核对项 | 验证代码 | 通过标准 |
|---|--------|---------|---------|
| B1 | formatType = RICHTEXT | `data.get("formatType") == "RICHTEXT"` | 全部为RICHTEXT |
| B2 | description以双引号article开头 | `desc.startswith('<article class="4ever-article">')` | 无单引号开头 |
| B3 | description无单引号 | `"'" not in desc[:200]` | 前200字符无单引号 |
| B4 | description无换行符 | `"\n" not in desc[:500]` | 前500字符无换行 |
| B5 | description有hr分隔 | `"<hr>" in desc` | 至少3个hr |
| B6 | description有img标签（仅适用有截图的缺陷） | `"<img" in desc` | 有截图的缺陷都含img，无截图的缺陷不检 |
| B7 | description有8段关键词 | 检查含`前置`/`问题链接`/`用户账号`/`供应商账号`/`步骤`/`问题`/`期望`/`定位` | 8个关键词全部存在 |

### C. 自动验证脚本（批量核对用）

直接运行skill内的可执行脚本：

```bash
python3 ~/.hermes/skills/qa/yunxiao-defect-submit/scripts/verify_defects.py
```

- 默认验证12条SRMPRO文档库测试缺陷
- 支持自定义参数：`python3 verify_defects.py E2E-001:feff5e5c... PERM-001:08e6ab4c...`
- 返回码：0=全部通过，1=有失败项

### D. 交付前最终确认

| # | 确认项 | 行动 |
|---|--------|------|
| D1 | 运行verify_defects.py脚本 | 全部✅才能继续 |
| D2 | 通知老大去云效查看 | 发送缺陷列表+链接 |
| D3 | 等老大确认显示正常 | 老大说OK才算完成 |