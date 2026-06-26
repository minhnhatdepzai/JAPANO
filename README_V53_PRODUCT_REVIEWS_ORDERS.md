# JAPANO V53 - Product Reviews + Admin Order Success/Cancel

Bản này thêm:

1. Review sản phẩm ở trang chi tiết sản phẩm.
2. Chỉ user đã mua sản phẩm và đơn hàng đã thành công/thanh toán thành công mới được review.
3. Chưa mua hoặc thanh toán/chốt đơn chưa thành công thì bị chặn review.
4. Có review ảo hiển thị để sản phẩm không bị trống đánh giá.
5. Admin có nút xác nhận đơn hàng thành công và hủy đơn nhanh.
6. Sau khi admin xác nhận thành công, khách có thể review sản phẩm trong đơn đó.

## Chạy

Copy zip vào `/home/rd/Downloads/v37`, rồi chạy:

```bash
cd /home/rd/Downloads/v37
unzip -o JAPANO_V53_PRODUCT_REVIEWS_ORDERS.zip
chmod +x RUN_APPLY_V53_PRODUCT_REVIEWS_ORDERS_LINUX.sh
./RUN_APPLY_V53_PRODUCT_REVIEWS_ORDERS_LINUX.sh
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

## API mới

- `GET /api/products/:productId/reviews?userId=...`
- `GET /api/products/:productId/review-eligibility?userId=...`
- `POST /api/products/:productId/reviews`
- `PATCH /api/admin/orders/:orderId/status`
- `PATCH /api/admin/orders/:orderId/success`
- `PATCH /api/admin/orders/:orderId/cancel`

## Luồng đúng

1. User đặt hàng.
2. Admin vào trang admin → Orders / Payments.
3. Bấm `Xác nhận thành công`.
4. Đơn chuyển sang `completed`, payment chuyển `paid`.
5. User mở sản phẩm đã mua → được review.
6. Nếu admin bấm `Hủy nhanh`, user không được review.
