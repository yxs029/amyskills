"""Sample test for auto_assess + report generation."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from auto_assess import assess_from_raw, load_metadata

load_metadata()

# Synthetic test JSON: imagine an AI agent ran arxiv pipeline
sample = {
    "subject": "Mavis (对 arxiv-obsidian-collector 项目的协作能力)",
    "scenario": "在 5 天内完成 arxiv skill 从原始下载到工程化上线的全流程",
    "evaluated_at": "2026-07-10T16:50:00",
    "sub_scores": {
        # 审美
        "A1": {"score": 16, "evidence": "看到原始 skill 后立刻分两栏列亮点/毛病"},
        "A2": {"score": 17, "evidence": "能讲出 v0.5 vs v1 的具体差异"},
        "A3": {"score": 12, "evidence": "有 TopN 选型,但有时拿不准"},
        "A4": {"score": 10, "evidence": "提出 LAYER_ALIAS 这种小抽象,但模型提炼不足"},
        # 体系(人)
        "S1_人": {"score": 14, "evidence": "用 Obsidian 双链保存参考资料"},
        "S2_人": {"score": 8,  "evidence": "跑了 5 个项目没主动砍,导致焦点模糊"},
        "S3_人": {"score": 11, "evidence": "MECE 拆解尚可,偶尔漏"},
        "S4_人": {"score": 7,  "evidence": "因果链分析偏弱,runbook 没沉淀"},
        # 创新
        "I1": {"score": 13, "evidence": "流程创新 OK,但 pipeline 还没自动化到端到端"},
        "I2": {"score": 15, "evidence": "提了 5 周/5 天/MECE 等多个方案让用户选"},
        "I3": {"score": 9,  "evidence": "商业创新弱,只是个人知识整理"},
        "I4": {"score": 7,  "evidence": "没产品化"},
        "I5": {"score": 16, "evidence": "用了 mavis cron / anthropic SDK / proxy 兜底等多种技术"},
        "I6": {"score": 14, "evidence": "做了 arxiv-obsidian-collector 和 double-triangle-review 两个自研 skill"},
        # 场景(AI)
        "S1_AI": {"score": 15, "evidence": "场景边界清晰,只做 arxiv 周报"},
        "S2_AI": {"score": 11, "evidence": "3 年终局思考弱,这是周报维度不是 10 年尺度"},
        "S3_AI": {"score": 13, "evidence": "用 AI 攻克 arxiv 搜索+评分瓶颈,效率提升明显"},
        "S4_AI": {"score": 7,  "evidence": "没对外交付"},
        # 基本功
        "K1": {"score": 18, "evidence": "理解 m3 / embeddings / proxy 原理"},
        "K2": {"score": 16, "evidence": "写了 5+ 个高质量 prompt 模板"},
        "K3": {"score": 17, "evidence": "用 anthropic SDK + 评分+摘要流水线"},
        "K4": {"score": 12, "evidence": "有 PyPDF2 + requests 代码基础,embeddings 弱"},
        "K5": {"score": 14, "evidence": "SKILL.md 标准化,breakpoint resume"},
        # 数据
        "D1": {"score": 12, "evidence": "GIGO 原则知道,但信源筛选不严格"},
        "D2": {"score": 11, "evidence": "用 breakfrontmatter 字段做结构化,但标签不统一"},
        "D3": {"score": 8,  "evidence": "vault 在 F 盘云同步,但没全结构化"},
        "D4": {"score": 6,  "evidence": "数据飞轮未建立,human_rating 字段还没启用"},
    },
    "key_observations": [
        "AI 在 arxiv 搜索 + PDF 下载端到端跑通",
        "评分环节因 Connection error 全部失败,fallback 5.0 分",
        "mavis cron 调度链路通畅,但 proxy 兜底是临时补丁",
        "数据飞轮尚未建立,human_rating 字段还没启用",
    ],
}

result = assess_from_raw(json.dumps(sample))
print(f"\n=== ASSESSMENT RESULT ===")
print(f"Subject: {result['subject']}")
print(f"Overall: {result['overall']['total']}/{result['overall']['max']} = {result['overall']['percent']}% ({result['overall']['level']})")
print(f"Bottleneck: {result['bottleneck']}")
print(f"Strength: {result['strength']}")
print(f"\nDim summary:")
for k, v in result['dim_summary'].items():
    print(f"  {v['name']:6s} {v['total']:3d}/{v['max']:3d} = {v['percent']:3d}% {v['level']}")

# Save for later use
out = Path(r'C:\Users\AaronMY\.mavis\sessions\mvs_be59af8e1fe2424ea4b0644137e6a353\workspace\sample-assessment.json')
out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(f"\nSaved sample to {out}")