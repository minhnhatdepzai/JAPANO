# Patch ERD + Square UI

Đã chỉnh theo yêu cầu:

1. Bỏ bo góc giao diện
   - `lib/styles.ts`: toàn bộ `radius` = 0.
   - Các style `borderRadius` hard-code trong `app/`, `components/`, `context/`, `lib/` đã chuyển về `0`.

2. Dọn database backend theo ERD
   - File chính: `server/index.mjs` và `server/index.js`.
   - Bỏ kiểu schema lỏng `strict: false` ở backend chính.
   - Thêm các collection đúng luồng ERD: Categories, Products, ProductVariants, ProductImages, Colors, Sizes, Users, Cart, Wishlist, Notifications, ForgotPassword, Reviews, Orders, OrderItems, DiscountCodes, Payments, AIChat.
   - Cart/Wishlist/Orders không còn lưu mảng object làm nguồn chính; backend lưu theo row chuẩn hoá và chỉ hydrate `items` khi trả về app để frontend cũ không vỡ.

3. Tài liệu schema
   - Xem `DATABASE_ERD_SCHEMA.md` để biết bảng/collection và field đã map theo ERD.

Kiểm tra đã chạy:
- `node --check server/index.mjs`: OK.

Lưu ý:
- Chưa chạy được build Expo/TypeScript đầy đủ trong sandbox vì project không có `node_modules` và thiếu `expo/tsconfig.base` khi kiểm tra bằng `tsc`.
- Khi chạy trên máy thật, chạy lại `npm install --legacy-peer-deps`, sau đó `npm run start-server` và Expo như bình thường.
