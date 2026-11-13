# 火山 Agent Plan 语音 API 协议笔记(2026-11-13 实测)

## 鉴权(与标准语音技术产品的区别)

1. 【Plan 专属路径】openspeech.bytedance.com/api/v3/plan/tts/* 与 /api/v3/plan/sauc/* 是 Agent Plan 专属端点
2. 【鉴权头】X-Api-Key=<Agent Plan ark key> — 不是 Bearer, 不是旧语音控制台的 X-Api-App-Key/X-Api-Access-Key 三件套
3. 【Resource-Id 请求头】TTS=seed-tts-2.0 / ASR=volc.seedasr.sauc.duration — 必须放 header, body 里放不认
4. 【错误码阶梯(逆向实录)】Bearer+无Resource-Id → 400 "get resource id empty"; Bearer+Resource-Id头 → 400 "app key not found in header or query"; X-Api-Key+Resource-Id → 200

## TTS 2.0 HTTP 接口(unidirectional)

1. 【请求】req_params{text, speaker, audio_params{format, sample_rate}}
2. 【响应】NDJSON 逐行: code=0 行 data=base64 音频分片(拼接), code=20000000 完成帧
3. 【实测】202字播报稿→290KB mp3; "你好"短句→32KB mp3(ID3v2.4/24kHz/64kbps)
4. 【计费回执头】X-Control-Require-Usage-Tokens-Return: * → additions.usage_tokens
5. 【音色】仅 2.0 音色(*_uranus_bigtts 后缀); seed-icl-2.0 声音复刻不在套餐
6. 【格式】mp3/ogg_opus/pcm(默认 mp3; wav 不支持流式); 8000~48000Hz 七档

## ASR 2.0 websocket 协议(bigmodel_nostream / bigmodel_async)

1. 【握手 header】X-Api-Key + X-Api-Resource-Id + X-Api-Request-Id(uuid) + X-Api-Connect-Id(uuid)
2. 【帧头 4 字节大端】byte0=0b0001_0001(版本1+头长1*4B); byte1=高4位消息类型/低4位flags; byte2=高4位序列化/低4位压缩; byte3=0
3. 【消息类型】FULL_CLIENT=0b0001 / AUDIO_ONLY=0b0010 / SERVER_FULL=0b1001 / ERROR=0b1111
4. 【flags 位语义(踩坑实锤)】bit0=payload 带序号(4字节大端插在 size 前), bit1=末包标记; 末包 seq 用负数
5. 【序列化/压缩】JSON 包=JSON(0b0001)+gzip(0b0001); 音频包=raw(0b0000)+raw(0b0000)
6. 【首包 JSON】user.uid + audio{format,rate,bits,channel} + request{model_name:"bigmodel", enable_punc, enable_itn}; sequence: 1
7. 【音频包】6400B/包=200ms@16kHz16bit, 包间隔 ~120ms, seq 从 2 递增, 末包负 seq
8. 【响应】nostream 逐包回执(duration 200ms 步进), text 渐进累积, 末包 definitive=true
9. 【音频硬性要求】16kHz/16bit/单声道 pcm_s16le(wav/mp3/ogg 内部转); ffmpeg 转裸 pcm 流必须 -f s16le

## 计费(AFP)

1. TTS: 字符数/10000 × 1350 AFP(2000字=270)
2. ASR: 时长小时 × 450 AFP/小时
3. key 与 LiteLLM 网关 VOLC_AGENTPLAN_KEY 同值(~/.hermes/.env WEB_SEARCH_API_KEY 变量)

## 官方文档锚点

1. Agent Plan 接入语音模型: https://ark.volcengine.com/docs/agent-plan-personal-voice-model (加 .md 取 Markdown 版)
2. TTS 三接口: 双向流 /api/v3/plan/tts/bidirection; 单向流 /api/v3/plan/tts/unidirectional/stream; HTTP /api/v3/plan/tts/unidirectional
3. ASR 两接口: async /api/v3/plan/sauc/bigmodel_async(实时); nostream /api/v3/plan/sauc/bigmodel_nostream(准确率)
