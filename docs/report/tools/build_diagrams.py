#!/usr/bin/env python3
"""Sinh toàn bộ sơ đồ .drawio cho báo cáo tốt nghiệp JAPANO.

Nội dung mỗi sơ đồ được lấy từ mã nguồn hiện hành (backend/routes, backend/lib,
web/, mobile/, admin/) và từ ảnh chụp runtime ngày 2026-08-31, không phải từ báo
cáo cũ. Chạy lại: python3 docs/report/tools/build_diagrams.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from drawio_kit import Page, write, sequence  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / 'diagrams'
OUT.mkdir(parents=True, exist_ok=True)


def d01_architecture():
    p = Page('Kiến trúc tổng thể', 1500, 1000)
    p.node('Thiết bị người dùng', 40, 30, 1420, 150, 'sysbox')
    mob = p.node('Ứng dụng di động\nExpo SDK 51 · React Native 0.74\nAndroid, gói vn.japano.app', 80, 70, 320, 90, 'box')
    web = p.node('Website storefront\nReact 19 · App Router (vinext)\nTypeScript strict', 460, 70, 320, 90, 'box')
    adm = p.node('Web Admin\nHTML/CSS/JavaScript thuần\nkhông có bước build', 840, 70, 320, 90, 'box')

    p.node('Máy chủ ứng dụng (một tiến trình Node)', 40, 220, 1420, 210, 'sysbox')
    bff = p.node('BFF same-origin của website\nweb/app/api/[...path] · /media\nJWT → cookie HttpOnly, kiểm tra Origin', 460, 260, 320, 80, 'boxblue')
    api = p.node('REST API — Express 4 trên Node 20\nbackend/server.js · 19 tệp route · 138 endpoint\nGiá, tồn kho, voucher, tổng tiền luôn tính lại phía server', 200, 360, 900, 60, 'boxred')

    p.node('Dịch vụ AI cục bộ — tiến trình riêng, chỉ chiếm GPU khi được gọi', 40, 470, 900, 250, 'sysbox')
    body = p.node('Phân tích cơ thể :7863\nYOLOv8n-pose + U2Net + hồi quy\nCPU, model thường trú', 80, 515, 260, 80, 'boxgrey')
    fashn = p.node('Thử đồ :7862\nFASHN VTON 1.5 + FLUX.2 Klein 4B\nGPU ~15 GB', 370, 515, 260, 80, 'boxred')
    motion = p.node('Motion\nWan2.1-T2V-1.3B + One-to-All\nGPU ~13,5 GB, CUDA-only', 660, 515, 250, 80, 'boxred')
    ollama = p.node('Ollama (tuỳ chọn)\nqwen2.5:7b · qwen3-vl:8b', 80, 620, 260, 62, 'boxgrey')
    arb = p.node('GPU arbiter\nmột model giữ VRAM tại một thời điểm;\nhàng chờ ưu tiên theo màn hình đang mở', 370, 620, 540, 62, 'boxblue')

    p.node('Dịch vụ ngoài', 980, 470, 480, 250, 'sysbox')
    db = p.node('MongoDB Atlas\ncơ sở dữ liệu runtime\nnguồn dữ liệu chính', 1010, 515, 200, 80, 'store')
    cdn = p.node('Cloudinary\nảnh/video sản phẩm', 1240, 515, 190, 80, 'box')
    pay = p.node('Stripe Test Mode\nVNPay Sandbox', 1010, 620, 200, 62, 'box')
    net = p.node('Tailscale\ntruy cập tailnet :4101', 1240, 620, 190, 62, 'box')

    for src in (mob,):
        p.edge(src, api, 'HTTPS/JSON · JWT trong SecureStore')
    p.edge(web, bff, 'chỉ same-origin /api và /media')
    p.edge(bff, api, 'chuyển tiếp có kiểm soát')
    p.edge(adm, api, 'JWT + phân quyền vai trò')
    for svc in (body, fashn, motion, ollama):
        p.edge(api, svc, '', 'dash')
    p.edge(fashn, arb, '', 'plain')
    p.edge(motion, arb, '', 'plain')
    p.edge(api, db, 'driver mongodb chính thức')
    p.edge(api, cdn, 'chỉ URL/metadata')
    p.edge(api, pay, 'chế độ thử nghiệm')
    p.edge(api, net, '', 'dash')
    p.node('Ghi chú: ba bề mặt client dùng CHUNG một catalog, một tài khoản,\n'
           'một kho đơn hàng và một cụm AI. Không có bản sao dữ liệu riêng cho\n'
           'từng client. Ảnh và video không nằm trong MongoDB — chỉ URL.',
           980, 740, 480, 90, 'note')
    write(OUT / 'D01-kien-truc-tong-the.drawio', p)


def d02_deployment():
    p = Page('Sơ đồ triển khai', 1400, 900)
    p.node('Máy trạm phát triển — Linux, RTX 5060 Ti 16 GB, driver 595.84', 40, 30, 900, 560, 'sysbox')
    p.node('systemd user services', 70, 80, 840, 300, 'sysbox')
    p.node('japano-backend.service\nnode backend/server.js — cổng 4100\nphục vụ cả /admin/', 100, 130, 380, 80, 'boxred')
    p.node('japano-body-analysis.service\npython3 body_analysis_service.py — 7863', 100, 230, 380, 70, 'boxgrey')
    p.node('japano-fashn.service\npython fashn_service.py — 7862', 510, 130, 370, 80, 'boxred')
    p.node('japano-metro-runtime.service\nMetro bundler — 8081', 510, 230, 370, 70, 'boxgrey')
    p.node('japano-storefront-runtime.service\nnpm --prefix web run dev — 4200', 100, 315, 780, 50, 'boxblue')
    p.node('Ollama — 11434 (tuỳ chọn)', 70, 400, 400, 45, 'boxgrey')
    p.node('Tailscale Serve — 100.69.188.16:4101\nrd-system.tail6502ce.ts.net', 500, 400, 410, 45, 'boxblue')
    p.node('Trạng thái đo lúc 2026-08-31T11:57+07:00 bằng ss -ltnp và\n'
           'systemctl --user list-units. Motion service không chạy tại thời điểm\n'
           'chụp; nó chỉ được bật khi có yêu cầu tạo video.', 70, 465, 840, 100, 'note')

    p.node('Thiết bị và mạng ngoài', 980, 30, 380, 560, 'sysbox')
    p.node('Điện thoại Android\nRedmi Note 8 Pro / OPPO A78\nAPK 1.0.19 · versionCode 20', 1010, 80, 320, 90, 'box')
    p.node('adb reverse tcp:4100\nkhi cắm USB', 1010, 190, 320, 55, 'boxgrey')
    p.node('Tailnet — khi dùng không dây', 1010, 260, 320, 45, 'boxgrey')
    p.node('MongoDB Atlas (cloud)', 1010, 330, 320, 60, 'store')
    p.node('Cloudinary (cloud)', 1010, 405, 320, 50, 'box')
    p.node('Cloudflare Workers\nCHƯA deploy công khai:\nchỉ build và wrangler deploy --dry-run', 1010, 470, 320, 90, 'note')
    write(OUT / 'D02-trien-khai.drawio', p)


def d03_uc_overview():
    p = Page('Use Case tổng quát', 1500, 1000)
    p.node('Hệ thống JAPANO', 330, 40, 840, 900, 'sysbox')
    guest = p.node('Khách chưa\nđăng nhập', 90, 120, 60, 90, 'actor')
    cust = p.node('Khách hàng', 90, 300, 60, 90, 'actor')
    staff = p.node('Nhân viên\n(staff)', 90, 500, 60, 90, 'actor')
    admin = p.node('Quản trị viên\n(admin)', 90, 680, 60, 90, 'actor')
    sadmin = p.node('Super Admin', 90, 850, 60, 90, 'actor')
    gw = p.node('Cổng thanh toán\nStripe / VNPay', 1300, 300, 60, 90, 'actor')
    media = p.node('Cloudinary', 1300, 470, 60, 90, 'actor')
    ai = p.node('Dịch vụ AI\ncục bộ', 1300, 640, 60, 90, 'actor')
    db = p.node('MongoDB Atlas', 1300, 810, 60, 90, 'actor')

    u1 = p.node('Duyệt và tìm\nsản phẩm', 400, 110, 170, 70, 'usecase')
    u2 = p.node('Quản lý tài khoản\nvà địa chỉ', 640, 110, 170, 70, 'usecase')
    u3 = p.node('Giỏ hàng và\nvoucher', 880, 110, 170, 70, 'usecase')
    u4 = p.node('Đặt hàng và\nthanh toán', 400, 230, 170, 70, 'usecase')
    u5 = p.node('Theo dõi đơn,\ntrả hàng, hoàn tiền', 640, 230, 170, 70, 'usecase')
    u6 = p.node('Đánh giá đã\nmua xác thực', 880, 230, 170, 70, 'usecase')
    u7 = p.node('Thử đồ ảo\ntrên ảnh thật', 400, 350, 170, 70, 'ucai')
    u8 = p.node('Ước lượng số đo\nvà gợi ý size', 640, 350, 170, 70, 'ucai')
    u9 = p.node('Tạo video\nchuyển động', 880, 350, 170, 70, 'ucai')
    u10 = p.node('Trò chuyện với\ntrợ lý Ori', 400, 470, 170, 70, 'ucai')
    u11 = p.node('Khám phá Nhật Bản,\n"Đưa tôi đến đây"', 640, 470, 170, 70, 'ucai')
    u12 = p.node('Gợi ý sản phẩm\ncá nhân hoá', 880, 470, 170, 70, 'ucai')
    u13 = p.node('Mục tiêu tiết kiệm\nvà loyalty/VIP', 400, 590, 170, 70, 'usecase')
    u14 = p.node('Quản lý đơn hàng\nvà kho', 640, 590, 170, 70, 'usecase')
    u15 = p.node('Quản lý sản phẩm\nvà biến thể', 880, 590, 170, 70, 'usecase')
    u16 = p.node('Kiểm duyệt đánh giá\nvà nội dung cộng đồng', 400, 710, 170, 70, 'usecase')
    u17 = p.node('Xem dashboard,\nphân tích, dự báo', 640, 710, 170, 70, 'usecase')
    u18 = p.node('Đối soát thanh toán,\nhoàn tiền', 880, 710, 170, 70, 'usecase')
    u19 = p.node('Quản lý người dùng\nvà phân quyền', 520, 830, 170, 70, 'usecase')
    u20 = p.node('Theo dõi sức khoẻ\ndịch vụ và model', 760, 830, 170, 70, 'usecase')

    for u in (u1, u3):
        p.edge(guest, u, '', 'plain')
    for u in (u1, u2, u3, u4, u5, u6, u7, u8, u9, u10, u11, u12, u13):
        p.edge(cust, u, '', 'plain')
    for u in (u14, u16, u17):
        p.edge(staff, u, '', 'plain')
    for u in (u14, u15, u16, u17, u18, u20):
        p.edge(admin, u, '', 'plain')
    for u in (u19, u18):
        p.edge(sadmin, u, '', 'plain')
    p.edge(u4, gw, '', 'plain')
    p.edge(u15, media, '', 'plain')
    for u in (u7, u8, u9, u10, u12):
        p.edge(u, ai, '', 'plain')
    p.edge(u17, db, '', 'plain')
    write(OUT / 'D03-uc-tong-quat.drawio', p)


def d04_uc_customer():
    # Bố cục bám sát Use Case người dùng do chủ đề cung cấp: một tác nhân,
    # các chức năng công khai + chức năng cần xác thực, và Đăng nhập là use case
    # được include. Trang dọc giúp chèn vào Word mà chữ vẫn đủ lớn để bảo vệ.
    p = Page('Use Case — User', 1400, 1900)
    boundary = ('rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#111827;'
                'strokeWidth=2;verticalAlign=top;align=center;fontSize=26;fontStyle=1;spacingTop=16;')
    public_uc = ('ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#243244;'
                 'strokeWidth=2;fontSize=15;spacing=4;')
    protected_uc = ('ellipse;whiteSpace=wrap;html=1;fillColor=#EEF4FF;strokeColor=#355B8C;'
                    'strokeWidth=2;fontSize=15;spacing=4;')
    login_uc = ('ellipse;whiteSpace=wrap;html=1;fillColor=#FFF4D6;strokeColor=#9A6700;'
                'strokeWidth=2;fontSize=16;fontStyle=1;spacing=4;')
    assoc = ('edgeStyle=none;rounded=0;html=1;strokeColor=#243244;strokeWidth=1.5;endArrow=none;')

    p.node('JAPANO Store', 250, 35, 1100, 1810, boundary)
    user = p.node('User', 55, 835, 80, 125,
                  'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;'
                  'outlineConnect=0;fontSize=16;strokeWidth=2;')

    labels = [
        ('Đăng ký', False),
        ('Quên mật khẩu', False),
        ('Đổi mật khẩu', True),
        ('Xem sản phẩm', False),
        ('Tìm kiếm sản phẩm', False),
        ('Đánh giá sản phẩm', True),
        ('Xem đánh giá sản phẩm', False),
        ('Quản lý giỏ hàng', True),
        ('Theo dõi đơn hàng', True),
        ('Xem giỏ hàng', True),
        ('Quản lý danh sách yêu thích', True),
        ('Sử dụng mã giảm giá', True),
        ('Quản lý tài khoản', True),
        ('Xem thông báo', True),
        ('Đặt hàng', True),
        ('Thanh toán', True),
        ('Xem lịch sử mua hàng', True),
        ('Chat AI', True),
        ('Thử đồ AI', True),
    ]
    usecases = []
    for index, (label, needs_login) in enumerate(labels):
        y = 105 + index * 86
        node = p.node(label, 390, y, 290, 62, protected_uc if needs_login else public_uc)
        usecases.append((node, needs_login))
        p.edge(user, node, '', assoc)

    login = p.node('Đăng nhập', 1030, 825, 235, 76, login_uc)
    p.edge(user, login, '', assoc)

    protected = [node for node, needs_login in usecases if needs_login]
    for index, node in enumerate(protected):
        entry_y = round((index + 1) / (len(protected) + 1), 3)
        include = (
            'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;'
            'dashed=1;dashPattern=7 5;strokeColor=#6B7255;strokeWidth=1.5;endArrow=open;'
            f'exitX=1;exitY=0.5;entryX=0;entryY={entry_y};fontSize=11;'
            'labelBackgroundColor=#FFFFFF;'
        )
        p.edge(node, login, '«include»', include)

    p.node('Quy ước: nền xanh = chức năng cần xác thực; mỗi nét đứt biểu diễn quan hệ «include» Đăng nhập.',
           780, 1715, 500, 72,
           'shape=note;whiteSpace=wrap;html=1;size=16;fillColor=#FFFBE6;strokeColor=#B7A66B;'
           'fontSize=12;align=left;verticalAlign=middle;spacing=8;')
    write(OUT / 'D04-uc-khach-hang.drawio', p)


def d05_uc_admin():
    # Bản quản trị bám theo hình mẫu: một actor Admin, một use case Đăng nhập,
    # chín nhóm nghiệp vụ quản trị và thao tác cập nhật trạng thái đơn hàng.
    p = Page('Use Case — Admin', 1400, 1300)
    boundary = ('rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#111827;'
                'strokeWidth=2;verticalAlign=top;align=center;fontSize=26;fontStyle=1;spacingTop=16;')
    uc = ('ellipse;whiteSpace=wrap;html=1;fillColor=#EEF4FF;strokeColor=#355B8C;'
          'strokeWidth=2;fontSize=15;spacing=4;')
    login_uc = ('ellipse;whiteSpace=wrap;html=1;fillColor=#FFF4D6;strokeColor=#9A6700;'
                'strokeWidth=2;fontSize=16;fontStyle=1;spacing=4;')
    assoc = ('edgeStyle=none;rounded=0;html=1;strokeColor=#243244;strokeWidth=1.5;endArrow=none;')

    p.node('JAPANO Store', 45, 35, 1110, 1215, boundary)
    admin = p.node('Admin', 1225, 570, 80, 125,
                   'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;'
                   'outlineConnect=0;fontSize=16;strokeWidth=2;')
    login = p.node('Đăng nhập', 120, 565, 230, 76, login_uc)
    p.edge(admin, login, '', assoc)

    items = [
        ('Quản lý sản phẩm', 520, 150, 270),
        ('Quản lý danh mục', 820, 265, 270),
        ('Quản lý đơn hàng', 520, 380, 270),
        ('Thống kê doanh thu', 820, 495, 270),
        ('Quản lý người dùng', 520, 610, 270),
        ('Quản lý mã giảm giá', 820, 725, 270),
        ('Quản lý đánh giá', 520, 840, 270),
        ('Quản lý banner /\nsản phẩm nổi bật', 820, 955, 270),
        ('Cập nhật trạng thái\nđơn hàng', 520, 1070, 270),
    ]
    nodes = []
    for index, (label, x, y, width) in enumerate(items):
        node = p.node(label, x, y, width, 72, uc)
        nodes.append(node)
        p.edge(admin, node, '', assoc)
        entry_y = round((index + 1) / (len(items) + 1), 3)
        include = (
            'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;'
            'dashed=1;dashPattern=7 5;strokeColor=#6B7255;strokeWidth=1.5;endArrow=open;'
            f'exitX=0;exitY=0.5;entryX=1;entryY={entry_y};fontSize=11;'
            'labelBackgroundColor=#FFFFFF;'
        )
        p.edge(node, login, '«include»', include)

    # Cập nhật trạng thái là một phần bắt buộc của quản lý đơn hàng.
    p.edge(nodes[2], nodes[8], '«include»',
           'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;dashed=1;dashPattern=7 5;'
           'strokeColor=#355B8C;strokeWidth=1.5;endArrow=open;fontSize=11;'
           'labelBackgroundColor=#FFFFFF;exitX=0.55;exitY=1;entryX=0.55;entryY=0;')

    note = p.node('Thao tác sản phẩm và danh mục:\nthêm, sửa, xem, ẩn / hiện.',
                  120, 145, 300, 115,
                  'shape=note;whiteSpace=wrap;html=1;size=18;fillColor=#FFFBE6;strokeColor=#B7A66B;'
                  'fontSize=13;align=center;verticalAlign=middle;spacing=8;')
    note_link = ('edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;dashed=1;strokeColor=#B7A66B;'
                 'strokeWidth=1.5;endArrow=open;')
    p.edge(note, nodes[0], '', note_link)
    p.edge(note, nodes[1], '', note_link)
    write(OUT / 'D05-uc-quan-tri.drawio', p)


def d06_uc_tryon():
    p = Page('Use Case — Thử đồ ảo', 1250, 760)
    p.node('Phân hệ thử đồ ảo', 300, 40, 800, 640, 'sysbox')
    cust = p.node('Khách hàng', 100, 250, 60, 90, 'actor')
    ai = p.node('Dịch vụ GPU\nFASHN + FLUX.2', 1150, 250, 60, 90, 'actor')
    up = p.node('Tải ảnh của mình lên', 360, 100, 210, 66, 'usecase')
    cons = p.node('Đồng ý cho dùng ảnh', 620, 100, 210, 66, 'usecase')
    adult = p.node('Qua cổng 18+\n(chỉ với đồ nhạy cảm)', 880, 100, 200, 66, 'usecase')
    an = p.node('Phân tích bằng chứng\ncơ thể (CPU)', 360, 210, 210, 66, 'ucai')
    fit = p.node('Phân tích độ vừa vặn\n7 mức verdict', 620, 210, 210, 66, 'ucai')
    gen = p.node('Sinh ảnh thử đồ', 620, 320, 210, 66, 'ucai')
    rep = p.node('Chuyển tư thế\nbằng FLUX.2', 360, 320, 210, 66, 'ucai')
    ref = p.node('Mô phỏng chật/vừa/rộng\n(fit-refine)', 880, 320, 200, 66, 'ucai')
    qg = p.node('Kiểm tra danh tính,\ncấu trúc, độ che phủ', 620, 430, 210, 66, 'ucai')
    res = p.node('Nhận ảnh kết quả\nhoặc lý do từ chối', 620, 540, 210, 66, 'usecase')
    cancel = p.node('Huỷ lượt đang chạy', 360, 540, 210, 66, 'usecase')
    for u in (up, gen, res, cancel):
        p.edge(cust, u, '', 'plain')
    p.edge(gen, cons, '«include»', 'include')
    p.edge(gen, an, '«include»', 'include')
    p.edge(gen, fit, '«include»', 'include')
    p.edge(gen, qg, '«include»', 'include')
    p.edge(gen, rep, '«extend» khi tư thế khó', 'include')
    p.edge(gen, ref, '«extend» khi lệch size', 'include')
    p.edge(gen, adult, '«extend»', 'include')
    p.edge(gen, ai, '', 'plain')
    p.edge(qg, res, '', 'solid')
    write(OUT / 'D06-uc-thu-do-ai.drawio', p)


def d07_uc_travel():
    p = Page('Use Case — Đưa tôi đến đây', 1200, 640)
    p.node('Phân hệ khám phá Nhật Bản', 300, 40, 760, 520, 'sysbox')
    cust = p.node('Khách hàng', 100, 220, 60, 90, 'actor')
    wm = p.node('Nguồn ảnh\nWikimedia', 1110, 220, 60, 90, 'actor')
    br = p.node('Duyệt 25 địa danh', 350, 100, 200, 66, 'usecase')
    de = p.node('Xem chi tiết địa danh\nvà đánh giá cộng đồng', 600, 100, 230, 66, 'usecase')
    sug = p.node('Đóng góp địa danh mới\n(được thưởng voucher)', 860, 100, 180, 66, 'usecase')
    rec = p.node('Nhận gợi ý trang phục\nhợp địa điểm', 350, 210, 200, 66, 'ucai')
    tryon = p.node('Thử đồ ngay\ntại chỗ', 600, 210, 230, 66, 'ucai')
    comp = p.node('Ghép ảnh vào\ncảnh thật của địa điểm', 600, 320, 230, 66, 'ucai')
    anchor = p.node('Bám điểm đặt chân,\nvùng đứng, hướng sáng', 860, 320, 180, 66, 'ucai')
    filt = p.node('Lọc theo quy tắc\nvăn hoá và cổng 18+', 350, 320, 200, 66, 'usecase')
    save = p.node('Lưu hoặc chia sẻ ảnh', 600, 430, 230, 66, 'usecase')
    for u in (br, de, sug, rec, tryon, comp, save):
        p.edge(cust, u, '', 'plain')
    p.edge(rec, filt, '«include»', 'include')
    p.edge(comp, anchor, '«include»', 'include')
    p.edge(comp, tryon, '«include»', 'include')
    p.edge(comp, wm, 'ảnh nền đã tải sẵn, có ghi nguồn', 'plain')
    write(OUT / 'D07-uc-dua-toi-den-day.drawio', p)


def d08_uc_order():
    p = Page('Use Case — Đặt hàng, thanh toán, đổi trả', 1250, 800)
    p.node('Phân hệ thương mại', 300, 40, 780, 690, 'sysbox')
    cust = p.node('Khách hàng', 100, 200, 60, 90, 'actor')
    staff = p.node('Nhân viên / Admin', 100, 470, 60, 90, 'actor')
    gw = p.node('Stripe / VNPay', 1130, 200, 60, 90, 'actor')
    cart = p.node('Xác nhận giỏ hàng', 350, 100, 200, 66, 'usecase')
    price = p.node('Tính lại giá, voucher,\ntồn kho phía server', 600, 100, 230, 66, 'usecase')
    place = p.node('Tạo đơn hàng', 860, 100, 190, 66, 'usecase')
    cod = p.node('Thanh toán COD', 350, 210, 200, 66, 'usecase')
    card = p.node('Thanh toán Stripe\n(Test Mode)', 600, 210, 230, 66, 'usecase')
    vnp = p.node('Thanh toán VNPay\n(Sandbox)', 860, 210, 190, 66, 'usecase')
    cb = p.node('Chờ callback thật\ntừ cổng thanh toán', 600, 320, 230, 66, 'usecase')
    ship = p.node('Cập nhật vận chuyển', 350, 430, 200, 66, 'usecase')
    recv = p.node('Xác nhận đã nhận hàng', 600, 430, 230, 66, 'usecase')
    req = p.node('Yêu cầu trả từng dòng', 860, 430, 190, 66, 'usecase')
    apr = p.node('Duyệt/từ chối\nyêu cầu trả', 350, 540, 200, 66, 'usecase')
    back = p.node('Theo dõi gửi trả hàng', 600, 540, 230, 66, 'usecase')
    rfd = p.node('Hoàn tiền theo\ntừng dòng hàng', 860, 540, 190, 66, 'usecase')
    for u in (cart, cod, card, vnp, recv, req):
        p.edge(cust, u, '', 'plain')
    for u in (ship, apr, back, rfd):
        p.edge(staff, u, '', 'plain')
    p.edge(place, price, '«include»', 'include')
    p.edge(place, cart, '«include»', 'include')
    p.edge(card, cb, '«include»', 'include')
    p.edge(vnp, cb, '«include»', 'include')
    p.edge(card, gw, '', 'plain')
    p.edge(vnp, gw, '', 'plain')
    p.edge(req, apr, '', 'solid')
    p.edge(apr, back, '', 'solid')
    p.edge(back, rfd, '', 'solid')
    p.node('Đơn COD được xác nhận ngay. Đơn Stripe/VNPay chỉ chuyển sang trạng thái\n'
           'đã thanh toán SAU khi backend nhận callback thật từ cổng — client không\n'
           'bao giờ là nguồn sự thật của trạng thái thanh toán.', 300, 745, 780, 55, 'note')
    write(OUT / 'D08-uc-dat-hang-thanh-toan-doi-tra.drawio', p)


def d09_uc_moderation():
    p = Page('Use Case — Quản lý và kiểm duyệt nội dung', 1200, 700)
    p.node('Phân hệ nội dung', 300, 40, 760, 580, 'sysbox')
    cust = p.node('Khách hàng', 100, 150, 60, 90, 'actor')
    staff = p.node('Nhân viên / Admin', 100, 400, 60, 90, 'actor')
    llm = p.node('Ollama\nqwen2.5:7b', 1110, 260, 60, 90, 'actor')
    wr = p.node('Viết đánh giá\n(đã mua mới được viết)', 350, 100, 230, 66, 'usecase')
    sp = p.node('Đóng góp địa danh', 630, 100, 200, 66, 'usecase')
    reac = p.node('Bày tỏ cảm xúc\nvới đánh giá', 870, 100, 170, 66, 'usecase')
    norm = p.node('Chuẩn hoá văn bản,\nchống lách luật', 350, 210, 230, 66, 'ucai')
    rule = p.node('Đối chiếu luật cục bộ\n5 nhóm vi phạm', 630, 210, 200, 66, 'ucai')
    sem = p.node('Kiểm duyệt ngữ nghĩa\n(khi có Ollama)', 870, 210, 170, 66, 'ucai')
    merge = p.node('Hợp nhất quyết định\nduyệt / chờ / từ chối', 630, 320, 200, 66, 'ucai')
    review = p.node('Xem hàng chờ\nkiểm duyệt', 350, 430, 230, 66, 'usecase')
    ov = p.node('Ghi đè quyết định\ncủa máy', 630, 430, 200, 66, 'usecase')
    learn = p.node('Lưu mẫu bị từ chối\nlàm cụm khoá mới', 870, 430, 170, 66, 'usecase')
    ban = p.node('Quản lý banner,\nthông báo, cấu hình', 480, 530, 240, 66, 'usecase')
    for u in (wr, sp, reac):
        p.edge(cust, u, '', 'plain')
    for u in (review, ov, ban):
        p.edge(staff, u, '', 'plain')
    p.edge(wr, norm, '«include»', 'include')
    p.edge(norm, rule, '', 'solid')
    p.edge(rule, sem, '«extend»', 'include')
    p.edge(sem, llm, '', 'plain')
    p.edge(rule, merge, '', 'solid')
    p.edge(sem, merge, '', 'solid')
    p.edge(ov, learn, '«extend»', 'include')
    write(OUT / 'D09-uc-kiem-duyet-noi-dung.drawio', p)


def d10_seq_login():
    p = Page('Trình tự — Đăng nhập', 1400, 720)
    actors = [('Khách hàng', 'life'), ('Client\n(app / website)', 'life'), ('POST /api/auth/login', 'life'),
              ('backend/lib/auth.js', 'life'), ('MongoDB users', 'lifeai')]
    msgs = [
        ('Khách hàng', 'Client\n(app / website)', 'nhập email + mật khẩu', 'msg'),
        ('Client\n(app / website)', 'POST /api/auth/login', 'JSON qua HTTPS (website đi qua BFF same-origin)', 'msg'),
        ('POST /api/auth/login', 'POST /api/auth/login', 'authLimiter: 20 lần / 15 phút cho mỗi IP', 'msg'),
        ('POST /api/auth/login', 'MongoDB users', 'tìm người dùng theo email', 'msg'),
        ('MongoDB users', 'POST /api/auth/login', 'bản ghi kèm passwordHash', 'ret'),
        ('POST /api/auth/login', 'backend/lib/auth.js', 'bcrypt.compare(mật khẩu, hash)', 'msg'),
        ('backend/lib/auth.js', 'POST /api/auth/login', 'đúng / sai', 'ret'),
        ('POST /api/auth/login', 'backend/lib/auth.js', 'ký JWT kèm vai trò và TTL', 'msg'),
        ('POST /api/auth/login', 'Client\n(app / website)', '200 + token + hồ sơ rút gọn', 'ret'),
        ('Client\n(app / website)', 'Client\n(app / website)', 'app: SecureStore · website: BFF đổi sang cookie HttpOnly', 'msg'),
        ('Client\n(app / website)', 'Khách hàng', 'vào màn hình chính', 'ret'),
    ]
    sequence(p, actors, msgs, lane=270)
    p.node('Thất bại trả 401 với thông điệp trung tính, không nói email có tồn tại hay không.\n'
           'GET /api/auth/me và /api/auth/providers KHÔNG nằm dưới authLimiter: trước đây\n'
           'chúng bị 429 và nhánh catch của mobile/lib/auth.tsx xoá token, làm người dùng\n'
           'thật bị đăng xuất oan khi nhiều thiết bị dùng chung một IP.', 60, 640, 1280, 70, 'note')
    write(OUT / 'D10-seq-dang-nhap.drawio', p)


def d11_seq_order():
    p = Page('Trình tự — Đặt hàng và thanh toán', 1500, 800)
    actors = [('Khách hàng', 'life'), ('Client', 'life'), ('POST /api/orders', 'life'),
              ('lib/pricing.js\nlib/inventory.js', 'life'), ('Cổng thanh toán', 'lifeai'), ('MongoDB', 'lifeai')]
    msgs = [
        ('Khách hàng', 'Client', 'xác nhận giỏ, địa chỉ, mã giảm giá', 'msg'),
        ('Client', 'POST /api/orders', 'gửi danh sách biến thể + mã voucher', 'msg'),
        ('POST /api/orders', 'lib/pricing.js\nlib/inventory.js', 'tính lại giá, chiết khấu VIP, phí ship', 'msg'),
        ('POST /api/orders', 'MongoDB', 'kiểm tra tồn kho từng biến thể', 'msg'),
        ('MongoDB', 'POST /api/orders', 'tồn kho thực tế', 'ret'),
        ('POST /api/orders', 'MongoDB', 'ghi orders + order_items (snapshot giá, tên, size, màu)', 'msg'),
        ('POST /api/orders', 'Client', 'COD: đơn đã xác nhận', 'ret'),
        ('Client', 'Cổng thanh toán', 'thẻ/VNPay: mở phiên thanh toán', 'msg'),
        ('Cổng thanh toán', 'POST /api/orders', 'callback/webhook đã ký', 'msg'),
        ('POST /api/orders', 'MongoDB', 'ghi payments, cập nhật trạng thái đơn', 'msg'),
        ('POST /api/orders', 'Client', 'đơn chuyển sang đã thanh toán', 'ret'),
        ('Client', 'Khách hàng', 'màn hình xác nhận + thông báo', 'ret'),
    ]
    sequence(p, actors, msgs, lane=240)
    p.node('Giá, voucher và tồn kho KHÔNG bao giờ lấy từ client. Đơn thanh toán online chỉ\n'
           'chuyển trạng thái sau callback thật; đây là lý do màn hình không hiện "thành công"\n'
           'ngay khi rời khỏi WebView. Giới hạn đã biết: tồn kho chưa được hoàn lại cho đơn\n'
           'online bị bỏ dở (ghi chú trong backend/routes/orders.js).', 60, 700, 1380, 80, 'note')
    write(OUT / 'D11-seq-mua-hang.drawio', p)


def d12_seq_tryon():
    p = Page('Trình tự — Thử đồ ảo', 1600, 900)
    actors = [('Khách hàng', 'life'), ('Client', 'life'), ('POST /api/tryon', 'life'),
              ('Body worker\n:7863', 'lifeai'), ('GPU arbiter', 'lifeai'), ('FASHN + FLUX.2\n:7862', 'lifeai')]
    msgs = [
        ('Khách hàng', 'Client', 'chọn ảnh, sản phẩm, size, đồng ý dùng ảnh', 'msg'),
        ('Client', 'POST /api/tryon', 'ảnh base64 + productIds + size', 'msg'),
        ('POST /api/tryon', 'POST /api/tryon', 'kiểm tra 18+ và độ che phủ nếu là đồ nhạy cảm', 'msg'),
        ('POST /api/tryon', 'Body worker\n:7863', 'phân tích bằng chứng cơ thể', 'msg'),
        ('Body worker\n:7863', 'POST /api/tryon', 'khoảng số đo + độ tin cậy, hoặc chưa đủ bằng chứng', 'ret'),
        ('POST /api/tryon', 'POST /api/tryon', 'analyzeFit(): verdict, severity, hiệu ứng được phép', 'msg'),
        ('POST /api/tryon', 'GPU arbiter', 'xin lượt GPU với focus = tryon', 'msg'),
        ('GPU arbiter', 'FASHN + FLUX.2\n:7862', 'nạp model, chạy VTON', 'msg'),
        ('FASHN + FLUX.2\n:7862', 'POST /api/tryon', 'ảnh đã mặc đồ', 'ret'),
        ('POST /api/tryon', 'FASHN + FLUX.2\n:7862', 'fit-refine khi cần mô phỏng chật/rộng', 'msg'),
        ('POST /api/tryon', 'POST /api/tryon', 'cổng danh tính, cấu trúc, độ che phủ', 'msg'),
        ('POST /api/tryon', 'Client', 'đạt: ảnh thật + cảnh báo nếu có', 'ret'),
        ('POST /api/tryon', 'Client', 'không đạt: giữ ảnh sạch + lý do rõ ràng', 'ret'),
        ('Client', 'Khách hàng', 'hiển thị kết quả, không có thanh phần trăm giả', 'ret'),
    ]
    sequence(p, actors, msgs, lane=250)
    p.node('Thiếu số đo KHÔNG chặn thử đồ: đo cơ thể và thử đồ là hai khả năng tách biệt.\n'
           'Không có đường lùi dán ảnh sản phẩm lên người. Kết quả chỉ được ghi vào cache\n'
           'khi ảnh đầu vào là mẫu dựng sẵn của JAPANO và ảnh không mang cảnh báo nào.',
           60, 790, 1400, 70, 'note')
    write(OUT / 'D12-seq-thu-do.drawio', p)


def d13_seq_motion():
    p = Page('Trình tự — Tạo video chuyển động', 1400, 700)
    actors = [('Khách hàng', 'life'), ('Client', 'life'), ('/api/tryon/motion', 'life'),
              ('GPU arbiter', 'lifeai'), ('Motion service\nWan2.1 + One-to-All', 'lifeai')]
    msgs = [
        ('Khách hàng', 'Client', 'chọn preset walk / turn / pose', 'msg'),
        ('Client', '/api/tryon/motion', 'gửi ảnh KẾT QUẢ thử đồ + preset', 'msg'),
        ('/api/tryon/motion', 'GPU arbiter', 'xin lượt với ưu tiên motion (300)', 'msg'),
        ('GPU arbiter', 'Motion service\nWan2.1 + One-to-All', 'dừng thử đồ, nhả VRAM, nạp motion', 'msg'),
        ('Motion service\nWan2.1 + One-to-All', 'Motion service\nWan2.1 + One-to-All', 'sinh 49 khung, 384x640, kiểm tra hành động', 'msg'),
        ('Motion service\nWan2.1 + One-to-All', '/api/tryon/motion', 'tệp MP4', 'ret'),
        ('/api/tryon/motion', '/api/tryon/motion', 'cổng chất lượng chuyển động', 'msg'),
        ('/api/tryon/motion', 'Client', 'URL video mở được', 'ret'),
        ('Client', '/api/tryon/motion', 'DELETE: huỷ giữa chừng khi rời màn hình', 'msg'),
    ]
    sequence(p, actors, msgs, lane=265)
    p.node('Đo trên RTX 5060 Ti 16 GB: walk khoảng 58 s chạy thẳng / 65 s qua backend,\n'
           'turn khoảng 71 s, pose khoảng 66 s. Đây là TỐI ƯU SUY LUẬN, không phải\n'
           'fine-tune: không có checkpoint mới nào được sinh ra. Motion là CUDA-only,\n'
           'không có đường lùi CPU.', 60, 590, 1280, 80, 'note')
    write(OUT / 'D13-seq-motion.drawio', p)


def d14_seq_travel():
    p = Page('Trình tự — Ghép ảnh "Đưa tôi đến đây"', 1450, 700)
    actors = [('Khách hàng', 'life'), ('Client', 'life'), ('/api/japan-spots/\nscene-photo', 'life'),
              ('lib/japanScenes.js', 'lifeai'), ('scene_compose.py\nU2Net', 'lifeai')]
    msgs = [
        ('Khách hàng', 'Client', 'chọn địa danh, bấm "Đưa mình tới đây"', 'msg'),
        ('Client', '/api/japan-spots/\nscene-photo', 'ảnh thử đồ + TÊN địa danh (không gửi URL)', 'msg'),
        ('/api/japan-spots/\nscene-photo', 'lib/japanScenes.js', 'tra metadata cảnh theo tên', 'msg'),
        ('lib/japanScenes.js', '/api/japan-spots/\nscene-photo', 'footAnchor, groundPolygon, tỉ lệ người, hướng sáng', 'ret'),
        ('/api/japan-spots/\nscene-photo', 'scene_compose.py\nU2Net', 'tách người khỏi nền', 'msg'),
        ('scene_compose.py\nU2Net', 'scene_compose.py\nU2Net', 'cắt khung bám điểm đặt chân, đặt người, dựng bóng', 'msg'),
        ('scene_compose.py\nU2Net', '/api/japan-spots/\nscene-photo', 'ảnh JPEG đã ghép', 'ret'),
        ('/api/japan-spots/\nscene-photo', 'Client', 'ảnh + ghi nguồn Wikimedia', 'ret'),
    ]
    sequence(p, actors, msgs, lane=280)
    p.node('Client chỉ gửi TÊN địa điểm. Nhận URL do client cung cấp ở đây sẽ mở một lỗ SSRF,\n'
           'nên URL được tra trong bảng cứng và chỉ chấp nhận HTTPS trên upload.wikimedia.org.\n'
           'Bước ghép dùng segmentation, KHÔNG dùng model sinh ảnh: khuôn mặt và cơ thể còn\n'
           'nguyên từng pixel. Đo được 912 ms (ảnh dựng sẵn) và 1 195 ms (ảnh vừa thử đồ).\n'
           'Nếu ghép cảnh lỗi, ảnh thử đồ vẫn được giữ để thử lại riêng bước đó.',
           60, 560, 1330, 100, 'note')
    write(OUT / 'D14-seq-travel-composite.drawio', p)


def d15_seq_moderation():
    p = Page('Trình tự — Kiểm duyệt đánh giá', 1400, 700)
    actors = [('Khách hàng', 'life'), ('POST /api/reviews', 'life'), ('lib/reviewModeration.js', 'life'),
              ('Ollama qwen2.5:7b', 'lifeai'), ('Admin', 'life')]
    msgs = [
        ('Khách hàng', 'POST /api/reviews', 'gửi nội dung đánh giá', 'msg'),
        ('POST /api/reviews', 'POST /api/reviews', 'kiểm tra đã mua sản phẩm chưa', 'msg'),
        ('POST /api/reviews', 'lib/reviewModeration.js', 'moderateReview(text, samples)', 'msg'),
        ('lib/reviewModeration.js', 'lib/reviewModeration.js', 'bỏ dấu, gỡ leet, dồn ký tự lặp, so 5 nhóm luật', 'msg'),
        ('lib/reviewModeration.js', 'Ollama qwen2.5:7b', 'chỉ khi luật cục bộ chưa đủ chắc', 'msg'),
        ('Ollama qwen2.5:7b', 'lib/reviewModeration.js', 'JSON: harmful, confidence, categories', 'ret'),
        ('lib/reviewModeration.js', 'POST /api/reviews', 'approved / pending / rejected + lý do', 'ret'),
        ('POST /api/reviews', 'Admin', 'nội dung pending vào hàng chờ', 'msg'),
        ('Admin', 'POST /api/reviews', 'ghi đè quyết định, lưu mẫu vi phạm mới', 'msg'),
    ]
    sequence(p, actors, msgs, lane=265)
    p.node('Ngưỡng cứng: điểm ≥ 0,75 từ chối; 0,40–0,75 chuyển chờ duyệt; dưới 0,40 duyệt.\n'
           'Mô hình ngôn ngữ chỉ được từ chối khi confidence ≥ 0,62. Khi Ollama tắt, luật cục\n'
           'bộ vẫn chạy đầy đủ. Việc lưu cụm khoá từ mẫu bị từ chối là BỘ NHỚ MẪU, không\n'
           'phải fine-tune và cũng không phải học tăng cường: không có trọng số nào được cập nhật.',
           60, 570, 1280, 90, 'note')
    write(OUT / 'D15-seq-kiem-duyet.drawio', p)


def d16_seq_reco():
    p = Page('Trình tự — Gợi ý sản phẩm', 1400, 660)
    actors = [('Khách hàng', 'life'), ('GET /api/recommendations', 'life'), ('lib/recommend.js', 'life'),
              ('lib/advancedRecommend.js', 'lifeai'), ('MongoDB', 'lifeai')]
    msgs = [
        ('Khách hàng', 'GET /api/recommendations', 'mở trang chủ', 'msg'),
        ('GET /api/recommendations', 'lib/recommend.js', 'getHomeRecommendations(userId, limit)', 'msg'),
        ('lib/recommend.js', 'lib/recommend.js', 'cache RAM còn hạn 60 giây?', 'msg'),
        ('lib/recommend.js', 'MongoDB', 'đọc interactions, orders, products, profiles', 'msg'),
        ('MongoDB', 'lib/recommend.js', 'sự kiện hành vi đã gắn trọng số và suy giảm theo thời gian', 'ret'),
        ('lib/recommend.js', 'lib/advancedRecommend.js', 'dựng SSM, đồ thị, chuỗi chuyển tiếp, ranker', 'msg'),
        ('lib/advancedRecommend.js', 'lib/recommend.js', 'bốn đặc trưng cho mỗi cặp (người dùng, sản phẩm)', 'ret'),
        ('lib/recommend.js', 'lib/recommend.js', 'trộn MoE theo độ dài lịch sử, trừ điểm feedback âm', 'msg'),
        ('lib/recommend.js', 'lib/recommend.js', 'đa dạng hoá: tối đa 2 sản phẩm mỗi danh mục', 'msg'),
        ('lib/recommend.js', 'GET /api/recommendations', 'danh sách + lý do cho từng sản phẩm', 'ret'),
        ('GET /api/recommendations', 'Khách hàng', 'thẻ sản phẩm kèm câu giải thích', 'ret'),
    ]
    sequence(p, actors, msgs, lane=265)
    p.node('Ảnh cơ thể và kết quả thử đồ KHÔNG được đưa vào bộ gợi ý. Chỉ tín hiệu hành vi\n'
           'thương mại (xem, tìm, yêu thích, giỏ, thử đồ, chat, mua) mới vào mô hình.',
           60, 570, 1280, 55, 'note')
    write(OUT / 'D16-seq-goi-y.drawio', p)


def d17_body_pipeline():
    p = Page('Đường ống ảnh → số đo', 1500, 820)
    steps = [
        ('1. Kiểm tra chất lượng ảnh\nđộ phân giải, độ nét, độ phủ cơ thể', 60, 60),
        ('2. YOLOv8n-pose — 17 khớp\nloại khớp conf < 0,5 và khớp sát mép ảnh 1,5%', 60, 160),
        ('3. Chọn chủ thể chính\ndiện tích, chiều cao khung, vị trí, độ tin cậy', 60, 260),
        ('4. U2Net — tách silhouette', 60, 360),
        ('5. body_geometry.torso_profile\ncắt hai cánh tay bằng khung xương', 60, 460),
        ('6. Đặc trưng hình học chuẩn hoá\nbề ngang ngực/eo/hông, tỉ lệ, clothing_slack', 60, 560),
    ]
    ids = []
    for label, x, y in steps:
        ids.append(p.node(label, x, y, 400, 70, 'box'))
    for a, b in zip(ids, ids[1:]):
        p.edge(a, b)

    r = [
        ('7. Ước lượng chiều cao\nhậu nghiệm của prior dân số cập nhật bằng cue ảnh', 560, 60),
        ('8. Hồi quy đã train lại trên ANSUR II\nBMI ← tỉ lệ bề ngang; cân nặng; ba vòng', 560, 160),
        ('9. Hiệu chuẩn dân số BodyM\nkéo đầu ra về phân bố dân số chung', 560, 260),
        ('10. Cổng tỉnh táo giải phẫu\nvòng đo, tỉ lệ giữa các vòng, BMI hợp lệ?', 560, 360),
        ('11. Độ tin cậy và khoảng bất định\nuncertaintyMin/Max cho từng đại lượng', 560, 460),
        ('12. Gom về bin 10 đơn vị để hiển thị', 560, 560),
    ]
    rids = []
    for label, x, y in r:
        rids.append(p.node(label, x, y, 400, 70, 'boxblue'))
    for a, b in zip(rids, rids[1:]):
        p.edge(a, b)
    p.edge(ids[-1], rids[0])

    dec = p.node('Số đo do khách\ntự nhập?', 1030, 190, 180, 90, 'decision')
    out1 = p.node('Dùng số đo thật của khách\n— luôn thắng ước lượng của AI', 1010, 330, 400, 60, 'boxred')
    out2 = p.node('Trả khoảng ước lượng kèm độ tin cậy', 1010, 420, 400, 50, 'box')
    out3 = p.node('Trả trạng thái "chưa đủ bằng chứng"\nkhi ảnh cắt cụt hoặc đồ quá rộng', 1010, 500, 400, 60, 'boxgrey')
    p.edge(rids[-1], dec)
    p.edge(dec, out1, 'có')
    p.edge(dec, out2, 'không, ảnh đủ bằng chứng')
    p.edge(dec, out3, 'không, thiếu bằng chứng')
    p.node('Giới hạn vật lý: một ảnh không có vật chuẩn không thể xác định chiều cao tuyệt đối.\n'
           'Với ảnh khó, trọng số của cue ảnh có thể chỉ còn 0,168 — phần còn lại là prior dân số.\n'
           'Kết quả khi đó được gắn basis = population_prior và usableForSizing = false, và\n'
           'KHÔNG được dùng để chốt size.', 1010, 590, 420, 110, 'note')
    p.node('Đo trên BodyM testB (120 người, tách danh tính, tệp\n'
           'evaluation/body_pipeline_testB.json ngày 2026-08-28):\n'
           'MAE chiều cao 6,56 cm · cân nặng 9,59 kg · ngực 6,49 cm ·\n'
           'eo 6,45 cm · hông 5,70 cm. Độ trễ API P50 0,35 s.',
           60, 660, 900, 110, 'note')
    write(OUT / 'D17-pipeline-do-co-the.drawio', p)


def d18_reco_pipeline():
    p = Page('Đường ống gợi ý — Adaptive Mixture of Experts', 1500, 760)
    src = p.node('Sự kiện hành vi từ MongoDB\ninteractions, orders, profiles, products\n'
                 'trọng số: xem 1 · tìm 2 · yêu thích 3 · thử đồ 3,5 · giỏ 4 · mua 6\n'
                 'suy giảm nửa đời 14 ngày', 480, 40, 520, 90, 'boxred')
    experts = [
        ('Matrix Factorization\nSGD, k = 8', 40, 190),
        ('Item-CF\ncosine, 12 hàng xóm', 260, 190),
        ('Hồ sơ nội dung\ntag, giá, phong cách', 480, 190),
        ('Luật mua kèm\nsupport/confidence/lift', 700, 190),
        ('Trending / DemandScore', 920, 190),
        ('Selective SSM\ntrạng thái 12 chiều, tối đa 64 sự kiện', 1140, 190),
    ]
    eids = [p.node(label, x, y, 200, 80, 'box') for label, x, y in experts]
    experts2 = [
        ('LightGCN-style\nhai lớp lan truyền đồ thị', 260, 310),
        ('Next-item Markov bậc một\nkhoảng cách tối đa 72 giờ', 560, 310),
        ('Pairwise logistic ranker\nSGD, 12 epoch', 860, 310),
    ]
    eids += [p.node(label, x, y, 240, 70, 'boxblue') for label, x, y in experts2]
    for eid in eids:
        p.edge(src, eid, '', 'dash')
    gate = p.node('Cổng trộn thích ứng — trọng số đổi theo số sản phẩm đã tương tác\n'
                  '≥ 3 tương tác: ranker 0,23 · SSM 0,15 · transition 0,14 · đồ thị 0,12 · phần còn lại 0,36\n'
                  '0 tương tác, không có tín hiệu nội dung: trending 0,70 · ranker 0,30',
                  330, 420, 800, 80, 'boxred')
    for eid in eids:
        p.edge(eid, gate, '', 'plain')
    neg = p.node('Trừ điểm feedback âm\nbỏ giỏ, bỏ yêu thích: −0,45 trước sigmoid', 60, 430, 240, 70, 'boxgrey')
    p.edge(neg, gate, '', 'plain')
    stack = p.node('Xếp hạng chồng: logit = 0,7·logit(rank) + 2,2·(retrieval − 0,5) − 5·negative', 330, 530, 800, 45, 'box')
    div = p.node('Đa dạng hoá: tối đa 2 sản phẩm mỗi danh mục', 330, 595, 380, 45, 'box')
    exp = p.node('Một suất khám phá lấy mẫu theo trending', 750, 595, 380, 45, 'box')
    out = p.node('Danh sách + lý do hiển thị cho khách ("Vì bạn đã quan tâm...", "Đang là xu hướng...")',
                 330, 660, 800, 45, 'boxblue')
    p.edge(gate, stack)
    p.edge(stack, div)
    p.edge(stack, exp)
    p.edge(div, out)
    p.edge(exp, out)
    p.node('Các khối SSM, đồ thị và bộ nhớ chat là implementation "inspired/style" viết bằng\n'
           'JavaScript chạy online, KHÔNG phải checkpoint Mamba, LightGCN hay xLSTM chính thức.\n'
           'Đánh giá xếp hạng ngoại tuyến chưa triển khai: NDCG@10 và Recall@10 báo not-measured.',
           40, 660, 270, 90, 'note')
    write(OUT / 'D18-pipeline-goi-y-moe.drawio', p)


def d19_gpu():
    p = Page('GPU arbiter', 1250, 620)
    p.node('GPU NVIDIA RTX 5060 Ti — 16 311 MiB VRAM', 60, 40, 1120, 40, 'boxred')
    q = p.node('Hàng chờ ưu tiên — chỉ một job sinh ảnh/video chạy tại một thời điểm', 60, 110, 1120, 45, 'box')
    m = p.node('motion — 300\nđộc quyền GPU và RAM', 60, 190, 250, 70, 'boxred')
    t = p.node('tryon / swimwear — 200\nđộc quyền cho FASHN và FLUX.2', 350, 190, 260, 70, 'boxred')
    v = p.node('vision — 120\nQwen3-VL mô tả ảnh sản phẩm', 650, 190, 250, 70, 'boxblue')
    r = p.node('recommendation — 100\nembedding ngữ nghĩa', 940, 190, 240, 70, 'boxgrey')
    for node in (m, t, v, r):
        p.edge(q, node, '', 'plain')
    st = p.node('Chuyển màn hình → đổi focus profile:\n'
                'cancel job đang chờ, abort request đang chạy,\n'
                'gọi /unload để nhả VRAM, đổi thiết bị của embedding',
                60, 300, 480, 90, 'box')
    guard = p.node('beginGpuJob / endGpuJob\nBảo vệ job đang chạy khỏi chính báo cáo focus của màn hình đó.\n'
                   'Trước khi có cặp hàm này, màn hình thử đồ tự báo focus "browse"\n'
                   'và giết chính lượt thử đồ mình vừa gửi đi.',
                   580, 300, 600, 90, 'note')
    p.edge(q, st, '', 'plain')
    p.node('Vì sao cần: try-on chiếm khoảng 15 GB và motion khoảng 13,5 GB, trong khi card chỉ có\n'
           '16 GB. Nạp đồng thời là OOM chắc chắn. Chính sách "giữ đến khi xong" được chọn thay cho\n'
           'chia sẻ thời gian vì hai model đều mất hàng chục giây chỉ để nạp — tráo qua lại giữa\n'
           'chừng sẽ làm cả hai job chậm hơn là xếp hàng.', 60, 420, 1120, 90, 'note')
    write(OUT / 'D19-gpu-arbiter.drawio', p)


def d20_fit():
    p = Page('Quyết định độ vừa vặn', 1350, 800)
    a = p.node('Đầu vào: size khách chọn, size khuyến nghị,\nsố đo hợp nhất, kết quả phân tích ảnh, vùng cơ thể', 420, 40, 480, 70, 'boxred')
    d0 = p.node('Có đủ hai\nbậc size?', 610, 140, 160, 80, 'decision')
    unk = p.node('verdict = unknown\nkhông sinh hiệu ứng nào', 950, 150, 300, 60, 'boxgrey')
    d1 = p.node('Có số đo vòng thật\ncủa vùng tương ứng?', 580, 250, 220, 90, 'decision')
    ease = p.node('ease = vòng theo bảng size − vòng cơ thể\nease < 0 → chật; 0 ≤ ease ≤ 9 cm → vừa; > 9 cm → rộng\n'
                  'severity = |ease| / 22 (chật) hoặc (ease − 9) / 24 (rộng)', 130, 370, 460, 80, 'box')
    delta = p.node('Chỉ có bậc size: 1 bậc → 0,34 · 2 bậc → 0,66 · ≥ 3 bậc → 0,88+\n'
                   'BMI ước lượng và tỉ lệ bề ngang chỉ hiệu chỉnh nhẹ (±0,05…0,08)', 800, 370, 460, 80, 'boxblue')
    merge = p.node('severity = max(ease, 0,45·delta + 0,55·ease); số đo thật chỉ được ĐẨY LÊN, không kéo xuống',
                   250, 480, 850, 50, 'boxred')
    verd = p.node('≤ 0,12 vừa · ≤ 0,42 hơi chật/hơi rộng · ≤ 0,72 chật/rộng · > 0,72 rất chật/rất rộng',
                  250, 555, 850, 45, 'box')
    tear = p.node('Cho phép hiệu ứng bục đường may?', 250, 625, 380, 50, 'decision')
    no = p.node('KHÔNG — quần, chân váy, đồ bơi, crop top,\nhoặc severity < 0,85: chỉ vải căng và hằn nhẹ', 660, 615, 440, 70, 'boxgrey')
    p.edge(a, d0)
    p.edge(d0, unk, 'không')
    p.edge(d0, d1, 'có')
    p.edge(d1, ease, 'có')
    p.edge(d1, delta, 'không')
    p.edge(ease, merge)
    p.edge(delta, merge)
    p.edge(merge, verd)
    p.edge(verd, tear)
    p.edge(tear, no, 'ba tầng chặn độc lập')
    p.node('Nguyên tắc bất di bất dịch: giữ nguyên cơ thể người dùng, chỉ đổi cách vải ôm và rủ.\n'
           'Không làm người gầy đi cho vừa áo nhỏ, cũng không làm người to ra cho vừa áo rộng.\n'
           'Với đồ bơi và đồ hở, một vết bục đồng nghĩa với làm lộ thêm cơ thể, nên bị cấm tuyệt đối.',
           250, 700, 850, 70, 'note')
    write(OUT / 'D20-quyet-dinh-do-vua-van.drawio', p)


def main():
    for fn in (d01_architecture, d02_deployment, d03_uc_overview, d04_uc_customer, d05_uc_admin,
               d06_uc_tryon, d07_uc_travel, d08_uc_order, d09_uc_moderation, d10_seq_login,
               d11_seq_order, d12_seq_tryon, d13_seq_motion, d14_seq_travel, d15_seq_moderation,
               d16_seq_reco, d17_body_pipeline, d18_reco_pipeline, d19_gpu, d20_fit):
        fn()
        print('ok', fn.__name__)


if __name__ == '__main__':
    main()
