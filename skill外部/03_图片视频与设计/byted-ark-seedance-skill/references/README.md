# byted-ark-seedance-skill v6.3.6

AgentPlan Seedance 视频生成、编辑、延长与任务查询工具。入口及安全边界见根目录SKILL.md；2.5参数限制见 references/seedance-2.5.md。

运行环境：Node.js 18+，无第三方npm依赖。上传包可运行 `node scripts/seedance-wrapper.js create --prompt '一只猫' --duration 5 --dry-run` 做离线预览。`npm test` 仅在含 `tests/` 的开发源码目录运行，不提交生成请求。

6.1.0 新增 `create --dry-run` 离线请求预览，修复 `--wait false` 仍轮询与缺少任务 ID 时成功退出的问题，并明确静态图片、纯剪辑、缺失素材和硬性冲突的处理边界。测试覆盖与测评解释见 [EVALUATION.md](EVALUATION.md)。

模型入口使用AgentPlan服务，2.5模型名为doubao-seedance-2.5。仅在服务端开放后可真实使用；UnsupportedModel不应通过切换到后付费接口规避。

2026-10-15 在测试账号上，2.0标准版与2.5各一次5秒/720p任务完成提交、查询与下载，输出为1280×720、24fps、约5.04秒且无音轨。该验收不覆盖全部模型能力、账号或视觉质量，不以一次成功承诺稳定可用。

优先通过本地ARK_API_KEY环境变量配置凭据。默认不保存临时密钥；用户明确要求保存时才使用--save-api-key true。上传包不包含任何用户配置、真实密钥、偏好或生成记录。

6.2.1 接入与生图共用的飞书模型表，使用独立 seedance 发布频道。默认值、能力、限制、优先级、别名和同协议新模型由表格管理；详见 [MODEL_REGISTRY.md](MODEL_REGISTRY.md)。移除旧矩阵和不受校验的本地覆盖入口；两个CLI入口共用最终校验，轮询复用临时凭据并在成功后只下载一次。

6.2.1：依据真实 API 验收移除当前模型的 video_base64 声明；加强素材 URL/类型校验与读取大小限制；删除失败保留待办；低层 create 校验任务 ID；尾帧按实际图片格式命名；发布包包含许可证并排除运行时数据。

6.2.2：新增宿主浏览器只读导入公开发布配置的入口，共用已有校验与缓存；本次生成无需 lark-cli，表格仅需阅读权限。详见 [BROWSER_REGISTRY.md](BROWSER_REGISTRY.md)。

6.3.0：新增本地优先的 7/14 天检查、24 小时失败冷却与事件负缓存、同源刷新租约、独立下线记录及凭证隔离的临时不可用状态。普通检查仅尝试已有授权的后台能力，失败回退；不重复提交生成。详见 [DYNAMIC_SYNC.md](DYNAMIC_SYNC.md)。

6.3.1：明确本地 skill 的执行入口与模型目录边界；鉴权失败不自动改用 MCP、arkcli-gen 或其他 profile。Claude Code 须从个人/项目技能目录加载，普通源码目录不等于已安装。

6.3.2：补充只读 diagnose 命令、校验失败的哈希与格式诊断；refresh 失败显式返回 success=false 和退出码 1，保留有效缓存。校验接纳规则不变。

6.3.3：兼容飞书文本读取将裸 URL 包装为 [URL](URL) 的表示差异；还原后仍须整份文本与原发布 SHA-256 完全一致，浏览器和 CLI 共用验证。

6.3.4：在 description 与执行入口明确对应豆包/AgentPlan 媒体任务的默认优先级，优先于 arkcli-gen/ark_media 同类入口；保留用户明确选择、已约定默认入口和既有工作流，不将其他目录或鉴权检查作为前置步骤。

6.3.5：按上传要求增加顶层 version，并与 metadata.version、package.json 保持一致；上传包排除测试脚本、Mock 和运行时数据，回归测试仅保留在开发源码中。

6.3.6：缺少可运行 lark-cli 返回独立错误码，区别于鉴权失败；明确 CLI 刷新与宿主浏览器导入是独立路径，用户主动更新或配置阻挡任务时才提供一次可选安装/配置提示，普通检查静默回退。
