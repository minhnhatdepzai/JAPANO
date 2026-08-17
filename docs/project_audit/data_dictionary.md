# Từ điển dữ liệu (Data Dictionary)

> Sinh tự động từ `backend/data/db.json` bằng `backend/scripts/generate-data-dictionary.js`.
> Cột **Bắt buộc** nghĩa là trường có mặt ở 100% bản ghi hiện có; cột **Duy nhất** là suy ra
> từ dữ liệu thật, không phải ràng buộc do cơ sở dữ liệu áp đặt — MongoDB chỉ ép duy nhất ở
> những trường có khai báo chỉ mục unique trong `ensureMongoIndexes()`.

Thời điểm sinh: 2026-08-16T15:57:18.887Z

## Tổng quan

| Collection | Khoá trong state | Số bản ghi |
|---|---|---:|
| `interactions` | `interactions` | 668 |
| `orders` | `orders` | 94 |
| `payments` | `payments` | 94 |
| `review_reactions` | `reviewReactions` | 88 |
| `tryon_history` | `tryonHistory` | 73 |
| `chats` | `chats` | 68 |
| `notifications` | `notifications` | 46 |
| `users` | `users` | 36 |
| `products` | `products` | 35 |
| `reviews` | `reviews` | 31 |
| `wishlist_items` | `wishlists` | 13 |
| `search_logs` | `searchLogs` | 13 |
| `profiles` | `profiles` | 12 |
| `addresses` | `addresses` | 11 |
| `ai_descriptions` | `aiDescriptions` | 10 |
| `return_requests` | `returnRequests` | 8 |
| `goals` | `goals` | 8 |
| `flagcards` | `flagcards` | 7 |
| `moderation_samples` | `moderationSamples` | 6 |
| `categories` | `categories` | 5 |
| `cart_items` | `carts` | 5 |
| `voucher_redemptions` | `voucherRedemptions` | 5 |
| `vip_memberships` | `vipMemberships` | 5 |
| `japan_spot_reviews` | `japanSpotReviews` | 5 |
| `japan_spot_suggestions` | `japanSpotSuggestions` | 5 |
| `vouchers` | `vouchers` | 4 |
| `flagcard_collections` | `flagcardCollections` | 4 |
| `push_tokens` | `pushTokens` | 4 |
| `discount_rules` | `discountRules` | 3 |
| `banners` | `banners` | 3 |

> Ngoài các collection trên, hệ thống còn tách `product_details`, `product_variants`
> và `product_media` từ mảng `products` khi ghi xuống MongoDB, cùng `order_items`
> tách từ `orders.items`, và `settings` lưu cấu hình cửa hàng.

## `categories`

Số bản ghi: **5**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | phu-kien |
| `name` | chuỗi | ✔ | ✔ | 100% |  | Phụ kiện |
| `kanji` | chuỗi | ✔ | ✔ | 100% |  | 小物 |

## `products`

Số bản ghi: **35**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | p4 |
| `slug` | chuỗi | ✔ | ✔ | 100% | products (theo slug) | cardigan-dai |
| `name` | chuỗi | ✔ | ✔ | 100% |  | Áo len khoác dáng dài |
| `sku` | chuỗi | ✔ | ✔ | 100% |  | CARDIGA |
| `brand` | chuỗi | ✔ |  | 100% |  | JAPANO |
| `price` | số nguyên | ✔ |  | 100% |  | 890000 |
| `status` | chuỗi | ✔ |  | 100% |  | published |
| `cat` | chuỗi | ✔ |  | 100% |  | haori |
| `category` | chuỗi | ✔ |  | 100% |  | haori |
| `discountPercent` | số nguyên | ✔ |  | 100% |  | 18 |
| `desc` | chuỗi | ✔ | ✔ | 100% |  | Sản phẩm Cardigan len dáng dài … |
| `story` | chuỗi | ✔ | ✔ | 100% |  | Thiết kế Cardigan len dáng dài … |
| `colorHex` | chuỗi | ✔ |  | 100% |  | #6B7255 |
| `tags` | mảng | ✔ |  | 100% |  | [3 phần tử] |
| `visualTags` | mảng | ✔ |  | 100% |  | [3 phần tử] |
| `rating` | số thực / số nguyên | ✔ |  | 100% |  | 4.7 |
| `sold` | số nguyên | ✔ |  | 100% |  | 54 |
| `variants` | mảng | ✔ |  | 100% |  | [11 phần tử] |
| `images` | mảng | ✔ |  | 100% |  | [4 phần tử] |
| `image` | chuỗi | ✔ | ✔ | 100% |  | https://res.cloudinary.com/dc6k… |
| `videos` | mảng | ✔ |  | 100% |  | [0 phần tử] |
| `kanji` | chuỗi |  |  | 97% |  | 羽織 |
| `createdAt` | số nguyên |  |  | 97% |  | 1783402572477 |
| `old` | số nguyên |  |  | 40% |  | 1090000 |
| `updatedAt` | số nguyên |  |  | 3% |  | 1786448518918 |
| `sale` | — |  |  | 0% |  |  |

## `users`

Số bản ghi: **36**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | u10 |
| `name` | chuỗi | ✔ |  | 100% |  | Lý Cẩm Tú |
| `email` | chuỗi | ✔ | ✔ | 100% |  | ly.cam.tu@japano.vn |
| `role` | chuỗi | ✔ |  | 100% |  | customer |
| `status` | chuỗi | ✔ |  | 100% |  | active |
| `joinedAt` | số nguyên | ✔ | ✔ | 100% |  | 1760592972477 |
| `tryons` | số nguyên |  |  | 97% |  | 4 |
| `passwordHash` | chuỗi |  |  | 97% |  | $2b$10$SjFmdnUNiEH/I.Lwauh9juQ4… |
| `authProviders` | mảng |  |  | 31% |  | [1 phần tử] |
| `demoBatch` | chuỗi |  |  | 28% |  | demo-2026-08 |
| `stripeCustomerId` | chuỗi |  |  | 6% |  | cus_UxCr4ABzaY5DdI |
| `resetCodeHash` | chuỗi |  |  | 3% |  | 874038108d211a2584d67b7d4e454c1… |
| `resetCodeExpiresAt` | số nguyên |  |  | 3% |  | 1786443699605 |
| `googleId` | chuỗi |  |  | 3% |  | 102289268310840361283 |
| `avatar` | chuỗi |  |  | 3% |  | https://lh3.googleusercontent.c… |

## `addresses`

Số bản ghi: **11**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | addr-1784882864421-khsp |
| `userId` | chuỗi | ✔ |  | 100% | users | u-1784883377086-fma6ou |
| `title` | chuỗi | ✔ |  | 100% |  | Công ty |
| `name` | chuỗi | ✔ |  | 100% |  | Lê Minh Nhật |
| `phone` | chuỗi | ✔ |  | 100% |  | 0707193002 |
| `street` | chuỗi | ✔ |  | 100% |  | 222 |
| `wardCode` | chuỗi | ✔ |  | 100% |  | 27592 |
| `ward` | chuỗi | ✔ |  | 100% |  | Xã Bà Điểm |
| `provinceCode` | chuỗi | ✔ |  | 100% |  | 79 |
| `province` | chuỗi | ✔ |  | 100% |  | Thành phố Hồ Chí Minh |
| `isDefault` | luận lý | ✔ |  | 100% |  | false |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1784882864421 |
| `updatedAt` | số nguyên | ✔ | ✔ | 100% |  | 1784882864421 |
| `demoBatch` | chuỗi |  |  | 55% |  | demo-2026-08 |

## `cart_items`

Số bản ghi: **5**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `userId` | chuỗi | ✔ | ✔ | 100% | users | u-1786634423582-24lrz9 |
| `productId` | chuỗi | ✔ | ✔ | 100% | products | kimono-hong |
| `color` | chuỗi | ✔ |  | 100% |  | Sumi |
| `size` | chuỗi | ✔ |  | 100% |  | M |
| `quantity` | số nguyên | ✔ |  | 100% |  | 2 |
| `updatedAt` | số nguyên | ✔ |  | 100% |  | 1786634423648 |
| `id` | chuỗi | ✔ | ✔ | 100% |  | cart-u-1786634423582-24lrz9-kim… |
| `demoBatch` | chuỗi |  |  | 80% |  | demo-2026-08 |

## `wishlist_items`

Số bản ghi: **13**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | wish-1785640249329-hkhf |
| `userId` | chuỗi | ✔ |  | 100% | users | admin-1784883154949 |
| `createdAt` | số nguyên | ✔ |  | 100% |  | 1785640249329 |
| `productSlug` | chuỗi | ✔ |  | 100% |  | kimono-hong |
| `demoBatch` | chuỗi |  |  | 62% |  | demo-2026-08 |

## `orders`

Số bản ghi: **94**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | o4 |
| `code` | chuỗi | ✔ | ✔ | 100% |  | JP240703 |
| `customer` | đối tượng | ✔ |  | 100% |  | {id, name, phone…} |
| `address` | chuỗi | ✔ |  | 100% |  | 12 Nguyễn Huệ, P. Bến Nghé, HCM |
| `total` | số nguyên | ✔ |  | 100% |  | 1680000 |
| `ship` | số nguyên | ✔ |  | 100% |  | 30000 |
| `status` | chuỗi | ✔ |  | 100% |  | confirmed |
| `createdAt` | số nguyên | ✔ |  | 100% |  | 1781663772477 |
| `history` | mảng | ✔ |  | 100% |  | [2 phần tử] |
| `source` | chuỗi | ✔ |  | 100% |  | demo |
| `items` | mảng | ✔ |  | 100% |  | [2 phần tử] |
| `payment` | đối tượng | ✔ |  | 100% |  | {method, provider, status…} |
| `userId` | chuỗi |  |  | 99% | users | u4 |
| `subtotal` | số nguyên |  |  | 61% |  | 6060000 |
| `discount` | số nguyên |  |  | 61% |  | 606000 |
| `discountCode` | chuỗi |  |  | 61% |  | JAPANO10 |
| `voucherDiscount` | số nguyên |  |  | 60% |  | 0 |
| `paymentDiscount` | số nguyên |  |  | 60% |  | 661000 |
| `addressDetails` | đối tượng |  |  | 57% |  | {street, wardCode, ward…} |
| `paymentPromotion` | đối tượng |  |  | 45% |  | {code, label, percent…} |
| `vipDiscount` | số nguyên |  |  | 45% |  | 0 |
| `demoBatch` | chuỗi |  |  | 35% |  | demo-2026-08 |
| `completedAt` | số nguyên |  |  | 21% |  | 1784887804243 |
| `clientRequestId` | chuỗi |  |  | 9% |  | checkout-1784887387020-iozffaw7 |
| `returnRequest` | đối tượng |  |  | 9% |  | {id, code, status…} |
| `returnStatus` | chuỗi |  |  | 6% |  | received |
| `flagcardAward` | đối tượng |  |  | 5% |  | {cardId, orderId, orderCode…} |
| `voucherRedemption` | đối tượng |  |  | 5% |  | {id, code, userId…} |
| `stockRestoredAt` | số nguyên |  |  | 5% |  | 1786639187664 |
| `stockRestoredReason` | chuỗi |  |  | 5% |  | demo-seed |
| `deliveredAt` | số nguyên |  |  | 3% |  | 1779208787664 |
| `autoCompleted` | luận lý |  |  | 3% |  | true |
| `vipPromotion` | — |  |  | 0% |  |  |

## `payments`

Số bản ghi: **94**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | pay-migrated-o9 |
| `code` | chuỗi | ✔ | ✔ | 100% |  | PAY-JP240708 |
| `orderId` | chuỗi | ✔ | ✔ | 100% | orders | o9 |
| `orderCode` | chuỗi | ✔ | ✔ | 100% |  | JP240708 |
| `userId` | chuỗi | ✔ |  | 100% | users | u9 |
| `provider` | chuỗi | ✔ |  | 100% |  | stripe-seed |
| `method` | chuỗi | ✔ |  | 100% |  | Stripe |
| `status` | chuỗi | ✔ |  | 100% |  | paid |
| `amount` | số nguyên | ✔ |  | 100% |  | 450000 |
| `currency` | chuỗi | ✔ |  | 100% |  | vnd |
| `transactionCode` | chuỗi | ✔ |  | 100% |  | pi_seed_0009 |
| `refundable` | luận lý | ✔ |  | 100% |  | false |
| `refunds` | mảng | ✔ |  | 100% |  | [0 phần tử] |
| `createdAt` | số nguyên | ✔ |  | 100% |  | 1778189772477 |
| `updatedAt` | số nguyên | ✔ |  | 100% |  | 1778189772477 |
| `paidAt` | số nguyên |  |  | 37% |  | 1784194904499 |
| `demoBatch` | chuỗi |  |  | 35% |  | demo-2026-08 |
| `paymentIntentId` | chuỗi |  |  | 33% |  | pi_seed_0009 |
| `checkoutSessionId` | chuỗi |  |  | 32% |  |  |
| `originalAmount` | số nguyên |  |  | 20% |  | 120000 |
| `discount` | số nguyên |  |  | 20% |  | 9000 |
| `voucherDiscount` | số nguyên |  |  | 20% |  | 0 |
| `paymentDiscount` | số nguyên |  |  | 20% |  | 9000 |
| `promotionCode` | chuỗi |  |  | 20% |  | STRIPE10 |
| `paymentMethodType` | chuỗi |  |  | 13% |  | card |
| `chargeId` | chuỗi |  |  | 9% |  | ch_3TtlnV46LydUHMTH0FLn161f |
| `receiptUrl` | chuỗi |  |  | 9% |  | https://pay.stripe.com/receipts… |
| `customer` | đối tượng |  |  | 9% |  | {name, email, phone…} |
| `card` | đối tượng |  |  | 9% |  | {brand, last4, funding…} |
| `intentStatus` | chuỗi |  |  | 7% |  | succeeded |
| `nativeAttempt` | số nguyên |  |  | 7% |  | 1 |
| `vnpCreateDate` | chuỗi |  |  | 7% |  | 20260722162844 |
| `vnpTransactionNo` | chuỗi |  |  | 4% |  | 15631363 |
| `vnpBankCode` | chuỗi |  |  | 4% |  | NCB |
| `vnpCardType` | chuỗi |  |  | 4% |  | ATM |
| `vnpPayDate` | chuỗi |  |  | 4% |  | 20260722163045 |
| `failureReason` | chuỗi |  |  | 3% |  | checkout_expired |
| `vipDiscount` | số nguyên |  |  | 3% |  | 0 |
| `amountSubtotal` | số nguyên |  |  | 2% |  | 111000 |
| `refundedAmount` | số nguyên |  |  | 2% |  | 111000 |
| `pendingRefundAmount` | số nguyên |  |  | 2% |  | 0 |
| `refundId` | chuỗi |  |  | 2% |  | re_3TtlnV46LydUHMTH0Apc9O77 |
| `refundedAt` | số nguyên |  |  | 2% |  | 1784194940649 |
| `vipPromotion` | — |  |  | 0% |  |  |

## `return_requests`

Số bản ghi: **8**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | ret-1784194939560 |
| `code` | chuỗi | ✔ | ✔ | 100% |  | RTN-JP240739-39560 |
| `orderId` | chuỗi | ✔ | ✔ | 100% | orders | o1784194860381 |
| `orderCode` | chuỗi | ✔ | ✔ | 100% |  | JP240739 |
| `userId` | chuỗi | ✔ |  | 100% | users | demo-minh |
| `paymentId` | chuỗi | ✔ |  | 100% | payments | pay-1784194860381 |
| `paymentCode` | chuỗi | ✔ |  | 100% |  | PAY-JP240739-860381 |
| `status` | chuỗi | ✔ |  | 100% |  | refunded |
| `reason` | chuỗi | ✔ |  | 100% |  | Kiểm thử quy trình trả hàng Stripe |
| `note` | chuỗi | ✔ |  | 100% |  | E2E tự động: sản phẩm còn nguyê… |
| `items` | mảng | ✔ |  | 100% |  | [1 phần tử] |
| `amount` | số nguyên | ✔ | ✔ | 100% |  | 111000 |
| `currency` | chuỗi | ✔ |  | 100% |  | vnd |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1784194939560 |
| `updatedAt` | số nguyên | ✔ | ✔ | 100% |  | 1784194940649 |
| `timeline` | mảng | ✔ |  | 100% |  | [4 phần tử] |
| `kind` | chuỗi |  |  | 88% |  | cancel |
| `photos` | mảng |  |  | 88% |  | [0 phần tử] |
| `adminNote` | chuỗi |  |  | 75% |  |  |
| `codManualRefund` | luận lý |  |  | 50% |  | false |
| `refundId` | chuỗi |  |  | 25% |  | re_3TtlnV46LydUHMTH0Apc9O77 |
| `refundStatus` | chuỗi |  |  | 25% |  | succeeded |
| `coversWholeOrder` | luận lý |  |  | 25% |  | true |
| `stockRestoredAt` | số nguyên |  |  | 25% |  | 1784392787664 |
| `demoBatch` | chuỗi |  |  | 25% |  | demo-2026-08 |

## `reviews`

Số bản ghi: **31**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | review-seed-kimono-hong-u5 |
| `productId` | chuỗi | ✔ |  | 100% | products | kimono-hong |
| `userId` | chuỗi | ✔ |  | 100% | users | u5 |
| `userName` | chuỗi | ✔ |  | 100% |  | Hoàng Anh Tú |
| `orderId` | chuỗi | ✔ |  | 100% | orders | o15 |
| `orderCode` | chuỗi | ✔ |  | 100% |  | JP240714 |
| `rating` | số nguyên | ✔ |  | 100% |  | 5 |
| `comment` | chuỗi | ✔ |  | 100% |  | Vải mềm, lên dáng chuẩn, hoa vă… |
| `status` | chuỗi | ✔ |  | 100% |  | approved |
| `moderation` | đối tượng | ✔ |  | 100% |  | {decision, score, engine…} |
| `createdAt` | số nguyên | ✔ |  | 100% |  | 1774323372477 |
| `updatedAt` | số nguyên | ✔ |  | 100% |  | 1784715524685 |
| `adminNote` | chuỗi |  |  | 32% |  |  |
| `moderatedAt` | số nguyên |  |  | 32% |  | 1784715524685 |
| `demoBatch` | chuỗi |  |  | 29% |  | demo-2026-08 |
| `media` | — |  |  | 0% |  |  |

## `review_reactions`

Số bản ghi: **88**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | reaction-seed-review-seed-yukat… |
| `reviewId` | chuỗi | ✔ |  | 100% | reviews | review-seed-yukata-xanh-demo-minh |
| `userId` | chuỗi | ✔ |  | 100% | users | u2 |
| `value` | chuỗi | ✔ |  | 100% |  | helpful |
| `updatedAt` | số nguyên | ✔ |  | 100% |  | 1784511449095 |
| `demoBatch` | chuỗi |  |  | 27% |  | demo-2026-08 |

## `moderation_samples`

Số bản ghi: **6**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | sample-1784710774168-0l7 |
| `label` | chuỗi | ✔ |  | 100% |  | rejected |
| `normalizedText` | chuỗi | ✔ |  | 100% |  | nen them quan c c an hai |
| `learnedPhrases` | mảng | ✔ |  | 100% |  | [1 phần tử] |
| `source` | chuỗi | ✔ |  | 100% |  | auto-community |
| `updatedAt` | số nguyên | ✔ | ✔ | 100% |  | 1784710774168 |
| `demoBatch` | chuỗi |  |  | 33% |  | demo-2026-08 |
| `reviewId` | — |  |  | 0% | reviews |  |

## `notifications`

Số bản ghi: **46**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | notif-1784887771583-yv4ir4 |
| `title` | chuỗi | ✔ |  | 100% |  | Đặt hàng thành công · #JP240755 |
| `body` | chuỗi | ✔ |  | 100% |  | Đơn 1.320.000đ đã được ghi nhận… |
| `type` | chuỗi | ✔ |  | 100% |  | Đơn hàng |
| `reach` | số nguyên | ✔ |  | 100% |  | 1 |
| `at` | số nguyên | ✔ | ✔ | 100% |  | 1784887771583 |
| `userId` | chuỗi |  |  | 83% | users | admin-1784883154949 |
| `action` | chuỗi |  |  | 80% |  | order:o1784887771581 |
| `demoBatch` | chuỗi |  |  | 24% |  | demo-2026-08 |

## `discount_rules`

Số bản ghi: **3**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | discount-vip-10 |
| `code` | chuỗi | ✔ | ✔ | 100% |  | JAPANO-VIP10 |
| `name` | chuỗi | ✔ | ✔ | 100% |  | Thành viên VIP giảm 10% |
| `scope` | chuỗi | ✔ | ✔ | 100% |  | vip |
| `type` | chuỗi | ✔ |  | 100% |  | percent |
| `value` | số nguyên | ✔ | ✔ | 100% |  | 10 |
| `active` | luận lý | ✔ |  | 100% |  | true |
| `demoBatch` | chuỗi |  |  | 67% |  | demo-2026-08 |
| `maxUnitsPerOrder` | số nguyên |  |  | 33% |  | 1 |
| `qualificationType` | chuỗi |  |  | 33% |  | monthly_spend |
| `qualificationValue` | số nguyên |  |  | 33% |  | 5000000 |
| `validityDays` | số nguyên |  |  | 33% |  | 30 |

## `vouchers`

Số bản ghi: **4**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `code` | chuỗi | ✔ | ✔ | 100% |  | THU20 |
| `type` | chuỗi | ✔ |  | 100% |  | percent |
| `value` | số nguyên | ✔ | ✔ | 100% |  | 20 |
| `min` | số nguyên | ✔ |  | 100% |  | 500000 |
| `expiry` | chuỗi (ngày) | ✔ | ✔ | 100% |  | 2027-12-31 |
| `limit` | số nguyên | ✔ | ✔ | 100% |  | 500 |
| `used` | số nguyên | ✔ | ✔ | 100% |  | 133 |
| `active` | luận lý | ✔ |  | 100% |  | true |
| `id` | chuỗi | ✔ | ✔ | 100% |  | voucher-THU20 |
| `appliesTo` | chuỗi |  |  | 25% |  | all-products |
| `ownerUserId` | chuỗi |  |  | 25% |  | admin-1784883154949 |
| `source` | chuỗi |  |  | 25% |  | admin-compensation |
| `reason` | chuỗi |  |  | 25% |  | Xin lỗi vì sự cố với đơn JP240757 |
| `issuedBy` | chuỗi |  |  | 25% |  | admin-1784883154949 |
| `issuedAt` | số nguyên |  |  | 25% |  | 1786083427166 |

## `voucher_redemptions`

Số bản ghi: **5**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | redeem-o1784631853615 |
| `code` | chuỗi | ✔ |  | 100% |  | FREESHIP |
| `userId` | chuỗi | ✔ |  | 100% | users | demo-minh |
| `orderId` | chuỗi | ✔ | ✔ | 100% | orders | o1784631853615 |
| `discount` | số nguyên | ✔ |  | 100% |  | 30000 |
| `redeemedAt` | số nguyên | ✔ | ✔ | 100% |  | 1784631853615 |
| `voucherId` | chuỗi | ✔ |  | 100% |  | voucher-FREESHIP |
| `demoBatch` | chuỗi |  |  | 60% |  | demo-2026-08 |

## `flagcards`

Số bản ghi: **7**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | kiyomizu-dera |
| `order` | số nguyên | ✔ | ✔ | 100% |  | 2 |
| `glyph` | chuỗi | ✔ | ✔ | 100% |  | 🏯 |
| `accent` | chuỗi | ✔ | ✔ | 100% |  | #B06B3B |
| `title` | chuỗi | ✔ | ✔ | 100% |  | Kiyomizu-dera |
| `japanese` | chuỗi | ✔ | ✔ | 100% |  | 清水寺 |
| `region` | chuỗi | ✔ |  | 100% |  | Kyoto |
| `summary` | chuỗi | ✔ | ✔ | 100% |  | Ngôi chùa trên sườn núi nổi tiế… |
| `formationHistory` | chuỗi | ✔ | ✔ | 100% |  | Chính điện và hiên gỗ dựa trên … |
| `legend` | chuỗi | ✔ | ✔ | 100% |  | Nước ở thác Otowa chia thành ba… |
| `funFacts` | mảng | ✔ |  | 100% |  | [2 phần tử] |
| `checkins` | mảng | ✔ |  | 100% |  | [3 phần tử] |
| `outfit` | đối tượng | ✔ |  | 100% |  | {style, clothing, accessories…} |
| `recommendedProductIds` | mảng | ✔ |  | 100% |  | [4 phần tử] |
| `sourceUrl` | chuỗi | ✔ | ✔ | 100% |  | https://kyoto.travel/en/destina… |
| `active` | luận lý | ✔ |  | 100% |  | true |

## `flagcard_collections`

Số bản ghi: **4**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | flags-demo-minh |
| `userId` | chuỗi | ✔ | ✔ | 100% | users | demo-minh |
| `cardIds` | mảng | ✔ |  | 100% |  | [2 phần tử] |
| `awards` | mảng | ✔ |  | 100% |  | [2 phần tử] |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1784206908261 |
| `updatedAt` | số nguyên | ✔ | ✔ | 100% |  | 1784540414640 |

## `vip_memberships`

Số bản ghi: **5**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | vip-demo-minh-2026-07 |
| `userId` | chuỗi | ✔ | ✔ | 100% | users | demo-minh |
| `discountRuleId` | chuỗi | ✔ |  | 100% | discount_rules | discount-vip-10 |
| `qualifyingPeriod` | chuỗi | ✔ |  | 100% |  | 2026-07 |
| `qualifyingOrderIds` | mảng | ✔ |  | 100% |  | [1 phần tử] |
| `qualifiedSpend` | số nguyên | ✔ | ✔ | 100% |  | 5949000 |
| `startedAt` | số nguyên | ✔ | ✔ | 100% |  | 1784206908261 |
| `expiresAt` | số nguyên | ✔ | ✔ | 100% |  | 1786798908261 |
| `status` | chuỗi | ✔ |  | 100% |  | active |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1784206908261 |
| `updatedAt` | số nguyên | ✔ |  | 100% |  | 1786639301858 |
| `threshold` | số nguyên | ✔ |  | 100% |  | 5000000 |
| `discountPercent` | số nguyên | ✔ |  | 100% |  | 10 |
| `discountedUnitsPerOrder` | số nguyên | ✔ |  | 100% |  | 1 |

## `banners`

Số bản ghi: **3**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | b2 |
| `title` | chuỗi | ✔ | ✔ | 100% |  | Cách tân Nhật Bản |
| `img` | chuỗi | ✔ | ✔ | 100% |  | #243244 |
| `link` | chuỗi | ✔ | ✔ | 100% |  | /culture |
| `active` | luận lý | ✔ |  | 100% |  | true |
| `order` | số nguyên | ✔ | ✔ | 100% |  | 2 |

## `interactions`

Số bản ghi: **668**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ |  | 100% |  | i2 |
| `productId` | chuỗi | ✔ |  | 100% | products | so-mi-trang |
| `type` | chuỗi | ✔ |  | 100% |  | view |
| `createdAt` | số nguyên | ✔ |  | 100% |  | 1783902972477 |
| `source` | chuỗi | ✔ |  | 100% |  | demo |
| `value` | số nguyên |  |  | 85% |  | 5 |
| `userId` | chuỗi |  |  | 79% | users | u2 |
| `metadata` | đối tượng |  |  | 42% |  | {…} |
| `demoBatch` | chuỗi |  |  | 22% |  | demo-2026-08 |

## `search_logs`

Số bản ghi: **13**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | sl1786360423565ce3ge |
| `userId` | chuỗi | ✔ |  | 100% | users | u-1786359849747-ukzvqm |
| `query` | chuỗi | ✔ |  | 100% |  | Ki |
| `resultCount` | số nguyên | ✔ |  | 100% |  | 20 |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1786360423565 |
| `demoBatch` | chuỗi |  |  | 62% |  | demo-2026-08 |

## `push_tokens`

Số bản ghi: **4**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `userId` | chuỗi | ✔ | ✔ | 100% | users | u-1786634366406-ph3avg |
| `token` | chuỗi | ✔ | ✔ | 100% |  | ExponentPushToken[TEST-17866343… |
| `platform` | chuỗi | ✔ |  | 100% |  | android |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1786634366500 |
| `id` | chuỗi | ✔ | ✔ | 100% |  | ExponentPushToken[TEST-17866343… |
| `demoBatch` | chuỗi |  |  | 75% |  | demo-2026-08 |

## `profiles`

Số bản ghi: **12**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `userId` | chuỗi | ✔ | ✔ | 100% | users | u2 |
| `preferredStyles` | mảng | ✔ |  | 100% |  | [2 phần tử] |
| `heightCm` | số nguyên | ✔ |  | 100% |  | 159 |
| `weightKg` | số nguyên | ✔ |  | 100% |  | 52 |
| `updatedAt` | số nguyên | ✔ | ✔ | 100% |  | 1783834572477 |
| `id` | chuỗi | ✔ | ✔ | 100% |  | u2 |
| `gender` | chuỗi |  |  | 92% |  | Nữ |
| `skinTone` | chuỗi |  |  | 92% |  | Sáng |
| `occasion` | chuỗi |  |  | 92% |  | Đi chơi |
| `budget` | số nguyên |  |  | 92% |  | 950000 |
| `usualSize` | chuỗi |  |  | 92% |  | M |
| `demoBatch` | chuỗi |  |  | 42% |  | demo-2026-08 |

## `chats`

Số bản ghi: **68**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | chat-1783936617114 |
| `role` | chuỗi | ✔ |  | 100% |  | user |
| `message` | chuỗi | ✔ |  | 100% |  | hi |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1783936617114 |
| `userId` | chuỗi |  |  | 71% | users | demo-minh |
| `productIds` | mảng |  |  | 46% |  | [4 phần tử] |
| `engine` | chuỗi |  |  | 19% |  | hybrid-post-transformer |
| `intent` | chuỗi |  |  | 19% |  | lookup |
| `confidence` | số thực |  |  | 19% |  | 0.96 |
| `latencyMs` | số nguyên |  |  | 19% |  | 0 |
| `modelTrace` | đối tượng |  |  | 15% |  | {intent, confidence, semanticIntent…} |
| `generationModel` | chuỗi |  |  | 15% |  | local-grounded-retrieval |
| `fallbackReason` | chuỗi |  |  | 15% |  | ollama-disabled |
| `demoBatch` | chuỗi |  |  | 9% |  | demo-2026-08 |

## `tryon_history`

Số bản ghi: **73**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | tryon-1783934432155 |
| `productId` | chuỗi | ✔ |  | 100% | products | khoac-nhat |
| `accessoryIds` | mảng | ✔ |  | 100% |  | [0 phần tử] |
| `engine` | chuỗi | ✔ |  | 100% |  | flux2-klein-4b-pose+fashn-vton-1.5 |
| `createdAt` | số nguyên | ✔ |  | 100% |  | 1783934432155 |
| `userId` | chuỗi |  |  | 88% | users | demo-minh |
| `productIds` | mảng |  |  | 27% |  | [1 phần tử] |
| `appliedAccessories` | mảng |  |  | 14% |  | [3 phần tử] |
| `skippedAccessories` | mảng |  |  | 14% |  | [0 phần tử] |
| `demoBatch` | chuỗi |  |  | 14% |  | demo-2026-08 |

## `goals`

Số bản ghi: **8**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | goal-demo-minh-yukata-xanh |
| `userId` | chuỗi | ✔ |  | 100% | users | demo-minh |
| `productId` | chuỗi | ✔ |  | 100% | products | yukata-xanh |
| `product` | đối tượng | ✔ |  | 100% |  | {slug, name, price…} |
| `input` | đối tượng | ✔ |  | 100% |  | {age, heightCm, currentWeightKg…} |
| `plan` | đối tượng | ✔ |  | 100% |  | {saving, wellness, coaching…} |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1784711737653 |
| `updatedAt` | số nguyên | ✔ |  | 100% |  | 1784711770961 |
| `fund` | đối tượng |  |  | 50% |  | {deposits, target, saved…} |
| `demoBatch` | chuỗi |  |  | 38% |  | demo-2026-08 |

## `ai_descriptions`

Số bản ghi: **10**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `productId` | chuỗi | ✔ | ✔ | 100% | products | kimono-hong |
| `generatedAt` | số nguyên | ✔ | ✔ | 100% |  | 1785037034406 |
| `description` | đối tượng | ✔ |  | 100% |  | {headline, visualSummary, details…} |
| `id` | chuỗi | ✔ | ✔ | 100% |  | aiDescriptions-1 |

## `japan_spot_reviews`

Số bản ghi: **5**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | jspot-review-1785640335059-uuh4c |
| `place` | chuỗi | ✔ |  | 100% |  | Kênh Otaru |
| `prefecture` | chuỗi | ✔ |  | 100% |  | Hokkaido |
| `userId` | chuỗi | ✔ |  | 100% | users | demo-minh |
| `userName` | chuỗi | ✔ | ✔ | 100% |  | Quản trị viên JAPANO |
| `rating` | số nguyên | ✔ |  | 100% |  | 5 |
| `comment` | chuỗi | ✔ | ✔ | 100% |  | Good |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1785640335060 |
| `status` | chuỗi |  |  | 80% |  | approved |
| `moderation` | đối tượng |  |  | 80% |  | {decision, score, engine…} |
| `demoBatch` | chuỗi |  |  | 60% |  | demo-2026-08 |
| `media` | — |  |  | 0% |  |  |

## `japan_spot_suggestions`

Số bản ghi: **5**

| Trường | Kiểu | Bắt buộc | Duy nhất | Có giá trị | Tham chiếu | Ví dụ |
|---|---|:---:|:---:|---:|---|---|
| `id` | chuỗi | ✔ | ✔ | 100% |  | jspot-suggestion-1786634366486-… |
| `prefecture` | chuỗi | ✔ |  | 100% |  | Kyoto |
| `userId` | chuỗi | ✔ | ✔ | 100% | users | u-1786634366406-ph3avg |
| `userName` | chuỗi | ✔ | ✔ | 100% |  | Rỗng |
| `suggestion` | chuỗi | ✔ | ✔ | 100% |  | Nên đi lúc sáng sớm để vắng người. |
| `place` | chuỗi | ✔ | ✔ | 100% |  | Fushimi Inari |
| `status` | chuỗi | ✔ |  | 100% |  | approved |
| `createdAt` | số nguyên | ✔ | ✔ | 100% |  | 1786634366486 |
| `demoBatch` | chuỗi |  |  | 80% |  | demo-2026-08 |
| `moderation` | đối tượng |  |  | 20% |  | {decision, score, engine…} |
| `reward` | đối tượng |  |  | 20% |  | {status…} |
