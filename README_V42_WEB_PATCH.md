# JAPANO V42 Web Patch

Mục tiêu: thêm giao diện web chạy cùng app Android hiện tại, dùng chung backend `:4000` và AI Gateway `:8001`.

## Copy file vào đâu?
Copy toàn bộ nội dung gói này vào gốc project:

```txt
C:\jp\v37
```

Sau khi copy, bạn sẽ có:

```txt
C:\jp\v37\app\web.tsx
C:\jp\v37\lib\v42WebApi.ts
C:\jp\v37\japano_web_v42\PATCH_V42_WEB_SERVER.ps1
C:\jp\v37\japano_web_v42\server_routes_v42_web.mjs
C:\jp\v37\RUN_WEB_APP_V42_WINDOWS.bat
C:\jp\v37\RUN_WEB_ONLY_V42_WINDOWS.bat
```

## Chạy nhanh

```powershell
cd C:\jp\v37
.\RUN_WEB_APP_V42_WINDOWS.bat
```

Mở web:

```txt
http://localhost:8081/web
```

Nếu Expo chọn port khác, xem cửa sổ `JAPANO Web Frontend`.

## Chức năng thêm

- Giao diện web dạng AI Studio.
- Link nhanh đến các trang Android/web sẵn có: Home, Try-on, Camera, Admin, Cart, Wishlist.
- Try-on bằng link ảnh: ảnh người + ảnh sản phẩm + nhiều ảnh phụ kiện.
- Camera web bằng webcam máy tính qua trình duyệt.
- Phân tích outfit bằng link ảnh nếu camera máy ảo không nhận webcam.
- Tạo ảnh realistic bằng local AI Gateway / SDXL-Turbo.
- Backend route mới `/api/v42/web/*`.

## Lưu ý

- Web dùng API: `http://localhost:4000`.
- Android emulator dùng API: `http://10.0.2.2:4000`.
- AI Gateway dùng: `http://127.0.0.1:8001`.
- Try-on CatVTON runner trong V41 vẫn là slot/scaffold. Nếu CatVTON chưa nối runner thật, web sẽ tạo preview realistic bằng SDXL local để không đứng luồng.
