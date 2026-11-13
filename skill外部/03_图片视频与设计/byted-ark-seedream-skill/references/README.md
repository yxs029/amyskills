# AgentPlan Seedream Skill 5.2.6

内置 Seedream 5.0 Flash 与 5.0 Pro，Lite 已下线。入口与参数见 [SKILL.md](../SKILL.md)，内置能力边界见 [MODELS.md](MODELS.md)。新增飞书多维表格动态配置，维护字段和发布流程见 [MODEL_REGISTRY.md](MODEL_REGISTRY.md)。

- 默认 Flash；强调高画质时优先 Pro。用户明确选择优先。
- 两者均支持交互编辑、图层拆分、透明图层编辑和 1K / 1.5K / 2K。
- 当前发布配置的 Lite 已下线并拒绝；内置模型拒绝组图、联网、流式、3K / 4K 和超过 10 张参考图，新模型按已发布能力校验。
- 本地优先，默认 7 天到期或事件触发才查表；失败冷却 24 小时并保留最后有效配置及下线记录。
- 保持 AgentPlan `/api/plan/v3/images/generations` 接口与 ark- Key。
- stdout 输出 JSON，stderr 输出进度；图片与图层 metadata 保存到本地。

示例见 [EXAMPLES.md](EXAMPLES.md)，Key 与路径见 [CONFIG.md](CONFIG.md)，素材处理和输出见 [DEVELOPER.md](DEVELOPER.md)。

```bash
node scripts/generate.js --model flash --prompt '一只猫' --dry-run
node scripts/generate.js --list-models
```

上传包不含测试脚本与 Mock 数据；`npm test` 仅用于含 `tests/` 的开发源码目录。

能力基线依据 2026-10-14 用户提供的 Pro / Flash 教程 PDF、官方图片生成 API 文档与用户指定的 Flash AgentPlan ID。2026-10-15 完成 Flash / Pro 共7个真实生成场景，含多参考图、交互编辑、拆图层、透明编辑、自定义尺寸与 Pro fast；透明图首次下载超时，原 URL 补下载成功。5.1.1 增加 delivery_status 和下载计数，避免将生成成功误报为全部下载成功；默认下载超时调整为90秒。测试结果仅证明该账号当次请求。

5.1.3：与视频共享表格时先按模态隔离草稿；对飞书明确返回的限流错误，在读取预算内有限退避重试。写入不自动重试，模型和生成行为保持原配置。

5.1.3：固定官方 AgentPlan API 地址；下载加入公网 DNS/重定向校验、1GiB 上限、原子落盘和0600权限；dry-run 素材脱敏及严格控制参数；支持 ARK_API_KEY 优先级并避免显式 Key 时扫描其他配置；补齐打包白名单和许可证。

5.1.4：新增宿主浏览器只读导入公开发布配置的入口，共用已有校验与缓存；本次生成无需 lark-cli，表格仅需阅读权限。详见 [BROWSER_REGISTRY.md](BROWSER_REGISTRY.md)。

5.2.0：新增本地优先的 7/14 天检查、24 小时失败冷却与事件负缓存、同源刷新租约、独立下线记录及凭证隔离的临时不可用状态。普通检查仅尝试已有授权的后台能力，失败回退；不重复提交生成。详见 [DYNAMIC_SYNC.md](DYNAMIC_SYNC.md)。

5.2.1：明确本地 skill 的执行入口与模型目录边界；鉴权失败不自动改用 MCP、arkcli-gen 或其他 profile。Claude Code 须从个人/项目技能目录加载，普通源码目录不等于已安装。

5.2.2：补充只读 diagnose 命令、校验失败的哈希与格式诊断；refresh 失败显式返回 success=false 和退出码 1，保留有效缓存。校验接纳规则不变。

5.2.3：兼容飞书文本读取将裸 URL 包装为 [URL](URL) 的表示差异；还原后仍须整份文本与原发布 SHA-256 完全一致，浏览器和 CLI 共用验证。

5.2.4：在 description 与执行入口明确对应豆包/AgentPlan 媒体任务的默认优先级，优先于 arkcli-gen/ark_media 同类入口；保留用户明确选择、已约定默认入口和既有工作流，不将其他目录或鉴权检查作为前置步骤。

5.2.5：按上传要求增加顶层 version，并与 metadata.version、package.json 保持一致；上传包排除测试脚本、Mock 和运行时数据，回归测试仅保留在开发源码中。流式错误日志不再输出原始响应内容。

5.2.6：缺少可运行 lark-cli 返回独立错误码，区别于鉴权失败；明确 CLI 刷新与宿主浏览器导入是独立路径，用户主动更新或配置阻挡任务时才提供一次可选安装/配置提示，普通检查静默回退。
