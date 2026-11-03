# 雷达图生成(报告 1 用)

## 选用 SVG 内嵌方案

不用 Mermaid(不支持六边形雷达)也不用 ASCII(占位大),用 **纯 SVG 内嵌 markdown**,支持任意 markdown 渲染器(GitHub、Obsidian、本地预览)。

## 完整 SVG 模板

```html
<svg viewBox="0 0 480 460" xmlns="http://www.w3.org/2000/svg" style="max-width:480px;font-family:sans-serif">
  <!-- 背景六边形(灰) -->
  <polygon points="240,40 419,140 419,340 240,440 61,340 61,140"
           fill="none" stroke="#E8EAED" stroke-width="1"/>
  <polygon points="240,90 369,165 369,315 240,390 111,315 111,165"
           fill="none" stroke="#E8EAED" stroke-width="1"/>
  <polygon points="240,140 319,190 319,290 240,340 161,290 161,190"
           fill="none" stroke="#E8EAED" stroke-width="1"/>
  <polygon points="240,190 269,215 269,265 240,290 211,265 211,215"
           fill="none" stroke="#E8EAED" stroke-width="1"/>

  <!-- 段位标签:30%、60% 圈 -->
  <text x="245" y="92" font-size="9" fill="#9AA0A6">60%</text>
  <text x="245" y="142" font-size="9" fill="#9AA0A6">30%</text>
  <text x="245" y="192" font-size="9" fill="#9AA0A6">10%</text>
  <text x="245" y="442" font-size="9" fill="#9AA0A6">0%</text>

  <!-- 6 维度轴线 -->
  <line x1="240" y1="240" x2="240" y2="40"  stroke="#BDBDBD" stroke-width="1"/>
  <line x1="240" y1="240" x2="419" y2="140" stroke="#BDBDBD" stroke-width="1"/>
  <line x1="240" y1="240" x2="419" y2="340" stroke="#BDBDBD" stroke-width="1"/>
  <line x1="240" y1="240" x2="240" y2="440" stroke="#BDBDBD" stroke-width="1"/>
  <line x1="240" y1="240" x2="61"  y2="340" stroke="#BDBDBD" stroke-width="1"/>
  <line x1="240" y1="240" x2="61"  y2="140" stroke="#BDBDBD" stroke-width="1"/>

  <!-- 数据填充(实际分数 0-100% 映射到六边形上的点) -->
  <!-- 计算公式: r = (score / 100) * 200 (中心 240,240 半径 200) -->
  <!-- 维度 1 (顶部, 审美): {{aesthetic_r}} 角度 -90° -->
  <!-- 维度 2 (右上, 创新): {{innovation_r}} 角度 -30° -->
  <!-- 维度 3 (右下, 基本功): {{skill_r}} 角度 30° -->
  <!-- 维度 4 (底部, 数据): {{data_r}} 角度 90° -->
  <!-- 维度 5 (左下, 场景): {{scene_r}} 角度 150° -->
  <!-- 维度 6 (左上, 体系): {{system_r}} 角度 210° -->

  <polygon points="{{dim1_x}},{{dim1_y}} {{dim2_x}},{{dim2_y}} {{dim3_x}},{{dim3_y}} {{dim4_x}},{{dim4_y}} {{dim5_x}},{{dim5_y}} {{dim6_x}},{{dim6_y}}"
           fill="rgba(26,115,232,0.25)" stroke="#1A73E8" stroke-width="2"/>

  <!-- 数据点 -->
  <circle cx="{{dim1_x}}" cy="{{dim1_y}}" r="4" fill="#1A73E8"/>
  <circle cx="{{dim2_x}}" cy="{{dim2_y}}" r="4" fill="#1A73E8"/>
  <circle cx="{{dim3_x}}" cy="{{dim3_y}}" r="4" fill="#1A73E8"/>
  <circle cx="{{dim4_x}}" cy="{{dim4_y}}" r="4" fill="#1A73E8"/>
  <circle cx="{{dim5_x}}" cy="{{dim5_y}}" r="4" fill="#1A73E8"/>
  <circle cx="{{dim6_x}}" cy="{{dim6_y}}" r="4" fill="#1A73E8"/>

  <!-- 维度标签 + 分数 -->
  <text x="240" y="30"  text-anchor="middle" font-size="14" font-weight="600" fill="#202124">审美</text>
  <text x="240" y="14"  text-anchor="middle" font-size="11" fill="#5F6368">{{aesthetic_score}}%</text>

  <text x="430" y="135" text-anchor="start" font-size="14" font-weight="600" fill="#202124">创新</text>
  <text x="430" y="120" text-anchor="start" font-size="11" fill="#5F6368">{{innovation_score}}%</text>

  <text x="430" y="345" text-anchor="start" font-size="14" font-weight="600" fill="#202124">基本功</text>
  <text x="430" y="330" text-anchor="start" font-size="11" fill="#5F6368">{{skill_score}}%</text>

  <text x="240" y="455" text-anchor="middle" font-size="14" font-weight="600" fill="#202124">数据</text>
  <text x="240" y="470" text-anchor="middle" font-size="11" fill="#5F6368">{{data_score}}%</text>

  <text x="50" y="345" text-anchor="end" font-size="14" font-weight="600" fill="#202124">场景</text>
  <text x="50" y="330" text-anchor="end" font-size="11" fill="#5F6368">{{scene_score}}%</text>

  <text x="50" y="135" text-anchor="end" font-size="14" font-weight="600" fill="#202124">体系</text>
  <text x="50" y="120" text-anchor="end" font-size="11" fill="#5F6368">{{system_score}}%</text>
</svg>
```

## 坐标计算公式

中心 (240, 240),最大半径 200(对应 100% 分数)。

```
score_percent: 0-100
r = (score_percent / 100) * 200

维度角度(顺时针):
  审美 (top):       -90°  → (240, 240 - r)
  创新 (top-right): -30°  → (240 + r*cos(-30°), 240 + r*sin(-30°)) = (240 + r*0.866, 240 - r*0.5)
  基本功 (bot-right): 30°  → (240 + r*0.866, 240 + r*0.5)
  数据 (bottom):     90°  → (240, 240 + r)
  场景 (bot-left):  150°  → (240 - r*0.866, 240 + r*0.5)
  体系 (top-left):  210°  → (240 - r*0.866, 240 - r*0.5)
```

## Python 自动生成示例

```python
import math

def radar_svg(scores: dict[str, float], title: str = "") -> str:
    """
    scores: {"审美": 35, "创新": 60, ...} 0-100
    返回 SVG 字符串
    """
    cx, cy = 240, 240
    R = 200
    dims = ["审美", "创新", "基本功", "数据", "场景", "体系"]
    angles_deg = [-90, -30, 30, 90, 150, 210]

    pts = []
    labels = []
    for d, a in zip(dims, angles_deg):
        s = max(0, min(100, scores.get(d, 0)))
        r = (s / 100) * R
        rad = math.radians(a)
        x = cx + r * math.cos(rad)
        y = cy + r * math.sin(rad)
        pts.append(f"{x:.1f},{y:.1f}")
        labels.append((d, x, y, a, s))

    polygon_pts = " ".join(pts)

    return f"""<svg viewBox="0 0 480 480" ...>
        ...
        <polygon points="{polygon_pts}" fill="rgba(26,115,232,0.25)" stroke="#1A73E8" stroke-width="2"/>
        ...
    </svg>"""
```

## ASCII 兜底方案(无 SVG 渲染器时)

如果 markdown 渲染器不支持 SVG,可以用 ASCII radar:

```
          审美 (35%)
           ▲
          /│\
         / │ \
        /  │  \
   体系/  中心  \创新
   (28%)│  ▼  │(60%)
        \  │  /
         \ │ /
          \│/
       场景 ─ 数据
      (45%) (38%)
        ╲
         ╲
        基本功 (75%)
```

## 报告 1 中雷达图的位置

放在综合评分卡之后、子模块明细之前,作为"总分 + 形状感"的快速可视化。

示例(参考附件风格):

```markdown
## 综合评分卡

综合分: 47% (进阶段 B)
最大瓶颈: 体系 28%
最强维度: 基本功 75%

## 6 维度雷达图

<svg ...>...</svg>

## 子模块明细
| 子模块 | ... |
```

## 颜色规范

雷达图风格按附件保持:

| 段位 | 填充色 | 边框色 | 文字 |
|---|---|---|---|
| 初阶(<30%) | #FCEEEA(浅橙) | #E76F51 | #C0392B |
| 进阶(30-60%) | #E8F0FE(浅蓝) | #1A73E8 | #1557B0 |
| 高阶(>60%) | #E8F5F3(浅绿) | #2A9D8F | #16A085 |

每个数据点的填充色根据该维度的段位:
- 初阶 → 橙点
- 进阶段 → 蓝点
- 高阶 → 绿点