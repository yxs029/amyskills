import re
from pathlib import Path

samples = [
    r'F:\软件测试\30AI技术知识树\arxivForAI\第二层-大模型基底层\Transformer架构与改进\CrossDepth Geometry-Constrained Attention for Generalizable Multi-View Surround Depth Estimation.md',
    r'F:\软件测试\30AI技术知识树\arxivForAI\第二层-大模型基底层\向量数据库与检索\Technical Manual for a Toolkit for Measuring Contextual Individuation in Transformer Language Models.md',
    r'F:\软件测试\30AI技术知识树\arxivForAI\第二层-大模型基底层\AGI\Electromagnetic alignment and jet precession around supermassive black holes Quasi-periodic oscillat.md',
]

for p in samples:
    fp = Path(p)
    if not fp.exists():
        print(f'MISSING: {p}')
        continue
    txt = fp.read_text(encoding='utf-8', errors='replace')
    score_m = re.search(r'quality_score:\s*([\d.]+)', txt)
    cat_m = re.search(r'quality_category:\s*(\S+)', txt)
    has_429 = '429' in txt
    has_401 = '401' in txt
    has_scoring_failed = 'scoring failed' in txt
    print(f'\n--- {fp.name[:60]}')
    print(f'  quality_score: {score_m.group(1) if score_m else "N/A"}')
    print(f'  quality_category: {cat_m.group(1) if cat_m else "N/A"}')
    print(f'  has "429": {has_429}')
    print(f'  has "401": {has_401}')
    print(f'  has "scoring failed": {has_scoring_failed}')
