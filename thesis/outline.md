# ĐỀ CƯƠNG CHI TIẾT BÁO CÁO TỐT NGHIỆP
## Đề tài: Phát triển ứng dụng thương mại điện tử thời trang JAPANO Store

**Căn cứ xây dựng đề cương:** cấu trúc chương/mục theo đúng khung của báo cáo mẫu (`baocao (2).docx`, Trường Cao đẳng FPT Polytechnic) — front-matter, số chương, tiêu đề chương và quy ước đánh số Bảng/Hình được giữ nguyên vì đây là yêu cầu định dạng của trường. **Toàn bộ nội dung kỹ thuật của đề cương này được xây dựng lại từ 10 tệp bằng chứng trong `thesis/evidence/`, không kế thừa nội dung kỹ thuật của báo cáo mẫu** vì báo cáo mẫu chứa nhiều chi tiết sai lệch so với mã nguồn thật (xem `thesis/evidence/missing-information.md`, mục 1). Một số mục con được thêm mới hoặc đổi tên so với báo cáo mẫu để phản ánh đúng bằng chứng thật đang có (ví dụ: bổ sung hẳn một mục "Kiểm thử tự động" ở Chương 6 vì hệ thống có 46 test case tự động thật; đổi "Tài khoản admin mặc định" ở mục 5.5 vì báo cáo mẫu ghi tài khoản/mật khẩu không có thật trong mã nguồn).

**Quy ước sử dụng đề cương này:** mỗi mục có 7 trường — Mục đích, Luận điểm chính, Bằng chứng cần dùng (trỏ đến tệp:mục trong `thesis/evidence/`), Hình/sơ đồ cần có, Bảng cần có, Số trang ước tính, Thông tin còn thiếu. Số trang ước tính dựa trên mật độ nội dung thật đang có trong evidence pack, không phải số trang mong muốn — nơi nào bằng chứng mỏng thì số trang ước tính cũng thấp, thay vì độn chữ cho đủ dài.

**Tổng số trang ước tính toàn bài (không kể phụ lục):** khoảng 78–96 trang nội dung (Chương 1–8) + 8–12 trang front-matter. Đây là ước tính cho một báo cáo tốt nghiệp hệ Cao đẳng thực học/thực làm, không phải luận văn thạc sĩ.

---

## PHẦN MỞ ĐẦU (trước Chương 1)

| Mục | Nội dung |
|---|---|
| Trang bìa | Tên trường, tên đề tài, GVHD, sinh viên thực hiện, thời gian, địa điểm — lấy đúng thông tin đã có ở báo cáo mẫu (cần nhóm xác nhận lại vì đây là thông tin hành chính, không phải thông tin kỹ thuật nên đề cương này không tự kiểm chứng được — xem `missing-information.md` mục 1, dòng "Caveat"). |
| Lời cảm ơn | 1 trang, văn phong tự do theo nhóm. |
| Lời mở đầu | 1 trang — nêu bối cảnh thương mại điện tử thời trang, lý do chọn đề tài JAPANO, tóm tắt phạm vi (thương mại điện tử lõi + trợ lý AI + quản trị). Phải khớp với `project-overview.md`, không dùng số liệu người dùng/doanh thu thật vì hệ thống là dữ liệu demo (xem `missing-information.md` mục 5). |
| Mục lục, Danh mục hình, Danh mục bảng | Tự động sinh sau khi hoàn thiện. |
| **Danh mục từ viết tắt / thuật ngữ** (đề xuất bổ sung mới) | Nên có vì báo cáo dùng nhiều thuật ngữ: JWT, RBAC, VIP, COD, HMAC, CSP, CORS, IPN, ORM/ODM, SSM, MoE, RFM, K-Means, YOLO, LLM, VRAM. Không có trong báo cáo mẫu nhưng nên thêm để người đọc không chuyên dễ theo dõi Chương 3–6. Ước tính: 1 trang. |

---

## CHƯƠNG 1: GIỚI THIỆU DỰ ÁN

### 1.1. Lý do chọn đề tài
- **Mục đích:** đặt bối cảnh thị trường và lý do nhóm chọn xây dựng một ứng dụng thương mại điện tử thời trang có tích hợp AI thay vì một ứng dụng bán hàng thông thường.
- **Luận điểm chính:** (1) nhu cầu mua sắm thời trang trực tuyến ngày càng cao nhưng phần lớn ứng dụng chỉ dừng ở trưng bày sản phẩm; (2) JAPANO chọn hướng khác biệt là kết hợp thương mại điện tử lõi với các trợ lý AI thật (chat, thử đồ ảo, tư vấn size/phối đồ) chạy trên hạ tầng cục bộ; (3) đây là dịp để nhóm thực hành toàn bộ chu trình full-stack: từ thiết kế CSDL, API, thanh toán, đến vận hành AI cục bộ có GPU.
- **Bằng chứng cần dùng:** `project-overview.md` (mục "What the project is", "Problem statement"); `architecture.md` mục 6 (danh sách microservice AI) để chứng minh phần "khác biệt AI" là có thật, không phải khẩu hiệu.
- **Hình/sơ đồ:** không bắt buộc; có thể chèn 1 ảnh chụp màn hình trang chủ ứng dụng làm minh hoạ mở đầu (ảnh cần chụp thật từ ứng dụng đang chạy, chưa có trong evidence pack — xem "Thông tin còn thiếu").
- **Bảng:** không bắt buộc.
- **Số trang ước tính:** 1–1.5 trang.
- **Thông tin còn thiếu:** số liệu thị trường/khảo sát thực tế (không có trong repo, cần nhóm tự khảo sát hoặc trích nguồn báo cáo thị trường bên ngoài nếu muốn dùng số liệu — không được suy diễn từ mã nguồn).

### 1.2. Mục tiêu dự án
- **Mục đích:** liệt kê mục tiêu kỹ thuật cụ thể, có thể kiểm chứng bằng mã nguồn — tránh các mục tiêu chung chung không đối chiếu được.
- **Luận điểm chính:** mục tiêu nên viết lại thành 5 nhóm khớp đúng với những gì thật sự tồn tại: (1) xây dựng ứng dụng mua sắm Expo/React Native chạy đa nền tảng (Android/iOS/Web); (2) hoàn chỉnh luồng mua hàng cơ bản (danh mục → giỏ hàng → đặt hàng → thanh toán → hậu mãi); (3) tích hợp AI hỗ trợ mua sắm (chat, thử đồ ảo, tư vấn size/phối đồ, gợi ý cá nhân hoá) trên nền tảng dịch vụ cục bộ có GPU; (4) xây dựng trang quản trị web phân quyền nhiều cấp; (5) triển khai xác thực JWT + phân quyền vai trò thật (không phải mục tiêu "để sau" — đây là điểm đã đạt được, khác với báo cáo mẫu tưởng là "chưa có").
- **Bằng chứng cần dùng:** `feature-inventory.md` (toàn bộ, đối chiếu từng mục tiêu với tính năng đã có endpoint thật); `security-analysis.md` mục 1 (JWT/bcrypt) để khẳng định mục tiêu (5) đã đạt, khác với giới hạn cũ trong README.
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng "Mục tiêu – Trạng thái đạt được" (Mục tiêu | Minh chứng mã nguồn | Trạng thái: Đạt/Đạt một phần/Chưa đạt) — đây là bảng quan trọng để giữ tinh thần "không thổi phồng" xuyên suốt báo cáo.
- **Số trang ước tính:** 1–1.5 trang + bảng.
- **Thông tin còn thiếu:** không.

### 1.3. Phạm vi chức năng
- **Mục đích:** xác định ranh giới chức năng để Chương 3–6 không phải liệt kê lại từ đầu.
- **Luận điểm chính:** trình bày phạm vi theo 4 nhóm tác nhân/khối chức năng: Người dùng cuối (tài khoản, mua sắm, hậu mãi), AI thời trang (chat, thử đồ, tư vấn), Quản trị viên (sản phẩm, đơn hàng, phân quyền), Nội dung/loyalty (Nhật Bản, Flagcard, VIP). **Không đưa vào phạm vi:** mini-game, hệ thống điểm/xu — vì không tồn tại trong mã nguồn (đã xác minh bằng grep toàn repo, xem `feature-inventory.md` mục 7) dù báo cáo mẫu có nhắc tới.
- **Bằng chứng cần dùng:** `feature-inventory.md` mục 1–6 (toàn bộ bảng tính năng).
- **Hình/sơ đồ:** không bắt buộc ở đây (sơ đồ Use Case tổng quát để dành cho 3.2).
- **Bảng:** 1 bảng "Phạm vi chức năng" (Nhóm chức năng | Nội dung triển khai), phỏng theo cấu trúc bảng 1.1 của báo cáo mẫu nhưng nội dung viết lại đúng theo `feature-inventory.md`.
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không.

### 1.4. Thành viên dự án
- **Mục đích:** thông tin hành chính bắt buộc theo quy định của trường.
- **Luận điểm chính:** giữ nguyên bảng thành viên như báo cáo mẫu (họ tên, MSSV, email, nhiệm vụ chính) — đây là thông tin không thể kiểm chứng bằng mã nguồn.
- **Bằng chứng cần dùng:** không có trong evidence pack (nguồn duy nhất là báo cáo mẫu, mục 1.4).
- **Hình/sơ đồ:** không.
- **Bảng:** 1 bảng thành viên (giữ định dạng báo cáo mẫu).
- **Số trang ước tính:** 0.5 trang.
- **Thông tin còn thiếu:** **cần nhóm xác nhận lại thông tin này còn đúng không**, đặc biệt phần "nhiệm vụ chính" — vì không có lịch sử git để đối chiếu ai thực sự làm phần nào (xem `git-history-summary.md` và `missing-information.md` mục 5).

---

## CHƯƠNG 2: KHẢO SÁT

### 2.1. Yêu cầu từ khách hàng và thị trường
- **Mục đích:** trình bày các yêu cầu nghiệp vụ đã được hiện thực hoá thành tính năng thật, tránh liệt kê yêu cầu "trên giấy" không khớp sản phẩm.
- **Luận điểm chính:** mỗi yêu cầu nêu ra phải đi kèm chức năng tương ứng đã triển khai: tiện lợi (duyệt/mua nhanh, giỏ hàng đồng bộ đa thiết bị), minh bạch thông tin sản phẩm (ảnh/mô tả/đánh giá xác thực theo đơn đã mua — xem cơ chế "verified-purchase" trong `feature-inventory.md` mục 2), tìm kiếm thông minh (fuzzy-search tự viết bằng Levenshtein, không phải công cụ ngoài), cá nhân hoá (gợi ý theo hành vi thật, không phải rule tĩnh — có thể trích `architecture.md` mục 6 về hybrid recommender), thanh toán đa dạng (COD/Stripe Test/VNPay Sandbox), quản trị dữ liệu thật (dashboard KPI, phân quyền).
- **Bằng chứng cần dùng:** `feature-inventory.md` mục 2–4; `README.md`'s phần "Điểm nổi bật" đã được đối chiếu và xác nhận khớp mã nguồn (không phải phần "Giới hạn hiện tại" — mục đó đã lỗi thời, xem `missing-information.md` mục 2).
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng "Yêu cầu – Tính năng đáp ứng – Vị trí mã nguồn".
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không có khảo sát thị trường/khách hàng thật bằng số liệu (bảng câu hỏi, phỏng vấn) trong repo — nếu nhóm có làm khảo sát thật bên ngoài thì bổ sung, không suy diễn từ mã nguồn.

### 2.2. Đối tượng sử dụng
- **Mục đích:** mô tả các nhóm vai trò thật sự tồn tại trong hệ thống — đây là điểm cần viết lại hoàn toàn khác báo cáo mẫu vì mẫu chỉ có 2 nhóm (Người dùng cuối, Quản trị viên) trong khi hệ thống thật có 4 cấp vai trò.
- **Luận điểm chính:** trình bày đúng 4 cấp trong `ROLE_RANK` (`backend/lib/auth.js`): `customer` (khách mua hàng mặc định) < `staff` (nhân viên, chỉ vào được trang quản trị và chỉ thấy/sửa sản phẩm do chính mình tạo) < `admin` (quản lý toàn bộ shop) < `super_admin` (thêm quyền cấp/gỡ quyền admin khác). Đây là một điểm mạnh kỹ thuật thật của hệ thống, khác hẳn báo cáo mẫu mô tả "chưa có RBAC phía server" — nên nhấn mạnh đúng mức, có bằng chứng, không phóng đại.
- **Bằng chứng cần dùng:** `security-analysis.md` mục 1 (bảng middleware, role hierarchy); `api-inventory.md` (các endpoint có `requireStaff`/`requireAdmin`/`requireSuperAdmin`).
- **Hình/sơ đồ:** 1 sơ đồ phân cấp vai trò đơn giản (customer → staff → admin → super_admin, mũi tên "quyền tăng dần") — có thể vẽ mới, không cần công cụ ngoài.
- **Bảng:** 1 bảng "Vai trò – Quyền hạn – Ví dụ endpoint được bảo vệ".
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không.

### 2.3. Lập kế hoạch dự án
- **Mục đích:** trình bày tiến độ thực hiện theo giai đoạn.
- **Luận điểm chính:** giữ cấu trúc bảng giai đoạn của báo cáo mẫu (khảo sát → phân tích → thiết kế → lập trình → kiểm thử/đóng gói) nhưng **không thể xác nhận mốc thời gian cụ thể** vì không có lịch sử git.
- **Bằng chứng cần dùng:** `git-history-summary.md` (xác nhận không có lịch sử commit để đối chiếu mốc thời gian).
- **Hình/sơ đồ:** có thể vẽ Gantt chart đơn giản nếu nhóm tự cung cấp mốc thời gian thật.
- **Bảng:** 1 bảng kế hoạch theo giai đoạn (Giai đoạn | Công việc | Thời gian | Kết quả).
- **Số trang ước tính:** 1 trang.
- **Thông tin còn thiếu:** **mốc thời gian thật của từng giai đoạn** — không có trong repo (không có git log), phải lấy từ nhật ký làm việc thật của nhóm nếu có, không được bịa ngày tháng để khớp bảng cho đẹp.

---

## CHƯƠNG 3: PHÂN TÍCH

*(Chương này được viết đầy đủ ở `thesis/chapters/chapter-03-system-analysis.md` — mục dưới đây chỉ tóm tắt phạm vi/kế hoạch, không lặp lại nội dung.)*

### 3.1. Mô hình triển khai hệ thống
- **Mục đích:** trình bày kiến trúc triển khai tổng thể (client-server, các thành phần, cổng dịch vụ) làm nền cho toàn bộ Chương 4–5.
- **Luận điểm chính:** JAPANO là monorepo 3 ứng dụng dùng chung 1 backend Express (cổng 4100) — Mobile (Expo/React Native), Web Admin (HTML/CSS/JS thuần, không build step), Backend phục vụ cả API lẫn file tĩnh của Admin; dữ liệu chính là file JSON (`backend/data/db.json`), MongoDB chỉ là bản mirror tuỳ chọn; các dịch vụ AI cục bộ (FASHN, motion, embedding, CatVTON) và Ollama là các tiến trình độc lập giao tiếp qua HTTP.
- **Bằng chứng cần dùng:** `architecture.md` (toàn bộ), `api-inventory.md` mục "Entry point", `database-analysis.md` mục 1–2.
- **Hình/sơ đồ:** 1 sơ đồ kiến trúc triển khai (có thể dựa trên sơ đồ mermaid có sẵn, đã kiểm chứng khớp mã nguồn, trong `README.md`), 1 sơ đồ luồng middleware Express.
- **Bảng:** 1 bảng "Thành phần triển khai hệ thống" (Thành phần | Công nghệ | Vai trò | Cổng).
- **Số trang ước tính:** 3–4 trang.
- **Thông tin còn thiếu:** không.

### 3.2. Sơ đồ Use Case
- **Mục đích:** trực quan hoá phạm vi chức năng theo tác nhân.
- **Luận điểm chính:** tối thiểu 2 sơ đồ Use Case (Người dùng, Quản trị viên) — nội dung từng use case phải lấy đúng từ `feature-inventory.md`, không thêm use case không có endpoint tương ứng (ví dụ: không được vẽ use case "Chơi game", "Đổi xu").
- **Bằng chứng cần dùng:** `feature-inventory.md` mục 1–6.
- **Hình/sơ đồ:** 2 sơ đồ Use Case (UML, có thể vẽ bằng draw.io/PlantUML) — **cần tạo mới**, không có sẵn trong evidence pack (evidence pack chỉ cung cấp danh sách use case dạng bảng, chưa phải hình).
- **Bảng:** không bắt buộc (danh sách use case nên để dạng sơ đồ + đặc tả ở 3.3).
- **Số trang ước tính:** 2–3 trang (chủ yếu là hình).
- **Thông tin còn thiếu:** hình vẽ UML thật cần được dựng bằng công cụ vẽ sơ đồ, đề cương này chỉ cung cấp nội dung/danh sách use case đã kiểm chứng.

### 3.3. Đặc tả Use Case
- **Mục đích:** đặc tả chi tiết luồng sự kiện cho các use case trọng yếu.
- **Luận điểm chính:** chọn 8–10 use case tiêu biểu bao trùm cả 2 tác nhân và các nghiệp vụ phức tạp nhất (đăng ký/đăng nhập/quên mật khẩu, tìm kiếm, giỏ hàng/đặt hàng đa phương thức thanh toán, huỷ đơn/trả hàng có ảnh minh chứng, chat AI, thử đồ AI, quản lý sản phẩm theo phạm vi staff, phân quyền super-admin, duyệt yêu cầu trả hàng/hoàn tiền). Mỗi đặc tả gồm: tác nhân, tiền điều kiện, dòng sự kiện chính, ngoại lệ — tất cả phải khớp với logic thật trong route handler tương ứng.
- **Bằng chứng cần dùng:** `api-inventory.md` (mô tả hành vi từng endpoint, dùng làm nguồn cho "dòng sự kiện"); `feature-inventory.md`.
- **Hình/sơ đồ:** có thể bổ sung 1–2 sơ đồ tuần tự (sequence diagram) cho use case phức tạp nhất (ví dụ: quy trình huỷ đơn có hoàn tiền tự động qua cổng thanh toán).
- **Bảng:** bảng danh sách use case chính (Mã | Tên | Tác nhân | Mô tả ngắn), theo sau là các khối đặc tả chi tiết dạng văn bản có cấu trúc.
- **Số trang ước tính:** 6–8 trang (phần dài nhất của Chương 3 vì đặc tả chi tiết từng use case).
- **Thông tin còn thiếu:** không, miễn là đặc tả bám sát `api-inventory.md`.

---

## CHƯƠNG 4: THIẾT KẾ ỨNG DỤNG

### 4.1. Kiến trúc công nghệ
- **Mục đích:** liệt kê và giải thích lựa chọn công nghệ theo từng lớp.
- **Luận điểm chính:** trình bày đúng phiên bản thật (Expo ~51, React Native 0.74.5, React 18.2.0 — không phải Expo 54/RN 0.81.5/React 19 như báo cáo mẫu); backend Express 4 + JSON file datastore + MongoDB tuỳ chọn (không phải "MongoDB, Mongoose" là công nghệ CSDL chính); giải thích lý do chọn kiến trúc JSON-file-first (đơn giản, không cần hạ tầng DB ngoài để demo, có đường nâng cấp sang MongoDB khi cần nhiều máy).
- **Bằng chứng cần dùng:** `technology-stack.md` (toàn bộ).
- **Hình/sơ đồ:** không bắt buộc (bảng công nghệ là đủ).
- **Bảng:** 1 bảng "Công nghệ sử dụng trong dự án" theo lớp (Lớp | Công nghệ | Phiên bản | Vai trò) — dựng lại đúng theo `technology-stack.md`, khác bảng 4.1 của báo cáo mẫu ở phần Frontend/Database/Media-AI.
- **Số trang ước tính:** 2–3 trang.
- **Thông tin còn thiếu:** không.

### 4.2. Thiết kế cơ sở dữ liệu
- **Mục đích:** đây là mục **cần viết lại thận trọng nhất** trong toàn báo cáo vì đây là nơi báo cáo mẫu sai nhiều nhất.
- **Luận điểm chính:** trình bày rõ 2 tầng: (a) **mô hình vận hành thật** — 1 tệp JSON (`backend/data/db.json`) là nguồn dữ liệu chính, có ghi nguyên tử (atomic write), 34 khoá cấp cao (users/products/orders/payments/...), MongoDB nếu bật chỉ là bản mirror một-document; (b) **thiết kế lý thuyết đi kèm** — nhóm có xây dựng một bộ schema SQL chuẩn hoá (`japano_schema_v2.sql`, 47 bảng, sửa "11 nhóm lỗi thiết kế") như một sản phẩm thiết kế riêng, **chưa từng được kết nối vào backend đang chạy** — trình bày phần này như một minh chứng năng lực thiết kế CSDL quan hệ của nhóm, không trình bày như công nghệ đang vận hành.
- **Bằng chứng cần dùng:** `database-analysis.md` (toàn bộ, đặc biệt mục 1, 2, 6).
- **Hình/sơ đồ:** 1 ERD cho tầng vận hành thật (có thể vẽ đơn giản dạng "document JSON lồng nhau" thay vì ERD quan hệ, vì bản chất không phải quan hệ); 1 ERD cho `japano_schema_v2.sql` (đã có sẵn dữ liệu bảng để vẽ, lấy từ chính file SQL) — ghi rõ chú thích "thiết kế, chưa triển khai runtime" ngay trên hình.
- **Bảng:** 1 bảng liệt kê 34 collection/entity chính (tên | vai trò | ví dụ trường dữ liệu), lấy đúng từ `database-analysis.md` mục 5.
- **Số trang ước tính:** 5–7 trang (bao gồm hình ERD).
- **Thông tin còn thiếu:** không, nhưng cần **ghi chú rõ ràng, nhất quán** ở mọi vị trí nhắc tới CSDL trong toàn báo cáo — không chỉ ở Chương 4 — rằng JSON file là runtime thật, SQL là thiết kế song song.

### 4.3. Sitemap và luồng điều hướng ứng dụng
- **Mục đích:** trình bày cấu trúc điều hướng thật của app mobile và web admin.
- **Luận điểm chính:** mô tả đúng theo `architecture.md` mục 4 — 4 tab chức năng thật (Home/Products/Wishlist/Me) + 1 nút FAB trung tâm không phải tab thật (chỉ là lối tắt vào Camera); cơ chế `AuthGate` cho phép khách xem sản phẩm nhưng chặn các hành động cá nhân hoá; sitemap Admin theo các nhóm chức năng đã xác minh trong `feature-inventory.md` mục 6.
- **Bằng chứng cần dùng:** `architecture.md` mục 4; mobile screen inventory trong `feature-inventory.md`.
- **Hình/sơ đồ:** 1 sitemap ứng dụng mobile, 1 sitemap web admin — vẽ mới dựa trên danh sách 33 file màn hình đã kiểm chứng.
- **Bảng:** không bắt buộc (sitemap dạng hình là đủ).
- **Số trang ước tính:** 2–3 trang.
- **Thông tin còn thiếu:** không.

### 4.4. Thiết kế giao diện chính
- **Mục đích:** minh hoạ trực quan các màn hình quan trọng nhất.
- **Luận điểm chính:** chọn 8–10 màn hình tiêu biểu (Splash/Onboarding, Đăng nhập/Đăng ký/Quên mật khẩu, Trang chủ, Cửa hàng, Chi tiết sản phẩm, Giỏ hàng, Checkout, Chat AI, Thử đồ AI, Admin Dashboard) và **chú thích rõ tính năng nào thật sự hoạt động** — ví dụ khi minh hoạ màn hình Cá nhân/Cài đặt, phải ghi chú rằng form chỉnh sửa hồ sơ hiện chưa lưu được (theo `feature-inventory.md` mục 1), tránh để ảnh chụp màn hình ngầm khẳng định tính năng hoạt động đầy đủ trong khi thực tế thì không.
- **Bằng chứng cần dùng:** `feature-inventory.md` (đối chiếu trạng thái từng màn hình trước khi chú thích ảnh).
- **Hình/sơ đồ:** 8–10 ảnh chụp màn hình thật từ ứng dụng đang chạy — **chưa có trong evidence pack, cần chụp mới** (xem "Thông tin còn thiếu").
- **Bảng:** 1 bảng tổng hợp "Màn hình – Mô tả thiết kế" trước phần ảnh chi tiết.
- **Số trang ước tính:** 6–8 trang (chủ yếu là hình).
- **Thông tin còn thiếu:** **toàn bộ ảnh chụp màn hình thật** — không có sẵn trong repo hay evidence pack, bắt buộc phải chạy ứng dụng thật (mobile + admin) rồi chụp trước khi hoàn thiện chương này.

---

## CHƯƠNG 5: THỰC HIỆN

### 5.1. Cấu trúc mã nguồn
- **Mục đích:** liệt kê cấu trúc thư mục/tệp thật, dùng làm bản đồ tra cứu cho phần còn lại của chương.
- **Luận điểm chính:** trình bày cây thư mục thật (`admin/`, `backend/{routes,lib,data}`, `mobile/{app,lib,components}`) — **không dùng** các đường dẫn sai của báo cáo mẫu (`app/_layout.tsx` không có tiền tố `mobile/`, `context/AppContext.tsx`, `server/index.mjs`, `data/catalog.ts`).
- **Bằng chứng cần dùng:** `architecture.md`; `api-inventory.md`; `feature-inventory.md` (cột "Mobile entry point").
- **Hình/sơ đồ:** 1 cây thư mục (text tree, có thể lấy gần nguyên bản từ `README.md`'s "Cấu trúc thư mục", đã kiểm chứng khớp thật).
- **Bảng:** 1 bảng "Thư mục/Tệp chính – Chức năng" (chọn ra khoảng 15–20 file/thư mục quan trọng nhất từ 17 route file + 34 lib file + các thư mục mobile, không cần liệt kê hết 51 file backend).
- **Số trang ước tính:** 2–3 trang.
- **Thông tin còn thiếu:** không.

### 5.2. Chức năng người dùng đã triển khai
- **Mục đích:** mô tả chi tiết cách các tính năng phía người dùng hoạt động, có trích dẫn endpoint.
- **Luận điểm chính:** theo đúng nhóm trong `feature-inventory.md` mục 1–5 (Tài khoản, Danh mục/tìm kiếm, Mua sắm, AI, Nội dung/loyalty) — mỗi tính năng mô tả ngắn gọn cơ chế thật (ví dụ: "tìm kiếm dùng thuật toán Levenshtein tự viết, không dùng dịch vụ tìm kiếm ngoài"; "trả hàng bắt buộc tối thiểu 1 ảnh minh chứng, tải lên Cloudinary"). Mục này **phải nêu rõ các phần chưa hoạt động đầy đủ** (chỉnh sửa hồ sơ, các toggle cài đặt, đăng nhập Google/Apple) thay vì bỏ qua.
- **Bằng chứng cần dùng:** `feature-inventory.md` mục 1–5 (toàn bộ); `api-inventory.md` cho chi tiết endpoint.
- **Hình/sơ đồ:** không bắt buộc (đã có ở 4.4); có thể chèn 1–2 sơ đồ luồng nghiệp vụ phức tạp (ví dụ luồng thử đồ AI: ảnh → phân tích dáng người → FASHN/FLUX → kiểm tra chất lượng → trả kết quả).
- **Bảng:** có thể tái sử dụng dạng bảng của `feature-inventory.md` mục 1–5, rút gọn.
- **Số trang ước tính:** 6–8 trang.
- **Thông tin còn thiếu:** không, nhưng cần nhất quán với chú thích "chưa hoạt động" đã nêu ở 4.4.

### 5.3. Chức năng quản trị viên đã triển khai
- **Mục đích:** mô tả trang quản trị theo đúng phạm vi phân quyền thật.
- **Luận điểm chính:** theo `feature-inventory.md` mục 6 — nhấn mạnh cơ chế phân quyền 4 cấp (đặc biệt: `staff` chỉ thấy sản phẩm do chính mình tạo, thực thi ở cả tầng route lẫn tầng kiểm tra `ownerId`; `super_admin` mới được đổi vai trò người dùng khác, có chặn tự hạ quyền chính mình).
- **Bằng chứng cần dùng:** `feature-inventory.md` mục 6; `security-analysis.md` mục 2 (bảng ví dụ endpoint nhạy cảm).
- **Hình/sơ đồ:** 1 sơ đồ luồng duyệt yêu cầu trả hàng/huỷ đơn (requested → approved/rejected → received → refunded), vì đây là luồng nghiệp vụ phức tạp nhất của khối quản trị.
- **Bảng:** 1 bảng chức năng theo tab quản trị (Tab | Nội dung | Endpoint chính).
- **Số trang ước tính:** 3–4 trang.
- **Thông tin còn thiếu:** không.

### 5.4. API và xử lý dữ liệu
- **Mục đích:** trình bày danh sách API như bằng chứng kỹ thuật cốt lõi của chương Thực hiện.
- **Luận điểm chính:** hệ thống có 109 endpoint thật trên 17 route file — không liệt kê hết 109 endpoint trong thân bài (đưa bảng đầy đủ vào phụ lục nếu cần), thân bài chỉ trình bày theo nhóm nghiệp vụ (Auth, Catalog, Cart/Wishlist/Orders, Checkout/Stripe/VNPay, AI, Admin) kèm 1–2 endpoint tiêu biểu mỗi nhóm và giải thích cơ chế dùng chung logic (ví dụ: COD/Stripe/VNPay đều gọi chung `makeCreateOrderInState`).
- **Bằng chứng cần dùng:** `api-inventory.md` (toàn bộ — đây là bằng chứng nguồn chính của mục này).
- **Hình/sơ đồ:** 1 sơ đồ minh hoạ pattern dependency-injection `ctx` (route → ctx → store/Cloudinary/Stripe/VNPay).
- **Bảng:** bảng rút gọn theo nhóm API (giống bảng 5.3 trong báo cáo mẫu về hình thức, nhưng nội dung/endpoint lấy đúng từ `api-inventory.md`); bảng đầy đủ 109 endpoint đưa vào phụ lục.
- **Số trang ước tính:** 5–6 trang (thân bài) + phụ lục riêng cho bảng đầy đủ.
- **Thông tin còn thiếu:** không.

### 5.5. Tài khoản quản trị và bảo vệ phân quyền
- **Mục đích:** thay thế hoàn toàn mục "Tài khoản admin mặc định" sai của báo cáo mẫu (đã dẫn `a@gmail.com`/`lnhat1938@gmail.com` với mật khẩu `"1"` — không có thật).
- **Luận điểm chính:** mô tả đúng cơ chế thật: tài khoản `super_admin` gốc được tạo/thăng hạng lúc khởi động từ biến môi trường `JAPANO_ADMIN_EMAIL`/`JAPANO_ADMIN_PASSWORD` (không hard-code trong mã nguồn); nếu tài khoản đã tồn tại thì không ghi đè mật khẩu đã đổi; mật khẩu phải qua kiểm tra độ mạnh (`passwordStrength()`), không chấp nhận mật khẩu như `"1"`. Trình bày các ràng buộc bảo vệ: không tự hạ quyền chính mình, `roleAtLeast` mặc định từ chối vai trò không xác định.
- **Bằng chứng cần dùng:** `security-analysis.md` mục 1 (đoạn `ensureAdminSeeded`), mục 2.
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng biến môi trường liên quan đến bootstrap tài khoản quản trị (tên biến | vai trò | ghi chú) — lấy từ `.env.example`, **không được điền giá trị thật** vào bảng (chỉ tên biến, đúng khuyến nghị bảo mật trong `security-analysis.md` mục 5).
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không.

---

## CHƯƠNG 6: KIỂM THỬ

### 6.1. Kiểm thử tự động (đề xuất bổ sung mới so với báo cáo mẫu)
- **Mục đích:** trình bày bằng chứng kiểm thử **mạnh nhất và đáng tin cậy nhất** của toàn bộ dự án — nên đặt lên đầu chương thay vì chỉ có test case thủ công như báo cáo mẫu.
- **Luận điểm chính:** hệ thống có 46 test case tự động thật, chạy bằng `node --test` (không cần Jest/Mocha), **46/46 pass**, bao phủ: VIP/loyalty (7 case), embeddings (4), tạo đơn hàng/tồn kho/chống trùng đơn (7), try-on pure-function (8), recommendation/analytics/moderation/goals (20). Nêu rõ cách chạy (`npm --workspace backend test` / `npm run check`) để người chấm có thể tự kiểm chứng lại.
- **Bằng chứng cần dùng:** `testing-evidence.md` (toàn bộ, đặc biệt mục 1 và 3 — số liệu thật copy từ kết quả chạy lệnh, không phải số ước tính).
- **Hình/sơ đồ:** 1 ảnh chụp màn hình terminal kết quả chạy `npm --workspace backend test` thật (khuyến khích chụp mới để có bằng chứng trực quan, số liệu `46 pass / 0 fail` đã có sẵn trong evidence pack nếu không kịp chụp lại).
- **Bảng:** 1 bảng liệt kê 5 tệp test (Tệp | Module kiểm thử | Số test case).
- **Số trang ước tính:** 3–4 trang.
- **Thông tin còn thiếu:** không — đây là mục có bằng chứng đầy đủ nhất trong toàn báo cáo.

### 6.2. Kịch bản kiểm thử thủ công — người dùng
- **Mục đích:** bổ sung các kịch bản kiểm thử giao diện/trải nghiệm mà kiểm thử tự động không bao phủ (vì kiểm thử tự động hiện chỉ ở tầng logic backend, không có E2E mobile — xem `testing-evidence.md` mục 5).
- **Luận điểm chính:** xây dựng bảng test case thủ công cho các luồng người dùng chính (đăng ký/đăng nhập/quên mật khẩu, tìm kiếm, giỏ hàng, checkout 3 phương thức thanh toán, huỷ đơn/trả hàng, chat AI, thử đồ AI) — khác báo cáo mẫu ở chỗ: kết quả mong đợi phải khớp đúng trạng thái/luồng thật (ví dụ không dùng trạng thái đơn hàng `pending_cod` không tồn tại).
- **Bằng chứng cần dùng:** `feature-inventory.md` mục 1–5; `api-inventory.md` (để biết chính xác input/output từng endpoint khi viết "kết quả mong đợi").
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng test case (Mã | Chức năng | Kịch bản | Kết quả mong đợi | Kết quả thật — cột cuối chỉ điền được sau khi nhóm thật sự chạy tay).
- **Số trang ước tính:** 3–4 trang.
- **Thông tin còn thiếu:** **cột "Kết quả thật"** — đề cương chỉ dựng được khung bảng và "kết quả mong đợi" suy từ mã nguồn; kết quả thật đo được phải do nhóm tự thực hiện kiểm thử tay trên ứng dụng đang chạy.

### 6.3. Kịch bản kiểm thử thủ công — quản trị viên
- **Mục đích:** tương tự 6.2 nhưng cho khối quản trị, đặc biệt các ràng buộc phân quyền.
- **Luận điểm chính:** ưu tiên các kịch bản kiểm thử đúng ranh giới phân quyền — ví dụ: tài khoản `staff` cố sửa sản phẩm của người khác phải bị từ chối (403); tài khoản `admin` (không phải `super_admin`) cố đổi vai trò người khác phải bị từ chối; `super_admin` cố tự hạ quyền chính mình phải bị chặn. Đây là các kịch bản có giá trị chứng minh cao vì trực tiếp kiểm chứng phần bảo mật đã nêu ở Chương 5.5.
- **Bằng chứng cần dùng:** `security-analysis.md` mục 2 (danh sách endpoint nhạy cảm + middleware).
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng test case tương tự 6.2, tập trung vào các trường hợp từ chối quyền (negative test case) thay vì chỉ test trường hợp thành công.
- **Số trang ước tính:** 2–3 trang.
- **Thông tin còn thiếu:** cột "Kết quả thật" — như mục 6.2.

### 6.4. Nhận xét, giới hạn và hướng cải thiện kiểm thử
- **Mục đích:** đánh giá trung thực độ bao phủ kiểm thử — đây là mục **bắt buộc phải trung thực** theo đúng tinh thần yêu cầu ban đầu, không được nói kiểm thử đã "đầy đủ".
- **Luận điểm chính:** nêu rõ các khoảng trống thật: chưa có test tự động cho xác thực (`lib/auth.js`), cho luồng huỷ/trả hàng (`routes/returns.js`), cho 2 cổng thanh toán (dù đã có sẵn hàm export theo đúng pattern có thể test được); chưa có pipeline CI/CD; chưa có framework E2E cho mobile (không Detox/Maestro/Playwright).
- **Bằng chứng cần dùng:** `testing-evidence.md` mục 4, 5, 6 và phần "Honest summary".
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng "Phạm vi đã kiểm thử tự động – Chưa kiểm thử tự động".
- **Số trang ước tính:** 1–1.5 trang.
- **Thông tin còn thiếu:** không.

---

## CHƯƠNG 7: ĐÓNG GÓI VÀ TRIỂN KHAI

### 7.1. Môi trường triển khai
- **Mục đích:** liệt kê yêu cầu hệ thống để cài đặt/chạy dự án.
- **Luận điểm chính:** phân biệt rõ 3 mức yêu cầu (đúng theo `README.md`, đã kiểm chứng khớp mã nguồn): chạy lõi (chỉ cần Node.js ≥20, không cần Python/MongoDB/Ollama/GPU), chạy mobile (Android Studio/adb, JDK 17, hoặc Xcode cho iOS), chạy đầy đủ AI (Linux, Python riêng cho từng repo model ngoài, GPU CUDA ~16GB VRAM).
- **Bằng chứng cần dùng:** `technology-stack.md` mục 5; README.md phần "Yêu cầu hệ thống" (đã đối chiếu khớp).
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng yêu cầu theo 3 mức.
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không.

### 7.2. Hướng dẫn cài đặt và chạy dự án
- **Mục đích:** hướng dẫn tái lập môi trường chạy thật — phải dùng đúng lệnh thật trong `package.json`/`start-all.sh`, không dùng lệnh của báo cáo mẫu (`npm run start-server`, đường dẫn Windows `.\.venv\Scripts\Activate.ps1` không khớp môi trường Linux thật của dự án).
- **Luận điểm chính:** trình bày các bước: cài dependency (`npm ci` từ thư mục gốc), tạo `.env.server` từ `.env.example`, chạy backend (`npm run backend`), chạy Android (lệnh `adb reverse` hoặc `EXPO_PUBLIC_API_URL`), hoặc chạy toàn bộ bằng `./start-all.sh`.
- **Bằng chứng cần dùng:** README.md phần "Cài đặt và chạy dự án" (đã đối chiếu khớp `package.json` scripts thật).
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** không bắt buộc (dạng liệt kê lệnh là đủ).
- **Số trang ước tính:** 2–3 trang.
- **Thông tin còn thiếu:** không.

### 7.3. Cấu hình biến môi trường
- **Mục đích:** liệt kê các biến môi trường cần thiết theo nhóm chức năng.
- **Luận điểm chính:** trình bày theo nhóm (Core/mobile, Storage/media, Payment, AI) — **chỉ liệt kê tên biến và mục đích, không in giá trị thật** (đúng nguyên tắc bảo mật đã nêu ở `security-analysis.md` mục 5); đồng thời **bổ sung ghi chú thiếu sót thật** đã phát hiện: biến `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` được mã nguồn dùng thật (`backend/lib/mailer.js`) nhưng không có trong `.env.example` — nêu đây như một khuyến nghị cải thiện tài liệu, không phải lỗi nghiêm trọng.
- **Bằng chứng cần dùng:** `security-analysis.md` mục 5 (toàn bộ).
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng biến môi trường theo nhóm (Biến | Mục đích) — phỏng theo bảng của README nhưng đầy đủ hơn (thêm ghi chú SMTP còn thiếu).
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không (thông tin thiếu chính là SMTP, đã ghi chú là nội dung cần trình bày).

### 7.4. Kết quả đóng gói và giới hạn triển khai
- **Mục đích:** tổng kết trạng thái sẵn sàng triển khai, nêu rõ đây là bản demo/nghiên cứu chứ không phải sản phẩm production.
- **Luận điểm chính:** hệ thống chạy được đa nền tảng từ 1 backend dùng chung; **nêu trung thực các giới hạn triển khai thật**: CSP tắt trên trang admin (rủi ro XSS tự ghi nhận trong mã nguồn), CORS mở hoàn toàn, chưa có CI/CD, một số route thiếu middleware xác thực, JSON file chưa có transaction/horizontal scaling.
- **Bằng chứng cần dùng:** `security-analysis.md` mục 4, 7; `missing-information.md` mục 4.
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng "Hạng mục cần hoàn thiện trước khi triển khai thật" (Hạng mục | Mức độ ưu tiên | Ghi chú) — tổng hợp từ `security-analysis.md` và `testing-evidence.md`.
- **Số trang ước tính:** 2–3 trang.
- **Thông tin còn thiếu:** không.

---

## CHƯƠNG 8: KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

### 8.1. Kết luận
- **Mục đích:** tổng kết những gì đã đạt được, bám sát mục tiêu đã nêu ở 1.2.
- **Luận điểm chính:** đối chiếu trực tiếp với bảng "Mục tiêu – Trạng thái đạt được" ở mục 1.2 — khẳng định các phần đã đạt thật (luồng mua sắm đầy đủ, xác thực JWT/RBAC 4 cấp thật, 3 phương thức thanh toán hoạt động ở chế độ sandbox, AI thử đồ/chat/gợi ý chạy trên hạ tầng cục bộ có fallback), không tô hồng phần chưa hoàn thiện.
- **Bằng chứng cần dùng:** toàn bộ 10 tệp evidence, tổng hợp lại — không đưa thông tin mới.
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** không bắt buộc (có thể tái sử dụng bảng ở 1.2 với cột trạng thái đã cập nhật).
- **Số trang ước tính:** 1–1.5 trang.
- **Thông tin còn thiếu:** không.

### 8.2. Đánh giá ưu điểm và hạn chế (đề xuất bổ sung mới)
- **Mục đích:** một mục đánh giá trung thực, tách bạch khỏi phần "Kết luận" mang tính tổng kết — đây là mục có giá trị học thuật cao vì thể hiện khả năng tự đánh giá của nhóm, phù hợp tinh thần "không được thổi phồng" của toàn bộ yêu cầu ban đầu.
- **Luận điểm chính:** liệt kê song song 2 cột — Ưu điểm thật (ví dụ: kiến trúc dependency-injection nhất quán, xác thực JWT/RBAC thật, kiểm thử tự động 46/46, thanh toán có xác thực chữ ký/webhook thật, AI có cơ chế fallback không bịa kết quả) và Hạn chế thật (phân quyền chưa nhất quán ở 5 route, CSP tắt, CORS mở, chưa có CI/CD, form hồ sơ cá nhân chưa lưu được, chưa phục hồi tồn kho khi đơn online thất bại).
- **Bằng chứng cần dùng:** `missing-information.md` mục 4 (danh sách hạn chế đã tổng hợp sẵn); `security-analysis.md` mục "Summary".
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng 2 cột "Ưu điểm – Hạn chế", mỗi dòng kèm trích dẫn vị trí mã nguồn.
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không.

### 8.3. Hướng phát triển
- **Mục đích:** đề xuất hướng cải thiện dựa trên chính các hạn chế đã nêu ở 8.2, không đề xuất chung chung.
- **Luận điểm chính:** ưu tiên theo mức độ nghiêm trọng đã phân tích ở `security-analysis.md`: (1) hoàn thiện middleware xác thực cho 5 route còn thiếu, đặc biệt `/flagcards/admin/grant`; (2) bật CSP sau khi audit các điểm `innerHTML` trong `admin/js/*.js`, đồng thời cân nhắc chuyển JWT admin khỏi `localStorage`; (3) giới hạn CORS theo domain thật; (4) bổ sung test tự động cho `lib/auth.js` và luồng thanh toán/trả hàng; (5) thiết lập CI/CD; (6) hoàn thiện các màn hình chưa lưu được dữ liệu (hồ sơ, cài đặt); (7) nếu mở rộng quy mô, chuyển từ JSON-file sang CSDL có transaction thật — có thể tận dụng ngay bộ thiết kế `japano_schema_v2.sql` đã có sẵn làm điểm khởi đầu.
- **Bằng chứng cần dùng:** `security-analysis.md`, `testing-evidence.md`, `database-analysis.md` mục 6, `missing-information.md`.
- **Hình/sơ đồ:** không bắt buộc.
- **Bảng:** 1 bảng lộ trình đề xuất (Hạng mục | Mức ưu tiên | Lý do).
- **Số trang ước tính:** 1.5–2 trang.
- **Thông tin còn thiếu:** không.

---

## PHỤ LỤC (đề xuất, không bắt buộc theo khung 8 chương)

| Phụ lục | Nội dung | Nguồn |
|---|---|---|
| A | Bảng đầy đủ 109 endpoint API | `api-inventory.md` |
| B | Bảng đầy đủ 34 file `backend/lib/` | `api-inventory.md` (báo cáo agent gốc) |
| C | Toàn văn `missing-information.md` (rút gọn) | trình bày như "Ghi chú về phạm vi và độ tin cậy của báo cáo" — nên đưa gần đầu báo cáo hoặc phụ lục đầu tiên để người chấm hiểu ngay phương pháp luận trước khi đọc nội dung kỹ thuật |

---

## TỔNG HỢP: THÔNG TIN CÒN THIẾU XUYÊN SUỐT TOÀN BÁO CÁO

(Không lặp lại chi tiết — xem đầy đủ tại `thesis/evidence/missing-information.md`. Danh sách dưới đây chỉ nêu các mục **bắt buộc phải bổ sung bằng hành động thật (chạy ứng dụng, chụp ảnh, hỏi nhóm)** trước khi nộp báo cáo, không thể suy ra thêm từ việc đọc mã nguồn:)

1. Toàn bộ ảnh chụp màn hình thật (Chương 4.4, và minh hoạ rải rác ở Chương 5–6).
2. Sơ đồ UML Use Case dạng hình vẽ (Chương 3.2) — nội dung đã có, hình chưa có.
3. Cột "Kết quả thật" trong các bảng test case thủ công (Chương 6.2, 6.3).
4. Mốc thời gian thật của kế hoạch dự án (Chương 2.3) — không có git log để đối chiếu.
5. Xác nhận lại thông tin thành viên/nhiệm vụ (Chương 1.4).
6. Bất kỳ số liệu người dùng/doanh thu/hiệu năng nào nếu muốn đưa vào báo cáo — hệ thống hiện chỉ có dữ liệu demo/seed, không phải số liệu vận hành thật.
