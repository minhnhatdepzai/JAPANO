#!/usr/bin/env python3
"""Sinh một ERD tổng quát, một trang, dành cho báo cáo ứng dụng JAPANO.

Phong cách cố ý bám mẫu ERD học thuật: bảng trắng viền đen, tên bảng căn giữa,
cột PK/FK riêng bên trái, tên trường căn trái và connector đi từ đúng hàng FK.
Đây là logical/application ERD chọn lọc, không phải bản kiểm kê toàn bộ Atlas.
"""
import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

from erd_i18n_vi import assert_complete, collection_label, field_label

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'docs/database/atlas-snapshot.json'
OUT = ROOT / 'docs/architecture/erd/JAPANO_ERD_CORE.drawio'

# Chỉ giữ thực thể trực tiếp tham gia các luồng nhìn thấy trong app: tài khoản,
# catalog, mua hàng, thanh toán, đánh giá và chatbot. Không đưa log, cấu hình,
# token thiết bị, moderation hay bảng vận hành vào ERD báo cáo.
ENTITIES = {
    'notifications': ['id', 'userId', 'title', 'body', 'type', 'at'],
    'chats': ['id', 'userId', 'role', 'message', 'intent', 'createdAt'],
    'addresses': ['id', 'userId', 'name', 'phone', 'street', 'ward', 'province', 'isDefault'],
    'profiles': ['id', 'userId', 'preferredStyles', 'heightCm', 'weightKg', 'gender', 'usualSize'],
    'users': ['id', 'name', 'email', 'passwordHash', 'role', 'status', 'joinedAt'],
    'interactions': ['id', 'userId', 'productId', 'type', 'value', 'createdAt', 'source'],
    'categories': ['id', 'name', 'kanji'],
    'products': ['id', 'categoryId', 'name', 'brand', 'price', 'status', 'garmentType'],
    'product_variants': ['id', 'productId', 'colorName', 'size', 'sku', 'stock', 'price'],
    'product_media': ['id', 'productId', 'url', 'type', 'isPrimary'],
    'cart_items': ['id', 'userId', 'productId', 'color', 'size', 'quantity'],
    'wishlist_items': ['id', 'userId', 'productId', 'createdAt'],
    'reviews': ['id', 'productId', 'userId', 'orderId', 'rating', 'comment', 'status'],
    'orders': ['id', 'userId', 'voucherId', 'code', 'total', 'status', 'createdAt'],
    'order_items': ['id', 'orderId', 'productId', 'productName', 'colorName', 'size', 'qty', 'price'],
    'payments': ['id', 'orderId', 'provider', 'method', 'amount', 'status', 'createdAt'],
    'vouchers': ['id', 'code', 'type', 'value', 'min', 'expiry', 'active'],
    'return_requests': ['id', 'orderId', 'paymentId', 'kind', 'reason', 'amount', 'status'],
    'japan_spots': ['id', 'productId', 'place', 'prefecture', 'region', 'photoUrl', 'bestTime', 'sourceUrl', 'active'],
}

RELATIONS = [
    ('notifications', 'userId', 'users'),
    ('chats', 'userId', 'users'),
    ('addresses', 'userId', 'users'),
    ('profiles', 'userId', 'users'),
    ('interactions', 'userId', 'users'),
    ('interactions', 'productId', 'products'),
    ('products', 'categoryId', 'categories'),
    ('product_variants', 'productId', 'products'),
    ('product_media', 'productId', 'products'),
    ('cart_items', 'userId', 'users'),
    ('cart_items', 'productId', 'products'),
    ('wishlist_items', 'userId', 'users'),
    ('wishlist_items', 'productId', 'products'),
    ('orders', 'userId', 'users'),
    ('orders', 'voucherId', 'vouchers'),
    ('order_items', 'orderId', 'orders'),
    ('order_items', 'productId', 'products'),
    ('payments', 'orderId', 'orders'),
    ('return_requests', 'orderId', 'orders'),
    ('return_requests', 'paymentId', 'payments'),
    ('reviews', 'productId', 'products'),
    ('reviews', 'userId', 'users'),
    ('reviews', 'orderId', 'orders'),
    ('japan_spots', 'productId', 'products'),
]

# Quan hệ logic có trong mô hình ứng dụng nhưng snapshot không đưa vào danh sách
# tham chiếu tự suy luận (thông báo phát toàn hệ thống có thể không có userId).
# Vẫn chỉ chấp nhận khi trường nguồn và bảng đích đều tồn tại trong Atlas.
LOGICAL_RELATIONS = {('notifications', 'userId', 'users')}

ID_LABELS = {
    'notifications': 'Mã thông báo', 'chats': 'Mã tin nhắn',
    'addresses': 'Mã địa chỉ', 'profiles': 'Mã hồ sơ',
    'users': 'Mã người dùng', 'interactions': 'Mã hành vi',
    'categories': 'Mã danh mục',
    'products': 'Mã sản phẩm', 'product_variants': 'Mã biến thể',
    'product_media': 'Mã hình ảnh', 'cart_items': 'Mã chi tiết giỏ hàng',
    'wishlist_items': 'Mã yêu thích', 'reviews': 'Mã đánh giá',
    'orders': 'Mã đơn hàng', 'order_items': 'Mã chi tiết đơn hàng',
    'payments': 'Mã thanh toán', 'vouchers': 'Mã phiếu giảm giá',
    'return_requests': 'Mã yêu cầu trả hàng',
    'japan_spots': 'Mã địa điểm',
}

# Bố cục một trang, sắp theo luồng trái → phải và trên → dưới.
POS = {
    'notifications': (40, 100), 'chats': (40, 390),
    'addresses': (40, 690), 'profiles': (40, 980),
    'users': (350, 580),
    'interactions': (660, 250),
    'categories': (950, 100), 'products': (950, 350),
    'product_variants': (1330, 180), 'product_media': (1330, 600),
    'cart_items': (660, 560), 'wishlist_items': (660, 850),
    'reviews': (1330, 850),
    'orders': (350, 1100), 'order_items': (660, 1100),
    'payments': (350, 1450), 'vouchers': (40, 1450),
    'return_requests': (660, 1450),
    'japan_spots': (1330, 1180),
}

# Cổng riêng trên bảng đích; một bảng hub không còn gom mọi dây vào giữa cạnh.
TARGET_PORTS = {
    ('notifications', 'userId', 'users'): (0, 0.10),
    ('chats', 'userId', 'users'): (0, 0.25),
    ('addresses', 'userId', 'users'): (0, 0.45),
    ('profiles', 'userId', 'users'): (0, 0.65),
    ('interactions', 'userId', 'users'): (1, 0.10),
    ('interactions', 'productId', 'products'): (0, 0.10),
    ('cart_items', 'userId', 'users'): (1, 0.25),
    ('wishlist_items', 'userId', 'users'): (1, 0.40),
    ('orders', 'userId', 'users'): (0, 0.85),
    ('reviews', 'userId', 'users'): (1, 0.70),
    ('products', 'categoryId', 'categories'): (1, 0.50),
    ('product_variants', 'productId', 'products'): (1, 0.10),
    ('product_media', 'productId', 'products'): (1, 0.35),
    ('cart_items', 'productId', 'products'): (0, 0.30),
    ('wishlist_items', 'productId', 'products'): (0, 0.50),
    ('order_items', 'productId', 'products'): (0, 0.75),
    ('reviews', 'productId', 'products'): (1, 0.75),
    ('orders', 'voucherId', 'vouchers'): (1, 0.50),
    ('order_items', 'orderId', 'orders'): (1, 0.20),
    ('payments', 'orderId', 'orders'): (1, 0.40),
    ('return_requests', 'orderId', 'orders'): (1, 0.60),
    ('return_requests', 'paymentId', 'payments'): (1, 0.50),
    ('reviews', 'orderId', 'orders'): (1, 0.80),
    ('japan_spots', 'productId', 'products'): (1, 0.92),
}

# Một số quan hệ dài được dẫn qua hành lang trống; các quan hệ ngắn để Draw.io
# nối vuông góc tự nhiên như mẫu người dùng cung cấp.
ROUTES = {
    ('profiles', 'userId', 'users'): [(320, 1056.5), (320, 633.55)],
    ('orders', 'userId', 'users'): [(330, 1176.5), (330, 638.95)],
    ('orders', 'voucherId', 'vouchers'): [(330, 1203.5), (330, 1420), (310, 1506.25)],
    ('order_items', 'productId', 'products'): [(940, 1203.5), (940, 406.25)],
    ('payments', 'orderId', 'orders'): [(630, 1526.5), (630, 1146.8)],
    ('return_requests', 'orderId', 'orders'): [(650, 1526.5), (650, 1152.2)],
    ('reviews', 'userId', 'users'): [(1300, 953.5), (1300, 1040), (640, 1040), (640, 634.9)],
    ('reviews', 'orderId', 'orders'): [(1270, 980.5), (1270, 1060), (620, 1060)],
    ('reviews', 'productId', 'products'): [(1240, 926.5), (1240, 406.25)],
    ('japan_spots', 'productId', 'products'): [(1315, 1256.5), (1315, 428.2)],
}

SOURCE_PORTS = {
    ('orders', 'userId', 'users'): (0, 0.5),
    ('orders', 'voucherId', 'vouchers'): (0, 0.5),
    ('payments', 'orderId', 'orders'): (1, 0.5),
    ('return_requests', 'orderId', 'orders'): (0, 0.5),
}

ROW_H = 27
HEADER_H = 36
WIDTH = 270
KEY_W = 46
PAGE_W = 1700
PAGE_H = 1750


def load_snapshot():
    if not SNAPSHOT.exists():
        sys.exit(f'Thiếu {SNAPSHOT}. Chạy atlas_audit.js trước.')
    return json.loads(SNAPSHOT.read_text(encoding='utf-8'))


def build():
    snapshot = load_snapshot()
    assert_complete(snapshot)
    by_name = {item['name']: item for item in snapshot['collections']}
    references = {(item['from'], item['field']): item for item in snapshot['references']}

    missing_entities = sorted(set(ENTITIES) - set(by_name))
    stale_fields = {
        name: sorted(set(fields) - {item['field'] for item in by_name[name]['fields']})
        for name, fields in ENTITIES.items()
        if set(fields) - {item['field'] for item in by_name[name]['fields']}
    }
    if missing_entities or stale_fields:
        sys.exit(f'ERD app lệch Atlas: bảng={missing_entities}, field={stale_fields}')
    for source, field, target in RELATIONS:
        reference = references.get((source, field))
        if reference is None and (source, field, target) in LOGICAL_RELATIONS:
            continue
        if reference is None or reference['to'] != target:
            sys.exit(f'Quan hệ không có bằng chứng Atlas: {source}.{field} → {target}')

    uid = [100]

    def nid():
        uid[0] += 1
        return f'a{uid[0]}'

    fk_fields = {}
    for source, field, _ in RELATIONS:
        fk_fields.setdefault(source, [])
        if field not in fk_fields[source]:
            fk_fields[source].append(field)

    cells = []
    table_ids = {}
    row_ids = {}
    row_centres = {}

    for name, fields in ENTITIES.items():
        x, y = POS[name]
        height = HEADER_H + ROW_H * len(fields)
        table_id = nid()
        table_ids[name] = table_id
        cells.append(
            f'<mxCell id="{table_id}" data-collection="{name}" '
            f'value="{escape(collection_label(name))}" '
            f'style="shape=table;startSize={HEADER_H};container=1;collapsible=0;childLayout=tableLayout;'
            f'fillColor=#FFFFFF;strokeColor=#222222;strokeWidth=1.2;fontColor=#202020;fontSize=13;'
            f'fontStyle=1;align=center;verticalAlign=middle;whiteSpace=wrap;html=1;" '
            f'vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{WIDTH}" '
            f'height="{height}" as="geometry"/></mxCell>')

        for index, field in enumerate(fields):
            row_id = nid()
            row_ids[(name, field)] = row_id
            row_centres[(name, field)] = (x, y + HEADER_H + index * ROW_H + ROW_H / 2)
            marker = ''
            if field == 'id':
                marker = 'PK'
            elif field in fk_fields.get(name, []):
                order = fk_fields[name].index(field) + 1
                marker = 'FK' if len(fk_fields[name]) == 1 else f'FK{order}'
            label = ID_LABELS[name] if field == 'id' else field_label(field)
            cells.append(
                f'<mxCell id="{row_id}" data-table="{name}" data-field="{field}" value="" '
                f'style="shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;'
                f'fillColor=#FFFFFF;collapsible=0;dropTarget=0;points=[[0,0.5],[1,0.5]];'
                f'portConstraint=eastwest;strokeColor=#222222;strokeWidth=1.2;top=0;left=0;right=0;bottom=0;" '
                f'vertex="1" parent="{table_id}"><mxGeometry y="{HEADER_H + index * ROW_H}" '
                f'width="{WIDTH}" height="{ROW_H}" as="geometry"/></mxCell>')
            cells.append(
                f'<mxCell id="{nid()}" value="{marker}" style="shape=partialRectangle;overflow=hidden;'
                f'connectable=0;fillColor=#FFFFFF;strokeColor=#222222;strokeWidth=1.2;top=0;left=0;bottom=0;right=1;'
                f'align=center;verticalAlign=middle;fontSize=11;fontStyle={1 if marker else 0};html=1;" '
                f'vertex="1" parent="{row_id}"><mxGeometry width="{KEY_W}" height="{ROW_H}" '
                f'as="geometry"/></mxCell>')
            cells.append(
                f'<mxCell id="{nid()}" value="{escape(label)}" style="shape=partialRectangle;'
                f'overflow=hidden;connectable=0;fillColor=#FFFFFF;strokeColor=none;align=left;'
                f'verticalAlign=middle;spacingLeft=8;fontSize=11;fontStyle={5 if field == "id" else 0};'
                f'html=1;" vertex="1" parent="{row_id}"><mxGeometry x="{KEY_W}" '
                f'width="{WIDTH - KEY_W}" height="{ROW_H}" as="geometry"/></mxCell>')

    def source_side(source, field, target):
        sx, sy = row_centres[(source, field)]
        sx += WIDTH / 2
        tx, ty = POS[target]
        target_center = (tx + WIDTH / 2, ty + (HEADER_H + ROW_H * len(ENTITIES[target])) / 2)
        if target_center[0] >= sx:
            return 1, 0.5
        return 0, 0.5

    for source, field, target in RELATIONS:
        edge_id = nid()
        exit_x, exit_y = SOURCE_PORTS.get(
            (source, field, target), source_side(source, field, target))
        entry_x, entry_y = TARGET_PORTS[(source, field, target)]
        points = ROUTES.get((source, field, target), [])
        if points:
            point_xml = ''.join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in points)
            geometry = (f'<mxGeometry relative="1" as="geometry"><Array as="points">'
                        f'{point_xml}</Array></mxGeometry>')
        else:
            geometry = '<mxGeometry relative="1" as="geometry"/>'
        reference = references.get((source, field))
        optional = reference is None or reference['observedOptionality'] == 'optional'
        cells.append(
            f'<mxCell id="{edge_id}" data-source-table="{source}" data-source-field="{field}" '
            f'data-target-table="{target}" value="" '
            f'style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;exitX={exit_x};exitY={exit_y};'
            f'exitDx=0;exitDy=0;entryX={entry_x};entryY={entry_y};entryDx=0;entryDy=0;'
            f'endArrow=ERone;startArrow={"ERzeroToMany" if optional else "ERmany"};'
            f'endFill=0;startFill=0;strokeColor=#222222;strokeWidth=1.2;jumpStyle=arc;jumpSize=8;" '
            f'edge="1" parent="1" source="{row_ids[(source, field)]}" '
            f'target="{row_ids[(target, "id")]}">{geometry}</mxCell>')

    title = [
        'ERD TỔNG QUÁT ỨNG DỤNG JAPANO',
        'Tài khoản · Hành vi & gợi ý · Sản phẩm · Giỏ hàng · Đơn hàng · Thanh toán · Đánh giá · Trợ lý AI',
        f'{len(ENTITIES)} bảng nghiệp vụ chọn lọc từ {snapshot["collectionCount"]} bộ sưu tập Atlas · {snapshot["snapshotAt"][:10]}',
    ]
    cells.append(
        f'<mxCell id="{nid()}" value="{"&#10;".join(escape(line) for line in title)}" '
        f'style="text;html=1;align=left;verticalAlign=middle;fontSize=15;fontStyle=1;'
        f'fontColor=#202020;" vertex="1" parent="1"><mxGeometry x="40" y="20" '
        f'width="850" height="70" as="geometry"/></mxCell>')
    legend = [
        'PK: Khóa định danh logic (MongoDB dùng _id vật lý)',
        'FK/FK1/FK2: Khóa tham chiếu tầng ứng dụng',
        'Đầu 1: một bản ghi · đầu chân quạ: nhiều bản ghi',
    ]
    cells.append(
        f'<mxCell id="{nid()}" value="{"&#10;".join(escape(line) for line in legend)}" '
        f'style="rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#222222;strokeWidth=1.2;'
        f'align=left;spacingLeft=10;verticalAlign=middle;fontSize=11;" vertex="1" parent="1">'
        f'<mxGeometry x="1120" y="30" width="530" height="70" as="geometry"/></mxCell>')

    xml = (
        '<mxfile host="japano" type="device"><diagram name="ERD tổng quát ứng dụng" '
        'id="japano-app-erd"><mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" '
        'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
        f'pageWidth="{PAGE_W}" pageHeight="{PAGE_H}" math="0" shadow="0" adaptiveColors="auto">'
        '<root><mxCell id="0"/><mxCell id="1" parent="0"/>' + ''.join(cells) +
        '</root></mxGraphModel></diagram></mxfile>'
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(xml, encoding='utf-8')
    print(f'-> {OUT}')
    print(f'   1 trang · {len(ENTITIES)} bảng app · {len(RELATIONS)} quan hệ')


if __name__ == '__main__':
    sys.exit('Chạy scripts/build_erd.py để sinh duy nhất JAPANO_ERD.drawio.')
