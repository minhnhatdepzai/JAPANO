#!/usr/bin/env python3
"""Chuẩn hoá khung trang sau khi chạy layout ELK của draw.io.

    python3 scripts/normalize_drawio_page.py file.drawio [--margin 80]

ELK sắp lại toạ độ nhưng KHÔNG biết khổ trang, nên bảng hay văng ra ngoài và
toạ độ âm. Bước này dịch mọi ô về góc dương rồi đặt lại pageWidth/pageHeight vừa
đúng nội dung. Chỉ đụng toạ độ, không đụng nội dung hay quan hệ.
"""
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def normalize(path, margin=80):
    tree = ET.parse(path)
    root = tree.getroot()
    changed = 0
    for model in root.iter('mxGraphModel'):
        boxes = []
        for cell in model.iter('mxCell'):
            if cell.get('vertex') != '1' or cell.get('parent') != '1':
                continue
            geometry = cell.find('mxGeometry')
            # Ô có thể thiếu x hoặc y (draw.io coi thiếu là 0). Điền 0 trước khi
            # dịch, nếu không phép min() sẽ vấp None.
            if geometry is None:
                continue
            if geometry.get('x') is None and geometry.get('y') is None:
                continue
            if geometry.get('x') is None:
                geometry.set('x', '0')
            if geometry.get('y') is None:
                geometry.set('y', '0')
            boxes.append((cell, geometry))
        if not boxes:
            continue
        min_x = min(float(g.get('x')) for _, g in boxes)
        min_y = min(float(g.get('y')) for _, g in boxes)
        shift_x, shift_y = margin - min_x, margin - min_y
        for _, geometry in boxes:
            geometry.set('x', str(round(float(geometry.get('x')) + shift_x)))
            geometry.set('y', str(round(float(geometry.get('y')) + shift_y)))
            changed += 1
        # Waypoint của cạnh cũng nằm trong hệ toạ độ đó.
        for cell in model.iter('mxCell'):
            if cell.get('edge') != '1':
                continue
            for point in cell.iter('mxPoint'):
                if point.get('as') == 'offset' or point.get('x') is None:
                    continue
                point.set('x', str(round(float(point.get('x')) + shift_x)))
                point.set('y', str(round(float(point.get('y')) + shift_y)))
        width = max(float(g.get('x')) + float(g.get('width') or 0) for _, g in boxes) + margin
        height = max(float(g.get('y')) + float(g.get('height') or 0) for _, g in boxes) + margin
        model.set('pageWidth', str(int(width)))
        model.set('pageHeight', str(int(height)))
    tree.write(path, encoding='utf-8', xml_declaration=False)
    return changed


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    margin = 80
    if '--margin' in sys.argv:
        margin = int(sys.argv[sys.argv.index('--margin') + 1])
    for target in args:
        count = normalize(Path(target), margin)
        print(f'{target}: đã chuẩn hoá {count} ô')
