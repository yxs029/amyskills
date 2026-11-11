# Web Exploratory Tester 模板目录

## 文件清单

- `report.md.j2` — 报告 Jinja2 模板（如果不用 report_renderer.py 可手动用）
- `issue.json` — 单个 issue 的 JSON 结构样例

## 报告模板（简化版，直接用 report_renderer.py 即可）

报告渲染主要靠 `scripts/report_renderer.py`，它会读 `issues.json` 生成最终报告。
这里放 JSON 样例供参考。

## `issues.json` 结构样例

```json
{
  "target_url": "https://example.com",
  "date": "2026-06-03",
  "scope": "全站 + 后端 API",
  "duration_minutes": 15,
  "overall_assessment": "发现 X 个严重问题，建议立即修复",
  "issues": [
    {
      "id": 1,
      "title": "登录弹窗完全空白",
      "severity": "Critical",
      "category": "Functional",
      "url": "/dashboard",
      "description": "...",
      "steps_to_reproduce": [
        "访问 /dashboard",
        "点击左下角'登录公众号'按钮",
        "观察弹窗"
      ],
      "expected": "显示扫码登录二维码",
      "actual": "弹窗只有标题和关闭按钮",
      "screenshot": "screenshots/01-empty-dialog.png",
      "console_errors": ""
    }
  ],
  "coverage": {
    "pages_tested": ["/", "/dashboard", "/dashboard/single", "/dashboard/api"],
    "features_tested": ["登录", "添加文章", "API 文档浏览", "代理节点配置"],
    "not_tested": ["登录后功能", "移动端响应式", "性能测试"],
    "blockers": ["Issue #1 阻止了登录后测试"]
  },
  "notes": "详细经验沉淀..."
}
```

## 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `target_url` | ✅ | 目标 URL |
| `date` | ✅ | 测试日期 YYYY-MM-DD |
| `scope` | ✅ | 测试范围 |
| `duration_minutes` | ⭕ | 耗时（分钟）|
| `overall_assessment` | ⭕ | 一句话总结 |
| `issues` | ✅ | issue 数组 |
| `coverage` | ⭕ | 覆盖范围 |
| `notes` | ⭕ | 备注 |
| `issue.id` | ✅ | 内部 ID（最终编号会被重排）|
| `issue.title` | ✅ | 标题 |
| `issue.severity` | ✅ | Critical / High / Medium / Low |
| `issue.category` | ✅ | Functional / Visual / Accessibility / Console / UX / Content |
| `issue.url` | ✅ | 发现该 issue 的 URL |
| `issue.description` | ✅ | 详细描述 |
| `issue.steps_to_reproduce` | ✅ | 复现步骤数组 |
| `issue.expected` | ✅ | 期望行为 |
| `issue.actual` | ✅ | 实际行为 |
| **`issue.screenshot`** | ✅ **必填** | 缺陷全貌截图路径（相对 output_dir）|
| `issue.screenshot_annotated` | ⭐ 强烈推荐 | 标注截图路径（标出缺陷位置）|
| `issue.screenshot_compare` | 💡 可选 | 对比截图路径（正常 vs 异常）|
| `issue.dom_snapshot` | ⭕ | DOM 文本证据 |
| `issue.console_errors` | ⭕ | 相关 console 错误 |

## 📸 截图字段硬性要求

> **图多于文：每个 Issue 必须至少 1 张截图！**

报告渲染器（`report_renderer.py`）对每个 issue 强制检查：
- ✅ 有 `screenshot` → 正常渲染
- ⚠️ 没有 `screenshot` → 报告中插入警告："此 Issue 缺少截图证据"

详见 SKILL.md "Phase 4: Collect Evidence" 章节。
