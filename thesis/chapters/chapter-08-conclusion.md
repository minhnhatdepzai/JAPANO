# CHƯƠNG 8: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

## 8.1. Kết luận

Dự án JAPANO Store đã xây dựng được một hệ thống thương mại điện tử thời trang tương đối hoàn chỉnh về mặt chức năng, gồm ba ứng dụng phối hợp trên một nền tảng backend dùng chung: ứng dụng di động đa nền tảng, trang quản trị Web và máy chủ API.

Đối chiếu với năm mục tiêu đề ra ở Chương 1, kết quả đạt được như sau:

**Bảng 8.1: Đối chiếu mục tiêu và kết quả đạt được**

| Mục tiêu | Kết quả | Minh chứng |
|---|---|---|
| Ứng dụng mua sắm đa nền tảng | Đạt | 33 màn hình dưới `mobile/app/`, chạy được Android/iOS/Web từ cùng mã nguồn |
| Luồng mua hàng hoàn chỉnh (danh mục → giỏ → đặt hàng → thanh toán → hậu mãi) | Đạt | Bao gồm cả quy trình hậu mãi có phê duyệt: huỷ đơn, trả hàng kèm ảnh minh chứng, hoàn tiền tự động qua cổng thanh toán |
| Tích hợp AI hỗ trợ mua sắm | Đạt | Trợ lý chat, thử đồ ảo, tư vấn size, gợi ý phối đồ, gợi ý cá nhân hoá — đều có cơ chế dự phòng khi dịch vụ AI không khả dụng |
| Trang quản trị phân quyền nhiều cấp | Đạt | Bốn cấp vai trò (`customer/staff/admin/super_admin`), phân quyền theo cả route lẫn phạm vi dữ liệu |
| Xác thực và phân quyền thật phía máy chủ | Đạt | bcrypt + JWT, middleware phân tầng, kiểm tra quyền sở hữu dữ liệu ở tầng handler |

Về mặt kỹ thuật, hệ thống có tổng cộng **109 endpoint API** phân bố trên 17 module route theo domain nghiệp vụ, **46 trường hợp kiểm thử tự động đều đạt**, và một kiến trúc tiêm phụ thuộc nhất quán giúp tách biệt logic nghiệp vụ khỏi chi tiết hạ tầng (cơ sở dữ liệu, thanh toán, lưu trữ media).

Thông qua dự án, nhóm đã vận dụng và thực hành được một dải kiến thức tương đối rộng: phát triển ứng dụng di động đa nền tảng, thiết kế và triển khai REST API, xác thực/phân quyền, tích hợp cổng thanh toán có xác minh chữ ký, thiết kế cơ sở dữ liệu (cả mô hình tài liệu đang vận hành lẫn thiết kế quan hệ chuẩn hoá), kiểm thử tự động, và điều phối các dịch vụ AI cục bộ chạy trên GPU.

## 8.2. Đánh giá ưu điểm và hạn chế

Mục này trình bày song song các điểm mạnh và điểm yếu đã được xác minh trực tiếp từ mã nguồn, nhằm đưa ra một đánh giá cân bằng và trung thực về sản phẩm.

**Bảng 8.2: Ưu điểm và hạn chế của hệ thống**

| Ưu điểm (đã xác minh) | Hạn chế (đã xác minh) |
|---|---|
| Kiến trúc tiêm phụ thuộc nhất quán: cả 17 module route dùng chung một đối tượng `ctx`, không module nào thao tác trực tiếp với hệ thống tệp/cổng thanh toán | Mô hình phân quyền chưa nhất quán: 5 tệp route có endpoint tin tưởng `userId` từ client mà không xác thực, trong đó có endpoint `/flagcards/admin/grant` không có kiểm tra quyền quản trị |
| Ba phương thức thanh toán dùng chung một hàm tạo đơn, giá luôn được tính lại phía máy chủ | CSP bị tắt trong khi trang quản trị dùng nhiều `innerHTML` động và lưu JWT ở `localStorage` — rủi ro XSS dẫn tới đánh cắp phiên quản trị |
| Xác thực có chiều sâu: bcrypt, JWT, chặn khởi động ở production nếu thiếu `JWT_SECRET`, mặc định từ chối vai trò không xác định | CORS mở hoàn toàn, chưa giới hạn theo danh sách domain |
| Xác minh chữ ký thanh toán đúng chuẩn: webhook Stripe kiểm tra chữ ký, VNPay dùng HMAC-SHA512 với so sánh an toàn theo thời gian | Kiểm tra tệp tải lên chỉ dựa trên tiền tố MIME do client khai báo, chưa xác thực nội dung thật của tệp |
| Khoá cứng chế độ thử nghiệm: Stripe chỉ hoạt động với khoá `sk_test_`/`pk_test_` | Tồn tại giá trị bí mật dự phòng ghi cứng trong mã nguồn (merchant sandbox VNPay) |
| 46/46 kiểm thử tự động đạt, chạy nhanh nhờ tách hàm thuần khỏi tầng HTTP | Chưa có kiểm thử tự động cho xác thực, luồng trả hàng và hai cổng thanh toán; chưa có CI/CD; chưa có kiểm thử giao diện tự động |
| Nguyên tắc không trả kết quả AI giả: khi mô hình thất bại, hệ thống báo lỗi rõ ràng thay vì ghép ảnh dự phòng | Một số màn hình chưa hoàn thiện: biểu mẫu hồ sơ cá nhân chưa lưu được, phần lớn công tắc cài đặt chưa đồng bộ máy chủ, nút đăng nhập Google/Apple mới là giao diện |
| Toàn bộ khối AI đều có phương án dự phòng, luồng thương mại lõi không phụ thuộc GPU | Tồn kho bị trừ ngay khi tạo đơn nhưng chưa tự hoàn lại khi đơn thanh toán trực tuyến thất bại |
| Cơ sở dữ liệu JSON ghi nguyên tử, có cơ chế bảo vệ chống ghi đè dữ liệu mới bằng dữ liệu cũ từ trang quản trị | JSON chưa hỗ trợ giao dịch (transaction) và mở rộng theo chiều ngang |

*Nguồn: `thesis/evidence/security-analysis.md`; `thesis/evidence/testing-evidence.md`; `thesis/evidence/feature-inventory.md`; `thesis/evidence/database-analysis.md`.*

## 8.3. Hướng phát triển

Các đề xuất dưới đây được sắp xếp theo mức độ ưu tiên, xuất phát trực tiếp từ các hạn chế đã nêu ở mục 8.2 thay vì các đề xuất chung chung.

### 8.3.1. Ưu tiên cao — hoàn thiện bảo mật

1. **Bổ sung middleware xác thực cho các route còn thiếu.** Áp dụng `requireAuth` và kiểm tra quyền sở hữu dữ liệu cho các endpoint trong `customerData.js`, `reviews.js`, `stylist.js`, `loyalty.js`, `japanSpots.js`; đặc biệt cần bổ sung `requireAdmin` cho endpoint `/flagcards/admin/grant`. Đây là hạng mục cần xử lý đầu tiên vì ảnh hưởng trực tiếp tới tính riêng tư dữ liệu người dùng.
2. **Rà soát và bật Content Security Policy cho trang quản trị.** Kiểm tra toàn bộ các điểm gán `innerHTML` động trong `admin/js/*.js`, chuyển sang các phương thức an toàn hơn (`textContent`, hoặc escape dữ liệu đầu vào), sau đó bật CSP. Đồng thời cân nhắc chuyển JWT của trang quản trị từ `localStorage` sang cookie `httpOnly` để giảm hậu quả nếu vẫn còn lỗ hổng XSS.
3. **Giới hạn CORS** theo danh sách domain cụ thể thay vì cho phép mọi nguồn gốc.
4. **Xác thực nội dung tệp tải lên** bằng cách kiểm tra chữ ký byte đầu tệp (magic bytes), không chỉ dựa vào tiền tố MIME do client khai báo.

### 8.3.2. Ưu tiên trung bình — chất lượng và độ tin cậy

5. **Mở rộng kiểm thử tự động** sang ba vùng đang trống: xác thực/phân quyền, luồng huỷ đơn–trả hàng–hoàn tiền, và hai cổng thanh toán. Hạ tầng để làm việc này đã có sẵn — các module thanh toán đã xuất khẩu hàm theo đúng mẫu phục vụ kiểm thử, chỉ chưa được khai thác.
6. **Thiết lập quy trình CI/CD** tự động chạy `npm run check` (kiểm thử backend + kiểm tra kiểu TypeScript) mỗi khi có thay đổi mã nguồn, ngăn các thay đổi làm hỏng kiểm thử lọt vào nhánh chính.
7. **Bổ sung kiểm thử giao diện tự động** cho các luồng quan trọng của ứng dụng di động (đăng nhập, đặt hàng, thanh toán) bằng Detox hoặc Maestro.
8. **Khôi phục tồn kho** khi đơn hàng thanh toán trực tuyến bị huỷ hoặc thất bại, tránh tình trạng hàng bị "khoá" bởi các đơn không bao giờ hoàn tất.

### 8.3.3. Ưu tiên thấp — mở rộng quy mô và hoàn thiện trải nghiệm

9. **Hoàn thiện các màn hình chưa đầy đủ chức năng**: kết nối biểu mẫu hồ sơ cá nhân với API cập nhật thông tin, đồng bộ các thiết lập cá nhân lên máy chủ, hoàn thiện hoặc gỡ bỏ các nút đăng nhập mạng xã hội hiện chỉ là giao diện.
10. **Chuyển sang cơ sở dữ liệu có hỗ trợ giao dịch** nếu hệ thống cần phục vụ nhiều người dùng đồng thời. Nhóm đã có sẵn một bộ thiết kế quan hệ chuẩn hoá 47 bảng (`japano_schema_v2.sql`) có thể dùng làm điểm khởi đầu cho công việc này, thay vì phải thiết kế lại từ đầu.
11. **Đánh giá định lượng hệ gợi ý.** Hiện tại các chỉ số xếp hạng ngoại tuyến (NDCG@10, Recall@10) được hệ thống báo cáo trung thực là "chưa đo" thay vì đưa ra con số không có căn cứ. Khi có đủ dữ liệu hành vi thật, cần xây dựng bộ đánh giá ngoại tuyến để đo lường và cải thiện chất lượng gợi ý một cách có cơ sở.
12. **Bổ sung tài liệu cấu hình còn thiếu**, cụ thể là bốn biến SMTP đang được mã nguồn sử dụng nhưng chưa xuất hiện trong `.env.example`.

---

*Ghi chú về phương pháp: toàn bộ nội dung đánh giá trong chương này dựa trên bộ bằng chứng kỹ thuật được xây dựng bằng cách đọc và kiểm chứng trực tiếp mã nguồn (xem thư mục `thesis/evidence/`). Các thông tin không thể xác minh từ mã nguồn — số liệu người dùng thật, số đo hiệu năng dưới tải, lịch sử phát triển theo commit — đã được ghi nhận là chưa có trong `thesis/evidence/missing-information.md` và không được đưa vào báo cáo dưới bất kỳ hình thức suy đoán nào.*
