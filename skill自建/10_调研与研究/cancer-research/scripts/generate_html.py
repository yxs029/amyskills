"""从 data.json 生成腾讯风格单文件 HTML（内嵌数据，可交互）。

v2 (2026-08-28): 标题日期 + 副标题 + 数据概览标签动态化
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
OUT_HTML = SITE_DIR / "index.html"
if len(sys.argv) > 1:
    TODAY = sys.argv[1]
else:
    TODAY = datetime.now().strftime("%Y-%m-%d")

data_json = DATA.read_text(encoding="utf-8")
# 防止 </script> 出现在 JSON 里破坏 script 标签
data_json_safe = data_json.replace("</", "<\\/")

html = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>直肠癌晚期治疗方案索引 · __TODAY__ 周更</title>
<style>
  :root {
    --primary: #0052D9;
    --primary-light: #E8F3FF;
    --primary-dark: #0034B5;
    --success: #00A870;
    --success-light: #E8F8F0;
    --warning: #ED7B2F;
    --warning-light: #FFF3E8;
    --danger: #D54941;
    --danger-light: #FDECEB;
    --text-1: #181B25;
    --text-2: #4B5260;
    --text-3: #8690A6;
    --border: #E7E9F0;
    --bg: #F5F7FA;
    --card-bg: #FFFFFF;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.05);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--text-1);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

  /* Hero */
  .hero {
    background: linear-gradient(135deg, #0052D9 0%, #366EF4 50%, #5B8DEF 100%);
    color: #fff;
    padding: 48px 0 40px;
    position: relative;
    overflow: hidden;
  }
  .hero::before {
    content: '';
    position: absolute;
    top: -50%; right: -10%;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
    border-radius: 50%;
  }
  .hero-inner { position: relative; z-index: 1; }
  .hero-badge {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(10px);
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 16px;
    letter-spacing: 0.3px;
  }
  .hero h1 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 10px;
    letter-spacing: -0.5px;
  }
  .hero .subtitle {
    font-size: 15px;
    opacity: 0.9;
    max-width: 680px;
    line-height: 1.7;
  }
  .hero .meta {
    margin-top: 18px;
    font-size: 13px;
    opacity: 0.82;
  }

  /* Stats */
  .stats {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
    margin-top: -28px;
    position: relative;
    z-index: 2;
    margin-bottom: 32px;
  }
  .stat-card {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 20px 18px;
    box-shadow: var(--shadow-md);
    text-align: center;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .stat-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--primary);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .stat-label {
    font-size: 13px;
    color: var(--text-3);
    margin-top: 6px;
  }
  .stat-sub {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 4px;
  }

  /* Toolbar */
  .toolbar {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 16px 18px;
    box-shadow: var(--shadow-sm);
    margin-bottom: 24px;
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }
  .tabs { display: flex; gap: 4px; background: var(--bg); padding: 4px; border-radius: 8px; }
  .tab {
    padding: 7px 18px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
    transition: all 0.18s;
  }
  .tab:hover { color: var(--primary); }
  .tab.active { background: #fff; color: var(--primary); box-shadow: var(--shadow-sm); }
  .search-box {
    flex: 1;
    min-width: 240px;
    position: relative;
  }
  .search-box input {
    width: 100%;
    padding: 9px 14px 9px 38px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    background: #fff;
  }
  .search-box input:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-light);
  }
  .search-box::before {
    content: '🔍';
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    opacity: 0.5;
  }
  .result-count {
    font-size: 13px;
    color: var(--text-3);
    white-space: nowrap;
  }

  /* Regimen grid */
  .regimen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }
  .regimen-card {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 20px;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    border: 1px solid transparent;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .regimen-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--shadow-lg);
    border-color: var(--primary-light);
  }
  .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .regimen-id {
    font-family: "SF Mono", "Consolas", monospace;
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
    background: var(--primary-light);
    padding: 3px 9px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .tag {
    font-size: 11px;
    padding: 3px 9px;
    border-radius: 4px;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .tag-western { background: #E8F3FF; color: #0052D9; }
  .tag-tcm { background: #E8F8F0; color: #00A870; }
  .tag-combined { background: #FFF3E8; color: #ED7B2F; }
  .cred {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .cred-A { background: #E8F8F0; color: #00A870; }
  .cred-B { background: #FFF3E8; color: #ED7B2F; }
  .cred-C { background: #F0F1F5; color: #8690A6; }
  .regimen-name {
    font-size: 17px;
    font-weight: 600;
    color: var(--text-1);
    line-height: 1.4;
  }
  .regimen-summary {
    font-size: 13.5px;
    color: var(--text-2);
    line-height: 1.65;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .regimen-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px dashed var(--border);
  }
  .meta-chip {
    font-size: 12px;
    color: var(--text-2);
    background: var(--bg);
    padding: 3px 9px;
    border-radius: 4px;
  }
  .meta-chip strong { color: var(--text-1); font-weight: 600; }
  .key-data {
    font-size: 12.5px;
    color: var(--danger);
    background: var(--danger-light);
    padding: 6px 10px;
    border-radius: 6px;
    font-weight: 500;
    line-height: 1.5;
  }

  /* Modal */
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(24,27,37,0.55);
    backdrop-filter: blur(4px);
    z-index: 1000;
    padding: 20px;
    overflow-y: auto;
  }
  .modal-overlay.active { display: flex; justify-content: center; align-items: flex-start; padding-top: 40px; }
  .modal {
    background: #fff;
    border-radius: var(--radius-lg);
    max-width: 820px;
    width: 100%;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    margin-bottom: 40px;
    animation: modalIn 0.25s ease;
  }
  @keyframes modalIn {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .modal-head {
    background: linear-gradient(135deg, #0052D9 0%, #366EF4 100%);
    color: #fff;
    padding: 24px 28px;
    position: relative;
  }
  .modal-close {
    position: absolute;
    top: 16px; right: 18px;
    background: rgba(255,255,255,0.2);
    border: none;
    color: #fff;
    width: 32px; height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: background 0.18s;
  }
  .modal-close:hover { background: rgba(255,255,255,0.32); }
  .modal-id { font-size: 12px; opacity: 0.85; font-family: monospace; margin-bottom: 6px; }
  .modal-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .modal-tags { display: flex; gap: 8px; }
  .modal-body { padding: 24px 28px; }
  .modal-section { margin-bottom: 24px; }
  .modal-section:last-child { margin-bottom: 0; }
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
    margin-bottom: 12px;
    padding-left: 10px;
    border-left: 3px solid var(--primary);
  }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .info-item {
    background: var(--bg);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 13px;
  }
  .info-item .label { color: var(--text-3); font-size: 11.5px; margin-bottom: 3px; }
  .info-item .value { color: var(--text-1); font-weight: 500; line-height: 1.5; }
  .data-box {
    background: var(--danger-light);
    color: var(--danger);
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.6;
  }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: var(--bg); color: var(--text-2); font-weight: 600; font-size: 12px; border-bottom: 1px solid var(--border); }
  td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--text-1); vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #FAFBFC; }
  .role-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
  }
  .role-core { background: #FDECEB; color: #D54941; }
  .role-adjunct { background: #E8F3FF; color: #0052D9; }
  .role-supportive { background: #F0F1F5; color: #4B5260; }
  .hospital-card {
    background: var(--bg);
    border-radius: 8px;
    padding: 14px 16px;
    margin-bottom: 10px;
  }
  .hospital-card:last-child { margin-bottom: 0; }
  .hospital-name { font-weight: 600; color: var(--text-1); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  .premier-star { color: #F5A623; font-size: 14px; }
  .hospital-info { font-size: 12.5px; color: var(--text-2); line-height: 1.7; }
  .hospital-info a { color: var(--primary); text-decoration: none; }
  .hospital-info a:hover { text-decoration: underline; }
  .evidence {
    background: var(--primary-light);
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 12.5px;
    color: var(--primary-dark);
    word-break: break-all;
  }

  /* Footer */
  .footer {
    text-align: center;
    padding: 32px 20px;
    color: var(--text-3);
    font-size: 12.5px;
    line-height: 1.8;
  }
  .footer a { color: var(--primary); text-decoration: none; }

  /* Responsive */
  @media (max-width: 768px) {
    .hero { padding: 32px 0 36px; }
    .hero h1 { font-size: 24px; }
    .stats { grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: -20px; }
    .stat-card { padding: 14px; }
    .stat-value { font-size: 26px; }
    .regimen-grid { grid-template-columns: 1fr; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .tabs { overflow-x: auto; }
    .info-grid { grid-template-columns: 1fr; }
    .modal-body { padding: 18px; }
    .modal-head { padding: 20px; }
    .modal-title { font-size: 18px; }
    table { font-size: 12px; }
    th, td { padding: 8px; }
  }
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-3);
  }
  .empty-state .icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
</style>
</head>
<body>

<div class="hero">
  <div class="container hero-inner">
    <div class="hero-badge">📊 癌症治疗方案索引系统 · 周更 v__TODAY__</div>
    <h1>直肠癌晚期治疗方案索引</h1>
    <div class="subtitle">基于 SQLite 药物物料清单库构建 · 西医/中医双体系标签管理 · 方案-药物-医院三维关联 · 数据来自 drugs.db</div>
    <div class="meta">周更日期：__TODAY__ · 生成时间：<span id="gen-time">__GEN_TIME__</span> · 数据来源：drugs.db · 首份基线 2026-08-24</div>
  </div>
</div>

<div class="container">
  <div class="stats" id="stats"></div>

  <div class="toolbar">
    <div class="tabs" id="tabs">
      <button class="tab active" data-filter="all">全部</button>
      <button class="tab" data-filter="western">西医</button>
      <button class="tab" data-filter="tcm">中医</button>
    </div>
    <div class="search-box">
      <input type="text" id="search" placeholder="搜索方案名、医院、药物、主诊团队…">
    </div>
    <div class="result-count" id="result-count"></div>
  </div>

  <div class="regimen-grid" id="regimen-grid"></div>
</div>

<div class="modal-overlay" id="modal-overlay">
  <div class="modal" id="modal"></div>
</div>

<div class="footer">
  <div>本报告由 <strong>cancer-research skill</strong> 自动生成 · 数据全部来自 drugs.db (SQLite)</div>
  <div>⚠️ 仅供与主治医生讨论参考，不构成治疗建议 · 所有方案需在执业医师指导下进行</div>
</div>

<script>
const DATA = __DATA_PLACEHOLDER__;

const state = { filter: 'all', query: '' };

function tagLabel(t) { return { western: '西医', tcm: '中医', combined: '中西医' }[t] || t; }
function roleLabel(r) { return { core: '主药', adjunct: '辅药', supportive: '支持' }[r] || r; }
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderStats() {
  const s = DATA.stats;
  document.getElementById('gen-time').textContent = s.generated_at;
  document.getElementById('stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${s.regimens_total}</div>
      <div class="stat-label">方案总数</div>
      <div class="stat-sub">西医 ${s.regimens_western} · 中医 ${s.regimens_tcm}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${s.drugs_total}</div>
      <div class="stat-label">药物总数</div>
      <div class="stat-sub">西医 ${s.drugs_western} · 中医 ${s.drugs_tcm} · 共用 ${s.drugs_both}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${s.hospitals_total}</div>
      <div class="stat-label">医院</div>
      <div class="stat-sub">重点专科 ${s.premier_hospitals} 家</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${s.regimen_drug_links}</div>
      <div class="stat-label">方案-药物关联</div>
      <div class="stat-sub">平均每方案 ${(s.regimen_drug_links / s.regimens_total).toFixed(1)} 个药</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${s.regimen_hospital_links}</div>
      <div class="stat-label">方案-医院关联</div>
      <div class="stat-sub">平均每方案 ${(s.regimen_hospital_links / s.regimens_total).toFixed(1)} 家医院</div>
    </div>
  `;
}

function filteredRegimens() {
  const q = state.query.trim().toLowerCase();
  return DATA.regimens.filter(r => {
    if (state.filter !== 'all' && r.medicine_type !== state.filter) return false;
    if (!q) return true;
    const haystack = [
      r.regimen_id, r.name, r.summary, r.target_population, r.key_data,
      r.evidence_source, r.stage,
      ...(r.hospitals || []).flatMap(h => [h.hospital_name, h.lead_team, h.city, h.department, h.contact_phone, h.contact_website]),
      ...(r.drugs || []).map(d => d.name_cn + ' ' + (d.name_en || ''))
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function renderGrid() {
  const list = filteredRegimens();
  document.getElementById('result-count').textContent = `共 ${list.length} 个方案`;
  const grid = document.getElementById('regimen-grid');
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔍</div>没有找到匹配的方案</div>';
    return;
  }
  grid.innerHTML = list.map(r => `
    <div class="regimen-card" data-id="${esc(r.regimen_id)}">
      <div class="card-head">
        <span class="regimen-id">${esc(r.regimen_id)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${r.credibility_score && r.credibility_score !== 'N/A' ? `<span class="cred cred-${r.credibility_score}" title="${esc(r.credibility_notes || '')}">可信度 ${r.credibility_score}</span>` : ''}
          <span class="tag tag-${r.medicine_type}">${tagLabel(r.medicine_type)}</span>
        </div>
      </div>
      <div class="regimen-name">${esc(r.name)}</div>
      <div class="regimen-summary">${esc(r.summary)}</div>
      ${r.key_data ? `<div class="key-data">📊 ${esc(r.key_data)}</div>` : ''}
      <div class="regimen-meta">
        <span class="meta-chip"><strong>${r.drug_count}</strong> 个药</span>
        <span class="meta-chip"><strong>${r.hospital_count}</strong> 家医院</span>
        <span class="meta-chip">${esc(r.stage)}</span>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.regimen-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function openModal(rid) {
  const r = DATA.regimens.find(x => x.regimen_id === rid);
  if (!r) return;
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-head">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div class="modal-id">${esc(r.regimen_id)}</div>
      <div class="modal-title">${esc(r.name)}</div>
      <div class="modal-tags">
        <span class="tag tag-${r.medicine_type}" style="background:rgba(255,255,255,0.2);color:#fff;">${tagLabel(r.medicine_type)}</span>
        <span class="tag" style="background:rgba(255,255,255,0.2);color:#fff;">${esc(r.stage)}</span>
        ${r.credibility_score && r.credibility_score !== 'N/A' ? `<span class="tag" style="background:rgba(255,255,255,0.25);color:#fff;">可信度 ${r.credibility_score}</span>` : ''}
      </div>
    </div>
    <div class="modal-body">
      <div class="modal-section">
        <div class="section-title">方案概要</div>
        <div class="info-grid">
          <div class="info-item"><div class="label">适用人群</div><div class="value">${esc(r.target_population)}</div></div>
          <div class="info-item"><div class="label">分期</div><div class="value">${esc(r.stage)}</div></div>
          <div class="info-item" style="grid-column:1/-1"><div class="label">核心能力</div><div class="value">${esc(r.summary)}</div></div>
          <div class="info-item"><div class="label">首次入库</div><div class="value">${esc(r.first_seen_date)}</div></div>
          <div class="info-item"><div class="label">最后更新</div><div class="value">${esc(r.last_updated)}</div></div>
          ${r.credibility_notes ? `<div class="info-item" style="grid-column:1/-1"><div class="label">可信度评估（${r.credibility_score || 'N/A'}）</div><div class="value" style="color:var(--text-2);font-size:12.5px">${esc(r.credibility_notes)}</div></div>` : ''}
        </div>
      </div>
      ${r.key_data ? `
      <div class="modal-section">
        <div class="section-title">关键数据</div>
        <div class="data-box">📊 ${esc(r.key_data)}</div>
      </div>` : ''}
      ${r.evidence_source ? `
      <div class="modal-section">
        <div class="section-title">证据来源</div>
        <div class="evidence">${esc(r.evidence_source)}</div>
      </div>` : ''}
      ${r.drugs && r.drugs.length ? `
      <div class="modal-section">
        <div class="section-title">涉及药物（${r.drugs.length}）</div>
        <table>
          <thead><tr><th>药物</th><th>类别</th><th>体系</th><th>角色</th><th>默认剂量</th></tr></thead>
          <tbody>
            ${r.drugs.map(d => `
              <tr>
                <td><strong>${esc(d.name_cn)}</strong>${d.name_en ? `<div style="color:var(--text-3);font-size:11px;margin-top:2px">${esc(d.name_en)}</div>` : ''}</td>
                <td>${esc(d.category)}</td>
                <td><span class="tag tag-${d.medicine_type_tag === 'both' ? 'combined' : d.medicine_type_tag}" style="font-size:10px;padding:2px 6px">${{western:'西医',tcm:'中医',both:'共用'}[d.medicine_type_tag]}</span></td>
                <td><span class="role-badge role-${d.role}">${roleLabel(d.role)}</span></td>
                <td style="font-size:12px;color:var(--text-2)">${esc(d.dose_default || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : ''}
      ${r.hospitals && r.hospitals.length ? `
      <div class="modal-section">
        <div class="section-title">可开展医院 / 团队（${r.hospitals.length}）</div>
        ${r.hospitals.map(h => {
          let linkBadge = '';
          if (h.link_status === 'ok') linkBadge = '<span style="color:var(--success);font-size:11px;margin-left:4px">✅可访问</span>';
          else if (h.link_status === 'fail' && [403,521].includes(h.link_http_code)) linkBadge = '<span style="color:var(--warning);font-size:11px;margin-left:4px">🌐需浏览器</span>';
          else if (h.link_status === 'fail') linkBadge = '<span style="color:var(--danger);font-size:11px;margin-left:4px">❌待核实</span>';
          const credColor = h.credibility_score === 'A' ? 'var(--success)' : h.credibility_score === 'B' ? 'var(--warning)' : h.credibility_score === 'C' ? 'var(--text-3)' : 'var(--text-3)';
          const webLine = h.contact_website
            ? `<div>🌐 <a href="https://${esc(h.contact_website)}" target="_blank" rel="noopener">${esc(h.contact_website)}</a>${linkBadge}</div>`
            : '';
          return `
          <div class="hospital-card">
            <div class="hospital-name">
              ${h.is_premier ? '<span class="premier-star">⭐</span>' : ''}
              ${esc(h.hospital_name)}
              ${h.credibility_score && h.credibility_score !== 'N/A' ? `<span class="cred cred-${h.credibility_score}" style="margin-left:8px" title="${esc(h.credibility_notes||'')}">可信度 ${h.credibility_score}</span>` : ''}
            </div>
            <div class="hospital-info">
              <div>🏥 ${esc(h.department)} · <strong>${esc(h.lead_team)}</strong> · 📍 ${esc(h.city)}</div>
              ${h.contact_phone ? `<div>☎️ <a href="tel:${esc(h.contact_phone)}">${esc(h.contact_phone)}</a></div>` : ''}
              ${webLine}
              ${h.feature ? `<div style="margin-top:4px;color:var(--text-3)">${esc(h.feature)}</div>` : ''}
            </div>
          </div>
        `;}).join('')}
      </div>` : ''}
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

document.getElementById('tabs').addEventListener('click', e => {
  if (e.target.classList.contains('tab')) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    state.filter = e.target.dataset.filter;
    renderGrid();
  }
});

let searchTimer;
document.getElementById('search').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = e.target.value;
    renderGrid();
  }, 150);
});

renderStats();
renderGrid();
</script>
</body>
</html>
"""

OUT_HTML.write_text(
    html.replace("__DATA_PLACEHOLDER__", data_json_safe)
        .replace("__TODAY__", TODAY)
        .replace("__GEN_TIME__", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
    encoding="utf-8"
)
size = OUT_HTML.stat().st_size
print(f"✅ HTML 已生成：{OUT_HTML}")
print(f"   大小：{size:,} 字节 ({size/1024:.1f} KB)")
