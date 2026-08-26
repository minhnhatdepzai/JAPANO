# 13 — ERD DEFENSE MAP

## ① ERD TỔNG

**Nói:**
> 36 thực thể logic, 50 quan hệ; User và Product là hub, Order là trung tâm chứng từ.

**Chỉ:** User · Product · Order

↓

## ② ERD-01 — Danh mục, sản phẩm và biến thể

**Nói:**
> Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`. Quản trị viên tạo danh mục → tạo sản phẩm → bổ sung chi tiết → tạo từng biến thể màu/cỡ → khách đọc catalog và tồn kho.

**Chỉ:**
- Sản Phẩm
- Sản Phẩm → Danh Mục Sản Phẩm qua `products.categoryId`

↓

## ③ ERD-02 — Media và nội dung sản phẩm tạo bởi AI

**Nói:**
> Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`. Admin tải media lên Cloudinary → MongoDB lưu URL/type/vị trí → sinh mô tả AI theo sản phẩm → duyệt nội dung để hiển thị.

**Chỉ:**
- Sản Phẩm
- Hình Ảnh → Sản Phẩm qua `legacy image.productId`

↓

## ④ ERD-03 — Người dùng và ý định mua sắm

**Nói:**
> Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. Người dùng đăng nhập → hoàn thiện hồ sơ/địa chỉ → xem sản phẩm → lưu wishlist/giỏ/mục tiêu → nhận thông báo.

**Chỉ:**
- Người Dùng
- Địa Chỉ → Người Dùng qua `addresses.userId`

↓

## ⑤ ERD-04 — Đơn hàng, thanh toán và trả hàng

**Nói:**
> Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng. Khách checkout → tạo đơn và dòng hàng snapshot → tạo payment attempt → đối soát → nếu cần tạo return request và hoàn tiền theo item.

**Chỉ:**
- Đơn Hàng
- Chi Tiết Đơn Hàng → Đơn Hàng qua `order_items.orderId`

↓

## ⑥ ERD-05 — Khuyến mãi, VIP và Flagcard

**Nói:**
> Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. Đơn hoàn tất → tính hạng VIP/trao Flagcard → sinh hoặc áp voucher → ghi redemption gắn user và order.

**Chỉ:**
- Người Dùng
- Đơn Hàng → Người Dùng qua `orders.userId`

↓

## ⑦ ERD-06 — Đánh giá và kiểm duyệt

**Nói:**
> Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair. Người mua có đơn hợp lệ → tạo review → hệ thống/admin kiểm duyệt → user khác phản ứng helpful/not helpful.

**Chỉ:**
- Đánh Giá Sản Phẩm
- Đơn Hàng → Người Dùng qua `orders.userId`

↓

## ⑧ ERD-07 — Hành vi, AI và vận hành nội dung

**Nói:**
> Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. Người dùng tìm/xem/chat/thử đồ → event gắn user và có thể gắn product → hệ thống dùng dữ liệu cho gợi ý, lịch sử và quản trị.

**Chỉ:**
- Người Dùng
- Lịch Sử Tìm Kiếm → Người Dùng qua `search_logs.userId`

↓

## ⑨ END-TO-END CHECKOUT

**Nói:**
> User tạo Order; Order Item giữ dòng hàng và giá lịch sử; Payment giữ attempt và đối soát; Return Request giữ hậu mãi.

**Chỉ:** User → Order → Order Item/Product → Payment → Return Request

↓

## ⑩ KẾT

> Điểm mạnh là tách đúng master–mapping–transaction–history. Giới hạn là integrity hiện ở application và một process; production nhiều instance phải đưa unique, atomic update và transaction xuống MongoDB.
