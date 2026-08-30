#!/usr/bin/env python3
"""So ERD tổng quát một trang với snapshot database Atlas thật.

    python3 scripts/validate_erd_against_atlas.py

ERD tổng quát là tập con logic có chủ đích. Gate bắt buộc: mọi bảng trên ERD
phải tồn tại trên Atlas, không trùng và không có quan hệ trỏ sai.

Script KHÔNG kết nối database. Nó đọc snapshot đã chụp bằng scripts/atlas_audit.js
để kết quả tái lập được và không cần credential.
"""
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'docs/database/atlas-snapshot.json'
CANONICAL = ROOT / 'JAPANO_ERD.drawio'

# Tên collection: chữ thường, số và gạch dưới.
#
# Hai ERD đặt nhãn khác nhau. Bản vật lý mở đầu bằng tên collection
# ("users  ·  36 doc"); bản core đặt tên tiếng Việt trước rồi xuống dòng
# ("Người dùng  ·  36 doc\nusers"). Vì vậy phải quét MỌI token trong nhãn và lấy
# token khớp danh sách collection thật, thay vì chỉ đọc token đầu tiên.
TOKEN = re.compile(r'[a-z][a-z0-9_]{2,}')


def collection_in_label(label, known):
    """Tên collection xuất hiện trong nhãn bảng, hoặc None."""
    for token in TOKEN.findall(label):
        if token in known:
            return token
    return None


def is_table(cell):
    """Ô này có phải một BẢNG collection không?

    Draw.io dựng bảng bằng `shape=table` và mỗi dòng field bằng `shape=tableRow`.
    Chuỗi "swimlane" xuất hiện trong style của DÒNG (`swimlaneHead=0`), nên lọc
    theo "swimlane" sẽ bắt nhầm hàng trăm dòng field và bỏ sót mọi bảng.
    """
    style = cell.get('style') or ''
    return 'shape=table;' in style and 'tableRow' not in style


def table_names(path, known, view=None):
    """Tên collection của mọi bảng trong file .drawio, theo từng trang.

    `known` là tập collection thật trên Atlas. Nhãn nào không chứa tên nào trong
    tập đó được ghi lại riêng thành `unknown` — đó chính là các bảng "bịa ra".
    """
    tree = ElementTree.parse(path)
    unknown = []
    found = {}
    duplicates = []
    # Mỗi <diagram> là một trang. Duyệt riêng để biết bảng nằm ở trang nào và để
    # phát hiện cùng một collection bị vẽ hai lần.
    for page in tree.iter('diagram'):
        if view and page.get('data-view') != view:
            continue
        title = page.get('name', '?')
        for cell in page.iter('mxCell'):
            if not is_table(cell):
                continue
            label = re.sub(r'<[^>]+>', ' ', cell.get('value') or '').strip()
            # Bộ sinh ERD tiếng Việt giữ tên collection thật ở thuộc tính ẩn để
            # phần trình bày không phải trộn tiếng Anh vào nhãn bảng.
            name = cell.get('data-collection') or collection_in_label(label, known)
            if name not in known:
                name = None
            if not name:
                if label:
                    unknown.append((title, label.split('\n')[0][:40]))
                continue
            if name in found:
                duplicates.append((name, found[name], title))
            else:
                found[name] = title
    return found, duplicates, unknown


def relation_targets(path, known, view=None):
    """Connector trỏ tới bảng không tồn tại."""
    tree = ElementTree.parse(path)
    broken = []
    for page in tree.iter('diagram'):
        if view and page.get('data-view') != view:
            continue
        ids = {}
        for cell in page.iter('mxCell'):
            if is_table(cell):
                label = re.sub(r'<[^>]+>', ' ', cell.get('value') or '').strip()
                name = cell.get('data-collection') or collection_in_label(label, known)
                if name:
                    ids[cell.get('id')] = name
        for cell in page.iter('mxCell'):
            if cell.get('edge') != '1':
                continue
            for end in ('source', 'target'):
                ref = cell.get(end)
                if ref and ref in ids and ids[ref] not in known:
                    broken.append((page.get('name', '?'), ids[ref]))
    return broken


def relation_row_endpoints(path, view=None):
    """Mọi cạnh nghiệp vụ phải đi từ đúng hàng FK tới đúng hàng PK ``id``."""
    tree = ElementTree.parse(path)
    broken = []
    for page in tree.iter('diagram'):
        if view and page.get('data-view') != view:
            continue
        cells = {cell.get('id'): cell for cell in page.iter('mxCell') if cell.get('id')}
        for edge in page.iter('mxCell'):
            if edge.get('edge') != '1' or not edge.get('data-source-table'):
                continue
            source = cells.get(edge.get('source'))
            target = cells.get(edge.get('target'))
            expected_source = (edge.get('data-source-table'), edge.get('data-source-field'))
            actual_source = (source.get('data-table'), source.get('data-field')) if source is not None else None
            expected_target = (edge.get('data-target-table'), 'id')
            actual_target = (target.get('data-table'), target.get('data-field')) if target is not None else None
            if actual_source != expected_source or actual_target != expected_target:
                broken.append((expected_source, actual_source, expected_target, actual_target))
    return broken


def main():
    if not SNAPSHOT.exists():
        sys.exit(f'Thiếu {SNAPSHOT}. Chạy: node scripts/atlas_audit.js --out {SNAPSHOT}')
    snapshot = json.loads(SNAPSHOT.read_text(encoding='utf-8'))
    atlas = {c['name'] for c in snapshot['collections']}

    print(f'Atlas «{snapshot["database"]}» — snapshot {snapshot["snapshotAt"][:19]}')
    print(f'  {len(atlas)} collection, {snapshot["documentTotal"]} document\n')

    tables, duplicates, unknown = table_names(CANONICAL, atlas, view='app')
    erd = set(tables)
    invented = sorted({label for _, label in unknown})
    broken = relation_targets(CANONICAL, atlas, view='app')
    bad_endpoints = relation_row_endpoints(CANONICAL, view='app')
    omitted = sorted(atlas - erd)
    valid = not invented and not duplicates and not broken and not bad_endpoints and bool(erd)

    print(f'ERD tổng quát: {CANONICAL.relative_to(ROOT)}')
    print(f'  1 trang · {len(erd)} bảng logic chọn từ {len(atlas)} collection Atlas')
    print(f'  bảng không có thật: {", ".join(invented) if invented else "không"}')
    print(f'  bảng trùng: {", ".join(n for n, _, _ in duplicates) if duplicates else "không"}')
    print(f'  quan hệ hỏng: {", ".join(f"{p}/{n}" for p, n in broken) if broken else "không"}')
    print(f'  dây không nối FK → PK: {len(bad_endpoints) if bad_endpoints else "không"}')
    print(f'  collection hỗ trợ không vẽ: {", ".join(omitted)}')
    print(f'\nERD tổng quát hợp lệ với Atlas: {"ĐẠT" if valid else "KHÔNG ĐẠT"}')
    sys.exit(0 if valid else 1)


if __name__ == '__main__':
    main()
