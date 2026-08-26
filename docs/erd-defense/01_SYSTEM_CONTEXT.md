# 01 — System context

## Tổng quan hệ thống

### Cách kỹ thuật

[THỰC TẾ] JAPANO là modular monolith: mobile React Native/Expo và Web Admin gọi REST API Node.js/Express; runtime thao tác trên state trong bộ nhớ, MongoDB lưu 35 collection vật lý đã tách, Cloudinary giữ media và các dịch vụ AI cục bộ xử lý suy luận. ERD logic mô tả 36 thực thể và 50 quan hệ tham chiếu do tầng ứng dụng kiểm tra.

### Cách nói trước hội đồng

> JAPANO giải quyết trọn luồng mua thời trang Nhật Bản: khách khám phá, chọn biến thể, thử đồ, đặt hàng và xử lý hậu mãi; nhân viên vận hành trên Web Admin. ERD của nhóm không chỉ lưu sản phẩm và đơn hàng mà còn giữ được giá lịch sử, nguồn thanh toán, quyền lợi loyalty và dữ liệu AI gắn đúng người dùng/sản phẩm.

## Actor

| Actor | Vai trò/chức năng chính | Dữ liệu tác động |
|---|---|---|
| Khách chưa đăng nhập | Duyệt/tìm sản phẩm, đăng ký/đăng nhập | categories, products, search_logs |
| Khách hàng | Mua sắm, thanh toán, review, thử đồ, hậu mãi, loyalty | users và các collection có userId |
| Staff | Đọc dữ liệu vận hành theo ngưỡng role | orders, users, catalog |
| Admin | Quản lý sản phẩm, đơn, voucher, nội dung, moderation | catalog, transaction, content |
| Super admin | Quản trị quyền cao nhất | users.role/status và audit liên quan |
| Stripe/VNPay | Xác nhận và đối soát thanh toán | payments, orders |
| GPU/AI services | Thử đồ, video, embedding, chat tùy cấu hình | tryon_history, ai_descriptions, chats/interactions |

## Các module nghiệp vụ

- **ERD-01 — Danh mục, sản phẩm và biến thể**: Giải thích catalog, master data và đơn vị tồn kho theo màu–kích cỡ.
- **ERD-02 — Media và nội dung sản phẩm tạo bởi AI**: Tách metadata ảnh/video, nội dung AI và content quảng bá khỏi lõi sản phẩm.
- **ERD-03 — Người dùng và ý định mua sắm**: Trình bày danh tính, hồ sơ, địa chỉ và dữ liệu người dùng tạo trước khi checkout.
- **ERD-04 — Đơn hàng, thanh toán và trả hàng**: Thể hiện chuỗi chứng từ tiền–hàng từ checkout tới hậu mãi.
- **ERD-05 — Khuyến mãi, VIP và Flagcard**: Giải thích nguồn giảm giá, lượt dùng và phần thưởng trung thành.
- **ERD-06 — Đánh giá và kiểm duyệt**: Trình bày verified purchase, phản ứng cộng đồng và dấu vết kiểm duyệt.
- **ERD-07 — Hành vi, AI và vận hành nội dung**: Giải thích dữ liệu sự kiện phục vụ gợi ý, chat, thử đồ và cấu hình vận hành.

## Các luồng nghiệp vụ chính

- **FLOW-01**: Khách hàng → Người dùng tạo tài khoản hoặc đăng nhập rồi cập nhật hồ sơ/địa chỉ. → `Người Dùng → Hồ Sơ Người Dùng → Địa Chỉ` → CREATE/UPDATE sổ địa chỉ.
- **FLOW-02**: Khách hàng → Người dùng tìm sản phẩm, chọn màu/cỡ và thêm vào giỏ. → `Danh Mục → Sản Phẩm → Biến Thể → Chi Tiết Giỏ Hàng` → UPSERT quantity theo đúng lựa chọn.
- **FLOW-03**: Khách hàng + cổng thanh toán → Người dùng xác nhận giỏ và chọn COD/Stripe/VNPay. → `Giỏ → Biến Thể → Đơn Hàng → Chi Tiết Đơn Hàng → Thanh Toán` → CREATE/UPDATE payment attempt, webhook/reconcile/refund.
- **FLOW-04**: Khách hàng + quản trị viên → Đơn đã giao, khách chọn các dòng cần trả và gửi bằng chứng. → `Đơn Hàng → Chi Tiết Đơn Hàng → Yêu Cầu Trả Hàng → Thanh Toán` → UPDATE refunds/refundedAmount theo item đã duyệt.
- **FLOW-05**: Khách hàng + quản trị viên → Người mua đã hoàn tất đơn muốn đánh giá sản phẩm. → `Đơn Hàng → Đánh Giá Sản Phẩm → Mẫu Kiểm Duyệt → Tương Tác Đánh Giá` → UPSERT helpful/not_helpful.
- **FLOW-06**: Khách hàng + GPU services → Người dùng chọn ảnh người và sản phẩm để thử đồ/tạo video. → `Sản Phẩm → Lịch Sử Thử Đồ → Media kết quả` → CREATE user/product/result URL/engine/time.
- **FLOW-07**: Hệ thống + quản trị viên → Đơn hoàn tất hoặc admin cấp ưu đãi. → `Đơn Hàng → Thành Viên VIP/Flagcard → Phiếu Giảm Giá → Lượt Sử Dụng Phiếu` → READ rule; CREATE redemption gắn order.
- **FLOW-08**: Khách hàng → Người dùng xem, tìm, yêu thích, chat hoặc đặt mục tiêu. → `Người Dùng → Search/Interaction/Chat/Goal → Sản Phẩm → Gợi ý` → READ dữ liệu thật; fallback nếu vector service tắt.

## Mâu thuẫn báo cáo/source cần nhớ

- Báo cáo trình bày **36 bảng/50 quan hệ ở mức logic**; source chạy **35 collection vật lý**. Đây không phải cùng một con số.
- MongoDB không có FK server-side; các dây trên ERD là logical reference, kiểm tra bằng `relationshipErrors()`/`assertValid()`.
- Hệ thống không dùng Mongoose và không có migration ORM; Node MongoDB driver cùng serializer là nguồn implementation.
- Tính nguyên tử hiện tại đến từ một mutator đồng bộ trong một process, không phải MongoDB transaction.
