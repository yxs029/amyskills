# HTML 测试报告截图增强配方

**适用场景**：测试跑完后，老大说"把截图关联到报告里"、"便于人类核对测试过程和结果"。已有 HTML 报告 + 截图文件，需要把步骤截图内嵌到报告里，让用例 ID 和步骤图片一一对应。

实战日期：2026-07-07（SRMPRO 文档库 v3 全量测试 14 模块 12 份 HTML 报告 454 张截图）。

---

## 0. 核心思路

**不做新报告，改老报告**——已有 HTML 报告保留原结构，在每个用例的步骤区域注入截图画廊。

**为什么用 base64 内嵌而不是相对路径 `<img src="xxx.png">`**：
- 单文件自包含——发给老大一个 HTML 打开即看，不依赖外部文件路径
- 飞书发送方便——一个文件搞定，不用打包 zip
- 缺点：文件大（3-11MB/份），但飞书能发

---

## 1. 截图索引构建

截图文件命名规范：`{CaseID}_step{N}_{描述}.png`

```python
import re
from pathlib import Path

screenshot_index = {}  # key: "TC-SEC-001", value: [(filepath, step_n, desc)]

for sdir in SCREENSHOT_DIRS:
    for f in sdir.iterdir():
        if f.suffix.lower() != '.png': continue
        m = re.match(r'(.+?)_step(\d+)_(.*)\.png', f.name)
        if m:
            case_id = m.group(1)
            step_n = int(m.group(2))
            desc = m.group(3)
            if case_id not in screenshot_index:
                screenshot_index[case_id] = []
            # 去重（report/ 和 A_执行层/截图/ 可能有同名文件）
            existing = [x for x in screenshot_index[case_id] if x[0].name == f.name]
            if not existing:
                screenshot_index[case_id].append((f, step_n, desc))

for k in screenshot_index:
    screenshot_index[k].sort(key=lambda x: x[1])  # 按 step 号排序
```

**⚠️ 坑：TC_STAT_001 vs TC-STAT-001**  
统计卡片区报告用下划线 `TC_STAT_001`，截图用连字符 `TC-STAT-001`。查询时必须做归一化：
```python
def lookup_case_id(raw):
    return raw.replace('_', '-', 1) if raw.startswith('TC_') else raw
```

---

## 2. 四种 HTML 报告格式检测与注入

**⚠️ 核心坑：格式检测不能用 `'case-card' in content`**  
因为 CSS 定义里也有 `.case-card{...}`，会误判。必须检测 HTML body 部分：

```python
css_end = content.find('</style>') + 8
body_html = content[css_end:]  # 只在 body 里检测
```

### 格式 A：toggle/cd 格式（数据权限控制）

```html
<div class="case">
  <h3 onclick="toggle('TC-PERM-001')">❌失败 TC-PERM-001</h3>
  <div id="TC-PERM-001" class="cd" style="display:none">...</div>
</div>
```

注入点：`id="TC-PERM-001"` 的 cd div 内部末尾。

```python
if 'onclick="toggle' in body_html:
    cd_matches = list(re.finditer(r'id="(TC-[A-Z]+-?\d+)"[^>]*class="cd"', body_html))
    for m in reversed(cd_matches):
        cid = m.group(1)
        # ... find closing </div> before next "case" div, insert gallery
```

### 格式 B：case-card + case-body 格式（报表下载）

```html
<div class="case-card" id="TC-REPORT-001">
  <div class="case-header"><span class="case-id">TC-REPORT-001</span>...</div>
  <div class="case-body">...</div>
</div>
```

注入点：case-body 的最后一个 `</div>` 前。

**⚠️ 检测必须用 `'class="case-card"'` in body_html（带引号），不能用 `'case-card' in content`。**

### 格式 C：case-header/case-body 无 case-card（E2E/筛选/集成）

```html
<div class="case-header">
  <div class="case-id">E2E-001</div>  <!-- ⚠️ 用 div 不是 span -->
  <div class="case-name">核心浏览流程</div>
</div>
<div class="case-body">...</div>
```

**⚠️ 坑：case-id 可能是 `<span>` 也可能是 `<div>`，且 ID 里可能有数字（E2E-001）**  
正则要用 `[^<]+` 而不是 `[A-Z]+-[A-Z]*-?\d+`（后者匹配不了 E2E-001 因为 E2E 含数字）：

```python
# ❌ 错：只匹配纯字母
re.findall(r'class="case-id"[^>]*>\s*([A-Z]+-[A-Z]*-?\d+)\s*</(?:span|div)>', body)

# ✅ 对：匹配任意非 < 字符
re.findall(r'class="case-id"[^>]*>\s*([^<]+?)\s*</(?:span|div)>', body)
```

### 格式 D：table 行格式（树形列表/安全/异常容错/并发/用户场景）

```html
<!-- 树形列表：<td><b>TC-TREE-001</b></td> -->
<!-- 新模块：<td>TC-SEC-001</td> -->
```

注入方式：在每个 `</tr>` 后插入新行，用 `colspan` 跨所有列：

```python
# 计算列数
thead_m = re.search(r'<thead>.*?</thead>', content, re.DOTALL)
ncols = thead_m.group(0).count('<th>') if thead_m else 5

# 在每个用例行后插入截图行（reversed 避免位置偏移）
for m in reversed(rows):
    tr_end = content.find('</tr>', m.end()) + 5
    new_row = f'\n<tr><td colspan="{ncols}">{gallery}</td></tr>\n'
    content = content[:tr_end] + new_row + content[tr_end:]
```

### 格式 E：无 case ID 的报告（统计卡片区）

统计卡片区报告只列缺陷 `TC_STAT_001`（下划线），没有用例详情区。策略：在 `</body>` 前追加所有截图画廊。

---

## 3. 截图画廊 CSS + JS（Lightbox 灯箱）

```css
.sc-gallery{margin-top:12px;padding:12px;background:#f8f9fa;border-radius:8px;border:1px solid #e8e8e8}
.sc-gallery-title{font-size:13px;font-weight:600;color:#1890ff;margin-bottom:8px}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.sc-item{background:white;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:transform .2s,box-shadow .2s;cursor:pointer}
.sc-item:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
.sc-item img{width:100%;height:140px;object-fit:cover;object-position:top center;display:block}
.sc-item .sc-label{padding:6px 8px;font-size:11px;color:#666;background:#fafafa;border-top:1px solid #f0f0f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sc-item .sc-step{font-weight:600;color:#1890ff;margin-right:4px}
```

```javascript
// Lightbox: 点击缩略图弹出大图，ESC/点击关闭
(function(){
    var lb=document.createElement('div');lb.className='sc-lightbox';
    lb.innerHTML='<span class="sc-close">&times;</span><img><div class="sc-caption"></div>';
    document.body.appendChild(lb);
    // ... openLb/closeLb + event delegation on .sc-item
})();
```

**关键体验设计**：
- 缩略图高度固定 140px + `object-fit:cover` + `object-position:top center`（截取页面顶部）
- hover 上浮 + 阴影增强 = 交互反馈
- `loading="lazy"` 懒加载（大量图片时不卡）
- 标签 `Step N + 描述` 用 `text-overflow:ellipsis` 防止溢出

---

## 4. 完整注入函数

```python
import base64, html as html_mod

def make_gallery(case_id, screenshot_index):
    # 归一化 case_id（TC_STAT_001 → TC-STAT-001）
    lookup = case_id.replace('_', '-', 1) if case_id.startswith('TC_') else case_id
    if lookup not in screenshot_index:
        return ''
    shots = screenshot_index[lookup]
    items = []
    for fp, step_n, desc in shots:
        try:
            b64 = base64.b64encode(fp.read_bytes()).decode('ascii')
        except:
            continue
        d = html_mod.escape(desc)
        items.append(
            f'<div class="sc-item" title="点击放大">'
            f'<img src="data:image/png;base64,{b64}" alt="Step {step_n}" loading="lazy">'
            f'<div class="sc-label"><span class="sc-step">Step {step_n}</span>{d}</div>'
            f'</div>'
        )
    if not items:
        return ''
    return (f'<div class="sc-gallery">'
            f'<div class="sc-gallery-title">📸 步骤截图（{len(items)}张，点击放大查看）</div>'
            f'<div class="sc-grid">{"".join(items)}</div></div>')
```

---

## 5. 注入流程（per report）

```python
for html_file in html_files:
    content = html_file.read_text(encoding='utf-8')
    css_end = content.find('</style>') + 8
    body_html = content[css_end:]  # 只在 body 里检测格式

    # 按优先级检测格式（注意互斥）
    if 'onclick="toggle' in body_html:
        # 格式 A: toggle/cd
    elif 'class="case-card"' in body_html:
        # 格式 B: case-card（带引号检测！）
    elif 'class="case-header"' in body_html and 'class="case-body"' in body_html:
        # 格式 C: case-header/case-body（无 case-card）
    elif '<td><b>TC-' in body_html:
        # 格式 D-1: table + bold case ID
    elif '<td>TC-' in body_html and '<table>' in body_html:
        # 格式 D-2: table + plain case ID
    elif 'TC_STAT_' in body_html:
        # 格式 E: 无 case ID（统计卡片区）

    # 注入完成后，在 </body> 前插入 CSS + JS
    content = content.replace('</body>', GALLERY_CSS + '\n' + LIGHTBOX_JS + '\n</body>')
```

**⚠️ 互斥检测顺序**：case-card 必须在 case-header/case-body 之前检测（因为 case-card 内部也包含 case-header/case-body，先检测后者会误入）。

---

## 6. 实战产物（2026-07-07）

| 报告 | 格式 | 增强后大小 | 关联用例数 |
|---|---|---|---|
| 数据权限控制 | A (toggle/cd) | 11.3MB | 6 |
| 报表下载 | B (case-card) | 4.5MB | 10 |
| E2E端到端测试 | C (case-header/body) | 3.4MB | 4 |
| 筛选区 | C (case-header/body) | 9.5MB | 13 |
| 集成测试 | C (case-header/body) | 4.1MB | 7 |
| 树形列表区 | D-1 (table+bold) | 5.2MB | 16 |
| 安全测试 | D-2 (table+plain) | 3.1MB | 8 |
| 异常容错测试 | D-2 | 3.4MB | 8 |
| 并发竞态测试 | D-2 | 1.5MB | 5 |
| 用户场景测试 | D-2 | 3.0MB | 7 |
| 数据一致性测试 | D-2 | 2.9MB | 10 |
| 统计卡片区 | E (无case ID) | 6.4MB | 6 |

**总计**：12 份报告，96 个用例关联了 454 张截图。输出目录：`report/enhanced/`

---

## 7. 无截图用例的处理（用户明确要求）

跑完增强后老大要求："如果没有的话就不要关联，备注一个无图片的备注"。

**不能留空**——留空会让老大以为截图丢失或脚本 bug。必须显示一个灰色备注框，明确告知"该用例本身无关联截图"。

```python
def make_gallery(case_id, screenshot_index):
    # ...（截图查找逻辑同 section 4）
    if not items:
        # ⚠️ 不返回空字符串，返回灰色备注框
        return (
            '<div class="sc-gallery sc-no-screenshots">'
            '<div class="sc-gallery-title" style="color:#999">📸 步骤截图 → 该用例无关联截图</div>'
            '</div>'
        )
    return f'<div class="sc-gallery">...'
```

```css
.sc-no-screenshots {
    background: #f5f5f5;
    border: 1px dashed #d9d9d9;
    opacity: 0.7;
}
.sc-no-screenshots .sc-gallery-title {
    color: #999 !important;
    font-style: italic;
}
```

**用户体验**：灰色虚线边框 + 斜体灰字，视觉上与有截图的蓝色实线框区分开。老大一眼就知道"这个用例没有截图是正常的，不是 bug"。

---

## 8. 易错点 Checklist

- [ ] **格式检测只在 body_html 里做**——不能在整个 content 里搜（CSS 会误匹配）
- [ ] **case-card 检测用带引号的 `'class="case-card"'`**——不带引号会匹配 CSS `.case-card{}`
- [ ] **case-id 正则用 `[^<]+` 而非 `[A-Z]+-...`**——E2E-001 含数字，纯字母正则匹配不到
- [ ] **case-card 格式必须在 case-header/case-body 之前检测**——互斥顺序
- [ ] **table 行注入用 reversed()**——正序注入会改变后续行位置导致偏移
- [ ] **截图去重**——report/ 和 A_执行层/截图/ 可能有同名文件
- [ ] **TC_STAT_001 → TC-STAT-001 归一化**——下划线/连字符不一致
- [ ] **colspan 计算从 thead 数 `<th>`**——不同报告列数不同
- [ ] **大文件用 `loading="lazy"`**——12MB 报告不懒加载会卡浏览器
