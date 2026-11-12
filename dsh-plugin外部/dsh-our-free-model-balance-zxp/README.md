# dsh-our-free-model-balance-zxp

> **前提：先装 `dsh-our-free-model`（OFM），并在里面登录至少一个渠道。**
> 没有 OFM，这个插件装上也只会显示「读不到 Our Free Model」，不会有任何数字。

在 DSH 输入框旁显示 **Our Free Model（OFM）** 当前渠道的剩余额度，点开可看全部渠道。

## 它显示什么

- **图标**：当前会话所用模型所属渠道的余额，切换模型会跟着变
- **面板**：所有已登录渠道的总览，每个渠道一行
- **悬浮卡片**：那一行的**精确总额（两位小数）**，下面逐账号列出额度

显示规则：

| 情况 | 表现 |
|---|---|
| 渠道有余额 | 只显示数字，安静 |
| 余额为 0 | 红底 + 红边 + 加粗「用尽」 |
| 当前渠道 | 左侧一条该厂商的品牌色脊线 |
| 未登录的渠道 | 默认不出现（可在设置里打开） |
| 数字超过一千 | OFM 同款缩写（`15K` / `7.5K` / `8.0M`），悬浮卡片给精确值 |

## 前提

- 已安装 **Our Free Model** 插件，并在其中登录了至少一个渠道
- DSH **≥ 0.2.1**（用到 `connection.browserPeer` 与 `webServer` 的 prefix 路由）

## 安装

```bash
dsh plugin --profile desktop add github:zengxiangpeng123/dsh-our-free-model-balance-zxp
```

## 设置

`设置 → 渠道余额`：

- 自动刷新间隔（关闭 / 30 秒 / 1 分钟 / 5 分钟 / 自定义 15–3600 秒）
- 立即刷新
- 显示项：时间戳、单位、脊线、底部汇总、用尽标红、图标只显示色点
- 逐渠道隐藏 + 是否显示未登录渠道

## 它是怎么工作的

1. **宿主侧轮询**：DSH 主进程通过内核 RPC（`channel-pack`）向 OFM 询问「谁登录了」，再只对已登录的渠道查余额，合成一份快照。
2. **浏览器只读快照**：客户端不直接调 OFM，只 `GET /api/our-free-model-balance-zxp/snapshot`，并定时发一次心跳（`POST /watch`）告诉宿主「还有人在看」。
3. **省电**：没人看的时候（心跳停了 150 秒）轮询自动停止；失败按指数退避（上限 10 分钟）。整轮失败时保留上一次的正确数字并标记为「可能已经不准」，而不是清空。

接口：`/snapshot`（GET）、`/watch`（POST）、`/refresh`（POST）、`/settings`（GET/PUT）。

## 已知限制

- 渠道表内置 10 个（lobsterai / qoder / qodercn / trae / cline / loomy / raccoon / minimax / zcode / gemini）。OFM 新增渠道后需要更新本插件才认识它（不认识的渠道会被忽略，而不是瞎猜数字）。
- 不同渠道单位不同（积分 / Token / USD / 配额），**不做跨渠道换算或汇总**。
- 宿主的本地接口不做鉴权（仅监听本机，与 DSH 其它插件一致）。

## 许可

MIT
