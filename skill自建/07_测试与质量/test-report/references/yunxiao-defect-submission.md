# 云效缺陷自动提单参考

> 2026-07-07 实测验证通过。第1条缺陷已成功提交，工作项ID: feff5e5cd04219d9dda9ea8bec。
> 2026-07-08 更新：缺陷描述模板格式 + PUT更新方法 + 附件上传限制。

## API 关键信息（实测确认）

### 域名
```
https://openapi-rdc.aliyuncs.com
```
⚠️ **不是** `devops.cn-hangzhou.aliyuncs.com`（那个是旧版SDK域名，OpenAPI会返回404）。

### 认证
Header: `x-yunxiao-token: {个人访问令牌}`

### 凭证文件位置（老大已配置）
```
~/SRMPRO/文档库/03-R_数据层/yunxiao_id.md
```
格式：
```
yunxiao_token=pt-xxx
yunxiao_org_id=5f30dccc5fd102f22f6ba1c4
yunxiao_space_id=8fd106d2e9114df21947be9a14
```

### SRMPRO项目固定参数
| 参数 | 值 | 说明 |
|------|---|------|
| 组织ID | `5f30dccc5fd102f22f6ba1c4` | 中心版path参数 |
| 项目空间ID | `8fd106d2e9114df21947be9a14` | spaceId/spaceIdentifier |
| 缺陷类型ID | `37da3a07df4d08aef2e3b393` | categoryId=Bug |
| 袁雪松userId | `5f30dcae42509b3c32f367e8` | assignedTo |

---

## 缺陷描述模板格式（老大2026-07-08指定）

提交缺陷时，描述字段**必须**按以下模板格式填写：

```
前置：（什么条件下才会出现缺陷？）
[描述触发缺陷的前置条件：系统、页面、登录状态、数据状态等]

问题链接：[被测系统URL]
用户账号：[测试时使用的账号，如 admin / Esic@2024]
供应商账号：[如涉及供应商账号则填，没有就写"无"]

步骤：（回想一下缺陷产生的操作步骤）
1. [步骤1]
2. [步骤2]
...
-
问题：（具体问题描述，可以放在步骤中，例如：点击xxx按钮，出现问题为xxx）
[N. [步骤动作] → [实际结果，标注异常]]
-
期望：（正常功能是什么样的？）
1. [期望行为1]
2. [期望行为2]
...
定位：（推断出问题的原因是什么？）
[根因推断，分点列出可能的原因链路]
```

### 模板要点
- **前置**：什么条件下才会出现缺陷（系统状态+页面+数据状态）
- **用户账号**：测试时用哪个账号操作的
- **供应商账号**：没有就不填，写"无"
- **步骤**：回想缺陷产生的操作步骤，每步含动作+结果
- **问题**：具体问题描述，可以放在步骤中（如"点击xxx按钮，出现问题为xxx"）
- **期望**：正常功能是什么样的
- **定位**：推断出问题的原因
- **截图**：配上错误截图（通过飞书发送或网页端手动上传，API暂不支持）

### 实际示例（E2E-001）
```
前置：（什么条件下才会出现缺陷？）
SRMPRO文档库模块，已登录admin账号后访问文档库页面（https://test.esicint.com/SupplierManagement/newDocument），页面统计卡片正常显示数据...

问题链接：https://test.esicint.com/SupplierManagement/newDocument
用户账号：admin / Esic@2024
供应商账号：无

步骤：（回想一下缺陷产生的操作步骤）
1. 以admin账号登录后访问文档库页面
2. 读取4张统计卡片，数据正常显示...
6. 点击分段器"即将过期"，叠加过滤
-
问题：（具体问题描述，可以放在步骤中）
7. 验证叠加过滤后行数：ISO搜索结果5行 + "即将过期"叠加过滤后 → 行数变为0...
10. 点击第一行文档类型节点 → click=None，弹窗未弹出（modal=False）
-
期望：（正常功能是什么样的？）
1. 叠加过滤结果为0行时，点击"展开全部"应能正常展开所有文档类型节点...
2. 点击任意文档类型节点，应弹出详情弹窗...

定位：（推断出问题的原因是什么？）
根因推断：当叠加过滤条件导致结果集为空时，前端组件状态进入异常分支...
```

---

## API 调用顺序（4步）

### 步骤1：获取工作项类型列表 → 找缺陷类型ID

```python
GET /oapi/v1/projex/organizations/{orgId}/workitemTypes?spaceId={spaceId}
Header: x-yunxiao-token: {token}
```

返回JSON数组，找 `name="缺陷"` 且 `categoryId="Bug"` 的条目，取 `id`。

SRMPRO项目中已有类型：
- `37da3a07df4d08aef2e3b393` — 缺陷 (Bug)
- `bba77181ef64f834248a0175` — 线上故障 (Bug)
- `bca48ee2a0976d38f4802fae` — 技术类需求 (Req)

### 步骤2：获取缺陷类型字段配置 → 找必填字段ID和选项值

```python
GET /oapi/v1/projex/organizations/{orgId}/projects/{projectId}/workitemTypes/{typeId}/fields
Header: x-yunxiao-token: {token}
```

⚠️ **路径关键**：中间有 `/projects/{projectId}/` 段，不是 `/workitemTypes/{typeId}/fieldConfig`（那个返回404）。

返回JSON数组，每个字段含：`id`, `name`, `format`, `type`, `required`, `options[]`

### 步骤3：获取项目成员 → 找指派人userId

```python
GET /oapi/v1/projex/organizations/{orgId}/projects/{projectId}/members
Header: x-yunxiao-token: {token}
```

返回成员数组，每个含：`userId`, `userName`, `roleName`

### 步骤4：创建缺陷工作项

```python
POST /oapi/v1/projex/organizations/{orgId}/workitems
Header: x-yunxiao-token: {token}
Content-Type: application/json
```

### 步骤5（新增）：更新已有缺陷 — 用PUT

提交后发现需要修改描述/问题原因时，用 **PUT**：

```python
PUT /oapi/v1/projex/organizations/{orgId}/workitems/{workitemId}
Header: x-yunxiao-token: {token}
Content-Type: application/json
Body: {
    "description": "新描述内容（纯文本）",
    "subject": "新标题（可选）",
    "564b87a47ec3cc38200eb22606": "问题原因字段（可选）"
}
# 返回 HTTP 204（无Body）= 成功
```

⚠️ **PATCH返回404**，必须用PUT。description会被自动存为RICHTEXT格式（含htmlValue + jsonMLValue）。

### 步骤6（可选）：查询工作项详情 — 验证更新

```python
GET /oapi/v1/projex/organizations/{orgId}/workitems/{workitemId}
# 返回完整工作项JSON，含description/subject/status/assignedTo/customFields等
```

---

## 缺陷8个必填字段（实测，SRMPRO项目）

| # | 字段名 | fieldId | 类型 | 来源 |
|---|--------|---------|------|------|
| 1 | 标题 | `subject` | NativeField | 从报告提取 |
| 2 | 负责人 | `assignedTo` | NativeField (user) | 项目成员userId |
| 3 | 功能分类（单选） | `11a84d02dfe22457200ccee776` | CustomField (list) | 选项值 |
| 4 | 严重程度 | `seriousLevel` | SystemCustomField (list) | 选项ID |
| 5 | 优先级 | `priority` | SystemCustomField (list) | 选项ID |
| 6 | 问题类型 | `0886f9621f999f923838979136` | CustomField (list) | 选项值 |
| 7 | 发布环境 | `dcc3ef7a2b06518658e170bc10` | CustomField (list) | 选项值 |
| 8 | 问题原因 | `564b87a47ec3cc38200eb22606` | CustomField (text) | 自由文本 |

### 严重程度选项（seriousLevel）

| 报告等级 | 云效显示值 | 选项ID |
|---------|----------|--------|
| P0 | 1-致命 | `5f4d4efe6250247696204dc6dd` |
| P0 | 2-严重 | `39d1172d0a91194bdd785fa88b` |
| P1 | 3-一般 | `8dcb72afefd944c445e1a7ee8f` |
| P2/INFO | 4-轻微 | `5452c36be91ff150751335b6b6` |

### 优先级选项（priority）

| 报告等级 | 云效显示值 | 选项ID |
|---------|----------|--------|
| P0 | 紧急 | `c44dc2d43d2106e892d98cee47` |
| P0 | 高 | `d215fd28f4ccf4e4ada063e92e` |
| P1 | 中 | `ea2dde53407a08c5815ab78748` |
| P2/INFO | 低 | `0a73c6a9f04d34dd2d90f91926` |

### 功能分类选项（11a84d02...）

选项值即选项ID（value=id）：
- 供应商模块 ← **SRMPRO缺陷默认用这个**
- 合同管理、分级模块、认证模块、物料模块、系统管理、通用功能、订单、财务协同、供应商能力矩阵、AVPL、BI、BOM模块、PPV模块、移动端

### 问题类型选项（0886f962...）

选项值即选项ID：
- 需求缺陷（设计或逻辑问题）
- 功能错误（报错不符合设计）← **默认用这个**
- UI/UX问题（WEB兼容性）
- 对接问题（三方接口对接）
- 配置或部署问题
- 非问题（提错单）
- 暂不处理问题
- 其他

### 发布环境选项（dcc3ef7a...）

选项值即选项ID：
- 内测环境 ← **SRMPRO测试默认用这个**
- UAT环境、生产环境、演示环境

### 其他可用字段（非必填）

| 字段名 | fieldId | 类型 | 说明 |
|--------|---------|------|------|
| 浏览器 | `f61cd6da8aa8cdd545e805cf05` | CustomField | 测试浏览器 |
| 出现频率 | `b485e8fa1492ad82c23efc352f` | CustomField | 必现/偶发等 |
| 附件 | `5980caa5afecbffd665b251839` | CustomField | 截图/日志附件 |
| 触发者 | `627c1a7be94b9e52a5666337b1` | CustomField | |
| 验证者 | `verifier` | Role | |
| 迭代 | `sprint` | Application | |

---

## 创建缺陷请求体（完整示例）

```python
body = {
    "subject": "[E2E-001] 文档库核心浏览流程Happy Path关键步骤未通过",
    "description": "前置：（什么条件下才会出现缺陷？）\nSRMPRO文档库模块...\n问题链接：https://test.esicint.com/SupplierManagement/newDocument\n用户账号：admin / Esic@2024\n供应商账号：无\n\n步骤：\n1. 以admin账号登录后访问文档库页面\n...",
    "formatType": "MARKDOWN",
    "spaceId": "8fd106d2e9114df21947be9a14",
    "spaceIdentifier": "8fd106d2e9114df21947be9a14",
    "spaceType": "Project",
    "workitemTypeId": "37da3a07df4d08aef2e3b393",
    "assignedTo": "5f30dcae42509b3c32f367e8",
    "customFieldValues": {
        "11a84d02dfe22457200ccee776": "供应商模块",
        "seriousLevel": "5f4d4efe6250247696204dc6dd",
        "priority": "c44dc2d43d2106e892d98cee47",
        "0886f9621f999f923838979136": "功能错误（报错不符合设计）",
        "dcc3ef7a2b06518658e170bc10": "内测环境",
        "564b87a47ec3cc38200eb22606": "前端对空结果集边界条件处理不完善"
    }
}
```

### 返回
```json
{"id": "feff5e5cd04219d9dda9ea8bec"}
```

查看链接：`https://devops.aliyun.com/organization/{orgId}/projex/project/{spaceId}`

---

## 严重程度→优先级映射策略

| 报告等级 | 严重程度 | 优先级 | 问题类型 |
|---------|---------|--------|---------|
| P0 | 1-致命 | 紧急 | 功能错误 |
| P0 | 2-严重 | 高 | 功能错误 |
| P1 | 3-一般 | 中 | 功能错误 |
| P2 | 4-轻微 | 低 | 功能错误 |
| INFO | 4-轻微 | 低 | 其他 |

---

## 批量提交脚本

已有脚本：`~/SRMPRO/文档库/05-S_交付层/缺陷提单/submit_defects_to_yunxiao.py`

缺陷数据：`~/SRMPRO/文档库/05-S_交付层/缺陷提单/defects_for_yunxiao.json`（12条结构化缺陷）

### 批量提交流程
```python
import requests, json, time

# 1. 读凭证
token = read_file("~/SRMPRO/文档库/03-R_数据层/yunxiao_id.md")  # 解析 yunxiao_token=
# 2. 逐条提交
for defect in defects:
    body = map_defect_to_body(defect)
    resp = requests.post(url, headers=headers, json=body)
    time.sleep(1)  # 避免频率限制
# 3. 汇总结果
```

---

## 踩过的坑

### 1. 域名错误
- ❌ `https://devops.cn-hangzhou.aliyuncs.com` → 404 InvalidAction.NotFound
- ✅ `https://openapi-rdc.aliyuncs.com` → 200

### 2. 字段配置API路径错误
- ❌ `/oapi/v1/projex/organizations/{orgId}/workitemTypes/{typeId}/fieldConfig` → 404
- ❌ `/oapi/v1/projex/organizations/{orgId}/workitems/fields/listAll` → 404
- ✅ `/oapi/v1/projex/organizations/{orgId}/projects/{projectId}/workitemTypes/{typeId}/fields` → 200

关键：路径中间有 `/projects/{projectId}/` 段。

### 3. assignedTo不是邮箱
- ❌ `"assignedTo": "yxs029@139.com"` → 400 Invalid.UserAccountId
- ✅ `"assignedTo": "5f30dcae42509b3c32f367e8"` → 200（需要先调项目成员API获取userId）

### 4. 缺少必填自定义字段
第一次提交只填了5个基础字段，返回400：
```
字段【功能分类（单选）】不能为空
```
SRMPRO项目配了7个必填自定义字段，必须全部填。调字段配置API时看 `required: true` 的字段。

### 5. 自定义字段值格式
- `seriousLevel` 和 `priority`：值是**选项ID**（如 `5f4d4efe6250247696204dc6dd`）
- `功能分类`/`问题类型`/`发布环境`：值是**选项值本身**（如 `"供应商模块"`），因为这些字段的 value=id

### 6. 更新工作项用PUT不是PATCH（2026-07-08实测）
- ❌ `PATCH /oapi/v1/projex/organizations/{orgId}/workitems/{id}` → 404 NotFound
- ✅ `PUT /oapi/v1/projex/organizations/{orgId}/workitems/{id}` → 204（成功）
- description字段会被自动转为RICHTEXT格式存储（含htmlValue + jsonMLValue）
- 问题原因字段（`564b87a47ec3cc38200eb22606`）也可通过同一PUT请求更新

### 7. 附件上传API不可用（2026-07-08实测）
云效附件上传需要3步流程：GetWorkitemAttachmentCreatemeta → 上传OSS → WorkitemAttachmentCreate。
- ❌ 新版路径 `/oapi/v1/projex/organizations/{orgId}/workitems/{id}/attachmentCreateMeta` → 404
- ❌ 新版路径 `/oapi/v1/projex/organizations/{orgId}/workitem/{id}/attachmentCreateMeta` → 404
- ❌ 旧版路径 `/organization/{orgId}/workitem/{id}/attachmentCreateMeta` → 返回HTML页面（非JSON）
- ❌ 直接POST文件到 `/organization/{orgId}/workitem/{id}/attachment` → 返回HTML页面
- ❌ 多域名尝试：`devops.cn-hangzhou.aliyuncs.com` / `devops.aliyuncs.com` 均不可用

→ **结论**：目前无法通过OpenAPI自动上传截图附件。替代方案：
  1. 通过飞书发送截图给老大
  2. 在云效网页端手动上传
  3. 在描述中注明截图文件路径（如 `截图: 测试截图/E2E-001_step11_弹窗打开.png`）
