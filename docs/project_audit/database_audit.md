# Kiểm toán cơ sở dữ liệu

Ngày 16/08/2026. Nguồn: `backend/lib/mongoCollections.js`, `backend/lib/store.js`,
và bản chụp dữ liệu thật `backend/data/db.json`.

---

## 1. Mô hình lưu trữ

MongoDB Atlas, cơ sở dữ liệu `japano`, **35 collection vật lý**. Truy cập bằng
trình điều khiển Node.js chính thức, **không dùng Mongoose**, do đó không có
schema ở tầng thư viện ánh xạ đối tượng.

Điểm cần hiểu đúng: hệ thống **không đọc/ghi trực tiếp từng collection cho mỗi
yêu cầu**. Toàn bộ dữ liệu được nạp một lần lúc khởi động thành một object trong
bộ nhớ (`mongoState`); mọi thao tác nghiệp vụ diễn ra trên object này; sau mỗi
lượt ghi, state được đẩy xuống MongoDB theo lô với độ trễ 40 ms.

Hệ quả trực tiếp lên thiết kế dữ liệu:

- Ràng buộc toàn vẹn **không** do MongoDB áp đặt mà do hàm `relationshipErrors()`
  kiểm tra ở tầng ứng dụng, gọi trong `assertValid()` trước **mỗi** lượt ghi.
  Phát hiện tham chiếu mồ côi thì ném `INVALID_RELATIONSHIP` (HTTP 409) và huỷ
  toàn bộ lượt ghi.
- Chỉ mục MongoDB có tác dụng chủ yếu cho **tính duy nhất** và cho các truy vấn
  ngoài luồng chính, chứ không phải để tăng tốc đọc trong luồng nghiệp vụ (vì
  luồng nghiệp vụ đọc từ bộ nhớ).

Đây là lý do **không** bổ sung hàng loạt chỉ mục trong đợt kiểm toán này: thêm
chỉ mục cho những truy vấn không tồn tại chỉ làm chậm thao tác ghi. Yêu cầu
"chỉ thêm chỉ mục có truy vấn thực tế biện minh" được tuân thủ theo hướng này.

---

## 2. Chỉ mục hiện có

Khai báo tập trung trong `ensureMongoIndexes()`, tạo lại mỗi lần khởi động:

| Collection | Chỉ mục | Kiểu |
|---|---|---|
| `users` | `id` | duy nhất |
| `discount_rules` | `id` | duy nhất |
| `discount_rules` | `code` | duy nhất |
| `vip_memberships` | `id` | duy nhất |
| `vip_memberships` | `{userId, status}` | thường |
| `vip_memberships` | `discountRuleId` | thường |

**Nhận xét.** Chỉ mục `discount_rules.code` là bằng chứng trực tiếp cho thấy
trường `code` của bảng quy tắc giảm giá là **mã định danh của chính quy tắc đó**,
không phải khoá ngoại trỏ sang `vouchers` — đây là điểm từng gây hiểu nhầm trên ERD.

---

## 3. Tính duy nhất được thực thi ở tầng ứng dụng

| Trường | Nơi kiểm tra | Ghi chú |
|---|---|---|
| `users.email` | `POST /api/auth/register`, `PATCH /api/admin/users/:id` | Trả 409 khi trùng |
| `orders.code` | `nextOrderCode()` trong `backend/routes/orders.js` | Lấy mốc cao nhất từng dùng rồi tăng tiếp, có dò trùng. Cách tính cũ dựa trên `orders.length` từng khiến hai đơn khác nhau trùng mã sau khi xoá đơn |
| `vouchers.code` | `validateVoucher()` và luồng lưu từ trang quản trị | |
| `products.slug` | Dùng làm khoá tra cứu trong toàn hệ thống | Chưa có chỉ mục duy nhất ở cơ sở dữ liệu |

---

## 4. Ảnh chụp dữ liệu tại thời điểm đặt hàng (snapshot)

Thiết kế **có chủ đích** sao lại dữ liệu thay vì chỉ giữ tham chiếu:

| Nơi | Trường sao lại | Lý do |
|---|---|---|
| `orders.customer`, `orders.address` | họ tên, số điện thoại, địa chỉ | Khách sửa hồ sơ sau này không làm thay đổi đơn cũ |
| `order_items` | `name`, `colorName`, `colorHex`, `size`, `price` | Đơn cũ giữ đúng giá và tên tại thời điểm mua, kể cả khi sản phẩm đổi giá hoặc bị ẩn |
| `payments` | `orderCode`, `amount`, `currency` | Đối soát với cổng thanh toán không phụ thuộc trạng thái hiện tại của đơn |

Đây là lựa chọn đúng cho miền thương mại điện tử và cần được nêu trong báo cáo
như một quyết định thiết kế, không phải trùng lặp dữ liệu do sơ suất.

---

## 5. Trường thời gian và xoá mềm

| Cơ chế | Cài đặt |
|---|---|
| Thời điểm tạo/cập nhật | `createdAt`, `updatedAt` có ở `orders`, `payments`, `return_requests`, `addresses`, `goals`, `products` |
| Xoá mềm sản phẩm | `products.status` (`active` / `hidden` / `draft`) — không xoá vật lý để đơn cũ còn tham chiếu được |
| Chốt hoàn kho | `order.stockRestoredAt`, `returnRequest.stockRestoredAt` — bảo đảm hoàn kho chỉ có tác dụng một lần |
| Chốt thanh toán | `payment.paidAt ||= now` — webhook gửi lại không ghi đè mốc thời gian đầu tiên |

---

## 6. Cơ chế dự phòng `db.json` — đánh giá rủi ro

`activateFileFallback()` chuyển sang tệp JSON cục bộ **chỉ khi** MongoDB thực sự
không truy cập được. Trước khi ghi đè, hệ thống tạo bản sao
`db.json.pre-fallback-<thời gian>`.

Bình luận trong chính mã nguồn ghi lại một sự cố đã xảy ra thật: một kịch bản đẩy
sản phẩm ghi sai collection khiến MongoDB có sản phẩm nhưng thiếu ảnh; một lần
MongoDB chập là `db.json` bị thay bằng bản thiếu, mất mô tả và ảnh của 9 sản phẩm.
Cơ chế sao lưu trước khi ghi đè được thêm vào sau sự cố đó.

**Rủi ro còn lại.** Nếu MongoDB trở lại sau khi đã chuyển sang tệp cục bộ, hệ
thống không tự trộn ngược thay đổi phát sinh trong lúc chạy dự phòng. Đây là
tình huống có thể mất dữ liệu và **phải nêu là giới hạn**, không được mô tả là
"sẵn sàng cao".

---

## 7. Việc đã làm và việc cố ý không làm

**Đã làm:**
- Xác định chính xác chênh lệch 35 collection vật lý so với 36 thực thể ERD, giải
  thích được từng trường hợp (xem `project_facts.md` mục 3.1).
- Sinh Từ điển dữ liệu tự động từ dữ liệu thật cho 30 collection có dữ liệu
  (`data_dictionary.md`, 640 dòng) — kèm kiểu, tỉ lệ có giá trị, tính duy nhất
  suy ra từ dữ liệu và trường tham chiếu.
- Kiểm chứng bằng kiểm thử rằng lớp `assertValid()` thực sự chặn được state có
  tham chiếu mồ côi (chính lớp này làm 7 kiểm thử cũ thất bại vì fixture sai).

**Cố ý không làm:**
- **Không** thêm chỉ mục mới. Luồng nghiệp vụ đọc từ bộ nhớ nên chỉ mục không rút
  ngắn thời gian phản hồi; thêm vào chỉ làm chậm ghi. Sẽ cần thiết khi chuyển
  sang mô hình đọc/ghi trực tiếp từng collection.
- **Không** đổi `products.slug` thành chỉ mục duy nhất trong đợt này: cần rà soát
  dữ liệu hiện có trước để tránh thao tác tạo chỉ mục thất bại lúc khởi động.
  Đã ghi vào `remaining_risks.md`.
- **Không** chuyển sang transaction MongoDB. Lý do đầy đủ ở `engineering_decisions.md` QĐ-03.
