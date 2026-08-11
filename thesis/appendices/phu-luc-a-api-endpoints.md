# PHỤ LỤC A — DANH MỤC ĐẦY ĐỦ API ENDPOINT

## A.1. Phương pháp lập bảng

Bảng dưới đây được dựng bằng cách quét trực tiếp toàn bộ lời gọi `api.get/post/put/patch/delete(...)` trong 17 tệp thuộc `backend/routes/`, cộng với route gắn thẳng trên đối tượng `app` trong `backend/server.js`. Không có endpoint nào được suy đoán từ tên tệp hay tên hàm; mỗi dòng đều kèm số dòng mã nguồn để hội đồng đối chiếu lại.

- Điểm vào: `backend/server.js`; cổng mặc định `PORT = Number(process.env.PORT || 4100)` (`server.js:48`).
- Toàn bộ router nghiệp vụ gắn tại `app.use('/api', generalApiLimiter, api)` (`server.js:282`), nên mọi đường dẫn khai báo trong tệp route đều có tiền tố `/api`.
- Riêng webhook Stripe gắn thẳng lên `app` **trước** `express.json` để giữ raw body phục vụ xác thực chữ ký: `app.post('/api/stripe/webhook', express.raw(...))` (`server.js:216`).
- Nhóm `/api/auth/*` được bọc thêm bởi `authLimiter` (giới hạn tần suất chống dò mật khẩu).

**Tổng số endpoint đếm được thật: 111** — gồm 103 endpoint khai báo trực tiếp trong `backend/routes/`, 7 endpoint sinh qua hai vòng `forEach` trong `routes/health.js`, và 1 webhook Stripe gắn trực tiếp trên `app`.

> **Chênh lệch so với tài liệu trước.** Đề cương (`thesis/outline.md`) và `thesis/evidence/api-inventory.md` ghi **109**. Con số đúng tại thời điểm lập phụ lục này là **111**. Chênh lệch **+2** nằm trọn ở `backend/routes/stylist.js`: `POST /api/gpu/focus` (dòng 27) và `GET /api/gpu/focus` (dòng 36) — hai endpoint thuộc cơ chế điều phối ưu tiên GPU, được bổ sung vào mã nguồn sau khi bộ bằng chứng được lập. Các tệp chương và đề cương đã được cập nhật theo con số 111.

## A.2. Quy ước cột "Middleware bảo vệ"

| Ký hiệu | Ý nghĩa |
|---|---|
| `requireAuth` | Bắt buộc JWT hợp lệ |
| `requireStaff` | Vai trò từ `staff` trở lên |
| `requireAdmin` | Vai trò từ `admin` trở lên |
| `requireSuperAdmin` | Chỉ `super_admin` |
| `optionalAuth` | Giải mã JWT nếu có, không bắt buộc; việc phân quyền nằm trong thân hàm xử lý |
| *(công khai)* | Không có middleware — endpoint đọc dữ liệu công khai theo đúng thiết kế |
| **(không có)** | Không có middleware nào, nhưng endpoint có thao tác ghi hoặc đọc dữ liệu cá nhân — **xem cảnh báo ở mục A.4** |

Toàn bộ middleware định nghĩa trong `backend/lib/auth.js`, truyền vào từng module route qua đối tượng `ctx` (`server.js:157-178`).

## A.3. Bảng endpoint theo từng tệp route

### A.3.1. `routes/addresses.js` — 5 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 1 | GET | `/api/addresses` | requireAuth | Địa chỉ đã lưu của người gọi, địa chỉ mặc định xếp trước (L32) |
| 2 | POST | `/api/addresses` | requireAuth | Tạo địa chỉ; tự đặt mặc định nếu là địa chỉ đầu tiên (L39) |
| 3 | PUT | `/api/addresses/:id` | requireAuth | Cập nhật địa chỉ thuộc sở hữu người gọi (L60) |
| 4 | POST | `/api/addresses/:id/default` | requireAuth | Đặt mặc định, bỏ mặc định các địa chỉ còn lại (L80) |
| 5 | DELETE | `/api/addresses/:id` | requireAuth | Xoá; nếu cần thì nâng địa chỉ khác lên mặc định (L96) |

### A.3.2. `routes/admin.js` — 3 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 6 | PATCH | `/api/admin/users/:id` | requireSuperAdmin | Sửa vai trò/tên/email/trạng thái; **chặn tự hạ quyền** khỏi `super_admin` (L13) |
| 7 | POST | `/api/admin/customers/:userId/voucher` | requireAdmin | Cấp voucher đền bù cá nhân, admin chọn giá trị và lý do (L53) |
| 8 | POST | `/api/admin/notifications` | requireAdmin | Gửi thông báo quảng bá hoặc tới người dùng cụ thể (L105) |

### A.3.3. `routes/auth.js` — 5 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 9 | POST | `/api/auth/register` | *(công khai)* | Kiểm tra dữ liệu và độ mạnh mật khẩu, băm bcrypt, tạo tài khoản `customer`, trả JWT (L31) |
| 10 | POST | `/api/auth/login` | *(công khai)* | Đối chiếu bcrypt, kiểm tra khoá tài khoản, trả lỗi chung khi thất bại để không tiết lộ email tồn tại (L61) |
| 11 | GET | `/api/auth/me` | requireAuth | Hồ sơ công khai của chính người gọi (L75) |
| 12 | POST | `/api/auth/forgot-password` | *(công khai)* | Mã 6 chữ số băm SHA-256, hạn 30 phút, gửi qua `lib/mailer.js` (L84) |
| 13 | POST | `/api/auth/reset-password` | *(công khai)* | Xác minh mã và hạn dùng, đặt mật khẩu bcrypt mới (L112) |

### A.3.4. `routes/catalog.js` — 9 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 14 | GET | `/api/products` | *(công khai)* | Sản phẩm đã xuất bản, bổ sung điểm đánh giá và số đã bán theo thời gian thực (L67) |
| 15 | GET | `/api/products/:slug/videos/:index` | *(công khai)* | Phát video base64 có hỗ trợ HTTP range (L73) |
| 16 | GET | `/api/staff/products` | requireStaff | Nhân viên chỉ thấy sản phẩm mình sở hữu (`ownerId`); admin trở lên thấy tất cả (L104) |
| 17 | PUT | `/api/products/:id` | requireStaff | Tạo/cập nhật; nhân viên không sửa được sản phẩm người khác; cần ≥2 ảnh mới cho xuất bản (L112) |
| 18 | DELETE | `/api/products/:id` | requireAdmin | Xoá theo `id` hoặc `slug` (L153) |
| 19 | GET | `/api/locations/provinces` | *(công khai)* | Tìm gần đúng trên bộ dữ liệu 34 tỉnh/thành (L175) |
| 20 | GET | `/api/locations/wards` | *(công khai)* | Tìm gần đúng phường/xã trong một tỉnh (L183) |
| 21 | GET | `/api/products/:slug/related` | *(công khai)* | Slug sản phẩm liên quan, lấy từ `lib/recommend.js` (L195) |
| 22 | GET | `/api/products/:slug/ai-description` | *(công khai)* | Mô tả sinh bởi mô hình thị giác, có cache (L201) |

### A.3.5. `routes/customerData.js` — 5 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 23 | POST | `/api/interactions` | **(không có)** | Ghi sự kiện hành vi làm đầu vào cho bộ gợi ý (L7) |
| 24 | POST | `/api/search-log` | **(không có)** | Ghi nhật ký truy vấn tìm kiếm và số kết quả, giới hạn 5000 bản ghi (L49) |
| 25 | POST | `/api/carts/sync` | **(không có)** | Thay thế giỏ hàng, có kiểm tra lại theo catalog (L70) |
| 26 | GET | `/api/wishlist` | **(không có)** | Danh sách slug yêu thích (L99) |
| 27 | POST | `/api/wishlist/sync` | **(không có)** | Thay thế danh sách yêu thích (L108) |

### A.3.6. `routes/health.js` — 19 endpoint (12 khai báo trực tiếp + 7 sinh qua `forEach`)

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 28 | GET | `/api/health` | *(công khai)* | Ảnh chụp tình trạng hệ thống, gồm `database:{type:'json',...}` (L12) |
| 29 | GET | `/api/state` | requireAdmin | Xuất toàn bộ state thô (L33) |
| 30 | GET | `/api/admin/live` | requireAdmin | Lát cắt dữ liệu nhẹ cho dashboard polling (L34) |
| 31 | PUT | `/api/state` | requireAdmin | Ghi đè state hàng loạt qua `replaceFromAdmin` (L50) |
| 32 | PUT | `/api/shop` | requireAdmin | Cập nhật cấu hình cửa hàng, tải logo lên Cloudinary (L69) |
| 33 | POST | `/api/seed` | requireAdmin | Nạp lại bộ dữ liệu demo (L100) |
| 34 | POST | `/api/reset` | requireAdmin | Xoá sạch về state rỗng (L101) |
| 35 | GET | `/api/shop/logo` | *(công khai)* | Trả byte ảnh logo cửa hàng (L103) |
| 36 | GET | `/api/categories` | *(công khai)* | Sinh bởi vòng lặp `publicCollections` (L115-116) |
| 37 | GET | `/api/banners` | *(công khai)* | Sinh bởi vòng lặp `publicCollections` (L115-116) |
| 38 | GET | `/api/vouchers` | *(công khai)* | Sinh bởi vòng lặp `publicCollections` (L115-116) |
| 39 | GET | `/api/flagcards` | *(công khai)* | Sinh bởi vòng lặp `publicCollections` (L115-116) |
| 40 | GET | `/api/payments` | requireAdmin | Sinh bởi vòng lặp `adminOnlyCollections` (L118-119) |
| 41 | GET | `/api/returnRequests` | requireAdmin | Sinh bởi vòng lặp `adminOnlyCollections` (L118-119) |
| 42 | GET | `/api/users` | requireAdmin | Sinh bởi vòng lặp `adminOnlyCollections` (L118-119) |
| 43 | GET | `/api/orders` | optionalAuth | Admin trở lên xem tất cả; khách xem đơn của mình; ẩn danh trả 401 (L121) |
| 44 | GET | `/api/notifications` | optionalAuth | Thông báo chung cộng thông báo riêng của chính người gọi (L128) |
| 45 | GET | `/api/shop` | *(công khai)* | Thông tin cửa hàng công khai (L133) |
| 46 | GET | `/api/analytics` | *(công khai)* | Toàn bộ dữ liệu phân tích, tham số `?scope=live\|all` (L136) |

### A.3.7. `routes/japanSpots.js` — 8 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 47 | GET | `/api/japan-spots/reviews` | **(không có)** | Đánh giá theo địa điểm và tỉnh, đọc Mongo hoặc dự phòng JSON (L34) |
| 48 | POST | `/api/japan-spots/reviews` | **(không có)** | Gửi đánh giá, qua kiểm duyệt AI, kèm media tuỳ chọn (L54) |
| 49 | GET | `/api/japan-spots/suggestions` | **(không có)** | Gợi ý địa điểm cho một tỉnh (L94) |
| 50 | POST | `/api/japan-spots/suggestions` | **(không có)** | Gửi gợi ý địa điểm, có kiểm duyệt (L111) |
| 51 | GET | `/api/japan-spots/admin` | **(không có)** | Danh sách quản trị, mọi trạng thái — **tên có "admin" nhưng không kiểm quyền** (L165) |
| 52 | DELETE | `/api/japan-spots/reviews/:id` | requireAdmin | Xoá một đánh giá (L180) |
| 53 | DELETE | `/api/japan-spots/suggestions/:id` | requireAdmin | Xoá một gợi ý (L184) |
| 54 | POST | `/api/moderation/test` | **(không có)** | Thử nghiệm mô hình kiểm duyệt, không ghi dữ liệu (L190) |

### A.3.8. `routes/loyalty.js` — 6 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 55 | GET | `/api/flagcards/collection/:userId` | **(không có)** | Tiến độ Flagcard và voucher thưởng của người dùng (L10) |
| 56 | GET | `/api/flagcards-program` | **(không có)** | Cấu hình chương trình và danh mục thẻ (L13) |
| 57 | POST | `/api/flagcards/reconcile` | **(không có)** | Tính lại toàn bộ phần thưởng trên mọi đơn hàng (L18) |
| 58 | POST | `/api/flagcards/admin/grant` | **(không có)** | Cấp thẻ thủ công — **thiếu `requireAdmin`, lỗ hổng nghiêm trọng nhất** (L26) |
| 59 | GET | `/api/vip/status/:userId` | **(không có)** | Trạng thái VIP tính từ lịch sử đơn hàng trong tháng (L52) |
| 60 | POST | `/api/vouchers/validate` | **(không có)** | Kiểm tra voucher, trả về mức giảm giá đã tính (L58) |

### A.3.9. `routes/orders.js` — 2 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 61 | POST | `/api/orders` | requireAuth | Tạo đơn: **server tính lại giá theo catalog thật**, trừ tồn kho, trao Flagcard, đẩy push (L225) |
| 62 | GET | `/api/orders/:id` | *(công khai)* | Lấy đơn kèm bản ghi thanh toán và yêu cầu đổi trả (L243) |

Tệp này còn xuất `makeCreateOrderInState`, `normalizedOrderItems`, `paymentProviderOf`, `isOnlinePayment`, `decrementStock` để `paymentsStripe.js` và `paymentsVnpay.js` dùng lại **đúng một logic tạo đơn duy nhất** — chi tiết ở Chương 5, mục 5.4.

### A.3.10. `routes/payments.js` — 2 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 63 | GET | `/api/payments/:id` | **(không có)** | Tra cứu giao dịch; tự sửa trạng thái Stripe treo bằng cách hỏi lại cổng (L12) |
| 64 | POST | `/api/payments/:id/refund` | requireAdmin | Gửi lệnh hoàn tiền tới đúng cổng thanh toán (L32) |

### A.3.11. `routes/paymentsStripe.js` — 11 endpoint (+1 webhook khai báo trong `server.js`)

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 65 | GET | `/api/stripe/cards` | requireAuth | Liệt kê thẻ đã lưu qua Stripe Customer (L336) |
| 66 | DELETE | `/api/stripe/cards/:id` | requireAuth | Gỡ thẻ đã lưu sau khi kiểm tra quyền sở hữu (L352) |
| 67 | GET | `/api/stripe/config` | *(công khai)* | Trả publishable key và đơn vị tiền cho SDK di động (L366) |
| 68 | GET | `/api/stripe/checkout/open/:sessionId` | *(công khai)* | Phân giải URL Checkout Session đang mở, chuyển hướng 303 (L382) |
| 69 | POST | `/api/stripe/payment-intent` | requireAuth | Tạo/tái dùng/sửa PaymentIntent; tạo Stripe Customer khi cần (L397) |
| 70 | POST | `/api/stripe/payment-intent/confirm` | **(không có)** | Chốt đơn sau khi client xác nhận PaymentIntent (L506) |
| 71 | POST | `/api/stripe/checkout-session` | requireAuth | Tạo hoặc tái dùng Checkout Session (L520) |
| 72 | POST | `/api/stripe/checkout/confirm` | **(không có)** | Chốt đơn từ Checkout Session đã hoàn tất (L636) |
| 73 | GET | `/api/stripe/checkout/success` | *(công khai)* | Trang đích thanh toán thành công, deep-link về ứng dụng (L645) |
| 74 | GET | `/api/stripe/checkout/cancel` | *(công khai)* | Trang đích khi người dùng huỷ thanh toán (L662) |
| 75 | POST | `/api/stripe/reconcile` | **(không có)** | Đối soát hàng loạt tối đa 30 giao dịch treo hoặc chờ hoàn tiền (L687) |
| 76 | POST | `/api/stripe/webhook` | Xác thực chữ ký Stripe | Gắn trực tiếp trên `app` với raw body (`server.js:216`); điều phối tới `finalizeStripeCheckout` / `finalizeStripePaymentIntent` / `markStripe*Failed` / `applyStripeRefundToState` |

### A.3.12. `routes/paymentsVnpay.js` — 5 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 77 | GET | `/api/vnpay/config` | *(công khai)* | Cờ bật/tắt VNPay và dấu hiệu return-URL (L203) |
| 78 | POST | `/api/vnpay/payment-url` | requireAuth | Tạo/tái dùng đơn, sinh URL thanh toán Sandbox ký HMAC-SHA512 (L218) |
| 79 | POST | `/api/vnpay/return` | **(không có)** | Nhận callback do WebView bắt được — **có xác minh chữ ký trong thân hàm** (L288) |
| 80 | GET | `/api/vnpay/ipn` | *(công khai)* | Endpoint IPN server-to-server, hợp đồng JSON `RspCode`; xác minh chữ ký trong thân hàm (L303) |
| 81 | POST | `/api/vnpay/reconcile` | **(không có)** | Đối soát hàng loạt qua `querydr` của VNPay cho giao dịch treo (L318) |

### A.3.13. `routes/push.js` — 2 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 82 | POST | `/api/push/register` | requireAuth | Lưu hoặc làm mới Expo push token (L5) |
| 83 | POST | `/api/push/unregister` | requireAuth | Gỡ push token (L17) |

### A.3.14. `routes/returns.js` — 4 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 84 | POST | `/api/orders/:id/cancel-request` | requireAuth | Yêu cầu huỷ đơn chưa giao, bắt buộc nêu lý do (L86) |
| 85 | POST | `/api/orders/:id/returns` | requireAuth | Yêu cầu đổi trả đơn đã hoàn tất, trong 30 ngày, cần lý do và **≥1 ảnh minh chứng** (L139) |
| 86 | POST | `/api/returns/:id/action` | requireAdmin | `approve` / `reject` / `receive` / `cancel` / `refund`; tự hoàn tiền khi huỷ đơn đã thanh toán online (L204) |
| 87 | PATCH | `/api/orders/:id` | requireAdmin | Cập nhật trạng thái trực tiếp; tự đánh dấu COD đã thu khi hoàn tất (L349) |

### A.3.15. `routes/reviews.js` — 5 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 88 | GET | `/api/products/:slug/reviews` | *(công khai)* | Đánh giá đã duyệt, phân bố sao, điều kiện được viết đánh giá (L34) |
| 89 | POST | `/api/products/:slug/reviews` | **(không có)** | Gửi đánh giá; chỉ cho người đã mua, mỗi người một đánh giá mỗi sản phẩm (L53) |
| 90 | POST | `/api/reviews/:id/reaction` | **(không có)** | Bật/tắt phản hồi hữu ích hoặc không hữu ích (L96) |
| 91 | GET | `/api/reviews/admin` | **(không có)** | Danh sách quản trị, mọi trạng thái — **tên có "admin" nhưng không kiểm quyền** (L120) |
| 92 | PATCH | `/api/reviews/:id/moderation` | **(không có)** | Ghi đè kiểm duyệt; nội dung bị từ chối lưu làm mẫu cụm từ xấu (L130) |

### A.3.16. `routes/stylist.js` — 15 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 93 | POST | `/api/gpu/focus` | **(không có)** | Ứng dụng báo màn hình đang mở để backend ưu tiên GPU cho tính năng đó (L27) |
| 94 | GET | `/api/gpu/focus` | **(không có)** | Đọc ưu tiên GPU hiện hành (L36) |
| 95 | GET | `/api/ai/health` | *(công khai)* | Tình trạng sống của mọi micro-service AI cục bộ kèm chẩn đoán (L38) |
| 96 | GET | `/api/recommendations/home` | *(công khai)* | Gợi ý trang chủ, tham số `?userId=` / `?style=` (L113) |
| 97 | GET | `/api/recommendations/:userId` | **(không có)** | Cùng bộ máy gợi ý, `userId` truyền qua path param (L122) |
| 98 | POST | `/api/stylist/profile` | **(không có)** | Lưu hồ sơ phong cách/vóc dáng, body dạng bọc (L148) |
| 99 | POST | `/api/stylist/profile/:userId` | **(không có)** | Cùng chức năng, biến thể body phẳng (L154) |
| 100 | GET | `/api/stylist/profile/:userId` | **(không có)** | Đọc hồ sơ phong cách đã lưu (L157) |
| 101 | GET | `/api/goals/:userId` | **(không có)** | Danh sách kế hoạch mục tiêu đã lưu (L164) |
| 102 | POST | `/api/goals/plan` | **(không có)** | Lập kế hoạch tiết kiệm và sức khoẻ/BMI, tuỳ chọn coaching bằng Ollama (L170) |
| 103 | GET | `/api/outfits/today` | *(công khai)* | Bộ trang phục xoay vòng theo ngày quanh một sản phẩm trending (L219) |
| 104 | GET | `/api/outfits/:slug` | **(không có)** | Bộ phối đồ lấy một sản phẩm làm trung tâm (L224) |
| 105 | POST | `/api/stylist/size` | **(không có)** | Tư vấn size bằng hệ chuyên gia (L231) |
| 106 | POST | `/api/stylist/recommend` | **(không có)** | Phân tích màu sắc/tâm trạng/phong cách từ ảnh selfie (L240) |
| 107 | POST | `/api/stylist/chat` | **(không có)** | Chatbot tư vấn: định tuyến ý định, trả lời bám theo catalog (L277) |

### A.3.17. `routes/tryon.js` — 4 endpoint

| STT | Method | Đường dẫn | Middleware | Mô tả ngắn |
|---|---|---|---|---|
| 108 | POST | `/api/tryon` | **(không có)** | Pipeline thử đồ: chuẩn hoá dáng → FASHN → cổng kiểm chất lượng → dự phòng CatVTON → tinh chỉnh phụ kiện (L255) |
| 109 | GET | `/api/tryon/motion/presets` | **(không có)** | 5 preset chuyển động và tình trạng kết nối service (L539) |
| 110 | POST | `/api/tryon/motion` | **(không có)** | Gửi ảnh thử đồ sang service chuyển động, lưu tệp MP4 (L544) |
| 111 | GET | `/api/tryon/motion/video/:id` | **(không có)** | Trả tệp MP4 đã sinh theo `id` (L611) |

## A.4. Tổng hợp số lượng

| Tệp route | Số endpoint | Số endpoint không có middleware |
|---|---|---|
| `addresses.js` | 5 | 0 |
| `admin.js` | 3 | 0 |
| `auth.js` | 5 | 0 (4 endpoint công khai theo thiết kế) |
| `catalog.js` | 9 | 0 |
| `customerData.js` | 5 | **5** |
| `health.js` | 19 | 0 |
| `japanSpots.js` | 8 | **6** |
| `loyalty.js` | 6 | **6** |
| `orders.js` | 2 | 0 |
| `payments.js` | 2 | **1** |
| `paymentsStripe.js` | 11 (+1 webhook) | **3** |
| `paymentsVnpay.js` | 5 | **2** |
| `push.js` | 2 | 0 |
| `returns.js` | 4 | 0 |
| `reviews.js` | 5 | **4** |
| `stylist.js` | 15 | **14** |
| `tryon.js` | 4 | **4** |
| `server.js` (webhook Stripe) | 1 | 0 (xác thực bằng chữ ký) |
| **Tổng** | **111** | **45** |

## A.5. Cảnh báo phân quyền — phải nêu trong báo cáo

Trong 111 endpoint, có **45 endpoint không áp dụng middleware xác thực** và tin vào `userId` do client gửi lên. Cần phân biệt hai nhóm:

**Nhóm chấp nhận được:** phần lớn endpoint trong `stylist.js` và `tryon.js` là tính năng AI không ghi dữ liệu nhạy cảm (tư vấn size, phối đồ, thử đồ). Rủi ro chủ yếu là lạm dụng tài nguyên GPU, không phải rò rỉ dữ liệu. Tuy vậy vẫn nên thêm `requireAuth` và giới hạn tần suất.

**Nhóm cần sửa ngay:**

| Endpoint | Vấn đề |
|---|---|
| `POST /api/flagcards/admin/grant` (`loyalty.js:26`) | **Nghiêm trọng nhất.** Đường dẫn có chữ "admin" nhưng hoàn toàn không có `requireAdmin` — bất kỳ ai cũng có thể tự cấp thẻ thưởng cho mình |
| `GET /api/reviews/admin` (`reviews.js:120`) | Lộ toàn bộ đánh giá mọi trạng thái, kể cả nội dung bị từ chối kiểm duyệt |
| `GET /api/japan-spots/admin` (`japanSpots.js:165`) | Tương tự, lộ dữ liệu chờ kiểm duyệt |
| `PATCH /api/reviews/:id/moderation` (`reviews.js:130`) | Cho phép ghi đè quyết định kiểm duyệt mà không cần quyền admin |
| `POST /api/carts/sync`, `POST /api/wishlist/sync` (`customerData.js`) | Ghi đè giỏ hàng/wishlist của bất kỳ `userId` nào được truyền vào |
| `GET /api/payments/:id` (`payments.js:12`) | Đọc bản ghi giao dịch mà không kiểm tra quyền sở hữu |
| `POST /api/stripe/reconcile`, `POST /api/vnpay/reconcile` | Kích hoạt đối soát hàng loạt với cổng thanh toán mà không cần quyền |

Đây là hạn chế thật của hệ thống, đã ghi nhận trong `thesis/evidence/security-analysis.md` mục 2 và Phụ lục C mục C.4. Chương 8, mục 8.3.1 đặt việc hoàn thiện các middleware này ở mức **ưu tiên cao nhất**. Việc công bố đầy đủ danh sách này là có chủ đích: báo cáo mô tả đúng hệ thống thật, không trình bày một hệ thống hoàn hảo không tồn tại.
