# 视频号加密机制与 API 字段完整说明

调试解密失败、需要字段含义、或 WASM 加载报错时读本文。

## 加密机制

```
decode_key (数值字符串)
  → Isaac64 生成 131,072 字节密钥流
  → 密钥流 reverse
  → 与文件前 128 KB 逐字节 XOR
```

只加密前 128 KB 的原因：MP4 的 `moov` 元数据盒通常在文件头部，头部损坏即无法解析播放，因此无需为全片承担加解密性能开销。这个成本权衡正是它可被解开的前提。

文件 128 KB 之后的字节为明文，无需处理。

## WASM 模块

必需两个文件，来自微信前端资源服务器：

```bash
curl -sL -o wasm_video_decode.js \
  https://res.wx.qq.com/t/wx_fed/finder/web/web-finder/res/js/wasm_video_decode.js
curl -sL -o wasm_video_decode.wasm \
  https://res.wx.qq.com/t/wx_fed/finder/web/web-finder/res/wasm/wasm_video_decode.wasm
```

`.wasm` 约 3.8 MB。两个文件必须放在同一目录。

### 加载方式：必须用 vm 沙箱，不能用 require

**这是最容易踩且最难查的坑。** 用 `require()` 加载该 JS 胶水代码的表现是：**零报错、进程静默挂住**，没有任何诊断线索。

根因在胶水代码开头：

```javascript
var Module = typeof Module !== 'undefined' ? Module : {};
```

在 CommonJS 模块作用域下，`typeof Module` 永远是 `'undefined'`，于是它总是新建一个空对象，外部注入的 `onRuntimeInitialized` 回调、`wasmBinary`、`instantiateWasm` 全部失效，运行时初始化完成后无人接管，进程空转。

正确做法是用 `vm.createContext` 建立共享上下文，把预先构造好的 `Module` 对象注入为该上下文的全局变量，再在其中执行胶水代码：

```javascript
const vm = require('vm');
const sandbox = {
  Module: { wasmBinary: fs.readFileSync('wasm_video_decode.wasm'), onRuntimeInitialized },
  console, process, require, Buffer, TextDecoder, TextEncoder,
  performance, setTimeout, clearTimeout,
};
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('wasm_video_decode.js', 'utf8'), sandbox);
```

Node 环境还缺少若干浏览器全局对象，`self`、`globalThis`、`VTS_WASM_URL` 需一并补齐，否则胶水代码的环境判定分支会走错。

### decode_key 必须传字符串

调用形式：

```javascript
const decryptor = new Module.WxIsaac64(String(decodeKey));
const keyStream = decryptor.generate();  // Uint8Array(131072)
```

**传数值会静默产出错误密钥流**，解密后文件损坏但不报错。公开资料普遍把 `decode_key` 描述为数值 seed，直接按数值传是常见失败原因。

### 不要重写 Isaac64

已验证：标准 Isaac64 的独立实现（纯 Python / 纯 JS）无法产出与微信一致的密钥流，因为微信对 seed 初始化做了非标准处理。这也解释了为何 GitHub 上所有相关项目（包括 5.6k stars 的 wechatVideoDownload）都直接调用官方 WASM，而非自行实现算法。**不要在这上面浪费时间。**

## fetch_video_detail 返回字段

`POST https://api.tikhub.io/api/v1/wechat_channels/v2/fetch_video_detail`

请求体：`{"share_url": "...", "raw": false}`。输入优先级为 `object_id` > `export_id` > `share_url`；`export_id` 来自搜索结果且很快过期，应配合 `object_nonce_id` 使用。

`data` 层字段：

| 字段 | 含义 | 备注 |
|------|------|------|
| `id` | object_id | 稳定唯一标识，宜作为知识库主键 |
| `object_nonce_id` | nonce | 部分接口需配合传入 |
| `username` / `nickname` | 账号标识 / 昵称 | |
| `title` | 标题文案 | **注意字段名是 title 而非 description** |
| `create_time` | 发布时间戳 | 秒级 |
| `read_count` | 播放量 | **恒为 0**，微信不公开该数据 |
| `like_count` / `fav_count` / `forward_count` / `comment_count` | 赞/藏/转/评 | 可用于传播特征分析 |
| `cover_img_url` | 封面图 | |
| `media` | 媒体对象 | `raw=false` 时为单个 dict；`raw=true` 时在 `objects[0].objectDesc.media[]` |

`media` 层字段：

| 字段 | 含义 | 陷阱 |
|------|------|------|
| `url` | 裸地址（实测 192 字符） | 有防盗链，单独用会失败 |
| `url_token` | 鉴权 token（实测 696 字符） | |
| `full_url` | = url + url_token（实测 888 字符） | **用这个下载** |
| `decode_key` | 解密种子 | **每次请求都不同**，必须与本次 url 配对使用 |
| `duration` | 时长（秒） | |
| `width` / `height` | 原始分辨率 | 实测 1080×1920，但下载所得为 720×1280 |
| `file_size` | 原版体积 | **不可用于校验下载文件**，实测差 48 倍 |
| `md5` | 原版 MD5 | 同上，不可用于校验 |
| `media_type` | 媒体类型 | 4 表示视频 |

## 域名区分陷阱

| 资源 | 域名 |
|------|------|
| 封面图（网页预览页内） | `finder.video.qq.com` |
| 视频流（API 返回） | `wxapp.tc.qq.com` |

两者都使用 `stodownload` 端点，**仅凭域名或路径无法区分图片与视频**，必须检查 `Content-Type`。实测教训：网页预览页里唯一的 `finder.video.qq.com/.../stodownload?...` 地址看似视频流，实际返回 `Content-Type: image/jpg`，是 607×809 的封面图。

## 为什么不能在沙箱里跑本机下载工具

`qiye45/wechatVideoDownload` 的工作原理是 mitmproxy 代理监听 + 篡改微信下发的 `virtual_svg-icons-register.publish*.js`，在 `finderGetCommentDetail` 函数中注入代码把 `decodeKey` 发出。它的前提是**存在一个正在播放视频的真实微信客户端**，因此不是「按链接下载」的工具。Linux 沙箱无微信客户端，wine 方案下 XWeb 内核能否正常解密播放亦不确定，成本极高不建议尝试。
