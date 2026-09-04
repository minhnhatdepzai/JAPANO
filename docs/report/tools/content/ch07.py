"""Chương 7 — Kiểm thử, triển khai, bảo mật và tính khả thi."""
from docx.shared import Cm


def build(r):
    r.h1('Kiểm thử, triển khai, bảo mật và tính khả thi')

    # ============================================================== TESTING
    r.h2('7.1. Kiểm thử')
    r.h3('7.1.1. Kết quả chạy thật trong lần dựng báo cáo')
    r.p('Toàn bộ số liệu trong mục này đến từ một lần chạy thật ngày 31/08/2026 trên máy phát triển, '
        'không lấy lại từ tài liệu cũ. Nhật ký đầy đủ được lưu tại '
        '`docs/report/evidence/npm_check_20260831.log`.')
    r.table(
        'Kết quả các bộ kiểm thử chạy ngày 31/08/2026.',
        ['Bộ kiểm thử', 'Lệnh', 'Kết quả'],
        [
            ['Kiểm thử backend (Node)', '`npm --workspace backend test`',
             '**345/345 đạt**, 0 lỗi, 0 bỏ qua, thời gian 1,88 giây'],
            ['Kiểm tra kiểu TypeScript của ứng dụng di động', '`npm --workspace mobile run typecheck`',
             '**Không lỗi**'],
            ['Kiểm thử Python', '`python3 -m unittest discover -s backend/test/python`',
             '**102 kiểm thử, 100 đạt, 2 bỏ qua có chủ đích**, thời gian 10,88 giây'],
            ['Kiểm tra kiểu TypeScript của website', '`npm --prefix web run typecheck`', '**Không lỗi**'],
            ['Kiểm thử đơn vị website (Vitest)', '`npm --prefix web run test`', '**7/7 đạt**'],
            ['Kiểm tra ERD với cơ sở dữ liệu thật', '`python3 scripts/validate_erd_against_atlas.py`',
             '**ĐẠT** — 1 trang, 19 bảng, 24 quan hệ, không bảng bịa, không bảng trùng, không quan hệ hỏng'],
            ['Kiểm tra nguồn dữ liệu runtime', '`curl http://127.0.0.1:4100/api/health`',
             '**ĐẠT** — backend kết nối MongoDB Atlas, database `japano`'],
            ['Kiểm tra database trình bày trên Compass',
             '`node scripts/sync_compass_presentation_erd19.js`',
             '**ĐẠT** — đúng 19 bảng trùng ERD, dữ liệu nhạy cảm đã được che'],
            ['Chụp màn hình website và trang quản trị', '`node docs/report/tools/capture_screens.js`',
             '**12/12 trang chụp thành công**; 11 trang không có lỗi console'],
        ],
        widths=[Cm(4.2), Cm(5.4), Cm(5.9)], font=10,
        note='Toàn bộ chạy trên máy phát triển Linux, Node v22.23.1, Python 3.11.9, ngày 31/08/2026.')
    r.p('Cấu trúc của bộ kiểm thử: 39 tệp kiểm thử Node và 8 tệp kiểm thử Python. Website có thêm 15 '
        'kịch bản kiểm thử đầu-cuối cho giao diện và 4 kịch bản riêng cho phần AI thật.')

    r.h3('7.1.2. Sáu loại kiểm thử và ý nghĩa khác nhau của chúng')
    r.p('Gộp mọi thứ vào một con số "số kiểm thử" sẽ che mất điều quan trọng: các loại kiểm thử cho '
        'những mức độ đảm bảo rất khác nhau.')
    r.table(
        'Sáu loại kiểm thử trong dự án và mức độ đảm bảo mà chúng cung cấp.',
        ['Loại', 'Có trong JAPANO', 'Chứng minh được điều gì'],
        [
            ['Kiểm thử đơn vị', 'Có — phần lớn trong 345 kiểm thử Node và 102 kiểm thử Python',
             'Một hàm thuần cho ra kết quả đúng với đầu vào cho trước. Không chứng minh hệ thống chạy được.'],
            ['Kiểm thử tích hợp', 'Có — luồng tạo đơn, tính tiền hoàn, chính sách giao nhận, vòng đời sản phẩm',
             'Nhiều mô-đun phối hợp đúng với nhau.'],
            ['Kiểm thử hợp đồng', 'Có một phần — kiểm thử so trực tiếp bảng địa danh của ứng dụng với '
             'bảng của máy chủ',
             'Hai bên không lệch nhau. Đây là loại kiểm thử phòng đúng lớp lỗi khó phát hiện nhất.'],
            ['Kiểm thử đầu-cuối', 'Có cho website — 30/30 đạt trên hai độ rộng thiết bị',
             'Một người dùng thật đi hết luồng được trên trình duyệt thật.'],
            ['Kiểm thử trên thiết bị thật', 'Có một phần — Redmi Note 8 Pro',
             'Ứng dụng chạy được trên phần cứng thật. **Không thay thế được bằng bất cứ loại nào ở trên.**'],
            ['Kiểm thử khói cho AI thật', 'Có — chạy riêng bằng một cờ môi trường',
             '**Bắt buộc nhận được ảnh hoặc video mở được.** Mã HTTP 200 không được tính là đạt.'],
        ],
        widths=[Cm(3.0), Cm(5.4), Cm(7.1)], font=10)
    r.note('Điểm cuối `/api/health` trả về 200 **không chứng minh** rằng tính năng thử đồ hoạt động. Nó '
           'chỉ chứng minh tiến trình backend còn sống. Một kiểm thử khói thật cho AI phải trả về một '
           'tệp ảnh hoặc video mở được, và bộ kiểm thử của dự án được cấu hình đúng theo yêu cầu đó. '
           'Lần chạy gần nhất: 4/4 đạt — thử đồ trả PNG 641 KB kích thước 1152×1536 trong 57,9 giây, '
           'video trả MP4 438 KB mở được, ghép cảnh trả JPEG 399 KB kèm ghi nguồn, và lệnh huỷ dừng '
           'được công việc đang chạy.', label='Một phân biệt quan trọng')

    r.h3('7.1.3. Những gì bộ kiểm thử chưa phủ')
    r.p('Phần này quan trọng ngang phần trên. Một báo cáo chỉ liệt kê số kiểm thử đã đạt sẽ tạo ấn '
        'tượng sai về mức độ đảm bảo.')
    r.bullets([
        '**Chưa có kiểm thử tự động cho hai cổng thanh toán.** Cả hai tệp xử lý Stripe và VNPay đều '
        'theo cùng kiểu xuất hàm như các tệp đã có kiểm thử, nên việc bổ sung là khả thi — chỉ là chưa '
        'được làm. Đây là khoảng trống đáng lo nhất vì nó nằm ở phần chạm vào tiền.',
        '**Chưa có kiểm thử đầu-cuối cho ứng dụng di động.** Việc kiểm chứng hiện dựa vào thao tác tay '
        'trên thiết bị thật.',
        '**Chưa có quy trình tích hợp liên tục.** Bộ kiểm thử phải được chạy tay trước mỗi lần bàn giao.',
        '**Chưa có kiểm thử tải.** Không có số liệu về khả năng phục vụ đồng thời; mục 7.4 chỉ đưa ra '
        'các giới hạn suy từ kiến trúc, không phải từ đo đạc.',
        '**Chưa đo tỉ lệ chặn nhầm và bỏ lọt của bộ kiểm duyệt** trên một tập có nhãn đủ lớn.',
        '**Chưa đo chất lượng xếp hạng của hệ gợi ý** — trạng thái `not-measured` như đã nêu ở mục 6.8.6.',
    ])
    r.note('Ngày 04/09/2026, thiết bị Redmi Note 8 Pro kết nối ADB đã chạy gói `vn.japano.app`, phiên '
           'bản **1.0.19 (versionCode 20)**. Nhóm mở trực tiếp onboarding, trang chủ, catalog 70 sản '
           'phẩm, chi tiết sản phẩm và đăng nhập trong khi backend dùng MongoDB Atlas; ảnh mới được '
           'đưa vào Chương 1 và Chương 5. Phiên kiểm tra không gỡ ứng dụng, không xoá dữ liệu và không '
           'có thông tin đăng nhập hợp lệ để kiểm chứng lại luồng thử đồ có xác thực.',
           label='Trạng thái xác minh mới nhất trên thiết bị')
    r.p('Khi cập nhật APK, cách cài bắt buộc là **cài đè** thay vì gỡ bản cũ trước, để bảo toàn dữ '
        'liệu ứng dụng. Trong lần cập nhật báo cáo này không cài lại APK; thiết bị đã có đúng bản '
        '1.0.19 và được nối tới backend bằng `adb reverse tcp:4100 tcp:4100`.')

    # ============================================================ DEPLOYMENT
    r.h2('7.2. Triển khai')
    r.h3('7.2.1. Cấu hình hiện tại')
    r.p('JAPANO hiện chạy trên một máy phát triển duy nhất, dùng các dịch vụ người dùng của systemd để '
        'quản lý vòng đời tiến trình. Bảng sau ghi đúng trạng thái quan sát được lúc 11 giờ 57 phút '
        'ngày 31/08/2026.')
    r.table(
        'Cấu hình triển khai và trạng thái đo được.',
        ['Thành phần', 'Địa chỉ', 'Trạng thái'],
        [
            ['Backend REST và Web Admin', 'cổng 4100', 'Đang chạy'],
            ['Website storefront (chế độ phát triển)', 'cổng 4200 trên địa chỉ nội bộ', 'Đang chạy'],
            ['Metro bundler cho ứng dụng di động', 'cổng 8081', 'Đang chạy'],
            ['Dịch vụ phân tích cơ thể', 'cổng 7863', 'Đang chạy, dùng CPU'],
            ['Dịch vụ thử đồ', 'cổng 7862', 'Đang chạy, chỉ chiếm GPU khi được gọi'],
            ['Dịch vụ tạo video', '—', 'Không chạy lúc đo; bật theo yêu cầu'],
            ['Mô hình ngôn ngữ Ollama', 'cổng 11434', 'Cổng đang lắng nghe'],
            ['Truy cập qua tailnet', '`100.69.188.16:4101`', 'Đang lắng nghe; **chỉ trong mạng nội bộ**'],
            ['MongoDB Atlas', 'dịch vụ đám mây', 'Kết nối được, cơ sở dữ liệu `japano`'],
            ['Cloudinary', 'dịch vụ đám mây', 'Kết nối được'],
            ['Stripe', 'chế độ Test', 'Bật'],
            ['VNPay', 'môi trường Sandbox', 'Bật'],
        ],
        widths=[Cm(6.0), Cm(4.4), Cm(5.1)], font=10,
        note='Đo bằng `ss -ltnp`, `systemctl --user list-units` và `GET /api/health` lúc '
             '2026-08-31T11:57+07:00. Phần cứng GPU: NVIDIA GeForce RTX 5060 Ti, 16 311 MiB, driver '
             '595.84, đọc bằng `nvidia-smi`.')
    r.note('**Không có bí mật nào được ghi trong báo cáo này.** Danh sách biến môi trường ở Phụ lục F '
           'chỉ ghi **tên biến** và mục đích, không ghi giá trị. Chuỗi kết nối cơ sở dữ liệu, khoá ký '
           'thẻ phiên, khoá của các cổng thanh toán và thông tin xác thực dịch vụ media đều nằm ngoài '
           'tài liệu.', label='Về bí mật cấu hình')

    r.h3('7.2.2. Ba con đường tới backend và vì sao cần cả ba')
    r.numbers([
        '**Cáp USB với chuyển tiếp cổng.** Đường nhanh nhất khi phát triển. Cần biết một bẫy: trên một '
        'thiết bị Redmi cụ thể, lệnh chuyển tiếp báo thành công nhưng dữ liệu không đi qua. Vì vậy tập '
        'lệnh khởi động phải **dò thật** rồi mới quyết định dùng đường này hay rơi về mạng nội bộ.',
        '**Mạng nội bộ qua Tailscale.** Đường dùng khi không cắm cáp. Website và ứng dụng đều cấu hình '
        'sẵn địa chỉ tailnet.',
        '**Cloudflare Workers.** Đường dự kiến cho website khi triển khai công khai. Hiện mới chỉ dựng '
        'gói và chạy thử khô thành công.',
    ])
    r.p('Có một hạn chế thực tế cần ghi nhận: dịch vụ chuyển tiếp hiện tại cho website là một dịch vụ '
        'tạm của phiên đăng nhập, và nó có thể biến mất sau khi đăng xuất hoặc khởi động lại máy. Việc '
        'cấu hình phục vụ HTTPS cố định chưa làm được vì thao tác đó cần quyền quản trị trên máy này.')

    r.h3('7.2.3. Trạng thái triển khai công khai')
    r.p('Ba việc chưa hoàn thành, và cần nói rõ vì chúng thường bị trình bày quá lời:')
    r.bullets([
        '**Website chưa từng được deploy công khai.** Máy phát triển chưa đăng nhập vào nhà cung cấp, '
        'và backend hiện chỉ truy cập được trong mạng nội bộ nên một bản deploy công khai sẽ không có '
        'dữ liệu để hiển thị.',
        '**Đăng nhập Google trên web chưa từng thành công lần nào** vì thiếu định danh ứng dụng dành '
        'cho web. Việc cấu hình chạy được **không phải** là bằng chứng đăng nhập thành công.',
        '**Chưa có một giao dịch thanh toán hoàn chỉnh nào được thực hiện từ website.** Các luồng thanh '
        'toán đã chạy từ ứng dụng di động ở chế độ thử nghiệm.',
    ])

    # ============================================================== SECURITY
    r.h2('7.3. Bảo mật')
    r.p('Mục này trình bày cả những gì đã làm và những gì còn hở. Nhóm cho rằng một bản rà soát bảo mật '
        'chỉ liệt kê ưu điểm thì không phải là một bản rà soát bảo mật.')
    r.h3('7.3.1. Những biện pháp đã có')
    r.table(
        'Các biện pháp bảo mật đã được triển khai.',
        ['Biện pháp', 'Cách triển khai', 'Đánh giá'],
        [
            ['Băm mật khẩu', '`bcryptjs`, hệ số công việc 10',
             'Đạt. Hàm băm chậm có chủ đích, chống thử hàng loạt.'],
            ['Phiên đăng nhập', 'JWT có chữ ký, mang vai trò, có thời hạn',
             'Đạt cho quy mô hiện tại. Hạn chế: **không thu hồi được tức thì** trước khi hết hạn.'],
            ['Phân quyền theo vai trò', 'Bốn mức, middleware riêng cho từng nhóm điểm cuối',
             'Đạt về thiết kế; xem phần lỗ hổng bên dưới về việc áp dụng chưa đồng đều.'],
            ['Bảo vệ thẻ phiên trên trình duyệt', 'Cookie `HttpOnly`, `SameSite=Lax` qua lớp BFF',
             'Đạt cho website. **Trang quản trị thì không** — xem bên dưới.'],
            ['Chống giả mạo yêu cầu chéo trang', 'Kiểm tra `Origin` trên mọi thao tác ghi ở lớp BFF',
             'Đạt cho website.'],
            ['Chặn đường dẫn nhạy cảm ở lớp proxy', 'Bảy nhóm đường dẫn trả 404 ngay tại BFF',
             'Đạt. Đây là lớp phòng thủ thứ hai độc lập với phân quyền của backend.'],
            ['Giới hạn tần suất', '600 lần/5 phút cho toàn API; 20 lần/15 phút cho các điểm cuối đăng nhập',
             'Đạt, và phạm vi áp dụng đã được thu hẹp đúng chỗ sau một sự cố.'],
            ['Tính toán phía máy chủ', 'Giá, tồn kho, voucher và tổng tiền luôn tính lại',
             'Đạt. Đây là biện pháp quan trọng nhất chống thao túng giá.'],
            ['Xác minh webhook thanh toán', 'Kiểm tra chữ ký của Stripe; ký HMAC với VNPay',
             'Đạt. Chữ ký sai bị từ chối và trạng thái đơn không đổi.'],
            ['Không lưu ảnh cá nhân', 'Ảnh khách bị xoá khi công việc kết thúc; bộ nhớ đệm chỉ cho ảnh mẫu',
             'Đạt và được kiểm chứng bằng logic của khoá bộ nhớ đệm.'],
            ['Chặn SSRF ở điểm cuối ghép ảnh', 'Client chỉ gửi tên địa danh; đường dẫn tra trong bảng '
             'ghi cứng, chỉ HTTPS tới một tên miền',
             'Đạt.'],
            ['Xác minh ảnh mẫu bằng mã băm', 'Máy chủ tự nạp tệp và đối chiếu SHA-256 với bản kê khai',
             'Đạt. Cờ đã duyệt cho nội dung người lớn bám vào phép kiểm tra này.'],
        ],
        widths=[Cm(3.4), Cm(6.2), Cm(5.9)], font=9.5)
    r.p('Một sự cố về giới hạn tần suất đáng được kể lại vì nó cho thấy một biện pháp bảo mật đặt sai '
        'chỗ có thể gây hại. Trước đây, bộ đếm chống thử mật khẩu hàng loạt được áp cho **toàn bộ** '
        'nhóm đường dẫn xác thực, gồm cả điểm cuối kiểm tra phiên. Kết quả: hai mươi lần mở ứng dụng '
        'trong mười lăm phút — hoàn toàn bình thường khi nhiều thiết bị dùng chung một địa chỉ IP ra '
        'Internet — là đủ để nhận mã 429. Ứng dụng hiểu nhầm đó là phiên bị thu hồi và **xoá thẻ phiên '
        'trong kho lưu trữ an toàn**, tức là đăng xuất oan người dùng thật. Cách sửa là thu hẹp phạm '
        'vi: chỉ những điểm cuối thật sự nhận thông tin đăng nhập mới bị siết.')

    r.h3('7.3.2. Các lỗ hổng và điểm yếu đã biết')
    r.p('Bảng dưới đây liệt kê những gì còn hở, kèm mức độ và hướng khắc phục. Nhóm chọn công bố đầy đủ '
        'thay vì bỏ qua, vì một hệ thống có lỗ hổng được ghi nhận vẫn an toàn hơn một hệ thống có lỗ '
        'hổng không ai biết.')
    r.table(
        'Các lỗ hổng và điểm yếu bảo mật đã biết.',
        ['Vấn đề', 'Mức độ', 'Chi tiết', 'Hướng khắc phục'],
        [
            ['Chính sách chống chèn mã đang tắt trên trang quản trị', '**Cao**',
             'Trang quản trị dựng HTML động ở nhiều chỗ và lưu thẻ phiên trong kho của trình duyệt mà '
             'JavaScript đọc được. Kết hợp hai điều này, một lỗ hổng chèn mã sẽ dẫn thẳng tới lấy được '
             'thẻ phiên quản trị.',
             'Rà toàn bộ các chỗ dựng HTML động, chuyển sang tạo phần tử an toàn, rồi bật lại chính '
             'sách. Song song, chuyển thẻ phiên của trang quản trị sang cookie `HttpOnly`.'],
            ['Chia sẻ tài nguyên giữa các nguồn đang mở mặc định', '**Trung bình**',
             'Khi không cấu hình danh sách nguồn được phép, máy chủ chấp nhận mọi nguồn. Điều này hợp '
             'lý cho môi trường phát triển nhưng không chấp nhận được khi chạy thật.',
             'Đặt biến môi trường liệt kê đúng các tên miền của mình trước khi triển khai công khai. Cơ '
             'chế đã có sẵn trong mã, chỉ cần cấu hình.'],
            ['Kiểm tra loại tệp tải lên dựa trên khai báo', '**Trung bình**',
             'Hệ thống tin vào loại tệp mà client khai báo thay vì kiểm tra các byte đầu của tệp.',
             'Bổ sung kiểm tra chữ ký byte đầu tệp và giới hạn kích thước ở tầng máy chủ.'],
            ['Tồn kho không được hoàn lại cho đơn trực tuyến bị bỏ dở', '**Trung bình**',
             'Khi khách tạo đơn thanh toán trực tuyến rồi không hoàn tất, số lượng đã trừ không tự '
             'quay lại kho. Đây là lỗi nghiệp vụ hơn là lỗ hổng, nhưng nó gây thiệt hại thật.',
             'Thêm một tác vụ định kỳ thu hồi đơn quá hạn và hoàn tồn kho, kèm thời hạn giữ hàng rõ ràng.'],
            ['Bí mật của môi trường thử nghiệm ghi cứng trong mã', 'Thấp',
             'Có một khoá của môi trường sandbox thanh toán được ghi làm giá trị dự phòng trong mã '
             'nguồn. Đây là thông tin công khai của môi trường thử nghiệm, không phải rò rỉ khoá thật.',
             'Chuyển hẳn sang biến môi trường và bỏ giá trị dự phòng.'],
            ['Áp dụng phân quyền chưa đồng đều', '**Cao**',
             'Một số điểm cuối tin vào định danh người dùng do client gửi lên thay vì lấy từ thẻ phiên '
             'đã xác thực. Với kiến trúc gắn middleware theo từng route, chỉ cần quên một chỗ là có một '
             'lỗ hổng.',
             'Rà soát toàn bộ 138 điểm cuối theo một bảng đối chiếu, và chuyển sang mô hình mặc định '
             'yêu cầu xác thực, chỉ mở ngoại lệ cho các điểm cuối công khai.'],
            ['Không có chỉ mục TTL cho dữ liệu nhật ký', 'Thấp',
             'Bảng nhật ký hành vi tăng không giới hạn và hiện chỉ có một chỉ mục.',
             'Đặt chỉ mục theo người dùng và một chỉ mục TTL với thời hạn phù hợp chính sách lưu trữ.'],
            ['Chưa có kiểm định an ninh độc lập', '**Cao**',
             'Toàn bộ đánh giá trong mục này do chính nhóm phát triển thực hiện.',
             'Thuê hoặc nhờ một bên thứ ba kiểm định trước khi đưa vào vận hành thật.'],
        ],
        widths=[Cm(3.4), Cm(1.7), Cm(5.4), Cm(5.0)], font=9.5)

    r.h3('7.3.3. Quyền riêng tư và vòng đời dữ liệu ảnh')
    r.p('Ảnh cơ thể là loại dữ liệu nhạy cảm nhất mà hệ thống chạm tới, nên chính sách với nó được viết '
        'ra rõ ràng và được hiện thực hoá trong mã chứ không chỉ trong tài liệu:')
    r.bullets([
        'Ảnh khách gửi lên để thử đồ hoặc đo cơ thể **không bao giờ được ghi vào cơ sở dữ liệu**.',
        'Ảnh đầu vào của một công việc trong hàng đợi bị **xoá khi công việc kết thúc**.',
        'Bộ nhớ đệm kết quả **chỉ áp dụng cho ảnh mẫu do JAPANO dựng**, và khoá của nó gắn với mã băm '
        'của chính ảnh mẫu.',
        'Kết quả mang bất kỳ cảnh báo nào **không bao giờ được lưu**.',
        'Bảng hồ sơ người dùng chỉ lưu **số đo**, không lưu ảnh nguồn.',
    ])
    r.p('Ba việc còn thiếu để chính sách này đủ chuẩn cho vận hành thật: chưa có văn bản chính sách '
        'quyền riêng tư công bố cho người dùng; chưa có cơ chế để người dùng yêu cầu xoá toàn bộ dữ '
        'liệu của mình; và chưa có nhật ký truy cập dữ liệu nhạy cảm.')

    r.h3('7.3.4. Sao lưu và khôi phục')
    r.p('Hiện có tập lệnh sao lưu và khôi phục cho các lần chuyển đổi cơ sở dữ liệu, kèm bản kê khai '
        'mã băm và quyền tệp hạn chế. Tuy nhiên **chưa có sao lưu tự động định kỳ**, và bài học ở mục '
        '4.7.1 cho thấy chính xác cái giá của việc thiếu nó: 263 bản ghi đơn hàng, thanh toán và tương '
        'tác đã mất không khôi phục được vì không bản sao lưu nào chứa chúng. Nguyên tắc rút ra và đã '
        'được áp dụng: **một lần chuyển đổi chạm vào đường ghi toàn cục phải sao lưu toàn bộ cơ sở dữ '
        'liệu, không chỉ những phần nó định đụng tới.**')

    # ============================================================ FEASIBILITY
    r.h2('7.4. Tính khả thi')
    r.p('Mục này phân tách rõ ba mức độ trưởng thành của sản phẩm, vì trình bày một bản demo như một hệ '
        'thống sẵn sàng vận hành là kiểu nói quá phổ biến nhất trong các đồ án về AI.')
    r.table(
        'Ba mức độ trưởng thành và vị trí hiện tại của JAPANO.',
        ['Mức', 'Đặc điểm', 'JAPANO'],
        [
            ['Nghiên cứu / trình diễn', 'Chạy được trên máy của nhóm, dữ liệu thử nghiệm, dùng dữ liệu '
             'huấn luyện phi thương mại, thanh toán ở chế độ thử.',
             '**Đây là vị trí hiện tại.** Tất cả tính năng chạy thật và đo được.'],
            ['Sản phẩm khả dụng tối thiểu', 'Triển khai công khai, thanh toán thật, sao lưu tự động, '
             'giám sát cơ bản, chính sách quyền riêng tư, đã kiểm định an ninh.',
             'Cần thêm khoảng 3 tháng theo lộ trình ở mục 8.6.'],
            ['Vận hành thương mại', 'Chịu tải nhiều người dùng đồng thời, GPU đủ cho nhu cầu thật, dữ '
             'liệu huấn luyện có giấy phép thương mại, khôi phục sau sự cố, có SLA.',
             'Cần thêm ít nhất 6 tháng và một khoản đầu tư hạ tầng đáng kể.'],
        ],
        widths=[Cm(3.4), Cm(6.4), Cm(5.7)], font=10)

    r.h3('7.4.1. Khả thi kỹ thuật')
    r.p('Phần thương mại của hệ thống khả thi rõ ràng: nó chạy thuần CPU, không phụ thuộc phần cứng đặc '
        'biệt, và có thể nhân bản theo chiều ngang bằng cách thêm tiến trình vì trạng thái nằm ở cơ sở '
        'dữ liệu chứ không nằm trong bộ nhớ tiến trình. Nút thắt thật nằm hoàn toàn ở phần AI.')
    r.table(
        'Các nút thắt kỹ thuật của phần AI và mức độ nghiêm trọng.',
        ['Nút thắt', 'Số đo', 'Ý nghĩa'],
        [
            ['Một GPU phục vụ tuần tự', 'Mỗi lượt thử đồ 38–75 giây; mỗi video 58–71 giây',
             '**Nghiêm trọng nhất.** Với một card, khoảng 48–95 lượt thử đồ mỗi giờ ở mức lý thuyết. '
             'Đây là giới hạn suy từ kiến trúc, chưa qua kiểm thử tải thật.'],
            ['Thời gian nạp mô hình khi đổi loại công việc', '8,3 giây riêng cho mô hình video',
             'Xen kẽ thử đồ và tạo video làm giảm thông lượng đáng kể. Đây là lý do chính sách xếp hàng '
             'là "giữ đến khi xong".'],
            ['Bộ nhớ GPU 16 GB', 'Thử đồ ~15 GB, video ~13,5 GB',
             'Không thể chạy song song hai loại công việc trên một card.'],
            ['Khởi động nguội', 'Ca đồ bơi hai mảnh: 58 giây khi bộ nhớ đệm ấm, khoảng 73 giây khi nguội',
             'Người dùng đầu tiên sau một khoảng nghỉ luôn chờ lâu hơn.'],
            ['Phân tích cơ thể trên CPU', '0,35 giây (P50)',
             'Không phải nút thắt. Việc cố ý để nó trên CPU giúp nó không tranh GPU với thử đồ.'],
        ],
        widths=[Cm(3.6), Cm(4.6), Cm(7.3)], font=10)
    r.p('Hướng mở rộng tự nhiên là tách các dịch vụ GPU thành một nhóm máy chủ chuyên dụng có hàng đợi '
        'chung, để backend không còn ràng buộc vào một card cụ thể. Kiến trúc hiện tại đã sẵn sàng cho '
        'việc đó vì các dịch vụ AI vốn không có kết nối cơ sở dữ liệu và chỉ nhận ảnh, trả ảnh.')

    r.h3('7.4.2. Khả thi kinh tế')
    r.p('Nhóm không đưa ra một bảng chi phí bằng tiền cụ thể, vì mọi con số như vậy sẽ phụ thuộc vào '
        'nhà cung cấp, khu vực và thời điểm — và một con số bịa ra trong một báo cáo kỹ thuật thì tệ '
        'hơn là không có con số nào. Thay vào đó, bảng dưới đây phân tích **cấu trúc chi phí**: khoản '
        'nào tăng theo cái gì, và khoản nào là nút thắt thật.')
    r.table(
        'Cấu trúc chi phí vận hành và yếu tố chi phối từng khoản.',
        ['Khoản chi phí', 'Tăng theo', 'Nhận định'],
        [
            ['GPU cho thử đồ và tạo video', 'Số lượt tạo ảnh và video, không theo số người dùng',
             '**Khoản lớn nhất và khó dự đoán nhất.** Một GPU 16 GB phục vụ được vài chục lượt mỗi giờ; '
             'nhu cầu thật vượt qua mức đó là phải thuê thêm card, và chi phí tăng theo bậc thang chứ '
             'không tuyến tính.'],
            ['Lưu trữ media', 'Số sản phẩm và số ảnh trên mỗi sản phẩm',
             'Nhẹ và dự đoán được, vì hệ thống **không lưu ảnh do AI sinh ra**. Đây là một lợi ích chi '
             'phí trực tiếp của chính sách quyền riêng tư ở mục 7.3.3.'],
            ['Cơ sở dữ liệu', 'Số document và đặc biệt là số collection và chỉ mục',
             'Rất nhẹ ở quy mô hiện tại (2 212 document). Cần nhớ chi phí cố định khoảng 36 KB cho mỗi '
             'collection và mỗi chỉ mục — nên bảng nhật ký hành vi là khoản sẽ tăng nhanh nhất.'],
            ['Băng thông', 'Lưu lượng truy cập và kích thước ảnh',
             'Có thể giảm đáng kể bằng cách chuyển thumbnail sang định dạng ảnh hiện đại; một lần đo '
             'ước tính còn tiết kiệm được khoảng 1,8 MB mỗi trang.'],
            ['Vận hành', 'Số dịch vụ phải theo dõi',
             'Sáu tiến trình. Cần công cụ giám sát tự động trước khi có người dùng thật.'],
        ],
        widths=[Cm(3.6), Cm(4.6), Cm(7.3)], font=10)

    r.h3('7.4.3. Rào cản pháp lý và giấy phép')
    r.p('Đây là rào cản **cứng** nhất giữa JAPANO hiện tại và một sản phẩm thương mại, và nó không thể '
        'giải quyết bằng kỹ thuật:')
    r.bullets([
        'VITON-HD (`CC-BY-NC-SA-4.0`) và BodyM (`CC-BY-NC-4.0`) đều là dữ liệu **phi thương mại**. Bộ '
        'chuyển thể LoRA, các hằng số hiệu chuẩn hình học và hiệu chuẩn dân số đều thừa hưởng ràng '
        'buộc đó.',
        'Phần suy từ ANSUR II (`CC0-1.0`) thì **không** bị ràng buộc — nghĩa là ba bộ hồi quy chính của '
        'phần đo cơ thể có thể dùng thương mại.',
        'Để thương mại hoá, cần **thay dữ liệu huấn luyện bằng nguồn có giấy phép thương mại** rồi '
        'huấn luyện lại, hoặc mua giấy phép sử dụng riêng. Đây không phải việc nhỏ.',
        'Ảnh nền các địa danh lấy từ nguồn mở và luôn hiển thị kèm ghi nguồn; điều kiện của từng giấy '
        'phép phải được rà lại khi dùng cho mục đích thương mại.',
    ])

    r.h2('7.5. Tổng hợp giới hạn hiện tại')
    r.p('Bảng dưới đây tập hợp toàn bộ giới hạn đã nêu rải rác trong báo cáo, để người đọc có một chỗ '
        'duy nhất để tra cứu.')
    r.table(
        'Tổng hợp các giới hạn của JAPANO tại thời điểm nộp báo cáo.',
        ['Giới hạn', 'Mức ảnh hưởng', 'Mục liên quan'],
        [
            ['Đây là sản phẩm nghiên cứu và trình diễn, **chưa phải sản phẩm thương mại**.',
             'Toàn hệ thống', '7.4'],
            ['Một ảnh không có vật chuẩn không cho được số đo tuyệt đối chính xác; sai số công bố là '
             'sai số thật và phải đọc như một khoảng.', 'Đo cơ thể', '6.2'],
            ['Chế độ trang phục phom rộng chưa đo được vì không có bộ dữ liệu phù hợp.', 'Đo cơ thể', '6.2.8'],
            ['Sai số tách nền trên ảnh thật chưa nằm trong bất kỳ con số nào.', 'Đo cơ thể', '6.2.8'],
            ['Kết quả ở nam kém hơn ở nữ; nguyên nhân chưa điều tra.', 'Đo cơ thể', '6.2.8'],
            ['Bộ chuyển thể LoRA chỉ phủ danh mục `tops` và **mặc định tắt**.', 'Thử đồ', '6.5'],
            ['Dữ liệu huấn luyện phi thương mại ràng buộc mọi checkpoint phái sinh.', 'Pháp lý', '7.4.3'],
            ['Tạo video chỉ chạy trên máy có CUDA, không có đường lùi CPU.', 'Video', '6.7'],
            ['Chất lượng xếp hạng của hệ gợi ý **chưa được đo**.', 'Gợi ý', '6.8.6'],
            ['Tỉ lệ chặn nhầm và bỏ lọt của bộ kiểm duyệt chưa được đo.', 'Kiểm duyệt', '6.12.5'],
            ['Thanh toán đang ở chế độ thử nghiệm.', 'Thương mại', '7.2.3'],
            ['Website chưa deploy công khai.', 'Triển khai', '7.2.3'],
            ['Đăng nhập Google trên web chưa từng thành công.', 'Xác thực', '7.2.3'],
            ['Còn cảnh báo hydration ở một số trang website trên bản production.', 'Website', '5.2.4'],
            ['Bản Android 1.0.13 chưa được kiểm chứng trực quan trên thiết bị.', 'Ứng dụng di động', '7.1.3'],
            ['Chưa có kiểm thử tự động cho hai cổng thanh toán.', 'Kiểm thử', '7.1.3'],
            ['Chưa có quy trình tích hợp liên tục và chưa có kiểm thử tải.', 'Kiểm thử', '7.1.3'],
            ['Chính sách chống chèn mã đang tắt trên trang quản trị.', 'Bảo mật', '7.3.2'],
            ['Áp dụng phân quyền chưa đồng đều trên toàn bộ điểm cuối.', 'Bảo mật', '7.3.2'],
            ['Tồn kho chưa được hoàn lại cho đơn trực tuyến bị bỏ dở.', 'Thương mại', '7.3.2'],
            ['Chưa có sao lưu tự động, giám sát và quy trình khôi phục sau sự cố.', 'Vận hành', '7.3.4'],
            ['Chưa có chính sách quyền riêng tư công bố và cơ chế xoá dữ liệu theo yêu cầu.',
             'Quyền riêng tư', '7.3.3'],
            ['Chưa có kiểm định an ninh độc lập.', 'Bảo mật', '7.3.2'],
            ['Thông báo đẩy từ xa chưa gửi được do thiếu định danh dịch vụ.', 'Ứng dụng di động', '5.1.10'],
            ['Ba bản ghi tương tác có tham chiếu người dùng treo, đã ghi nhận và chưa xử lý.',
             'Cơ sở dữ liệu', '4.6.2'],
            ['Kho mã nguồn không lưu thông tin tác giả nên không lập được bảng phân công.',
             'Hành chính', '1.7'],
        ],
        widths=[Cm(8.6), Cm(3.6), Cm(3.3)], font=10)
