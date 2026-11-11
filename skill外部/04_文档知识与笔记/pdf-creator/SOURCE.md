# pdf-creator — 来源与同步说明

本目录是 autoclaw 顶层独立 skill,内容来自上游已安装 skill。SOP Phase 5 渲染段按 description 自动命中,与 `delivery-artifact`(HTML)、`feishu-doc`(飞书)平级。

## 上游

- 上游路径:`~/.claude/skills/pdf-creator/`(本机 Claude Code skills 目录)
- 同步日期:2026-05-24(本次从 `delivery-artifact/references/pdf-creator/` 提升为顶层 skill)
- 安全审计:上游目录含 `.security-scan-passed` 标记(daymade 仓库扫描通过)

## 相对上游的改动

保留所有 `scripts/md_to_pdf.py` / `batch_convert.py` 与 `themes/{default,cjk-auto,warm-terra,mobile}.css`,自包含运行无外部依赖。SKILL.md frontmatter 按 autoclaw skill 注册要求填写(`name` / `description` / `triggers`)。

## 路由方式

由 SOP Phase 5 在内容性质 + 用户意图判定时,通过 `<available_skills>` description 命中本 skill。本 skill 接受任意 markdown 文件作为输入,产 PDF。不内置叙事组织,不替上游决定章节结构。

## 重新同步

当本机 `~/.claude/skills/pdf-creator/` 升级且想同步进 autoclaw 包时:

```bash
SRC=~/.claude/skills/pdf-creator
DST=resources/skills-domestic/pdf-creator
rm -rf $DST/scripts $DST/themes
cp -r $SRC/scripts $SRC/themes $DST/
# SKILL.md 不直接覆盖——上游 SKILL.md 是 Claude Code 通用版本,
# autoclaw 这边的 SKILL.md 已按 SOP Phase 5 渲染定位重写 frontmatter,
# 同步时手动 diff 正文(去除 YAML frontmatter 部分),合并改动。
# 完成后更新本文件的"同步日期"。
```
