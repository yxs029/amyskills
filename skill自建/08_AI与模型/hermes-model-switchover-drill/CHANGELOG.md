# Changelog

## v1.4.0 (2026-11-10)

- **可移植链方案 v2**：全公网直连、零本地依赖（主 zhipu 官网 glm-5.3-flash → L1 minimax 官方 M3.1-Flash → L2 白山 baishan/GLM-5.3-Flash → L3 agnes → L4 openrouter）
- 本地 LiteLLM 网关降级为可选加速层，config 不再引用
- 新增第 9 节：.env 五把 key 清单 + providers 模板 + 迁移操作要点

## v1.3.1 (2026-11-10)

- L1 弃网关版改官方 coding plan（主备同源）
- 新坑：断链演练对主备同 provider 不适用 → 同源等价论证
- 密钥打码层连源码里 KEY_NAME= 前缀也吃（拼接绕开）

## v1.3.0 (2026-11-10)

- 🔴 修正两条错误结论：key 字段名是 `key_env` 不是 `api_key_env`（写错静默 no-key-required → 401 全链废）；502/500 不触发降级（只有 429/401）
- 新增第 8 节：fake 429 服务器 + 链裁剪真降级验证法

## v1.2.0 (2026-11-10)

- 第 7 节轻量切换流水线（只换模型+上下文，三层验证）
- 上下文长度优先级（model.context_length 显式纯整数最高）
- config.yaml 受保护改法、密钥打码层坑

## v1.1.0 (2026-10-09)

- LiteLLM 网关 provider 配合与链序铁律

## v1.0.0 (2026-09-28)

- 初版：切换七步 + T0-T3 断联演练（failover_drill.py），本机实测全通过
