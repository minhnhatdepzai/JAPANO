# JAPANO V46 Seed Shop Products

Gói này thêm 26 sản phẩm mẫu vào database shop.

Điểm quan trọng:
- Ảnh đầu tiên của mỗi sản phẩm là ảnh chính để V45 Shop Try-on dùng.
- Ảnh 2/3/4 là ảnh phụ, dùng placeholder cũng được.
- Có cả quần áo, đồ bơi, giày, dây chuyền, đồng hồ, túi, kính, nón, vòng tay.
- V45 sẽ lấy các sản phẩm này từ database shop để gợi ý và thử đồ.

## Ubuntu

Copy toàn bộ vào:
`/home/rd/Downloads/v37`

Chạy patch:
```bash
cd /home/rd/Downloads/v37
chmod +x RUN_APPLY_V46_SEED_SHOP_PRODUCTS_LINUX.sh
./RUN_APPLY_V46_SEED_SHOP_PRODUCTS_LINUX.sh
```

Restart backend:
```bash
cd /home/rd/Downloads/v37
source .venv/bin/activate
export PYTHON_BIN="$PWD/.venv/bin/python"
export JAPANO_AI_GATEWAY_URL="http://127.0.0.1:8001"
npm run start-server
```

Mở terminal mới để seed:
```bash
cd /home/rd/Downloads/v37
chmod +x RUN_SEED_V46_PRODUCTS_AFTER_BACKEND_LINUX.sh
./RUN_SEED_V46_PRODUCTS_AFTER_BACKEND_LINUX.sh
```

Kiểm tra:
```bash
curl http://127.0.0.1:4000/api/v45/shop/products
```

## Windows

Copy toàn bộ vào:
`C:\jp\v37`

Patch:
```powershell
cd C:\jp\v37
.\RUN_APPLY_V46_SEED_SHOP_PRODUCTS_WINDOWS.bat
```

Restart backend rồi chạy:
```powershell
.\RUN_SEED_V46_PRODUCTS_AFTER_BACKEND_WINDOWS.bat
```
