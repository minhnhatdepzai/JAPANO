# PATCH V35 - Fix API timeout + web warning cleanup

## Lỗi chính trong log
Các dòng `Failed to load resource: net::ERR_CONNECTION_TIMED_OUT` ở `/api/products/bulk`, `/api/auth/login`, `/api/auth/register` là lỗi thật: app web không gọi được backend Node.js ở port `4000`.

Các dòng `textShadow*`, `shadow*`, `props.pointerEvents`, `useNativeDriver` là warning của React Native Web/Animated trong dev mode, không phải lỗi chặn đăng nhập. Bản này đã giảm/cố định các warning đó trên web.

## Đã sửa
- `lib/api.ts` không còn phụ thuộc IP LAN hardcode trong `.env` cho web.
- Web tự gọi backend theo host hiện tại: `http://localhost:4000` hoặc `http://<host-web>:4000`.
- Expo Go/dev build tự suy ra IP từ host Metro nếu `.env` để trống.
- Thêm timeout và thông báo lỗi backend rõ ràng thay vì treo lâu.
- Backend listen rõ trên `0.0.0.0` và in thêm LAN API URL khi chạy.
- `.env` để `EXPO_PUBLIC_API_URL=` để tránh giữ IP Wi-Fi cũ.
- `START_HERE_WINDOWS.bat` không ghi IP LAN cứng vào `.env` nữa.
- Thêm `RUN_WEB_ADMIN_WINDOWS.bat` để chạy riêng Web Admin + Backend.
- Sửa warning web:
  - `shadow*` -> `boxShadow` trên web.
  - `textShadow*` -> `textShadow` trên web.
  - `pointerEvents` prop -> style pointerEvents.
  - `useNativeDriver` tắt trên web, giữ trên mobile.

## Cách chạy web admin
1. Giải nén bản V35 ra thư mục mới.
2. Chạy `RUN_WEB_ADMIN_WINDOWS.bat`.
3. Mở `http://localhost:4000/api/health` để kiểm tra backend.
4. Mở web Expo và vào `/admin`.

## Nếu vẫn timeout
- Đóng terminal cũ, chạy lại `RUN_WEB_ADMIN_WINDOWS.bat`.
- Kiểm tra port 4000 có bị chặn không.
- Nếu chạy từ điện thoại, máy tính và điện thoại phải cùng Wi-Fi, Windows Firewall phải cho phép Node.js.
- Chạy Expo bằng `-c` để xóa cache env cũ.
