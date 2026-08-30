# Chính sách lưu giữ dữ liệu — JAPANO

Cập nhật 2026-08-29, sau khi rút database từ 34 xuống 29 collection.

Nguyên tắc: **cái gì người dùng, nhân viên, kế toán hoặc quy trình hoàn tất đơn
còn cần thì giữ.** Số lượng collection ít đi không tự nó tiết kiệm tiền — chi
phí nằm ở `dataSize`, `totalIndexSize` và tốc độ tăng.

## Phân lớp

| Lớp | Ý nghĩa | Chính sách |
|---|---|---|
| A — nghiệp vụ lõi | `products`, `orders`, `users`, `categories`, `reviews`… | giữ vĩnh viễn |
| B — sổ chứng từ | `payments`, `voucher_redemptions`, `return_requests` | giữ vĩnh viễn, không bao giờ suy lại |
| C — cấu hình | `settings` (chứa cả banners và discount rules) | giữ, nhúng gọn |
| D — quan hệ 1:1 | (không còn) `product_details` | đã nhúng vào `products` |
| E — suy ra được | (không còn) `vip_memberships` | tính lại bằng `reconcileVipState` |
| F — cache AI | (không còn) `ai_descriptions` | cache RAM trong `routes/catalog.js` |
| G — log tăng nhanh | `interactions`, `search_logs`, `notifications`, `chats`, `cart_items` | cần retention — xem dưới |
| H — media | `product_media` | chỉ URL Cloudinary + metadata, không bao giờ lưu byte ảnh |

## Đề xuất retention cho lớp G — **chưa triển khai**

| Collection | Doc hiện tại | Đề xuất | Vì sao chưa làm |
|---|---:|---|---|
| `interactions` | 671 | TTL 180 ngày cho sự kiện thô + bản tổng hợp theo ngày | là đầu vào của bộ gợi ý; cắt ngắn làm giảm chất lượng đề xuất — cần người quyết định đánh đổi |
| `notifications` | 46 | TTL 90 ngày kể từ khi đã đọc | cần thống nhất "đã đọc" tính từ field nào |
| `chats` | 68 | giới hạn N lượt gần nhất cho mỗi người | người dùng có thể muốn xem lại lịch sử tư vấn |
| `search_logs` | 13 | TTL 90 ngày | an toàn, nhưng gộp chung một lần với các TTL khác |
| `cart_items` | 5 | dọn giỏ bỏ quên sau 60 ngày | giỏ hàng bỏ quên vẫn là tín hiệu bán hàng |

Tạo TTL index là **thao tác ghi lên Atlas và sẽ tự động xoá dữ liệu người dùng**.
Vì vậy phiên này chỉ đề xuất, không thực thi. Trước khi bật TTL cần: chốt thời
hạn, xác nhận API/UI không cần lịch sử dài hơn thế, viết test kiểm tra index tồn
tại, và có bản archive ngoài Atlas nếu cần tra cứu về sau.

## Đã tiết kiệm được gì

| Nguồn tiết kiệm | Giá trị |
|---|---|
| Bỏ 5 collection | −184 320 B storage, −331 776 B index |
| Gộp `product_details` vào `products` | −71 document, −73 728 B index |
| Bỏ index của `discount_rules` và `vip_memberships` | −7 index |
| TTL | chưa triển khai |
| Media giữ ngoài MongoDB | ảnh và video ở Cloudinary; MongoDB chỉ giữ URL |

Tổng: `dataSize` 838 KB → 623 KB, `storageSize` 1,54 MB → 1,36 MB,
`totalIndexSize` 3,23 MB → 2,90 MB.

Cần nhìn đúng tỉ lệ: index vẫn lớn gấp 4,7 lần dữ liệu. Lý do là sàn cấp phát
của WiredTiger — mỗi collection tốn khoảng 36 KB và mỗi index thêm khoảng 36 KB
bất kể số document. Ở quy mô hiện tại, cách tiết kiệm hiệu quả nhất không phải
xoá dữ liệu mà là **bỏ bớt index không có truy vấn nào dùng tới**.
