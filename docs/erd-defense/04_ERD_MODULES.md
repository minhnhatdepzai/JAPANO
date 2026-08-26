# 04 — Phân cụm ERD theo nghiệp vụ

> Một shared table được lặp ở nhiều ERD con để kể trọn luồng; việc lặp không tạo entity hoặc relationship mới.

# ERD-01 — Danh mục, sản phẩm và biến thể

## Mục đích

Giải thích catalog, master data và đơn vị tồn kho theo màu–kích cỡ.

## Bảng trung tâm

**Sản Phẩm** — Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.

## Tables

1. Danh Mục Sản Phẩm (`categories`)
2. Sản Phẩm (`products`)
3. Chi Tiết Sản Phẩm (`product_details`)
4. Biến Thể Sản Phẩm (`product_variants`)
5. Màu Sắc (logic/nhúng)
6. Kích Thước (logic/nhúng)

## Relationships

- **Sản Phẩm → Danh Mục Sản Phẩm** qua `products.categoryId` · category 1 → N products. Một danh mục gom nhiều sản phẩm.
- **Chi Tiết Sản Phẩm → Sản Phẩm** qua `product_details.productId` · product 1 → 0..1 detail. Một product có tối đa một khối chi tiết.
- **Biến Thể Sản Phẩm → Sản Phẩm** qua `product_variants.productId` · product 1 → N variants. Một product có nhiều tổ hợp màu–cỡ.
- **Biến Thể Sản Phẩm → Màu Sắc** qua `product_variants.colorName/colorHex` · color 1 → N variants (logic). Nhiều variant dùng cùng khái niệm màu.
- **Biến Thể Sản Phẩm → Kích Thước** qua `product_variants.size` · size 1 → N variants (logic). Nhiều variant dùng cùng kích cỡ.

## Business flow

Quản trị viên tạo danh mục → tạo sản phẩm → bổ sung chi tiết → tạo từng biến thể màu/cỡ → khách đọc catalog và tồn kho.

## Shared tables

Không có.

## Liên kết sang ERD khác

ERD-02, ERD-03, ERD-04, ERD-05, ERD-06, ERD-07.

## Vì sao nên tách thành ERD riêng

Đây là bounded context catalog và inventory; biến thể là nơi quy tắc tồn kho khác với mô tả sản phẩm.

---

# ERD-02 — Media và nội dung sản phẩm tạo bởi AI

## Mục đích

Tách metadata ảnh/video, nội dung AI và content quảng bá khỏi lõi sản phẩm.

## Bảng trung tâm

**Sản Phẩm** — Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.

## Tables

1. Sản Phẩm (`products`)
2. Hình Ảnh (logic/nhúng)
3. Hình Ảnh Giao Diện Sản Phẩm (`product_media`)
4. Mô Tả Sản Phẩm Tạo Bởi AI (`ai_descriptions`)
5. Quảng Cáo (`banners`)

## Relationships

- **Hình Ảnh → Sản Phẩm** qua `legacy image.productId` · product 1 → N images (logic). Ảnh cũ thuộc một product.
- **Mô Tả Sản Phẩm Tạo Bởi AI → Sản Phẩm** qua `ai_descriptions.productId` · product 1 → N generations. Một product có thể sinh mô tả nhiều lần.
- **Hình Ảnh Giao Diện Sản Phẩm → Sản Phẩm** qua `product_media.productId` · product 1 → N media. Một product có nhiều ảnh/video.

## Business flow

Admin tải media lên Cloudinary → MongoDB lưu URL/type/vị trí → sinh mô tả AI theo sản phẩm → duyệt nội dung để hiển thị.

## Shared tables

Sản Phẩm

## Liên kết sang ERD khác

ERD-01, ERD-03, ERD-04, ERD-05, ERD-06, ERD-07.

## Vì sao nên tách thành ERD riêng

Các artifact media/AI có vòng đời và cách kiểm duyệt khác dữ liệu giá, SKU và tồn kho.

---

# ERD-03 — Người dùng và ý định mua sắm

## Mục đích

Trình bày danh tính, hồ sơ, địa chỉ và dữ liệu người dùng tạo trước khi checkout.

## Bảng trung tâm

**Người Dùng** — Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

## Tables

1. Người Dùng (`users`)
2. Hồ Sơ Người Dùng (`profiles`)
3. Địa Chỉ (`addresses`)
4. Thông Báo (`notifications`)
5. Chi Tiết Giỏ Hàng (`cart_items`)
6. Danh Sách Sản Phẩm Yêu Thích (`wishlist_items`)
7. Mục Tiêu Tiết Kiệm (`goals`)
8. Sản Phẩm (`products`)

## Relationships

- **Địa Chỉ → Người Dùng** qua `addresses.userId` · user 1 → N addresses. Một user lưu nhiều địa chỉ.
- **Hồ Sơ Người Dùng → Người Dùng** qua `profiles.userId` · user 1 → 0..1 profile. Một user có tối đa một profile hiện tại.
- **Thông Báo → Người Dùng** qua `notifications.userId` · user 1 → N notifications. Một user nhận nhiều thông báo.
- **Chi Tiết Giỏ Hàng → Người Dùng** qua `cart_items.userId` · user 1 → N cart lines. Một user có nhiều dòng giỏ.
- **Chi Tiết Giỏ Hàng → Sản Phẩm** qua `cart_items.productId` · product 1 → N cart lines. Một product nằm trong nhiều giỏ.
- **Danh Sách Sản Phẩm Yêu Thích → Người Dùng** qua `wishlist_items.userId` · user 1 → N wishlist rows. Một user thích nhiều product.
- **Danh Sách Sản Phẩm Yêu Thích → Sản Phẩm** qua `wishlist_items.productId` · product 1 → N wishlist rows. Một product được nhiều user thích.
- **Mục Tiêu Tiết Kiệm → Người Dùng** qua `goals.userId` · user 1 → N goals. Một user có nhiều mục tiêu.
- **Mục Tiêu Tiết Kiệm → Sản Phẩm** qua `goals.productId` · product 1 → N goals. Một product là đích của nhiều goal.

## Business flow

Người dùng đăng nhập → hoàn thiện hồ sơ/địa chỉ → xem sản phẩm → lưu wishlist/giỏ/mục tiêu → nhận thông báo.

## Shared tables

Sản Phẩm

## Liên kết sang ERD khác

ERD-01, ERD-02, ERD-04, ERD-05, ERD-06, ERD-07.

## Vì sao nên tách thành ERD riêng

Các bản ghi cùng phụ thuộc user nhưng có vòng đời khác chứng từ đơn hàng.

---

# ERD-04 — Đơn hàng, thanh toán và trả hàng

## Mục đích

Thể hiện chuỗi chứng từ tiền–hàng từ checkout tới hậu mãi.

## Bảng trung tâm

**Đơn Hàng** — Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng.

## Tables

1. Người Dùng (`users`)
2. Sản Phẩm (`products`)
3. Đơn Hàng (`orders`)
4. Chi Tiết Đơn Hàng (`order_items`)
5. Thanh Toán (`payments`)
6. Yêu Cầu Trả Hàng (`return_requests`)
7. Phiếu Giảm Giá (`vouchers`)
8. Lượt Sử Dụng Phiếu (`voucher_redemptions`)

## Relationships

- **Chi Tiết Đơn Hàng → Đơn Hàng** qua `order_items.orderId` · order 1 → N items. Một đơn gồm nhiều dòng hàng.
- **Chi Tiết Đơn Hàng → Sản Phẩm** qua `order_items.productId` · product 1 → N sold lines. Một product xuất hiện ở nhiều đơn.
- **Đơn Hàng → Người Dùng** qua `orders.userId` · user 1 → N orders. Một user đặt nhiều đơn; guest là ngoại lệ logic.
- **Đơn Hàng → Phiếu Giảm Giá** qua `orders.voucherId` · voucher 1 → 0..N orders. Voucher có thể áp cho nhiều đơn; order có tối đa một voucher record.
- **Thanh Toán → Đơn Hàng** qua `payments.orderId` · order 1 → N payment attempts. Một đơn có thể retry thanh toán.
- **Thanh Toán → Người Dùng** qua `payments.userId` · user 1 → N payments. Một user phát sinh nhiều giao dịch.
- **Yêu Cầu Trả Hàng → Đơn Hàng** qua `return_requests.orderId` · order 1 → N requests. Một order có thể trả theo nhiều đợt/item.
- **Yêu Cầu Trả Hàng → Người Dùng** qua `return_requests.userId` · user 1 → N requests. User tạo nhiều yêu cầu hậu mãi.
- **Yêu Cầu Trả Hàng → Thanh Toán** qua `return_requests.paymentId` · payment 1 → 0..N requests. Refund online trỏ đúng payment; COD có thể rỗng.
- **Phiếu Giảm Giá → Người Dùng** qua `vouchers.issuedBy` · user 1 → N issued vouchers. Một staff/admin cấp nhiều voucher.
- **Phiếu Giảm Giá → Người Dùng** qua `vouchers.ownerUserId` · user 1 → 0..N assigned vouchers. Voucher có thể cấp riêng một user.
- **Lượt Sử Dụng Phiếu → Phiếu Giảm Giá** qua `voucher_redemptions.voucherId` · voucher 1 → N redemptions. Một voucher có nhiều lượt dùng.
- **Lượt Sử Dụng Phiếu → Người Dùng** qua `voucher_redemptions.userId` · user 1 → N redemptions. Một user có nhiều lượt dùng voucher.
- **Lượt Sử Dụng Phiếu → Đơn Hàng** qua `voucher_redemptions.orderId` · order 1 → 0..N redemptions. Lượt dùng phải đối soát về order.

## Business flow

Khách checkout → tạo đơn và dòng hàng snapshot → tạo payment attempt → đối soát → nếu cần tạo return request và hoàn tiền theo item.

## Shared tables

Người Dùng, Sản Phẩm, Phiếu Giảm Giá, Lượt Sử Dụng Phiếu

## Liên kết sang ERD khác

ERD-01, ERD-02, ERD-03, ERD-05, ERD-06, ERD-07.

## Vì sao nên tách thành ERD riêng

Đây là transaction core; cần nhìn liền mạch để giải thích giá lịch sử, idempotency và audit.

---

# ERD-05 — Khuyến mãi, VIP và Flagcard

## Mục đích

Giải thích nguồn giảm giá, lượt dùng và phần thưởng trung thành.

## Bảng trung tâm

**Người Dùng** — Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

## Tables

1. Người Dùng (`users`)
2. Đơn Hàng (`orders`)
3. Sản Phẩm (`products`)
4. Phiếu Giảm Giá (`vouchers`)
5. Lượt Sử Dụng Phiếu (`voucher_redemptions`)
6. Quy Tắc Giảm Giá (`discount_rules`)
7. Thành Viên VIP (`vip_memberships`)
8. Thẻ Địa Danh (`flagcards`)
9. Bộ Sưu Tầm Thẻ Của Người Dùng (`flagcard_collections`)

## Relationships

- **Đơn Hàng → Người Dùng** qua `orders.userId` · user 1 → N orders. Một user đặt nhiều đơn; guest là ngoại lệ logic.
- **Đơn Hàng → Phiếu Giảm Giá** qua `orders.voucherId` · voucher 1 → 0..N orders. Voucher có thể áp cho nhiều đơn; order có tối đa một voucher record.
- **Phiếu Giảm Giá → Người Dùng** qua `vouchers.issuedBy` · user 1 → N issued vouchers. Một staff/admin cấp nhiều voucher.
- **Phiếu Giảm Giá → Người Dùng** qua `vouchers.ownerUserId` · user 1 → 0..N assigned vouchers. Voucher có thể cấp riêng một user.
- **Lượt Sử Dụng Phiếu → Phiếu Giảm Giá** qua `voucher_redemptions.voucherId` · voucher 1 → N redemptions. Một voucher có nhiều lượt dùng.
- **Lượt Sử Dụng Phiếu → Người Dùng** qua `voucher_redemptions.userId` · user 1 → N redemptions. Một user có nhiều lượt dùng voucher.
- **Lượt Sử Dụng Phiếu → Đơn Hàng** qua `voucher_redemptions.orderId` · order 1 → 0..N redemptions. Lượt dùng phải đối soát về order.
- **Thành Viên VIP → Người Dùng** qua `vip_memberships.userId` · user 1 → N membership periods. User có nhiều kỳ VIP theo thời gian.
- **Thành Viên VIP → Quy Tắc Giảm Giá** qua `vip_memberships.discountRuleId` · rule 1 → N memberships. Nhiều membership dùng cùng rule.
- **Thẻ Địa Danh → Sản Phẩm** qua `flagcards.recommendedProductIds[]` · flagcard N ↔ N products (array). Một card gợi ý nhiều product và ngược lại.
- **Bộ Sưu Tầm Thẻ Của Người Dùng → Người Dùng** qua `flagcard_collections.userId` · user 1 → 0..N collections. Collection ghi tiến trình/award của user.
- **Bộ Sưu Tầm Thẻ Của Người Dùng → Thẻ Địa Danh** qua `flagcard_collections.cardIds[]` · collection N ↔ N flagcards (array). Một collection chứa nhiều card; card thuộc nhiều user.

## Business flow

Đơn hoàn tất → tính hạng VIP/trao Flagcard → sinh hoặc áp voucher → ghi redemption gắn user và order.

## Shared tables

Người Dùng, Đơn Hàng, Sản Phẩm

## Liên kết sang ERD khác

ERD-01, ERD-02, ERD-03, ERD-04, ERD-06, ERD-07.

## Vì sao nên tách thành ERD riêng

Các bảng này cùng trả lời giảm giá đến từ đâu, đã dùng ở đơn nào và phần thưởng thuộc user nào.

---

# ERD-06 — Đánh giá và kiểm duyệt

## Mục đích

Trình bày verified purchase, phản ứng cộng đồng và dấu vết kiểm duyệt.

## Bảng trung tâm

**Đánh Giá Sản Phẩm** — Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair.

## Tables

1. Người Dùng (`users`)
2. Sản Phẩm (`products`)
3. Đơn Hàng (`orders`)
4. Đánh Giá Sản Phẩm (`reviews`)
5. Tương Tác Đánh Giá (`review_reactions`)
6. Mẫu Kiểm Duyệt (`moderation_samples`)
7. Đánh Giá Địa Điểm Nhật Bản (`japan_spot_reviews`)

## Relationships

- **Đơn Hàng → Người Dùng** qua `orders.userId` · user 1 → N orders. Một user đặt nhiều đơn; guest là ngoại lệ logic.
- **Đánh Giá Sản Phẩm → Sản Phẩm** qua `reviews.productId` · product 1 → N reviews. Một product có nhiều review.
- **Đánh Giá Sản Phẩm → Người Dùng** qua `reviews.userId` · user 1 → N reviews. Một user review nhiều product.
- **Đánh Giá Sản Phẩm → Đơn Hàng** qua `reviews.orderId` · order 1 → 0..N reviews. Order hoàn tất chứng minh verified purchase.
- **Tương Tác Đánh Giá → Đánh Giá Sản Phẩm** qua `review_reactions.reviewId` · review 1 → N reactions. Một review nhận nhiều phản ứng.
- **Tương Tác Đánh Giá → Người Dùng** qua `review_reactions.userId` · user 1 → N reactions. Một user phản ứng nhiều review.
- **Mẫu Kiểm Duyệt → Đánh Giá Sản Phẩm** qua `moderation_samples.reviewId` · review 1 → 0..N samples. Mẫu học truy về review nguồn.
- **Đánh Giá Địa Điểm Nhật Bản → Người Dùng** qua `japan_spot_reviews.userId` · user 1 → N spot reviews. Một user đánh giá nhiều địa điểm.

## Business flow

Người mua có đơn hợp lệ → tạo review → hệ thống/admin kiểm duyệt → user khác phản ứng helpful/not helpful.

## Shared tables

Người Dùng, Sản Phẩm, Đơn Hàng

## Liên kết sang ERD khác

ERD-01, ERD-02, ERD-03, ERD-04, ERD-05, ERD-07.

## Vì sao nên tách thành ERD riêng

Cụm này chứng minh nguồn review, chống phản ứng trùng và tách quyết định kiểm duyệt khỏi nội dung gốc.

---

# ERD-07 — Hành vi, AI và vận hành nội dung

## Mục đích

Giải thích dữ liệu sự kiện phục vụ gợi ý, chat, thử đồ và cấu hình vận hành.

## Bảng trung tâm

**Người Dùng** — Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

## Tables

1. Người Dùng (`users`)
2. Sản Phẩm (`products`)
3. Lịch Sử Tìm Kiếm (`search_logs`)
4. Tin Nhắn (`chats`)
5. Tương Tác Người Dùng (`interactions`)
6. Lịch Sử Thử Đồ (`tryon_history`)
7. Đánh Giá Địa Điểm Nhật Bản (`japan_spot_reviews`)
8. Cấu Hình Cửa Hàng (`settings`)
9. Quảng Cáo (`banners`)

## Relationships

- **Lịch Sử Tìm Kiếm → Người Dùng** qua `search_logs.userId` · user 1 → N search events. Một user phát sinh nhiều lượt tìm.
- **Tin Nhắn → Người Dùng** qua `chats.userId` · user 1 → N messages. Một user có nhiều message.
- **Tin Nhắn → Sản Phẩm** qua `chats.productIds[]` · message N ↔ N product (mảng nhúng). Message hỏi về một hoặc nhiều product; runtime lưu mảng chứ không phải FK đơn.
- **Tương Tác Người Dùng → Người Dùng** qua `interactions.userId` · user 1 → N events. Một user tạo nhiều event hành vi.
- **Tương Tác Người Dùng → Sản Phẩm** qua `interactions.productId` · product 1 → N events. Một product nhận nhiều event.
- **Lịch Sử Thử Đồ → Sản Phẩm** qua `tryon_history.productId` · product 1 → N try-ons. Một product được thử nhiều lần.
- **Lịch Sử Thử Đồ → Người Dùng** qua `tryon_history.userId` · user 1 → N try-ons. Một user thử nhiều product/lần.
- **Đánh Giá Địa Điểm Nhật Bản → Người Dùng** qua `japan_spot_reviews.userId` · user 1 → N spot reviews. Một user đánh giá nhiều địa điểm.

## Business flow

Người dùng tìm/xem/chat/thử đồ → event gắn user và có thể gắn product → hệ thống dùng dữ liệu cho gợi ý, lịch sử và quản trị.

## Shared tables

Người Dùng, Sản Phẩm, Đánh Giá Địa Điểm Nhật Bản, Quảng Cáo

## Liên kết sang ERD khác

ERD-01, ERD-02, ERD-03, ERD-04, ERD-05, ERD-06.

## Vì sao nên tách thành ERD riêng

Đây là dữ liệu hành vi append-heavy và artifact AI; retention/index khác dữ liệu giao dịch.

---
