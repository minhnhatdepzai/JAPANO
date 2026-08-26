# 11 — Database design review

| Hạng mục | Hiện trạng [THỰC TẾ] | Điểm có thể bị hỏi |
|---|---|---|
| 1NF | Phần lớn field scalar; arrays/object tồn tại theo document design | Không tuyên bố relational 1NF tuyệt đối cho document nhúng |
| 2NF | Junction có định danh riêng và thuộc tính phụ thuộc mapping | Không có composite PK vật lý; uniqueness dùng compound index ở một số bảng |
| 3NF | Master data tách category/product/detail/rule | Snapshot order/payment và rating/sold là denormalization có chủ đích |
| Junction | order_items, cart_items, wishlist_items, reactions, redemptions | Flagcard N:N dùng array thay junction collection |
| Duplicate | Order/item/payment snapshot bảo toàn lịch sử | orders.items và order_items cần một source of truth rõ khi refactor |
| Unique | Variant/cart/wishlist/reaction/redemption có compound unique | users.email, reviews(userId,productId), orders clientRequestId còn thiếu DB unique |
| Nullable FK | paymentId ở return cho COD; chat product context có thể thiếu | Nên dùng schema validator theo workflow |
| Index | Có index theo id/FK/compound ở collection trọng yếu | Runtime đọc memory nên không thêm hàng loạt index vô căn cứ |
| Cascade | Business workflow có clear/archive/restrict | MongoDB không có cascade constraint |
| Soft delete | Product/status và transaction history được giữ | Chưa có deletedAt/retention nhất quán |
| Audit | order history, refunds, return timeline, moderation sample | Mảng history trong document chưa phải immutable audit log |
| Transaction integrity | Synchronous mutator + assertValid; tests một process | Không transaction MongoDB, không an toàn multi-instance |

## Điểm có thể bị hội đồng hỏi

### Email chưa unique ở database

> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. Trong một process app check trước khi insert; production nhiều instance phải dọn duplicate rồi thêm unique index.

### Không dùng MongoDB transaction

> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. Phạm vi đồ án dùng state một process và có test concurrency; production cần direct collection writes/atomic condition/transaction.

### Hai entity ảnh nhưng một collection

> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. Thừa nhận dấu vết logic cũ; runtime thống nhất ở product_media và nên gộp entity trong phiên bản sau.

### Review chưa có unique pair

> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. Application recheck chưa phải lớp cuối; cần composite unique `(userId,productId)` theo rule hiện tại.

### Fallback JSON

> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. Là phương án trình diễn, không phải HA; không auto-merge khi Mongo phục hồi.

### Snapshot trùng dữ liệu

> Thiết kế hiện tại chưa tối ưu hoàn toàn ở điểm này. Đây là immutable business snapshot, không phải anomaly; order cũ không được đổi theo catalog/user hiện tại.
