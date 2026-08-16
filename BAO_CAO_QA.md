# BÁO CÁO KIỂM TRA CHẤT LƯỢNG — baocaototnghiep_hoan_thien.docx

**Ngày thực hiện:** 16/08/2026
**Bản gốc:** `baocaototnghiep.docx` — **giữ nguyên, không bị ghi đè** (thời điểm sửa cuối vẫn là 16/08/2026 11:57).
**Sản phẩm:** `baocaototnghiep_hoan_thien.docx`, `baocaototnghiep_hoan_thien.pdf`
**Quy trình áp dụng:** Skill `.claude/skills/bao-cao-tot-nghiep/SKILL.md` (được tạo mới cho nhiệm vụ này và sử dụng xuyên suốt).

---

## 1. Số liệu sản phẩm

| Chỉ tiêu | Bản gốc | Bản hoàn thiện |
|---|---|---|
| Số trang (A4) | không xác định (khổ Letter) | **161** |
| Khổ giấy | US Letter 21,6 × 27,9 cm | **A4 21 × 29,7 cm** |
| Lề | trái 2,4 · phải 2,0 · trên 2,0 · dưới 2,0 cm | **trái 3,0 · phải 2,0 · trên 2,5 · dưới 2,5 cm** |
| Số hình có chú thích | 4 (không có chú thích) | **80** |
| Số bảng có chú thích | 23 (3 chú thích viết tay) | **39** |
| Ảnh nhúng trong tệp | 48 | **81** |
| Mục trong mục lục | mục lục cũ đã lỗi thời | **164** |
| Section | 1 | **3** (có 1 trang ngang cho sơ đồ ERD) |

---

## 2. Nội dung đã bổ sung

### 2.1. Sơ đồ mới (11 sơ đồ tự sinh)

| Sơ đồ | Vị trí | Nguồn dữ liệu |
|---|---|---|
| Sơ đồ triển khai hệ thống | Hình 3.1 | `backend/server.js`, `backend/lib/serviceUrls.js`, `mongoCollections.js` |
| Use Case ứng dụng người dùng (20 ca sử dụng) | Hình 3.2 | `mobile/app/`, `mobile/lib/api.ts` |
| Use Case web quản trị (20 ca sử dụng) | Hình 3.3 | `admin/index.html`, `admin/js/` |
| 5 biểu đồ hoạt động | Hình 3.4 – 3.8 | các tệp `backend/routes/` tương ứng |
| Sitemap ứng dụng người dùng | Hình 4.9 | 33 tệp trong `mobile/app/` |
| Sitemap web quản trị | Hình 4.10 | 15 mục `data-route` trong `admin/index.html` |

### 2.2. ERD (mục 4.2)

- **Nguồn:** `erd.drawio` trong workspace. Tệp `JAPANO_ERD_36_bang_tinh_chinh_theo_mau.drawio` nêu trong yêu cầu **không tồn tại**; `erd.drawio` chính là bản đó (tên diagram: *"ERD JAPANO – 36 bảng – Tên chuẩn hoá theo mẫu"*).
- **Đã kiểm tra:** đúng **36 bảng**, đúng **51 quan hệ**; mọi khoá ngoại nối đúng hàng khoá chính (đối chiếu bằng cách phân tích `source`/`target` của từng cạnh trong XML — tất cả đều trỏ tới `*-ref-row-*` chứ không trỏ vào thân bảng); không có bảng chồng nhau; nền trắng.
- **Cấp 1:** Hình 4.1 — ERD tổng thể trên **trang ngang A4 riêng** (section 2), rộng 24,7 cm.
- **Cấp 2:** Hình 4.2 – 4.8 — bảy sơ đồ phóng to theo nhóm, **vẽ lại bằng bố cục hai cột với dây nối chạy trong máng giữa** nên không có đường nối cắt qua bảng; ký hiệu chân chim / gạch đơn / vòng tròn lấy đúng từ `startArrow`/`endArrow` của tệp gốc.
- **Bảng 4.2:** 51 dòng quan hệ khoá chính – khoá ngoại, **trích tự động từ `erd.drawio`** nên chắc chắn khớp hình vẽ.
- Mục 4.2.4 nêu rõ đây là **mô hình dữ liệu mức logic trên các collection MongoDB**, không phải lược đồ quan hệ SQL.

### 2.3. Đặc tả Use Case (mục 3.3)

12 đặc tả chi tiết (UC-01 → UC-12), mỗi ca gồm 13 trường: mã, tên, mục tiêu, tác nhân chính, tác nhân phụ, tiền điều kiện, hậu điều kiện, luồng chính, luồng thay thế, ngoại lệ, quy tắc nghiệp vụ, dữ liệu liên quan, giao diện lập trình liên quan.

### 2.4. Thiết kế giao diện web quản trị (mục 4.5 — hoàn toàn mới)

19 tiểu mục, **19 ảnh chụp thật** từ hệ thống đang chạy với dữ liệu thật trên MongoDB:

đăng nhập · bảng điều khiển · sản phẩm · biểu mẫu sản phẩm · đơn hàng · chi tiết đơn hàng · thanh toán · chi tiết giao dịch · trả hàng · người dùng · phiếu giảm giá · đánh giá · kiểm duyệt AI · danh mục · thông báo · thẻ địa danh · khám phá Nhật Bản · ảnh quảng bá · cài đặt.

Cách chụp: khởi động `backend/server.js` ở cổng 4199 (không đụng cổng 4100 người dùng đang dùng), đăng nhập bằng **tài khoản quản trị tạm thời**, chụp bằng Chrome qua Playwright ở `deviceScaleFactor: 2`.

### 2.5. Chức năng quản trị đã triển khai (mục 5.3 — mở rộng)

Từ 1 đoạn văn + 1 bảng 8 dòng → **9 tiểu mục**, mỗi chức năng có bảng đặc tả 9 trường: mục đích, đường dẫn truy cập, quyền cần có, thành phần giao diện, giao diện lập trình sử dụng, collection liên quan, luồng xử lý, kiểm tra hợp lệ, trường hợp lỗi.

---

## 3. Lỗi trong bản gốc đã sửa

### 3.1. Lỗi cấu trúc và đánh số

| Lỗi | Xử lý |
|---|---|
| Mục 3.2.1 có câu *"Tương tác mua sắm…"* bị lặp nguyên văn trong cùng một dòng | Viết lại toàn bộ danh sách gạch đầu dòng theo 7 nhóm, không còn lặp |
| *"3.4. Phân tích luồng hoạt động"* bị dính vào cuối một gạch đầu dòng của mục 3.3.4 | Tách ra thành mục **3.4. Biểu đồ hoạt động** với Style `Heading 2` thật |
| *"3.4 ERD"* trùng số với mục luồng hoạt động | ERD chuyển hẳn sang **4.2** như yêu cầu; mục 3.4 chỉ còn biểu đồ hoạt động |
| Sau 4.4 lại xuất hiện *"4.3. A"*, *"4.3. B"* … *"4.3. F"* | Đổi thành **4.4.1 → 4.4.6** |
| 43 tiêu đề màn hình đánh số 1–43 lẫn với số mục | Đổi thành **4.4.1.1 → 4.4.6.9** |
| Mục 7.3 xuất hiện hai lần | Đánh số lại thành 7.3 → 7.7 |
| 4.3.1 và 4.3.2 chỉ có **bảng 1×1 rỗng** thay cho sơ đồ; trong đó một ô chỉ chứa dòng chữ *"Hình 4.2: Sitemap ứng dụng…"* — tức là **caption không có hình** | Xoá hai khung rỗng, chèn sơ đồ thật (Hình 4.9, 4.10) kèm chú thích |
| Mục lục cũ nằm trong khối `w:sdt` (không thấy khi duyệt đoạn văn thường), nội dung đã lỗi thời — vẫn liệt kê *"3.3.1. Use Case: Quản lý sản phẩm"*, *"4.4.1 Màn hình Splash"* là những mục không còn tồn tại | Gỡ bỏ, dựng lại mục lục / danh mục hình / danh mục bảng |
| Không có chương nào bắt đầu ở trang mới (danh mục bảng và Chương 1 nằm chung một trang) | Đặt ngắt trang trước cả 12 tiêu đề cấp 1 |

### 3.2. Nội dung không khớp mã nguồn (Vòng 1)

Toàn bộ phát hiện dưới đây được xác minh bằng `grep` trên workspace, không suy đoán.

| Bản gốc viết | Thực tế trong mã nguồn | Xử lý |
|---|---|---|
| Web Admin dùng **ReactJS/NextJS** | `admin/` là **HTML + CSS + JavaScript thuần**, 5 tệp trong `admin/js/`, không có React | Sửa ở Bảng 3.1, Bảng 4.1, mục 8.1 |
| MongoDB truy cập qua **Mongoose** | `backend/lib/mongo.js` dùng trình điều khiển Node.js chính thức, không có Mongoose | Sửa |
| Dùng **Gemini AI** cho chatbot | `grep -rn "gemini"` trên toàn `backend/` **không có kết quả**. Biến `GEMINI_API_KEY` tồn tại trong `.env.server` nhưng không tệp mã nào đọc nó | Thay bằng Ollama (mô hình chạy cục bộ) |
| Dùng **Fotor API** tạo ảnh | Không tồn tại | Gỡ bỏ |
| **Minigame** Caro AI, Sudoku AI, Né quái vật, Trú mưa; tích luỹ **"Xu" thưởng** | `grep -i "minigame\|coins\|xu thưởng"` → **không có kết quả** trên toàn bộ `mobile/`, `backend/`, `admin/` | Gỡ khỏi Bảng 1.1, mục 2.2.1, 2.3.1, 3.2.2, kịch bản kiểm thử |
| Tab admin **Analytics/ML**, tab **Games** | `admin/index.html` chỉ có 15 `data-route`, không có hai mục này | Thay bằng danh sách 15 trang thật |
| Stripe **Payment Sheet** | Mã nguồn dùng Checkout Session và Payment Intent (`backend/routes/paymentsStripe.js`) | Sửa |
| Mật khẩu băm bằng **scrypt hoặc bcrypt** | `backend/lib/auth.js` chỉ dùng **bcrypt** | Sửa |
| Bộ quyền dạng chuỗi: `admin:dashboard`, `users:read`, `roles:grant`, `roles:revoke`, `products:manage`, `orders:manage` | `grep -rn "products:manage\|roles:grant\|permissions"` → **không có kết quả**. Hệ thống dùng 4 vai trò thứ bậc `customer < staff < admin < super_admin` (`ROLE_RANK` trong `auth.js`) | Viết lại toàn bộ mục 5.5 |
| API `/api/admin/products`, `/api/chat`, `/api/chat/upload`, `/api/chat/create-image`, `/api/admin/overview`, `/api/customers/:userId`, `/api/cart/:userId`, `/api/checkout/quote`, `/api/products/bulk`, `PATCH /api/admin/users/:id/role` | Không endpoint nào trong số này tồn tại | Thay bằng 115 endpoint thật, trích từ `backend/routes/` |
| Ứng dụng chạy trên **cả Web** | Bản dựng web đã bị gỡ (chỉ còn Android/iOS) | Sửa ở mục 1.2, 7.2.4, 8.1 |
| Chỉ có COD và Stripe | Có thêm **VNPay** (`backend/routes/paymentsVnpay.js`) | Bổ sung xuyên suốt |
| Bảng 5.1 liệt kê `app/(tabs)/shop.tsx`, `app/(tabs)/chat.tsx`, `app/admin.tsx`, `context/AppContext.tsx`, `data/catalog.ts`, `server/index.mjs` | **Không tệp nào tồn tại** | Thay bằng cấu trúc thư mục thật |
| Bảng 4.2 liệt kê collection `Cart`, `Wishlist`, `DiscountCodes`, `AIChat`, `ForgotPassword` | Tên thật: `cart_items`, `wishlist_items`, `discount_rules`, `chats`; không có `ForgotPassword` | Thay bằng 35 collection thật từ `mongoCollections.js` |
| Trợ lý AI là **một tab riêng** trên thanh điều hướng | `mobile/lib/botchat.tsx` — hộp thoại nổi dùng chung mọi màn hình; thanh tab chỉ có 5 mục | Sửa mục 4.3.1, 5.2.5 |
| Tuỳ chỉnh **theme** (màu/chữ) trong Settings | `mobile/theme/tokens.ts` là tệp token cố định, `settings.tsx` chỉ có 3 nhóm: Giao diện, Trợ lý & gợi ý, Thông báo | Gỡ khỏi kịch bản kiểm thử |
| Chat hỗ trợ **upload ảnh/video** | `botchat.tsx` không có chức năng chọn tệp; tìm bằng ảnh nằm ở `mobile/app/camera.tsx` | Sửa |
| Uptime **99,9%** | Không có căn cứ đo lường | Viết lại thành mô tả cơ chế dự phòng thật |

### 3.3. An toàn thông tin

| Vấn đề | Xử lý |
|---|---|
| **Bảng 5.4** *"Tài khoản admin mặc định"* công bố `a@gmail.com` / mật khẩu `1` và `lnhat1938@gmail.com` / `1` | Xoá hẳn bảng. Mục 5.5 chỉ mô tả **cơ chế** khởi tạo tài khoản từ biến môi trường |
| **Bảng 7.2** *"Tài khoản dùng khi demo"* công bố cùng thông tin trên | Thay bằng bảng mô tả **cách có được** từng loại tài khoản, không có email/mật khẩu |
| Mục 3.3.4 nêu đích danh `a@gmail.com`, `lnhat1938@gmail.com` là "admin gốc được bảo vệ" | Viết lại theo cơ chế thật (chặn tự hạ quyền, kiểm tra vai trò hợp lệ) |
| Kịch bản kiểm thử TC-A02, TC-A10 chứa `a@gmail.com / 1` | Viết lại toàn bộ 2 bảng kịch bản kiểm thử |
| Ảnh chụp trang **Người dùng** và **Đơn hàng** lộ email, số điện thoại thật của khách | Che bằng JavaScript trước khi chụp: email → `••••••@domain`, điện thoại → `091••••••` |
| Bảng biến môi trường liệt kê `GEMINI_API_KEY` (không dùng) | Thay bằng bảng 8 nhóm biến thật, **chỉ tên biến, không có giá trị** |

**Kết quả quét bản PDF cuối:** không có `sk_test_*`, `pk_test_*`, `AIza*`, chuỗi kết nối MongoDB có mật khẩu, hay bất kỳ cặp email/mật khẩu nào. Ba địa chỉ thư điện tử còn lại là của chính ba sinh viên trong Bảng 1.2 (thông tin nhóm thực hiện, vốn có trong bản gốc).

---

## 4. Kết quả sáu vòng kiểm tra

### Vòng 1 — Đúng theo mã nguồn ✅

- Trích 115 endpoint thật bằng `grep -rhoE "\bapi\.(get|post|put|patch|delete)\(\s*'[^']+'" backend/routes/`.
- Đối chiếu tự động: **75/75 endpoint** nêu trong báo cáo đều tìm được trong mã nguồn.
- Đối chiếu collection: mọi tên collection nêu trong báo cáo đều có trong `mongoCollections.js`.
- 22 phát biểu sai đã liệt kê ở mục 3.2 đều được sửa hoặc gỡ.

### Vòng 2 — Nội dung học thuật ✅

- Chương 3 chỉ còn phân tích (triển khai, Use Case, đặc tả, hoạt động); ERD chuyển sang Chương 4 (thiết kế); ảnh chụp giao diện thật nằm ở Chương 4, mô tả cách triển khai ở Chương 5 — ba mức tách bạch.
- Gỡ nội dung lặp ở 3.2.1, gộp các danh sách trùng ý ở 2.2/2.3.
- Bổ sung mục *"những chức năng chưa hoàn tất"* ở 8.3 để phần kết luận không mâu thuẫn với phần thực hiện.

### Vòng 3 — Tiếng Việt ✅

- Toàn bộ nội dung mới viết bằng tiếng Việt, văn phong báo cáo.
- Thuật ngữ thống nhất: Người dùng, Quản trị viên, Sản phẩm, Đơn hàng, Thanh toán, Biến thể sản phẩm, Cơ sở dữ liệu, Trí tuệ nhân tạo, Phiếu giảm giá, Giao diện lập trình.
- Ngôn ngữ tài liệu đặt `vi-VN` trên mọi run và trong `settings.xml`.
- Dịch các tiêu đề còn tiếng Anh: *"Use Case người dùng"* → *"Sơ đồ Use Case ứng dụng người dùng"*, *"Sitemap web admin"* → *"Sitemap web quản trị"*, *"Test case…"* → *"Kịch bản kiểm thử…"*.

### Vòng 4 — Đánh số và tham chiếu ✅

Kiểm tra tự động trên bản PDF, **chỉ tính phần thân bài** (bỏ qua các trang mục lục):

```
Hình: 80 mục · chương 3: 8, chương 4: 72 · liên tục, không trùng, không nhảy số ✅
Bảng: 36 mục · chương 1: 2, 2: 1, 3: 14, 4: 2, 5: 12, 6: 3, 7: 2 · ✅
Số trang trong mục lục / danh mục hình / danh mục bảng: 280/280 mục khớp trang thật ✅
Chuỗi "Error! Reference source not found": 0 ✅
```

### Vòng 5 — Bố cục trực quan ✅

Render `soffice --headless --convert-to pdf` rồi `pdftoppm` toàn bộ **161 trang**, xem từng trang qua 5 bảng contact sheet.

| Kiểm tra | Kết quả |
|---|---|
| Chữ vượt ra ngoài lề | **0/161 trang** (đo bằng `pdftotext -bbox`, so với khung 3/2/2,5/2,5 cm) |
| Trang trắng | **0** |
| Ảnh vượt vùng nội dung | 0 — ảnh rộng nhất 24,7 cm (trang ngang), cao nhất 20,0 cm |
| Bảng vượt lề | 0 — 5 bảng của bản gốc rộng 17,2 cm đã thu về 16 cm theo tỉ lệ |
| Caption tách khỏi hình | 0 — mọi đoạn ảnh đặt `keepNext` |
| Font không đồng nhất | 0 — ép Times New Roman trên toàn bộ run |

**Lỗi phát hiện trong vòng này và đã sửa rồi render lại:**

1. Số trang trong chân trang nằm **ngoài lề phải 23 pt** — do bảng chân trang rộng 17,2 cm theo lề cũ, cộng `w:ind w:right="-115"`. Đã thu bảng về 16 cm và gỡ thụt lề âm.
2. **Khung viền trang** (`w:pgBorders display="firstPage"`) — Word chỉ vẽ ở trang bìa nhưng LibreOffice vẽ ở **mọi trang** và cắt vào số trang. Gỡ hẳn để bản DOCX và bản PDF hiển thị như nhau.
3. **Tiêu đề mục màu xanh, in nghiêng** do bản gốc đặt định dạng trực tiếp trên run, đè lên Style. Đã gỡ `w:color`, `w:i`, `w:sz` khỏi mọi run của Heading 1/2/3.
4. **Dấu đầu dòng thò ra ngoài lề trái 0,64 cm** trên 10 trang. Đã đặt thụt lề tường minh `left=357, hanging=357` cho mọi đoạn danh sách.
5. **Cột bảng sai độ rộng** — `python-docx` đặt `tcW` nhưng thiếu `tblLayout=fixed` và `tblGrid` nên Word/LibreOffice tự co giãn. Đã bổ sung cả ba.
6. **Ảnh chụp màn hình điện thoại chỉ cao 12,1 cm**, để lại ~7 cm trắng cuối trang. Đã phóng to đúng tỉ lệ lên 15 cm (43 ảnh).
7. **Danh mục bảng và Chương 1 nằm chung một trang.** Đã đặt ngắt trang trước mọi tiêu đề cấp 1.

### Vòng 6 — Sản phẩm cuối ✅

```
DOCX toàn vẹn (zipfile.testzip)      : OK
Ảnh trong gói                        : 85 tệp
Ảnh được chèn vào nội dung           : 81
Bảng                                 : 39
Section                              : 3 (dọc → ngang cho ERD → dọc)
Khổ giấy PDF                         : 595,3 × 841,9 pt = A4 ✅
Trang ngang                          : trang 55, đúng 841,9 × 595,3 pt ✅
Placeholder / khung rỗng còn lại     : 0
Bí mật, khoá API, mật khẩu           : 0
Bản gốc bị ghi đè                    : không
```

---

## 5. Sự cố kỹ thuật và cách xử lý

| Sự cố | Cách xử lý |
|---|---|
| Tệp ERD nêu trong yêu cầu (`JAPANO_ERD_36_bang_tinh_chinh_theo_mau.drawio`) **không tồn tại** | Dò toàn workspace, tìm thấy `erd.drawio` chính là bản đó (tên diagram *"36 bảng – Tên chuẩn hoá theo mẫu"*, đúng 36 bảng / 51 quan hệ, tên tiếng Việt). Dùng tệp này. |
| `drawio` CLI báo `Invalid page index` với `-p 0` | Bản ≥ 27 đánh số trang từ 1; đổi sang `-p 1`. |
| `drawio` CLI báo `Error writing to file` khi ghi vào `/tmp/claude-*` | Snap confinement chặn ghi ngoài `$HOME`; chuyển thư mục làm việc sang `~/japano-baocao-work`. |
| Cắt vùng từ ảnh ERD tổng thể cho ra tỉ lệ 1:5 (dải hẹp và cao), không dùng được trên trang A4 | Vẽ lại từng nhóm bằng bố cục hai cột tự sinh, dữ liệu trường lấy trực tiếp từ `erd.drawio`, tỉ lệ 0,55 – 2,1. |
| Bố cục tự động của draw.io cho các nhóm khiến **dây nối cắt xuyên qua bảng** | Bỏ tự động định tuyến, tự đặt mỗi dây một làn riêng trong máng giữa hai cột. |
| Sơ đồ Use Case ban đầu để trục dọc đè lên các hình bầu dục cột trái | Dời cột trái sang phải một khoảng bằng nửa chiều rộng hình bầu dục cộng 64 pt. |
| Sitemap: dây nối từ nút gốc xuống hàng thứ hai cắt qua các khối của hàng thứ nhất | Định tuyến vòng qua trục dọc đặt bên ngoài mọi khối. |
| `.env.server` đặt `JAPANO_ADMIN_PASSWORD` nhưng **không đăng nhập được** tài khoản quản trị có sẵn | `ensureAdminSeeded` chỉ ghi mật khẩu khi tài khoản **chưa có** `passwordHash`; tài khoản cũ giữ nguyên hash. Tạo tài khoản quản trị **tạm thời** bằng script rồi **xoá sau khi chụp xong** (đã xác nhận `tài khoản tạm còn lại: 0`). |
| Sửa dữ liệu qua `store` không có tác dụng | `createStore()` trả về `read/write/update/initialize/flush`, phải gọi `initialize()` trước và `flush()` sau; không có `store.ready` hay `store.get`. |
| **LibreOffice tính lại trường `SEQ`** khi xuất PDF, làm số hình/bảng trong PDF lệch với số trong DOCX (ví dụ *Hình 4.6* trong DOCX thành *Hình 4.15* trong PDF) | Bỏ trường `SEQ`, dùng **số cố định** do chương trình tự tính và ghi thẳng vào chú thích (Style `Caption` vẫn giữ nguyên để danh mục hình/bảng thu thập được). Đánh đổi: khi chèn thêm hình, phải đánh số lại thủ công — nhưng bù lại **DOCX và PDF luôn khớp nhau tuyệt đối**. Mục lục chính vẫn là trường `TOC` thật, Word cập nhật được bình thường. |
| LibreOffice **xoá nội dung mục lục đã dựng sẵn** khi `settings.xml` có `w:updateFields=true` | Gỡ `updateFields`; giữ trường `TOC` kèm kết quả đã lưu sẵn. |
| Số trang trong mục lục ban đầu **đều trỏ về chính trang mục lục** | Chính các trang mục lục cũng chứa nguyên văn mọi tiêu đề. Bổ sung bước loại trừ dải trang mục lục trước khi dò. |
| Mục lục cũ **không thấy** khi duyệt đoạn văn | Nó nằm trong khối `w:sdt`, mà `w:sdt` không phải `w:p` cũng không phải `w:tbl`. Bổ sung bước quét và gỡ riêng. |

**Quy trình hai lượt để có số trang đúng:** lượt 1 dựng mục lục với đúng số dòng nhưng bỏ trống số trang → xuất PDF → dò trang thật của từng mục → lượt 2 dựng lại với số trang thật. Vì số dòng không đổi nên phân trang giữa hai lượt giống hệt nhau; đã kiểm chứng lại trên bản cuối: **280/280 mục khớp**.

---

## 6. Những chức năng được xác định là **chưa triển khai**

Đã ghi rõ trong mục 8.3 của báo cáo là hướng phát triển, **không mô tả như đã hoàn thành**:

1. **Thông báo đẩy từ xa** — `backend/routes/push.js` và `mobile/lib/push.ts` đã có phần đăng ký thiết bị, nhưng chưa gửi được từ máy chủ tới thiết bị vì thiếu định danh dự án trên dịch vụ biên dịch của Expo. Hiện dùng thông báo trong ứng dụng (`mobile/lib/localNotify.ts`).
2. **Tích hợp đơn vị vận chuyển** — trạng thái vận chuyển cập nhật thủ công ở cổng quản trị, chưa gọi giao diện lập trình của bên thứ ba.
3. **Phí vận chuyển động** — hiện là một giá trị cố định trong cấu hình cửa hàng, chưa tính theo khoảng cách hay khối lượng.
4. **Triển khai môi trường thật** — hệ thống chạy trên máy phát triển, Stripe ở chế độ thử nghiệm và VNPay ở môi trường Sandbox.
5. **Minigame và hệ thống xu thưởng** — bản gốc mô tả như đã có; thực tế **không tồn tại dòng mã nào**. Đã gỡ khỏi báo cáo, không đưa vào hướng phát triển vì không có nền tảng sẵn.
6. **Tuỳ chỉnh giao diện (theme)** — `mobile/theme/tokens.ts` là bộ token cố định, người dùng không đổi được. Đã gỡ khỏi báo cáo.

---

## 7. Giới hạn còn lại

1. **Sơ đồ ERD tổng thể (Hình 4.1)** đặt 36 bảng trên một trang ngang A4 nên chữ trong bảng nhỏ. Đây là giới hạn vật lý của khổ giấy. Hình này đóng vai trò **bản đồ tổng quan**; toàn bộ chi tiết đọc được nằm ở Hình 4.2 – 4.8 (bảy sơ đồ phóng to theo nhóm) và Bảng 4.2 (51 quan hệ dạng văn bản). Cách trình bày hai cấp này đúng như yêu cầu đặt ra.
2. **Số hình và số bảng là số cố định**, không phải trường `SEQ` tự cập nhật — lý do và đánh đổi đã nêu ở mục 5. Nếu chèn thêm hình sau này, cần đánh số lại thủ công hoặc chạy lại `~/japano-baocao-work/build_report.py`.
3. **Mỗi màn hình ứng dụng chiếm một trang.** Ảnh chụp điện thoại có tỉ lệ rất cao (5,6 × 12,1 → nay 6,9 × 15 cm) nên không thể xếp hai màn hình một trang mà vẫn đọc được. Đã phóng to hết mức để giảm khoảng trắng.
4. **Không chụp lại 43 màn hình ứng dụng.** Ảnh trong bản gốc đã đúng và đầy đủ; việc khởi động máy ảo Android song song với các dịch vụ trí tuệ nhân tạo dùng GPU có nguy cơ làm sập phiên làm việc từ xa. Ảnh cũ được giữ nguyên, chỉ phóng to và bổ sung chú thích.

---

## 8. Tệp bàn giao

| Tệp | Đường dẫn |
|---|---|
| Báo cáo hoàn thiện (Word) | `/home/nhat/Downloads/japano/baocaototnghiep_hoan_thien.docx` |
| Báo cáo hoàn thiện (PDF) | `/home/nhat/Downloads/japano/baocaototnghiep_hoan_thien.pdf` |
| Báo cáo kiểm tra chất lượng | `/home/nhat/Downloads/japano/BAO_CAO_QA.md` |
| Quy trình đã dùng | `/home/nhat/Downloads/japano/.claude/skills/bao-cao-tot-nghiep/SKILL.md` |
| Bản gốc (không đổi) | `/home/nhat/Downloads/japano/baocaototnghiep.docx` |

**Tệp trung gian** (giữ lại để dựng lại khi cần) nằm ở `~/japano-baocao-work/`: `build_report.py`, `docx_lib.py`, `content.py`, `content_admin.py`, `make_diagrams.py`, `make_deploy.py`, `erd_group_svg.py`, `pass2.sh`, thư mục `diagrams/` (11 sơ đồ SVG + PNG) và `shots/` (19 ảnh chụp cổng quản trị).
