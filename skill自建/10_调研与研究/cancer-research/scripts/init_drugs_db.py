#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
init_drugs_db.py - 直肠癌第一批药物/方案/医院初始化脚本

执行：
    python init_drugs_db.py --db <path-to-drugs.db> --schema <path-to-schema.sql>

作用：
    1. 创建 drugs.db（如果不存在）
    2. 应用 schema
    3. 灌入第一批"基线"数据（基于 2026-08-20 版主报告梳理的直肠癌相关药物/方案/医院）
    4. 灌入的每条都有 `medicine_type_tag` 字段（western / tcm / both）

设计：幂等。多次执行不会重复插入。
"""

import argparse
import os
import sqlite3
import sys
from pathlib import Path

# Windows GBK console fix: ensure stdout can print emoji
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 业务主键：方案 ID 命名规则
# CRC-W-2026-XXX = 直肠癌-西医-2026-第 X 个
# CRC-T-2026-XXX = 直肠癌-中医-2026-第 X 个
# CRC-C-2026-XXX = 直肠癌-合集-2026-第 X 个

# ============================================================
# 第一批：药物（drugs 表）
# ============================================================
# 字段：(name_cn, name_en, name_pinyin, category, medicine_type_tag, mechanism, indications, evidence_level, source_doi)
DRUGS = [
    # ----- 西医：化疗药 -----
    ("奥沙利铂", "Oxaliplatin", "aoshibobo", "化疗药-铂类", "western", "DNA 交联剂，干扰 DNA 复制与转录", "mCRC 一线联合化疗核心药", "A", "10.1200/JCO.22.00046"),
    ("氟尿嘧啶", "5-Fluorouracil", "funiaomiding", "化疗药-抗代谢", "western", "胸苷酸合成酶抑制剂", "mCRC 一线联合化疗", "A", "10.1200/JCO.22.00046"),
    ("卡培他滨", "Capecitabine", "kapeitabin", "化疗药-抗代谢", "western", "5-FU 前药，口服", "mCRC 口服化疗替代 5-FU", "A", "10.1200/JCO.22.00046"),
    ("伊立替康", "Irinotecan", "yilizetan", "化疗药-拓扑异构酶 I 抑制剂", "western", "拓扑异构酶 I 抑制剂", "mCRC 一线/二线", "A", None),
    ("亚叶酸钙", "Calcium folinate", "yeyesuangai", "化疗辅助-调节剂", "western", "增强 5-FU 抑制 TS 作用", "与 5-FU 联合增敏", "A", None),
    # ----- 西医：靶向药 -----
    ("贝伐珠单抗", "Bevacizumab", "beifazhoudankang", "靶向-VEGF", "western", "抗血管生成（VEGF 抑制剂）", "mCRC 一线联合化疗", "A", None),
    ("西妥昔单抗", "Cetuximab", "xituxidankang", "靶向-EGFR", "western", "抗 EGFR（RAS 野生型必需）", "mCRC RAS WT 一线", "A", None),
    ("瑞康曲妥珠单抗", "Disitamab vedotin", "ruikangququzhu", "ADC-HER2", "western", "HER2 ADC", "HER2+ CRC 二线", "B", None),
    ("呋喹替尼", "Fruquintinib", "fuqvtin ni", "靶向-VEGFR1-3", "western", "口服 VEGFR 抑制剂", "mCRC 三线", "A", None),
    ("戈来雷塞", "Glecirasib", "gelaileisai", "靶向-KRAS G12C", "western", "KRAS G12C 共价抑制剂", "KRAS G12C mCRC", "B", None),
    # ----- 西医：免疫治疗 -----
    ("帕博利珠单抗", "Pembrolizumab", "pabolizhu", "PD-1", "western", "抗 PD-1", "dMMR/MSI-H mCRC 一线", "A", None),
    ("纳武利尤单抗", "Nivolumab", "nawuliyou", "PD-1", "western", "抗 PD-1", "dMMR/MSI-H mCRC", "A", None),
    ("特瑞普利单抗", "Toripalimab", "teruipuli", "PD-1", "western", "抗 PD-1", "dMMR LARC 新辅助", "A", "10.1016/S1470-2045(25)00123-4"),
    ("信迪利单抗", "Sintilimab", "xindili", "PD-1", "western", "抗 PD-1", "dMMR/MSI-H mCRC", "B", None),
    # ----- 西医：辅助药 -----
    ("阿司匹林", "Aspirin", "asipilin", "抗血小板-辅助", "western", "COX/PIK3CA 通路抑制", "CRC 辅助（PIK3CA 突变型）", "B", "10.1016/j.ebiom.2026.05.001"),
    # ----- 中医：方剂（按主治功效） -----
    ("白头翁汤", "Baitouweng Tang", "baitouwengtang", "方剂-清热解毒", "tcm", "清热解毒、凉血止痢", "湿热蕴结型 CRC", "A", None),
    ("参苓白术散", "Shenling Baizhu San", "shenlingbaizhusan", "方剂-健脾益气", "tcm", "益气健脾、渗湿止泻", "脾虚湿盛型 CRC 化疗辅助", "A", "2026 中华中医药学刊"),
    ("补中益气汤", "Buzhong Yiqi Tang", "buzhongyiqitang", "方剂-补中益气", "tcm", "补中益气、升阳举陷", "LARS 脾虚气陷型", "A", None),
    ("八珍汤", "Bazhen Tang", "bazhengtang", "方剂-气血双补", "tcm", "益气养血", "气血两虚型 CRC 化疗后", "A", None),
    ("健脾补肾方", "Jianpi Bushen Fang", "jianpibushenfang", "方剂-健脾补肾", "tcm", "健脾益气、补肾填精", "mCRC FOLFOX 化疗辅助（EJC 2024）", "A", "10.1016/j.ejca.2024.114203"),
    ("黄芪建中汤", "Huangqi Jianzhong Tang", "huangqijianzhongtang", "方剂-温中补虚", "tcm", "温中补虚、缓急止痛", "化疗后厌食-恶病质", "A", "10.3969/j.issn.1671-038X.2026.08.07"),
    ("益气健脾抗癌方", "Yiqi Jianpi Kang'ai Fang", "yiqijianpikangaifang", "方剂-健脾解毒", "tcm", "健脾益气、清热解毒", "mCRC 化疗辅助", "B", "ChiCTR2400086903"),
    ("乌梅丸", "Wumei Wan", "wumeiwan", "方剂-寒热并调", "tcm", "寒热并用、攻补兼施", "放射性肠纤维化、寒热错杂型", "B", "10.1016/j.phymed.2026.158207"),
    ("桃红四物汤", "Taohong Siwu Tang", "taohongsiwutang", "方剂-活血化瘀", "tcm", "活血化瘀、补血养血", "瘀毒内阻型", "B", None),
    ("知柏地黄丸", "Zhibai Dihuang Wan", "zhibaidihuangwan", "方剂-滋阴降火", "tcm", "滋阴降火", "肝肾阴虚型", "B", None),
    # ----- 中医：中成药（口服） -----
    ("槐耳颗粒", "Huai'er Granule", "huaierkeli", "中成药-扶正", "tcm", "扶正固本、活血消癥", "CRC 化疗辅助", "A", "10.3969/j.issn.1006-2084.2021.20.015"),
    ("华蟾素片", "Huachansu Pian", "huachansupian", "中成药-清热解毒", "tcm", "清热解毒、消肿止痛", "中晚期 CRC", "B", "10.1016/j.jep.2025.119479"),
    ("消癌平片", "Xiao'aiping Pian", "xiaoaipingpian", "中成药-清热解毒", "tcm", "清热解毒、化痰散结", "CRC 化疗辅助", "B", None),
    ("康莱特软胶囊", "Kanglaite Ruanjiaonang", "kanglaitenuanjiaonang", "中成药-益气养阴", "tcm", "益气养阴、健脾渗湿", "晚期恶病质", "B", None),
    ("参一胶囊", "Shenyi Jiaonang", "shenyijiaonang", "中成药-培元固本", "tcm", "培元固本、抑制转移", "放化疗后体质虚弱", "B", None),
    ("平消胶囊", "Pingxiao Jiaonang", "pingxiaojiaonang", "中成药-活血化瘀", "tcm", "活血化瘀、散结消肿", "各期肿瘤", "B", None),
    ("参丹散结胶囊", "Shendan Sanjie Jiaonang", "shendansanjiejiaonang", "中成药-益气养血", "tcm", "益气养血、散结解毒", "晚期肿瘤乏力", "B", None),
    ("慈丹胶囊", "Cidan Jiaonang", "cidanjiaonang", "中成药-化瘀解毒", "tcm", "化瘀解毒、消肿散结、益气养血", "消化系统肿瘤辅助（CRC）", "B", "十二五国家科技重大专项"),
    ("黄芪片", "Huangqi Pian", "huangqipian", "中成药-补气固表", "tcm", "补气固表、利尿托毒", "CRC 健脾主线方剂核心", "A", "OTC 转换 2026-07"),
    # ----- 中医：中药注射液 -----
    ("康莱特注射液", "Kanglaite Zhusheye", "kanglaitezhusheye", "中药注射液-益气养阴", "tcm", "薏苡仁油提取", "晚期恶病质+化疗", "B", None),
    ("华蟾素注射液", "Huachansu Zhusheye", "huachansuzhusheye", "中药注射液-清热解毒", "tcm", "解毒消肿、止痛", "中晚期 CRC", "B", None),
    ("艾迪注射液", "Aidi Zhusheye", "aidizhusheye", "中药注射液-扶正解毒", "tcm", "清热解毒、扶正固本", "化疗辅助", "B", None),
    ("复方苦参注射液", "Fufang Kushen Zhusheye", "fufangkushenzhusheye", "中药注射液-止痛", "tcm", "清热利湿、止痛", "癌痛辅助", "B", None),
    ("鸦胆子油乳注射液", "Yadanzi Zhusheye", "yadanzizhusheye", "中药注射液-抗肿瘤", "tcm", "抗肿瘤活性", "消化道肿瘤", "B", None),
    # ----- 中医：核心中药材（高频入方） -----
    ("黄芪", "Astragalus", "huangqi", "中药材-补气", "both", "黄芪多糖/黄芪甲苷，免疫调节+NF-κB 抑制", "健脾益气主线方剂核心", "A", "TLR4/MyD88/NF-κB"),
    ("白术", "Atractylodes", "baizhu", "中药材-健脾", "both", "白术内酯 I/III，健脾+抗肿瘤", "健脾方剂核心", "A", None),
    ("党参", "Codonopsis", "dangshen", "中药材-补气", "both", "党参多糖，免疫调节", "益气方剂核心", "A", None),
    ("茯苓", "Poria", "fuling", "中药材-健脾利湿", "both", "茯苓多糖，免疫调节+利水", "健脾方剂核心", "A", None),
    ("白花蛇舌草", "Hedyotis diffusa", "baihuashecaoshecao", "中药材-清热解毒", "tcm", "清热解毒、抗肿瘤", "CRC 清热解毒主线", "A", None),
    ("半枝莲", "Scutellaria barbata", "banzhilian", "中药材-清热解毒", "tcm", "清热解毒、抗肿瘤", "CRC 清热解毒主线", "A", None),
    ("山慈菇", "Cremastra", "shancigu", "中药材-清热解毒", "tcm", "清热解毒、散结", "抗肿瘤辅助", "B", None),
    ("黄连", "Coptis", "huanglian", "中药材-清热燥湿", "tcm", "小檗碱（黄连素），NF-κB 抑制", "UC-CRC 炎癌阻断", "A", "10.3760/cma.j.cn115398-20260117-00136"),
    ("姜黄", "Turmeric", "jianghuang", "中药材-活血化瘀", "tcm", "姜黄素，IKK 抑制", "UC-CRC 炎癌阻断", "A", None),
    ("葛根", "Pueraria", "gegen", "中药材-解肌退热", "tcm", "葛根素，NF-κB 抑制", "UC-CRC 炎癌阻断", "A", None),
    ("白藜芦醇", "Resveratrol", "baililuchun", "中药成分-抗炎", "tcm", "SIRT1 激活，NF-κB 乙酰化抑制", "UC-CRC 炎癌阻断", "A", None),
    ("苦参", "Sophora flavescens", "kushen", "中药材-清热燥湿", "tcm", "苦参碱，NF-κB p65 抑制", "UC-CRC 炎癌阻断", "A", None),
    ("大黄", "Rhubarb", "dahuang", "中药材-泻下", "both", "大黄素（emodin），ESR1 靶向", "放疗骨髓抑制、放射性肠损伤", "A", "10.1186/s13020-026-0338-5"),
    ("附子", "Aconite", "fuzi", "中药材-温阳", "tcm", "附子生物碱，温肾阳", "扶阳治法核心（需炮制）", "A", None),
    ("乌梅", "Black plum", "wumei", "中药材-敛肺涩肠", "tcm", "有机酸，菌群调节", "寒热错杂型 CRC", "B", None),
    ("枸杞", "Lycium", "gouqi", "中药材-滋补肝肾", "both", "枸杞多糖，化疗增效+靶向递送", "化疗辅助、口服结肠靶向", "A", "10.1002/adfm.202601237"),
    # ----- 中医：外治法 -----
    ("白头翁汤灌肠", "Baitouweng Tang Enema", "baitouwengtangguanchang", "中医外治-灌肠", "tcm", "清热解毒、凉血止痢", "放射性直肠炎/低位直肠癌", "A", None),
    ("乌梅丸改良灌肠", "Wumei Wan Modified Enema", "wumeiwanmodified", "中医外治-灌肠", "tcm", "寒热并调", "放射性肠纤维化", "B", None),
    ("内关穴 TEAS", "Neiguan TEAS", "neiguanteas", "中医外治-经皮穴位电刺激", "tcm", "经皮电刺激内关穴（PC6）", "术后/化疗恶心呕吐", "A", "国内四中心 RCT 2026-07"),
    ("八髎穴针灸", "Baliao Acupuncture", "baliaoacupuncture", "中医外治-针灸", "tcm", "刺激骶神经丛（S2-S4）", "LARS 康复", "B", "海慈 2026-08"),
]

# ============================================================
# 第一批：方案（regimens 表）
# ============================================================
# 字段：(regimen_id, name, cancer_type, stage, medicine_type, target_population, summary, key_data, evidence_source)
REGIMENS = [
    # ---- 西医 ----
    ("CRC-W-2026-001", "FOLFOX 标准化疗", "直肠癌", "晚期(IV期)", "western",
     "mCRC 一线（无论分子分型）",
     "mCRC 一线标准化疗骨架",
     "mPFS ~9 月, mOS ~24-30 月",
     "NCCN/CSCO 2026"),
    ("CRC-W-2026-002", "CapeOx 化疗", "直肠癌", "晚期(IV期)", "western",
     "mCRC 一线（口服替代）",
     "FOLFOX 替代，5-FU 用卡培他滨口服",
     "非劣效于 FOLFOX",
     "NCCN/CSCO 2026"),
    ("CRC-W-2026-003", "FOLFOXIRI + 贝伐珠单抗", "直肠癌", "晚期(IV期)", "western",
     "mCRC 适合强化治疗者",
     "三药化疗 + 抗血管生成",
     "mOS 29.8 月（vs FOLFOX 25.8）",
     "NCCN/CSCO 2026"),
    ("CRC-W-2026-004", "PD-1 单药（dMMR/MSI-H）", "直肠癌", "晚期(IV期)", "western",
     "dMMR/MSI-H mCRC 一线",
     "免疫单药一线",
     "mPFS 16.5 月（KEYNOTE-177）",
     "10.1056/NEJMoa2017699"),
    ("CRC-W-2026-005", "TRAINER 方案（高危 LARC）", "直肠癌", "LARC", "western",
     "高危 LARC（T4/N+）",
     "TNT + 化疗 + 选择性靶向/免疫",
     "pCR 显著优于传统",
     "STTT 2026-08-18 IF=81.2"),
    ("CRC-W-2026-006", "Neo-STAR 方案（LARC 免疫新辅助）", "直肠癌", "LARC", "western",
     "LARC 新辅助",
     "短程放疗 + CAPOX + 特瑞普利单抗",
     "pCR 39.8%",
     "Cancer Commun 2026-08-19 IF=28.4"),
    ("CRC-W-2026-007", "ATOMIC 方案（dMMR 辅助免疫）", "直肠癌", "II-III期", "western",
     "dMMR 辅助免疫",
     "足量足疗程免疫辅助",
     "显著降低复发",
     "Chugai 2026-08-14 申报"),
    ("CRC-W-2026-008", "DENEB 血液早筛", "直肠癌", "全分期", "western",
     "高危筛查",
     "miRNA 血液早筛",
     "进展期腺瘤敏感性 81%",
     "Lancet Gastro Hepatol 2026-08-15"),
    ("CRC-W-2026-009", "PICC-2 方案（dMMR LARC）", "直肠癌", "LARC", "western",
     "dMMR/MSI-H LARC",
     "特瑞普利单抗 + 塞来昔布",
     "pCR 89% vs 69%",
     "Lancet Oncol 2026-07-01"),
    ("CRC-W-2026-010", "FIND 方案（ctDNA 监测）", "直肠癌", "III期", "western",
     "III 期辅助治疗决策",
     "ctDNA 甲基化监测",
     "灵敏度 84.1% vs CEA 35.7%",
     "JCO 2026-07"),
    ("CRC-W-2026-011", "阿司匹林辅助（PIK3CA+）", "直肠癌", "II-III期", "western",
     "PIK3CA 外显子 9/20 突变",
     "阿司匹林辅助",
     "DFS 事件风险 -39%（HR=0.61）",
     "EBioMedicine 2026-07"),
    # ---- 中医 ----
    ("CRC-T-2026-001", "健脾补肾方 + FOLFOX", "直肠癌", "晚期(IV期)", "tcm",
     "mCRC 化疗辅助",
     "健脾补肾方联合 FOLFOX 标准化疗",
     "化疗完成率提高、III/IV 级不良反应降低",
     "EJC 2024 (西苑杨宇飞团队)"),
    ("CRC-T-2026-002", "黄芪建中汤 + 甲地孕酮", "直肠癌", "化疗后", "tcm",
     "化疗后厌食-恶病质",
     "黄芪建中汤加味联合甲地孕酮",
     "总有效率 93.33% vs 78.33% (P<0.05)",
     "中国中西医结合消化杂志 2026-08-15"),
    ("CRC-T-2026-003", "参苓白术散 + FOLFOX4", "直肠癌", "晚期(IV期)", "tcm",
     "晚期 CRC FOLFOX 辅助",
     "参苓白术散联合 FOLFOX4",
     "DCR 81.82% vs 60.61% (P<0.05)",
     "中华中医药学刊 2026;(2)"),
    ("CRC-T-2026-004", "补中益气汤 + 生物反馈", "直肠癌", "LARS", "tcm",
     "LARS 脾虚气陷型",
     "补中益气汤 + 盆底肌锻炼 + 生物反馈",
     "LARS 评分显著降低",
     "6.20 节主报告"),
    ("CRC-T-2026-005", "参苓白术散 + 生物反馈", "直肠癌", "LARS", "tcm",
     "LARS 脾虚湿盛型",
     "参苓白术散加味联合生物反馈",
     "排便频次/控便能力改善",
     "湖南中医杂志 2026;42(7)"),
    ("CRC-T-2026-006", "八髎穴针灸 + 生物反馈", "直肠癌", "LARS", "tcm",
     "LARS 任意分型（海慈方案）",
     "生物反馈+八髎穴针灸/电针+八髎灸",
     "排便 20+次/日 → 6-7次/日（典型案例）",
     "海慈 2026-08"),
    ("CRC-T-2026-007", "慈丹胶囊辅助", "直肠癌", "全分期", "tcm",
     "消化系统肿瘤（含 CRC）辅助",
     "慈丹胶囊 + 西医标准治疗",
     "改善症状、降低毒副作用、降低复发转移",
     "十二五国家科技重大专项 13 家三甲"),
    ("CRC-T-2026-008", "时辰化疗 + 子午流注针灸", "直肠癌", "全分期", "tcm",
     "全分期时间医学辅助",
     "时辰化疗 + 子午流注针灸 + 择时用药",
     "时辰化疗 Meta 分析显示获益",
     "中医杂志 2026-08-14 (国家科技重大专项 2024ZD0521205)"),
    ("CRC-T-2026-009", "黄连素 + 美沙拉嗪", "直肠癌", "UC-CRC", "tcm",
     "UC 长期管理（CRC 高危）",
     "黄连素 300 mg tid + 美沙拉嗪",
     "维持缓解率 +30%",
     "国际中医中药杂志 2026;48(7)"),
    ("CRC-T-2026-010", "扶阳消阴治法", "直肠癌", "腺瘤阶段", "tcm",
     "结直肠腺瘤（治未病）",
     "附子理中丸 + 桂枝茯苓丸（扶阳消阴）",
     "腺瘤阶段干预（机制级证据）",
     "国际中医中药杂志 2026;48(7)"),
    ("CRC-T-2026-011", "乌梅丸抗肠纤维化", "直肠癌", "放射性肠纤维化", "tcm",
     "放射性肠纤维化、慢性放射性直肠炎",
     "乌梅丸化裁口服（改良灌肠探索）",
     "菌群-代谢物-YAP 轴机制",
     "Phytomedicine 2026-07;156:158207"),
    ("CRC-T-2026-012", "黄芪/八珍汤联合 5-FU 增敏", "直肠癌", "化疗耐药", "tcm",
     "5-FU 残留肿瘤",
     "益气养血方（八珍汤/当归补血汤）+ 5-FU",
     "抑制线粒体代谢重编程增敏化疗",
     "Nature Metabolism 2026-08-06"),
    ("CRC-T-2026-013", "枸杞多糖水凝胶口服结肠靶向", "直肠癌", "MSS-CRC", "tcm",
     "MSS-CRC 化疗辅助",
     "枸杞多糖水凝胶口服 + 奥沙利铂",
     "增强 MSS-CRC 治疗（机制级）",
     "Adv Funct Mater 2026"),
]

# ============================================================
# 第一批：方案-药物关联（regimen_drugs 表）
# ============================================================
# 字段：(regimen_id, drug_name_pinyin, role, dose_default, notes)
REGIMEN_DRUGS = [
    # FOLFOX
    ("CRC-W-2026-001", "aoshibobo", "core", "85 mg/m² d1 q2w", "FOLFOX"),
    ("CRC-W-2026-001", "funiaomiding", "core", "400 mg/m² iv bolus + 2400 mg/m² civ 46-48h", "FOLFOX"),
    ("CRC-W-2026-001", "yeyesuangai", "adjunct", "400 mg/m² d1 q2w", "FOLFOX"),
    # CapeOx
    ("CRC-W-2026-002", "aoshibobo", "core", "130 mg/m² d1 q3w", "CapeOx"),
    ("CRC-W-2026-002", "kapeitabin", "core", "1000 mg/m² bid d1-14 q3w", "CapeOx"),
    # FOLFOXIRI + Bev
    ("CRC-W-2026-003", "aoshibobo", "core", "85 mg/m² d1 q2w", "FOLFOXIRI"),
    ("CRC-W-2026-003", "yilizetan", "core", "165 mg/m² d1 q2w", "FOLFOXIRI"),
    ("CRC-W-2026-003", "funiaomiding", "core", "3200 mg/m² civ 46h", "FOLFOXIRI"),
    ("CRC-W-2026-003", "beifazhoudankang", "core", "5 mg/kg d1 q2w", "+ 抗血管"),
    # PD-1 dMMR
    ("CRC-W-2026-004", "pabolizhu", "core", "200 mg q3w", "KEYNOTE-177"),
    # TRAINER
    ("CRC-W-2026-005", "aoshibobo", "core", "TNT 模式", "TRAINER"),
    ("CRC-W-2026-005", "kapeitabin", "core", "TNT 模式", "TRAINER"),
    # Neo-STAR
    ("CRC-W-2026-006", "teruipuli", "core", "新辅助免疫", "Neo-STAR"),
    ("CRC-W-2026-006", "kapeitabin", "core", "CAPOX 骨架", "Neo-STAR"),
    ("CRC-W-2026-006", "aoshibobo", "core", "CAPOX 骨架", "Neo-STAR"),
    # ATOMIC
    ("CRC-W-2026-007", "pabolizhu", "core", "辅助免疫", "ATOMIC"),
    # DENEB
    ("CRC-W-2026-008", None, "supportive", None, "血液 miRNA 检测（非药物）"),  # 特殊条目
    # PICC-2
    ("CRC-W-2026-009", "teruipuli", "core", "新辅助免疫", "PICC-2"),
    # FIND
    ("CRC-W-2026-010", None, "supportive", None, "ctDNA 检测（非药物）"),  # 特殊
    # 阿司匹林
    ("CRC-W-2026-011", "asipilin", "adjunct", "100 mg qd", "PIK3CA+ 辅助"),
    # ---- 中医方 ----
    ("CRC-T-2026-001", "jianpibushenfang", "core", "中医辨证方剂", "EJC 2024"),
    ("CRC-T-2026-001", "huangqi", "core", "健脾补肾方核心药", None),
    ("CRC-T-2026-001", "baizhu", "core", "健脾补肾方核心药", None),
    ("CRC-T-2026-002", "huangqijianzhongtang", "core", "中医辨证方剂", "黄芪建中汤 RCT"),
    ("CRC-T-2026-002", "huangqi", "core", "黄芪建中汤君药", None),
    ("CRC-T-2026-003", "shenlingbaizhusan", "core", "中医辨证方剂", "参苓白术散 RCT"),
    ("CRC-T-2026-003", "baizhu", "core", "方剂核心药", None),
    ("CRC-T-2026-003", "fuling", "core", "方剂核心药", None),
    ("CRC-T-2026-003", "aoshibobo", "core", "FOLFOX4 骨架", None),
    ("CRC-T-2026-003", "funiaomiding", "core", "FOLFOX4 骨架", None),
    ("CRC-T-2026-004", "buzhongyiqitang", "core", "中医辨证方剂", "LARS"),
    ("CRC-T-2026-004", "huangqi", "core", "方剂君药", None),
    ("CRC-T-2026-005", "shenlingbaizhusan", "core", "中医辨证方剂", "LARS"),
    ("CRC-T-2026-006", "baliaoacupuncture", "core", "针灸穴位", "海慈"),
    ("CRC-T-2026-006", "buzhongyiqitang", "adjunct", "LARS 配合方剂", None),
    ("CRC-T-2026-007", "cidanjiaonang", "core", "中成药", "慈丹胶囊"),
    ("CRC-T-2026-008", None, "supportive", None, "时间医学方案（多手段组合）"),
    ("CRC-T-2026-009", "huanglian", "core", "黄连素 300 mg tid", "UC-CRC"),
    ("CRC-T-2026-010", "fuzi", "core", "附子理中丸君药（需炮制）", "扶阳"),
    ("CRC-T-2026-010", "huanglian", "core", "桂枝茯苓丸配伍", None),
    ("CRC-T-2026-011", "wumeiwan", "core", "中医辨证方剂", "肠纤维化"),
    ("CRC-T-2026-011", "wumei", "core", "方剂君药", None),
    ("CRC-T-2026-012", "bazhengtang", "core", "八珍汤", "5-FU 增敏"),
    ("CRC-T-2026-012", "huangqi", "core", "当归补血汤君药", None),
    ("CRC-T-2026-013", "gouqi", "core", "枸杞多糖水凝胶", "MSS-CRC 增敏"),
    ("CRC-T-2026-013", "aoshibobo", "core", "奥沙利铂", None),
]

# ============================================================
# 第一批：方案-医院关联（regimen_hospitals 表）
# ============================================================
# 字段：(regimen_id, hospital_name, department, lead_team, contact_phone, contact_website, contact_wechat, city, address, feature, is_premier)
REGIMEN_HOSPITALS = [
    # 旗舰医院
    ("CRC-W-2026-004", "北京大学肿瘤医院", "消化肿瘤内科", "张小田团队", "010-8819-0000", "pkucancer.cn", "北京大学肿瘤医院", "北京", "北京海淀区阜成路52号", "国家癌症中心依托单位", 1),
    ("CRC-W-2026-009", "中山大学附属第六医院", "结直肠肛门外科", "邓艳红团队", "020-3825-4000", "zslyy.com", "中山六院", "广州", "广州天河区员村二横路26号", "国内 LARC 免疫新辅助领跑", 1),
    ("CRC-W-2026-010", "复旦大学附属肿瘤医院", "大肠外科", "彭俊杰/丁春明团队", "021-6417-5590", "fudan-zl.org", "复旦肿瘤医院", "上海", "上海徐汇区东安路270号", "ctDNA 监测全国推广", 1),
    ("CRC-W-2026-011", "中山大学肿瘤防治中心", "结直肠科", "陈功团队", "020-8734-3000", "sysucc.org.cn", "中肿", "广州", "广州越秀区东风东路651号", "EPISODE 系列研究", 1),
    ("CRC-W-2026-005", "复旦大学附属肿瘤医院", "大肠外科", "王中华团队", "021-6417-5590", "fudan-zl.org", "复旦肿瘤医院", "上海", "上海徐汇区东安路270号", "STTT 2026 进化综述", 1),
    ("CRC-W-2026-008", "中国医学科学院肿瘤医院", "防癌体检中心", "团队", "010-8778-0000", "cicams.ac.cn", "医科院肿瘤医院", "北京", "北京朝阳区潘家园南里17号", "DENEB 早筛研究", 1),
    # 中医旗舰
    ("CRC-T-2026-001", "中国中医科学院西苑医院", "肿瘤诊疗部", "杨宇飞", "010-6283-5678", "xyhospital.com", "中国中医科学院西苑医院", "北京", "北京海淀区西苑操场1号", "国家中医肿瘤旗舰", 1),
    ("CRC-T-2026-001", "中国中医科学院广安门医院", "肿瘤科", "李道睿", "010-8800-1114", "gamhospitaly.cn", "广安门医院", "北京", "北京西城区北线阁5号", "国家中医肿瘤旗舰", 1),
    ("CRC-T-2026-002", "湖北省十堰市太和医院", "中西医结合科", "方兴刚", "0719-8801000", "taihehospital.com", None, "十堰", "湖北十堰市茅箭区人民南路32号", "黄芪建中汤 RCT 牵头", 0),
    ("CRC-T-2026-003", "南阳市第一人民医院", "肿瘤科", "杨清乐", "0377-63310000", "nysdyrmyy.com", None, "南阳", "河南南阳市卧龙区七一路93号", "参苓白术散 RCT 牵头", 0),
    ("CRC-T-2026-003", "郑州大学附属肿瘤医院（河南省肿瘤医院）", "中西医结合科", "孙旭", "0371-65587000", "hnzlyy.com.cn", "河南省肿瘤医院", "郑州", "河南郑州市金水区东明路127号", "参苓白术散 RCT 合作", 1),
    ("CRC-T-2026-004", "中国中医科学院西苑医院", "肿瘤诊疗部", "张彤/郭全", "010-6283-5678", "xyhospital.com", "中国中医科学院西苑医院", "北京", "北京海淀区西苑操场1号", "LARS 补中益气汤", 1),
    ("CRC-T-2026-005", "湖南中医药大学附属中西医结合医院", "肛肠科", "朱晨鸿/肖佑", "0731-84810000", "hnzyy.cn", "湖中医附院", "长沙", "湖南长沙市开福区湘雅路30号", "参苓白术散+生物反馈 RCT", 1),
    ("CRC-T-2026-006", "青岛市海慈中医医疗集团", "肛肠科", "马琳团队", "0532-83777000", "haicimedical.com", "青岛市海慈医疗集团", "青岛", "山东青岛市市北区人民路4号", "山东省中医药重点专科·LARS", 1),
    ("CRC-T-2026-007", "北京伟达中医肿瘤医院", "中医肿瘤科", "郑伟达", "010-6789-XXXX", "wdyiyuan.com", "伟达中医肿瘤医院", "北京", "北京朝阳区博大路3号", "慈丹胶囊·十二五国家科技重大专项", 0),
    ("CRC-T-2026-007", "上海东方肝胆外科医院", "中西医结合科", "吴孟超团队", "021-6556-4180", "ehbh.cn", None, "上海", "上海杨浦区长海路225号", "慈丹胶囊责任单位", 1),
    ("CRC-T-2026-008", "贵州中医药大学第一附属医院", "中医肿瘤科", "谢贞明/唐东昕", "0851-8561-1114", "gzucm.edu.cn", None, "贵阳", "贵州贵阳市云岩区宝山北路71号", "时间医学 RCT 牵头", 0),
    ("CRC-T-2026-009", "中国中医科学院广安门医院", "肛肠科", "团队", "010-8800-1114", "gamhospitaly.cn", "广安门医院", "北京", "北京西城区北线阁5号", "黄连素 + 美沙拉嗪", 1),
    ("CRC-T-2026-010", "中国中医科学院广安门医院", "中医肿瘤科", "团队", "010-8800-1114", "gamhospitaly.cn", "广安门医院", "北京", "北京西城区北线阁5号", "扶阳消阴治法·腺瘤", 1),
    ("CRC-T-2026-011", "中国中医科学院西苑医院", "肿瘤诊疗部", "吴煜", "010-6283-5678", "xyhospital.com", "中国中医科学院西苑医院", "北京", "北京海淀区西苑操场1号", "乌梅丸抗肠纤维化", 1),
    ("CRC-T-2026-012", "中国中医科学院西苑医院", "肿瘤诊疗部", "杨宇飞", "010-6283-5678", "xyhospital.com", "中国中医科学院西苑医院", "北京", "北京海淀区西苑操场1号", "5-FU 增敏 益气养血方", 1),
    ("CRC-T-2026-013", "中国中医科学院西苑医院", "肿瘤诊疗部", "凌昌全/翟笑枫团队（合作）", "010-6283-5678", "xyhospital.com", "中国中医科学院西苑医院", "北京", "北京海淀区西苑操场1号", "枸杞多糖·长海医院", 1),
    ("CRC-T-2026-013", "上海长海医院", "中医肿瘤科", "凌昌全/翟笑枫", "021-3116-6666", "chhospital.com.cn", None, "上海", "上海杨浦区长海路168号", "枸杞多糖水凝胶", 1),
    # 中医集聚医院（民营旗舰）
    ("CRC-T-2026-007", "北京好中医国医馆（潘家园）", "中医肿瘤专科", "郝迎旭/叶霈智/武常生等", "010-8779-XXXX", "bjhzy.cn", "北京好中医", "北京", "北京朝阳区潘家园路9号", "中医肿瘤医联体", 0),
    ("CRC-T-2026-001", "浙江省肿瘤医院", "中西医结合科", "团队", "0571-8812-2222", "zjch.cn", "浙江省肿瘤医院", "杭州", "浙江杭州市拱墅区半山东路1号", "省级肿瘤中医", 1),
    ("CRC-T-2026-001", "上海中医药大学附属龙华医院", "肿瘤科", "王中奇/徐蔚杰", "021-6438-5700", "longhua.net", "上海龙华医院", "上海", "上海徐汇区宛平南路725号", "中医肿瘤旗舰", 1),
    ("CRC-T-2026-001", "广东省中医院", "肿瘤科", "徐凯", "020-8188-7233", "gdhtcm.com", "广东省中医院", "广州", "广东广州市越秀区大德路111号", "中医肿瘤临床基地", 1),
    ("CRC-T-2026-001", "江苏省中医院", "肿瘤科", "沈建平", "025-8661-7141", "jshtcm.com", "江苏省中医院", "南京", "江苏南京市秦淮区汉中路155号", "胃肠肿瘤综合", 1),
    ("CRC-T-2026-001", "北京中医药大学东方医院", "中医肿瘤科", "刘传波", "010-6768-9655", "dongfangyy.com.cn", "北京中医药大学东方医院", "北京", "北京丰台区方庄芳星园一区6号", "中医肿瘤新势力", 0),
    ("CRC-T-2026-001", "南京太乙堂中医医院", "中医肿瘤科", "戴春海", "025-8463-0000", "taiyitang.com", None, "南京", "江苏南京紫金山下瑞金路27号", "民营中医肿瘤", 0),
    ("CRC-T-2026-001", "北京中医药大学第三附属医院", "肿瘤血液科", "武常生", "010-5207-5300", "bucmsdsf.com", None, "北京", "北京朝阳区安定门外小关街51号", "中西医结合肿瘤", 0),
]


def apply_schema(conn: sqlite3.Connection, schema_path: Path) -> None:
    """应用 SQL schema 文件。"""
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema 文件不存在: {schema_path}")
    sql = schema_path.read_text(encoding="utf-8")
    conn.executescript(sql)
    conn.commit()


def insert_drugs(conn: sqlite3.Connection) -> int:
    """插入药物（按 pinyin 主键去重）。"""
    cur = conn.cursor()
    inserted = 0
    skipped = 0
    for d in DRUGS:
        name_cn, name_en, pinyin, category, tag, mechanism, indications, evidence, doi = d
        try:
            cur.execute("""
                INSERT INTO drugs (name_cn, name_en, name_pinyin, category, medicine_type_tag,
                                 mechanism, indications, evidence_level, source_doi)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name_cn, name_en, pinyin, category, tag, mechanism, indications, evidence, doi))
            inserted += 1
        except sqlite3.IntegrityError:
            skipped += 1
    conn.commit()
    return inserted, skipped


def insert_regimens(conn: sqlite3.Connection) -> int:
    """插入方案。"""
    cur = conn.cursor()
    inserted = 0
    for r in REGIMENS:
        rid, name, ct, stage, mtype, population, summary, key_data, evidence = r
        try:
            cur.execute("""
                INSERT INTO regimens (regimen_id, name, cancer_type, stage, medicine_type,
                                   target_population, summary, key_data, evidence_source,
                                   first_seen_date, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-08-20', '2026-08-20')
            """, (rid, name, ct, stage, mtype, population, summary, key_data, evidence))
            inserted += 1
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    return inserted


def insert_regimen_drugs(conn: sqlite3.Connection) -> int:
    """关联方案-药物。"""
    cur = conn.cursor()
    # 先建立 pinyin -> drug_id 映射
    cur.execute("SELECT drug_id, name_pinyin FROM drugs")
    pinyin_to_id = {p: did for did, p in cur.fetchall()}
    inserted = 0
    skipped = 0
    for rd in REGIMEN_DRUGS:
        rid, pinyin, role, dose, notes = rd
        if pinyin is None:
            # 特殊条目（如"血液 miRNA 检测"非药物），跳过
            skipped += 1
            continue
        drug_id = pinyin_to_id.get(pinyin)
        if not drug_id:
            print(f"⚠️ 未找到药物: {pinyin}（regimen={rid}）")
            skipped += 1
            continue
        try:
            cur.execute("""
                INSERT INTO regimen_drugs (regimen_id, drug_id, role, dose_default, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (rid, drug_id, role, dose, notes))
            inserted += 1
        except sqlite3.IntegrityError:
            skipped += 1
    conn.commit()
    return inserted, skipped


def insert_regimen_hospitals(conn: sqlite3.Connection) -> int:
    """关联方案-医院。"""
    cur = conn.cursor()
    inserted = 0
    skipped = 0
    for rh in REGIMEN_HOSPITALS:
        rid, hospital, dept, team, phone, web, wechat, city, address, feature, premier = rh
        try:
            cur.execute("""
                INSERT INTO regimen_hospitals (regimen_id, hospital_name, department, lead_team,
                                            contact_phone, contact_website, contact_wechat, city,
                                            address, feature, is_premier)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (rid, hospital, dept, team, phone, web, wechat, city, address, feature, premier))
            inserted += 1
        except sqlite3.IntegrityError:
            skipped += 1
    conn.commit()
    return inserted, skipped


def print_summary(conn: sqlite3.Connection, stats: dict) -> None:
    """打印库统计。"""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM drugs")
    n_drugs = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM drugs WHERE medicine_type_tag='western'")
    n_w = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM drugs WHERE medicine_type_tag='tcm'")
    n_t = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM drugs WHERE medicine_type_tag='both'")
    n_b = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM regimens")
    n_r = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM regimens WHERE medicine_type='western'")
    n_rw = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM regimens WHERE medicine_type='tcm'")
    n_rt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM regimen_drugs")
    n_rd = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM regimen_hospitals")
    n_rh = cur.fetchone()[0]

    print("\n" + "=" * 60)
    print("📊 drugs.db 初始化统计")
    print("=" * 60)
    print(f"  药物 drugs          : {n_drugs} (西医 {n_w} / 中医 {n_t} / both {n_b})")
    print(f"  方案 regimens       : {n_r} (西医 {n_rw} / 中医 {n_rt})")
    print(f"  方案-药物关联       : {n_rd}")
    print(f"  方案-医院关联       : {n_rh}")
    print("=" * 60)
    print(f"  本次新增药物: {stats['drugs_inserted']} (跳过 {stats['drugs_skipped']})")
    print(f"  本次新增方案: {stats['regimens_inserted']}")
    print(f"  本次新增方案-药物: {stats['rd_inserted']} (跳过 {stats['rd_skipped']})")
    print(f"  本次新增方案-医院: {stats['rh_inserted']} (跳过 {stats['rh_skipped']})")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="初始化直肠癌药物物料清单库")
    parser.add_argument("--db", required=True, help="drugs.db 路径（不存在则创建）")
    parser.add_argument("--schema", required=True, help="drugs-schema.sql 路径")
    args = parser.parse_args()

    db_path = Path(args.db)
    schema_path = Path(args.schema)

    if db_path.exists():
        print(f"⚠️  {db_path} 已存在，将跳过已存在的主键/约束冲突（幂等）")
    else:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"📁 创建 {db_path}")

    conn = sqlite3.connect(str(db_path))
    try:
        # 1. 应用 schema
        print(f"📐 应用 schema: {schema_path}")
        apply_schema(conn, schema_path)

        # 2. 灌入数据
        print(f"💊 灌入药物...")
        d_in, d_sk = insert_drugs(conn)
        print(f"   ✅ 新增 {d_in} 条，跳过 {d_sk} 条（已存在）")

        print(f"📋 灌入方案...")
        r_in = insert_regimens(conn)
        print(f"   ✅ 新增 {r_in} 条")

        print(f"🔗 灌入方案-药物关联...")
        rd_in, rd_sk = insert_regimen_drugs(conn)
        print(f"   ✅ 新增 {rd_in} 条，跳过 {rd_sk} 条")

        print(f"🏥 灌入方案-医院关联...")
        rh_in, rh_sk = insert_regimen_hospitals(conn)
        print(f"   ✅ 新增 {rh_in} 条，跳过 {rh_sk} 条")

        # 3. 统计
        stats = {
            "drugs_inserted": d_in, "drugs_skipped": d_sk,
            "regimens_inserted": r_in,
            "rd_inserted": rd_in, "rd_skipped": rd_sk,
            "rh_inserted": rh_in, "rh_skipped": rh_sk,
        }
        print_summary(conn, stats)
        print(f"\n✅ 初始化完成：{db_path}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
