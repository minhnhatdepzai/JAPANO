"""Chương 4 — Kiến trúc hệ thống và cơ sở dữ liệu."""
from docx.shared import Cm

from paths import DIAG, ERD_PNG

DD = [Cm(3.0), Cm(2.0), Cm(1.3), Cm(9.2)]


def _dict_table(r, name, vi_name, purpose, rows, indexes, retention, relations):
    r.h4(f'{name} — {vi_name}')
    r.p(purpose)
    r.table(f'Từ điển dữ liệu collection `{name}`.',
            ['Trường', 'Kiểu', 'Bắt buộc', 'Ý nghĩa · nguồn ghi · nơi đọc'],
            rows, widths=DD, font=10)
    r.bullets([
        f'**Chỉ mục:** {indexes}',
        f'**Vòng đời dữ liệu:** {retention}',
        f'**Quan hệ:** {relations}',
    ])


def build(r):
    r.h1('Kiến trúc hệ thống và cơ sở dữ liệu')

    r.h2('4.1. Nguyên tắc kiến trúc')
    r.p('Kiến trúc của JAPANO được quyết định bởi ba ràng buộc rất cụ thể, chứ không phải bởi một sơ '
        'đồ mẫu chọn sẵn. Việc nêu ba ràng buộc này trước giúp các quyết định ở phần sau trở nên dễ '
        'hiểu, kể cả những quyết định trông có vẻ bảo thủ.')
    r.numbers([
        '**Một GPU 16 GB phải phục vụ hai mô hình lớn.** Mô hình thử đồ chiếm khoảng 15 GB, mô hình '
        'tạo video chiếm khoảng 13,5 GB. Nạp đồng thời là tràn bộ nhớ chắc chắn. Ràng buộc này dẫn '
        'thẳng tới việc mỗi dịch vụ AI là một tiến trình riêng và tới sự tồn tại của bộ điều phối GPU.',
        '**Ba bề mặt client phải nhìn thấy đúng một sự thật.** Nếu website có bản sao catalog riêng thì '
        'ngay khi tồn kho đổi, tính năng thử đồ sẽ bắt đầu nói dối. Ràng buộc này loại bỏ mọi phương án '
        'sao chép dữ liệu cho từng client.',
        '**Phần thương mại phải chạy được khi không có GPU.** Một cửa hàng không thể ngừng bán vì card '
        'đồ hoạ đang bận. Ràng buộc này buộc mọi tính năng AI phải là nhánh phụ có thể tắt, chứ không '
        'nằm trên đường đi chính của luồng mua hàng.',
    ])
    r.p('Kết quả là một kiến trúc mà nhóm gọi là "một lõi, nhiều vệ tinh": một tiến trình Node duy nhất '
        'giữ toàn bộ logic nghiệp vụ và là nơi duy nhất chạm vào cơ sở dữ liệu, còn các dịch vụ AI là '
        'những tiến trình riêng biệt, không có kết nối cơ sở dữ liệu, chỉ nhận ảnh và trả ảnh. Sự tách '
        'bạch này có một lợi ích thực tế mà nhóm chỉ nhận ra khi vận hành: khi một tiến trình AI chết '
        'vì tràn bộ nhớ GPU, cửa hàng vẫn bán hàng bình thường.')

    r.h2('4.2. Các thành phần của hệ thống')
    r.p('Hình 1.1 ở Chương 1 đã trình bày bức tranh tổng thể. Mục này mô tả từng thành phần kèm trạng '
        'thái quan sát được lúc 11 giờ 57 phút ngày 31/08/2026, đo bằng `ss -ltnp` và '
        '`systemctl --user list-units`.')
    r.table(
        'Các tiến trình của hệ thống và trạng thái đo được ngày 31/08/2026.',
        ['Thành phần', 'Tiến trình / cổng', 'Tài nguyên', 'Trạng thái lúc đo'],
        [
            ['Backend REST + Web Admin', '`japano-backend`, `backend/server.js`, cổng 4100', 'CPU',
             'Đang chạy'],
            ['Website storefront (chế độ phát triển)', '`japano-storefront-runtime`, cổng 4200', 'CPU',
             'Đang chạy'],
            ['Metro bundler cho ứng dụng di động', '`japano-metro-runtime`, cổng 8081', 'CPU',
             'Đang chạy'],
            ['Phân tích cơ thể', '`japano-body-analysis`, `body_analysis_service.py`, cổng 7863',
             'CPU — cố ý không chiếm VRAM', 'Đang chạy'],
            ['Thử đồ', '`japano-fashn`, `fashn_service.py`, cổng 7862', 'GPU ~15 GB khi hoạt động',
             'Đang chạy'],
            ['Tạo video chuyển động', '`japano-motion`, `motion_service.py`', 'GPU ~13,5 GB',
             'Không chạy lúc đo — chỉ bật khi có yêu cầu'],
            ['Mô hình ngôn ngữ (tuỳ chọn)', 'Ollama, cổng 11434', 'GPU hoặc CPU',
             'Cổng đang lắng nghe'],
            ['Truy cập qua tailnet', 'Tailscale Serve, `100.69.188.16:4101`', '—',
             'Đang lắng nghe'],
        ],
        widths=[Cm(3.6), Cm(4.6), Cm(3.3), Cm(4.0)], font=10,
        note='Ảnh chụp trạng thái tiến trình lúc 2026-08-31T11:57+07:00. Không có tiến trình nào bị '
             'khởi động hay dừng để phục vụ việc dựng báo cáo.')

    r.h2('4.3. Sơ đồ triển khai')
    r.figure(DIAG / 'D02-trien-khai.png',
             'Sơ đồ triển khai: các dịch vụ systemd trên máy phát triển, thiết bị Android và các dịch '
             'vụ đám mây.',
             source='Nhóm tự vẽ từ trạng thái đo được; tệp nguồn '
                    '`docs/report/diagrams/D02-trien-khai.drawio`.',
             width_cm=15.5)
    r.p('Một chi tiết trên sơ đồ đáng được giải thích: điện thoại có **hai** đường tới backend. Khi cắm '
        'cáp USB, `adb reverse tcp:4100 tcp:4100` chuyển tiếp cổng của máy tính vào thiết bị. Khi không '
        'cắm cáp, ứng dụng gọi tới địa chỉ tailnet. Hai đường này tồn tại song song vì đường thứ nhất '
        'từng thất bại một cách âm thầm trên một thiết bị Redmi cụ thể — lệnh `adb reverse` báo thành '
        'công nhưng dữ liệu không đi qua — nên tập lệnh khởi động buộc phải dò thật rồi mới quyết định '
        'dùng đường nào.')

    r.h2('4.4. Lớp BFF của website và ranh giới bảo mật')
    r.p('Website là bề mặt duy nhất chạy trong trình duyệt của người lạ, nên nó có thêm một lớp riêng. '
        'Trình duyệt chỉ nhìn thấy hai đường dẫn cùng gốc là `/api` và `/media`; nó không bao giờ nói '
        'chuyện trực tiếp với backend. Lớp trung gian này làm bốn việc mà một client gọi thẳng không '
        'làm được:')
    r.bullets([
        '**Giữ token khỏi tầm với của JavaScript.** JWT được tách khỏi phần thân phản hồi và đặt vào '
        'cookie `japano_session` với `HttpOnly` và `SameSite=Lax`.',
        '**Kiểm tra `Origin` trên mọi thao tác ghi.** Yêu cầu đến từ trang khác bị trả 403.',
        '**Chặn cứng các nhóm đường dẫn quản trị.** `admin`, `state`, `seed`, `reset`, `analytics`, '
        '`users`, `payments` bị trả 404 ngay tại lớp proxy, tức là trình duyệt không có cách nào chạm '
        'tới chúng kể cả khi biết đường dẫn.',
        '**Kiểm soát nguồn ảnh bên ngoài.** Ảnh Wikimedia của các địa danh Nhật Bản đi qua '
        '`/media/wikimedia/<path>` với tên máy chủ đích ghi cứng trong mã. Việc này vừa đóng đường '
        'SSRF, vừa bỏ được cookie bên thứ ba, vừa cho phép kiểm soát bộ nhớ đệm. Phần ghi nguồn ảnh '
        'vẫn hiển thị nguyên vẹn.',
    ])

    r.h2('4.5. Phạm vi cơ sở dữ liệu trong báo cáo')
    r.h3('4.5.1. Một mô hình thống nhất gồm 19 bảng')
    r.p('Toàn bộ phần trình bày cơ sở dữ liệu trong báo cáo này dùng đúng một phạm vi thống nhất: '
        '**19 bảng nghiệp vụ** trên ERD chuẩn. Mỗi bảng tương ứng với một collection được chọn để '
        'giải thích luồng người dùng, catalog, đơn hàng, thanh toán, hậu mãi, gợi ý và địa danh Nhật '
        'Bản. Không dùng một sơ đồ khác và không đổi số lượng bảng giữa các chương.')
    r.table(
        'Các tiêu chí bắt buộc của mô hình dữ liệu dùng trong báo cáo.',
        ['Tiêu chí', 'Giá trị', 'Cách kiểm chứng'],
        [
            ['Số bảng', '**19 bảng**', 'Đếm trực tiếp trong `JAPANO_ERD.drawio`.'],
            ['Số quan hệ', '**24 quan hệ**', 'Mỗi đường nối phải bắt đầu ở đúng dòng FK và kết thúc ở '
             'đúng dòng PK logic.'],
            ['Ngôn ngữ', 'Nhãn nghiệp vụ tiếng Việt', 'Tên collection kỹ thuật được ghi cạnh tên bảng '
             'để đối chiếu với mã nguồn.'],
            ['Bản trình bày', '`japano_presentation_19` trên MongoDB local', 'Mở bằng MongoDB Compass; '
             'database này chỉ dùng khi thuyết trình.'],
            ['Nguồn chạy hệ thống', 'MongoDB Atlas', 'Backend đọc cấu hình `MONGODB_URI`; ứng dụng '
             'không chạy trên database Compass dùng để trình bày.'],
        ],
        widths=[Cm(3.0), Cm(4.2), Cm(8.3)], font=10.5)
    r.note('Khi bảo vệ, mở MongoDB Compass tại database `japano_presentation_19` để trình bày đúng 19 '
           'bảng của ERD. Khi chạy ứng dụng, backend vẫn kết nối MongoDB Atlas. Hai mục đích được tách '
           'rõ để thao tác trình bày không làm thay đổi dữ liệu đang phục vụ hệ thống.',
           label='Quy ước trình bày và vận hành')

    r.h3('4.5.2. Nguyên tắc kiểm tra tính đúng của 19 bảng')
    r.p('Bộ kiểm tra đọc tên collection và kiểu trường từ MongoDB Atlas, nhưng kết quả trình bày luôn '
        'được chiếu về đúng 19 bảng của ERD. Tập lệnh chỉ đọc không ghi, không xoá và không in giá trị '
        'dữ liệu; nó dùng metadata để phát hiện bảng không tồn tại, trường FK sai tên, đường nối bị '
        'trùng hoặc đầu nối không bám đúng dòng dữ liệu.')
    r.table(
        'Kết quả kiểm tra mô hình 19 bảng dùng trong báo cáo.',
        ['Nội dung kiểm tra', 'Kết quả', 'Ý nghĩa'],
        [
            ['Số trang ERD', '1', 'Chỉ có một nguồn trình bày, không có bản song song.'],
            ['Số bảng', '**19 — ĐẠT**', 'Đủ toàn bộ bảng đã chốt cho báo cáo.'],
            ['Số quan hệ', '**24 — ĐẠT**', 'Không thiếu và không trùng quan hệ.'],
            ['Đầu nối FK → PK', '**ĐẠT**', 'Quan hệ bám đúng dòng trường, không nối chung vào khung bảng.'],
            ['Đối chiếu tên với Atlas', '**ĐẠT**', 'Mỗi collection kỹ thuật trên ERD đều có nguồn dữ '
             'liệu thật khi backend chạy.'],
            ['Bản Compass thuyết trình', '**19 bảng — ĐẠT**', 'Danh sách collection local trùng chính '
             'xác với danh sách trên ERD.'],
        ],
        widths=[Cm(5.0), Cm(3.0), Cm(7.5)], font=10.5,
        note='`python3 scripts/validate_drawio.py JAPANO_ERD.drawio` và '
             '`node scripts/sync_compass_presentation_erd19.js` (dry-run trước khi `--apply`).')

    r.h2('4.6. Sơ đồ thực thể — quan hệ')
    r.p('ERD dưới đây là bản chuẩn duy nhất dùng trong báo cáo và buổi bảo vệ. Mọi nội dung mô tả bảng, '
        'quan hệ và dữ liệu ở các mục sau đều phải quay về sơ đồ này; thay đổi chỉ được chấp nhận khi '
        'bộ kiểm tra vẫn xác nhận đúng 19 bảng và 24 quan hệ.')
    r.landscape()
    r.figure(ERD_PNG,
             'Sơ đồ thực thể — quan hệ của JAPANO: 19 bảng nghiệp vụ logic và 24 quan hệ, nhãn tiếng Việt.',
             source='Tệp nguồn `JAPANO_ERD.drawio`; đã qua `scripts/validate_erd_against_atlas.py` '
                    'với kết quả ĐẠT ngày 31/08/2026.',
             width_cm=23.5, max_height_cm=14.6)
    r.portrait()
    r.p('Bộ kiểm tra ERD không chỉ so tên bảng. Nó từ chối tệp nếu có bảng không tồn tại trên Atlas, có '
        'bảng bị vẽ trùng, có quan hệ trỏ tới bảng không có, hoặc có đường nối gắn ở mức bảng thay vì '
        'gắn đúng vào dòng khoá ngoại và dòng khoá chính. Kết quả chạy ngày 31/08/2026: **1 trang, 19 '
        'bảng, 24 quan hệ, không có bảng bịa, không có bảng trùng, không có quan hệ hỏng — ĐẠT**.')

    r.h3('4.6.1. Sáu cụm nghiệp vụ')
    r.p('Mười chín bảng trên ERD chia thành sáu cụm. Cách chia này không phải để trang trí: nó phản ánh '
        'đúng ranh giới sở hữu dữ liệu trong mã nguồn, và mỗi cụm tương ứng với một hoặc hai tệp route '
        'ở backend.')
    r.table(
        'Sáu cụm nghiệp vụ trên ERD và các bảng thuộc từng cụm.',
        ['Cụm', 'Bảng thuộc cụm', 'Vai trò'],
        [
            ['Danh tính và cá nhân hoá', '`users`, `profiles`, `addresses`',
             'Ai là người dùng, số đo và sở thích của họ, giao hàng tới đâu.'],
            ['Danh mục sản phẩm', '`categories`, `products`, `product_variants`, `product_media`',
             'Cái gì đang được bán, ở những tổ hợp nào, với ảnh và video nào.'],
            ['Ý định mua sắm', '`cart_items`, `wishlist_items`',
             'Ý định chưa cam kết. Tách khỏi đơn hàng vì vòng đời hoàn toàn khác.'],
            ['Đơn hàng, thanh toán và hậu mãi', '`orders`, `order_items`, `payments`, `return_requests`',
             'Cam kết mua đã chốt và toàn bộ dòng tiền theo sau.'],
            ['Hành vi và gợi ý', '`interactions`, `chats`, `notifications`',
             'Nguồn dữ liệu cho hệ gợi ý và cho kênh liên lạc với khách.'],
            ['Khuyến mãi và địa danh Nhật Bản', '`vouchers`, `japan_spots`, `reviews`',
             'Ưu đãi, 25 địa danh và nội dung đánh giá do cộng đồng đóng góp.'],
        ],
        widths=[Cm(3.6), Cm(5.4), Cm(6.5)], font=10.5)
    r.p('Một lựa chọn cần giải thích: `interactions` được vẽ nằm giữa `users` và `products` thay vì đặt '
        'ở rìa sơ đồ. Đó là chủ ý. Bảng này là nguồn hành vi trực tiếp của toàn bộ hệ gợi ý ở Chương 6; '
        'đặt nó ở rìa sẽ khiến người đọc tưởng nó là nhật ký phụ trợ, trong khi thực tế nó là một trong '
        'ba đầu vào xếp hạng, cùng với hồ sơ người dùng và các đơn hàng thành công.')

    r.h3('4.6.2. Khoá định danh và tham chiếu')
    r.p('Trên ERD, mỗi bảng có một dòng đánh dấu PK và một hoặc vài dòng đánh dấu FK. Cần nói rõ hai '
        'điều để không gây hiểu nhầm khi so sánh với cơ sở dữ liệu thật:')
    r.bullets([
        '**Khoá lưu trữ luôn là `_id`.** MongoDB tự tạo và tự đánh chỉ mục trường này cho mọi '
        'document. Các trường `id` trên ERD là khoá nghiệp vụ do ứng dụng đặt, dùng để tham chiếu chéo '
        'và để giữ ổn định khi dữ liệu được đồng bộ giữa các môi trường.',
        '**Khoá ngoại không được cơ sở dữ liệu ép buộc.** MongoDB không có ràng buộc tham chiếu. Điều '
        'này có nghĩa là một tham chiếu treo hoàn toàn có thể tồn tại, và trong thực tế đã tồn tại: '
        'lần kiểm tra toàn vẹn chỉ đọc gần nhất tìm thấy ba bản ghi `interactions` có `userId` không '
        'còn tra ra người dùng nào. Nhóm ghi nhận và **không** xoá chúng trong quá trình viết báo cáo, '
        'vì việc sửa dữ liệu sống không thuộc phạm vi của một lần dựng tài liệu.',
    ])

    r.h3('4.6.3. Ba quyết định mô hình hoá đáng giải thích')
    r.h4('Vì sao dòng hàng lưu ảnh chụp giá, tên và size')
    r.p('`order_items` không lưu một con trỏ tới biến thể rồi tra giá lúc hiển thị. Nó lưu bản sao của '
        'giá, tên sản phẩm, tên màu và size ngay tại thời điểm khách bấm đặt hàng. Lý do là một đơn '
        'hàng là một **sự kiện đã xảy ra trong quá khứ**, và quá khứ không được phép thay đổi khi hiện '
        'tại thay đổi. Nếu lưu con trỏ, thì mỗi lần cửa hàng chỉnh giá hoặc đổi tên sản phẩm, toàn bộ '
        'lịch sử đơn hàng sẽ tự viết lại: hoá đơn cũ hiển thị sai, báo cáo doanh thu sai, và tranh chấp '
        'với khách không có căn cứ nào để giải quyết. Chi phí của quyết định này là dư thừa dữ liệu — '
        'và đó là dư thừa đúng đắn.')
    r.h4('Vì sao cơ sở dữ liệu chỉ lưu URL của ảnh và video')
    r.p('Không một byte ảnh nào nằm trong MongoDB. `product_media` chỉ lưu đường dẫn tới Cloudinary, '
        'loại tệp và thứ tự hiển thị. Ba lý do, xếp theo mức độ quan trọng: cơ sở dữ liệu tài liệu có '
        'giới hạn kích thước document và bị suy giảm hiệu năng rõ rệt khi document phình to; ảnh cần '
        'được phục vụ qua mạng phân phối nội dung có cache chứ không qua tầng ứng dụng; và việc sao '
        'lưu một cơ sở dữ liệu vài trăm ki-lô-byte khác hẳn việc sao lưu vài chục ghi-ga-byte ảnh. '
        'Ảnh nền các địa danh Nhật Bản cũng theo nguyên tắc này — cơ sở dữ liệu lưu URL và phần ghi '
        'nguồn, tệp ảnh nằm ở nguồn có giấy phép của nó.')
    r.h4('Vì sao không lưu mọi kết quả AI')
    r.p('Đây là quyết định gây tranh luận nhiều nhất trong nhóm. Một ảnh thử đồ mất tới bảy mươi giây '
        'GPU để tạo ra; bản năng đầu tiên là lưu lại tất cả. Nhóm quyết định ngược lại, vì hai lý do '
        'khác nhau về bản chất:')
    r.bullets([
        '**Riêng tư.** Ảnh thử đồ của khách là ảnh cơ thể của một người thật. Giữ lại nó tạo ra một '
        'kho dữ liệu nhạy cảm mà đồ án này không có đủ hạ tầng để bảo vệ đúng mức. Chính sách vì vậy '
        'là: ảnh đầu vào của khách bị xoá khi công việc kết thúc, và **không bao giờ** được ghi vào '
        'bộ nhớ đệm.',
        '**Đúng đắn của dữ liệu.** Một ảnh được tạo bằng phiên bản đường ống cũ sẽ che mất mọi cải '
        'tiến về sau. Vì vậy bộ nhớ đệm — chỉ áp dụng cho ảnh mẫu do JAPANO dựng — mang một số hiệu '
        'phiên bản đường ống trong khoá; đổi mô hình hay đổi tham số thì phải tăng số hiệu đó, nếu '
        'không cache cũ sẽ tiếp tục trả ảnh đời trước.',
    ])
    r.p('Kết quả đo được của lựa chọn này khá rõ: một lượt trúng cache trả về trong khoảng **27 mili '
        'giây** so với **40,8 giây** khi phải dựng lại, và hai ảnh giống nhau đến từng byte. Đồng '
        'thời, không có ảnh cá nhân nào nằm lại trên đĩa.')
    r.note('Bốn loại dữ liệu cố ý **không** có collection nào: kết quả ghép ảnh cảnh Nhật Bản, danh '
           'sách gợi ý theo địa điểm, hàng đợi công việc AI bất đồng bộ, và bộ nhớ đệm mô tả sản phẩm '
           'do mô hình sinh. Ba loại đầu là dữ liệu tạm có thể dựng lại; loại cuối là bộ nhớ đệm trong '
           'RAM. Thêm collection cho chúng chỉ làm phình cơ sở dữ liệu mà không đổi lại được gì.',
           label='Những thứ cố ý không lưu')

    r.h2('4.7. Tác dụng, vai trò và nhiệm vụ chính của 19 bảng')
    r.p('Bảng dưới đây là phần thuyết minh trực tiếp cho ERD. "Tác dụng" trả lời bảng lưu dữ liệu gì; '
        '"vai trò" giải thích vị trí của bảng trong hệ thống; "nhiệm vụ chính" nêu thao tác mà '
        'backend thực hiện với dữ liệu đó. Đây cũng là thứ tự nên dùng khi trình bày trên MongoDB '
        'Compass để người nghe đi từ danh tính, qua catalog, tới giao dịch và các tính năng hỗ trợ.')
    r.table(
        'Tác dụng, vai trò và nhiệm vụ chính của đúng 19 bảng trên ERD JAPANO.',
        ['STT · Bảng', 'Tác dụng', 'Vai trò trong hệ thống', 'Nhiệm vụ chính'],
        [
            ['1. `users`\nNgười dùng', 'Lưu tài khoản, email, mật khẩu đã băm, trạng thái và vai trò.',
             'Gốc định danh và phân quyền cho khách hàng, nhân viên, quản trị viên và Super Admin.',
             'Đăng ký/đăng nhập, ký JWT, kiểm tra trạng thái tài khoản và làm khoá cha cho dữ liệu cá nhân.'],
            ['2. `profiles`\nHồ sơ người dùng', 'Lưu hồ sơ phong cách, size quen dùng và số đo do người '
             'dùng tự khai.', 'Nguồn cá nhân hoá và nguồn ưu tiên cao hơn ước lượng từ ảnh.',
             'Cấp dữ liệu cho gợi ý size/phối đồ; không lưu ảnh cơ thể và không biến suy đoán thành số đo thật.'],
            ['3. `addresses`\nĐịa chỉ', 'Lưu nhiều địa chỉ nhận hàng và địa chỉ mặc định của một người.',
             'Cầu nối giữa tài khoản và bước đặt hàng.', 'Tạo/sửa/xoá địa chỉ, chọn nơi giao và chụp '
             'lại thông tin người nhận khi tạo đơn.'],
            ['4. `categories`\nDanh mục sản phẩm', 'Phân nhóm kimono, yukata, áo khoác, trang phục và phụ kiện.',
             'Cấu trúc điều hướng và bộ lọc cấp cao của catalog.', 'Cấp nhãn nhóm cho `products`, hỗ '
             'trợ lọc và bảo đảm mỗi sản phẩm thuộc đúng miền kinh doanh.'],
            ['5. `products`\nSản phẩm', 'Lưu thông tin sản phẩm hiển thị: tên, mô tả, giá, nhãn và trạng thái.',
             'Thực thể trung tâm của catalog; không trực tiếp giữ tồn kho theo màu/size.',
             'Hiển thị danh sách/chi tiết, ẩn hoặc hiện lại sản phẩm và cung cấp đặc trưng cho hệ gợi ý.'],
            ['6. `product_variants`\nBiến thể sản phẩm', 'Lưu tổ hợp màu, kích cỡ, SKU và số lượng tồn.',
             'Đơn vị thật sự được thêm vào giỏ và bán.', 'Kiểm tra tồn kho theo đúng biến thể, trừ/hoàn '
             'tồn và ngăn đặt số lượng vượt quá số đang có.'],
            ['7. `product_media`\nHình ảnh sản phẩm', 'Lưu URL Cloudinary, loại media, thứ tự và cờ ảnh chính.',
             'Lớp trình bày trực quan của sản phẩm; MongoDB chỉ giữ metadata.', 'Chọn ảnh đại diện, '
             'sắp xếp gallery và cung cấp ảnh tham chiếu đã kiểm soát cho luồng thử đồ.'],
            ['8. `cart_items`\nChi tiết giỏ hàng', 'Lưu sản phẩm, biến thể, số lượng và thời điểm cập nhật.',
             'Ý định mua tạm thời trước khi hình thành đơn hàng.', 'Thêm/cập nhật/xoá dòng giỏ, hợp '
             'nhất giỏ sau đăng nhập và chuyển dữ liệu sang bước kiểm tra giá/tồn kho.'],
            ['9. `wishlist_items`\nDanh sách yêu thích', 'Lưu cặp người dùng–sản phẩm đã đánh dấu.',
             'Tín hiệu quan tâm dài hơn một phiên nhưng chưa phải cam kết mua.', 'Bật/tắt yêu thích, '
             'hiển thị bộ sưu tập cá nhân và cung cấp tín hiệu dương cho hệ gợi ý.'],
            ['10. `reviews`\nĐánh giá sản phẩm', 'Lưu số sao, nội dung, trạng thái duyệt và đơn mua liên quan.',
             'Bằng chứng xã hội có điều kiện “đã mua xác thực”.', 'Kiểm tra quyền đánh giá theo từng '
             'đơn, chạy kiểm duyệt, cho phép người vận hành duyệt/từ chối và tổng hợp rating.'],
            ['11. `orders`\nĐơn hàng', 'Lưu mã đơn, người mua, tổng tiền, phương thức, trạng thái và lịch sử.',
             'Cam kết thương mại trung tâm, nối khách hàng với thanh toán và hậu mãi.', 'Tính lại giá '
             'phía server, tạo đơn, điều khiển vòng đời trạng thái và làm nguồn doanh thu/VIP.'],
            ['12. `order_items`\nChi tiết đơn hàng', 'Lưu từng dòng hàng cùng ảnh chụp tên, giá, màu, size và số lượng.',
             'Bảo toàn lịch sử mua dù sản phẩm hiện tại đổi tên hoặc đổi giá.', 'Tính thành tiền từng '
             'dòng, đối chiếu đánh giá đã mua và làm cơ sở hoàn tiền theo phần hàng được chấp nhận.'],
            ['13. `payments`\nThanh toán', 'Lưu giao dịch COD/Stripe/VNPay, trạng thái, số tiền và hoàn tiền.',
             'Sổ chứng từ dòng tiền tách khỏi trạng thái giao vận của đơn.', 'Đối soát callback có chữ '
             'ký, chống cập nhật giả từ client, ghi nhiều sự kiện tiền cho một đơn và theo dõi refund.'],
            ['14. `vouchers`\nPhiếu giảm giá', 'Lưu mã, loại giảm, giá trị, điều kiện, hạn dùng và trạng thái.',
             'Lớp chính sách khuyến mãi được máy chủ kiểm tra.', 'Xác thực quyền sở hữu/phạm vi, tính '
             'mức giảm đúng sản phẩm và quản lý vòng đời giữ chỗ–tiêu thụ–giải phóng.'],
            ['15. `return_requests`\nYêu cầu trả hàng', 'Lưu yêu cầu trả theo từng dòng, lý do, timeline và refund.',
             'Hồ sơ hậu mãi nối đơn hàng với quyết định duyệt và dòng tiền hoàn.', 'Ngăn trả trùng, '
             'kiểm tra thời hạn/chính sách, duyệt hoặc từ chối và ghi số tiền hoàn thực tế.'],
            ['16. `interactions`\nTương tác người dùng', 'Lưu các tín hiệu xem, yêu thích, giỏ, thử đồ và mua.',
             'Nguồn hành vi chính cho cá nhân hoá và phân tích nhu cầu.', 'Gắn trọng số theo loại hành '
             'vi/thời gian, dựng chuỗi và đồ thị người dùng–sản phẩm, không lưu ảnh cá nhân.'],
            ['17. `chats`\nTin nhắn trợ lý', 'Lưu lịch sử hội thoại theo người dùng và vai trò tin nhắn.',
             'Bộ nhớ nhiều lượt cho trợ lý Ori.', 'Khôi phục ngữ cảnh, giải quyết tham chiếu “món đó” '
             'và hỗ trợ truy hồi catalog trước khi mô hình ngôn ngữ viết lại câu trả lời.'],
            ['18. `notifications`\nThông báo', 'Lưu tiêu đề, nội dung, loại, trạng thái tiếp cận và hành động đích.',
             'Kênh phản hồi bất đồng bộ giữa sự kiện nghiệp vụ và khách hàng.', 'Tạo thông báo khi '
             'đơn/voucher/hoàn tiền thay đổi, đánh dấu đã đọc và điều hướng đúng màn hình.'],
            ['19. `japan_spots`\nĐịa điểm Nhật Bản', 'Lưu địa danh, vùng, nội dung, URL ảnh và sản phẩm liên quan.',
             'Nguồn dữ liệu cho trải nghiệm khám phá Nhật Bản và gợi ý theo bối cảnh.', 'Lọc địa điểm, '
             'chấm điểm trang phục phù hợp, tra ảnh nền an toàn và giữ thông tin nguồn/giấy phép.'],
        ],
        widths=[Cm(3.0), Cm(4.0), Cm(4.2), Cm(4.3)], font=8.7)
    r.p('Ba lớp trách nhiệm xuất hiện xuyên suốt bảng trên. Lớp **nguồn sự thật** gồm tài khoản, catalog '
        'và giao dịch; lớp **trạng thái ý định** gồm giỏ và yêu thích; lớp **dữ liệu hỗ trợ quyết định** '
        'gồm tương tác, hội thoại, thông báo và địa điểm. Việc nhận đúng vai trò giúp tránh lỗi dùng '
        'dữ liệu tạm để thay thế chứng từ, hoặc dùng kết quả AI để thay thế thông tin do người dùng khai.')

    r.h2('4.8. Từ điển dữ liệu của các bảng trọng yếu')
    r.p('Sau bảng vai trò đầy đủ của 19 bảng, mục này đi sâu vào trường dữ liệu của các bảng có ảnh '
        'hưởng trực tiếp tới xác thực, giá, tồn kho, thanh toán, riêng tư, gợi ý và trải nghiệm Nhật '
        'Bản. Cột "Bắt buộc" ghi C nếu trường luôn phải có và K nếu tuỳ chọn.')

    _dict_table(r, 'users', 'Người dùng',
        'Bảng gốc của danh tính. Mọi kiểm tra phân quyền đều bắt đầu từ đây.',
        [
            ['`_id`', 'ObjectId', 'C', 'Khoá chính vật lý do MongoDB sinh.'],
            ['`id`', 'string', 'C', 'Khoá nghiệp vụ ổn định, dùng để tham chiếu chéo giữa các collection.'],
            ['`email`', 'string', 'C', 'Định danh đăng nhập, duy nhất. Ghi khi đăng ký; đọc ở mọi lần đăng nhập.'],
            ['`passwordHash`', 'string', 'C', 'Băm bcrypt. **Không bao giờ được trả về trong bất kỳ phản hồi API nào.**'],
            ['`name`', 'string', 'C', 'Tên hiển thị.'],
            ['`role`', 'string', 'C', 'Một trong `customer`, `staff`, `admin`, `super_admin`. Nguồn của toàn bộ phân quyền.'],
            ['`phone`', 'string', 'K', 'Số điện thoại liên hệ, dùng cho đơn hàng.'],
            ['`joinedAt`', 'number', 'C', 'Mốc thời gian tạo tài khoản; đầu vào cho phân tích RFM.'],
            ['`spent`, `orders`', 'number', 'K', 'Số liệu tổng hợp phục vụ hạng VIP; được đối chiếu lại từ `orders`.'],
        ],
        'Duy nhất trên `email`; chỉ mục phụ trên `id` và `role`.',
        'Giữ suốt vòng đời tài khoản. Không có chỉ mục TTL.',
        'Một người dùng có nhiều `addresses`, `orders`, `interactions`, `profiles` (một-một trên thực tế).')

    _dict_table(r, 'products', 'Sản phẩm',
        'Đơn vị hiển thị trong catalog. Không mang tồn kho — tồn kho nằm ở biến thể.',
        [
            ['`id`', 'string', 'C', 'Khoá nghiệp vụ, được dòng hàng và tương tác tham chiếu tới.'],
            ['`slug`', 'string', 'C', 'Định danh thân thiện với URL, dùng làm khoá trong hệ gợi ý.'],
            ['`name`, `kanji`', 'string', 'C/K', 'Tên tiếng Việt và tên chữ Hán của trang phục.'],
            ['`price`, `oldPrice`', 'number', 'C/K', 'Giá bán hiện tại và giá gạch ngang.'],
            ['`cat` / `category`', 'string', 'C', 'Danh mục; có hai thế hệ tên trường do lịch sử dữ liệu.'],
            ['`garmentType`', 'string', 'K', 'Loại trang phục chi tiết; quyết định quy tắc an toàn và quy tắc fit.'],
            ['`tags`, `visualTags`', 'array', 'K', 'Nhãn phong cách; đầu vào của lọc theo nội dung và gợi ý theo địa điểm.'],
            ['`status`', 'string', 'C', '`published` hoặc `hidden`. **Không có trạng thái đã xoá.**'],
            ['`rating`, `sold`', 'number', 'K', 'Điểm đánh giá và số đã bán; đầu vào của điểm nhu cầu.'],
            ['`createdAt`', 'number', 'C', 'Dùng cho thành phần độ mới trong công thức điểm nhu cầu.'],
        ],
        'Duy nhất trên `id` và `slug`; chỉ mục phụ trên `status` và `cat`.',
        'Không xoá vĩnh viễn. Sản phẩm ngừng bán chuyển sang `hidden` để giữ tham chiếu lịch sử.',
        'Một sản phẩm có nhiều `product_variants`, `product_media`, `reviews`, `interactions`.')

    _dict_table(r, 'product_variants', 'Biến thể sản phẩm',
        'Tổ hợp cụ thể của màu và size. Đây mới là thứ có tồn kho, có mã hàng và được đặt mua.',
        [
            ['`productId`', 'string', 'C', 'Khoá ngoại logic tới `products.id`.'],
            ['`colorName`, `colorHex`', 'string', 'K', 'Tên và mã màu (thế hệ dữ liệu cũ).'],
            ['`color`', 'string', 'K', 'Tên màu (thế hệ dữ liệu mới, 36 sản phẩm nhập sau).'],
            ['`size`', 'string', 'C', 'Một trong S, M, L, XL, XXL, XXXL, 4XL, 5XL.'],
            ['`stock`', 'number', 'C', 'Số lượng còn bán. Chỉ được thay đổi phía máy chủ.'],
            ['`sku`', 'string', 'K', 'Mã hàng (thế hệ dữ liệu cũ).'],
            ['`price`', 'number', 'K', 'Giá riêng của biến thể nếu khác giá sản phẩm.'],
        ],
        'Duy nhất trên bộ ba (`productId`, tên màu, `size`); tổng cộng 5 chỉ mục.',
        'Giữ theo vòng đời sản phẩm. Biến thể ngừng bán được đặt tồn kho về 0 thay vì xoá.',
        'Thuộc về một `products`; được `cart_items` và `order_items` tham chiếu tới.')
    r.note('Catalog có **hai thế hệ dữ liệu biến thể**: nhóm cũ dùng `colorName`/`colorHex`/`sku`, còn '
           '36 sản phẩm nhập sau chỉ có `color`/`id`. Đọc thẳng trường thô trong giao diện sẽ cho ra '
           'nhãn "Màu undefined" và khoá React trùng nhau. Website vì vậy chuẩn hoá tại biên trong '
           '`web/lib/product.ts` và các thành phần giao diện chỉ được đọc qua lớp chuẩn hoá đó.',
           label='Bẫy dữ liệu cần biết')

    _dict_table(r, 'orders', 'Đơn hàng',
        'Cam kết mua đã chốt. Là gốc của toàn bộ nhánh hậu mãi và của mọi phép tính doanh thu.',
        [
            ['`id`', 'string', 'C', 'Mã đơn hiển thị cho khách.'],
            ['`userId`', 'string', 'C', 'Khoá ngoại logic tới `users.id`.'],
            ['`status`', 'string', 'C', '`pending`, `confirmed`, `shipping`, `completed`, `cancelled`, `returned`.'],
            ['`total`', 'number', 'C', 'Tổng tiền, **tính lại phía máy chủ** ở bước đặt hàng.'],
            ['`createdAt`', 'number', 'C', 'Trục thời gian cho mọi biểu đồ doanh thu và dự báo.'],
            ['`customer`', 'object', 'C', 'Ảnh chụp thông tin người nhận tại thời điểm đặt.'],
            ['`voucherCode`', 'string', 'K', 'Mã giảm giá đã áp dụng, nếu có.'],
            ['`paymentMethod`', 'string', 'C', '`cod`, `stripe` hoặc `vnpay`.'],
        ],
        'Chỉ mục trên `id`, `userId`, `status` và `createdAt`; tổng cộng 4 chỉ mục.',
        'Giữ vĩnh viễn — là chứng từ kinh doanh.',
        'Một đơn có nhiều `order_items`, một hoặc nhiều `payments`, và có thể có `return_requests`.')

    _dict_table(r, 'order_items', 'Chi tiết đơn hàng',
        'Một dòng hàng. Đây là bảng chứa các ảnh chụp lịch sử được nói tới ở mục 4.6.3.',
        [
            ['`orderId`', 'string', 'C', 'Khoá ngoại logic tới `orders.id`.'],
            ['`productId`', 'string', 'C', 'Tham chiếu tới sản phẩm — nhưng **không** dùng để tra giá.'],
            ['`name`', 'string', 'C', 'Tên sản phẩm **tại thời điểm mua**.'],
            ['`price`', 'number', 'C', 'Đơn giá **tại thời điểm mua**.'],
            ['`qty`', 'number', 'C', 'Số lượng.'],
            ['`size`, `colorName`', 'string', 'C/K', 'Biến thể đã mua, lưu dưới dạng bản sao.'],
            ['`returnedQty`', 'number', 'K', 'Số lượng đã được chấp nhận trả; cơ sở tính tiền hoàn.'],
        ],
        '4 chỉ mục, gồm chỉ mục trên `orderId` và trên `productId`.',
        'Giữ vĩnh viễn cùng đơn hàng.',
        'Thuộc về một `orders`; trỏ tới `products` chỉ để đối chiếu, không để lấy giá.')

    _dict_table(r, 'payments', 'Thanh toán',
        'Sổ chứng từ tiền vào và tiền ra. Tách khỏi đơn hàng vì một đơn có thể có nhiều sự kiện tiền.',
        [
            ['`orderId`', 'string', 'C', 'Khoá ngoại logic tới `orders.id`.'],
            ['`provider`', 'string', 'C', '`cod`, `stripe` hoặc `vnpay`.'],
            ['`status`', 'string', 'C', 'Trạng thái thật do cổng thanh toán xác nhận, không do client báo.'],
            ['`amount`', 'number', 'C', 'Số tiền của sự kiện này.'],
            ['`providerRef`', 'string', 'K', 'Mã tham chiếu bên cổng, dùng để đối soát.'],
            ['`kind`', 'string', 'K', 'Phân biệt thanh toán và hoàn tiền.'],
            ['`createdAt`', 'number', 'C', 'Mốc thời gian của sự kiện.'],
        ],
        '4 chỉ mục; có chỉ mục trên `orderId` và `providerRef` phục vụ đối soát.',
        'Giữ vĩnh viễn — là chứng từ tài chính.',
        'Nhiều `payments` thuộc về một `orders`.')

    _dict_table(r, 'profiles', 'Hồ sơ người dùng',
        'Nơi giữ số đo cơ thể và sở thích. Đây là collection nhạy cảm nhất về mặt riêng tư.',
        [
            ['`userId`', 'string', 'C', 'Khoá ngoại logic tới `users.id`; quan hệ một-một.'],
            ['`height`, `weight`', 'number', 'K', 'Số đo **do người dùng tự nhập**; luôn thắng ước lượng của mô hình.'],
            ['`chest`, `waist`, `hip`', 'number', 'K', 'Ba vòng đo, cũng ưu tiên giá trị tự nhập.'],
            ['`stylePreferences`', 'array', 'K', 'Sở thích phong cách; đầu vào của lọc theo nội dung.'],
            ['`updatedAt`', 'number', 'C', 'Lần cập nhật gần nhất.'],
        ],
        '2 chỉ mục, gồm chỉ mục trên `userId`.',
        'Giữ tới khi người dùng xoá. **Ảnh dùng để ước lượng số đo không bao giờ được lưu ở đây hay ở '
        'bất kỳ đâu.**',
        'Một-một với `users`; là đầu vào của phân tích độ vừa vặn ở mục 6.3.')

    _dict_table(r, 'interactions', 'Tương tác người dùng',
        'Nhật ký hành vi. Collection lớn nhất và tăng nhanh nhất; là nguồn dữ liệu chính của hệ gợi ý.',
        [
            ['`userId`', 'string', 'C', 'Người thực hiện hành vi; có thể là khách vãng lai.'],
            ['`productId`', 'string', 'C', 'Sản phẩm liên quan.'],
            ['`type`', 'string', 'C', '`view`, `search`, `wishlist`, `cart`, `tryon`, `chat`, `goal`, `purchase`.'],
            ['`value`', 'number', 'K', 'Cường độ của tín hiệu; mặc định là 1.'],
            ['`metadata`', 'object', 'K', 'Ngữ cảnh bổ sung; nơi chứa dữ liệu của lịch sử thử đồ sau khi collection riêng bị bỏ.'],
            ['`createdAt`', 'number', 'C', 'Mốc thời gian; dùng cho suy giảm theo nửa đời 14 ngày.'],
        ],
        'Chỉ 1 chỉ mục (`_id`). **Đây là điểm cần cải thiện**: mọi truy vấn theo `userId` hiện phải quét toàn bộ.',
        'Chưa có chính sách xoá theo thời gian. Đây là collection đầu tiên nên đặt chỉ mục TTL khi hệ '
        'thống chạy thật.',
        'Nhiều-nhiều giữa `users` và `products`. Ba bản ghi hiện có `userId` treo — đã được ghi nhận, chưa xử lý.')

    _dict_table(r, 'reviews', 'Đánh giá sản phẩm',
        'Nội dung do người dùng tạo, và vì vậy là nơi duy nhất trong hệ thống cần kiểm duyệt tự động.',
        [
            ['`productId`', 'string', 'C', 'Sản phẩm được đánh giá.'],
            ['`userId`', 'string', 'C', 'Người viết; phải có đơn hoàn tất chứa sản phẩm này.'],
            ['`rating`', 'number', 'C', 'Số sao từ 1 đến 5.'],
            ['`content`', 'string', 'C', 'Nội dung; đi qua bộ kiểm duyệt trước khi hiển thị.'],
            ['`status`', 'string', 'C', '`approved`, `pending` hoặc `rejected`.'],
            ['`moderationScore`', 'number', 'K', 'Điểm mà bộ kiểm duyệt chấm; giữ lại để người vận hành đối chiếu.'],
            ['`createdAt`', 'number', 'C', 'Mốc thời gian.'],
        ],
        '5 chỉ mục, gồm chỉ mục trên `productId`, `userId` và `status`.',
        'Giữ vĩnh viễn kể cả khi bị từ chối, để có thể xem lại quyết định kiểm duyệt.',
        'Thuộc về một `products` và một `users`; có nhiều `review_reactions`.')

    _dict_table(r, 'japan_spots', 'Địa danh Nhật Bản',
        '25 địa danh với metadata phối cảnh. Đây là collection duy nhất mà dữ liệu ảnh hưởng trực tiếp '
        'tới hình học của một bức ảnh được sinh ra.',
        [
            ['`id`, `place`', 'string', 'C', 'Định danh và tên địa danh; client chỉ gửi tên này lên.'],
            ['`prefecture`', 'string', 'C', 'Tỉnh của Nhật Bản.'],
            ['`imageUrl`', 'string', 'C', 'Đường dẫn ảnh nền; **chỉ máy chủ được quyền quyết định giá trị này**.'],
            ['`attribution`', 'string', 'C', 'Phần ghi nguồn và giấy phép ảnh; luôn hiển thị cùng ảnh.'],
            ['`productIds`', 'array', 'K', 'Sản phẩm gắn với địa danh, trỏ tới `products.id` thật.'],
            ['`styleTags`, `seasons`', 'array', 'K', 'Đầu vào cho việc chấm điểm gợi ý trang phục.'],
            ['`modest`', 'boolean', 'K', 'Cờ đánh dấu nơi trang nghiêm; chặn tuyệt đối đồ bơi.'],
        ],
        '5 chỉ mục.',
        'Đồng bộ từ bảng nguồn trong mã nguồn bằng một lệnh chỉ ghi thêm, không xoá collection khác.',
        'Trỏ tới `products`; có nhiều `japan_spot_reviews` và `japan_spot_suggestions`.')

    r.h2('4.9. Cách trình bày 19 bảng trên MongoDB Compass')
    r.p('MongoDB Compass được dùng như công cụ trực quan trong buổi bảo vệ, không phải nơi backend '
        'đọc dữ liệu. Người trình bày kết nối tới `mongodb://127.0.0.1:27017`, chọn database '
        '`japano_presentation_19` và sẽ thấy đúng 19 collection trùng tên với 19 bảng của ERD.')
    r.numbers([
        'Mở nhóm danh tính: `users` → `profiles` → `addresses`, giải thích người dùng là khoá gốc và '
        'số đo tự khai luôn có quyền ưu tiên cao nhất.',
        'Mở nhóm catalog: `categories` → `products` → `product_variants` → `product_media`, chỉ ra '
        'sản phẩm giữ nội dung còn biến thể mới giữ màu, size và tồn kho.',
        'Mở nhóm ý định và cộng đồng: `cart_items`, `wishlist_items`, `reviews`, `interactions`, giải '
        'thích sự khác nhau giữa ý định tạm thời, bằng chứng đã mua và tín hiệu hành vi.',
        'Mở nhóm giao dịch: `orders` → `order_items` → `payments` → `return_requests` → `vouchers`, '
        'theo dõi vòng đời từ chốt giá tới hoàn tiền.',
        'Kết thúc bằng `chats`, `notifications`, `japan_spots` để trình bày trợ lý Ori, kênh thông '
        'báo và trải nghiệm khám phá Nhật Bản.',
    ])
    r.note('Tập lệnh `scripts/sync_compass_presentation_erd19.js` sao chép cấu trúc và dữ liệu cần '
           'trình bày từ Atlas, đồng thời che email, số điện thoại, địa chỉ, mật khẩu băm, số đo và '
           'mã giao dịch. Tập lệnh chỉ cho phép ghi vào máy local và mặc định chạy thử; phải thêm '
           '`--apply` mới ghi. Cấu hình backend không bị thay đổi.',
           label='An toàn dữ liệu khi thuyết trình')
