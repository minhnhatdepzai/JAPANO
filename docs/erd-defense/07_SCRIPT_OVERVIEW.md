# 07 — Bài nói ERD tổng (45–60 giây)

> [MỞ ERD TỔNG] ERD của JAPANO có 36 thực thể logic và 50 quan hệ, được chia thành bảy cụm nghiệp vụ. Hai điểm neo lớn nhất là Người Dùng và Sản Phẩm vì hầu hết hành vi mua sắm đều cần biết ai thực hiện và đang tác động lên sản phẩm nào. Đơn Hàng là trung tâm chứng từ: từ đây đi sang Chi Tiết Đơn Hàng để giữ từng dòng và giá lịch sử, sang Thanh Toán để đối soát tiền, và sang Yêu Cầu Trả Hàng để xử lý hậu mãi. Khi trình bày em không đọc 36 bảng, mà đi theo bảy nhánh: catalog–biến thể, media–AI, user–shopping, order–payment–return, promotion–loyalty, review–moderation và dữ liệu hành vi–AI. Sau cùng em nối lại bằng luồng checkout end-to-end.

## Câu dự phòng nếu bị hỏi 36 bảng hay 35 collection

> 36 là thực thể ở mô hình logic; implementation MongoDB có 35 collection vật lý. Màu, kích thước và một thực thể ảnh được nhúng/gộp, trong khi push token và japan spot suggestion là collection kỹ thuật chưa có entity riêng.
