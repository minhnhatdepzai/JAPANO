# 02 — Database inventory

> [THỰC TẾ] Snapshot 20/08/2026 22:33 +07: **35 collection vật lý · 2,017 document · 36 thực thể logic · 50 quan hệ logic**.

| Table/thực thể logic | Collection vật lý | Chức năng | PK logic | FK logic | Unique/index đáng chú ý | Quan hệ | Module |
|---|---|---|---|---|---|---:|---|
| Danh Mục Sản Phẩm | `categories` | Nhóm phân loại dùng chung để duyệt catalog và đổi tên tập trung. | Mã danh mục | — | id UNIQUE | 1 | ERD-01 |
| Sản Phẩm | `products` | Mặt hàng theo cách khách tìm kiếm: tên, slug, danh mục, giá chung và trạng thái. | Mã sản phẩm | `products.categoryId` → Danh Mục Sản Phẩm | id UNIQUE, slug UNIQUE, categoryId | 15 | ERD-01 |
| Chi Tiết Sản Phẩm | `product_details` | Khối mô tả dài, câu chuyện, tags, rating và sold tách khỏi lõi catalog. | Mã chi tiết sản phẩm | `product_details.productId` → Sản Phẩm | productId UNIQUE | 1 | ERD-01 |
| Biến Thể Sản Phẩm | `product_variants` | Một tổ hợp màu–cỡ/SKU cụ thể, là đơn vị thật để định giá riêng và giữ tồn kho. | Mã biến thể | `product_variants.productId` → Sản Phẩm; `product_variants.colorName/colorHex` → Màu Sắc; `product_variants.size` → Kích Thước | id UNIQUE, productId, sku UNIQUE, productId+colorName+size UNIQUE | 3 | ERD-01 |
| Hình Ảnh | — (logic/nhúng) | Thực thể logic cũ cho ảnh sản phẩm, hiện trùng chức năng với `product_media`. | Mã hình ảnh | `legacy image.productId` → Sản Phẩm | Không có collection vật lý riêng | 1 | ERD-02 |
| Mô Tả Sản Phẩm Tạo Bởi AI | `ai_descriptions` | Lưu kết quả và dấu vết mô tả AI theo sản phẩm để tái sử dụng/audit. | Mã bản ghi mô tả AI | `ai_descriptions.productId` → Sản Phẩm | Chỉ `_id` mặc định | 1 | ERD-02 |
| Đơn Hàng | `orders` | Chứng từ một lần mua, đóng băng khách, địa chỉ, giảm giá, tổng tiền và lịch sử trạng thái. | Mã đơn hàng | `orders.userId` → Người Dùng; `orders.voucherId` → Phiếu Giảm Giá | id UNIQUE, code UNIQUE, userId+createdAt | 7 | ERD-04 |
| Chi Tiết Đơn Hàng | `order_items` | Dòng hàng nối order–product và giữ qty, giá, tên, slug, màu, cỡ tại lúc mua. | Mã chi tiết đơn hàng | `order_items.orderId` → Đơn Hàng; `order_items.productId` → Sản Phẩm | id UNIQUE, orderId, productId | 2 | ERD-04 |
| Thanh Toán | `payments` | Một payment attempt/giao dịch tiền gắn đơn, provider và lịch sử refund. | Mã thanh toán | `payments.orderId` → Đơn Hàng; `payments.userId` → Người Dùng | id UNIQUE, orderId, userId | 3 | ERD-04 |
| Yêu Cầu Trả Hàng | `return_requests` | Hồ sơ huỷ/đổi/trả: ai yêu cầu, đơn nào, payment nào, món nào và timeline xử lý. | Mã yêu cầu trả hàng | `return_requests.orderId` → Đơn Hàng; `return_requests.userId` → Người Dùng; `return_requests.paymentId` → Thanh Toán | id UNIQUE, orderId, paymentId, userId | 3 | ERD-04 |
| Người Dùng | `users` | Danh tính đăng nhập và điểm neo phân quyền; hồ sơ phong cách được tách sang `profiles`. | Mã người dùng | — | id UNIQUE, email | 21 | ERD-03 |
| Địa Chỉ | `addresses` | Sổ địa chỉ nhận hàng có thể tái sử dụng của một người dùng. | Mã địa chỉ | `addresses.userId` → Người Dùng | id UNIQUE, userId | 1 | ERD-03 |
| Hồ Sơ Người Dùng | `profiles` | Thông tin cơ thể, phong cách và ngân sách dùng để cá nhân hoá gợi ý. | Mã hồ sơ người dùng | `profiles.userId` → Người Dùng | userId UNIQUE | 1 | ERD-03 |
| Cấu Hình Cửa Hàng | `settings` | Singleton/nhóm document cấu hình phí ship, phương thức thanh toán và logo. | Mã cấu hình | — | Chỉ `_id` mặc định | 0 | ERD-07 |
| Thông Báo | `notifications` | Inbox thông báo nghiệp vụ cho user, có type/action và thời điểm. | Mã thông báo | `notifications.userId` → Người Dùng | Chỉ `_id` mặc định | 1 | ERD-03 |
| Chi Tiết Giỏ Hàng | `cart_items` | Lựa chọn tạm thời của user theo product–màu–size và quantity. | Mã chi tiết giỏ hàng | `cart_items.userId` → Người Dùng; `cart_items.productId` → Sản Phẩm | id UNIQUE, userId+productId+color+size UNIQUE | 2 | ERD-03 |
| Danh Sách Sản Phẩm Yêu Thích | `wishlist_items` | Bảng bắc cầu user–product cho một lựa chọn yêu thích. | Mã yêu thích | `wishlist_items.userId` → Người Dùng; `wishlist_items.productId` → Sản Phẩm | id UNIQUE, userId+productId UNIQUE | 2 | ERD-03 |
| Mục Tiêu Tiết Kiệm | `goals` | Kế hoạch tích quỹ của user cho một sản phẩm, kèm tiến độ và các lần nạp. | Mã mục tiêu | `goals.userId` → Người Dùng; `goals.productId` → Sản Phẩm | Chỉ `_id` mặc định | 2 | ERD-03 |
| Lịch Sử Tìm Kiếm | `search_logs` | Log từ khoá, số kết quả và user để phân tích nhu cầu/zero-result. | Mã lịch sử tìm kiếm | `search_logs.userId` → Người Dùng | Chỉ `_id` mặc định | 1 | ERD-07 |
| Tin Nhắn | `chats` | Lịch sử hội thoại trợ lý theo user, có product context tùy chọn. | Mã tin nhắn | `chats.userId` → Người Dùng; `chats.productIds[]` → Sản Phẩm | Chỉ `_id` mặc định | 2 | ERD-07 |
| Tương Tác Người Dùng | `interactions` | Event hành vi xem/thích/cart dùng cho analytics và gợi ý. | Mã tương tác | `interactions.userId` → Người Dùng; `interactions.productId` → Sản Phẩm | Chỉ `_id` mặc định | 2 | ERD-07 |
| Lịch Sử Thử Đồ | `tryon_history` | Lưu một lần try-on theo user/product/engine để xem lại và đo usage. | Mã lịch sử thử đồ | `tryon_history.productId` → Sản Phẩm; `tryon_history.userId` → Người Dùng | Chỉ `_id` mặc định | 2 | ERD-07 |
| Phiếu Giảm Giá | `vouchers` | Định nghĩa voucher: code, loại/giá trị, hạn, limit, người cấp và người nhận tùy chọn. | Mã phiếu giảm giá | `vouchers.issuedBy` → Người Dùng; `vouchers.ownerUserId` → Người Dùng | id UNIQUE, code UNIQUE | 4 | ERD-04 |
| Lượt Sử Dụng Phiếu | `voucher_redemptions` | Ledger từng lần voucher được dùng bởi user cho order và số tiền giảm. | Mã lượt sử dụng phiếu | `voucher_redemptions.voucherId` → Phiếu Giảm Giá; `voucher_redemptions.userId` → Người Dùng; `voucher_redemptions.orderId` → Đơn Hàng | id UNIQUE, voucherId, userId, orderId | 3 | ERD-04 |
| Quy Tắc Giảm Giá | `discount_rules` | Cấu hình chương trình giảm có scope, điều kiện, mức giảm và thời hạn. | Mã quy tắc giảm giá | — | id UNIQUE, code UNIQUE | 1 | ERD-05 |
| Thành Viên VIP | `vip_memberships` | Một giai đoạn user đạt VIP theo rule và tập đơn đủ điều kiện. | Mã thành viên VIP | `vip_memberships.userId` → Người Dùng; `vip_memberships.discountRuleId` → Quy Tắc Giảm Giá | id UNIQUE, userId+status, discountRuleId | 2 | ERD-05 |
| Đánh Giá Sản Phẩm | `reviews` | Nhận xét đã xác minh mua hàng nhờ nối user–product–order. | Mã đánh giá | `reviews.productId` → Sản Phẩm; `reviews.userId` → Người Dùng; `reviews.orderId` → Đơn Hàng | id UNIQUE, productId, userId, orderId | 5 | ERD-06 |
| Tương Tác Đánh Giá | `review_reactions` | Một user đánh dấu helpful/not helpful cho một review. | Mã tương tác đánh giá | `review_reactions.reviewId` → Đánh Giá Sản Phẩm; `review_reactions.userId` → Người Dùng | id UNIQUE, reviewId+userId UNIQUE | 2 | ERD-06 |
| Mẫu Kiểm Duyệt | `moderation_samples` | Mẫu nội dung bị từ chối để hỗ trợ kiểm duyệt các review sau. | Mã mẫu kiểm duyệt | `moderation_samples.reviewId` → Đánh Giá Sản Phẩm | Chỉ `_id` mặc định | 1 | ERD-06 |
| Đánh Giá Địa Điểm Nhật Bản | `japan_spot_reviews` | Nội dung người dùng đánh giá một địa điểm Nhật, tách khỏi review sản phẩm. | Mã đánh giá địa điểm | `japan_spot_reviews.userId` → Người Dùng | Chỉ `_id` mặc định | 1 | ERD-06 |
| Hình Ảnh Giao Diện Sản Phẩm | `product_media` | Metadata media sản phẩm; file thật ở Cloudinary, MongoDB giữ URL/type/vị trí. | Mã hình ảnh giao diện | `product_media.productId` → Sản Phẩm | id UNIQUE, productId+position | 1 | ERD-02 |
| Thẻ Địa Danh | `flagcards` | Nội dung gamification về địa danh và danh sách sản phẩm gợi ý. | Mã thẻ địa danh | `flagcards.recommendedProductIds[]` → Sản Phẩm | Chỉ `_id` mặc định | 2 | ERD-05 |
| Bộ Sưu Tầm Thẻ Của Người Dùng | `flagcard_collections` | Tiến trình sưu tầm card và lịch sử award của một user. | Mã bộ sưu tầm | `flagcard_collections.userId` → Người Dùng; `flagcard_collections.cardIds[]` → Thẻ Địa Danh | Chỉ `_id` mặc định | 2 | ERD-05 |
| Quảng Cáo | `banners` | Banner có ảnh, link, trạng thái và thứ tự hiển thị. | Mã banner | — | Chỉ `_id` mặc định | 0 | ERD-02 |
| Màu Sắc | — (logic/nhúng) | Từ điển màu ở mô hình logic cho biến thể sản phẩm. | Mã màu sắc | — | Không có collection vật lý riêng | 1 | ERD-01 |
| Kích Thước | — (logic/nhúng) | Từ điển kích cỡ logic và thứ tự sắp xếp size. | Mã kích thước | — | Không có collection vật lý riêng | 1 | ERD-01 |

## Collection vật lý chưa có thực thể riêng trên ERD

| Collection | Count | Vai trò | Trạng thái |
|---|---:|---|---|
| `push_tokens` | 4 | Token push theo user/device | ⚠️ ERD logic chưa mô hình hóa riêng |
| `japan_spot_suggestions` | 5 | Hàng đợi gợi ý địa điểm | ⚠️ ERD logic chưa mô hình hóa riêng |

## Thống kê phân loại

- **PK logic:** 36; ở MongoDB mọi document còn có `_id`.
- **FK/relationship logic:** 50; không phải MongoDB foreign-key constraint.
- **Junction/association:** `order_items`, `cart_items`, `wishlist_items`, `review_reactions`, `voucher_redemptions`, `flagcard_collections`.
- **Master:** categories, products, product_details, product_variants, product_media, discount_rules, flagcards, settings.
- **Transaction/ledger:** orders, order_items, payments, return_requests, voucher_redemptions.
- **History/event/log:** interactions, search_logs, chats, tryon_history, notifications, moderation_samples.
- **Bảng nhiều FK nhất:** `Yêu Cầu Trả Hàng`, `Lượt Sử Dụng Phiếu`, `Đánh Giá Sản Phẩm` (mỗi bảng 3 quan hệ outbound).
- **Bảng được tham chiếu nhiều nhất:** `Người Dùng`, kế đến `Sản Phẩm`; xem bảng trọng lực trong `03_ERD_AUDIT.md`.
