#!/usr/bin/env python3
"""Gộp toàn bộ docs/erd-defense thành một tài liệu Word để học/bảo vệ."""
from pathlib import Path
import re
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor

BASE = Path(__file__).resolve().parents[1]
OUT = BASE.parent.parent / "ERD_DEFENSE_JAPANO_TRON_BO.docx"
DIAGRAMS = BASE / "diagrams"

DOCS = [
    ("00_SOURCE_INVENTORY.md", "Nguồn và quy tắc kiểm chứng"),
    ("01_SYSTEM_CONTEXT.md", "Ngữ cảnh hệ thống"),
    ("02_DATABASE_INVENTORY.md", "Inventory database"),
    ("03_ERD_AUDIT.md", "Audit ERD và trung tâm trọng lực"),
    ("04_ERD_MODULES.md", "Phân cụm ERD theo nghiệp vụ"),
    ("05_PRESENTATION_MAP.md", "Bản đồ thuyết trình ERD"),
    ("06_DATA_FLOWS.md", "Đường dữ liệu end-to-end"),
    ("07_SCRIPT_OVERVIEW.md", "Bài nói ERD tổng"),
    ("08_SCRIPT_MODULES.md", "Bài nói từng ERD con"),
    ("09_FULL_PRESENTATION.md", "Bài thuyết trình 5 phút và 8 phút"),
    ("10_DEFENSE_QA.md", "48 câu hỏi phản biện"),
    ("11_DATABASE_REVIEW.md", "Review normalization và database design"),
    ("12_CHEATSHEET.md", "Cheat sheet học nhanh"),
    ("13_ERD_DEFENSE_MAP.md", "ERD Defense Map"),
]

NAVY = "17365D"
BLUE = "1F4E79"
LIGHT = "EAF3F8"
YELLOW = "FFF2CC"
GRAY = "666666"


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def margins(cell, top=80, start=100, bottom=80, end=100):
    tc_pr = cell._tc.get_or_add_tcPr()
    mar = OxmlElement("w:tcMar")
    for side, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = OxmlElement("w:" + side)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        mar.append(node)
    tc_pr.append(mar)


def border(cell, color="D9E2F3"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        node = OxmlElement("w:" + side)
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "3")
        node.set(qn("w:color"), color)
        borders.append(node)
    tc_pr.append(borders)


def page_number(p):
    run = p.add_run()
    begin = OxmlElement("w:fldChar"); begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText"); instr.set(qn("xml:space"), "preserve"); instr.text = " PAGE "
    end = OxmlElement("w:fldChar"); end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, end])


def inline(text):
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[([^]]+)\]\(([^)]+)\)", r"\1", text)
    text = text.replace("**", "").replace("__", "")
    return text


def add_table(doc, rows):
    if not rows:
        return
    table = doc.add_table(rows=1, cols=len(rows[0]))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    for i, value in enumerate(rows[0]):
        cell = table.rows[0].cells[i]
        shade(cell, NAVY); margins(cell); border(cell, NAVY)
        p = cell.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(inline(value)); r.bold = True; r.font.color.rgb = RGBColor(255, 255, 255); r.font.size = Pt(9)
    for raw in rows[1:]:
        cells = table.add_row().cells
        for i, value in enumerate(raw):
            cell = cells[i]; margins(cell); border(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            r = p.add_run(inline(value)); r.font.size = Pt(8.5)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def add_markdown(doc, path):
    lines = path.read_text(encoding="utf-8").splitlines()
    i = 0
    in_code = False
    code_lines = []
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            if in_code:
                p = doc.add_paragraph(style="No Spacing")
                p.paragraph_format.left_indent = Cm(0.6)
                r = p.add_run("\n".join(code_lines)); r.font.name = "Consolas"; r.font.size = Pt(8); r.font.color.rgb = RGBColor.from_string(GRAY)
                code_lines = []; in_code = False
            else:
                in_code = True
            i += 1; continue
        if in_code:
            code_lines.append(line); i += 1; continue
        if not line.strip():
            i += 1; continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|?\s*:?-+:?\s*\|", lines[i + 1]):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                parts = [x.strip() for x in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", x.replace("\\", "")) for x in parts):
                    rows.append(parts)
                i += 1
            add_table(doc, rows); continue
        heading = re.match(r"^(#{1,4})\s+(.*)$", line)
        if heading:
            level = min(len(heading.group(1)), 3)
            p = doc.add_heading(inline(heading.group(2)), level=level)
            i += 1; continue
        if line.startswith(">"):
            p = doc.add_paragraph(style="Intense Quote")
            p.paragraph_format.left_indent = Cm(0.5)
            p.add_run(inline(line[1:].strip()))
            i += 1; continue
        bullet = re.match(r"^\s*[-*]\s+(.*)$", line)
        number = re.match(r"^\s*\d+[.)]\s+(.*)$", line)
        if bullet:
            p = doc.add_paragraph(style="List Bullet"); p.add_run(inline(bullet.group(1))); i += 1; continue
        if number:
            p = doc.add_paragraph(style="List Number"); p.add_run(inline(number.group(1))); i += 1; continue
        p = doc.add_paragraph(inline(line))
        p.paragraph_format.space_after = Pt(3)
        i += 1


def add_diagram(doc, title, filename, caption):
    path = DIAGRAMS / filename
    if not path.exists():
        return
    doc.add_heading(title, level=2)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    from PIL import Image
    with Image.open(path) as im:
        w, h = im.size
    max_w, max_h = 16.0, 21.5
    width = min(max_w, max_h * w / h)
    height = width * h / w
    if height > max_h:
        height = max_h; width = height * w / h
    p.add_run().add_picture(str(path), width=Cm(width), height=Cm(height))
    cap = doc.add_paragraph(caption); cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.runs[0].italic = True; cap.runs[0].font.color.rgb = RGBColor.from_string(GRAY)


def configure(doc):
    sec = doc.sections[0]
    sec.top_margin = Cm(1.8); sec.bottom_margin = Cm(1.7); sec.left_margin = Cm(2); sec.right_margin = Cm(1.7)
    normal = doc.styles["Normal"]
    normal.font.name = "Aptos"; normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos"); normal.font.size = Pt(10.5)
    normal.paragraph_format.line_spacing = 1.08; normal.paragraph_format.space_after = Pt(4)
    for name, size, color in (("Heading 1", 16, NAVY), ("Heading 2", 13, BLUE), ("Heading 3", 11, BLUE)):
        style = doc.styles[name]; style.font.name = "Aptos Display"; style._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos Display")
        style.font.size = Pt(size); style.font.bold = True; style.font.color.rgb = RGBColor.from_string(color)
    header = sec.header.paragraphs[0]; header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = header.add_run("JAPANO  |  ERD DEFENSE — BẢN GỘP HỌC"); r.font.size = Pt(8); r.font.color.rgb = RGBColor.from_string(GRAY)
    footer = sec.footer.paragraphs[0]; footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = footer.add_run("JAPANO  •  Trang "); r.font.size = Pt(8); r.font.color.rgb = RGBColor.from_string(GRAY); page_number(footer)


def main():
    doc = Document(); configure(doc)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(35)
    r = p.add_run("JAPANO"); r.bold = True; r.font.size = Pt(28); r.font.color.rgb = RGBColor.from_string(NAVY)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("ERD DEFENSE — BẢN GỘP DUY NHẤT ĐỂ HỌC"); r.bold = True; r.font.size = Pt(17); r.font.color.rgb = RGBColor.from_string(BLUE)
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Phân tích source/database • ERD con • Data flow • Bài nói • 48 câu phản biện"); r.italic = True; r.font.color.rgb = RGBColor.from_string(GRAY)
    table = doc.add_table(rows=4, cols=2); table.alignment = WD_TABLE_ALIGNMENT.CENTER; table.style = "Table Grid"
    for idx, (a, b) in enumerate([("Sinh viên", "[Tên sinh viên]"), ("Lớp / ngành", "[Tên lớp – ngành]"), ("Giảng viên", "[Tên giảng viên]"), ("Snapshot", "20/08/2026 — 36 entity · 50 quan hệ · 35 collection")]):
        shade(table.cell(idx, 0), LIGHT); margins(table.cell(idx, 0)); margins(table.cell(idx, 1)); border(table.cell(idx, 0)); border(table.cell(idx, 1))
        table.cell(idx, 0).paragraphs[0].add_run(a).bold = True; table.cell(idx, 1).paragraphs[0].add_run(b)
    doc.add_paragraph()
    p = doc.add_paragraph(style="Intense Quote"); p.add_run("Cách học: đọc phần 12 trước để nhớ trục, sau đó học phần 09 để nói, cuối cùng dùng phần 10 để luyện phản biện. Các câu trả lời đều phân biệt [THỰC TẾ], [SUY LUẬN] và [ĐỀ XUẤT].")
    doc.add_page_break()
    doc.add_heading("Mục lục học nhanh", level=1)
    for idx, (_, title) in enumerate(DOCS, 1):
        doc.add_paragraph(f"{idx}. {title}", style="List Number")
    doc.add_paragraph("Phụ lục: hình ERD tổng và 7 ERD con.")
    doc.add_page_break()
    for index, (filename, title) in enumerate(DOCS):
        doc.add_heading(f"PHẦN {index + 1} — {title}", level=1)
        add_markdown(doc, BASE / filename)
        if filename == "04_ERD_MODULES.md":
            doc.add_page_break(); doc.add_heading("Phụ lục A — Hình ERD con để trình chiếu", level=1)
            add_diagram(doc, "ERD-00 — Tổng thể", "ERD-00-overview.png", "ERD tổng — source editable: ERD-00-overview.drawio")
            for i, (slug, name, png) in enumerate([
                ("product-catalog", "Danh mục, sản phẩm và biến thể", "ERD-01-product-catalog.png"),
                ("media-and-ai-content", "Media và nội dung AI", "ERD-02-media-and-ai-content.png"),
                ("user-and-shopping", "Người dùng và ý định mua sắm", "ERD-03-user-and-shopping.png"),
                ("order-payment-return", "Đơn hàng, thanh toán và trả hàng", "ERD-04-order-payment-return.png"),
                ("promotion-and-loyalty", "Khuyến mãi, VIP và Flagcard", "ERD-05-promotion-and-loyalty.png"),
                ("review-and-moderation", "Đánh giá và kiểm duyệt", "ERD-06-review-and-moderation.png"),
                ("behavior-ai-and-operations", "Hành vi, AI và vận hành", "ERD-07-behavior-ai-and-operations.png"),
            ], 1):
                add_diagram(doc, f"ERD-0{i} — {name}", png, f"ERD-0{i} — source Mermaid: ERD-0{i}-{slug}.mmd")
        if index < len(DOCS) - 1:
            doc.add_page_break()
    doc.core_properties.title = "JAPANO ERD Defense — Bản gộp duy nhất để học"
    doc.core_properties.subject = "ERD, database defense, data flow, presentation and Q&A"
    doc.core_properties.author = "JAPANO"
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
