#!/usr/bin/env python3
"""Sinh sáu sơ đồ cụm cho mục 4.6 bằng cách CẮT TỪ ERD chuẩn.

Bảy sơ đồ cũ (docs/erd-defense/diagrams/ERD-0*.png) được vẽ tay theo bản kiểm
kê collection vật lý, nên chúng đưa vào mười sáu tên không thuộc mô hình 19
bảng của Chương 4 — trong đó có `tryon_history`, một collection đã bị xoá khỏi
dự án. Giữ chúng lại thì Hình 4.2 nói 19 bảng còn Hình 4.3–4.9 vẽ 35 bảng.

Cách chắc chắn duy nhất để hai chỗ không lệch nhau là đừng vẽ lại: đọc thẳng
JAPANO_ERD.drawio, lấy đúng các bảng của từng cụm cùng các bảng mà chúng tham
chiếu tới, rồi xếp lại vị trí. Ô bảng, tên tiếng Việt, danh sách trường, dấu
PK/FK và kiểu đường quan hệ đều là bản gốc, nên sáu sơ đồ con không thể chứa
thứ mà sơ đồ tổng không có.
"""
import copy
import re
import xml.etree.ElementTree as ET

SRC = '/home/nhat/Downloads/japano/JAPANO_ERD.drawio'
OUT = '/home/nhat/Downloads/japano/docs/report/assets/diagrams'

# Sáu cụm — khớp đúng mục 4.3.1 và 4.4.1 của báo cáo.
CLUSTERS = [
    ('C1', 'tai-khoan-ca-nhan-hoa',
     ['users', 'profiles', 'addresses', 'interactions']),
    ('C2', 'danh-muc-san-pham',
     ['categories', 'products', 'product_variants', 'product_media']),
    ('C3', 'y-dinh-mua-sam',
     ['cart_items', 'wishlist_items']),
    ('C4', 'don-hang-thanh-toan',
     ['orders', 'order_items', 'payments', 'return_requests']),
    ('C5', 'khuyen-mai-noi-dung',
     ['vouchers', 'reviews', 'notifications']),
    ('C6', 'trai-nghiem-nhat-ban',
     ['japan_spots', 'chats']),
]

GAP_X, GAP_Y, COL_W = 320, 55, 270
STUB_W, STUB_H = 210, 54
# Bảng cụm khác chỉ vẽ tên, không trải trường: cụm tài khoản nối tới bảy bảng
# ngoài, vẽ đầy đủ trường cho cả bảy thì hình rộng gấp đôi khổ giấy và không
# ai đọc được. Chi tiết của chúng nằm ở sơ đồ cụm của chính chúng.
STUB_STYLE = ('rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#F2F2F2;'
              'strokeColor=#888888;fontColor=#404040;fontSize=12;align=center;'
              'verticalAlign=middle;dashed=1;')


def load():
    tree = ET.parse(SRC)
    dia = list(tree.getroot().iter('diagram'))[0]
    root = dia.find('.//root')
    cells = list(root)
    by_id = {c.get('id'): c for c in cells}
    tables = {c.get('data-collection'): c for c in cells if c.get('data-collection')}
    kids = {}
    for c in cells:
        kids.setdefault(c.get('parent'), []).append(c)
    edges = [c for c in cells if c.get('edge') == '1' and c.get('data-source-table')]
    return by_id, tables, kids, edges


def descendants(cell, kids):
    out = []
    for child in kids.get(cell.get('id'), []):
        out.append(child)
        out.extend(descendants(child, kids))
    return out


def height_of(cell):
    geo = cell.find('mxGeometry')
    return float(geo.get('height', 198))


def build(code, slug, members, by_id, tables, kids, edges):
    inside = {tables[n].get('id'): n for n in members}
    outside = []
    for e in edges:
        a, b = e.get('data-source-table'), e.get('data-target-table')
        for near, far in ((a, b), (b, a)):
            if near in members and far not in members and far not in outside:
                outside.append(far)

    model = ET.Element('mxGraphModel', {
        'dx': '1400', 'dy': '900', 'grid': '0', 'gridSize': '10', 'guides': '1',
        'tooltips': '1', 'connect': '1', 'arrows': '1', 'fold': '1', 'page': '1',
        'pageScale': '1', 'pageWidth': '1400', 'pageHeight': '1000', 'math': '0',
        'shadow': '0',
    })
    root = ET.SubElement(model, 'root')
    ET.SubElement(root, 'mxCell', {'id': '0'})
    ET.SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})

    stub_id = {}
    heights = [
        sum(height_of(tables[n]) for n in members) + GAP_Y * max(len(members) - 1, 0),
        len(outside) * STUB_H + GAP_Y * max(len(outside) - 1, 0),
    ]
    tallest = max(heights)

    y = 40 + (tallest - heights[0]) / 2
    for name in members:
        table = copy.deepcopy(tables[name])
        geo = table.find('mxGeometry')
        geo.set('x', '40')
        geo.set('y', str(y))
        root.append(table)
        for kid in descendants(tables[name], kids):
            root.append(copy.deepcopy(kid))
        y += height_of(table) + GAP_Y

    y = 40 + (tallest - heights[1]) / 2
    for name in outside:
        source = tables[name]
        label = f"<b>{source.get('value')}</b><br/><small>{name}</small>"
        node = ET.SubElement(root, 'mxCell', {
            'id': f'{code}-{name}', 'data-collection': name, 'value': label,
            'style': STUB_STYLE, 'vertex': '1', 'parent': '1'})
        ET.SubElement(node, 'mxGeometry', {
            'x': str(40 + COL_W + GAP_X), 'y': str(y),
            'width': str(STUB_W), 'height': str(STUB_H), 'as': 'geometry'})
        stub_id[name] = f'{code}-{name}'
        y += STUB_H + GAP_Y

    # Cạnh trong ERD chuẩn nối vào HÀNG trường chứ không vào ô bảng, nên phải
    # leo cây cha để biết cạnh thuộc bảng nào. So id ô bảng trực tiếp thì không
    # cạnh nào khớp và sơ đồ ra rỗng quan hệ.
    def owner(cell_id):
        depth = 0
        while cell_id and cell_id not in inside and depth < 6:
            cell = by_id.get(cell_id)
            cell_id = cell.get('parent') if cell is not None else None
            depth += 1
        return inside.get(cell_id)

    # draw.io khi xuất ảnh KHÔNG chạy lại bộ định tuyến: bỏ trống neo thì nó
    # kéo dây vòng ra ngoài khung rồi cắt ngang cả sơ đồ. Vì bố cục ở đây là hai
    # cột cố định nên gán thẳng neo và một làn dọc riêng cho từng cạnh: cạnh
    # trong cụm đi vòng bên trái, cạnh ra bảng ngoài đi qua khoảng giữa.
    left_lane, mid_lane, count = 0, 0, 0
    for e in edges:
        a, b = e.get('data-source-table'), e.get('data-target-table')
        if a not in members and b not in members:
            continue
        edge = copy.deepcopy(e)
        style = re.sub(r'(exit|entry)(X|Y|Dx|Dy)=[-0-9.]+;', '', edge.get('style') or '')
        geo = edge.find('mxGeometry')
        points = ET.SubElement(geo, 'Array', {'as': 'points'})

        if a in members and b in members:
            for end, name in (('source', a), ('target', b)):
                edge.set(end, owner(e.get(end)) and e.get(end) or tables[name].get('id'))
            left_lane += 1
            lane = 10 - 34 * left_lane
            style += 'exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;'
            ET.SubElement(points, 'mxPoint', {'x': str(lane), 'y': '0'})
        else:
            near, far = (a, b) if a in members else (b, a)
            edge.set('source' if a in members else 'target',
                     owner(e.get('source' if a in members else 'target'))
                     and e.get('source' if a in members else 'target')
                     or tables[near].get('id'))
            edge.set('target' if a in members else 'source', stub_id[far])
            mid_lane += 1
            lane = 40 + COL_W + 22 * mid_lane
            if a in members:
                style += 'exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;'
            else:
                style += 'exitX=0;exitY=0.5;exitDx=0;exitDy=0;entryX=1;entryY=0.5;entryDx=0;entryDy=0;'
            ET.SubElement(points, 'mxPoint', {'x': str(lane), 'y': '0'})

        edge.set('style', style)
        root.append(edge)
        count += 1

    legend = ('<b>Chú giải</b><br/>Ô đầy đủ trường: bảng thuộc cụm này<br/>'
              'Ô xám nét đứt: bảng của cụm khác, chỉ ghi tên để thấy điểm nối')
    node = ET.SubElement(root, 'mxCell', {
        'id': f'{code}-legend', 'value': legend,
        'style': ('rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#888888;'
                  'align=left;verticalAlign=middle;spacingLeft=10;fontSize=11;dashed=1;'),
        'vertex': '1', 'parent': '1'})
    ET.SubElement(node, 'mxGeometry', {
        'x': str(10 - 34 * left_lane), 'y': str(int(tallest + 110)),
        'width': '440', 'height': '70', 'as': 'geometry'})

    mxfile = ET.Element('mxfile', {'host': 'japano', 'type': 'device'})
    dia = ET.SubElement(mxfile, 'diagram', {'name': slug, 'id': f'japano-{slug}'})
    dia.append(model)
    path = f'{OUT}/{code}-erd-{slug}.drawio'
    ET.ElementTree(mxfile).write(path, encoding='utf-8', xml_declaration=True)
    return path, members, outside, count


def main():
    by_id, tables, kids, edges = load()
    assert len(tables) == 19, f'ERD chuẩn phải có 19 bảng, đang có {len(tables)}'
    covered = sorted(n for _, _, m in CLUSTERS for n in m)
    assert covered == sorted(tables), 'sáu cụm phải phủ đúng 19 bảng, không thừa không thiếu'
    for code, slug, members in CLUSTERS:
        path, inside, outside, count = build(code, slug, members, by_id, tables, kids, edges)
        print(f'{code} · {slug}: {len(inside)} bảng trong cụm + {len(outside)} tham chiếu, '
              f'{count} quan hệ → {path.split("/")[-1]}')


if __name__ == '__main__':
    main()
