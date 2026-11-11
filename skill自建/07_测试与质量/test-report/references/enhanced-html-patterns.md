# Enhanced HTML Patterns - Concrete Code Snippets

Extracted from `SRMPRO/文档库/report/enhanced/*.html` reference reports.
These are the exact CSS/HTML/JS patterns that produce the user-mandated format.

## CSS Foundation

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f0f2f5;
  color: #333;
  line-height: 1.6;
}
.report-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
```

## Block 1: Title Area CSS

```css
.report-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.report-header h1 { font-size: 28px; margin-bottom: 8px; }
.report-header .subtitle { font-size: 14px; opacity: 0.9; }
```

## Block 2: Statistics Cards CSS

```css
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}
.stat-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-top: 4px solid #ddd;
}
.stat-card .stat-num { font-size: 36px; font-weight: 700; }
.stat-card .stat-label { font-size: 14px; color: #666; margin-top: 4px; }
.stat-total { border-top-color: #1890ff; }
.stat-total .stat-num { color: #1890ff; }
.stat-pass  { border-top-color: #52c41a; }
.stat-pass .stat-num  { color: #52c41a; }
.stat-fail  { border-top-color: #ff4d4f; }
.stat-fail .stat-num  { color: #ff4d4f; }
.stat-skip  { border-top-color: #faad14; }
.stat-skip .stat-num  { color: #faad14; }
```

## Block 3: Priority Statistics CSS

```css
.priority-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}
.priority-card {
  background: white;
  border-radius: 8px;
  padding: 15px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-left: 4px solid #ddd;
}
.priority-card .pri-label { font-size: 14px; font-weight: 600; }
.priority-card .pri-num   { font-size: 20px; font-weight: 700; margin: 4px 0; }
.priority-card .pri-rate  { font-size: 12px; color: #999; }
.pri-p0 { border-left-color: #cf1322; }
.pri-p0 .pri-label, .pri-p0 .pri-num { color: #cf1322; }
.pri-p1 { border-left-color: #fa8c16; }
.pri-p1 .pri-label, .pri-p1 .pri-num { color: #fa8c16; }
.pri-p2 { border-left-color: #1890ff; }
.pri-p2 .pri-label, .pri-p2 .pri-num { color: #1890ff; }
```

## Block 4: Pass-rate Progress Bar CSS

```css
.pass-rate-bar-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.pass-rate-bar-container .label { font-size: 14px; margin-bottom: 8px; }
.pass-rate-track {
  background: #e8e8e8;
  border-radius: 10px;
  height: 24px;
  overflow: hidden;
  position: relative;
}
.pass-rate-fill {
  height: 100%;
  border-radius: 10px;
  transition: width 0.6s ease;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  color: white;
  font-size: 12px;
  font-weight: 600;
}
/* Colors set inline via style attribute based on pass-rate threshold */
```

## Block 5: Case Detail Card CSS + HTML

```css
.case-card {
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-left: 4px solid #52c41a; /* green for pass */
}
.case-card.case-fail  { border-left-color: #ff4d4f; }
.case-card.case-warn  { border-left-color: #faad14; }
.case-card.case-skip  { border-left-color: #d9d9d9; }

.case-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}
.case-id { font-family: monospace; font-size: 13px; color: #1890ff; }
.case-title { font-size: 15px; font-weight: 600; flex: 1; }

.priority-tag { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.priority-tag.pri-p0 { background: #fff1f0; color: #cf1322; }
.priority-tag.pri-p1 { background: #fff7e6; color: #fa8c16; }
.priority-tag.pri-p2 { background: #e6f7ff; color: #1890ff; }

.status-tag { padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
.status-tag.status-pass { background: #f6ffed; color: #52c41a; }
.status-tag.status-fail { background: #fff1f0; color: #ff4d4f; }
.status-tag.status-warn { background: #fffbe6; color: #faad14; }

.case-body { padding: 12px 16px; }
.actual-result { margin-bottom: 8px; font-size: 14px; }
.actual-result .label { color: #666; }

/* Defect Box */
.defect-box {
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-left: 4px solid #ff4d4f;
  border-radius: 4px;
  padding: 12px;
  margin: 8px 0;
  font-size: 14px;
}
.defect-box .defect-title { font-weight: 600; color: #cf1322; margin-bottom: 4px; }

/* Steps */
.steps { margin: 10px 0; }
.step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 14px;
  border-left: 3px solid #d9d9d9;
}
.step .step-num {
  background: #f0f0f0; color: #666;
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; flex-shrink: 0;
}
.step.step-pass { border-left-color: #52c41a; background: #f6ffed; }
.step.step-fail { border-left-color: #ff4d4f; background: #fff1f0; }
.step.step-obs  { border-left-color: #1890ff; background: #e6f7ff; }

/* Screenshot Gallery */
.screenshot-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}
.shot-thumb {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  transition: transform 0.2s;
}
.shot-thumb:hover { transform: scale(1.03); }
.shot-thumb img { width: 100%; display: block; }
.shot-label { padding: 4px 8px; font-size: 12px; color: #666; background: #fafafa; }

/* Blank shot warning */
.shot-thumb.blank-shot {
  border: 2px dashed #faad14;
  position: relative;
}
.shot-thumb.blank-shot::after {
  content: '⚠️ 可能空白';
  position: absolute;
  top: 4px; left: 4px;
  background: rgba(250,173,20,0.9);
  color: white; font-size: 10px;
  padding: 2px 6px; border-radius: 3px;
}
```

## Block 6: Defect Summary Table CSS

```css
.defect-table-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.defect-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.defect-table th {
  background: #fafafa;
  padding: 10px;
  text-align: left;
  border-bottom: 2px solid #f0f0f0;
  font-weight: 600;
}
.defect-table td {
  padding: 10px;
  border-bottom: 1px solid #f0f0f0;
}
.severity-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.severity-badge.sev-p0   { background: #fff1f0; color: #cf1322; }
.severity-badge.sev-p1   { background: #fff7e6; color: #fa8c16; }
.severity-badge.sev-p2   { background: #e6f7ff; color: #1890ff; }
.severity-badge.sev-info { background: #f5f5f5; color: #999; }
```

## Block 7: Test Summary CSS

```css
.summary-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.summary-section h2 { font-size: 18px; margin-bottom: 12px; }
.summary-stats { display: flex; gap: 20px; margin-bottom: 12px; flex-wrap: wrap; }
.summary-stat { font-size: 14px; }
.summary-stat .num { font-size: 24px; font-weight: 700; }
.summary-stat.pass .num  { color: #52c41a; }
.summary-stat.warn .num  { color: #faad14; }
.summary-stat.fail .num  { color: #ff4d4f; }
.summary-stat.shot .num  { color: #1890ff; }
.key-experience { margin-top: 12px; }
.key-experience li { margin-bottom: 6px; font-size: 14px; }
```

## Lightbox JS

```javascript
function openLightbox(src) {
  var lb = document.getElementById('lightbox');
  var img = document.getElementById('lightbox-img');
  img.src = src;
  lb.style.display = 'flex';
}
function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeLightbox();
});

/* Lightbox CSS */
// <div id="lightbox" onclick="closeLightbox()" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;justify-content:center;align-items:center;cursor:pointer;">
//   <img id="lightbox-img" style="max-width:90%;max-height:90%;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
// </div>
```

## Pass-rate Color Threshold Logic (Python)

```python
def pass_rate_color(rate):
    if rate >= 80:
        return '#52c41a'  # green
    elif rate >= 50:
        return '#faad14'  # orange
    else:
        return '#ff4d4f'  # red
```

## Test Conclusion Logic

```python
def test_conclusion(stats, priorities, defects):
    p0_pass = priorities['p0']['pass']
    p0_total = priorities['p0']['total']
    p1_pass = priorities['p1']['pass']
    p1_total = priorities['p1']['total']
    p0_p1_defects = [d for d in defects if d.get('severity') in ('P0', 'P1')]

    if p0_pass < p0_total or p0_p1_defects:
        return '不通过', 'red'
    elif p1_pass / p1_total < 0.9:
        return '有条件通过', 'orange'
    else:
        return '通过', 'green'
```
