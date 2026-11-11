import json
from collections import Counter

with open(r'C:\Users\AaronMY\.minimax\skills\arxiv-obsidian-collector\logs\fixup_l2_20260825_report.json', encoding='utf-8') as f:
    r = json.load(f)

print(f'total_candidates: {r["total_candidates"]}')
print(f'fixed: {len(r["fixed"])}')
print(f'failed: {len(r["failed"])}')
print()
print('新分数分布:')
scores = Counter(round(x['new_score'], 1) for x in r['fixed'])
for s in sorted(scores):
    print(f'  {s}: {scores[s]}')
print()
print('新分类分布:')
cats = Counter(x['new_category'] for x in r['fixed'])
for c, n in sorted(cats.items(), key=lambda x: -x[1]):
    print(f'  {c}: {n}')
print()
# 验证 5.0+unknown 残留
still_5_0 = sum(1 for x in r['fixed'] if x['new_score'] == 5.0)
print(f'修复后仍 5.0 分: {still_5_0} 篇(原 5.0+unknown 占位,真实 LLM 评分就是 5.0 不算失败)')
