# PHỤ LỤC B — THƯ VIỆN NGHIỆP VỤ `backend/lib/`

## B.1. Phạm vi và cách xác minh

Danh sách dưới đây là kết quả liệt kê trực tiếp thư mục `backend/lib/`. Cột "Được dùng bởi" dựng từ việc quét toàn bộ lời gọi `require('./lib/...')` và `require('../lib/...')` trong `backend/server.js`, `backend/routes/`, `backend/test/`, `backend/scripts/`, `backend/seed.js` và trong chính `backend/lib/`. Chỉ liệt kê những nơi thực sự `require` tệp đó, không suy đoán theo tên.

**Tổng số tệp đếm được thật: 36.**

> **Chênh lệch so với tài liệu trước.** `thesis/evidence/missing-information.md` ghi "34 files under `backend/lib/`". Số đúng hiện tại là **36**, lệch **+2**. Hai tệp chưa có trong bản kiểm kê cũ là `gpuArbiter.js` và `gpuJobQueue.js` — cụm điều phối và xếp hàng tác vụ GPU, hiện đã được `catalog.js`, `stylist.js`, `tryon.js` và `test/gpu-queue.test.js` sử dụng. Các tệp chương và đề cương đã được cập nhật theo con số 36.

**Mô hình nạp module:** `backend/server.js` `require` phần lớn các module này (`server.js:13-46`) rồi gom vào **một đối tượng `ctx` duy nhất**, truyền cho cả 17 tệp route (`server.js:157-178`). Vì vậy nhiều module không được tệp route `require` trực tiếp mà đến với route qua `ctx`. Cột "Được dùng bởi" ghi rõ trường hợp nào là như vậy bằng ký hiệu `server.js → ctx`. Đây chính là mẫu tiêm phụ thuộc (dependency injection) được phân tích ở Chương 3, mục 3.1.3.

## B.2. Bảng đầy đủ 36 module

| STT | Tên tệp | Vai trò | Được dùng bởi |
|---|---|---|---|
| 1 | `accessory.js` | Pipeline xử lý phụ kiện (nón, ô) và định tuyến tới điểm neo pose; xuất `runAccessoryPipeline`, `accessoryKind` | `server.js` → `ctx` (dùng trong `routes/tryon.js`); `test/analytics-recommend.test.js` |
| 2 | `advancedRecommend.js` | Mô hình gợi ý nâng cao; xuất `buildAdvancedModel`, `scoreAdvanced` | `lib/recommend.js`; `test/analytics-recommend.test.js` |
| 3 | `analytics.js` | Bộ máy phân tích doanh thu/nhu cầu/phân khúc khách hàng; xuất `buildAnalytics`, `finiteNumber`, `productId` | `server.js` → `ctx` (dùng trong `routes/health.js`); `lib/chatbot.js`, `lib/recommend.js`, `lib/outfit.js`; `test/analytics-recommend.test.js` |
| 4 | `auth.js` | Băm bcrypt, phát/kiểm JWT, toàn bộ middleware phân quyền: `requireAuth`, `optionalAuth`, `requireStaff`, `requireAdmin`, `requireSuperAdmin`, `roleAtLeast`, `ensureAdminSeeded` | `routes/auth.js`; `server.js` → `ctx` (mọi route có bảo vệ) |
| 5 | `chatbot.js` | Chatbot tư vấn: định tuyến ý định, trả lời bám danh mục sản phẩm thật | `server.js` → `ctx` (dùng trong `routes/stylist.js`); `test/analytics-recommend.test.js` |
| 6 | `cloudinaryMedia.js` | Tích hợp Cloudinary; xuất `cloudinary`, `cloudinaryEnabled`, `cloudinaryHealth`, `uploadReviewMedia`, `uploadReturnPhotos` | `server.js` → `ctx` (`routes/health.js`, `routes/reviews.js`, `routes/returns.js`, `routes/japanSpots.js`) |
| 7 | `embeddings.js` | Vector hoá sản phẩm và độ tương đồng; xuất `ensureProductEmbeddingsFresh`, `getProductEmbedding`, `cosineSimilarity`, `embeddingsStatus`, `productText` | `lib/recommend.js`; `test/embeddings.test.js` |
| 8 | `flagcards.js` | Chương trình thẻ Flagcard và voucher thưởng; xuất `ensureFlagcardState`, `reconcileFlagRewards`, `flagcardCollectionView`, `validateVoucher`, `awardFlagcardForOrder`, `FLAGCARDS`, `DEFAULT_FLAGCARD_CONFIG` | `server.js` → `ctx` (`routes/loyalty.js`, `routes/orders.js`, `routes/health.js`); `seed.js`; `test/orders.test.js`, `test/analytics-recommend.test.js` |
| 9 | `garmentImages.js` | Phân giải ảnh trang phục đầu vào cho pipeline thử đồ; xuất `resolveGarmentImage` | `routes/tryon.js`, `routes/catalog.js` |
| 10 | `goals.js` | Lập kế hoạch tiết kiệm và sức khoẻ/BMI có giới hạn an toàn; xuất `buildGoalPlan`, `enhanceCoaching` | `server.js` → `ctx` (`routes/stylist.js`); `test/analytics-recommend.test.js` |
| 11 | `gpuArbiter.js` | Điều phối ưu tiên GPU giữa các tính năng AI; xuất `setFocus`, `getFocus`, `runGpuJob`, `GpuJobCancelledError`, `FOCUS_PROFILES` | `routes/stylist.js`, `routes/tryon.js`, `routes/catalog.js`; `test/gpu-queue.test.js` |
| 12 | `gpuJobQueue.js` | Hàng đợi tác vụ GPU có mức ưu tiên và khả năng huỷ tác vụ; xuất `GpuJobQueue`, `GpuJobCancelledError`, `DEFAULT_PRIORITIES` | `lib/gpuArbiter.js`; `test/gpu-queue.test.js` |
| 13 | `httpError.js` | Kiểu lỗi HTTP dùng chung toàn hệ thống; xuất `httpError` | `server.js` → `ctx`; `lib/cloudinaryMedia.js`; `test/orders.test.js` |
| 14 | `httpFetch.js` | Gọi HTTP có timeout và kiểm tra sức khoẻ service; xuất `fetchWithTimeout`, `serviceHealth` | `routes/stylist.js`, `routes/tryon.js`; `lib/embeddings.js`, `lib/gpuArbiter.js`, `lib/push.js` |
| 15 | `japanKnowledge.js` | Cơ sở tri thức về Nhật Bản cho chatbot; xuất `japanKnowledgeAnswer` | `lib/chatbot.js` |
| 16 | `logger.js` | Logging có cấu trúc và bắt lỗi; xuất `logger`, `captureError`, `sentryEnabled` | `server.js`; `lib/embeddings.js`, `lib/gpuArbiter.js`, `lib/store.js`, `lib/push.js`, `lib/mailer.js`, `lib/auth.js` |
| 17 | `mailer.js` | Gửi email (mã đặt lại mật khẩu); xuất `sendMail` | `routes/auth.js` |
| 18 | `mongo.js` | Kết nối MongoDB tuỳ chọn (bản sao gương của state); xuất `getDb`, `mongoEnabled`, `mongoHealth` | `server.js`; `lib/store.js` |
| 19 | `notify.js` | Tạo bản ghi thông báo trong state; xuất `pushNotification` | `routes/admin.js`, `routes/returns.js`; `server.js` → `ctx`; `test/orders.test.js` |
| 20 | `orderStatus.js` | Chuẩn hoá trạng thái đơn hàng; xuất `successfulLiveOrder` | `routes/reviews.js`, `routes/catalog.js` |
| 21 | `outfit.js` | Phối đồ, bộ trang phục theo ngày, tư vấn size; xuất `composeOutfit`, `todaysOutfit`, `adviseSize`, `styleRecommendation` | `server.js` → `ctx` (`routes/stylist.js`); `lib/chatbot.js` |
| 22 | `paymentLookup.js` | Tra cứu giao dịch/yêu cầu đổi trả và tái dùng đơn chưa thanh toán; xuất `findPayment`, `findReturnRequest`, `checkoutItemsKey`, `reusableStripeOrder`, `reusableProviderOrder` | `routes/paymentsStripe.js`, `routes/payments.js`, `routes/orders.js`, `routes/paymentsVnpay.js`, `routes/returns.js` |
| 23 | `pillow.js` | Xử lý ảnh qua service Pillow cục bộ; xuất `runPillow` | `server.js` → `ctx` (`routes/stylist.js`) |
| 24 | `portraitVision.js` | Phân tích ảnh chân dung (màu sắc, tâm trạng, phong cách); xuất `analyzePortrait` | `server.js` → `ctx` (`routes/stylist.js`) |
| 25 | `postTransformer.js` | Định tuyến ý định và độ tương đồng ngữ nghĩa cho chatbot; xuất `routeChatIntent`, `semanticSimilarity` | `lib/chatbot.js` |
| 26 | `productVision.js` | Sinh và kiểm tra mô tả sản phẩm bằng mô hình thị giác; xuất `analyzeProductImage`, `fallbackProductDescription`, `ensureVietnameseProductDescription`, `parseJsonText` | `server.js` → `ctx` (`routes/catalog.js`); `lib/goals.js`; `test/analytics-recommend.test.js` |
| 27 | `push.js` | Gửi thông báo đẩy qua Expo; xuất `makeSendPushToUser`, `makeSendPushToAll` | `server.js` → `ctx` (`routes/push.js`, `routes/orders.js`, `routes/admin.js`) |
| 28 | `recommend.js` | Bộ máy gợi ý chính (hybrid); xuất `getHomeRecommendations`, `getRecommendationDiagnostics`, `buildTagIndex`, `trendingList` | `server.js` → `ctx` (`routes/stylist.js`, `routes/catalog.js`); `lib/chatbot.js`, `lib/outfit.js`; `test/analytics-recommend.test.js` |
| 29 | `reviewModeration.js` | Kiểm duyệt đánh giá bằng AI kết hợp luật cục bộ; xuất `moderateReview`, `localModeration`, `DEFAULT_MODEL` | `server.js` → `ctx` (`routes/reviews.js`, `routes/japanSpots.js`); `test/analytics-recommend.test.js` |
| 30 | `serviceUrls.js` | Tập trung URL của các micro-service AI; xuất `CATVTON_URL`, `FASHN_URL`, `MOTION_URL`, `AI_GATEWAY_URL`, `OLLAMA_URL`, `EMBEDDING_URL`, `MOTION_ENGINE_LABEL` | `routes/japanSpots.js`, `routes/stylist.js`, `routes/tryon.js`, `routes/reviews.js`, `routes/catalog.js`; `lib/embeddings.js`, `lib/gpuArbiter.js` |
| 31 | `store.js` | **Lớp lưu trữ trung tâm** (`db.json` + gương MongoDB), ghi nguyên tử; xuất `createStore` — nguồn của `read`/`write`/`update` | `server.js` → `ctx` (toàn bộ 17 tệp route); `scripts/seedReviews.js` |
| 32 | `stripeClient.js` | Khởi tạo SDK Stripe và cấu hình; xuất `stripe`, `stripeEnabled`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_MERCHANT_DISPLAY_NAME`, `STRIPE_WEBHOOK_SECRET` | `server.js` → `ctx` (`routes/paymentsStripe.js`, webhook trong `server.js`) |
| 33 | `stripeMoney.js` | Quy đổi số tiền và đơn vị tiền tệ Stripe; xuất `stripeAmount`, `localStripeAmount`, `STRIPE_CURRENCY` | `routes/paymentsStripe.js`, `routes/orders.js`, `routes/paymentsVnpay.js`, `routes/returns.js`; `server.js` → `ctx` |
| 34 | `tryonConfig.js` | Cờ cấu hình pipeline thử đồ; xuất `FORCE_REPOSE`, `FASHN_FIDELITY_REFINE` | `routes/tryon.js`; `server.js` → `ctx` |
| 35 | `vip.js` | Hạng VIP và ưu đãi theo lịch sử mua hàng; xuất `VIP_CONFIG`, `vipStatus`, `vipDiscountForSelection`, `reconcileVipState` | `server.js` → `ctx` (`routes/loyalty.js`, `routes/orders.js`); `test/vip.test.js`, `test/orders.test.js` |
| 36 | `vnpaySign.js` | Ký và xác minh chữ ký HMAC-SHA512 của VNPay; xuất `vnpayEnabled` cùng các hàm ký/kiểm tra | `routes/paymentsVnpay.js`; `server.js` → `ctx` |

## B.3. Nhận xét

### Module được dùng rộng nhất

`store.js` là module trung tâm — mọi tệp route đều truy cập dữ liệu qua nó. `serviceUrls.js` và `logger.js` cũng có mặt ở nhiều nơi, cho thấy hai quyết định thiết kế đúng: tập trung URL dịch vụ vào một chỗ (đổi cổng chỉ sửa một tệp) và dùng logging có cấu trúc thay vì `console.log` rải rác.

### Module có kiểm thử tự động

Trong 36 module, có kiểm thử tự động cho: `vip.js`, `embeddings.js`, `flagcards.js`, `goals.js`, `analytics.js`, `recommend.js`, `advancedRecommend.js`, `chatbot.js`, `reviewModeration.js`, `productVision.js`, `accessory.js`, `gpuJobQueue.js`, `gpuArbiter.js`, `httpError.js`, `notify.js`.

**Không có kiểm thử** cho: `auth.js` (module bảo mật quan trọng nhất), `mailer.js`, `cloudinaryMedia.js`, `paymentLookup.js`, `stripeClient.js`, `stripeMoney.js`, `vnpaySign.js` (module ký chữ ký thanh toán), `store.js`, `mongo.js`. Đây là khoảng trống kiểm thử đã ghi nhận ở Chương 6, mục 6.4 và Chương 8, mục 8.3.2.

### Ghi chú bảo mật

- Cấu hình nhạy cảm (khoá Stripe, `JWT_SECRET`, thông tin SMTP, khoá Cloudinary, bí mật VNPay) được đọc từ biến môi trường. Phụ lục này chỉ nêu **tên biến**, không in giá trị — đúng nguyên tắc ở `thesis/evidence/security-analysis.md` mục 5. Danh mục biến môi trường đầy đủ nằm ở `.env.example` và Chương 7, mục 7.3.
- `lib/vnpaySign.js` có giá trị bí mật sandbox gán cứng làm giá trị dự phòng. Đây là bộ thông tin demo do VNPay công bố công khai, **không phải khoá production bị rò rỉ**, nhưng vẫn là secret nằm trong mã nguồn và được ghi nhận là hạn chế ở Phụ lục C mục C.4.
- Biến `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` được `lib/mailer.js` dùng thật nhưng **không có trong `.env.example`** — thiếu sót tài liệu, không phải lỗi bảo mật; đã nêu ở Chương 7, mục 7.3.
