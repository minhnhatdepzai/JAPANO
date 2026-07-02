# JAPANO V49 Shopee Try-on UI Fix

Bản này sửa đúng flow:

## Flow thử đồ
1. Người dùng bấm vào sản phẩm họ thích trong shop.
2. Ở trang chi tiết sản phẩm, người dùng kéo xuống và bấm "Thử đồ AI".
3. Trang thử đồ tự nhận sản phẩm đó.
4. Ảnh đồ chính = ảnh đầu tiên của sản phẩm trong database.
5. Không còn chọn ảnh sản phẩm, không còn dán link ảnh sản phẩm.
6. Người dùng thêm ảnh của họ.
7. Lúc này phần quiz size + gợi ý mới xuất hiện.
8. Người dùng bấm "Gợi ý size & phụ kiện từ shop".
9. Phụ kiện trong shop được sắp xếp lại theo ảnh người + món đồ.
10. Người dùng chọn hoặc bỏ chọn phụ kiện.
11. Nếu chọn phụ kiện, kết quả sẽ thử đồ và gắn/cầm/đeo/mang phụ kiện đó.

## Giao diện sản phẩm
Có thêm screen Shopee-like:
- ảnh sản phẩm lớn
- ảnh phụ
- giá / giá gốc / giảm giá
- chọn màu
- chọn size S, M, L, XL, 2XL, 3XL
- bảng kích thước
- quiz gợi ý size
- nút Thêm giỏ / Thử đồ AI / Mua ngay
- nút quay lại

## Network request failed
V49 API tự thử nhiều base URL:
- EXPO_PUBLIC_API_URL
- http://10.0.2.2:4000
- http://127.0.0.1:4000
- http://localhost:4000

Nếu backend chưa chạy, UI vẫn mở bằng dữ liệu fallback để không chết màn hình.

## Ubuntu

Copy vào `/home/rd/Downloads/v37`, rồi chạy:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_APPLY_V49_SHOPEE_TRYON_UI_LINUX.sh
./RUN_APPLY_V49_SHOPEE_TRYON_UI_LINUX.sh
```

Restart backend:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Seed phụ kiện:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_SEED_V49_ACCESSORIES_AFTER_BACKEND_LINUX.sh
./RUN_SEED_V49_ACCESSORIES_AFTER_BACKEND_LINUX.sh
```

Chạy app:

```bash
cd /home/rd/Downloads/v37
export EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"
npx expo start -c --dev-client
```

Nếu UI vẫn cũ:

```bash
npx expo run:android
```

## Gắn nút thử đồ từ product detail/card

Nút thử đồ nên truyền productId hoặc product JSON:

```ts
router.push({
  pathname: '/thu-do-ai-v49-shop-flow',
  params: {
    productId: product._id || product.id,
    product: encodeURIComponent(JSON.stringify(product)),
  },
});
```

## Kiểm tra còn UI cũ

```bash
cd /home/rd/Downloads/v37
grep -RIn "Chọn ảnh sản phẩm\|Hoặc dán link ảnh sản phẩm\|Ảnh sản phẩm / đồ mẫu" app src components 2>/dev/null
```
