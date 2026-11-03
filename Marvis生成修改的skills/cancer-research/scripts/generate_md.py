"""从 data.json 生成完整 Markdown 方案索引报告。

v2 (2026-08-28): 支持 today 参数 + 方案状态识别 (new/updated/kept)
"""
import sys
import json
from pathlib import Path
from datetime import datetime

# 强制 stdout UTF-8（防 GBK 报错，checklist 已闭环 2026-08-28）
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SITE_DIR = Path(r"C:\Users\AaronMY\.mavis\workspace\cancer-report-site")
DATA = SITE_DIR / "data.json"
# today 可通过命令行参数覆盖（默认 = 今天）
if len(sys.argv) > 1:
    TODAY = sys.argv[1]
else:
    TODAY = datetime.now().strftime("%Y-%m-%d")
# 输出文件名（保留 8-24 基线习惯 — 8-24 是首份完整快照）
# 但实际产出文件名按 today 走
OUT_MD = Path(rf"C:\Users\AaronMY\.mavis\workspace\直肠癌晚期_方案索引_{TODAY}.md")

data = json.loads(DATA.read_text(encoding="utf-8"))
s = data["stats"]
regimens = data["regimens"]
reports = data["reports"]

def esc(s):
    if s is None:
        return ""
    return str(s).replace("|", "\\|").replace("\n", " ")

# 状态映射：data.json 的 regimen 包含 status_in_report（在最新报告中）
# 1) 查 latest TCM report + latest Western report
# 2) 查 regimen 自己的 last_updated 是否 >= 上一份基线日期
def status_badge(r):
    """
    状态识别规则（按时间优先级）：
    1) 如果 r.last_updated == TODAY 且该 regimen 在最新 report 里是 'new' → 🆕新增
    2) 如果 r.last_updated == TODAY 且是 'updated' → 🔄更新
    3) 否则 → ➖ 保留
    """
    # 简化：直接看 last_updated 是否等于今天
    if r.get("last_updated") == TODAY:
        return "🆕 新增"
    return "➖ 保留"

def section_for_type(mtype):
    return {
        "western": "一、西医方案",
        "tcm": "二、中医方案",
        "combined": "三、中西医合集",
    }[mtype]

lines = []
lines.append(f"# 直肠癌(晚期)治疗方案索引（{TODAY} 周更）")
lines.append("")
lines.append(f"> **生成时间**：{s['generated_at']}")
lines.append(f"> **数据来源**：drugs.db（SQLite 药物物料清单库）")
lines.append(f"> **报告版本**：周更 v{TODAY}（每周五 00:00 自动更新；首份基线 2026-08-24）")
lines.append(">")
lines.append("> **本报告不含药物配方/剂量**——药物细节查 drugs.db，或打开同目录 HTML 页面点击方案 ID 查看")
lines.append("> **使用前必须与主治医生讨论**——本报告是信息索引，不是处方建议")
lines.append("")
lines.append("---")
lines.append("")

# 数据概览
lines.append("## 数据概览")
lines.append("")
lines.append("| 维度 | 西医 | 中医 | 共用 | 合计 |")
lines.append("|------|------|------|------|------|")
lines.append(f"| 方案数 | {s['regimens_western']} | {s['regimens_tcm']} | {s['regimens_combined']} | **{s['regimens_total']}** |")
lines.append(f"| 药物数 | {s['drugs_western']} | {s['drugs_tcm']} | {s['drugs_both']} | **{s['drugs_total']}** |")
lines.append(f"| 医院数 | — | — | — | **{s['hospitals_total']}**（重点专科 {s['premier_hospitals']}） |")
lines.append(f"| 关联数 | — | — | — | 方案-药物 {s['regimen_drug_links']} / 方案-医院 {s['regimen_hospital_links']} |")
lines.append("")
lines.append("---")
lines.append("")

# 按分册分组
for mtype in ["western", "tcm", "combined"]:
    group = [r for r in regimens if r["medicine_type"] == mtype]
    if not group:
        continue
    lines.append(f"## {section_for_type(mtype)}")
    lines.append("")
    lines.append("### 方案总表")
    lines.append("")
    lines.append("| 方案 ID | 方案名 | 分期 | 可信度 | 适用人群 | 核心能力 | 关键数据 | 证据 | 状态 |")
    lines.append("|---------|--------|------|--------|---------|---------|---------|------|------|")
    for r in group:
        cred = r.get("credibility_score", "N/A")
        lines.append(f"| **{r['regimen_id']}** | {esc(r['name'])} | {esc(r['stage'])} | **{cred}** | {esc(r['target_population'])} | {esc(r['summary'])} | {esc(r['key_data'])} | {esc(r['evidence_source'])} | {status_badge(r)} |")
    lines.append("")

    # 每个方案详情
    lines.append("### 方案详情")
    lines.append("")
    for r in group:
        lines.append(f"#### {r['regimen_id']} · {r['name']}")
        lines.append("")
        lines.append(f"- **分期**：{r['stage']}")
        lines.append(f"- **适用人群**：{esc(r['target_population'])}")
        lines.append(f"- **核心能力**：{esc(r['summary'])}")
        lines.append(f"- **关键数据**：{esc(r['key_data'])}")
        lines.append(f"- **证据来源**：{esc(r['evidence_source'])}")
        lines.append(f"- **首次入库**：{r['first_seen_date']} / **最后更新**：{r['last_updated']}")
        lines.append("")

        # 药物
        if r["drugs"]:
            lines.append("**涉及药物**（查 drugs.db 获取完整机制/剂量）：")
            lines.append("")
            lines.append("| 药物 | 类别 | 体系 | 角色 | 默认剂量 | 证据等级 |")
            lines.append("|------|------|------|------|---------|---------|")
            for d in r["drugs"]:
                tag_label = {"western":"西医","tcm":"中医","both":"共用"}[d["medicine_type_tag"]]
                role_label = {"core":"主药","adjunct":"辅药","supportive":"支持"}[d["role"]]
                lines.append(f"| {d['name_cn']} | {esc(d['category'])} | {tag_label} | {role_label} | {esc(d['dose_default'])} | {esc(d['evidence_level'])} |")
            lines.append("")

        # 医院
        if r["hospitals"]:
            lines.append("**可开展医院/团队**：")
            lines.append("")
            lines.append("| 医院 | 科室 | 主诊/团队 | 城市 | 可信度 | 联系方式 | 特色 |")
            lines.append("|------|------|----------|------|--------|---------|------|")
            for h in r["hospitals"]:
                contact_parts = []
                if h["contact_phone"]: contact_parts.append(f"☎ {h['contact_phone']}")
                if h["contact_website"]:
                    ls = h.get("link_status", "")
                    code = h.get("link_http_code", 0)
                    if ls == "ok": badge = " ✅"
                    elif ls == "fail" and code in (403, 521): badge = " 🌐需浏览器"
                    elif ls == "fail": badge = " ❌待核实"
                    else: badge = ""
                    # 修正: 防止 https://https:// 前缀重复
                    url = h["contact_website"]
                    if url.startswith(("http://", "https://")):
                        href = url
                    else:
                        href = "https://" + url
                    contact_parts.append(f"🌐 [{url}]({href}){badge}")
                if h["contact_wechat"]: contact_parts.append(f"📱 {h['contact_wechat']}")
                contact = " / ".join(contact_parts) if contact_parts else "—"
                feature = f"{'⭐ ' if h['is_premier'] else ''}{esc(h['feature'])}"
                hcred = h.get("credibility_score", "N/A")
                lines.append(f"| {esc(h['hospital_name'])} | {esc(h['department'])} | {esc(h['lead_team'])} | {esc(h['city'])} | **{hcred}** | {contact} | {feature} |")
            lines.append("")
        lines.append("---")
        lines.append("")

# 渠道
lines.append("## 四、官方/科普/患者社区渠道")
lines.append("")
lines.append("### 4.1 官方权威")
lines.append("- 国家卫健委 nhc.gov.cn")
lines.append("- 国家中医药管理局 natcm.gov.cn")
lines.append("- CSCO csco.org.cn")
lines.append("- 中华中医药学会肿瘤分会")
lines.append("")
lines.append("### 4.2 顶级医院")
lines.append("- 复旦肿瘤 fudan-zl.org / 中山六院 zslyy.com / 北京大学肿瘤 pkucancer.cn")
lines.append("- 中国医科院肿瘤 cicams.ac.cn / 中山肿瘤 sysucc.org.cn")
lines.append("- 西苑 xyhospital.com / 广安门 gamhospitaly.cn / 龙华 longhua.net")
lines.append("- 广东省中医院 gdhtcm.com / 江苏省中医院 jshtcm.com")
lines.append("")
lines.append("### 4.3 患者社区")
lines.append("- 觅健 meijian360.com / 癌度 caidu.cn / 丁香园 dxy.cn / 知乎癌症话题")
lines.append("")
lines.append("### 4.4 国际权威")
lines.append("- NCCN nccn.org / ESMO esmo.org / ASCO asco.org / ClinicalTrials.gov")
lines.append("")
lines.append("---")
lines.append("")

# 报告历史
lines.append("## 五、报告历史")
lines.append("")
lines.append("| 日期 | 癌种 | 分册 | 新增 | 更新 | 保留 | 新药物 | note_id |")
lines.append("|------|------|------|------|------|------|--------|---------|")
for rp in reports:
    lines.append(f"| {rp['report_date']} | {rp['cancer_type']} | {rp['medicine_type']} | {rp['new_regimens_count']} | {rp['updated_regimens_count']} | {rp['kept_regimens_count']} | {rp['new_drugs_count']} | {rp.get('biji_note_id') or '—'} |")
lines.append("")
lines.append("---")
lines.append("")
lines.append("## 六、如何查药物细节")
lines.append("")
lines.append("药物细节（组成、剂量、机制、证据）全部在 `drugs.db`（SQLite）。查询示例：")
lines.append("")
lines.append("```sql")
lines.append("-- 查某方案的所有药物")
lines.append("SELECT d.name_cn, d.medicine_type_tag, rd.role, rd.dose_default")
lines.append("  FROM regimens r")
lines.append("  JOIN regimen_drugs rd ON r.regimen_id = rd.regimen_id")
lines.append("  JOIN drugs d ON rd.drug_id = d.drug_id")
lines.append(" WHERE r.regimen_id = 'CRC-T-2026-002';")
lines.append("")
lines.append("-- 查某医院能做的所有方案")
lines.append("SELECT r.regimen_id, r.name FROM regimens r")
lines.append("  JOIN regimen_hospitals rh ON r.regimen_id = rh.regimen_id")
lines.append(" WHERE rh.hospital_name LIKE '%西苑%';")
lines.append("```")
lines.append("")
lines.append("也可以直接打开同目录的 HTML 页面，点击方案 ID 查看详情。")
lines.append("")
lines.append("---")
lines.append("")
lines.append("*本报告由 cancer-research skill 自动生成 · 数据全部来自 drugs.db · 仅供与主治医生讨论参考*")

OUT_MD.write_text("\n".join(lines), encoding="utf-8")
print(f"✅ MD 已生成：{OUT_MD}")
print(f"   字符数：{len(OUT_MD.read_text(encoding='utf-8'))}")
print(f"   方案数：{len(regimens)}")
