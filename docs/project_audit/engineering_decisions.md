# Quyết định kỹ thuật trong đợt kiểm toán

Mỗi mục theo khung: **Vấn đề → Hiện trạng → Rủi ro → Phương án → Lựa chọn → Đánh đổi → Kiểm thử → Kết quả.**

---

## QĐ-01. Lộ thông tin cá nhân qua điểm cuối tra cứu giao dịch

**Vấn đề.** `GET /api/payments/:id` không có bộ lọc phân quyền nào.

**Hiện trạng.** Điểm cuối trả về `{ payment, order }`, trong đó `order` chứa họ
tên, số điện thoại và địa chỉ giao hàng của khách. Mã giao dịch có dạng
`PAY-JP240784` — đếm tăng dần, đoán được cả dải.

**Rủi ro.** Bất kỳ ai cũng duyệt được toàn bộ thông tin cá nhân của khách hàng
chỉ bằng một vòng lặp. Đã chứng minh bằng thực nghiệm, kết quả lưu tại
`docs/project_evidence/security/exploit_BEFORE.txt`.

**Phương án.**
1. Đổi mã giao dịch sang dạng ngẫu nhiên khó đoán.
2. Bắt buộc đăng nhập và kiểm tra chủ sở hữu.
3. Cắt bớt trường nhạy cảm trong phản hồi.

**Lựa chọn.** Phương án 2. Phương án 1 không giải quyết gốc rễ (vẫn lộ nếu biết
mã) và làm hỏng dữ liệu lịch sử. Phương án 3 làm hỏng màn hình kết quả thanh
toán của ứng dụng vốn cần đọc đơn hàng.

**Cách làm.** Thêm `requireAuth`; so `payment.userId` với `req.user.id`; người
không phải chủ nhận **404 chứ không phải 403** — trả 403 là xác nhận mã giao dịch
có thật, đủ để dò ra dải mã đang dùng. Cách xử lý này thống nhất với
`GET /orders/:id` vốn đã làm đúng từ trước.

**Đánh đổi.** Ứng dụng phải đăng nhập mới xem được kết quả thanh toán. Kiểm tra
`mobile/lib/api.ts` cho thấy `requestJson` tự đính `Authorization` nên không có
client nào bị hỏng.

**Kiểm thử.** `backend/test/security-authz.test.js` + kiểm tra hồi quy ba chiều:
chủ sở hữu → 200, người khác → 404, ẩn danh → 401.

**Kết quả.** Đạt cả ba. Bằng chứng: `docs/project_evidence/security/regression_ownership.txt`.

---

## QĐ-02. Tám điểm cuối quản trị không có bộ lọc phân quyền

**Vấn đề.** `GET /reviews/admin`, `PATCH /reviews/:id/moderation`,
`POST /flagcards/admin/grant`, `POST /flagcards/reconcile`,
`GET /japan-spots/admin`, `POST /moderation/test`,
`POST /stripe/reconcile`, `POST /vnpay/reconcile` — đều gọi được khi chưa đăng nhập.

**Rủi ro.** Nghiêm trọng nhất là `flagcards/admin/grant`: cấp thẻ kéo theo phát
sinh phiếu giảm giá qua `ensureRewardVoucher`, tức là **thao tác có giá trị tiền**.
`PATCH /reviews/:id/moderation` cho phép người ngoài duyệt đánh giá rác của chính
mình hoặc ẩn đánh giá của đối thủ.

**Phương án.**
1. Thêm bộ lọc `requireAdmin` cho từng điểm cuối.
2. Gom các điểm cuối quản trị vào một tiền tố `/api/admin/*` rồi bảo vệ cả nhóm.

**Lựa chọn.** Phương án 1. Phương án 2 gọn hơn về lâu dài nhưng đổi đường dẫn
sẽ làm hỏng cả trang quản trị lẫn ứng dụng — vi phạm nguyên tắc không phá vỡ
hành vi đang chạy. Phương án 1 là thay đổi nhỏ nhất khắc phục đúng lỗ hổng.

**Đánh đổi.** Vẫn phải nhớ gắn bộ lọc thủ công cho mỗi điểm cuối mới. Bù lại,
bộ kiểm thử `security-authz.test.js` đóng vai trò lưới an toàn.

**Kiểm thử.** Bộ kiểm thử đi từ **3/10 lên 10/10**; đồng thời kiểm tra ngược để
chắc rằng bốn điểm cuối công khai (`/health`, `/products`, `/shop`,
`/locations/provinces`) vẫn mở, và quản trị viên hợp lệ vẫn gọi được cả sáu
điểm cuối vừa siết.

---

## QĐ-03. Không dùng transaction MongoDB — mô tả đúng cơ chế thay thế

**Vấn đề.** Báo cáo mô tả checkout có tính "tất cả hoặc không gì", trong khi
`grep -rn "startSession\|withTransaction"` trên toàn `backend/` cho **0 kết quả**.

**Hiện trạng.** Toàn bộ state nằm trong một object trong bộ nhớ.
`store.update(mutator)` đọc bản sao, chạy mutator **đồng bộ**, rồi thay cả state.
Không mutator nào là `async` — đã kiểm tra bằng `grep`.

**Phân tích.** Vì Node.js chạy một luồng và mutator không có `await`, không yêu
cầu nào chen vào giữa được. Do đó:
- kiểm tra tồn kho rồi trừ kho **thực sự** là một thao tác không thể tách rời;
- mutator ném lỗi thì `write()` không bao giờ chạy, nên không có thay đổi dở dang.

Tính chất này là thật, nhưng **không phải** ACID nhiều tài liệu, và **mất hiệu
lực khi chạy nhiều bản sao máy chủ**.

**Phương án.**
1. Chuyển sang transaction MongoDB thật (`withTransaction`).
2. Chuyển thao tác tồn kho sang `findOneAndUpdate` có điều kiện, nguyên tử phía cơ sở dữ liệu.
3. Giữ nguyên cài đặt, mô tả đúng cơ chế và giới hạn, đồng thời viết kiểm thử khoá lại tính chất đó.

**Lựa chọn.** Phương án 3.

**Lý do.** Phương án 1 đòi hỏi viết lại toàn bộ tầng lưu trữ: hiện tại mỗi lượt
ghi thay cả state rồi đẩy xuống MongoDB theo lô có debounce 40 ms — mô hình này
không tương thích với transaction theo phiên. Đây là thay đổi kiến trúc lớn, rủi
ro cao, trong khi hệ thống chỉ chạy một tiến trình nên **chưa có lỗi thực tế nào
để sửa**. Phương án 2 chỉ vá được tồn kho, không giải quyết tính nhất quán giữa
đơn hàng – chi tiết đơn – thanh toán, mà lại phá vỡ mô hình "một nguồn state duy nhất".

**Đánh đổi.** Hệ thống **không thể mở rộng ngang** sang nhiều bản sao máy chủ nếu
không làm lại tầng lưu trữ. Đây là giới hạn phải nêu thẳng trong báo cáo và là
điều kiện kích hoạt cho hướng phát triển tương lai.

**Kiểm thử.** `backend/test/checkout-concurrency.test.js`, 4 kiểm thử:
- 200 lượt `update()` đồng thời → không mất cập nhật nào;
- 50 lượt mua đồng thời trên tồn kho 5 → đúng 5 lượt thành công, 45 bị từ chối, tồn kho về 0, không âm;
- mutator ném lỗi giữa chừng → tồn kho giữ nguyên;
- hoàn kho gọi ba lần → chỉ cộng một lần.

**Kết quả.** 4/4 đạt.

---

## QĐ-04. Bảy kiểm thử hỏng sẵn từ trước

**Vấn đề.** `store-update-throw.test.js` và `user-credentials.test.js` ném
`INVALID_RELATIONSHIP`.

**Nguyên nhân gốc.** Fixture dựng state bằng cách lấy state đã seed rồi **thay
mảng `users`**. Toàn bộ đơn hàng và giỏ hàng của bản seed lập tức trở thành tham
chiếu mồ côi, và `assertValid()` — vốn được thêm vào sau khi hai tệp kiểm thử này
ra đời — chặn lượt ghi.

**Xác minh.** Chạy lại hai tệp trên bản mã nguồn chưa sửa (`git stash`) cho đúng
7 lỗi như cũ → khẳng định không phải do đợt kiểm toán gây ra.

**Lựa chọn.** Sửa fixture, dựng trên `emptyState()` thay vì state đã seed. Không
nới lỏng `assertValid()` — chính nó là lớp bảo vệ toàn vẹn tham chiếu.

**Kết quả.** 7/7 chuyển sang đạt. Hai tệp này kiểm thử đúng tính chất "tất cả
hoặc không gì" nêu ở QĐ-03, nên việc khôi phục chúng có giá trị kép.

---

## QĐ-05. Nới giới hạn tần suất khi đo hiệu năng

**Vấn đề.** Lần benchmark đầu tiên có nhiều điểm cuối lỗi 100%.

**Nguyên nhân.** `generalApiLimiter` giới hạn 600 yêu cầu / 5 phút; phép đo gửi
120 yêu cầu × 5 điểm cuối = đúng 600 → chạm trần, trả HTTP 429.

**Nhận định.** Đây **không phải lỗi** — lớp giới hạn đang hoạt động đúng thiết kế.

**Lựa chọn.** Nới `JAPANO_RATE_LIMIT_MAX` **chỉ trong tiến trình dùng để đo**, giữ
nguyên cấu hình chạy thật. Ghi rõ điều này trong tệp kết quả để người đọc không
hiểu nhầm rằng hệ thống không có giới hạn tần suất.

**Bổ sung.** Sửa kịch bản benchmark: khi tỉ lệ lỗi cao thì báo `NHIỄU (lỗi cao)`
hoặc `KHÔNG ĐO ĐƯỢC` thay vì vẫn đánh dấu `ĐẠT` — bản đầu tiên đánh giá sai vì
p95 của một tập rỗng vẫn nhỏ hơn 500.

---

## QĐ-06. Không "cải thiện" tìm kiếm ngữ nghĩa khi chưa có bằng chứng

**Vấn đề.** Đo được rằng tìm kiếm ngữ nghĩa **không** vượt tìm kiếm từ khoá
(MRR 0,793 so với 0,846).

**Nguyên nhân khả dĩ.** `productText()` chỉ nhúng `name + category + tags +
visualTags`, bỏ qua phần mô tả và câu chuyện sản phẩm.

**Phương án.**
1. Nhúng thêm mô tả rồi đo lại.
2. Giữ nguyên, ghi nhận kết quả đo và nêu giả thuyết.

**Lựa chọn.** Phương án 2.

**Lý do.** Bộ đánh giá chỉ có 24 truy vấn do chính nhóm gán nhãn, lại được viết
khi đã biết bộ thẻ sản phẩm. Thay đổi cách nhúng rồi đo lại **trên chính bộ dữ
liệu đó** rất dễ trở thành tối ưu theo bộ đánh giá thay vì cải thiện thật. Với
mẫu nhỏ như vậy, một thay đổi cho kết quả nhích lên cũng không đủ căn cứ kết luận.

**Cách xử lý trong báo cáo.** Nêu đúng số đo, nêu giả thuyết về nguyên nhân, và
xếp việc "nhúng thêm mô tả rồi đánh giá lại trên bộ truy vấn lớn hơn do người
ngoài gán nhãn" vào phần hướng phát triển.

**Nhận xét.** Đây là kết quả âm tính nhưng có giá trị: nó cho thấy trên danh mục
35 sản phẩm với bộ thẻ biên tập kỹ, so khớp từ khoá đã đủ mạnh. Giá trị của thành
phần ngữ nghĩa chỉ xuất hiện khi danh mục lớn lên và bộ thẻ không còn bao phủ đủ.
