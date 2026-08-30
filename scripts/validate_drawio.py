#!/usr/bin/env python3
"""Kiểm tra file .drawio trước khi đem đi trình bày.

    python3 scripts/validate_drawio.py docs/architecture/erd/*.drawio

Bắt đúng những lỗi làm hỏng buổi bảo vệ: file không mở được, quan hệ trỏ vào ô
không tồn tại, bảng nằm ngoài trang, chữ bị cắt, dây xuyên bảng hoặc chồng đoạn.
"""
import sys
import re
import xml.etree.ElementTree as ET
from pathlib import Path

def check(path):
    problems, notes = [], []
    raw = path.read_bytes()
    try:
        tree = ET.fromstring(raw)
    except ET.ParseError as error:
        return [f'XML không mở được: {error}'], []

    if b'watermark' in raw.lower():
        problems.append('file có chữ "watermark"')

    def crosses(ax, ay, bx, by, box, pad=6):
        x, y, w, h = box
        x, y, w, h = x - pad, y - pad, w + 2 * pad, h + 2 * pad
        for steps in range(1, 60):
            t = steps / 60
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            if x <= px <= x + w and y <= py <= y + h:
                return True
        return False

    def shared_length(first, second):
        """Độ dài chồng nhau của hai đường gãy đã có waypoint rõ ràng."""
        total = 0
        for a, b in zip(first, first[1:]):
            for c, d in zip(second, second[1:]):
                if a[0] == b[0] == c[0] == d[0]:
                    total += max(0, min(max(a[1], b[1]), max(c[1], d[1]))
                                 - max(min(a[1], b[1]), min(c[1], d[1])))
                elif a[1] == b[1] == c[1] == d[1]:
                    total += max(0, min(max(a[0], b[0]), max(c[0], d[0]))
                                 - max(min(a[0], b[0]), min(c[0], d[0])))
        return total

    def anchor(style, prefix, box):
        """Điểm connector thật trên viền bảng; mặc định là tâm nếu không ép."""
        x, y, w, h = box
        found_x = re.search(rf'(?:^|;){prefix}X=([0-9.]+)', style)
        found_y = re.search(rf'(?:^|;){prefix}Y=([0-9.]+)', style)
        ratio_x = float(found_x.group(1)) if found_x else 0.5
        ratio_y = float(found_y.group(1)) if found_y else 0.5
        return x + w * ratio_x, y + h * ratio_y

    # Kiểm tra THEO TỪNG TRANG. Một mxfile nhiều trang thì mỗi trang có root
    # riêng với id=0/id=1, và bảng ở trang 3 không thể che dây ở trang 5. Gộp
    # chung các trang lại làm cả hai kiểm tra dưới đây báo sai hàng loạt.
    pages = 0
    total_cells = total_tables = total_edges = 0
    crossing, crossing_names = 0, []

    for model in tree.iter('mxGraphModel'):
        pages += 1
        page_w = float(model.get('pageWidth') or 0)
        page_h = float(model.get('pageHeight') or 0)
        cells = list(model.iter('mxCell'))
        total_cells += len(cells)

        label_of, boxes = {}, {}
        table_by_collection = {}
        for cell in cells:
            if cell.get('vertex') == '1' and 'shape=table;' in (cell.get('style') or ''):
                value = (cell.get('value') or '').replace('&#10;', '\n')
                label_of[cell.get('id')] = value.split('\n')[-1].strip() or cell.get('id')
                if cell.get('data-collection'):
                    table_by_collection[cell.get('data-collection')] = cell.get('id')

        ids = [cell.get('id') for cell in cells]
        duplicates = {i for i in ids if i and ids.count(i) > 1}
        if duplicates:
            problems.append(f'trang {pages}: ID trùng {sorted(duplicates)[:5]}')

        known = set(ids)
        for cell in cells:
            for attribute in ('source', 'target', 'parent'):
                reference = cell.get(attribute)
                if reference and reference not in known:
                    problems.append(f'trang {pages}: {cell.get("id")}.{attribute} trỏ tới ô không tồn tại')

        edges = [c for c in cells if c.get('edge') == '1']
        total_edges += len(edges)
        for edge in edges:
            if edge.find('mxGeometry') is None:
                problems.append(f'trang {pages}: cạnh {edge.get("id")} thiếu mxGeometry')

        for cell in cells:
            style = cell.get('style') or ''
            geometry = cell.find('mxGeometry')
            if geometry is None or cell.get('vertex') != '1' or 'shape=table;' not in style:
                continue
            total_tables += 1
            x = float(geometry.get('x') or 0)
            y = float(geometry.get('y') or 0)
            w = float(geometry.get('width') or 0)
            h = float(geometry.get('height') or 0)
            boxes[cell.get('id')] = (x, y, w, h)
            if page_w and (x < -200 or x + w > page_w + 200):
                problems.append(f'trang {pages}: bảng {label_of.get(cell.get("id"))} ra ngoài trang (ngang)')
            if page_h and (y < -200 or y + h > page_h + 200):
                problems.append(f'trang {pages}: bảng {label_of.get(cell.get("id"))} ra ngoài trang (dọc)')
            rows = [r for r in cells if r.get('parent') == cell.get('id')
                    and 'shape=tableRow' in (r.get('style') or '')]
            start_size = re.search(r'(?:^|;)startSize=([0-9.]+)', style)
            header_h = float(start_size.group(1)) if start_size else 0
            row_bottoms = []
            for row in rows:
                row_geometry = row.find('mxGeometry')
                if row_geometry is None:
                    continue
                row_y = float(row_geometry.get('y') or header_h)
                row_h = float(row_geometry.get('height') or 0)
                row_bottoms.append(row_y + row_h)
            expected = max([header_h] + row_bottoms)
            if rows and abs(h - expected) > 2:
                problems.append(f'trang {pages}: bảng {label_of.get(cell.get("id"))} cao {h:.0f} '
                                f'nhưng {len(rows)} dòng cần {expected:.0f} — chữ sẽ bị cắt')

        # Row của table là nguồn connector trong ERD kiểu PK/FK. Tính hộp tuyệt
        # đối để kiểm tra đúng điểm xuất phát thay vì bỏ qua toàn bộ quan hệ.
        connector_boxes = dict(boxes)
        parent_table_of = {table_id: table_id for table_id in boxes}
        for cell in cells:
            if 'shape=tableRow' not in (cell.get('style') or ''):
                continue
            parent_id = cell.get('parent')
            geometry = cell.find('mxGeometry')
            if parent_id not in boxes or geometry is None:
                continue
            px, py, pw, _ = boxes[parent_id]
            connector_boxes[cell.get('id')] = (
                px + float(geometry.get('x') or 0),
                py + float(geometry.get('y') or 0),
                float(geometry.get('width') or pw),
                float(geometry.get('height') or 0),
            )
            parent_table_of[cell.get('id')] = parent_id

        explicit_paths = []
        edge_pairs = {}
        for edge in edges:
            source, target = edge.get('source'), edge.get('target')
            if source not in connector_boxes or target not in connector_boxes:
                continue
            logical_source = edge.get('data-source-table')
            logical_target = edge.get('data-target-table')
            logical_field = edge.get('data-source-field')
            source_table_id = table_by_collection.get(logical_source, parent_table_of.get(source, source))
            target_table_id = table_by_collection.get(logical_target, parent_table_of.get(target, target))
            pair = (logical_source or source_table_id, logical_field or source,
                    logical_target or target_table_id)
            if pair in edge_pairs:
                problems.append(f'trang {pages}: quan hệ trùng '
                                f'{label_of.get(source_table_id, logical_source)} -> '
                                f'{label_of.get(target_table_id, logical_target)}')
            edge_pairs[pair] = edge.get('id')
            style = edge.get('style') or ''
            path = [anchor(style, 'exit', connector_boxes[source])]
            geometry = edge.find('mxGeometry')
            has_waypoints = False
            if geometry is not None:
                for array in geometry.findall('Array'):
                    if array.get('as') == 'points':
                        has_waypoints = True
                        for point in array.findall('mxPoint'):
                            path.append((float(point.get('x') or 0), float(point.get('y') or 0)))
            path.append(anchor(style, 'entry', connector_boxes[target]))
            hit = None
            for start, end in zip(path, path[1:]):
                for other_id, box in boxes.items():
                    if other_id in (source_table_id, target_table_id):
                        continue
                    if crosses(start[0], start[1], end[0], end[1], box):
                        hit = other_id
                        break
                if hit:
                    break
            if hit:
                crossing += 1
                crossing_names.append(f'trang {pages}: {label_of.get(source_table_id, logical_source)} -> '
                                      f'{label_of.get(target_table_id, logical_target)} qua '
                                      f'{label_of.get(hit)}')
            if has_waypoints:
                explicit_paths.append((edge, path))

        overlaps = []
        for index, (first_edge, first_path) in enumerate(explicit_paths):
            for second_edge, second_path in explicit_paths[index + 1:]:
                length = shared_length(first_path, second_path)
                if length > 12:
                    first = (f'{first_edge.get("data-source-table") or label_of.get(first_edge.get("source"))}'
                             f'.{first_edge.get("data-source-field") or "?"} -> '
                             f'{first_edge.get("data-target-table") or label_of.get(first_edge.get("target"))}')
                    second = (f'{second_edge.get("data-source-table") or label_of.get(second_edge.get("source"))}'
                              f'.{second_edge.get("data-source-field") or "?"} -> '
                              f'{second_edge.get("data-target-table") or label_of.get(second_edge.get("target"))}')
                    overlaps.append(f'trang {pages}: {first} chồng {second} ({length:.0f}px)')
        if overlaps:
            problems.append(f'trang {pages}: {len(overlaps)} cặp connector chồng đoạn: '
                            + '; '.join(overlaps[:3]))

    if crossing:
        problems.append(f'{crossing}/{total_edges} quan hệ đi xuyên qua bảng khác: '
                        + '; '.join(crossing_names[:4]))

    return problems, notes + [f'{pages} trang, {total_cells} ô, {total_tables} bảng, {total_edges} quan hệ']


def main():
    targets = [Path(a) for a in sys.argv[1:]]
    if not targets:
        targets = sorted(Path('docs/architecture/erd').glob('*.drawio'))
    if not targets:
        print('Không có file .drawio nào để kiểm tra.')
        return 1
    failed = 0
    for path in targets:
        problems, notes = check(path)
        status = 'ĐẠT' if not problems else 'LỖI'
        print(f'[{status}] {path}')
        for note in notes:
            print(f'      {note}')
        for problem in problems:
            print(f'      ✗ {problem}')
        failed += bool(problems)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
