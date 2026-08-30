#!/usr/bin/env python3
"""Sinh duy nhất một trang ERD tổng quát ``JAPANO_ERD.drawio``."""
from pathlib import Path
from xml.etree import ElementTree as ET

import build_erd_core


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'JAPANO_ERD.drawio'


def build():
    build_erd_core.OUT = OUT
    build_erd_core.build()
    root = ET.parse(OUT).getroot()
    diagram = root.find('diagram')
    if diagram is None:
        raise RuntimeError('Bộ sinh không tạo được trang ERD tổng quát.')
    diagram.set('data-view', 'app')
    diagram.set('name', 'ERD tổng quát ứng dụng')
    ET.indent(root, space='  ')
    OUT.write_bytes(ET.tostring(root, encoding='utf-8', xml_declaration=True))

    print(f'-> {OUT}')
    print('   1 file · 1 trang tổng quát app')


if __name__ == '__main__':
    build()
