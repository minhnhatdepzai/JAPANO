"""Chương 2 — Cơ sở lý thuyết và khảo sát."""
from docx.shared import Cm


def build(r):
    r.h1('Cơ sở lý thuyết và khảo sát')
    r.p('Chương này cung cấp phần nền cần thiết để đọc các chương sau. Nhóm cố ý không viết nó như một '
        'bài tổng quan tách rời: mỗi khái niệm đều được nối ngay với chỗ nó xuất hiện trong JAPANO, và '
        'chỗ nào lý thuyết chuẩn khác với cách JAPANO làm thì sự khác biệt đó được nói ra.')

    r.h2('2.1. Thương mại điện tử và phần lõi của nó')
    r.h3('2.1.1. Commerce, e-commerce và core commerce')
    r.p('*Commerce* là hoạt động trao đổi hàng hoá; *e-commerce* là hoạt động đó diễn ra qua kênh điện '
        'tử. Thuật ngữ hữu ích hơn cho người xây dựng hệ thống là *core commerce* — phần lõi không thể '
        'thiếu của bất kỳ cửa hàng trực tuyến nào, bất kể ngành hàng. Phần lõi ấy gồm bảy khái niệm, '
        'và cách một hệ thống mô hình hoá chúng quyết định phần lớn chất lượng của nó về sau.')
    r.table(
        'Bảy khái niệm của core commerce và cách JAPANO hiện thực hoá.',
        ['Khái niệm', 'Định nghĩa', 'Trong JAPANO'],
        [
            ['Catalog', 'Tập hợp sản phẩm được bày bán, có phân loại.',
             'Collection `products` và `categories`; sản phẩm có `status` là `published` hoặc `hidden`.'],
            ['Variant', 'Một tổ hợp thuộc tính cụ thể của sản phẩm — thứ thật sự có tồn kho và mã hàng.',
             'Collection `product_variants` với chỉ mục duy nhất theo (sản phẩm, màu, size); 497 biến '
             'thể tại thời điểm đo.'],
            ['Inventory', 'Số lượng còn bán được của từng biến thể.',
             'Trường `stock` trên từng biến thể; mọi phép trừ tồn kho đều thực hiện phía máy chủ.'],
            ['Cart', 'Ý định mua chưa cam kết; có thể thuộc về khách chưa đăng nhập.',
             'Collection `cart_items`; giỏ của khách nằm trên thiết bị và được hợp nhất vào tài khoản '
             'khi đăng nhập, lấy số lượng lớn hơn để không mất sản phẩm.'],
            ['Order', 'Cam kết mua đã được chốt, có trạng thái theo thời gian.',
             'Collection `orders` với các trạng thái `pending`, `confirmed`, `shipping`, `completed`, '
             '`cancelled`, `returned`.'],
            ['Order item', 'Một dòng hàng trong đơn — **ảnh chụp tại thời điểm mua**, không phải con trỏ.',
             'Collection `order_items` lưu bản sao giá, tên, màu và size; lý do được giải thích ở mục 4.6.'],
            ['Payment / Return', 'Chứng từ tiền vào và quy trình tiền ra.',
             'Collection `payments` và `return_requests`; trả hàng thực hiện theo từng dòng, không phải '
             'theo cả đơn.'],
        ],
        widths=[Cm(2.3), Cm(5.4), Cm(7.8)], font=10.5)
    r.p('Điểm dễ làm sai nhất trong danh sách trên là *order item*. Một hệ thống ngây thơ sẽ lưu dòng '
        'hàng như một tham chiếu tới biến thể, rồi khi hiển thị lại đơn cũ thì đi tra giá hiện tại. '
        'Hậu quả là mọi đơn hàng trong quá khứ sẽ đổi giá mỗi lần cửa hàng chỉnh bảng giá, và báo cáo '
        'doanh thu trở nên vô nghĩa. JAPANO lưu bản sao giá, tên, màu và size ngay trên dòng hàng.')

    r.h3('2.1.2. Vòng đời đơn hàng và hậu mãi')
    r.p('Vòng đời đơn hàng trong JAPANO không kết thúc ở trạng thái "đã giao". Nó có một nhánh hậu mãi '
        'đầy đủ: khách yêu cầu trả từng dòng hàng, người vận hành duyệt hoặc từ chối, khách gửi hàng '
        'trở lại và có mã theo dõi, rồi hệ thống hoàn tiền theo đúng số dòng đã được chấp nhận. Thiết '
        'kế theo dòng hàng thay vì theo cả đơn là một quyết định có chi phí — nó làm phần tính tiền '
        'hoàn phức tạp hơn hẳn — nhưng nó phản ánh đúng thực tế: khách mua ba món và chỉ muốn trả một.')

    r.h2('2.2. Kiến trúc client–server và REST')
    r.p('Mô hình client–server tách phần hiển thị khỏi phần giữ sự thật. Trong JAPANO, sự tách bạch đó '
        'được phát biểu thành một quy tắc cứng: **client không bao giờ là nguồn sự thật**. Giá, mã '
        'giảm giá, tồn kho và tổng tiền luôn được tính lại phía máy chủ ở bước đặt hàng, kể cả khi '
        'client đã gửi lên đầy đủ những con số đó.')
    r.p('REST (Representational State Transfer) là kiểu thiết kế API dựa trên tài nguyên: mỗi thứ đáng '
        'quan tâm có một đường dẫn, và phương thức HTTP mô tả hành động. JAPANO có 138 điểm cuối chia '
        'theo miền nghiệp vụ trong 19 tệp — auth, catalog, orders, returns, reviews, loyalty, payments, '
        'stylist, tryon, japanSpots, push và hàng đợi công việc AI bất đồng bộ. Danh sách đầy đủ nằm ở '
        'Phụ lục A.')
    r.h3('2.2.1. Bất đồng bộ cho công việc dài')
    r.p('Một điểm cuối REST thông thường giả định công việc kết thúc trong vài trăm mili-giây. Sinh '
        'một ảnh thử đồ mất bốn mươi tới bảy mươi giây, và giữ một kết nối HTTP mở suốt ngần ấy thời '
        'gian là một thiết kế mong manh: chỉ cần người dùng chuyển tab hoặc mạng chập chờn là mất kết '
        'quả của cả một lượt chạy GPU. JAPANO vì vậy có thêm một lớp hàng đợi bất đồng bộ với vòng đời '
        '`queued → running → completed | failed | cancelled`. Client gửi yêu cầu, nhận về một mã công '
        'việc, rồi hỏi trạng thái định kỳ; và quan trọng là có thể **huỷ** công việc đang chạy bằng '
        'một lệnh DELETE — điều mà một kết nối đồng bộ không cho phép làm sạch sẽ.')

    r.h2('2.3. Xác thực, phân quyền và mẫu BFF')
    r.h3('2.3.1. Băm mật khẩu và JWT')
    r.p('Mật khẩu không bao giờ được lưu ở dạng có thể đọc lại. JAPANO dùng `bcrypt` — một hàm băm '
        'được thiết kế để **chậm có chủ đích**, với hệ số công việc điều chỉnh được, nhằm làm cho việc '
        'thử hàng loạt mật khẩu trở nên tốn kém ngay cả khi kẻ tấn công đã lấy được cơ sở dữ liệu.')
    r.p('JWT (JSON Web Token) là một chuỗi có chữ ký gồm ba phần: phần đầu mô tả thuật toán, phần thân '
        'mang dữ liệu (ở đây là mã người dùng, vai trò và thời hạn), phần cuối là chữ ký. Máy chủ xác '
        'minh chữ ký thay vì tra cứu phiên trong cơ sở dữ liệu, nên xác thực không tốn thêm một lượt '
        'truy vấn. Đánh đổi là **không thu hồi được tức thì**: một token đã ký vẫn hợp lệ tới khi hết '
        'hạn. JAPANO chấp nhận đánh đổi này bằng cách đặt thời hạn ngắn và kiểm tra lại danh tính ở nền.')
    r.h3('2.3.2. RBAC — phân quyền theo vai trò')
    r.p('JAPANO dùng bốn vai trò có thứ tự: `customer < staff < admin < super_admin`. Đây là mô hình '
        'phân cấp: quyền của vai trò cao bao trùm vai trò thấp. Cách hiện thực là một tập middleware '
        '(`requireAuth`, `requireStaff`, `requireAdmin`, `requireSuperAdmin`) gắn vào từng điểm cuối. '
        'Ưu điểm là đơn giản và dễ đọc; nhược điểm là kiểm tra nằm rải rác ở từng route, nên **chỉ cần '
        'quên gắn middleware ở một điểm cuối là có một lỗ hổng** — và đây đúng là một trong những phát '
        'hiện của phần rà soát bảo mật ở mục 7.3.')
    r.h3('2.3.3. Cookie HttpOnly và mẫu BFF')
    r.p('Trên trình duyệt, nơi lưu token quyết định mức độ nguy hiểm khi có lỗ hổng chèn mã. Token nằm '
        'trong `localStorage` có thể bị JavaScript đọc; token nằm trong cookie đánh dấu `HttpOnly` thì '
        'không. Website JAPANO dùng mẫu **BFF (Backend For Frontend)**: trình duyệt chỉ nói chuyện với '
        'chính máy chủ của website qua hai đường `/api` và `/media`; lớp BFF này gỡ JWT ra khỏi phần '
        'thân phản hồi và đặt vào cookie `japano_session` với thuộc tính `HttpOnly` và `SameSite=Lax`. '
        'Vì mọi yêu cầu đều cùng gốc, lớp BFF còn có chỗ đứng tự nhiên để kiểm tra tiêu đề `Origin` '
        '(chống CSRF) và để **chặn thẳng** các nhóm đường dẫn quản trị.')
    r.note('Trang quản trị lại đang lưu JWT trong `localStorage` và chạy với chính sách CSP đang tắt. '
           'Đây là một rủi ro đã biết, được ghi nhận trong chính chú thích của mã nguồn và được trình '
           'bày đầy đủ ở mục 7.3 thay vì bỏ qua.', label='Khác biệt giữa hai bề mặt web')

    r.h2('2.4. Mô hình dữ liệu tài liệu của MongoDB')
    r.h3('2.4.1. Document, collection và khoá')
    r.p('MongoDB lưu dữ liệu dưới dạng *document* (bản ghi dạng cây, mã hoá BSON) nhóm trong '
        '*collection*. Mỗi document bắt buộc có trường `_id` làm khoá chính vật lý. Khác biệt cơ bản '
        'so với cơ sở dữ liệu quan hệ là **không có ràng buộc khoá ngoại ở tầng lưu trữ**: quan hệ '
        'giữa các collection do ứng dụng bảo đảm. Đây vừa là tự do, vừa là trách nhiệm — và trong '
        'JAPANO, trách nhiệm ấy đã có lúc bị bỏ sót: một lần kiểm tra toàn vẹn chỉ đọc trên cơ sở dữ '
        'liệu thật đã tìm thấy ba bản ghi tương tác có `userId` không còn tra ra người dùng nào.')
    r.h3('2.4.2. Nhúng hay tham chiếu')
    r.p('Câu hỏi thiết kế trung tâm của MongoDB là: dữ liệu con nên **nhúng** vào document cha hay '
        '**tham chiếu** sang collection riêng? Không có câu trả lời chung; có ba câu hỏi dẫn tới câu '
        'trả lời đúng.')
    r.table(
        'Ba câu hỏi quyết định nhúng hay tham chiếu, và cách JAPANO trả lời.',
        ['Câu hỏi', 'Nghiêng về nhúng khi…', 'Ví dụ trong JAPANO'],
        [
            ['Dữ liệu con có được truy vấn độc lập không?',
             'Không — nó luôn được đọc cùng với cha.',
             'Màu và size **nhúng** trong `product_variants`; không ai đi hỏi "cho tôi tất cả màu đỏ" '
             'tách khỏi biến thể.'],
            ['Dữ liệu con có tăng không giới hạn không?',
             'Không — số lượng bị chặn trên.',
             'Tương tác người dùng **tham chiếu** ra `interactions` vì nó tăng vô hạn theo thời gian '
             '(718 bản ghi và còn tăng).'],
            ['Dữ liệu con có cần lịch sử riêng không?',
             'Không — nó không có vòng đời riêng.',
             'Dòng hàng **tách** thành `order_items` vì nó có vòng đời trả hàng và hoàn tiền riêng của '
             'từng dòng.'],
        ],
        widths=[Cm(4.2), Cm(4.2), Cm(7.1)], font=10.5)
    r.h3('2.4.3. Chi phí ẩn của việc chia quá nhỏ')
    r.p('Một kết quả đo được trong quá trình làm đồ án đáng để ghi lại, vì nó đi ngược trực giác: '
        'MongoDB (qua bộ máy lưu trữ WiredTiger) tính khoảng **36 KB cho mỗi collection và mỗi chỉ '
        'mục**, gần như không phụ thuộc số lượng document. Với một hệ thống có nhiều collection nhỏ, '
        'phần chi phí cố định này lớn hơn cả dữ liệu thật. Đó là lý do JAPANO đã gộp năm collection '
        'nhỏ (`product_details`, `banners`, `discount_rules`, `vip_memberships`, `ai_descriptions`) vào '
        'nơi khác — chi tiết ở mục 4.7.')

    r.h2('2.5. Thị giác máy tính cho bài toán cơ thể người')
    r.h3('2.5.1. Ước lượng tư thế (pose estimation)')
    r.p('Ước lượng tư thế là bài toán tìm toạ độ các khớp cơ thể trên ảnh. JAPANO dùng YOLOv8n-pose, '
        'trả về 17 điểm khớp theo quy ước COCO kèm độ tin cậy cho từng điểm. Chi tiết quan trọng — và '
        'là nguồn của một lỗi thật trong dự án — là **mô hình vẫn xuất ra khớp ngay cả khi khớp đó '
        'không có trong ảnh**, chỉ với độ tin cậy thấp. Trên một ảnh bị cắt ngang đùi, mô hình vẫn báo '
        'có đầu gối với độ tin cậy 0,25–0,32, và hệ thống đời đầu đã tin vào đó để ngoại suy chiều cao, '
        'cho ra kết quả 200–210 cm. Cách sửa là lọc theo ngưỡng độ tin cậy và loại các khớp nằm sát mép '
        'ảnh.')
    r.h3('2.5.2. Phân đoạn người (human segmentation)')
    r.p('Phân đoạn người tách vùng ảnh thuộc về người khỏi nền, cho ra một mặt nạ nhị phân gọi là '
        '*silhouette*. JAPANO dùng U2Net. Hạn chế cốt lõi của mặt nạ nhị phân là nó **không phân biệt '
        'được các bộ phận**: khi hai cánh tay buông sát thân, silhouette chỉ có một khối liền, và bề '
        'ngang đo được ở mức eo thực chất là tay cộng thân cộng tay. Đây là nguyên nhân trực tiếp của '
        'sai số vòng eo lên tới 79 pixel trong phiên bản đầu; cách xử lý được trình bày ở mục 6.2.')
    r.h3('2.5.3. Từ pixel ra xăng-ti-mét: bài toán thang đo')
    r.p('Đây là giới hạn vật lý quan trọng nhất của cả mảng đo cơ thể, và nó không phải là vấn đề mô '
        'hình. Một ảnh hai chiều không có vật chuẩn về kích thước thì **không thể** xác định kích thước '
        'tuyệt đối: một người cao 1,60 m đứng gần ống kính và một người cao 1,80 m đứng xa hơn có thể '
        'chiếm đúng cùng một số pixel. Mọi hệ thống ước lượng số đo từ một ảnh đơn đều phải bù bằng một '
        'giả định về dân số. JAPANO chọn cách phát biểu điều này ra thành thiết kế: kết quả là một '
        '**phân phối hậu nghiệm** của một tiên nghiệm dân số được cập nhật bằng manh mối từ ảnh, và khi '
        'trọng số của manh mối ảnh quá thấp thì kết quả bị gắn nhãn `basis: population_prior` và '
        '`usableForSizing: false`.')

    r.h2('2.6. Mô hình sinh ảnh và thử đồ ảo')
    r.h3('2.6.1. Mô hình khuếch tán (diffusion model)')
    r.p('Mô hình khuếch tán học cách đảo ngược một quá trình thêm nhiễu. Trong huấn luyện, ảnh thật bị '
        'thêm nhiễu Gauss theo nhiều bước cho tới khi thành nhiễu thuần; mạng học dự đoán phần nhiễu đã '
        'thêm ở mỗi bước. Khi sinh ảnh, quá trình chạy ngược: bắt đầu từ nhiễu, mạng khử dần theo điều '
        'kiện được đưa vào (văn bản mô tả, ảnh tham chiếu, tư thế). Số bước khử nhiễu là một tham số '
        'đánh đổi trực tiếp giữa chất lượng và thời gian — JAPANO dùng 20 bước cho hồ sơ `balanced`, và '
        'đây là con số được chọn sau khi đo chứ không phải mặc định.')
    r.h3('2.6.2. Virtual try-on')
    r.p('Thử đồ ảo là bài toán: cho ảnh một người và ảnh một trang phục, sinh ra ảnh người đó đang mặc '
        'trang phục kia. Bài toán khó ở ba ràng buộc thường xung đột nhau: **giữ đúng danh tính** '
        '(khuôn mặt, dáng người không được đổi), **giữ đúng trang phục** (màu, hoạ tiết, cấu trúc phải '
        'là của sản phẩm đang bán), và **hợp lý về vật lý** (vải phải rơi theo tư thế, có nếp và bóng). '
        'Một mô hình mạnh về ràng buộc này thường yếu ở ràng buộc kia — và đó chính là lý do JAPANO '
        'dùng hai mô hình nối tiếp thay vì một, như trình bày ở mục 6.4.')
    r.h3('2.6.3. LoRA và fine-tuning')
    r.p('*Fine-tuning* là huấn luyện tiếp một mô hình đã được huấn luyện trước trên dữ liệu của bài '
        'toán cụ thể. Với các mô hình sinh ảnh cỡ hàng tỉ tham số, cập nhật toàn bộ trọng số là bất '
        'khả thi trên phần cứng của sinh viên. **LoRA (Low-Rank Adaptation)** giải quyết bằng cách '
        'đóng băng trọng số gốc và chỉ học thêm một cặp ma trận hạng thấp cộng vào: nếu lớp gốc là '
        'ma trận W kích thước d×k thì phần học thêm là tích B·A với A kích thước r×k và B kích thước '
        'd×r, trong đó r rất nhỏ (JAPANO dùng r = 8). Số tham số phải học giảm hàng nghìn lần, và '
        'checkpoint thu được chỉ nặng khoảng 16 MB thay vì hàng chục GB.')
    r.p('Điểm quan trọng về mặt thuật ngữ: LoRA **là** fine-tuning thật — có optimizer, có gradient, có '
        'trọng số được cập nhật và lưu lại. Nó khác hẳn với việc đổi lời nhắc, đổi số bước khử nhiễu '
        'hay hiệu chuẩn đầu ra, những thứ **không** phải fine-tuning dù kết quả nhìn có thể tốt hơn. '
        'Ranh giới này được áp dụng nghiêm ngặt trong toàn bộ báo cáo; bảng phân loại đầy đủ ở mục 6.5.')
    r.h3('2.6.4. Cổng chất lượng (quality gate)')
    r.p('Vì mô hình sinh ảnh không có gì bảo đảm đầu ra đúng, một hệ thống nghiêm túc phải có bước '
        'kiểm tra sau khi sinh. *Quality gate* trong JAPANO là một tập kiểm tra định lượng chạy trên '
        'cặp (ảnh gốc, ảnh sinh ra) và trả lời ba câu hỏi tách biệt: người trong ảnh có còn là người '
        'đó không, trang phục có đúng cấu trúc của sản phẩm không, và độ che phủ cơ thể có đúng thiết '
        'kế không. Ba câu hỏi được tách vì chúng có ngưỡng và hậu quả khác nhau — một ảnh sai màu áo '
        'thì đáng cảnh báo, một ảnh làm hở vùng không được hở thì phải chặn.')

    r.h2('2.7. Hệ gợi ý')
    r.h3('2.7.1. Lọc cộng tác, lọc theo nội dung và mô hình lai')
    r.p('*Lọc cộng tác* (collaborative filtering) gợi ý dựa trên hành vi: những người có lịch sử giống '
        'bạn đã thích gì. Nó mạnh khi có nhiều dữ liệu và yếu khi gặp người dùng mới hoặc sản phẩm mới '
        '— gọi là bài toán *cold start*. *Lọc theo nội dung* (content-based) so khớp đặc trưng của sản '
        'phẩm với hồ sơ sở thích, nên hoạt động ngay cả với sản phẩm chưa ai mua, nhưng dễ mắc kẹt '
        'trong một vòng lặp gợi ý những thứ quá giống nhau. Hệ thống thực tế gần như luôn là mô hình '
        'lai, và JAPANO cũng vậy: chín nguồn gợi ý được trộn với trọng số thay đổi theo độ dài lịch sử '
        'của từng người.')
    r.h3('2.7.2. Phân rã ma trận')
    r.p('Phân rã ma trận biểu diễn ma trận tương tác người dùng × sản phẩm thành tích của hai ma trận '
        'nhỏ hơn: mỗi người và mỗi sản phẩm được gán một véc-tơ ẩn k chiều, và điểm dự đoán là tích vô '
        'hướng của hai véc-tơ. Các véc-tơ được học bằng hạ gradient ngẫu nhiên trên các cặp đã quan '
        'sát, kèm một số hạng phạt để tránh học thuộc. JAPANO dùng k = 8.')
    r.h3('2.7.3. Lan truyền trên đồ thị')
    r.p('Quan hệ người dùng – sản phẩm cũng có thể xem là một đồ thị hai phía. Ý tưởng của LightGCN là '
        'bỏ hết phần biến đổi phi tuyến thường thấy trong mạng đồ thị và **chỉ giữ lại phép lan truyền '
        'có chuẩn hoá theo bậc**: biểu diễn của một nút ở lớp sau là trung bình có trọng số của các '
        'láng giềng ở lớp trước, và biểu diễn cuối cùng là trung bình qua tất cả các lớp. Điều này cho '
        'phép một người "chạm" tới sản phẩm mà mình chưa từng tương tác, thông qua những người dùng '
        'trung gian.')
    r.h3('2.7.4. Gợi ý theo chuỗi')
    r.p('Hành vi mua sắm có thứ tự: xem một chiếc yukata rồi xem đai obi khác hẳn với chuỗi ngược lại. '
        'Các mô hình gợi ý theo chuỗi khai thác thứ tự này. JAPANO cài hai dạng nhẹ: một mô hình không '
        'gian trạng thái chọn lọc (12 chiều, cổng thay đổi theo từng sự kiện — lấy ý tưởng từ họ Mamba) '
        'và một phân phối Markov bậc một trên các bước chuyển trong cùng phiên.')
    r.h3('2.7.5. Xếp hạng và đánh giá')
    r.p('Sau khi các nguồn tạo ra ứng viên, bước cuối là xếp hạng. JAPANO dùng một bộ xếp hạng logistic '
        'theo cặp: với mỗi mẫu dương (sản phẩm người dùng thật sự đã tương tác mạnh), lấy một mẫu âm và '
        'cập nhật trọng số theo hướng làm điểm của mẫu dương cao hơn. Cách đánh giá đúng cho loại mô '
        'hình này là giữ lại tương tác tích cực cuối cùng của mỗi người theo thứ tự thời gian, và đo '
        'bằng NDCG@k hoặc Recall@k.')
    r.note('JAPANO **chưa triển khai** phần đánh giá xếp hạng ngoại tuyến này. Chính API chẩn đoán của '
           'hệ thống trả về `evaluation: {status: "not-measured", ndcgAt10: null, recallAt10: null}`. '
           'Báo cáo giữ nguyên trạng thái đó thay vì đưa ra một con số không có nguồn.',
           label='Chỉ số chưa đo')

    r.h2('2.8. Kiểm duyệt nội dung, dự báo và phân khúc')
    r.h3('2.8.1. Kiểm duyệt và bài toán lách luật')
    r.p('Lọc nội dung xấu bằng danh sách từ cấm thất bại rất nhanh trước tiếng Việt, vì có quá nhiều '
        'cách viết cùng một từ: bỏ dấu, thay chữ bằng số, chèn khoảng trắng, viết tắt, và đặc biệt là '
        '**nói lái** — đảo thứ tự âm tiết để tạo ra một cụm tục nhưng mặt chữ trông vô hại. Vì vậy '
        'bước chuẩn hoá văn bản trước khi so khớp quan trọng hơn cả bản thân danh sách từ. Với những '
        'cụm mơ hồ mà mặt chữ không phân biệt được, cách duy nhất đúng là xét ngữ cảnh, và khi ngữ '
        'cảnh vẫn chưa rõ thì chuyển sang trạng thái chờ người duyệt thay vì chặn oan.')
    r.h3('2.8.2. Ba mô hình dự báo chuỗi thời gian')
    r.p('JAPANO dùng ba mô hình dự báo đơn giản và trộn chúng lại. **Hồi quy tuyến tính bình phương '
        'tối thiểu (OLS)** khớp một đường thẳng theo thời gian — ổn định nhưng phản ứng chậm khi xu '
        'hướng đổi chiều. **Làm mượt luỹ thừa kép của Holt** duy trì hai đại lượng, mức và xu hướng, '
        'mỗi cái cập nhật theo một hệ số học riêng — bám xu hướng mới nhanh hơn nhưng nhạy với nhiễu. '
        '**Trung bình trượt có trọng số** đơn giản nhất và bền nhất khi dữ liệu ít. Việc trộn ba mô '
        'hình theo nghịch đảo sai số của chính chúng là một cách rẻ tiền để có được ưu điểm của cả ba '
        'mà không phải chọn trước.')
    r.h3('2.8.3. K-Means và RFM')
    r.p('**K-Means** chia tập điểm thành k cụm bằng cách lặp lại hai bước: gán mỗi điểm về tâm gần '
        'nhất, rồi dời tâm về trung bình của cụm. Điều kiện bắt buộc là các chiều phải được chuẩn hoá '
        '— nếu không, chiều có đơn vị lớn (chi tiêu tính bằng đồng) sẽ nuốt hoàn toàn chiều có đơn vị '
        'nhỏ (số đơn). **RFM** là một khung chấm điểm khách hàng theo ba trục: mua gần đây bao lâu '
        '(Recency), mua thường xuyên thế nào (Frequency), đã chi bao nhiêu (Monetary). RFM không phải '
        'học máy; nó là một heuristic minh bạch, và JAPANO gọi đúng tên nó như vậy.')

    r.h2('2.9. Khảo sát: JAPANO đứng ở đâu')
    r.p('Nhóm cố ý **không** đưa vào báo cáo các con số thị phần hay doanh thu của các nền tảng khác: '
        'nhóm không có cách kiểm chứng chúng, và trích lại từ bài viết tiếp thị sẽ vi phạm chính '
        'nguyên tắc mà đồ án đặt ra. Bảng so sánh dưới đây chỉ dùng những tiêu chí mà một người đọc có '
        'thể tự kiểm tra bằng cách sử dụng sản phẩm hoặc đọc tài liệu công khai của nó.')
    r.table(
        'So sánh JAPANO với các nhóm giải pháp phổ biến, theo tiêu chí kiểm chứng được.',
        ['Tiêu chí', 'Sàn TMĐT phổ thông', 'Website thời trang có 3D/AR', 'JAPANO'],
        [
            ['Xem trang phục trên cơ thể người mua',
             'Không — chỉ ảnh người mẫu.',
             'Thường là ảnh dựng trên hình nộm hoặc mô hình 3D chuẩn hoá.',
             'Sinh ảnh từ ảnh thật của người mua bằng mô hình khuếch tán.'],
            ['Gợi ý size',
             'Bảng size tĩnh, đôi khi có số đo tham chiếu.',
             'Nhập số đo thủ công là chính.',
             'Ước lượng số đo từ ảnh + số đo tự nhập, số đo tự nhập luôn được ưu tiên.'],
            ['Thể hiện độ chật/rộng',
             'Một dòng chữ cảnh báo, nếu có.',
             'Đổi kích thước mô hình 3D.',
             'Đổi chính bức ảnh: độ căng vải, nếp rủ, vai trễ theo mức độ chật đo được.'],
            ['Xử lý khi mô hình sinh ra ảnh sai',
             'Không áp dụng.',
             'Không áp dụng.',
             'Cổng chất lượng ba tầng; ảnh sai bị loại và giữ lại ảnh sạch kèm lý do.'],
            ['Công khai giới hạn của phần AI',
             'Không.',
             'Hiếm khi.',
             'Có — sai số, điều kiện đo, và các chỉ số chưa đo đều được ghi trong tài liệu.'],
            ['Sẵn sàng thương mại',
             'Có.',
             'Có.',
             '**Chưa** — thanh toán ở chế độ thử nghiệm, chưa triển khai công khai, dữ liệu huấn luyện '
             'phi thương mại.'],
        ],
        widths=[Cm(3.2), Cm(3.6), Cm(3.7), Cm(5.0)], font=10,
        note='Bảng chỉ so sánh đặc điểm quan sát được, không so sánh quy mô kinh doanh. Hàng cuối cùng '
             'là điểm JAPANO thua rõ ràng và được giữ lại trong bảng vì lý do đó.')
