# 10 — Bộ câu hỏi phản biện database

> Tổng cộng **48 câu**. Công thức trả lời: kết luận → bằng chứng source/schema → giới hạn → hướng cải tiến.

# LEVEL 1 — Nhận biết

## Q01

### Giảng viên hỏi

PK logic của Người Dùng là gì?

### Câu trả lời tốt

`Mã người dùng`; MongoDB còn có `_id`, còn `id` là domain/API identity ổn định.

### Câu trả lời ngắn nếu bị hỏi nhanh

Mã người dùng; `_id` là khóa vật lý.

### Không nên trả lời

Email là PK.

## Q02

### Giảng viên hỏi

FK của `order_items` là gì?

### Câu trả lời tốt

`orderId` trỏ Order và `productId` trỏ Product; dòng còn giữ snapshot.

### Câu trả lời ngắn nếu bị hỏi nhanh

orderId và productId.

### Không nên trả lời

Chỉ productId.

## Q03

### Giảng viên hỏi

Bảng nào giữ tồn kho?

### Câu trả lời tốt

`product_variants.stock`, vì tồn phụ thuộc tổ hợp màu–cỡ.

### Câu trả lời ngắn nếu bị hỏi nhanh

Biến thể sản phẩm.

### Không nên trả lời

products.stock.

## Q04

### Giảng viên hỏi

Bảng nào nối review với người đã mua?

### Câu trả lời tốt

`reviews.orderId` nối về order; code còn kiểm tra order hoàn tất và chứa product.

### Câu trả lời ngắn nếu bị hỏi nhanh

reviews.orderId.

### Không nên trả lời

Chỉ cần userId.

## Q05

### Giảng viên hỏi

Bảng nào giữ lượt dùng voucher?

### Câu trả lời tốt

`voucher_redemptions` gắn voucher, user và order.

### Câu trả lời ngắn nếu bị hỏi nhanh

Lượt Sử Dụng Phiếu.

### Không nên trả lời

Lưu counter trong voucher là đủ.

## Q06

### Giảng viên hỏi

Media file nằm trong MongoDB không?

### Câu trả lời tốt

Không; Cloudinary giữ file, `product_media` giữ URL/type/vị trí.

### Câu trả lời ngắn nếu bị hỏi nhanh

Mongo chỉ giữ URL/metadata.

### Không nên trả lời

Mongo lưu toàn bộ ảnh.

## Q07

### Giảng viên hỏi

35 hay 36?

### Câu trả lời tốt

36 thực thể logic, 35 collection vật lý; hai lớp khác nhau.

### Câu trả lời ngắn nếu bị hỏi nhanh

36 logic, 35 physical.

### Không nên trả lời

Cả hai đều là số bảng vật lý.

## Q08

### Giảng viên hỏi

MongoDB có FK không?

### Câu trả lời tốt

Không có constraint FK server-side; source kiểm tra logical reference bằng relationshipErrors/assertValid.

### Câu trả lời ngắn nếu bị hỏi nhanh

Không; app kiểm tra.

### Không nên trả lời

Có 50 FK thật trong MongoDB.

## Q09

### Giảng viên hỏi

Payment nối bảng nào?

### Câu trả lời tốt

Nối Order qua orderId và User qua userId.

### Câu trả lời ngắn nếu bị hỏi nhanh

Order và User.

### Không nên trả lời

Chỉ Order.

## Q10

### Giảng viên hỏi

Return Request nối gì?

### Câu trả lời tốt

Nối Order, User và Payment; paymentId có thể nullable cho COD.

### Câu trả lời ngắn nếu bị hỏi nhanh

Order, User, Payment.

### Không nên trả lời

Luôn bắt buộc paymentId.

# LEVEL 2 — Hiểu thiết kế

## Q11

### Giảng viên hỏi

Vì sao tách Order Item?

### Câu trả lời tốt

Vì Order–Product là N:N có qty/price riêng và cần snapshot lịch sử.

### Câu trả lời ngắn nếu bị hỏi nhanh

Junction có thuộc tính và snapshot.

### Không nên trả lời

Vì SQL bắt buộc.

## Q12

### Giảng viên hỏi

Vì sao không gộp Profile vào User?

### Câu trả lời tốt

Identity/auth có vòng đời và quyền truy cập khác dữ liệu cá nhân hóa; profile là 0..1.

### Câu trả lời ngắn nếu bị hỏi nhanh

Tách auth khỏi dữ liệu cá nhân hóa.

### Không nên trả lời

Để có nhiều bảng hơn.

## Q13

### Giảng viên hỏi

Vì sao Payment không đặt unique orderId?

### Câu trả lời tốt

Một order có thể có nhiều attempt/retry; dữ liệu 94/94 không quyết định cardinality.

### Câu trả lời ngắn nếu bị hỏi nhanh

Cho phép payment retry.

### Không nên trả lời

Vì quên thêm index.

## Q14

### Giảng viên hỏi

Vì sao địa chỉ vừa ở addresses vừa snapshot trong order?

### Câu trả lời tốt

Address book là state hiện tại; order phải đóng băng nơi giao tại thời điểm mua.

### Câu trả lời ngắn nếu bị hỏi nhanh

Sổ địa chỉ khác chứng từ.

### Không nên trả lời

Duplicate vô nghĩa.

## Q15

### Giảng viên hỏi

Vì sao màu/size không có collection?

### Câu trả lời tốt

Tập giá trị hiện đóng/đọc cùng variant nên physical MongoDB nhúng; ERD vẫn biểu diễn lookup logic.

### Câu trả lời ngắn nếu bị hỏi nhanh

Lookup logic được nhúng.

### Không nên trả lời

Database bị thiếu bảng.

## Q16

### Giảng viên hỏi

Vì sao reaction là entity?

### Câu trả lời tốt

Quan hệ user–review có thuộc tính value và unique pair; counter không chỉ ra ai đã vote.

### Câu trả lời ngắn nếu bị hỏi nhanh

Bridge có thuộc tính.

### Không nên trả lời

Để tăng normal form.

## Q17

### Giảng viên hỏi

Vì sao lưu price trong order_items?

### Câu trả lời tốt

Đây là snapshot chứng từ, bảo toàn giá lúc mua khi catalog đổi.

### Câu trả lời ngắn nếu bị hỏi nhanh

Giữ giá lịch sử.

### Không nên trả lời

Không cần, join product là đủ.

## Q18

### Giảng viên hỏi

Vì sao Banner không có FK?

### Câu trả lời tốt

Nó là content vận hành độc lập trong ERD hiện tại; link/asset là dữ liệu, không có parent business entity đã xác minh.

### Câu trả lời ngắn nếu bị hỏi nhanh

Content độc lập.

### Không nên trả lời

Mọi bảng đều phải có FK.

## Q19

### Giảng viên hỏi

Vì sao AI model không phải table?

### Câu trả lời tốt

Model là service/runtime component; chỉ artifact cần lưu như ai_descriptions/tryon_history mới là entity.

### Câu trả lời ngắn nếu bị hỏi nhanh

Service không phải dữ liệu nghiệp vụ.

### Không nên trả lời

ERD không hỗ trợ AI.

## Q20

### Giảng viên hỏi

Vì sao logical normalization khác physical MongoDB?

### Câu trả lời tốt

Logical ERD giải thích thực thể/quan hệ; physical design chọn embed/snapshot theo vòng đời và read pattern.

### Câu trả lời ngắn nếu bị hỏi nhanh

Hai lớp có mục tiêu khác.

### Không nên trả lời

MongoDB không cần thiết kế.

# LEVEL 3 — Phản biện kỹ thuật

## Q21

### Giảng viên hỏi

Có transaction MongoDB không?

### Câu trả lời tốt

Không thấy startSession/withTransaction. Atomicity hiện tại dựa trên synchronous mutator trong một process; multi-instance phải đổi.

### Câu trả lời ngắn nếu bị hỏi nhanh

Không; chỉ an toàn trong một process.

### Không nên trả lời

Có vì update chạy cùng lúc.

## Q22

### Giảng viên hỏi

Hai backend cùng đăng ký một email thì sao?

### Câu trả lời tốt

App check có race; users.email hiện không unique. Production phải thêm unique index sau khi dọn dữ liệu.

### Câu trả lời ngắn nếu bị hỏi nhanh

Có race; cần unique email.

### Không nên trả lời

Code đã check nên tuyệt đối an toàn.

## Q23

### Giảng viên hỏi

Hai khách mua món cuối cùng thì sao?

### Câu trả lời tốt

Một process đã được test đúng; nhiều process cần atomic conditional decrement hoặc transaction MongoDB.

### Câu trả lời ngắn nếu bị hỏi nhanh

Một process ổn, multi-instance chưa.

### Không nên trả lời

JavaScript luôn chống được race.

## Q24

### Giảng viên hỏi

Cascade được thực thi ở đâu?

### Câu trả lời tốt

Không có Mongo cascade. Các mô tả cascade/restrict là policy ứng dụng; phải cài trong workflow và integrity check.

### Câu trả lời ngắn nếu bị hỏi nhanh

Ở tầng ứng dụng, không ở Mongo.

### Không nên trả lời

ERD tự cascade.

## Q25

### Giảng viên hỏi

Index càng nhiều càng tốt?

### Câu trả lời tốt

Không; runtime đọc state trong memory, index chủ yếu bảo đảm unique hoặc hỗ trợ query trực tiếp. Mỗi index làm tăng chi phí ghi.

### Câu trả lời ngắn nếu bị hỏi nhanh

Chỉ thêm theo query/constraint.

### Không nên trả lời

Có, thêm hết FK.

## Q26

### Giảng viên hỏi

Review duplicate bị chặn tuyệt đối chưa?

### Câu trả lời tốt

Chưa; app recheck nhưng Mongo thiếu unique `(userId,productId)`, nên multi-instance vẫn có race.

### Câu trả lời ngắn nếu bị hỏi nhanh

Chưa; thiếu unique pair.

### Không nên trả lời

Đã có orderId nên không thể trùng.

## Q27

### Giảng viên hỏi

db.json có phải high availability?

### Câu trả lời tốt

Không; là fallback demo, không tự merge ngược khi Mongo trở lại và có cửa sổ mất dữ liệu.

### Câu trả lời ngắn nếu bị hỏi nhanh

Không, chỉ fallback cục bộ.

### Không nên trả lời

Có hai database nên HA.

## Q28

### Giảng viên hỏi

Một process chết trước flush 40ms thì sao?

### Câu trả lời tốt

Thay đổi đã trả về có thể chưa persist; mức mất không nên khẳng định tuyệt đối một write vì debounce có thể gom nhiều update.

### Câu trả lời ngắn nếu bị hỏi nhanh

Có cửa sổ mất write chưa flush.

### Không nên trả lời

Không thể mất dữ liệu.

## Q29

### Giảng viên hỏi

Soft delete ở đâu?

### Câu trả lời tốt

Product dùng status archive/hidden/draft; chứng từ không hard-delete. Chưa có deletedAt thống nhất toàn schema.

### Câu trả lời ngắn nếu bị hỏi nhanh

Theo status, chưa đồng nhất.

### Không nên trả lời

Tất cả đều có deletedAt.

## Q30

### Giảng viên hỏi

Có đạt 3NF tuyệt đối không?

### Câu trả lời tốt

Logical model tách nhiều entity, nhưng snapshot/order, rating/sold và media arrays là denormalization có chủ đích/đánh đổi.

### Câu trả lời ngắn nếu bị hỏi nhanh

Không tuyệt đối; có denormalization chủ đích.

### Không nên trả lời

Có MongoDB nên không cần normal form.

# LEVEL 4 — Riêng trên JAPANO

## Q31

### Giảng viên hỏi

Hai backend cùng mua món cuối cùng thì thao tác nào phải atomic?

### Câu trả lời tốt

[THỰC TẾ] Đây là đơn vị kho thật; UNIQUE `(productId,colorName,size)` ngăn tách đôi tồn. Áo size M còn 5 nhưng size L còn 0; chỉ L phải báo hết. Điểm yếu: An toàn check-then-decrement chỉ được kiểm thử trong một process, chưa an toàn nhiều instance. [ĐỀ XUẤT] Atomic conditional update theo `_id`/stock hoặc transaction; thêm `variant_stock` khi nhiều kho.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là đơn vị kho thật; UNIQUE `(productId,colorName,size)` ngăn tách đôi tồn.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q32

### Giảng viên hỏi

MongoDB cho embed array; tại sao implementation vẫn tách collection?

### Câu trả lời tốt

[THỰC TẾ] Đây vừa là bảng nối N:N vừa là historical snapshot, không phải duplicate vô nghĩa. Product đổi giá/tên hoặc bị archive, dòng đơn vẫn hiển thị đúng lịch sử. Điểm yếu: Physical Mongo chỉ tách collection; runtime hydrate lại thành `orders.items`, cần một source of truth rõ. [ĐỀ XUẤT] Giữ `order_items` làm nguồn vật lý; thêm variantId/SKU snapshot nếu kho cần đối soát sâu.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây vừa là bảng nối N:N vừa là historical snapshot, không phải duplicate vô nghĩa.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q33

### Giảng viên hỏi

Nếu hai request đăng ký cùng email tới hai instance thì lớp nào chặn?

### Câu trả lời tốt

[THỰC TẾ] Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi. Khoá tài khoản không được làm mất đơn và thanh toán đã phát sinh. Điểm yếu: `users.email` chỉ có index thường; chạy nhiều backend vẫn có race đăng ký trùng email. [ĐỀ XUẤT] Thêm UNIQUE email; nếu một người nhiều vai trò/provider thì tách `user_roles` và `user_identities`.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là danh tính đăng nhập và phân quyền; `id` ổn định còn email có thể đổi.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q34

### Giảng viên hỏi

Vì sao `slug` unique nhưng không dùng làm PK?

### Câu trả lời tốt

[THỰC TẾ] Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`. Giá/tên hiện tại đổi nhưng dòng đơn cũ vẫn giữ giá/tên tại lúc mua. Điểm yếu: Xoá thật bị toàn vẹn chặn khi đã có dòng đơn; chính sách vòng đời chưa được khai báo bằng `deletedAt`. [ĐỀ XUẤT] Soft-delete/archived; thêm `product_categories` nếu một sản phẩm thuộc nhiều danh mục.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là mặt hàng khách duyệt; thứ kho xuất thực tế là `product_variants`.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q35

### Giảng viên hỏi

Webhook lặp ở hai instance thì database constraint nào là lớp cuối?

### Câu trả lời tốt

[THỰC TẾ] Đây là một payment attempt; 94/94 là current data, không phải cardinality bắt buộc. Webhook/return/reconcile có thể lặp; code kiểm tra status/id provider trước khi ghi lặp. Điểm yếu: `orderId` không unique nên schema cho phép N attempt, nhưng `transactionCode` cũng chưa unique ở DB. [ĐỀ XUẤT] Unique/sparse theo provider transaction id; event log webhook; outbox cho side effects.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là một payment attempt; 94/94 là current data, không phải cardinality bắt buộc.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q36

### Giảng viên hỏi

Nếu process chết trước lượt flush Mongo thì những write nào có thể mất?

### Câu trả lời tốt

[THỰC TẾ] Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng. Double-click dùng `clientRequestId`; đổi giá sau mua không đổi tổng đơn cũ. Điểm yếu: `clientRequestId` chưa có unique index DB; state lưu trong memory và ghi Mongo sau debounce 40 ms. [ĐỀ XUẤT] Unique theo `(userId,clientRequestId)`; state machine tập trung; write-through/transaction.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là chứng từ đóng băng một lần mua; items tách để biểu diễn dòng hàng.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q37

### Giảng viên hỏi

Vì sao unique bốn cột mà không chỉ `(userId,productId)`?

### Câu trả lời tốt

[THỰC TẾ] Đây là mapping có dữ liệu riêng; unique bốn trường giữ đúng một dòng mỗi lựa chọn. Cùng áo size M và L là hai dòng hợp lệ; duplicate đúng selection bị unique chặn. Điểm yếu: Route ghi bằng userId trong body ở một số luồng; cần nhất quán authorization theo JWT. [ĐỀ XUẤT] Dùng variantId làm FK và TTL/cleanup cho giỏ bỏ quên.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là mapping có dữ liệu riêng; unique bốn trường giữ đúng một dòng mỗi lựa chọn.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q38

### Giảng viên hỏi

Nếu một product nhiều category, migration hiện tại ảnh hưởng gì?

### Câu trả lời tốt

[THỰC TẾ] Đây là master data; product giữ `categoryId` thay vì chép tên. Đổi tên danh mục một lần, mọi product theo `categoryId` thấy tên mới. Điểm yếu: Thiết kế phẳng, chưa có parent-child; mỗi product chỉ có một category. [ĐỀ XUẤT] Thêm `parentId` tự tham chiếu hoặc bảng `product_categories` cho N:N.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là master data; product giữ `categoryId` thay vì chép tên.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q39

### Giảng viên hỏi

Tại sao wishlist có composite unique còn reviews lại chưa có?

### Câu trả lời tốt

[THỰC TẾ] Đây là N:N thuần, UNIQUE `(userId,productId)` là lớp chống trùng cuối. Người dùng bấm yêu thích hai lần vẫn chỉ có một cặp. Điểm yếu: Integrity có kiểm tra, nhưng sản phẩm archive cần quy tắc hiển thị rõ. [ĐỀ XUẤT] Thêm created source/folder nếu cần nhiều danh sách.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là N:N thuần, UNIQUE `(userId,productId)` là lớp chống trùng cuối.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q40

### Giảng viên hỏi

Vì sao ba index thường chưa đủ chống dùng voucher lặp?

### Câu trả lời tốt

[THỰC TẾ] Đây vừa là bridge ba phía vừa là transaction ledger, không chỉ là bộ đếm. Khách khiếu nại voucher không áp dụng có thể truy đúng redemption/order. Điểm yếu: Ba logical FK có index nhưng collection này chưa được relationshipErrors kiểm tra. [ĐỀ XUẤT] Composite unique theo quy tắc per-user/per-order và quy trình reverse khi order huỷ.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây vừa là bridge ba phía vừa là transaction ledger, không chỉ là bộ đếm.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q41

### Giảng viên hỏi

Nếu huỷ order thì used/redemption có được hoàn không?

### Câu trả lời tốt

[THỰC TẾ] Đây là rule voucher; hai dây tới users là người cấp và người nhận. Voucher hết hạn ngay lúc tạo order thì server từ chối theo thời điểm checkout. Điểm yếu: `used` và redemption có thể lệch nếu write giữa chừng; hai quan hệ tới users dễ bị hiểu nhầm. [ĐỀ XUẤT] Lấy redemption làm ledger nguồn; atomic consume/unique per-user theo policy.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là rule voucher; hai dây tới users là người cấp và người nhận.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q42

### Giảng viên hỏi

Vì sao `paymentId` nullable, và COD hoàn thế nào?

### Câu trả lời tốt

[THỰC TẾ] Đây là workflow hậu mãi tách khỏi order để giữ nhiều lần yêu cầu và timeline. Một order có thể có nhiều yêu cầu theo các nhóm item khác nhau. Điểm yếu: Quy tắc chống chồng lấn item nằm ở code; ảnh chứng minh là URL ngoài DB. [ĐỀ XUẤT] Unique/conditional rule cho active requests và item-level refund ledger.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là workflow hậu mãi tách khỏi order để giữ nhiều lần yêu cầu và timeline.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q43

### Giảng viên hỏi

Hai request review qua hai instance cùng vượt application check thì sao?

### Câu trả lời tốt

[THỰC TẾ] Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair. Sau moderation async, code recheck trùng trong update trước khi push review. Điểm yếu: Thiếu UNIQUE `(userId,productId)` ở MongoDB; hai instance vẫn có thể tạo trùng. [ĐỀ XUẤT] Thêm composite unique; tách `review_media` nếu một review nhiều media có metadata.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là đánh giá verified purchase vì giữ `orderId`, nhưng DB chưa chặn duplicate pair.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q44

### Giảng viên hỏi

Hai request cùng đặt hai địa chỉ mặc định thì sao?

### Câu trả lời tốt

[THỰC TẾ] Đây là sổ địa chỉ 1:N; chứng từ đơn hàng chụp lại địa chỉ thay vì trỏ sống. Khách đổi địa chỉ mặc định nhưng đơn cũ vẫn giữ snapshot địa chỉ đã giao. Điểm yếu: Cần quy tắc chỉ một `isDefault=true` cho mỗi user; index hiện tại chỉ theo `userId`. [ĐỀ XUẤT] Dùng unique partial index cho địa chỉ mặc định hoặc transaction khi đổi mặc định.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là sổ địa chỉ 1:N; chứng từ đơn hàng chụp lại địa chỉ thay vì trỏ sống.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q45

### Giảng viên hỏi

Hai instance cùng trao một card thì lớp nào chống duplicate?

### Câu trả lời tốt

[THỰC TẾ] Đây là aggregate tiến trình của user; card IDs nhúng để đọc một lần. Webhook lặp không được trao cùng card hai lần; collection kiểm tra cardIds trước khi push. Điểm yếu: `cardIds[]` nhúng N:N, không có index/DB constraint cho từng phần tử. [ĐỀ XUẤT] Tách award ledger nếu cần chống trùng ở nhiều instance và audit theo order.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là aggregate tiến trình của user; card IDs nhúng để đọc một lần.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q46

### Giảng viên hỏi

Nếu rating tính từ reviews, tại sao còn lưu `rating`?

### Câu trả lời tốt

[THỰC TẾ] Đây là phần mở rộng 0..1 của sản phẩm; `productId` unique chứng minh bản số. Admin sửa câu chuyện sản phẩm mà không làm thay đổi mã, giá hay tồn kho. Điểm yếu: `rating`/`sold` là dữ liệu dẫn xuất, có nguy cơ lệch nếu cập nhật không đồng bộ. [ĐỀ XUẤT] Tính lại định kỳ hoặc dùng pipeline sự kiện; version nội dung nếu cần audit.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là phần mở rộng 0..1 của sản phẩm; `productId` unique chứng minh bản số.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q47

### Giảng viên hỏi

Đổi phí ship giữa lúc checkout thì đơn lấy giá nào?

### Câu trả lời tốt

[THỰC TẾ] Đây là cấu hình vận hành, không phải giao dịch; order chụp kết quả áp dụng. Admin đổi phí ship, order mới dùng giá mới còn order cũ giữ `ship` snapshot. Điểm yếu: Nhiều loại settings nằm chung collection; cần whitelist và audit ai đổi. [ĐỀ XUẤT] Version/audit log và schema validator theo `_id` từng nhóm.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là cấu hình vận hành, không phải giao dịch; order chụp kết quả áp dụng.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.

## Q48

### Giảng viên hỏi

Tại sao ERD có hai bảng ảnh nhưng MongoDB chỉ có một collection?

### Câu trả lời tốt

[THỰC TẾ] Đây là dấu vết thiết kế cũ; runtime chỉ dùng `product_media`. Giảng viên chỉ vào hai bảng ảnh và hỏi tại sao trùng. Điểm yếu: Đây là dư thừa thật trên ERD, không nên cố bảo vệ như hai nguồn dữ liệu độc lập. [ĐỀ XUẤT] Gộp vào `Hình Ảnh Giao Diện Sản Phẩm` và dùng trường `type=image|video`.

### Câu trả lời ngắn nếu bị hỏi nhanh

Đây là dấu vết thiết kế cũ; runtime chỉ dùng `product_media`.

### Không nên trả lời

Khẳng định hệ thống hoàn hảo, bịa transaction/constraint hoặc chỉ đọc tên bảng.
