# 调用示例

在 skill 根目录运行。示例 URL 需替换成用户实际参考图；添加 `--dry-run` 检查请求不会消耗额度。

先用 `node scripts/generate.js --list-models` 查看当前已发布模型。单独 dry-run 使用离线配置；加 `--refresh-models` 可读取远端后预览。以下为内置 Flash / Pro 示例，实际状态与限制以当前配置为准。

## 普通生图与显式选模

```bash
node scripts/generate.js --model auto --prompt '一只猫趴在窗台上'
node scripts/generate.js --model flash --prompt '一张花卉插画' --size 1.5K --output_format png
node scripts/generate.js --model doubao-seedream-5-0-flash --prompt '一张海边日落照片' --size 2048x1024
node scripts/generate.js --model pro --prompt '高精度产品海报，标题为「夏日限定」' --size 2K
node scripts/generate.js --model pro --prompt '一张花卉插画' --optimize_prompt_mode fast
```

## 交互编辑、拆图层与透明编辑

下列操作 Flash 和 Pro 均支持，可以显式选择任一模型。

```bash
node scripts/generate.js --model flash --interactive_edit true --reference_images '["https://example.com/marked.png"]' --prompt '在蓝色框内添加电视机，移除蓝框，保持其余布局不变'
node scripts/generate.js --model flash --reference_images '["https://example.com/source.png","https://example.com/scene.png"]' --prompt '将图1<bbox>179 283 796 986</bbox>的主体放到图2<bbox>118 331 933 871</bbox>位置'
node scripts/generate.js --model flash --layer_decomposition true --reference_images '["https://example.com/poster.png"]'
node scripts/generate.js --model pro --layer_decomposition true --reference_images '["https://example.com/poster.png"]' --prompt '拆出人物、标题文字和右下角装饰图标' --size 2K
node scripts/generate.js --model flash --background transparent --reference_images '["https://example.com/alpha-layer.png"]' --prompt '将鹦鹉改为孔雀，保持透明背景'
```

透明编辑输入需实际带透明通道。坐标应来自用户提供的定位信息，不要猜测。

## 从 Lite 迁移

将原有 `--model lite` 或 Lite 模型 ID 更新为 `--model flash`；环境变量同样需要更新。仅替换模型名不等于参数兼容：移除组图、流式、联网与 reference_strength，分辨率调整为支持的档位，普通参考图最多 10 张。若这些是用户明确要求，先说明限制并取得新的需求，不要自动删除参数。

所有参数见 [SKILL.md](../SKILL.md)，输入限制见 [MODELS.md](MODELS.md)。
