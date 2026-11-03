"""从 drugs.db 导出全量数据为 JSON，供 HTML 内嵌和 MD 生成使用。"""
import sys
import sqlite3
import json
from pathlib import Path
from datetime import datetime

# 强制 stdout UTF-8（防 GBK 报错，checklist 已闭环 2026-08-28）
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DB = r"C:\Users\AaronMY\.mavis\workspace\drugs.db"
OUT_DIR = Path(r"C:\Users\AaronMY\.mavis\workspace\cancer-report-site")
OUT_DIR.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def q(sql, params=()):
    cur.execute(sql, params)
    return [dict(r) for r in cur.fetchall()]

# 1. 方案 + 关联药物 + 关联医院
regimens = q("""
    SELECT r.*,
           (SELECT COUNT(*) FROM regimen_drugs rd WHERE rd.regimen_id=r.regimen_id) AS drug_count,
           (SELECT COUNT(*) FROM regimen_hospitals rh WHERE rh.regimen_id=r.regimen_id) AS hospital_count
      FROM regimens r
     ORDER BY
       CASE r.credibility_score WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 ELSE 3 END,
       r.medicine_type, r.regimen_id
""")

for r in regimens:
    r["drugs"] = q("""
        SELECT d.drug_id, d.name_cn, d.name_en, d.name_pinyin, d.category,
               d.medicine_type_tag, d.mechanism, d.indications,
               d.evidence_level, d.source_doi, d.source_url,
               rd.role, rd.dose_default, rd.notes
          FROM regimen_drugs rd
          JOIN drugs d ON rd.drug_id = d.drug_id
         WHERE rd.regimen_id = ?
         ORDER BY rd.role, d.name_pinyin
    """, (r["regimen_id"],))
    r["hospitals"] = q("""
        SELECT hospital_name, department, lead_team, contact_phone,
               contact_website, contact_wechat, city, address, feature, is_premier,
               link_status, link_http_code, link_title, link_checked_at
          FROM regimen_hospitals
         WHERE regimen_id = ?
         ORDER BY is_premier DESC, city
    """, (r["regimen_id"],))

# 2. 药物全量
drugs = q("""
    SELECT d.* FROM drugs d ORDER BY d.medicine_type_tag, d.category, d.name_pinyin
""")

# 3. 报告元信息
reports = q("SELECT * FROM reports ORDER BY report_date DESC")

# 4. 统计
stats = {
    "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "regimens_total": len(regimens),
    "regimens_western": sum(1 for r in regimens if r["medicine_type"] == "western"),
    "regimens_tcm": sum(1 for r in regimens if r["medicine_type"] == "tcm"),
    "regimens_combined": sum(1 for r in regimens if r["medicine_type"] == "combined"),
    "drugs_total": len(drugs),
    "drugs_western": sum(1 for d in drugs if d["medicine_type_tag"] == "western"),
    "drugs_tcm": sum(1 for d in drugs if d["medicine_type_tag"] == "tcm"),
    "drugs_both": sum(1 for d in drugs if d["medicine_type_tag"] == "both"),
    "hospitals_total": q("SELECT COUNT(DISTINCT hospital_name) AS c FROM regimen_hospitals")[0]["c"],
    "premier_hospitals": q("SELECT COUNT(DISTINCT hospital_name) AS c FROM regimen_hospitals WHERE is_premier=1")[0]["c"],
    "regimen_drug_links": q("SELECT COUNT(*) AS c FROM regimen_drugs")[0]["c"],
    "regimen_hospital_links": q("SELECT COUNT(*) AS c FROM regimen_hospitals")[0]["c"],
}

data = {
    "stats": stats,
    "regimens": regimens,
    "drugs": drugs,
    "reports": reports,
}

out_path = OUT_DIR / "data.json"
out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"✅ 导出 {out_path}")
print(f"   方案 {stats['regimens_total']} (西医 {stats['regimens_western']} / 中医 {stats['regimens_tcm']})")
print(f"   药物 {stats['drugs_total']} (西医 {stats['drugs_western']} / 中医 {stats['drugs_tcm']} / 共用 {stats['drugs_both']})")
print(f"   医院 {stats['hospitals_total']} (重点 {stats['premier_hospitals']})")
print(f"   关联 方案-药物 {stats['regimen_drug_links']} / 方案-医院 {stats['regimen_hospital_links']}")
print(f"   报告 {len(reports)} 篇")

conn.close()
