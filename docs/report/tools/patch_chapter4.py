#!/usr/bin/env python3
"""Vá Chương 4 của báo cáo JAPANO về đúng MỘT mô hình 19 bảng.

Bản cũ trình bày ba con số cùng lúc (19 bảng logic, 24 quan hệ, 30 collection
vật lý) rồi giải thích vì sao cả ba đều đúng. Cách kể đó chính xác về kỹ thuật
nhưng buộc người đọc phải giữ hai danh mục trong đầu, và phần "danh mục
collection vật lý" kéo câu chuyện ra khỏi mô hình nghiệp vụ.

Bản vá này giữ nguyên tiêu đề chương, 4.1, 4.7 trở đi và mọi nội dung không liên
quan. Nó chỉ sửa đúng các đoạn cơ sở dữ liệu, và sửa TẠI CHỖ: đổi chữ trong ô
bảng và trong đoạn văn có sẵn thay vì xoá rồi dựng lại, để style, đánh số, mục
lục và các tham chiếu chéo không bị động tới.

MongoDB Atlas vẫn là nguồn dữ liệu chạy thật; báo cáo và MongoDB Compass chỉ
trình bày mô hình 19 bảng này.
"""
import sys
from copy import deepcopy
from docx import Document

DOC = ('/home/nhat/Downloads/japano/'
       'Thầy Nguyễn Ngọc Chấn_Phát triển ứng dụng thương mại điện tử thời trang JAPANO Store (1).docx')

# Sáu cụm nghiệp vụ, tổng đúng 19 bảng.
CLUSTERS = [
    ('Tài khoản và cá nhân hoá', '4',
     'users, profiles, addresses, interactions'),
    ('Danh mục sản phẩm', '4',
     'categories, products, product_variants, product_media'),
    ('Ý định mua sắm', '2',
     'cart_items, wishlist_items'),
    ('Đơn hàng và thanh toán', '4',
     'orders, order_items, payments, return_requests'),
    ('Khuyến mãi và nội dung', '3',
     'vouchers, reviews, notifications'),
    ('Trải nghiệm Nhật Bản và trợ lý', '2',
     'japan_spots, chats'),
]

# 19 bảng: tên kỹ thuật · tên nghiệp vụ · lưu gì · vai trò · nhiệm vụ backend.
TABLES = [
    ('users', 'Tài khoản người dùng',
     'Email, mật khẩu đã băm bcrypt, vai trò, trạng thái, mốc tham gia.',
     'Danh tính gốc của toàn hệ thống.',
     'Xác thực bcrypt + JWT; kiểm quyền theo thang customer < staff < admin < super_admin.'),
    ('profiles', 'Hồ sơ phong cách',
     'Phong cách ưa thích, dịp mặc, số đo do người dùng tự khai.',
     'Đầu vào cá nhân hoá cho gợi ý và tư vấn kích cỡ.',
     'Lưu và đọc hồ sơ; cấp dữ liệu cho bộ gợi ý và trợ lý Ori.'),
    ('addresses', 'Địa chỉ nhận hàng',
     'Người nhận, số điện thoại, địa chỉ, cờ mặc định.',
     'Đích giao hàng của mỗi đơn.',
     'Quản lý sổ địa chỉ; gắn bản sao địa chỉ vào đơn lúc đặt hàng.'),
    ('categories', 'Danh mục sản phẩm',
     'Tên danh mục, tên Nhật, thứ tự hiển thị.',
     'Trục phân loại của toàn bộ catalog.',
     'Phục vụ lọc, điều hướng và giới hạn hai món mỗi danh mục khi gợi ý.'),
    ('products', 'Sản phẩm',
     'Tên, giá niêm yết, mô tả, thẻ phân loại, trạng thái hiển thị.',
     'Thực thể trung tâm của nghiệp vụ thương mại.',
     'Nguồn giá chuẩn: mọi đơn hàng đều tính lại giá từ đây, không tin giá client gửi.'),
    ('product_variants', 'Biến thể sản phẩm',
     'Màu, kích cỡ, tồn kho, giá riêng nếu có.',
     'Nơi giữ tồn kho thật của cửa hàng.',
     'Kiểm tra rồi trừ tồn kho trong một thao tác không thể tách rời khi tạo đơn.'),
    ('product_media', 'Ảnh và video sản phẩm',
     'Đường dẫn Cloudinary, loại tệp, thứ tự hiển thị.',
     'Tách nội dung nặng khỏi bản ghi sản phẩm.',
     'Chỉ lưu URL và metadata; không một byte ảnh nào nằm trong cơ sở dữ liệu.'),
    ('cart_items', 'Giỏ hàng',
     'Người dùng, biến thể đã chọn, số lượng.',
     'Ý định mua hàng chưa chốt.',
     'Khử trùng lặp theo bộ khoá người dùng + sản phẩm + màu + cỡ.'),
    ('wishlist_items', 'Danh sách yêu thích',
     'Người dùng và sản phẩm được lưu.',
     'Tín hiệu quan tâm dài hạn.',
     'Cấp tín hiệu trọng số 3 cho bộ gợi ý; khử trùng lặp theo trạng thái.'),
    ('reviews', 'Đánh giá sản phẩm',
     'Điểm sao, nội dung, media kèm theo, trạng thái kiểm duyệt.',
     'Bằng chứng xã hội đã xác minh mua hàng.',
     'Chỉ mở cho đơn đã hoàn tất; đi qua kiểm duyệt hai tầng luật và mô hình ngôn ngữ.'),
    ('orders', 'Đơn hàng',
     'Mã đơn, tổng tiền, các khoản giảm, trạng thái, lịch sử chuyển trạng thái.',
     'Bản ghi giao dịch của khách.',
     'Trung tâm vòng đời: đặt → giao → hoàn tất, hoặc huỷ và trả hàng.'),
    ('order_items', 'Chi tiết đơn hàng',
     'Ảnh chụp giá, tên, màu, kích cỡ và số lượng tại thời điểm mua.',
     'Giữ đúng điều khoản đã thoả thuận, không đổi theo giá hiện tại.',
     'Cơ sở để tính hoàn tiền cho từng dòng hàng khi khách trả một phần.'),
    ('payments', 'Giao dịch thanh toán',
     'Nhà cung cấp, mã giao dịch, trạng thái, số tiền đã hoàn.',
     'Sổ đối soát với Stripe và VNPay.',
     'Chỉ callback đã kiểm chữ ký mới được đổi trạng thái; redirect chỉ để hiển thị.'),
    ('vouchers', 'Phiếu giảm giá',
     'Mã, loại, giá trị, hạn dùng, giới hạn lượt, phạm vi áp dụng.',
     'Công cụ khuyến mãi và đền bù cho khách.',
     'Thực thi phạm vi sản phẩm; giữ chỗ khi tạo đơn, chỉ tiêu lượt khi tiền thực về.'),
    ('return_requests', 'Yêu cầu huỷ và trả hàng',
     'Món được trả, lý do, số tiền hoàn, trạng thái xử lý.',
     'Quy trình hậu mãi của cửa hàng.',
     'Tính hoàn tiền theo phân bổ từng dòng hàng và nhập lại kho đúng số lượng.'),
    ('interactions', 'Nhật ký hành vi',
     'Loại hành vi, sản phẩm, thời điểm và mức độ.',
     'Nhiên liệu cho toàn bộ phần cá nhân hoá.',
     'Tám loại hành vi có trọng số, suy giảm theo nửa đời 14 ngày.'),
    ('chats', 'Hội thoại với trợ lý',
     'Vai trò, nội dung, ý định nhận diện, độ tin cậy và độ trễ.',
     'Lịch sử trò chuyện và telemetry của trợ lý Ori.',
     'Định tuyến ý định; câu trả lời luôn bám catalog thật, không tự sinh sản phẩm.'),
    ('notifications', 'Thông báo trong ứng dụng',
     'Tiêu đề, nội dung, phân loại và hành động điều hướng.',
     'Kênh báo trạng thái tới người dùng.',
     'Sinh theo sự kiện đơn hàng, khuyến mãi và thông báo hệ thống.'),
    ('japan_spots', 'Địa danh Nhật Bản',
     'Tỉnh, mô tả, ảnh có giấy phép, toạ độ và sản phẩm gợi ý.',
     'Nền tảng cho trải nghiệm du lịch ảo.',
     'Cấp dữ liệu cho gợi ý theo địa điểm và cho bước ghép ảnh vào khung cảnh.'),
]

NAMES = [t[0] for t in TABLES]


def set_cell(cell, text, bold=False):
    """Ghi chữ vào ô mà GIỮ NGUYÊN định dạng của run đầu tiên."""
    para = cell.paragraphs[0]
    if para.runs:
        para.runs[0].text = text
        for extra in para.runs[1:]:
            extra.text = ''
        if bold:
            para.runs[0].bold = True
    else:
        run = para.add_run(text)
        run.bold = bold
    for extra in cell.paragraphs[1:]:
        extra._p.getparent().remove(extra._p)


def resize_rows(table, wanted):
    """Thêm/bớt dòng bằng cách nhân bản dòng có sẵn — giữ đúng style bảng."""
    while len(table.rows) > wanted:
        row = table.rows[-1]._tr
        row.getparent().remove(row)
    while len(table.rows) < wanted:
        clone = deepcopy(table.rows[-1]._tr)
        table.rows[-1]._tr.addnext(clone)


def replace_para(para, text):
    if para.runs:
        para.runs[0].text = text
        for extra in para.runs[1:]:
            extra.text = ''
    else:
        para.add_run(text)


def main():
    doc = Document(DOC)
    ps = doc.paragraphs
    log = []

    def head(i, text):
        replace_para(ps[i], text)
        log.append(f'#{i} tiêu đề → {text}')

    # ---- 4.2 : một mô hình duy nhất -------------------------------------
    head(444, '4.2. Mô hình dữ liệu 19 bảng')
    head(445, '4.2.1. Một mô hình thống nhất cho toàn bộ báo cáo')
    replace_para(ps[446],
        'Toàn bộ phần cơ sở dữ liệu của báo cáo này dùng đúng một mô hình: 19 bảng '
        'nghiệp vụ và 24 quan hệ giữa chúng. Mười chín bảng được chia thành sáu cụm '
        'theo ranh giới sở hữu dữ liệu, và mọi sơ đồ, từ điển dữ liệu cũng như luồng '
        'dữ liệu trong chương này đều chỉ nói về đúng tập bảng đó. Cách trình bày một '
        'mô hình giúp người đọc không phải giữ hai danh mục song song trong đầu khi '
        'theo dõi một luồng nghiệp vụ.')
    replace_para(ps[447], 'Bảng 4.2. Sáu cụm nghiệp vụ và 19 bảng dữ liệu thuộc từng cụm.')

    table = doc.tables[23]
    resize_rows(table, 1 + len(CLUSTERS))
    for col, title in enumerate(('Cụm nghiệp vụ', 'Số bảng', 'Các bảng trong cụm')):
        set_cell(table.rows[0].cells[col], title, bold=True)
    for row, (name, count, members) in zip(table.rows[1:], CLUSTERS):
        set_cell(row.cells[0], name)
        set_cell(row.cells[1], count)
        set_cell(row.cells[2], members)
    log.append(f'bảng #23 → {len(CLUSTERS)} cụm, tổng {sum(int(c[1]) for c in CLUSTERS)} bảng')

    # ---- 4.2.2 : cách kiểm chứng, không công bố danh mục vật lý ----------
    head(450, '4.2.2. Cách kiểm chứng mô hình 19 bảng')
    replace_para(ps[451],
        'Sơ đồ không được phép là một bản vẽ tay tách rời khỏi hệ thống đang chạy. '
        'Trước khi đưa vào báo cáo, tệp ERD được đối chiếu tự động với cơ sở dữ liệu '
        'thật bằng một lượt kiểm tra CHỈ ĐỌC: tập lệnh không ghi, không xoá và không '
        'sửa bất cứ thứ gì. Phép kiểm tra từ chối tệp nếu có bảng vẽ trên sơ đồ nhưng '
        'không tồn tại trong hệ thống, có bảng bị vẽ trùng, hoặc có quan hệ trỏ tới '
        'một bảng không có thật. Backend khi chạy vẫn kết nối MongoDB Atlas qua biến '
        'môi trường; bản sao dùng cho MongoDB Compass chỉ phục vụ trình bày.')
    replace_para(ps[452], 'Bảng 4.3. Kết quả kiểm chứng mô hình dữ liệu, đo ngày 31/08/2026.')
    replace_para(ps[453],
        'Nguồn: scripts/validate_erd_against_atlas.py chạy ở chế độ chỉ đọc ngày '
        '31/08/2026; không có thao tác ghi nào được thực hiện.')

    audit = doc.tables[24]
    for row in audit.rows[1:]:
        if row.cells[0].text.strip().lower().startswith('số collection'):
            set_cell(row.cells[0], 'Số bảng trên mô hình')
            set_cell(row.cells[1], '19')
            set_cell(row.cells[2], 'Khớp đúng tập bảng nghiệp vụ được vẽ trên ERD.')
            log.append('bảng #24: dòng "Số collection = 30" → "Số bảng trên mô hình = 19"')

    # ---- 4.3.2 : đổi tên để không kéo về danh mục vật lý -----------------
    head(465, '4.3.2. Khoá định danh và tham chiếu')

    # ---- 4.4 : danh mục 19 bảng ------------------------------------------
    head(480, '4.4. Danh mục 19 bảng dữ liệu')
    replace_para(ps[481],
        'Bảng dưới đây giải thích từng bảng trong mô hình: tên kỹ thuật dùng trong mã '
        'nguồn, tên nghiệp vụ tiếng Việt, dữ liệu mà bảng đó lưu, vai trò của nó trong '
        'toàn hệ thống và nhiệm vụ chính mà backend thực hiện với bảng đó.')
    replace_para(ps[482], 'Bảng 4.5. Mười chín bảng dữ liệu của JAPANO Store.')
    replace_para(ps[483],
        'Tên kỹ thuật ở cột đầu là tên thật dùng trong mã nguồn và trong MongoDB '
        'Compass, nên có thể tra cứu trực tiếp khi đọc phần cài đặt ở Chương 5.')
    replace_para(ps[484],
        'Sáu cụm ở Bảng 4.2 gom 19 bảng này theo ranh giới sở hữu dữ liệu, còn từ điển '
        'dữ liệu ở mục 4.5 mô tả chi tiết trường của những bảng có cấu trúc đáng chú ý.')

    catalog = doc.tables[26]
    resize_rows(catalog, 1 + len(TABLES))
    headers = ('Bảng', 'Tên nghiệp vụ', 'Lưu dữ liệu gì', 'Vai trò trong hệ thống',
               'Nhiệm vụ chính của backend')
    for col, title in enumerate(headers):
        set_cell(catalog.rows[0].cells[col], title, bold=True)
    for row, item in zip(catalog.rows[1:], TABLES):
        for col, value in enumerate(item):
            set_cell(row.cells[col], value)
    log.append(f'bảng #26 → {len(TABLES)} dòng × {len(headers)} cột')

    # ---- 4.4.1 : thay bài học vận hành bằng nội dung 19 bảng -------------
    head(485, '4.4.1. Cách sáu cụm phối hợp trên một luồng mua hàng')
    replace_para(ps[486],
        'Sáu cụm không hoạt động tách rời. Một lượt mua hàng đi xuyên qua gần như '
        'toàn bộ mô hình theo thứ tự cố định, và nhìn theo thứ tự đó thì vai trò của '
        'từng bảng trở nên rõ ràng hơn là đọc danh mục theo bảng chữ cái.')
    replace_para(ps[487],
        'Khách mở ứng dụng và duyệt catalog: categories dẫn đường, products cấp thông '
        'tin và giá niêm yết, product_variants quyết định màu và cỡ nào còn hàng, '
        'product_media cấp ảnh. Mỗi thao tác chủ ý được ghi vào interactions. Khi khách '
        'lưu món cho lần sau, bản ghi rơi vào wishlist_items; khi khách quyết định mua, '
        'nó rơi vào cart_items. Lúc đặt hàng, orders được tạo cùng các dòng order_items '
        'giữ ảnh chụp giá, addresses cấp địa chỉ giao, vouchers được kiểm tra phạm vi '
        'rồi giữ chỗ, và payments ghi lại giao dịch với cổng thanh toán.')
    replace_para(ps[488],
        'Sau khi nhận hàng, khách có thể viết reviews cho đúng đơn đã hoàn tất, hoặc mở '
        'return_requests để trả một phần và nhận hoàn tiền tính theo từng dòng hàng. '
        'Suốt quá trình đó notifications báo trạng thái, chats lưu các lượt hỏi trợ lý, '
        'profiles tích luỹ dần thông tin phong cách, và japan_spots cấp bối cảnh cho '
        'phần trải nghiệm du lịch ảo. Mười chín bảng, một luồng liền mạch.')

    # ---- 4.5 : chỉnh phạm vi mở đầu --------------------------------------
    for i in range(489, 495):
        text = ps[i].text.strip()
        if text.startswith('Từ điển') or 'từ điển dữ liệu' in text.lower():
            replace_para(ps[i],
                'Từ điển dưới đây mô tả chi tiết các trường của những bảng có cấu trúc '
                'đáng chú ý nhất trong mô hình 19 bảng. Các bảng còn lại có cấu trúc '
                'đủ đơn giản để Bảng 4.5 đã diễn đạt trọn vẹn.')
            log.append(f'#{i} mở đầu 4.5 → phạm vi 19 bảng')
            break

    doc.save(DOC)
    print('\n'.join(log))
    print(f'\nĐÃ VÁ {len(log)} chỗ · tổng 19 bảng: {", ".join(NAMES)}')


if __name__ == '__main__':
    sys.exit(main())
