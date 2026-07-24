# PATCH V29 - Admin panel + quyền admin

## Đã thêm

- Trang `app/admin.tsx`.
- Nút mở trang Admin ở `Profile` và `Settings` khi tài khoản đang đăng nhập có `role = admin`.
- Backend tự seed 2 tài khoản admin mặc định khi chạy server:
  - `a@gmail.com` / mật khẩu `1`
  - `lnhat1938@gmail.com` / mật khẩu `1`
- API admin:
  - `GET /api/admin/overview?adminId=...`
  - `GET /api/admin/users?adminId=...`
  - `PATCH /api/admin/users/:targetUserId/role`
- Trang admin hiện có:
  - Tổng quan số lượng collection đúng ERD.
  - Danh sách user.
  - Cấp quyền admin cho tài khoản customer.
  - Gỡ quyền admin an toàn.

## Luật quyền

- Chỉ user có `role: admin` mới mở được API admin.
- Admin có thể cấp quyền admin cho user khác.
- Admin có thể gỡ quyền admin của user khác, nhưng:
  - Không được tự gỡ quyền admin của chính mình.
  - Không được gỡ quyền của 2 admin mặc định.
  - Không được gỡ admin cuối cùng của hệ thống.
- Quyền admin được lưu trong collection `users`, không tạo thêm collection ngoài ERD.

## Lưu ý

Nếu tài khoản đã được lưu cache trong app trước đó, hãy đăng xuất/đăng nhập lại để app lấy `role` mới từ backend.
