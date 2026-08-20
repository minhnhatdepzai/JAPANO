# ERD DEFENSE MATRIX — JAPANO

Hồ sơ bảo vệ rút gọn cho từng thực thể. Bản đầy đủ ở `ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.docx`.

**36 thực thể · 50 quan hệ · 35 collection.** Số liệu đối chiếu từ `erd.drawio`, MongoDB đang chạy và mã nguồn backend.

Nhãn: `[THỰC TẾ]` xác nhận được · `[SUY LUẬN]` suy ra hợp lý · `[ĐỀ XUẤT]` chưa có, nên làm.

---

## Biến Thể Sản Phẩm

**Hạng:** S · **Collection thật:** `product_variants` (317 bản ghi)

**Câu mở đầu:**
Đây là đơn vị kho thật; UNIQUE `(productId,colorName,size)` ngăn tách đôi tồn.

**Vai trò ngoài đời:**
Một tổ hợp màu và cỡ cụ thể — đơn vị thật mà kho lấy hàng ra. 35 sản phẩm sinh 317 biến thể.

**Nếu bỏ bảng/thực thể này:**
Không biết size/màu nào còn hàng; hết L bị hiểu sai thành hết cả sản phẩm.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã biến thể` · `Mã sản phẩm` · `Mã màu sắc` · `Mã kích thước` · `Mã SKU biến thể` · `Số lượng tồn kho` · `Giá riêng (tuỳ chọn)` · `Thứ tự hiển thị`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `colorName` · `colorHex` · `size` · `sku` · `stock` · `id` · `productId` · `position`.  Tuỳ chọn/không phủ hết sample: `price`(1%).

**Chỉ mục thật:** `id` **UNIQUE** · `productId` · `sku` **UNIQUE** · `productId+colorName+size` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `product_variants.productId` → **Sản Phẩm** · product 1 → N variants. Một product có nhiều tổ hợp màu–cỡ. Xoá: CASCADE variant; order history dùng snapshot.
- `product_variants.colorName/colorHex` → **Màu Sắc** · color 1 → N variants (logic). Nhiều variant dùng cùng khái niệm màu. Xoá: Hiện nhúng; không có parent vật lý để xoá.
- `product_variants.size` → **Kích Thước** · size 1 → N variants (logic). Nhiều variant dùng cùng kích cỡ. Xoá: Hiện nhúng; không có parent vật lý để xoá.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Cascade theo product nếu chưa có tham chiếu giao dịch; lịch sử vẫn do `order_items` snapshot.

**Tình huống thực tế:**
Áo size M còn 5 nhưng size L còn 0; chỉ L phải báo hết.

**Real-world drills:**
- Hết cỡ L thì trang sản phẩm hiện gì? → Tổng tồn các biến thể; bằng 0 mới là hết hàng.
- Hai người cùng mua cái cuối cùng? → Kiểm tra và trừ kho trong cùng một hàm sửa đổi đồng bộ.

**Câu hội đồng dễ truy đuổi:**
- Sao tồn kho không để ở `products`?
- Ràng buộc ghép ba cột để làm gì?
- Cột `price` ở biến thể khác gì `price` ở sản phẩm?
- Bán nhiều kho thì sao?
- Hai backend cùng mua món cuối cùng thì thao tác nào phải atomic?

**Điểm yếu thật:**
`Màu Sắc` và `Kích Thước` có trên sơ đồ nhưng không thành collection — nhúng thẳng vào biến thể.

**Hướng mở rộng [ĐỀ XUẤT]:**
Atomic conditional update theo `_id`/stock hoặc transaction; thêm `variant_stock` khi nhiều kho.

**Best defense:**
Ràng buộc duy nhất `(productId, colorName, size)` mã hoá đúng một quy tắc nghiệp vụ và ngăn tồn kho bị tách đôi.

---

## Bộ Sưu Tầm Thẻ Của Người Dùng

**Hạng:** B · **Collection thật:** `flagcard_collections` (4 bản ghi)

**Câu mở đầu:**
Đây là aggregate tiến trình của user; card IDs nhúng để đọc một lần.

**Vai trò ngoài đời:**
Tiến trình sưu tầm card và lịch sử award của một user.

**Nếu bỏ bảng/thực thể này:**
Không biết user đã nhận thẻ nào, từ đơn nào và đã mở thưởng chưa.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã bộ sưu tầm` · `Mã người dùng` · `Mã thẻ địa danh` · `Danh sách phần thưởng` · `Ngày bắt đầu sưu tầm` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `userId` · `cardIds` · `awards` · `createdAt` · `updatedAt`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Logical FK / cardinality / FK owner:**
- `flagcard_collections.userId` → **Người Dùng** · user 1 → 0..N collections. Collection ghi tiến trình/award của user. Xoá: Ẩn danh hoặc giữ audit reward.
- `flagcard_collections.cardIds[]` → **Thẻ Địa Danh** · collection N ↔ N flagcards (array). Một collection chứa nhiều card; card thuộc nhiều user. Xoá: Không cascade card khỏi lịch sử award.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Giữ award history; ẩn danh user theo chính sách.

**Tình huống thực tế:**
Webhook lặp không được trao cùng card hai lần; collection kiểm tra cardIds trước khi push.

**Câu hội đồng dễ truy đuổi:**
- Hai instance cùng trao một card thì lớp nào chống duplicate?

**Điểm yếu thật:**
`cardIds[]` nhúng N:N, không có index/DB constraint cho từng phần tử.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tách award ledger nếu cần chống trùng ở nhiều instance và audit theo order.

**Best defense:**
Đây là aggregate tiến trình của user; card IDs nhúng để đọc một lần.

---

## Chi Tiết Giỏ Hàng

**Hạng:** A · **Collection thật:** `cart_items` (6 bản ghi)

**Câu mở đầu:**
Đây là mapping có dữ liệu riêng; unique bốn trường giữ đúng một dòng mỗi lựa chọn.

**Vai trò ngoài đời:**
Lựa chọn tạm thời của user theo product–màu–size và quantity.

**Nếu bỏ bảng/thực thể này:**
Không đồng bộ giỏ giữa thiết bị và không phân biệt hai biến thể cùng product.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã chi tiết giỏ hàng` · `Mã người dùng` · `Mã sản phẩm` · `Màu sắc` · `Số lượng` · `Kích thước` · `Thời gian cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `userId` · `productId` · `color` · `size` · `quantity` · `updatedAt` · `id`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(67%).

**Chỉ mục thật:** `id` **UNIQUE** · `userId+productId+color+size` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `cart_items.userId` → **Người Dùng** · user 1 → N cart lines. Một user có nhiều dòng giỏ. Xoá: CASCADE/clear khi user xoá.
- `cart_items.productId` → **Sản Phẩm** · product 1 → N cart lines. Một product nằm trong nhiều giỏ. Xoá: Xoá/ẩn cart line khi product unavailable.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Xoá tự do khi quantity về 0/checkout; không ảnh hưởng product.

**Tình huống thực tế:**
Cùng áo size M và L là hai dòng hợp lệ; duplicate đúng selection bị unique chặn.

**Câu hội đồng dễ truy đuổi:**
- Vì sao unique bốn cột mà không chỉ `(userId,productId)`?

**Điểm yếu thật:**
Route ghi bằng userId trong body ở một số luồng; cần nhất quán authorization theo JWT.

**Hướng mở rộng [ĐỀ XUẤT]:**
Dùng variantId làm FK và TTL/cleanup cho giỏ bỏ quên.

**Best defense:**
Đây là mapping có dữ liệu riêng; unique bốn trường giữ đúng một dòng mỗi lựa chọn.

---

## Chi Tiết Sản Phẩm

**Hạng:** B · **Collection thật:** `product_details` (35 bản ghi)

**Câu mở đầu:**
Đây là phần mở rộng 0..1 của sản phẩm; `productId` unique chứng minh bản số.

**Vai trò ngoài đời:**
Khối mô tả dài, câu chuyện, tags, rating và sold tách khỏi lõi catalog.

**Nếu bỏ bảng/thực thể này:**
Product bị phình hoặc mất nội dung marketing/thuộc tính phục vụ gợi ý.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã chi tiết sản phẩm` · `Mã sản phẩm` · `Mô tả sản phẩm` · `Câu chuyện sản phẩm` · `Mã màu đại diện` · `Thẻ từ khóa` · `Thẻ nhận diện hình ảnh` · `Điểm đánh giá trung bình` · `Số lượng đã bán`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `productId` · `description` · `story` · `colorHex` · `tags` · `visualTags` · `rating` · `sold`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Chỉ mục thật:** `productId` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `product_details.productId` → **Sản Phẩm** · product 1 → 0..1 detail. Một product có tối đa một khối chi tiết. Xoá: CASCADE phần chi tiết khi product được xoá hợp lệ.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Sống theo product; có thể cascade khi product chưa từng giao dịch bị xoá.

**Tình huống thực tế:**
Admin sửa câu chuyện sản phẩm mà không làm thay đổi mã, giá hay tồn kho.

**Câu hội đồng dễ truy đuổi:**
- Nếu rating tính từ reviews, tại sao còn lưu `rating`?

**Điểm yếu thật:**
`rating`/`sold` là dữ liệu dẫn xuất, có nguy cơ lệch nếu cập nhật không đồng bộ.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tính lại định kỳ hoặc dùng pipeline sự kiện; version nội dung nếu cần audit.

**Best defense:**
Đây là phần mở rộng 0..1 của sản phẩm; `productId` unique chứng minh bản số.

---

## Chi Tiết Đơn Hàng

**Hạng:** S · **Collection thật:** `order_items` (154 bản ghi)

**Câu mở đầu:**
Đây vừa là bảng nối N:N vừa là historical snapshot, không phải duplicate vô nghĩa.

**Vai trò ngoài đời:**
Một dòng hàng trong đơn. Vừa giải quyết quan hệ nhiều–nhiều, vừa giữ bản chụp lịch sử.

**Nếu bỏ bảng/thực thể này:**
Quan hệ N:N không có chỗ lưu số lượng/giá lịch sử; đơn cũ phụ thuộc catalog hiện tại.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã chi tiết đơn hàng` · `Mã đơn hàng` · `Mã sản phẩm` · `Tên sản phẩm` · `Đường dẫn sản phẩm` · `Tên màu sắc` · `Mã màu Hex` · `Kích cỡ` · `Số lượng đặt mua` · `Đơn giá mua` · `Thứ tự hiển thị`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `productId` · `colorName` · `colorHex` · `size` · `qty` · `price` · `id` · `orderId` · `productSlug` · `productName` · `position`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Chỉ mục thật:** `id` **UNIQUE** · `orderId` · `productId`

**Logical FK / cardinality / FK owner:**
- `order_items.orderId` → **Đơn Hàng** · order 1 → N items. Một đơn gồm nhiều dòng hàng. Xoá: Không hard-delete chứng từ.
- `order_items.productId` → **Sản Phẩm** · product 1 → N sold lines. Một product xuất hiện ở nhiều đơn. Xoá: Không cascade lịch sử; snapshot giữ hiển thị.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Sống theo order về vòng đời nhưng chứng từ không bị hard-delete.

**Tình huống thực tế:**
Product đổi giá/tên hoặc bị archive, dòng đơn vẫn hiển thị đúng lịch sử.

**Real-world drills:**
- Giá sản phẩm đổi? → Dòng hàng giữ nguyên giá cũ.
- Sản phẩm bị xoá? → Vẫn hiển thị đủ nhờ chụp tên, màu, cỡ.

**Câu hội đồng dễ truy đuổi:**
- Sao không lưu mảng sản phẩm trong `orders`?
- Số lượng thuộc bảng nào?
- Lưu giá hai chỗ có dư thừa không?
- MongoDB nhúng mảng được mà, sao còn tách bảng?
- MongoDB cho embed array; tại sao implementation vẫn tách collection?

**Điểm yếu thật:**
Vừa nhúng mảng `items` trong `orders` vừa có collection `order_items` riêng — cần giải thích rõ đây là đánh đổi có chủ ý.

**Hướng mở rộng [ĐỀ XUẤT]:**
Giữ `order_items` làm nguồn vật lý; thêm variantId/SKU snapshot nếu kho cần đối soát sâu.

**Best defense:**
Chụp NĂM thuộc tính: tên, đường dẫn, màu, mã màu, cỡ, cộng giá. Đơn cũ luôn đúng dù sản phẩm đổi gì hoặc bị xoá.

---

## Cấu Hình Cửa Hàng

**Hạng:** C · **Collection thật:** `settings` (3 bản ghi)

**Câu mở đầu:**
Đây là cấu hình vận hành, không phải giao dịch; order chụp kết quả áp dụng.

**Vai trò ngoài đời:**
Singleton/nhóm document cấu hình phí ship, phương thức thanh toán và logo.

**Nếu bỏ bảng/thực thể này:**
Các route phải hard-code cấu hình và dễ lệch giữa admin/app.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã cấu hình` · `Tên cửa hàng` · `Hotline hỗ trợ` · `Email liên hệ` · `Địa chỉ cửa hàng` · `Phí vận chuyển` · `Thanh toán khi nhận hàng` · `Thanh toán Stripe` · `Thanh toán VNPay` · `Đường dẫn Logo`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: _không kết luận_.  Tuỳ chọn/không phủ hết sample: `mongo`(33%) · `cloudinary`(33%) · `ai`(33%) · `name`(33%) · `hotline`(33%) · `email`(33%) · `address`(33%) · `shipFee`(33%) · `cod`(33%) · `stripe`(33%).

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Không xoá singleton; cập nhật có kiểm soát và lưu lịch sử.

**Tình huống thực tế:**
Admin đổi phí ship, order mới dùng giá mới còn order cũ giữ `ship` snapshot.

**Câu hội đồng dễ truy đuổi:**
- Đổi phí ship giữa lúc checkout thì đơn lấy giá nào?

**Điểm yếu thật:**
Nhiều loại settings nằm chung collection; cần whitelist và audit ai đổi.

**Hướng mở rộng [ĐỀ XUẤT]:**
Version/audit log và schema validator theo `_id` từng nhóm.

**Best defense:**
Đây là cấu hình vận hành, không phải giao dịch; order chụp kết quả áp dụng.

---

## Danh Mục Sản Phẩm

**Hạng:** A · **Collection thật:** `categories` (5 bản ghi)

**Câu mở đầu:**
Đây là master data; product giữ `categoryId` thay vì chép tên.

**Vai trò ngoài đời:**
Nhóm phân loại dùng chung để duyệt catalog và đổi tên tập trung.

**Nếu bỏ bảng/thực thể này:**
Tên danh mục bị lặp trong products và phát sinh update/insert/delete anomaly.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã danh mục` · `Tên danh mục` · `Tên tiếng Nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `name` · `kanji`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Chỉ mục thật:** `id` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.
- Bảng con trỏ vào: **Sản Phẩm** qua `products.categoryId` (category 1 → N products)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
RESTRICT khi còn product, hoặc reassign trước khi xoá.

**Tình huống thực tế:**
Đổi tên danh mục một lần, mọi product theo `categoryId` thấy tên mới.

**Câu hội đồng dễ truy đuổi:**
- Nếu một product nhiều category, migration hiện tại ảnh hưởng gì?

**Điểm yếu thật:**
Thiết kế phẳng, chưa có parent-child; mỗi product chỉ có một category.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm `parentId` tự tham chiếu hoặc bảng `product_categories` cho N:N.

**Best defense:**
Đây là master data; product giữ `categoryId` thay vì chép tên.

---

## Danh Sách Sản Phẩm Yêu Thích

**Hạng:** A · **Collection thật:** `wishlist_items` (14 bản ghi)

**Câu mở đầu:**
Đây là N:N thuần, UNIQUE `(userId,productId)` là lớp chống trùng cuối.

**Vai trò ngoài đời:**
Bảng bắc cầu user–product cho một lựa chọn yêu thích.

**Nếu bỏ bảng/thực thể này:**
Không đồng bộ được wishlist và phải nhúng mảng vào user/product.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã yêu thích` · `Mã người dùng` · `Mã sản phẩm` · `Ngày thêm`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `userId` · `createdAt` · `productId`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(57%).

**Chỉ mục thật:** `id` **UNIQUE** · `userId+productId` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `wishlist_items.userId` → **Người Dùng** · user 1 → N wishlist rows. Một user thích nhiều product. Xoá: CASCADE mapping.
- `wishlist_items.productId` → **Sản Phẩm** · product 1 → N wishlist rows. Một product được nhiều user thích. Xoá: CASCADE/ẩn mapping khi archive.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Xoá tự do khi bỏ thích; product archive thì ẩn hoặc giữ để thông báo.

**Tình huống thực tế:**
Người dùng bấm yêu thích hai lần vẫn chỉ có một cặp.

**Câu hội đồng dễ truy đuổi:**
- Tại sao wishlist có composite unique còn reviews lại chưa có?

**Điểm yếu thật:**
Integrity có kiểm tra, nhưng sản phẩm archive cần quy tắc hiển thị rõ.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm created source/folder nếu cần nhiều danh sách.

**Best defense:**
Đây là N:N thuần, UNIQUE `(userId,productId)` là lớp chống trùng cuối.

---

## Hình Ảnh

**Hạng:** B · **Collection thật:** _không có — xem Phần 1.1 của tài liệu Word_

**Câu mở đầu:**
Đây là dấu vết thiết kế cũ; runtime chỉ dùng `product_media`.

**Vai trò ngoài đời:**
Thực thể logic cũ cho ảnh sản phẩm, hiện trùng chức năng với `product_media`.

**Nếu bỏ bảng/thực thể này:**
Bỏ riêng thực thể này không làm hỏng runtime vì không có collection tương ứng.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã hình ảnh` · `Mã sản phẩm` · `Đường dẫn hình ảnh` · `Thứ tự` · `Hình ảnh chính`

**Logical FK / cardinality / FK owner:**
- `legacy image.productId` → **Sản Phẩm** · product 1 → N images (logic). Ảnh cũ thuộc một product. Xoá: Thực thể trùng; phải gộp vào product_media.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Loại khỏi mô hình logic sau khi migration; không có dữ liệu runtime để cascade.

**Tình huống thực tế:**
Giảng viên chỉ vào hai bảng ảnh và hỏi tại sao trùng.

**Câu hội đồng dễ truy đuổi:**
- Tại sao ERD có hai bảng ảnh nhưng MongoDB chỉ có một collection?

**Điểm yếu thật:**
Đây là dư thừa thật trên ERD, không nên cố bảo vệ như hai nguồn dữ liệu độc lập.

**Hướng mở rộng [ĐỀ XUẤT]:**
Gộp vào `Hình Ảnh Giao Diện Sản Phẩm` và dùng trường `type=image|video`.

**Best defense:**
Đây là dấu vết thiết kế cũ; runtime chỉ dùng `product_media`.

---

## Hình Ảnh Giao Diện Sản Phẩm

**Hạng:** B · **Collection thật:** `product_media` (115 bản ghi)

**Câu mở đầu:**
Đây là metadata media; file ở Cloudinary, database chỉ giữ liên kết và thứ tự.

**Vai trò ngoài đời:**
Metadata media sản phẩm; file thật ở Cloudinary, MongoDB giữ URL/type/vị trí.

**Nếu bỏ bảng/thực thể này:**
Không sắp thứ tự được ảnh/video và product phải chứa mảng media cồng kềnh.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã hình ảnh giao diện` · `Mã sản phẩm` · `Đường dẫn URL` · `Loại tệp truyền thông` · `Thứ tự hiển thị` · `Ảnh đại diện`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `url` · `id` · `productId` · `type` · `position` · `isPrimary`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Chỉ mục thật:** `id` **UNIQUE** · `productId+position`

**Logical FK / cardinality / FK owner:**
- `product_media.productId` → **Sản Phẩm** · product 1 → N media. Một product có nhiều ảnh/video. Xoá: CASCADE metadata, dọn Cloudinary có bù trừ.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Cascade metadata khi xoá product; xoá asset Cloudinary cần quy trình bù trừ.

**Tình huống thực tế:**
Đổi ảnh chính chỉ đổi metadata; không nhét binary vào MongoDB.

**Câu hội đồng dễ truy đuổi:**
- Nếu xoá Mongo thành công nhưng xoá Cloudinary thất bại thì xử lý ra sao?

**Điểm yếu thật:**
Sơ đồ còn thêm thực thể `Hình Ảnh` trùng vai trò với collection này.

**Hướng mở rộng [ĐỀ XUẤT]:**
Gộp hai thực thể logic; thêm unique partial index cho một media chính mỗi product.

**Best defense:**
Đây là metadata media; file ở Cloudinary, database chỉ giữ liên kết và thứ tự.

---

## Hồ Sơ Người Dùng

**Hạng:** B · **Collection thật:** `profiles` (12 bản ghi)

**Câu mở đầu:**
Đây là hồ sơ cá nhân hoá 0..1 của một user, tách khỏi thông tin xác thực.

**Vai trò ngoài đời:**
Thông tin cơ thể, phong cách và ngân sách dùng để cá nhân hoá gợi ý.

**Nếu bỏ bảng/thực thể này:**
Tư vấn size/phong cách mất dữ liệu đầu vào hoặc phải nhồi dữ liệu riêng tư vào `users`.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã hồ sơ người dùng` · `Mã người dùng` · `Giới tính` · `Phong cách yêu thích` · `Tông màu da` · `Dịp mặc` · `Ngân sách dự kiến` · `Chiều cao (cm)` · `Cân nặng (kg)` · `Kích cỡ hay mặc` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `userId` · `preferredStyles` · `heightCm` · `weightKg` · `updatedAt` · `id`.  Tuỳ chọn/không phủ hết sample: `gender`(92%) · `skinTone`(92%) · `occasion`(92%) · `budget`(92%) · `usualSize`(92%) · `demoBatch`(42%).

**Chỉ mục thật:** `userId` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `profiles.userId` → **Người Dùng** · user 1 → 0..1 profile. Một user có tối đa một profile hiện tại. Xoá: Cascade/anonymize profile.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Xoá/ẩn danh theo chủ tài khoản; không kéo theo đơn hàng.

**Tình huống thực tế:**
Khách đổi cân nặng nhưng tài khoản và lịch sử đơn không đổi.

**Câu hội đồng dễ truy đuổi:**
- Vì sao `profiles.userId` unique và tại sao không gộp vào `users`?

**Điểm yếu thật:**
Toàn vẹn `profiles.userId` có kiểm tra, nhưng dữ liệu nhạy cảm cần chính sách lưu giữ rõ hơn.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tách lịch sử số đo nếu cần theo dõi biến đổi; mã hoá/giới hạn truy cập các trường nhạy cảm.

**Best defense:**
Đây là hồ sơ cá nhân hoá 0..1 của một user, tách khỏi thông tin xác thực.

---

## Kích Thước

**Hạng:** B · **Collection thật:** _không có — xem Phần 1.1 của tài liệu Word_

**Câu mở đầu:**
Đây là lookup logic được nhúng vì tập giá trị đóng và hiếm đổi.

**Vai trò ngoài đời:**
Từ điển kích cỡ logic và thứ tự sắp xếp size.

**Nếu bỏ bảng/thực thể này:**
Nếu size thay đổi theo bảng quy chuẩn/quốc gia thì thiếu nơi quản trị tập trung.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã kích thước` · `Tên kích thước` · `Thứ tự sắp xếp`

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.
- Bảng con trỏ vào: **Biến Thể Sản Phẩm** qua `product_variants.size` (size 1 → N variants (logic))

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Hiện sống trong variant; không có record cha để xoá.

**Tình huống thực tế:**
Hiện S/M/L/XL/XXL được nhúng trực tiếp vào `product_variants.size`.

**Câu hội đồng dễ truy đuổi:**
- Nếu bán giày EU/US/JP thì thiết kế size hiện tại đổi thế nào?

**Điểm yếu thật:**
Không có collection thật; thứ tự/chuẩn size nằm ở code thay vì dữ liệu.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tách `size_charts` và `sizes` khi hỗ trợ nhiều hệ size/quốc gia.

**Best defense:**
Đây là lookup logic được nhúng vì tập giá trị đóng và hiếm đổi.

---

## Lượt Sử Dụng Phiếu

**Hạng:** A · **Collection thật:** `voucher_redemptions` (5 bản ghi)

**Câu mở đầu:**
Đây vừa là bridge ba phía vừa là transaction ledger, không chỉ là bộ đếm.

**Vai trò ngoài đời:**
Ledger từng lần voucher được dùng bởi user cho order và số tiền giảm.

**Nếu bỏ bảng/thực thể này:**
Một counter không trả lời được ai dùng, đơn nào, lúc nào và giảm bao nhiêu.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã lượt sử dụng phiếu` · `Mã phiếu giảm giá` · `Mã người dùng` · `Mã đơn hàng` · `Mã áp dụng` · `Số tiền giảm` · `Ngày sử dụng`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `code` · `userId` · `orderId` · `discount` · `redeemedAt` · `voucherId`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(60%).

**Chỉ mục thật:** `id` **UNIQUE** · `voucherId` · `userId` · `orderId`

**Logical FK / cardinality / FK owner:**
- `voucher_redemptions.voucherId` → **Phiếu Giảm Giá** · voucher 1 → N redemptions. Một voucher có nhiều lượt dùng. Xoá: Không cascade ledger.
- `voucher_redemptions.userId` → **Người Dùng** · user 1 → N redemptions. Một user có nhiều lượt dùng voucher. Xoá: Ẩn danh, giữ audit.
- `voucher_redemptions.orderId` → **Đơn Hàng** · order 1 → 0..N redemptions. Lượt dùng phải đối soát về order. Xoá: Không xoá ledger.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Không xoá tùy tiện; reverse bằng trạng thái/event để giữ audit.

**Tình huống thực tế:**
Khách khiếu nại voucher không áp dụng có thể truy đúng redemption/order.

**Câu hội đồng dễ truy đuổi:**
- Vì sao ba index thường chưa đủ chống dùng voucher lặp?

**Điểm yếu thật:**
Ba logical FK có index nhưng collection này chưa được relationshipErrors kiểm tra.

**Hướng mở rộng [ĐỀ XUẤT]:**
Composite unique theo quy tắc per-user/per-order và quy trình reverse khi order huỷ.

**Best defense:**
Đây vừa là bridge ba phía vừa là transaction ledger, không chỉ là bộ đếm.

---

## Lịch Sử Thử Đồ

**Hạng:** C · **Collection thật:** `tryon_history` (75 bản ghi)

**Câu mở đầu:**
Đây là event AI nhạy cảm gắn user/product, không phải ảnh catalog.

**Vai trò ngoài đời:**
Lưu một lần try-on theo user/product/engine để xem lại và đo usage.

**Nếu bỏ bảng/thực thể này:**
Không theo dõi lượt dùng, kết quả hoặc sản phẩm đã thử.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã lịch sử thử đồ` · `Mã sản phẩm` · `Mã người dùng` · `Công nghệ AI` · `Ngày thử đồ`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `productId` · `accessoryIds` · `engine` · `createdAt`.  Tuỳ chọn/không phủ hết sample: `userId`(81%) · `productIds`(29%) · `appliedAccessories`(16%) · `skippedAccessories`(16%) · `demoBatch`(13%).

**Logical FK / cardinality / FK owner:**
- `tryon_history.productId` → **Sản Phẩm** · product 1 → N try-ons. Một product được thử nhiều lần. Xoá: Retention; không cascade mù asset.
- `tryon_history.userId` → **Người Dùng** · user 1 → N try-ons. Một user thử nhiều product/lần. Xoá: Xoá cả metadata và asset theo yêu cầu.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Cho phép user xoá; cần xóa cả asset ngoài DB theo workflow.

**Tình huống thực tế:**
User thử cùng product nhiều lần bằng engine khác nhau, nên quan hệ là 1:N.

**Câu hội đồng dễ truy đuổi:**
- Nếu xoá metadata nhưng ảnh Cloudinary còn thì đã đáp ứng quyền xoá chưa?

**Điểm yếu thật:**
Ảnh người dùng nhạy cảm; logical refs chưa được relationshipErrors kiểm tra.

**Hướng mở rộng [ĐỀ XUẤT]:**
Retention ngắn, consent, xoá asset Cloudinary và metadata đồng bộ.

**Best defense:**
Đây là event AI nhạy cảm gắn user/product, không phải ảnh catalog.

---

## Lịch Sử Tìm Kiếm

**Hạng:** C · **Collection thật:** `search_logs` (13 bản ghi)

**Câu mở đầu:**
Đây là telemetry; collection rỗng không chứng minh entity vô dụng.

**Vai trò ngoài đời:**
Log từ khoá, số kết quả và user để phân tích nhu cầu/zero-result.

**Nếu bỏ bảng/thực thể này:**
Không biết khách tìm gì mà catalog chưa đáp ứng.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã lịch sử tìm kiếm` · `Mã người dùng` · `Từ khóa tìm kiếm` · `Số lượng kết quả` · `Thời gian tìm kiếm`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `userId` · `query` · `resultCount` · `createdAt`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(62%).

**Logical FK / cardinality / FK owner:**
- `search_logs.userId` → **Người Dùng** · user 1 → N search events. Một user phát sinh nhiều lượt tìm. Xoá: TTL/anonymize.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Dọn theo retention; userId có thể anonymize.

**Tình huống thực tế:**
Từ khoá có 0 kết quả vẫn được ghi để admin cải thiện catalog.

**Câu hội đồng dễ truy đuổi:**
- Tại sao không lưu mọi keystroke tìm kiếm?

**Điểm yếu thật:**
Có thể chứa dữ liệu nhạy cảm; physical collection có thể rỗng dù route tồn tại.

**Hướng mở rộng [ĐỀ XUẤT]:**
TTL, chuẩn hoá query, ẩn danh user và aggregate hot terms.

**Best defense:**
Đây là telemetry; collection rỗng không chứng minh entity vô dụng.

---

## Màu Sắc

**Hạng:** B · **Collection thật:** _không có — xem Phần 1.1 của tài liệu Word_

**Câu mở đầu:**
Đây là thực thể logic nhưng implementation chủ ý nhúng màu vào variant.

**Vai trò ngoài đời:**
Từ điển màu ở mô hình logic cho biến thể sản phẩm.

**Nếu bỏ bảng/thực thể này:**
Nếu màu trở thành dữ liệu quản trị toàn cục thì thiếu nơi chuẩn hoá tên/mã màu.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã màu sắc` · `Tên màu sắc` · `Mã màu`

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.
- Bảng con trỏ vào: **Biến Thể Sản Phẩm** qua `product_variants.colorName/colorHex` (color 1 → N variants (logic))

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Hiện sống trong variant; xoá variant là xoá giá trị nhúng.

**Tình huống thực tế:**
Hiện màu Sumi được nhúng bằng `colorName` và `colorHex` trong từng variant.

**Câu hội đồng dễ truy đuổi:**
- Khi nào nhúng màu không còn phù hợp?

**Điểm yếu thật:**
Không có collection thật; đổi tên một màu toàn hệ thống phải cập nhật nhiều variant.

**Hướng mở rộng [ĐỀ XUẤT]:**
Chỉ vật lý hoá thành `colors` khi màu có vòng đời/truy vấn độc lập.

**Best defense:**
Đây là thực thể logic nhưng implementation chủ ý nhúng màu vào variant.

---

## Mô Tả Sản Phẩm Tạo Bởi AI

**Hạng:** C · **Collection thật:** `ai_descriptions` (10 bản ghi)

**Câu mở đầu:**
Đây là artifact AI gắn product, không phải mô tả nguồn duy nhất.

**Vai trò ngoài đời:**
Lưu kết quả và dấu vết mô tả AI theo sản phẩm để tái sử dụng/audit.

**Nếu bỏ bảng/thực thể này:**
Phải gọi model lại mỗi lần hoặc không truy được nội dung đã sinh cho product nào.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã bản ghi mô tả AI` · `Mã sản phẩm` · `Thời gian khởi tạo` · `Chi tiết nội dung mô tả`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `productId` · `generatedAt` · `description` · `id`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Logical FK / cardinality / FK owner:**
- `ai_descriptions.productId` → **Sản Phẩm** · product 1 → N generations. Một product có thể sinh mô tả nhiều lần. Xoá: Archive/cascade theo retention.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Cascade hoặc archive cùng product, tuỳ yêu cầu audit nội dung.

**Tình huống thực tế:**
Admin sinh lại mô tả sau khi đổi ảnh và cần biết kết quả cũ thuộc model/lần nào.

**Câu hội đồng dễ truy đuổi:**
- AI sinh sai thì source of truth là trường nào?

**Điểm yếu thật:**
Không nằm trong `relationshipErrors()`; retention/version nguồn sinh chưa chặt.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm modelVersion, promptVersion, approvalStatus và retention.

**Best defense:**
Đây là artifact AI gắn product, không phải mô tả nguồn duy nhất.

---

## Mẫu Kiểm Duyệt

**Hạng:** C · **Collection thật:** `moderation_samples` (6 bản ghi)

**Câu mở đầu:**
Đây là training/audit artifact phát sinh từ review bị từ chối.

**Vai trò ngoài đời:**
Mẫu nội dung bị từ chối để hỗ trợ kiểm duyệt các review sau.

**Nếu bỏ bảng/thực thể này:**
Bộ kiểm duyệt không học lại từ quyết định admin và không audit được mẫu nguồn.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã mẫu kiểm duyệt` · `Mã đánh giá` · `Nhãn phân loại` · `Văn bản đã chuẩn hóa` · `Cụm từ nhận diện được` · `Nguồn thu thập` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `reviewId` · `label` · `normalizedText` · `learnedPhrases` · `source` · `updatedAt`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(33%).

**Logical FK / cardinality / FK owner:**
- `moderation_samples.reviewId` → **Đánh Giá Sản Phẩm** · review 1 → 0..N samples. Mẫu học truy về review nguồn. Xoá: Retention/anonymize.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Có thể cascade/anonymize theo review sau thời hạn audit.

**Tình huống thực tế:**
Admin reject review, mẫu chuẩn hoá được tạo/cập nhật theo reviewId.

**Câu hội đồng dễ truy đuổi:**
- Nếu review bị xoá vì quyền riêng tư, mẫu học xử lý thế nào?

**Điểm yếu thật:**
Có logical FK nhưng không nằm trong relationshipErrors; dữ liệu học có thể giữ PII.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm retention, version model và quy trình xoá/ẩn dữ liệu cá nhân.

**Best defense:**
Đây là training/audit artifact phát sinh từ review bị từ chối.

---

## Mục Tiêu Tiết Kiệm

**Hạng:** B · **Collection thật:** `goals` (8 bản ghi)

**Câu mở đầu:**
Đây là aggregate kế hoạch gắn user và product, khác với payment mua hàng.

**Vai trò ngoài đời:**
Kế hoạch tích quỹ của user cho một sản phẩm, kèm tiến độ và các lần nạp.

**Nếu bỏ bảng/thực thể này:**
Không theo dõi được mục tiêu, số dư và sản phẩm đích.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã mục tiêu` · `Mã người dùng` · `Mã sản phẩm` · `Thông tin sản phẩm` · `Thông tin mục tiêu` · `Kế hoạch thực hiện` · `Ngày tạo` · `Ngày cập nhật` · `Quỹ tiết kiệm`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `userId` · `productId` · `product` · `input` · `plan` · `createdAt` · `updatedAt`.  Tuỳ chọn/không phủ hết sample: `fund`(50%) · `demoBatch`(38%).

**Logical FK / cardinality / FK owner:**
- `goals.userId` → **Người Dùng** · user 1 → N goals. Một user có nhiều mục tiêu. Xoá: Archive/anonymize theo ledger.
- `goals.productId` → **Sản Phẩm** · product 1 → N goals. Một product là đích của nhiều goal. Xoá: Giữ snapshot/đóng goal khi product mất.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
User có thể đóng mục tiêu; ledger tài chính không nên hard-delete.

**Tình huống thực tế:**
Giá product đổi khiến goal phải phân biệt target snapshot và giá hiện tại.

**Câu hội đồng dễ truy đuổi:**
- Nếu product bị xoá hoặc đổi giá thì target của goal ra sao?

**Điểm yếu thật:**
relationshipErrors kiểm user/product nhưng cấu trúc quỹ nhúng cần invariant tổng tiền.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tách deposit ledger khi cần audit/đối soát tiền thật.

**Best defense:**
Đây là aggregate kế hoạch gắn user và product, khác với payment mua hàng.

---

## Người Dùng

**Hạng:** S · **Collection thật:** `users` (36 bản ghi)

**Câu mở đầu:**
Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

**Vai trò ngoài đời:**
Danh tính có thể đăng nhập và được phân quyền. Cố ý KHÔNG giữ hồ sơ cá nhân — thứ đó nằm ở `profiles`.

**Nếu bỏ bảng/thực thể này:**
Mất đăng nhập, phân quyền và đích tham chiếu của phần lớn dữ liệu theo người dùng.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã người dùng` · `Họ và tên` · `Email` · `Mật khẩu mã hóa` · `Vai trò` · `Trạng thái` · `Số lượt thử đồ` · `Ngày đăng ký` · `Mã khách hàng Stripe` · `Mã đặt lại mã hóa` · `Hạn mã đặt lại mật khẩu` · `Mã Google` · `Ảnh đại diện`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `name` · `email` · `role` · `status` · `joinedAt`.  Tuỳ chọn/không phủ hết sample: `tryons`(97%) · `passwordHash`(97%) · `stripeCustomerId`(6%) · `resetCodeHash`(3%) · `resetCodeExpiresAt`(3%) · `googleId`(3%) · `authProviders`(31%) · `avatar`(3%) · `demoBatch`(28%).

**Chỉ mục thật:** `id` **UNIQUE** · `email`

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.
- Bảng con trỏ vào: **Đơn Hàng** qua `orders.userId` (user 1 → N orders) · **Thanh Toán** qua `payments.userId` (user 1 → N payments) · **Yêu Cầu Trả Hàng** qua `return_requests.userId` (user 1 → N requests) · **Địa Chỉ** qua `addresses.userId` (user 1 → N addresses) · **Hồ Sơ Người Dùng** qua `profiles.userId` (user 1 → 0..1 profile) · **Thông Báo** qua `notifications.userId` (user 1 → N notifications) · **Chi Tiết Giỏ Hàng** qua `cart_items.userId` (user 1 → N cart lines) · **Danh Sách Sản Phẩm Yêu Thích** qua `wishlist_items.userId` (user 1 → N wishlist rows) · **Mục Tiêu Tiết Kiệm** qua `goals.userId` (user 1 → N goals) · **Lịch Sử Tìm Kiếm** qua `search_logs.userId` (user 1 → N search events) · **Tin Nhắn** qua `chats.userId` (user 1 → N messages) · **Tương Tác Người Dùng** qua `interactions.userId` (user 1 → N events) · **Lịch Sử Thử Đồ** qua `tryon_history.userId` (user 1 → N try-ons) · **Phiếu Giảm Giá** qua `vouchers.ownerId` (user 1 → N issued vouchers) · **Phiếu Giảm Giá** qua `vouchers.userId` (user 1 → 0..N assigned vouchers) · **Lượt Sử Dụng Phiếu** qua `voucher_redemptions.userId` (user 1 → N redemptions) · **Thành Viên VIP** qua `vip_memberships.userId` (user 1 → N membership periods) · **Đánh Giá Sản Phẩm** qua `reviews.userId` (user 1 → N reviews) · **Tương Tác Đánh Giá** qua `review_reactions.userId` (user 1 → N reactions) · **Đánh Giá Địa Điểm Nhật Bản** qua `japan_spot_reviews.userId` (user 1 → N spot reviews) · **Bộ Sưu Tầm Thẻ Của Người Dùng** qua `flagcard_collections.userId` (user 1 → 0..N collections)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Không hard-delete chứng từ; khoá bằng `status`, sau này thêm quy trình ẩn danh hoá.

**Tình huống thực tế:**
Khoá tài khoản không được làm mất đơn và thanh toán đã phát sinh.

**Real-world drills:**
- Xoá tài khoản thì đơn cũ sao? → Không có chức năng xoá, chỉ khoá bằng `status`.
- Đổi email thì khoá ngoại sao? → Không ảnh hưởng, bảng con trỏ về `id`.
- Một triệu người dùng thì đăng nhập chậm không? → Đã có chỉ mục `email`.

**Câu hội đồng dễ truy đuổi:**
- Sao không dùng email làm khoá chính?
- Email có duy nhất ở tầng cơ sở dữ liệu không?
- Hai người đăng ký cùng email cùng lúc thì sao?
- Sao không tách bảng `roles`?
- Nếu hai request đăng ký cùng email tới hai instance thì lớp nào chặn?

**Điểm yếu thật:**
Chỉ mục `email` KHÔNG đặt duy nhất. Chặn trùng chỉ ở tầng ứng dụng (lỗi 409). Không có ẩn danh hoá.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm UNIQUE email; nếu một người nhiều vai trò/provider thì tách `user_roles` và `user_identities`.

**Best defense:**
Khoá chính là định danh kỹ thuật, tách khỏi dữ liệu nghiệp vụ, nên email đổi bao nhiêu lần cũng không ảnh hưởng 21 bảng con.

---

## Phiếu Giảm Giá

**Hạng:** A · **Collection thật:** `vouchers` (4 bản ghi)

**Câu mở đầu:**
Đây là rule voucher; hai dây tới users là người cấp và người nhận.

**Vai trò ngoài đời:**
Định nghĩa voucher: code, loại/giá trị, hạn, limit, người cấp và người nhận tùy chọn.

**Nếu bỏ bảng/thực thể này:**
Checkout không có quy tắc giảm, giới hạn và nguồn phát hành để kiểm tra.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã phiếu giảm giá` · `Mã người tạo` · `Mã người dùng` · `Mã hiển thị` · `Loại giảm giá` · `Giá trị giảm` · `Giá trị đơn tối thiểu` · `Ngày hết hạn` · `Giới hạn sử dụng` · `Số lượt đã dùng` · `Trạng thái` · `Đối tượng áp dụng` · `Lý do` · `Ngày phát hành`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `code` · `type` · `value` · `min` · `expiry` · `limit` · `used` · `active` · `id`.  Tuỳ chọn/không phủ hết sample: `appliesTo`(25%) · `ownerUserId`(25%) · `source`(25%) · `reason`(25%) · `issuedBy`(25%) · `issuedAt`(25%).

**Chỉ mục thật:** `id` **UNIQUE** · `code` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `vouchers.ownerId` → **Người Dùng** · user 1 → N issued vouchers. Một staff/admin cấp nhiều voucher. Xoá: Giữ issuer audit, có thể snapshot tên.
- `vouchers.userId` → **Người Dùng** · user 1 → 0..N assigned vouchers. Voucher có thể cấp riêng một user. Xoá: Ẩn danh/giữ assignment theo policy.
- Bảng con trỏ vào: **Đơn Hàng** qua `orders.voucherId` (voucher 1 → 0..N orders) · **Lượt Sử Dụng Phiếu** qua `voucher_redemptions.voucherId` (voucher 1 → N redemptions)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Archive khi hết hạn; giữ redemption và order snapshot.

**Tình huống thực tế:**
Voucher hết hạn ngay lúc tạo order thì server từ chối theo thời điểm checkout.

**Câu hội đồng dễ truy đuổi:**
- Nếu huỷ order thì used/redemption có được hoàn không?

**Điểm yếu thật:**
`used` và redemption có thể lệch nếu write giữa chừng; hai quan hệ tới users dễ bị hiểu nhầm.

**Hướng mở rộng [ĐỀ XUẤT]:**
Lấy redemption làm ledger nguồn; atomic consume/unique per-user theo policy.

**Best defense:**
Đây là rule voucher; hai dây tới users là người cấp và người nhận.

---

## Quy Tắc Giảm Giá

**Hạng:** B · **Collection thật:** `discount_rules` (3 bản ghi)

**Câu mở đầu:**
Đây là master rule dùng chung; order chỉ chụp kết quả tiền giảm.

**Vai trò ngoài đời:**
Cấu hình chương trình giảm có scope, điều kiện, mức giảm và thời hạn.

**Nếu bỏ bảng/thực thể này:**
VIP membership phải lặp phần trăm/ngưỡng, đổi rule không quản trị tập trung.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã quy tắc giảm giá` · `Mã chương trình` · `Tên chương trình giảm giá` · `Phạm vi áp dụng` · `Hình thức giảm giá` · `Giá trị giảm` · `Số lượng tối đa` · `Loại điều kiện đặt ra` · `Giá trị điều kiện cần đạt` · `Trạng thái hoạt động` · `Thời hạn hiệu lực`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `code` · `name` · `scope` · `type` · `value` · `active`.  Tuỳ chọn/không phủ hết sample: `maxUnitsPerOrder`(33%) · `qualificationType`(33%) · `qualificationValue`(33%) · `validityDays`(33%) · `demoBatch`(67%).

**Chỉ mục thật:** `id` **UNIQUE** · `code` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.
- Bảng con trỏ vào: **Thành Viên VIP** qua `vip_memberships.discountRuleId` (rule 1 → N memberships)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Archive rule đã được tham chiếu, không hard-delete.

**Tình huống thực tế:**
VIP membership trỏ `discountRuleId`, còn số tiền đã áp dụng snapshot trong order.

**Câu hội đồng dễ truy đuổi:**
- Rule đổi giữa kỳ VIP thì membership cũ theo rule nào?

**Điểm yếu thật:**
Rule thay đổi có thể ảnh hưởng membership đang active nếu không version.

**Hướng mở rộng [ĐỀ XUẤT]:**
Version/immutable rule; membership trỏ version đã cấp.

**Best defense:**
Đây là master rule dùng chung; order chỉ chụp kết quả tiền giảm.

---

## Quảng Cáo

**Hạng:** C · **Collection thật:** `banners` (3 bản ghi)

**Câu mở đầu:**
Đây là content vận hành độc lập, không cần FK trong ERD hiện tại.

**Vai trò ngoài đời:**
Banner có ảnh, link, trạng thái và thứ tự hiển thị.

**Nếu bỏ bảng/thực thể này:**
Không quản trị được nội dung hero/campaign từ backend.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã banner` · `Tiêu đề banner` · `Đường dẫn hình ảnh` · `Đường dẫn điều hướng` · `Trạng thái hiển thị` · `Thứ tự ưu tiên`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `title` · `img` · `link` · `active` · `order`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Logical FK / cardinality / FK owner:**
- Không có logical FK đi ra.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Archive; asset ngoài DB được dọn sau khi không còn tham chiếu.

**Tình huống thực tế:**
Banner draft không hiện; reorder không đổi URL asset.

**Câu hội đồng dễ truy đuổi:**
- Nếu hai banner cùng position thì thứ tự nào thắng?

**Điểm yếu thật:**
Không có owner/audit/khung thời gian publish; ảnh ngoài Cloudinary cần đồng bộ vòng đời.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm startAt/endAt, ownerId, placement và audit.

**Best defense:**
Đây là content vận hành độc lập, không cần FK trong ERD hiện tại.

---

## Sản Phẩm

**Hạng:** S · **Collection thật:** `products` (35 bản ghi)

**Câu mở đầu:**
Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.

**Vai trò ngoài đời:**
Mặt hàng theo cách khách hàng nghĩ: có tên, ảnh, mô tả, danh mục. Thứ khách tìm kiếm và duyệt.

**Nếu bỏ bảng/thực thể này:**
Catalog, tìm kiếm, wishlist, cart, review và dòng đơn đều mất đối tượng trung tâm.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã sản phẩm` · `Mã danh mục` · `Đường dẫn định danh` · `Tên sản phẩm` · `Tên tiếng Nhật` · `Mã quản lý kho` · `Thương hiệu` · `Giá bán hiện tại` · `Giá niêm yết` · `Ngày tạo` · `Trạng thái` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `slug` · `name` · `sku` · `brand` · `price` · `status` · `categoryId` · `compareAtPrice`.  Tuỳ chọn/không phủ hết sample: `kanji`(97%) · `createdAt`(97%) · `updatedAt`(3%).

**Chỉ mục thật:** `id` **UNIQUE** · `slug` **UNIQUE** · `categoryId`

**Logical FK / cardinality / FK owner:**
- `products.categoryId` → **Danh Mục Sản Phẩm** · category 1 → N products. Một danh mục gom nhiều sản phẩm. Xoá: RESTRICT/reassign khi còn product.
- Bảng con trỏ vào: **Chi Tiết Sản Phẩm** qua `product_details.productId` (product 1 → 0..1 detail) · **Biến Thể Sản Phẩm** qua `product_variants.productId` (product 1 → N variants) · **Hình Ảnh** qua `legacy image.productId` (product 1 → N images (logic)) · **Mô Tả Sản Phẩm Tạo Bởi AI** qua `ai_descriptions.productId` (product 1 → N generations) · **Chi Tiết Đơn Hàng** qua `order_items.productId` (product 1 → N sold lines) · **Chi Tiết Giỏ Hàng** qua `cart_items.productId` (product 1 → N cart lines) · **Danh Sách Sản Phẩm Yêu Thích** qua `wishlist_items.productId` (product 1 → N wishlist rows) · **Mục Tiêu Tiết Kiệm** qua `goals.productId` (product 1 → N goals) · **Tin Nhắn** qua `chats.productId` (product 1 → 0..N contextual messages) · **Tương Tác Người Dùng** qua `interactions.productId` (product 1 → N events) · **Lịch Sử Thử Đồ** qua `tryon_history.productId` (product 1 → N try-ons) · **Đánh Giá Sản Phẩm** qua `reviews.productId` (product 1 → N reviews) · **Hình Ảnh Giao Diện Sản Phẩm** qua `product_media.productId` (product 1 → N media) · **Thẻ Địa Danh** qua `flagcards.recommendedProductIds[]` (flagcard N ↔ N products (array))

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Ưu tiên archive; dữ liệu chi tiết có thể cascade, chứng từ phải giữ snapshot.

**Tình huống thực tế:**
Giá/tên hiện tại đổi nhưng dòng đơn cũ vẫn giữ giá/tên tại lúc mua.

**Real-world drills:**
- Đổi giá thì đơn cũ hiện giá nào? → Giá cũ, vì `order_items` chụp lại.
- Đổi tên thì đơn cũ sao? → Vẫn tên cũ, có chụp `productName`.
- Bị xoá thì `order_items` sao? → Vẫn hiển thị đủ; mất liên kết về trang sản phẩm.

**Câu hội đồng dễ truy đuổi:**
- Tồn kho để ở đâu và vì sao?
- Sao không lưu thẳng tên danh mục?
- Một sản phẩm nhiều danh mục thì sao?
- Lưu giá hai chỗ có vi phạm chuẩn 3 không?
- Vì sao `slug` unique nhưng không dùng làm PK?

**Điểm yếu thật:**
`DELETE /products/:id` là xoá thật, không có xoá mềm. Chính sách xoá không khai báo tường minh mà là hệ quả của kiểm tra toàn vẹn.

**Hướng mở rộng [ĐỀ XUẤT]:**
Soft-delete/archived; thêm `product_categories` nếu một sản phẩm thuộc nhiều danh mục.

**Best defense:**
Ranh giới sản phẩm–biến thể phản ánh đúng thực tế: khách duyệt theo sản phẩm, kho vận hành theo biến thể.

---

## Thanh Toán

**Hạng:** S · **Collection thật:** `payments` (94 bản ghi)

**Câu mở đầu:**
Đây là một payment attempt; 94/94 là current data, không phải cardinality bắt buộc.

**Vai trò ngoài đời:**
Một lượt giao dịch tiền cho một đơn. Mang dữ liệu riêng của cổng: mã giao dịch, biên nhận, bốn số cuối thẻ.

**Nếu bỏ bảng/thực thể này:**
Không biểu diễn retry, trạng thái cổng, đối soát và hoàn từng phần.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã thanh toán` · `Mã đơn hàng` · `Mã người dùng` · `Mã hiển thị thanh toán` · `Mã hiển thị đơn hàng` · `Nhà cung cấp dịch vụ` · `Phương thức thanh toán` · `Trạng thái giao dịch` · `Số tiền thanh toán` · `Đơn vị tiền tệ` · `Mã giao dịch ngân hàng` · `Mã Payment Intent` · `Mã phiên thanh toán` · `Khả năng hoàn tiền`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `code` · `orderId` · `orderCode` · `userId` · `provider` · `method` · `status` · `amount` · `currency` · `transactionCode` · `refundable`.  Tuỳ chọn/không phủ hết sample: `paymentIntentId`(33%) · `checkoutSessionId`(32%) · `originalAmount`(20%) · `discount`(20%) · `voucherDiscount`(20%) · `paymentDiscount`(20%) · `promotionCode`(20%) · `amountSubtotal`(2%) · `paidAt`(37%) · `chargeId`(9%).

**Chỉ mục thật:** `id` **UNIQUE** · `orderId` · `userId`

**Logical FK / cardinality / FK owner:**
- `payments.orderId` → **Đơn Hàng** · order 1 → N payment attempts. Một đơn có thể retry thanh toán. Xoá: Giữ payment khi order huỷ.
- `payments.userId` → **Người Dùng** · user 1 → N payments. Một user phát sinh nhiều giao dịch. Xoá: Ẩn danh user, giữ ledger.
- Bảng con trỏ vào: **Yêu Cầu Trả Hàng** qua `return_requests.paymentId` (payment 1 → 0..N requests)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Không xoá; refund/cancel bằng trạng thái và lưu mảng refund.

**Tình huống thực tế:**
Webhook/return/reconcile có thể lặp; code kiểm tra status/id provider trước khi ghi lặp.

**Real-world drills:**
- Cổng gửi lại thông báo 5 lần? → Handler kiểm trạng thái/txn/refund-id và cờ hoàn kho; DB transactionCode vẫn chưa unique.
- Cổng báo thành công mà máy chủ chết? → Cổng tự gửi lại, cộng đối soát chủ động.
- Hoàn một trong ba món? → Mảng các lần hoàn trong bản ghi thanh toán.

**Câu hội đồng dễ truy đuổi:**
- Sao không gộp vào `orders`?
- Dữ liệu hiện tại 1:1 mà, sao bảo là 1:N?
- Ai là nguồn sự thật về tiền?
- Có lưu số thẻ không?
- Webhook lặp ở hai instance thì database constraint nào là lớp cuối?

**Điểm yếu thật:**
Dữ liệu hiện tại 94 đơn / 94 giao dịch nên nhìn như 1:1 — phải chỉ ra chỉ mục `orderId` không đặt duy nhất để chứng minh thiết kế là 1:N.

**Hướng mở rộng [ĐỀ XUẤT]:**
Unique/sparse theo provider transaction id; event log webhook; outbox cho side effects.

**Best defense:**
Có idempotency ở provider/handler (`paidAt`, refund id, `stockRestoredAt`), nhưng phải nói rõ database constraint còn thiếu.

---

## Thành Viên VIP

**Hạng:** B · **Collection thật:** `vip_memberships` (5 bản ghi)

**Câu mở đầu:**
Đây là trạng thái có thời hạn nối user và discount rule, không phải cờ boolean trong users.

**Vai trò ngoài đời:**
Một giai đoạn user đạt VIP theo rule và tập đơn đủ điều kiện.

**Nếu bỏ bảng/thực thể này:**
Không biết ai đang VIP, hạn tới đâu và dựa trên đơn nào.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã thành viên VIP` · `Mã người dùng` · `Mã quy tắc giảm giá` · `Kỳ xét duyệt VIP` · `Danh sách đơn hàng xét duyệt` · `Tổng chi tiêu đủ điều kiện` · `Ngày bắt đầu VIP` · `Ngày hết hạn VIP` · `Trạng thái` · `Ngày tạo` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `userId` · `discountRuleId` · `qualifyingPeriod` · `qualifyingOrderIds` · `qualifiedSpend` · `startedAt` · `expiresAt` · `status` · `createdAt` · `updatedAt`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Chỉ mục thật:** `id` **UNIQUE** · `userId+status` · `discountRuleId`

**Logical FK / cardinality / FK owner:**
- `vip_memberships.userId` → **Người Dùng** · user 1 → N membership periods. User có nhiều kỳ VIP theo thời gian. Xoá: Expire/archive, không hard-delete.
- `vip_memberships.discountRuleId` → **Quy Tắc Giảm Giá** · rule 1 → N memberships. Nhiều membership dùng cùng rule. Xoá: Archive/version rule.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Hết hạn bằng status; giữ lịch sử membership để audit ưu đãi.

**Tình huống thực tế:**
Đạt ngưỡng chi tiêu thì membership lưu `qualifyingOrderIds` và expiresAt.

**Câu hội đồng dễ truy đuổi:**
- Hai membership active cho một user bị lớp nào chặn?

**Điểm yếu thật:**
Index `(userId,status)` không unique; có thể tồn tại nhiều active membership nếu app sai.

**Hướng mở rộng [ĐỀ XUẤT]:**
Unique partial cho active membership; ledger qualification riêng nếu quy mô lớn.

**Best defense:**
Đây là trạng thái có thời hạn nối user và discount rule, không phải cờ boolean trong users.

---

## Thông Báo

**Hạng:** B · **Collection thật:** `notifications` (47 bản ghi)

**Câu mở đầu:**
Đây là bản ghi inbox; push token chỉ là kênh giao, không phải thông báo.

**Vai trò ngoài đời:**
Inbox thông báo nghiệp vụ cho user, có type/action và thời điểm.

**Nếu bỏ bảng/thực thể này:**
Không có lịch sử những gì hệ thống đã báo cho khách.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã thông báo` · `Mã người dùng` · `Tiêu đề thông báo` · `Nội dung thông báo` · `Phân loại thông báo` · `Hành động` · `Lượt tiếp cận` · `Thời gian gửi`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `title` · `body` · `type` · `reach` · `at`.  Tuỳ chọn/không phủ hết sample: `userId`(94%) · `action`(81%) · `demoBatch`(23%).

**Logical FK / cardinality / FK owner:**
- `notifications.userId` → **Người Dùng** · user 1 → N notifications. Một user nhận nhiều thông báo. Xoá: TTL/anonymize theo retention.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
TTL/dọn theo retention; xoá user thì anonymize hoặc xoá inbox.

**Tình huống thực tế:**
Order đổi trạng thái tạo notification có action mở đúng order.

**Câu hội đồng dễ truy đuổi:**
- Ghi DB thành công nhưng gửi push thất bại thì source of truth là gì?

**Điểm yếu thật:**
userId logical chưa nằm trong relationshipErrors; `reach` không thay thế trạng thái đã đọc.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm readAt/delivery attempts và outbox để tránh mất/nhân đôi.

**Best defense:**
Đây là bản ghi inbox; push token chỉ là kênh giao, không phải thông báo.

---

## Thẻ Địa Danh

**Hạng:** B · **Collection thật:** `flagcards` (7 bản ghi)

**Câu mở đầu:**
Đây là master content; quan hệ sản phẩm đang được biểu diễn bằng mảng logical refs.

**Vai trò ngoài đời:**
Nội dung gamification về địa danh và danh sách sản phẩm gợi ý.

**Nếu bỏ bảng/thực thể này:**
Không có catalog thẻ để trao thưởng và kể nội dung văn hoá.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã thẻ địa danh` · `Mã sản phẩm` · `Thứ tự hiển thị` · `Biểu tượng` · `Mã màu chủ đạo` · `Tên địa danh` · `Tên tiếng Nhật` · `Khu vực` · `Mô tả ngắn` · `Lịch sử hình thành` · `Truyền thuyết` · `Sự thật thú vị` · `Danh sách điểm check-in` · `Gợi ý trang phục`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `order` · `glyph` · `accent` · `title` · `japanese` · `region` · `summary` · `formationHistory` · `legend` · `funFacts` · `checkins`.  Tuỳ chọn/không phủ hết sample: _không có_.

**Logical FK / cardinality / FK owner:**
- `flagcards.recommendedProductIds[]` → **Sản Phẩm** · flagcard N ↔ N products (array). Một card gợi ý nhiều product và ngược lại. Xoá: Gỡ ID khi product archive; không xoá card award.
- Bảng con trỏ vào: **Bộ Sưu Tầm Thẻ Của Người Dùng** qua `flagcard_collections.cardIds[]` (collection N ↔ N flagcards (array))

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Archive card; không xoá khỏi lịch sử award đã trao.

**Tình huống thực tế:**
Đơn đủ điều kiện trao một card; card dẫn tới outfit/sản phẩm liên quan.

**Câu hội đồng dễ truy đuổi:**
- Tại sao dùng mảng product IDs mà order_items lại tách collection?

**Điểm yếu thật:**
`recommendedProductIds[]` là quan hệ N:N nhúng, relationshipErrors chưa phủ.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tách `flagcard_products` nếu cần ranking/analytics theo từng mapping.

**Best defense:**
Đây là master content; quan hệ sản phẩm đang được biểu diễn bằng mảng logical refs.

---

## Tin Nhắn

**Hạng:** C · **Collection thật:** `chats` (68 bản ghi)

**Câu mở đầu:**
Đây là log hội thoại; product context là optional nên quan hệ 0..1.

**Vai trò ngoài đời:**
Lịch sử hội thoại trợ lý theo user, có product context tùy chọn.

**Nếu bỏ bảng/thực thể này:**
Trợ lý mất ngữ cảnh và không audit được câu trả lời đã phát.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã tin nhắn` · `Mã người dùng` · `Mã sản phẩm` · `Vai trò người gửi` · `Nội dung tin nhắn` · `Thời gian gửi`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `role` · `message` · `createdAt`.  Tuỳ chọn/không phủ hết sample: `userId`(71%) · `productIds`(46%) · `engine`(19%) · `intent`(19%) · `confidence`(19%) · `modelTrace`(15%) · `generationModel`(15%) · `latencyMs`(19%) · `fallbackReason`(15%) · `demoBatch`(9%).

**Logical FK / cardinality / FK owner:**
- `chats.userId` → **Người Dùng** · user 1 → N messages. Một user có nhiều message. Xoá: Retention/anonymize.
- `chats.productId` → **Sản Phẩm** · product 1 → 0..N contextual messages. Message có thể hỏi về một product. Xoá: Giữ text, cho FK logic nullable.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Dọn theo retention; product bị archive không được phá nội dung cũ.

**Tình huống thực tế:**
User hỏi về một product; productId có thể rỗng khi câu hỏi chung.

**Câu hội đồng dễ truy đuổi:**
- Vì sao `productId` nullable và khi product bị xoá thì chat sao?

**Điểm yếu thật:**
Hai logical refs chưa được relationshipErrors kiểm tra; retention nội dung hội thoại chưa rõ.

**Hướng mở rộng [ĐỀ XUẤT]:**
Tách conversation/message nếu cần nhiều phiên, thêm retention/consent.

**Best defense:**
Đây là log hội thoại; product context là optional nên quan hệ 0..1.

---

## Tương Tác Người Dùng

**Hạng:** C · **Collection thật:** `interactions` (675 bản ghi)

**Câu mở đầu:**
Đây là event log append-heavy, không phải trạng thái nguồn của wishlist/cart.

**Vai trò ngoài đời:**
Event hành vi xem/thích/cart dùng cho analytics và gợi ý.

**Nếu bỏ bảng/thực thể này:**
Không đo được funnel hay cá nhân hoá theo hành vi.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã tương tác` · `Mã người dùng` · `Mã sản phẩm` · `Nguồn tương tác` · `Thời gian tương tác` · `Loại tương tác`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `productId` · `type` · `createdAt` · `source`.  Tuỳ chọn/không phủ hết sample: `userId`(79%) · `value`(85%) · `metadata`(42%) · `demoBatch`(22%).

**Logical FK / cardinality / FK owner:**
- `interactions.userId` → **Người Dùng** · user 1 → N events. Một user tạo nhiều event hành vi. Xoá: TTL/anonymize.
- `interactions.productId` → **Sản Phẩm** · product 1 → N events. Một product nhận nhiều event. Xoá: Giữ aggregate, dọn raw event.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Cho phép TTL/aggregation; không cascade làm hỏng master data.

**Tình huống thực tế:**
Mỗi lượt xem có thể sinh event nên collection tăng nhanh hơn master data.

**Câu hội đồng dễ truy đuổi:**
- Index nào phục vụ query cụ thể mà không làm write quá đắt?

**Điểm yếu thật:**
Route `/interactions` nhận userId từ body; collection phình nhanh và refs chưa được assert.

**Hướng mở rộng [ĐỀ XUẤT]:**
Xác thực principal, partition/TTL, aggregate theo ngày.

**Best defense:**
Đây là event log append-heavy, không phải trạng thái nguồn của wishlist/cart.

---

## Tương Tác Đánh Giá

**Hạng:** B · **Collection thật:** `review_reactions` (88 bản ghi)

**Câu mở đầu:**
Đây là bảng bắc cầu có thuộc tính `value`; composite unique ngăn một user phản ứng hai lần.

**Vai trò ngoài đời:**
Một user đánh dấu helpful/not helpful cho một review.

**Nếu bỏ bảng/thực thể này:**
Không đếm phản hồi tin cậy hoặc phải nhúng danh sách user vào review.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã tương tác đánh giá` · `Mã đánh giá` · `Mã người dùng` · `Giá trị tương tác` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `reviewId` · `userId` · `value` · `updatedAt`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(27%).

**Chỉ mục thật:** `id` **UNIQUE** · `reviewId+userId` **UNIQUE**

**Logical FK / cardinality / FK owner:**
- `review_reactions.reviewId` → **Đánh Giá Sản Phẩm** · review 1 → N reactions. Một review nhận nhiều phản ứng. Xoá: CASCADE reaction nếu review bị xoá thật.
- `review_reactions.userId` → **Người Dùng** · user 1 → N reactions. Một user phản ứng nhiều review. Xoá: CASCADE/anonymize mapping.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Cascade theo review; user bị ẩn danh có thể xoá phản ứng.

**Tình huống thực tế:**
Bấm cùng lựa chọn lần nữa thì bỏ; đổi lựa chọn thì cập nhật cùng cặp.

**Câu hội đồng dễ truy đuổi:**
- Tại sao reaction là entity thay vì hai counter trong reviews?

**Điểm yếu thật:**
ID sinh theo thời gian có thể va chạm lý thuyết; giá trị enum do app kiểm tra.

**Hướng mở rộng [ĐỀ XUẤT]:**
Dùng compound key làm natural uniqueness và schema validator cho enum.

**Best defense:**
Đây là bảng bắc cầu có thuộc tính `value`; composite unique ngăn một user phản ứng hai lần.

---

## Yêu Cầu Trả Hàng

**Hạng:** A · **Collection thật:** `return_requests` (8 bản ghi)

**Câu mở đầu:**
Đây là workflow hậu mãi tách khỏi order để giữ nhiều lần yêu cầu và timeline.

**Vai trò ngoài đời:**
Hồ sơ huỷ/đổi/trả: ai yêu cầu, đơn nào, payment nào, món nào và timeline xử lý.

**Nếu bỏ bảng/thực thể này:**
Hoàn tiền mất căn cứ, không biết trả toàn bộ hay từng món, không audit quyết định admin.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã yêu cầu trả hàng` · `Mã đơn hàng` · `Mã người dùng` · `Mã thanh toán` · `Mã hiển thị trả hàng` · `Mã hiển thị đơn hàng` · `Mã hiển thị thanh toán` · `Trạng thái yêu cầu` · `Lý do trả hàng` · `Ghi chú của khách` · `Danh sách món hàng trả` · `Số tiền hoàn` · `Đơn vị tiền tệ` · `Ngày tạo yêu cầu`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `code` · `orderId` · `orderCode` · `userId` · `paymentId` · `paymentCode` · `status` · `reason` · `note` · `items` · `amount`.  Tuỳ chọn/không phủ hết sample: `adminNote`(75%) · `refundId`(25%) · `refundStatus`(25%) · `kind`(88%) · `photos`(88%) · `codManualRefund`(50%) · `coversWholeOrder`(25%) · `stockRestoredAt`(25%) · `demoBatch`(25%).

**Chỉ mục thật:** `id` **UNIQUE** · `orderId` · `paymentId` · `userId`

**Logical FK / cardinality / FK owner:**
- `return_requests.orderId` → **Đơn Hàng** · order 1 → N requests. Một order có thể trả theo nhiều đợt/item. Xoá: Giữ request và order.
- `return_requests.userId` → **Người Dùng** · user 1 → N requests. User tạo nhiều yêu cầu hậu mãi. Xoá: Ẩn danh, không phá audit.
- `return_requests.paymentId` → **Thanh Toán** · payment 1 → 0..N requests. Refund online trỏ đúng payment; COD có thể rỗng. Xoá: Giữ payment/request.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Không hard-delete sau xử lý; ảnh có retention riêng.

**Tình huống thực tế:**
Một order có thể có nhiều yêu cầu theo các nhóm item khác nhau.

**Câu hội đồng dễ truy đuổi:**
- Vì sao `paymentId` nullable, và COD hoàn thế nào?

**Điểm yếu thật:**
Quy tắc chống chồng lấn item nằm ở code; ảnh chứng minh là URL ngoài DB.

**Hướng mở rộng [ĐỀ XUẤT]:**
Unique/conditional rule cho active requests và item-level refund ledger.

**Best defense:**
Đây là workflow hậu mãi tách khỏi order để giữ nhiều lần yêu cầu và timeline.

---

## Đánh Giá Sản Phẩm

**Hạng:** A · **Collection thật:** `reviews` (31 bản ghi)

**Câu mở đầu:**
Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair.

**Vai trò ngoài đời:**
Nhận xét của người đã mua. Có `orderId` làm bằng chứng mua hàng.

**Nếu bỏ bảng/thực thể này:**
Không có social proof; bỏ `orderId` thì khó chứng minh đã mua và nhận hàng.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã đánh giá` · `Mã sản phẩm` · `Mã người dùng` · `Mã đơn hàng` · `Tên người dùng` · `Mã hiển thị đơn hàng` · `Điểm số đánh giá` · `Nội dung nhận xét` · `Hình ảnh & Video` · `Trạng thái hiển thị` · `Nội dung kiểm duyệt` · `Đối tượng kiểm duyệt` · `Ngày viết đánh giá` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `productId` · `userId` · `userName` · `orderId` · `orderCode` · `rating` · `comment` · `media` · `status` · `moderation` · `createdAt`.  Tuỳ chọn/không phủ hết sample: `adminNote`(32%) · `moderatedAt`(32%) · `demoBatch`(29%).

**Chỉ mục thật:** `id` **UNIQUE** · `productId` · `userId` · `orderId`

**Logical FK / cardinality / FK owner:**
- `reviews.productId` → **Sản Phẩm** · product 1 → N reviews. Một product có nhiều review. Xoá: Ẩn review khi product archive; giữ audit.
- `reviews.userId` → **Người Dùng** · user 1 → N reviews. Một user review nhiều product. Xoá: Ẩn danh tên snapshot khi cần.
- `reviews.orderId` → **Đơn Hàng** · order 1 → 0..N reviews. Order hoàn tất chứng minh verified purchase. Xoá: Giữ link chứng từ.
- Bảng con trỏ vào: **Tương Tác Đánh Giá** qua `review_reactions.reviewId` (review 1 → N reactions) · **Mẫu Kiểm Duyệt** qua `moderation_samples.reviewId` (review 1 → 0..N samples)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Ưu tiên đổi status/ẩn; reaction nên cascade khi review thật sự bị xoá.

**Tình huống thực tế:**
Sau moderation async, code recheck trùng trong update trước khi push review.

**Real-world drills:**
- Chưa mua có đánh giá được không? → Không, phải có đơn chứa đúng sản phẩm.
- Người dùng đổi tên thì đánh giá cũ sao? → Vẫn tên cũ, có chụp `userName`.

**Câu hội đồng dễ truy đuổi:**
- Một người đánh giá hai lần được không?
- Chặn bằng gì?
- Điểm trung bình có nên lưu sẵn?
- Ứng dụng kiểm tra rồi cần ràng buộc cơ sở dữ liệu làm gì?
- Hai request review qua hai instance cùng vượt application check thì sao?

**Điểm yếu thật:**
KHÔNG có ràng buộc duy nhất `(userId, productId)` ở cơ sở dữ liệu. Chỉ chặn ở tầng ứng dụng — trong khi `wishlist_items` lại có. Thiếu nhất quán.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm composite unique; tách `review_media` nếu một review nhiều media có metadata.

**Best defense:**
Đường nối tới `Đơn Hàng` là ràng buộc chống đánh giá giả, thứ nhiều đồ án không có.

---

## Đánh Giá Địa Điểm Nhật Bản

**Hạng:** B · **Collection thật:** `japan_spot_reviews` (5 bản ghi)

**Câu mở đầu:**
Đây là review địa điểm, không nối products vì đối tượng đánh giá khác.

**Vai trò ngoài đời:**
Nội dung người dùng đánh giá một địa điểm Nhật, tách khỏi review sản phẩm.

**Nếu bỏ bảng/thực thể này:**
Không có UGC địa điểm và sẽ trộn hai loại rating khác nghiệp vụ.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã đánh giá địa điểm` · `Mã người dùng` · `Tên địa điểm` · `Tỉnh / Thành phố` · `Tên người đánh giá` · `Điểm đánh giá` · `Nội dung bình luận` · `Tệp đính kèm` · `Ngày đánh giá`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `place` · `prefecture` · `userId` · `userName` · `rating` · `comment` · `createdAt`.  Tuỳ chọn/không phủ hết sample: `media`(80%) · `status`(80%) · `moderation`(80%) · `demoBatch`(60%).

**Logical FK / cardinality / FK owner:**
- `japan_spot_reviews.userId` → **Người Dùng** · user 1 → N spot reviews. Một user đánh giá nhiều địa điểm. Xoá: Ẩn danh/moderate.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Ẩn/moderate thay vì xoá thẳng; media có retention riêng.

**Tình huống thực tế:**
Một user đánh giá Fushimi Inari, nội dung không ảnh hưởng rating sản phẩm.

**Câu hội đồng dễ truy đuổi:**
- Tại sao không có bảng `japan_spots` làm cha?

**Điểm yếu thật:**
Chỉ logical userId; chưa có entity địa điểm chuẩn nên `place`/`prefecture` lặp.

**Hướng mở rộng [ĐỀ XUẤT]:**
Thêm `japan_spots` và unique theo user–spot nếu áp quy tắc một review.

**Best defense:**
Đây là review địa điểm, không nối products vì đối tượng đánh giá khác.

---

## Đơn Hàng

**Hạng:** S · **Collection thật:** `orders` (94 bản ghi)

**Câu mở đầu:**
Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng.

**Vai trò ngoài đời:**
Chứng từ ghi lại một lần mua. Đóng băng dữ liệu tại thời điểm đặt: khách, địa chỉ, tổng tiền, giảm giá.

**Nếu bỏ bảng/thực thể này:**
Không có chứng từ để giao hàng, đối soát, hoàn tiền hay chứng minh giá đã chốt.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã đơn hàng` · `Mã người dùng` · `Mã phiếu giảm giá` · `Mã hiển thị đơn hàng` · `Thông tin người nhận` · `Địa chỉ giao hàng` · `Tổng giá trị đơn hàng` · `Phí vận chuyển` · `Trạng thái đơn hàng` · `Tạm tính` · `Lịch sử trạng thái` · `Số tiền giảm` · `Ngày đặt hàng` · `Ngày cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `code` · `customer` · `address` · `total` · `ship` · `status` · `createdAt` · `history` · `source` · `voucherId`.  Tuỳ chọn/không phủ hết sample: `userId`(99%) · `subtotal`(61%) · `discount`(61%) · `discountCode`(61%) · `flagcardAward`(5%) · `addressDetails`(57%) · `voucherDiscount`(60%) · `paymentDiscount`(60%) · `paymentPromotion`(60%) · `clientRequestId`(10%).

**Chỉ mục thật:** `id` **UNIQUE** · `code` **UNIQUE** · `userId+createdAt`

**Logical FK / cardinality / FK owner:**
- `orders.userId` → **Người Dùng** · user 1 → N orders. Một user đặt nhiều đơn; guest là ngoại lệ logic. Xoá: Khoá/ẩn danh user, giữ order.
- `orders.voucherId` → **Phiếu Giảm Giá** · voucher 1 → 0..N orders. Voucher có thể áp cho nhiều đơn; order có tối đa một voucher record. Xoá: Archive voucher, giữ snapshot giảm trong order.
- Bảng con trỏ vào: **Chi Tiết Đơn Hàng** qua `order_items.orderId` (order 1 → N items) · **Thanh Toán** qua `payments.orderId` (order 1 → N payment attempts) · **Yêu Cầu Trả Hàng** qua `return_requests.orderId` (order 1 → N requests) · **Lượt Sử Dụng Phiếu** qua `voucher_redemptions.orderId` (order 1 → 0..N redemptions) · **Đánh Giá Sản Phẩm** qua `reviews.orderId` (order 1 → 0..N reviews)

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Không hard-delete; huỷ bằng status và giữ history.

**Tình huống thực tế:**
Double-click dùng `clientRequestId`; đổi giá sau mua không đổi tổng đơn cũ.

**Real-world drills:**
- Huỷ đơn thì có xoá không? → Không, chuyển `status` sang `cancelled`.
- Khách bấm đặt hai lần? → `clientRequestId` trả về đơn đã tạo.
- Khách vãng lai đặt được không? → Thiết kế có chừa chỗ, `userId` có mặt 99% chứ không 100%.

**Câu hội đồng dễ truy đuổi:**
- Sao phải tách `order_items`?
- Trạng thái chuyển ngược được không?
- Có máy trạng thái không?
- Sao phải lưu `total` mà không tính lại?
- Nếu process chết trước lượt flush Mongo thì những write nào có thể mất?

**Điểm yếu thật:**
Chưa có bảng quy tắc chuyển trạng thái tập trung. Nhánh failed/cancelled đã hoàn kho, nhưng pending treo vẫn phụ thuộc callback/reconcile.

**Hướng mở rộng [ĐỀ XUẤT]:**
Unique theo `(userId,clientRequestId)`; state machine tập trung; write-through/transaction.

**Best defense:**
Bảy trạng thái kèm cột `history` lưu vết mọi lần đổi, nên luôn dựng lại được đường đi của đơn.

---

## Địa Chỉ

**Hạng:** A · **Collection thật:** `addresses` (11 bản ghi)

**Câu mở đầu:**
Đây là sổ địa chỉ 1:N; chứng từ đơn hàng chụp lại địa chỉ thay vì trỏ sống.

**Vai trò ngoài đời:**
Sổ địa chỉ nhận hàng có thể tái sử dụng của một người dùng.

**Nếu bỏ bảng/thực thể này:**
Khách phải nhập lại mỗi lần; không quản lý được nhiều địa chỉ/mặc định.

**PK và cột trên sơ đồ:** PK logic là cột mã; physical Mongo dùng `_id` và domain/API id ổn định khi có. `Mã địa chỉ` · `Mã người dùng` · `Nhãn địa chỉ` · `Tên người nhận` · `Số điện thoại` · `Số nhà, tên đường` · `Mã phường / xã` · `Tên phường / xã` · `Mã tỉnh / thành phố` · `Tên tỉnh / thành phố` · `Địa chỉ mặc định` · `Thời gian tạo` · `Thời gian cập nhật`

**Field thật / nullability theo dữ liệu hiện tại:**
Có mặt 100%: `id` · `userId` · `title` · `name` · `phone` · `street` · `wardCode` · `ward` · `provinceCode` · `province` · `isDefault` · `createdAt`.  Tuỳ chọn/không phủ hết sample: `demoBatch`(55%).

**Chỉ mục thật:** `id` **UNIQUE** · `userId`

**Logical FK / cardinality / FK owner:**
- `addresses.userId` → **Người Dùng** · user 1 → N addresses. Một user lưu nhiều địa chỉ. Xoá: Có thể cascade sổ địa chỉ, không chạm order snapshot.

**Vì sao FK ở phía này:**
Mỗi object phía con trỏ tối đa một cha nên field reference nằm ở con; array refs MongoDB được ghi riêng là ngoại lệ có đánh đổi.

**Xoá cha/con:**
Có thể xoá địa chỉ khỏi sổ; không sửa snapshot trong đơn đã tạo.

**Tình huống thực tế:**
Khách đổi địa chỉ mặc định nhưng đơn cũ vẫn giữ snapshot địa chỉ đã giao.

**Câu hội đồng dễ truy đuổi:**
- Hai request cùng đặt hai địa chỉ mặc định thì sao?

**Điểm yếu thật:**
Cần quy tắc chỉ một `isDefault=true` cho mỗi user; index hiện tại chỉ theo `userId`.

**Hướng mở rộng [ĐỀ XUẤT]:**
Dùng unique partial index cho địa chỉ mặc định hoặc transaction khi đổi mặc định.

**Best defense:**
Đây là sổ địa chỉ 1:N; chứng từ đơn hàng chụp lại địa chỉ thay vì trỏ sống.

---
