# 09 — Bài thuyết trình ERD hoàn chỉnh

# VERSION A — 5 PHÚT

[MỞ ERD TỔNG]

> ERD JAPANO có 36 thực thể logic, 50 quan hệ và được hiện thực thành 35 collection MongoDB. Em sẽ không đọc từng bảng mà đi theo luồng dữ liệu. Ba điểm neo là Người Dùng, Sản Phẩm và Đơn Hàng.

[CHỈ USER] [CHỈ PRODUCT]

> User và Product có degree cao nhất vì chúng nối danh tính với hầu hết hành vi mua sắm. Product tách Category, Detail, Variant và Media; trong đó Variant mới là đơn vị tồn kho theo màu–cỡ.

[CHUYỂN ERD-01] [CHỈ PRODUCT → VARIANT]

> Một product có nhiều variant. Unique `(productId,colorName,size)` ngăn cùng một lựa chọn bị tách thành hai kho. Màu và kích thước có trên ERD logic nhưng được nhúng vào variant ở MongoDB.

[CHUYỂN ERD-04] [CHỈ USER → ORDER → ORDER ITEM]

> Khi checkout, server tính lại giá và kiểm tra tồn kho. Order giữ snapshot khách, địa chỉ và tổng tiền; Order Item nối Order với Product, đồng thời chụp tên, màu, cỡ, số lượng và giá để catalog đổi sau này không làm sai chứng từ.

[CHỈ ORDER → PAYMENT → RETURN]

> Payment là attempt nên orderId không unique; một đơn có thể retry. Return Request tách riêng để lưu item, bằng chứng, timeline và payment cần hoàn. Idempotency được chốt bằng clientRequestId, wasPaid và stockRestoredAt, nhưng chưa phải transaction MongoDB nhiều document.

[CHUYỂN ERD-06]

> Review giữ ba FK tới user, product và order để chứng minh verified purchase. Điểm yếu thật là chưa có unique `(userId,productId)` ở MongoDB.

[QUAY ERD TỔNG]

> Tóm lại, thiết kế mạnh ở việc tách master, mapping và chứng từ snapshot. Giới hạn là FK/application integrity chỉ an toàn theo kiến trúc một process hiện tại; khi mở rộng nhiều backend phải dùng unique/atomic update/transaction ở MongoDB.

# VERSION B — 8 PHÚT

[MỞ ERD TỔNG]

> ERD mô tả 36 thực thể logic và 50 quan hệ. MongoDB hiện có 35 collection vật lý; sự chênh lệch là do một số lookup được nhúng và hai collection kỹ thuật chưa được vẽ. Em chia sơ đồ theo bảy nghiệp vụ, rồi kết bằng checkout.

[CHUYỂN ERD-01] [CHỈ SẢN PHẨM]

> Giải thích catalog, master data và đơn vị tồn kho theo màu–kích cỡ. Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`. [CHỈ Sản Phẩm → Danh Mục Sản Phẩm] `products.categoryId` biểu diễn category 1 → n products; một danh mục gom nhiều sản phẩm. Quản trị viên tạo danh mục → tạo sản phẩm → bổ sung chi tiết → tạo từng biến thể màu/cỡ → khách đọc catalog và tồn kho.

[CHUYỂN ERD-02] [CHỈ SẢN PHẨM]

> Tách metadata ảnh/video, nội dung AI và content quảng bá khỏi lõi sản phẩm. Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`. [CHỈ Hình Ảnh → Sản Phẩm] `legacy image.productId` biểu diễn product 1 → n images (logic); ảnh cũ thuộc một product. Admin tải media lên Cloudinary → MongoDB lưu URL/type/vị trí → sinh mô tả AI theo sản phẩm → duyệt nội dung để hiển thị.

[CHUYỂN ERD-03] [CHỈ NGƯỜI DÙNG]

> Trình bày danh tính, hồ sơ, địa chỉ và dữ liệu người dùng tạo trước khi checkout. Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. [CHỈ Địa Chỉ → Người Dùng] `addresses.userId` biểu diễn user 1 → n addresses; một user lưu nhiều địa chỉ. Người dùng đăng nhập → hoàn thiện hồ sơ/địa chỉ → xem sản phẩm → lưu wishlist/giỏ/mục tiêu → nhận thông báo.

[CHUYỂN ERD-04] [CHỈ ĐƠN HÀNG]

> Thể hiện chuỗi chứng từ tiền–hàng từ checkout tới hậu mãi. Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng. [CHỈ Chi Tiết Đơn Hàng → Đơn Hàng] `order_items.orderId` biểu diễn order 1 → n items; một đơn gồm nhiều dòng hàng. Khách checkout → tạo đơn và dòng hàng snapshot → tạo payment attempt → đối soát → nếu cần tạo return request và hoàn tiền theo item.

[CHUYỂN ERD-05] [CHỈ NGƯỜI DÙNG]

> Giải thích nguồn giảm giá, lượt dùng và phần thưởng trung thành. Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. [CHỈ Đơn Hàng → Người Dùng] `orders.userId` biểu diễn user 1 → n orders; một user đặt nhiều đơn; guest là ngoại lệ logic. Đơn hoàn tất → tính hạng VIP/trao Flagcard → sinh hoặc áp voucher → ghi redemption gắn user và order.

[CHUYỂN ERD-06] [CHỈ ĐÁNH GIÁ SẢN PHẨM]

> Trình bày verified purchase, phản ứng cộng đồng và dấu vết kiểm duyệt. Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair. [CHỈ Đơn Hàng → Người Dùng] `orders.userId` biểu diễn user 1 → n orders; một user đặt nhiều đơn; guest là ngoại lệ logic. Người mua có đơn hợp lệ → tạo review → hệ thống/admin kiểm duyệt → user khác phản ứng helpful/not helpful.

[CHUYỂN ERD-07] [CHỈ NGƯỜI DÙNG]

> Giải thích dữ liệu sự kiện phục vụ gợi ý, chat, thử đồ và cấu hình vận hành. Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. [CHỈ Lịch Sử Tìm Kiếm → Người Dùng] `search_logs.userId` biểu diễn user 1 → n search events; một user phát sinh nhiều lượt tìm. Người dùng tìm/xem/chat/thử đồ → event gắn user và có thể gắn product → hệ thống dùng dữ liệu cho gợi ý, lịch sử và quản trị.

[MỞ FLOW-03] [CHỈ USER → ORDER → ORDER ITEM → PAYMENT]

> Đây là flow em chọn để kết: actor xác nhận giỏ; server đọc product/variant, tính lại giá và tồn; tạo Order cùng Order Item snapshot; payment provider cập nhật Payment; nếu hậu mãi thì Return Request trỏ lại Order và Payment. Mỗi dây tồn tại để dữ liệu ở bước sau vẫn truy được nguồn và giữ đúng lịch sử.

[QUAY ERD TỔNG]

> Về trade-off, logical model khá chuẩn hóa, nhưng physical MongoDB chủ động denormalize snapshot và lookup đóng. Hệ thống có application-level referential integrity, chưa có FK/cascade/transaction server-side; đây là giới hạn cần xử lý khi production nhiều instance.
