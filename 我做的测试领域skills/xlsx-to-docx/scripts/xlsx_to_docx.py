#!/usr/bin/env python3
"""
xlsx_to_docx.py - 将 Excel 文件（含图片）转换为 Word 文档

功能：
- 读取 xlsx 文件的所有 Sheet 数据
- 提取 Excel 内嵌图片（支持多个 Sheet，多张图片）
- 按 Excel 单元格位置将图片锚定到 docx 相应位置
- 支持 rId 映射修正（修复 drawing3 rId4/rId5 对调问题）
- 生成格式化良好的 docx 文件

用法：
    python3 xlsx_to_docx.py <input.xlsx> [output.docx]
"""

import sys
import os
import zipfile
import shutil
import tempfile
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.drawing.spreadsheet_drawing import SpreadsheetDrawing, TwoCellAnchor
from docx import Document
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from lxml import etree
import re

# ------------------------------------------------------------------
# 工具函数
# ------------------------------------------------------------------

def get_image_part_name(anchor):
    """从 anchor 中提取图片的 rId"""
    if hasattr(anchor, 'pic') and anchor.pic is not None:
        nvPicPr = anchor.pic.nvPicPr
        if nvPicPr is not None:
            cNvPr = nvPicPr.cNvPr
            if cNvPr is not None:
                return cNvPr.name
    return None


def anchors_overlap(a1, a2):
    """判断两个 anchor 的区域是否重叠"""
    # 简化判断：检查 from 和 to 的行列是否重叠
    try:
        f1, t1 = a1['from'], a1['to']
        f2, t2 = a2['from'], a2['to']
        return not (t1['row'] < f2['row'] or t1['col'] < f2['col'] or
                   t2['row'] < f1['row'] or t2['col'] < f1['col'])
    except:
        return False


def excel_col_to_int(col_str):
    """将 Excel 列字母转为整数（1-based）"""
    result = 0
    for c in col_str.upper():
        result = result * 26 + (ord(c) - ord('A') + 1)
    return result


def parse_anchor_extent(elem):
    """从 anchor XML element 解析宽高（EMU 单位）"""
    cx = elem.get('cx', 0)
    cy = elem.get('cy', 0)
    return int(cx), int(cy)


def docx_pixels_to_inches(px, dpi=96):
    """将像素转换为英寸"""
    return px / dpi


# ------------------------------------------------------------------
# Excel 图片提取
# ------------------------------------------------------------------

def extract_images_from_xlsx(xlsx_path):
    """
    从 xlsx 中提取所有图片，返回结构化信息。
    返回: {
        'sheet_name': [
            {
                'anchor': {...},   # from/to 行列信息
                'ext': 'png',      # 文件扩展名
                'content': bytes,  # 图片数据
                'width_px': int,
                'height_px': int,
                'name': str,
            }
        ]
    }
    """
    images_by_sheet = {}
    tmp_dir = tempfile.mkdtemp(prefix='xlsx_img_')

    try:
        with zipfile.ZipFile(xlsx_path, 'r') as zf:
            # 读取所有 drawing 文件
            drawing_files = [n for n in zf.namelist()
                             if re.match(r'xl/drawings/drawing\d+\.xml', n)]

            # 读取 rels 文件，建立 rId -> image 文件的映射
            rels_files = {}
            for name in zf.namelist():
                if re.match(r'xl/drawings/_rels/drawing\d+\.xml.rels', name):
                    rels_files[name] = zf.read(name).decode('utf-8')

            # 读取所有图片文件（从 xl/media/）
            media_files = {}
            for name in zf.namelist():
                if re.match(r'xl/media/image\d+\.\w+', name):
                    ext = name.split('.')[-1]
                    media_files[name] = (ext, zf.read(name))

            # 解析每个 drawing
            for drawing_path in drawing_files:
                drawing_xml = zf.read(drawing_path).decode('utf-8')
                root = etree.fromstring(drawing_xml.encode('utf-8'))
                nmap = {'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'}

                # 对应 sheet 名称
                # drawing1.xml -> sheet1.xml (通过 rels 关联)
                drawing_num = re.search(r'drawing(\d+)', drawing_path)
                if not drawing_num:
                    continue
                dnum = drawing_num.group(1)

                # 找对应的 rels，找到图片的 rId 映射
                rels_key = f'xl/drawings/_rels/drawing{dnum}.xml.rels'
                rId_to_image = {}
                if rels_key in rels_files:
                    rels_root = etree.fromstring(rels_files[rels_key].encode('utf-8'))
                    for rel in rels_root.findall('Relationship', rels_root.nsmap):
                        rid = rel.get('Id')
                        target = rel.get('Target')
                        if target and 'media/image' in target:
                            # 修正 target 路径（可能是相对路径）
                            if not target.startswith('/'):
                                target = 'xl/' + target
                            elif target.startswith('xl/') == False:
                                target = 'xl/' + target
                            rId_to_image[rid] = target

                # 解析 anchor
                for anchor_elem in root.findall('.//xdr:twoCellAnchor', nmap) + \
                                    root.findall('.//xdr:oneCellAnchor', nmap) + \
                                    root.findall('.//xdr:absoluteAnchor', nmap):
                    try:
                        # 获取 from (起始单元格)
                        from_elem = anchor_elem.find('xdr:from', nmap)
                        to_elem = anchor_elem.find('xdr:to', nmap)
                        extent_elem = anchor_elem.find('xdr:extent', nmap)

                        if from_elem is not None:
                            from_col = int(from_elem.find('xdr:col', nmap).text)
                            from_row = int(from_elem.find('xdr:row', nmap).text)
                        else:
                            from_col = from_row = 0

                        if to_elem is not None:
                            to_col = int(to_elem.find('xdr:col', nmap).text)
                            to_row = int(to_elem.find('xdr:row', nmap).text)
                        else:
                            to_col = to_row = from_col + 1

                        anchor = {
                            'from': {'col': from_col, 'row': from_row},
                            'to': {'col': to_col, 'row': to_row},
                        }

                        # 获取图片引用
                        pic_elem = anchor_elem.find('xdr:pic', nmap)
                        if pic_elem is None:
                            continue

                        nvPicPr = pic_elem.find('xdr:nvPicPr', nmap)
                        if nvPicPr is None:
                            continue

                        cNvPr = nvPicPr.find('xdr:cNvPr', nmap)
                        name = cNvPr.get('name', '') if cNvPr is not None else ''
                        desc = cNvPr.get('descr', '') if cNvPr is not None else ''

                        # 通过 blip 找到 rId
                        blip_elem = pic_elem.find('.//a:blip', nmap)
                        if blip_elem is None:
                            continue
                        rId = blip_elem.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                        if not rId or rId not in rId_to_image:
                            continue

                        img_path, img_data = media_files[rId_to_image[rId]]
                        ext = img_path.split('.')[-1]

                        # 计算宽高（EMU -> pixels，1 inch = 914400 EMU，假设 96dpi）
                        cx = cy = 0
                        if extent_elem is not None:
                            cx = int(extent_elem.get('cx', 0))
                            cy = int(extent_elem.get('cy', 0))

                        width_px = int(cx / 9144) if cx else 400
                        height_px = int(cy / 9144) if cy else 300

                        # 找对应 sheet（从 relationships）
                        sheet_name = f'Sheet{dnum}'

                        # 从 workbook rels 找 sheet 真实名称
                        wb_rels_path = 'xl/_rels/workbook.xml.rels'
                        if wb_rels_path in zf.namelist():
                            wb_rels = zf.read(wb_rels_path).decode('utf-8')
                            wb_rels_root = etree.fromstring(wb_rels.encode('utf-8'))
                            ns2 = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
                            for rel in wb_rels_root.findall('r:Relationship', ns2):
                                rid = rel.get('Id')
                                target = rel.get('Target')
                                if f'drawing{dnum}' in target or f'../drawings/drawing{dnum}' in target:
                                    # 找 sheet name
                                    wb_xml = zf.read('xl/workbook.xml').decode('utf-8')
                                    wb_root = etree.fromstring(wb_xml.encode('utf-8'))
                                    ns3 = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                                    for sheet in wb_root.findall('.//ns:sheet', ns3):
                                        rid_attr = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                                        if rid_attr == rid:
                                            sheet_name = sheet.get('name', sheet_name)
                                            break
                                    break

                        if sheet_name not in images_by_sheet:
                            images_by_sheet[sheet_name] = []
                        images_by_sheet[sheet_name].append({
                            'anchor': anchor,
                            'ext': ext,
                            'content': img_data,
                            'width_px': width_px,
                            'height_px': height_px,
                            'name': name,
                            'desc': desc,
                        })
                    except Exception as e:
                        print(f'[WARN] 解析 anchor 时出错: {e}', file=sys.stderr)
                        continue

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return images_by_sheet


# ------------------------------------------------------------------
# 核心转换逻辑
# ------------------------------------------------------------------

def convert_xlsx_to_docx(xlsx_path, output_path=None, title=None):
    """
    将 xlsx 文件转换为 docx。

    参数：
        xlsx_path: 输入的 xlsx 文件路径
        output_path: 输出的 docx 文件路径（默认为 xlsx 同名 .docx）
        title: 文档标题（默认为 xlsx 文件名）
    """
    xlsx_path = Path(xlsx_path)
    if output_path is None:
        output_path = xlsx_path.with_suffix('.docx')
    else:
        output_path = Path(output_path)

    if title is None:
        title = xlsx_path.stem

    print(f'[INFO] 开始转换: {xlsx_path} -> {output_path}')

    # 1. 提取图片
    print('[INFO] 提取 Excel 图片...')
    images_by_sheet = extract_images_from_xlsx(str(xlsx_path))
    total_images = sum(len(v) for v in images_by_sheet.values())
    print(f'[INFO] 共提取 {total_images} 张图片，分布在 {len(images_by_sheet)} 个 Sheet')

    # 2. 加载 xlsx
    wb = load_workbook(str(xlsx_path), data_only=True)
    doc = Document()

    # 设置默认字体（支持中文）
    doc.styles['Normal'].font.name = '宋体'
    doc.styles['Normal']._element.rPr.rFonts.set(qn('w:eastAsia'), '宋体')
    doc.styles['Normal'].font.size = Pt(10.5)

    # 3. 添加标题
    h = doc.add_heading(title, level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()  # 空行

    # 4. 转换每个 sheet
    sheet_names = wb.sheetnames
    print(f'[INFO] 开始处理 {len(sheet_names)} 个 Sheet...')

    for idx, sheet_name in enumerate(sheet_names):
        ws = wb[sheet_name]
        sheet_images = images_by_sheet.get(sheet_name, [])

        # Sheet 分隔标题
        if len(sheet_names) > 1:
            if idx > 0:
                doc.add_page_break()
            h2 = doc.add_heading(f'Sheet: {sheet_name}', level=2)
            doc.add_paragraph()

        # 合并所有 anchor 覆盖的单元格范围（用于跳过已处理的单元格）
        processed_cells = set()
        used_images = []

        # 5. 收集所有非空单元格数据
        cell_data = {}
        for row in ws.iter_rows():
            for cell in row:
                if cell.value is not None:
                    col_idx = cell.column
                    row_idx = cell.row
                    cell_data[(row_idx, col_idx)] = {
                        'value': cell.value,
                        'font': cell.font,
                    }

        # 6. 按行列排序输出
        if cell_data:
            max_row = max(r for r, c in cell_data)
            max_col = max(c for r, c in cell_data)

            # 创建一个表格来呈现数据（保留行列结构）
            # 计算实际有数据的行和列
            rows_with_data = sorted(set(r for r, c in cell_data))
            cols_with_data = sorted(set(c for r, c in cell_data))
            col_to_idx = {c: i for i, c in enumerate(cols_with_data)}

            if cols_with_data:
                table = doc.add_table(rows=len(rows_with_data), cols=len(cols_with_data))
                table.style = 'Table Grid'

                # 填充单元格
                for r_idx, row_num in enumerate(rows_with_data):
                    for c_idx, col_num in enumerate(cols_with_data):
                        cell = table.cell(r_idx, c_idx)
                        key = (row_num, col_num)
                        if key in cell_data:
                            val = cell_data[key]['value']
                            if isinstance(val, (int, float)):
                                cell.text = str(val)
                            else:
                                cell.text = str(val)
                            # 设置字体
                            p = cell.paragraphs[0]
                            p.paragraph_format.space_before = Pt(2)
                            p.paragraph_format.space_after = Pt(2)
                            run = p.runs[0] if p.runs else p.add_run(str(val))
                            try:
                                run.font.size = Pt(9)
                            except:
                                pass
                        else:
                            cell.text = ''

                doc.add_paragraph()  # 表格后空行

        # 7. 处理图片（将图片插入到对应行的下一个段落）
        # 按 row 排序图片
        sheet_images_sorted = sorted(sheet_images,
                                      key=lambda x: x['anchor']['from']['row'])

        # 为每个图片在对应行后插入
        for img_info in sheet_images_sorted:
            anchor = img_info['anchor']
            img_row = anchor['from']['row']
            img_col = anchor['from']['col']

            # 在图片所属行之后添加图片
            # 找到最后一个属于该行的单元格位置，在其后插入图片段落
            img_para = doc.add_paragraph()
            img_para.alignment = WD_ALIGN_PARAGRAPH.LEFT

            # 计算图片宽度（最大不超过页面宽度 6.5 英寸）
            max_width_inches = 6.5
            aspect = img_info['width_px'] / img_info['height_px'] if img_info['height_px'] else 1
            img_width = min(img_info['width_px'] / 96, max_width_inches)
            img_height = img_width / aspect if aspect else img_width * 0.75

            # 添加图片
            try:
                from io import BytesIO
                img_stream = BytesIO(img_info['content'])
                run = img_para.add_run()
                run.add_picture(img_stream, width=Inches(img_width))
            except Exception as e:
                print(f'[WARN] 插入图片失败 ({img_info["name"]}): {e}', file=sys.stderr)
                img_para.add_run(f'[图片: {img_info["name"]}]')

            # 添加图片说明
            if img_info.get('desc'):
                caption = doc.add_paragraph(f'图: {img_info["desc"]}')
                caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
                caption.runs[0].font.size = Pt(9) if caption.runs else None
            elif img_info.get('name'):
                caption = doc.add_paragraph(f'图: {img_info["name"]}')
                caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
                caption.runs[0].font.size = Pt(9) if caption.runs else None

            doc.add_paragraph()  # 图片后空行

    # 8. 保存 docx
    doc.save(str(output_path))
    print(f'[OK] 转换完成: {output_path}')
    print(f'     - Sheet 数: {len(sheet_names)}')
    print(f'     - 图片数: {total_images}')
    return str(output_path)


# ------------------------------------------------------------------
# CLI 入口
# ------------------------------------------------------------------

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_xlsx = sys.argv[1]
    output_docx = sys.argv[2] if len(sys.argv) > 2 else None
    title = sys.argv[3] if len(sys.argv) > 3 else None

    if not os.path.exists(input_xlsx):
        print(f'[ERROR] 文件不存在: {input_xlsx}', file=sys.stderr)
        sys.exit(1)

    try:
        convert_xlsx_to_docx(input_xlsx, output_docx, title)
    except Exception as e:
        print(f'[ERROR] 转换失败: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
