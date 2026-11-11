-- ============================================================
-- Cancer Research 药物物料清单库 Schema
-- 路径：drugs.db（默认在 output_dir）
-- 设计：报告（含方案 ID）↔ 药物（含中西医 tag）↔ 医院/团队
-- ============================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------
-- 1. drugs：药物主数据
-- ----------------------------------------------------------
-- 同一药物在中药/西药双体系下都可能存在，medicine_type_tag = 'both'
-- 用 name_pinyin 作为业务主键去重
CREATE TABLE IF NOT EXISTS drugs (
  drug_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name_cn            TEXT NOT NULL,                       -- 中文名
  name_en            TEXT,                                -- 英文名/INN
  name_pinyin        TEXT NOT NULL UNIQUE,                -- 拼音主键
  category           TEXT NOT NULL,                       -- 类别（化疗药/靶向药/PD-1/中成药/中药材/方剂...）
  medicine_type_tag  TEXT NOT NULL                        -- western / tcm / both
                      CHECK (medicine_type_tag IN ('western','tcm','both')),
  mechanism          TEXT,                                -- 作用机制（1-2 句）
  indications        TEXT,                                -- 适应症（自由文本）
  evidence_level     TEXT,                                -- A/B/C/.../case
  source_doi         TEXT,                                -- 关键证据 DOI
  source_url         TEXT,                                -- 证据/官网链接
  notes              TEXT,                                -- 备注
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_updated       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_drugs_tag ON drugs(medicine_type_tag);
CREATE INDEX IF NOT EXISTS idx_drugs_category ON drugs(category);
CREATE INDEX IF NOT EXISTS idx_drugs_pinyin ON drugs(name_pinyin);

-- ----------------------------------------------------------
-- 2. regimens：方案（核心实体，跨周保持稳定）
-- ----------------------------------------------------------
-- 方案 ID 由业务生成（如 CRC-W-2026-001），regimen_id 用字符串
CREATE TABLE IF NOT EXISTS regimens (
  regimen_id         TEXT PRIMARY KEY,                    -- 业务方案 ID
  name               TEXT NOT NULL,                       -- 方案名
  cancer_type        TEXT NOT NULL,                       -- 癌种（中文）
  stage              TEXT NOT NULL,                       -- 分期
  medicine_type      TEXT NOT NULL                        -- western / tcm / combined
                      CHECK (medicine_type IN ('western','tcm','combined')),
  target_population  TEXT,                                -- 适用人群（分期/分子分型）
  summary            TEXT,                                -- 1-2 句话核心能力
  key_data           TEXT,                                -- 关键数据（mPFS/mOS/ORR/HR）
  evidence_source    TEXT,                                -- 期刊/DOI
  first_seen_date    TEXT NOT NULL,                       -- 首次出现在索引报告的日期
  last_updated       TEXT NOT NULL,                       -- 最后更新日期
  status             TEXT NOT NULL DEFAULT 'active'       -- active / archived
                      CHECK (status IN ('active','archived')),
  -- 可信度评估
  credibility_score      TEXT DEFAULT 'N/A'               -- A(高)/B(中)/C(低)/N/A
                          CHECK (credibility_score IN ('A','B','C','N/A')),
  credibility_notes      TEXT,                            -- 验证过程：来源数/交叉验证/备注
  credibility_checked_at TEXT                             -- 评估时间
);

CREATE INDEX IF NOT EXISTS idx_regimens_cancer ON regimens(cancer_type, stage, medicine_type);

-- ----------------------------------------------------------
-- 3. regimen_drugs：方案-药物关联
-- ----------------------------------------------------------
-- 多对多：一种药可被多个方案引用，一个方案可包含多个药
-- role 区分主药/辅药/对症药
CREATE TABLE IF NOT EXISTS regimen_drugs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  regimen_id         TEXT NOT NULL,
  drug_id            INTEGER NOT NULL,
  role               TEXT NOT NULL DEFAULT 'core'         -- core/adjunct/supportive
                      CHECK (role IN ('core','adjunct','supportive')),
  dose_default       TEXT,                                -- 默认剂量（如 "85 mg/m² d1" 或 "10g bid"）
  notes              TEXT,
  FOREIGN KEY (regimen_id) REFERENCES regimens(regimen_id) ON DELETE CASCADE,
  FOREIGN KEY (drug_id) REFERENCES drugs(drug_id) ON DELETE CASCADE,
  UNIQUE (regimen_id, drug_id, role)
);

CREATE INDEX IF NOT EXISTS idx_rd_regimen ON regimen_drugs(regimen_id);
CREATE INDEX IF NOT EXISTS idx_rd_drug ON regimen_drugs(drug_id);

-- ----------------------------------------------------------
-- 4. regimen_hospitals：方案-医院关联
-- ----------------------------------------------------------
-- 多对多：同方案可多家医院做；同医院可做多方案
CREATE TABLE IF NOT EXISTS regimen_hospitals (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  regimen_id         TEXT NOT NULL,
  hospital_name      TEXT NOT NULL,
  department         TEXT,                                -- 科室
  lead_team          TEXT,                                -- 主诊/团队
  contact_phone      TEXT,
  contact_website    TEXT,
  contact_wechat     TEXT,                                -- 公众号/小程序
  city               TEXT,
  address            TEXT,
  feature            TEXT,                                -- 特色（重点学科/国家中医旗舰/民营旗舰）
  is_premier         INTEGER NOT NULL DEFAULT 0,         -- 1=重点专科/国家旗舰
  notes              TEXT,
  -- 可信度评估
  credibility_score      TEXT DEFAULT 'N/A'               -- A(高)/B(中)/C(低)/N/A
                          CHECK (credibility_score IN ('A','B','C','N/A')),
  credibility_notes      TEXT,                            -- 验证过程：官网/交叉源/患者评价
  credibility_checked_at TEXT,                            -- 评估时间
  -- 链接验证
  link_status        TEXT,                                -- ok/fail/empty/unknown
  link_http_code     INTEGER,
  link_content_len   INTEGER,
  link_final_url     TEXT,
  link_title         TEXT,
  link_checked_at    TEXT,
  FOREIGN KEY (regimen_id) REFERENCES regimens(regimen_id) ON DELETE CASCADE,
  UNIQUE (regimen_id, hospital_name, lead_team)
);

CREATE INDEX IF NOT EXISTS idx_rh_regimen ON regimen_hospitals(regimen_id);
CREATE INDEX IF NOT EXISTS idx_rh_hospital ON regimen_hospitals(hospital_name);
CREATE INDEX IF NOT EXISTS idx_rh_premier ON regimen_hospitals(is_premier);

-- ----------------------------------------------------------
-- 5. reports：每周方案索引报告元信息（轻量表，不存全文）
-- ----------------------------------------------------------
-- 报告全文在 markdown 文件里，这里只存元信息用于追溯
CREATE TABLE IF NOT EXISTS reports (
  report_id          INTEGER PRIMARY KEY AUTOINCREMENT,
  report_path        TEXT NOT NULL UNIQUE,                -- 报告文件路径
  cancer_type        TEXT NOT NULL,
  stage              TEXT NOT NULL,
  medicine_type      TEXT NOT NULL,
  report_date        TEXT NOT NULL,                       -- YYYY-MM-DD
  period_start       TEXT,                                -- 本期起
  period_end         TEXT,                                -- 本期止
  new_regimens_count INTEGER NOT NULL DEFAULT 0,          -- 本期新增方案数
  updated_regimens_count INTEGER NOT NULL DEFAULT 0,      -- 本期更新方案数
  kept_regimens_count    INTEGER NOT NULL DEFAULT 0,      -- 本期保留方案数
  new_drugs_count    INTEGER NOT NULL DEFAULT 0,          -- 本期新增药物数
  biji_note_id       TEXT,                                -- 同步的 Get笔记 ID
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_reports_cancer ON reports(cancer_type, medicine_type);

-- ----------------------------------------------------------
-- 6. regimen_report_refs：方案-报告引用关系
-- ----------------------------------------------------------
-- 一个方案可在多周报告中出现；一篇报告可引用多方案
CREATE TABLE IF NOT EXISTS regimen_report_refs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  regimen_id         TEXT NOT NULL,
  report_id          INTEGER NOT NULL,
  status_in_report   TEXT NOT NULL                        -- new / updated / kept
                      CHECK (status_in_report IN ('new','updated','kept')),
  FOREIGN KEY (regimen_id) REFERENCES regimens(regimen_id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
  UNIQUE (regimen_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_rrr_regimen ON regimen_report_refs(regimen_id);
CREATE INDEX IF NOT EXISTS idx_rrr_report ON regimen_report_refs(report_id);

-- ============================================================
-- 常用查询示例（供 Python 脚本调用参考）
-- ============================================================
--
-- Q1: 查某方案的所有药物
-- SELECT d.*, rd.role, rd.dose_default
--   FROM regimens r
--   JOIN regimen_drugs rd ON r.regimen_id = rd.regimen_id
--   JOIN drugs d ON rd.drug_id = d.drug_id
--  WHERE r.regimen_id = 'CRC-W-2026-001';
--
-- Q2: 查所有中医方案涉及的医院
-- SELECT DISTINCT rh.hospital_name, rh.lead_team, rh.contact_phone
--   FROM regimens r
--   JOIN regimen_hospitals rh ON r.regimen_id = rh.regimen_id
--  WHERE r.medicine_type IN ('tcm','combined') AND r.cancer_type = '直肠癌';
--
-- Q3: 查"中西医共用"药物（如黄芪）
-- SELECT * FROM drugs WHERE medicine_type_tag = 'both' ORDER BY name_pinyin;
--
-- Q4: 查最近一期方案索引报告
-- SELECT * FROM reports ORDER BY report_date DESC LIMIT 1;
--
-- Q5: 查某医院能做的所有方案
-- SELECT r.* FROM regimens r
--   JOIN regimen_hospitals rh ON r.regimen_id = rh.regimen_id
--  WHERE rh.hospital_name LIKE '%西苑%'
--  ORDER BY r.cancer_type, r.stage;
