"""Chương 8 — Kết luận và hướng phát triển."""
from docx.shared import Cm


def build(r):
    r.h1('Kết luận và hướng phát triển')

    r.h2('8.1. Những gì đã hoàn thành')
    r.p('Sau ba tháng, JAPANO là một hệ thống hoàn chỉnh gồm bốn sản phẩm chạy trên cùng một backend. '
        'Phần thương mại đi trọn một vòng đời đơn hàng thật, từ danh mục tới hoàn tiền theo từng dòng '
        'hàng. Phần trí tuệ nhân tạo gồm bốn năng lực tách biệt, mỗi năng lực có bằng chứng đo được và '
        'có ranh giới được nói rõ.')
    r.table(
        'Tổng kết những gì đã hoàn thành, kèm bằng chứng.',
        ['Hạng mục', 'Kết quả', 'Bằng chứng'],
        [
            ['Quy mô mã nguồn', '140 tệp JavaScript ở backend (khoảng 26 900 dòng), 14 tệp Python '
             '(7 800 dòng), 65 tệp TypeScript cho ứng dụng di động (12 550 dòng), 67 tệp cho website '
             '(18 500 dòng), 6 tệp cho trang quản trị (2 470 dòng).',
             'Đếm trực tiếp trên kho mã nguồn ngày 31/08/2026.'],
            ['API', '138 điểm cuối REST trong 19 tệp chia theo miền nghiệp vụ.', 'Phụ lục A.'],
            ['Cơ sở dữ liệu', 'ERD chuẩn gồm đúng 19 bảng và 24 quan hệ; database local dành cho '
             'MongoDB Compass có đúng cùng 19 bảng; backend runtime vẫn kết nối MongoDB Atlas.',
             '`validate_drawio.py`, `sync_compass_presentation_erd19.js` và `/api/health`, 04/09/2026.'],
            ['Kiểm thử', '345 kiểm thử Node đạt toàn bộ, 102 kiểm thử Python (100 đạt, 2 bỏ qua có chủ '
             'đích), 7 kiểm thử đơn vị website, 30 kiểm thử đầu-cuối website.',
             'Nhật ký `docs/report/evidence/npm_check_20260831.log`.'],
            ['Đo cơ thể', 'Sai số đầu-cuối trên 120 người tách danh tính: chiều cao 6,56 cm, cân nặng '
             '9,59 kg, ba vòng 5,70–6,49 cm; độ trễ P50 0,35 giây.',
             '`body_pipeline_testB.json`.'],
            ['Thử đồ', 'Đường ống sinh ảnh thật có cổng chất lượng ba tầng; ca thường 37,9 giây; ma '
             'trận 5 dáng người × 7 size với ảnh kết quả.',
             '`docs/project_evidence/ai_benchmarks/` và `test-results/qa-matrix/`.'],
            ['Fine-tune', 'Một bộ chuyển thể LoRA hạng 8 đã huấn luyện, đã nghiệm thu, có mã băm; hai '
             'checkpoint khác đã bị cổng nghiệm thu loại.',
             '`fit_lora.status.json`.'],
            ['Video chuyển động', 'Nhanh hơn khoảng 5,1 lần so với cấu hình ban đầu mà không hạ một '
             'ngưỡng chất lượng nào.', '`MOTION_INFERENCE_2026-08-29.md`.'],
            ['Website', 'Lighthouse 93–99 hiệu năng, 100 điểm cho khả năng truy cập, thực hành tốt và '
             'SEO; 30/30 kiểm thử đầu-cuối đạt.', '`WEB_STOREFRONT_2026-08-30.md`.'],
            ['Trang quản trị', '16 tuyến đường không còn vi phạm WCAG 2.1 mức A/AA; 15 thuật toán phân '
             'tích chạy trên dữ liệu thật.', 'Mục 5.3 và 6.11.'],
        ],
        widths=[Cm(3.0), Cm(7.4), Cm(5.1)], font=10)

    r.h2('8.2. Giá trị khác biệt')
    r.p('Nếu phải chọn một điều để nói về JAPANO, nhóm sẽ không chọn danh sách mô hình mà chọn điều '
        'này: **hệ thống được xây dựng để biết từ chối**. Ba biểu hiện cụ thể:')
    r.numbers([
        '**Cổng chất lượng sẵn sàng vứt bỏ công sức đã bỏ ra.** Một ảnh thử đồ mất tới bảy mươi giây '
        'GPU vẫn bị huỷ nếu nó làm sai cơ thể khách hoặc phá độ che phủ an toàn. Hình 5.7 ở Chương 5 là '
        'ảnh chụp thật của hành vi này trên điện thoại.',
        '**Trạng thái "chưa đủ bằng chứng" là một trạng thái thật.** Khi manh mối từ ảnh quá yếu, hệ '
        'thống nói ra điều đó và không dùng kết quả để chốt size, thay vì trả một con số trông có vẻ '
        'hợp lý.',
        '**Kỷ luật thuật ngữ được áp dụng nhất quán.** Trong toàn bộ đồ án chỉ có một thành phần được '
        'gọi là đã fine-tune, và ngay cả nó cũng được ghi rõ là **đang tắt ở thời điểm chạy**. Chỉ số '
        'nào chưa đo thì báo là chưa đo.',
    ])
    r.p('Về mặt sản phẩm, điểm khác biệt nằm ở chỗ độ vừa vặn **điều khiển bức ảnh** thay vì chỉ là một '
        'dòng cảnh báo, và ba trải nghiệm — mua sắm, thử trước khi mua, khám phá Nhật Bản — dùng chung '
        'một nguồn dữ liệu nên chúng nuôi lẫn nhau thay vì tồn tại song song.')

    r.h2('8.3. Những giới hạn trung thực')
    r.p('Danh sách đầy đủ nằm ở mục 7.5. Ở đây nhóm nêu năm giới hạn mà nhóm cho là quan trọng nhất, '
        'theo nghĩa chúng ảnh hưởng trực tiếp tới việc hệ thống có thể được dùng thật hay không:')
    r.bullets([
        '**JAPANO chưa phải sản phẩm thương mại.** Thanh toán ở chế độ thử nghiệm, chưa triển khai công '
        'khai, chưa qua kiểm định an ninh độc lập.',
        '**Dữ liệu huấn luyện phi thương mại là rào cản cứng.** Không thể vượt qua bằng kỹ thuật; phải '
        'thay dữ liệu hoặc mua giấy phép.',
        '**Chất lượng hệ gợi ý chưa được đo.** Hệ thống chạy và trả kết quả có vẻ hợp lý, nhưng "có vẻ '
        'hợp lý" không phải một chỉ số.',
        '**Một GPU là nút thắt thông lượng.** Khoảng vài chục lượt tạo ảnh mỗi giờ, và đây là con số '
        'suy từ kiến trúc chứ chưa qua kiểm thử tải.',
        '**Một ảnh không có vật chuẩn không cho số đo chính xác.** Đây là giới hạn vật lý, không phải '
        'lỗi có thể sửa bằng một mô hình tốt hơn.',
    ])

    r.h2('8.4. Bài học kỹ thuật')
    r.p('Năm bài học dưới đây đều đến từ những lỗi thật mà nhóm đã gây ra và phải sửa. Nhóm chọn ghi '
        'lại chúng vì chúng có giá trị hơn danh sách những thứ đã chạy đúng ngay từ đầu.')
    r.numbers([
        '**Một lỗi ở bước đầu của một đường ống sẽ nhân lên ở mọi bước sau.** Sai số chiều cao 40 cm '
        'làm mọi bề ngang quy ra cm sai theo, đẩy véc-tơ đặc trưng lệch miền tám độ lệch chuẩn, khiến '
        'cổng kiểm tra phủ quyết mô hình, và nhánh dự phòng trả ra một con số vô lý. Sửa ở bước cuối là '
        'vô ích; phải quay lại bước đầu.',
        '**Không bao giờ dùng một phép đếm để suy ra trạng thái hệ thống.** Câu hỏi "collection này có '
        'bao nhiêu document" đã bị dùng để trả lời câu hỏi "cơ sở dữ liệu đã khởi tạo chưa", và khi '
        'collection đó bị xoá, phép đếm trả về 0, hệ thống ghi đè cơ sở dữ liệu thật. Một dấu mốc '
        'tường minh là câu trả lời đúng.',
        '**Chỉ số tự động không thay thế được việc nhìn bằng mắt.** Ba phương án tăng tốc video đã qua '
        'cổng chất lượng tự động nhưng bị loại khi xem: một phương án làm động tác trông như đang nhảy, '
        'một phương án làm trang phục nhoè ở góc nghiêng. Cổng tự động lọc được cái sai rõ, không lọc '
        'được cái sai tinh.',
        '**Metadata phải gắn với từng đối tượng, không dùng chung một quy ước.** Quy ước "đặt người ở '
        'giữa, sát đáy khung hình" đúng với ảnh mẫu đầu tiên và sai với gần như mọi ảnh phong cảnh '
        'thật. Một ảnh có giấy phép tốt và độ phân giải cao vẫn có thể vô dụng nếu không ai đứng được '
        'trong đó.',
        '**Một biện pháp bảo mật đặt sai chỗ gây hại thật.** Bộ đếm chống thử mật khẩu hàng loạt áp cho '
        'cả điểm cuối kiểm tra phiên đã làm người dùng thật bị đăng xuất oan. Phạm vi áp dụng quan '
        'trọng ngang bản thân biện pháp.',
    ])

    r.h2('8.5. Bài học sản phẩm')
    r.bullets([
        '**Trung thực về độ bất định là một tính năng, không phải một điểm yếu.** Việc giao diện ghi '
        '"Không đủ dữ liệu" thay vì điền một con số làm cho những con số còn lại đáng tin hơn.',
        '**Số nút bấm ghim trên màn hình tỉ lệ nghịch với khả năng ra quyết định.** Trang chi tiết sản '
        'phẩm được rút xuống đúng hai hành động chính sau một lần rà soát.',
        '**Không hiển thị tiến độ giả.** Một thanh phần trăm bịa ra sẽ làm người dùng mất niềm tin ngay '
        'lần đầu nó chạy tới 99% rồi đứng yên. Hiển thị trạng thái thật khó chịu hơn nhưng trung thực hơn.',
        '**Xoá vĩnh viễn hầu như luôn là quyết định sai trong thương mại điện tử.** Ẩn mềm giữ được '
        'tham chiếu cho đơn hàng, thống kê và danh sách yêu thích cũ.',
    ])

    r.h2('8.6. Lộ trình ba tháng')
    r.p('Lộ trình này nhắm tới mức "sản phẩm khả dụng tối thiểu" ở mục 7.4, và được sắp xếp theo thứ tự '
        'phụ thuộc chứ không theo mức độ thú vị.')
    r.table(
        'Lộ trình ba tháng tiếp theo.',
        ['Tháng', 'Hạng mục', 'Kết quả cần đạt'],
        [
            ['1', 'Đóng các lỗ hổng bảo mật mức cao',
             'Bật lại chính sách chống chèn mã trên trang quản trị sau khi rà các chỗ dựng HTML động; '
             'chuyển thẻ phiên quản trị sang cookie; rà đủ 138 điểm cuối theo bảng đối chiếu phân quyền; '
             'cấu hình danh sách nguồn được phép.'],
            ['1', 'Bổ sung kiểm thử cho phần chạm vào tiền',
             'Kiểm thử tự động cho hai cổng thanh toán và cho luồng hoàn tiền; thiết lập quy trình tích '
             'hợp liên tục chạy toàn bộ bộ kiểm thử.'],
            ['2', 'Đánh giá ngoại tuyến cho hệ gợi ý',
             'Triển khai NDCG@10 và Recall@10 trên khung tách dữ liệu theo thời gian đã có; công bố số '
             'thật thay cho trạng thái `not-measured`.'],
            ['2', 'Sao lưu, giám sát và khôi phục',
             'Sao lưu tự động hằng ngày có kiểm tra khôi phục; giám sát sáu tiến trình với cảnh báo; '
             'quy trình khôi phục sau sự cố được viết ra và diễn tập một lần.'],
            ['2', 'Quyền riêng tư', 'Chính sách quyền riêng tư công bố; cơ chế để người dùng yêu cầu '
             'xoá toàn bộ dữ liệu; nhật ký truy cập dữ liệu nhạy cảm.'],
            ['3', 'Triển khai công khai',
             'Đưa backend ra một địa chỉ công khai có HTTPS; deploy website thật; hoàn tất cấu hình '
             'đăng nhập Google cho web.'],
            ['3', 'Kiểm thử tải và kiểm định an ninh',
             'Đo thông lượng thật của đường ống GPU; mời một bên thứ ba kiểm định an ninh.'],
        ],
        widths=[Cm(1.5), Cm(4.6), Cm(9.4)], font=10)

    r.h2('8.7. Lộ trình sáu tháng và điều kiện thương mại hoá')
    r.table(
        'Lộ trình sáu tháng hướng tới vận hành thương mại.',
        ['Hạng mục', 'Nội dung', 'Vì sao cần'],
        [
            ['Dữ liệu huấn luyện có giấy phép thương mại',
             'Thay VITON-HD và BodyM bằng dữ liệu có giấy phép thương mại, hoặc mua giấy phép sử dụng '
             'riêng; huấn luyện lại bộ chuyển thể LoRA và các hằng số hiệu chuẩn.',
             '**Điều kiện bắt buộc.** Không có cách nào đi vòng bằng kỹ thuật.'],
            ['Nhóm máy chủ GPU có hàng đợi chung',
             'Tách các dịch vụ GPU ra một nhóm máy riêng, backend đẩy công việc vào hàng đợi thay vì '
             'gọi trực tiếp.',
             'Gỡ nút thắt thông lượng lớn nhất. Kiến trúc hiện tại đã sẵn sàng vì các dịch vụ AI không '
             'chạm cơ sở dữ liệu.'],
            ['Thanh toán thật', 'Chuyển Stripe sang chế độ Live và VNPay sang môi trường thật; đối '
             'soát tự động hằng ngày.',
             'Không có doanh thu thật nếu không có bước này.'],
            ['Đánh giá có người tham gia cho phần thử đồ',
             'Thay các chỉ số proxy tự động bằng một cuộc đánh giá có người chấm trên cỡ mẫu đủ lớn.',
             'Tám mẫu của hai danh tính là quá nhỏ để kết luận về chất lượng.'],
            ['Thử nghiệm A/B cho hệ gợi ý',
             'So sánh các cấu hình trọng số trên lưu lượng thật, sau khi đã có đánh giá ngoại tuyến.',
             'Không có A/B thì không biết một thay đổi làm tốt lên hay xấu đi.'],
            ['Mở rộng bộ chuyển thể LoRA ra các danh mục khác',
             'Hiện chỉ phủ danh mục `tops`. Mở rộng đòi hỏi dữ liệu tương ứng cho phần thân dưới và '
             'trang phục liền thân.',
             'Hiệu ứng độ vừa vặn hiện chỉ tốt nhất ở phần thân trên.'],
            ['Khôi phục sau sự cố và cam kết chất lượng dịch vụ',
             'Mục tiêu thời gian khôi phục và mục tiêu điểm khôi phục được viết ra và diễn tập.',
             'Bài học ở mục 4.7.1 cho thấy cái giá của việc thiếu chuẩn bị này.'],
        ],
        widths=[Cm(3.6), Cm(6.4), Cm(5.5)], font=10)

    r.h2('8.8. Lời kết')
    r.p('Câu hỏi mà JAPANO cố gắng trả lời rất đơn giản: làm sao để một người mua quần áo trực tuyến '
        'biết được bộ đồ đó trông thế nào trên chính họ, và size nào là đúng. Câu trả lời hoá ra không '
        'nằm ở việc gọi được nhiều mô hình mạnh, mà ở việc xây dựng đủ số lớp kiểm tra để những mô hình '
        'đó không nói dối.')
    r.p('Phần lớn thời gian của đồ án này không dành cho việc làm cho một tính năng chạy được, mà dành '
        'cho việc làm cho nó **thất bại một cách trung thực** khi nó không nên chạy: một cổng chất '
        'lượng vứt bỏ ảnh vừa mất bốn mươi giây GPU, một trạng thái "chưa đủ bằng chứng" thay cho một '
        'con số dễ nghe, ba tầng chặn độc lập cho một hiệu ứng thị giác, một dòng ghi trong tài liệu '
        'nói rằng chỉ số này chưa đo. Đó là phần công việc ít thấy nhất và, theo đánh giá của nhóm, là '
        'phần đáng giá nhất.')
    r.p('JAPANO ở thời điểm nộp là một hệ thống nghiên cứu và trình diễn hoàn chỉnh, chưa phải một sản '
        'phẩm thương mại. Nhóm biết rõ khoảng cách giữa hai điều đó, đã liệt kê nó thành một danh sách '
        'cụ thể ở mục 7.5, và đã vạch ra con đường đi qua nó ở hai mục vừa rồi. Nhóm cho rằng biết '
        'chính xác mình đang đứng ở đâu là một kết quả có giá trị không kém những gì đã xây dựng được.')
