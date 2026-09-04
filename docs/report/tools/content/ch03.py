"""Chương 3 — Phân tích hệ thống và use case."""
from docx.shared import Cm

from paths import DIAG

W = [Cm(2.9), Cm(12.6)]


def _uc(r, code, name, actor, pre, post, main, alt, exc, endpoints, data):
    """Đặc tả một use case dưới dạng bảng chuẩn."""
    rows = [
        ['Mã use case', f'**{code}**'],
        ['Tên', f'**{name}**'],
        ['Tác nhân', actor],
        ['Tiền điều kiện', pre],
        ['Hậu điều kiện', post],
        ['Luồng chính', '\n'.join(main) if isinstance(main, list) else main],
        ['Luồng thay thế', '\n'.join(alt) if isinstance(alt, list) else alt],
        ['Ngoại lệ', '\n'.join(exc) if isinstance(exc, list) else exc],
        ['Điểm cuối / mô-đun', endpoints],
        ['Dữ liệu đọc / ghi', data],
    ]
    # Luồng nhiều bước phải là nhiều đoạn để không bị dính thành một dòng dài.
    flat = []
    for label, value in rows:
        if '\n' in str(value):
            for index, line in enumerate(str(value).split('\n')):
                flat.append([label if index == 0 else '', line])
        else:
            flat.append([label, value])
    r.table(f'Đặc tả use case {code} — {name}.', ['Hạng mục', 'Nội dung'], flat, widths=W, font=10.5)


def build(r):
    r.h1('Phân tích hệ thống và mô hình use case')
    r.p('Chương này chuyển từ mô tả sản phẩm sang mô tả yêu cầu. Điểm khác biệt so với một bản phân '
        'tích viết trước khi lập trình là ở đây mọi tác nhân và mọi use case đều được **rút ra từ hệ '
        'thống đã chạy**: mỗi use case dưới đây đều có ít nhất một điểm cuối REST hoặc một màn hình '
        'tương ứng trong mã nguồn, và những use case từng được nghĩ tới nhưng không được xây dựng thì '
        'không xuất hiện trong chương này.')

    r.h2('3.1. Xác định tác nhân')
    r.p('JAPANO có mười tác nhân, chia thành hai nhóm: tác nhân người và tác nhân hệ thống. Việc đưa '
        'tác nhân hệ thống vào mô hình không phải để cho sơ đồ trông đầy đặn, mà vì chúng thật sự '
        'quyết định luồng: một đơn thanh toán thẻ chỉ chuyển trạng thái khi cổng thanh toán gọi ngược '
        'lại, và một lượt thử đồ chỉ hoàn tất khi dịch vụ GPU trả về ảnh.')
    r.table(
        'Danh sách tác nhân của hệ thống JAPANO.',
        ['Tác nhân', 'Loại', 'Quyền hạn và vai trò trong hệ thống'],
        [
            ['Khách chưa đăng nhập', 'Người',
             'Duyệt catalog, tìm kiếm, xem chi tiết sản phẩm, thêm vào giỏ trên thiết bị. Không truy '
             'cập được đơn hàng, hồ sơ hay tính năng AI cần danh tính.'],
            ['Khách hàng (`customer`)', 'Người',
             'Toàn bộ chức năng mua sắm, hậu mãi, thử đồ, đo cơ thể, trợ lý, khám phá Nhật Bản, mục '
             'tiêu tiết kiệm và chương trình khách hàng thân thiết.'],
            ['Nhân viên (`staff`)', 'Người',
             'Xử lý đơn hàng, cập nhật trạng thái vận chuyển, duyệt yêu cầu trả hàng, kiểm duyệt nội '
             'dung, xem dashboard. Không sửa được cấu hình hệ thống.'],
            ['Quản trị viên (`admin`)', 'Người',
             'Bao trùm quyền nhân viên, thêm quản lý sản phẩm và biến thể, voucher, banner, đối soát '
             'thanh toán, hoàn tiền, xem phân tích và theo dõi sức khoẻ dịch vụ.'],
            ['Super Admin (`super_admin`)', 'Người',
             'Bao trùm quyền quản trị viên, thêm quản lý người dùng và gán vai trò.'],
            ['Cổng Stripe', 'Hệ thống',
             'Nhận yêu cầu thanh toán thẻ ở chế độ Test, gọi ngược webhook đã ký để xác nhận thành '
             'công, thất bại hoặc hoàn tiền.'],
            ['Cổng VNPay', 'Hệ thống',
             'Nhận yêu cầu thanh toán ở môi trường Sandbox, trả kết quả qua chuỗi truy vấn có ký HMAC.'],
            ['Cloudinary', 'Hệ thống',
             'Lưu trữ và phục vụ ảnh, video sản phẩm. Cơ sở dữ liệu chỉ giữ URL và metadata.'],
            ['MongoDB Atlas', 'Hệ thống',
             'Kho dữ liệu runtime chính. ERD và phần thuyết trình cơ sở dữ liệu dùng đúng 19 bảng nghiệp vụ.'],
            ['Cụm dịch vụ AI cục bộ', 'Hệ thống',
             'Bốn tiến trình riêng: phân tích cơ thể (CPU), thử đồ (GPU), tạo video (GPU) và mô hình '
             'ngôn ngữ tuỳ chọn qua Ollama. Được điều phối bởi bộ arbiter GPU.'],
        ],
        widths=[Cm(3.2), Cm(1.8), Cm(10.5)], font=10.5)

    r.h2('3.2. Hai sơ đồ Use Case chính thức')
    r.p('Báo cáo chỉ sử dụng **hai sơ đồ Use Case đã được nhóm chốt**: một sơ đồ cho phân hệ mua sắm '
        'của khách hàng và một sơ đồ cho phân hệ quản trị Web Admin. Hai hình này thay thế toàn bộ '
        'các bản Use Case cũ; các quy trình AI, thanh toán và hậu mãi được mô tả bằng đặc tả văn bản '
        'ở mục 3.3 thay vì tách thêm hình khác.')

    r.h3('3.2.1. Phân hệ mua sắm dành cho khách hàng')
    r.p('Sơ đồ khách hàng tách riêng để có chỗ thể hiện đúng quan hệ `include` và `extend`. Quy ước: '
        '`include` là bước **bắt buộc** của luồng chính — bỏ nó thì use case cha không hoàn thành; '
        '`extend` là nhánh **chỉ chạy khi thoả điều kiện**. Chẳng hạn "Áp mã giảm giá" là `extend` của '
        '"Đặt hàng" vì đơn không có mã vẫn đặt được, còn "Chọn địa chỉ giao hàng" là `include` vì '
        'không có địa chỉ thì không có đơn.')
    r.figure(DIAG / 'D04-uc-khach-hang.png',
             'Use Case chính thức của phân hệ mua sắm dành cho khách hàng.',
             source='Nhóm tự vẽ; tệp nguồn `docs/report/diagrams/D04-uc-khach-hang.drawio`.',
             width_cm=15.0)

    r.h3('3.2.2. Phân hệ quản trị Web Admin')
    r.p('Ba vai trò quản trị được vẽ chồng lớp theo đúng thứ tự phân quyền: mũi tên của `staff` chỉ '
        'tới nhóm việc vận hành hằng ngày, `admin` thêm nhóm việc cấu hình và tiền bạc, `super_admin` '
        'thêm nhóm việc quản lý con người. Cách vẽ này làm lộ ra một tính chất quan trọng của hệ '
        'thống: **quyền càng cao thì số use case càng ít nhưng hậu quả càng lớn**.')
    r.figure(DIAG / 'D05-uc-quan-tri.png',
             'Use Case chính thức của phân hệ quản trị với ba mức vai trò.',
             source='Nhóm tự vẽ; tệp nguồn `docs/report/diagrams/D05-uc-quan-tri.drawio`.',
             width_cm=15.0)

    r.h2('3.3. Đặc tả chi tiết các use case quan trọng')
    r.p('Mười bốn use case dưới đây được đặc tả đầy đủ vì chúng hoặc chạm vào tiền, hoặc chạm vào dữ '
        'liệu cá nhân, hoặc là nơi hệ thống có thể từ chối người dùng — ba nhóm mà một mô tả sơ sài dễ '
        'gây hiểu nhầm nhất. Cột "Điểm cuối / mô-đun" trỏ thẳng tới mã nguồn để người đọc kiểm chứng.')

    _uc(r, 'UC-01', 'Đăng ký tài khoản', 'Khách chưa đăng nhập',
        'Người dùng chưa có tài khoản với địa chỉ email định dùng.',
        'Tài khoản mới được tạo với vai trò `customer`, mật khẩu đã băm bcrypt; người dùng có phiên '
        'đăng nhập hợp lệ.',
        ['1. Người dùng mở màn hình đăng ký và nhập họ tên, email, mật khẩu.',
         '2. Client kiểm tra sơ bộ định dạng và độ mạnh mật khẩu.',
         '3. Hệ thống kiểm tra email chưa tồn tại.',
         '4. Hệ thống kiểm tra chính sách mật khẩu phía máy chủ.',
         '5. Hệ thống băm mật khẩu bằng bcrypt và ghi bản ghi người dùng.',
         '6. Hệ thống ký JWT kèm vai trò và trả về cho client.',
         '7. Client lưu phiên (SecureStore trên ứng dụng, cookie HttpOnly trên website).'],
        ['3a. Email đã tồn tại: hệ thống trả lỗi và mời người dùng đăng nhập hoặc khôi phục mật khẩu.',
         '4a. Mật khẩu không đạt chính sách: trả về lý do cụ thể để người dùng sửa.'],
        ['E1. Vượt giới hạn 20 lần trong 15 phút cho mỗi địa chỉ IP: trả mã 429 kèm thông báo chờ.',
         'E2. Mất kết nối cơ sở dữ liệu: trả lỗi máy chủ, không tạo tài khoản một nửa.'],
        '`POST /api/auth/register` · `backend/routes/auth.js` · `backend/lib/auth.js`',
        'Ghi: `users`. Đọc: `users` (kiểm tra trùng email).')

    _uc(r, 'UC-02', 'Đăng nhập', 'Khách hàng, Nhân viên, Quản trị viên, Super Admin',
        'Tài khoản đã tồn tại và chưa bị khoá.',
        'Người dùng có JWT hợp lệ mang đúng vai trò của mình.',
        ['1. Người dùng nhập email và mật khẩu.',
         '2. Hệ thống áp giới hạn chống thử mật khẩu hàng loạt.',
         '3. Hệ thống tìm người dùng theo email và so mật khẩu bằng `bcrypt.compare`.',
         '4. Hệ thống ký JWT kèm mã người dùng, vai trò và thời hạn.',
         '5. Client lưu phiên; ứng dụng di động khôi phục màn hình chính ngay từ bản sao người dùng đã '
         'lưu cục bộ trong khi vẫn xác thực lại ở nền.'],
        ['5a. Trên website, lớp BFF tách JWT khỏi phần thân phản hồi và đặt vào cookie `japano_session` '
         'với `HttpOnly` và `SameSite=Lax`; trình duyệt không bao giờ thấy token.'],
        ['E1. Sai email hoặc sai mật khẩu: trả 401 với thông điệp trung tính, không tiết lộ email có '
         'tồn tại hay không.',
         'E2. Vượt giới hạn: trả 429. Chỉ các điểm cuối thật sự nhận thông tin đăng nhập mới bị siết; '
         '`/auth/me` và `/auth/providers` cố ý nằm ngoài, vì trước đây chúng bị 429 và ứng dụng hiểu '
         'nhầm là phiên bị thu hồi rồi xoá token của người dùng thật.'],
        '`POST /api/auth/login` · `GET /api/auth/me` · `backend/lib/auth.js` · `web/app/api/[...path]`',
        'Đọc: `users`. Không ghi dữ liệu nghiệp vụ.')

    _uc(r, 'UC-03', 'Tìm kiếm, lọc và duyệt catalog', 'Khách chưa đăng nhập, Khách hàng',
        'Catalog có ít nhất một sản phẩm ở trạng thái `published`.',
        'Danh sách sản phẩm phù hợp được trả về; lượt tìm kiếm được ghi nhận để phục vụ phân tích.',
        ['1. Người dùng mở màn hình sản phẩm hoặc nhập từ khoá.',
         '2. Hệ thống lọc theo danh mục, kiểu dáng, khoảng giá và sắp xếp theo tiêu chí đã chọn.',
         '3. Hệ thống chỉ trả về sản phẩm `published` và có ít nhất một biến thể còn bán được.',
         '4. Hệ thống ghi lượt tìm kiếm vào nhật ký để phục vụ báo cáo từ khoá cho quản trị viên.'],
        ['2a. Không nhập từ khoá: trả về toàn bộ catalog theo thứ tự sắp xếp mặc định.',
         '4a. Từ khoá không ra kết quả: vẫn ghi nhật ký — đây là dữ liệu có giá trị cho người vận hành, '
         'vì nó chỉ ra nhu cầu chưa được đáp ứng.'],
        ['E1. Cơ sở dữ liệu không phản hồi: hệ thống dùng bản cache ảnh sản phẩm còn hạn thay vì hiển '
         'thị ô trống.'],
        '`GET /api/products` · `POST /api/search-log` · `backend/routes/catalog.js` · `web/lib/product.ts`',
        'Đọc: `products`, `product_variants`, `product_media`, `categories`. Ghi: `search_logs`.')

    _uc(r, 'UC-04', 'Thêm vào giỏ và hợp nhất giỏ khi đăng nhập', 'Khách chưa đăng nhập, Khách hàng',
        'Sản phẩm còn tồn kho ở biến thể được chọn.',
        'Giỏ hàng phản ánh đúng ý định mua; sau khi đăng nhập, giỏ trên thiết bị và giỏ trên tài khoản '
        'được hợp nhất mà không mất sản phẩm nào.',
        ['1. Người dùng chọn màu và size, bấm thêm vào giỏ.',
         '2. Khách chưa đăng nhập: giỏ được lưu trên thiết bị.',
         '3. Khách đã đăng nhập: hệ thống ghi vào `cart_items` gắn với tài khoản.',
         '4. Khi khách chưa đăng nhập thực hiện đăng nhập, hệ thống hợp nhất hai giỏ, **lấy số lượng '
         'lớn hơn** cho mỗi biến thể trùng nhau.'],
        ['1a. Sản phẩm không có biến thể còn hàng: nút thêm vào giỏ bị vô hiệu hoá ngay ở giao diện.'],
        ['E1. Tồn kho thay đổi giữa lúc thêm vào giỏ và lúc đặt hàng: bước đặt hàng kiểm tra lại và báo '
         'lỗi rõ ràng cho từng dòng hàng bị ảnh hưởng.'],
        '`GET/POST/DELETE /api/cart` · `backend/routes/customerData.js`',
        'Đọc: `product_variants`. Ghi: `cart_items`, `interactions` (tín hiệu `cart`).')

    _uc(r, 'UC-05', 'Đặt hàng và thanh toán', 'Khách hàng, Cổng Stripe, Cổng VNPay',
        'Giỏ hàng có ít nhất một dòng; khách đã chọn địa chỉ giao hàng.',
        'Đơn hàng và các dòng hàng được ghi kèm ảnh chụp giá tại thời điểm mua; chứng từ thanh toán '
        'được ghi đúng trạng thái thật của cổng.',
        ['1. Khách xác nhận giỏ, địa chỉ và (tuỳ chọn) mã giảm giá.',
         '2. **Máy chủ tính lại toàn bộ**: đơn giá từng biến thể, chiết khấu VIP, giá trị mã giảm giá, '
         'phí vận chuyển và tổng tiền. Các con số do client gửi lên bị bỏ qua.',
         '3. Máy chủ kiểm tra tồn kho từng biến thể.',
         '4. Máy chủ ghi `orders` và `order_items` với bản sao giá, tên, màu, size.',
         '5. Với COD: đơn được xác nhận ngay.',
         '6. Với Stripe hoặc VNPay: client mở phiên thanh toán; đơn ở trạng thái chờ.',
         '7. Cổng thanh toán gọi ngược về máy chủ (webhook đã ký với Stripe, chuỗi truy vấn ký HMAC '
         'với VNPay).',
         '8. Máy chủ ghi `payments` và chuyển trạng thái đơn.'],
        ['2a. Mã giảm giá không hợp lệ hoặc đã hết hạn: máy chủ bỏ mã và thông báo, không huỷ cả đơn.',
         '6a. Khách rời khỏi màn hình thanh toán: đơn giữ nguyên trạng thái chờ, **không** tự chuyển '
         'thành thành công.'],
        ['E1. Tồn kho không đủ: trả lỗi kèm danh sách dòng hàng cụ thể.',
         'E2. Chữ ký webhook không hợp lệ: máy chủ từ chối với mã 400 và không đổi trạng thái đơn.',
         'E3. Đơn thanh toán trực tuyến bị bỏ dở: **tồn kho hiện chưa được hoàn lại tự động** — đây là '
         'một giới hạn đã biết, được ghi chú ngay trong mã nguồn và nêu lại ở mục 7.3.'],
        '`POST /api/orders` · `backend/routes/orders.js` · `paymentsStripe.js` · `paymentsVnpay.js` · '
        '`backend/lib/pricing.js` · `backend/lib/inventory.js`',
        'Đọc: `products`, `product_variants`, `vouchers`, `users`. Ghi: `orders`, `order_items`, '
        '`payments`, `voucher_redemptions`, `notifications`.')

    _uc(r, 'UC-06', 'Yêu cầu trả hàng theo từng dòng và hoàn tiền',
        'Khách hàng, Nhân viên, Quản trị viên',
        'Đơn hàng ở trạng thái cho phép trả theo chính sách đã công bố.',
        'Yêu cầu trả được ghi nhận theo từng dòng hàng; nếu được duyệt và hàng đã gửi về, số tiền hoàn '
        'đúng bằng phần giá trị của các dòng được chấp nhận.',
        ['1. Khách chọn từng dòng hàng muốn trả và nêu lý do.',
         '2. Hệ thống tạo yêu cầu trả gắn với đơn và các dòng hàng cụ thể.',
         '3. Nhân viên hoặc quản trị viên duyệt hoặc từ chối.',
         '4. Khi được duyệt, khách gửi hàng trở lại và cập nhật mã theo dõi.',
         '5. Quản trị viên xác nhận đã nhận hàng và thực hiện hoàn tiền qua đúng kênh đã thanh toán.',
         '6. Hệ thống ghi chứng từ hoàn tiền và gửi thông báo cho khách.'],
        ['3a. Từ chối: hệ thống ghi lý do và thông báo cho khách; đơn giữ nguyên trạng thái.',
         '5a. Đơn COD: hoàn tiền thực hiện ngoài hệ thống, hệ thống chỉ ghi nhận trạng thái.'],
        ['E1. Yêu cầu trả cho dòng hàng đã trả trước đó: hệ thống từ chối để tránh hoàn tiền hai lần.',
         'E2. Hoàn tiền qua cổng thất bại: trạng thái giữ ở mức chờ và sự kiện thất bại được ghi lại.'],
        '`POST /api/returns` · `PATCH /api/orders/:id` · `backend/routes/returns.js` · '
        '`backend/lib/refundMath.js` · `backend/lib/fulfillmentPolicy.js`',
        'Đọc: `orders`, `order_items`, `payments`. Ghi: `return_requests`, `payments`, `notifications`.')

    _uc(r, 'UC-07', 'Viết đánh giá đã mua xác thực', 'Khách hàng',
        'Khách đã có ít nhất một đơn hoàn tất chứa sản phẩm được đánh giá.',
        'Đánh giá được ghi ở một trong ba trạng thái: đã duyệt, chờ duyệt, hoặc bị từ chối kèm lý do.',
        ['1. Khách mở sản phẩm đã mua và viết đánh giá kèm số sao.',
         '2. Hệ thống kiểm tra khách thật sự đã mua sản phẩm đó.',
         '3. Hệ thống chuẩn hoá văn bản và chạy bộ lọc chống lách luật cục bộ.',
         '4. Nếu kết quả cục bộ chưa đủ chắc chắn và có mô hình ngôn ngữ, hệ thống chạy thêm bước kiểm '
         'duyệt ngữ nghĩa.',
         '5. Hệ thống hợp nhất hai kết quả thành một quyết định cuối.'],
        ['4a. Không có mô hình ngôn ngữ: chỉ dùng kết quả cục bộ, hệ thống vẫn hoạt động đầy đủ.',
         '5a. Điểm nằm trong vùng xám: đánh giá chuyển sang chờ duyệt thay vì bị chặn oan.'],
        ['E1. Khách chưa mua sản phẩm: hệ thống từ chối tạo đánh giá.',
         'E2. Mô hình ngôn ngữ phản hồi quá lâu: hệ thống bỏ qua bước ngữ nghĩa thay vì để khách chờ.'],
        '`POST /api/reviews` · `backend/routes/reviews.js` · `backend/lib/reviewModeration.js`',
        'Đọc: `orders`, `order_items`. Ghi: `reviews`, `moderation_samples`.')

    _uc(r, 'UC-08', 'Ước lượng số đo cơ thể từ ảnh', 'Khách hàng, Cụm dịch vụ AI cục bộ',
        'Khách đã đồng ý cho hệ thống dùng ảnh của mình cho lần phân tích này.',
        'Hệ thống trả về khoảng ước lượng kèm độ tin cậy cho chiều cao, cân nặng và ba vòng đo, **hoặc** '
        'trạng thái chưa đủ bằng chứng.',
        ['1. Khách chụp hoặc chọn một ảnh toàn thân.',
         '2. Hệ thống kiểm tra chất lượng ảnh và độ phủ cơ thể.',
         '3. Hệ thống lấy 17 điểm khớp, loại các khớp có độ tin cậy thấp và các khớp nằm sát mép ảnh.',
         '4. Hệ thống chọn chủ thể chính nếu ảnh có nhiều người.',
         '5. Hệ thống tách hình bóng, cắt hai cánh tay khỏi thân, tính các đặc trưng hình học đã chuẩn hoá.',
         '6. Các bộ hồi quy ước lượng chiều cao, cân nặng và ba vòng; kết quả đi qua hiệu chuẩn dân số.',
         '7. Cổng tỉnh táo giải phẫu loại bỏ những giá trị bất khả thi.',
         '8. Hệ thống trả về khoảng 10 đơn vị kèm độ tin cậy.'],
        ['8a. Khách đã tự nhập số đo: **số đo tự nhập luôn thắng** ước lượng của mô hình.',
         '6a. Manh mối từ ảnh quá yếu: kết quả được gắn nhãn dựa trên tiên nghiệm dân số và bị đánh dấu '
         'không dùng được để chốt size.'],
        ['E1. Ảnh bị cắt cụt hoặc trang phục quá rộng: trả trạng thái chưa đủ bằng chứng, **không** trả '
         'một con số bịa.',
         'E2. Tiến trình phân tích không chạy: hệ thống lùi về đường xử lý dự phòng và báo rõ độ tin cậy '
         'thấp hơn.'],
        '`POST /api/stylist/body-analysis` · `backend/body_analysis.py` · `backend/body_geometry.py` · '
        '`backend/lib/bodyAnalysis.js`',
        'Đọc: `profiles` (số đo tự nhập). Ghi: `profiles` khi khách lưu lại kết quả. **Ảnh không được '
        'lưu lại.**')

    _uc(r, 'UC-09', 'Thử đồ ảo trên ảnh của khách',
        'Khách hàng, Cụm dịch vụ AI cục bộ',
        'Khách đã chọn sản phẩm, size và đồng ý cho dùng ảnh; dịch vụ GPU đang chạy.',
        'Khách nhận được một ảnh do mô hình sinh ra đã qua cổng chất lượng, **hoặc** một lời từ chối '
        'kèm lý do cụ thể.',
        ['1. Khách chọn ảnh, sản phẩm và size.',
         '2. Với trang phục nhạy cảm, hệ thống chạy cổng kiểm tra độ tuổi và độ che phủ trước.',
         '3. Hệ thống phân tích bằng chứng cơ thể (không bắt buộc thành công).',
         '4. Hệ thống tính độ vừa vặn: mức verdict, độ nghiêm trọng và danh sách hiệu ứng được phép.',
         '5. Hệ thống xin lượt GPU qua bộ điều phối với mức ưu tiên của màn hình thử đồ.',
         '6. FASHN VTON sinh ảnh mặc trang phục.',
         '7. Khi cần, FLUX.2 chạy thêm bước mô phỏng độ chật/rộng trên ảnh đã mặc xong.',
         '8. Cổng chất lượng chấm danh tính, cấu trúc trang phục và độ che phủ.',
         '9. Hệ thống trả ảnh kèm cảnh báo nếu có.'],
        ['3a. Không đo được cơ thể: **luồng vẫn tiếp tục** — đây là hai khả năng tách biệt.',
         '6a. Tư thế khó: hệ thống chạy thêm bước chuyển tư thế bằng FLUX.2 và chuyển chính sách kiểm '
         'tra danh tính từ nghiêm ngặt sang cảnh báo, vì so pixel không còn ý nghĩa khi tư thế đã đổi.',
         '9a. Ảnh đầu vào là mẫu dựng sẵn của JAPANO và không có cảnh báo nào: kết quả được lưu cache '
         'trên đĩa. **Ảnh của khách không bao giờ được ghi vào cache.**'],
        ['E1. Không đạt cổng chất lượng: hệ thống **giữ lại ảnh sạch** và nêu lý do, không trả ảnh hỏng.',
         'E2. Khách rời màn hình: yêu cầu đang chạy bị huỷ và GPU được nhả.',
         'E3. GPU đang phục vụ công việc ưu tiên cao hơn: yêu cầu xếp hàng chờ.'],
        '`POST /api/tryon` · `POST/GET/DELETE /api/tryon/jobs` · `backend/routes/tryon.js` · '
        '`backend/fashn_service.py` · `backend/lib/fitAnalysis.js` · `backend/lib/gpuArbiter.js`',
        'Đọc: `products`, `product_variants`, `profiles`. Ghi: `interactions` (tín hiệu `tryon`). '
        '**Ảnh khách không được ghi vào cơ sở dữ liệu hay cache.**')

    _uc(r, 'UC-10', 'Tạo video chuyển động từ kết quả thử đồ',
        'Khách hàng, Cụm dịch vụ AI cục bộ',
        'Đã có một ảnh thử đồ hợp lệ; máy chủ có GPU hỗ trợ CUDA.',
        'Khách nhận được một tệp MP4 mở được, hoặc lời từ chối kèm lý do.',
        ['1. Khách chọn một trong ba kiểu chuyển động: đi, xoay người, tạo dáng.',
         '2. Hệ thống gửi **ảnh kết quả thử đồ** (không phải ảnh gốc) sang dịch vụ tạo video.',
         '3. Bộ điều phối GPU đặt mức ưu tiên cao nhất cho tạo video: dừng thử đồ, nhả bộ nhớ, nạp mô '
         'hình video.',
         '4. Dịch vụ sinh 49 khung ở độ phân giải 384×640 và kiểm tra hành động.',
         '5. Cổng chất lượng chuyển động chấm kết quả trước khi trả về.'],
        ['5a. Khách rời màn hình giữa chừng: gửi lệnh huỷ, công việc dừng và GPU được nhả ngay.'],
        ['E1. Máy chủ không có CUDA: hệ thống báo lỗi rõ ràng. **Không có đường lùi trên CPU.**',
         'E2. Bộ nhớ GPU không đủ: bộ điều phối xếp hàng thay vì nạp song song.'],
        '`POST /api/tryon/motion` · `POST/GET/DELETE /api/tryon/motion/jobs` · '
        '`backend/motion_service.py` · `backend/one_to_all_runner.py`',
        'Đọc: không. Ghi: tệp video tạm trên đĩa, không ghi vào cơ sở dữ liệu.')

    _uc(r, 'UC-11', 'Gợi ý trang phục theo địa điểm và ghép ảnh vào cảnh thật',
        'Khách hàng, Cụm dịch vụ AI cục bộ',
        'Địa danh có trong bảng 25 địa điểm và có metadata cảnh hợp lệ.',
        'Khách nhận danh sách trang phục phù hợp, và (nếu đã thử đồ) một ảnh ghép vào cảnh thật của '
        'địa danh kèm ghi nguồn.',
        ['1. Khách chọn một địa danh.',
         '2. Hệ thống chấm điểm catalog thật theo sáu tiêu chí: phong cách và văn hoá (25 điểm), mùa và '
         'thời tiết (20), màu so với tông cảnh (20), loại đồ hợp hoạt động (15), có size vừa người dùng '
         '(15), chất lượng dữ liệu sản phẩm (5).',
         '3. Hệ thống loại trang phục vi phạm quy tắc văn hoá của địa điểm.',
         '4. Khách chọn một sản phẩm và thử đồ ngay tại chỗ.',
         '5. Khách bấm ghép ảnh; **client chỉ gửi tên địa danh**, không gửi đường dẫn ảnh.',
         '6. Máy chủ tra metadata cảnh: điểm đặt chân, vùng đứng được, tỉ lệ người, hướng sáng.',
         '7. Hệ thống tách người bằng phân đoạn ảnh và ghép vào cảnh, cắt khung bám theo điểm đặt chân.',
         '8. Hệ thống trả ảnh kèm phần ghi nguồn ảnh nền.'],
        ['3a. Địa điểm thuộc nhóm trang nghiêm: đồ bơi bị loại tuyệt đối.',
         '3b. Địa điểm biển: đồ bơi chỉ xuất hiện khi lượt đó đã qua cổng độ tuổi.',
         '7a. Bước ghép cảnh lỗi: **ảnh thử đồ vẫn được giữ lại** để khách thử lại riêng bước ghép.'],
        ['E1. Client gửi đường dẫn ảnh nền: hệ thống bỏ qua. Chấp nhận đường dẫn từ client ở đây sẽ mở '
         'một lỗ hổng SSRF.',
         'E2. Không còn sản phẩm nào hợp lệ: trả danh sách rỗng kèm lý do, không hạ tiêu chuẩn lọc.'],
        '`GET /api/japan-spots/recommendations` · `POST /api/japan-spots/scene-photo` · '
        '`backend/lib/japanSpotRecommendations.js` · `backend/lib/japanScenes.js` · '
        '`backend/scene_compose.py`',
        'Đọc: `products`, `product_variants`, `japan_spots`, `profiles`. Ghi: không.')

    _uc(r, 'UC-12', 'Quản lý sản phẩm và biến thể', 'Quản trị viên',
        'Người dùng có vai trò `admin` trở lên.',
        'Sản phẩm và biến thể được cập nhật; **không bản ghi nào bị xoá vĩnh viễn**.',
        ['1. Quản trị viên mở danh sách sản phẩm trong trang quản trị.',
         '2. Tạo mới hoặc sửa thông tin sản phẩm, thêm biến thể theo màu và size.',
         '3. Cập nhật tồn kho cho từng biến thể.',
         '4. Gắn ảnh và video; hệ thống chỉ lưu URL và metadata, tệp nằm ở dịch vụ media.',
         '5. Khi cần gỡ sản phẩm khỏi cửa hàng, quản trị viên chuyển trạng thái sang `hidden`.'],
        ['5a. Sản phẩm ẩn có thể được hiện lại bất cứ lúc nào; giao diện nói rõ điều này.'],
        ['E1. Gọi điểm cuối xoá cũ: hệ thống thực hiện ẩn mềm thay vì xoá, để đơn hàng, thống kê và '
         'danh sách yêu thích cũ không mất tham chiếu.'],
        '`POST/PUT /api/products` · `DELETE /api/products/:id` (đã chuyển thành ẩn mềm) · '
        '`backend/routes/catalog.js` · `backend/lib/productLifecycle.js`',
        'Đọc/Ghi: `products`, `product_variants`, `product_media`, `categories`.')

    _uc(r, 'UC-13', 'Kiểm duyệt nội dung và ghi đè quyết định của máy',
        'Nhân viên, Quản trị viên',
        'Có ít nhất một nội dung ở trạng thái chờ duyệt.',
        'Nội dung được chuyển sang đã duyệt hoặc bị từ chối; nếu bị từ chối, cụm từ vi phạm được lưu '
        'làm mẫu cho các lần lọc sau.',
        ['1. Người vận hành mở hàng chờ kiểm duyệt.',
         '2. Xem nội dung kèm điểm và lý do mà máy đưa ra.',
         '3. Quyết định duyệt hoặc từ chối.',
         '4. Khi từ chối, hệ thống lưu dạng đã chuẩn hoá của nội dung làm cụm khoá cho bộ lọc cục bộ.'],
        ['3a. Người vận hành có thể ghi đè quyết định của máy theo cả hai chiều.'],
        ['E1. Nội dung đã bị xoá: hệ thống báo và làm mới hàng chờ.'],
        '`GET/PATCH /api/reviews/moderation` · `backend/routes/reviews.js` · '
        '`backend/lib/reviewModeration.js`',
        'Đọc/Ghi: `reviews`, `moderation_samples`, `japan_spot_suggestions`.')

    _uc(r, 'UC-14', 'Xem dashboard, dự báo và phân khúc khách hàng',
        'Nhân viên, Quản trị viên',
        'Có dữ liệu đơn hàng hợp lệ trong hệ thống.',
        'Người vận hành thấy các chỉ số hiện tại, dự báo ba tháng tới, phân khúc khách hàng, nguy cơ '
        'rời bỏ và các luật mua kèm.',
        ['1. Người vận hành mở trang tổng quan.',
         '2. Hệ thống tổng hợp doanh thu theo ngày, tuần, tháng, năm từ các đơn hợp lệ.',
         '3. Hệ thống chạy ba mô hình dự báo và trộn theo nghịch đảo sai số của từng mô hình.',
         '4. Hệ thống tính điểm nhu cầu, đà 30 ngày và rủi ro tồn kho cho từng sản phẩm.',
         '5. Hệ thống phân cụm khách hàng bằng K-Means (k ≤ 3) trên dữ liệu đã chuẩn hoá.',
         '6. Hệ thống chấm nguy cơ rời bỏ theo mô hình RFM minh bạch.',
         '7. Hệ thống rút các luật mua kèm có support, confidence và lift.'],
        ['3a. Chuỗi dữ liệu quá ngắn: các mô hình vẫn chạy nhưng khoảng dự báo rộng ra và cỡ mẫu được '
         'ghi rõ trên giao diện.'],
        ['E1. Chưa có đơn hàng hợp lệ nào: hệ thống hiển thị trạng thái trống thay vì vẽ biểu đồ từ dữ '
         'liệu rỗng.'],
        '`GET /api/analytics` · `backend/lib/analytics.js` · `admin/js/dashboard.js`',
        'Đọc: `orders`, `order_items`, `products`, `product_variants`, `users`, `interactions`, '
        '`search_logs`. Ghi: không.')

    r.h2('3.5. Yêu cầu phi chức năng rút ra từ phân tích')
    r.p('Quá trình đặc tả use case ở trên làm lộ ra bốn yêu cầu phi chức năng mà một danh sách tính '
        'năng đơn thuần sẽ bỏ sót. Chúng được ghi lại ở đây vì chúng chi phối thiết kế ở Chương 4 và '
        'Chương 6.')
    r.table(
        'Bốn yêu cầu phi chức năng rút ra từ phân tích use case.',
        ['Yêu cầu', 'Bắt nguồn từ use case', 'Hệ quả thiết kế'],
        [
            ['Hệ thống phải có khả năng **từ chối một cách rõ ràng**.',
             'UC-08, UC-09, UC-11',
             'Mọi luồng AI đều có trạng thái thất bại mang lý do, thay vì trả về một kết quả trông có vẻ hợp lệ.'],
            ['Công việc dài phải **huỷ được**.', 'UC-09, UC-10',
             'Hàng đợi công việc bất đồng bộ với lệnh DELETE thật sự dừng được yêu cầu đang chạy.'],
            ['Dữ liệu lịch sử không được thay đổi theo hiện tại.', 'UC-05, UC-06, UC-12',
             'Dòng hàng lưu ảnh chụp giá; sản phẩm chỉ được ẩn chứ không xoá.'],
            ['Ảnh cá nhân không được lưu trữ lâu dài.', 'UC-08, UC-09',
             'Cache kết quả chỉ áp dụng cho ảnh mẫu do JAPANO dựng; ảnh đầu vào của khách bị xoá khi '
             'công việc kết thúc.'],
        ],
        widths=[Cm(4.6), Cm(3.2), Cm(7.7)], font=10.5)
