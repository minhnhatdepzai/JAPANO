#!/usr/bin/env python3
"""Bộ dựng tài liệu Word cho báo cáo tốt nghiệp JAPANO.

Tách riêng khỏi nội dung: tệp này chỉ lo trình bày (khổ giấy, style, đánh số
hình/bảng, mục lục, header/footer). Nội dung từng chương nằm trong
docs/report/tools/content/*.py.
"""
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[3]
REPORT = ROOT / 'docs' / 'report'
ASSETS = REPORT / 'assets'

FONT = 'Times New Roman'
BODY_PT = 13
CODE_FONT = 'Consolas'

INK = RGBColor(0x1A, 0x1A, 0x1A)
MUTED = RGBColor(0x55, 0x55, 0x55)
ACCENT = RGBColor(0x8C, 0x2F, 0x27)



# Thứ tự các phần tử con trong <w:pPr> và <w:tblPr> là bắt buộc theo lược đồ
# OOXML. Chèn sai vị trí thì Word vẫn mở được nhưng tệp không hợp lệ, nên hai
# hàm dưới đây luôn đặt phần tử vào đúng chỗ thay vì nối vào cuối.
P_PR_ORDER = [
    'pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl',
    'numPr', 'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens',
    'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE',
    'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind',
    'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', 'textDirection',
    'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr',
    'sectPr', 'pPrChange',
]
TBL_PR_ORDER = [
    'tblStyle', 'tblpPr', 'tblOverlap', 'bidiVisual', 'tblStyleRowBandSize',
    'tblStyleColBandSize', 'tblW', 'jc', 'tblCellSpacing', 'tblInd', 'tblBorders',
    'shd', 'tblLayout', 'tblCellMar', 'tblLook', 'tblCaption', 'tblDescription',
    'tblPrChange',
]


def _insert_ordered(parent, child, order):
    name = child.tag.split('}')[-1]
    position = order.index(name)
    # Lược đồ chỉ cho phép mỗi phần tử xuất hiện một lần; nếu đã có sẵn (ví dụ
    # tblW do chính python-docx thêm) thì thay thế thay vì thêm bản thứ hai.
    for existing in list(parent):
        if existing.tag == child.tag:
            parent.remove(existing)
    for existing in parent:
        existing_name = existing.tag.split('}')[-1]
        if existing_name in order and order.index(existing_name) > position:
            existing.addprevious(child)
            return child
    parent.append(child)
    return child


_LANDSCAPE = {'on': False}


def _set_font(run, name=FONT, size=BODY_PT, bold=False, italic=False, color=INK):
    run.font.name = name
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn('w:rFonts'))
    if rfonts is None:
        rfonts = OxmlElement('w:rFonts')
        rpr.append(rfonts)
    for attr in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
        rfonts.set(qn(attr), name)


def _field(paragraph, instruction, cached=None):
    """Chèn một field Word thật (mục lục, số trang) kèm kết quả đã tính sẵn.

    Kết quả cached quan trọng: LibreOffice khi convert sang PDF không tính lại
    field, nên nếu không có nó thì mục lục trong PDF sẽ trống.
    """
    run = paragraph.add_run()
    begin = OxmlElement('w:fldChar')
    begin.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText')
    instr.set(qn('xml:space'), 'preserve')
    instr.text = instruction
    sep = OxmlElement('w:fldChar')
    sep.set(qn('w:fldCharType'), 'separate')
    end = OxmlElement('w:fldChar')
    end.set(qn('w:fldCharType'), 'end')
    run._element.append(begin)
    run._element.append(instr)
    run._element.append(sep)
    if cached is not None:
        text = OxmlElement('w:t')
        text.text = str(cached)
        run._element.append(text)
    run._element.append(end)
    _set_font(run)
    return run


def _shade(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tc_pr.append(shd)


def _keep_with_next(paragraph, value=True):
    paragraph.paragraph_format.keep_with_next = value


class Report:
    """API viết nội dung. Mọi số hiệu hình/bảng do lớp này cấp phát."""

    def __init__(self, toc_pages=None):
        self.doc = Document()
        self.chapter = 0
        self.fig_n = 0
        self.tab_n = 0
        self.figures = []          # (số hiệu, tiêu đề)
        self.tables = []
        self.headings = []         # (cấp, tiêu đề)
        self.missing_images = []   # placeholder ảnh cần người dùng bổ sung
        self.toc_pages = toc_pages or {}
        self._pending_break = False
        self.chapter_label = None
        self._setup_styles()
        self._setup_page()

    # ------------------------------------------------------------------ setup
    def _setup_styles(self):
        styles = self.doc.styles
        normal = styles['Normal']
        normal.font.name = FONT
        normal.font.size = Pt(BODY_PT)
        normal.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
        pf = normal.paragraph_format
        pf.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        pf.line_spacing = 1.5
        pf.space_after = Pt(6)
        pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        pf.first_line_indent = Cm(1.0)

        for name, size, color, before, after in (
            ('Heading 1', 16, ACCENT, 18, 10),
            ('Heading 2', 14, INK, 12, 6),
            ('Heading 3', 13, INK, 10, 4),
            ('Heading 4', 13, MUTED, 8, 4),
        ):
            style = styles[name]
            style.font.name = FONT
            style.font.size = Pt(size)
            style.font.bold = True
            style.font.color.rgb = color
            style.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
            hpf = style.paragraph_format
            hpf.space_before = Pt(before)
            hpf.space_after = Pt(after)
            hpf.keep_with_next = True
            hpf.first_line_indent = Cm(0)
            hpf.line_spacing = 1.3
            hpf.alignment = WD_ALIGN_PARAGRAPH.LEFT

    def _setup_page(self):
        section = self.doc.sections[0]
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.left_margin = Cm(3.5)
        section.right_margin = Cm(2.0)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.header_distance = Cm(1.2)
        section.footer_distance = Cm(1.2)

    def add_header_footer(self, header_text='BÁO CÁO TỐT NGHIỆP — JAPANO'):
        # Trang bìa không mang header/footer: đây là quy ước trình bày chuẩn của
        # báo cáo tốt nghiệp, và số trang chỉ bắt đầu có ý nghĩa từ trang sau.
        first = self.doc.sections[0]
        first.different_first_page_header_footer = True
        for section in self.doc.sections:
            header = section.header
            header.is_linked_to_previous = False
            hp = header.paragraphs[0]
            hp.text = ''
            hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            hp.paragraph_format.first_line_indent = Cm(0)
            _set_font(hp.add_run(header_text), size=10, italic=True, color=MUTED)
            self._bottom_border(hp)

            footer = section.footer
            footer.is_linked_to_previous = False
            fp = footer.paragraphs[0]
            fp.text = ''
            fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
            fp.paragraph_format.first_line_indent = Cm(0)
            _field(fp, ' PAGE ', cached='')

    @staticmethod
    def _bottom_border(paragraph):
        p_pr = paragraph._p.get_or_add_pPr()
        borders = OxmlElement('w:pBdr')
        bottom = OxmlElement('w:bottom')
        bottom.set(qn('w:val'), 'single')
        bottom.set(qn('w:sz'), '4')
        bottom.set(qn('w:space'), '2')
        bottom.set(qn('w:color'), 'BBBBBB')
        borders.append(bottom)
        _insert_ordered(p_pr, borders, P_PR_ORDER)

    # --------------------------------------------------------------- headings
    def h1(self, text, numbered=True):
        self.pagebreak()
        if numbered:
            self.chapter += 1
            self.fig_n = 0
            self.tab_n = 0
            text = f'CHƯƠNG {self.chapter}. {text.upper()}'
        p = self._consume_break(self.doc.add_paragraph(style='Heading 1'))
        _set_font(p.add_run(text), size=16, bold=True, color=ACCENT)
        self.headings.append((1, text))
        return p

    def front_h1(self, text):
        """Tiêu đề cấp 1 cho phần đầu sách (không đánh số chương)."""
        self.pagebreak()
        p = self._consume_break(self.doc.add_paragraph(style='Heading 1'))
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _set_font(p.add_run(text.upper()), size=15, bold=True, color=ACCENT)
        self.headings.append((1, text.upper()))
        return p

    def appendix(self, letter, title):
        """Mở một phụ lục: đánh số bảng/hình theo chữ cái thay vì theo chương."""
        self.chapter_label = letter
        self.fig_n = 0
        self.tab_n = 0
        return self.front_h1(title)

    def h2(self, text):
        p = self.doc.add_paragraph(style='Heading 2')
        _set_font(p.add_run(text), size=14, bold=True)
        self.headings.append((2, text))
        return p

    def h3(self, text):
        p = self.doc.add_paragraph(style='Heading 3')
        _set_font(p.add_run(text), size=13, bold=True)
        self.headings.append((3, text))
        return p

    def h4(self, text):
        p = self.doc.add_paragraph(style='Heading 4')
        _set_font(p.add_run(text), size=13, bold=True, italic=True, color=MUTED)
        return p

    # ------------------------------------------------------------------- text
    def p(self, text, indent=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY, italic=False,
          size=BODY_PT, space_after=6, keep=False):
        para = self._para()
        para.alignment = align
        para.paragraph_format.first_line_indent = Cm(1.0 if indent else 0)
        para.paragraph_format.space_after = Pt(space_after)
        _keep_with_next(para, keep)
        self._rich(para, text, size=size, italic=italic)
        return para

    @staticmethod
    def _rich(para, text, size=BODY_PT, italic=False, color=INK):
        """Hỗ trợ **in đậm**, *in nghiêng* và `mã nguồn` ngay trong chuỗi."""
        import re
        pattern = r'(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)'
        for token in re.split(pattern, str(text)):
            if not token:
                continue
            if token.startswith('**') and token.endswith('**') and len(token) > 4:
                _set_font(para.add_run(token[2:-2]), size=size, bold=True, italic=italic, color=color)
            elif token.startswith('*') and token.endswith('*') and len(token) > 2:
                _set_font(para.add_run(token[1:-1]), size=size, italic=True, color=color)
            elif token.startswith('`') and token.endswith('`'):
                _set_font(para.add_run(token[1:-1]), name=CODE_FONT, size=size - 1.5, color=color)
            else:
                _set_font(para.add_run(token), size=size, italic=italic, color=color)

    def bullets(self, items, style='List Bullet'):
        for item in items:
            para = self.doc.add_paragraph(style=style)
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.left_indent = Cm(1.0)
            para.paragraph_format.space_after = Pt(3)
            para.paragraph_format.line_spacing = 1.4
            para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            self._rich(para, item)

    def numbers(self, items):
        self.bullets(items, style='List Number')

    def note(self, text, label='Ghi chú'):
        table = self.doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        self._table_width(table, [Cm(15.5)])
        cell = table.cell(0, 0)
        _shade(cell, 'F6F3EE')
        para = cell.paragraphs[0]
        para.paragraph_format.first_line_indent = Cm(0)
        para.paragraph_format.space_after = Pt(0)
        para.paragraph_format.line_spacing = 1.3
        para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        _set_font(para.add_run(f'{label}. '), size=11.5, bold=True, color=ACCENT)
        self._rich(para, text, size=11.5)
        self._spacer(4)
        return table

    def _spacer(self, points=6):
        para = self.doc.add_paragraph()
        para.paragraph_format.space_after = Pt(points)
        para.paragraph_format.space_before = Pt(0)
        para.paragraph_format.line_spacing = 1.0
        para.paragraph_format.first_line_indent = Cm(0)
        for run in para.runs:
            _set_font(run, size=4)
        return para

    def code(self, lines, caption=None, language=''):
        table = self.doc.add_table(rows=1, cols=1)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        self._table_width(table, [Cm(15.5)])
        cell = table.cell(0, 0)
        _shade(cell, 'F4F4F2')
        first = True
        for line in lines:
            para = cell.paragraphs[0] if first else cell.add_paragraph()
            first = False
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.space_after = Pt(0)
            para.paragraph_format.space_before = Pt(0)
            para.paragraph_format.line_spacing = 1.05
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            _set_font(para.add_run(line if line else ' '), name=CODE_FONT, size=10)
        if caption:
            self.caption(caption, kind='code', language=language)
        else:
            self._spacer(6)
        return table

    def formula(self, lines, note=None):
        for line in lines:
            para = self.doc.add_paragraph()
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.space_after = Pt(2)
            para.paragraph_format.space_before = Pt(2)
            para.paragraph_format.line_spacing = 1.2
            ascii_only = all(ord(ch) < 128 for ch in line)
            if ascii_only:
                _set_font(para.add_run(line), name=CODE_FONT, size=10.5)
            else:
                _set_font(para.add_run(line), size=12, italic=True)
        if note:
            para = self.doc.add_paragraph()
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.space_after = Pt(8)
            self._rich(para, note, size=10.5, color=MUTED)

    def caption(self, text, kind='figure', language=''):
        para = self.doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.first_line_indent = Cm(0)
        para.paragraph_format.space_after = Pt(10)
        para.paragraph_format.space_before = Pt(4)
        para.paragraph_format.line_spacing = 1.2
        if kind == 'code':
            _set_font(para.add_run(f'Trích mã nguồn. {text}'), size=10.5, italic=True, color=MUTED)
        else:
            _set_font(para.add_run(text), size=10.5, italic=True, color=MUTED)
        return para

    # ----------------------------------------------------------------- tables
    @staticmethod
    def _table_width(table, widths):
        # Chặn ngay lúc dựng: tổng bề rộng cột không được vượt vùng in. Một bảng
        # rộng hơn vùng in sẽ bị cắt mất cột cuối khi in ra PDF.
        total_cm = sum(w.cm for w in widths)
        limit = 25.8 if _LANDSCAPE.get('on') else 15.6
        if total_cm > limit + 0.01:
            raise ValueError(f'Bảng rộng {total_cm:.2f} cm, vượt vùng in {limit} cm')
        table.autofit = False
        total = sum(w.twips for w in widths)
        tbl_pr = table._tbl.tblPr
        tbl_w = OxmlElement('w:tblW')
        tbl_w.set(qn('w:w'), str(total))
        tbl_w.set(qn('w:type'), 'dxa')
        _insert_ordered(tbl_pr, tbl_w, TBL_PR_ORDER)
        grid = table._tbl.find(qn('w:tblGrid'))
        if grid is not None:
            for col, width in zip(grid.findall(qn('w:gridCol')), widths):
                col.set(qn('w:w'), str(width.twips))
        for row in table.rows:
            for cell, width in zip(row.cells, widths):
                cell.width = width

    def table(self, caption, headers, rows, widths=None, font=11, header_fill='EDE7E0',
              align_right=(), note=None, numbered=True):
        # Bảng ở phần đầu sách (trang phụ bìa, danh mục từ viết tắt) không được
        # đánh số: chúng nằm ngoài dòng đánh số của thân bài, và nếu đánh số thì
        # số hiệu của mọi bảng phía sau sẽ lệch khỏi Danh mục bảng.
        number = ''
        if numbered:
            self.tab_n += 1
            prefix = self.chapter_label or self.chapter
            number = f'{prefix}.{self.tab_n}' if prefix else f'0.{self.tab_n}'
        cap = self.doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.first_line_indent = Cm(0)
        cap.paragraph_format.space_after = Pt(4)
        cap.paragraph_format.space_before = Pt(8)
        _keep_with_next(cap, True)
        if numbered:
            _set_font(cap.add_run(f'Bảng {number}. '), size=10.5, bold=True, color=MUTED)
            self.tables.append((number, caption))
        _set_font(cap.add_run(caption), size=10.5, italic=True, color=MUTED)

        columns = len(headers)
        if widths is None:
            widths = [Cm(15.5 / columns)] * columns
        table = self.doc.add_table(rows=1, cols=columns)
        table.style = 'Table Grid'
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        self._table_width(table, widths)
        for index, head in enumerate(headers):
            cell = table.rows[0].cells[index]
            _shade(cell, header_fill)
            para = cell.paragraphs[0]
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.space_after = Pt(1)
            para.paragraph_format.line_spacing = 1.15
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            _set_font(para.add_run(str(head)), size=font, bold=True)
        for row_values in rows:
            cells = table.add_row().cells
            for index, value in enumerate(row_values):
                para = cells[index].paragraphs[0]
                para.paragraph_format.first_line_indent = Cm(0)
                para.paragraph_format.space_after = Pt(1)
                para.paragraph_format.line_spacing = 1.15
                para.alignment = (WD_ALIGN_PARAGRAPH.RIGHT if index in align_right
                                  else WD_ALIGN_PARAGRAPH.LEFT)
                self._rich(para, value, size=font)
        # Lặp lại hàng tiêu đề khi bảng tràn sang trang sau.
        tr_pr = table.rows[0]._tr.get_or_add_trPr()
        header_flag = OxmlElement('w:tblHeader')
        header_flag.set(qn('w:val'), 'true')
        tr_pr.append(header_flag)
        # Không cho một hàng bị cắt đôi giữa hai trang.
        for row in table.rows:
            tr_pr = row._tr.get_or_add_trPr()
            cant_split = OxmlElement('w:cantSplit')
            tr_pr.append(cant_split)
        if note:
            para = self.doc.add_paragraph()
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.space_before = Pt(3)
            para.paragraph_format.space_after = Pt(10)
            para.paragraph_format.line_spacing = 1.2
            _set_font(para.add_run('Nguồn: '), size=10, bold=True, color=MUTED)
            self._rich(para, note, size=10, color=MUTED)
        else:
            self._spacer(8)
        return table

    # ---------------------------------------------------------------- figures
    def figure(self, path, caption, source=None, width_cm=15.0, max_height_cm=19.0):
        from PIL import Image
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(path)
        self.fig_n += 1
        prefix = self.chapter_label or self.chapter
        number = f'{prefix}.{self.fig_n}' if prefix else f'0.{self.fig_n}'
        with Image.open(path) as image:
            ratio = image.height / image.width
        width = width_cm
        if width * ratio > max_height_cm:
            width = max_height_cm / ratio
        para = self.doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.first_line_indent = Cm(0)
        para.paragraph_format.space_before = Pt(8)
        para.paragraph_format.space_after = Pt(2)
        _keep_with_next(para, True)
        para.add_run().add_picture(str(path), width=Cm(width))
        cap = self.doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.first_line_indent = Cm(0)
        cap.paragraph_format.space_after = Pt(10)
        cap.paragraph_format.line_spacing = 1.2
        _set_font(cap.add_run(f'Hình {number}. '), size=10.5, bold=True, color=MUTED)
        self._rich(cap, caption, size=10.5, italic=True, color=MUTED)
        if source:
            src = self.doc.add_paragraph()
            src.alignment = WD_ALIGN_PARAGRAPH.CENTER
            src.paragraph_format.first_line_indent = Cm(0)
            src.paragraph_format.space_after = Pt(10)
            src.paragraph_format.line_spacing = 1.15
            _set_font(src.add_run('Nguồn: '), size=9.5, italic=True, color=MUTED)
            self._rich(src, source, size=9.5, color=MUTED)
        self.figures.append((number, caption))
        return number

    def figure_placeholder(self, code, title, purpose, howto, ratio, where, privacy=''):
        self.fig_n += 1
        prefix = self.chapter_label or self.chapter
        number = f'{prefix}.{self.fig_n}' if prefix else f'0.{self.fig_n}'
        table = self.doc.add_table(rows=1, cols=1)
        table.style = 'Table Grid'
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        self._table_width(table, [Cm(15.5)])
        cell = table.cell(0, 0)
        _shade(cell, 'FBF6E9')
        first = True

        def line(label, value, bold_label=True):
            nonlocal first
            para = cell.paragraphs[0] if first else cell.add_paragraph()
            first = False
            para.paragraph_format.first_line_indent = Cm(0)
            para.paragraph_format.space_after = Pt(2)
            para.paragraph_format.line_spacing = 1.25
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            if label:
                _set_font(para.add_run(f'{label} '), size=11, bold=bold_label, color=ACCENT if bold_label else MUTED)
            self._rich(para, value, size=11)

        line(f'[CẦN BỔ SUNG ẢNH — {code}]', '')
        line('Tên ảnh:', title)
        line('Mục đích:', purpose)
        line('Cách chụp:', howto)
        line('Tỉ lệ đề xuất:', ratio)
        line('Vị trí cần chèn:', where)
        if privacy:
            line('Riêng tư:', privacy)
        cap = self.doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.first_line_indent = Cm(0)
        cap.paragraph_format.space_after = Pt(10)
        _set_font(cap.add_run(f'Hình {number}. '), size=10.5, bold=True, color=MUTED)
        _set_font(cap.add_run(f'{title} (ảnh chưa có — xem khung hướng dẫn ở trên).'),
                  size=10.5, italic=True, color=MUTED)
        self.figures.append((number, f'{title} [chờ bổ sung — {code}]'))
        self.missing_images.append({
            'code': code, 'number': number, 'title': title, 'where': where,
            'howto': howto, 'ratio': ratio, 'privacy': privacy or 'Không có dữ liệu cá nhân trong khung hình.',
        })
        return number


    # ------------------------------------------------- mục lục và danh mục
    def _leader_paragraph(self, text, page, level=0, bold=False, size=12):
        """Một dòng mục lục: nhãn — dấu chấm dẫn — số trang, canh phải bằng tab."""
        from docx.enum.text import WD_TAB_ALIGNMENT, WD_TAB_LEADER
        para = self.doc.add_paragraph()
        pf = para.paragraph_format
        pf.first_line_indent = Cm(0)
        pf.left_indent = Cm(0.6 * level)
        pf.space_after = Pt(3 if level else 5)
        pf.line_spacing = 1.25
        pf.tab_stops.add_tab_stop(Cm(15.5), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        _set_font(para.add_run(text), size=size, bold=bold)
        _set_font(para.add_run('\t'), size=size)
        _set_font(para.add_run(str(page) if page else '—'), size=size, bold=bold)
        return para

    def toc(self, headings, pages):
        """Mục lục dạng field Word thật, có sẵn kết quả để PDF hiển thị được.

        Field bọc quanh các đoạn mục lục: Word cập nhật lại được bằng F9, còn
        LibreOffice khi xuất PDF vẫn in đúng phần kết quả đã dựng sẵn.
        """
        opener = self.doc.add_paragraph()
        opener.paragraph_format.first_line_indent = Cm(0)
        opener.paragraph_format.space_after = Pt(0)
        run = opener.add_run()
        begin = OxmlElement('w:fldChar'); begin.set(qn('w:fldCharType'), 'begin')
        instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve')
        instr.text = ' TOC \\o "1-3" \\h \\z \\u '
        sep = OxmlElement('w:fldChar'); sep.set(qn('w:fldCharType'), 'separate')
        run._element.append(begin); run._element.append(instr); run._element.append(sep)
        _set_font(run, size=2)
        last = opener
        for level, text in headings:
            last = self._leader_paragraph(text, pages.get(('h', text)), level=level - 1,
                                          bold=(level == 1), size=12.5 if level == 1 else 12)
        run = last.add_run()
        end = OxmlElement('w:fldChar'); end.set(qn('w:fldCharType'), 'end')
        run._element.append(end)
        _set_font(run, size=2)

    def catalogue(self, entries, pages, kind):
        """Danh mục hình hoặc danh mục bảng."""
        prefix = 'Hình' if kind == 'figure' else 'Bảng'
        for number, caption in entries:
            self._leader_paragraph(f'{prefix} {number}. {caption}',
                                   pages.get((kind, number)), size=12)

    # ------------------------------------------------------------------ flow
    def pagebreak(self):
        """Đánh dấu: đoạn được tạo tiếp theo sẽ bắt đầu ở đầu trang mới.

        Cố ý KHÔNG chèn một đoạn rỗng chứa ngắt trang — đoạn đó tự nó chiếm một
        dòng và sinh ra trang trắng mỗi khi nội dung phía trước vừa kết thúc
        đúng cuối trang.
        """
        self._pending_break = True

    def _consume_break(self, paragraph):
        if getattr(self, '_pending_break', False):
            paragraph.paragraph_format.page_break_before = True
            self._pending_break = False
        return paragraph

    def _para(self):
        return self._consume_break(self.doc.add_paragraph())

    def landscape(self):
        section = self.doc.add_section(WD_SECTION.NEW_PAGE)
        section.orientation = WD_ORIENT.LANDSCAPE
        section.page_width = Cm(29.7)
        section.page_height = Cm(21.0)
        section.left_margin = Cm(2.0)
        section.right_margin = Cm(2.0)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        _LANDSCAPE['on'] = True
        return section

    def portrait(self):
        _LANDSCAPE['on'] = False
        section = self.doc.add_section(WD_SECTION.NEW_PAGE)
        section.orientation = WD_ORIENT.PORTRAIT
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.left_margin = Cm(3.5)
        section.right_margin = Cm(2.0)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        return section

    def _drop_orphan_spacers(self):
        body = self.doc.element.body
        children = list(body)
        for index, node in enumerate(children[:-1]):
            if not node.tag.endswith('}p'):
                continue
            if ''.join(node.itertext()).strip():
                continue
            nxt = children[index + 1]
            if not nxt.tag.endswith('}p'):
                continue
            p_pr = nxt.find(qn('w:pPr'))
            if p_pr is not None and p_pr.find(qn('w:pageBreakBefore')) is not None:
                body.remove(node)

    def _fix_settings(self):
        settings = self.doc.settings.element
        zoom = settings.find(qn('w:zoom'))
        if zoom is not None and zoom.get(qn('w:percent')) is None:
            zoom.set(qn('w:percent'), '100')

    def save(self, path):
        self._drop_orphan_spacers()
        self._fix_settings()
        self.add_header_footer()
        self.doc.save(str(path))
        return path
