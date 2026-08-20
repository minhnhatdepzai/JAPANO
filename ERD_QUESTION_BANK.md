# ERD QUESTION BANK — JAPANO

Ngân hàng câu hỏi để luyện phản biện. Đọc câu hỏi, trả lời thành tiếng, rồi mới xem đáp án.

**120 câu hỏi có mã Q001–Q120.** Tất cả 61 câu bổ sung và phần lớn 59 câu kế thừa gắn với table, field, relationship, route, index hoặc logic thật của JAPANO.

> Quy tắc luyện: trả lời nhanh 15–30 giây. Với 24 câu trọng tâm, tiếp tục trả lời sâu 45–90 giây rồi tự xử lý câu truy đuổi.

---

## Cấp 1 — Nhận biết

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q001 | Sơ đồ có bao nhiêu bảng, bao nhiêu quan hệ? | 36 thực thể logic, 50 quan hệ, 407 dòng cột. | Đọc sơ đồ |
| Q002 | Bảng nào là trung tâm? | `Người Dùng` 21 dây vào, `Sản Phẩm` 14 dây. Hai bảng chiếm 35/50. | Đọc sơ đồ |
| Q003 | Khoá chính của `users`? | `id`, kiểu chuỗi. | Khoá chính |
| Q004 | `order_items` có mấy khoá ngoại? | Hai: `orderId`, `productId`. | Khoá ngoại |
| Q005 | `return_requests` có mấy khoá ngoại? | Ba: `userId`, `orderId`, `paymentId` (tuỳ chọn). | Khoá ngoại |
| Q006 | Đơn hàng có mấy trạng thái? | Bảy: pending, pending_payment, confirmed, shipping, completed, cancelled, returned. | Nghiệp vụ |
| Q007 | Có mấy vai trò người dùng? | Bốn, xếp thứ bậc: customer < staff < admin < super_admin. | Phân quyền |
| Q008 | Tồn kho lưu ở bảng nào? | `product_variants`, không phải `products`. | Thiết kế thực thể |
| Q009 | Cơ sở dữ liệu dùng là gì? | MongoDB, driver chính thức, không dùng Mongoose. | Công nghệ |
| Q010 | Có bao nhiêu collection thật? | 35. | Đối chiếu |

---

## Cấp 2 — Giải thích

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q011 | Vì sao khoá ngoại nằm ở phía nhiều? | Phía nhiều chỉ trỏ về một bản ghi nên một ô là đủ. Đặt ngược phải chứa danh sách → vi phạm chuẩn 1. | Bản số |
| Q012 | Vì sao `orders` và `order_items` tách? | Đơn–sản phẩm là nhiều–nhiều, và dòng hàng còn mang dữ liệu riêng. | Chuẩn hoá |
| Q013 | Vì sao tồn kho ở biến thể? | Hết cỡ L ≠ hết áo. Tồn kho phải ở mức lấy hàng khỏi kệ. | Nghiệp vụ |
| Q014 | Vì sao dùng `categoryId` chứ không lưu tên? | Tránh bất thường khi sửa/thêm/xoá. Đổi tên chỉ sửa một bản ghi. | Chuẩn hoá |
| Q015 | Vì sao địa chỉ tách bảng? | Một người nhiều địa chỉ; sửa đè làm sai lịch sử giao hàng. | Bản số |
| Q016 | Vì sao `profiles` tách khỏi `users`? | Khác mức nhạy cảm; đổi avatar không nên chạm bản ghi có mật khẩu. | Bảo mật |
| Q017 | Vì sao thanh toán là bảng riêng? | Một đơn nhiều lượt giao dịch; giao dịch mang dữ liệu riêng của cổng. | Bản số |
| Q018 | Vì sao đánh giá nối tới đơn hàng? | Xác minh đã mua — chống đánh giá giả. | Toàn vẹn nghiệp vụ |
| Q019 | Vì sao `cart_items` ràng buộc bốn cột? | Cùng áo khác màu/cỡ là hai dòng giỏ hợp lệ. | Ràng buộc |
| Q020 | Vì sao khoá chuỗi chứ không tự tăng? | MongoDB không có tự tăng; khoá chuỗi sinh được ở ứng dụng, cần khi chạy nhiều bản sao. | Khoá chính |
| Q021 | Vì sao `voucher_redemptions` là bảng chứ không phải bộ đếm? | Cần biết ai dùng, đơn nào, lúc nào — để chặn dùng lại và đối soát. | Thiết kế thực thể |
| Q022 | Vì sao `Phiếu Giảm Giá` có hai dây tới `Người Dùng`? | Một là người nhận, một là người cấp — thao tác phát sinh tiền phải truy được trách nhiệm. | Đọc sơ đồ |

---

## Cấp 3 — Tình huống thực tế

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q023 | Giá đổi thì đơn cũ hiện giá nào? | Giá cũ — `order_items.price` là bản chụp. | Snapshot |
| Q024 | Sản phẩm đổi tên thì đơn cũ sao? | Vẫn tên cũ, có chụp `productName`. | Snapshot |
| Q025 | Sản phẩm bị xoá thì đơn cũ sao? | Hiển thị đủ nhờ bản chụp; mất liên kết về trang sản phẩm. | Chiến lược xoá |
| Q026 | Người dùng xoá tài khoản thì đơn sao? | Không có chức năng xoá, chỉ khoá bằng `status`. Thiếu ẩn danh hoá. | Chiến lược xoá |
| Q027 | Đổi email thì khoá ngoại sao? | Không ảnh hưởng — bảng con trỏ về `id`. | Khoá chính |
| Q028 | Khách đổi địa chỉ mặc định thì đơn cũ sao? | Không đổi — đơn chụp địa chỉ lúc đặt. | Snapshot |
| Q029 | Hai người cùng mua món cuối cùng? | Một process serialize check–decrement và unit test 50/5 đạt; nhiều instance cần atomic Mongo update. | Đồng thời |
| Q030 | Cổng thanh toán gửi lại 5 lần? | Status/txn/refund-id/restock markers chống lặp ở handler; transactionCode DB unique còn thiếu. | Idempotency |
| Q031 | Khách bấm đặt hàng hai lần? | `clientRequestId` trả về đơn đã tạo. | Idempotency |
| Q032 | Khách trả lại 1 trong 3 món? | Hoàn từng phần, ghi vào mảng các lần hoàn. | Nghiệp vụ |
| Q033 | Phiếu hết hạn đúng lúc thanh toán? | Kiểm tra hạn ở máy chủ lúc tạo đơn → từ chối, không tạo đơn sai giá. | Toàn vẹn |
| Q034 | Đơn trực tuyến thất bại thì kho có hoàn? | Có khi handler xác nhận failed/cancelled/expired; pending treo vẫn cần reconcile/timeout. | Điểm yếu |
| Q035 | Admin khoá tài khoản khi đơn đang giao? | Đơn không bị ảnh hưởng — `status` của người dùng độc lập với đơn. | Nghiệp vụ |
| Q036 | Khách tải lại trang thanh toán giữa chừng? | `clientRequestId` bảo đảm không tạo đơn thứ hai. | Idempotency |

---

## Cấp 4 — Phản biện

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q037 | Tách nhiều bảng, nối nhiều, thiết kế kém? | Gộp bảng không xoá độ phức tạp, chỉ chuyển sang mã ứng dụng nơi cơ sở dữ liệu không giúp được. | Chuẩn hoá |
| Q038 | Chuẩn 3 lúc nào cũng tốt? | Không. Snapshot lịch sử và dữ liệu tra cứu đóng là hai chỗ cố ý không chuẩn hoá. | Chuẩn hoá |
| Q039 | Lưu giá hai chỗ là dư thừa? | Không. Dư thừa = một sự thật hai nơi. Đây là hai sự thật tại hai thời điểm. | Snapshot |
| Q040 | Ứng dụng kiểm tra rồi, cần ràng buộc DB làm gì? | Giữa đọc và ghi có khoảng trống cho yêu cầu khác chen vào. | Đồng thời |
| Q041 | Nếu thêm UNIQUE email rồi còn cần `id` không? | Có. UNIQUE chống trùng; `id` là định danh ổn định để tham chiếu. | Khoá chính |
| Q042 | Khoá ngoại làm chậm, sao vẫn dùng? | Giá của dữ liệu mồ côi cao hơn, và thường chỉ lộ khi đã hỏng dây chuyền. | Toàn vẹn |
| Q043 | Chỉ mục càng nhiều càng nhanh? | Không — đọc nhanh, ghi chậm, tốn dung lượng. | Hiệu năng |
| Q044 | Xoá mềm = không bao giờ xoá thật? | Không. Hết hạn lưu trữ vẫn dọn; quyền riêng tư cần ẩn danh hoá. | Chiến lược xoá |
| Q045 | MongoDB không lược đồ thì vẽ ERD làm gì? | Dữ liệu vẫn có cấu trúc, chỉ khai báo trong mã. Bằng chứng: 21 collection có chỉ mục tường minh. | Mô hình hoá |
| Q046 | Sao không dùng cơ sở dữ liệu quan hệ? | Dữ liệu sản phẩm có cấu trúc biến động. Đánh đổi: phải tự thực thi toàn vẹn — chấp nhận có ý thức. | Kiến trúc |
| Q047 | MongoDB nhúng mảng được, sao còn tách `order_items`? | Có nhúng `items` để đọc một đơn một lượt, và có collection riêng để thống kê theo sản phẩm. Đánh đổi có chủ ý. | Kiến trúc |

---

## Cấp 5 — Khó

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q048 | Hệ thống có dùng transaction không? | KHÔNG. Không có `startSession`/`withTransaction` nào. Nguyên tử từ chạy đồng bộ một luồng, chỉ đúng trong một tiến trình. | ACID |
| Q049 | Bước 4 trong luồng đặt hàng hỏng thì sao? | Bản sao bị bỏ, trạng thái gốc chưa bị chạm — tương đương rollback. Chỉ đúng khi hỏng nằm trong hàm sửa đổi. | ACID |
| Q050 | Muốn chạy nhiều máy chủ phải đổi gì? | Cập nhật có điều kiện, khoá lạc quan, hoặc transaction thật. Và bỏ mô hình giữ toàn bộ state trong bộ nhớ. | Mở rộng |
| Q051 | Mức cô lập nào đang dùng? | Không áp dụng — không có song song thật trong một tiến trình một luồng. | ACID |
| Q052 | Toàn vẹn tham chiếu có phủ hết không? | KHÔNG. Chỉ ~9 nhóm bảng con, và KHÔNG chạy trên nhánh ghi tệp JSON dự phòng. | Điểm yếu |
| Q053 | Dữ liệu có thể mất không? | Có. Ack có thể đi trước durable persist; debounce reset nên không giới hạn là một write cuối. | Bền vững |
| Q054 | Một triệu người dùng thì gãy ở đâu trước? | Không phải chỉ mục — mà là việc giữ toàn bộ state trong bộ nhớ một tiến trình. | Mở rộng |
| Q055 | Bảng nào phình nhanh nhất? | `interactions` — mỗi lượt xem một bản ghi. Cần gộp theo ngày và dọn bản ghi cũ. | Mở rộng |
| Q056 | Nếu làm lại thì đổi gì đầu tiên? | Bỏ state trong bộ nhớ, chuyển sang lớp truy cập theo bảng với cập nhật có điều kiện. | Kiến trúc |
| Q057 | Điểm mạnh nhất của thiết kế? | Snapshot ở dòng đơn hàng — chụp 5 thuộc tính nên đơn cũ luôn đúng dù sản phẩm đổi gì. | Tổng hợp |
| Q058 | Vì sao 36 thực thể mà 35 collection? | 3 thực thể không thành collection (Màu Sắc, Kích Thước, Hình Ảnh thừa) + 2 collection không lên sơ đồ. 36−3+2=35. | Đối chiếu |
| Q059 | Hai bảng hình ảnh trên sơ đồ để làm gì? | Trùng vai trò — dấu vết bản thiết kế đầu khi chưa hỗ trợ video. Chỉ `product_media` tồn tại. Đây là lỗi. | Điểm yếu |

---

## Cột & ràng buộc

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q060 | `users.googleId` dùng để làm gì và có unique không? | Nối danh tính Google; MongoDB hiện chưa có unique index riêng. | auth.js/lib/googleAuth.js + indexes users |
| Q061 | Vì sao `passwordHash` được phép thiếu ở một số user? | Tài khoản Google-only có thể chưa đặt mật khẩu. | users field presence + authProviders |
| Q062 | `authProviders` là snapshot hay state hiện tại? | Là state các cách đăng nhập hiện có, không phải chứng từ. | routes/auth.js publicUser/reset-password |
| Q063 | `products.slug` unique nhưng đổi slug có rủi ro gì? | Link cũ và logical refs dùng slug có thể hỏng; cần redirect hoặc ID ổn định. | uq_products_slug + route lookup |
| Q064 | `product_variants.sku` khác `id` thế nào? | SKU phục vụ kho/nghiệp vụ và có thể theo quy ước; id là định danh kỹ thuật. | uq_product_variants_sku |
| Q065 | Khi nào `product_variants.price` được dùng? | Khi variant có giá riêng; nếu thiếu thì fallback về products.price. | lib/pricing.js + live count |
| Q066 | `compareAtPrice=null` có nghĩa gì? | Không có giá niêm yết để so sánh, khác với giá 0. | products field null sample |
| Q067 | Vì sao `order_items.position` cần tồn tại? | Giữ thứ tự dòng ổn định khi hydrate order từ collection riêng. | mongoCollections serialize/hydrate |
| Q068 | `orders.total` phải thoả invariant nào? | Bằng subtotal - các khoản giảm + ship, chặn dưới 0 tại lúc tạo. | routes/orders.js createOrderInState |
| Q069 | `orders.history` có thay thế audit log bất biến không? | Chưa; nó là mảng trong document và có thể bị sửa cùng order. | orders.history implementation |
| Q070 | Tại sao `payments.currency` đang có cả `vnd` và `VND`? | Dữ liệu/provider chưa chuẩn hoá casing; so sánh phải normalize. | live payments field enum |
| Q071 | `payments.card.last4` có phải dữ liệu thẻ đầy đủ không? | Không; chỉ metadata hiển thị, backend không nhận/lưu PAN hoặc CVC. | paymentsStripe.js CardField flow |
| Q072 | Vì sao `return_requests.paymentId` nullable? | COD chưa thu qua gateway có thể không có payment cần hoàn online. | returns.js needsGatewayRefund |
| Q073 | `reviews.userName` có dư thừa với users.name không? | Đó là snapshot tên hiển thị lúc review; cần nêu policy khi user yêu cầu ẩn danh. | routes/reviews.js create review |
| Q074 | `review_reactions.value` nhận những giá trị nào? | Chỉ `helpful` hoặc `not_helpful`, app route kiểm tra enum. | routes/reviews.js reaction |
| Q075 | Vì sao `profiles.userId` có unique index? | Bản số vật lý là user 1 : 0..1 profile hiện tại. | uq_profiles_user |
| Q076 | Vì sao `payments.orderId` chỉ index thường? | Cho phép nhiều attempt cho một order; unique sẽ khoá cứng 1:1. | live index payments |
| Q077 | Vì sao `orders.clientRequestId` cần unique DB? | Application lookup không đủ ở nhiều instance; duplicate order vẫn có thể lọt. | orders.js + missing index |

---

## Quan hệ

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q078 | Hai dây từ vouchers tới users có cùng nghĩa không? | Không: ownerId là người cấp, userId là người nhận mục tiêu. | erd.drawio relationship rows |
| Q079 | Vì sao order nối voucher và vẫn lưu discountCode/discount? | FK giải thích nguồn rule; snapshot giữ kết quả tiền lịch sử. | orders serialization + snapshot fields |
| Q080 | `reviews.orderId` chứng minh điều gì và chưa chứng minh điều gì? | Chứng minh order nguồn; code còn kiểm tra completed/successful và chứa product. | reviewPurchaseOrders |
| Q081 | Quan hệ chats–products có bắt buộc không? | Không; message chung không cần productId, message theo sản phẩm mới có context. | ERD + chats fields |
| Q082 | Tại sao flagcards–products là N:N nhưng không có bridge collection? | Implementation nhúng `recommendedProductIds[]` vì mapping nhỏ/đọc cùng card. | flagcards schema |
| Q083 | `flagcard_collections.cardIds[]` đánh đổi gì? | Đọc aggregate nhanh nhưng khó unique/atomic nhiều instance và analytics theo card. | flagcard collection implementation |
| Q084 | Xoá category đang có products nên làm gì? | RESTRICT hoặc reassign; cascade products sẽ làm mất catalog hàng loạt. | products.categoryId |
| Q085 | Xoá review thì reactions nên xử lý thế nào? | Cascade mapping vì reaction không có nghĩa độc lập; nếu chỉ hide review có thể giữ audit. | review_reactions relationship |
| Q086 | Product archive có nên xoá wishlist rows không? | Tuỳ UX: có thể giữ để báo unavailable; phải quy định rõ, không cascade mù. | wishlist/product lifecycle |
| Q087 | Một order có thể có nhiều return request không? | Có; code trả danh sách và hỗ trợ các đợt/item khác nhau. | routes/orders.js comment + returns |

---

## MongoDB

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q088 | Logical FK khác database-native FK thế nào? | Logical FK chỉ là field/ý nghĩa; MongoDB không tự reject orphan như RDBMS. | relationshipErrors() |
| Q089 | `relationshipErrors()` chạy lúc nào? | Trước write ở nhánh Mongo và trong persistStateToCollections; nhánh JSON writeFile không gọi. | lib/store.js/mongoCollections.js |
| Q090 | Vì sao JSON fallback là chế độ suy giảm chứ không phải nguồn ngang hàng? | MongoDB là primary; fallback giữ demo sống nhưng enforcement/persistence khác. | store.initialize/activateFileFallback |
| Q091 | Debounce 40 ms tối ưu gì và đánh đổi gì? | Gộp write Mongo; đổi lại acknowledged response có thể đi trước durable persistence. | scheduleMongoPersistence |
| Q092 | Nếu write liên tục dưới 40 ms thì mất tối đa một write đúng không? | Không chắc; timer bị reset, có thể còn nhiều thay đổi chưa flush từ lần persist cuối. | store.js debounce logic |
| Q093 | `replaceCollection()` cập nhật theo document hay thay cả projection? | Upsert toàn bộ docs rồi delete `_id` không còn trong snapshot; đây là snapshot replacement theo collection. | mongoCollections.js replaceCollection |
| Q094 | Vì sao giữ toàn state trong RAM là trần scale? | Mỗi read structuredClone toàn state và mỗi persist tuần tự nhiều collection. | store.js read/write |
| Q095 | Index unique có làm mọi write atomic đa collection không? | Không; nó chỉ bảo vệ invariant của index trên một collection. | MongoDB design + code |
| Q096 | Có schema validator MongoDB không? | Không thấy khai báo validator; cấu trúc/ràng buộc chủ yếu nằm ở code và indexes. | mongoCollections ensureMongoIndexes |
| Q097 | Vì sao `_id` và `id` cùng tồn tại? | `_id` là PK vật lý Mongo; `id` giữ API/domain ID nhất quán khi hydrate state. | serializeDirectRow + indexes |

---

## Concurrency

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q098 | Test 50 lượt/tồn 5 chứng minh phạm vi nào? | Chỉ chứng minh synchronous store update trong một process/file-mode test. | checkout-concurrency.test.js |
| Q099 | Test đó không chứng minh điều gì? | Không chứng minh nhiều process/pod cùng ghi Mongo an toàn. | test comment LIMIT |
| Q100 | Atomic conditional stock update có điều kiện gì? | Update variant khi `stock >= qty`, decrement trong cùng lệnh, kiểm modifiedCount. | đề xuất production |
| Q101 | Application check email an toàn trong một process tới đâu? | Mutator sync serialize được register route hiện tại; async/multi-instance vẫn cần DB unique. | auth register + store.update |
| Q102 | Review route recheck duplicate sau moderation để làm gì? | Đóng cửa sổ async trong cùng process; chưa thay DB unique ở nhiều instance. | reviews.js lines 55-68 |
| Q103 | `clientRequestId` có nên unique toàn hệ thống không? | Nên scope theo user/channel; unique toàn cục phụ thuộc cách client sinh ID. | orders create logic |
| Q104 | Webhook Stripe và reconcile cùng chạy có gửi hai biên nhận không? | Code ghi `wasPaid` và chỉ gửi khi chuyển sang paid lần đầu trong state hiện tại. | finalizeStripe* |
| Q105 | Refund webhook lặp được chống bằng gì? | Upsert entry theo refund.id trong `payment.refunds`. | applyStripeRefundToState |

---

## Thanh toán

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q106 | Ai là source of truth khi DB nói pending nhưng Stripe nói succeeded? | Provider; route read/reconcile truy vấn ngược rồi finalize local state. | payments.js + stripe/reconcile |
| Q107 | VNPay return và IPN cùng tới thì sao? | Nếu payment đã paid, finalize trả `already_done`, không gửi receipt lần nữa. | paymentsVnpay.js |
| Q108 | Stripe idempotency key đang dùng ở đâu? | Tạo PaymentIntent/Checkout và refund dùng key dẫn xuất từ order/attempt/request. | paymentsStripe.js |
| Q109 | `transactionCode` có unique index chưa? | Chưa; hiện chỉ có index id/orderId/userId ở payments. | live Mongo indexes |
| Q110 | 94 orders/94 payments có kết luận 1:1 được không? | Không; current data là 1:1, index orderId non-unique cho phép 1:N. | live counts/index |
| Q111 | Partial refund làm order luôn `returned` không? | Không; chỉ toàn bộ item/amount mới chuyển returned, partial giữ lịch sử phù hợp. | returns.js/applyStripeRefundToState |

---

## Tình huống

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q112 | Product đổi tên sau khi mua: field nào bảo vệ lịch sử? | `order_items.productName` cùng slug/màu/cỡ/price snapshot. | live order_items fields |
| Q113 | User đổi email: những FK nào phải update? | Không FK nào nếu đều trỏ `users.id`; email chỉ là thuộc tính đăng nhập. | ERD logical FKs |
| Q114 | Admin khoá user khi order đang shipping thì sao? | Login bị chặn nhưng order/chứng từ giữ nguyên; fulfillment là vòng đời độc lập. | auth status + order data |
| Q115 | Voucher hết hạn giữa lúc mở giỏ và tạo order thì sao? | Server validate lại lúc create order và từ chối nếu hết hạn. | orders validateVoucher |
| Q116 | MongoDB lỗi sau response nhưng trước persist thì sao? | Write đã ở RAM; persist catch chuyển fallback, nhưng durability/consistency cần nói rõ và đối soát. | store schedule/catch fallback |
| Q117 | Xoá asset Cloudinary nhưng URL Mongo còn thì hậu quả gì? | Broken media; cần outbox/retry hoặc trạng thái đồng bộ asset. | media storage boundary |

---

## Đổi yêu cầu

| ID | Câu hỏi | Trả lời nhanh 15–30 giây | Evidence / đang kiểm tra |
|---:|---|---|---|
| Q118 | Một user nhiều provider đăng nhập nên thêm gì? | Tách `user_identities(userId,provider,providerSubject)` với unique provider+subject. | current googleId/authProviders limitation |
| Q119 | Một order chia nhiều shipment nên thêm gì? | `shipments` và `shipment_items`; order 1:N shipments, line item phân bổ theo quantity. | current order has one fulfillment state |
| Q120 | Voucher chỉ áp cho một category nên thêm gì? | Mapping `voucher_categories` hoặc scope rule; checkout kiểm item category. | current voucher scope limitation |

---

## 24 câu trọng tâm — trả lời nhanh, trả lời sâu, câu truy đuổi

Các câu dưới đây là phần bắt buộc luyện thành tiếng. `[THỰC TẾ]` là hiện trạng đã đối chiếu; `[ĐỀ XUẤT]` không được nói như tính năng đã triển khai.

### F01. Email đã có index, vì sao vẫn chưa an toàn?

**Trả lời nhanh (15–30 giây):** Index thường chỉ tăng tốc lookup; không chặn trùng.

**Trả lời sâu (45–90 giây):** Register kiểm tra trong `store.update()` nên cùng một process hiện được serialize. Nhưng hai instance có state riêng và MongoDB không có UNIQUE email, nên cả hai có thể cùng vượt check. Lớp đúng là unique index trên email chuẩn hoá, rồi map duplicate-key thành 409.

**Câu hỏi truy đuổi:** Nếu email khác hoa/thường thì unique index xử lý thế nào?

**Evidence:** ``auth/register` + live index `users.email` non-unique.`

### F02. Tại sao `id`, không dùng email làm PK?

**Trả lời nhanh (15–30 giây):** `id` ổn định; email là dữ liệu nghiệp vụ có thể đổi.

**Trả lời sâu (45–90 giây):** Các bảng con trỏ vào `users.id`, nên đổi email không gây cập nhật dây chuyền. UNIQUE email và PK giải quyết hai việc khác nhau: chống trùng và định danh tham chiếu.

**Câu hỏi truy đuổi:** Nếu merge hai tài khoản Google/password thì giữ id nào?

**Evidence:** `ERD user FKs + routes/auth.js.`

### F03. Tại sao stock ở variant?

**Trả lời nhanh (15–30 giây):** Tồn kho khác nhau theo màu/cỡ.

**Trả lời sâu (45–90 giây):** Một product là khái niệm khách duyệt, còn variant là đơn vị kho xuất. UNIQUE `(productId,colorName,size)` ngăn hai ô tồn cho cùng selection; `sku` unique phục vụ kho.

**Câu hỏi truy đuổi:** Nếu có nhiều warehouse thì thêm bảng nào?

**Evidence:** `Live product_variants indexes/fields.`

### F04. Hai khách mua món cuối cùng thì sao?

**Trả lời nhanh (15–30 giây):** Một process hiện serialize check và decrement; nhiều instance chưa an toàn.

**Trả lời sâu (45–90 giây):** Test 50 request trên stock 5 chứng minh synchronous `store.update()` không oversell trong một process/file mode. Nó không chứng minh distributed safety. Production cần conditional decrement hoặc transaction ở Mongo.

**Câu hỏi truy đuổi:** modifiedCount=0 phải trả HTTP gì?

**Evidence:** `checkout-concurrency.test.js + orders.js.`

### F05. Lưu price hai nơi có vi phạm chuẩn hoá?

**Trả lời nhanh (15–30 giây):** Không; đó là hai sự thật ở hai thời điểm.

**Trả lời sâu (45–90 giây):** `products.price` trả lời giá hiện tại; `order_items.price` trả lời giá khách đã chốt. Nếu product đổi mà order item không phải đổi theo, trường thứ hai là historical snapshot.

**Câu hỏi truy đuổi:** Còn productName/colorName/address có cùng logic không?

**Evidence:** `orders.js normalized items + live order_items.`

### F06. MongoDB cho embed items, sao tách `order_items`?

**Trả lời nhanh (15–30 giây):** Tách vật lý để index/query/analytics theo product và order.

**Trả lời sâu (45–90 giây):** Runtime hydrate `orders.items` để ứng dụng đọc aggregate tiện, nhưng Mongo source tách `order_items`. Ưu là analytics/index rõ; nhược là persist/hydrate phức tạp và phải thống nhất source of truth.

**Câu hỏi truy đuổi:** Nếu chỉ embed thì query top product bán chạy thế nào?

**Evidence:** `mongoCollections serializeOrders/hydrateOrders.`

### F07. 94 order và 94 payment nghĩa là 1:1?

**Trả lời nhanh (15–30 giây):** Không; đó chỉ là current data.

**Trả lời sâu (45–90 giây):** `payments.orderId` non-unique nên allowed design là order 1:N payment attempts. Business cần retry sau failed; sample hiện chưa tạo nhiều attempt trên một order.

**Câu hỏi truy đuổi:** Muốn ép 1:1 cần constraint nào?

**Evidence:** `Live counts and indexes.`

### F08. Webhook gửi 5 lần thì sao?

**Trả lời nhanh (15–30 giây):** Handler kiểm trạng thái/id provider và cập nhật idempotent.

**Trả lời sâu (45–90 giây):** Stripe giữ `wasPaid`, history chống trùng theo txn, refund upsert theo refund.id; VNPay trả `already_done` khi payment đã paid. Tuy nhiên transactionCode chưa unique ở DB nên nhiều instance vẫn còn lớp yếu.

**Câu hỏi truy đuổi:** Side effect gửi email có thể lặp ở crash window nào?

**Evidence:** `paymentsStripe.js/paymentsVnpay.js.`

### F09. Reviews chặn một user review một product bằng gì?

**Trả lời nhanh (15–30 giây):** Hai application checks, chưa có composite unique DB.

**Trả lời sâu (45–90 giây):** Route check trước moderation rồi recheck trong synchronous update để đóng cửa sổ await trong một process. Hai instance vẫn có thể cùng push và persist; Mongo cần UNIQUE `(userId,productId)`.

**Câu hỏi truy đuổi:** Tại sao wishlist đã có constraint còn reviews chưa?

**Evidence:** `reviews.js + live indexes.`

### F10. MongoDB không có FK thì 50 dây là gì?

**Trả lời nhanh (15–30 giây):** Đó là logical relationships; một phần được app enforce.

**Trả lời sâu (45–90 giây):** Field refs và index mô tả mô hình, nhưng MongoDB không tự reject orphan. `relationshipErrors()` kiểm một tập quan hệ trước write Mongo; JSON fallback và nhiều quan hệ telemetry chưa được phủ.

**Câu hỏi truy đuổi:** Một orphan ở voucher_redemptions hiện bị lớp nào bắt?

**Evidence:** `mongoCollections.relationshipErrors.`

### F11. Fallback JSON khác Mongo mode ở điểm nào?

**Trả lời nhanh (15–30 giây):** JSON write không gọi `assertValid()`.

**Trả lời sâu (45–90 giây):** Trong Mongo mode, `write()` normalize rồi assert relationship; file mode đi thẳng `writeFile()`. Vì vậy cùng một mutation có thể được chấp nhận ở fallback nhưng bị từ chối ở Mongo.

**Câu hỏi truy đuổi:** Nên đặt validation ở đâu để hai nhánh đồng nhất?

**Evidence:** `lib/store.js write/writeFile.`

### F12. Cửa sổ 40 ms có nghĩa mất tối đa một write?

**Trả lời nhanh (15–30 giây):** Không thể khẳng định tối đa một.

**Trả lời sâu (45–90 giây):** Mỗi write reset debounce timer và response có thể trả trước persist. Khi write liên tục, nhiều thay đổi từ lần persist cuối có thể còn ở RAM; crash lúc đó mất phần chưa flush. Cần nói đúng phạm vi thay vì lặp claim cũ.

**Câu hỏi truy đuổi:** Write-through sẽ đổi latency ra sao?

**Evidence:** `scheduleMongoPersistence.`

### F13. Product bị xoá thì order cũ sao?

**Trả lời nhanh (15–30 giây):** Snapshot giữ hiển thị; Mongo integrity hiện chặn orphan khi write.

**Trả lời sâu (45–90 giây):** Order item giữ name/slug/color/size/price. Vì relationshipErrors yêu cầu product còn tồn tại trong Mongo mode, hard delete product đã bán bị chặn như RESTRICT; nhưng đây là hệ quả chứ chưa phải policy tường minh.

**Câu hỏi truy đuổi:** Nếu legal yêu cầu xoá product content thì giữ tối thiểu gì?

**Evidence:** `orders snapshot + relationshipErrors.`

### F14. User bị xoá thì chứng từ sao?

**Trả lời nhanh (15–30 giây):** Hiện không có delete account; dùng status locked.

**Trả lời sâu (45–90 giây):** Đơn/payment phải giữ để đối soát, nhưng giữ toàn PII vô thời hạn không phải đáp án. Thiết kế production cần anonymize user/customer snapshot theo retention mà không xoá số tiền/chứng từ.

**Câu hỏi truy đuổi:** Hash email có đủ gọi là anonymize không?

**Evidence:** `auth status + no delete route.`

### F15. Ai là source of truth thanh toán?

**Trả lời nhanh (15–30 giây):** Stripe/VNPay là nguồn sự thật về tiền; DB là local projection/audit.

**Trả lời sâu (45–90 giây):** Khi local pending nhưng provider succeeded, read/reconcile truy vấn provider và finalize state. Không được tin callback client tự khai; phải verify signature/status/amount.

**Câu hỏi truy đuổi:** Provider unavailable thì có được tự chuyển paid không?

**Evidence:** `payment finalize/reconcile routes.`

### F16. Partial refund được lưu thế nào?

**Trả lời nhanh (15–30 giây):** Mỗi refund có id/amount/status trong `payments.refunds`.

**Trả lời sâu (45–90 giây):** Code upsert theo refund.id, cộng `refundedAmount` từ các refund succeeded và chỉ đánh dấu order returned khi hoàn toàn bộ/đủ item. Partial refund giữ order lịch sử phù hợp.

**Câu hỏi truy đuổi:** Hai refund đồng thời có thể vượt remaining amount không?

**Evidence:** `paymentsStripe issue/apply refund.`

### F17. Vì sao địa chỉ vừa có bảng riêng vừa snapshot trong order?

**Trả lời nhanh (15–30 giây):** Hai vòng đời khác nhau: address book hiện tại và chứng từ giao hàng lịch sử.

**Trả lời sâu (45–90 giây):** Address record được user sửa/xoá; order.address/addressDetails không đổi. Đây là denormalization có chủ đích, giống price snapshot.

**Câu hỏi truy đuổi:** Nếu khách sửa địa chỉ sau khi order pending thì policy nào thắng?

**Evidence:** `addresses + orders snapshot.`

### F18. Một user nhiều role thì sửa gì?

**Trả lời nhanh (15–30 giây):** Thêm roles và user_roles N:N.

**Trả lời sâu (45–90 giây):** Current `users.role` phù hợp hierarchy đơn. Khi nhiều role đồng thời, `roles(id,name)` và `user_roles(userId,roleId)` với composite unique; migration tạo mapping từ role hiện tại.

**Câu hỏi truy đuổi:** Permission nên nằm ở role hay hard-code?

**Evidence:** `current ROLE_RANK + proposed schema.`

### F19. Một product nhiều category thì sửa gì?

**Trả lời nhanh (15–30 giây):** Thêm product_categories bridge.

**Trả lời sâu (45–90 giây):** Migrate `products.categoryId` thành mỗi product một row bridge, thêm UNIQUE `(productId,categoryId)`, đổi query/catalog rồi mới bỏ field cũ.

**Câu hỏi truy đuổi:** Có nên giữ primary category không?

**Evidence:** `current single categoryId.`

### F20. Một order nhiều shipment thì sửa gì?

**Trả lời nhanh (15–30 giây):** Thêm shipments và shipment_items.

**Trả lời sâu (45–90 giây):** Shipment thuộc order; shipment_items phân bổ qty từ order_items. Trạng thái giao không còn là một status duy nhất trên order; order status được tổng hợp từ shipment states.

**Câu hỏi truy đuổi:** Một line item tách hai kiện biểu diễn thế nào?

**Evidence:** `current single order fulfillment state.`

### F21. Index càng nhiều càng tốt?

**Trả lời nhanh (15–30 giây):** Không; index tăng tốc query nhưng làm write/tốn RAM/disk.

**Trả lời sâu (45–90 giây):** Phải chỉ ra query. Ví dụ orders(userId,createdAt) phục vụ lịch sử đơn mới nhất; interactions append-heavy cần cân nhắc TTL/aggregate trước khi thêm nhiều index.

**Câu hỏi truy đuổi:** Index nào đang thiếu cho login correctness chứ không chỉ performance?

**Evidence:** `ensureMongoIndexes + route queries.`

### F22. 3NF luôn tốt nhất trong MongoDB?

**Trả lời nhanh (15–30 giây):** Không; logical normalization và physical document design là hai lớp.

**Trả lời sâu (45–90 giây):** Master data được chuẩn hoá để tránh anomaly; chứng từ snapshot và lookup đóng có thể denormalize vì vòng đời/read pattern. Cần nói trade-off, không dùng 1NF như khẩu hiệu máy móc.

**Câu hỏi truy đuổi:** Màu/size nhúng khác price snapshot ở động cơ nào?

**Evidence:** `ERD logical vs collection physical.`

### F23. `_id` và `id` có dư thừa?

**Trả lời nhanh (15–30 giây):** Hai field phục vụ physical identity và domain/API identity.

**Trả lời sâu (45–90 giây):** Serializer dùng domain id làm `_id` để upsert, đồng thời giữ `id` cho state/API. Đây có chi phí lặp; nếu refactor có thể chuẩn hoá một nguồn, nhưng migration và API compatibility phải tính.

**Câu hỏi truy đuổi:** Unique id index còn cần khi `_id` bằng id không?

**Evidence:** `mongoCollections serialization/indexes.`

### F24. Nếu bị chỉ đúng một điểm yếu, nên trả lời thế nào?

**Trả lời nhanh (15–30 giây):** Nêu hiện trạng, tình huống hỏng, phạm vi và cách sửa.

**Trả lời sâu (45–90 giây):** Ví dụ email: hiện app check, một process tạm an toàn, multi-instance có race; giải pháp là unique index. Không nói hệ thống hoàn hảo và không bịa transaction.

**Câu hỏi truy đuổi:** Đâu là evidence trong source?

**Evidence:** `Phần Y và các nhãn THỰC TẾ/ĐỀ XUẤT.`

## Năm câu cứu nguy

**Khi không biết:** _"Chỗ này em chưa kiểm chứng nên không dám khẳng định. Theo cách cài đặt hiện tại thì em nghĩ là… , nhưng để chắc chắn phải xem lại phần… trong mã nguồn."_

**Khi bị chỉ đúng điểm yếu:** _"Ở phiên bản hiện tại nhóm triển khai theo cách này. Khi rà soát lại chúng em nhận thấy nó có hạn chế ở tình huống thầy cô vừa nêu. Thiết kế tốt hơn là… , và lý do nhóm chưa làm là… "_

**Khi bị hỏi về phạm vi chưa làm:** _"Thiết kế hiện tại đáp ứng đúng phạm vi của phiên bản này. Nếu mở rộng sang… thì cần thêm bảng… với khoá chính ghép… — đây là một lần chuyển dữ liệu, không phải viết lại hệ thống."_

**Khi bị hỏi production scale:** _"Unit test hiện tại chứng minh phạm vi một process. Khi chạy nhiều instance, invariant phải chuyển xuống unique constraint, atomic update hoặc transaction ở database."_

**Khi tiền đề câu hỏi trộn current data với design:** _"Em xin tách ba lớp: dữ liệu hiện có, schema cho phép và business rule. Ba lớp này không tự động giống nhau."_
