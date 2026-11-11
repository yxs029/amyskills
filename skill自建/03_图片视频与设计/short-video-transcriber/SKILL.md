---
name: short-video-transcriber
description: Download videos from WeChat Channels (视频号), local media files, YouTube, and other platforms, then convert them into timestamped transcripts and structured knowledge cards. Use when a user provides a video/audio link or file and wants the spoken content extracted, transcribed, or ingested into a knowledge base. Handles WeChat Channels encryption (Isaac64 + XOR on first 128KB) that ordinary downloaders cannot decrypt.
---

# Short Video Transcriber

把视频/音频转成带时间戳的逐字稿与结构化知识卡片。核心难点是微信视频号的加密视频，本 skill 已实测跑通完整解法。

## 路由：先判断输入源类型

| 输入 | 走哪条管道 | 是否需付费 API |
|------|-----------|--------------|
| 视频号链接 `weixin.qq.com/sph/xxx` 或 `channels.weixin.qq.com/...` | 管道 A | 是（约 $0.01/次） |
| 本地 mp4 / mp3 / wav / m4a / webm | 管道 B | 否 |
| YouTube 链接 | 管道 C | 否 |
| B站/抖音等其他平台链接 | 管道 D | 视情况 |

判断错管道会浪费时间与费用。视频号链接**不能**走管道 B 或 C。

## 管道 A：视频号链接 → 逐字稿

### 为什么不能直接下载

视频流地址与解密密钥 `decode_key` 由微信客户端通过 `WeixinJSBridge.invoke` → `FinderGetCommentDetail` 下发，**网页预览页不含这些数据**（实测 `video` 元素 0 个，HTML 中 `decode_key` 命中 0 次）。因此必须借助第三方解析服务取参。

即便拿到文件也无法直接播放：文件**前 128 KB 被加密**（Isaac64 生成 131072 字节密钥流后 reverse，再与前 128KB 逐字节 XOR）。

### 执行步骤

```bash
export TIKHUB_API_KEY=<key>
python3 scripts/wx_channels_pipeline.py <分享链接> --out ./out
```

脚本自动完成：取 `full_url` + `decode_key` → 下载 → 解密（内部调用 `scripts/wx_decrypt.js`）→ 转写 → 生成 `transcript.md`。

首次运行前需确保 WASM 模块（`wasm_video_decode.js` 与 `wasm_video_decode.wasm`）存在于 `scripts/` 目录，缺失时按 `references/wechat-channels-internals.md` 中的地址下载。

若已另行获得加密文件与配对的 key，可单独调用解密步骤：

```bash
node scripts/wx_decrypt.js <加密文件> <decode_key> <输出文件>
```

用户没有 API key 时，读 `references/troubleshooting.md` 的「无 API key 的替代路径」，不要直接放弃。

### 五条铁律

均为实测确认，违反任何一条都会导致失败或静默产出错误数据：

1. **`decode_key` 与 `url` 必须来自同一次 API 响应。** 每次请求返回的配对都不同（实测三次调用得到 `1619877393` / `1782851221` / `1736702595`，各自都能解密同一文件）。绝不能缓存 key 复用于其他请求。
2. **用 `full_url`，不要用裸 `url`。** 裸 `url` 有防盗链会失败。`full_url` = `url` + `url_token`。
3. **不要用 `file_size` 或 `md5` 校验下载文件。** 二者对应最高码率原版（实测报 226,263,083 字节 / 1080×1920），而下载地址给的是压缩分发版（实测 4,715,649 字节 / 720×1280），相差 48 倍。以实际 Content-Length 为准。
4. **解密必须调用微信官方 WASM 模块，不要自己重写 Isaac64。** 微信对 seed 初始化做了非标准处理，独立实现无法产出正确密钥流。
5. **`decode_key` 传入 WASM 时必须是字符串。** 传数值会静默产出错误结果——不报错，但解密后文件损坏。

### 计费陷阱

TikHub 的微信系路由（视频号 + 公众号 + 搜一搜）**全部拒绝免费额度**，仅接受付费余额，否则返回 `HTTP 402`；而抖音等非微信接口可用免费额度。因此「用免费额度试视频号」不成立，必须先充值。实测单次 `fetch_video_detail` 成本 $0.01，5 USD 约可解析 500 条。

## 管道 B：本地媒体文件 → 逐字稿

```bash
manus-speech-to-text <文件路径>
```

产出 JSON（含 segments 时间戳）与纯文本两份。批量处理：

```bash
python3 scripts/batch_transcribe.py --dir <输入目录> --out <输出目录>
```

该脚本同时兼容「已有加密文件 + 已知 key」的场景（传 `--key`），无 key 时自动跳过解密直接转写。

## 管道 C：YouTube 链接

**不要下载视频。** 直接调用：

```bash
manus-analyze-video "<YouTube URL>" "<分析要求>"
```

实测可对 27 分钟视频一次性提取框架、步骤与案例，比先下载再转写更快，也不占存储。需要精确逐字稿时才考虑下载。

## 管道 D：其他平台

优先搜索是否有同源转载可走管道 C；仍不可得时参考 `references/troubleshooting.md` 的平台限制表。

## 产出规范

`transcript.md` 必须包含两部分。首先是元数据表：标题、账号、发布时间、时长、分辨率、互动数据、object_id、来源链接。其次是带时间戳的逐字稿：

```
`[00:00.14 - 00:10.18]` 逐字内容……
```

时间戳是溯源锚点，作用等价于书籍的页码或段落区间，**不得省略**。

## 转写质量校正

转写引擎对英文缩写与专有名词识别不稳定，**入库前必须人工校正术语**。实测案例：「单点 ROI 决策」被转成「单点 RY 决策」。做法是通读逐字稿，列出所有可疑英文缩写与专名，按上下文逐个校正后再入库，并在文末标注校正说明。

## 参考资料索引

按需读取，不要一次全读：

| 文件 | 何时读 |
|------|--------|
| `references/wechat-channels-internals.md` | 调试解密失败、需要 API 字段完整说明、WASM 加载报错时 |
| `references/troubleshooting.md` | 遇到错误码、用户无 API key、需要平台限制对照时 |
| `references/case-yitang-system.md` | 首次使用本 skill、需要产出范例与内容拆解范式时 |
| `references/knowledge-extraction.md` | 要把逐字稿转成知识卡片并入库时 |
