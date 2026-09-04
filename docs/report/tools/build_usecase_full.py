#!/usr/bin/env python3
"""Hai sơ đồ use case tổng thể cho báo cáo tốt nghiệp — bản có «include».

Bản ảnh đang nằm trong báo cáo chỉ vẽ đường liền từ tác nhân tới từng use case,
không có quan hệ nào giữa các use case với nhau. Một sơ đồ use case UML thiếu
«include»/«extend» thì mất đúng phần thông tin mà nó sinh ra để kể: bước nào là
BẮT BUỘC của luồng chính, bước nào chỉ chạy KHI thoả điều kiện.

Quy ước UML dùng ở đây:
  A --«include»--> B : chạy A thì LUÔN chạy B (mũi tên hướng từ A sang B).
  B --«extend»--> A  : B là nhánh mở rộng, chỉ chạy khi thoả điều kiện của A.

Giữ nguyên bố cục hai cột và bảng chú giải màu theo nhóm chức năng của bản cũ,
chỉ thêm quan hệ giữa các use case.
"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from drawio_kit import Page, write  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / 'diagrams'
PNG = Path(__file__).resolve().parents[1] / 'assets' / 'diagrams'

# Màu theo nhóm chức năng — giống bản đang có trong báo cáo.
GROUPS = {
    'account':  ('#EEF2FB', '#5B6B82', 'Tài khoản'),
    'shop':     ('#E9F5EC', '#5F7A63', 'Mua sắm'),
    'order':    ('#FBF1E3', '#A98544', 'Đơn hàng'),
    'ai':       ('#FBECEF', '#A33A2F', 'Trí tuệ nhân tạo'),
    'exp':      ('#EFECFA', '#6A5FA0', 'Trải nghiệm'),
    'access':   ('#EEF2FB', '#5B6B82', 'Truy cập'),
    'product':  ('#E9F5EC', '#5F7A63', 'Sản phẩm'),
    'sell':     ('#FBF1E3', '#A98544', 'Bán hàng'),
    'customer': ('#FBECEF', '#A33A2F', 'Khách hàng'),
    'content':  ('#EFECFA', '#6A5FA0', 'Nội dung'),
}


VERT_UP = ('edgeStyle=none;html=1;dashed=1;endArrow=open;strokeColor=#6B7255;fontSize=10;'
           'exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=1;entryDx=0;entryDy=0;'
           'labelBackgroundColor=#FFFFFF;')
VERT_DOWN = ('edgeStyle=none;html=1;dashed=1;endArrow=open;strokeColor=#6B7255;fontSize=10;'
             'exitX=0.5;exitY=1;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;'
             'labelBackgroundColor=#FFFFFF;')
SIDE = ('edgeStyle=none;html=1;dashed=1;endArrow=open;strokeColor=#6B7255;fontSize=10;'
        'exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;'
        'labelBackgroundColor=#FFFFFF;')


def uc_style(group):
    fill, stroke, _ = GROUPS[group]
    return (f'ellipse;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};'
            'fontSize=11;spacing=2;')


def legend(page, x, y, keys):
    """Bảng chú giải màu nằm dưới khung hệ thống."""
    page.node('Nhóm chức năng:', x, y, 110, 22,
              'text;html=1;align=right;verticalAlign=middle;fontSize=10;fontColor=#5B6B82;')
    cursor = x + 118
    for key in keys:
        fill, stroke, label = GROUPS[key]
        page.node('', cursor, y + 5, 12, 12,
                  f'rounded=0;html=1;fillColor={fill};strokeColor={stroke};')
        width = 7 * len(label) + 12
        page.node(label, cursor + 15, y, width, 22,
                  'text;html=1;align=left;verticalAlign=middle;fontSize=10;fontColor=#3A4453;')
        cursor += 15 + width + 14


def customer_diagram():
    """Bố cục xếp theo QUAN HỆ: mọi «include»/«extend» chỉ nối các ô cạnh nhau.

    Bản trước vẽ đúng quan hệ nhưng đường đi xuyên qua các ô khác và nhãn đè lên
    chữ bên trong — sơ đồ đúng mà không đọc được thì vẫn là sơ đồ hỏng.
    """
    ROW = 104
    p = Page('Use case — Ứng dụng người dùng', 1340, 1440)
    p.node('HỆ THỐNG JAPANO STORE — ỨNG DỤNG NGƯỜI DÙNG', 250, 40, 1030, 1245, 'sysbox')
    actor = p.node('Người dùng', 90, 620, 60, 90, 'actor')

    L, R, W, H = 320, 760, 230, 62
    left = lambda i: (L, 95 + i * ROW)
    right = lambda i: (R, 95 + i * ROW)

    reg    = p.node('Đăng ký tài khoản',              *left(0),  W, H, uc_style('account'))
    login  = p.node('Đăng nhập / Đăng nhập Google',   *left(1),  W, H, uc_style('account'))
    forgot = p.node('Quên mật khẩu —\nđặt lại qua email', *left(2), W, H, uc_style('account'))
    prof   = p.node('Cập nhật hồ sơ cá nhân',         *left(3),  W, H, uc_style('account'))
    home   = p.node('Xem trang chủ và\ngợi ý cá nhân hoá', *left(4), W, H, uc_style('shop'))
    cat    = p.node('Duyệt danh mục sản phẩm',        *left(5),  W, H, uc_style('shop'))
    search = p.node('Tìm kiếm và lọc sản phẩm',       *left(6),  W, H, uc_style('shop'))
    detail = p.node('Xem chi tiết, màu sắc, kích cỡ', *left(7),  W, H, uc_style('shop'))
    wish   = p.node('Quản lý danh sách yêu thích',    *left(8),  W, H, uc_style('shop'))
    # "Đặt hàng" nằm GIỮA giỏ hàng và địa chỉ để cả hai đường «include» đều nối
    # hai ô sát nhau. Nhảy cách một hàng là đường đi xuyên qua ô ở giữa và nhãn
    # rơi vào lòng ô đó — sơ đồ đúng quan hệ nhưng không đọc được.
    cart   = p.node('Quản lý giỏ hàng',               *left(9),  W, H, uc_style('shop'))
    order  = p.node('Đặt hàng và chọn địa chỉ giao',  *left(10), W, H, uc_style('order'))
    addr   = p.node('Quản lý địa chỉ nhận hàng',      *left(11), W, H, uc_style('account'))

    chat   = p.node('Trò chuyện với trợ lý JAPANO',   *right(0),  W, H, uc_style('ai'))
    vsearch= p.node('Tìm kiếm sản phẩm\nbằng hình ảnh', *right(1), W, H, uc_style('ai'))
    tryon  = p.node('Thử đồ ảo bằng ảnh cá nhân',     *right(2),  W, H, uc_style('ai'))
    advise = p.node('Nhận tư vấn kích cỡ và phối đồ', *right(3),  W, H, uc_style('ai'))
    goal   = p.node('Lập mục tiêu tiết kiệm',         *right(4),  W, H, uc_style('exp'))
    flag   = p.node('Sưu tầm thẻ địa danh Nhật Bản',  *right(5),  W, H, uc_style('exp'))
    explore= p.node('Khám phá điểm đến và văn hoá',   *right(6),  W, H, uc_style('exp'))
    # "Theo dõi đơn" đứng giữa hai nhánh «extend» của nó; "Thanh toán" đặt ngang
    # hàng với "Đặt hàng" để đường «include» đi ngang, không cắt qua cột.
    review = p.node('Đánh giá sản phẩm đã mua',       *right(7),  W, H, uc_style('order'))
    track  = p.node('Theo dõi và xác nhận đơn hàng',  *right(8),  W, H, uc_style('order'))
    ret    = p.node('Gửi yêu cầu huỷ đơn\nhoặc trả hàng', *right(9), W, H, uc_style('order'))
    pay    = p.node('Thanh toán COD / Stripe / VNPay', *right(10), W, H, uc_style('order'))
    notify = p.node('Nhận thông báo trong ứng dụng',  *right(11), W, H, uc_style('exp'))

    # Tác nhân chỉ nối tới use case KHỞI ĐẦU. "Thanh toán" và "Nhận tư vấn kích
    # cỡ" không nối thẳng vào tác nhân vì chúng luôn được kích hoạt bên trong
    # một luồng khác — đó chính là ý nghĩa của «include».
    for uc in (reg, login, forgot, prof, home, cat, search, detail, wish, cart,
               addr, order, chat, vsearch, tryon, goal, flag, explore, notify,
               track, ret, review):
        p.edge(actor, uc, '', 'plain')

    p.edge(forgot, login,  '«extend»',  VERT_UP)
    p.edge(home,   cat,    '«include»', VERT_DOWN)
    p.edge(search, cat,    '«extend»',  VERT_UP)
    p.edge(detail, search, '«extend»',  VERT_UP)
    p.edge(order,  cart,   '«include»', VERT_UP)
    p.edge(order,  addr,   '«include»', VERT_DOWN)
    p.edge(order,  pay,    '«include»', SIDE)
    p.edge(tryon,  advise, '«include»', VERT_DOWN)
    p.edge(ret,    track,  '«extend»',  VERT_UP)
    p.edge(review, track,  '«extend»',  VERT_DOWN)

    legend(p, 250, 1305, ['account', 'shop', 'order', 'ai', 'exp'])
    p.node('«include» — bước BẮT BUỘC: đặt hàng thì luôn đi qua giỏ hàng, địa chỉ và thanh toán.\n'
           '«extend» — nhánh CÓ ĐIỀU KIỆN: "Đánh giá sản phẩm" chỉ mở khi đơn đã hoàn tất\n'
           '(verified purchase — quy tắc nằm ở backend/routes/reviews.js).',
           250, 1340, 700, 72, 'note')
    write(OUT / 'D21-uc-ung-dung-nguoi-dung.drawio', p)


def admin_diagram():
    ROW = 104
    p = Page('Use case — Web quản trị', 1340, 1440)
    p.node('HỆ THỐNG JAPANO STORE — WEB QUẢN TRỊ', 250, 40, 1030, 1245, 'sysbox')
    actor = p.node('Quản trị viên', 90, 620, 60, 90, 'actor')

    L, R, W, H = 320, 760, 230, 62
    left = lambda i: (L, 95 + i * ROW)
    right = lambda i: (R, 95 + i * ROW)

    login = p.node('Đăng nhập và đăng xuất quản trị', *left(0),  W, H, uc_style('access'))
    dash  = p.node('Xem bảng điều khiển tổng quan',   *left(1),  W, H, uc_style('access'))
    prod  = p.node('Quản lý sản phẩm',                *left(2),  W, H, uc_style('product'))
    pcat  = p.node('Quản lý danh mục sản phẩm',       *left(3),  W, H, uc_style('product'))
    var   = p.node('Quản lý biến thể, màu sắc, cỡ',   *left(4),  W, H, uc_style('product'))
    media = p.node('Quản lý hình ảnh và video',       *left(5),  W, H, uc_style('product'))
    stock = p.node('Quản lý tồn kho và cảnh báo',     *left(6),  W, H, uc_style('product'))
    order = p.node('Quản lý đơn hàng',                *left(7),  W, H, uc_style('sell'))
    pay   = p.node('Theo dõi giao dịch thanh toán',   *left(8),  W, H, uc_style('sell'))
    ret   = p.node('Xử lý yêu cầu trả hàng\nvà hoàn tiền', *left(9), W, H, uc_style('sell'))
    users = p.node('Quản lý người dùng',              *left(10), W, H, uc_style('customer'))
    role  = p.node('Phân quyền tài khoản',            *left(11), W, H, uc_style('customer'))

    vip   = p.node('Theo dõi thành viên VIP',         *right(0),  W, H, uc_style('customer'))
    vouch = p.node('Quản lý phiếu giảm giá',          *right(1),  W, H, uc_style('content'))
    grant = p.node('Cấp phiếu giảm giá cho khách',    *right(2),  W, H, uc_style('customer'))
    modrv = p.node('Kiểm duyệt đánh giá sản phẩm',    *right(3),  W, H, uc_style('content'))
    modai = p.node('Quản lý kiểm duyệt bằng AI',      *right(4),  W, H, uc_style('content'))
    notify= p.node('Gửi thông báo tới người dùng',    *right(5),  W, H, uc_style('content'))
    flag  = p.node('Quản lý thẻ địa danh',            *right(6),  W, H, uc_style('content'))
    japan = p.node('Duyệt nội dung khám phá Nhật Bản', *right(7), W, H, uc_style('content'))
    banner= p.node('Quản lý ảnh quảng bá',            *right(8),  W, H, uc_style('content'))
    cfg   = p.node('Cấu hình cửa hàng',               *right(9),  W, H, uc_style('content'))

    for uc in (login, dash, prod, stock, order, pay, ret, users, role,
               vip, vouch, grant, modrv, notify, flag, japan, banner, cfg):
        p.edge(actor, uc, '', 'plain')

    p.edge(prod,  pcat,  '«include»', VERT_DOWN)
    p.edge(pcat,  var,   '«include»', VERT_DOWN)
    p.edge(var,   media, '«include»', VERT_DOWN)
    p.edge(order, stock, '«include»', VERT_UP)
    p.edge(ret,   pay,   '«include»', VERT_UP)
    p.edge(role,  users, '«include»', VERT_UP)
    p.edge(grant, vouch, '«include»', VERT_UP)
    p.edge(modrv, modai, '«include»', VERT_DOWN)
    p.edge(vip,   vouch, '«extend»',  VERT_DOWN)
    p.edge(japan, flag,  '«extend»',  VERT_UP)

    legend(p, 250, 1305, ['access', 'product', 'sell', 'customer', 'content'])
    p.node('«include» — bước BẮT BUỘC: sửa sản phẩm luôn đi qua danh mục, biến thể và ảnh;\n'
           'duyệt hoàn tiền luôn đi qua đối soát giao dịch; phân quyền luôn thao tác trên\n'
           'một tài khoản. «extend» — nhánh CÓ ĐIỀU KIỆN, chỉ chạy khi thoả điều kiện.',
           250, 1340, 700, 72, 'note')
    write(OUT / 'D22-uc-web-quan-tri.drawio', p)


def render(name):
    src, dst = OUT / f'{name}.drawio', PNG / f'{name}.png'
    try:
        subprocess.run(['drawio', '-x', '-f', 'png', '--scale', '2', '-o', str(dst), str(src)],
                       check=True, capture_output=True, timeout=180)
        return dst.exists()
    except Exception as error:                       # noqa: BLE001
        print(f'  không render được {name}: {error}')
        return False


if __name__ == '__main__':
    customer_diagram()
    admin_diagram()
    print('đã ghi 2 tệp .drawio')
    for name in ('D21-uc-ung-dung-nguoi-dung', 'D22-uc-web-quan-tri'):
        print(f'  render {name}: {"OK" if render(name) else "THẤT BẠI"}')
