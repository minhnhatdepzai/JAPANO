#!/usr/bin/env python3
"""Sinh JAPANO_ERD_MongoDB.drawio — ERD VẬT LÝ, đủ collection Atlas.

Đây là file canonical cho sơ đồ vật lý. Không tạo thêm bản trùng chức năng.

Khác với ERD CORE: file này KHÔNG chọn lọc. Mọi collection có trên Atlas đều phải
xuất hiện đúng một lần, và script dừng nếu thiếu hoặc thừa. Chia 7 trang theo
domain để mỗi trang đọc được, thay vì nhồi toàn bộ bảng vào một trang.

Mỗi collection còn được gắn lớp lưu trữ. Nhãn này không làm collection biến mất
khỏi Atlas; nó chỉ ngăn người đọc hiểu nhầm cache/kết quả suy ra là dữ liệu cần
giữ vĩnh viễn. ERD vật lý luôn phản ánh sự thật đang chạy, còn quyết định gộp/xoá
phải đi qua migration có backup riêng.

    python3 scripts/atlas_audit.js --out docs/database/atlas-snapshot.json
    python3 scripts/build_erd_physical.py
"""
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from erd_i18n_vi import assert_complete, collection_label, field_label

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'docs/database/atlas-snapshot.json'
OUT = ROOT / 'JAPANO_ERD_MongoDB.drawio'

PAGES = [
    ('1. Tổng quan', '#37474F', []),
    ('2. Danh tính & hồ sơ', '#1E3A5F', ['users', 'addresses', 'profiles', 'push_tokens', 'goals']),
    ('3. Danh mục & hình ảnh', '#1B5E20', ['categories', 'products', 'product_details', 'product_variants',
                                       'product_media', 'ai_descriptions', 'banners']),
    ('4. Giỏ hàng & đơn hàng', '#4A148C', ['cart_items', 'wishlist_items', 'orders', 'order_items']),
    ('5. Thanh toán & hoàn trả', '#B71C1C', ['payments', 'return_requests', 'vouchers', 'voucher_redemptions',
                                        'discount_rules', 'vip_memberships', 'flagcards', 'flagcard_collections']),
    ('6. Đánh giá & cộng đồng', '#006064', ['reviews', 'review_reactions', 'moderation_samples',
                                          'japan_spot_reviews', 'japan_spot_suggestions']),
    ('7. AI, hành vi & vận hành', '#E65100', ['interactions', 'search_logs', 'chats',
                                              'notifications', 'settings']),
]

MEDIA_NOTE = {'product_media', 'banners', 'reviews', 'japan_spot_reviews'}
# Collection chứa thông tin xác thực hoặc PII — sơ đồ vật lý PHẢI ghi rõ chúng
# không bao giờ rời máy chủ, để không ai đọc sơ đồ rồi tưởng đây là dữ liệu
# được API trả về.
CREDENTIAL_NOTE = {'users', 'profiles', 'addresses', 'push_tokens', 'chats'}
ROW_H = 24
HEADER_H = 48
WIDTH = 300
COLS = 4
GAP_X = 360
GAP_Y = 80
MAX_FIELDS = 11
TABLE_TOP = 230
NOTE_H = 150

# Phân loại vòng đời, không phải tên domain. Các collection không nằm trong
# danh sách đặc biệt là dữ liệu nghiệp vụ đang cần persist độc lập.
STORAGE_CLASS = {
    'product_details': 'GỘP VÀO SẢN PHẨM',
    'ai_descriptions': 'BỘ NHỚ ĐỆM — KHÔNG LƯU DÀI HẠN',
    'banners': 'GỘP VÀO CẤU HÌNH',
    'discount_rules': 'GỘP VÀO CẤU HÌNH',
    'vip_memberships': 'DỮ LIỆU SUY RA — KHÔNG LƯU',
    'cart_items': 'GIỚI HẠN THỜI GIAN LƯU',
    'notifications': 'GIỚI HẠN THỜI GIAN LƯU',
    'push_tokens': 'GIỚI HẠN THỜI GIAN LƯU',
    'chats': 'GIỚI HẠN THỜI GIAN LƯU',
    'search_logs': 'GIỚI HẠN THỜI GIAN LƯU',
    'interactions': 'GIỚI HẠN THỜI GIAN LƯU',
}

# Năm collection này vẫn phải xuất hiện khi còn trên Atlas, nhưng generator
# cũng phải dựng được ERD 29 collection sau migration đã kiểm chứng. Chỉ đúng
# năm tên này được phép biến mất; thiếu bất kỳ collection nào khác vẫn là lỗi.
LEAN_REMOVED = {
    'product_details', 'ai_descriptions', 'banners', 'discount_rules',
    'vip_memberships',
}


def storage_class(name):
    return STORAGE_CLASS.get(name, 'NGHIỆP VỤ')


def load():
    if not SNAPSHOT.exists():
        sys.exit(f'Thiếu {SNAPSHOT}. Chạy: node scripts/atlas_audit.js --out {SNAPSHOT}')
    return json.loads(SNAPSHOT.read_text(encoding='utf-8'))


def marks_for(collection, field, ref_fields, refs, name):
    single, composite, indexed, sparse = set(), set(), set(), set()
    for index in collection['indexes']:
        keys = list(index['key'].keys())
        if index['unique']:
            (single if len(keys) == 1 else composite).update(keys)
            if index['sparse'] and len(keys) == 1:
                sparse.update(keys)
        indexed.update(keys)
    marks = []
    if field == '_id':
        marks.append('🔑')
    elif field in single:
        marks.append('🔒*' if field in sparse else '🔒')
    elif field in composite:
        marks.append('🔒ᶜ')
    elif field in indexed:
        marks.append('⬚')
    if (name, field) in ref_fields:
        reference = refs.get((name, field))
        marks.append('🔗?' if reference and reference['observedOptionality'] == 'optional' else '🔗')
    return marks


def build():
    snapshot = load()
    assert_complete(snapshot)
    by_name = {c['name']: c for c in snapshot['collections']}
    refs = {(r['from'], r['field']): r for r in snapshot['references']}
    ref_fields = set(refs)

    assigned = [name for _, _, names in PAGES for name in names]
    live = set(by_name)
    missing = live - set(assigned)
    extra = set(assigned) - live - LEAN_REMOVED
    if missing:
        sys.exit(f'THIẾU trên sơ đồ (có trên Atlas): {sorted(missing)}')
    if extra:
        sys.exit(f'THỪA trên sơ đồ (không có trên Atlas): {sorted(extra)}')
    duplicates = [n for n in assigned if assigned.count(n) > 1]
    if duplicates:
        sys.exit(f'Collection xuất hiện nhiều lần: {sorted(set(duplicates))}')
    pages = [(title, colour, [name for name in names if name in live])
             for title, colour, names in PAGES]

    diagrams = []
    uid = [1000]

    def nid():
        uid[0] += 1
        return f'p{uid[0]}'

    for page_index, (title, colour, names) in enumerate(pages):
        cells = []
        if not names:
            lines = [f'JAPANO — ERD VẬT LÝ MONGODB',
                     f'Atlas «{snapshot["database"]}» · bản chụp {snapshot["snapshotAt"][:10]}',
                     f'{snapshot["collectionCount"]} bộ sưu tập · {snapshot["documentTotal"]} bản ghi',
                     f'{snapshot["uniqueIndexCount"]} chỉ mục duy nhất · chỉ mục TTL {snapshot["ttlIndexCount"]} '
                     f'· bộ kiểm tra cấu trúc {snapshot["validatorCount"]}',
                     '',
                     'Mọi bộ sưu tập dưới đây là [THỰC TẾ] — đọc trực tiếp từ Atlas.',
                     'Ảnh và video nằm ở Cloudinary; MongoDB chỉ lưu đường dẫn và dữ liệu mô tả.',
                     'MongoDB KHÔNG ràng buộc khóa ngoại ở máy chủ: 🔗 là tham chiếu tầng ứng dụng.']
            cells.append(
                f'<mxCell id="{nid()}" value="{"&#10;".join(escape(l) for l in lines)}" '
                f'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ECEFF1;strokeColor=#37474F;align=left;'
                f'spacingLeft=20;verticalAlign=top;spacingTop=18;fontSize=15;" vertex="1" parent="1">'
                f'<mxGeometry x="60" y="60" width="820" height="260" as="geometry"/></mxCell>')
            y = 360
            class_counts = {}
            for name in by_name:
                label = storage_class(name)
                class_counts[label] = class_counts.get(label, 0) + 1
            class_summary = ' · '.join(f'{label}: {count}' for label, count in class_counts.items())
            cells.append(
                f'<mxCell id="{nid()}" value="{escape(class_summary)}" '
                f'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF8E1;strokeColor=#F9A825;align=left;'
                f'spacingLeft=16;verticalAlign=middle;fontSize=11;" vertex="1" parent="1">'
                f'<mxGeometry x="60" y="335" width="820" height="52" as="geometry"/></mxCell>')
            y = 410
            for other_title, other_colour, other_names in pages[1:]:
                docs = sum(by_name[n]['count'] for n in other_names)
                value = escape(f'{other_title} — {len(other_names)} bộ sưu tập, {docs} bản ghi')
                cells.append(
                    f'<mxCell id="{nid()}" value="{value}&#10;'
                    f'{escape(", ".join(collection_label(name) for name in other_names))}" '
                    f'style="rounded=1;whiteSpace=wrap;html=1;fillColor={other_colour};strokeColor={other_colour};'
                    f'fontColor=#FFFFFF;align=left;spacingLeft=16;verticalAlign=middle;fontSize=12;" '
                    f'vertex="1" parent="1">'
                    f'<mxGeometry x="60" y="{y}" width="820" height="72" as="geometry"/></mxCell>')
                y += 86
            page_w, page_h = 960, y + 60
        else:
            ids = {}
            for order, name in enumerate(names):
                collection = by_name[name]
                fields = [f['field'] for f in collection['fields'][:MAX_FIELDS]]
                if '_id' not in fields:
                    fields.insert(0, '_id')
                hidden = len(collection['fields']) - len(fields)
                column, row = order % COLS, order // COLS
                x, y = 60 + column * GAP_X, TABLE_TOP + row * (GAP_Y + HEADER_H + ROW_H * (MAX_FIELDS + 2))
                height = HEADER_H + ROW_H * (len(fields) + (1 if hidden > 0 else 0))
                table_id = nid()
                ids[name] = table_id
                head = escape(f'{collection_label(name)} · {collection["count"]} bản ghi · {storage_class(name)}')
                cells.append(
                    f'<mxCell id="{table_id}" data-collection="{name}" value="{head}" '
                    f'style="shape=table;startSize={HEADER_H};container=1;collapsible=0;childLayout=tableLayout;'
                    f'fillColor={colour};strokeColor={colour};fontColor=#FFFFFF;fontSize=12;fontStyle=1;'
                    f'align=center;verticalAlign=middle;whiteSpace=wrap;html=1;" vertex="1" parent="1">'
                    f'<mxGeometry x="{x}" y="{y}" width="{WIDTH}" height="{height}" as="geometry"/></mxCell>')
                rows = list(fields) + ([f'… còn {hidden} trường'] if hidden > 0 else [])
                for index, field in enumerate(rows):
                    text = field
                    if not field.startswith('…'):
                        marks = marks_for(collection, field, ref_fields, refs, name)
                        text = f'{field_label(field)} {" ".join(marks)}'.strip()
                    row_id = nid()
                    cells.append(
                        f'<mxCell id="{row_id}" value="" style="shape=tableRow;horizontal=0;startSize=0;'
                        f'swimlaneHead=0;swimlaneBody=0;fillColor=none;collapsible=0;dropTarget=0;'
                        f'points=[[0,0.5],[1,0.5]];portConstraint=eastwest;strokeColor=#CFD8DC;'
                        f'top=0;left=0;right=0;bottom=0;" vertex="1" parent="{table_id}">'
                        f'<mxGeometry y="{HEADER_H + index * ROW_H}" width="{WIDTH}" height="{ROW_H}" as="geometry"/></mxCell>')
                    style_extra = 'fontStyle=2;fontColor=#78909C;' if field.startswith('…') else 'fontColor=#212121;'
                    cells.append(
                        f'<mxCell id="{nid()}" data-field="{field if not field.startswith("…") else ""}" '
                        f'value="{escape(text)}" style="shape=partialRectangle;'
                        f'overflow=hidden;connectable=0;fillColor=#FFFFFF;strokeColor=none;align=left;'
                        f'spacingLeft=10;fontSize=11;{style_extra}whiteSpace=wrap;html=1;" '
                        f'vertex="1" parent="{row_id}">'
                        f'<mxGeometry width="{WIDTH}" height="{ROW_H}" as="geometry"/></mxCell>')

            # Hộp bao để luồn dây. Lưới 4 cột khiến bảng đứng cạnh nhau chắn
            # ngay đường nối của hai bảng cùng hàng; đo được 4/15 cạnh bị vậy.
            rects = {}
            for order, name in enumerate(names):
                collection = by_name[name]
                fields = [f['field'] for f in collection['fields'][:MAX_FIELDS]]
                if '_id' not in fields:
                    fields.insert(0, '_id')
                hidden = len(collection['fields']) - len(fields)
                column, row = order % COLS, order // COLS
                x = 60 + column * GAP_X
                y = TABLE_TOP + row * (GAP_Y + HEADER_H + ROW_H * (MAX_FIELDS + 2))
                h = HEADER_H + ROW_H * (len(fields) + (1 if hidden > 0 else 0))
                rects[name] = (x, y, WIDTH, h)

            def hits(path, skip):
                total = 0
                for other, (bx, by, bw, bh) in rects.items():
                    if other in skip:
                        continue
                    for start, end in zip(path, path[1:]):
                        clipped = False
                        for step in range(1, 60):
                            t = step / 60
                            px = start[0] + (end[0] - start[0]) * t
                            py = start[1] + (end[1] - start[1]) * t
                            if bx - 8 <= px <= bx + bw + 8 and by - 8 <= py <= by + bh + 8:
                                clipped = True
                                break
                        if clipped:
                            total += 1
                            break
                return total

            def shared_length(first, second):
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

            drawn = 0
            used_paths = []
            detour_target_uses = {}
            for (source, field), reference in refs.items():
                target = reference['to']
                if source not in ids or target not in ids:
                    continue
                sx, sy, sw, sh = rects[source]
                tx, ty, tw, th = rects[target]
                a = (sx + sw / 2, sy + sh / 2)
                b = (tx + tw / 2, ty + th / 2)
                lane_top = min(y for _, y, _, _ in rects.values()) - 35
                lane_bottom = max(y + h for _, y, _, h in rects.values()) + 50
                lanes = (lane_top, lane_top - 20, lane_bottom, lane_bottom + 30)

                def score(path, priority):
                    overlap = sum(shared_length(path, used) for used in used_paths)
                    return hits(path, {source, target}), overlap, priority

                options = [(*score([a, b], 0), [a, b], None, None)]
                target_slot = detour_target_uses.get(target, 0)
                entry_ratio = (0.35, 0.65, 0.2, 0.8, 0.5)[target_slot % 5]
                for order_index, lane in enumerate(lanes, start=1):
                    top_route = lane < min(y for _, y, _, _ in rects.values())
                    exit_side = (0.5, 0) if top_route else (0.5, 1)
                    entry_side = (entry_ratio, 0) if top_route else (entry_ratio, 1)
                    target_anchor = (tx + tw * entry_ratio, ty if top_route else ty + th)
                    detour = [a, (a[0], lane), (target_anchor[0], lane), target_anchor]
                    options.append((*score(detour, order_index), detour, exit_side, entry_side))
                _, _, _, path, exit_side, entry_side = min(options, key=lambda item: item[:3])
                used_paths.append(path)
                anchors = ''
                if exit_side:
                    detour_target_uses[target] = target_slot + 1
                    anchors = (f'exitX={exit_side[0]};exitY={exit_side[1]};exitDx=0;exitDy=0;'
                               f'entryX={entry_side[0]};entryY={entry_side[1]};entryDx=0;entryDy=0;')
                if len(path) > 2:
                    points = ''.join(f'<mxPoint x="{int(px)}" y="{int(py)}"/>' for px, py in path[1:-1])
                    geometry = ('<mxGeometry relative="1" as="geometry">'
                                f'<Array as="points">{points}</Array></mxGeometry>')
                else:
                    geometry = '<mxGeometry relative="1" as="geometry"/>'
                cells.append(
                    f'<mxCell id="{nid()}" value="{escape(field_label(field))}" '
                    f'style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;{anchors}endArrow=ERone;'
                    f'startArrow=ERmany;endFill=0;startFill=0;strokeColor=#546E7A;strokeWidth=1.4;'
                    f'fontSize=10;fontColor=#455A64;labelBackgroundColor=#FFFFFF;'
                    f'jumpStyle=arc;jumpSize=8;" edge="1" parent="1" '
                    f'source="{ids[source]}" target="{ids[target]}">{geometry}</mxCell>')
                drawn += 1

            external = sorted({f'{collection_label(s)}.{field_label(f)} → {collection_label(r["to"])}'
                               for (s, f), r in refs.items()
                               if s in ids and r['to'] not in ids})
            note_lines = [f'{title}', f'{len(names)} bộ sưu tập · {drawn} quan hệ trong trang']
            special = [f'{collection_label(name)}: {storage_class(name)}' for name in names
                       if storage_class(name) != 'NGHIỆP VỤ']
            if special:
                note_lines.append('')
                note_lines.append('Vòng đời / hướng tối giản: ' + '; '.join(special))
            if external:
                note_lines.append('')
                note_lines.append('Tham chiếu sang trang khác: ' + '; '.join(external[:10]))
            if any(n in MEDIA_NOTE for n in names):
                note_lines.append('')
                note_lines.append('Ảnh và video lưu ở Cloudinary — MongoDB chỉ giữ đường dẫn và dữ liệu mô tả.')
            if any(n in CREDENTIAL_NOTE for n in names):
                note_lines.append('')
                note_lines.append('CHÚ Ý BẢO MẬT: mật khẩu băm, mã đặt lại và mã Google là dữ liệu xác thực.')
                note_lines.append('Các trường này bị lọc khỏi mọi phản hồi API và KHÔNG rời máy chủ.')
                note_lines.append('Hồ sơ chứa số đo cơ thể; địa chỉ và tin nhắn chứa dữ liệu cá nhân.')
            cells.append(
                f'<mxCell id="{nid()}" value="{"&#10;".join(escape(l) for l in note_lines)}" '
                f'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF8E1;strokeColor=#F9A825;align=left;'
                f'spacingLeft=12;verticalAlign=top;spacingTop=10;fontSize=11;" vertex="1" parent="1">'
                f'<mxGeometry x="60" y="20" width="{COLS * GAP_X - 60}" height="{NOTE_H}" as="geometry"/></mxCell>')
            rows_used = (len(names) + COLS - 1) // COLS
            page_w = 60 + COLS * GAP_X
            page_h = 200 + rows_used * (GAP_Y + HEADER_H + ROW_H * (MAX_FIELDS + 2))

        diagrams.append(
            f'<diagram name="{escape(title)}" id="japano-physical-{page_index}">'
            f'<mxGraphModel dx="1400" dy="900" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" '
            f'arrows="1" fold="1" page="1" pageScale="1" pageWidth="{int(page_w)}" pageHeight="{int(page_h)}" '
            f'math="0" shadow="0" adaptiveColors="auto"><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
            + ''.join(cells) + '</root></mxGraphModel></diagram>')

    OUT.write_text(f'<mxfile host="japano" type="device">{"".join(diagrams)}</mxfile>', encoding='utf-8')
    print(f'-> {OUT}')
    print(f'   {len(PAGES)} trang, {snapshot["collectionCount"]}/{snapshot["collectionCount"]} collection Atlas')


if __name__ == '__main__':
    sys.exit('Chạy scripts/build_erd.py để sinh duy nhất JAPANO_ERD.drawio.')
