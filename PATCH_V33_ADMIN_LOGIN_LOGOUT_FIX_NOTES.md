# PATCH V33 - Admin login/logout fix

## Đã sửa

1. **Đăng nhập từ trang Admin quay lại đúng `/admin`**
   - `app/admin.tsx`: nút đăng nhập admin mở `/login` kèm `redirectTo=/admin`.
   - `app/login.tsx`: sau khi login thành công, nếu có `redirectTo` an toàn thì `router.replace()` về đúng trang đó.

2. **Chống lỗi logout xong user cũ tự hiện lại**
   - `context/AppContext.tsx`: thêm session guard bằng `sessionRef`.
   - Nếu logout/login xảy ra trong lúc app đang hydrate dữ liệu remote, request cũ sẽ không được phép ghi ngược lại user/cart/wishlist/orders.

3. **Logout dọn dữ liệu local sạch hơn**
   - Xoá user, cart, wishlist, orders, generated images, search history và last route local.
   - Tránh app restore lại trang admin cũ khi đã đăng xuất.

## Cách test nhanh

1. Chạy backend: `npm run start-server`
2. Chạy app/web: `npm run web` hoặc `npm run expo-go`
3. Vào `/admin`.
4. Bấm đăng nhập admin.
5. Đăng nhập bằng tài khoản demo: `a@gmail.com` / `1`.
6. App phải quay lại đúng trang Admin.
7. Đăng xuất ở trang Profile, sau đó đăng nhập admin lại và mở `/admin` bình thường.

## Ghi chú

- Backend chính của project vẫn là `server/index.mjs` theo `package.json`.
- Đã kiểm tra cú pháp Node cho `server/index.mjs` và `server/index.js`.
