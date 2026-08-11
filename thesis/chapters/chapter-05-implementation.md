# CHƯƠNG 5: THỰC HIỆN

## 5.1. Cấu trúc mã nguồn

Mã nguồn được tổ chức theo mô hình monorepo với ba thư mục gốc độc lập — `admin/`, `backend/`, `mobile/` — dùng chung một tệp khoá phụ thuộc (`package-lock.json`) ở thư mục gốc thông qua cơ chế npm workspaces. Bảng 5.1 liệt kê các thư mục/tệp quan trọng nhất, đủ để tra cứu trong các mục tiếp theo của chương này.

**Bảng 5.1: Cấu trúc mã nguồn chính**

```text
japano/
├── admin/                       # Trang quản trị Web (không build step)
│   ├── index.html
│   ├── styles.css
│   └── js/{core,dashboard,actions,views-commerce,views-content}.js
├── backend/
│   ├── server.js                # Điểm khởi động Express, chuỗi middleware, DI ctx
│   ├── routes/                  # 17 tệp route theo domain nghiệp vụ
│   ├── lib/                     # 36 tệp — thương mại, xác thực, AI, phân tích, thanh toán
│   ├── test/                    # 5 tệp kiểm thử tự động (node:test)
│   ├── data/db.json             # Nguồn dữ liệu chính (JSON)
│   ├── fashn_service.py         # Dịch vụ thử đồ AI (FASHN + FLUX.2)
│   ├── motion_service.py        # Dịch vụ tạo video chuyển động
│   ├── embedding_service.py     # Dịch vụ embedding ngữ nghĩa
│   └── catvton_service.py       # Dịch vụ thử đồ dự phòng
├── mobile/
│   ├── app/                     # 33 tệp màn hình (Expo Router)
│   ├── lib/                     # 16 tệp — API client, context, dữ liệu tĩnh
│   ├── components/              # 9 tệp thành phần dùng chung
│   └── theme/tokens.ts          # Token màu sắc, font chữ
├── scripts/verify.mjs           # Smoke test API
├── japano_schema_v2.sql         # Thiết kế CSDL quan hệ chuẩn hoá (chưa kết nối runtime)
├── .env.example
├── package.json
└── start-all.sh                 # Script khởi động toàn bộ hệ thống
```

*Nguồn: xác minh trực tiếp cấu trúc thư mục; đối chiếu `README.md`'s "Cấu trúc thư mục" (đã kiểm chứng khớp thật), `thesis/evidence/architecture.md`, `thesis/evidence/api-inventory.md`.*

Không giống mô tả trong một bản báo cáo nháp trước đó (vốn ghi backend là một tệp duy nhất `server/index.mjs`), điểm khởi động backend thật là `backend/server.js`, nạp và gắn 17 tệp route qua một đối tượng tiêm phụ thuộc (`ctx`) dùng chung — chi tiết cơ chế này đã trình bày tại Chương 3, mục 3.1.

## 5.2. Chức năng người dùng đã triển khai

### 5.2.1. Đăng ký, đăng nhập và quản lý phiên

Người dùng đăng ký bằng họ tên, email, số điện thoại và mật khẩu (`mobile/app/register.tsx` → `POST /api/auth/register`). Backend băm mật khẩu bằng bcrypt (hệ số 10, `backend/lib/auth.js:20-22`) trước khi lưu; đồng thời kiểm tra độ mạnh mật khẩu qua hàm dùng chung `passwordStrength()`, từ chối các mật khẩu thuộc danh sách phổ biến bị chặn (ví dụ `12345678`, `password`). Sau khi đăng nhập, phiên làm việc được duy trì bằng JWT lưu trong `expo-secure-store` (hạn dùng mặc định 30 ngày), tự động đính kèm vào mọi yêu cầu API tiếp theo qua header `Authorization: Bearer`.

Cơ chế quên mật khẩu (`mobile/app/forgot-password.tsx`) sinh mã 6 chữ số ngẫu nhiên, chỉ lưu bản băm SHA-256 của mã (không lưu mã gốc), hạn dùng 30 phút, gửi qua `backend/lib/mailer.js` — hộp thư thật nếu có cấu hình SMTP, hoặc hộp thư giả lập (Ethereal) trong môi trường phát triển hiện tại.

### 5.2.2. Danh mục, tìm kiếm và chi tiết sản phẩm

Danh mục sản phẩm được tải qua `GET /api/products`. Tìm kiếm tại tab "Sản phẩm" (`mobile/app/(tabs)/products.tsx`) dùng thuật toán so khớp mờ dựa trên khoảng cách Levenshtein **tự triển khai ngay trong tệp màn hình**, không gọi dịch vụ tìm kiếm ngoài — cho phép khớp kết quả dù người dùng gõ sai chính tả nhẹ. Mỗi lượt tìm kiếm, kể cả không ra kết quả, được ghi log qua `POST /api/search-log` để phục vụ báo cáo "tín hiệu tìm kiếm" phía quản trị.

Màn hình chi tiết sản phẩm (`mobile/app/product/[slug].tsx`) hiển thị thư viện ảnh/video có phóng to bằng cử chỉ (tự triển khai bằng `PanResponder`, không dùng thư viện zoom ngoài), mô tả sản phẩm do AI tạo (`GET /api/products/:slug/ai-description`, dùng mô hình thị giác `qwen3-vl:8b` qua Ollama, có phương án dự phòng dạng mẫu câu khi dịch vụ AI không khả dụng), dải sản phẩm gợi ý phối đồ (`GET /api/outfits/:slug`) và sản phẩm liên quan (`GET /api/products/:slug/related`), cùng phần đánh giá đã xác thực mua hàng.

### 5.2.3. Giỏ hàng, yêu thích và đặt hàng

Giỏ hàng và danh sách yêu thích được đồng bộ hai chiều với server (`POST /api/carts/sync`, `POST /api/wishlist/sync`), lưu đệm cục bộ theo từng tài khoản để phản hồi tức thời trên giao diện trong lúc chờ đồng bộ nền. Luồng đặt hàng (`mobile/app/checkout.tsx`) gồm bốn bước: nhập/chọn địa chỉ (có gợi ý tỉnh/thành, phường/xã bằng tìm kiếm gần đúng), chọn phương thức thanh toán, xác nhận, và trang kết quả. **Tổng tiền luôn được tính lại phía server** từ dữ liệu sản phẩm thật tại thời điểm đặt hàng (`backend/routes/orders.js:103-216`), không tin tưởng số tiền do client gửi lên.

### 5.2.4. Thanh toán đa phương thức

Ba phương thức thanh toán được triển khai đầy đủ, đều ở chế độ thử nghiệm/sandbox:

- **COD** — tạo đơn trực tiếp (`POST /api/orders`), trạng thái ban đầu `pending`.
- **Stripe Test Mode** — nhập thẻ trực tiếp trong ứng dụng qua thành phần `CardForm` của `@stripe/stripe-react-native`; hỗ trợ lưu thẻ để thanh toán nhanh lần sau (`GET/DELETE /api/stripe/cards`, dựa trên đối tượng Stripe Customer gắn với tài khoản); backend chỉ hoạt động khi khoá API bắt đầu bằng `sk_test_`/`pk_test_` (`backend/lib/stripeClient.js:14`), khoá thật (`sk_live_`) sẽ khiến mọi endpoint Stripe trả lỗi `503`.
- **VNPay Sandbox** — mở trang thanh toán trong một `WebView` nhúng ngay trong ứng dụng, không rời khỏi JAPANO; xác nhận kết quả trả về được kiểm tra chữ ký HMAC-SHA512 bằng phép so sánh an toàn theo thời gian (`crypto.timingSafeEqual`).

### 5.2.5. Hậu mãi: huỷ đơn và trả hàng

Đây là một trong những luồng nghiệp vụ phức tạp nhất đã triển khai, mô phỏng theo mô hình huỷ/trả hàng có phê duyệt của các nền tảng thương mại điện tử phổ biến:

- **Huỷ đơn** chỉ khả dụng khi đơn chưa bàn giao vận chuyển (`pending`/`pending_payment`/`confirmed`), bắt buộc nhập lý do, luôn qua bước quản trị viên phê duyệt — không huỷ ngay lập tức.
- **Trả hàng** chỉ khả dụng sau khi đơn đã giao thành công, trong vòng 30 ngày, bắt buộc đính kèm tối thiểu một ảnh chụp thực tế sản phẩm (tối đa 6 ảnh, tải lên Cloudinary).
- Khi quản trị viên phê duyệt yêu cầu huỷ đơn **đã thanh toán trực tuyến**, hệ thống tự động gọi hoàn tiền qua đúng cổng thanh toán đã dùng, trong cùng một thao tác phê duyệt — không cần thao tác hoàn tiền riêng. Đơn thanh toán COD không có bước hoàn tiền tự động vì chưa từng thu tiền trước khi giao hàng.
- Mọi thay đổi trạng thái đều tạo thông báo trong ứng dụng và thông báo đẩy, đính kèm liên kết điều hướng thẳng tới đúng màn hình chi tiết đơn hàng khi người dùng chạm vào thông báo.

### 5.2.6. Trợ lý AI và các tính năng thời trang thông minh

- **Trò chuyện (chat)**: có cả màn hình chat toàn phần (`mobile/app/chat.tsx`) và bong bóng chat nổi toàn ứng dụng (`mobile/lib/botchat.tsx`). Câu trả lời được xây dựng theo nguyên tắc "catalog-grounded" — hệ thống truy hồi sản phẩm/giá/voucher/đơn hàng thật từ trạng thái hệ thống trước khi tạo câu trả lời, hạn chế việc mô hình ngôn ngữ "tự bịa" thông tin sản phẩm không có thật.
- **Thử đồ AI** (`mobile/app/tryon.tsx`): người dùng chọn ảnh và sản phẩm, hệ thống chạy pipeline nhiều bước — phân tích tư thế người trong ảnh, chọn ảnh trang phục phẳng phù hợp, sinh ảnh bằng FASHN VTON (kết hợp FLUX.2 nếu ảnh cần chỉnh tư thế), qua bước kiểm tra chất lượng trước khi trả kết quả. Nếu không mô hình nào tạo được ảnh đạt chất lượng, hệ thống trả lỗi thông báo rõ ràng thay vì trả về ảnh ghép giả — nguyên tắc này được thực thi cứng trong mã nguồn: chế độ ghép ảnh sản phẩm chồng lên ảnh người dùng (fallback đơn giản) đã bị vô hiệu hoá có chủ đích.
- **Tư vấn size và gợi ý phối đồ**: dựa trên hệ chuyên gia theo ngưỡng số đo/chiều cao-cân nặng, kết hợp thuật toán phối màu (hài hoà HSL) và độ tương đồng thẻ (tag) sản phẩm.
- **Kế hoạch mục tiêu mua sắm** (`mobile/app/goals.tsx`): tính toán kế hoạch tiết kiệm để mua một sản phẩm cụ thể, có thể kèm gợi ý sức khoẻ (BMI), tuỳ chọn nhờ mô hình ngôn ngữ diễn đạt lại lời khuyên tự nhiên hơn — công thức ngân sách và các quy tắc an toàn luôn chạy cục bộ, không phụ thuộc mô hình AI.

## 5.3. Chức năng quản trị viên đã triển khai

Trang quản trị (`admin/`) là một ứng dụng JavaScript thuần không qua bước biên dịch, được phục vụ trực tiếp bởi backend dưới đường dẫn `/admin`. Bảng 5.2 tổng hợp các nhóm chức năng chính.

**Bảng 5.2: Chức năng quản trị đã triển khai**

| Nhóm chức năng | Nội dung | Vai trò tối thiểu |
|---|---|---|
| Dashboard | KPI trực tiếp, đồng bộ đơn hàng/thanh toán/trả hàng theo thời gian thực | `staff` (chỉ thấy phần liên quan) |
| Quản lý sản phẩm | Thêm/sửa/ẩn/xoá, yêu cầu tối thiểu 2 ảnh khi xuất bản | `staff` (chỉ sản phẩm của mình), `admin` (toàn bộ) |
| Quản lý đơn hàng | Xem, cập nhật trạng thái | `admin` |
| Trả hàng & hoàn tiền | Phê duyệt/từ chối/xác nhận nhận hàng/hoàn tiền | `admin` |
| Voucher đền bù cá nhân | Cấp voucher riêng cho một khách hàng, mức giảm và lý do do quản trị viên tự chọn | `admin` |
| Thông báo | Soạn thông báo broadcast hoặc gửi riêng một khách hàng | `admin` |
| Kiểm duyệt nội dung | Duyệt/chặn đánh giá sản phẩm, nội dung cộng đồng khám phá Nhật Bản | `admin` |
| Phân quyền người dùng | Đổi vai trò tài khoản khác | `super_admin` |

*Nguồn: `thesis/evidence/feature-inventory.md` mục 6; `thesis/evidence/api-inventory.md`.*

Điểm đáng chú ý nhất về mặt kỹ thuật của khối quản trị là cơ chế phân quyền theo phạm vi dữ liệu (data-scoped authorization) áp dụng cho vai trò `staff`: khi gọi `GET /api/staff/products`, backend chỉ trả về các sản phẩm có trường `ownerId` trùng khớp với tài khoản đang đăng nhập; khi chỉnh sửa sản phẩm qua `PUT /api/products/:id`, backend kiểm tra lại quyền sở hữu ngay trong handler trước khi cho phép ghi, không chỉ dựa vào việc middleware `requireStaff` đã cho qua ở tầng ngoài. Đây là ví dụ cụ thể cho việc phân quyền không dừng lại ở "có được vào route hay không" mà còn kiểm soát "được thao tác trên phần dữ liệu nào" — một yêu cầu thiết kế phân quyền chặt chẽ hơn mức tối thiểu.

## 5.4. API và xử lý dữ liệu

Hệ thống backend cung cấp **111 endpoint HTTP** phân bố trên 17 tệp route, được thống kê đầy đủ tại Phụ lục A. Bảng 5.3 trình bày một số endpoint tiêu biểu theo nhóm nghiệp vụ — danh sách đầy đủ đặt ở phụ lục để không làm loãng nội dung chính của chương.

Con số 111 gồm 103 endpoint khai báo trực tiếp trong `backend/routes/`, 7 endpoint sinh qua hai vòng lặp `forEach` trong `routes/health.js`, và 1 webhook Stripe gắn trực tiếp trên đối tượng `app` (`backend/server.js:216`) — webhook phải nằm ngoài router chính để giữ được raw body phục vụ xác thực chữ ký.

**Bảng 5.3: Một số API tiêu biểu theo nhóm nghiệp vụ**

| Nhóm | Endpoint tiêu biểu | Ghi chú |
|---|---|---|
| Xác thực | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password` | Middleware `requireAuth`/`optionalAuth` áp dụng theo endpoint |
| Sản phẩm | `GET /api/products`, `PUT /api/products/:id`, `GET /api/staff/products` | Phân quyền theo `ownerId` với vai trò `staff` |
| Giỏ hàng/Đơn hàng | `POST /api/carts/sync`, `POST /api/orders`, `GET /api/orders/:id` | Giá luôn tính lại phía server |
| Thanh toán | `POST /api/stripe/payment-intent`, `POST /api/vnpay/payment-url`, `POST /api/payments/:id/refund` | Ba luồng tạo đơn dùng chung một hàm `makeCreateOrderInState` |
| AI | `POST /api/stylist/chat`, `POST /api/tryon`, `POST /api/stylist/size` | Có phương án dự phòng khi dịch vụ AI ngoại vi không khả dụng |
| Quản trị | `GET /api/admin/live`, `POST /api/returns/:id/action`, `PATCH /api/admin/users/:id` | Phân theo ba mức middleware: `requireStaff`/`requireAdmin`/`requireSuperAdmin` |

*Nguồn: Phụ lục A (bảng đầy đủ 111 endpoint, kèm middleware bảo vệ và số dòng mã nguồn).*

Cần ghi nhận trung thực một điểm yếu ở đây: trong 111 endpoint có **45 endpoint chưa gắn middleware xác thực**, phần lớn thuộc nhóm AI (`stylist.js`, `tryon.js`) và dữ liệu hành vi người dùng (`customerData.js`). Trường hợp nghiêm trọng nhất là `POST /api/flagcards/admin/grant` (`backend/routes/loyalty.js:26`) — đường dẫn có chữ "admin" nhưng không hề kiểm tra quyền. Danh sách đầy đủ và phân loại mức nghiêm trọng ở Phụ lục A mục A.5; lộ trình khắc phục ở Chương 8 mục 8.3.1.

Về mặt xử lý dữ liệu, điểm thiết kế xuyên suốt là **tái sử dụng logic tạo đơn hàng cho cả ba phương thức thanh toán**: `backend/routes/paymentsStripe.js` và `backend/routes/paymentsVnpay.js` đều gọi lại hàm `makeCreateOrderInState` được định nghĩa trong `backend/routes/orders.js`, thay vì mỗi phương thức thanh toán tự cài đặt lại logic tính giá/giảm giá/VIP. Nhờ đó, một thay đổi trong quy tắc tính giá chỉ cần sửa ở một nơi duy nhất, giảm rủi ro ba luồng thanh toán tính tiền không nhất quán với nhau.

## 5.5. Tài khoản quản trị và bảo vệ phân quyền

Tài khoản `super_admin` gốc của hệ thống được tạo hoặc thăng hạng tự động khi backend khởi động, dựa trên hai biến môi trường `JAPANO_ADMIN_EMAIL` và `JAPANO_ADMIN_PASSWORD` (hàm `ensureAdminSeeded()`, `backend/lib/auth.js:119-139`) — **không có tài khoản/mật khẩu nào được ghi cứng trong mã nguồn**. Nếu tài khoản với email đó đã tồn tại từ trước, cơ chế này chỉ nâng vai trò lên `super_admin` mà **không ghi đè mật khẩu đã có**, tránh vô tình đặt lại mật khẩu mà quản trị viên đã tự đổi.

Hệ thống có bốn cấp vai trò, xếp hạng tăng dần: `customer < staff < admin < super_admin` (`backend/lib/auth.js:88-91`). Các ràng buộc bảo vệ được thực thi ở tầng server, không chỉ ở giao diện:

- Vai trò không xác định hoặc rỗng mặc định bị từ chối ở mọi kiểm tra quyền (`roleAtLeast()` trả về hạng `-1` cho vai trò không nằm trong danh sách đã biết).
- Chỉ `super_admin` mới được đổi vai trò của tài khoản khác (`PATCH /api/admin/users/:id`).
- Một tài khoản `super_admin` **không thể tự hạ quyền chính mình** — được kiểm tra tường minh trong handler (`backend/routes/admin.js:23-25`), ngăn tình huống vô tình khoá quyền quản trị cao nhất của chính người đang thao tác.

*Nguồn: `thesis/evidence/security-analysis.md` mục 1.*

Đây là điểm cần được trình bày như một minh chứng kỹ thuật thật của dự án, khác với một bản báo cáo nháp trước đó từng ghi nhận hai tài khoản quản trị mặc định với mật khẩu là chuỗi số `"1"` — thông tin này không có căn cứ trong mã nguồn hiện tại; mật khẩu như vậy sẽ bị chính cơ chế kiểm tra độ mạnh mật khẩu của hệ thống từ chối nếu được dùng để đăng ký hoặc đặt lại mật khẩu qua các endpoint công khai.
