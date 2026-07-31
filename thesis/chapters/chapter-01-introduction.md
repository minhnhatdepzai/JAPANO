# CHƯƠNG 1: GIỚI THIỆU DỰ ÁN

## 1.1. Lý do chọn đề tài

Thị trường mua sắm trực tuyến tại Việt Nam những năm gần đây phát triển nhanh, trong đó thời trang là một trong những nhóm hàng có nhu cầu cao nhờ tính đa dạng về kiểu dáng, màu sắc và phong cách. Tuy nhiên, phần lớn các ứng dụng bán hàng thời trang hiện nay mới dừng ở mức trưng bày sản phẩm và xử lý đơn hàng, chưa hỗ trợ tốt cho những khó khăn đặc thù của việc mua quần áo trực tuyến: người mua không thể thử đồ trước, khó ước lượng kích cỡ phù hợp, và thường thiếu cơ sở để quyết định một món đồ có hợp với phong cách hay các món đồ sẵn có của mình hay không.

Xuất phát từ thực tế đó, nhóm lựa chọn xây dựng JAPANO Store — một ứng dụng thương mại điện tử chuyên về thời trang và sản phẩm phong cách Nhật Bản, với định hướng khác biệt là **kết hợp các chức năng thương mại điện tử tiêu chuẩn với một nhóm tính năng trí tuệ nhân tạo hỗ trợ ra quyết định mua hàng**: trợ lý trò chuyện tư vấn dựa trên danh mục sản phẩm thật, thử đồ ảo bằng mô hình sinh ảnh, tư vấn kích cỡ theo số đo cơ thể, và gợi ý cá nhân hoá dựa trên hành vi người dùng.

Đề tài cũng tạo cơ hội để nhóm thực hành trọn vẹn một chu trình phát triển phần mềm full-stack ở quy mô tương đối lớn: từ phân tích nghiệp vụ, thiết kế cơ sở dữ liệu, xây dựng API, tích hợp cổng thanh toán có xác minh chữ ký, xác thực và phân quyền nhiều cấp, cho tới việc vận hành các mô hình AI chạy cục bộ trên GPU.

## 1.2. Mục tiêu dự án

Dự án đặt ra năm mục tiêu kỹ thuật cụ thể, tất cả đều có thể kiểm chứng trực tiếp bằng mã nguồn:

1. **Xây dựng ứng dụng mua sắm đa nền tảng** bằng Expo/React Native, chạy được trên Android, iOS và Web từ cùng một mã nguồn.
2. **Hoàn thiện luồng mua hàng đầy đủ**, không chỉ dừng ở đặt hàng mà bao gồm cả quy trình hậu mãi: theo dõi đơn, huỷ đơn có phê duyệt, trả hàng kèm ảnh minh chứng, và hoàn tiền qua đúng cổng thanh toán đã sử dụng.
3. **Tích hợp các tính năng AI hỗ trợ mua sắm** — trợ lý chat, thử đồ ảo, tư vấn kích cỡ, gợi ý phối đồ và gợi ý sản phẩm cá nhân hoá — theo nguyên tắc các tính năng này bổ trợ chứ không cản trở luồng thương mại lõi.
4. **Xây dựng trang quản trị Web có phân quyền nhiều cấp**, cho phép phân công công việc giữa nhân viên và quản trị viên với phạm vi dữ liệu khác nhau.
5. **Triển khai xác thực và phân quyền thật ở phía máy chủ**, không chỉ kiểm soát ở giao diện.

Bảng 1.1 đối chiếu từng mục tiêu với minh chứng cụ thể trong mã nguồn.

**Bảng 1.1: Mục tiêu dự án và trạng thái đạt được**

| Mục tiêu | Minh chứng mã nguồn | Trạng thái |
|---|---|---|
| Ứng dụng đa nền tảng | 33 tệp màn hình dưới `mobile/app/`, Expo `~51.0.28` + React Native `0.74.5` | Đạt |
| Luồng mua hàng đầy đủ kể cả hậu mãi | `backend/routes/orders.js`, `backend/routes/returns.js` (4 endpoint huỷ/trả/duyệt) | Đạt |
| Tính năng AI hỗ trợ mua sắm | `backend/routes/stylist.js` (13 endpoint), `backend/routes/tryon.js` (4 endpoint) | Đạt |
| Trang quản trị phân quyền nhiều cấp | `admin/`, bốn cấp vai trò trong `backend/lib/auth.js:88-91` | Đạt |
| Xác thực/phân quyền phía máy chủ | bcrypt + JWT (`backend/lib/auth.js`), 5 middleware phân tầng | Đạt |

## 1.3. Phạm vi chức năng

Phạm vi chức năng của hệ thống được xác định theo bốn nhóm, trình bày tại Bảng 1.2. Danh sách này được xây dựng từ việc đối chiếu từng tính năng của giao diện với endpoint backend tương ứng — chỉ những chức năng có đủ cả hai phía mới được đưa vào phạm vi.

**Bảng 1.2: Phạm vi chức năng của JAPANO Store**

| Nhóm chức năng | Nội dung triển khai |
|---|---|
| Tài khoản người dùng | Đăng ký (có kiểm tra độ mạnh mật khẩu), đăng nhập, quên/đặt lại mật khẩu qua mã xác nhận gửi email, quản lý phiên bằng JWT, xem sản phẩm không cần tài khoản |
| Mua sắm | Duyệt danh mục, tìm kiếm gần đúng, xem chi tiết sản phẩm, danh sách yêu thích, giỏ hàng đồng bộ, sổ địa chỉ, mã giảm giá, đặt hàng, thanh toán COD/Stripe/VNPay, theo dõi đơn, huỷ đơn, trả hàng kèm ảnh, đánh giá sản phẩm sau mua |
| AI thời trang | Trợ lý trò chuyện dựa trên danh mục thật, thử đồ ảo, tạo video chuyển động từ ảnh thử đồ, tư vấn kích cỡ, gợi ý phối đồ, gợi ý sản phẩm cá nhân hoá, mô tả sản phẩm tự động, kế hoạch tiết kiệm mua sắm |
| Nội dung và khách hàng thân thiết | Khám phá địa danh Nhật Bản (có bản đồ tương tác, đánh giá cộng đồng), chương trình thẻ Flagcard, hạng VIP theo chi tiêu tháng, thông báo trong ứng dụng và thông báo đẩy |
| Quản trị | Bảng điều khiển KPI, quản lý sản phẩm theo phạm vi vai trò, quản lý đơn hàng, duyệt yêu cầu huỷ/trả hàng và hoàn tiền, cấp voucher đền bù, gửi thông báo, kiểm duyệt nội dung, phân quyền người dùng |

*Nguồn: `thesis/evidence/feature-inventory.md` (toàn bộ).*

**Các nội dung nằm ngoài phạm vi:** hệ thống không bao gồm trò chơi giải trí tích hợp, hệ thống điểm thưởng/tiền ảo nội bộ, hay xử lý thanh toán ở môi trường thương mại thật (cả hai cổng thanh toán đều được khoá cứng ở chế độ thử nghiệm trong mã nguồn).

## 1.4. Thành viên dự án

**Bảng 1.3: Danh sách thành viên thực hiện**

| STT | Sinh viên | MSSV | Nhiệm vụ chính |
|---|---|---|---|
| 1 | Lê Minh Nhật | PS46869 | Trưởng nhóm; phân tích, thiết kế, phát triển backend, tích hợp chức năng và quản lý dự án |
| 2 | Đặng Huy Phát | PS43608 | Phân tích, thiết kế ứng dụng, xây dựng chức năng và backend |
| 3 | Hồ Ngọc Vũ | PS46157 | Backend, xử lý chức năng, phân tích và thiết kế ứng dụng |

- **Giảng viên hướng dẫn:** Thầy Nguyễn Ngọc Chấn
- **Thời gian thực hiện:** 05/2026 – 07/2026

*Ghi chú: thông tin phân công nhiệm vụ trong bảng trên là thông tin hành chính do nhóm cung cấp, không thể đối chiếu với lịch sử phiên bản mã nguồn (repository bàn giao không chứa lịch sử commit sử dụng được — xem `thesis/evidence/git-history-summary.md`). Nhóm cần rà soát lại bảng này trước khi nộp để bảo đảm phản ánh đúng đóng góp thực tế của từng thành viên.*
