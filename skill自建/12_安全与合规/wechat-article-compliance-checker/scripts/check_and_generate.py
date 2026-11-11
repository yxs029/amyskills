"""
微信公众号文章违禁词检查与文档生成脚本模板

此脚本提供了一个基础框架，用于：
1. 读取 Word 文档内容
2. 匹配违禁词（此处仅为示例，实际使用时建议结合大模型进行语义分析）
3. 生成违禁词标红版 Word 文档
4. 生成替换违禁词后的合规版 Word 文档

依赖库：
pip install python-docx
"""
import os
from docx import Document
from docx.shared import RGBColor, Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def add_text_with_highlights(para, text, violations_in_para):
    """在段落中添加文字，对违禁词部分标红"""
    if not violations_in_para:
        para.add_run(text)
        return

    # 收集所有需要标红的词及其位置
    highlights = []
    for v in violations_in_para:
        word = v["original"]
        start = 0
        while True:
            pos = text.find(word, start)
            if pos == -1:
                break
            highlights.append((pos, pos + len(word), word))
            start = pos + 1

    if not highlights:
        para.add_run(text)
        return

    # 按位置排序并合并重叠区间
    highlights.sort(key=lambda x: x[0])
    merged = []
    for h in highlights:
        if merged and h[0] < merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], h[1]), merged[-1][2])
        else:
            merged.append(list(h))

    # 生成runs
    cursor = 0
    for start, end, word in merged:
        if cursor < start:
            para.add_run(text[cursor:start])
        # 标红run
        red_run = para.add_run(text[start:end])
        red_run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
        red_run.font.bold = True
        cursor = end
    if cursor < len(text):
        para.add_run(text[cursor:])

def generate_marked_doc(paragraphs, violations, output_path):
    """生成标红版文档"""
    doc = Document()
    
    # 建立段落索引到违规词的映射
    violations_map = {}
    for v in violations:
        idx = v["para_idx"]
        if idx not in violations_map:
            violations_map[idx] = []
        violations_map[idx].append(v)

    # 封面标题
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_para.add_run("【违禁词检查版】文章")
    title_run.font.size = Pt(18)
    title_run.font.bold = True

    subtitle_para = doc.add_paragraph()
    subtitle_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle_run = subtitle_para.add_run("⚠️ 红色标注部分为检测到的违禁词/违规表达，请参考文末报告修改后再发布")
    subtitle_run.font.size = Pt(11)
    subtitle_run.font.color.rgb = RGBColor(0xFF, 0x66, 0x00)
    doc.add_paragraph()

    # 正文
    for idx, text in enumerate(paragraphs):
        violations_in_para = violations_map.get(idx, [])
        p = doc.add_paragraph()
        add_text_with_highlights(p, text, violations_in_para)

    # 分页与报告
    doc.add_page_break()
    report_title = doc.add_paragraph()
    report_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rt_run = report_title.add_run("📋 违禁词检查报告")
    rt_run.font.size = Pt(16)
    rt_run.font.bold = True
    rt_run.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)

    doc.add_paragraph(f"共检测到违规表达 {len(violations)} 处，详情如下：")

    table = doc.add_table(rows=1, cols=5)
    table.style = 'Table Grid'
    headers = ["序号", "违规词", "违规类别", "违规原因", "修改建议"]
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        hdr_cells[i].paragraphs[0].runs[0].font.bold = True

    for i, v in enumerate(violations, 1):
        row_cells = table.add_row().cells
        row_cells[0].text = str(i)
        row_cells[1].text = v["original"]
        row_cells[1].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
        row_cells[2].text = v["category"]
        row_cells[3].text = v["reason"]
        row_cells[4].text = v["suggestion"]

    doc.save(output_path)
    print(f"✅ 标红版文档已生成：{output_path}")

def generate_clean_doc(paragraphs, violations, output_path):
    """生成合规版文档"""
    doc = Document()
    
    # 替换违禁词
    clean_paragraphs = []
    replacements_made = []
    
    for idx, text in enumerate(paragraphs):
        clean_text = text
        para_violations = [v for v in violations if v["para_idx"] == idx]
        for v in para_violations:
            if v["original"] in clean_text:
                clean_text = clean_text.replace(v["original"], v["suggestion"])
                replacements_made.append((v["original"], v["suggestion"], v["category"]))
        clean_paragraphs.append(clean_text)

    # 封面标题
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_para.add_run("【合规版】文章")
    title_run.font.size = Pt(18)
    title_run.font.bold = True

    subtitle_para = doc.add_paragraph()
    subtitle_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle_run = subtitle_para.add_run("✅ 已替换全部违禁词，可安全发布至微信公众号")
    subtitle_run.font.size = Pt(11)
    subtitle_run.font.color.rgb = RGBColor(0x00, 0x80, 0x00)
    doc.add_paragraph()

    # 正文
    for text in clean_paragraphs:
        doc.add_paragraph(text)

    # 分页与对照表
    doc.add_page_break()
    appendix_title = doc.add_paragraph()
    appendix_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    at_run = appendix_title.add_run("📝 违禁词替换对照表")
    at_run.font.size = Pt(14)
    at_run.font.bold = True
    at_run.font.color.rgb = RGBColor(0x00, 0x70, 0xC0)

    doc.add_paragraph(f"本次共替换违禁词/违规表达 {len(replacements_made)} 处：")

    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    headers = ["原文（违禁词）", "替换后（合规表达）", "违规类别"]
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = h
        hdr_cells[i].paragraphs[0].runs[0].font.bold = True

    for orig, repl, cat in replacements_made:
        row_cells = table.add_row().cells
        row_cells[0].text = orig
        row_cells[0].paragraphs[0].runs[0].font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
        row_cells[1].text = repl
        row_cells[1].paragraphs[0].runs[0].font.color.rgb = RGBColor(0x00, 0x70, 0x00)
        row_cells[2].text = cat

    doc.save(output_path)
    print(f"✅ 合规版文档已生成：{output_path}")

if __name__ == "__main__":
    # 示例数据
    sample_paragraphs = [
        "这是一款全网第一的产品，拥有最先进的技术。",
        "使用后包治百病，绝对让你满意。"
    ]
    
    sample_violations = [
        {"para_idx": 0, "original": "全网第一", "category": "极限词", "reason": "违反广告法", "suggestion": "行业领先"},
        {"para_idx": 0, "original": "最先进", "category": "极限词", "reason": "违反广告法", "suggestion": "先进"},
        {"para_idx": 1, "original": "包治百病", "category": "医疗违规", "reason": "夸大疗效", "suggestion": "有助于改善"},
        {"para_idx": 1, "original": "绝对", "category": "极限词", "reason": "绝对化用语", "suggestion": "一定程度上"}
    ]
    
    generate_marked_doc(sample_paragraphs, sample_violations, "marked_example.docx")
    generate_clean_doc(sample_paragraphs, sample_violations, "clean_example.docx")
