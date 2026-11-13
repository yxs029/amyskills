---
name: volc-voice-mcp
description: "火山方舟 Agent Plan 语音 MCP 工具包: 豆包语音合成2.0(volc_tts) + 豆包流式语音识别2.0(volc_asr) 的 FastMCP stdio server, 一键接入 Hermes/任何 MCP 客户端。含鉴权三件套(X-Api-Key+Resource-Id)、websocket 二进制帧协议客户端、ffmpeg 16kHz 自动降采样、TTS造音频测ASR闭环测试脚本。触发词: 火山语音/豆包语音/语音合成/语音识别/TTS接入hermes/ASR接入hermes/MCP语音工具/volc_tts/volc_asr/openspeech/seed-tts-2.0/volc.seedasr"
version: 1.0.0
author: 测测 (CeCe) for 袁雪松
license: MIT
---

# volc-voice-mcp · 火山方舟语音 MCP 工具包

> 2026-11-13 实战沉淀: 零官方文档冷启动打通, TTS 出 32KB 合法 mp3, ASR 闭环转写逐字 PASS。

## 这是什么

1. 【双工具 MCP server】`scripts/server.py` = FastMCP stdio server, 暴露 volc_tts(合成) + volc_asr(识别), 已实测接入 Hermes(config mcp_servers 注册, hermes mcp test 628ms/2工具)
2. 【闭环测试】`scripts/test_volc_voice.py` = TTS 造音频喂 ASR 的端到端验证(无麦克风环境), 自动判定 PASS/FAIL
3. 【协议笔记】`references/voice-api-notes.md` = 鉴权三件套/websocket 帧格式/错误码阶梯/计费口径

## 快速开始(3 步)

```bash
# 0. 依赖: litellm venv 或任意带 mcp+websockets 的 python (系统 python3 + pip install mcp websockets 亦可)
# 1. key: ~/.hermes/.env 里放 WEB_SEARCH_API_KEY=ark-xxxx (Agent Plan 的 API Key)
# 2. 注册(交互确认喂 Y):
printf 'Y\n' | hermes mcp add volc-voice --command <venv-python> --args /path/to/server.py
# 3. 验证:
hermes mcp list && hermes mcp test volc-voice
```

## 鉴权速查(最重要的坑)

1. 语音接口走 `X-Api-Key: <ark_key>` 头, **不是 Bearer**(Bearer 会得到 400 get resource id empty)
2. Resource-Id 必须放请求头: TTS=`seed-tts-2.0`, ASR=`volc.seedasr.sauc.duration`(放 body 不认)
3. ASR 音频硬性要求 16kHz/16bit/单声道 pcm_s16le(server 自动 ffmpeg 转换, 裸 pcm 流 ffmpeg 输出须 `-f s16le`)

## 工具签名

1. `volc_tts(text, voice='zh_female_vv_uranus_bigtts', audio_format='mp3', sample_rate=24000, output_path='')` → JSON{path, bytes, usage_tokens}; 音色命名规则 `*_uranus_bigtts`
2. `volc_asr(audio_path, language='')` → JSON{text, duration_s}; wav/mp3/ogg/pcm 皆可, language 留空=中英+方言自动
3. 计费(AFP): TTS≈字符数/10000×1350, ASR≈450/小时; 建议 TTS 单次 ≤500 字

## 工程护栏（better-skill 补丁 · 2026-11-13）

### 触发时机（必修 P0-1）
当用户提出本技能覆盖的任务、或明确点名本技能时使用；同一意图的不同说法（改述）也应能触发。

### 初始对话协议（必修 P0-3）
多步任务的第一步必须停顿确认：「我计划分 X 步，预期产出 Y，是否开始？」；得到明确确认前不得进入执行。

### 核心执行原则（P0 · 底线护栏）
1. 严禁猜测未侦察过的环境状态（路径 / ID / 页面）；没读过的文件视为不存在。
2. 绝不擅自修改脚本或核心配置；非文本操作只通过既有脚本运行。
3. 不得在产出中夹带真实凭据、个人手机号、内网 IP 等敏感信息。
4. 严禁全量重印长文档；修改只做最小 diff 补丁。

### 黑盒执行协议（必修 P0-7）
涉及 `scripts/` 等非文本操作时：只读 `--help` 了解用法、只运行脚本，不读源码、不修改脚本内容。

### 分阶段退出条件（必修 P1-5）
每个阶段须有明确完成标志：产出物齐全、自检通过、无未决阻塞，方可进入下一阶段。

### 交付前自检（P1 · 挑刺审计）
交付前列出 3 个可能缺陷，至少修正 1 个，并复查受影响条目。
