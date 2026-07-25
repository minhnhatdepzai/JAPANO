# JAPANO V47 Selected Product + Shop Accessories

Bản này sửa đúng yêu cầu mới:

- Bỏ hẳn phần chọn ảnh sản phẩm / dán link ảnh sản phẩm.
- Ảnh đồ chính lấy từ sản phẩm người dùng đã bấm trong shop.
- Dùng ảnh đầu tiên của sản phẩm: `images[0]` hoặc `image`.
- Phụ kiện bổ sung lấy từ sản phẩm phụ kiện trong database shop.
- Phụ kiện hiển thị giống thẻ sản phẩm: ảnh, tên, giá.
- Người dùng chọn phụ kiện từ shop.
- Thêm phụ kiện seed: dù, khăn trùm đầu, bông tai, thắt lưng, kẹp tóc, túi tote.
- Thông tin gợi ý chỉ hiện sau khi người dùng thêm ảnh của họ.
- Bấm "Gợi ý phụ kiện từ shop" thì phụ kiện sẽ đổi theo ảnh người + món đồ chính.
- Tạo thử đồ chỉ dùng sản phẩm shop, không lấy ảnh ngoài.

## Ubuntu

Copy vào `/home/rd/Downloads/v37`, rồi chạy:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_APPLY_V47_SELECTED_PRODUCT_LINUX.sh
./RUN_APPLY_V47_SELECTED_PRODUCT_LINUX.sh
```

Restart backend:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Mở terminal mới seed phụ kiện:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_SEED_V47_EXTRA_ACCESSORIES_AFTER_BACKEND_LINUX.sh
./RUN_SEED_V47_EXTRA_ACCESSORIES_AFTER_BACKEND_LINUX.sh
```

Chạy app:

```bash
cd /home/rd/Downloads/v37
export EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"
npx expo start -c --dev-client
```

Nếu app không cập nhật:

```bash
npx expo run:android
```

## Cách truyền sản phẩm từ trang sản phẩm sang thử đồ

Ở nút "Thử đồ" trong thẻ/chi tiết sản phẩm, nên gọi:

```ts
router.push({
  pathname: '/thu-do-ai-v47-selected-product',
  params: { productId: product._id || product.id }
});
```

Nếu route cũ của bạn là `/try-on` hoặc `/thu-do-ai`, vẫn được nếu script đã thay screen cũ sang V47.
