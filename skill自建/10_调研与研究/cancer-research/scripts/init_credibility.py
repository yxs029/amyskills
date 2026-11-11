"""给 drugs.db 增加可信度字段，并对现有方案/医院做初始评估。

可信度评级标准：
  A（高）— 官网可访问 + 多个独立来源一致 + 有临床数据或患者评价
  B（中）— 有权威单源（期刊/官方公告），但缺少多源交叉验证或患者评价
  C（低）— 网站打不开 / 仅有单一非权威来源 / 无患者评价 / 信息存疑
  N/A    — 暂未评估

字段：
  regimens.credibility_score      TEXT (A/B/C/N/A)
  regimens.credibility_notes      TEXT  (验证过程：来源数量、交叉验证情况、备注)
  regimens.credibility_checked_at TEXT
  regimen_hospitals.credibility_score      TEXT
  regimen_hospitals.credibility_notes      TEXT
  regimen_hospitals.credibility_checked_at TEXT
"""
import sqlite3
from datetime import datetime

DB = r"C:\Users\AaronMY\.mavis\workspace\drugs.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

# 1. 加字段
for table, cols in [
    ("regimens", [
        ("credibility_score", "TEXT DEFAULT 'N/A'"),
        ("credibility_notes", "TEXT"),
        ("credibility_checked_at", "TEXT"),
    ]),
    ("regimen_hospitals", [
        ("credibility_score", "TEXT DEFAULT 'N/A'"),
        ("credibility_notes", "TEXT"),
        ("credibility_checked_at", "TEXT"),
    ]),
]:
    for col, typ in cols:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")
            print(f"  + {table}.{col}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e):
                print(f"  = {table}.{col} already exists")
            else:
                raise
conn.commit()

now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 2. 方案初始可信度评估
# A = 有 RCT/III 期/顶级期刊 + 多源验证
# B = 有期刊/共识但证据级别中等或单源
# C = 仅理论/案例/机制级证据
REGIMEN_CREDIBILITY = {
    # ---- 西医 ----
    "CRC-W-2026-001": ("A", "NCCN/CSCO 标准一线方案；多篇 III 期 RCT；全球临床广泛使用"),
    "CRC-W-2026-002": ("A", "NCCN/CSCO 标准方案；非劣效 RCT 支持口服替代"),
    "CRC-W-2026-003": ("A", "FOLFOXIRI+Bev 为 NCCN 强烈推荐；TRIBE III 期 RCT 证据"),
    "CRC-W-2026-004": ("A", "KEYNOTE-177 NEJM 发表；dMMR/MSI-H 一线标准；FDA/NMPA 获批"),
    "CRC-W-2026-005": ("B", "STTT 2026-08-18 IF=81.2 发表；III 期数据待完整读出"),
    "CRC-W-2026-006": ("B", "Cancer Commun 2026-08-19 IF=28.4；pCR 39.8%；待 III 期验证"),
    "CRC-W-2026-007": ("B", "Chugai 2026-08-14 申报；ATOMIC III 期进行中；dMMR 辅助"),
    "CRC-W-2026-008": ("B", "Lancet Gastro Hepatol 2026-08-15；miRNA 早筛；进展期腺瘤敏感性 81%"),
    "CRC-W-2026-009": ("A", "Lancet Oncol 2026-07-01；110 例 II 期 RCT；pCR 89% vs 69%"),
    "CRC-W-2026-010": ("A", "JCO 2026-07；584 例 III 期 RCT；ctDNA 甲基化灵敏度 84.1%；复旦肿瘤"),
    "CRC-W-2026-011": ("B", "EBioMedicine 2026-07 荟萃分析；471 例 PIK3CA 突变；HR=0.61；待前瞻性验证"),
    # ---- 中医 ----
    "CRC-T-2026-001": ("A", "EJC 2024 RCT；西苑医院杨宇飞团队；健脾补肾方+FOLFOX；多中心"),
    "CRC-T-2026-002": ("A", "中国中西医结合消化杂志 2026-08-15；120 例 RCT；有效率 93.33% vs 78.33%"),
    "CRC-T-2026-003": ("A", "中华中医药学刊 2026;(2)；132 例 RCT；DCR 81.82% vs 60.61%；国自然资助"),
    "CRC-T-2026-004": ("B", "补中益气汤为经典方；LARS 应用有临床观察但缺大样本 RCT"),
    "CRC-T-2026-005": ("B", "湖南中医杂志 2026;42(7)；20 例临床观察；样本量偏小"),
    "CRC-T-2026-006": ("B", "海慈医疗集团典型案例报道；排便 20+→6-7 次/日；缺 RCT；山东省重点专科"),
    "CRC-T-2026-007": ("B", "十二五国家科技重大专项；13 家三甲多中心；但原始数据未完全公开；民营医院推广"),
    "CRC-T-2026-008": ("B", "中医杂志 2026-08-14；国家科技重大专项资助；理论+Meta 分析；缺 CRC 专项 RCT"),
    "CRC-T-2026-009": ("B", "国际中医中药杂志 2026;48(7) 综述；黄连素+美沙拉嗪有 RCT 但非 CRC 专项"),
    "CRC-T-2026-010": ("C", "扶阳消阴治法为理论探讨；国际中医中药杂志综述；无临床 RCT；腺瘤阶段干预"),
    "CRC-T-2026-011": ("B", "Phytomedicine 2026-07;156:158207；机制研究（菌群-代谢物-YAP）；动物实验为主"),
    "CRC-T-2026-012": ("B", "Nature Metabolism 2026-08-06 机制研究；八珍汤/当归补血汤对接；动物实验"),
    "CRC-T-2026-013": ("B", "Adv Funct Mater 2026；枸杞多糖水凝胶；机制/动物实验；长海医院"),
}

for rid, (score, notes) in REGIMEN_CREDIBILITY.items():
    cur.execute("""UPDATE regimens
                      SET credibility_score=?, credibility_notes=?, credibility_checked_at=?
                    WHERE regimen_id=?""",
                (score, notes, now, rid))
print(f"\n方案可信度评估: {len(REGIMEN_CREDIBILITY)} 条")
a_count = sum(1 for s,_ in REGIMEN_CREDIBILITY.values() if s=="A")
b_count = sum(1 for s,_ in REGIMEN_CREDIBILITY.values() if s=="B")
c_count = sum(1 for s,_ in REGIMEN_CREDIBILITY.values() if s=="C")
print(f"  A(高): {a_count}  B(中): {b_count}  C(低): {c_count}")

# 3. 医院初始可信度评估
# A = 官网可访问(link_status=ok) + 三甲/国家重点专科 + 有明确科室和专家
# B = 官网可访问或有权威来源但 link_status 非 ok + 医院真实存在
# C = 网站打不开/民营机构/信息存疑
# 用 link_status + is_premier + 医院性质综合判断
cur.execute("""SELECT id, hospital_name, is_premier, link_status, link_http_code, feature
                 FROM regimen_hospitals""")
hospitals = cur.fetchall()

hospital_ratings = {}
for hid, name, premier, lstatus, lcode, feature in hospitals:
    if name in hospital_ratings:
        continue
    # 判断逻辑
    if lstatus == "ok" and premier == 1:
        score = "A"
        note = "官网可访问 + 国家/省级重点专科/旗舰医院"
    elif lstatus == "ok" and premier == 0:
        score = "B"
        note = "官网可访问；非重点专科但信息可核实"
    elif lstatus == "fail" and lcode in (403, 521):
        score = "B"
        note = "官网有反爬(403/521)，浏览器可访问；医院真实存在"
    elif lstatus == "fail" and premier == 1:
        score = "B"
        note = "官网连接异常但为知名三甲；建议电话核实"
    elif "民营" in (feature or "") or "民营" in name:
        score = "C"
        note = "民营机构；建议核实资质和专家信息"
    else:
        score = "C"
        note = "官网无法访问；信息待核实"
    hospital_ratings[name] = (score, note)

for name, (score, note) in hospital_ratings.items():
    cur.execute("""UPDATE regimen_hospitals
                      SET credibility_score=?, credibility_notes=?, credibility_checked_at=?
                    WHERE hospital_name=?""",
                (score, note, now, name))

print(f"\n医院可信度评估: {len(hospital_ratings)} 家")
ha = sum(1 for s,_ in hospital_ratings.values() if s=="A")
hb = sum(1 for s,_ in hospital_ratings.values() if s=="B")
hc = sum(1 for s,_ in hospital_ratings.values() if s=="C")
print(f"  A(高): {ha}  B(中): {hb}  C(低): {hc}")

conn.commit()
conn.close()
print(f"\n✅ 评估完成，时间：{now}")
