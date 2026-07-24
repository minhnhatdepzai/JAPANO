# JAPANO V54 - Frontend Reviews + Size/Color Selection

V54 cập nhật frontend:

- Trang chi tiết sản phẩm có phần **Đánh giá sản phẩm**.
- Hiển thị review ảo + review thật từ backend.
- Chỉ user có đơn thành công mới gửi review được.
- Thêm chọn **màu sắc** và **size** trước khi:
  - Thêm giỏ
  - Mua ngay
  - Thử đồ AI
- Trang thử đồ cũng có chọn **màu sắc** và **size**, và gửi `selectedSize`, `selectedColor`, `selectedVariantId` qua backend.
- Không đụng vào CatVTON / Torch.

## Chạy

```bash
cd /home/rd/Downloads/v37
unzip -o JAPANO_V54_FRONTEND_REVIEWS_SIZE_COLOR.zip
chmod +x RUN_APPLY_V54_FRONTEND_REVIEWS_SIZE_COLOR_LINUX.sh
./RUN_APPLY_V54_FRONTEND_REVIEWS_SIZE_COLOR_LINUX.sh
```

Restart backend:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_CATVTON_URL="http://127.0.0.1:7861"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Restart Android:

```bash
cd /home/rd/Downloads/v37
export EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"
npx expo start -c --dev-client
```

Bấm `a`.
