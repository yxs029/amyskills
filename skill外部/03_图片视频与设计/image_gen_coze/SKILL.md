---
name: image_gen_coze
version: 1.1.3
description: |
  Image Generation via Coze | 基于 Coze 的图像生成技能
  Generate images using Coze workflows. 使用 Seedream 4.5 model.
  Handles parameter building and result parsing. 负责参数构建和结果解析。
  Requires coze-workflow skill. 需要 coze-workflow 技能。
homepage: https://www.coze.cn
dependencies: ["coze_workflow v1.1.1+"]
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


# Image Gen Coze | 图像生成技能

基于 Coze 工作流的图像生成技能。使用 Seedream 4.5 模型。**依赖**: `coze-workflow` 技能（基础层）。

Image generation skill based on Coze workflow. Uses Seedream 4.5 model. **Requires**: `coze-workflow` skill (base layer).

---

## 依赖关系 / Dependencies

**必需 / Required**：
- `coze-workflow` v1.1.1+ - Coze 工作流执行的基础技能 / Base skill for Coze workflow execution

**架构 / Architecture**：
- `coze-workflow`（基础层 / base）→ `image-gen-coze`（业务层 / business layer）

---

## 功能特性 / Features

| 特性 / Feature | 说明 / Description |
|---------------|-------------------|
| 模型 / Model | Seedream 4.5 |
| 输入 / Input | 单一 Prompt / Single prompt |
| 输出 / Output | 图片 URL / Image URL |
| 限制 / Limit | 30秒/次 / 30 seconds per request |

---

## 配置 / Configuration

`~/.openclaw/skills/image_gen_coze/config.json`：

```json
{
  "workflow_id": "7613773741864550434"
}
```

依赖技能配置 / Dependency config：`~/.openclaw/skills/coze_workflow/config.json`

---

## 使用方式 / Usage

### 输入 / Input

```json
{
  "prompt": "一只可爱的橘猫在窗台上晒太阳，温暖的光线，写实摄影风格 --ar 1:1"
}
```

### 完整调用流程 / Full Workflow

```bash
#!/bin/bash

# 1. 读取配置 / Read config
WORKFLOW_ID=$(jq -r '.workflow_id' ~/.openclaw/skills/image_gen_coze/config.json)
COZE_CONFIG=~/.openclaw/skills/coze_workflow/config.json
API_KEY=$(jq -r '.api_key' "$COZE_CONFIG")
BASE_URL=$(jq -r '.base_url // "https://api.coze.cn"' "$COZE_CONFIG")

# 2. 构建 prompt / Build prompt
PROMPT="一只可爱的橘猫在窗台上晒太阳，温暖的光线，写实摄影风格 --ar 1:1"

# 3. 调用 coze_workflow 执行 / Execute
result=$(curl -s -X POST "${BASE_URL}/v1/workflow/stream_run" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"workflow_id\": \"${WORKFLOW_ID}\",
    \"parameters\": {
      \"prompt\": \"${PROMPT}\"
    }
  }" | grep -E "^event: Message$" -A1 | tail -1)

# 4. 解析结果 / Parse result
data=$(echo "$result" | sed 's/^data: //')
content=$(echo "$data" | jq -r '.content')
image_url=$(echo "$content" | jq -r '.output // empty')

# 5. 下载并保存 / Download and save
if [ -n "$image_url" ]; then
  SAVE_DIR="./generated_images"
  mkdir -p "$SAVE_DIR"
  
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  PREFIX=$(echo "$PROMPT" | sed 's/[^a-zA-Z0-9\u4e00-\u9fa5]//g' | cut -c1-10)
  FILENAME="${TIMESTAMP}_${PREFIX}.png"
  FILEPATH="${SAVE_DIR}/${FILENAME}"
  
  curl -s -L "$image_url" -o "$FILEPATH"
fi
```

---

## 文件保存约定 / File Save Convention

### 保存路径 / Save Path

```
./generated_images/
```

**实际路径示例 / Example paths**:
- Agent A: `~/.openclaw/workspace-agentA/generated_images/`
- Agent B: `~/.openclaw/workspace-agentB/generated_images/`

### 命名规则 / Naming Rule

```
{时间戳 / Timestamp}_{prompt前缀 / Prefix}.png

示例 / Example：
20260305_233045_一只可爱的橘猫.png
```

| 参数 / Parameter | 说明 / Description | 示例 / Example |
|-----------------|-------------------|---------------|
| `TIMESTAMP` | 生成时间 / Generation time | 20260305_233045 |
| `PREFIX` | Prompt 前10字符 / First 10 chars | 一只可爱的橘猫 |

---

## 提示词写法 / Prompt Writing

### 尺寸 / Aspect Ratio

在 prompt 末尾添加 `--ar 比例`：

| 标签 / Tag | 尺寸 / Size |
|-----------|------------|
| `--ar 1:1` | 1024×1024 |
| `--ar 16:9` | 1024×576 |
| `--ar 9:16` | 576×1024 |

### 风格关键词 / Style Keywords

- `写实摄影风格` - 照片级真实 / Photorealistic
- `动漫风格` - 日式动漫 / Anime style
- `3D渲染` - 三维立体 / 3D render
- `赛博朋克` - 科幻霓虹 / Cyberpunk

---

## 速率限制 / Rate Limit

**30秒/次** - 建议实现调用间隔检查 / Implement call interval checking.

---

## 版本历史 / Changelog

- **v1.1.3**: 添加中英文对照 / Add bilingual support
- **v1.1.1**: 明确职责，负责参数构建和结果解析 / Clarify responsibilities
- **v1.1.0**: Seedream 4.5 模型 / Seedream 4.5 model
- **v1.0.0**: 初始版本 / Initial version
