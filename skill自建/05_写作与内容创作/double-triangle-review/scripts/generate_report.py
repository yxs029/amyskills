#!/usr/bin/env python3
"""
generate_report.py — 把评估 JSON 转两份 markdown 报告

报告 1: 可视化复盘报告(含雷达图 + 6 要素段位 + 90 天主线)
报告 2: 场景迭代建议报告(直接喂给 AI 跑下一轮)

用法:
  from generate_report import generate_report_1, generate_report_2
  r1 = generate_report_1(assessment_data, subject='Mavis', date='2026-07-10')
  r2 = generate_report_2(assessment_data, scenario='arxiv skill 落地', ...)
  # r1, r2 都是 markdown 字符串
"""

import math
from datetime import datetime
from pathlib import Path

# ==================== 段位判定 ====================
def level_emoji(percent: int) -> str:
    if percent < 30:
        return "🌱"
    elif percent < 60:
        return "🔵"
    else:
        return "⭐"


def level_label(percent: int) -> str:
    if percent < 30:
        return "初阶"
    elif percent < 60:
        return "进阶段"
    else:
        return "高阶"


def level_color(percent: int) -> str:
    if percent < 30:
        return "#E76F51"
    elif percent < 60:
        return "#1A73E8"
    else:
        return "#2A9D8F"


# ==================== SVG 雷达图 ====================
def make_radar_svg(dim_summary: dict, size: int = 480) -> str:
    """
    生成 6 维度雷达图 SVG。
    dim_summary: {key: {name, percent, level, ...}}
    """
    cx, cy = size / 2, size / 2 + 10
    R = size * 0.42  # 留出标签空间

    # 6 维度按顺序排列(顶部 + 顺时针)
    dims = ["aesthetic", "innovation", "skill", "data", "scene_AI", "system_人"]
    angles_deg = [-90, -30, 30, 90, 150, 210]

    # 数据点
    pts = []
    labels = []
    for d, a in zip(dims, angles_deg):
        info = dim_summary.get(d, {})
        s = max(0, min(100, info.get("percent", 0)))
        r = (s / 100) * R
        rad = math.radians(a)
        x = cx + r * math.cos(rad)
        y = cy + r * math.sin(rad)
        pts.append(f"{x:.1f},{y:.1f}")

        # 标签位置(更外)
        lr = R + 30
        lx = cx + lr * math.cos(rad)
        ly = cy + lr * math.sin(rad)

        color = level_color(s)
        labels.append({
            "name": info.get("name", d),
            "score": s,
            "x": lx,
            "y": ly,
            "color": color,
            "angle": a,
        })

    polygon_pts = " ".join(pts)

    # 网格 + 段位刻度
    rings = []
    for pct in (30, 60, 100):
        r = (pct / 100) * R
        # 六边形
        ring_pts = []
        for a in angles_deg:
            rad = math.radians(a)
            ring_pts.append(f"{cx + r*math.cos(rad):.1f},{cy + r*math.sin(rad):.1f}")
        rings.append({
            "pct": pct,
            "pts": " ".join(ring_pts),
        })

    # 轴线
    axes = []
    for a in angles_deg:
        rad = math.radians(a)
        x2 = cx + R * math.cos(rad)
        y2 = cy + R * math.sin(rad)
        axes.append(f"M{cx},{cy} L{x2:.1f},{y2:.1f}")

    # 段位标签文字(沿顶部轴)
    ring_labels = []
    for pct in (30, 60, 100):
        r = (pct / 100) * R
        ring_labels.append(f'<text x="{cx + 4:.0f}" y="{cy - r - 2:.0f}" font-size="9" fill="#9AA0A6">{pct}%</text>')

    # 数据标签
    label_svg = []
    for lbl in labels:
        # 文字 anchor 根据角度定
        if lbl["angle"] in (-90, 90):
            anchor = "middle"
        elif lbl["angle"] < 0:
            anchor = "start"
        else:
            anchor = "end"

        # y 偏移避免和分数冲突
        dy = -3
        label_svg.append(
            f'<text x="{lbl["x"]:.0f}" y="{lbl["y"] + dy:.0f}" text-anchor="{anchor}" '
            f'font-size="14" font-weight="600" fill="#202124">{lbl["name"]}</text>'
        )
        label_svg.append(
            f'<text x="{lbl["x"]:.0f}" y="{lbl["y"] + dy + 14:.0f}" text-anchor="{anchor}" '
            f'font-size="11" fill="#5F6368">{lbl["score"]}%</text>'
        )

    svg = f'''<svg viewBox="0 0 {size} {size + 40}" xmlns="http://www.w3.org/2000/svg" style="max-width:{size}px;font-family:sans-serif">

  <!-- 背景网格 -->
  {chr(10).join(f'<polygon points="{r["pts"]}" fill="none" stroke="#E8EAED" stroke-width="1"/>' for r in rings)}

  <!-- 段位刻度 -->
  {chr(10).join(ring_labels)}

  <!-- 轴线 -->
  {chr(10).join(f'<path d="{a}" stroke="#BDBDBD" stroke-width="1" fill="none"/>' for a in axes)}

  <!-- 数据多边形 -->
  <polygon points="{polygon_pts}" fill="rgba(26,115,232,0.25)" stroke="#1A73E8" stroke-width="2.5"/>

  <!-- 数据点 -->
  {chr(10).join(f'<circle cx="{p.split(",")[0]}" cy="{p.split(",")[1]}" r="4.5" fill="#1A73E8" stroke="white" stroke-width="2"/>' for p in pts)}

  <!-- 维度标签 -->
  {chr(10).join(label_svg)}
</svg>'''
    return svg


def make_radar_ascii(dim_summary: dict) -> str:
    """
    ASCII 雷达图兜底方案。当 markdown 渲染器不支持 SVG 时使用。
    用 ASCII 字符画六边形雷达 + 维度得分。
    """
    dims = ["aesthetic", "innovation", "skill", "data", "scene_AI", "system_人"]
    # dim_name + percent lookup
    parts = []
    for d in dims:
        info = dim_summary.get(d, {})
        parts.append(f"{info.get('name', d)}({info.get('percent', 0)}%)")

    # 用一个简化的 ascii 表 + 数据
    md = []
    md.append("### 6 维度雷达图(ASCII 兜底)")
    md.append("")
    md.append("```")
    md.append("              审美")
    md.append("             /    \\")
    md.append("            /      \\")
    md.append("           /        \\")
    md.append("     体系 ───────────── 创新")
    md.append(f"     ({parts[5]:14s})              ({parts[1]:14s})")
    md.append("          \\        /")
    md.append("           \\      /")
    md.append("            \\    /")
    md.append("             \\  /")
    md.append("     场景 ───────────── 数据")
    md.append(f"     ({parts[4]:14s})              ({parts[3]:14s})")
    md.append("                |")
    md.append("                |")
    md.append("             基本功")
    md.append(f"             ({parts[2]})")
    md.append("```")
    md.append("")
    md.append("**维度速览表**:")
    md.append("")
    md.append("| 位置 | 维度 | 百分比 | 段位 | 形状 |")
    md.append("|---|---|---|---|---|")
    positions = ["顶部", "右上", "右下", "底部", "左下", "左上"]
    for i, d in enumerate(dims):
        info = dim_summary.get(d, {})
        pct = info.get("percent", 0)
        # 形状:基于百分比用 ■■■■■■░░░░ 风格的 bar
        bar = "■" * int(pct / 10) + "░" * (10 - int(pct / 10))
        md.append(f"| {positions[i]} | {info.get('name', d)} | {pct}% | {level_emoji(pct)} {info.get('level', '')} | `{bar}` |")
    md.append("")
    return "\n".join(md)


def make_radar(dim_summary: dict, size: int = 480) -> str:
    """
    输出 SVG + ASCII 双版本雷达图。
    优先 SVG(渲染器支持时),降级 ASCII。
    """
    svg = make_radar_svg(dim_summary, size)
    ascii_art = make_radar_ascii(dim_summary)
    return svg + "\n\n<details><summary>📐 如果看不到上方雷达图(SVG 没渲染),点这里看 ASCII 版本</summary>\n\n" + ascii_art + "\n\n</details>"


# ==================== 报告 1: 可视化复盘 ====================
GROWTH_PATH_TEMPLATES = {
    "审美": {
        "初阶": [
            ("第 1-30 天", "攻克 A1 主动模仿", [
                "每天收藏 1 篇优质内容",
                "用 Obsidian 笔记分类'为什么好'",
            ], "30 天后收藏 30 篇 + 每篇 50 字笔记"),
            ("第 31-60 天", "攻克 A2 我能看见", [
                "看到作品时主动打分:'这个 8 分,因为 X'",
                "用 1-5 分打 10 个作品",
                "写一份'我的 Top 5 标准'",
            ], "Top 5 标准文档"),
            ("第 61-90 天", "攻克 A3 筛选入围", [
                "砍 50% 不重要的内容订阅",
                "列'我的 3 个核心主题'",
            ], "90 天复评: A1+A2+A3 ≥ 60%"),
        ],
        "进阶段": [
            ("第 1-30 天", "稳定 A4 提炼模型", [
                "选 5 篇最近读的内容,每篇画 1 张核心模型图",
            ], "5 张模型图"),
            ("第 31-60 天", "扩展到跨领域", [
                "把 3 张图合并成 1 张'跨领域模型'",
            ], "1 张跨领域图"),
            ("第 61-90 天", "形成'我的最佳实践清单'", [
                "写一份 markdown 文档,作为团队的审美标杆",
            ], "最佳实践清单 v1"),
        ],
        "高阶": [
            ("第 1-30 天", "做'美学布道'", ["内部分享 1 次", "写 1 篇公众号"], "分享完成"),
            ("第 31-60 天", "建审美库", ["用 Notion 建'我的 Top 100'库"], "Top 100 库"),
            ("第 61-90 天", "迭代方法论", ["把'我的标准'变成'我们的标准'v2"], "标准 v2"),
        ],
    },
    "体系": {
        "初阶": [
            ("第 1-30 天", "攻克 S1 散点管理", ["选 1 个统一入口", "迁移 3 个月资料"], "迁移完成"),
            ("第 31-60 天", "攻克 S2 TopN聚焦", ["列所有项目", "砍 30%"], "Top 3 跑 30 天"),
            ("第 61-90 天", "攻克 S3 MECE结构", ["MECE 拆 1 个项目", "输出流程图"], "MECE 流程图"),
        ],
        "进阶段": [
            ("第 1-30 天", "攻克 S4 逻辑链系统", ["因果链分析 1 个项目", "画完整链路图"], "链路图"),
            ("第 31-60 天", "SOP 化", ["核心流程 SOP", "找 1 人跑一遍"], "SOP v1"),
            ("第 61-90 天", "自动化", ["SOP 中至少 1 个环节自动化"], "自动化脚本"),
        ],
        "高阶": [
            ("第 1-30 天", "方法论输出", ["写 1 篇方法论"], "方法论文"),
            ("第 31-60 天", "教练他人", ["带 1-2 个人"], "1 个徒弟"),
            ("第 61-90 天", "方法论迭代", ["根据结果迭代 v2"], "方法论 v2"),
        ],
    },
    "创新": {
        "初阶": [
            ("第 1-30 天", "攻克 I1 流程创新", ["画流程图", "找最痛环节"], "流程图 + 痛点"),
            ("第 31-60 天", "攻克 I2 方案创新", ["对 1 个问题想 5 个方案", "选 1 个落地"], "5 方案 + 1 落地"),
            ("第 61-90 天", "攻克 I5 技术应用", ["用 AI 替代 1 个环节", "量化时间收益"], "时间对比"),
        ],
        "进阶段": [
            ("第 1-30 天", "攻克 I3 商业创新", ["3 个方案", "1 个 MVP"], "MVP 上线"),
            ("第 31-60 天", "攻克 I4 产品创新", ["1 个知识资产转产品"], "产品发布"),
            ("第 61-90 天", "攻克 I6 技术自研", ["自创 1 个工具", "公开给 3+ 人"], "3+ 用户"),
        ],
        "高阶": [
            ("第 1-30 天", "方法论化", ["写创新方法论"], "方法论文"),
            ("第 31-60 天", "商业化 1 个产品", ["1 个付费产品"], "付费用户"),
            ("第 61-90 天", "找徒弟", ["1 个徒弟/合作伙伴"], "徒弟"),
        ],
    },
    "场景": {
        "初阶": [
            ("第 1-30 天", "攻克 S1 Seek", ["写'我的 AI 使用目的'200 字"], "200 字文档"),
            ("第 31-60 天", "攻克 S2 Transform", ["想 3 年后", "写 3 年路线图"], "路线图"),
            ("第 61-90 天", "攻克 S3 Accelerate", ["找 1 个最痛环节", "用 AI 替代", "量化"], "时间对比"),
        ],
        "进阶段": [
            ("第 1-30 天", "攻克 S4 Realize", ["1 个资产对外"], "对外发布"),
            ("第 31-60 天", "算 ROI", ["投入 vs 收益"], "ROI 表"),
            ("第 61-90 天", "可复用化", ["封装成 Skill"], "Skill 落地"),
        ],
        "高阶": [
            ("第 1-30 天", "扩展场景", ["3 个新场景"], "3 场景清单"),
            ("第 31-60 天", "建场景库", ["Top 10 AI 场景"], "场景库"),
            ("第 61-90 天", "布道", ["写 1 篇"], "1 篇文章"),
        ],
    },
    "基本功": {
        "初阶": [
            ("第 1-30 天", "攻克 K1 AI认知入门", ["看 3 篇基础论文", "写'AI 能/不能'清单"], "清单"),
            ("第 31-60 天", "攻克 K2 提示工程核心", ["5 个 prompt 模板", "10 个收藏"], "模板库"),
            ("第 61-90 天", "攻克 K3 智能体与RAG", ["RAG demo", "Agent 跑通"], "demo"),
        ],
        "进阶段": [
            ("第 1-30 天", "攻克 K4 编程融合进阶", ["embeddings + 向量检索 1 个项目"], "项目"),
            ("第 31-60 天", "攻克 K5 体系化思维", ["PARA/MOC", "全链路 SOP"], "SOP"),
            ("第 61-90 天", "封装 Skill", ["3 个自研 Skill 进生产"], "3 Skills"),
        ],
        "高阶": [
            ("第 1-30 天", "深度技术文章", ["1 篇"], "文章"),
            ("第 31-60 天", "内部分享", ["1 次"], "分享"),
            ("第 61-90 天", "开源贡献", ["1 个 PR"], "PR merged"),
        ],
    },
    "数据": {
        "初阶": [
            ("第 1-30 天", "攻克 D1 数据质量意识", ["信源 Top 10", "砍 50% 低质量"], "Top 10"),
            ("第 31-60 天", "攻克 D2 数据整理能力", ["6 大标签", "100 条入库"], "标签体系"),
            ("第 61-90 天", "攻克 D3 数据资产就绪", ["全部进 Vault", "2 分钟定位"], "Vault 完成"),
        ],
        "进阶段": [
            ("第 1-30 天", "攻克 D4 数据飞轮增值", ["输出反哺", "RAG 二次创作"], "1 篇"),
            ("第 31-60 天", "飞轮自动化", ["收集→整理→入库 Skill"], "飞轮 Skill"),
            ("第 61-90 天", "飞轮可视化", ["画流程图"], "流程图"),
        ],
        "高阶": [
            ("第 1-30 天", "数据资产化", ["公开/收费"], "产品"),
            ("第 31-60 天", "多模态", ["图/视/音纳入"], "全模态"),
            ("第 61-90 天", "数据 ROI", ["算清每月价值"], "ROI 报告"),
        ],
    },
}


SUB_NAMES = {
    "aesthetic": {
        "A1": {"name": "主动模仿", "desc": "主动收藏、研究、模仿优质内容"},
        "A2": {"name": "我能看见", "desc": "快速判断内容质量,识别逻辑漏洞"},
        "A3": {"name": "筛选入围", "desc": "有明确主题,有选书标准,主动舍弃"},
        "A4": {"name": "提炼模型", "desc": "总结规律,绘制图谱,提炼核心模型"},
    },
    "system_人": {
        "S1_人": {"name": "散点管理", "desc": "统一入口,定期整理,告别分散"},
        "S2_人": {"name": "TopN聚焦", "desc": "聚焦核心主题,主动放弃次要"},
        "S3_人": {"name": "MECE结构", "desc": "系统分类,搭建框架,不重不漏"},
        "S4_人": {"name": "逻辑链系统", "desc": "因果链分析,系统方案,行动转化"},
    },
    "innovation": {
        "I1": {"name": "流程创新", "desc": "固定的输入-处理-输出工作流"},
        "I2": {"name": "方案创新", "desc": "多方案思维,尝试新方法,持续改进"},
        "I3": {"name": "商业创新", "desc": "知识服务多用户,探索新渠道新形态"},
        "I4": {"name": "产品创新", "desc": "书变课程,课程变社群,知识变训练营"},
        "I5": {"name": "技术应用", "desc": "AI 辅助学习写作,自动化工具提效"},
        "I6": {"name": "技术自研", "desc": "原创模型、方法论、工具与 Skill"},
    },
    "scene_AI": {
        "S1_AI": {"name": "探索定位 Seek", "desc": "明确用 AI 搭建知识体系的目的与主轴领域,避免盲目跟风"},
        "S2_AI": {"name": "变革视野 Transform", "desc": "知识体系的终局预判与长期路径规划,与个人事业/创作关联"},
        "S3_AI": {"name": "效率加速 Accelerate", "desc": "用 AI 攻克采集/整理/检索/输出等具体瓶颈,量化时间收益"},
        "S4_AI": {"name": "价值落地 Realize", "desc": "知识库从个人消化走向对外交付,复用与 ROI 清晰"},
    },
    "skill": {
        "K1": {"name": "AI 认知入门", "desc": "理解大模型/Embeddings/向量检索原理,建立人在回路的心态"},
        "K2": {"name": "提示工程核心", "desc": "针对知识处理场景的结构化提示词与模板库"},
        "K3": {"name": "智能体与 RAG", "desc": "用智能体/RAG 搭建自动化知识工作流,端到端串联知识流"},
        "K4": {"name": "编程融合进阶", "desc": "Embeddings/语义搜索/AI 辅助小工具,了解模型差异与局限"},
        "K5": {"name": "体系化思维", "desc": "用 PARA/MOC 等方法论指导 AI 知识库设计,全链路 SOP 与多轮迭代"},
    },
    "data": {
        "D1": {"name": "数据质量意识", "desc": "理解 GIGO 原则,筛选优质信源,明确哪些素材适合入知识库"},
        "D2": {"name": "数据整理能力", "desc": "统一标签/分类/双向链接体系,AI 辅助结构化入库"},
        "D3": {"name": "数据资产就绪", "desc": "拥有 AI 可读的结构化知识库,持续维护,2 分钟可定位"},
        "D4": {"name": "数据飞轮增值", "desc": "AI 输出反哺知识库,AI 基于私域知识做二次创作,形成正向循环"},
    },
}


def generate_report_1(data: dict, subject: str = "", date: str = "", scenario: str = "") -> str:
    """
    生成报告 1:可视化复盘报告。
    包含:
      - 一句话回顾
      - 综合评分卡
      - 6 维度雷达图(SVG 内嵌)
      - 6 要素章节(每个含子模块明细 + 段位 + 90 天成长主线)
      - 下次复评时间
    """
    overall = data["overall"]
    dim_summary = data["dim_summary"]
    bottleneck = data["bottleneck"]
    strength = data["strength"]
    sub_scores = data["sub_scores"]

    if not subject:
        subject = data.get("subject", "复盘对象")
    if not date:
        date = data.get("evaluated_at", datetime.now().strftime("%Y-%m-%d"))
    if not scenario:
        scenario = data.get("scenario", "")

    md = []
    md.append(f"# 双三角复盘报告 · {subject} · {date}")
    md.append("")
    if scenario:
        md.append(f"> **复盘场景**:{scenario}")
        md.append("")

    # 一句话回顾
    emoji = level_emoji(overall["percent"])
    level = overall["level"]
    md.append("## 一句话回顾")
    md.append("")
    md.append(
        f"本次测评综合 **{emoji} {overall['percent']}% ({level})**,"
        f"最大瓶颈在 **{bottleneck}**,最强维度在 **{strength}**。"
    )
    md.append("")

    # 综合评分卡
    md.append("## 综合评分卡")
    md.append("")
    md.append(f"- **综合分**:`{overall['total']} / {overall['max']}` = **{overall['percent']}%** ({overall['level']})")
    md.append(f"- **最大瓶颈**:{bottleneck}")
    md.append(f"- **最强维度**:{strength}")
    md.append(f"- **下次复评**:30-90 天后(建议 90 天做完整版)")
    md.append("")

    # 6 维度雷达图
    md.append("## 6 维度雷达图")
    md.append("")
    md.append(make_radar(dim_summary))
    md.append("")

    # 维度明细表
    md.append("## 维度明细")
    md.append("")
    md.append("| 维度 | 子模块均分 | 总分 | 满分 | 百分比 | 段位 |")
    md.append("|---|---|---|---|---|---|")
    for key in ["aesthetic", "system_人", "innovation", "scene_AI", "skill", "data"]:
        d = dim_summary[key]
        avg = round(d["total"] / SUB_NAMES[key].__len__(), 1)
        md.append(f"| {d['name']} | {avg} | {d['total']} | {d['max']} | {d['percent']}% | {level_emoji(d['percent'])} {d['level']} |")
    md.append("")

    # 6 要素详细章节
    md.append("---")
    md.append("")
    md.append("## 6 要素详细 + 90 天成长主线")
    md.append("")

    for key in ["aesthetic", "system_人", "innovation", "scene_AI", "skill", "data"]:
        d = dim_summary[key]
        dim_name = d["name"]
        pct = d["percent"]
        level = d["level"]
        emoji = level_emoji(pct)

        md.append(f"### {dim_name} · {emoji} {level}({pct}%)")
        md.append("")

        # 子模块明细
        md.append("**子模块明细**:")
        md.append("")
        md.append("| 子模块 | 名称 | 含义(是什么) | 分数 | evidence |")
        md.append("|---|---|---|---|---|")
        for sid, info in SUB_NAMES[key].items():
            name = info["name"]
            desc = info["desc"]
            val = sub_scores.get(sid, {"score": 0, "evidence": "-"})
            if isinstance(val, dict):
                score = val.get("score", 0)
                ev = val.get("evidence", "-")
            else:
                score = val
                ev = "-"
            md.append(
                f"| {sid} | **{name}** | {desc} | {score}/20 | "
                f"{ev[:60]}{'...' if len(ev) > 60 else ''} |"
            )
        md.append("")

        # 90 天成长主线
        growth = GROWTH_PATH_TEMPLATES.get(dim_name, {}).get(level, [])
        md.append(f"**90 天成长主线建议**({dim_name} · {level}):")
        md.append("")
        for phase, action, checklist, success in growth:
            md.append(f"#### {phase} · {action}")
            md.append("")
            for item in checklist:
                md.append(f"- [ ] {item}")
            md.append("")
            md.append(f"**成功标准**:{success}")
            md.append("")

    # 下次复评
    md.append("---")
    md.append("")
    md.append("## 下次复评")
    md.append("")
    md.append("- **时间**:90 天后(下次完整测评)")
    md.append("- **重点**:本次最大瓶颈是否突破 + 是否出现跨级跳")
    md.append("- **节奏**:30 天小复盘(快速 6 题模式)→ 60 天小复盘 → 90 天完整版")
    md.append("")

    return "\n".join(md)


# ==================== 报告 2: 场景迭代建议 ====================
DIM_GUIDANCE = {
    "审美": {
        "低": "AI 输出物格式清晰但视觉粗糙。建议增加'参考样板 + 设计 token',让 AI 直接套风格。",
        "中": "AI 已能产出合格品,但缺惊艳。建议在 prompt 里加入'3 个 Top 案例'作为风格标杆。",
        "高": "AI 审美已达高水平。建议沉淀'我们的美学标准 v1'到 SKILL.md,跨场景复用。",
    },
    "体系": {
        "低": "返工多、无 runbook。建议每次返工后立刻沉淀到 SKILL_REFERENCE.md。",
        "中": "有 SOP 但常忘。建议把高频流程做成自动化脚本/Skill。",
        "高": "体系已建立。建议把方法论输出到内部分享,带 1-2 个徒弟。",
    },
    "创新": {
        "低": "AI 提的方案少且保守。建议在 prompt 里强制'至少 3 个方案,含 1 个激进解'。",
        "中": "有创新但偏组合。建议增加'商业 / 产品'维度的创新思考。",
        "高": "创新已达自创水平。建议把创新流程方法论化,跨领域复用。",
    },
    "场景": {
        "低": "场景边界模糊。建议下次启动前先写 1 段 200 字'我们这次做什么/不做什么'。",
        "中": "场景清晰,ROI 合理。建议量化 ROI(投入时间 vs 收益)进报告。",
        "高": "场景已达稳定 ROI。建议把场景封装成 Skill,跨项目复用。",
    },
    "基本功": {
        "低": "工具使用不熟。建议下一轮专门给 AI 配 prompt 模板 + 工具清单。",
        "中": "工具熟练。建议沉淀 5 个最常用 prompt 到模板库。",
        "高": "基本功扎实。建议往'自研工具 / 自创方法论'突破。",
    },
    "数据": {
        "低": "数据散落、没结构。建议建 6 大标签体系(对应双三角 6 维度)。",
        "中": "有结构但没飞轮。建议加 human_rating 字段,建立反馈闭环。",
        "高": "数据飞轮已建立。建议把飞轮方法论化,跨项目复用。",
    },
}


def generate_report_2(data: dict, scenario: str = "", hours: float = 0, retros: str = "") -> str:
    """
    生成报告 2:场景迭代建议报告。
    包含:
      - 场景元数据
      - 上一轮 6 要素得分速览
      - P0/P1/P2 改进建议(每条含 AI prompt + 人类 prompt + 验证标准)
      - 下一轮 AI 启动 prompt(完整)
      - 下一轮人类启动清单(时间轴)
      - 期望下轮 6 要素分数提升表
    """
    overall = data["overall"]
    dim_summary = data["dim_summary"]
    bottleneck = data["bottleneck"]
    strength = data["strength"]
    sub_scores = data["sub_scores"]

    md = []
    md.append(f"# 场景迭代建议报告 · {scenario or '本次场景'} · {datetime.now().strftime('%Y-%m-%d')}")
    md.append("")
    md.append("> 报告 2 = 把报告 1 的诊断转成下一轮可执行的改进指令。直接喂给 AI + 人类使用。")
    md.append("")

    # 场景元数据
    md.append("## 场景元数据")
    md.append("")
    md.append("| 字段 | 值 |")
    md.append("|---|---|")
    md.append(f"| 场景名称 | {scenario or '-'} |")
    md.append(f"| 复盘对象 | {data.get('subject', '-')} |")
    md.append(f"| 综合分 | {overall['percent']}% ({overall['level']}) |")
    md.append(f"| 最大瓶颈 | {bottleneck} |")
    if hours:
        md.append(f"| 上一轮耗时 | {hours} 小时 |")
    if retros:
        md.append(f"| 关键返工 | {retros} |")
    md.append("")

    # 上一轮得分速览
    md.append("## 上一轮 6 要素得分速览")
    md.append("")
    md.append("| 要素 | 段位 | 百分比 | 关键观察 | 改进方向 |")
    md.append("|---|---|---|---|---|")
    for key in ["aesthetic", "system_人", "innovation", "scene_AI", "skill", "data"]:
        d = dim_summary[key]
        # 找该维度最低子模块
        dim_sub_keys = SUB_NAMES[key].keys()
        dim_subs = [(k, sub_scores.get(k, {})) for k in dim_sub_keys]
        weakest_sub = min(dim_subs,
                         key=lambda x: x[1].get("score", 0) if isinstance(x[1], dict) else 0)
        weakest_score = weakest_sub[1].get("score", 0) if isinstance(weakest_sub[1], dict) else 0
        weakest_name = SUB_NAMES[key].get(weakest_sub[0], {}).get("name", "")
        guidance_key = "低" if d["percent"] < 50 else ("中" if d["percent"] < 70 else "高")
        guidance = DIM_GUIDANCE.get(d["name"], {}).get(guidance_key, "")
        md.append(
            f"| {d['name']} | {level_emoji(d['percent'])} {d['level']} | {d['percent']}% | "
            f"最低子模块 {weakest_sub[0]} {weakest_name}={weakest_score} | {guidance[:60]} |"
        )
    md.append("")

    # P0 改进建议
    md.append("---")
    md.append("")
    md.append("## P0 改进建议(下一轮必须解决,1-3 条)")
    md.append("")

    # 找出 P0 = 最大瓶颈维度
    weakest_dim_key = data["bottleneck_dim"]
    weakest_dim = dim_summary[weakest_dim_key]

    # 找该维度最低分 sub
    weakest_sub_id = min(
        SUB_NAMES[weakest_dim_key].keys(),
        key=lambda k: sub_scores.get(k, {}).get("score", 0) if isinstance(sub_scores.get(k), dict) else 0
    )
    weakest_sub_score = sub_scores.get(weakest_sub_id, {}).get("score", 0)
    weakest_sub_name = SUB_NAMES[weakest_dim_key][weakest_sub_id]["name"]

    md.append(f"### 改进 1 · 解决 {bottleneck} 的 {weakest_sub_id} {weakest_sub_name}({weakest_sub_score}/20)")
    md.append("")
    md.append(f"**问题描述**:{bottleneck} 维度是本次最大瓶颈,最低子模块 {weakest_sub_name} 得分 {weakest_sub_score}/20,直接影响整体段位。")
    md.append("")
    md.append("**人类下一步应该做的**:")
    md.append("")
    md.append("- [ ] 启动下一轮前 1 小时,review 报告 1 中该要素的 90 天成长主线")
    md.append("- [ ] 把本次返工的具体场景写到 SKILL_REFERENCE.md")
    md.append("- [ ] 给 AI 启动 prompt 加上本要素的 Top 3 标准")
    md.append("")
    md.append("**AI 下一步应该做的**(可直接作为 system prompt):")
    md.append("")
    md.append("```")
    prompt_inner = (
        f"在接下来的任务中,你的 {weakest_sub_name} 表现被列为重点改进项"
        f"(本次得分 {weakest_sub_score}/20)。\n\n"
        f"具体要求:\n"
        f"1. 主动识别任务中涉及{weakest_sub_name}的环节\n"
        f"2. 对每个环节输出'评估 + 改进建议',不少于 2 段\n"
        f"3. 主动引用前 1 轮的相关 evidence,避免重复错误\n"
        f"4. 任务结束时,输出 1 段'本次 {weakest_sub_name} 表现自评'(0-20 分 + 证据)\n\n"
        f"如果表现 < 10,主动停下来请求人类介入,而不是硬跑。"
    )
    md.append(prompt_inner)
    md.append("")
    md.append("```")
    md.append("")
    md.append("**成功验证标准**:")
    md.append("")
    md.append("- [ ] 下一轮复评,该子模块提升 ≥ 5 分")
    md.append("- [ ] 下一轮在该子模块相关环节 0 返工")
    md.append("")

    # P1 改进建议
    md.append("---")
    md.append("")
    md.append("## P1 改进建议(本季度内完成,2-4 条)")
    md.append("")

    # 取最低 4 个子模块(去掉 P0 已选的)
    sorted_subs = sorted(
        sub_scores.items(),
        key=lambda x: x[1].get("score", 0) if isinstance(x[1], dict) else 0
    )
    p1_subs = [s for s in sorted_subs if s[0] != weakest_sub_id][:4]

    for i, (sid, val) in enumerate(p1_subs, 1):
        if isinstance(val, dict):
            score = val.get("score", 0)
            ev = val.get("evidence", "")
        else:
            score = val
            ev = ""

        # 找名字
        sub_name = "未知"
        for dim_subs in SUB_NAMES.values():
            if sid in dim_subs:
                sub_name = dim_subs[sid]
                break

        md.append(f"### 改进 {1 + i} · {sid} {sub_name}({score}/20)")
        md.append("")
        md.append(f"**当前状态**:{ev}")
        md.append("")
        md.append(f"**改进方向**:针对 {sub_name},下一轮 AI 输出时增加 1 个相关证据 + 1 个自评段。")
        md.append("")
        md.append("**人类动作**:review 该子模块的 evidence,找 1-2 个最弱环节加进下一轮 prompt。")
        md.append("")
        md.append("**验证标准**:该子模块 +3 分。")
        md.append("")

    # P2 改进建议
    md.append("---")
    md.append("")
    md.append("## P2 改进建议(战略性,可推迟,1-2 条)")
    md.append("")
    md.append("### 改进 · 数据飞轮建立")
    md.append("")
    md.append("**问题**:本次测评显示 D3 数据资产就绪 / D4 数据飞轮增值 偏弱。")
    md.append("")
    md.append("**改进**:下一轮所有产出(报告、笔记、Skill)都加上 human_rating 字段,你看完后随手打分,1 个月后形成可校准评分 prompt 的金标准。")
    md.append("")
    md.append("**时间**:3 个月内。")
    md.append("")

    # 下一轮 AI 启动 prompt
    md.append("---")
    md.append("")
    md.append("## 下一轮 AI 启动 prompt(完整粘贴块)")
    md.append("")
    md.append("```")
    md.append(f"你正在参与的场景: {scenario or '下一轮协作'}")
    md.append("")
    md.append("## 上一轮复盘关键结论")
    md.append(f"- 综合分: {overall['percent']}% ({overall['level']})")
    md.append(f"- 最大瓶颈: {bottleneck}")
    md.append(f"- 最强维度: {strength}")
    md.append(f"- 最大瓶颈子模块: {weakest_sub_id} {weakest_sub_name} ({weakest_sub_score}/20)")
    md.append("")
    md.append("## 你本轮必须改进的 5 件事")
    p1_five = [sid for sid, _ in p1_subs[:4]] + [weakest_sub_id]
    for sid in p1_five:
        for dim_subs in SUB_NAMES.values():
            if sid in dim_subs:
                md.append(f"1. {sid} {dim_subs[sid]}:在相关环节增加 evidence 输出和自评段")
                break
    md.append("")
    md.append("## 报告节奏")
    md.append("- 每完成 1 个里程碑,立即输出 1 段'当前段位自评'(0-20 分)")
    md.append("- 任务结束前 5 分钟,输出'6 要素本次预估分 + 关键证据'")
    md.append("- 主动识别风险,而不是出问题才说")
    md.append("")
    md.append("## 风险红线")
    md.append("- 不许连续 2 次返工(同一个错误模式)")
    md.append("- 不许假设未确认的接口")
    md.append("- 不许跳过 checkpoint")
    md.append("```")
    md.append("")

    # 下一轮人类启动清单
    md.append("---")
    md.append("")
    md.append("## 下一轮人类启动清单(时间轴)")
    md.append("")
    md.append("### 启动前 1 小时")
    md.append("- [ ] 看完报告 1 + 报告 2")
    md.append("- [ ] 列出本轮 Top 3 目标(不超过 3 个,聚焦)")
    md.append("- [ ] 准备素材(数据/文档)")
    md.append("")
    md.append("### 启动(0 分钟)")
    md.append("- [ ] 把上面『AI 启动 prompt』粘贴到 AI chat")
    md.append("- [ ] 确认 AI 理解了 Top 3 目标")
    md.append("- [ ] 设第 1 个 checkpoint:启动后 30 分钟")
    md.append("")
    md.append("### 第 30 分钟 checkpoint")
    md.append("- [ ] 暂停,review AI 的 30 分钟输出")
    md.append("- [ ] 检查 Top 3 目标里,目前完成几个?")
    md.append("- [ ] 给 AI 反馈:哪个方向做得好/需要调整")
    md.append("")
    md.append("### 第 60 分钟 checkpoint")
    md.append("- [ ] 同上")
    md.append("- [ ] 警惕:是不是快撞上 P0 问题了?")
    md.append("")
    md.append("### 任务结束")
    md.append("- [ ] 让 AI 输出'本轮 6 要素自评 + 关键证据'")
    md.append("- [ ] 你花 10 分钟做完整 108 题测评(quick mode 也行)")
    md.append("- [ ] 对比预期 vs 实际")
    md.append("- [ ] 写报告 2 v2")
    md.append("")

    # 期望下轮分数提升
    md.append("---")
    md.append("")
    md.append("## 期望下轮 6 要素分数提升")
    md.append("")
    md.append("| 要素 | 上一轮 | 下轮目标 | 提升 | 备注 |")
    md.append("|---|---|---|---|---|")
    for key in ["aesthetic", "system_人", "innovation", "scene_AI", "skill", "data"]:
        d = dim_summary[key]
        target = min(100, d["percent"] + 15)
        delta = target - d["percent"]
        # 最大瓶颈优先突破
        note = "**P0**" if key == weakest_dim_key else (
               "**P1**" if delta >= 10 else "")
        md.append(f"| {d['name']} | {d['percent']}% | {target}% | +{delta}% | {note} |")
    md.append("")
    md.append("如果下轮实际 < 目标 50% 以上,说明 P0 没做到位,需要重新诊断。")
    md.append("")

    # 元建议
    md.append("---")
    md.append("")
    md.append("## 元建议(关于'如何用报告 2')")
    md.append("")
    md.append("- **不要 100% 照搬**:挑 P0 + P1 共 3-5 条执行")
    md.append("- **每次启动前 1 小时**:review 报告 2")
    md.append("- **下一轮结束后**:做下一份报告 1 + 报告 2,看是否兑现")
    md.append("- **3 轮后**:画'场景迭代曲线',沉淀合作方法论 v1/v2/v3")
    md.append("")

    return "\n".join(md)


# ==================== 主入口 ====================
if __name__ == "__main__":
    import json
    from pathlib import Path

    sample_file = Path(r"C:\Users\AaronMY\.mavis\sessions\mvs_be59af8e1fe2424ea4b0644137e6a353\workspace\sample-assessment.json")
    if not sample_file.exists():
        print(f"Sample not found: {sample_file}")
        exit(1)

    data = json.loads(sample_file.read_text(encoding="utf-8"))

    r1 = generate_report_1(
        data,
        subject="Mavis(对 arxiv-obsidian-collector 项目的协作能力)",
        date="2026-07-10",
        scenario="在 5 天内完成 arxiv skill 从原始下载到工程化上线的全流程",
    )

    r2 = generate_report_2(
        data,
        scenario="arxiv-obsidian-collector skill 落地",
        hours=24,
        retros="Connection error 4 次,config 路径错误 1 次,Unicode 损坏 1 次",
    )

    out_dir = Path(r"C:\Users\AaronMY\.mavis\sessions\mvs_be59af8e1fe2424ea4b0644137e6a353\workspace")
    (out_dir / "sample-report-1.md").write_text(r1, encoding="utf-8")
    (out_dir / "sample-report-2.md").write_text(r2, encoding="utf-8")
    print(f"Report 1: {len(r1)} chars → sample-report-1.md")
    print(f"Report 2: {len(r2)} chars → sample-report-2.md")