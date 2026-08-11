# PHỤ LỤC C — GHI CHÚ VỀ PHẠM VI VÀ ĐỘ TIN CẬY CỦA BÁO CÁO

> **Khuyến nghị vị trí:** phụ lục này nên được đặt **ngay trước Chương 1** thay vì ở cuối báo cáo, để người đọc hiểu phương pháp luận và ranh giới độ tin cậy trước khi tiếp cận nội dung kỹ thuật.

## C.1. Phương pháp luận

Toàn bộ nội dung kỹ thuật trong báo cáo này được dựng lại từ **mã nguồn thật** của dự án, không kế thừa từ bản báo cáo mẫu trước đó. Cụ thể:

1. Mọi endpoint API trong Phụ lục A đều là một lời gọi `api.<method>(...)` có thật trong `backend/routes/`, kèm số dòng để đối chiếu. Không có endpoint nào được suy ra từ tên tệp hay quy ước đặt tên.
2. Mọi module trong Phụ lục B đều được xác minh bằng cách liệt kê thư mục `backend/lib/`; quan hệ phụ thuộc lấy từ các lời gọi `require(...)` có thật.
3. Kết quả kiểm thử ở Chương 6 là đầu ra nguyên văn của lệnh `npm --workspace backend test`, chạy lặp lại để xác nhận tính ổn định — không phải số ước lượng.
4. Các con số cấu hình (cổng 4100, hạn mã đặt lại mật khẩu 30 phút, thời hạn đổi trả 30 ngày, ngưỡng Flagcard 5 triệu đồng…) đều trích từ hằng số trong mã nguồn.
5. Nơi nào mã nguồn hiện tại khác với tài liệu tham chiếu (đề cương, `README.md`, bộ bằng chứng), báo cáo lấy **mã nguồn làm chuẩn** và ghi rõ điểm lệch thay vì im lặng chọn một con số.
6. Không in giá trị bí mật ở bất kỳ đâu — chỉ nêu tên biến môi trường.

### Ba điểm lệch số liệu phát hiện khi lập phụ lục

| Hạng mục | Tài liệu trước | Đếm thật | Nguyên nhân |
|---|---|---|---|
| Số endpoint API | 109 | **111** | Bổ sung `POST` và `GET /api/gpu/focus` (`routes/stylist.js:27,36`) |
| Số tệp `backend/lib/` | 34 | **36** | Bổ sung `gpuArbiter.js`, `gpuJobQueue.js` |
| Số ca kiểm thử tự động | 46 | **50** | Bổ sung `test/gpu-queue.test.js` (3 ca) và 1 ca trong `analytics-recommend.test.js` |

Cả ba đều theo cùng một hướng: mã nguồn đã phát triển tiếp sau khi bộ bằng chứng được lập, chủ yếu ở cụm điều phối GPU. Báo cáo dùng các con số **111 / 36 / 50** và đã cập nhật lại toàn bộ các tệp chương, đề cương cùng bộ bằng chứng cho khớp.

Việc chủ động công bố ba điểm lệch này, thay vì âm thầm sửa số, là một phần của phương pháp luận: nó cho phép hội đồng kiểm tra chéo và xác nhận rằng nhóm thực sự đối chiếu lại mã nguồn chứ không sao chép số liệu từ tài liệu cũ.

## C.2. Các điểm sai trong báo cáo mẫu đã được sửa

Một bản báo cáo mẫu (`baocao (2).docx`) tồn tại từ trước. **Cấu trúc chương mục và phần đầu học thuật của tài liệu đó là khuôn mẫu hợp lệ và được tái sử dụng** vì đây là yêu cầu định dạng của trường. Tuy nhiên **nội dung kỹ thuật của 8 chương chính sai lệch nghiêm trọng so với hệ thống thật và đã bị loại bỏ hoàn toàn**. Các điểm sai đã được sửa:

| Nội dung trong bản mẫu | Thực tế đã xác minh |
|---|---|
| Backend chỉ là một tệp `server/index.mjs` | Không tồn tại đường dẫn đó. Backend thật là `backend/server.js` (326 dòng) + 17 tệp `backend/routes/` + 36 tệp `backend/lib/` |
| CSDL là MongoDB + Mongoose với các collection chuẩn hoá | Kho dữ liệu chính là tệp JSON `backend/data/db.json`; MongoDB (nếu bật) chỉ là bản sao gương toàn bộ state trong một document; repo **không** dùng `mongoose` |
| Cổng mặc định 4000 | Cổng mặc định **4100** (`backend/server.js:48`) |
| Expo 54 / React Native 0.81.5 / React 19 | Thật: Expo `~51.0.28`, React Native `0.74.5`, React `18.2.0` (`mobile/package.json`) |
| Đường dẫn `app/_layout.tsx`, `context/AppContext.tsx`, `data/catalog.ts` | Đường dẫn thật `mobile/app/_layout.tsx`; **không có** `AppContext.tsx` — state chia ở `mobile/lib/auth.tsx`, `store.tsx`, `data.tsx`, `shop.tsx`, `botchat.tsx`; catalog là `mobile/lib/catalog.ts` |
| Băm mật khẩu bằng scrypt | Băm bằng **bcrypt** (`bcryptjs`, cost 10) — `backend/lib/auth.js` |
| Tài khoản admin mặc định `a@gmail.com` / `lnhat1938@gmail.com` với mật khẩu `"1"` | Không tồn tại tài khoản/mật khẩu đó. Bộ kiểm tra độ mạnh mật khẩu thật sẽ từ chối `"1"`; admin gốc khởi tạo qua biến môi trường `JAPANO_ADMIN_EMAIL` / `JAPANO_ADMIN_PASSWORD`, và không ghi đè mật khẩu nếu tài khoản đã tồn tại |
| Trạng thái đơn hàng `pending_cod` | Không tồn tại. Trạng thái thật: `pending`, `confirmed`, `shipping`, `completed`, `cancelled`, `returned` |
| Chưa có phân quyền phía server | **Sai theo hướng ngược lại** — hệ thống có JWT + bốn cấp vai trò thật (`customer` → `staff` → `admin` → `super_admin`) với 5 middleware phân quyền. Đây là điểm mạnh bị bản mẫu mô tả thiếu |
| Tab "Games" (Caro AI, Sudoku AI, "Né quái vật", "Trú mưa") và hệ thống "xu" | Xác nhận **không tồn tại** qua tìm kiếm toàn repo — không có mã game, không có hệ thống điểm/xu ở `mobile/` hay `backend/` |
| Các tính năng tên "DemandScore v3", "What-if Simulator", "AI Pricing Optimizer" | Không tìm thấy dưới các tên này. Bộ máy phân tích thật (`lib/analytics.js`, `lib/recommend.js`) có làm dự báo/phân khúc/chấm điểm nhu cầu, nhưng tên tính năng và số phiên bản nêu trên không khớp mã nguồn |
| Lệnh `npm run start-server`, đường dẫn Windows `.\.venv\Scripts\Activate.ps1` | Lệnh thật `npm run backend` / `./start-all.sh`; môi trường phát triển là Linux; không tồn tại tệp `vision-requirements.txt` |

### Về phần "Giới hạn hiện tại" trong `README.md`

Đoạn này nói admin chưa có màn đăng nhập, các endpoint mutation chưa có xác thực phía server, và mobile chỉ lưu đăng nhập bằng AsyncStorage. **Nội dung này đã lỗi thời**: `backend/lib/auth.js` đã có bcrypt và JWT thật, `backend/routes/auth.js` đã có đăng ký/đăng nhập/quên–đặt lại mật khẩu, và các middleware phân quyền đã được áp dụng trên nhiều tuyến. Báo cáo mô tả hiện trạng thật và **không trích dẫn đoạn README này**. Các phần còn lại của README (cấu trúc thư mục, yêu cầu hệ thống, hướng dẫn cài đặt, sơ đồ kiến trúc) đã được đối chiếu và xác nhận khớp mã nguồn, nên vẫn là tài liệu tham chiếu đáng tin cậy.

## C.3. Thông tin còn thiếu, bắt buộc nhóm bổ sung

Những mục sau **không thể suy ra từ mã nguồn** và tuyệt đối không được bịa số:

1. **Toàn bộ ảnh chụp màn hình.** Chương 4 mục 4.4 cần 10 ảnh theo Bảng 4.3; Chương 6 nên có ảnh terminal kết quả kiểm thử. Không có ảnh nào trong repo — bắt buộc chạy ứng dụng thật rồi chụp. Khi chú thích, phải ghi rõ tính năng nào chưa hoạt động đầy đủ.
2. **Sơ đồ UML dạng hình vẽ.** Ba hình ở Chương 3 hiện là sơ đồ Mermaid, cần kết xuất thành ảnh hoặc vẽ lại bằng công cụ UML chuẩn. Các sitemap ở Chương 4 và sơ đồ ERD chưa có hình.
3. **Cột "Kết quả thật" trong Bảng 6.2 và Bảng 6.3.** Cột "Kết quả mong đợi" đã suy từ mã nguồn nên có căn cứ; kết quả thật phải do nhóm chạy kiểm thử tay. Không điền "Pass" cho toàn bộ mà không thực sự kiểm thử.
4. **Mốc thời gian thật của từng giai đoạn (Bảng 2.3).** Không có git log để đối chiếu — phải lấy từ nhật ký làm việc thật, không bịa ngày tháng cho khớp bảng.
5. **Bảng phân công công việc từng thành viên (Bảng 1.3).** Không thể xác minh: bản chụp repo này **không có lịch sử git dùng được** — thư mục `.git/` chỉ còn `info`, thiếu `HEAD`, `objects` và `refs`, nên không dựng được nhật ký commit, tác giả hay dòng thời gian phát triển. Nếu nhóm có bản lưu trên GitHub/GitLab với lịch sử thật thì phải lấy từ đó; nếu không, nhóm tự khai và tự chịu trách nhiệm.
6. **Số liệu người dùng và kinh doanh.** Hệ thống chạy trên dữ liệu demo do `backend/seed.js` sinh ra. Mọi con số "số người dùng", "số đơn đã xử lý", "doanh thu" phải ghi rõ là dữ liệu demo, hoặc bỏ hẳn. Không trình bày số liệu seed như số liệu vận hành.
7. **Số đo hiệu năng và tải.** Repo không có công cụ hay kết quả load-test nào. Nếu báo cáo cần thời gian phản hồi API, số người dùng đồng thời, hay độ trễ pipeline thử đồ, nhóm phải tự chạy đo thật.
8. **Cấu hình phần cứng GPU.** Con số ~16 GB VRAM nhất quán với các giá trị mặc định trong `.env.example` nhưng chưa được kiểm chứng bằng `nvidia-smi` trên máy thật. Nhóm cần xác nhận lại cấu hình cụ thể.
9. **Tình trạng cài đặt của các micro-service AI** (FASHN, motion, embedding, CatVTON). Mã Node gọi tới chúng là thật và đã xác minh, nhưng bản thân các model là repo ngoài, không nhúng trong dự án.
10. **Chỉ số đánh giá bộ gợi ý.** `README.md` nêu rõ: đánh giá xếp hạng offline chưa được triển khai, NDCG@10 và Recall@10 hiện được báo là *not-measured*. Chương mô tả bộ gợi ý phải giữ nguyên ghi chú này thay vì bịa một con số độ chính xác.
11. **Số liệu khảo sát thị trường.** Nhóm không thực hiện khảo sát có phương pháp. Nếu muốn dẫn số liệu thị trường, phải trích nguồn báo cáo bên ngoài tra cứu được, kèm tên nguồn và năm công bố.

## C.4. Hạn chế đã biết của hệ thống

Các hạn chế sau đã được xác minh trong mã nguồn và được công bố công khai trong báo cáo.

### Về bảo mật và phân quyền

- **Phân quyền không nhất quán.** Trong 111 endpoint có **45 endpoint không gắn middleware xác thực**, tin vào `userId` do client gửi. Danh sách đầy đủ và phân loại mức nghiêm trọng ở Phụ lục A mục A.5. Nghiêm trọng nhất: `POST /api/flagcards/admin/grant` (`routes/loyalty.js:26`) có chữ "admin" trong đường dẫn nhưng hoàn toàn không kiểm tra quyền — bất kỳ ai cũng có thể tự cấp thẻ thưởng.
- **CSP bị tắt** trên trang quản trị (`helmet({ contentSecurityPolicy: false })`), trong khi trang này có 17 vị trí gán `innerHTML` động chưa được rà soát và lưu JWT trong `localStorage` — rủi ro XSS dẫn tới đánh cắp token. Chính chú thích trong mã nguồn thừa nhận điều này.
- **CORS mở hoàn toàn** — `cors()` không có danh sách origin cho phép.
- **Kiểm tra MIME khi tải tệp lên dựa trên khai báo của client**, chưa xác minh magic byte của nội dung thật.
- **Bí mật sandbox VNPay gán cứng** làm giá trị dự phòng trong `backend/lib/vnpaySign.js` (`VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`). Chú thích trong mã ghi rõ đây là merchant demo công khai của VNPay, **không phải khoá production bị rò rỉ**, và được thay bằng `.env.server` khi có merchant thật. Dù vậy đây vẫn là secret nằm trong mã nguồn.

### Về tính năng chưa hoàn thiện

- `mobile/profile.tsx` **không thực sự lưu thay đổi** — các ô nhập là uncontrolled input, nút "Lưu" chỉ điều hướng quay lại.
- Các công tắc trong `mobile/settings.tsx` **phần lớn chỉ có tác dụng cục bộ**, không được lưu lại; ngoại lệ là công tắc bật/tắt chatbot.
- Nút **đăng nhập Google/Apple là giao diện mẫu**, chưa nối với backend.
- **Tồn kho không được hoàn lại** cho đơn thanh toán online bị bỏ dở hoặc thất bại. Đây là đánh đổi có ý thức: mã nguồn trừ kho ngay khi tạo đơn để hai khách không cùng mua được sản phẩm cuối cùng, và chú thích tại `backend/routes/orders.js:62-64` ghi rõ việc hoàn kho chưa làm trong bản này.

### Về quy trình phát triển và kiểm thử

- **Không có pipeline CI/CD.**
- **Không có framework kiểm thử E2E/UI cho ứng dụng di động** (không Detox, Maestro hay Playwright).
- **Kiểm thử tự động chỉ ở tầng logic backend**, gồm 50 ca trên 6 tệp: logic VIP, toán embedding, tạo đơn hàng và tồn kho, các hàm thuần của pipeline thử đồ, hàng đợi GPU, và cụm gợi ý/phân tích/kiểm duyệt/mục tiêu. **Không có ca kiểm thử nào** cho `lib/auth.js` (module bảo mật quan trọng nhất), cho quy trình đổi trả/huỷ đơn (`routes/returns.js`), và cho cả hai cổng thanh toán — dù `paymentsStripe.js` và `paymentsVnpay.js` đều đã xuất hàm theo đúng mẫu có thể kiểm thử được như các tệp đã có test. Hạ tầng đã sẵn sàng nhưng chưa được khai thác.
- **Một phần bề mặt export không được dùng:** `catalog.js` trả về `{ publicProduct, ensureCloudProductImagesFresh }` nhưng không nơi nào trong repo tiêu thụ.

---

Việc liệt kê đầy đủ các hạn chế này là có chủ đích. Một báo cáo trình bày hệ thống như đã hoàn hảo sẽ không chịu được phần chất vấn, trong khi một báo cáo nêu rõ ranh giới giữa "đã làm được", "làm được một phần" và "chưa làm" cho phép hội đồng đánh giá đúng năng lực thật của nhóm. Chương 8 mục 8.3 chuyển toàn bộ danh sách hạn chế này thành lộ trình cải thiện có thứ tự ưu tiên.
