# JAPANO V44 Mobile Try-on Fix

Mục tiêu:
- Bỏ popup demo-mode kiểu "AI thử đồ chưa chạy được".
- Dùng ảnh người dùng làm ảnh gốc, mặc đồ từ ảnh mẫu/sản phẩm lên người dùng.
- Thêm slot phụ kiện: dây chuyền, đồng hồ, túi xách, kính, giày.
- Có thêm nhập link ảnh hoặc chọn ảnh từ máy/điện thoại.
- Ưu tiên giữ gương mặt/người trong ảnh đầu tiên làm anchor.
- Nếu nhiều output không giống nhau, lấy ảnh đầu tiên làm final fallback.
- Có gợi ý size/phụ kiện/phong cách.
- Hỗ trợ đồ bơi/crop-top với adult fashion hợp lệ.

## Copy vào đâu?
Copy toàn bộ nội dung vào gốc project V37.

## Chạy patch server
Windows:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\RUN_PATCH_V44_TRYON_WINDOWS.bat

Ubuntu:
chmod +x RUN_PATCH_V44_TRYON_LINUX.sh
./RUN_PATCH_V44_TRYON_LINUX.sh

## Tích hợp vào screen cũ
Tìm file screen hiện tại có tiêu đề "Thử đồ AI". Thay nội dung bằng:
export { default } from './thu-do-ai-v44';

Hoặc copy logic từ app/thu-do-ai-v44.tsx vào screen cũ.
