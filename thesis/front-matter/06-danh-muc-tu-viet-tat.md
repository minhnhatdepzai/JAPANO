# DANH MỤC TỪ VIẾT TẮT VÀ THUẬT NGỮ

> Bảng dưới đây giải thích các từ viết tắt và thuật ngữ kỹ thuật dùng trong báo cáo. Cột **"Xuất hiện ở"** được lập bằng cách tìm kiếm thật trên 8 tệp chương, không phải liệt kê phỏng đoán — nhờ đó nhóm biết chính xác thuật ngữ nào đã dùng ở đâu, và thuật ngữ nào hiện chỉ tồn tại trong mã nguồn.

## A. Thuật ngữ có xuất hiện trong thân bài

| Viết tắt / Thuật ngữ | Tên đầy đủ | Nghĩa tiếng Việt và giải thích ngắn | Xuất hiện ở chương |
|---|---|---|---|
| API | Application Programming Interface | Giao diện lập trình ứng dụng — tập các điểm truy cập (endpoint) để ứng dụng khách gọi tới máy chủ. Hệ thống có 111 endpoint trên 17 tệp route | 1, 3, 4, 5, 6, 7, 8 |
| JWT | JSON Web Token | Mã thông báo xác thực dạng chuỗi có ký số, dùng để duy trì phiên đăng nhập mà không cần lưu session phía máy chủ | 1, 3, 4, 5, 7, 8 |
| bcrypt | *(tên thuật toán)* | Thuật toán băm mật khẩu có chi phí tính toán điều chỉnh được (dự án dùng cost 10), chống tấn công dò mật khẩu bằng vũ lực | 1, 3, 4, 5, 8 |
| VIP | Very Important Person | Hạng khách hàng thân thiết, xét theo mức chi tiêu tích luỹ trong tháng; kèm ưu đãi giảm giá | 1, 3, 4, 5, 6 |
| COD | Cash On Delivery | Thanh toán tiền mặt khi nhận hàng — phương thức không phát sinh bước hoàn tiền qua cổng thanh toán | 1, 2, 3, 5, 6, 7 |
| HMAC | Hash-based Message Authentication Code | Mã xác thực thông điệp dựa trên hàm băm; dùng để ký và xác minh dữ liệu trả về từ VNPay (HMAC-SHA512) | 3, 4, 5, 8 |
| webhook | *(thuật ngữ tích hợp)* | Điểm truy cập do máy chủ ta cung cấp để cổng thanh toán chủ động gọi vào khi có sự kiện, thay vì ta phải liên tục hỏi | 2, 3, 7, 8 |
| sandbox | *(chế độ thử nghiệm)* | Môi trường mô phỏng của cổng thanh toán, dùng tiền ảo; hệ thống chưa từng xử lý giao dịch tiền thật | 2, 3, 4, 5, 6, 7, 8 |
| Stripe | *(tên cổng thanh toán)* | Cổng thanh toán thẻ quốc tế; trong dự án giới hạn ở Test Mode | 1, 2, 3, 4, 5, 6, 7, 8 |
| VNPay | *(tên cổng thanh toán)* | Cổng thanh toán nội địa Việt Nam; trong dự án trỏ tới máy chủ Sandbox, có xác minh chữ ký HMAC-SHA512 | 1, 2, 3, 4, 5, 6, 7, 8 |
| CSP | Content Security Policy | Chính sách bảo mật nội dung của trình duyệt, hạn chế nguồn tài nguyên được phép thực thi. Hiện **đang tắt** trên trang quản trị — ghi nhận là hạn chế | 7, 8 |
| CORS | Cross-Origin Resource Sharing | Cơ chế chia sẻ tài nguyên giữa các nguồn khác nhau. Hiện cấu hình mở hoàn toàn — cần siết trước khi triển khai thật | 7, 8 |
| helmet | *(tên thư viện)* | Middleware Express bổ sung các HTTP header bảo mật | 3, 4 |
| middleware | *(thuật ngữ Express)* | Lớp xử lý trung gian nằm giữa yêu cầu và bộ xử lý cuối; dự án dùng để xác thực và phân quyền | 1, 3, 5, 7, 8 |
| atomic write | *(ghi nguyên tử)* | Kỹ thuật ghi tệp qua tệp tạm rồi đổi tên, đảm bảo tệp dữ liệu không bị hỏng nếu tiến trình dừng giữa lúc ghi | 3, 4 |
| Levenshtein | Levenshtein distance | Khoảng cách Levenshtein — số phép sửa tối thiểu giữa hai chuỗi; là cơ sở của tìm kiếm gần đúng tự triển khai, không dùng dịch vụ tìm kiếm ngoài | 3, 5 |
| embedding | *(vector nhúng)* | Biểu diễn sản phẩm dưới dạng vector số để so sánh độ tương đồng ngữ nghĩa | 3, 4, 5, 6, 7 |
| ERD | Entity Relationship Diagram | Sơ đồ thực thể – liên kết, mô tả cấu trúc dữ liệu | 2, 4 |
| Cloudinary | *(tên dịch vụ)* | Dịch vụ lưu trữ và xử lý ảnh/video trên đám mây; dùng cho ảnh sản phẩm và ảnh minh chứng trả hàng | 3, 5 |
| Expo / React Native | *(tên nền tảng)* | Nền tảng phát triển ứng dụng di động đa nền tảng bằng JavaScript/TypeScript; dự án dùng Expo `~51.0.28`, React Native `0.74.5`, React `18.2.0` | 1, 3, 4, 5, 6, 7 |
| FAB | Floating Action Button | Nút hành động nổi ở giữa thanh tab; **không phải một tab thật**, chỉ là lối tắt tới màn hình Camera | 4 |
| Ollama | *(tên phần mềm)* | Nền tảng chạy mô hình ngôn ngữ lớn cục bộ; là tiến trình độc lập được backend gọi qua HTTP | 3, 4, 5, 7 |
| FASHN | *(tên dịch vụ)* | Dịch vụ AI cục bộ phục vụ chức năng thử đồ ảo, chạy độc lập và giao tiếp qua HTTP | 3, 4, 5, 7 |
| CatVTON | Category Virtual Try-On | Dịch vụ thử đồ ảo cục bộ, đóng vai trò đường dự phòng khi FASHN không đạt ngưỡng chất lượng | 3, 4, 7 |
| GPU | Graphics Processing Unit | Bộ xử lý đồ hoạ; các tính năng AI sinh ảnh/video cần GPU, hệ thống có cơ chế xếp hàng và ưu tiên tác vụ GPU | 1, 3, 7, 8 |
| VRAM | Video Random Access Memory | Bộ nhớ của card đồ hoạ; chạy đầy đủ khối AI cần GPU CUDA khoảng 16 GB VRAM | 7 |
| E2E | End-to-End (testing) | Kiểm thử đầu-cuối toàn luồng người dùng. Hệ thống **chưa có** framework E2E cho ứng dụng di động | 6 |
| CI/CD | Continuous Integration / Continuous Deployment | Tích hợp và triển khai liên tục. Dự án **chưa thiết lập** pipeline CI/CD | 6, 7, 8 |

## B. Thuật ngữ có trong mã nguồn nhưng chưa dùng trong thân bài

Các thuật ngữ dưới đây tồn tại thật trong mã nguồn hoặc trong bộ bằng chứng, nhưng **hiện chưa xuất hiện trong 8 chương**. Nhóm có hai lựa chọn: (a) bổ sung vào thân bài nếu muốn trình bày sâu hơn phần AI/phân tích, khi đó giữ dòng tương ứng trong danh mục; hoặc (b) **xoá khỏi danh mục này** để danh mục không chứa thuật ngữ không dùng đến. Không giữ lại thuật ngữ trong danh mục mà thân bài không hề nhắc tới.

| Viết tắt / Thuật ngữ | Tên đầy đủ | Nghĩa tiếng Việt và giải thích ngắn | Vị trí trong mã nguồn |
|---|---|---|---|
| RBAC | Role-Based Access Control | Kiểm soát truy cập theo vai trò. Thân bài mô tả đúng cơ chế này (bốn cấp `customer` → `staff` → `admin` → `super_admin`) nhưng dùng cách diễn đạt tiếng Việt "phân quyền theo vai trò" thay vì viết tắt | `backend/lib/auth.js` |
| IPN | Instant Payment Notification | Thông báo thanh toán tức thời do cổng thanh toán gửi về máy chủ để xác nhận kết quả giao dịch | `GET /api/vnpay/ipn` — `backend/routes/paymentsVnpay.js` |
| LLM | Large Language Model | Mô hình ngôn ngữ lớn. Thân bài dùng cách diễn đạt "mô hình ngôn ngữ lớn" (Chương 3) thay vì viết tắt | `backend/lib/chatbot.js` |
| MoE | Mixture of Experts | Kiến trúc "hỗn hợp chuyên gia": chỉ kích hoạt một phần tham số cho mỗi lượt suy luận | `backend/lib/postTransformer.js` |
| SSM / mLSTM | State-Space Model / matrix LSTM | Các kiến trúc mô hình chuỗi dùng trong khối gợi ý và ghi nhớ hội thoại | `backend/lib/postTransformer.js`, `backend/lib/recommend.js` |
| RFM | Recency – Frequency – Monetary | Phân tích khách hàng theo độ mới, tần suất và giá trị mua hàng | `backend/lib/analytics.js` |
| K-Means | K-Means Clustering | Thuật toán phân cụm K trung bình, dùng để nhóm khách hàng hoặc đặc trưng sản phẩm | `backend/lib/analytics.js` |
| YOLO | You Only Look Once | Họ mô hình phát hiện đối tượng theo thời gian thực; dự án có tệp trọng số `backend/models/yolov8n-pose.pt` phục vụ phát hiện khung xương người | `backend/*.py` (pipeline xử lý ảnh) |
| ORM / ODM | Object-Relational Mapping / Object-Document Mapping | Lớp ánh xạ đối tượng sang bảng quan hệ / sang tài liệu. Dự án **không dùng** ORM/ODM nào (không có Mongoose); truy cập MongoDB bằng driver thuần | — (nêu ra để phủ định thông tin sai trong tài liệu tham chiếu, xem Phụ lục C) |

---

**Ghi chú về cách bảo trì danh mục này:** cột "Xuất hiện ở chương" phản ánh nội dung 8 chương tại thời điểm lập danh mục. Nếu nhóm sửa hoặc bổ sung nội dung chương, cần rà lại cột này. Đặc biệt, nếu nhóm quyết định dùng dạng viết tắt (RBAC, LLM, IPN) trong thân bài thay cho cách diễn đạt tiếng Việt hiện tại, phải chuyển các dòng tương ứng từ Bảng B lên Bảng A.
