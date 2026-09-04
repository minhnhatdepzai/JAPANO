"""Chương 5 — Triển khai chức năng trên ba bề mặt."""
from docx.shared import Cm

from paths import SCREEN

MW = [Cm(3.1), Cm(12.4)]


def _module(r, title, goal, screens, flow, api, collections, rules, errors, tests):
    r.h4(title)
    rows = [
        ['Mục tiêu người dùng', goal],
        ['Màn hình', screens],
        ['Luồng chính', flow],
        ['Điểm cuối liên quan', api],
        ['Collection chạm tới', collections],
        ['Quy tắc nghiệp vụ', rules],
        ['Trạng thái lỗi', errors],
        ['Kiểm thử', tests],
    ]
    r.table(f'Đặc tả mô-đun: {title}.', ['Hạng mục', 'Nội dung'], rows, widths=MW, font=10.5)


def build(r):
    r.h1('Triển khai chức năng')
    r.p('Chương này đi qua từng chức năng đã được xây dựng, chia theo ba bề mặt client. Với mỗi mô-đun, '
        'báo cáo ghi cùng một bộ tám thông tin — mục tiêu người dùng, màn hình, luồng, điểm cuối, '
        'collection, quy tắc nghiệp vụ, trạng thái lỗi và tình trạng kiểm thử — để người đọc có thể '
        'đối chiếu thẳng với mã nguồn thay vì phải tin vào lời mô tả.')

    # =============================================================== MOBILE
    r.h2('5.1. Ứng dụng di động')
    r.p('Ứng dụng di động là bề mặt đầy đủ nhất của JAPANO: nó mang cả ba giá trị sản phẩm và là nơi '
        'duy nhất có toàn bộ tính năng AI. Kỹ thuật: Expo SDK 51, React Native 0.74, React 18, điều '
        'hướng bằng Expo Router, lưu phiên bằng SecureStore. Gói ứng dụng là `vn.japano.app`, bản phát '
        'hành đang được kiểm tra trên thiết bị là 1.0.19 (versionCode 20), targetSdk 34.')
    r.note('Mục tiêu web của Expo đã được **gỡ bỏ** khỏi dự án. Bề mặt web duy nhất dành cho khách hàng '
           'là dự án `web/` độc lập ở mục 5.2. Nói cách khác, ứng dụng di động hiện là ứng dụng chỉ '
           'chạy trên điện thoại, và trong mã nguồn không còn phụ thuộc `react-native-web` nào.',
           label='Một điểm dễ nhầm')

    r.h3('5.1.1. Khởi động và nhận diện thương hiệu')
    _module(r, 'Màn hình chờ có hoạt cảnh thương hiệu',
        'Người dùng biết ứng dụng đang khởi động và nhận ra thương hiệu ngay từ giây đầu tiên, thay vì '
        'nhìn một màn hình trắng.',
        'Màn hình chờ hệ thống của Android, sau đó là hoạt cảnh trong ứng dụng.',
        'Ứng dụng vẽ chữ lồng JAPANO, các chữ cái xuất hiện so le, hoa anh đào rơi và dòng khẩu hiệu '
        'cuối cùng. Song song đó, phiên đăng nhập được khôi phục lạc quan từ bản sao người dùng lưu '
        'trên máy cộng với thẻ trong SecureStore, còn việc xác thực lại chạy ở nền.',
        '`GET /api/auth/me` (chạy nền, không chặn giao diện)',
        '`users`',
        'Phiên bị thu hồi thì bị xoá **ở nền** sau khi xác thực lại thất bại, chứ không chặn màn hình '
        'khởi động. Hoạt cảnh dừng ở 2,65 giây thay vì 4,1 giây như bản đầu.',
        'Mất mạng lúc khởi động: ứng dụng vẫn vào màn hình chính bằng dữ liệu đã lưu, và hiển thị lại '
        'khi có mạng.',
        'Đã kiểm tra bằng một đoạn quay màn hình 9 giây trên Redmi Note 8 Pro: từ trình khởi chạy tới '
        'màn hình chính không còn khoảng trắng; nội dung xuất hiện sau khoảng 3–4 giây.')
    r.figure(SCREEN / 'mobile-2026-09-04/06-home.png',
             'Màn hình chính JAPANO JOURNEY và AI Studio nhận dữ liệu khi backend dùng MongoDB Atlas.',
             source='Ảnh chụp trực tiếp từ Redmi Note 8 Pro ngày 04/09/2026; ứng dụng 1.0.19 '
                    '(versionCode 20), kết nối backend qua `adb reverse tcp:4100 tcp:4100`.',
             width_cm=7.2)

    r.h3('5.1.2. Tài khoản, hồ sơ và địa chỉ')
    _module(r, 'Đăng ký, đăng nhập, quên mật khẩu',
        'Có một tài khoản để giữ đơn hàng, số đo và ưu đãi.',
        'Đăng ký, đăng nhập, quên mật khẩu, đặt lại mật khẩu.',
        'Nhập thông tin → máy chủ kiểm tra chính sách mật khẩu → băm bcrypt → ký JWT → lưu vào '
        'SecureStore. Luồng quên mật khẩu gửi thư qua hộp thư thử nghiệm.',
        '`POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/forgot-password` · '
        '`POST /api/auth/reset-password` · `GET /api/auth/me` · `GET /api/auth/providers`',
        '`users`',
        'Giới hạn 20 lần trong 15 phút cho mỗi IP, **chỉ** áp lên các điểm cuối thật sự nhận thông tin '
        'đăng nhập. Thông báo lỗi trung tính, không tiết lộ email có tồn tại hay không.',
        'Sai thông tin đăng nhập trả 401; vượt giới hạn trả 429 kèm thời gian chờ; máy chủ không phản '
        'hồi thì giữ nguyên màn hình và cho phép thử lại.',
        'Có kiểm thử tự động cho phần băm mật khẩu và ký thẻ; luồng quên mật khẩu đã được thử bằng hộp '
        'thư thử nghiệm.')
    r.figure(SCREEN / 'mobile-2026-09-04/08-login.png',
             'Màn hình đăng nhập mới của ứng dụng di động JAPANO.',
             source='Ảnh chụp trực tiếp từ Redmi Note 8 Pro ngày 04/09/2026. Nội dung email là gợi ý '
                    'của giao diện; không sử dụng hoặc công bố mật khẩu người dùng.',
             width_cm=7.2)
    r.p('Về đăng nhập bằng Google: nút đã có trên ứng dụng và đường dẫn phía máy chủ đã tồn tại. Tuy '
        'nhiên trên **website** thì tính năng này chưa từng đăng nhập thành công lần nào vì thiếu định '
        'danh ứng dụng dành cho web. Báo cáo ghi đúng trạng thái đó thay vì tính nó là tính năng đã '
        'hoàn thành.')

    r.h3('5.1.3. Duyệt catalog và chi tiết sản phẩm')
    r.figure(SCREEN / 'mobile-2026-09-04/05-products.png',
             'Màn hình catalog mới trên thiết bị Android, tải trực tiếp danh sách 70 sản phẩm từ '
             'backend đang kết nối MongoDB Atlas.',
             source='Ảnh chụp trực tiếp từ Redmi Note 8 Pro ngày 04/09/2026; ứng dụng 1.0.19 '
                    '(versionCode 20).',
             width_cm=7.2)
    _module(r, 'Catalog, tìm kiếm, lọc và sắp xếp',
        'Tìm được sản phẩm muốn xem trong ít thao tác nhất.',
        'Tab sản phẩm, ô tìm kiếm, hàng chip lọc theo danh mục và theo kiểu dáng.',
        'Bộ lọc được thu gọn sau một nút có nhãn để nhường chỗ cho sản phẩm; số lượng kết quả và tiêu '
        'chí sắp xếp giữ nguyên trên màn hình khi cuộn.',
        '`GET /api/products` · `GET /api/categories` · `POST /api/search-log`',
        '`products`, `product_variants`, `product_media`, `categories`, `search_logs`',
        'Chỉ sản phẩm `published` xuất hiện. Sản phẩm không còn biến thể nào có tồn kho vẫn hiển thị '
        'nhưng không thêm được vào giỏ.',
        'Danh sách rỗng hiển thị trạng thái trống có hướng dẫn, không phải một màn hình trắng.',
        'Đã kiểm tra trực tiếp trên thiết bị Redmi: cuộn danh sách, lọc theo kimono, và nhãn hỗ trợ '
        'đọc màn hình đều hoạt động.')
    _module(r, 'Chi tiết sản phẩm',
        'Xem đủ thông tin để quyết định: ảnh, video, màu, size, giá, đánh giá.',
        'Trang chi tiết sản phẩm với dải ảnh, phần chọn biến thể và khu vực đánh giá.',
        'Chọn màu và size → hệ thống hiển thị tồn kho của đúng biến thể đó → thêm vào giỏ hoặc chuyển '
        'thẳng sang thử đồ. Trang có mục "Mặc bộ này ở đâu trên đất Nhật" nối sang phần địa danh.',
        '`GET /api/products/:id` · `GET /api/products/:id/related` · `GET /api/reviews`',
        '`products`, `product_variants`, `product_media`, `reviews`, `interactions`',
        'Chỉ hai hành động chính được ghim cố định ở đáy màn hình: "Thử trên ảnh" và "Thêm vào giỏ". '
        'Việc giới hạn xuống hai nút là kết quả của một lần rà soát giao diện, khi số nút ghim nhiều '
        'hơn khiến người dùng lưỡng lự.',
        'Sản phẩm bị ẩn giữa chừng: hiển thị thông báo và đưa về danh sách.',
        'Đã kiểm tra trực tiếp trên thiết bị.')
    r.figure(SCREEN / 'mobile-2026-09-04/07-product-detail.png',
             'Màn hình chi tiết sản phẩm mới với ảnh, giá, biến thể và hành động mua sắm.',
             source='Ảnh chụp trực tiếp từ Redmi Note 8 Pro ngày 04/09/2026 khi dữ liệu catalog được '
                    'đọc từ MongoDB Atlas.',
             width_cm=7.2)

    r.h3('5.1.4. Giỏ hàng, ưu đãi và thanh toán')
    _module(r, 'Giỏ hàng và hợp nhất giỏ',
        'Không mất sản phẩm đã chọn khi đăng nhập.',
        'Màn hình giỏ hàng với danh sách dòng hàng và tổng tiền tạm tính.',
        'Khách chưa đăng nhập giữ giỏ trên máy; khi đăng nhập, hai giỏ được hợp nhất và hệ thống **lấy '
        'số lượng lớn hơn** cho mỗi biến thể trùng.',
        '`GET/POST/DELETE /api/cart`',
        '`cart_items`, `product_variants`, `interactions`',
        'Tổng tiền hiển thị ở giỏ là tạm tính; con số cuối cùng do máy chủ quyết định ở bước đặt hàng.',
        'Biến thể hết hàng khi đang ở trong giỏ: dòng hàng được đánh dấu và không cho đặt.',
        'Có kiểm thử tự động cho phần tạo đơn từ giỏ.')
    _module(r, 'Đặt hàng và ba phương thức thanh toán',
        'Trả tiền theo cách quen thuộc và biết chắc đơn đã được ghi nhận.',
        'Màn hình đặt hàng, WebView của VNPay, giao diện thẻ của Stripe, màn hình kết quả.',
        'Chọn địa chỉ → chọn phương thức → máy chủ tính lại toàn bộ tiền → tạo đơn → với COD thì xác '
        'nhận ngay, với thanh toán trực tuyến thì chờ callback thật.',
        '`POST /api/orders` · `POST /api/payments/stripe/*` · `POST /api/payments/vnpay/*` · '
        '`POST /api/stripe/webhook`',
        '`orders`, `order_items`, `payments`, `vouchers`, `voucher_redemptions`, `product_variants`',
        'Giá, mã giảm giá, tồn kho và tổng tiền **luôn tính lại phía máy chủ**. Thẻ đã lưu của Stripe '
        'được hỗ trợ để không phải nhập lại mỗi lần.',
        'Chữ ký webhook sai bị từ chối và đơn giữ nguyên trạng thái. Rời khỏi màn hình thanh toán '
        'không làm đơn tự chuyển thành công.',
        'Có kiểm thử cho phần tạo đơn và phần tính tiền hoàn; **chưa có kiểm thử tự động cho hai cổng '
        'thanh toán** — đây là một khoảng trống đã biết, nêu lại ở mục 7.1.')

    r.h3('5.1.5. Hậu mãi: theo dõi đơn, trả hàng và hoàn tiền')
    _module(r, 'Theo dõi đơn và trả hàng theo từng dòng',
        'Biết đơn đang ở đâu và trả lại được đúng món không ưng, không phải trả cả đơn.',
        'Danh sách đơn, chi tiết đơn có dòng thời gian trạng thái, màn hình tạo yêu cầu trả.',
        'Chọn từng dòng hàng và số lượng muốn trả → nêu lý do → chờ duyệt → gửi hàng về kèm mã theo '
        'dõi → nhận hoàn tiền.',
        '`GET /api/orders` · `PATCH /api/orders/:id` · `POST /api/returns` · `GET /api/returns`',
        '`orders`, `order_items`, `return_requests`, `payments`, `notifications`',
        'Tiền hoàn được tính theo đúng số lượng của từng dòng được chấp nhận, có tính tới phần giảm '
        'giá đã áp cho dòng đó. Chính sách giao nhận được công bố công khai để hai bên cùng đối chiếu.',
        'Yêu cầu trùng cho một dòng đã trả bị từ chối, tránh hoàn tiền hai lần.',
        'Có kiểm thử cho phép tính tiền hoàn và cho chính sách giao nhận.')

    r.h3('5.1.6. Đánh giá, chương trình khách hàng thân thiết và thông báo')
    _module(r, 'Đánh giá đã mua xác thực và cảm xúc',
        'Đọc được nhận xét của người thật sự đã mua.',
        'Khu vực đánh giá trong trang sản phẩm và màn hình viết đánh giá.',
        'Chỉ mở form khi khách có đơn hoàn tất chứa sản phẩm đó → nội dung đi qua bộ kiểm duyệt → hiển '
        'thị, chờ duyệt, hoặc bị từ chối kèm lý do.',
        '`POST /api/reviews` · `GET /api/reviews` · `POST /api/reviews/:id/reactions`',
        '`reviews`, `review_reactions`, `orders`, `order_items`, `moderation_samples`',
        'Không có đường nào để viết đánh giá cho sản phẩm chưa mua.',
        'Nội dung bị từ chối được nêu lý do theo nhóm vi phạm, không phải một thông báo chung chung.',
        'Bộ kiểm duyệt có kiểm thử riêng, gồm cả các trường hợp lách luật; xem mục 6.11.')
    _module(r, 'VIP, Flagcard và voucher cá nhân',
        'Được thưởng vì mua nhiều, theo quy tắc rõ ràng chứ không mơ hồ.',
        'Màn hình thẻ thành viên, bộ sưu tập Flagcard, danh sách voucher.',
        'Chi tiêu hợp lệ đạt 5.000.000 đồng trong tháng mở hạng VIP 30 ngày, giảm 10% cho một đơn vị '
        'sản phẩm tự chọn mỗi đơn. Mỗi đơn từ 5.000.000 đồng nhận một Flagcard; đủ 7 thẻ đổi được '
        'voucher giảm 50%, dùng một lần, hiệu lực 90 ngày.',
        '`GET /api/loyalty/*` · `POST /api/loyalty/flagcards/redeem`',
        '`users`, `orders`, `flagcards`, `flagcard_collections`, `vouchers`, `voucher_redemptions`',
        'Trạng thái VIP được **suy ra từ đơn hàng** chứ không lưu thành bảng riêng, nên nó không thể '
        'lệch khỏi dữ liệu gốc.',
        'Đổi thẻ khi chưa đủ điều kiện bị từ chối kèm số thẻ còn thiếu.',
        'Có kiểm thử tự động cho logic VIP.')

    r.h3('5.1.7. Trợ lý Ori và stylist')
    _module(r, 'Trợ lý hội thoại Ori',
        'Hỏi bằng ngôn ngữ tự nhiên thay vì phải tự tìm trong menu.',
        'Bong bóng chat nổi trên mọi màn hình và một màn hình chat đầy đủ.',
        'Câu hỏi được định tuyến ý định → truy hồi sản phẩm thật từ catalog → dựng bản nháp trả lời '
        'bám vào dữ liệu → mô hình ngôn ngữ (nếu có) chỉ viết lại cho tự nhiên.',
        '`POST /api/chat` · `GET /api/chat/history`',
        '`chats`, `products`, `product_variants`, `orders`, `interactions`',
        'Mô hình ngôn ngữ **chỉ được phép viết lại** bản nháp đã bám dữ liệu; nó không được bịa tồn '
        'kho, giá hay sự thật về cơ thể. Tư vấn sức khoẻ được tách khỏi tư vấn mua sắm.',
        'Khi mô hình ngôn ngữ tắt hoặc trả lời không dùng được, hệ thống rơi về bản nháp đã bám dữ '
        'liệu — vẫn đúng, chỉ kém trau chuốt hơn.',
        'Có kiểm thử cho phần định tuyến ý định và phần truy hồi sản phẩm.')

    r.h3('5.1.8. Đo cơ thể, gợi ý size và thử đồ')
    r.p('Giao diện của mô-đun này tuân theo nguyên tắc: kết quả từ ảnh luôn được ghi là ước lượng, '
        'trạng thái “không đủ dữ liệu” được hiển thị thay cho một con số thiếu bằng chứng, và người '
        'dùng luôn có thể nhập số đo thật. Trong lần chụp mới ngày 04/09/2026, thiết bị chưa có phiên '
        'đăng nhập hợp lệ để đi tới bước tải ảnh; vì vậy báo cáo không giữ ảnh giao diện thử đồ cũ và '
        'không dùng màn hình đăng nhập làm bằng chứng cho một luồng chưa chạy hết.')
    _module(r, 'Thử đồ ảo trên ảnh thật',
        'Thấy trang phục trên chính cơ thể mình trước khi quyết định mua.',
        'Màn hình thử đồ với ba bước, phần xem trước sản phẩm, hai nút chụp ảnh và chọn ảnh, phần nhập '
        'số đo thủ công thu gọn mặc định.',
        'Chọn ảnh → (tuỳ chọn) phân tích cơ thể → chọn size → tạo ảnh → nhận kết quả hoặc lý do từ chối.',
        '`POST /api/tryon` · `POST/GET/DELETE /api/tryon/jobs` · `POST /api/stylist/body-analysis`',
        '`products`, `product_variants`, `profiles`, `interactions`',
        'Ảnh của khách **không được lưu** vào cơ sở dữ liệu hay bộ nhớ đệm. Thiếu số đo không chặn thử '
        'đồ. Không có phương án dán ảnh sản phẩm lên người.',
        'Ảnh không đạt cổng chất lượng bị huỷ kết quả và hệ thống giải thích lý do bằng ngôn ngữ khách '
        'hiểu được; cơ chế và ngưỡng kiểm tra được trình bày chi tiết ở Chương 6.',
        'Có ma trận kiểm thử 5 dáng người × 7 size với ảnh kết quả kèm theo; xem mục 6.4.')

    r.h3('5.1.9. Khám phá Nhật Bản và "Đưa tôi đến đây"')
    _module(r, '25 địa danh và ghép ảnh vào cảnh thật',
        'Biết mặc bộ đồ này ở đâu thì đẹp, và thấy trước mình đứng ở đó.',
        'Danh sách địa danh, chi tiết địa danh, hộp ghép ảnh "Đưa mình tới đây".',
        'Chọn địa danh → nhận gợi ý trang phục chấm theo sáu tiêu chí → thử đồ ngay → ghép kết quả vào '
        'ảnh thật của nơi đó.',
        '`GET /api/japan-spots/catalog` · `GET /api/japan-spots/recommendations` · '
        '`POST /api/japan-spots/scene-photo` · `POST /api/japan-spots/suggestions`',
        '`japan_spots`, `japan_spot_reviews`, `japan_spot_suggestions`, `products`, `product_variants`',
        'Client **chỉ gửi tên địa danh**; máy chủ tự tra đường dẫn ảnh nền. Đồ bơi bị chặn tuyệt đối ở '
        'nơi trang nghiêm và chỉ xuất hiện ở địa điểm biển sau khi qua cổng độ tuổi.',
        'Ghép cảnh lỗi thì ảnh thử đồ vẫn được giữ lại để thử lại riêng bước ghép.',
        'Có kiểm thử so sánh trực tiếp bảng địa danh ở ứng dụng với bảng ở máy chủ để hai bên không '
        'lệch nhau; có bộ kiểm tra tính hợp lệ của metadata từng cảnh.')

    r.h3('5.1.10. Mục tiêu tiết kiệm, sức khoẻ và thông báo')
    _module(r, 'Quỹ mục tiêu và lộ trình sức khoẻ',
        'Đặt mục tiêu mua một món đắt tiền và theo dõi tiến độ tiết kiệm.',
        'Màn hình mục tiêu với thanh tiến độ và lịch sử đóng góp.',
        'Chọn sản phẩm mục tiêu → góp dần → khi đủ, hệ thống phát voucher thưởng.',
        '`GET/POST /api/goals` · `POST /api/goals/:id/contribute`',
        '`goals`, `vouchers`, `notifications`',
        'Lộ trình sức khoẻ được **tách hẳn** khỏi mục tiêu mua sắm và có rào chắn an toàn: hệ thống '
        'không đưa lời khuyên y tế và không lưu mục tiêu sức khoẻ như một quỹ mua hàng.',
        'Góp vượt mục tiêu bị chặn với thông báo rõ ràng.',
        'Có kiểm thử cho phần phát voucher khi hoàn thành mục tiêu.')
    _module(r, 'Thông báo',
        'Biết khi đơn đổi trạng thái hoặc khi có ưu đãi dành riêng.',
        'Trung tâm thông báo trong ứng dụng.',
        'Sự kiện nghiệp vụ sinh thông báo → hiển thị trong ứng dụng → chạm vào thì mở đúng màn hình '
        'liên quan.',
        '`GET /api/notifications` · `POST /api/push/register`',
        '`notifications`, `push_tokens`',
        'Mỗi thông báo mang một đường dẫn sâu tới màn hình đích, không chỉ là một dòng chữ.',
        '—',
        '**Thông báo đẩy từ xa hiện chưa gửi được** vì dự án chưa có định danh EAS; đường đang dùng là '
        'thông báo cục bộ trong ứng dụng. Đây là giới hạn đã biết.')

    # ============================================================ STOREFRONT
    r.h2('5.2. Website storefront')
    r.p('Website là một **dự án độc lập** nằm trong thư mục `web/`. Nó có cây phụ thuộc riêng, tệp cấu '
        'hình riêng và không nằm trong không gian gói của thư mục gốc; nó cũng không nhập một dòng mã '
        'React Native nào. Việc nói rõ điều này là cần thiết vì trong nhiều đồ án, "website" chỉ là bản '
        'web của ứng dụng di động — ở đây thì không phải.')
    r.table(
        'Công nghệ của website storefront.',
        ['Lớp', 'Công nghệ'],
        [
            ['Khung ứng dụng', 'React 19 với App Router (chạy trên `vinext`), TypeScript ở chế độ nghiêm ngặt'],
            ['Dữ liệu và biểu mẫu', 'TanStack Query, Zod, React Hook Form'],
            ['Giao diện và hoạt cảnh', 'Tailwind 4, Motion for React, GSAP 3.15, View Transitions'],
            ['Kiểm thử', 'Vitest cho kiểm thử đơn vị, Playwright cho kiểm thử đầu-cuối'],
            ['Triển khai dự kiến', 'Cloudflare Workers (mới ở mức build và chạy thử khô)'],
        ],
        widths=[Cm(3.8), Cm(11.7)], font=11)
    r.p('Ba thư viện từng có mặt nhưng đã bị gỡ, và việc gỡ chúng cũng là một quyết định kỹ thuật: '
        'Three.js bị loại khỏi danh sách phụ thuộc vì phần hiệu ứng ba chiều không đáng với dung lượng '
        'gói mà nó thêm vào; hoạt cảnh nền chuyển sang dùng video thật.')
    r.figure(SCREEN / 'sf-home-desktop.png',
             'Trang chủ website ở độ rộng 1440 px: khu vực mở đầu dùng video thật, thanh điều hướng '
             'dẫn thẳng tới ba trải nghiệm chính.',
             source='Ảnh chụp Chromium qua Playwright, 31/08/2026, `http://127.0.0.1:4200/`; không có '
                    'lỗi console nào trong lần chụp.',
             width_cm=15.0)

    r.h3('5.2.1. Lớp BFF và ranh giới bảo mật')
    r.p('Phần này đã được trình bày ở mục 4.4. Ở đây chỉ nhắc lại điều quan trọng nhất với người vận '
        'hành: **trình duyệt không bao giờ giữ JWT**, và bảy nhóm đường dẫn nhạy cảm bị trả 404 ngay '
        'tại lớp proxy chứ không chờ tới tầng phân quyền của backend. Hai lớp phòng thủ độc lập thay '
        'vì một.')

    r.h3('5.2.2. Các trang và luồng')
    r.figure(SCREEN / 'sf-products-desktop.png',
             'Trang danh sách sản phẩm của website với bộ lọc và lưới sản phẩm.',
             source='Ảnh chụp Chromium qua Playwright, 31/08/2026, `/san-pham`.',
             width_cm=15.0)
    r.table(
        'Các trang chính của website và trạng thái triển khai.',
        ['Đường dẫn', 'Nội dung', 'Trạng thái'],
        [
            ['`/`', 'Trang chủ: khu vực mở đầu có video, hàng mới, bán chạy, giới thiệu AI, cửa hàng.', 'Hoàn thành'],
            ['`/san-pham`', 'Danh sách sản phẩm có lọc, sắp xếp và phân trang.', 'Hoàn thành'],
            ['`/hang-moi`, `/ban-chay`', 'Hai bộ sưu tập rút gọn từ cùng nguồn dữ liệu.', 'Hoàn thành'],
            ['`/tim-kiem`', 'Tìm kiếm sản phẩm.', 'Hoàn thành'],
            ['`/thu-do`', 'Thử đồ ảo trên web qua hàng đợi công việc bất đồng bộ.', 'Hoàn thành'],
            ['`/du-lich-nhat-ban`', 'Giới thiệu địa danh và thử đồ theo bối cảnh.', 'Hoàn thành'],
            ['`/gio-hang`, `/thanh-toan`', 'Giỏ hàng và đặt hàng.', 'Hoàn thành'],
            ['`/yeu-thich`, `/tai-khoan`', 'Danh sách yêu thích và khu vực tài khoản.', 'Hoàn thành'],
            ['`/cua-hang`', 'Vị trí cửa hàng, nhúng bản đồ chỉ sau khi người dùng bấm mở.', 'Hoàn thành'],
            ['`/dang-nhap`, `/dang-ky`', 'Xác thực; **đăng nhập Google chưa hoạt động**.', 'Hoàn thành một phần'],
            ['`/chinh-sach`, `/bo-suu-tap`', 'Nội dung tĩnh.', 'Hoàn thành'],
        ],
        widths=[Cm(3.4), Cm(8.6), Cm(3.5)], font=10.5)

    r.h3('5.2.3. Hàng đợi công việc AI bất đồng bộ trên web')
    r.p('Thử đồ trên web không dùng chung điểm cuối đồng bộ với ứng dụng di động. Lý do là môi trường '
        'trình duyệt khác hẳn: người dùng chuyển tab, mạng chập chờn, và giữ một kết nối mở suốt một '
        'phút là thiết kế mong manh. Vì vậy website dùng ba nhóm điểm cuối hàng đợi cho thử đồ, tạo '
        'video và ghép ảnh cảnh.')
    r.bullets([
        'Hàng đợi nằm **trong RAM có thời hạn sống**, không tạo collection MongoDB nào.',
        'Ảnh đầu vào bị **xoá ngay khi công việc kết thúc**.',
        'Lệnh DELETE thật sự huỷ được yêu cầu đang chạy, không chỉ đánh dấu trạng thái.',
        'Giao diện **không hiển thị thanh phần trăm giả**: nó chỉ hiển thị trạng thái thật của công việc.',
        'Các điểm cuối đồng bộ cũ vẫn giữ nguyên cho ứng dụng di động, nên hai bề mặt không phải chờ nhau.',
    ])

    r.h3('5.2.4. Kết quả đo hiệu năng và khả năng truy cập')
    r.table(
        'Kết quả đo website trên bản build production chạy bằng workerd, ngày 30/08/2026.',
        ['Chỉ tiêu', 'Kết quả'],
        [
            ['Lighthouse — hiệu năng', '93–99 trên 5 trang máy tính; trang chủ đạt 94'],
            ['Lighthouse — khả năng truy cập, thực hành tốt, SEO', '100 / 100 / 100'],
            ['Thời gian hiển thị nội dung lớn nhất (LCP)', '1,0 – 1,7 giây'],
            ['Độ dịch chuyển bố cục tích luỹ (CLS)', '≤ 0,038; trang chủ 0,003'],
            ['Thời gian chặn tổng (TBT)', '0 – 10 mili giây'],
            ['Playwright', '30/30 đạt trên hai cấu hình thiết bị: 390 px và 1440 px'],
            ['Kiểm thử đơn vị Vitest', '7/7 đạt (đo lại ngày 31/08/2026)'],
            ['Kiểm tra kiểu TypeScript', 'Không lỗi (đo lại ngày 31/08/2026)'],
        ],
        widths=[Cm(8.0), Cm(7.5)], font=10.5,
        note='`docs/project_evidence/ai_benchmarks/WEB_STOREFRONT_2026-08-30.md`; hai dòng cuối được '
             'chạy lại trong lần dựng báo cáo ngày 31/08/2026.')
    r.p('Bộ kiểm thử đầu-cuối của website được cấu hình khắt khe có chủ đích: một lần chạy bị coi là '
        'thất bại nếu xuất hiện lỗi console, ảnh vỡ, tràn ngang màn hình, hoặc bất kỳ mục tiêu chạm nào '
        'nhỏ hơn 44 × 44 điểm ảnh. Các tiêu chí này áp dụng trên cả hai độ rộng thiết bị.')
    r.note('Bộ kiểm thử đầy đủ chạy trên bản production bằng workerd **vẫn còn cảnh báo hydration React '
           '#418** ở một vài trang phía client sau khi điều hướng. Đây là giới hạn chưa xử lý, đang '
           'được theo dõi, và báo cáo giữ nguyên nó thay vì chỉ trình bày những con số đẹp ở bảng trên.',
           label='Vấn đề còn tồn tại')

    r.h3('5.2.5. Trạng thái triển khai thật')
    r.p('Cần nói rõ ba điều về triển khai, vì đây là chỗ dễ trình bày quá lời nhất:')
    r.bullets([
        'Lệnh build và `wrangler deploy --dry-run` **chạy được**. Điều đó chứng minh mã nguồn hợp lệ và '
        'gói triển khai dựng được.',
        'Website **chưa từng được deploy công khai**. Máy phát triển chưa đăng nhập vào Cloudflare, và '
        'quan trọng hơn, backend hiện chỉ truy cập được trong mạng nội bộ Tailscale nên một bản deploy '
        'công khai sẽ không có dữ liệu.',
        'Địa chỉ backend mặc định trong cấu hình website là địa chỉ tailnet. Đây là lựa chọn có chủ '
        'đích và **không được đổi về địa chỉ cục bộ**, vì làm vậy sẽ khiến bản build mất kết nối khi '
        'chạy ngoài máy phát triển.',
    ])

    # ================================================================= ADMIN
    r.h2('5.3. Web Admin')
    r.p('Trang quản trị được viết bằng HTML, CSS và JavaScript thuần, không có bước build. Lựa chọn '
        'này trông có vẻ lạc hậu nhưng có lý do thực tế: trang quản trị được phục vụ trực tiếp từ '
        'backend tại `/admin/`, nên không cần thêm một tiến trình build hay một máy chủ tĩnh nữa. Cái '
        'giá phải trả là chính sách CSP hiện đang tắt vì phần mã còn nhiều chỗ dựng HTML động chưa '
        'được rà hết — một rủi ro được nêu đầy đủ ở mục 7.3.')
    r.figure(SCREEN / 'admin-login-desktop.png',
             'Màn hình đăng nhập của Web Admin: bố cục hai cột, ghi rõ phiên được bảo vệ bằng JWT và '
             'phân quyền vai trò.',
             source='Ảnh chụp Chromium qua Playwright, 31/08/2026, `http://127.0.0.1:4100/admin/`.',
             width_cm=15.0)
    r.figure_placeholder(
        'IMG-ADMIN-01',
        'Bảng điều khiển tổng quan của Web Admin sau khi đăng nhập',
        'Chứng minh dashboard KPI, biểu đồ doanh thu và các thẻ chỉ số hoạt động trên dữ liệu thật.',
        'Đăng nhập bằng một tài khoản có vai trò admin, mở trang tổng quan, chụp toàn màn hình ở độ '
        'rộng 1440 px. Che hoặc làm mờ địa chỉ email và tên khách hàng thật nếu có xuất hiện trong '
        'các thẻ danh sách.',
        '16:10 — tối thiểu 2560 × 1600 px',
        'Chương 5, mục 5.3.1 — Dashboard KPI',
        'Che email, số điện thoại và mọi mã thẻ hoặc mã giao dịch.')
    r.note('Nhóm **không chụp được** màn hình quản trị sau đăng nhập trong lần dựng báo cáo này: mật '
           'khẩu quản trị hiện được cấu hình không đăng nhập được vào tài khoản `admin@japano.vn` (máy '
           'chủ trả 401), và nhóm cố ý **không** đặt lại mật khẩu chỉ để chụp ảnh, vì đó là một thao '
           'tác thay đổi dữ liệu sống. Các ảnh còn thiếu được đánh dấu bằng khung hướng dẫn ngay tại '
           'vị trí cần chèn và tổng hợp ở Phụ lục I.', label='Vì sao có ảnh còn thiếu')

    r.h3('5.3.1. Các phân hệ của trang quản trị')
    r.table(
        'Các phân hệ của Web Admin và chức năng chính.',
        ['Phân hệ', 'Chức năng'],
        [
            ['Dashboard', 'Chỉ số theo thời gian thực: doanh thu theo ngày/tuần/tháng/năm, số đơn, tồn '
             'kho, số khách hàng.'],
            ['Analytics', 'Dự báo doanh thu ba tháng, điểm nhu cầu sản phẩm, rủi ro tồn kho, phân cụm '
             'K-Means, nguy cơ rời bỏ theo RFM, luật mua kèm, báo cáo từ khoá tìm kiếm.'],
            ['Model observability', 'Trạng thái từng nguồn gợi ý, số cạnh đồ thị, số cặp huấn luyện của '
             'bộ xếp hạng, độ phủ, và số liệu vận hành của trợ lý.'],
            ['Commerce', 'Đơn hàng, sản phẩm, biến thể, danh mục, người dùng, giỏ hàng đang hoạt động.'],
            ['Payment', 'Tra cứu giao dịch Stripe và VNPay, đối soát, xử lý trả hàng và hoàn tiền.'],
            ['Content', 'Duyệt đánh giá, cộng đồng địa danh Nhật Bản, banner, thông báo, voucher.'],
            ['Integrations', 'Tình trạng kết nối của API, media, cổng thanh toán và từng dịch vụ AI.'],
        ],
        widths=[Cm(3.6), Cm(11.9)], font=10.5)

    r.h3('5.3.2. Dashboard không phải là biểu đồ trang trí')
    r.p('Một dashboard chỉ có giá trị khi mỗi con số trên đó dẫn tới một hành động làm được ngay. '
        'Nhóm áp dụng nguyên tắc này bằng cách yêu cầu mỗi chỉ số phải trả lời được câu hỏi "thấy con '
        'số này thì tôi làm gì". Đường đi của dữ liệu vì vậy được thiết kế thành một chuỗi khép kín:')
    r.formula([
        'MongoDB / Backend  →  chuẩn hoá dữ liệu  →  thuật toán',
        '→  KPI · dự báo · phân khúc · rủi ro  →  dashboard  →  hành động quản trị',
    ], note='Chuỗi này khép kín: hành động quản trị sinh ra dữ liệu mới, và dữ liệu mới lại chảy ngược '
            'về đầu chuỗi ở lần tổng hợp sau.')
    r.table(
        'Ví dụ về chuỗi từ dữ liệu tới hành động trên Web Admin.',
        ['Chỉ số hiển thị', 'Thuật toán phía sau', 'Hành động quản trị tương ứng'],
        [
            ['Dự báo doanh thu ba tháng kèm khoảng tin cậy',
             'Trộn OLS, Holt và trung bình trượt có trọng số theo nghịch đảo sai số',
             'Quyết định mức nhập hàng và ngân sách khuyến mãi cho quý tới.'],
            ['Rủi ro tồn kho của từng sản phẩm',
             'Điểm nhu cầu và đà 30 ngày chia cho tồn kho hiện tại, ra số ngày tới khi hết hàng',
             'Nhập thêm ngay với các sản phẩm còn dưới 14 ngày; giảm giá với hàng tồn quá lâu.'],
            ['Ba phân khúc khách hàng',
             'K-Means k ≤ 3 trên chi tiêu, số đơn và độ gần đây, đã chuẩn hoá z-score',
             'Soạn nội dung khác nhau cho từng nhóm thay vì gửi chung một thông điệp.'],
            ['Danh sách khách có nguy cơ rời bỏ',
             'Chấm điểm RFM minh bạch: 0,62 × độ lâu chưa mua + 0,23 × (1 − tần suất) + 0,15 × (1 − chi tiêu)',
             'Gửi ưu đãi quay lại cho nhóm nguy cơ cao; nhắc bộ sưu tập mới cho nhóm trung bình.'],
            ['Luật mua kèm có lift cao',
             'Luật kết hợp kiểu Apriori trên các đơn hợp lệ, tính support, confidence và lift',
             'Dựng combo bán kèm và bố trí lại vị trí sản phẩm gợi ý.'],
            ['Từ khoá tìm kiếm không ra kết quả',
             'Tổng hợp nhật ký tìm kiếm',
             'Bổ sung sản phẩm hoặc bổ sung nhãn cho sản phẩm đã có — đây là nhu cầu chưa được đáp ứng, '
             'nhìn thấy trực tiếp.'],
        ],
        widths=[Cm(3.8), Cm(5.6), Cm(6.1)], font=10)
    r.p('Công thức chi tiết của từng thuật toán trong bảng trên nằm ở mục 6.10, kèm ví dụ tính tay và '
        'phần bàn về giới hạn. Ở đây nhóm nhấn mạnh một điều về thuật ngữ: **các biểu đồ này không '
        'phải "AI dashboard"**. Dự báo chuỗi thời gian, phân cụm và luật kết hợp là thống kê và học '
        'máy cổ điển, minh bạch và kiểm tra tay được. Gọi chúng là AI để nghe cho mạnh sẽ đi ngược lại '
        'nguyên tắc thuật ngữ mà đồ án đặt ra ở Chương 1.')

    r.h3('5.3.3. Phân quyền và những gì trang quản trị cố ý không cho làm')
    r.p('Trang quản trị áp dụng bốn mức vai trò với middleware kiểm tra riêng ở phía máy chủ — nghĩa là '
        'giấu một nút trên giao diện **không** được coi là biện pháp phân quyền. Ngoài ra có hai điều '
        'trang quản trị cố ý không cho phép làm:')
    r.bullets([
        '**Không có nút xoá sản phẩm.** Hành động duy nhất là ẩn hoặc hiện lại, và giao diện giải thích '
        'rằng sản phẩm ẩn có thể khôi phục. Một lần kiểm tra bằng trình duyệt đã xác nhận: không còn nút '
        'xoá nào, thao tác ẩn gửi một yêu cầu PUT, không có yêu cầu DELETE nào được phát ra, hàng vẫn '
        'nằm trong bảng và trạng thái chuyển thành "Đã ẩn".',
        '**Không sửa dữ liệu hàng loạt qua một điểm cuối chung.** Việc ghi đè trạng thái toàn cục là '
        'con đường ngắn nhất dẫn tới mất dữ liệu, và dự án đã trả giá cho bài học đó một lần rồi '
        '(mục 4.7.1).',
    ])
    r.p('Về khả năng truy cập: cả 16 tuyến đường của trang quản trị đã được kiểm tra bằng công cụ tự '
        'động và không còn vi phạm WCAG 2.1 mức A/AA nào khi bật chế độ giảm chuyển động. Bảng dữ liệu '
        'cuộn được bằng bàn phím, thanh điều hướng hỗ trợ phím Enter và Space, và trạng thái trang hiện '
        'tại được công bố cho trình đọc màn hình.')
    r.note('Lần kiểm tra giao diện sau đăng nhập nói trên được thực hiện bằng một thẻ phiên tạm thời '
           'dùng cho kiểm thử cùng với một phản hồi danh tính giả lập, **không phải** bằng một tài '
           'khoản quản trị thật. Mật khẩu quản trị đang cấu hình vẫn trả 401 và nhóm cố ý không đặt '
           'lại nó. Điều này có nghĩa là luồng đăng nhập quản trị đầu-cuối với tài khoản thật **chưa '
           'được xác minh** trong lần dựng báo cáo này.', label='Giới hạn của bằng chứng')
