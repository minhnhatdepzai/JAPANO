# JAPANO — Backend, Web Admin và Mobile

JAPANO là monorepo thời trang Nhật gồm:

```text
japano/
├── backend/   Express API, dữ liệu JSON, dự đoán/gợi ý và thử đồ
├── admin/     Web quản trị được backend phục vụ trực tiếp
└── mobile/    React Native + Expo Router
```

## Chạy tất cả trên Android bằng một lệnh

Yêu cầu: Node.js 20+, npm, Android Studio/SDK, một emulator đã khởi động, FASHN VTON 1.5 tại `~/jp/ai/fashn-vton-1.5` và FLUX.2 Klein 4B tại `~/jp/ai/FLUX.2-klein-4B` (máy hiện tại đã được cài). Từ thư mục dự án chạy:

```bash
./start-all.sh
```

Script sẽ:

1. Chỉ chạy `npm install` khi dependencies đang thiếu hoặc sai phiên bản.
2. Khởi động FASHN VTON 1.5 + FLUX.2 pose editor ở cổng `7862` (model được nạp tuần tự để vừa VRAM 16 GB). Trước lượt thử đồ, model Ollama đang giữ GPU được unload khỏi VRAM rồi tự load lại khi chatbot/vision cần; không xóa model.
3. Khởi động backend ở cổng `4100`, hoặc dùng lại đúng backend JAPANO đã chạy ở cổng đó.
4. Phục vụ Web Admin tại <http://localhost:4100>.
5. Chọn Android emulator đang online, cấu hình `adb reverse` cho API/Metro và mở app bằng Expo.

Nhấn `Ctrl+C` để dừng Expo. Backend và dịch vụ thử đồ cũng được dừng nếu chính script đã khởi động chúng. Log nằm ở `/tmp/japano-backend-4100.log` và `/tmp/japano-fashn-7862.log`.

Các biến hữu ích:

```bash
# Chọn thiết bị khi adb đang thấy nhiều thiết bị
JAPANO_ANDROID_SERIAL=emulator-5554 ./start-all.sh

# Xoá Metro cache khi app có cache cũ
JAPANO_EXPO_CLEAR=1 ./start-all.sh

# Dùng cổng khác
PORT=4200 ./start-all.sh
```

## Chạy và kiểm tra từng phần

Backend + Web Admin:

```bash
PORT=4100 npm run backend
```

Mobile trên Android emulator, khi backend đã chạy:

```bash
EXPO_USE_METRO_WORKSPACE_ROOT=1 EXPO_PUBLIC_API_URL=http://10.0.2.2:4100 npm --workspace mobile run android -- --localhost
```

Kiểm tra source và API:

```bash
npm run check       # unit test backend + TypeScript mobile
npm run verify      # smoke test API đang chạy
npm run verify:ai   # thêm thử đồ, AI vision và lộ trình mục tiêu
```

Nếu dùng điện thoại Android thật qua USB, `start-all.sh` ưu tiên `adb reverse`. Nếu cần dùng Wi-Fi, đặt URL LAN của máy tính:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4100 ./start-all.sh
```

## Địa chỉ mặc định

- Web Admin: <http://localhost:4100>
- API: <http://localhost:4100/api>
- Health: <http://localhost:4100/api/health>
- Android emulator không dùng script: `http://10.0.2.2:4100`

Mobile cũng có dữ liệu catalog dự phòng khi API tạm mất kết nối, nhưng đặt hàng, lịch sử hành vi, gợi ý cá nhân và dashboard Admin cần backend.

## Chức năng đã nối

- Sản phẩm, đơn hàng, người dùng và cấu hình Admin dùng chung dữ liệu `backend/data/db.json`.
- Dashboard có dự báo doanh thu ensemble, dự báo nhu cầu/tồn kho, phân khúc và rủi ro khách hàng, xu hướng danh mục, luật mua kèm.
- Gợi ý cá nhân kết hợp Matrix Factorization, item-based CF, hồ sơ nội dung, xu hướng theo thời gian và market basket.
- Trợ lý Ori dùng catalog thật; thẻ sản phẩm và nút mua điều hướng tới đúng trang chi tiết.
- Qwen3-VL nhìn ảnh catalog và tạo mô tả bám đúng tiêu đề; luôn có fallback không bịa chất liệu.
- Mục tiêu mua sắm & làm đẹp kết hợp ngân sách, SMART goals, thói quen nếu–thì và giới hạn giảm cân an toàn.
- Thử đồ dùng FASHN VTON 1.5; mặc định mọi ảnh đều được FLUX.2 Klein 4B đưa riêng nhân vật chính về pose catalog trước (`JAPANO_FORCE_REPOSE=1`). YOLO Pose khóa đúng một nhân vật chính, kiểm tra ảnh không đổi người phụ và chặn kết quả dạng tấm vải/mờ trước khi trả về app. Nón được đội lên đầu, ô được neo vào cổ tay ở phía không che người phụ.

Dùng `.env.example` làm danh sách biến tham khảo và export biến cần thiết khi đổi cổng/dịch vụ AI. Có thể đặt `JAPANO_SKIP_FASHN=1` để chỉ mở phần còn lại; khi đó tính năng thử đồ sẽ báo chưa có engine thay vì trả ảnh ghép giả.
