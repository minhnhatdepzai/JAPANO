# JAPANO Fashion AI - Expo Mobile Shop

Bản Expo mobile đồng bộ với MongoDB Atlas. App dùng React Native thuần + Expo SDK 54, Context API/AsyncStorage cho trạng thái nhẹ, Node.js backend để lưu dữ liệu, Ollama/Gemini/Fotor cho chatbot, gợi ý phối đồ và tạo ảnh thử đồ.

## Tính năng chính
- Home/Shop/Chat/Profile/Settings tối ưu mobile, có safe-area cho status bar và navigation bar.
- Đã bỏ Redux Toolkit để tránh remount màn hình/input khiến bàn phím tự đóng khi đang nhập.
- Chatbot dùng Ollama, Gemini Vision/Gemini prompt helper và Fotor tạo ảnh.
- Gợi ý sản phẩm theo dịp đặc biệt: Tết Tây, Tết Nguyên Đán, Giáng sinh, 1/6, 30/4, 1/5, Giỗ Tổ Hùng Vương, sinh nhật user, ngày đặc biệt user tự tạo, Phục sinh, 20/10, 20/11, 8/3, Ngày của Cha...
- Dữ liệu đồng bộ MongoDB: users, profile, settings, cart, wishlist, orders, generated images metadata, search history, products, services, games. Chatbot không lưu lịch sử hội thoại; media được lưu Cloudinary.
- Hiệu ứng intro, fade-in và bướm/hoa bay nhẹ.

## Cài đặt
```powershell
npm install --legacy-peer-deps
```

Nếu cài mới từng gói phụ trợ:
```powershell
npx expo install expo-status-bar expo-font expo-constants expo-linking react-native-worklets expo-camera expo-image-picker expo-clipboard expo-file-system
```

## Chạy backend
```powershell
npm run start-server
```

## Chạy Ollama
```powershell
ollama pull qwen2.5:1.5b
ollama run qwen2.5:1.5b
```

## Chạy Expo
```powershell
npx expo start -c
```

Nếu chạy trên điện thoại thật, sửa `.env`:
```env
EXPO_PUBLIC_API_URL=http://IP_MAY_TINH_CUA_BAN:4000
```
Ví dụ:
```env
EXPO_PUBLIC_API_URL=
```

## Backend env
`.env.server` đã có các biến:
- `MONGODB_URI`
- `GEMINI_API_KEY`
- `FOTOR_API_KEY`
- `OLLAMA_URL`
- `OLLAMA_MODEL`


## Bản v18 fix - Không Redux, Gemini combo, Fotor Try-on, Cloudinary media

- Đã bỏ Redux Toolkit/React Redux khỏi app để giảm remount màn hình và tránh lỗi bàn phím tự đóng sau mỗi ký tự.
- Trang chi tiết sản phẩm có mục **Gemini gợi ý set đi chung**: khi bấm vào một sản phẩm, app gợi ý các món phối chung như áo/quần, kiếm cosplay, kẹp tóc, phụ kiện và đạo cụ theo cùng một bộ.
- Kéo xuống trang chi tiết sẽ có nút **Thử đồ**. Nút này mở trang thử đồ với đúng sản phẩm đang xem làm món chính.
- Trang thử đồ hỗ trợ đưa ảnh người dùng bằng link, copy/paste clipboard, upload từ máy hoặc chụp trực tiếp bằng camera.
- Người dùng có thể chọn một món hoặc cả combo AI gợi ý, sau đó backend gọi Fotor Image Generation API để tạo ảnh người đó mặc bộ đồ đã chọn, sau đó lưu kết quả lên Cloudinary.
- Đã bỏ voice-to-text, faster-whisper, endpoint `/api/speech/transcribe`, nút nói và quyền microphone.
- Home đã đổi nút yêu thích/giỏ hàng thành icon-only và thêm nút thông báo kế bên.

## Bản v4 - AI phối đồ theo ảnh sản phẩm

- Đã thêm nhiều sản phẩm quần áo, đồ dùng, dụng cụ, phụ kiện và thẻ bài mới.
- Trang chi tiết sản phẩm có mục **AI Stylist**: gợi ý phối đồ/combo đi kèm dựa trên ảnh sản phẩm, màu sắc, form, subcategory và câu chuyện sản phẩm.
- Backend có endpoint mới: `GET /api/products/:id/style-suggestions?userId=...` để Gemini phân tích thêm khi có API key; nếu không gọi được Gemini thì app vẫn có fallback gợi ý local.
- `.env` đã đặt `EXPO_PUBLIC_API_URL=` theo IPv4 Wi-Fi bạn gửi. Nếu mạng đổi IP, sửa lại dòng này.

## Bản v6 - AI Search / Checkout / Seasonal Animation

Đã thêm trong bản này:

- Thanh tìm kiếm AI trên Home và Shop:
  - autocomplete realtime theo ký tự.
  - hiểu câu hỏi kiểu chatbot như: "hôm nay mặc gì đây", "đi Tết mặc gì", "mua quà 1/6".
  - ưu tiên sản phẩm trong MongoDB và có fallback local khi AI/Gemini quá quota.
  - API backend mới: `POST /api/search/suggest`.

- Quy trình đặt hàng chuyên nghiệp 4 bước:
  1. Thông tin nhận hàng.
  2. Chọn giao hàng.
  3. Chọn thanh toán.
  4. Xác nhận đơn.
  - Có tóm tắt đơn, phí ship, ưu đãi, ghi chú, lưu profile và lưu order vào MongoDB.

- Animation theo dịp lễ:
  - Auto theo dịp lễ.
  - Cờ bay cho 30/4, 1/5, 2/9, Giỗ Tổ Hùng Vương.
  - Lì xì / hoa đào / đèn lồng từ tháng 1 đến tháng 2 và dịp Tết.
  - Tuyết Noel, bong bóng 1/6, hoa 8/3 và 20/10, tri ân 20/11...
  - Trang Settings có ít nhất 12 animation để chọn.

- Đồng bộ web/mobile qua MongoDB vẫn giữ nguyên backend Node.js.

Lệnh chạy:

```bash
npm install
npm run start-server
npx expo start -c
```

Nếu chạy trên điện thoại thật, `.env` cần trỏ về IP máy tính:

```env
EXPO_PUBLIC_API_URL=
```

## Bản v7 - AI Search nâng cấp / Checkout chuyên nghiệp / 19 animation

- AI Search nâng cấp:
  - Nhập 1 ký tự như `a`, `á`, `p` là đã có gợi ý sản phẩm bên dưới.
  - Chuẩn hóa tiếng Việt không dấu để tìm `ao` vẫn ra `áo`, `tet` vẫn ra `Tết`.
  - Nhập câu tự nhiên như `hôm nay mặc gì đây`, `mua quà 1/6`, `đi 30/4 mặc gì` sẽ chuyển sang kiểu AI stylist, trả về set sản phẩm và lý do.
  - Từ Home bấm gợi ý AI sẽ đưa qua Shop kèm query để lọc tiếp.
  - Backend `/api/search/suggest` đã tăng độ thông minh, kết hợp MongoDB products + Gemini fallback + local fallback.

- Checkout nâng cấp theo luồng chuyên nghiệp:
  1. Địa chỉ nhận hàng.
  2. Giao hàng + ngày dự kiến.
  3. Thanh toán.
  4. Kiểm tra đơn hàng.
  - Có mã giảm giá `JAPANO`, gói quà, phí ship, ưu đãi đơn lớn, tóm tắt sản phẩm, ghi chú giao hàng, trạng thái COD/pending payment.
  - Thêm backend `/api/checkout/quote`, `/api/checkout/intent`, `/api/orders/:orderId/track` và idempotency key khi tạo đơn.

- Animation:
  - Tăng lên 19 animation pack.
  - Tự động đổi theo lễ: Tết tháng 1-2 dùng lì xì/đèn lồng; 30/4, 1/5, 2/9, Giỗ Tổ dùng cờ; Noel tuyết; 1/6 bong bóng; 8/3 và 20/10 hoa; sinh nhật/ngày cá nhân dùng thư/tim.
  - Settings vẫn cho chọn thủ công hoặc Auto.

- API key đã đồng bộ trong `.env.server` theo bản mới bạn đưa.

## JAPANO v18 - Gemini Outfit Suggestion + Fotor Try-On + Cloudinary

Bản hiện tại đã gỡ chức năng nói thành văn bản, gói ghi âm cũ và model local chuyển giọng nói. Chat chỉ còn nhập chữ, gửi ảnh/video/file và tạo ảnh concept. Chatbot chỉ nhớ tối đa 10 câu trả lời gần nhất trong phiên, không lưu lịch sử hội thoại xuống database.

Trang sản phẩm dùng Gemini để gợi ý set đi chung: món chính, áo/quần/phụ kiện/đạo cụ phù hợp. Trang thử đồ nhận ảnh bằng link, clipboard, upload hoặc camera rồi gọi Fotor API để tạo ảnh người mặc combo đã chọn. Tất cả ảnh/file/video người dùng upload và ảnh AI tạo ra đều được lưu qua Cloudinary.

Cài Vision AI nếu cần phân tích ảnh/video trong chat:

```powershell
pip install -r server/vision-requirements.txt
```

Cấu hình backend trong `.env.server`:

```env
GEMINI_API_KEY=your_gemini_key_here
GEMINI_TEXT_MODEL=gemini-2.0-flash
FOTOR_API_KEY=your_fotor_key_here
FOTOR_PROVIDER=gemini-3-pro-image-preview
FOTOR_TRYON_WIDTH=896
FOTOR_TRYON_HEIGHT=1152
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
PYTHON_BIN=python
EMOTION_MODEL_PATH=server/models/emotion_fulltrain_best_model.tflite
```
