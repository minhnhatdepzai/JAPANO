# JAPANO V50 Force Image Output Fix

Lỗi hiện tại:
- App gọi backend OK.
- Backend gọi AI Gateway.
- AI Gateway không trả `imageBase64`.
- Vì vậy app báo: "AI Gateway chưa trả ảnh".

Nguyên nhân thường gặp:
1. Bạn đang không chạy AI Gateway ở `http://127.0.0.1:8001`.
2. Gateway có `/health` nhưng chưa có endpoint tạo ảnh thật `/tryon/advanced`.
3. Gateway có endpoint nhưng model tạo ảnh / try-on chưa cài, nên trả `ok=false` hoặc không có `imageBase64`.
4. Bạn đã bỏ thư mục AI nên không còn model thật để sinh ảnh.

V50 sửa:
- Chèn route ưu tiên vào backend ở đúng endpoint app đang gọi:
  `POST /api/v49/mobile/tryon-selected-product`
- Backend vẫn thử gọi AI Gateway trước.
- Nếu Gateway không trả ảnh, backend dùng Python/Pillow tạo ảnh preview fallback.
- App sẽ luôn có ảnh trả về, không còn trắng/trống.
- Ảnh fallback không phải AI try-on thật 100%, nhưng giúp flow không chết.
- Muốn ảnh AI thật thì vẫn cần cài Gateway/model tạo ảnh.

## Chạy trên Ubuntu

Copy toàn bộ vào `/home/rd/Downloads/v37`, rồi chạy:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_APPLY_V50_FORCE_IMAGE_OUTPUT_LINUX.sh
./RUN_APPLY_V50_FORCE_IMAGE_OUTPUT_LINUX.sh
```

Restart backend:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Mở terminal mới test:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_TEST_V50_BACKEND_HEALTH_LINUX.sh
./RUN_TEST_V50_BACKEND_HEALTH_LINUX.sh
```

Sau đó mở app và bấm tạo thử đồ lại.

## Nếu muốn kiểm tra route bằng curl

Cần ảnh base64 nên test bằng app là nhanh nhất.

## Nếu vẫn báo lỗi

Gửi log terminal backend tại thời điểm bấm "Tạo thử đồ".
Tìm các dòng có:
- `[V50]`
- `local preview`
- `gateway`
- `Pillow`
- `spawn`
