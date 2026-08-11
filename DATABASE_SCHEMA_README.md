# JAPANO — MongoDB Schema README (để dựng lại ERD)
Tài liệu này mô tả **toàn bộ database MongoDB thật** của backend JAPANO, dựng trực tiếp từ code đang chạy (`backend/seed.js`, `backend/lib/store.js`, toàn bộ `backend/routes/*.js` + `backend/lib/*.js`) và đối chiếu với dữ liệu sống `backend/data/db.json`. Đưa nguyên file này cho ChatGPT (hoặc bất kỳ AI nào) kèm yêu cầu "vẽ ERD từ tài liệu này" là đủ dữ liệu để vẽ đúng — không cần đọc lại source code.
## 0. Kiến trúc lưu trữ thật (đọc trước khi vẽ)
- Toàn bộ app đọc/ghi vào **1 document Mongo duy nhất**: collection `app_state`, `_id: "main"`.
- Sau mỗi lần ghi, store tự nhân bản (debounce 250ms) từng mảng cấp cao trong document đó thành **1 collection Mongo riêng** để admin xem bằng Compass. Danh sách bảng ở mục 2 dưới đây **chính là 29 collection chiếu (projection) đó + 1 collection `settings` (3 document cấu hình) + 1 collection `_runtime_metadata`** — tổng cộng những gì thực sự nằm trong MongoDB Compass.
- Vì vậy đây **không phải** một database SQL chuẩn hoá — nhiều bảng ở đây là **mảng nhúng (embedded array)** bên trong document cha (vd `products.variants[]`, `orders.items[]`) chứ không phải bảng riêng có FK thật. MongoDB **không ép buộc** khoá ngoại — mọi quan hệ liệt kê ở mục 3 đều là quan hệ NGHIỆP VỤ do code tự giữ nhất quán, không phải constraint của DB.
- **3 quy ước ngầm cần biết khi đọc bảng field bên dưới:**
  1. **`productId` ở MỌI bảng khác lưu `products.slug`**, không phải `products.id`. `products.id` gần như không ai tham chiếu.
  2. **`userId` = chuỗi `"guest"`** ở nhiều bảng (interactions, search_logs, chats, tryon_history, goals) khi khách chưa đăng nhập — đây KHÔNG phải id của 1 user thật, đừng coi là FK bắt buộc trỏ đúng document.
  3. Nhiều bảng **không có field `id`** — khoá chính là 1 field tự nhiên khác: `vouchers.code`, `push_tokens.token`, `carts` (tổ hợp `userId+productId+color+size`), `profiles`/`ai_descriptions`/`flagcard_collections` dùng `userId`/`productId` làm khoá chính.
## 1. Chú giải cột trong các bảng field bên dưới
| Cột | Ý nghĩa |
|---|---|
| **Field** | Tên field THẬT trong document Mongo (camelCase, copy nguyên từ code) |
| **Type** | Kiểu dữ liệu: `string`,`number`,`boolean`,`array`,`object`,`date`; hậu tố `?` = có thể null/không tồn tại |
| **Key** | `PK` = khoá chính · `FK` = tham chiếu sang collection khác · `PK, FK` = vừa là 1 phần khoá chính vừa tham chiếu (khoá gộp) · rỗng = field thường |
## 2. Toàn bộ 32 collection + field
### Nhóm A — Nội dung tĩnh / cấu hình / vệ tinh của Products (không có hub riêng)
#### `categories`
*State field:* `categories` — 5 danh mục sản phẩm cố định (áo truyền thống, haori, trang phục, phụ kiện, cosplay).
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `name` | string |  |
| `kanji` | string |  |
#### `ai_descriptions`
*State field:* `aiDescriptions` — Cache mô tả sản phẩm do AI thị giác (Qwen3-VL) sinh khi khách xem chi tiết — tránh gọi lại model tốn GPU.
| Field | Type | Key |
|---|---|---|
| `productId` | string | PK, FK |
| `generatedAt` | number |  |
| `description` | object |  |
#### `flagcards`
*State field:* `flagcards` — 7 thẻ địa danh Nhật Bản để khách sưu tầm — nội dung TĨNH do biên tập soạn sẵn, không phải dữ liệu người dùng.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `recommendedProductIds` | array | FK1 |
| `order` | number |  |
| `glyph` | string |  |
| `accent` | string |  |
| `title` | string |  |
| `japanese` | string |  |
| `region` | string |  |
| `summary` | string |  |
| `formationHistory` | string |  |
| `legend` | string |  |
| `funFacts` | array |  |
| `checkins` | array |  |
| `outfit` | object |  |
| `sourceUrl` | string |  |
| `active` | boolean |  |
#### `flagcard_collections`
*State field:* `flagcardCollections` — Bộ sưu tập thẻ của từng khách — gom đủ bộ thì tự sinh 1 voucher thưởng.
| Field | Type | Key |
|---|---|---|
| `userId` | string | PK, FK |
| `cardIds` | array | FK1 |
| `id` | string |  |
| `awards` | array |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
#### `banners`
*State field:* `banners` — Băng-rôn khuyến mãi trang chủ — độc lập, không tham chiếu bảng nào khác.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `title` | string |  |
| `img` | string |  |
| `link` | string |  |
| `active` | boolean |  |
| `order` | number |  |
#### `app_state`
*State field:* `—` — Document Mongo gốc — TOÀN BỘ state ứng dụng nằm trong 1 document duy nhất, _id cố định "main". Đây là nguồn ghi thật; 29 collection theo thực thể bên dưới chỉ là bản chiếu (projection) tự động đồng bộ mỗi 250ms để xem trong Compass, không phải bảng độc lập kiểu SQL.
| Field | Type | Key |
|---|---|---|
| `_id` | string | PK |
| `seeded` | boolean |  |
| `schemaVersion` | number |  |
| `shop` | object |  |
| `integrations` | object |  |
| `categories` | array |  |
| `products` | array |  |
| `orders` | array |  |
| `payments` | array |  |
| `returnRequests` | array |  |
| `carts` | array |  |
| `reviews` | array |  |
| `reviewReactions` | array |  |
| `moderationSamples` | array |  |
| `users` | array |  |
| `addresses` | array |  |
| `wishlists` | array |  |
| `notifications` | array |  |
| `vouchers` | array |  |
| `flagcards` | array |  |
| `flagcardCollections` | array |  |
| `vipMemberships` | array |  |
| `flagcardConfig` | object |  |
| `voucherRedemptions` | array |  |
| `banners` | array |  |
| `interactions` | array |  |
| `searchLogs` | array |  |
| `pushTokens` | array |  |
| `profiles` | array |  |
| `chats` | array |  |
| `tryonHistory` | array |  |
| `goals` | array |  |
| `aiDescriptions` | array |  |
| `japanSpotReviews` | array |  |
| `japanSpotSuggestions` | array |  |
| `_updatedAt` | date |  |
#### `settings (3 document con)`
*State field:* `shop + integrations + flagcardConfig` — KHÔNG phải 1 bảng dữ liệu người dùng — là 3 document CẤU HÌNH đơn (singleton) nằm CHUNG 1 collection Mongo tên "settings", phân biệt bằng _id ("shop"/"integrations"/"flagcardConfig").
| Field | Type | Key |
|---|---|---|
| `_id` | string | PK |
| `name` | string |  |
| `hotline` | string |  |
| `email` | string |  |
| `address` | string |  |
| `shipFee` | number |  |
| `cod` | boolean |  |
| `stripe` | boolean |  |
| `vnpay` | boolean |  |
| `logo` | null |  |
| `mongo` | boolean |  |
| `cloudinary` | boolean |  |
| `ai` | boolean |  |
| `active` | boolean |  |
| `qualifyingOrderMin` | number |  |
| `requiredCards` | number |  |
| `rewardPercent` | number |  |
| `rewardVoucherMinOrder` | number |  |
| `rewardValidityDays` | number |  |
#### `_runtime_metadata`
*State field:* `—` — Log nội bộ 1 document — ghi lại lần đồng bộ Mongo gần nhất, không phải dữ liệu nghiệp vụ.
| Field | Type | Key |
|---|---|---|
| `_id` | string | PK |
| `source` | string |  |
| `syncedAt` | date |  |
| `collections` | array |  |
### Nhóm B — PRODUCTS (hub)
#### `products`
*State field:* `products` — Sản phẩm bán trong shop. Nhúng thẳng biến thể (variants: màu/size/tồn kho) và toàn bộ ảnh/video — KHÔNG có bảng ProductVariants/Colors/Sizes/Images tách riêng như SQL.
| Field | Type | Key |
|---|---|---|
| `slug` | string | PK |
| `ownerId` | string | FK1 |
| `cat` | string | FK2 |
| `id` | string |  |
| `name` | string |  |
| `kanji` | string |  |
| `sku` | string |  |
| `category` | string |  |
| `brand` | string |  |
| `price` | number |  |
| `old` | number? |  |
| `sale` | null |  |
| `status` | string |  |
| `colorHex` | string |  |
| `rating` | number |  |
| `sold` | number |  |
| `tags` | array |  |
| `visualTags` | array |  |
| `desc` | string |  |
| `story` | string |  |
| `image` | string |  |
| `images` | array |  |
| `variants` | array |  |
| `createdAt` | number |  |
| `videos` | array |  |
| `discountPercent` | number |  |
### Nhóm C — Vệ tinh dùng chung Users + Products
#### `carts`
*State field:* `carts` — Giỏ hàng — mỗi DÒNG là 1 sản phẩm/màu/size của 1 user (không phải 1 document/giỏ chứa mảng items). Khoá là tổ hợp 4 field, KHÔNG có field id.
| Field | Type | Key |
|---|---|---|
| `userId` | string | PK, FK |
| `productId` | string | PK, FK |
| `color` | string | PK |
| `size` | string | PK |
| `quantity` | number |  |
| `updatedAt` | number |  |
#### `wishlists`
*State field:* `wishlists` — Danh sách yêu thích — mỗi dòng là 1 cặp (user, sản phẩm).
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `productSlug` | string | FK2 |
| `createdAt` | number |  |
#### `interactions`
*State field:* `interactions` — Nhật ký hành vi thô (xem/thích/giỏ/mua/thử đồ/chat...) — nuôi engine gợi ý collaborative-filtering + content-based.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `productId` | string | FK2 |
| `type` | string |  |
| `createdAt` | number |  |
| `source` | string |  |
| `value` | number |  |
| `metadata` | object |  |
#### `chats`
*State field:* `chats` — Lịch sử hội thoại thật với chatbot "Ori" — role user/assistant, có thể kèm sản phẩm AI gợi ý.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `productIds` | array | FK2 |
| `role` | string |  |
| `message` | string |  |
| `createdAt` | number |  |
| `engine` | string |  |
| `intent` | string |  |
| `confidence` | number |  |
| `modelTrace` | object |  |
| `generationModel` | string |  |
| `latencyMs` | number |  |
| `fallbackReason` | string |  |
#### `tryon_history`
*State field:* `tryonHistory` — Nhật ký các lượt thử đồ ảo bằng AI (không lưu ảnh kết quả, chỉ lưu metadata).
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `productId` | string | FK2 |
| `accessoryIds` | array |  |
| `engine` | string |  |
| `createdAt` | number |  |
#### `goals`
*State field:* `goals` — Mục tiêu mua sắm + kế hoạch tiết kiệm — thuật toán tài chính tính số, AI chỉ diễn đạt lời động viên.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `productId` | string | FK2 |
| `product` | object |  |
| `input` | object |  |
| `plan` | object |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
### Nhóm D — USERS (hub)
#### `users`
*State field:* `users` — Tài khoản — bcrypt + JWT thật. Là bảng trung tâm, gần như mọi collection khác đều có userId trỏ về đây.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `name` | string |  |
| `email` | string |  |
| `role` | string |  |
| `status` | string |  |
| `orders` | number |  |
| `spent` | number |  |
| `tryons` | number |  |
| `vip` | string |  |
| `joinedAt` | number |  |
| `vipMembership` | object |  |
| `passwordHash` | string |  |
| `stripeCustomerId` | string |  |
### Nhóm E — Vệ tinh dùng chung Users + Orders
#### `payments`
*State field:* `payments` — Giao dịch thanh toán — CHỈ tồn tại cho đơn trả online (Stripe/VNPay); đơn COD không có dòng nào ở đây.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `orderId` | string | FK1 |
| `userId` | string | FK2 |
| `code` | string |  |
| `orderCode` | string |  |
| `provider` | string |  |
| `method` | string |  |
| `status` | string |  |
| `amount` | number |  |
| `currency` | string |  |
| `transactionCode` | string |  |
| `paymentIntentId` | string |  |
| `checkoutSessionId` | string |  |
| `refundable` | boolean |  |
| `refunds` | array |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
| `originalAmount` | number |  |
| `discount` | number |  |
| `voucherDiscount` | number |  |
| `paymentDiscount` | number |  |
| `promotionCode` | string |  |
| `amountSubtotal` | number |  |
| `paidAt` | number |  |
| `chargeId` | string |  |
| `receiptUrl` | string |  |
| `paymentMethodType` | string |  |
| `customer` | object |  |
| `card` | object |  |
| `refundedAmount` | number |  |
| `pendingRefundAmount` | number |  |
| `refundId` | string |  |
| `refundedAt` | number |  |
| `failureReason` | string |  |
| `intentStatus` | string |  |
| `nativeAttempt` | number |  |
| `vnpCreateDate` | string |  |
| `vnpTransactionNo` | string |  |
| `vnpBankCode` | string |  |
| `vnpCardType` | string |  |
| `vnpPayDate` | string |  |
| `vipDiscount` | number |  |
| `vipPromotion` | null |  |
#### `return_requests`
*State field:* `returnRequests` — Yêu cầu huỷ đơn (trước giao) hoặc trả hàng (sau giao) — gộp chung 1 bảng, phân biệt bằng field kind.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `orderId` | string | FK1 |
| `userId` | string | FK2 |
| `paymentId` | string | FK3 |
| `code` | string |  |
| `orderCode` | string |  |
| `paymentCode` | string |  |
| `status` | string |  |
| `reason` | string |  |
| `note` | string |  |
| `items` | array |  |
| `amount` | number |  |
| `currency` | string |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
| `timeline` | array |  |
| `adminNote` | string |  |
| `refundId` | string |  |
| `refundStatus` | string |  |
| `kind` | string |  |
| `photos` | array |  |
#### `vouchers`
*State field:* `vouchers` — Mã giảm giá — gồm mã chung toàn shop và mã cá nhân (thưởng/đền bù). KHÔNG có field id — khoá chính là code.
| Field | Type | Key |
|---|---|---|
| `code` | string | PK |
| `ownerUserId` | string | FK1 |
| `issuedBy` | string | FK2 |
| `type` | string |  |
| `value` | number |  |
| `min` | number |  |
| `expiry` | string |  |
| `limit` | number |  |
| `used` | number |  |
| `active` | boolean |  |
| `source` | string |  |
| `reason` | string |  |
| `issuedAt` | number |  |
#### `voucher_redemptions`
*State field:* `voucherRedemptions` — Nhật ký mỗi lần 1 voucher thực sự được áp dụng vào 1 đơn.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `orderId` | string | FK2 |
| `code` | string | FK3 |
| `discount` | number |  |
| `redeemedAt` | number |  |
#### `reviews`
*State field:* `reviews` — Đánh giá sản phẩm — chỉ khách có đơn "completed" chứa đúng sản phẩm mới được viết, đã qua kiểm duyệt AI.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `productId` | string | FK1 |
| `userId` | string | FK2 |
| `orderId` | string | FK3 |
| `userName` | string |  |
| `orderCode` | string |  |
| `rating` | number |  |
| `comment` | string |  |
| `media` | null |  |
| `status` | string |  |
| `moderation` | object |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
| `adminNote` | string |  |
| `moderatedAt` | number |  |
#### `review_reactions`
*State field:* `reviewReactions` — Lượt "hữu ích/không hữu ích" cho từng review.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `reviewId` | string | FK1 |
| `userId` | string | FK2 |
| `value` | string |  |
| `updatedAt` | number |  |
#### `moderation_samples`
*State field:* `moderationSamples` — "Bộ nhớ học" của bộ lọc kiểm duyệt AI — mỗi lần nội dung bị chặn, cụm từ được lưu lại để nhận diện nhanh hơn lần sau.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `reviewId` | null | FK1 |
| `label` | string |  |
| `normalizedText` | string |  |
| `learnedPhrases` | array |  |
| `source` | string |  |
| `updatedAt` | number |  |
#### `vip_memberships`
*State field:* `vipMemberships` — Hạng VIP — KHÔNG phải dữ liệu tự nhập, được TÍNH LẠI (derive) từ lịch sử orders mỗi lần gọi API rồi mới cache vào đây.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `qualifyingOrderIds` | array | FK2 |
| `qualifyingPeriod` | string |  |
| `qualifiedSpend` | number |  |
| `threshold` | number |  |
| `discountPercent` | number |  |
| `discountedUnitsPerOrder` | number |  |
| `startedAt` | number |  |
| `expiresAt` | number |  |
| `status` | string |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
### Nhóm F — ORDERS (hub)
#### `orders`
*State field:* `orders` — Đơn hàng — thực thể trung tâm, nhúng sản phẩm (items[]), thông tin khách, thanh toán rút gọn, lịch sử trạng thái ngay trong document, KHÔNG tách bảng OrderItems.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `discountCode` | string | FK2 |
| `items` | array | FK3 |
| `code` | string |  |
| `customer` | object |  |
| `address` | string |  |
| `total` | number |  |
| `ship` | number |  |
| `payment` | object |  |
| `status` | string |  |
| `createdAt` | number |  |
| `history` | array |  |
| `source` | string |  |
| `subtotal` | number |  |
| `discount` | number |  |
| `flagcardAward` | object |  |
| `voucherDiscount` | number |  |
| `paymentDiscount` | number |  |
| `paymentPromotion` | object? |  |
| `completedAt` | number |  |
| `returnStatus` | string |  |
| `returnRequest` | object |  |
| `addressDetails` | object |  |
| `voucherRedemption` | object |  |
| `clientRequestId` | string? |  |
| `vipDiscount` | number |  |
| `vipPromotion` | null |  |
### Nhóm G — Vệ tinh chỉ thuộc Users
#### `profiles`
*State field:* `profiles` — Hồ sơ phong cách cá nhân — tín hiệu content-based cho engine gợi ý khi user còn mới (cold-start).
| Field | Type | Key |
|---|---|---|
| `userId` | string | PK, FK |
| `gender` | string |  |
| `preferredStyles` | array |  |
| `skinTone` | string |  |
| `occasion` | string |  |
| `budget` | number |  |
| `heightCm` | number |  |
| `weightKg` | number |  |
| `usualSize` | string |  |
| `updatedAt` | number |  |
#### `addresses`
*State field:* `addresses` — Sổ địa chỉ giao hàng, nhiều địa chỉ/khách, đồng bộ đa thiết bị.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `title` | string |  |
| `name` | string |  |
| `phone` | string |  |
| `street` | string |  |
| `wardCode` | string |  |
| `ward` | string |  |
| `provinceCode` | string |  |
| `province` | string |  |
| `isDefault` | boolean |  |
| `createdAt` | number |  |
| `updatedAt` | number |  |
#### `notifications`
*State field:* `notifications` — Thông báo trong app — riêng 1 khách (userId có giá trị) hoặc broadcast toàn bộ (userId = null).
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string? | FK1 |
| `title` | string |  |
| `body` | string |  |
| `type` | string |  |
| `action` | string |  |
| `reach` | number |  |
| `at` | number |  |
#### `push_tokens`
*State field:* `pushTokens` — Token thiết bị đã đăng ký nhận Expo Push. KHÔNG có field id — khoá chính là token.
| Field | Type | Key |
|---|---|---|
| `token` | string | PK |
| `userId` | string | FK1 |
| `platform` | string |  |
| `createdAt` | number |  |
#### `search_logs`
*State field:* `searchLogs` — Nhật ký mọi lượt tìm kiếm kể cả 0 kết quả — nuôi báo cáo "search intelligence" cho admin.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `query` | string |  |
| `resultCount` | number |  |
| `createdAt` | number |  |
#### `japan_spot_reviews`
*State field:* `japanSpotReviews` — Đánh giá địa điểm trong mục "Khám phá Nhật Bản" — không cần từng mua hàng, vẫn qua kiểm duyệt AI chung với review sản phẩm.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `place` | string |  |
| `prefecture` | string |  |
| `userName` | string |  |
| `rating` | number |  |
| `comment` | string |  |
| `createdAt` | number |  |
| `media` | null |  |
| `status` | string |  |
| `moderation` | object |  |
#### `japan_spot_suggestions`
*State field:* `japanSpotSuggestions` — Gợi ý địa điểm mới do khách đề xuất, admin duyệt thủ công.
| Field | Type | Key |
|---|---|---|
| `id` | string | PK |
| `userId` | string | FK1 |
| `prefecture` | string |  |
| `userName` | string |  |
| `suggestion` | string |  |
| `status` | string |  |
| `moderation` | object |  |
| `createdAt` | number |  |
## 3. Toàn bộ 46 quan hệ (dây nối ERD)
Cột **Cardinality** đọc là *[bảng A] — [bảng B]*. `?` sau tên field/bảng ở cột ghi chú nghĩa là FK đó cho phép null (vẽ đầu dây phía đó bằng ký hiệu "0 hoặc 1" thay vì "bắt buộc 1").

| # | Từ (field) | Đến (bảng.field) | Cardinality | Ghi chú |
|---|---|---|---|---|
| 1 | `products.cat` | `categories.id` | N — 1 |  |
| 2 | `carts.userId` | `users.id` | N — 1 |  |
| 3 | `carts.productId` | `products.slug` | N — 1 |  |
| 4 | `wishlists.userId` | `users.id` | N — 1 |  |
| 5 | `wishlists.productSlug` | `products.slug` | N — 1 |  |
| 6 | `orders.userId` | `users.id` | N — 1 |  |
| 7 | `orders.items` | `products.slug` | N — M |  |
| 8 | `orders.discountCode` | `vouchers.code` | N — 1 |  |
| 9 | `payments.orderId` | `orders.id` | 1 — 1 |  |
| 10 | `payments.userId` | `users.id` | N — 1 |  |
| 11 | `return_requests.orderId` | `orders.id` | N — 1 |  |
| 12 | `return_requests.paymentId` | `payments.id` | N — 1 | FK có thể null/rỗng |
| 13 | `return_requests.userId` | `users.id` | N — 1 |  |
| 14 | `voucher_redemptions.code` | `vouchers.code` | N — 1 |  |
| 15 | `voucher_redemptions.userId` | `users.id` | N — 1 |  |
| 16 | `voucher_redemptions.orderId` | `orders.id` | 1 — 1 |  |
| 17 | `reviews.productId` | `products.slug` | N — 1 |  |
| 18 | `reviews.userId` | `users.id` | N — 1 |  |
| 19 | `reviews.orderId` | `orders.id` | N — 1 |  |
| 20 | `review_reactions.reviewId` | `reviews.id` | N — 1 |  |
| 21 | `review_reactions.userId` | `users.id` | N — 1 |  |
| 22 | `addresses.userId` | `users.id` | N — 1 |  |
| 23 | `profiles.userId` | `users.id` | 1 — 1 |  |
| 24 | `notifications.userId` | `users.id` | N — 1 | FK có thể null/rỗng |
| 25 | `push_tokens.userId` | `users.id` | N — 1 |  |
| 26 | `interactions.userId` | `users.id` | N — 1 |  |
| 27 | `search_logs.userId` | `users.id` | N — 1 |  |
| 28 | `chats.userId` | `users.id` | N — 1 |  |
| 29 | `tryon_history.userId` | `users.id` | N — 1 |  |
| 30 | `goals.userId` | `users.id` | N — 1 |  |
| 31 | `flagcard_collections.cardIds` | `flagcards.id` | N — M |  |
| 32 | `vip_memberships.userId` | `users.id` | N — 1 |  |
| 33 | `japan_spot_reviews.userId` | `users.id` | N — 1 |  |
| 34 | `japan_spot_suggestions.userId` | `users.id` | N — 1 |  |
| 35 | `moderation_samples.reviewId` | `reviews.id` | N — 1 | FK có thể null/rỗng |
| 36 | `products.ownerId` | `users.id` | N — 1 | FK có thể null/rỗng |
| 37 | `vouchers.ownerUserId` | `users.id` | N — 1 | FK có thể null/rỗng |
| 38 | `vouchers.issuedBy` | `users.id` | N — 1 | FK có thể null/rỗng |
| 39 | `interactions.productId` | `products.slug` | N — 1 |  |
| 40 | `tryon_history.productId` | `products.slug` | N — 1 |  |
| 41 | `goals.productId` | `products.slug` | N — 1 |  |
| 42 | `chats.productIds` | `products.slug` | N — M |  |
| 43 | `ai_descriptions.productId` | `products.slug` | 1 — 1 |  |
| 44 | `flagcard_collections.userId` | `users.id` | 1 — 1 |  |
| 45 | `vip_memberships.qualifyingOrderIds` | `orders.id` | N — M |  |
| 46 | `flagcards.recommendedProductIds` | `products.slug` | N — M |  |

## 4. Quy ước vẽ ERD (đã chốt qua nhiều lần chỉnh, làm đúng luôn từ đầu)

Nếu mục đích của file này là dựng lại sơ đồ (drawio hoặc công cụ khác), dùng đúng các quy ước sau — đây là kết quả sau nhiều vòng chỉnh sửa, không phải gợi ý tuỳ chọn:

**Màu sắc / hình khối**
- Chỉ đen — trắng — xám. KHÔNG tô màu theo nhóm bảng, không màu mè trang trí.
- Mỗi bảng = 1 khối chữ nhật góc vuông (không bo tròn), không đổ bóng.
- Header bảng: nền xám nhạt (`#F5F5F5`), viền đen, chữ đen đậm, **CANH GIỮA**, tên bảng viết **HOA** (đúng tên collection Mongo, vd `PRODUCTS`, `FLAGCARD_COLLECTIONS`).
- Mỗi field = 1 dòng riêng, nền trắng, viền đen mảnh (1px), 2 cột tách nhau bằng 1 gạch dọc:
  - Cột trái hẹp: nhãn khoá (`PK` / `FK1`,`FK2`,`FK3`... / `PK, FK` / để trống).
  - Cột phải: tên field (font monospace).
- **Không** vẽ thêm cột kiểu dữ liệu, không ghi số document, không ghi mô tả trong sơ đồ — những thứ đó để trong file README này, sơ đồ chỉ cần cấu trúc.

**Chữ trong ô field (rất quan trọng, đã bị chê "kì cục" khi làm sai)**
- Field là **PK** (hoặc `PK, FK`): tên field **in đậm + gạch chân**.
- Field là **FK-only**: tên field **in đậm**, KHÔNG gạch chân, và **đánh số thứ tự FK1/FK2/FK3...** trong từng bảng (không lặp lại chữ "FK" trơn).
- Field thường: chữ thường, không đậm.
- Thứ tự field trong bảng: **PK trước → tất cả FK gom liền 1 khối ngay sau → rồi mới đến field thường** (không xen kẽ).

**Dây nối quan hệ**
- Đường liền nét (không đứt nét), màu đen, không tô nền nhãn.
- **Không ghi chữ/label gì trên dây cả** — dây phải nối chính xác từ **đúng ô field FK** (bảng con) sang **đúng ô field PK** (bảng cha), không nối vào cả khối bảng chung chung. Nối đúng ô rồi thì không cần chữ giải thích trên dây nữa.
- Ký hiệu ERD chuẩn (crow's foot), theo bảng Cardinality ở mục 3:
  - `N — 1`: đầu N = chân gà (many), đầu 1 = gạch ngang đơn (one, bắt buộc).
  - `1 — 1`: cả 2 đầu là gạch ngang đơn.
  - `N — M`: cả 2 đầu là chân gà.
  - Dòng có ghi chú "FK có thể null/rỗng" ở mục 3: đầu phía bảng cha (PK) vẽ thêm **vòng tròn "0"** trước gạch ngang (ký hiệu "zero-or-one") thay vì gạch đơn thường, vì phía con không bắt buộc phải có tham chiếu.

**Bố cục (giảm dây chồng chéo)**
- 3 bảng bị tham chiếu nhiều nhất là **`users`** (~20 quan hệ), **`products`** (~10), **`orders`** (~7) — coi đây là 3 "hub", mỗi hub nên đứng riêng 1 cột/khu vực.
- Bảng nào cần tham chiếu tới **2 hub cùng lúc** (vd `carts` cần cả `users` lẫn `products`; `payments`,`vouchers`,`reviews`... cần cả `users` lẫn `orders`) thì đặt **NẰM GIỮA** 2 hub đó — dây tới cả 2 phía đều ngắn.
- Bảng chỉ liên quan 1 hub duy nhất, hoặc hoàn toàn không có quan hệ nào (`banners`, `settings`, `_runtime_metadata`, `app_state`), xếp ra rìa ngoài cùng — vị trí của chúng không ảnh hưởng đến độ rối của sơ đồ.
- Chừa khoảng cách rộng giữa các cột/hàng để dây có chỗ đi vòng, tránh cắt ngang thân bảng khác. Với 1 hub bị tham chiếu 15-20 lần, KHÔNG thể làm hết 100% dây thẳng không giao nhau trong 1 sơ đồ tĩnh 2D — đây là giới hạn thật, không phải làm ẩu.

## 5. Cách dùng file này

Đưa nguyên file này cho AI khác kèm yêu cầu, ví dụ: *"Dựng ERD MongoDB từ README này, làm đúng theo mục 4 (quy ước vẽ)."* Toàn bộ field, khoá chính/khoá ngoại, 46 quan hệ và cardinality đã được đối chiếu 2 chiều với source code thật (mỗi field có FK đều có đúng 1 dòng quan hệ tương ứng ở mục 3, và ngược lại) — không cần yêu cầu AI tự đọc lại code hay tự đoán quan hệ.
