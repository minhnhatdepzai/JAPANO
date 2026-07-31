# CHƯƠNG 7: ĐÓNG GÓI VÀ TRIỂN KHAI

## 7.1. Môi trường triển khai

Hệ thống được thiết kế để có thể chạy ở ba mức độ đầy đủ khác nhau, tuỳ theo phần cứng và nhu cầu demo. Việc phân tách này là một quyết định kiến trúc có chủ đích: phần thương mại điện tử lõi không phụ thuộc GPU hay dịch vụ AI ngoại vi.

**Bảng 7.1: Yêu cầu môi trường theo ba mức triển khai**

| Mức | Thành phần chạy được | Yêu cầu |
|---|---|---|
| **Mức 1 — Lõi** | Backend API, trang quản trị Web, cơ sở dữ liệu JSON, phân tích dữ liệu, hệ gợi ý, trợ lý chat (chế độ dự phòng cục bộ) | Node.js `≥20`, npm, dung lượng đĩa cho `node_modules`. **Không cần** Python, MongoDB, Ollama hay GPU |
| **Mức 2 — Ứng dụng di động** | Toàn bộ Mức 1 + ứng dụng Android/iOS | Thêm Android Studio + Platform-Tools (`adb`), JDK 17 cho bản dựng native Android; macOS + Xcode nếu chạy iOS |
| **Mức 3 — Đầy đủ AI** | Toàn bộ Mức 2 + thử đồ ảo, tạo video chuyển động, embedding ngữ nghĩa, mô hình ngôn ngữ/thị giác | Thêm Linux (khuyến nghị cho `start-all.sh`), môi trường Python riêng cho từng repository mô hình, GPU NVIDIA CUDA (cấu hình hiện tại thiết kế cho khoảng 16 GB VRAM), các lệnh `curl`, `awk`, `grep`, `nvidia-smi` |

*Nguồn: `thesis/evidence/technology-stack.md` mục 5; đối chiếu `README.md` phần "Yêu cầu hệ thống" (đã kiểm chứng khớp mã nguồn).*

Cần lưu ý rằng các mô hình AI (FASHN VTON 1.5, FLUX.2 Klein-4B, One-to-All Animation, CatVTON) **không nằm trong repository** và không được cài đặt bởi `npm install`. Mỗi mô hình yêu cầu một môi trường Python riêng được chuẩn bị theo hướng dẫn của repository gốc tương ứng. Đây là lý do repository không có một tệp `requirements.txt` chung cho toàn bộ khối AI.

## 7.2. Hướng dẫn cài đặt và chạy dự án

### 7.2.1. Cài đặt phụ thuộc

Từ thư mục gốc của dự án:

```bash
npm ci
```

Lệnh `npm ci` sử dụng tệp khoá phụ thuộc ở thư mục gốc, cài đặt cho cả hai workspace (`backend` và `mobile`) trong một lần, đồng thời chạy script `postinstall` cần thiết cho thư viện Stripe native.

### 7.2.2. Tạo tệp cấu hình

```bash
cp .env.example .env.server
```

Sau đó chỉnh các giá trị placeholder theo môi trường thật của máy chạy. Backend tự động nạp `.env.server` khi khởi động. Tệp này **không được đưa lên hệ thống quản lý mã nguồn** (đã có quy tắc loại trừ tương ứng trong `.gitignore`).

### 7.2.3. Chạy backend và trang quản trị

```bash
npm run backend
```

Hoặc chỉ định cổng khác:

```bash
PORT=4200 npm run backend
```

Sau khi khởi động thành công, các địa chỉ truy cập là:

- Trang quản trị: `http://localhost:4100`
- API: `http://localhost:4100/api`
- Kiểm tra tình trạng hệ thống: `http://localhost:4100/api/health`

Ở lần chạy đầu tiên, nếu chưa tồn tại tệp `backend/data/db.json`, backend tự động sinh dữ liệu demo ban đầu.

### 7.2.4. Chạy ứng dụng Android

Với thiết bị thật hoặc máy ảo đã kết nối, cần chuyển tiếp cổng để thiết bị truy cập được backend trên máy tính:

```bash
adb reverse tcp:4100 tcp:4100
adb reverse tcp:8081 tcp:8081
EXPO_PUBLIC_API_URL=http://127.0.0.1:4100 npm --workspace mobile run android
```

Hoặc sử dụng địa chỉ IP mạng nội bộ:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4100 npm --workspace mobile run android
```

### 7.2.5. Chạy toàn bộ hệ thống bằng một lệnh

```bash
./start-all.sh
```

Script này thực hiện tuần tự: kiểm tra/cài đặt phụ thuộc Node, khởi động dịch vụ FASHN + FLUX.2, khởi động dịch vụ One-to-All (nếu đã cài), bỏ qua CatVTON theo mặc định, khởi động hoặc tái sử dụng backend đang chạy, chọn thiết bị Android, thiết lập `adb reverse`, mở Metro và đưa ứng dụng lên foreground; khi nhận `Ctrl+C` sẽ dừng các tiến trình do chính script tạo ra.

Có thể bỏ qua các dịch vụ AI nặng để tiết kiệm tài nguyên:

```bash
JAPANO_SKIP_FASHN=1 JAPANO_SKIP_MOTION=1 ./start-all.sh
```

**Khuyến nghị vận hành thực tế:** trong quá trình phát triển, việc chạy đồng thời toàn bộ khối AI (FASHN + Motion) cùng với phiên điều khiển máy từ xa (Remote Desktop) và máy ảo Android có thể gây cạn kiệt RAM hệ thống. Khi làm việc từ xa hoặc trên máy có RAM hạn chế, nên dùng biến môi trường bỏ qua nêu trên và chỉ bật dịch vụ AI khi thực sự cần demo tính năng thử đồ.

## 7.3. Cấu hình biến môi trường

Toàn bộ biến môi trường tham khảo được liệt kê trong `.env.example` (134 dòng). Bảng 7.2 tổng hợp các nhóm biến chính. **Bảng chỉ ghi tên biến và mục đích, tuyệt đối không ghi giá trị thật** — đúng theo nguyên tắc quản lý bí mật đã phân tích ở Chương 5.

**Bảng 7.2: Các nhóm biến môi trường**

| Nhóm | Biến tiêu biểu | Mục đích |
|---|---|---|
| Lõi | `PORT`, `NODE_ENV`, `JAPANO_DATA_FILE` | Cổng chạy backend, môi trường, đường dẫn tệp dữ liệu JSON |
| Xác thực | `JWT_SECRET`, `JWT_TTL`, `JAPANO_ADMIN_EMAIL`, `JAPANO_ADMIN_PASSWORD` | Khoá ký JWT (bắt buộc ở production), hạn token, tài khoản quản trị gốc |
| Giám sát | `SENTRY_DSN`, `LOG_LEVEL`, `JAPANO_RATE_LIMIT_MAX`, `JAPANO_AUTH_RATE_LIMIT_MAX` | Theo dõi lỗi, mức log, ngưỡng giới hạn tần suất |
| Lưu trữ | `MONGODB_URI`, `MONGODB_DB`, `CLOUDINARY_URL` | Đồng bộ MongoDB tuỳ chọn, lưu trữ media |
| Thanh toán | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAY_URL` | Khoá thử nghiệm Stripe và thông tin merchant VNPay Sandbox |
| AI | `JAPANO_FASHN_URL`, `JAPANO_MOTION_URL`, `JAPANO_EMBEDDING_URL`, `JAPANO_OLLAMA_URL`, `JAPANO_SKIP_FASHN`, `JAPANO_SKIP_MOTION` | Địa chỉ và công tắc bật/tắt các dịch vụ AI cục bộ |
| Ứng dụng di động | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_API_PORT`, `EXPO_PUBLIC_API_TIMEOUT_MS` | Địa chỉ backend mà ứng dụng kết nối tới |

*Nguồn: `thesis/evidence/security-analysis.md` mục 5.*

**Một thiếu sót về tài liệu cần ghi nhận:** module gửi email (`backend/lib/mailer.js`) đọc bốn biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` để gửi email đặt lại mật khẩu thật, nhưng bốn biến này **không được liệt kê trong `.env.example`**. Hệ thống không bị lỗi khi thiếu chúng (tự động chuyển sang hộp thư giả lập Ethereal), nhưng người triển khai chỉ dựa vào `.env.example` sẽ không biết đến khả năng cấu hình SMTP thật. Đây là một khuyến nghị cải thiện tài liệu, đã được ghi nhận trong danh mục hạn chế.

## 7.4. Kết quả đóng gói và giới hạn triển khai

### 7.4.1. Kết quả đạt được

- Hệ thống chạy được đầy đủ từ một backend dùng chung cho cả ứng dụng di động và trang quản trị Web.
- Cơ sở dữ liệu JSON tự khởi tạo dữ liệu demo ở lần chạy đầu, không cần bước cài đặt cơ sở dữ liệu riêng — giảm đáng kể rào cản để một người khác tái lập môi trường demo.
- Toàn bộ bí mật cấu hình được tách khỏi mã nguồn qua tệp `.env.server`, chỉ `.env.example` (chứa placeholder) được lưu trong repository.
- Có script `start-all.sh` tự động hoá toàn bộ trình tự khởi động nhiều tiến trình, kèm các công tắc bỏ qua dịch vụ nặng.
- Có script kiểm tra nhanh API sau khi triển khai: `npm run verify` (lõi) và `npm run verify:ai` (bao gồm cả khối AI).

### 7.4.2. Giới hạn triển khai cần ghi nhận trung thực

Bảng 7.3 tổng hợp các hạng mục cần hoàn thiện trước khi có thể đưa hệ thống vào môi trường vận hành thật. Đây là các hạn chế đã được xác minh trực tiếp từ mã nguồn, không phải phỏng đoán.

**Bảng 7.3: Hạng mục cần hoàn thiện trước khi triển khai thật**

| Hạng mục | Mức ưu tiên | Ghi chú |
|---|---|---|
| Bổ sung middleware xác thực cho một số route còn thiếu | Cao | Năm tệp route (`customerData.js`, `reviews.js`, `stylist.js`, `loyalty.js`, `japanSpots.js`) có endpoint tin tưởng `userId` do client gửi mà không xác thực; đặc biệt endpoint `/flagcards/admin/grant` mang tên "admin" nhưng không có kiểm tra quyền quản trị |
| Bật Content Security Policy cho trang quản trị | Cao | CSP hiện bị tắt có chủ đích; trang quản trị dùng nhiều `innerHTML` động và lưu JWT trong `localStorage` — cần rà soát các điểm `innerHTML` trước khi bật |
| Giới hạn CORS theo danh sách domain | Trung bình | Hiện `cors()` không cấu hình danh sách nguồn gốc cho phép |
| Xác thực nội dung tệp tải lên | Trung bình | Hiện chỉ kiểm tra tiền tố MIME do client khai báo, chưa kiểm tra chữ ký byte thật của tệp |
| Loại bỏ giá trị bí mật dự phòng ghi cứng | Trung bình | `backend/lib/vnpaySign.js` có giá trị mặc định ghi cứng cho merchant sandbox VNPay |
| Khôi phục tồn kho khi đơn thanh toán trực tuyến thất bại | Trung bình | Tồn kho bị trừ ngay khi tạo đơn; đơn online bị huỷ/thất bại chưa tự hoàn kho (đã được ghi chú ngay trong mã nguồn) |
| Thiết lập CI/CD | Trung bình | Chưa có quy trình tự động chạy kiểm thử khi có thay đổi mã nguồn |
| Chuyển sang cơ sở dữ liệu có giao dịch (transaction) | Thấp (với quy mô demo) | JSON hiện chưa hỗ trợ giao dịch hay mở rộng theo chiều ngang; có thể tận dụng thiết kế `japano_schema_v2.sql` đã có làm điểm khởi đầu |
| Hoàn thiện các màn hình chưa lưu dữ liệu | Thấp | Biểu mẫu hồ sơ cá nhân và phần lớn công tắc cài đặt chưa đồng bộ lên máy chủ |

*Nguồn: `thesis/evidence/security-analysis.md` mục 2, 4, 6, 7; `thesis/evidence/testing-evidence.md` mục 4; `thesis/evidence/missing-information.md` mục 4.*

Cần khẳng định rõ trong báo cáo: hệ thống ở trạng thái hiện tại là một **sản phẩm demo/nghiên cứu hoàn chỉnh về mặt chức năng**, phù hợp mục tiêu của một đồ án tốt nghiệp, nhưng **chưa sẵn sàng cho môi trường vận hành thương mại thật** — chính mã nguồn và tài liệu của dự án cũng tự khẳng định điều này ngay từ đầu tệp `README.md`.
