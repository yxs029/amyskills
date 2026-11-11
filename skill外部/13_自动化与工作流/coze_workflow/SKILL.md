---
name: coze_workflow
version: 1.1.3
description: |
  Coze Workflow Executor | Coze 工作流执行技能
  Execute Coze workflows with workflow_id and parameters. 接收参数调用工作流，返回执行结果。
  Pure invocation layer with no business logic. 纯净的调用层，不处理业务逻辑。
  Base skill for all Coze workflow integrations. 所有 Coze 工作流集成的基础技能。
homepage: https://www.coze.cn
license: MIT
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。

### 触发时机（必修 P0-1）
当用户提出本技能覆盖的任务、或明确点名本技能时使用；同一意图的不同说法（改述）也应能触发。


# Coze Workflow | Coze 工作流执行技能

纯净的调用层技能。接收 `workflow_id` 和 `parameters`，执行工作流，返回结果。这是其他 Coze 工作流技能依赖的**基础技能**。

Pure invocation layer skill. Receives `workflow_id` and `parameters`, executes the workflow, and returns results. This is the **base skill** that other Coze workflow skills depend on.

---

## 依赖关系 / Dependencies

**本技能被以下技能依赖 / This skill is a dependency for**：
- `image-gen-coze` - 图像生成 / Image generation via Coze workflows
- 其他自定义 Coze 工作流技能 / Other custom Coze workflow skills

---

## 配置 / Configuration

`~/.openclaw/skills/coze_workflow/config.json`：

```json
{
  "api_key": "pat_xxx",
  "base_url": "https://api.coze.cn"
}
```

---

## 职责边界 / Responsibility Boundaries

| 职责 / Responsibility | coze_workflow | 业务技能 / Business Skill |
|----------------------|---------------|---------------------------|
| 执行工作流 / Execute workflow | ✅ | ❌ |
| 参数构建 / Parameter building | ❌ | ✅ |
| 结果解析 / Result parsing | ❌ | ✅ |

---

## 调用方式 / Usage

### 输入 / Input

```json
{
  "workflow_id": "string",
  "parameters": {}  // 任意 JSON / Any JSON
}
```

### 输出 / Output

返回 Coze API 的原始响应 / Returns Coze API raw response：

```json
{
  "execute_id": "string",
  "status": "Success|Fail|Running",
  "output": "string",  // 工作流输出（JSON字符串）/ Workflow output (JSON string)
  "debug_url": "string"
}
```

---

## 执行方法 / Execution Methods

### 方法 1：流式执行（推荐）/ Method 1: Stream (Recommended)

```bash
curl -X POST "${COZE_BASE_URL}/v1/workflow/stream_run" \
  -H "Authorization: Bearer ${COZE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "xxx",
    "parameters": {...}
  }'
```

**响应 / Response**：SSE 流，提取 `event: Message` 的 `data.content` 字段

### 方法 2：轮询查询 / Method 2: Polling

```bash
curl "${COZE_BASE_URL}/v1/workflows/{workflow_id}/run_histories/{execute_id}" \
  -H "Authorization: Bearer ${COZE_API_KEY}"
```

---

## 版本历史 / Changelog

- **v1.1.3**: 添加中英文对照 / Add bilingual support
- **v1.1.1**: 明确职责边界 / Clarify responsibility boundaries
- **v1.1.0**: 流式执行 + 轮询 / Stream + Polling
- **v1.0.0**: 初始版本 / Initial version
