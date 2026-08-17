# Nhật ký thay đổi — đợt kiểm toán 16/08/2026

---

## Thay đổi mã nguồn

| Tệp | Thay đổi | Lý do |
|---|---|---|
| `backend/routes/payments.js` | `GET /payments/:id`: thêm `requireAuth` và kiểm tra chủ sở hữu; người không phải chủ nhận 404 | Lộ thông tin cá nhân qua mã giao dịch đoán được |
| `backend/routes/reviews.js` | `GET /reviews/admin`, `PATCH /reviews/:id/moderation`: thêm `requireAdmin` | Kiểm duyệt nội dung mở cho người ẩn danh |
| `backend/routes/loyalty.js` | `POST /flagcards/admin/grant`, `POST /flagcards/reconcile`: thêm `requireAdmin` | Cấp thẻ kéo theo phát sinh phiếu giảm giá — thao tác có giá trị tiền |
| `backend/routes/japanSpots.js` | `GET /japan-spots/admin`, `POST /moderation/test`: thêm `requireAdmin` | Hàng chờ kiểm duyệt và công cụ nội bộ |
| `backend/routes/paymentsStripe.js` | `POST /stripe/reconcile`: thêm `requireAdmin` | Đối soát gọi ngược sang cổng thanh toán |
| `backend/routes/paymentsVnpay.js` | `POST /vnpay/reconcile`: thêm `requireAdmin` | Như trên |

Tổng: **6 tệp, 9 điểm cuối được siết quyền.** Không đổi đường dẫn, không đổi
định dạng phản hồi, không đổi hợp đồng giao diện lập trình — hai ứng dụng khách
không phải sửa gì.

**Không thay đổi:** cấu trúc cơ sở dữ liệu, tên trường, tên trạng thái, tên
điểm cuối, mô hình dữ liệu, kiến trúc.

---

## Thay đổi cơ sở dữ liệu

Không có. Đợt kiểm toán **cố ý không** thêm chỉ mục hay đổi lược đồ — lý do đầy
đủ ở `database_audit.md` mục 7 (luồng nghiệp vụ đọc từ bộ nhớ nên chỉ mục không
rút ngắn thời gian phản hồi, thêm vào chỉ làm chậm ghi).

---

## Thay đổi bảo mật

- Chín điểm cuối được gắn bộ lọc phân quyền (bảng trên).
- Bổ sung kiểm tra quyền sở hữu cho `GET /payments/:id`, dùng mã 404 thay 403 để
  không xác nhận mã giao dịch có thật — thống nhất với cách `GET /orders/:id`
  vốn đã làm.
- Bổ sung `backend/test/security-authz.test.js` — 10 kịch bản khoá lại quy tắc
  truy cập, gồm cả kiểm tra ngược rằng điểm cuối công khai vẫn mở.

---

## Thay đổi về trí tuệ nhân tạo

Không sửa mã nguồn mô-đun AI. Bổ sung công cụ đánh giá:

- `tests/ai/semantic_search_dataset.json` — bộ 24 truy vấn gán nhãn thủ công.
- `backend/scripts/benchmark-semantic-search.js` — so sánh truy hồi giữa tìm kiếm
  từ khoá và tìm kiếm ngữ nghĩa theo HitRate@1, HitRate@5, Precision@5,
  Recall@5 và MRR.

Kết quả cho thấy tìm kiếm ngữ nghĩa **chưa** vượt trội, xem `report_vs_code.md`
mục 3. Nhóm **không** chỉnh mô-đun để "cải thiện chỉ số", lý do ở
`engineering_decisions.md` QĐ-06.

---

## Thay đổi hiệu năng

Không tối ưu mã nguồn. Bổ sung công cụ đo:

- `backend/scripts/benchmark-api.js` — đo 11 điểm cuối theo avg, p50, p95, p99,
  thông lượng, kích thước phản hồi và tỉ lệ lỗi.
- Kiểm thử tải tăng dần qua 5 mức đồng thời, kết quả tại
  `docs/project_evidence/load_tests/ramp.md`.

Lý do không tối ưu: phép đo cho thấy **toàn bộ điểm cuối đã đạt ngưỡng đề ra**,
nên không có nút thắt thực tế nào để sửa. Hai điểm về kích thước phản hồi được
ghi nhận là rủi ro ở `remaining_risks.md` R-02.

---

## Thay đổi kiểm thử

| Việc | Chi tiết |
|---|---|
| Sửa 7 kiểm thử hỏng sẵn từ trước | `store-update-throw.test.js` và `user-credentials.test.js` — fixture dựng state thiếu toàn vẹn tham chiếu; chuyển sang dựng trên `emptyState()` |
| Sửa lỗi phụ thuộc môi trường | Ba tệp kiểm thử đơn vị thao tác trên store dạng tệp bị treo khi môi trường có `MONGODB_URI`; nay xoá biến môi trường trước khi nạp module |
| Thêm `security-authz.test.js` | 10 kịch bản kiểm soát truy cập |
| Thêm `checkout-concurrency.test.js` | 4 kịch bản đồng thời và toàn vẹn |
| Thêm `backend/scripts/run-tests-per-file.sh` | Chạy từng tệp có hạn giờ riêng, để một tệp treo không làm mất kết quả của cả bộ |

**Kết quả:** trước kiểm toán 152 kiểm thử / 145 đạt / 7 hỏng →
sau kiểm toán **156 kiểm thử / 156 đạt / 0 hỏng / 0 tệp hết giờ**.

---

## Thay đổi báo cáo

**Mục viết mới:**

| Mục | Nội dung |
|---|---|
| 5.6 | Đóng góp kỹ thuật của nhóm — bảng phân định phần bên thứ ba cung cấp và phần nhóm tự xây dựng, cho 6 hạng mục |
| 6.6 | Kiểm thử kiểm soát truy cập — bảng 9 lỗ hổng, cách khắc phục, kết quả trước/sau, kiểm tra hồi quy ba vai trò |
| 6.7 | Kiểm thử đồng thời — phân tích cơ chế nguyên tử, 4 kịch bản kiểm chứng, và giới hạn một tiến trình |
| 6.8 | Đo hiệu năng — bảng 11 điểm cuối, nhận xét, phát hiện về kích thước phản hồi, kết quả kiểm thử tải |
| 6.9 | Đánh giá tìm kiếm ngữ nghĩa — bảng so sánh 5 chỉ số, giải thích nguyên nhân, ba giới hạn của phép đo |

**Mục viết lại:** 4.2 (tách rõ 36 thực thể logic so với 35 collection vật lý).

---

## Khẳng định không có căn cứ đã gỡ hoặc sửa

| Khẳng định | Xử lý |
|---|---|
| "35 collection" nói gộp với 36 thực thể ERD | Tách rõ hai mức, giải thích từng trường hợp chênh lệch |
| Checkout có tính giao dịch ACID | Giữ mô tả hành vi "tất cả hoặc không gì" nhưng nói rõ cơ chế là một luồng đồng bộ, **không** phải transaction MongoDB, và nêu giới hạn một tiến trình |
| Tìm kiếm ngữ nghĩa chính xác hơn | Thay bằng số đo thật, kết luận là **chưa** có cải thiện đo được ở quy mô hiện tại |
| "AI/ML" cho phân tích quản trị | Gọi đúng: thống kê và chấm điểm theo quy tắc |
| "Thời gian thực" | Gọi đúng: gần thời gian thực bằng polling mỗi 3 giây |
| `db.json` là "sẵn sàng cao" | Gọi đúng: bản dự phòng cho buổi trình diễn, kèm rủi ro mất dữ liệu khi trộn ngược |
| "60 FPS" | Gỡ con số vì chưa đo được |

*(Các khẳng định về Gemini, Mongoose, ReactJS, minigame, chuỗi quyền, scrypt,
Payment Sheet đã được xử lý ở các đợt trước — xem `BAO_CAO_QA.md`.)*

---

## Giới hạn còn lại

Xem `remaining_risks.md` — 10 rủi ro đã ghi nhận, trong đó R-01 (không mở rộng
ngang được) và R-04 (dự phòng `db.json` có thể mất dữ liệu) là hai mục cần nêu
thẳng khi bảo vệ.
