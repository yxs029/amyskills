# PDF 报告 HTML 模板结构

> 从 Siri 项目验证过的 HTML→PDF 渲染模板，后续拆解直接复用。

## 关键 CSS

```css
/* A4 页面 + 底部留 26mm 给二维码水印 */
@page { size: A4; margin: 18mm 18mm 26mm 18mm; }

/* 二维码水印：position:fixed 让 Chrome Headless 自动每页重复 */
.qr-watermark {
  position: fixed;
  bottom: 8mm;
  right: 10mm;
  width: 22mm;
  text-align: center;
  z-index: 9999;
}
.qr-watermark img {
  width: 22mm; height: 22mm;
  background: #fff; padding: 1mm;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
.qr-watermark .qr-label { font-size: 7pt; color: #4a5568; margin-top: 1mm; font-weight: 600; }
.qr-watermark .qr-sub   { font-size: 6pt; color: #718096; margin-top: 0.5mm; }
```

## 封面 HTML 结构

```html
<div class="cover">
  <div class="cover-content">
    <!-- ⚠️ 版本警告条（语料来自逆向时必加） -->
    <div class="cover-warning">
      ⚠️ <b>版本说明</b>：本报告语料来自第三方逆向分析资源，仅作技术学习研究。
    </div>
    <!-- 标签 -->
    <span class="cover-badge">🔍 写给开发者 & 企业经营者</span>
    <!-- 大标题 -->
    <h1>XXX 内部<br>使用说明书<br>大白话版</h1>
    <!-- 副标题 -->
    <div class="subtitle">N 张"小纸条"到底说了啥<br>铁律 + 场景 + 流程图</div>
    <!-- 元数据网格 -->
    <div class="meta">
      <div class="meta-item">
        <div class="meta-label">作者</div>
        <div class="meta-value">测测（基于 Hermes Agent）</div>
      </div>
      ...
    </div>
  </div>
  <div class="cover-footer">
    <span>📄 测测出品 · 仅供学习研究</span>
    <span>共 {PAGES} 页 · 公众号名</span>
  </div>
</div>
```

## 章节封面 HTML 结构

```html
<div class="chapter-cover">
  <div class="chapter-num">1</div>
  <div class="chapter-title">XXX 是谁？</div>
  <div class="chapter-sub">从那份核心文件里抽出来的 N 件事</div>
  <div class="chapter-tag">人格 · IDENTITY</div>
</div>
<!-- 章节正文 -->
{sections["l1"]}
```

## 渲染命令

```bash
# 第一次渲染（拿页数）
google-chrome --headless --no-sandbox --disable-gpu \
  --user-data-dir=/tmp/chrome-pdf-r1-$$ \
  --no-pdf-header-footer \
  --print-to-pdf=output.pdf \
  file:///path/to/report.html

# 提取页数
python3 -c "
import re
with open('output.pdf','rb') as f:
    print(len(re.findall(rb'/Type[\s]*/Page[^s]', f.read())))
"

# 替换 {PAGES} 占位符后第二次渲染
google-chrome --headless --no-sandbox --disable-gpu \
  --user-data-dir=/tmp/chrome-pdf-r2-$$ \
  --no-pdf-header-footer \
  --print-to-pdf=output.pdf \
  file:///path/to/report.html
```

## 验证命令

```bash
# 文本验证（比视觉 AI 靠谱）
pdftotext -layout output.pdf - | grep -c "关键词"

# 页面转 PNG（预览用）
pdftoppm -png -r 150 -f 1 -l 1 output.pdf preview

# 二维码覆盖率验证
pdftotext -layout output.pdf - | grep -c "扫码关注"
```
