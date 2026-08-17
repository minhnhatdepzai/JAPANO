# Cơ sở dữ kiện dự án JAPANO Store

> Mọi con số và tên gọi trong tài liệu này đều được trích trực tiếp từ mã nguồn
> hoặc từ hệ thống đang chạy tại thời điểm kiểm toán (16/08/2026). Không suy đoán.

---

## 1. Thành phần ứng dụng

| Thành phần | Công nghệ thực tế | Bằng chứng |
|---|---|---|
| Ứng dụng người dùng | React Native + Expo + Expo Router, TypeScript | `mobile/app/`, `mobile/package.json` |
| Cổng quản trị | HTML + CSS + **JavaScript thuần**, 5 tệp trong `admin/js/` (~1.922 dòng) | `admin/index.html`, không có React/Next |
| Máy chủ ứng dụng | Node.js + Express.js, kiến trúc **modular monolith** | `backend/server.js` + 17 tệp `backend/routes/` |
| Cơ sở dữ liệu | MongoDB Atlas, trình điều khiển Node.js chính thức (**không dùng Mongoose**) | `backend/lib/mongo.js` |
| Số điểm cuối REST | **115** | đếm từ `backend/routes/*.js` |
| Số tệp định tuyến | **17** | `ls backend/routes/` |

Ứng dụng chỉ còn mục tiêu Android/iOS — bản dựng web đã bị gỡ. Cổng quản trị là
thành phần web duy nhất, được chính Express phục vụ dưới dạng tệp tĩnh tại `/admin`.

---

## 2. Kiến trúc lưu trữ — điểm quan trọng nhất cần hiểu đúng

Đây là đặc điểm chi phối toàn bộ tính đúng đắn của hệ thống:

```
store.update(mutator)  →  read()  : clone toàn bộ state trong bộ nhớ
                       →  mutator : sửa đổi ĐỒNG BỘ
                       →  write() : normalize → assertValid → thay cả state
                       →  hẹn 40 ms → persistStateToCollections(db, snapshot)
```

- Toàn bộ dữ liệu nghiệp vụ nằm trong **một object JavaScript trong bộ nhớ**.
- Mỗi lượt ghi **thay toàn bộ state**, sau đó đẩy xuống MongoDB theo lô, có debounce 40 ms.
- Không có mutator nào là `async` (đã kiểm tra bằng `grep`), nên toàn bộ chuỗi
  đọc–sửa–ghi chạy trọn vẹn trong một lượt của vòng lặp sự kiện.

**Hệ quả đúng:** trong phạm vi một tiến trình, "kiểm tra tồn kho rồi trừ kho" là
một thao tác không thể bị chen ngang, và mutator ném lỗi thì không để lại thay
đổi dở dang. Đã kiểm chứng bằng `backend/test/checkout-concurrency.test.js`.

**Hệ quả cần nói rõ:** đây **không phải** transaction nhiều tài liệu của MongoDB.
`grep -rn "startSession\|withTransaction"` trên toàn `backend/` cho **0 kết quả**.
Tính chất trên mất hiệu lực nếu chạy nhiều bản sao máy chủ cùng ghi vào một cơ
sở dữ liệu.

---

## 3. Cơ sở dữ liệu

**Tên cơ sở dữ liệu:** `japano` (MongoDB Atlas).

**35 collection vật lý** khai báo trong `backend/lib/mongoCollections.js`:

```
settings, categories, products, product_details, product_variants, product_media,
users, addresses, cart_items, wishlist_items, orders, order_items, payments,
return_requests, discount_rules, vouchers, voucher_redemptions, reviews,
review_reactions, moderation_samples, notifications, flagcards,
flagcard_collections, vip_memberships, banners, interactions, search_logs,
push_tokens, profiles, chats, tryon_history, goals, ai_descriptions,
japan_spot_reviews, japan_spot_suggestions
```

### 3.1. Giải thích mâu thuẫn 35 collection vs 36 thực thể ERD

Không phải lệch một đơn vị, mà là hai chiều lệch bù nhau:

| | Số lượng | Chi tiết |
|---|---:|---|
| Ánh xạ 1–1 giữa thực thể ERD và collection | 33 | |
| Collection **không** có thực thể ERD riêng | 2 | `push_tokens`, `japan_spot_suggestions` |
| Thực thể ERD **không** có collection riêng | 3 | `Màu Sắc`, `Kích Thước`, `Hình Ảnh Giao Diện Sản Phẩm` |
| **Tổng** | **35 / 36** | |

Nguyên nhân là chủ đích thiết kế, không phải lỗi:

- `Màu Sắc` và `Kích Thước` là hai bảng tra cứu ở **mức logic** (chuẩn hoá kiểu
  quan hệ). Ở **mức vật lý**, MongoDB nhúng thẳng `colorName` và `size` vào tài
  liệu `product_variants` — đánh đổi quen thuộc của cơ sở dữ liệu hướng tài liệu:
  bỏ phép nối để đọc một lần ra đủ dữ liệu hiển thị.
- `Hình Ảnh Giao Diện Sản Phẩm` và `Hình Ảnh` cùng được lưu trong `product_media`,
  phân biệt bằng trường loại tệp.
- `push_tokens` và `japan_spot_suggestions` là bảng kỹ thuật, ERD chưa mô hình hoá riêng.

**Cách nói đúng trong báo cáo:** *"Mô hình logic gồm 36 thực thể; hiện thực vật lý
gồm 35 collection."* Không được nói hai con số này là một.

### 3.2. Chỉ mục

Khai báo tập trung trong `ensureMongoIndexes()` (`backend/lib/mongoCollections.js`),
tạo lại mỗi lần khởi động. Ví dụ đã có:
`users.id` (unique), `discount_rules.id` (unique), `discount_rules.code` (unique),
`vip_memberships.id` (unique), `vip_memberships.{userId,status}`,
`vip_memberships.discountRuleId`.

### 3.3. Toàn vẹn tham chiếu

MongoDB không có khoá ngoại. Hệ thống tự kiểm tra bằng `relationshipErrors(state)`
và gọi trong `assertValid()` **trước mỗi lượt ghi**: phát hiện tham chiếu mồ côi
thì ném lỗi `INVALID_RELATIONSHIP` (HTTP 409) và huỷ lượt ghi. Đây là cơ chế thay
thế cho ràng buộc khoá ngoại, thực thi ở tầng ứng dụng.

---

## 4. Xác thực

| Hạng mục | Thực tế |
|---|---|
| Băm mật khẩu | **bcrypt** (`backend/lib/auth.js`) — không có scrypt |
| Phiên làm việc | JWT ký bằng `JWT_SECRET` từ biến môi trường |
| Refresh token | **Không có** — chỉ một mã thông báo, hết hạn thì đăng nhập lại |
| Chính sách mật khẩu | tối thiểu 8 ký tự, chặn mật khẩu quá phổ biến (`passwordStrength`) |
| Quên mật khẩu | mã 6 chữ số, hiệu lực 30 phút, tối đa 5 lần sai, gửi lại cách nhau 60 giây |
| Đăng nhập Google | **Có** — `backend/lib/googleAuth.js`, `POST /api/auth/google` |
| Giới hạn tần suất | `/api/auth/*`: 20 lần / 15 phút · toàn bộ `/api`: 600 lần / 5 phút |

---

## 5. Phân quyền

Bốn vai trò **xếp theo thứ bậc**, khai báo tại `ROLE_RANK` trong `backend/lib/auth.js`:

```
customer (0) < staff (1) < admin (2) < super_admin (3)
```

**Không tồn tại** hệ thống chuỗi quyền kiểu `products:manage`, `roles:grant`
(`grep` cho 0 kết quả). Các bộ lọc: `requireAuth`, `optionalAuth`, `requireStaff`,
`requireAdmin`, `requireSuperAdmin`, `requireSelfOrStaff`.

Phân bố guard sau khi kiểm toán và vá (xem `report_vs_code.md`):

| Mức bảo vệ | Số điểm cuối |
|---|---:|
| Công khai có chủ đích (sản phẩm, health, đăng nhập, webhook) | 55 |
| `requireAuth` (bắt buộc đăng nhập) | 27 |
| `requireSelfOrStaff` (chính chủ hoặc nhân viên) | 6 |
| `requireStaff` | 2 |
| `requireAdmin` | 26 |
| `requireSuperAdmin` | 1 |
| `optionalAuth` (có lọc theo chủ sở hữu bên trong) | 3 |

---

## 6. Thanh toán

| Cổng | Trạng thái | Tệp |
|---|---|---|
| Thanh toán khi nhận hàng (COD) | Hoạt động | `backend/routes/orders.js` |
| Stripe | **Chế độ thử nghiệm (Test mode)** | `backend/routes/paymentsStripe.js` |
| VNPay | **Môi trường Sandbox** | `backend/routes/paymentsVnpay.js` |

Cơ chế bảo đảm đúng đắn — đã kiểm chứng bằng đọc mã nguồn:

- **Idempotency lúc tạo đơn:** `clientRequestId` — gọi lại cùng mã thì trả về đúng
  đơn cũ, không tạo đơn trùng.
- **Idempotency lúc xác nhận thanh toán:** cờ `wasPaid`, `paidAt ||= now`, và lịch
  sử trạng thái được khử trùng theo `txn` — webhook gửi hai lần không sinh hai biên nhận.
- **Xác thực chữ ký:** Stripe dùng `stripe.webhooks.constructEvent`; VNPay kiểm tra
  chữ ký HMAC SHA-512 và trả mã `97` khi sai.
- **Chống gọi lặp phía VNPay:** trả mã `02 — Order already confirmed`.
- **Đối chiếu số tiền:** VNPay trả mã `04` khi số tiền không khớp.
- **Đối soát chủ động:** `POST /api/stripe/reconcile`, `POST /api/vnpay/reconcile`
  hỏi ngược cổng thanh toán về trạng thái thật (dùng cho trường hợp khách đóng app giữa chừng).
- **Giá luôn tính lại ở máy chủ:** `unitPrice()` trong `backend/lib/pricing.js`;
  số tiền do client gửi lên bị bỏ qua hoàn toàn.

---

## 7. Các mô-đun trí tuệ nhân tạo

| Mô-đun | Mô hình | Nơi chạy | Cổng | Trạng thái lúc kiểm toán |
|---|---|---|---:|---|
| Trợ lý hội thoại | Ollama (mô hình ngôn ngữ cục bộ) | **Cục bộ** | 11434 | Trực tuyến |
| Vector ngữ nghĩa | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | **Cục bộ**, CUDA | 7865 | Khởi động được, chạy trên CUDA |
| Thử đồ ảo | CatVTON | **Cục bộ** | 7861 | Ngoại tuyến |
| Thử đồ ảo | FASHN | **Cục bộ** | 7862 | Ngoại tuyến |
| Sinh video chuyển động | One-to-All 1.3B v1 | **Cục bộ** | 7864 | Ngoại tuyến |
| Cổng AI | dịch vụ nội bộ | **Cục bộ** | 8001 | Ngoại tuyến |
| Kiểm duyệt đánh giá | qua Ollama | **Cục bộ** | 11434 | Trực tuyến |

**Toàn bộ AI chạy cục bộ. Không dùng dịch vụ AI đám mây.** Biến `GEMINI_API_KEY`
tồn tại trong tệp môi trường nhưng **không tệp mã nguồn nào đọc nó**
(`grep -rn "gemini" backend/` → 0 kết quả).

Điều phối tài nguyên: `backend/lib/gpuArbiter.js` + `gpuJobQueue.js`, xếp hàng theo
mức ưu tiên của màn hình người dùng đang mở (`POST /api/gpu/focus`).

Suy giảm mềm: khi dịch vụ AI ngoại tuyến, các điểm cuối vẫn trả kết quả bằng tín
hiệu khác. Đã kiểm chứng trực tiếp: với embedding service tắt,
`GET /api/products/:slug/related` vẫn trả về 8 sản phẩm liên quan.

---

## 8. Triển khai — mức độ trưởng thành thực tế

| Môi trường | Trạng thái |
|---|---|
| Phát triển | Máy cá nhân chạy Linux, Node.js v22.23.1, Python 3.11.9 |
| Cơ sở dữ liệu | MongoDB Atlas **thật** (không phải cục bộ) |
| Lưu trữ ảnh | Cloudinary **thật** |
| Stripe | **Test mode** — không phải sản xuất |
| VNPay | **Sandbox** — không phải sản xuất |
| AI | Cục bộ, phụ thuộc GPU của máy phát triển |
| Ứng dụng di động | Bản dựng phát triển (development build) qua Expo |
| Máy chủ công khai | **Chưa có** |

Kết luận trung thực: hệ thống ở mức **nguyên mẫu chạy được đầy đủ trên môi trường
phát triển**, chưa phải hệ thống đã triển khai sản xuất.
