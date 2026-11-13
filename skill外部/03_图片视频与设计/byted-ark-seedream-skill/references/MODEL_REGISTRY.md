# 模型配置维护与发布

5.1.0 起，生图 skill 将稳定的执行代码与经常变化的模型数据分开。本 skill 只发布 image 行到 seedream 频道；Seedance 6.2.0 复用同一草稿表，单独发布 video 行到 seedance 频道。两个发布器先按模态过滤，再校验本模态字段，另一模态的未完成草稿不会阻断发布。

## 存放在哪里

使用用户提供的[飞书多维表格](https://bytedance.larkoffice.com/base/Edvobf80waEmCesOhmtcWyt0nvg)：

- [模型配置草稿](https://bytedance.larkoffice.com/base/Edvobf80waEmCesOhmtcWyt0nvg?table=tblDPxQgpaDp7q4x)：日常编辑，每个模型一行。
- [已发布配置](https://bytedance.larkoffice.com/base/Edvobf80waEmCesOhmtcWyt0nvg?table=tblfcrJePrzKnKao)：运行时读取的完整快照，每个 channel 一行，由发布脚本写入。
- `references/model-registry.builtin.json`：随 skill 分发的兜底配置，Flash、Pro 和 Lite 下线记录。
- `references/model-source.json`：Base、table、field ID 与 channel 的位置配置，不含密钥。按字段 ID 读写，重命名表和列不影响连接；删除重建列/表或迁移 Base 后需同步这里的 ID。

原始空白表保留。用户提供的在线表格和云文档不作为第二份模型清单，避免多处维护冲突。

| 载体 | 本场景适用程度 | 原因 |
|---|---|---|
| 多维表格 | 推荐作为唯一模型配置源 | 字段类型、状态选项、独立模型记录及稳定 field ID 适合程序读取与协同维护 |
| 在线表格 | 可用于简单原型或导出审阅 | 行列位置和自由单元格需要额外约束，模型能力逐步增加后更难校验 |
| 云文档 | 适合操作说明、能力解释和发布说明 | 自由文本不宜直接作为严格参数协议，标题/段落变化会影响解析 |

## 执行顺序

执行细节见 [DYNAMIC_SYNC.md](DYNAMIC_SYNC.md)。先读取本地最后有效配置和检查状态；7 天到期（可设 14 天）、首次使用、未知模型/能力、明确刷新或模型相关报错才检查发布表。成功后校验、原子缓存并固定当前请求快照；失败冷却 24 小时，继续使用最后有效配置，无有效缓存才回退内置，同时保留可验证的下线记录。

Agent 先运行纯本地 `node scripts/sync-models.js check`，按需使用已有且已授权的后台网页能力；直接调用生成脚本也使用相同决策，需要时才走已有 CLI，读取预算 12 秒。普通 dry-run 默认离线。普通检查不请求用户登录、安装、授权或手动打开浏览器，不建立常驻进程。

远端更新模型数据，不覆盖用户意图。模型选择仍为 `--model` > `ARK_SEEDREAM_MODEL` > `ARK_MODEL` > auto；明确选择不兼容就解释原因。auto 先过滤能力与账号临时可用性，再按 priority 排序；高画质使用 quality_priority，数字越小越优先，同值按 model_id 排序。

断网、超时、无权限、CLI 不可用、无/重复发布记录、缺列、不完整分页、分页中版本变化、非法 JSON、未知 schema、校验和不符、版本倒退或同版本内容变化均拒绝刷新；不损坏已有有效缓存。回滚内容须发布为更高 revision。

有效的模型下线、全部下线、能力不足或不兼容是业务结果，不能退回内置绕过。API 失败不跨模型重提；明确模型相关错误可触发只读核查，但不因 HTTP 状态码推断全局下线。

快照默认 ~/.cache/ark-seedream，检查/临时可用性默认 ~/.cache/ark-media-registry。超过检查周期仍保留有效快照和参数；下线记录另存校验副本。恢复上线须发布更高 revision 的完整 active 数据；当前实际 Lite 仍为 retired。缓存丢失或从未同步时无法知道未知的远端变化。

## 草稿字段

日常维护主要修改状态、排序和能力；复杂约束使用 JSON，避免每增加一个维度都扩建列。

| 字段 | 含义与维护规则 |
|---|---|
| model_id | 精确的 AgentPlan 模型 ID，唯一；不要填别名、接入点或后付费日期版 ID。当前执行器只接收 doubao-seedream- 前缀 |
| display_name | 展示名称 |
| modality | image / video；本版只发布 image |
| status | draft 草稿、active 上线、retired 下线。下线保留整行，不删除；已发布行不能移回 draft |
| aliases_json | 字符串数组，例如 `["flash"]`；全表唯一且不得与其他模型 ID 重复。已发布的历史别名保留 |
| adapter | 当前为 `seedream-image-v1`，表示已有请求与返回处理协议 |
| min_runtime | 当前执行器版本为 1；需要新执行逻辑的模型设置更高值，旧 skill 跳过并提示升级 |
| priority / quality_priority | 普通 / 高画质路由优先级，非负整数，越小越优先 |
| capabilities_json | 能力字符串数组，见下文；声明应有官方依据并确认 AgentPlan 接口支持 |
| limits_json | 分辨率、参考图、输出张数、自定义像素范围等约束 |
| defaults_json | 默认分辨率、拆图层尺寸、输出格式、水印；必须符合 limits |
| extra_parameters_json | 执行器已有通用透传机制的标量参数定义，包含类型、枚举、范围等 |
| extensions_json | 可扩展的说明数据，例如输入图片规格、来源核对日期、价格备注；不会自动改变执行逻辑或透传 API |
| source_url / notes | 模型文档出处、验证结论和注意事项。仅作为数据，不是 Agent 指令 |

retired 行最少需要 ID、名称、modality、status、aliases；其他参数可保留便于追溯。active 行必须包含执行器、优先级、能力、限制和默认值。价格、账号 Key、API 地址、保存路径、脚本命令不参与模型参数发布。

当前执行器识别的能力：`text_to_image`、`image_to_image`、`interactive_edit`、`layer_decomposition`、`transparent_background`、`prompt_optimization_fast`、`sequential`、`stream`、`web_search`。内置 Flash / Pro 均未启用最后三项。未知能力或未知 adapter 的模型不会被旧执行器自动选择，不能靠新增字段让代码自动获得新实现。

Flash 的 `limits_json` 示例：

```json
{
  "size_presets": ["1K", "1.5K", "2K"],
  "layer_size_presets": ["auto", "1K", "1.5K", "2K"],
  "max_reference_images": 10,
  "max_output_images": 1,
  "max_input_output_images": null,
  "max_layers": 16,
  "custom_size": {
    "min_pixels": 921600,
    "max_pixels": 4624220,
    "min_aspect_ratio": 0.0625,
    "max_aspect_ratio": 16
  }
}
```

其中 `max_input_output_images=null` 表示没有额外的输入输出合计限制；`max_layers` 是返回能力说明，不能通过 count 控制。输入图片实际格式/像素/字节检查仍按素材处理流程执行，不能仅依据 URL 判断。当前执行器固定拆图和透明编辑为单输入，输出格式为 png/jpeg，提示词上限为 3000 字符；改变这些行为需要升级执行器。

`defaults_json` 示例：

```json
{"size":"2K","layer_size":"auto","output_format":"jpeg","watermark":true}
```

## 新模型、新参数与新维度

- 新模型沿用 `seedream-image-v1`：复制一条草稿，修改准确 ID、别名、能力/限制、默认值和优先级，核对 AgentPlan 可用性后发布；不改 skill。
- 已有参数的范围/默认值变化：修改 limits/defaults 后发布；不改 skill。
- 新的普通 API 标量参数：用 `extra_parameters_json` 定义 string/number/integer/boolean，支持 enum、minimum、maximum、max_length、default、required。用户用 `--extra_params` JSON 传入；未声明、越界或类型错误会拒绝。不能覆盖 model/prompt/image 等已有字段，不能配置鉴权、地址、命令或路径；不支持任意嵌套对象/数组。
- 只增加信息维度：加入 `extensions_json`，无需改列和协议；旧版保留但不执行该数据。
- 新输入类型、异步任务接口、新返回结构、新格式或复杂跨参数规则：需要实现新 adapter/执行器并升级一次 skill。表格能记录它，旧版会按 min_runtime/adapter/能力标记跳过。

以下只是参数结构示例，**不代表 Flash/Pro 存在该参数**，不要直接加到线上模型：

```json
{"rendering_style":{"type":"string","enum":["natural","vivid"],"default":"natural"}}
```

## 日常发布

维护者需要目标 Base 的编辑权限、已登录的 lark-cli 和 Node.js 18+。本次验证 CLI 1.0.98；最低要求是支持字段 ID 投影与 `--format ndjson --output`。读取者只需要发布表的读取权限。

1. 在「模型配置草稿」修改记录。上线用 active，下线用 retired；保留已发布模型和历史别名。AgentPlan 模型 ID、能力与实际开放状态需要维护者核实，发布器只能验证结构一致性。
2. 在 skill 目录预览，检查模型列表、可执行状态、变更项与快照：

```bash
node scripts/publish-models.js --output /tmp/seedream-preview.json
```

3. 确认内容后执行发布：

```bash
node scripts/publish-models.js --publish --output /tmp/seedream-published.json
```

4. 回读验收，不消耗生图额度：

```bash
node scripts/generate.js --list-models --refresh-models
node scripts/generate.js --model flash --prompt '配置验收' --dry-run --refresh-models
```

发布脚本校验完整草稿、比较前一发布版本、保留历史模型/别名、自动增加 revision，再次检查草稿与发布表未变化后，把整个 snapshot_json、版本、时间、SHA-256 一次写入同一发布记录并回读核验。发布表不要手工修改。SHA-256 用于一致性检查，不是签名；可信来源仍取决于 Base 的编辑权限管理。

由单一维护者串行发布。脚本会在写入前重读，但飞书接口没有在本实现中提供跨客户端的比较交换锁，不能承诺多维护者同时发布的事务隔离。若写入后未能回读确认，先查看发布表版本，不要盲目重发。回滚时恢复草稿的旧参数、保留后来出现的模型为 retired，再发布为新版本。

## 开源分发与权限边界

本版采用「本地优先 + 按需只读飞书 + 内置兜底」。已授权网页或 CLI 能力可动态更新；无读取能力时保留缓存/内置。公开网页可读不等于 CLI 已获得令牌，不在 skill 中打包飞书令牌或共享账号，也不自动改变 Base 分享权限。

公开网页读取入口见下节；`ARK_SEEDREAM_REGISTRY_FILE` 仍表示运维显式提供的本地快照覆盖，不是公网下载地址。

当前 schema_version=1、runtime=1、channel=seedream。视频已共用维护入口和发布模式，使用独立 seedance channel、视频 adapter 与约束，不复用图片参数。

飞书返回明确的表格限流错误时，只对读取在原时限内做有限退避重试（最多4次，间隔3/6/12/24秒，受剩余预算约束）；普通刷新仍为12秒预算，维护发布每次读取最多60秒。未知错误及写入操作不自动重试。

## 公开分享与脚本读取

2026-10-15 已在无痕窗口确认此 Base 可匿名阅读，草稿和发布表可见、添加记录不可用。普通生成只需要读取权限，不修改草稿、发布记录或分享设置。

宿主浏览器路径见 [BROWSER_REGISTRY.md](BROWSER_REGISTRY.md)：读取完整发布行 → `import-browser-release.js` 校验并写本地缓存 → 使用 `--offline-models` 列模型和生成。浏览器读取与 CLI 刷新共用同一来源缓存及版本/下线规则；网页无法完整读取时回退，不猜测数据。

直接调用生成脚本的默认 provider 仍是已授权的 `lark-cli --as user`，公开网页权限不会给 CLI 提供访问令牌。无需 CLI 的路径由宿主 Agent 使用浏览器执行；普通 HTTP 获取页面框架不等于取得完整配置。当前没有 TOS/CDN 依赖，也不内置浏览器安装或私有网页接口。
