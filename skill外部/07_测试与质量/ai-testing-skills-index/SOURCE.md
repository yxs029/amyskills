# 来源说明 / SOURCE

## 收录对象

本目录收录的是**一篇公开文章的整理资料**，不是从上游下载的技能本体。

| 项目 | 内容 |
| --- | --- |
| 原始文章 | 《AI 测试 Skill 大全，我日常在用的 27个，夯爆了！》 |
| 作者 | 狂师 |
| 公众号 | 测试开发技术 |
| 发布时间 | 原创，2026-11-05 08:50，湖北 |
| 原文 URL | https://mp.weixin.qq.com/s/jP9sRqey8bJk6kzDGp8Tlw |
| 主题 | 软件测试技术 / AI 测试方向的 27 个自研 Agent Skill 全景清单 |
| 本地收录日 | 2026-11-05 |
| 收录分类 | `市面上的测试领域skills/` |
| 目录名 | `kuangshi-ai-testing-27-skills-index`（ASCII，避免 zip 中文条目乱码） |

## 公开镜像（用于交叉核对）

| 站点 | URL |
| --- | --- |
| 博客园（同文 27 个版） | https://www.cnblogs.com/jinjiangongzuoshi/p/23555484 |
| 腾讯云开发者社区（2026-09-29，25 个旧版） | https://cloud.tencent.com/developer/article/2752799 |
| 51CTO 博客（25 个旧版） | https://blog.51cto.com/jinjiangongzuos/14972785 |
| 掘金（25 个旧版） | https://juejin.cn/post/7690414588748464138 |
| 掘金（新增 2 个业务场景技能专文） | https://juejin.cn/post/7700822176635191323 |
| InfoQ 写作社区（新增 2 个技能专文） | https://xie.infoq.cn/article/ae4c26566b0bdb59aea681ce6 |
| Skill 技能商店 | https://testfather.cn/skills |

25 → 27 的版本差异即由旧版文章与本次文章对照得出，新增 `api-scenario-modeler`、`api-scenario-runner` 两个技能。

## 为什么没有技能本体（2026-11-05 逐项核验）

1. **GitHub 地址是占位符**：原文「在线安装 / 克隆仓库」代码块写的是 `npx skills add xxx/api-scenario-modeler`、`git clone git@github.com:xxx/skills.git`，`xxx` 未替换，真实仓库地址未公开。
2. **GitHub 仓库搜索**：`testfather skills` 返回 0 个结果；`req-to-user-story`、`api-scenario-modeler` 关键词命中的均为无关仓库，没有该套技能的公开仓库。
3. **技能商店需登录**：`https://testfather.cn/skills` 实测页面内容为「AI 测试开发导航 - 一站式学习交流社区 / 立即登录」，无法取得技能详情或下载直链。
4. **全套技能包属付费权益**：原文说明「知识星球『AI 测开进化圈』的成员进圈即领全套 Skill」，未代取、未绕过任何登录或付费限制。
5. **本地技能库核查**：`F:\OPRASE-AMY\08AI操作系统\MySkills` 与 `E:\autoclaw\amyskills` 内均无这 27 个目录（检索 `req-to-user-story`、`api-*`、`ui-*`、`generator-testcase-*` 等，无命中）；`市面上的测试领域skills/` 原本只有 `test-master-0.1.0.zip` 与 `test-patterns-1.0.0.zip` 两个包。

## 收录方式

- 只整理**公开文章中的描述性文字**：技能目录名、逐条功能说明、三条流水线流程图、获取方式说明。
- 逐条说明保持原文措辞，不改写、不扩写、不猜测实现细节。
- 流程图：原文 ASCII 图原样保留在 `README.md` / `ARTICLE.md`；`SKILL.md` 中的 Mermaid 图为依据原文流程重绘，节点名严格使用原技能名，已标注「依据原文流程图重绘」。
- **未生成任何占位 `SKILL.md`**，避免把资料误当成已安装技能。
- 唯一新建的 `SKILL.md` 是**导航型索引技能**，其 frontmatter 与正文首段均明确声明「不含 27 个技能本体」。

## 免责与版权

- 27 个技能及文章内容版权归原作者狂师所有；本包仅为个人学习收藏用途的公开资料索引，不代表作者授权分发，也不含任何未公开内容。
- 若后续从正规渠道（作者公开的 GitHub 仓库 / testfather.cn 登录下载 / 知识星球成员权益）拿到本体，应补齐到本分类，并更新 `README.md` 第八节「本体待补清单」的状态。
- 本包不含任何密钥、账号凭据或需鉴权内容。

## 关联

- 同级分类：`市面上的测试领域skills/`
- 发布工具：`toamyskillhub`（`F:\OPRASE-AMY\08AI操作系统\MySkills\toamyskillhub`）
- 目标开源仓库：`https://github.com/yxs029/amyskills.git`
