# Seedream 模型参数与边界

本文是随包发布的内置基线，不是运行时模型总表。5.1.0 起先执行 `node scripts/generate.js --list-models` 查看已发布配置；线上调整与新增模型以该输出为准，维护方式见 [MODEL_REGISTRY.md](MODEL_REGISTRY.md)。

核对日期：2026-10-14。依据用户提供的《Doubao Seedream 5.0 pro / flash 教程》PDF（能力表、交互编辑、拆图层、输出规格和输入限制），并补充核对[官方图片生成 API](https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh&redirect=1)。[用户提供的教程入口](https://console.volcengine.com/ark/region:cn-beijing/docs/ark/seedream-5-0-pro?lang=zh)本次无法直接读取，教程内容以附件为准。

以下能力来自公开模型文档；AgentPlan Flash ID 使用用户明确提供的 `doubao-seedream-5-0-flash`，Pro 保留既有 `doubao-seedream-5.0-pro`。不复制后付费日期版 ID、接口地址、价格或 IPM 承诺。2026-10-15 已对 Flash / Pro 执行7个真实场景；透明图首次下载超时后从原 URL 成功补下载，其他场景直接下载成功。该结果不代替未来可用性或其他账号的验收。

| 能力 | 5.0 Flash | 5.0 Pro |
|---|---|---|
| AgentPlan model | doubao-seedream-5-0-flash | doubao-seedream-5.0-pro |
| 文生图、单/多图生单图 | 支持 | 支持 |
| 连贯组图、流式、联网搜索 | 暂不支持 | 暂不支持 |
| 交互编辑、拆图层、透明图层编辑 | 支持 | 支持 |
| 原生多语种生成 | 支持 | 支持 |
| 分辨率档位 | 1K / 1.5K / 2K | 1K / 1.5K / 2K |
| 参考图张数 | 普通≤10；拆图层/透明编辑=1 | 普通≤10；拆图层/透明编辑=1 |
| 服务端提示词优化 | standard | standard / fast |
| 输出文件 | jpeg / png；透明编辑仅 png | jpeg / png；透明编辑仅 png |

Lite 下线状态依据本次用户通知，适用于本 skill 的 AgentPlan 接入，不据此推断所有后付费渠道均已下线。旧模型选择会报错，不自动作为 Flash 别名。Flash 不继承 Lite 的组图、联网、流式、3K/4K 或 14 张参考图能力。教程的 size 示例仍出现“生成4张”，与能力表不一致；以官方 API 明确的“暂不支持组图生成”为准。

## Flash / Pro 输出与输入限制

普通生成：size 默认 2K，可用 1K、1.5K、2K 或宽x高；自定义总像素 921600–4624220，宽高比 1/16–16，必须同时满足。例：2048x1024 合法，512x512 不合法。

拆图层：size 默认 auto，仅允许 auto、1K、1.5K、2K，不支持具体像素值；image 恰好一张，prompt 可省略。返回 1 张底图与最多 16 张透明 PNG 图层，共最多 17 个资源。output_format 仅控制底图；count 不控制图层数量，指定拆分内容写入 prompt。

普通输入：jpeg/png/webp/bmp/tiff/gif/heic/heif，每张≤30 MB；宽高均大于14，总像素196–36000000，宽高比1/16–16。拆图输入：仅png/jpeg，每张≤30 MB，总像素262144–36000000，宽高比1/16–16。Agent 应在转换本地文件时核实格式、尺寸与体积；URL 内容需以实际图片为准，脚本无法仅通过地址完整验证。

透明编辑：background=transparent，仅一张实际带透明通道的输入图，输出PNG；JPEG输入或输出不可用。不能把普通白底PNG视为已经带透明通道，也不能把此参数当成无参考图的透明文生图开关。

## 精准交互编辑

交互编辑通过参考图 + prompt 完成，不新增 bbox/point 顶层 API 字段。传 interactive_edit=true 只用于本地路由和关闭通用提示词增强。

任意标记：输入已标记的参考图，在 prompt 描述框选/箭头/涂鸦区域、修改内容及是否去除标记。

坐标：原样保留用户提供的归一化标签，例如：

```text
将图1<bbox>179 283 796 986</bbox>的主体放到图2<bbox>118 331 933 871</bbox>位置。
```

参考图数组顺序对应图1、图2。不要猜坐标或把绝对像素直接填进归一化标签。材料示例未完整定义交互坐标获取步骤；缺少坐标时可使用用户的自然语言或已有标记定位，需要精确标签时补充坐标依据。

## 图层返回

保留 data 中的 output_format、size、z_index、bounding_box、name、description，并下载每个 URL。z_index=0 是底图，其他图层按实际 output_format 保存为 PNG；不假设 data[0] 一定是底图。

bounding_box.absolute 是输出底图坐标系中的 [left, top, right, bottom]，normalized 是归一化坐标。结果 JSON 和 metadata 均保留这些字段，供后续重组使用。API返回顺序和z_index分别保留，不用本地index覆盖z_index。

## 参数隔离

CLI output_format（或旧别名 response_format）是文件格式；API response_format 固定 url。CLI optimize_prompt_mode 映射 optimize_prompt_options.mode；optimize 只控制本地文字增强。Flash / Pro 不发送 stream、tools、sequential_image_generation 或 reference_strength。不复制后付费 Model ID、接口地址、max_images 或价格配置。
