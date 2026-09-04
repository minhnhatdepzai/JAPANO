#!/usr/bin/env python3
"""Dựng báo cáo tốt nghiệp JAPANO ra tệp DOCX.

Chạy:  python3 docs/report/tools/build_report.py

Quy trình hai lượt. Lượt một dựng tài liệu với mục lục chưa có số trang, xuất
PDF rồi dò xem mỗi tiêu đề, mỗi hình và mỗi bảng rơi vào trang nào. Lượt hai
dựng lại với đúng những số trang đó. Nhờ vậy mục lục và hai danh mục hiển thị
đúng cả trong Word lẫn trong bản PDF kiểm tra — LibreOffice không tự tính lại
field khi chuyển đổi.
"""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'content'))

from report_engine import Report  # noqa: E402

import ch00_modau, ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, appendix  # noqa: E402
import front  # noqa: E402

OUT_DIR = HERE.parents[0]
DOCX = OUT_DIR / 'BAO_CAO_TONG_HOP_JAPANO.docx'
PDF = OUT_DIR / 'BAO_CAO_TONG_HOP_JAPANO.pdf'

BODY = [ch00_modau, ch01, ch02, ch03, ch04, ch05, ch06, ch07, ch08, appendix]


def build_body(r):
    for module in BODY:
        module.build(r)
    # Hai phụ lục cuối phải dựng sau cùng vì nội dung của chúng phụ thuộc vào
    # những gì thân bài đã sinh ra (danh sách ảnh còn thiếu).
    appendix.build_missing_images(r, r.missing_images)
    appendix.build_evidence_matrix(r)


def build_document(pages):
    outline = Report()
    build_body(outline)

    r = Report()
    front.build(r, {
        'headings': outline.headings,
        'figures': outline.figures,
        'tables': outline.tables,
    }, pages)
    build_body(r)
    return r


def to_pdf(docx_path):
    subprocess.run(
        ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', str(docx_path.parent),
         str(docx_path)],
        check=True, capture_output=True, timeout=900)
    return docx_path.with_suffix('.pdf')


def map_pages(pdf_path, r):
    """Dò số trang của từng tiêu đề, hình và bảng trong bản PDF lượt một."""
    text = subprocess.run(['pdftotext', '-layout', str(pdf_path), '-'],
                          check=True, capture_output=True, timeout=300).stdout.decode('utf-8', 'replace')
    pages = text.split('\f')
    flat = [re.sub(r'\s+', ' ', page) for page in pages]
    result = {}

    def find(needle, start_page=0):
        needle = re.sub(r'\s+', ' ', needle).strip()
        if not needle:
            return None
        for index in range(start_page, len(flat)):
            if needle in flat[index]:
                return index + 1
        return None

    cursor = 0
    for _, heading in r.headings:
        page = find(heading, cursor)
        if page:
            result[('h', heading)] = page
            cursor = max(0, page - 1)
    cursor = 0
    for number, caption in r.figures:
        page = find(f'Hình {number}.', cursor)
        if page:
            result[('figure', number)] = page
            cursor = max(0, page - 1)
    cursor = 0
    for number, caption in r.tables:
        page = find(f'Bảng {number}.', cursor)
        if page:
            result[('table', number)] = page
            cursor = max(0, page - 1)
    return result


def main():
    print('Lượt 1: dựng tài liệu để lấy số trang…')
    first = build_document({})
    temp = OUT_DIR / '_pass1.docx'
    first.save(temp)
    pdf1 = to_pdf(temp)
    pages = map_pages(pdf1, first)
    print(f'  đã xác định {len(pages)} vị trí trang')

    print('Lượt 2: dựng bản chính thức…')
    final = build_document(pages)
    final.save(DOCX)
    for leftover in (temp, pdf1):
        leftover.unlink(missing_ok=True)

    print('Xuất PDF kiểm tra trình bày…')
    to_pdf(DOCX)
    info = subprocess.run(['pdfinfo', str(PDF)], check=True, capture_output=True).stdout.decode()
    total = re.search(r'Pages:\s+(\d+)', info)
    print(f'DOCX : {DOCX}')
    print(f'PDF  : {PDF}')
    print(f'Số trang: {total.group(1) if total else "?"}')
    print(f'Chương: {final.chapter} · Hình: {len(final.figures)} · Bảng: {len(final.tables)} · '
          f'Ảnh cần bổ sung: {len(final.missing_images)}')
    return final


if __name__ == '__main__':
    main()
