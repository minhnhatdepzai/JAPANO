# JAPANO V45 Shop Try-on Patch

Bản này sửa đúng logic shop:

- Ảnh người: người dùng tự chọn/chụp.
- Ảnh đồ mẫu / sản phẩm / phụ kiện: lấy từ sản phẩm đang bán trong database shop.
- Không yêu cầu dán link sản phẩm bên ngoài.
- Mỗi sản phẩm lấy ảnh đầu tiên: `product.images[0]` hoặc `product.image`.
- AI gợi ý sản phẩm từ database shop.
- Đồ chính: quần, áo, váy, bikini, giày...
- Phụ kiện: dây chuyền, đồng hồ, túi xách, kính, nón...
- Khi tạo thử đồ: người dùng là ảnh gốc, sản phẩm shop được mặc/gắn lên người dùng.
- Nếu AI trả nhiều ảnh lệch nhau: lấy ảnh đầu tiên làm final.

## Copy vào đâu?

Copy toàn bộ vào gốc project V37:

Ubuntu:
`/home/rd/Downloads/v37`

Windows:
`C:\jp\v37`

## Chạy Ubuntu

```bash
cd /home/rd/Downloads/v37
chmod +x RUN_APPLY_V45_SHOP_TRYON_LINUX.sh
./RUN_APPLY_V45_SHOP_TRYON_LINUX.sh
```

Sau đó restart backend và app.

## Chạy Windows

```powershell
cd C:\jp\v37
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\RUN_APPLY_V45_SHOP_TRYON_WINDOWS.bat
```

Sau đó restart backend và app.
