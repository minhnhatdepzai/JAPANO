# Rủi ro còn lại và giới hạn chưa xử lý

Ghi nhận ngày 16/08/2026, sau đợt kiểm toán. Mỗi mục nêu rõ **tác động**,
**điều kiện kích hoạt** và **lý do chưa xử lý trong đợt này**.

---

## R-01. Không mở rộng ngang được sang nhiều bản sao máy chủ — P1

**Hiện trạng.** Toàn bộ dữ liệu nghiệp vụ nằm trong một object trong bộ nhớ của
tiến trình Node.js. Tính nguyên tử của luồng đặt hàng dựa vào việc Node chạy một
luồng và hàm sửa đổi là đồng bộ.

**Tác động.** Chạy hai bản sao máy chủ cùng ghi vào một cơ sở dữ liệu sẽ gây mất
cập nhật và có thể bán vượt tồn kho. Cơ chế bảo vệ hiện tại **không** phát hiện
được tình huống này.

**Điều kiện kích hoạt.** Ngay khi triển khai bản sao thứ hai, hoặc dùng bất kỳ
cơ chế tự mở rộng nào.

**Vì sao chưa xử lý.** Cần viết lại tầng lưu trữ: chuyển từ mô hình "một state
trong bộ nhớ, ghi cả khối" sang đọc/ghi trực tiếp từng collection kèm thao tác
nguyên tử phía MongoDB. Đây là thay đổi kiến trúc lớn, rủi ro cao, trong khi hệ
thống hiện chỉ chạy một tiến trình nên **chưa có lỗi thực tế nào để sửa**. Chi
tiết cân nhắc ở `engineering_decisions.md` QĐ-03.

**Hướng xử lý khi cần.** Chuyển thao tác tồn kho sang
`findOneAndUpdate({ stock: { $gte: qty } }, { $inc: { stock: -qty } })`, và dùng
`withTransaction()` cho cụm đơn hàng – chi tiết đơn – thanh toán.

---

## R-02. Phản hồi quá lớn ở điểm cuối quản trị — P1

**Hiện trạng đo được.** `GET /api/state` trả 494 KB. `GET /api/admin/live` trả
317 KB và trang quản trị gọi mỗi 3 giây, tương đương khoảng 105 KB/giây cho mỗi
phiên quản trị đang mở.

**Tác động.** Tăng tuyến tính theo lượng dữ liệu. Với vài quản trị viên cùng mở
trang và danh mục lớn hơn, đây sẽ là nút thắt băng thông và bộ nhớ.

**Điều kiện kích hoạt.** Danh mục vượt vài trăm sản phẩm, hoặc nhiều hơn năm
phiên quản trị mở đồng thời.

**Vì sao chưa xử lý.** Chuyển sang trả dữ liệu theo trang hoặc chỉ trả phần thay
đổi sẽ kéo theo sửa đổi lớn ở trang quản trị. Ở quy mô hiện tại (35 sản phẩm,
94 đơn hàng) phép đo cho thấy p95 vẫn dưới ngưỡng nên chưa phải lỗi.

---

## R-03. Ghi lại toàn bộ state cho mỗi lượt cập nhật — P2

**Hiện trạng.** `store.update()` sao chép toàn bộ state, sửa, rồi thay cả state
và đẩy xuống MongoDB theo lô sau 40 ms.

**Tác động.** Chi phí mỗi thao tác ghi tỉ lệ với **tổng kích thước dữ liệu**, chứ
không phải với lượng dữ liệu thực sự thay đổi.

**Rủi ro phụ.** Nếu tiến trình dừng đột ngột trong cửa sổ 40 ms, thay đổi vừa
thực hiện chưa kịp xuống cơ sở dữ liệu.

**Vì sao chưa xử lý.** Cùng lý do với R-01: thuộc về thiết kế tầng lưu trữ.

---

## R-04. Cơ chế dự phòng `db.json` có thể mất dữ liệu — P1

**Hiện trạng.** Khi MongoDB không truy cập được, hệ thống chuyển sang ghi vào tệp
JSON cục bộ (có sao lưu bản cũ trước khi ghi đè).

**Tác động.** Khi MongoDB trở lại, hệ thống **không tự trộn ngược** những thay đổi
phát sinh trong lúc chạy dự phòng. Các đơn hàng tạo ra trong khoảng đó có thể
không lên được cơ sở dữ liệu chính.

**Vì sao chưa xử lý.** Trộn ngược dữ liệu cần một chiến lược giải quyết xung đột
rõ ràng, vượt phạm vi đồ án.

**Ghi chú quan trọng.** Không được mô tả cơ chế này là "sẵn sàng cao". Nó là bản
dự phòng để buổi trình diễn không bị gián đoạn.

---

## R-05. `products.slug` chưa có chỉ mục duy nhất — P2

**Hiện trạng.** `slug` được dùng làm khoá tra cứu sản phẩm trong toàn hệ thống
nhưng chỉ mục duy nhất chưa được khai báo ở MongoDB.

**Tác động.** Hai sản phẩm trùng `slug` sẽ khiến tra cứu trả về sai sản phẩm.

**Vì sao chưa xử lý.** Cần rà soát dữ liệu hiện có trước, vì tạo chỉ mục duy nhất
trên dữ liệu đã trùng sẽ làm quá trình khởi động thất bại.

---

## R-06. Vector ngữ nghĩa chưa nhúng phần mô tả sản phẩm — P2

**Hiện trạng.** `productText()` chỉ ghép tên, danh mục và các thẻ từ khoá.

**Tác động.** Có thể là nguyên nhân khiến tìm kiếm ngữ nghĩa chưa cho cải thiện
đo được so với tìm kiếm từ khoá (xem `report_vs_code.md` mục 3).

**Vì sao chưa xử lý.** Bộ đánh giá hiện chỉ có 24 truy vấn do chính nhóm gán nhãn.
Thay đổi cách nhúng rồi đo lại trên chính bộ đó rất dễ thành tối ưu theo bộ đánh
giá thay vì cải thiện thật. Chi tiết ở `engineering_decisions.md` QĐ-06.

---

## R-07. Chưa đo được tốc độ khung hình của ứng dụng di động — P2

**Hiện trạng.** Yêu cầu phi chức năng ban đầu nêu 60 khung hình mỗi giây.

**Tác động.** Không có số liệu nào chứng minh, nên không được khẳng định trong
báo cáo.

**Vì sao chưa xử lý.** Cần thiết bị đo và công cụ hồ sơ hoá hiệu năng trên thiết
bị thật; môi trường hiện tại không dựng được phép đo đáng tin cậy.

---

## R-08. Chưa kiểm thử xâm nhập chuyên sâu — P2

**Hiện trạng.** Đợt kiểm toán rà soát kiểm soát truy cập trên toàn bộ 115 điểm
cuối và vá 9 lỗ hổng, nhưng chỉ tập trung vào phân quyền và quyền sở hữu.

**Chưa kiểm tra sâu.** Chèn toán tử MongoDB qua dữ liệu đầu vào, chèn mã kịch bản
qua nội dung do người dùng nhập ở trang quản trị, kiểm tra kiểu và biên của toàn
bộ tham số đầu vào, và các lỗ hổng phụ thuộc bên thứ ba.

**Ghi chú.** Báo cáo phải nói rõ điều này, không được viết "hệ thống bảo mật
tuyệt đối".

---

## R-09. Một số dịch vụ trí tuệ nhân tạo không chạy được liên tục — P2

**Hiện trạng.** Tại thời điểm kiểm toán, CatVTON, FASHN, One-to-All và cổng AI
đều ngoại tuyến; chỉ Ollama và dịch vụ vector ngữ nghĩa khởi động được.

**Tác động.** Không đánh giá được chất lượng đầu ra của chức năng thử đồ ảo và
sinh video chuyển động trong đợt này. Cơ chế suy giảm mềm đã được xác minh hoạt
động (điểm cuối sản phẩm liên quan vẫn trả kết quả khi dịch vụ vector tắt).

**Ghi chú.** Báo cáo chỉ được nêu **kiểm chứng chức năng** cho các mô-đun này,
không được nêu **đánh giá chất lượng mô hình**.

---

## R-10. Bảy điểm cuối đối soát và kiểm duyệt mới chỉ có kiểm thử ở mức truy cập — P3

**Hiện trạng.** Bộ kiểm thử mới xác nhận các điểm cuối này từ chối người gọi
không đủ quyền, nhưng chưa kiểm thử **logic nghiệp vụ** bên trong (ví dụ: đối
soát có cập nhật đúng trạng thái khi cổng thanh toán trả về kết quả khác nhau).

**Vì sao chưa xử lý.** Cần dựng giả lập cổng thanh toán; thuộc nhóm ưu tiên thấp
hơn so với việc bịt lỗ hổng truy cập.
