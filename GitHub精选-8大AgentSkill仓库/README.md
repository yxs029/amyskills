# GitHub 精选 8 大 Agent Skill 仓库

> 收录自公众号文章：狂师《[GitHub 上最值得装的 8 个 Agent Skill 仓库](https://mp.weixin.qq.com/s/d7ExBV2bfkEQH1MBXe5jDQ)》（2026-11-03）。收录日期：2026-11-04。
> 共 **8 个上游仓库 / 88 个 SKILL.md / 787 个文件**。所有上游仓库均经 GitHub API 核验真实存在。

## 仓库清单

| # | 目录 | 上游仓库 | 技能数 | 文件数 | 体积 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `01-andrej-karpathy-skills` | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | 1 | 6 | 0.03 MB | karpathy-guidelines（写代码四条军规） |
| 2 | `02-mattpocock-skills` | [mattpocock/skills](https://github.com/mattpocock/skills) | 39 | 156 | 0.71 MB | grill / tdd 等近 40 个工程与效率技能 |
| 3 | `03-ponytail` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | 6 | 180 | 11.66 MB | ponytail 七级阶梯（少写代码） |
| 4 | `04-addyosmani-agent-skills` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 25 | 214 | 1.06 MB | 九条命令覆盖完整开发周期 |
| 5 | `05-taste-skill` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 1 | 67 | 2.95 MB | design-taste-frontend（真实素材做设计） |
| 6 | `06-impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 1 | 70 | 2.25 MB | impeccable 前端设计语言与 62 条规则 |
| 7 | `07-Understand-Anything` | [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | 9 | 79 | 0.62 MB | 代码库知识图谱 /understand 命令族 |
| 8 | `08-obsidian-skills` | [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) | 6 | 15 | 0.05 MB | Obsidian CEO 官方 6 个技能 |

每个目录下另附 `SOURCE.md`（来源、技能清单、收录方式），同级目录提供 `<目录名>.zip` 原始安装包。

## 收录口径

- **原文保真**：保持上游目录结构与文件名，不改写任何 `SKILL.md`。
- **去重**：仅保留一份技能本体，剔除各平台（`.claude/`、`.cursor/`、`.openclaw/` 等）下的重复副本。
- **排除**：>100MB 文件、`node_modules/`、`.git/`、`__pycache__/`、符号链接、测试 fixtures 与主页大图。
- `06-impeccable`（上游 876MB）与 `07-Understand-Anything`（35MB）采用 GitHub API 精准抓取技能目录；其余 6 个采用 main 分支完整源码包解包。

## 使用

把单个技能目录（含 `SKILL.md`）复制到你的 Agent 的 skills 目录即可。安装前建议先做一次安全审查。
各上游技能版权归原授权方所有，二次分发请遵循对应开源协议。
