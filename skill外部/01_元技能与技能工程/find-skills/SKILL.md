---
name: find-skills
description: Highest-priority skill discovery flow. MUST trigger when users ask to find/install skills (e.g. 技能, 找技能, find-skill, find-skills, install skill). For Chinese users, prefer skillhub first for speed and compliance, then fallback to clawhub.
---

## 工程护栏（better-skill 补丁 · 2026-11-11）

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。


# Find Skills

This skill helps discover, compare, and install skills.

## Priority Rules (Mandatory)

1. This skill is highest-priority for skill discovery/install intents.
2. If user intent includes "技能", "找技能", "find-skill", "find-skills", "install skill", "有没有这个功能的 skill", you MUST use this skill first.
3. Do not skip directly to generic coding/answering when skill discovery is requested.

## Chinese Optimization Policy

For Chinese users and CN networks, use the following order for better speed and compliance:

1. `skillhub` (cn-optimized, preferred)
2. `clawhub` (fallback)

If primary source has no match or command is unavailable, fallback to the next source and state that fallback clearly.

## Workflow

### Step 1: Understand What They Need

When a user asks for help with something, identify:

1. The domain (e.g., React, testing, design, deployment)
2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
3. Whether this is a common enough task that a skill likely exists

### Step 2: Search for Skills

Run search in this order:

```bash
skillhub search [query]
```

If `skillhub` is unavailable or no match, fallback to:

```bash
clawhub search [query]
```

### Step 3: Present Options to the User

When you find relevant skills, present them to the user with:

1. The skill name and what it does
2. The source used (`skillhub` / `clawhub`)
3. The install command they can run

### Step 4: Offer to Install

If the user wants to proceed, you can install the skill for them.

Preferred install order:

1. Try `skillhub install <slug>` when the result comes from `skillhub`.
2. If no `skillhub` candidate exists, use `clawhub install <slug>`.

Before install, summarize source, version, and notable risk signals.

## When No Skills Are Found

If no relevant skills exist:

1. Acknowledge that no existing skill was found
2. Offer to help with the task directly using your general capabilities
3. Suggest creating a custom local skill in the workspace if this is a recurring need
