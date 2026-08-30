# Quyết định lưu trữ và ERD JAPANO — 2026-08-29

> Tài liệu này ghi lại **snapshot trước migration** (34 collection). Trạng thái
> sau migration từng là 29 collection. Hiện hành là 30 collection sau khi thêm
> `japan_spots`, một master data 25 địa điểm thực sự hiển thị trong app; xem
> `docs/database/ERD_VALIDATION_REPORT.md` và `docs/database/atlas-snapshot.json`.

Nguồn kiểm chứng: MongoDB Atlas database `japano`, đọc bằng
`scripts/atlas_audit.js` và `scripts/atlas-inventory.js`. Hai script chỉ đọc,
không in connection string, không ghi hoặc xoá dữ liệu.

## Kết luận

- Atlas đang có **34 collection, 2.455 document, 787.090 byte (0,75 MB)**.
- Số collection hiện chưa làm phát sinh áp lực dung lượng đáng kể. Rủi ro phình
  nằm ở collection tăng liên tục và đang có **0 TTL index**: `interactions`,
  `search_logs`, `chats`, `notifications`, `cart_items`, `push_tokens`.
- Snapshot Atlas giữ đủ collection để validator đối chiếu; file ERD tổng quát
  không phải bản kiểm kê vật lý toàn bộ database.
- `JAPANO_ERD.drawio` là view dùng để trình bày: đúng một trang với 19 bảng logic
  lõi của app, gồm cả hành vi dùng cho máy gợi ý; không vẽ collection hỗ trợ
  hoặc bảng loyalty phụ.

## Những collection không nên tồn tại độc lập sau migration

| Collection hiện tại | Quyết định mục tiêu | Lý do |
|---|---|---|
| `product_details` | Gộp vào `products` | Quan hệ đúng 1:1 (71/71); cắt dọc không đem lại lợi ích truy vấn. |
| `ai_descriptions` | Không persist; cache RAM có hạn hoặc ghi bản đã duyệt vào `products` | Là kết quả Qwen3-VL có thể tạo lại, không phải dữ liệu nghiệp vụ nguồn. |
| `banners` | Nhúng vào document `settings.shop` | Chỉ 3 cấu hình, luôn tải cùng cấu hình trang chủ. Vẫn phải lưu vì Admin có CRUD và mobile hiển thị. |
| `discount_rules` | Nhúng vào `settings.promotionRules` | Chỉ 3 luật cấu hình; không cần collection riêng. |
| `vip_memberships` | Không persist, tính từ `orders` khi cần | `deriveVipMemberships()` đã tính lại hạng VIP theo lịch sử đơn và thời điểm hiện tại. |

Sau migration gộp dữ liệu, mô hình vật lý từng có **29 collection**. Collection
thứ 30 là `japan_spots`, được thêm có chủ đích vì đây là dữ liệu nguồn mà người
dùng nhìn thấy, không phải cache suy luận. Nó lưu 25 document metadata và URL
ảnh; file ảnh không nằm trong MongoDB.

## Vì sao voucher vẫn cần hai collection vật lý

| Collection | Có cần không? | Vai trò |
|---|---|---|
| `vouchers` | Có | Định nghĩa mã, phạm vi chủ sở hữu, giới hạn, hạn dùng và trạng thái. |
| `voucher_redemptions` | Có | Chứng từ chống dùng lại mã, đối chiếu `userId`, `orderId` và số tiền giảm. |
| `discount_rules` | Không cần đứng riêng | Chỉ là cấu hình VIP, chuyển vào `settings`. |

Trong ERD CORE chỉ vẽ `vouchers`. `voucher_redemptions` chỉ xuất hiện trong ERD
vật lý vì đây là chứng từ kỹ thuật/tài chính, không phải phần cần giải thích ở
luồng chính.

## Collection phải giữ nhưng cần giới hạn tăng trưởng

| Collection | Vì sao phải lưu | Hướng kiểm soát |
|---|---|---|
| `interactions` | Recommendation và thống kê hành vi | Raw 90 ngày, tổng hợp trước khi xoá. |
| `search_logs` | Từ khoá hot/không có kết quả | Raw 30 ngày, giữ aggregate theo ngày. |
| `chats` | Ngữ cảnh chatbot theo người dùng | 180 ngày hoặc nút xoá lịch sử. |
| `notifications` | Inbox và trạng thái đã đọc | 30 ngày sau đọc, tối đa 90 ngày chưa đọc. |
| `cart_items` | Đồng bộ giỏ đa thiết bị | Xoá sau 60 ngày không hoạt động. |
| `push_tokens` | Gửi push tới thiết bị | Xoá token invalid/không hoạt động 180 ngày. |

Không tạo TTL trực tiếp trên `createdAt` hiện tại vì dữ liệu đang là number,
trong khi MongoDB TTL cần BSON `Date`. Cần migration `expiresAt: Date` và tách
đường ghi khỏi cơ chế replace toàn state trước.

## Collection được giữ vì có nghiệp vụ thật

- Danh tính: `users`, `addresses`, `profiles`.
- Catalog: `categories`, `products`, `product_variants`, `product_media` (chỉ
  URL/metadata; file thật ở Cloudinary).
- Mua hàng: `cart_items`, `wishlist_items`, `orders`, `order_items`.
- Tài chính: `payments`, `return_requests`, `vouchers`,
  `voucher_redemptions`.
- Nội dung người dùng: `reviews`, `review_reactions`, `japan_spot_reviews`,
  `japan_spot_suggestions`.
- Tính năng đang hiển thị: `notifications`, `push_tokens`, `goals`, `flagcards`,
  `flagcard_collections`.
- Vận hành/mô hình: `interactions`, `search_logs`, `chats`,
  `moderation_samples`, `settings`.

`flagcard_collections` chưa được bỏ: ngoài phần thưởng từ đơn hàng còn có
`admin-grant`, nên không thể tái tạo đầy đủ chỉ từ `orders` như đề xuất cũ.

## Trạng thái thao tác

- Đã kiểm kê và phân loại lại toàn bộ 34 collection.
- Đã gắn nhãn vòng đời ngay trên ERD vật lý để cache/kết quả suy ra không còn
  bị hiểu nhầm là dữ liệu phải giữ vĩnh viễn.
- Chưa xoá collection hoặc document trên Atlas. Migration giảm 34 → 29 phải có
  backup, dry-run, test tương thích và đối chiếu count trước/sau.
