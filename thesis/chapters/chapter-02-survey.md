# CHƯƠNG 2: KHẢO SÁT

## 2.1. Yêu cầu từ khách hàng và thị trường

Khi mua sắm thời trang trực tuyến, người dùng thường quan tâm tới tốc độ thao tác, chất lượng hình ảnh sản phẩm, tính rõ ràng của giá bán, khả năng chọn đúng kích cỡ và sự thuận tiện khi thanh toán. Với nhóm khách hàng trẻ — đối tượng chính của các sản phẩm phong cách Nhật Bản — yếu tố cá nhân hoá và tư vấn phối đồ cũng có vai trò quan trọng trong việc rút ngắn thời gian ra quyết định.

Bảng 2.1 đối chiếu từng nhóm yêu cầu với chức năng đã được triển khai trong hệ thống, kèm vị trí mã nguồn để có thể kiểm chứng. Cách trình bày này nhằm bảo đảm phần khảo sát không dừng ở mức liệt kê mong muốn chung chung mà gắn trực tiếp với sản phẩm thực tế.

**Bảng 2.1: Yêu cầu nghiệp vụ và chức năng đáp ứng**

| Yêu cầu | Chức năng đáp ứng | Vị trí mã nguồn |
|---|---|---|
| Thao tác nhanh, mua sắm mọi lúc | Ứng dụng di động đa nền tảng, giỏ hàng đồng bộ đa thiết bị, lưu địa chỉ và thẻ thanh toán cho lần mua sau | `mobile/app/`, `backend/routes/addresses.js`, `GET /api/stripe/cards` |
| Thông tin sản phẩm minh bạch | Thư viện ảnh/video có phóng to, mô tả sản phẩm, đánh giá chỉ từ người đã thực sự mua hàng (verified purchase) | `mobile/app/product/[slug].tsx`, `backend/routes/reviews.js` |
| Tìm kiếm thông minh | Tìm kiếm gần đúng chịu được lỗi chính tả, lọc theo danh mục, sắp xếp nhiều tiêu chí | `mobile/app/(tabs)/products.tsx` |
| Cá nhân hoá | Gợi ý sản phẩm dựa trên hành vi thật (xem, tìm kiếm, yêu thích, giỏ hàng, mua), gợi ý phối đồ theo ngày | `backend/lib/recommend.js`, `GET /api/recommendations/home` |
| Hỗ trợ chọn kích cỡ | Tư vấn kích cỡ theo số đo hoặc chiều cao/cân nặng; thử đồ ảo bằng AI | `POST /api/stylist/size`, `POST /api/tryon` |
| Thanh toán đa dạng, an toàn | COD, Stripe (chế độ thử nghiệm), VNPay Sandbox; xác minh chữ ký webhook/URL trả về | `backend/routes/paymentsStripe.js`, `backend/routes/paymentsVnpay.js` |
| Chính sách hậu mãi rõ ràng | Huỷ đơn và trả hàng đều có chính sách hiển thị trước khi gửi yêu cầu, bắt buộc nêu lý do, có quy trình phê duyệt | `mobile/app/order/[id].tsx`, `backend/routes/returns.js` |
| Quản trị hiệu quả | Bảng điều khiển KPI thời gian thực, quản lý đơn hàng/sản phẩm/người dùng, phân quyền theo vai trò | `admin/`, `backend/routes/admin.js`, `backend/routes/health.js` |

*Nguồn: `thesis/evidence/feature-inventory.md`.*

## 2.2. Đối tượng sử dụng

Hệ thống phục vụ bốn nhóm đối tượng tương ứng với bốn cấp vai trò được định nghĩa trong mã nguồn (`backend/lib/auth.js:88-91`), theo thứ tự quyền hạn tăng dần: `customer` → `staff` → `admin` → `super_admin`. Việc phân tách bốn cấp thay vì chỉ hai cấp (khách hàng/quản trị viên) xuất phát từ một yêu cầu nghiệp vụ cụ thể: cửa hàng cần giao cho cộng tác viên/nhân viên quyền tự đăng và quản lý sản phẩm của riêng họ, nhưng không được phép nhìn thấy hay can thiệp vào dữ liệu đơn hàng, khách hàng và sản phẩm của người khác.

### 2.2.1. Khách hàng (`customer`)

Người mua sắm trên ứng dụng di động. Đây là vai trò mặc định khi đăng ký tài khoản mới.

- **Mục tiêu:** tìm và mua được sản phẩm phù hợp sở thích, ngân sách một cách nhanh chóng, thuận tiện.
- **Chức năng chính:** quản lý tài khoản; duyệt và tìm kiếm sản phẩm; xem chi tiết và đánh giá; giỏ hàng và danh sách yêu thích; đặt hàng và thanh toán; theo dõi đơn, huỷ đơn, yêu cầu trả hàng; sử dụng các tính năng AI (trợ lý chat, thử đồ ảo, tư vấn kích cỡ); nhận thông báo.
- **Đặc điểm truy cập:** khách chưa đăng nhập vẫn có thể duyệt danh mục và xem chi tiết sản phẩm; mọi thao tác tạo dữ liệu cá nhân (giỏ hàng, yêu thích, chat, thử đồ, đặt hàng) đều yêu cầu đăng nhập.

### 2.2.2. Nhân viên / cộng tác viên (`staff`)

Người được cấp quyền vào trang quản trị nhưng với phạm vi giới hạn nghiêm ngặt.

- **Mục tiêu:** tự đăng và quản lý danh mục sản phẩm do chính mình phụ trách.
- **Chức năng chính:** xem và chỉnh sửa **chỉ những sản phẩm do chính tài khoản đó tạo ra**; thêm sản phẩm mới; ẩn/hiện sản phẩm của mình.
- **Giới hạn quyền:** không nhìn thấy sản phẩm của người khác; không được xoá vĩnh viễn sản phẩm; không truy cập được dữ liệu đơn hàng, khách hàng, thanh toán; không thấy các mục quản trị khác trên thanh điều hướng.

### 2.2.3. Quản trị viên (`admin`)

Người vận hành cửa hàng hằng ngày.

- **Mục tiêu:** quản lý toàn bộ hoạt động kinh doanh và bảo đảm hệ thống vận hành ổn định.
- **Chức năng chính:** toàn quyền trên sản phẩm (bao gồm xoá); quản lý và cập nhật trạng thái đơn hàng; duyệt yêu cầu huỷ đơn/trả hàng và thực hiện hoàn tiền; cấp voucher đền bù cho khách; gửi thông báo chung hoặc riêng; kiểm duyệt đánh giá và nội dung cộng đồng; xem bảng điều khiển và báo cáo phân tích.

### 2.2.4. Quản trị viên cấp cao (`super_admin`)

- **Mục tiêu:** quản lý nhân sự vận hành hệ thống.
- **Chức năng riêng:** toàn bộ quyền của `admin`, cộng thêm quyền **thay đổi vai trò của tài khoản khác** (cấp/thu hồi quyền quản trị, gán vai trò nhân viên).
- **Ràng buộc bảo vệ:** không thể tự hạ quyền của chính mình — được kiểm tra tường minh ở phía máy chủ nhằm tránh tình huống vô tình mất quyền quản trị cao nhất.

**Bảng 2.2: Tổng hợp vai trò và phạm vi quyền hạn**

| Vai trò | Truy cập trang quản trị | Phạm vi dữ liệu | Ví dụ endpoint được bảo vệ tương ứng |
|---|---|---|---|
| `customer` | Không | Chỉ dữ liệu cá nhân của chính mình | `GET /api/addresses` (`requireAuth`) |
| `staff` | Có (giới hạn) | Chỉ sản phẩm do chính mình tạo | `GET /api/staff/products` (`requireStaff`) |
| `admin` | Có | Toàn bộ dữ liệu kinh doanh | `DELETE /api/products/:id`, `POST /api/returns/:id/action` (`requireAdmin`) |
| `super_admin` | Có | Toàn bộ, cộng quyền phân quyền | `PATCH /api/admin/users/:id` (`requireSuperAdmin`) |

*Nguồn: `thesis/evidence/security-analysis.md` mục 1–2; `thesis/evidence/api-inventory.md`.*

## 2.3. Lập kế hoạch dự án

Dự án được thực hiện theo năm giai đoạn, trình bày tại Bảng 2.3.

**Bảng 2.3: Kế hoạch thực hiện dự án**

| Giai đoạn | Công việc chính | Kết quả |
|---|---|---|
| 1 | Khảo sát nhu cầu, xác định phạm vi và các chức năng chính | Đặc tả yêu cầu ban đầu, định hướng sản phẩm |
| 2 | Phân tích hệ thống, xây dựng use case, kiến trúc và thiết kế cơ sở dữ liệu | Mô hình chức năng, sơ đồ ERD, cấu trúc kỹ thuật |
| 3 | Thiết kế giao diện, luồng màn hình và trải nghiệm người dùng | Giao diện ứng dụng di động và trang quản trị Web |
| 4 | Lập trình frontend, backend, tích hợp AI, thanh toán và bảng điều khiển quản trị | Mã nguồn hoàn chỉnh của hệ thống |
| 5 | Kiểm thử, sửa lỗi, đóng gói, viết tài liệu và chuẩn bị demo | Bộ kiểm thử tự động, tài liệu hướng dẫn, sản phẩm demo |

*Ghi chú về mốc thời gian: repository bàn giao không chứa lịch sử phiên bản (commit history) sử dụng được — xem `thesis/evidence/git-history-summary.md`. Do đó mốc thời gian cụ thể của từng giai đoạn không thể đối chiếu và xác minh từ mã nguồn. Nhóm cần bổ sung mốc thời gian thực tế từ nhật ký làm việc của mình trước khi nộp báo cáo, thay vì suy đoán ngày tháng cho khớp bảng.*
