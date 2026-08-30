# Ánh xạ ERD logic ↔ collection vật lý

Snapshot Atlas: **2026-08-28** · database `japano`.

## Vì sao hai con số khác nhau

- `erd.drawio` — ERD **logic** phục vụ tài liệu bảo vệ: **36 entity**.
- Atlas — schema **vật lý** đang chạy: **34 collection**.

36 ≠ 34 **không phải lỗi**. ERD logic mô hình hoá *khái niệm nghiệp vụ*; MongoDB gộp một số khái niệm
vào document cha vì chúng không bao giờ được truy vấn độc lập. Cụ thể:

| Chênh lệch | Giải thích |
|---|---|
| `Màu Sắc`, `Kích Thước` | Là **field nhúng** trong `product_variants`, không phải collection. Trong mô hình quan hệ chúng sẽ là bảng tra cứu; trong MongoDB tách ra chỉ thêm một lượt join mà không được gì. |
| `Hình Ảnh` vs `Hình Ảnh Giao Diện Sản Phẩm` | Hai entity logic, một collection vật lý `product_media`. |
| `Lịch Sử Thử Đồ` | Đã **xoá khỏi schema**: trùng `interactions` với `type=tryon`. |

**Không được gọi 36 entity logic là 36 collection vật lý.**

## Bảng ánh xạ

| # | Entity logic (erd.drawio) | Vật lý | Dạng | Nhãn | Docs | Ghi chú |
|---:|---|---|---|---|---:|---|
| 1 | Người Dùng | `users` | collection | `[THỰC TẾ]` | 36 |  |
| 2 | Địa Chỉ | `addresses` | collection | `[THỰC TẾ]` | 11 |  |
| 3 | Hồ Sơ Người Dùng | `profiles` | collection | `[THỰC TẾ]` | 12 | chứa số đo cơ thể |
| 4 | Danh Mục Sản Phẩm | `categories` | collection | `[THỰC TẾ]` | 5 |  |
| 5 | Sản Phẩm | `products` | collection | `[THỰC TẾ]` | 71 |  |
| 6 | Chi Tiết Sản Phẩm | `product_details` | collection | `[THỰC TẾ]` | 71 | 1:1 với products (unique productId) |
| 7 | Mô Tả Sản Phẩm Tạo Bởi AI | `ai_descriptions` | collection | `[THỰC TẾ]` | 8 |  |
| 8 | Biến Thể Sản Phẩm | `product_variants` | collection | `[THỰC TẾ]` | 497 | unique (productId,colorName,size) |
| 9 | Màu Sắc | `product_variants.colorName / colorHex` | field nhúng | `[SUY LUẬN]` | — | KHÔNG có collection riêng |
| 10 | Kích Thước | `product_variants.size` | field nhúng | `[SUY LUẬN]` | — | KHÔNG có collection riêng |
| 11 | Hình Ảnh Giao Diện Sản Phẩm | `product_media` | collection | `[THỰC TẾ]` | 151 | chỉ URL Cloudinary |
| 12 | Hình Ảnh | `product_media` | collection (đã gộp) | `[SUY LUẬN]` | 151 | entity logic cũ; product_media đã thay thế |
| 13 | Chi Tiết Giỏ Hàng | `cart_items` | collection | `[THỰC TẾ]` | 5 |  |
| 14 | Danh Sách Sản Phẩm Yêu Thích | `wishlist_items` | collection | `[THỰC TẾ]` | 15 |  |
| 15 | Đơn Hàng | `orders` | collection | `[THỰC TẾ]` | 98 |  |
| 16 | Chi Tiết Đơn Hàng | `order_items` | collection | `[THỰC TẾ]` | 160 | productId là snapshot lịch sử |
| 17 | Thanh Toán | `payments` | collection | `[THỰC TẾ]` | 98 |  |
| 18 | Yêu Cầu Trả Hàng | `return_requests` | collection | `[THỰC TẾ]` | 10 |  |
| 19 | Phiếu Giảm Giá | `vouchers` | collection | `[THỰC TẾ]` | 4 |  |
| 20 | Lượt Sử Dụng Phiếu | `voucher_redemptions` | collection | `[THỰC TẾ]` | 5 |  |
| 21 | Quy Tắc Giảm Giá | `discount_rules` | collection | `[THỰC TẾ]` | 3 |  |
| 22 | Thành Viên VIP | `vip_memberships` | view suy ra | `[THỰC TẾ]` | 6 | deriveVipMemberships() ghi đè mỗi lần chạy |
| 23 | Thẻ Địa Danh | `flagcards` | collection | `[THỰC TẾ]` | 7 |  |
| 24 | Bộ Sưu Tầm Thẻ Của Người Dùng | `flagcard_collections` | collection | `[THỰC TẾ]` | 4 |  |
| 25 | Đánh Giá Sản Phẩm | `reviews` | collection | `[THỰC TẾ]` | 31 |  |
| 26 | Tương Tác Đánh Giá | `review_reactions` | collection | `[THỰC TẾ]` | 88 | unique (reviewId,userId) |
| 27 | Mẫu Kiểm Duyệt | `moderation_samples` | collection | `[THỰC TẾ]` | 6 | reviewId coverage 0% |
| 28 | Đánh Giá Địa Điểm Nhật Bản | `japan_spot_reviews` | collection | `[THỰC TẾ]` | 5 |  |
| 29 | Tương Tác Người Dùng | `interactions` | collection | `[THỰC TẾ]` | 877 | 92 orphan userId |
| 30 | Lịch Sử Tìm Kiếm | `search_logs` | collection | `[THỰC TẾ]` | 13 |  |
| 31 | Tin Nhắn | `chats` | collection | `[THỰC TẾ]` | 74 | 6 orphan userId |
| 32 | Mục Tiêu Tiết Kiệm | `goals` | collection | `[THỰC TẾ]` | 10 |  |
| 33 | Thông Báo | `notifications` | collection | `[THỰC TẾ]` | 59 |  |
| 34 | Quảng Cáo | `banners` | collection | `[THỰC TẾ]` | 3 |  |
| 35 | Cấu Hình Cửa Hàng | `settings` | collection | `[THỰC TẾ]` | 3 |  |
| 36 | Lịch Sử Thử Đồ | `—` | ĐÃ XOÁ | `[THỰC TẾ]` | — | trùng interactions type=tryon; metadata chuyển vào interactions.metadata |

## Collection vật lý KHÔNG có entity logic tương ứng

| Collection | Docs | Vì sao ERD logic không có |
|---|---:|---|
| `japan_spot_suggestions` | 5 | Chưa được mô hình hoá trong `erd.drawio` — cần bổ sung hoặc giải thích |
| `push_tokens` | 4 | Chưa được mô hình hoá trong `erd.drawio` — cần bổ sung hoặc giải thích |

## Quy tắc bảo trì

1. `erd.drawio` **giữ nguyên**. Không ghi đè bằng ERD vật lý.
2. Ba file, ba mục đích: `erd.drawio` (logic/bảo vệ), `JAPANO_ERD_MongoDB.drawio` (vật lý, 34/34), `docs/architecture/erd/JAPANO_ERD_CORE.drawio` (view trình bày 14).
3. Thêm collection vào Atlas ⇒ phải cập nhật bảng này và ERD vật lý; generator sẽ **dừng** nếu lệch.
