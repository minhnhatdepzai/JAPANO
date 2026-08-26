# 12 — ERD Defense Cheatsheet

# 10 TABLE PHẢI NHỚ

| Table | Nhớ một câu |
|---|---|
| Người Dùng | Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. |
| Sản Phẩm | Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`. |
| Đơn Hàng | Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng. |
| Đánh Giá Sản Phẩm | Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair. |
| Phiếu Giảm Giá | Đây là rule voucher; hai dây tới users là người cấp và người nhận. |
| Biến Thể Sản Phẩm | Đây là đơn vị kho thật; UNIQUE `(productId,colorName,size)` ngăn tách đôi tồn. |
| Thanh Toán | Đây là một payment attempt; 94/94 là current data, không phải cardinality bắt buộc. |
| Yêu Cầu Trả Hàng | Đây là workflow hậu mãi tách khỏi order để giữ nhiều lần yêu cầu và timeline. |
| Lượt Sử Dụng Phiếu | Đây vừa là bridge ba phía vừa là transaction ledger, không chỉ là bộ đếm. |
| Chi Tiết Đơn Hàng | Đây vừa là bảng nối N:N vừa là historical snapshot, không phải duplicate vô nghĩa. |

# 10 RELATIONSHIP PHẢI NHỚ

| A | B | Quan hệ | Ý nghĩa |
|---|---|---|---|
| Sản Phẩm | Danh Mục Sản Phẩm | category 1 → N products qua `products.categoryId` | Một danh mục gom nhiều sản phẩm. |
| Biến Thể Sản Phẩm | Sản Phẩm | product 1 → N variants qua `product_variants.productId` | Một product có nhiều tổ hợp màu–cỡ. |
| Chi Tiết Đơn Hàng | Đơn Hàng | order 1 → N items qua `order_items.orderId` | Một đơn gồm nhiều dòng hàng. |
| Chi Tiết Đơn Hàng | Sản Phẩm | product 1 → N sold lines qua `order_items.productId` | Một product xuất hiện ở nhiều đơn. |
| Đơn Hàng | Người Dùng | user 1 → N orders qua `orders.userId` | Một user đặt nhiều đơn; guest là ngoại lệ logic. |
| Thanh Toán | Đơn Hàng | order 1 → N payment attempts qua `payments.orderId` | Một đơn có thể retry thanh toán. |
| Yêu Cầu Trả Hàng | Đơn Hàng | order 1 → N requests qua `return_requests.orderId` | Một order có thể trả theo nhiều đợt/item. |
| Thành Viên VIP | Người Dùng | user 1 → N membership periods qua `vip_memberships.userId` | User có nhiều kỳ VIP theo thời gian. |
| Đánh Giá Sản Phẩm | Sản Phẩm | product 1 → N reviews qua `reviews.productId` | Một product có nhiều review. |
| Đánh Giá Sản Phẩm | Đơn Hàng | order 1 → 0..N reviews qua `reviews.orderId` | Order hoàn tất chứng minh verified purchase. |

# 8 FLOW PHẢI NHỚ

1. **Checkout, đơn hàng và thanh toán** — `Giỏ → Biến Thể → Đơn Hàng → Chi Tiết Đơn Hàng → Thanh Toán`.
2. **Đổi trả và hoàn tiền theo sản phẩm** — `Đơn Hàng → Chi Tiết Đơn Hàng → Yêu Cầu Trả Hàng → Thanh Toán`.
3. **Khám phá sản phẩm tới giỏ hàng** — `Danh Mục → Sản Phẩm → Biến Thể → Chi Tiết Giỏ Hàng`.
4. **Thử đồ AI và tạo lịch sử** — `Sản Phẩm → Lịch Sử Thử Đồ → Media kết quả`.
5. **Đánh giá verified purchase** — `Đơn Hàng → Đánh Giá Sản Phẩm → Mẫu Kiểm Duyệt → Tương Tác Đánh Giá`.
6. **Đăng ký, đăng nhập và hồ sơ** — `Người Dùng → Hồ Sơ Người Dùng → Địa Chỉ`.
7. **Voucher, VIP và Flagcard** — `Đơn Hàng → Thành Viên VIP/Flagcard → Phiếu Giảm Giá → Lượt Sử Dụng Phiếu`.
8. **Hành vi và gợi ý cá nhân hóa** — `Người Dùng → Search/Interaction/Chat/Goal → Sản Phẩm → Gợi ý`.

# 10 CÂU PHẢN BIỆN NGUY HIỂM

1. 35 hay 36?
2. Có transaction MongoDB không?
3. Hai backend cùng mua món cuối cùng?
4. Vì sao lưu price/name/address hai nơi?
5. Payment 94/94 có phải 1:1?
6. MongoDB không có FK thì 50 dây là gì?
7. Email/review duplicate chặn ở lớp nào?
8. db.json có phải HA?
9. Hai bảng ảnh có trùng không?
10. Cascade/delete xử lý thế nào?

# 5 ĐIỂM THIẾT KẾ CẦN GIẢI THÍCH

- **Logical 36 vs physical 35**.
- **Variant là đơn vị kho**.
- **Order Item là junction + snapshot**.
- **Payment là attempt 1:N**.
- **Integrity ở app, giới hạn một process**.

# Nếu chỉ còn 5 phút trước khi bảo vệ thì học gì?

1. Đọc `07_SCRIPT_OVERVIEW.md`.
2. Học VERSION A trong `09_FULL_PRESENTATION.md`.
3. Thuộc FLOW-03 checkout và FLOW-04 return.
4. Thuộc 10 câu nguy hiểm phía trên.
5. Nhớ câu trung thực: *source hiện tại chưa có transaction/constraint đó; production em đề xuất...*
