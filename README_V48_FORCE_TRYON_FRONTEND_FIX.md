# JAPANO V48 Force Try-on Frontend Fix

Bản này sửa mạnh phần FRONT-END, đúng yêu cầu:

- Bỏ hoàn toàn phần:
  - Ảnh sản phẩm / đồ mẫu
  - Chọn ảnh sản phẩm
  - Dán link ảnh sản phẩm
- Sản phẩm chính là món người dùng đã bấm trong shop.
- Ảnh đồ chính = ảnh đầu tiên của sản phẩm trong database.
- Phụ kiện bổ sung lấy từ sản phẩm phụ kiện trong shop.
- Phụ kiện hiển thị bằng card có ảnh, tên, giá tiền.
- Thêm phụ kiện mẫu: dù, dây chuyền, khăn trùm đầu, đồng hồ, túi, kính, bông tai, thắt lưng, kẹp tóc.
- Phần thông tin gợi ý chỉ xuất hiện sau khi người dùng thêm ảnh của họ.
- Bấm "Gợi ý phụ kiện từ shop" thì danh sách phụ kiện đổi theo ảnh người + món đồ chính.
- Script sẽ ép thay các screen cũ còn chứa text "Chọn ảnh sản phẩm".

## Chạy trên Ubuntu

Copy toàn bộ vào `/home/rd/Downloads/v37`, rồi chạy:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_APPLY_V48_FORCE_TRYON_FRONTEND_LINUX.sh
./RUN_APPLY_V48_FORCE_TRYON_FRONTEND_LINUX.sh
```

Restart backend:

```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Seed phụ kiện nếu lúc patch backend chưa chạy:

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_SEED_V48_EXTRA_ACCESSORIES_AFTER_BACKEND_LINUX.sh
./RUN_SEED_V48_EXTRA_ACCESSORIES_AFTER_BACKEND_LINUX.sh
```

Chạy app:

```bash
cd /home/rd/Downloads/v37
export EXPO_PUBLIC_API_URL="http://10.0.2.2:4000"
npx expo start -c --dev-client
```

Nếu vẫn hiện UI cũ, rebuild:

```bash
npx expo run:android
```

## Nếu vẫn thấy UI cũ

Chạy:

```bash
cd /home/rd/Downloads/v37
grep -RIn "Chọn ảnh sản phẩm\|Hoặc dán link ảnh sản phẩm\|Ảnh sản phẩm / đồ mẫu" app src components 2>/dev/null
```

Gửi kết quả đó.
