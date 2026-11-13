# AgentPlan Seedream Skill 安装与迁移

需要 Node.js 18+、AgentPlan API Key 和能够访问方舟 API 的网络。将整个 `byted-ark-seedream-skill` 文件夹安装到宿主的 skills 目录，按宿主要求重新加载 skill。

目录应包含 `SKILL.md`、`LICENSE`、`package.json`、`scripts/` 和 `references/`。Key 检测和保存位置见 [CONFIG.md](CONFIG.md)。

## 5.1.0 动态配置

从旧版升级需一次性替换整个 skill。后续常规模型上下线、优先级和兼容参数调整只需修改飞书草稿并发布配置，无需重新发布 skill。

动态更新有两条可选路径：已有授权的宿主后台浏览器读取并导入发布配置，或支持 Base NDJSON 输出的 lark-cli（历史验证 1.0.98）配合已登录身份及目标 Base 读取权限。缺少 CLI 不影响可用的浏览器路径；两种读取均不可用时保留有效缓存，否则使用内置配置。仅有文档链接不代表宿主自动拥有读取能力。用户主动更新受阻时可选择安装/配置 CLI，安装后仍须验证登录与读取权限。详情见 [DYNAMIC_SYNC.md](DYNAMIC_SYNC.md)。

## 验证

先在 skill 根目录进行离线检查：

```bash
node scripts/generate.js --model flash --prompt '一只猫' --size 2K --dry-run
```

上传包不包含测试脚本或 Mock 数据。维护者在含 `tests/` 的开发源码目录运行 `npm test`；使用者通过上述 dry-run 检查安装。

实际生成会消耗 AgentPlan 额度：

```bash
node scripts/generate.js --model flash --prompt '一只猫趴在窗边晒太阳' --size 2K
```

## 5.0.0 迁移

Lite 已下线，普通生成默认改为 Flash。旧 `--model lite`、Lite 全名或环境变量会报迁移提示。显式更新为 `flash` / `doubao-seedream-5-0-flash`，或用 `--model auto` 覆盖旧环境偏好。

Flash 和 Pro 均支持文生图、多参考图融合、交互编辑、图层拆分与透明图层编辑；分辨率为 1K / 1.5K / 2K。普通参考图最多 10 张，拆图层和透明编辑恰好 1 张。

当前模型暂不支持连贯组图、联网搜索或流式输出。旧 3K / 4K、超过 10 张参考图、`count>1`、`reference_strength` 参数会在请求前被拒绝。新参数与示例见 [SKILL.md](../SKILL.md) 和 [EXAMPLES.md](EXAMPLES.md)。

## 输出与输入

图片默认保存到桌面 `Seedream-Images` 的日期目录，并保存 metadata。下载失败时仍返回完整资源 URL。

本地图片先转 Base64 Data URI；也可传入可访问的 HTTP(S) 图片地址。Base64 可以避免托管输入图片，但调用 API 和下载输出仍需要网络。
