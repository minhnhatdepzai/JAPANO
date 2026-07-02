# JAPANO V43 Web Full Patch

Bản này sửa phần Web để có:
- Trang sản phẩm hiển thị trực tiếp trên web, không phụ thuộc điều hướng Android.
- Seed thêm sản phẩm + ảnh sản phẩm mẫu vào database.
- Try-on web có 3 kiểu input: chọn ảnh từ máy, dán link ảnh, chụp webcam.
- Try-on hỗ trợ ảnh người, ảnh sản phẩm, nhiều link phụ kiện.
- Camera web dùng webcam máy tính, chụp frame, gửi backend phân tích emotion/age/style và gợi ý sản phẩm.
- Camera web cũng có chế độ dán link ảnh nếu webcam không hoạt động.
- Backend route V43 riêng: /api/v43/web/* để không phá route Android cũ.

## Copy vào đâu?

Copy toàn bộ nội dung trong folder này vào gốc project:

C:\jp\v37

Sau khi copy xong sẽ có:

C:\jp\v37\app\web.tsx
C:\jp\v37\japano_web_v43\PATCH_V43_WEB_SERVER.ps1
C:\jp\v37\japano_web_v43\server_routes_v43_web_block.mjs
C:\jp\v37\RUN_WEB_APP_V43_WINDOWS.bat

## Chạy

Mở PowerShell tại C:\jp\v37:

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\RUN_WEB_APP_V43_WINDOWS.bat

Sau đó mở:

http://localhost:8081/web

## Nếu backend đang chạy sẵn

Tắt terminal backend cũ rồi chạy RUN_WEB_APP_V43_WINDOWS.bat lại, hoặc chạy patch trước rồi khởi động backend lại.

## Ghi chú

- Emotion/age là ước lượng từ model ảnh, chỉ dùng để gợi ý phong cách. Không dùng để xác minh danh tính/tuổi thật.
- Try-on local thật phụ thuộc CatVTON runner. Nếu CatVTON chưa nối runner, route V43 sẽ fallback về preview/AI prompt để web không bị đứng luồng.
