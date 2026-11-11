#!/usr/bin/env bash
# 完整的 web-exploratory-tester 流程示例
# 目标: down.mptext.top
# 用法: bash run_exploratory_test.sh <target_url> [output_dir]

set -e
TARGET="${1:-https://down.mptext.top}"
OUTPUT="${2:-./dogfood-output}"

echo "🧪 Web Exploratory Tester"
echo "目标: $TARGET"
echo "输出: $OUTPUT"
echo ""

mkdir -p "$OUTPUT/screenshots"

# === Phase 1: Plan ===
echo "📋 Phase 1: 自动 sitemap 发现..."
python3 "$(dirname "$0")/sitemap_crawler.py" "$TARGET" --depth 2 --output "$OUTPUT/sitemap.md"

# === Phase 3: API Probe ===
echo ""
echo "🔌 Phase 3: 后端 API 探测..."
# 提取所有 API 路径
APIS=$(grep -oE '`(/api/[^`]+)`' "$OUTPUT/sitemap.md" | sort -u | tr -d '`' | head -10)
if [ -n "$APIS" ]; then
    echo "$APIS" > "$OUTPUT/endpoints.txt"
    python3 "$(dirname "$0")/api_probe.py" "$TARGET" --inventory "$OUTPUT/endpoints.txt" --output "$OUTPUT/api_probe.md"
fi

# === Phase 3b: 死链探测 ===
echo ""
echo "🔗 Phase 3b: 404 / 死链 / 敏感路径探测..."
python3 "$(dirname "$0")/dead_link_checker.py" "$TARGET" --common --output "$OUTPUT/dead_links.md"

# === Phase 2: Explore (Agent 在 Hermes 内执行 browser_*) ===
echo ""
echo "🌐 Phase 2: 浏览器探索 (需要 Agent 执行 browser_*)"
echo "   → 访问 SKILL.md Phase 2 步骤"

# === Phase 5: Render ===
echo ""
echo "📊 Phase 5: 渲染最终报告..."
if [ -f "$OUTPUT/issues.json" ]; then
    python3 "$(dirname "$0")/report_renderer.py" "$OUTPUT/issues.json" "$OUTPUT/report.md"
    echo "✅ 报告: $OUTPUT/report.md"
else
    echo "⚠️  跳过报告渲染（需要 issues.json）"
    echo "   Agent 探索完成后调用 report_renderer.py 生成"
fi

echo ""
echo "📁 产出:"
ls -la "$OUTPUT/"
