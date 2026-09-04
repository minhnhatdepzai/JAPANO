"""Chương 1 — Giới thiệu dự án."""
from docx.shared import Cm

from paths import DIAG, SCREEN


def build(r):
    r.h1('Giới thiệu dự án')

    r.h2('1.1. Câu chuyện hình thành JAPANO')
    r.p('JAPANO bắt đầu từ một quan sát rất cụ thể chứ không từ một ý tưởng lớn. Khi khảo sát các ứng '
        'dụng bán quần áo đang có, nhóm nhận thấy hầu hết đều đầu tư rất nhiều vào phần "trưng bày" — '
        'ảnh đẹp hơn, bố cục gọn hơn, hoạt cảnh mượt hơn — và gần như không đầu tư gì vào phần "quyết '
        'định". Người dùng vẫn phải tự đoán hai điều khó nhất: bộ đồ này lên người mình trông thế nào, '
        'và size nào là đúng.')
    r.p('Ý tưởng ban đầu của nhóm khá ngây thơ: dán ảnh sản phẩm lên ảnh người dùng. Nhóm đã thử, và '
        'kết quả tệ đến mức không thể trình bày — trang phục không bám theo tư thế, không có nếp vải, '
        'không có bóng đổ, và trông giống một hình dán hơn là một bộ quần áo. Quan trọng hơn, cách làm '
        'đó **không trả lời được câu hỏi về size**: một hình dán thì mặc size nào cũng như nhau. '
        'Chính thất bại đó định hình toàn bộ hướng kỹ thuật về sau: nếu đã làm thử đồ thì phải sinh ảnh '
        'thật bằng mô hình khuếch tán, và nếu đã sinh ảnh thật thì phải có cơ chế kiểm tra ảnh sinh ra '
        'trước khi cho khách xem.')
    r.p('Nguyên tắc "không dán ảnh" từ đó trở thành một ràng buộc cứng trong mã nguồn: chế độ ghép ảnh '
        'thủ công trong `backend/tryon_preview.py` bị vô hiệu hoá có chủ đích, và khi đường ống GPU '
        'không khả dụng thì hệ thống báo lỗi rõ ràng chứ không âm thầm trả về một ảnh giả.')

    r.h2('1.2. Bài toán của khách hàng')
    r.p('Đặt mình vào vị trí một người đang cân nhắc mua một chiếc haori giá gần hai triệu đồng, các '
        'câu hỏi thực sự trong đầu họ theo thứ tự là:')
    r.numbers([
        'Cái này lên người tôi có hợp không? — Ảnh người mẫu không trả lời được, vì người mẫu không có '
        'dáng của tôi.',
        'Tôi mặc size nào? — Bảng size trả lời được một nửa, nhưng nửa còn lại phụ thuộc vào số đo của '
        'tôi mà tôi thường không biết chính xác.',
        'Nếu chọn sai thì sao? — Chính sách đổi trả trả lời được, nhưng nó là một lời hứa về việc sửa '
        'sai chứ không giúp tránh sai.',
        'Mặc nó ở đâu thì đẹp? — Không ứng dụng nào trả lời, dù đây là câu hỏi khiến người ta thật sự '
        'muốn mua một bộ đồ Nhật Bản.',
    ])
    r.p('JAPANO trả lời câu 1 bằng thử đồ ảo trên ảnh thật của khách, câu 2 bằng ước lượng số đo cộng '
        'với gợi ý size có bằng chứng, câu 3 bằng quy trình trả hàng theo từng dòng được công bố rõ, và '
        'câu 4 bằng tính năng khám phá Nhật Bản kèm ghép ảnh vào cảnh thật.')

    r.h2('1.3. Bài toán của người vận hành cửa hàng')
    r.p('Người bán có một tập câu hỏi hoàn toàn khác, và chúng thường bị các đồ án bỏ quên vì phần '
        'quản trị ít được nhìn thấy hơn phần khách hàng. Trong quá trình xây dựng, nhóm rút gọn chúng '
        'thành bốn nhóm việc mà trang quản trị phải làm được:')
    r.bullets([
        '**Biết chuyện gì đang xảy ra.** Doanh thu hôm nay so với tuần trước, đơn nào đang chờ, sản '
        'phẩm nào sắp hết hàng. Đây là phần dashboard.',
        '**Biết chuyện gì sắp xảy ra.** Tháng sau bán được bao nhiêu, sản phẩm nào sẽ hết hàng trong '
        'hai tuần, khách nào có nguy cơ không quay lại. Đây là phần dự báo và phân khúc — và cũng là '
        'phần dễ bị làm cho có nhất, nên Chương 6 trình bày công thức cụ thể của từng thuật toán thay '
        'vì chỉ khoe biểu đồ.',
        '**Xử lý được việc.** Đổi trạng thái đơn, duyệt yêu cầu trả hàng, hoàn tiền, ẩn một sản phẩm, '
        'duyệt một đánh giá. Mỗi con số trên dashboard phải dẫn tới một hành động làm được ngay.',
        '**Biết hệ thống có khoẻ không.** Cổng thanh toán còn kết nối không, dịch vụ AI nào đang chạy, '
        'GPU có đang bận không. Với một hệ thống có bốn tiến trình AI chạy nền, đây không phải tính '
        'năng phụ.',
    ])
    r.p('Một quyết định thiết kế đáng chú ý ở đây: **sản phẩm không bao giờ bị xoá vĩnh viễn**. Hành '
        'động trên hàng sản phẩm chỉ chuyển giữa `published` và `hidden`. Lý do rất thực tế — một sản '
        'phẩm bị xoá sẽ làm hỏng tham chiếu trong các đơn hàng cũ, trong thống kê và trong danh sách '
        'yêu thích của khách. Để phòng ngừa sâu hơn, ngay cả điểm cuối `DELETE /api/products/:id` cũ '
        'nay cũng chỉ thực hiện thao tác ẩn mềm thay vì xoá bản ghi.')

    r.h2('1.4. Định vị: ba trải nghiệm trong một nền tảng')
    r.p('JAPANO tự định vị bằng ba giá trị dành cho khách hàng, và điều quan trọng là **ba giá trị này '
        'không trùng với ba bề mặt kỹ thuật**. Sự nhầm lẫn giữa hai trục này là một lỗi trình bày phổ '
        'biến, nên bảng dưới đây tách chúng ra.')
    r.table(
        'Phân biệt ba giá trị dành cho khách hàng và ba bề mặt kỹ thuật.',
        ['Trục', 'Thành phần', 'Nội dung'],
        [
            ['Giá trị khách hàng', 'Mua sắm', 'Một cửa hàng thời trang Nhật Bản hoàn chỉnh: danh mục, '
             'biến thể, giỏ hàng, ưu đãi, thanh toán, hậu mãi.'],
            ['Giá trị khách hàng', 'Thử trước khi mua', 'Thử đồ ảo trên ảnh thật, ước lượng số đo, gợi '
             'ý size có bằng chứng, video chuyển động từ chính ảnh đã thử.'],
            ['Giá trị khách hàng', 'Khám phá Nhật Bản', '25 địa danh có metadata thật, gợi ý trang phục '
             'theo địa điểm, ghép ảnh khách vào cảnh thật của nơi đó.'],
            ['Bề mặt kỹ thuật', 'Ứng dụng di động', 'Expo SDK 51 / React Native 0.74, gói `vn.japano.app`, '
             'bản phát hành 1.0.13 (versionCode 14), targetSdk 34.'],
            ['Bề mặt kỹ thuật', 'Website storefront', 'Dự án React 19 độc lập trong `web/`, có cây phụ '
             'thuộc riêng, gọi backend qua lớp BFF cùng gốc.'],
            ['Bề mặt kỹ thuật', 'Web Admin', 'HTML/CSS/JavaScript thuần, không có bước build, phục vụ '
             'trực tiếp từ backend tại đường dẫn `/admin/`.'],
        ],
        widths=[Cm(3.4), Cm(3.4), Cm(8.7)], font=11)
    r.p('Cả ba bề mặt đều mang cả ba giá trị ở mức độ khác nhau. Ứng dụng di động mang đủ ba; website '
        'mang phần mua sắm và thử đồ đầy đủ, phần khám phá Nhật Bản ở mức giới thiệu; trang quản trị '
        'không phục vụ khách hàng mà phục vụ người vận hành. Điều duy nhất chúng bắt buộc phải chia sẻ '
        'là dữ liệu: **một catalog, một kho tài khoản, một kho đơn hàng, một cụm AI**. Không có bản sao '
        'dữ liệu riêng cho client nào — đây là ràng buộc kiến trúc được nói rõ ở Chương 4.')
    r.figure(DIAG / 'D01-kien-truc-tong-the.png',
             'Kiến trúc tổng thể của JAPANO: ba bề mặt client, một backend, một cụm dịch vụ AI cục bộ '
             'và bốn dịch vụ ngoài.',
             source='Nhóm tự vẽ; tệp nguồn `docs/report/diagrams/D01-kien-truc-tong-the.drawio`.',
             width_cm=15.5)

    r.h2('1.5. Mục tiêu chức năng và phi chức năng')
    r.h3('1.5.1. Mục tiêu chức năng')
    r.p('Mục tiêu chức năng được nhóm viết dưới dạng "hệ thống phải làm được X", và mỗi mục đều có ít '
        'nhất một điểm cuối REST hoặc một màn hình tương ứng trong mã nguồn. Chương 5 trình bày chi '
        'tiết từng nhóm; ở đây chỉ liệt kê để định khung.')
    r.bullets([
        'Quản lý danh mục sản phẩm nhiều biến thể (màu, size) với tồn kho theo từng biến thể.',
        'Giỏ hàng hoạt động cho cả khách chưa đăng nhập, có hợp nhất vào tài khoản sau khi đăng nhập.',
        'Ba phương thức thanh toán: COD, thẻ qua Stripe, và VNPay.',
        'Vòng đời đơn hàng đầy đủ tới trả hàng theo từng dòng và hoàn tiền theo từng dòng.',
        'Đánh giá chỉ mở cho người đã thật sự mua sản phẩm đó.',
        'Thử đồ ảo, ước lượng số đo, gợi ý size, và tạo video chuyển động.',
        'Trợ lý hội thoại bám vào catalog thật, không bịa giá hay tồn kho.',
        'Gợi ý sản phẩm cá nhân hoá có kèm lý do hiển thị cho khách.',
        'Chương trình khách hàng thân thiết: hạng VIP theo chi tiêu tháng và thẻ Flagcard.',
        'Trang quản trị phân quyền bốn cấp với phân tích, dự báo và đối soát thanh toán.',
    ])
    r.h3('1.5.2. Mục tiêu phi chức năng')
    r.table(
        'Mục tiêu phi chức năng và trạng thái tại thời điểm nộp báo cáo.',
        ['Tiêu chí', 'Mục tiêu đặt ra', 'Trạng thái đo được'],
        [
            ['Thời gian phản hồi API thường', 'Dưới 1 giây cho các điểm cuối đọc dữ liệu',
             '**Đạt** — `/api/stylist/body-analysis` P50 0,35 s; gợi ý theo địa điểm 8 ms khi tính mới, '
             '25 ms khi trúng cache.'],
            ['Thời gian sinh ảnh thử đồ', 'Không đặt mục tiêu cứng; phải trung thực về thời gian chờ',
             '**Đạt một phần** — 37,9 s cho ca thường, 57,9 s cho hồ sơ chất lượng cao, khoảng 73 s cho '
             'ca đồ bơi hai mảnh khi cache nguội. Không có thanh phần trăm giả.'],
            ['Chạy được khi không có GPU', 'Toàn bộ phần thương mại và quản trị phải hoạt động',
             '**Đạt** — backend, quản trị, gợi ý, phân tích và đường lùi của trợ lý đều chạy trên CPU.'],
            ['Không tràn bộ nhớ GPU', 'Hai mô hình 15 GB và 13,5 GB dùng chung card 16 GB',
             '**Đạt** — bộ điều phối GPU xếp hàng theo màn hình, mục 6.4.6.'],
            ['Bảo mật xác thực', 'Mật khẩu băm, phiên có chữ ký, phân quyền theo vai trò',
             '**Đạt** — bcrypt và JWT; song còn các lỗ hổng đã biết được liệt kê ở mục 7.3.'],
            ['Khả năng kiểm thử tự động', 'Có bộ kiểm thử chạy được bằng một lệnh',
             '**Đạt** — `npm run check`: 345 kiểm thử Node, 102 kiểm thử Python, kiểm tra kiểu TypeScript.'],
            ['Khả năng truy cập (accessibility)', 'Trang quản trị không có lỗi WCAG 2.1 mức A/AA',
             '**Đạt một phần** — 16 route quản trị không còn lỗi axe; website đạt điểm 100 '
             'accessibility trên Lighthouse ở 5 trang, nhưng ứng dụng di động chưa được kiểm định.'],
            ['Sẵn sàng vận hành thật', 'Triển khai công khai, thanh toán thật, sao lưu, giám sát',
             '**Chưa đạt** — xem mục 7.5.'],
        ],
        widths=[Cm(3.4), Cm(4.6), Cm(7.5)], font=10.5,
        note='Số liệu lấy từ lần chạy `npm run check` ngày 31/08/2026 và các tệp bằng chứng trong '
             '`docs/project_evidence/`.')

    r.h2('1.6. Phạm vi đã hoàn thành và chưa hoàn thành')
    r.p('Bảng dưới đây là bảng quan trọng nhất của chương này, vì nó đặt ranh giới cho mọi tuyên bố ở '
        'các chương sau. Nhóm chia trạng thái thành bốn mức thay vì hai, bởi vì "xong" và "chưa xong" '
        'không đủ để mô tả một hệ thống có phần AI: nhiều thứ chạy được nhưng chưa được đo, và đó là '
        'một trạng thái riêng cần được nói ra.')
    r.table(
        'Phạm vi hệ thống theo bốn mức trạng thái.',
        ['Hạng mục', 'Trạng thái', 'Căn cứ'],
        [
            ['Thương mại lõi: catalog, giỏ, voucher, đơn hàng, trả hàng, hoàn tiền, đánh giá',
             'Hoàn thành', 'Điểm cuối đầy đủ, có kiểm thử tự động, đã chạy thật trên thiết bị.'],
            ['Xác thực và phân quyền bốn vai trò', 'Hoàn thành',
             'bcrypt + JWT, middleware `requireAuth`/`requireStaff`/`requireAdmin`/`requireSuperAdmin`.'],
            ['Thử đồ ảo và mô phỏng độ vừa vặn', 'Hoàn thành',
             'Đường ống chạy thật, có cổng chất lượng, có ma trận 5 dáng × 7 size với ảnh kết quả.'],
            ['Ước lượng số đo từ ảnh', 'Hoàn thành, sai số đã công bố',
             'Đo trên BodyM testB 120 người; sai số và giới hạn nêu ở mục 6.2.'],
            ['Video chuyển động', 'Hoàn thành, chỉ chạy trên máy có CUDA',
             'Không có đường lùi CPU; thời gian sinh 58–71 giây tuỳ preset.'],
            ['Gợi ý sản phẩm', 'Hoàn thành phần triển khai, **chưa đo chất lượng xếp hạng**',
             'NDCG@10 và Recall@10 được báo `not-measured` trong chính API chẩn đoán của hệ thống.'],
            ['Trợ lý hội thoại Ori', 'Hoàn thành phần bám dữ liệu; **không có checkpoint riêng**',
             'Định tuyến ý định + truy hồi catalog + quy tắc an toàn; mô hình ngôn ngữ chỉ viết lại câu.'],
            ['Bộ chuyển thể LoRA cho bước mô phỏng độ vừa vặn', 'Đã huấn luyện, **mặc định tắt**',
             '`fit_lora.status.json` ghi ACCEPTED; `/api/health` lúc 31/08/2026 báo `fitLoraPath` rỗng.'],
            ['Website storefront', 'Hoàn thành phần chạy cục bộ, **chưa deploy công khai**',
             'Build và `wrangler deploy --dry-run` chạy được; backend hiện chỉ truy cập được trong tailnet.'],
            ['Thanh toán', 'Chỉ ở chế độ thử nghiệm', 'Stripe Test Mode và VNPay Sandbox.'],
            ['Đăng nhập Google trên website', 'Chưa hoạt động',
             'Thiếu client ID dành cho web; cấu hình chạy được không phải bằng chứng đăng nhập thành công.'],
            ['Kiểm định an ninh độc lập, sao lưu tự động, giám sát vận hành', 'Chưa thực hiện',
             'Xem mục 7.3 và 7.5.'],
        ],
        widths=[Cm(5.6), Cm(4.0), Cm(5.9)], font=10.5)

    r.h2('1.7. Nhân sự và quá trình thực hiện')
    r.p('Đồ án được thực hiện bởi nhóm ba sinh viên dưới sự hướng dẫn của thầy Nguyễn Ngọc Chấn. Kho '
        'mã nguồn ghi nhận 57 lần thay đổi trong khoảng từ ngày 26/06/2026 đến 30/08/2026, chia thành '
        'ba giai đoạn có thể nhận ra rõ qua nội dung các lần ghi nhận: giai đoạn dựng nền thương mại và '
        'trang quản trị (cuối tháng 6 đến giữa tháng 8), giai đoạn xây dựng và tinh chỉnh phần AI '
        '(20–28/08, gồm cả lần huấn luyện LoRA và lần làm lại toàn bộ phần ước lượng số đo), và giai '
        'đoạn hoàn thiện trải nghiệm ba bề mặt cùng cơ sở dữ liệu (28–30/08).')
    r.note('Kho mã nguồn hiện tại **không lưu thông tin tác giả cho từng lần ghi nhận thay đổi** — lệnh '
           '`git shortlog -sne` trả về rỗng. Vì vậy báo cáo không đưa ra bảng phân công nhiệm vụ theo '
           'từng thành viên: một bảng như vậy sẽ là suy đoán chứ không phải bằng chứng. Nhóm cần tự bổ '
           'sung và ký xác nhận bảng phân công trước khi nộp; khung bảng để trống nằm ở Phụ lục H.',
           label='Thông tin cần nhóm bổ sung')
    r.figure(SCREEN / 'mobile-2026-09-04/01-onboarding.png',
             'Giao diện mở đầu “Mặc đẹp theo tinh thần Nhật” của JAPANO trên điện thoại Android thật.',
             source='Ảnh chụp trực tiếp từ Redmi Note 8 Pro ngày 04/09/2026 khi backend đang dùng '
                    'MongoDB Atlas; ứng dụng 1.0.19 (versionCode 20).',
             width_cm=7.2)
