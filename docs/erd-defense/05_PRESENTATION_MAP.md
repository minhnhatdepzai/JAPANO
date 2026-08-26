# 05 — Bản đồ thuyết trình ERD

| Thứ tự | Diagram | Mục tiêu | Bảng cần chỉ | Quan hệ cần chỉ | Chuyển sang phần sau |
|---:|---|---|---|---|---|
| 1 | ERD-00 | Định vị 36 entity/50 quan hệ | Người Dùng, Sản Phẩm, Đơn Hàng | Ba hub | Tách catalog trước |
| 2 | ERD-01 | Giải thích catalog, master data và đơn vị tồn kho theo màu–kích cỡ. | Sản Phẩm | Sản Phẩm→Danh Mục Sản Phẩm; Chi Tiết Sản Phẩm→Sản Phẩm | Chuyển ERD-02 |
| 3 | ERD-02 | Tách metadata ảnh/video, nội dung AI và content quảng bá khỏi lõi sản phẩm. | Sản Phẩm | Hình Ảnh→Sản Phẩm; Mô Tả Sản Phẩm Tạo Bởi AI→Sản Phẩm | Chuyển ERD-03 |
| 4 | ERD-03 | Trình bày danh tính, hồ sơ, địa chỉ và dữ liệu người dùng tạo trước khi checkout. | Người Dùng | Địa Chỉ→Người Dùng; Hồ Sơ Người Dùng→Người Dùng | Chuyển ERD-04 |
| 5 | ERD-04 | Thể hiện chuỗi chứng từ tiền–hàng từ checkout tới hậu mãi. | Đơn Hàng | Chi Tiết Đơn Hàng→Đơn Hàng; Chi Tiết Đơn Hàng→Sản Phẩm | Chuyển ERD-05 |
| 6 | ERD-05 | Giải thích nguồn giảm giá, lượt dùng và phần thưởng trung thành. | Người Dùng | Đơn Hàng→Người Dùng; Đơn Hàng→Phiếu Giảm Giá | Chuyển ERD-06 |
| 7 | ERD-06 | Trình bày verified purchase, phản ứng cộng đồng và dấu vết kiểm duyệt. | Đánh Giá Sản Phẩm | Đơn Hàng→Người Dùng; Đánh Giá Sản Phẩm→Sản Phẩm | Chuyển ERD-07 |
| 8 | ERD-07 | Giải thích dữ liệu sự kiện phục vụ gợi ý, chat, thử đồ và cấu hình vận hành. | Người Dùng | Lịch Sử Tìm Kiếm→Người Dùng; Tin Nhắn→Người Dùng | Chuyển End-to-end checkout |
| 9 | FLOW-03 | Kết toàn bài bằng luồng tiền–hàng | User, Order, OrderItem, Payment | User→Order→Item/Payment | Tổng kết trade-off |

## Quy tắc chỉ màn hình

1. Chỉ actor/hub trước.
2. Nói hành động.
3. Chỉ record được tạo/đọc.
4. Chỉ FK và business meaning.
5. Chỉ bước kế tiếp; không đọc danh sách field.
