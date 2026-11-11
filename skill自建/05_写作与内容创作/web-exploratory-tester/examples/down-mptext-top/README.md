# 示例：down.mptext.top 探索测试

## 这是什么
用 **web-exploratory-tester** skill 跑出的第一份真实报告。展示一个完整的端到端跑通是什么样。

## 目标
- **URL:** https://down.mptext.top
- **类型:** 公众号文章下载 SaaS
- **耗时:** 15 分钟
- **结果:** 14 个 issue（2 Critical / 4 High / 5 Medium / 3 Low）

## 文件清单
- `report.md` — 最终 dogfood 报告（21KB）
- `screenshots/01-homepage.png` — 落地页证据
- `screenshots/02-single-article-page.png` — 单篇下载页
- `screenshots/03-empty-login-dialog.png` — 🔴 Critical bug 证据

## 怎么用这个示例

### 学习报告格式
看 `report.md` 了解标准 dogfood 报告长啥样：
- Executive Summary
- Issue 详情（severity/category/url/steps/expected/actual）
- Issues Summary Table
- Testing Coverage
- Notes

### 复现这个测试
```bash
# 用 skill 完整重跑一遍
bash scripts/run_exploratory_test.sh https://down.mptext.top ./repro-test

# 然后按 SKILL.md Phase 2 用 browser_* 走一遍 dashboard
# 最后调用 report_renderer.py 生成报告
```

### 作为模板
把这个 `report.md` 拷一份，把内容换成你的目标即可：
```bash
cp -r examples/down-mptext-top my-target-test
# 改 report.md
```

## 学到的关键经验
详见 SKILL.md "关键经验" 章节。简而言之：
1. **不要相信 vision 工具对深色/中文 UI 的判断**（实测多次严重误识别）
2. **Nuxt SPA 所有未知路径都返回 200**（必须主动探测）
3. **AI 探索测试 ROI 极高**（15 分钟 = 14 个 issue）
