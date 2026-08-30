# Audit lưu trữ MongoDB JAPANO — 2026-08-29

Database: `japano` trên MongoDB Atlas (`mongodb+srv`). Không có URI, username,
password hay token trong tài liệu này.

Nguồn số liệu: `node scripts/atlas_audit.js` (chỉ đọc) →
`docs/database/atlas-schema-snapshot-2026-08-29.json`.

## Xác định database thật

| Kiểm tra | Kết quả |
|---|---|
| `MONGODB_DB` mà backend dùng | `japano` |
| Backend `/api/health` báo | `mongodb`, `collection-first`, connected, db `japano` |
| Script audit đọc cấu hình từ | cùng `.env.server` mà backend dùng |
| MongoDB Compass | **chưa xác minh** — Compass không được cài và không chạy trên máy này |

Compass chỉ là ứng dụng kết nối, không phải nơi chứa dữ liệu. Việc đối chiếu đã
được thực hiện bằng MongoDB Node driver trên **đúng URI mà backend đang dùng**,
nên cluster/database/collection set là cùng một nguồn. Nếu cần bằng chứng từ
Compass UI, phải mở Compass và kiểm tra tay — phiên này không làm được điều đó.

## Trước / sau

| Chỉ số | Trước | Sau | Chênh |
|---|---:|---:|---:|
| Collection | 34 | **29** | −5 |
| Document | 2 476 | 2 122 | −354 |
| `dataSize` | 838 168 B | 622 671 B | −215 497 B |
| `storageSize` | 1 544 192 B | 1 359 872 B | −184 320 B |
| `totalIndexSize` | 3 231 744 B | 2 899 968 B | −331 776 B |
| TTL index | 0 | 0 | 0 |
| Validator | 0 | 0 | 0 |

Chi phí thật của database này nằm ở **index**, không ở dữ liệu: 2,9 MB index so
với 0,6 MB dữ liệu. Nguyên nhân là sàn cấp phát của WiredTiger — mỗi collection
tốn khoảng 36 KB storage và mỗi index thêm khoảng 36 KB, bất kể có bao nhiêu
document. `banners` chỉ chứa 367 byte dữ liệu thật nhưng chiếm khoảng 73 KB.
Vì vậy gộp các collection cấu hình nhỏ tiết kiệm được thật, còn gộp một
collection lớn thì gần như không.

## Bảng quyết định

| Collection | Doc | Storage | Đọc ở đâu | Ghi ở đâu | Người dùng thấy | Suy ra được | Quyết định | Đích | Rủi ro |
|---|---:|---:|---|---|---|---|---|---|---|
| `product_details` | 71 | 53 KB | `hydrateProducts` | không còn ai | không (đã nhúng) | có | **BỎ** | `products` | thấp — Atlas đo 100% products đã có đủ field |
| `banners` | 3 | 37 KB | `/api/banners`, Admin | Admin | **có** | không | **GỘP** | `settings/_id=banners` | trung bình — dữ liệu người vận hành nhập |
| `discount_rules` | 3 | 37 KB | `lib/vip.js` | Admin | gián tiếp | không | **GỘP** | `settings/_id=discount_rules` | trung bình |
| `vip_memberships` | 6 | 37 KB | `reconcileVipState` | ghi đè mỗi `read()` | qua API VIP | **có** | **BỎ** | tính từ `orders` | thấp |
| `ai_descriptions` | 8 | 45 KB | `routes/catalog.js` | catalog AI | mô tả sản phẩm | **có** | **BỎ** | cache RAM | thấp — dựng lại được |
| `voucher_redemptions` | 5 | 37 KB | đối soát | `routes/orders.js` | có | **không** | **GIỮ** | — | chứng từ tiền |
| `flagcard_collections` | 4 | 37 KB | `routes/loyalty.js`, Admin | `lib/flagcards.js` | có | **không** | **GIỮ** | — | có thể chứa quà admin cấp tay |

### Bằng chứng cho từng quyết định bỏ

- **`product_details`** — snapshot Atlas cho thấy `products` đã có
  `description`, `story`, `tags`, `visualTags`, `rating`, `sold`,
  `compareAtPrice` ở mức hiện diện 100 %. `scripts/migrate_lean_collections.js`
  so từng field giữa 71 document `product_details` và 71 document `products`:
  không có khác biệt nào.
- **`vip_memberships`** — `backend/lib/vip.js:224` gán
  `state.vipMemberships = deriveVipMemberships(state, now)`, và
  `reconcileVipState` được gọi trong **mọi** `read()`/`write()` của
  `backend/server.js`. Bản persist luôn bị ghi đè trước khi ai đọc tới. Thử
  nghiệm: xoá sạch `vipMemberships` khỏi state rồi tính lại cho ra đúng 5
  membership. Document thứ 6 trên Atlas là tàn dư đã hết hiệu lực.
- **`ai_descriptions`** — `normalizeState()` đã đặt `aiDescriptions = []`; cache
  thật nằm trong RAM ở `routes/catalog.js`.

### Vì sao hai collection phải giữ

- `voucher_redemptions` là **sổ chứng từ**: mỗi dòng ghi một lượt dùng voucher
  gắn với `orderId` và `userId`. Suy lại từ đơn hàng sẽ mất dấu vết đối soát.
- `flagcard_collections` có thể chứa thẻ do quản trị viên cấp tay, không phát
  sinh từ đơn hàng nào, nên không suy ra được.

## Retention và chi phí

Chưa có TTL index nào. Các collection tăng theo hành vi người dùng:

| Collection | Doc | Document mới nhất | Đề xuất |
|---|---:|---|---|
| `interactions` | 671 | 2026-08-28 | TTL 180 ngày cho sự kiện thô, giữ bản tổng hợp theo ngày |
| `notifications` | 46 | 2026-08-28 | TTL 90 ngày sau khi đã đọc |
| `chats` | 68 | 2026-08-28 | giới hạn số lượt hội thoại giữ lại cho mỗi người |
| `search_logs` | 13 | 2026-08-13 | TTL 90 ngày |
| `cart_items` | 5 | 2026-08-13 | dọn giỏ bỏ quên sau 60 ngày |

**Chưa triển khai TTL trong phiên này.** Tạo TTL index là thao tác ghi lên Atlas
và sẽ tự động xoá dữ liệu người dùng, nên cần quyết định retention rõ ràng
trước. `interactions` còn là đầu vào của bộ gợi ý, nên cắt nó sẽ làm giảm chất
lượng đề xuất — đây là đánh đổi cần người quyết, không phải thao tác kỹ thuật.

Media (ảnh, video) không nằm trong MongoDB: chỉ URL Cloudinary và metadata.

## Sự cố mất dữ liệu trong lúc migration

Đây là phần quan trọng nhất của báo cáo.

`backend/lib/store.js` xác định "database đã chuẩn hoá chưa" bằng
`product_details.countDocuments()`. Sau khi `product_details` bị drop, phép đếm
trả **0** — trùng đúng con số của một database hoàn toàn trống. Boot kết luận
phải seed lại, nạp `backend/data/db.json` và **ghi đè lên Atlas**.

Hậu quả đo được:

| Collection | Trước | Sau khi ghi đè | Trạng thái |
|---|---:|---:|---|
| `products` | 71 | 54 | **đã khôi phục đủ 71** |
| `product_variants` | 497 | 412 | **đã khôi phục đủ 497** |
| `product_media` | 151 | 134 | **đã khôi phục đủ 151** |
| `orders` | 98 | 94 | **mất 4 — không khôi phục được** |
| `payments` | 98 | 94 | **mất 4 — không khôi phục được** |
| `order_items` | 160 | 154 | **mất 6 — không khôi phục được** |
| `interactions` | 898 | 671 | **mất 227 — không khôi phục được** |
| `notifications` | 59 | 46 | **mất 13 — không khôi phục được** |
| `chats` | 74 | 68 | **mất 6 — không khôi phục được** |
| `goals` | 10 | 8 | **mất 2 — không khôi phục được** |
| `return_requests` | 10 | 8 | **mất 2 — không khôi phục được** |
| `wishlist_items` | 15 | 13 | **mất 2 — không khôi phục được** |

Sản phẩm, biến thể và ảnh khôi phục được từ backup migration và từ
`backend/data/japanese-products.json`. 263 document còn lại chỉ tồn tại trên
Atlas — chúng được tạo sau lần đồng bộ `db.json` gần nhất (26-08) — và không có
bản sao cục bộ nào chứa chúng: `db.json`, `db.json.pre-fallback-2026-08-16`,
`db.json.truoc-khi-dong-bo` và `backup/db.json.bak-20260821` đều chỉ có 94 đơn.
Đường khôi phục còn lại duy nhất là snapshot phía Atlas, nếu gói dịch vụ của
cluster có bật sao lưu.

Nguyên nhân gốc đã được vá và khoá bằng test:

- `backend/lib/mongoCollections.js` ghi dấu mốc tường minh
  `settings/_id=storage_schema`, và `hasNormalizedStorage()` trả lời câu hỏi
  "đã chuẩn hoá chưa" bằng dấu mốc đó, có đường lùi là "có sản phẩm nào không".
- `backend/lib/store.js` kiểm lại một lần nữa ngay trước khi seed: nếu database
  đã có sản phẩm mà thiếu dấu mốc thì **dừng boot** thay vì ghi đè.
- `backend/test/storage-schema-marker.test.js` giữ đúng tình huống đó.

Backup migration của phiên này chỉ phủ 5 collection nguồn + `products` +
`settings`. Đó là thiếu sót: một migration chạm vào đường ghi toàn cục phải sao
lưu **toàn bộ** database, không chỉ những collection dự định sửa.

## Lỗi thứ hai đã sửa: thứ tự ghi làm treo backend

`replaceCollection()` upsert trước rồi mới xoá document thừa. Khi quy ước sinh
`_id` của biến thể đổi (`variant-jp1-0` → `variant-jp1-JP001-DEF-S`), bản mới
đụng unique index `uq_product_variants_selection` của bản cũ — thứ đằng nào cũng
sắp bị xoá ở dòng kế tiếp — và E11000 làm hỏng cả lượt ghi, khiến backend khởi
động mà không bao giờ mở cổng 4100.

Đã đổi thành xoá trước, upsert sau, và dùng `ordered: false`.
Test: `backend/test/replace-collection-order.test.js`.

## Lỗi thứ ba đã sửa: banner biến mất khỏi ứng dụng

`serializeState()` đã ngừng ghi `banners`/`discountRules` nhưng chưa nhúng chúng
vào đâu cả. Round-trip đo được: banners 3 → **0**, discountRules 3 → 1. Trên
backend đang chạy, `GET /api/banners` trả `[]`.

Đã nhúng vào `settings` kèm dual-read cho database chưa migrate. Sau khi sửa,
`GET /api/banners` trả lại đủ 3 banner.
Test: `backend/test/lean-schema-roundtrip.test.js`.
