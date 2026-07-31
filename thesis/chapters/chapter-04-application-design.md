# CHƯƠNG 4: THIẾT KẾ ỨNG DỤNG

## 4.1. Kiến trúc công nghệ

Bảng 4.1 trình bày công nghệ sử dụng theo từng lớp của hệ thống, với số phiên bản lấy trực tiếp từ `mobile/package.json` và `backend/package.json` tại thời điểm phân tích — không phải số phiên bản suy đoán hay số phiên bản mới nhất hiện có trên thị trường.

**Bảng 4.1: Công nghệ sử dụng trong dự án**

| Lớp | Công nghệ trong mã nguồn | Ghi chú |
|---|---|---|
| Nền tảng di động | Expo `~51.0.28`, React Native `0.74.5`, React `18.2.0` | Chạy đa nền tảng Android/iOS/Web từ cùng một mã nguồn |
| Điều hướng | Expo Router `~3.5.23` | Định tuyến theo cấu trúc thư mục (file-based routing) |
| Quản lý trạng thái | React Context thuần (`AuthProvider`, `StoreProvider`, `CatalogProvider`, `ShopProvider`, `BotChatProvider`) | Không dùng Redux/Zustand/MobX; không dùng React Query/SWR — mọi gọi API đi qua một client viết tay duy nhất (`mobile/lib/api.ts`) |
| Lưu trữ cục bộ | `AsyncStorage 1.23.1`, `expo-secure-store ~13.0.2` | Token JWT lưu trong Secure Store; dữ liệu giỏ hàng/hồ sơ lưu trong AsyncStorage |
| Thanh toán thẻ | `@stripe/stripe-react-native 0.37.2` | Thành phần `CardForm` nhập thẻ trực tiếp trong ứng dụng |
| Media | `expo-image-picker ~15.1.0`, `expo-av ~14.0.7`, `expo-image ~1.13.0` | Không dùng `expo-camera` — chụp ảnh thực hiện qua bàn giao cho ứng dụng Camera hệ điều hành |
| Thông báo đẩy | `expo-notifications ~0.28.19` | Đăng ký token, xử lý điều hướng khi chạm thông báo |
| Backend | Node.js `≥20`, Express `^4.19.2` | Một tiến trình duy nhất phục vụ cả API và trang quản trị |
| Xác thực | `bcryptjs ^3.0.3`, `jsonwebtoken ^9.0.3` | Băm mật khẩu + JWT, không dùng framework xác thực bên thứ ba |
| Cơ sở dữ liệu | Tệp JSON (`backend/data/db.json`) là nguồn dữ liệu chính; `mongodb ^7.5.0` (driver thuần, không dùng Mongoose) cho đồng bộ tuỳ chọn | Trình bày chi tiết tại mục 4.2 |
| Thanh toán | `stripe ^22.3.2` (chế độ Test), VNPay Sandbox (tự triển khai chữ ký HMAC-SHA512, không dùng SDK) | Cả hai đều bị khoá cứng ở chế độ thử nghiệm trong mã nguồn |
| Media/lưu trữ | `cloudinary ^2.10.0` | Ảnh đánh giá, ảnh minh chứng trả hàng, logo cửa hàng |
| Nhật ký & giám sát | `pino ^10.3.1`, `pino-http`, `@sentry/node ^10.67.0` | Ghi log có cấu trúc; Sentry chỉ kích hoạt khi có `SENTRY_DSN` |
| Bảo mật HTTP | `helmet ^8.3.0`, `express-rate-limit ^8.6.0`, `cors ^2.8.5` | Chi tiết cấu hình trình bày ở Chương 5 |
| Trang quản trị | HTML/CSS/JavaScript thuần, không build step | Phục vụ trực tiếp bởi Express dưới đường dẫn `/admin` |
| Dịch vụ AI cục bộ | FastAPI (Python) cho FASHN/Motion/Embedding/CatVTON; Ollama cho `qwen2.5:7b`/`qwen3-vl:8b` | Tiến trình độc lập, giao tiếp qua HTTP, có cơ chế dự phòng khi không khả dụng |

*Nguồn: `thesis/evidence/technology-stack.md` (toàn bộ).*

Một điểm cần nhấn mạnh khi trình bày mục này: bản thân dự án không sử dụng bất kỳ bộ khung quản lý trạng thái hay thư viện truy vấn dữ liệu phổ biến nào (Redux, React Query, v.v.), mà lựa chọn kiến trúc tối giản dựa hoàn toàn trên các API sẵn có của React (Context API) kết hợp một lớp gọi API viết tay. Đây là một quyết định thiết kế có chủ đích phù hợp quy mô một dự án tốt nghiệp, không phải một thiếu sót.

## 4.2. Thiết kế cơ sở dữ liệu

Mục này trình bày hai tầng thiết kế dữ liệu tách biệt của dự án: tầng **vận hành thật** (đang chạy) và tầng **thiết kế lý thuyết** (sản phẩm thiết kế song song, chưa kết nối vào hệ thống đang chạy). Việc tách bạch rõ ràng hai tầng này là bắt buộc để tránh lặp lại sai sót của một bản báo cáo trước đó, trong đó MongoDB/Mongoose bị mô tả nhầm là công nghệ cơ sở dữ liệu chính đang vận hành.

### 4.2.1. Tầng vận hành thật: kho dữ liệu JSON

Toàn bộ dữ liệu nghiệp vụ của hệ thống đang chạy được lưu trong một tệp JSON duy nhất, `backend/data/db.json`, do module `backend/lib/store.js` quản lý. Cơ chế ghi dữ liệu sử dụng chiến lược ghi nguyên tử (atomic write): dữ liệu được ghi ra một tệp tạm, sau đó đổi tên (`rename`) đè lên tệp chính — tránh tình trạng tệp dữ liệu bị hỏng nếu tiến trình dừng đột ngột giữa lúc ghi (`backend/lib/store.js:67-74`).

Tệp trạng thái có 34 khoá cấp cao nhất (`backend/seed.js:85-122`), tương ứng với 34 nhóm thực thể nghiệp vụ: `users, products, orders, payments, returnRequests, carts, wishlists, addresses, reviews, notifications, vouchers, flagcards, flagcardCollections, vipMemberships, banners, interactions, searchLogs, pushTokens, profiles, chats, tryonHistory, goals, aiDescriptions, japanSpotReviews, japanSpotSuggestions,...` và một số khoá cấu hình (`shop`, `integrations`, `flagcardConfig`, `schemaVersion`). Bảng 4.2 trình bày các nhóm thực thể chính cùng vai trò của chúng.

**Bảng 4.2: Các nhóm dữ liệu chính trong kho JSON**

| Nhóm dữ liệu | Vai trò |
|---|---|
| `users` | Tài khoản, vai trò (`customer/staff/admin/super_admin`), mật khẩu đã băm, thông tin VIP |
| `products` | Sản phẩm: tên, giá, ảnh, biến thể (màu/size/tồn kho), trạng thái, chủ sở hữu (`ownerId` với sản phẩm do staff tạo) |
| `orders` | Đơn hàng: sản phẩm, tổng tiền, địa chỉ, phương thức thanh toán, lịch sử trạng thái |
| `payments` | Giao dịch thanh toán trực tuyến (Stripe/VNPay): trạng thái, số tiền đã hoàn, mã giao dịch |
| `returnRequests` | Yêu cầu huỷ đơn/trả hàng hợp nhất trong một hàng đợi duy nhất, phân biệt bằng trường `kind` |
| `carts`, `wishlists`, `addresses` | Dữ liệu cá nhân theo từng người dùng |
| `notifications` | Thông báo trong ứng dụng, broadcast hoặc cá nhân |
| `vouchers` | Mã giảm giá, bao gồm voucher đền bù cá nhân do quản trị viên cấp |
| `flagcards`, `flagcardCollections`, `vipMemberships` | Chương trình khách hàng thân thiết |
| `interactions`, `searchLogs` | Dữ liệu hành vi phục vụ hệ thống gợi ý và phân tích |

*Nguồn: `thesis/evidence/database-analysis.md` mục 1, 5.*

Cơ chế đồng bộ MongoDB, khi được cấu hình qua biến môi trường `MONGODB_URI`, không lưu dữ liệu theo từng collection chuẩn hoá mà **sao chép toàn bộ trạng thái thành một document duy nhất** (collection `app_state`, `_id: 'main'`) sau mỗi lần ghi (`backend/lib/store.js:16-39`). Đây là cơ chế nhân bản (mirror) phục vụ mục tiêu nhiều máy/nhiều lần khởi động cùng thấy một nguồn dữ liệu, không phải một thiết kế cơ sở dữ liệu quan hệ hay tài liệu (document-oriented) chuẩn hoá. Việc kết nối MongoDB sử dụng driver `mongodb` thuần, **không sử dụng Mongoose hay bất kỳ lớp ánh xạ đối tượng (ODM) nào** — xác nhận bằng tìm kiếm toàn bộ mã nguồn không có kết quả nào chứa từ khoá `mongoose`.

### 4.2.2. Tầng thiết kế lý thuyết: lược đồ quan hệ chuẩn hoá

Song song với kho dữ liệu JSON đang vận hành, nhóm đã xây dựng một bộ thiết kế cơ sở dữ liệu quan hệ chuẩn hoá độc lập, thể hiện qua hai tệp DDL SQL: `japano_schema_v2.sql` (phương ngữ MySQL/MariaDB) và `japano_schema_v2_sqlite.sql` (phương ngữ SQLite), được sinh bởi kịch bản `backend/scripts/buildErdV2.js`. Bộ thiết kế này gồm 47 câu lệnh `CREATE TABLE`, tách các thực thể lồng nhau trong tệp JSON thành các bảng độc lập có khoá chính/khoá ngoại rõ ràng — ví dụ `product_variants`, `product_images`, `order_items`, `order_status_history`, `refunds`, `inventory_movements`. Chú thích trong kịch bản sinh tệp nêu rõ bộ thiết kế v2 này "sửa 11 nhóm lỗi thiết kế đã được rà soát" so với cấu trúc JSON gốc.

**Điểm mấu chốt cần trình bày minh bạch:** bộ thiết kế quan hệ này **chưa từng được kết nối vào backend đang chạy**. Không có driver SQL nào (`sqlite`, `mysql`, `pg`) tồn tại trong `backend/package.json`; không có đoạn mã nào trong `backend/` đọc hay thực thi hai tệp SQL này ngoài chính kịch bản sinh ra chúng. Đây là một sản phẩm thiết kế minh chứng năng lực phân tích/thiết kế cơ sở dữ liệu quan hệ của nhóm, cần được trình bày trong báo cáo **như một hạng mục thiết kế**, tách bạch rõ ràng khỏi phần mô tả công nghệ đang vận hành thật ở mục 4.2.1.

Ngoài ra, còn tồn tại một họ tệp thứ hai — `japano_erd.dbml`, `japano_erd.sql`, `japano_erd_sqlite.sql` — được sinh tự động từ chính dữ liệu thật trong `backend/data/db.json` (bởi `backend/scripts/exportMysqlErd.js`) nhằm mục đích trực quan hoá cấu trúc dữ liệu hiện có dưới dạng ERD, chứ không phải một thiết kế chuẩn hoá mới. Tệp `japano_erd.dbml` tự ghi chú ngay trong nội dung: *"Metadata của object app_state; không phải bảng SQL vật lý của runtime."*

*Nguồn: `thesis/evidence/database-analysis.md` mục 6.*

## 4.3. Sitemap và luồng điều hướng ứng dụng

### 4.3.1. Sitemap ứng dụng di động

Ứng dụng di động có 33 tệp màn hình dưới `mobile/app/`, tổ chức theo cơ chế định tuyến dựa trên cấu trúc thư mục của Expo Router. Cấu trúc điều hướng chính (`mobile/app/_layout.tsx:92-119`) gồm một ngăn xếp màn hình gốc (root stack) chứa các màn hình xác thực (Đăng nhập/Đăng ký/Quên mật khẩu), một nhóm tab chính, và các màn hình chi tiết (sản phẩm, danh mục, giỏ hàng, checkout, đơn hàng, v.v.).

Nhóm tab chính (`mobile/app/(tabs)/_layout.tsx`) có **4 tab chức năng thật**: Trang chủ, Sản phẩm, Yêu thích, Cá nhân — cùng **một nút trung tâm nổi (FAB)** không phải là một tab thực sự mà chỉ là lối tắt điều hướng thẳng tới màn hình Camera (`mobile/app/(tabs)/scan.tsx` chỉ là một tệp chuyển hướng 3 dòng). Đây là điểm cần trình bày chính xác vì dễ gây hiểu nhầm nếu chỉ nhìn giao diện (5 nút ở thanh tab nhưng chỉ 4 tab thật).

Cơ chế `AuthGate` (`mobile/app/_layout.tsx:31-45`) kiểm soát quyền truy cập: khách chưa đăng nhập được xem trang chủ, danh mục, chi tiết sản phẩm, trang văn hoá; mọi hành động tạo dữ liệu cá nhân (giỏ hàng, yêu thích, chat, thử đồ, đặt hàng) đều yêu cầu đăng nhập và tự động điều hướng, ghi nhớ đường dẫn đích để quay lại sau khi xác thực thành công.

*Nguồn: `thesis/evidence/architecture.md` mục 4; `thesis/evidence/feature-inventory.md`.*

### 4.3.2. Sitemap trang quản trị Web

Trang quản trị (`admin/`) không dùng cơ chế định tuyến phía client phức tạp — là một trang HTML đơn (`admin/index.html`) với nội dung được dựng động bằng JavaScript thuần (`admin/js/*.js`) theo các "view" tương ứng từng nhóm chức năng: Dashboard tổng quan, Sản phẩm, Đơn hàng, Trả hàng & hoàn tiền, Người dùng, Voucher & khuyến mãi, Thông báo, Kiểm duyệt nội dung. Phạm vi hiển thị các mục này **phụ thuộc vào vai trò đăng nhập** — tài khoản `staff` chỉ thấy giao diện quản lý sản phẩm của chính mình, các mục còn lại bị ẩn hoàn toàn khỏi thanh điều hướng.

*Nguồn: `thesis/evidence/feature-inventory.md` mục 6; `thesis/evidence/security-analysis.md` mục 1-2.*

## 4.4. Thiết kế giao diện chính

Bảng 4.3 liệt kê các màn hình chính cần minh hoạ bằng ảnh chụp thật trong bản báo cáo hoàn chỉnh.

**Bảng 4.3: Các màn hình chính cần minh hoạ**

| Màn hình | Mô tả thiết kế | Vị trí mã nguồn |
|---|---|---|
| Splash / Onboarding | Giới thiệu ứng dụng, lựa chọn đăng nhập hoặc xem sản phẩm không cần tài khoản | `mobile/app/onboarding.tsx` |
| Đăng nhập / Đăng ký / Quên mật khẩu | Xác thực JWT thật, có thanh đo độ mạnh mật khẩu thời gian thực | `mobile/app/login.tsx`, `register.tsx`, `forgot-password.tsx` |
| Trang chủ | Gợi ý cá nhân hoá, danh mục, outfit theo ngày | `mobile/app/(tabs)/index.tsx` |
| Cửa hàng / Tìm kiếm | Tìm kiếm mờ (fuzzy), lọc theo danh mục, sắp xếp | `mobile/app/(tabs)/products.tsx` |
| Chi tiết sản phẩm | Gallery ảnh/video có phóng to, mô tả AI, gợi ý phối đồ, đánh giá | `mobile/app/product/[slug].tsx` |
| Giỏ hàng / Checkout | Luồng nhiều bước: địa chỉ, vận chuyển, thanh toán, xác nhận | `mobile/app/cart.tsx`, `checkout.tsx` |
| Chi tiết đơn hàng | Timeline trạng thái, huỷ đơn, trả hàng có ảnh minh chứng | `mobile/app/order/[id].tsx` |
| Trợ lý AI (chat) | Chat có định hướng theo danh mục sản phẩm thật | `mobile/app/chat.tsx` |
| Thử đồ AI | Chọn ảnh, chọn sản phẩm, xem kết quả AI ghép trang phục | `mobile/app/tryon.tsx` |
| Admin Dashboard | Sidebar phân quyền, KPI, quản lý sản phẩm/đơn hàng/người dùng | `admin/index.html`, `admin/js/*.js` |

*Nguồn: `thesis/evidence/feature-inventory.md` (toàn bộ).*

**Lưu ý quan trọng khi hoàn thiện mục này:** đề cương và evidence pack đi kèm báo cáo này **không chứa ảnh chụp màn hình thật** — mọi hình minh hoạ giao diện phải được chụp trực tiếp từ ứng dụng đang chạy trước khi đưa vào bản in cuối cùng. Khi chụp và chú thích màn hình Cá nhân/Cài đặt (`mobile/app/profile.tsx`, `settings.tsx`), cần ghi chú rõ ràng rằng biểu mẫu chỉnh sửa hồ sơ hiện **chưa lưu được thay đổi** (các trường nhập liệu không kiểm soát, nút "Lưu" chỉ điều hướng quay lại) và phần lớn các công tắc cài đặt chỉ lưu tạm thời trên máy, chưa đồng bộ lên máy chủ — tránh để ảnh chụp màn hình ngầm khẳng định một chức năng hoạt động đầy đủ trong khi thực tế thì không, đúng theo nguyên tắc trung thực đã đặt ra cho toàn bộ báo cáo.

*Nguồn: `thesis/evidence/feature-inventory.md` mục 1; `thesis/evidence/missing-information.md` mục 4.*
