# 06 — Đường dữ liệu end-to-end

# FLOW-01 — Đăng ký, đăng nhập và hồ sơ

## Trigger

Người dùng tạo tài khoản hoặc đăng nhập rồi cập nhật hồ sơ/địa chỉ.

## Actor

Khách hàng

## Data path

`Người Dùng → Hồ Sơ Người Dùng → Địa Chỉ`

## Chi tiết

### Step 1 — Đăng ký/đăng nhập

- **TABLE/READ-WRITE:** `users`.
- **Hành vi:** CREATE/READ user; mật khẩu băm bcrypt, phiên JWT.
- **FK sử dụng:** users.id.

### Step 2 — Cập nhật hồ sơ

- **TABLE/READ-WRITE:** `profiles`.
- **Hành vi:** UPSERT số đo, phong cách, ngân sách.
- **FK sử dụng:** profiles.userId → users.id.

### Step 3 — Lưu địa chỉ

- **TABLE/READ-WRITE:** `addresses`.
- **Hành vi:** CREATE/UPDATE sổ địa chỉ.
- **FK sử dụng:** addresses.userId → users.id.

## Kết quả cuối

CREATE/UPDATE sổ địa chỉ.

## Tables liên quan

`Người Dùng → Hồ Sơ Người Dùng → Địa Chỉ`.

---

# FLOW-02 — Khám phá sản phẩm tới giỏ hàng

## Trigger

Người dùng tìm sản phẩm, chọn màu/cỡ và thêm vào giỏ.

## Actor

Khách hàng

## Data path

`Danh Mục → Sản Phẩm → Biến Thể → Chi Tiết Giỏ Hàng`

## Chi tiết

### Step 1 — Duyệt/tìm

- **TABLE/READ-WRITE:** `categories, products, product_details`.
- **Hành vi:** READ catalog và mô tả.
- **FK sử dụng:** products.categoryId → categories.id.

### Step 2 — Chọn biến thể

- **TABLE/READ-WRITE:** `product_variants`.
- **Hành vi:** READ stock theo màu/cỡ/SKU.
- **FK sử dụng:** product_variants.productId → products.id.

### Step 3 — Thêm giỏ

- **TABLE/READ-WRITE:** `cart_items`.
- **Hành vi:** UPSERT quantity theo đúng lựa chọn.
- **FK sử dụng:** userId → users.id; productId → products.id.

## Kết quả cuối

UPSERT quantity theo đúng lựa chọn.

## Tables liên quan

`Danh Mục → Sản Phẩm → Biến Thể → Chi Tiết Giỏ Hàng`.

---

# FLOW-03 — Checkout, đơn hàng và thanh toán

## Trigger

Người dùng xác nhận giỏ và chọn COD/Stripe/VNPay.

## Actor

Khách hàng + cổng thanh toán

## Data path

`Giỏ → Biến Thể → Đơn Hàng → Chi Tiết Đơn Hàng → Thanh Toán`

## Chi tiết

### Step 1 — Kiểm tra đầu vào

- **TABLE/READ-WRITE:** `cart_items, products, product_variants`.
- **Hành vi:** READ; server tính lại giá và kiểm tra stock.
- **FK sử dụng:** productId và tổ hợp màu/cỡ.

### Step 2 — Tạo chứng từ

- **TABLE/READ-WRITE:** `orders`.
- **Hành vi:** CREATE order, customer/address/discount snapshot; dùng clientRequestId.
- **FK sử dụng:** orders.userId → users.id.

### Step 3 — Tạo dòng hàng

- **TABLE/READ-WRITE:** `order_items`.
- **Hành vi:** CREATE qty/price/name/color/size snapshot.
- **FK sử dụng:** orderId → orders.id; productId → products.id.

### Step 4 — Thanh toán

- **TABLE/READ-WRITE:** `payments`.
- **Hành vi:** CREATE/UPDATE payment attempt, webhook/reconcile/refund.
- **FK sử dụng:** orderId → orders.id; userId → users.id.

## Kết quả cuối

CREATE/UPDATE payment attempt, webhook/reconcile/refund.

## Tables liên quan

`Giỏ → Biến Thể → Đơn Hàng → Chi Tiết Đơn Hàng → Thanh Toán`.

---

# FLOW-04 — Đổi trả và hoàn tiền theo sản phẩm

## Trigger

Đơn đã giao, khách chọn các dòng cần trả và gửi bằng chứng.

## Actor

Khách hàng + quản trị viên

## Data path

`Đơn Hàng → Chi Tiết Đơn Hàng → Yêu Cầu Trả Hàng → Thanh Toán`

## Chi tiết

### Step 1 — Xác minh điều kiện

- **TABLE/READ-WRITE:** `orders, order_items`.
- **Hành vi:** READ trạng thái, thời hạn, item còn được trả.
- **FK sử dụng:** order_items.orderId → orders.id.

### Step 2 — Tạo yêu cầu

- **TABLE/READ-WRITE:** `return_requests`.
- **Hành vi:** CREATE request, item list, ảnh và timeline.
- **FK sử dụng:** orderId/userId/paymentId.

### Step 3 — Duyệt và nhận hàng

- **TABLE/READ-WRITE:** `return_requests`.
- **Hành vi:** UPDATE trạng thái; chốt stockRestoredAt.
- **FK sử dụng:** Giữ cùng request id.

### Step 4 — Hoàn tiền

- **TABLE/READ-WRITE:** `payments`.
- **Hành vi:** UPDATE refunds/refundedAmount theo item đã duyệt.
- **FK sử dụng:** return_requests.paymentId → payments.id.

## Kết quả cuối

UPDATE refunds/refundedAmount theo item đã duyệt.

## Tables liên quan

`Đơn Hàng → Chi Tiết Đơn Hàng → Yêu Cầu Trả Hàng → Thanh Toán`.

---

# FLOW-05 — Đánh giá verified purchase

## Trigger

Người mua đã hoàn tất đơn muốn đánh giá sản phẩm.

## Actor

Khách hàng + quản trị viên

## Data path

`Đơn Hàng → Đánh Giá Sản Phẩm → Mẫu Kiểm Duyệt → Tương Tác Đánh Giá`

## Chi tiết

### Step 1 — Kiểm tra mua hàng

- **TABLE/READ-WRITE:** `orders, order_items`.
- **Hành vi:** READ đơn hoàn tất có chứa product.
- **FK sử dụng:** orderId/userId/productId.

### Step 2 — Tạo review

- **TABLE/READ-WRITE:** `reviews`.
- **Hành vi:** CREATE rating/content/status.
- **FK sử dụng:** productId/userId/orderId.

### Step 3 — Kiểm duyệt

- **TABLE/READ-WRITE:** `moderation_samples`.
- **Hành vi:** CREATE/UPDATE mẫu gắn review nguồn.
- **FK sử dụng:** reviewId → reviews.id.

### Step 4 — Phản ứng

- **TABLE/READ-WRITE:** `review_reactions`.
- **Hành vi:** UPSERT helpful/not_helpful.
- **FK sử dụng:** reviewId/userId.

## Kết quả cuối

UPSERT helpful/not_helpful.

## Tables liên quan

`Đơn Hàng → Đánh Giá Sản Phẩm → Mẫu Kiểm Duyệt → Tương Tác Đánh Giá`.

---

# FLOW-06 — Thử đồ AI và tạo lịch sử

## Trigger

Người dùng chọn ảnh người và sản phẩm để thử đồ/tạo video.

## Actor

Khách hàng + GPU services

## Data path

`Sản Phẩm → Lịch Sử Thử Đồ → Media kết quả`

## Chi tiết

### Step 1 — Chọn nguồn

- **TABLE/READ-WRITE:** `products, product_media`.
- **Hành vi:** READ ảnh sản phẩm và metadata.
- **FK sử dụng:** media.productId → products.id.

### Step 2 — Suy luận

- **TABLE/READ-WRITE:** `FASHN/FLUX/One-to-All (service)`.
- **Hành vi:** Không ghi model vào ERD; service xử lý ngoài DB.
- **FK sử dụng:** Không có FK.

### Step 3 — Lưu lịch sử

- **TABLE/READ-WRITE:** `tryon_history`.
- **Hành vi:** CREATE user/product/result URL/engine/time.
- **FK sử dụng:** userId → users.id; productId → products.id.

## Kết quả cuối

CREATE user/product/result URL/engine/time.

## Tables liên quan

`Sản Phẩm → Lịch Sử Thử Đồ → Media kết quả`.

---

# FLOW-07 — Voucher, VIP và Flagcard

## Trigger

Đơn hoàn tất hoặc admin cấp ưu đãi.

## Actor

Hệ thống + quản trị viên

## Data path

`Đơn Hàng → Thành Viên VIP/Flagcard → Phiếu Giảm Giá → Lượt Sử Dụng Phiếu`

## Chi tiết

### Step 1 — Tính quyền lợi

- **TABLE/READ-WRITE:** `orders, vip_memberships, discount_rules`.
- **Hành vi:** READ doanh số; CREATE/UPDATE kỳ VIP.
- **FK sử dụng:** membership.userId/ruleId.

### Step 2 — Trao thẻ

- **TABLE/READ-WRITE:** `flagcards, flagcard_collections`.
- **Hành vi:** UPDATE cardIds/awards chống lặp trong app.
- **FK sử dụng:** collection.userId; cardIds[].

### Step 3 — Áp voucher

- **TABLE/READ-WRITE:** `vouchers, voucher_redemptions`.
- **Hành vi:** READ rule; CREATE redemption gắn order.
- **FK sử dụng:** voucherId/userId/orderId.

## Kết quả cuối

READ rule; CREATE redemption gắn order.

## Tables liên quan

`Đơn Hàng → Thành Viên VIP/Flagcard → Phiếu Giảm Giá → Lượt Sử Dụng Phiếu`.

---

# FLOW-08 — Hành vi và gợi ý cá nhân hóa

## Trigger

Người dùng xem, tìm, yêu thích, chat hoặc đặt mục tiêu.

## Actor

Khách hàng

## Data path

`Người Dùng → Search/Interaction/Chat/Goal → Sản Phẩm → Gợi ý`

## Chi tiết

### Step 1 — Ghi hành vi

- **TABLE/READ-WRITE:** `search_logs, interactions, chats`.
- **Hành vi:** APPEND query/event/message.
- **FK sử dụng:** userId và productId nullable theo context.

### Step 2 — Ghi mục tiêu

- **TABLE/READ-WRITE:** `goals`.
- **Hành vi:** CREATE/UPDATE số tiền mục tiêu và deposits.
- **FK sử dụng:** userId/productId.

### Step 3 — Tạo gợi ý

- **TABLE/READ-WRITE:** `products + signals`.
- **Hành vi:** READ dữ liệu thật; fallback nếu vector service tắt.
- **FK sử dụng:** Không tạo thêm FK.

## Kết quả cuối

READ dữ liệu thật; fallback nếu vector service tắt.

## Tables liên quan

`Người Dùng → Search/Interaction/Chat/Goal → Sản Phẩm → Gợi ý`.

---

# Xếp hạng flow để thuyết trình

| Rank | Flow | Giá trị khi thuyết trình | Độ khó | Nên nói? |
|---:|---|---|---|---|
| 1 | FLOW-03 — Checkout, đơn hàng và thanh toán | Flow mạnh nhất để bảo vệ snapshot, giá server, tồn kho và idempotency. | Khó | Bắt buộc |
| 2 | FLOW-04 — Đổi trả và hoàn tiền theo sản phẩm | Thể hiện state machine hậu mãi, item-level refund và audit. | Khó | Có |
| 3 | FLOW-02 — Khám phá sản phẩm tới giỏ hàng | Nối catalog với tồn kho và mapping giỏ có thuộc tính. | Dễ | Có |
| 4 | FLOW-06 — Thử đồ AI và tạo lịch sử | Nối tính năng nổi bật của đồ án với dữ liệu thật mà không biến model thành bảng. | Trung bình | Có |
| 5 | FLOW-05 — Đánh giá verified purchase | Giải thích ba FK của review và điểm yếu unique còn thiếu. | Trung bình | Có |
| 6 | FLOW-01 — Đăng ký, đăng nhập và hồ sơ | Giải thích identity, dữ liệu riêng tư và quan hệ 1:0..1/1:N. | Dễ | Có |
| 7 | FLOW-07 — Voucher, VIP và Flagcard | Thể hiện rule, assignment, redemption và reward history. | Khó | Nếu còn thời gian |
| 8 | FLOW-08 — Hành vi và gợi ý cá nhân hóa | Giải thích event data và retention, nhưng ít giá trị giao dịch hơn checkout. | Trung bình | Nếu được hỏi |
