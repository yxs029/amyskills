# autoclaw常用技能 — 去重增补清单

> 生成日期：2026-11-03。来源：本机 autoClaw 技能目录（`.openclaw-autoclaw\skills` + `.agents\skills` 两个符号链接）。
> 去重方式：候选技能与仓库已有 64 个技能（按 SKILL.md frontmatter `name` 建索引）逐文件 SHA-256 比对，文本差异再按 git 换行归一化复核。

## 判定结果（21 个候选）

| 候选技能 | 判定 | 说明 |
| --- | --- | --- |
| feishu-doc | ✅ 收录 | 库内缺失；本机 `cache/` 含私有飞书文档内容，已剔除 |
| feishu-chat-history | ✅ 收录 | 库内缺失 |
| feishu-cron-reminder | ✅ 收录 | 库内缺失 |
| dws | ✅ 收录 | 库内缺失；钉钉技能全家桶（110 文件） |
| getnote | ✅ 收录 | 库内 `getnote-openclaw-main` 是另一变体；本版（autoClaw 安装版）references 更全，内容差异 1000+ 行 |
| skill-vetter | ✅ 收录 | 库内仅有 zip 原始包，无解包目录 |
| bilibili-cli | ⏭️ 跳过 | 与 `autoClaw的SKILL库/bilibili-cli` 完全一致（哈希级相同） |
| apify-ultimate-scraper | ⏭️ 跳过 | 完全一致 |
| deep-research / wps / a-stock-analysis / 挖券券儿 / financial-suite / pdf-creator / frontend-slides / ui-ux-pro-max / pptx-swarm / skill-creator / write-skill / memory / find-skills | ⏭️ 跳过 | 与库内副本内容一致；哈希差异仅为 LF/CRLF 换行与 `.bundled-hash`、`_store_meta.json` 等商店元数据（git 换行归一化后零内容差异） |
| autoglm-*（9 个） | ⏭️ 已在库 | `autoClaw的SKILL库` 已收录同名技能 |
| autoclaw-billing / autoclaw-im-cron | 🚫 不收录 | AutoClaw 平台内部业务技能，不随公开库分发 |
| alipay-authenticate-wallet / alipay-payment-skill | 🚫 不收录 | 支付宝官方技能包，官方已开源（github.com/alipay/payment-skills，Apache 2.0），重复无意义 |

## 安检说明

- 全部候选扫描硬编码密钥/令牌/私钥/cookie：未发现真实凭据。
- feishu-doc 脚本凭据一律读环境变量（`FEISHU_APP_ID` / `FEISHU_APP_SECRET`），`config.json` 为空模板。
- getnote 含 Get笔记 为 OpenClaw 预注册的公开 `client_id`（OAuth 公开标识，非机密）。
- 复制时统一剔除商店元数据（`_store_meta.json` / `_meta.json` / `.bundled-hash` / `.security-scan-passed`）与 `cache/` 私有缓存，与库内既有约定一致。
