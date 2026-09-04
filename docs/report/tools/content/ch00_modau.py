"""Phần mở đầu."""
from docx.shared import Cm

from paths import SCREEN


def build(r):
    r.front_h1('Phần mở đầu')

    r.h2('1. Bối cảnh')
    r.p('Mua sắm thời trang trực tuyến ở Việt Nam đã đi qua giai đoạn thuyết phục người dùng rằng '
        'có thể mua quần áo mà không cần đến cửa hàng. Câu hỏi hiện tại không còn là "có dám mua '
        'không" mà là "mua rồi có phải trả lại không". Đó là một câu hỏi rất khác, và nó không được '
        'giải quyết bằng cách thêm ảnh sản phẩm hay viết mô tả dài hơn.')
    r.p('Nguyên nhân nằm ở một khoảng trống mà bản thân định dạng ảnh catalog không thể lấp. Một bức '
        'ảnh catalog cho khách thấy trang phục **trên một người mẫu đã được chọn để mặc vừa bộ đồ đó**: '
        'chiều cao, tỉ lệ cơ thể, thậm chí tư thế đều được sắp đặt để trang phục rơi đẹp nhất. Thứ '
        'khách cần biết lại là điều ngược lại — bộ đồ đó rơi thế nào trên cơ thể của chính họ, và bảng '
        'size kia thì size nào mới đúng. Giữa hai điều đó là một khoảng trống thông tin mà người mua '
        'chỉ có thể lấp bằng cách đặt hàng và thử, tức là bằng chi phí đổi trả.')
    r.p('Với người bán, cùng một khoảng trống ấy hiện ra dưới dạng chi phí. Mỗi đơn bị trả lại là một '
        'lần vận chuyển hai chiều, một lần kiểm tra chất lượng, một sản phẩm quay lại kho có thể không '
        'còn nguyên vẹn, và một khách hàng ít nhiều mất niềm tin. Với thời trang, tỉ lệ đổi trả vì lý '
        'do "không vừa" luôn là nhóm lý do lớn — và đó chính xác là nhóm lý do mà thông tin trước khi '
        'mua có thể làm giảm.')

    r.h2('2. Vì sao là thời trang Nhật Bản')
    r.p('Nhóm chọn thời trang Nhật Bản không phải vì lý do thẩm mỹ đơn thuần mà vì nó tạo ra một bài '
        'toán kỹ thuật thú vị hơn hẳn một cửa hàng áo thun. Trang phục Nhật Bản — kimono, yukata, '
        'haori, hakama, happi — có ba đặc điểm khiến chúng trở thành phép thử tốt cho một hệ thống thử '
        'đồ ảo:')
    r.bullets([
        '**Cấu trúc phức tạp và có quy tắc.** Một chiếc haori có tay áo rộng và độ rủ riêng; một chiếc '
        'kimono có cách vắt vạt và thắt đai không thể sai. Một mô hình sinh ảnh cẩu thả sẽ biến chúng '
        'thành áo khoác bó, và lỗi đó nhìn thấy ngay bằng mắt thường. Điều này buộc hệ thống phải có '
        'cổng kiểm tra cấu trúc trang phục, chứ không chỉ kiểm tra "ảnh có đẹp không".',
        '**Ranh giới văn hoá rõ ràng.** Có những trang phục không được phép gợi ý ở một số bối cảnh. '
        'Đây là ràng buộc nghiệp vụ thật, và nó dẫn thẳng tới các quy tắc lọc trong phần gợi ý theo '
        'địa điểm ở Chương 6.',
        '**Gắn với một câu chuyện có thể kể được.** Một cửa hàng thời trang Nhật Bản có lý do tự nhiên '
        'để nói về Kyoto, Fushimi Inari hay Naoshima. Điều đó mở ra tính năng "Đưa tôi đến đây" — ghép '
        'ảnh khách đã thử đồ vào ảnh thật của một địa danh — thứ vừa là điểm khác biệt sản phẩm, vừa là '
        'một bài toán kỹ thuật độc lập về phối cảnh và phân đoạn ảnh.',
    ])

    r.h2('3. Vấn đề chọn size và chi phí đổi trả')
    r.p('Bảng size là một thoả hiệp. Nó gán một nhãn rời rạc (S, M, L) cho một đại lượng liên tục '
        '(cơ thể người), và hai người cùng được khuyên size L vẫn có thể lệch nhau mười xăng-ti-mét '
        'vòng ngực. Vì vậy một hệ thống chỉ hiển thị bảng size, hoặc chỉ in một dòng cảnh báo "size này '
        'có thể hơi chật", vẫn để nguyên khoảng trống ban đầu: khách phải tự tưởng tượng.')
    r.p('JAPANO chọn cách khác. Độ vừa vặn không dừng ở một dòng chữ mà **điều khiển chính bức ảnh**: '
        'chọn size nhỏ hơn cơ thể thì vải trong ảnh căng lên, đường may bị kéo, và ở mức rất chật thì '
        'trang phục có thể bục một đoạn. Chọn size lớn hơn thì vai trễ xuống, tay áo rộng ra, thân áo '
        'có thêm nếp rủ. Điều quan trọng là các hiệu ứng này được kích hoạt theo **độ chật đo được** '
        'chứ không theo việc cửa hàng còn size hay không — hệ thống không có động cơ nào để nói dối '
        'theo hướng có lợi cho việc bán hàng.')

    r.h2('4. Vì sao kết hợp ba thứ trong một sản phẩm')
    r.p('Một câu hỏi hợp lý là tại sao không làm ba sản phẩm riêng: một cửa hàng trực tuyến, một công '
        'cụ thử đồ, một ứng dụng du lịch. Câu trả lời là ba phần đó chỉ có giá trị khi dùng chung một '
        'nguồn dữ liệu.')
    r.p('Thử đồ chỉ hữu ích khi nó thử **đúng sản phẩm đang bán, đúng size còn hàng**. Một công cụ thử '
        'đồ tách rời phải nhập lại catalog, và ngay khi tồn kho thay đổi thì nó bắt đầu nói dối. Gợi ý '
        'trang phục theo địa điểm cũng vậy: nó chỉ đáng tin khi biết sản phẩm nào còn size vừa với cơ '
        'thể người đang xem. Ngược lại, chính lượt thử đồ lại là một tín hiệu hành vi rất mạnh cho hệ '
        'gợi ý — mạnh hơn lượt xem, gần bằng lượt thêm vào giỏ. Ba phần nuôi nhau, và điều đó chỉ xảy '
        'ra khi chúng nằm trên cùng một backend, cùng một cơ sở dữ liệu.')

    r.h2('5. Mục tiêu của đồ án')
    r.p('Đồ án đặt ra năm mục tiêu, tất cả đều được viết ở dạng có thể kiểm chứng bằng mã nguồn hoặc '
        'bằng một phép đo, chứ không phải ở dạng khẩu hiệu.')
    r.table(
        'Mục tiêu của đồ án và cách kiểm chứng từng mục tiêu.',
        ['#', 'Mục tiêu', 'Cách kiểm chứng'],
        [
            ['1', 'Hoàn chỉnh một vòng đời thương mại điện tử thật: catalog, giỏ hàng, voucher, thanh '
                  'toán, vận chuyển, trả hàng theo dòng, hoàn tiền, đánh giá đã mua.',
             'Điểm cuối REST tương ứng trong `backend/routes/` và bộ kiểm thử đơn hàng, trả hàng, '
             'hoàn tiền — Chương 5 và Chương 7.'],
            ['2', 'Xây dựng thử đồ ảo sinh ảnh thật, có cổng chất lượng, không dùng phương án dán ảnh '
                  'sản phẩm lên người.',
             'Đường ống trong `backend/routes/tryon.js` và `backend/fashn_service.py`; ma trận 5 dáng '
             'người × 7 size với ảnh kết quả — mục 6.4.'],
            ['3', 'Ước lượng số đo cơ thể từ ảnh một cách có trách nhiệm: trả khoảng kèm độ tin cậy và '
                  'biết nói "chưa đủ bằng chứng".',
             'Sai số đo trên BodyM testB và cổng tỉnh táo giải phẫu — mục 6.2.'],
            ['4', 'Cung cấp trang quản trị phân quyền nhiều cấp với phân tích và dự báo chạy trên dữ '
                  'liệu thật của hệ thống.',
             'Vai trò `customer < staff < admin < super_admin` và 15 thuật toán trong '
             '`backend/lib/analytics.js` — mục 5.3 và 6.10.'],
            ['5', 'Nói đúng về AI: phân biệt fine-tune, tối ưu suy luận, hiệu chuẩn và quy tắc; báo '
                  '"chưa đo" thay vì bịa chỉ số.',
             'Bảng trạng thái huấn luyện ở mục 6.5, phần trả lời về học tăng cường ở mục 6.6, và ma '
             'trận bằng chứng ở Phụ lục J.'],
        ],
        widths=[Cm(0.9), Cm(7.0), Cm(7.6)], font=11)

    r.h2('6. Phạm vi và đối tượng sử dụng')
    r.p('Phạm vi của đồ án gồm bốn bề mặt phần mềm (ứng dụng di động Android, website bán hàng, trang '
        'quản trị, cụm dịch vụ AI) chạy trên một backend duy nhất, cùng toàn bộ phần dữ liệu và phần '
        'huấn luyện/đánh giá mô hình đi kèm. Đối tượng sử dụng gồm năm nhóm: khách chưa đăng nhập, '
        'khách hàng, nhân viên, quản trị viên và super admin; chi tiết quyền hạn từng nhóm nằm ở '
        'Chương 3.')
    r.p('Ba việc **nằm ngoài phạm vi** và được nói rõ ngay từ đầu để tránh hiểu nhầm: hệ thống chưa '
        'được triển khai công khai trên Internet, chưa xử lý một giao dịch tiền thật nào (Stripe ở chế '
        'độ Test, VNPay ở Sandbox), và chưa qua một cuộc kiểm định an ninh độc lập. Danh sách đầy đủ '
        'các giới hạn nằm ở mục 7.5.')

    r.h2('7. Phương pháp thực hiện')
    r.p('Nhóm làm việc theo chu kỳ ngắn: chọn một tính năng, xây dựng phiên bản chạy được, đo nó trên '
        'máy thật, rồi mới quyết định giữ hay bỏ. Nguyên tắc quan trọng nhất mà nhóm áp dụng — và cũng '
        'là nguyên tắc chi phối cách bản báo cáo này được viết — là **một tuyên bố kỹ thuật chỉ tồn tại '
        'khi có bằng chứng đi kèm**. Trong thực tế, nguyên tắc đó nhiều lần buộc nhóm phải gỡ bỏ những '
        'thứ nghe hay: một mô hình cho kết quả tốt trong phòng thí nghiệm nhưng tệ trên ảnh thật đã bị '
        'thay; một checkpoint huấn luyện ở bước cuối cùng đã bị loại vì cổng nghiệm thu phát hiện lỗi '
        'ảnh; và một bộ chỉ số đánh giá xếp hạng chưa kịp triển khai thì được ghi thẳng là "chưa đo" '
        'thay vì lấy một con số ở đâu đó.')
    r.p('Về công cụ, nhóm dùng Git để theo dõi thay đổi, systemd để quản lý các dịch vụ chạy nền, '
        'Playwright để kiểm thử website, `node --test` và `unittest` cho backend và các mô-đun Python, '
        'và một tập tệp bằng chứng có ghi ngày trong `docs/project_evidence/` cho mọi khẳng định liên '
        'quan đến AI.')

    r.h2('8. Đóng góp của nhóm')
    r.p('Nhóm cho rằng đóng góp đáng kể nhất của đồ án không nằm ở số lượng mô hình được gọi — điều đó '
        'ngày nay không khó — mà ở **những chỗ hệ thống biết dừng lại**:')
    r.bullets([
        'Một đường ống thử đồ có cổng chất lượng ba tầng (danh tính, cấu trúc trang phục, độ che phủ) '
        'sẵn sàng vứt bỏ ảnh vừa mất bốn mươi giây GPU để tạo ra, thay vì trả về một bức ảnh làm sai '
        'cơ thể khách.',
        'Một bộ ước lượng số đo trả về khoảng có độ tin cậy và có trạng thái "chưa đủ bằng chứng" — '
        'kèm một cổng tỉnh táo chạy trên chính đầu ra để loại những con số bất khả thi về giải phẫu.',
        'Một tầng suy luận độ vừa vặn biến chênh lệch size thành hiệu ứng nhìn thấy được trên ảnh, '
        'với ba tầng chặn độc lập ngăn hiệu ứng "bục đường may" xuất hiện ở những loại trang phục mà '
        'nó sẽ làm hở thêm cơ thể.',
        'Một bộ điều phối GPU cho phép hai mô hình cỡ 15 GB và 13,5 GB cùng phục vụ trên một card 16 GB '
        'mà không tràn bộ nhớ, bằng cách xếp hàng theo màn hình người dùng đang mở.',
        'Và một kỷ luật thuật ngữ được áp dụng nhất quán: trong toàn bộ đồ án chỉ có **một** thành phần '
        'được gọi là đã fine-tune, và nó có checkpoint, mã băm, tập kiểm thử tách theo danh tính cùng '
        'một cổng nghiệm thu đã thật sự loại bỏ hai checkpoint khác.',
    ])

    r.h2('9. Cấu trúc báo cáo')
    r.p('Chương 1 giới thiệu dự án và định vị sản phẩm. Chương 2 trình bày cơ sở lý thuyết cần thiết '
        'để đọc các chương sau. Chương 3 phân tích hệ thống bằng mô hình use case. Chương 4 mô tả kiến '
        'trúc và cơ sở dữ liệu. Chương 5 đi qua từng chức năng đã triển khai trên ba bề mặt client. '
        'Chương 6 — chương dài nhất — trình bày chi tiết các thuật toán và mô hình AI kèm số liệu đánh '
        'giá. Chương 7 nói về kiểm thử, triển khai, bảo mật và tính khả thi. Chương 8 kết luận và đề '
        'xuất hướng phát triển. Phần Phụ lục chứa danh sách điểm cuối, từ điển dữ liệu, ma trận bằng '
        'chứng và danh sách ảnh nhóm cần bổ sung.')
    r.note('Bản báo cáo này được dựng lại hoàn toàn từ mã nguồn và dữ liệu đo được của hệ thống ở thời '
           'điểm 31/08/2026. Các bản báo cáo Word cũ trong kho lưu trữ chỉ được dùng để lấy quy ước '
           'trình bày (khung chương mục, trang bìa, thông tin hành chính) và **không** được dùng làm '
           'nguồn cho bất kỳ tuyên bố kỹ thuật nào, vì nội dung kỹ thuật của chúng đã lệch khá xa so '
           'với mã nguồn hiện tại.', label='Về nguồn của báo cáo')
