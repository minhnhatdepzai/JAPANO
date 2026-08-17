# Đối chiếu báo cáo với mã nguồn

Kiểm toán ngày 16/08/2026. Mỗi dòng đều kèm cách kiểm chứng lại được.

Trạng thái: `CORRECT` · `INACCURATE` · `OUTDATED` · `UNVERIFIED` · `INCOMPLETE` ·
`BUG` · `SECURITY RISK` · `ARCHITECTURE ISSUE`

---

## 1. Nhóm P0 — lỗ hổng kiểm soát truy cập (phát hiện mới trong lần kiểm toán này)

Cả bảy điểm cuối dưới đây trước đây **không có bộ lọc phân quyền nào**. Chúng đã
được vá trong lần kiểm toán này và có kiểm thử tự động khoá lại
(`backend/test/security-authz.test.js`).

| Điểm cuối | Rủi ro thực tế | Trạng thái | Hành động |
|---|---|---|---|
| `GET /api/payments/:id` | **Lộ thông tin cá nhân.** Mã giao dịch dạng `PAY-JP240784` đoán được cả dải; điểm cuối trả về NGUYÊN đơn hàng kèm họ tên, số điện thoại, địa chỉ giao. Đã chứng minh: gọi không đăng nhập lấy được `Ngô Ngọc Hà · 0912113915 · 196 Nguyễn Huệ, Phường Bến Nghé, TP. Hồ Chí Minh` | SECURITY RISK | Thêm `requireAuth` + kiểm tra chủ sở hữu, trả 404 với người không phải chủ |
| `POST /api/flagcards/admin/grant` | Cấp thẻ kéo theo phát sinh phiếu giảm giá (`ensureRewardVoucher`) — đây là thao tác **có giá trị tiền** | SECURITY RISK | Thêm `requireAdmin` |
| `GET /api/reviews/admin` | Đọc được toàn bộ 31 đánh giá kèm dữ liệu chấm điểm kiểm duyệt nội bộ | SECURITY RISK | Thêm `requireAdmin` |
| `PATCH /api/reviews/:id/moderation` | Ai cũng duyệt/ẩn được đánh giá bất kỳ | SECURITY RISK | Thêm `requireAdmin` |
| `GET /api/japan-spots/admin` | Đọc hàng chờ kiểm duyệt nội dung cộng đồng | SECURITY RISK | Thêm `requireAdmin` |
| `POST /api/stripe/reconcile` | Kích hoạt đối soát, gọi ngược sang cổng thanh toán và ghi lại trạng thái giao dịch | SECURITY RISK | Thêm `requireAdmin` |
| `POST /api/vnpay/reconcile` | Như trên | SECURITY RISK | Thêm `requireAdmin` |
| `POST /api/flagcards/reconcile` | Chạy lại toàn bộ phần thưởng | SECURITY RISK | Thêm `requireAdmin` |
| `POST /api/moderation/test` | Gọi thẳng mô hình ngôn ngữ — tốn tài nguyên, là công cụ nội bộ | SECURITY RISK | Thêm `requireAdmin` |

**Kiểm chứng:** `docs/project_evidence/security/exploit_BEFORE.txt` và `exploit_AFTER.txt`;
bộ kiểm thử đi từ 3/10 lên 10/10.

---

## 2. Nhóm khẳng định trong báo cáo

| Khẳng định trong báo cáo | Thực tế trong mã nguồn | Trạng thái | Hành động |
|---|---|---|---|
| "35 collection" | 35 collection vật lý, **36 thực thể ERD** — lệch hai chiều bù nhau, xem `project_facts.md` mục 3.1 | INACCURATE | Viết lại mục 4.2 để tách rõ mức logic và mức vật lý |
| Cổng quản trị dùng ReactJS/NextJS | HTML + CSS + JavaScript thuần | INACCURATE | Đã sửa ở lần trước |
| MongoDB qua Mongoose | Trình điều khiển Node.js chính thức | INACCURATE | Đã sửa ở lần trước |
| Dùng Gemini AI | `grep -rn "gemini" backend/` → 0 kết quả; biến môi trường tồn tại nhưng không mã nào đọc | INACCURATE | Đã sửa: nêu Ollama cục bộ |
| Mật khẩu băm scrypt hoặc bcrypt | Chỉ bcrypt | INACCURATE | Đã sửa |
| Bộ quyền `products:manage`, `roles:grant`… | Không tồn tại; 4 vai trò thứ bậc | INACCURATE | Đã sửa |
| Minigame, xu thưởng | Không tồn tại dòng mã nào | INACCURATE | Đã gỡ |
| **"Đơn hàng, chi tiết đơn hàng và thanh toán được ghi trong cùng một lần cập nhật… nếu bất kỳ bước nào thất bại thì toàn bộ thay đổi bị huỷ bỏ"** | **Đúng về hành vi, nhưng KHÔNG phải transaction MongoDB.** `grep "startSession\|withTransaction"` → 0 kết quả. Tính nguyên tử đến từ việc state nằm trong bộ nhớ và mutator chạy đồng bộ trên một luồng | INCOMPLETE | Giữ khẳng định nhưng nói rõ cơ chế và giới hạn một tiến trình |
| "API CRUD dưới 500 ms" | **Đã đo:** p95 từ 3,7 ms đến 336 ms trên 11 điểm cuối, tất cả đạt | CORRECT | Bổ sung số liệu đo vào báo cáo |
| "60 FPS trên ứng dụng di động" | **Chưa đo được** trong môi trường hiện tại | UNVERIFIED | Gỡ con số, thay bằng phát biểu định tính |
| "Uptime 99,9%" | Không có hệ thống giám sát nào để đo | UNVERIFIED | Đã gỡ ở lần trước |
| Tìm kiếm ngữ nghĩa giúp truy hồi tốt hơn | **Đã đo trên 24 truy vấn gán nhãn: KHÔNG tốt hơn.** hitRate@5 hoà 0,917; MRR từ khoá 0,846 so với ngữ nghĩa 0,793 | INACCURATE | Viết lại theo đúng số đo, xem mục 3 |
| Phân tích "AI/ML" ở trang quản trị | `backend/lib/analytics.js` là thống kê và heuristic, không có mô hình học máy được huấn luyện | INACCURATE | Gọi đúng tên: phân tích thống kê và chấm điểm theo quy tắc |
| Cập nhật "thời gian thực" | Polling mỗi 3 giây (`admin/js/core.js`) | INACCURATE | Gọi là "gần thời gian thực bằng polling mỗi 3 giây" |
| `db.json` là cơ chế "sẵn sàng cao" | Là bản dự phòng cục bộ, kích hoạt khi MongoDB không truy cập được; có sao lưu trước khi ghi đè | INACCURATE | Gọi đúng: dự phòng cho buổi trình diễn, không phải sẵn sàng cao |

---

## 3. Phát hiện quan trọng: tìm kiếm ngữ nghĩa không vượt trội tìm kiếm từ khoá

Đo trên 24 truy vấn gán nhãn thủ công, 35 sản phẩm thật, K = 5
(`tests/ai/semantic_search_dataset.json`, kịch bản `backend/scripts/benchmark-semantic-search.js`):

| Chỉ số | Từ khoá | Ngữ nghĩa |
|---|---:|---:|
| HitRate@1 | **0,792** | 0,708 |
| HitRate@5 | 0,917 | 0,917 |
| Precision@5 | **0,367** | 0,317 |
| Recall@5 | **0,743** | 0,663 |
| MRR | **0,846** | 0,793 |

Phân tích từng truy vấn: 21/24 cả hai cùng trúng, ngữ nghĩa thắng 1 truy vấn
("váy phối cùng áo truyền thống"), thua 1, cả hai cùng trượt 1.
**0/24 truy vấn** rơi vào trường hợp từ khoá không tìm được gì.

**Nguyên nhân:** `productText()` trong `backend/lib/embeddings.js` chỉ nhúng
`name + category + tags + visualTags`, không nhúng phần mô tả. Bộ thẻ của 35 sản
phẩm lại được biên tập rất kỹ bằng tiếng Việt ("lễ hội", "mùa đông", "công sở"),
nên baseline từ khoá vốn đã rất mạnh trên chính tập dữ liệu này.

**Giới hạn của phép đo:** bộ đánh giá chỉ có 24 truy vấn trên 35 sản phẩm, do
chính nhóm gán nhãn. Kết quả mang tính tham khảo, chưa đủ để kết luận thống kê
chặt chẽ, và có thể thiên lệch vì người gán nhãn biết trước bộ thẻ sản phẩm.

**Kết luận cho báo cáo:** không được viết "tìm kiếm ngữ nghĩa chính xác hơn".
Cách viết đúng: *"Trên bộ đánh giá 24 truy vấn, tìm kiếm ngữ nghĩa đạt HitRate@5
ngang với tìm kiếm từ khoá (0,917) nhưng thấp hơn ở MRR (0,793 so với 0,846).
Với quy mô 35 sản phẩm và bộ thẻ được biên tập kỹ, thành phần ngữ nghĩa chưa
mang lại cải thiện đo được; giá trị của nó nằm ở khả năng bổ sung tín hiệu khi
danh mục mở rộng và thẻ không còn bao phủ đủ."*

---

## 4. Nhóm P1 — vấn đề kỹ thuật đã ghi nhận

| Vấn đề | Bằng chứng | Trạng thái | Xử lý |
|---|---|---|---|
| 7 kiểm thử hỏng sẵn từ trước | `store-update-throw.test.js`, `user-credentials.test.js` ném `INVALID_RELATIONSHIP` vì fixture dựng state thiếu toàn vẹn tham chiếu | BUG | **Đã sửa** fixture (dùng `emptyState()`), 7 test chuyển sang đạt |
| `GET /api/state` trả 494 KB | Đo bằng benchmark | ARCHITECTURE ISSUE | Ghi nhận, chưa tối ưu (xem `remaining_risks.md`) |
| `GET /api/admin/live` trả 317 KB, trang quản trị gọi mỗi 3 giây (~105 KB/s cho mỗi phiên) | `admin/js/core.js` + benchmark | ARCHITECTURE ISSUE | Ghi nhận |
| `GET /api/health` chậm nhất trong các điểm cuối (p99 = 1.087 ms) | Vì kiểm tra trực tiếp MongoDB, Cloudinary và các dịch vụ AI | CORRECT (có chủ đích) | Ghi chú trong báo cáo, không tính vào NFR của API nghiệp vụ |
| Mỗi lượt ghi sao chép và ghi lại **toàn bộ** state | `store.js` — `read()` clone cả state, `write()` thay cả state | ARCHITECTURE ISSUE | Chấp nhận ở quy mô hiện tại (35 sản phẩm, 94 đơn); nêu rõ là giới hạn mở rộng |
| Vector ngữ nghĩa không nhúng phần mô tả sản phẩm | `productText()` | INCOMPLETE | Ghi nhận là hướng cải thiện, không sửa vì chưa có bằng chứng cho thấy sửa sẽ tốt hơn |

---

## 5. Nhóm đã đúng — xác nhận sau khi đọc mã nguồn

Những điểm sau ban đầu bị nghi ngờ nhưng kiểm tra cho thấy **đã được cài đặt đúng**:

| Hạng mục | Bằng chứng |
|---|---|
| Giá luôn tính lại ở máy chủ | `normalizedOrderItems()` gọi `unitPrice()`, bỏ qua giá client gửi |
| Chặn đặt màu/kích cỡ không tồn tại | `assertStockAvailable()` kiểm tra tập màu thật trước khi cho đi tiếp |
| Không bán vượt tồn kho | Kiểm tra và trừ kho trong cùng một mutator đồng bộ — đã kiểm chứng bằng kiểm thử đồng thời |
| Idempotency khi tạo đơn | `clientRequestId` |
| Idempotency khi xác nhận thanh toán | cờ `wasPaid`, `paidAt ||= now`, khử trùng lịch sử theo `txn` |
| Idempotency khi hoàn kho | cờ `stockRestoredAt` |
| Chống dò mã đơn hàng | `GET /orders/:id` trả 404 thay vì 403 cho người không phải chủ |
| Lọc đơn hàng theo chủ sở hữu | `GET /orders` với `optionalAuth` lọc theo `req.user.id` |
| Lọc thông báo theo chủ sở hữu | `GET /notifications` |
| Mã đơn hàng không trùng | Lấy mốc cao nhất từng dùng rồi tăng tiếp, có dò trùng |
| Giới hạn tần suất đăng nhập | 20 lần / 15 phút |
| Bảo toàn thông tin xác thực khi quản trị ghi đè | `preserveCredentials()` — trang quản trị không xoá được mật khẩu đã lưu |
| Kiểm tra toàn vẹn tham chiếu trước mỗi lượt ghi | `assertValid()` → `relationshipErrors()` |
| Sao lưu trước khi ghi đè `db.json` | `activateFileFallback()` tạo bản `.pre-fallback-<thời gian>` |
