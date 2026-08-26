# 03 — ERD audit

## Tổng quan

- Tổng thực thể logic: **36**.
- Tổng relationship: **50**.
- Collection vật lý: **35**.
- Bảng trung tâm theo degree: **Người Dùng**, **Sản Phẩm**, sau đó **Đơn Hàng**.
- Bridge/junction đáng nói: Chi Tiết Đơn Hàng, Giỏ Hàng, Wishlist, Reaction, Voucher Redemption, Flagcard Collection.

## Trung tâm trọng lực của database

| Rank | Table | Tổng quan hệ | Inbound | Outbound | Vai trò |
|---:|---|---:|---:|---:|---|
| 1 | Người Dùng | 21 | 21 | 0 | Danh tính đăng nhập và điểm neo phân quyền; hồ sơ phong cách được tách sang `profiles`. |
| 2 | Sản Phẩm | 15 | 14 | 1 | Mặt hàng theo cách khách tìm kiếm: tên, slug, danh mục, giá chung và trạng thái. |
| 3 | Đơn Hàng | 7 | 5 | 2 | Chứng từ một lần mua, đóng băng khách, địa chỉ, giảm giá, tổng tiền và lịch sử trạng thái. |
| 4 | Đánh Giá Sản Phẩm | 5 | 2 | 3 | Nhận xét đã xác minh mua hàng nhờ nối user–product–order. |
| 5 | Phiếu Giảm Giá | 4 | 2 | 2 | Định nghĩa voucher: code, loại/giá trị, hạn, limit, người cấp và người nhận tùy chọn. |
| 6 | Thanh Toán | 3 | 1 | 2 | Một payment attempt/giao dịch tiền gắn đơn, provider và lịch sử refund. |
| 7 | Biến Thể Sản Phẩm | 3 | 0 | 3 | Một tổ hợp màu–cỡ/SKU cụ thể, là đơn vị thật để định giá riêng và giữ tồn kho. |
| 8 | Yêu Cầu Trả Hàng | 3 | 0 | 3 | Hồ sơ huỷ/đổi/trả: ai yêu cầu, đơn nào, payment nào, món nào và timeline xử lý. |
| 9 | Lượt Sử Dụng Phiếu | 3 | 0 | 3 | Ledger từng lần voucher được dùng bởi user cho order và số tiền giảm. |
| 10 | Thẻ Địa Danh | 2 | 1 | 1 | Nội dung gamification về địa danh và danh sách sản phẩm gợi ý. |

### Ảnh hưởng nếu loại bỏ các hub

#### Người Dùng

1. **Lưu gì:** Danh tính đăng nhập và điểm neo phân quyền; hồ sơ phong cách được tách sang `profiles`.
2. **Tại sao tồn tại:** Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.
3. **Bảng phụ thuộc/liên quan:** Bộ Sưu Tầm Thẻ Của Người Dùng, Chi Tiết Giỏ Hàng, Danh Sách Sản Phẩm Yêu Thích, Hồ Sơ Người Dùng, Lượt Sử Dụng Phiếu, Lịch Sử Thử Đồ, Lịch Sử Tìm Kiếm, Mục Tiêu Tiết Kiệm, Phiếu Giảm Giá, Thanh Toán, Thành Viên VIP, Thông Báo, Tin Nhắn, Tương Tác Người Dùng, Tương Tác Đánh Giá, Yêu Cầu Trả Hàng, Đánh Giá Sản Phẩm, Đánh Giá Địa Điểm Nhật Bản, Đơn Hàng, Địa Chỉ.
4. **Workflow:** Khoá tài khoản không được làm mất đơn và thanh toán đã phát sinh.
5. **Nếu bỏ:** Mất đăng nhập, phân quyền và đích tham chiếu của phần lớn dữ liệu theo người dùng.

#### Sản Phẩm

1. **Lưu gì:** Mặt hàng theo cách khách tìm kiếm: tên, slug, danh mục, giá chung và trạng thái.
2. **Tại sao tồn tại:** Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.
3. **Bảng phụ thuộc/liên quan:** Biến Thể Sản Phẩm, Chi Tiết Giỏ Hàng, Chi Tiết Sản Phẩm, Chi Tiết Đơn Hàng, Danh Mục Sản Phẩm, Danh Sách Sản Phẩm Yêu Thích, Hình Ảnh, Hình Ảnh Giao Diện Sản Phẩm, Lịch Sử Thử Đồ, Mô Tả Sản Phẩm Tạo Bởi AI, Mục Tiêu Tiết Kiệm, Thẻ Địa Danh, Tin Nhắn, Tương Tác Người Dùng, Đánh Giá Sản Phẩm.
4. **Workflow:** Giá/tên hiện tại đổi nhưng dòng đơn cũ vẫn giữ giá/tên tại lúc mua.
5. **Nếu bỏ:** Catalog, tìm kiếm, wishlist, cart, review và dòng đơn đều mất đối tượng trung tâm.

#### Đơn Hàng

1. **Lưu gì:** Chứng từ một lần mua, đóng băng khách, địa chỉ, giảm giá, tổng tiền và lịch sử trạng thái.
2. **Tại sao tồn tại:** Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng.
3. **Bảng phụ thuộc/liên quan:** Chi Tiết Đơn Hàng, Lượt Sử Dụng Phiếu, Người Dùng, Phiếu Giảm Giá, Thanh Toán, Yêu Cầu Trả Hàng, Đánh Giá Sản Phẩm.
4. **Workflow:** Double-click dùng `clientRequestId`; đổi giá sau mua không đổi tổng đơn cũ.
5. **Nếu bỏ:** Không có chứng từ để giao hàng, đối soát, hoàn tiền hay chứng minh giá đã chốt.

#### Đánh Giá Sản Phẩm

1. **Lưu gì:** Nhận xét đã xác minh mua hàng nhờ nối user–product–order.
2. **Tại sao tồn tại:** Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair.
3. **Bảng phụ thuộc/liên quan:** Mẫu Kiểm Duyệt, Người Dùng, Sản Phẩm, Tương Tác Đánh Giá, Đơn Hàng.
4. **Workflow:** Sau moderation async, code recheck trùng trong update trước khi push review.
5. **Nếu bỏ:** Không có social proof; bỏ `orderId` thì khó chứng minh đã mua và nhận hàng.

#### Phiếu Giảm Giá

1. **Lưu gì:** Định nghĩa voucher: code, loại/giá trị, hạn, limit, người cấp và người nhận tùy chọn.
2. **Tại sao tồn tại:** Đây là rule voucher; hai dây tới users là người cấp và người nhận.
3. **Bảng phụ thuộc/liên quan:** Lượt Sử Dụng Phiếu, Người Dùng, Đơn Hàng.
4. **Workflow:** Voucher hết hạn ngay lúc tạo order thì server từ chối theo thời điểm checkout.
5. **Nếu bỏ:** Checkout không có quy tắc giảm, giới hạn và nguồn phát hành để kiểm tra.

#### Thanh Toán

1. **Lưu gì:** Một payment attempt/giao dịch tiền gắn đơn, provider và lịch sử refund.
2. **Tại sao tồn tại:** Đây là một payment attempt; 94/94 là current data, không phải cardinality bắt buộc.
3. **Bảng phụ thuộc/liên quan:** Người Dùng, Yêu Cầu Trả Hàng, Đơn Hàng.
4. **Workflow:** Webhook/return/reconcile có thể lặp; code kiểm tra status/id provider trước khi ghi lặp.
5. **Nếu bỏ:** Không biểu diễn retry, trạng thái cổng, đối soát và hoàn từng phần.

#### Biến Thể Sản Phẩm

1. **Lưu gì:** Một tổ hợp màu–cỡ/SKU cụ thể, là đơn vị thật để định giá riêng và giữ tồn kho.
2. **Tại sao tồn tại:** Đây là đơn vị kho thật; UNIQUE `(productId,colorName,size)` ngăn tách đôi tồn.
3. **Bảng phụ thuộc/liên quan:** Kích Thước, Màu Sắc, Sản Phẩm.
4. **Workflow:** Áo size M còn 5 nhưng size L còn 0; chỉ L phải báo hết.
5. **Nếu bỏ:** Không biết size/màu nào còn hàng; hết L bị hiểu sai thành hết cả sản phẩm.

#### Yêu Cầu Trả Hàng

1. **Lưu gì:** Hồ sơ huỷ/đổi/trả: ai yêu cầu, đơn nào, payment nào, món nào và timeline xử lý.
2. **Tại sao tồn tại:** Đây là workflow hậu mãi tách khỏi order để giữ nhiều lần yêu cầu và timeline.
3. **Bảng phụ thuộc/liên quan:** Người Dùng, Thanh Toán, Đơn Hàng.
4. **Workflow:** Một order có thể có nhiều yêu cầu theo các nhóm item khác nhau.
5. **Nếu bỏ:** Hoàn tiền mất căn cứ, không biết trả toàn bộ hay từng món, không audit quyết định admin.

## Những điểm ERD và database khớp nhau

- [THỰC TẾ] Tên 36 thực thể và 50 cạnh parse lại được trực tiếp từ `erd.drawio`.
- [THỰC TẾ] Các hub User/Product/Order khớp với field tham chiếu và route nghiệp vụ.
- [THỰC TẾ] `order_items` là junction có dữ liệu riêng và historical snapshot; không phải duplicate vô nghĩa.
- [THỰC TẾ] `product_variants` có unique `(productId,colorName,size)` và là đơn vị tồn kho.

## Những điểm ERD và source/database khác nhau

- **36 vs 35:** 36 thực thể logic, 35 collection vật lý. `Màu Sắc`, `Kích Thước`, `Hình Ảnh` không có collection 1–1; `push_tokens`, `japan_spot_suggestions` không có entity riêng.
- **Hai thực thể ảnh:** runtime dùng `product_media`; `Hình Ảnh` là dấu vết logic cũ/trùng vai trò.
- **Cardinality payment:** dữ liệu hiện có 94 order/94 payment không chứng minh 1:1; `payments.orderId` không unique, schema cho phép retry 1:N.
- **FK:** MongoDB không áp đặt; integrity là application-level và có giới hạn fallback/multi-instance.
- **Review:** source chưa có unique `(userId,productId)` trong khi wishlist đã có unique pair.

## Những điểm cần xác minh

- ⚠️ Chính sách retention/xóa ảnh thử đồ và dữ liệu hành vi chưa được định nghĩa đầy đủ.
- ⚠️ Cascade trong tài liệu là business policy/đề xuất; source không có MongoDB cascade constraint.
- ⚠️ Một số trường FK nullable phụ thuộc workflow; cần dùng validation schema nếu chuyển sang direct-per-collection writes.

## ERD nhìn ở cấp kiến trúc nói lên điều gì?

> [THỰC TẾ] Mật độ cạnh tập trung vào Người Dùng và Sản Phẩm cho thấy JAPANO lấy hành trình người dùng quanh catalog làm trục; Đơn Hàng là hub chứng từ nối product snapshot, payment, return, voucher và review. Các bảng event/AI nằm ở rìa vì chúng bổ sung cá nhân hóa, không quyết định tính đúng đắn của giao dịch.
