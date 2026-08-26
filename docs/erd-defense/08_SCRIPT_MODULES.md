# 08 — Bài nói cho từng ERD con

> Mỗi phần 40–90 giây. Câu trong dấu `[]` là hành động trình chiếu.

# ERD-01 — Danh mục, sản phẩm và biến thể

## Khi bắt đầu slide

> [MỞ ERD-01] Ở cụm này em tập trung vào giải thích catalog, master data và đơn vị tồn kho theo màu–kích cỡ. Bảng trung tâm là Sản Phẩm; đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.

## Chỉ vào bảng Sản Phẩm

> [CHỈ SẢN PHẨM] Mặt hàng theo cách khách tìm kiếm: tên, slug, danh mục, giá chung và trạng thái. Nếu bỏ bảng này: Catalog, tìm kiếm, wishlist, cart, review và dòng đơn đều mất đối tượng trung tâm.

## Chỉ vào relationship Sản Phẩm → Danh Mục Sản Phẩm

> [CHỈ DÂY] `products.categoryId` thể hiện category 1 → n products; một danh mục gom nhiều sản phẩm. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Quản trị viên tạo danh mục → tạo sản phẩm → bổ sung chi tiết → tạo từng biến thể màu/cỡ → khách đọc catalog và tồn kho.

## Lý do thiết kế

> Đây là bounded context catalog và inventory; biến thể là nơi quy tắc tồn kho khác với mô tả sản phẩm. Điểm cần thừa nhận: Xoá thật bị toàn vẹn chặn khi đã có dòng đơn; chính sách vòng đời chưa được khai báo bằng `deletedAt`.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Chi Tiết Sản Phẩm và Sản Phẩm, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.

---

# ERD-02 — Media và nội dung sản phẩm tạo bởi AI

## Khi bắt đầu slide

> [MỞ ERD-02] Ở cụm này em tập trung vào tách metadata ảnh/video, nội dung ai và content quảng bá khỏi lõi sản phẩm. Bảng trung tâm là Sản Phẩm; đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.

## Chỉ vào bảng Sản Phẩm

> [CHỈ SẢN PHẨM] Mặt hàng theo cách khách tìm kiếm: tên, slug, danh mục, giá chung và trạng thái. Nếu bỏ bảng này: Catalog, tìm kiếm, wishlist, cart, review và dòng đơn đều mất đối tượng trung tâm.

## Chỉ vào relationship Hình Ảnh → Sản Phẩm

> [CHỈ DÂY] `legacy image.productId` thể hiện product 1 → n images (logic); ảnh cũ thuộc một product. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Admin tải media lên Cloudinary → MongoDB lưu URL/type/vị trí → sinh mô tả AI theo sản phẩm → duyệt nội dung để hiển thị.

## Lý do thiết kế

> Các artifact media/AI có vòng đời và cách kiểm duyệt khác dữ liệu giá, SKU và tồn kho. Điểm cần thừa nhận: Xoá thật bị toàn vẹn chặn khi đã có dòng đơn; chính sách vòng đời chưa được khai báo bằng `deletedAt`.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Mô Tả Sản Phẩm Tạo Bởi AI và Sản Phẩm, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.

---

# ERD-03 — Người dùng và ý định mua sắm

## Khi bắt đầu slide

> [MỞ ERD-03] Ở cụm này em tập trung vào trình bày danh tính, hồ sơ, địa chỉ và dữ liệu người dùng tạo trước khi checkout. Bảng trung tâm là Người Dùng; đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

## Chỉ vào bảng Người Dùng

> [CHỈ NGƯỜI DÙNG] Danh tính đăng nhập và điểm neo phân quyền; hồ sơ phong cách được tách sang `profiles`. Nếu bỏ bảng này: Mất đăng nhập, phân quyền và đích tham chiếu của phần lớn dữ liệu theo người dùng.

## Chỉ vào relationship Địa Chỉ → Người Dùng

> [CHỈ DÂY] `addresses.userId` thể hiện user 1 → n addresses; một user lưu nhiều địa chỉ. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Người dùng đăng nhập → hoàn thiện hồ sơ/địa chỉ → xem sản phẩm → lưu wishlist/giỏ/mục tiêu → nhận thông báo.

## Lý do thiết kế

> Các bản ghi cùng phụ thuộc user nhưng có vòng đời khác chứng từ đơn hàng. Điểm cần thừa nhận: `users.email` chỉ có index thường; chạy nhiều backend vẫn có race đăng ký trùng email.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Hồ Sơ Người Dùng và Người Dùng, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.

---

# ERD-04 — Đơn hàng, thanh toán và trả hàng

## Khi bắt đầu slide

> [MỞ ERD-04] Ở cụm này em tập trung vào thể hiện chuỗi chứng từ tiền–hàng từ checkout tới hậu mãi. Bảng trung tâm là Đơn Hàng; đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng.

## Chỉ vào bảng Đơn Hàng

> [CHỈ ĐƠN HÀNG] Chứng từ một lần mua, đóng băng khách, địa chỉ, giảm giá, tổng tiền và lịch sử trạng thái. Nếu bỏ bảng này: Không có chứng từ để giao hàng, đối soát, hoàn tiền hay chứng minh giá đã chốt.

## Chỉ vào relationship Chi Tiết Đơn Hàng → Đơn Hàng

> [CHỈ DÂY] `order_items.orderId` thể hiện order 1 → n items; một đơn gồm nhiều dòng hàng. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Khách checkout → tạo đơn và dòng hàng snapshot → tạo payment attempt → đối soát → nếu cần tạo return request và hoàn tiền theo item.

## Lý do thiết kế

> Đây là transaction core; cần nhìn liền mạch để giải thích giá lịch sử, idempotency và audit. Điểm cần thừa nhận: `clientRequestId` chưa có unique index DB; state lưu trong memory và ghi Mongo sau debounce 40 ms.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Chi Tiết Đơn Hàng và Sản Phẩm, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.

---

# ERD-05 — Khuyến mãi, VIP và Flagcard

## Khi bắt đầu slide

> [MỞ ERD-05] Ở cụm này em tập trung vào giải thích nguồn giảm giá, lượt dùng và phần thưởng trung thành. Bảng trung tâm là Người Dùng; đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

## Chỉ vào bảng Người Dùng

> [CHỈ NGƯỜI DÙNG] Danh tính đăng nhập và điểm neo phân quyền; hồ sơ phong cách được tách sang `profiles`. Nếu bỏ bảng này: Mất đăng nhập, phân quyền và đích tham chiếu của phần lớn dữ liệu theo người dùng.

## Chỉ vào relationship Đơn Hàng → Người Dùng

> [CHỈ DÂY] `orders.userId` thể hiện user 1 → n orders; một user đặt nhiều đơn; guest là ngoại lệ logic. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Đơn hoàn tất → tính hạng VIP/trao Flagcard → sinh hoặc áp voucher → ghi redemption gắn user và order.

## Lý do thiết kế

> Các bảng này cùng trả lời giảm giá đến từ đâu, đã dùng ở đơn nào và phần thưởng thuộc user nào. Điểm cần thừa nhận: `users.email` chỉ có index thường; chạy nhiều backend vẫn có race đăng ký trùng email.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Đơn Hàng và Phiếu Giảm Giá, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.

---

# ERD-06 — Đánh giá và kiểm duyệt

## Khi bắt đầu slide

> [MỞ ERD-06] Ở cụm này em tập trung vào trình bày verified purchase, phản ứng cộng đồng và dấu vết kiểm duyệt. Bảng trung tâm là Đánh Giá Sản Phẩm; đây là đánh giá verified purchase vì giữ `orderid`, nhưng db chưa chặn duplicate pair.

## Chỉ vào bảng Đánh Giá Sản Phẩm

> [CHỈ ĐÁNH GIÁ SẢN PHẨM] Nhận xét đã xác minh mua hàng nhờ nối user–product–order. Nếu bỏ bảng này: Không có social proof; bỏ `orderId` thì khó chứng minh đã mua và nhận hàng.

## Chỉ vào relationship Đơn Hàng → Người Dùng

> [CHỈ DÂY] `orders.userId` thể hiện user 1 → n orders; một user đặt nhiều đơn; guest là ngoại lệ logic. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Người mua có đơn hợp lệ → tạo review → hệ thống/admin kiểm duyệt → user khác phản ứng helpful/not helpful.

## Lý do thiết kế

> Cụm này chứng minh nguồn review, chống phản ứng trùng và tách quyết định kiểm duyệt khỏi nội dung gốc. Điểm cần thừa nhận: Thiếu UNIQUE `(userId,productId)` ở MongoDB; hai instance vẫn có thể tạo trùng.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Đánh Giá Sản Phẩm và Sản Phẩm, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.

---

# ERD-07 — Hành vi, AI và vận hành nội dung

## Khi bắt đầu slide

> [MỞ ERD-07] Ở cụm này em tập trung vào giải thích dữ liệu sự kiện phục vụ gợi ý, chat, thử đồ và cấu hình vận hành. Bảng trung tâm là Người Dùng; đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

## Chỉ vào bảng Người Dùng

> [CHỈ NGƯỜI DÙNG] Danh tính đăng nhập và điểm neo phân quyền; hồ sơ phong cách được tách sang `profiles`. Nếu bỏ bảng này: Mất đăng nhập, phân quyền và đích tham chiếu của phần lớn dữ liệu theo người dùng.

## Chỉ vào relationship Lịch Sử Tìm Kiếm → Người Dùng

> [CHỈ DÂY] `search_logs.userId` thể hiện user 1 → n search events; một user phát sinh nhiều lượt tìm. Đây là business meaning của dây, không phải MongoDB foreign-key constraint.

## Luồng dữ liệu

> Người dùng tìm/xem/chat/thử đồ → event gắn user và có thể gắn product → hệ thống dùng dữ liệu cho gợi ý, lịch sử và quản trị.

## Lý do thiết kế

> Đây là dữ liệu hành vi append-heavy và artifact AI; retention/index khác dữ liệu giao dịch. Điểm cần thừa nhận: `users.email` chỉ có index thường; chạy nhiều backend vẫn có race đăng ký trùng email.

## Câu chuyển sang ERD tiếp theo

> Sau khi đã thấy dữ liệu đi qua Tin Nhắn và Người Dùng, em chuyển sang cụm tiếp theo để xem phần còn lại của hành trình.
